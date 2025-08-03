import React, { useState, useEffect } from 'react';
import AdminLogin from './AdminLogin';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress
} from '@mui/material';
import { Order, OrderStatus } from '../types';
import { getOrders, updateOrderStatus, markOrderAsPaid, uploadOrderFiles } from '../api';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const statusColors = {
  [OrderStatus.NEW]: 'default',
  [OrderStatus.WAITING_PAYMENT]: 'warning',
  [OrderStatus.PAID]: 'info',
  [OrderStatus.IN_PROGRESS]: 'secondary',
  [OrderStatus.COMPLETED]: 'success',
  [OrderStatus.NEEDS_REVISION]: 'error',
} as const;

const statusLabels = {
  [OrderStatus.NEW]: 'Новый',
  [OrderStatus.WAITING_PAYMENT]: 'Ожидание оплаты',
  [OrderStatus.PAID]: 'Оплачен',
  [OrderStatus.IN_PROGRESS]: 'В работе',
  [OrderStatus.COMPLETED]: 'Выполнен',
  [OrderStatus.NEEDS_REVISION]: 'Нужны исправления',
};

const AdminPage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('adminAuth') === 'true'
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<OrderStatus>(OrderStatus.NEW);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isAuthenticated) {
      loadOrders();
    }
  }, [isAuthenticated]);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  if (!isAuthenticated) {
    return <AdminLogin onLogin={handleLogin} />;
  }

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await getOrders(1, 100); // Загружаем все заказы
      setOrders(response.orders);
    } catch (error) {
      console.error('Ошибка загрузки заказов:', error);
      setError('Не удалось загрузить заказы');
    } finally {
      setLoading(false);
    }
  };

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setDialogOpen(true);
  };

  const handleStatusUpdate = async () => {
    if (!selectedOrder || !selectedOrder.id) return;

    try {
      const updatedOrder = await updateOrderStatus(selectedOrder.id, newStatus);
      setOrders(prev => prev.map(order => 
        order.id === updatedOrder.id ? updatedOrder : order
      ));
      setDialogOpen(false);
    } catch (error) {
      console.error('Ошибка обновления статуса:', error);
      setError('Не удалось обновить статус заказа');
    }
  };

  const handleMarkAsPaid = async () => {
    if (!selectedOrder || !selectedOrder.id) return;

    try {
      const updatedOrder = await markOrderAsPaid(selectedOrder.id);
      setOrders(prev => prev.map(order => 
        order.id === updatedOrder.id ? updatedOrder : order
      ));
      setSelectedOrder(updatedOrder);
    } catch (error) {
      console.error('Ошибка отметки оплаты:', error);
      setError('Не удалось отметить заказ как оплаченный');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedOrder || !selectedOrder.id || !event.target.files) return;

    try {
      setUploading(true);
      const updatedOrder = await uploadOrderFiles(selectedOrder.id, event.target.files);
      setOrders(prev => prev.map(order => 
        order.id === updatedOrder.id ? updatedOrder : order
      ));
      setSelectedOrder(updatedOrder);
    } catch (error) {
      console.error('Ошибка загрузки файлов:', error);
      setError('Не удалось загрузить файлы');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Панель администратора
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Все заказы ({orders.length})
          </Typography>
          
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Студент</TableCell>
                  <TableCell>Группа</TableCell>
                  <TableCell>Название</TableCell>
                  <TableCell>Предмет</TableCell>
                  <TableCell>Дедлайн</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Оплата</TableCell>
                  <TableCell>Создан</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((order) => (
                  <TableRow
                    key={order.id}
                    hover
                    onClick={() => handleOrderClick(order)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{order.id}</TableCell>
                    <TableCell>{order.student?.name}</TableCell>
                    <TableCell>{order.student?.group || '-'}</TableCell>
                    <TableCell>{order.title}</TableCell>
                    <TableCell>{order.subject?.name}</TableCell>
                    <TableCell>
                      {format(new Date(order.deadline), 'dd.MM.yyyy', { locale: ru })}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={statusLabels[order.status]}
                        color={statusColors[order.status]}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={order.is_paid ? 'Да' : 'Нет'}
                        color={order.is_paid ? 'success' : 'error'}
                        variant="outlined"
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {order.created_at && format(new Date(order.created_at), 'dd.MM.yyyy', { locale: ru })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Диалог редактирования заказа */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Редактирование заказа #{selectedOrder?.id}
        </DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="h6" gutterBottom>{selectedOrder.title}</Typography>
              
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Студент:</strong> {selectedOrder.student?.name}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Группа:</strong> {selectedOrder.student?.group || 'Не указана'}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Telegram:</strong> {selectedOrder.student?.telegram || 'Не указан'}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Предмет:</strong> {selectedOrder.subject?.name}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <strong>Дедлайн:</strong> {format(new Date(selectedOrder.deadline), 'dd.MM.yyyy', { locale: ru })}
              </Typography>
              
              <Typography variant="body2" gutterBottom sx={{ mt: 2 }}>
                <strong>Описание работы:</strong> {selectedOrder.description}
              </Typography>
              
              {selectedOrder.variant_info && (
                <Typography variant="body2" gutterBottom sx={{ mt: 1 }}>
                  <strong>Информация о варианте:</strong> {selectedOrder.variant_info}
                </Typography>
              )}
              
              {selectedOrder.input_data && (
                <Typography variant="body2" gutterBottom sx={{ mt: 1 }}>
                  <strong>Дополнительные требования:</strong> {selectedOrder.input_data}
                </Typography>
              )}
              
              {/* Информация об исправлениях */}
              {selectedOrder.status === OrderStatus.NEEDS_REVISION && (
                <Box sx={{ mt: 2, p: 2, bgcolor: '#ffebee', borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="error" gutterBottom>
                    🔄 Запрошены исправления
                  </Typography>
                  {selectedOrder.revision_comment && (
                    <Typography variant="body2" gutterBottom sx={{ mt: 1 }}>
                      <strong>Комментарий:</strong> {selectedOrder.revision_comment}
                    </Typography>
                  )}
                  {selectedOrder.revision_grade && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      <strong>Оценка из Moodle:</strong> {selectedOrder.revision_grade}
                    </Typography>
                  )}
                </Box>
              )}
              
              <Box sx={{ mt: 3 }}>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Статус</InputLabel>
                  <Select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as OrderStatus)}
                    label="Статус"
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <MenuItem key={value} value={value}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <Box sx={{ mb: 2 }}>
                  {!selectedOrder.is_paid && (
                    <Button
                      variant="outlined"
                      color="success"
                      onClick={handleMarkAsPaid}
                      sx={{ mr: 2 }}
                    >
                      Отметить как оплаченный
                    </Button>
                  )}
                  
                  <Button
                    variant="outlined"
                    component="label"
                    disabled={uploading}
                  >
                    {uploading ? 'Загрузка...' : 'Загрузить файлы'}
                    <input
                      type="file"
                      hidden
                      multiple
                      onChange={handleFileUpload}
                    />
                  </Button>
                </Box>
                
                {selectedOrder.files && selectedOrder.files.length > 0 && (
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Загруженные файлы:
                    </Typography>
                    {selectedOrder.files.map((file, index) => (
                      <Typography key={index} variant="body2" color="primary">
                        📎 {file}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Отмена
          </Button>
          <Button onClick={handleStatusUpdate} variant="contained">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminPage;