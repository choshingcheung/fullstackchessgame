# Detailed Chess Game Development Guide

This guide provides an in-depth explanation of every function and program in our Chess Game project.

## Backend (app.py)

### Imports and Setup

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from flask_migrate import Migrate
import chess
import uuid
```

These lines import necessary modules:
- `Flask`: The core framework for our web application
- `CORS`: Allows cross-origin requests, necessary for our frontend to communicate with the backend
- `SQLAlchemy`: ORM for database operations
- `JWTManager`: Handles JSON Web Tokens for authentication
- `werkzeug.security`: Provides password hashing functionality
- `Migrate`: Handles database migrations
- `chess`: A library for chess move validation
- `uuid`: Generates unique identifiers for our games

```python
app = Flask(__name__)
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///chess_games.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'your-secret-key'  # Change this in production

db = SQLAlchemy(app)
jwt = JWTManager(app)
migrate = Migrate(app, db)
```

This code initializes our Flask application, sets up CORS, configures the database, and initializes JWT and database migration.

### Database Models

```python
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)

class Game(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    white_player_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    black_player_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    fen = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), nullable=False, default='open')
```

These classes define our database models:
- `User`: Represents a user with an id, username, and hashed password
- `Game`: Represents a chess game with players, the current board state (in FEN notation), and game status

### API Routes

#### User Registration

```python
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
```

This route handles user registration:
1. It checks if both username and password are provided
2. It checks if the username already exists
3. If all checks pass, it creates a new user with a hashed password

#### User Login

```python
@app.route('/login', methods=['POST'])
def login():
    username = request.json.get('username', None)
    password = request.json.get('password', None)
    user = User.query.filter_by(username=username).first()
    if user and check_password_hash(user.password_hash, password):
        access_token = create_access_token(identity=username)
        return jsonify(access_token=access_token), 200
    return jsonify({"msg": "Bad username or password"}), 401
```

This route handles user login:
1. It checks if the username exists
2. If the user exists, it checks if the provided password matches the stored hash
3. If authentication is successful, it creates and returns a JWT

#### Create New Game

```python
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
```

This route creates a new game:
1. It gets the current user from the JWT
2. It creates a new game with the current user as the white player
3. It uses the `chess` library to set up the initial board state

#### Get Games

```python
@app.route('/get_games', methods=['GET'])
@jwt_required()
def get_games():
    current_username = get_jwt_identity()
    current_user = User.query.filter_by(username=current_username).first()
    if not current_user:
        return jsonify({"msg": "User not found"}), 404
    
    games = Game.query.filter((Game.white_player_id == current_user.id) | (Game.black_player_id == current_user.id)).all()
    return jsonify([{"id": game.id, "white_player": game.white_player_id, "black_player": game.black_player_id, "status": game.status} for game in games]), 200
```

This route retrieves all games for the current user:
1. It gets the current user from the JWT
2. It queries the database for all games where the user is either the white or black player

#### Join Game

```python
@app.route('/join_game/<game_id>', methods=['POST'])
@jwt_required()
def join_game(game_id):
    current_username = get_jwt_identity()
    current_user = User.query.filter_by(username=current_username).first()
    if not current_user:
        return jsonify({"msg": "User not found"}), 404

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
```

This route allows a user to join an existing game:
1. It gets the current user from the JWT
2. It checks if the game exists and is open for joining
3. If all checks pass, it adds the current user as the black player and updates the game status

#### Get Board State

```python
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
```

This route retrieves the current state of a game:
1. It gets the game from the database
2. It uses the `chess` library to create a board from the stored FEN
3. It returns the current board state, legal moves, and game status

#### Make Move

```python
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
```

This route handles making a move in a game:
1. It gets the game from the database
2. It creates a chess board from the stored FEN
3. It attempts to make the move using the `chess` library
4. If the move is valid, it updates the game state in the database

## Frontend (App.tsx)

```typescript
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Container, Grid, Paper, Button, Typography, List, ListItem, 
  ListItemText, ThemeProvider, createTheme, TextField, Dialog,
  DialogTitle, DialogContent, DialogActions, ListItemButton,
  Snackbar, Alert, AlertColor, Box
} from '@mui/material';
import { Chessboard } from 'react-chessboard';
```

These lines import necessary modules and components:
- React hooks for state management
- Axios for API calls
- Material-UI components for the user interface
- Chessboard component for displaying the chess board

```typescript
const App: React.FC = () => {
  // ... state declarations ...

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
      fetchGames();
    }
  }, []);
```

This is the main App component. The `useEffect` hook checks if a token exists in localStorage and sets the login state accordingly.

```typescript
  const fetchGames = async () => {
    try {
      const response = await axios.get('http://localhost:5000/get_games', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setGames(response.data);
    } catch (error) {
      setSnackbar({open: true, message: 'Error fetching games', severity: 'error'});
    }
  };
```

This function fetches the user's games from the backend.

```typescript
  const handleLogin = async () => {
    try {
      const response = await axios.post('http://localhost:5000/login', { username, password });
      if (response.data.access_token) {
        localStorage.setItem('token', response.data.access_token);
        setIsLoggedIn(true);
        fetchGames();
        setSnackbar({open: true, message: 'Logged in successfully', severity: 'success'});
      } else {
        setSnackbar({open: true, message: 'Login failed: No token received', severity: 'error'});
      }
    } catch (error) {
      // ... error handling ...
    }
  };
```

This function handles user login. It sends a POST request to the login endpoint and stores the received token in localStorage if successful.

```typescript
  const handleRegister = async () => {
    try {
      const response = await axios.post('http://localhost:5000/register', { username, password });
      if (response.status === 201) {
        setSnackbar({open: true, message: 'Registration successful. Please log in.', severity: 'success'});
      } else {
        setSnackbar({open: true, message: 'Registration failed: Unexpected response', severity: 'error'});
      }
    } catch (error) {
      // ... error handling ...
    }
  };
```

This function handles user registration. It sends a POST request to the register endpoint.

```typescript
  const handleNewGame = async () => {
    try {
      const response = await axios.post