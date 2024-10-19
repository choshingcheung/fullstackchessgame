# app.py

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
import chess
import uuid

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chess_games.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'your-secret-key'  # Change this to a secure random key in production

db = SQLAlchemy(app)
jwt = JWTManager(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)

class Game(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    white_player_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    black_player_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    fen = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='open')  # 'open', 'in_progress', 'completed'


with app.app_context():
    db.create_all()

@app.route('/register', methods=['POST'])
def register():
    username = request.json.get('username', None)
    password = request.json.get('password', None)
    if not username or not password:
        return jsonify({"msg": "Missing username or password"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"msg": "Username already exists"}), 400
    new_user = User(username=username, password_hash=generate_password_hash(password))
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"msg": "User created successfully"}), 201

@app.route('/login', methods=['POST'])
def login():
    username = request.json.get('username', None)
    password = request.json.get('password', None)
    user = User.query.filter_by(username=username).first()
    if user and check_password_hash(user.password_hash, password):
        access_token = create_access_token(identity=username)
        return jsonify(access_token=access_token), 200
    return jsonify({"msg": "Bad username or password"}), 401

@app.route('/new_game', methods=['POST'])
@jwt_required()
def new_game():
    current_username = get_jwt_identity()
    current_user = User.query.filter_by(username=current_username).first()
    if not current_user:
        return jsonify({"msg": "User not found"}), 404

    game_id = str(uuid.uuid4())
    new_game = Game(id=game_id, white_player_id=current_user.id, fen=chess.Board().fen(), status='open')
    db.session.add(new_game)
    db.session.commit()
    
    return jsonify({"game_id": game_id, "msg": "New game created successfully"}), 201

@app.route('/join_game/<game_id>', methods=['POST'])
@jwt_required()
def join_game(game_id):
    try:
        current_user = User.query.filter_by(username=get_jwt_identity()).first()
        if not current_user:
            return jsonify({"msg": "Current user not found"}), 404

        game = Game.query.get(game_id)
        if not game:
            return jsonify({"msg": "Game not found"}), 404

        if game.status != 'open':
            return jsonify({"msg": "This game is not open for joining"}), 400

        if game.white_player_id == current_user.id:
            return jsonify({"msg": "You cannot join your own game"}), 400

        game.black_player_id = current_user.id
        game.status = 'in_progress'
        db.session.commit()

        return jsonify({"msg": "Successfully joined the game"}), 200
    except Exception as e:
        logging.error(f"Error joining game: {str(e)}")
        db.session.rollback()
        return jsonify({"msg": f"An error occurred: {str(e)}"}), 500

@app.route('/open_games', methods=['GET'])
@jwt_required()
def get_open_games():
    try:
        open_games = Game.query.filter_by(status='open').all()
        games_list = [{
            'id': game.id,
            'white_player': User.query.get(game.white_player_id).username
        } for game in open_games]
        return jsonify(games_list), 200
    except Exception as e:
        logging.error(f"Error fetching open games: {str(e)}")
        return jsonify({"msg": f"An error occurred: {str(e)}"}), 500

@app.route('/get_games', methods=['GET'])
@jwt_required()
def get_games():
    current_username = get_jwt_identity()
    current_user = User.query.filter_by(username=current_username).first()
    if not current_user:
        return jsonify({"msg": "User not found"}), 404
    
    games = Game.query.filter((Game.white_player_id == current_user.id) | (Game.black_player_id == current_user.id)).all()
    return jsonify([{"id": game.id, "white_player": game.white_player_id, "black_player": game.black_player_id, "status": game.status} for game in games]), 200

@app.route('/get_board/<game_id>', methods=['GET'])
@jwt_required()
def get_board(game_id):
    game = Game.query.get(game_id)
    if not game:
        return jsonify({"msg": "Game not found"}), 404
    board = chess.Board(game.fen)
    return jsonify({
        'fen': board.fen(),
        'legal_moves': [move.uci() for move in board.legal_moves],
        'is_game_over': board.is_game_over(),
        'result': board.result() if board.is_game_over() else None
    })

@app.route('/make_move/<game_id>', methods=['POST'])
@jwt_required()
def make_move(game_id):
    game = Game.query.get(game_id)
    if not game:
        return jsonify({"msg": "Game not found"}), 404
    move = request.json['move']
    board = chess.Board(game.fen)
    try:
        board.push_san(move)
        game.fen = board.fen()
        db.session.commit()
        return jsonify({'success': True, 'fen': game.fen})
    except ValueError:
        return jsonify({'success': False, 'error': 'Invalid move'})

if __name__ == '__main__':
    with app.app_context():
        db.create_all()  # This will create tables that don't exist yet
    app.run(debug=True)