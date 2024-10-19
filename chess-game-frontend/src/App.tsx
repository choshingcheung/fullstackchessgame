// App.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Container, Grid, Paper, Button, Typography, List, ListItem, 
  ListItemText, ThemeProvider, createTheme, TextField, Dialog,
  DialogTitle, DialogContent, DialogActions, ListItemButton,
  Snackbar, Alert, AlertColor, Box
} from '@mui/material';
import { Chessboard } from 'react-chessboard';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2c3e50',
    },
    secondary: {
      main: '#e74c3c',
    },
  },
});

interface BoardState {
  fen: string;
  legalMoves: string[];
  isGameOver: boolean;
  result: string | null;
}

interface Game {
  id: string;
  white_player: string;
  black_player?: string;
  fen?: string;
  status: 'open' | 'in_progress' | 'completed';
}

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [games, setGames] = useState<Game[]>([]);
  const [openGames, setOpenGames] = useState<Game[]>([]);
  const [currentGame, setCurrentGame] = useState<string | null>(null);
  const [boardState, setBoardState] = useState<BoardState>({
    fen: 'start',
    legalMoves: [],
    isGameOver: false,
    result: null
  });
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [snackbar, setSnackbar] = useState<{open: boolean, message: string, severity: AlertColor}>({
    open: false,
    message: '',
    severity: 'info'
  });
  const [openGamesDialogOpen, setOpenGamesDialogOpen] = useState<boolean>(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
      fetchGames();
    }
  }, []);

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

  const fetchBoard = async () => {
    if (!currentGame) return;
    try {
      const response = await axios.get(`http://localhost:5000/get_board/${currentGame}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setBoardState(response.data);
      if (response.data.is_game_over) {
        setSnackbar({open: true, message: `Game over. Result: ${response.data.result}`, severity: 'info'});
      }
    } catch (error) {
      setSnackbar({open: true, message: 'Error fetching board state', severity: 'error'});
    }
  };

  useEffect(() => {
    if (currentGame) {
      fetchBoard();
    }
  }, [currentGame]);

  
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
      if (axios.isAxiosError(error) && error.response) {
        setSnackbar({open: true, message: `Login failed: ${error.response.data.msg || 'Unknown error'}`, severity: 'error'});
      } else {
        setSnackbar({open: true, message: 'Login failed: Network error', severity: 'error'});
      }
    }
  };

  const handleRegister = async () => {
    try {
      const response = await axios.post('http://localhost:5000/register', { username, password });
      if (response.status === 201) {
        setSnackbar({open: true, message: 'Registration successful. Please log in.', severity: 'success'});
      } else {
        setSnackbar({open: true, message: 'Registration failed: Unexpected response', severity: 'error'});
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        setSnackbar({open: true, message: `Registration failed: ${error.response.data.msg || 'Unknown error'}`, severity: 'error'});
      } else {
        setSnackbar({open: true, message: 'Registration failed: Network error', severity: 'error'});
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setCurrentGame(null);
    setGames([]);
    setOpenGames([]);
    setUsername('');
    setPassword('');
  };

  const fetchOpenGames = async () => {
    try {
      const response = await axios.get('http://localhost:5000/open_games', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setOpenGames(response.data);
    } catch (error) {
      setSnackbar({open: true, message: 'Error fetching open games', severity: 'error'});
    }
  };

  const handleNewGame = async () => {
    try {
      const response = await axios.post('http://localhost:5000/new_game', 
        {}, 
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      fetchGames();
      setCurrentGame(response.data.game_id);
      setSnackbar({open: true, message: 'New game created successfully!', severity: 'success'});
    } catch (error) {
      setSnackbar({open: true, message: 'Failed to create new game', severity: 'error'});
    }
  };

  const handleJoinGame = async (gameId: string) => {
    try {
      await axios.post(`http://localhost:5000/join_game/${gameId}`, 
        {}, 
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setOpenGamesDialogOpen(false);
      fetchGames();
      setCurrentGame(gameId);
      setSnackbar({open: true, message: 'Joined game successfully!', severity: 'success'});
    } catch (error) {
      setSnackbar({open: true, message: 'Failed to join game', severity: 'error'});
    }
  };

  const handleMove = async (from: string, to: string) => {
    if (!currentGame) return;
    try {
      const move = `${from}${to}`;
      const response = await axios.post(`http://localhost:5000/make_move/${currentGame}`, 
        { move },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      if (response.data.success) {
        setMoveHistory(prev => [...prev, move]);
        fetchBoard();
      } else {
        setSnackbar({open: true, message: 'Invalid move', severity: 'error'});
      }
    } catch (error) {
      setSnackbar({open: true, message: 'Error making move', severity: 'error'});
    }
  };

  const onDrop = (sourceSquare: string, targetSquare: string) => {
    handleMove(sourceSquare, targetSquare);
    return true;
  };

  if (!isLoggedIn) {
    return (
      <ThemeProvider theme={theme}>
        <Container maxWidth="xs" sx={{ mt: 4 }}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h5" gutterBottom>Login / Register</Typography>
            <TextField
              fullWidth
              margin="normal"
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <TextField
              fullWidth
              margin="normal"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button fullWidth variant="contained" color="primary" onClick={handleLogin} sx={{ mt: 2 }}>
              Login
            </Button>
            <Button fullWidth variant="outlined" color="secondary" onClick={handleRegister} sx={{ mt: 1 }}>
              Register
            </Button>
          </Paper>
          <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({...snackbar, open: false})}>
      <Alert onClose={() => setSnackbar({...snackbar, open: false})} severity={snackbar.severity} sx={{ width: '100%' }}>
        {snackbar.message}
      </Alert>
    </Snackbar>
        </Container>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Typography variant="h3" gutterBottom align="center">
          Chess Game
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="outlined" color="secondary" onClick={handleLogout}>
            Logout
          </Button>
        </Box>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper elevation={3} sx={{ p: 2 }}>
              {currentGame ? (
                <Chessboard 
                  position={boardState.fen} 
                  onPieceDrop={onDrop}
                  customBoardStyle={{
                    borderRadius: '4px',
                    boxShadow: '0 5px 15px rgba(0, 0, 0, 0.5)'
                  }}
                />
              ) : (
                <Typography>Select a game to play or create a new one</Typography>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Your Games
              </Typography>
              <List dense>
                {games.map((game) => (
                  <ListItem key={game.id} disablePadding>
                    <ListItemButton onClick={() => setCurrentGame(game.id)}>
                      <ListItemText 
                        primary={`Game ${game.id.slice(0, 8)}...`} 
                        secondary={`Status: ${game.status}`} 
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleNewGame}
                fullWidth
                sx={{ mt: 2 }}
              >
                Create New Game
              </Button>
              <Button 
                variant="outlined" 
                color="primary" 
                onClick={() => {
                  fetchOpenGames();
                  setOpenGamesDialogOpen(true);
                }}
                fullWidth
                sx={{ mt: 2 }}
              >
                Join Game
              </Button>
            </Paper>
            {currentGame && (
              <Paper elevation={3} sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Move History
                </Typography>
                <List dense>
                  {moveHistory.map((move, index) => (
                    <ListItem key={index}>
                      <ListItemText primary={`${index + 1}. ${move}`} />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Grid>
        </Grid>

        <Dialog open={openGamesDialogOpen} onClose={() => setOpenGamesDialogOpen(false)}>
          <DialogTitle>Open Games</DialogTitle>
          <DialogContent>
            <List>
              {openGames.map((game) => (
                <ListItem key={game.id} disablePadding>
                  <ListItemButton onClick={() => handleJoinGame(game.id)}>
                    <ListItemText primary={`Game by ${game.white_player}`} secondary={game.id} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenGamesDialogOpen(false)}>Cancel</Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({...snackbar, open: false})}>
          <Alert onClose={() => setSnackbar({...snackbar, open: false})} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </ThemeProvider>
  );
};

export default App;