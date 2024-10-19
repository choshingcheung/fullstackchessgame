class ChessPiece:
    def __init__(self, color, symbol):
        self.color = color
        self.symbol = symbol

    def __str__(self):
        return self.symbol

class ChessBoard:
    def __init__(self):
        self.board = [[None for _ in range(8)] for _ in range(8)]
        self.setup_board()

    def setup_board(self):
        # Set up pawns
        for col in range(8):
            self.board[1][col] = ChessPiece('black', 'p')
            self.board[6][col] = ChessPiece('white', 'P')

        # Set up other pieces
        back_row = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']
        for col in range(8):
            self.board[0][col] = ChessPiece('black', back_row[col])
            self.board[7][col] = ChessPiece('white', back_row[col].upper())

    def display(self):
        print("  a b c d e f g h")
        print(" ----------------")
        for i, row in enumerate(self.board):
            print(f"{8-i}|", end="")
            for piece in row:
                print(f"{str(piece) if piece else '.'} ", end="")
            print(f"|{8-i}")
        print(" ----------------")
        print("  a b c d e f g h")
        print()

    def is_valid_move(self, start, end):
        # Basic move validation (to be expanded)
        start_row, start_col = start
        end_row, end_col = end

        # Check if start and end are within the board
        if not (0 <= start_row < 8 and 0 <= start_col < 8 and 0 <= end_row < 8 and 0 <= end_col < 8):
            return False

        # Check if there's a piece at the start position
        if not self.board[start_row][start_col]:
            return False

        # Check if the end position is not occupied by a piece of the same color
        if self.board[end_row][end_col] and self.board[end_row][end_col].color == self.board[start_row][start_col].color:
            return False

        # More specific move validation to be implemented for each piece type
        return True

    def move_piece(self, start, end):
        if self.is_valid_move(start, end):
            start_row, start_col = start
            end_row, end_col = end
            self.board[end_row][end_col] = self.board[start_row][start_col]
            self.board[start_row][start_col] = None
            return True
        return False

def play_chess():
    board = ChessBoard()
    players = ['white', 'black']
    current_player = 0

    while True:
        board.display()
        print(f"{players[current_player]}'s turn")
        
        try:
            start = input("Enter start position (e.g., 'e2'): ")
            end = input("Enter end position (e.g., 'e4'): ")
            
            # Convert chess notation to array indices
            start = (8 - int(start[1]), ord(start[0]) - ord('a'))
            end = (8 - int(end[1]), ord(end[0]) - ord('a'))
            
            if board.move_piece(start, end):
                current_player = 1 - current_player
            else:
                print("Invalid move. Try again.")
        except (ValueError, IndexError):
            print("Invalid input. Please enter positions like 'e2' or 'a7'.")
        except KeyboardInterrupt:
            print("\nGame ended.")
            break

if __name__ == "__main__":
    play_chess()