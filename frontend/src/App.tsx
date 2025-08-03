import React from 'react';
import { Routes, Route, useLocation, Link } from 'react-router-dom';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Box,
  Chip,
  IconButton,
  Container,
  Badge
} from '@mui/material';
import { 
  Home,
  Add,
  School
} from '@mui/icons-material';
import OrdersPage from './components/OrdersPage';
import CreateOrderPage from './components/CreateOrderPage';
import AdminPage from './components/AdminPage';

function App() {
  const location = useLocation();
  
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
        return 'Мои заказы';
      case '/create':
        return 'Новый заказ';
      case '/admin':
        return 'Админ панель';
      default:
        return 'Система заказов';
    }
  };

  return (
    <Box 
      sx={{ 
        flexGrow: 1, 
        minHeight: '100vh',
        background: '#f8fafc',
      }}
    >
      <AppBar 
        position="fixed" 
        elevation={0}
        sx={{ 
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Container maxWidth="xl">
          <Toolbar sx={{ py: 1 }}>
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                mr: 3,
                background: '#2563eb',
                borderRadius: '8px',
                p: 1.5,
                color: 'white'
              }}
            >
              <School sx={{ fontSize: 24 }} />
            </Box>
            
            <Typography 
              variant="h5" 
              component={Link}
              to="/"
              sx={{ 
                flexGrow: 1, 
                fontWeight: 700,
                textDecoration: 'none',
                color: '#1e293b',
                transition: 'all 0.2s ease',
                '&:hover': { 
                  color: '#2563eb',
                }
              }}
            >
              BBI Father
            </Typography>
            
            <Chip 
              label={getPageTitle()}
              sx={{ 
                mr: 3,
                background: 'rgba(37, 99, 235, 0.1)',
                color: '#2563eb',
                fontWeight: 600,
                fontSize: '0.85rem',
                border: '1px solid rgba(37, 99, 235, 0.2)',
                '&:hover': {
                  background: 'rgba(37, 99, 235, 0.2)',
                }
              }}
            />
            
            <Box display="flex" gap={1}>
              <IconButton 
                component={Link} 
                to="/"
                sx={{ 
                  borderRadius: '4px',
                  p: 1.5,
                  background: location.pathname === '/' 
                    ? '#2563eb' 
                    : 'rgba(37, 99, 235, 0.1)',
                  color: location.pathname === '/' ? 'white' : '#2563eb',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    background: location.pathname === '/' 
                      ? '#1d4ed8'
                      : 'rgba(37, 99, 235, 0.2)',
                  }
                }}
              >
                <Home />
              </IconButton>
              
              <IconButton 
                component={Link} 
                to="/create"
                sx={{ 
                  borderRadius: '4px',
                  p: 1.5,
                  background: location.pathname === '/create' 
                    ? '#2563eb' 
                    : 'rgba(37, 99, 235, 0.1)',
                  color: location.pathname === '/create' ? 'white' : '#2563eb',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    background: location.pathname === '/create' 
                      ? '#1d4ed8'
                      : 'rgba(37, 99, 235, 0.2)',
                  }
                }}
              >
                <Add />
              </IconButton>
            </Box>
          </Toolbar>
        </Container>
      </AppBar>
      
      <Box sx={{ pt: 10, minHeight: '100vh', px: 2 }}>
        <Container maxWidth="xl" sx={{ py: 2 }}>
          <Routes>
            <Route path="/" element={<OrdersPage />} />
            <Route path="/create" element={<CreateOrderPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </Container>
      </Box>
    </Box>
  );
}

export default App;