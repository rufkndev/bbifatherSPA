import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Container,
  Paper
} from '@mui/material';
import { Lock } from '@mui/icons-material';

interface AdminLoginProps {
  onLogin: () => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Простая проверка пароля
    if (password === 'admin123') {
      localStorage.setItem('adminAuth', 'true');
      onLogin();
    } else {
      setError('Неверный пароль');
    }
    
    setLoading(false);
  };

  return (
    <Container maxWidth="sm">
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <Paper elevation={0} sx={{ width: '100%', maxWidth: 400 }}>
          <Card sx={{ 
            border: '1px solid', 
            borderColor: 'primary.200',
            borderRadius: 4 
          }}>
            <CardContent sx={{ p: 4 }}>
              <Box textAlign="center" mb={3}>
                <Box sx={{
                  width: 64,
                  height: 64,
                  bgcolor: 'primary.main',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2
                }}>
                  <Lock sx={{ color: 'white', fontSize: 32 }} />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                  Админ панель
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Введите пароль для доступа
                </Typography>
              </Box>

              <form onSubmit={handleSubmit}>
                <TextField
                  fullWidth
                  type="password"
                  label="Пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль администратора"
                  sx={{ mb: 3 }}
                  autoFocus
                />

                {error && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                  </Alert>
                )}

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading || password.trim() === ''}
                  sx={{ 
                    py: 1.5,
                    borderRadius: 3,
                    fontWeight: 600
                  }}
                >
                  {loading ? 'Проверка...' : 'Войти'}
                </Button>
              </form>

              <Box mt={3} textAlign="center">
                <Typography variant="body2" color="text.secondary">
                  Только для администраторов BBI Father
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Paper>
      </Box>
    </Container>
  );
};

export default AdminLogin;