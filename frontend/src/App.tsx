import React from 'react';
import { Routes, Route, useLocation, Link } from 'react-router-dom';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Box,
  Chip,
  IconButton
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
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar 
        position="static" 
        elevation={2}
      >
        <Toolbar>
          <School sx={{ mr: 2 }} />
          <Typography 
            variant="h6" 
            component={Link}
            to="/"
            sx={{ 
              flexGrow: 1, 
              fontWeight: 600,
              textDecoration: 'none',
              color: 'inherit',
              '&:hover': { opacity: 0.8 }
            }}
          >
            BBI Father
          </Typography>
          
          <Chip 
            label={getPageTitle()}
            color="secondary"
            variant="filled"
            sx={{ mr: 2 }}
          />
          
          <Box display="flex" gap={1}>
            <IconButton 
              color="inherit" 
              component={Link} 
              to="/"
              sx={{ 
                bgcolor: location.pathname === '/' ? 'rgba(255,255,255,0.2)' : 'transparent'
              }}
            >
              <Home />
            </IconButton>
            
            <IconButton 
              color="inherit" 
              component={Link} 
              to="/create"
              sx={{ 
                bgcolor: location.pathname === '/create' ? 'rgba(255,255,255,0.2)' : 'transparent'
              }}
            >
              <Add />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      
      <Box sx={{ minHeight: 'calc(100vh - 64px)' }}>
        <Routes>
          <Route path="/" element={<OrdersPage />} />
          <Route path="/create" element={<CreateOrderPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </Box>
    </Box>
  );
}

export default App;