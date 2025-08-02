import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2196f3', // Синий
      light: '#64b5f6',
      dark: '#1976d2',
    },
    secondary: {
      main: '#03a9f4', // Голубой
      light: '#4fc3f7',
      dark: '#0288d1',
    },
    background: {
      default: '#fafafa', // Очень светло-серый фон
      paper: '#ffffff',
    },
    success: {
      main: '#4caf50',
    },
    warning: {
      main: '#ff9800',
    },
    error: {
      main: '#f44336',
    },
    info: {
      main: '#81c784',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      color: '#1976d2',
    },
    h2: {
      fontWeight: 700,
      color: '#1976d2',
    },
    h3: {
      fontWeight: 700,
      color: '#1976d2',
    },
    h4: {
      fontWeight: 600,
      color: '#1976d2',
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 12px rgba(33, 150, 243, 0.08)',
          border: '1px solid rgba(33, 150, 243, 0.12)',
          '&:hover': {
            boxShadow: '0 4px 20px rgba(33, 150, 243, 0.15)',
            transform: 'translateY(-2px)',
            transition: 'all 0.3s ease',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 12,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
          borderRadius: 8,
        },
      },
    },
            MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundColor: '#2196f3',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            },
          },
        },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
      },
    },
  },
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);