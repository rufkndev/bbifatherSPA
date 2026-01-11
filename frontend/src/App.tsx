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
  Badge,
  Button
} from '@mui/material';
import { 
  Home,
  Add,
  School
} from '@mui/icons-material';
import OrdersPage from './components/OrdersPage';
import CreateOrderPage from './components/CreateOrderPage';
import AdminPage from './components/AdminPage';
import OrdersBoard from './components/OrdersBoard';

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
        background: 'radial-gradient(circle at 10% 20%, rgba(59,130,246,0.08), transparent 25%), radial-gradient(circle at 80% 0%, rgba(16,185,129,0.08), transparent 22%), linear-gradient(180deg, #f8fafc 0%, #edf2f7 100%)',
        pb: { xs: 8, sm: 2 },
        position: 'relative',
        overflowX: 'hidden'
      }}
    >
      {/* Мобильная версия - компактный header */}
      <AppBar 
        position="fixed" 
        elevation={0}
        sx={{ 
          background: 'rgba(255,255,255,0.9)',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
          backdropFilter: 'blur(12px)',
          // Компактный для мобильных
          '& .MuiToolbar-root': {
            minHeight: { xs: 72, sm: 84 },
          }
        }}
      >
        <Container maxWidth="xl" disableGutters sx={{ px: { xs: 2, sm: 3 } }}>
          <Toolbar sx={{ py: { xs: 0.5, sm: 1 }, minHeight: 'inherit !important' }}>
            <Box 
              component={Link} 
              to="/" 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                mr: { xs: 2, sm: 3 },
                flexGrow: 1,
                textDecoration: 'none'
              }}
            >
              <Box
                component="img"
                src="/logo.png"
                alt="BBI Father"
                sx={{
                  height: { xs: 40, sm: 56 },
                  width: 'auto',
                  display: 'block'
                }}
              />
            </Box>
            
            {/* Скрываем chip на мобильных для экономии места */}
            <Chip 
              label={getPageTitle()}
              sx={{ 
                mr: { xs: 1, sm: 3 },
                background: 'rgba(37, 99, 235, 0.1)',
                color: '#2563eb',
                fontWeight: 600,
                fontSize: { xs: '0.75rem', sm: '0.85rem' },
                border: '1px solid rgba(37, 99, 235, 0.2)',
                display: { xs: 'none', sm: 'flex' }, // Скрываем на мобильных
                '&:hover': {
                  background: 'rgba(37, 99, 235, 0.2)',
                }
              }}
            />
          </Toolbar>
        </Container>
      </AppBar>

      {/* Основной контент */}
      <Box sx={{ 
        pt: { xs: 9, sm: 12 }, 
        minHeight: '100vh', 
        px: { xs: 1, sm: 2 } 
      }}>
        <Container maxWidth="xl" sx={{ py: { xs: 1, sm: 2 } }}>
          <Routes>
            <Route path="/" element={<OrdersPage />} />
            <Route path="/create" element={<CreateOrderPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/board" element={<OrdersBoard />} />
          </Routes>
        </Container>
      </Box>

      {/* Мобильная bottom navigation */}
      <Box
        sx={{
          display: { xs: 'block', sm: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid #e2e8f0',
          py: 1,
          px: 2,
          zIndex: 1000,
        }}
      >
        <Box display="flex" justifyContent="space-around" alignItems="center">
          <IconButton 
            component={Link} 
            to="/"
            size="large"
            sx={{ 
              borderRadius: '12px',
              p: 2,
              background: location.pathname === '/' 
                ? 'rgba(37, 99, 235, 0.1)' 
                : 'transparent',
              color: location.pathname === '/' ? '#2563eb' : '#64748b',
              border: location.pathname === '/' ? '1px solid rgba(37, 99, 235, 0.2)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <Home sx={{ fontSize: 28 }} />
          </IconButton>
          
          <IconButton 
            component={Link} 
            to="/create"
            size="large"
            sx={{ 
              borderRadius: '12px',
              p: 2,
              background: location.pathname === '/create' 
                ? 'rgba(37, 99, 235, 0.1)' 
                : 'transparent',
              color: location.pathname === '/create' ? '#2563eb' : '#64748b',
              border: location.pathname === '/create' ? '1px solid rgba(37, 99, 235, 0.2)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            <Add sx={{ fontSize: 28 }} />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}

export default App;