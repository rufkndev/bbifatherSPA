import React, { useState, useEffect } from 'react';
import AdminLogin from './AdminLogin';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  Grid,
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
import { getAllOrders, updateOrderAdmin, markOrderAsPaid, uploadOrderFiles } from '../api';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const statusColors = {
  [OrderStatus.NEW]: 'default',
  [OrderStatus.WAITING_PAYMENT]: 'warning',
  [OrderStatus.PAID]: 'info',
  [OrderStatus.IN_PROGRESS]: 'secondary',
  [OrderStatus.COMPLETED]: 'success',
} as const;

const statusLabels: Record<OrderStatus, string> = {
  [OrderStatus.NEW]: 'Новый',
  [OrderStatus.WAITING_PAYMENT]: 'Ожидание оплаты',
  [OrderStatus.PAID]: 'Оплачен',
  [OrderStatus.IN_PROGRESS]: 'В работе',
  [OrderStatus.COMPLETED]: 'Выполнен',
  // Дополнительные статусы из enum (неиспользуемые сейчас, но нужны для типобезопасности)
  [OrderStatus.NEEDS_REVISION]: 'Нужны исправления',
  [OrderStatus.QUEUED]: 'В очереди',
  [OrderStatus.UNDER_REVIEW]: 'На рассмотрении',
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
  const [priceInput, setPriceInput] = useState<string>('');
  const [payoutInput, setPayoutInput] = useState<string>('');
  const [executorInput, setExecutorInput] = useState<string>('');
  const [titleInput, setTitleInput] = useState<string>('');
  const [descriptionInput, setDescriptionInput] = useState<string>('');
  const [inputDataInput, setInputDataInput] = useState<string>('');
  const [variantInfoInput, setVariantInfoInput] = useState<string>('');
  const [deadlineInput, setDeadlineInput] = useState<string>('');

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
      const allOrders = await getAllOrders(); // Загружаем все заказы без лимита 100
      setOrders(allOrders);
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
    const initialPrice = (order.actual_price ?? order.subject?.price ?? 0).toString();
    setPriceInput(initialPrice);
    const initialPayout = (order.payout_amount ?? '').toString();
    setPayoutInput(order.payout_amount != null ? initialPayout : '');
    setExecutorInput(order.executor_telegram ? `@${order.executor_telegram}` : '');
    setTitleInput(order.title || '');
    setDescriptionInput(order.description || '');
    setInputDataInput(order.input_data || '');
    setVariantInfoInput(order.variant_info || '');
    setDeadlineInput(order.deadline ? order.deadline.split('T')[0] : '');
  };

  const handleStatusUpdate = async () => {
    await handleSaveAdmin();
  };

  const handleSaveAdmin = async () => {
    if (!selectedOrder || !selectedOrder.id) return;

    try {
      const parsedPrice = parseFloat(priceInput.replace(',', '.'));
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        setError('Введите корректную стоимость');
        return;
      }

      const parsedPayout = payoutInput.trim() === '' ? null : parseFloat(payoutInput.replace(',', '.'));
      if (parsedPayout !== null && (isNaN(parsedPayout) || parsedPayout < 0)) {
        setError('Введите корректную сумму к выплате');
        return;
      }

      const payload = {
        title: titleInput,
        description: descriptionInput,
        input_data: inputDataInput,
        variant_info: variantInfoInput,
        deadline: deadlineInput,
        actual_price: parsedPrice,
        payout_amount: parsedPayout,
        executor_telegram: executorInput.trim() ? executorInput.trim().replace('@', '') : null,
        status: newStatus,
        is_paid: selectedOrder.is_paid,
      };

      const updatedOrder = await updateOrderAdmin(selectedOrder.id, payload);
      setOrders(prev => prev.map(order => 
        order.id === updatedOrder.id ? updatedOrder : order
      ));
      setSelectedOrder(updatedOrder);
      setDialogOpen(false);
    } catch (error) {
      console.error('Ошибка обновления заказа:', error);
      setError('Не удалось сохранить изменения заказа');
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
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: 3, py: 4 }}>
      {/* Header */}
      <Box 
        sx={{
          background: '#ffffff',
          borderRadius: 4,
          p: 3,
          mb: 4,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Typography 
          variant="h2" 
          component="h1" 
          sx={{ 
            fontWeight: 700, 
            mb: 1,
            color: '#1e293b',
          }}
        >
          Панель администратора
        </Typography>
        <Typography 
          variant="subtitle1" 
          sx={{ 
            color: 'grey.600',
            fontWeight: 500,
            fontSize: '1.1rem',
          }}
        >
          Управление заказами и мониторинг системы
        </Typography>
      </Box>

      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            mb: 4,
            borderRadius: 2,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            backdropFilter: 'blur(10px)',
            '& .MuiAlert-message': {
              fontWeight: 500,
            }
          }} 
          onClose={() => setError('')}
        >
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Box sx={{ mb: 6 }}>
        <Typography 
          variant="h4" 
          sx={{ 
            fontWeight: 700, 
            mb: 3,
            color: 'grey.800',
          }}
        >
          Статистика
        </Typography>
        
        <Box 
          display="flex" 
          gap={3} 
          sx={{ 
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: 'stretch'
          }}
        >
          <Card 
            sx={{
              background: 'rgba(37, 99, 235, 0.05)',
              border: '1px solid rgba(37, 99, 235, 0.2)',
              borderRadius: 4,
              flex: 1,
              minWidth: { xs: 'auto', md: 200 },
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: '#2563eb',
              }
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: 3, px: 2 }}>
              <Typography variant="h3" sx={{ fontWeight: 700, color: '#2563eb', mb: 1 }}>
                {orders.length}
              </Typography>
              <Typography variant="h6" sx={{ color: 'grey.700', fontWeight: 600 }}>
                Всего заказов
              </Typography>
            </CardContent>
          </Card>
          
          <Card 
            sx={{
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: 4,
              flex: 1,
              minWidth: { xs: 'auto', md: 200 },
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: '#10b981',
              }
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: 3, px: 2 }}>
              <Typography variant="h3" sx={{ fontWeight: 700, color: '#10b981', mb: 1 }}>
                {orders.filter(o => o.status === OrderStatus.COMPLETED).length}
              </Typography>
              <Typography variant="h6" sx={{ color: 'grey.700', fontWeight: 600 }}>
                Выполнено
              </Typography>
            </CardContent>
          </Card>
          
          <Card 
            sx={{
              background: 'rgba(245, 158, 11, 0.05)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: 4,
              flex: 1,
              minWidth: { xs: 'auto', md: 200 },
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: '#f59e0b',
              }
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: 3, px: 2 }}>
              <Typography variant="h3" sx={{ fontWeight: 700, color: '#f59e0b', mb: 1 }}>
                {orders.filter(o => o.status === OrderStatus.IN_PROGRESS).length}
              </Typography>
              <Typography variant="h6" sx={{ color: 'grey.700', fontWeight: 600 }}>
                В работе
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Card 
        sx={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 4,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 700, 
              mb: 3,
              color: 'grey.800',
            }}
          >
            Все заказы ({orders.length})
          </Typography>
          
          <TableContainer 
            component={Paper}
            sx={{
              borderRadius: 4,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              overflow: 'auto',
            }}
          >
            <Table sx={{ minWidth: 800 }}>
              <TableHead>
                <TableRow
                  sx={{
                    background: '#2563eb',
                    '& .MuiTableCell-head': {
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      color: '#ffffff',
                      borderBottom: '2px solid #1e40af',
                      py: 2,
                      px: 2,
                      whiteSpace: 'nowrap',
                    }
                  }}
                >
                  <TableCell>ID</TableCell>
                  <TableCell>Студент</TableCell>
                  <TableCell>Группа</TableCell>
                  <TableCell sx={{ minWidth: 250 }}>Название</TableCell>
                  <TableCell>Предмет</TableCell>
                  <TableCell>Дедлайн</TableCell>
                  <TableCell>Цена</TableCell>
                  <TableCell>К выплате</TableCell>
                  <TableCell>Исполнитель</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Оплата</TableCell>
                  <TableCell>Создан</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((order, index) => (
                  <TableRow
                    key={order.id}
                    onClick={() => handleOrderClick(order)}
                    sx={{ 
                      cursor: 'pointer',
                      background: index % 2 === 0 
                        ? '#ffffff' 
                        : 'rgba(37, 99, 235, 0.02)',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        background: 'rgba(37, 99, 235, 0.05)',
                      },
                      '& .MuiTableCell-root': {
                        borderBottom: '1px solid #e2e8f0',
                        py: 2,
                        px: 2,
                        fontWeight: 500,
                      }
                    }}
                  >
                    <TableCell sx={{ fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap' }}>
                      #{order.id}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                      {order.student?.name}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{order.student?.group || '-'}</TableCell>
                    <TableCell 
                      sx={{ 
                        minWidth: 250,
                        maxWidth: 300,
                        fontWeight: 600,
                        color: '#1f2937',
                        wordBreak: 'break-word',
                        whiteSpace: 'normal',
                        lineHeight: 1.4,
                      }}
                    >
                      {order.title}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{order.subject?.name}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {format(new Date(order.deadline), 'dd.MM.yyyy', { locale: ru })}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {order.actual_price ?? order.subject?.price ?? 0} ₽
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: '#059669', fontWeight: 600 }}>
                      {order.payout_amount != null ? `${order.payout_amount} ₽` : '—'}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {order.executor_telegram ? `@${order.executor_telegram}` : '—'}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Chip
                        label={statusLabels[order.status]}
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          background: order.status === OrderStatus.COMPLETED
                            ? 'rgba(16, 185, 129, 0.1)'
                            : order.status === OrderStatus.NEEDS_REVISION
                            ? 'rgba(239, 68, 68, 0.1)'
                            : 'rgba(37, 99, 235, 0.1)',
                          color: order.status === OrderStatus.COMPLETED
                            ? '#059669'
                            : order.status === OrderStatus.NEEDS_REVISION
                            ? '#dc2626'
                            : '#2563eb',
                          border: `1px solid ${
                            order.status === OrderStatus.COMPLETED
                              ? '#10b981'
                              : order.status === OrderStatus.NEEDS_REVISION
                              ? '#ef4444'
                              : '#2563eb'
                          }33`,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Chip
                        label={order.is_paid ? 'Да' : 'Нет'}
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          background: order.is_paid
                            ? 'rgba(16, 185, 129, 0.1)'
                            : 'rgba(239, 68, 68, 0.1)',
                          color: order.is_paid ? '#059669' : '#dc2626',
                          border: `1px solid ${order.is_paid ? '#10b981' : '#ef4444'}33`,
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
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
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            maxHeight: '90vh',
            overflow: 'auto',
          }
        }}
      >
        <DialogTitle sx={{ pb: 2 }}>
          Редактирование заказа #{selectedOrder?.id}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {selectedOrder && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Предмет: <strong>{selectedOrder.subject?.name || 'Не указан'}</strong>
              </Typography>

              <TextField
                fullWidth
                label="Название"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                sx={{ mb: 2 }}
              />
              
              <Grid container spacing={2} sx={{ mb: 1 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Студент:</strong> {selectedOrder.student?.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Группа:</strong> {selectedOrder.student?.group || 'Не указана'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    <strong>Telegram:</strong> @{selectedOrder.student?.telegram || 'не указан'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Дедлайн"
                    InputLabelProps={{ shrink: true }}
                    value={deadlineInput}
                    onChange={(e) => setDeadlineInput(e.target.value)}
                  />
                </Grid>
              </Grid>

              <TextField
                fullWidth
                multiline
                rows={3}
                label="Описание работы"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                multiline
                rows={2}
                label="Дополнительные требования"
                value={inputDataInput}
                onChange={(e) => setInputDataInput(e.target.value)}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                multiline
                rows={2}
                label="Информация о варианте"
                value={variantInfoInput}
                onChange={(e) => setVariantInfoInput(e.target.value)}
                sx={{ mb: 2 }}
              />
              
              {/* Информация об исправлениях */}
              {selectedOrder.status === OrderStatus.NEEDS_REVISION && (
                <Box sx={{ mt: 2, p: 2, bgcolor: '#ffebee', borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="error" gutterBottom>
                    🔄 Запрошены исправления
                  </Typography>
                  {selectedOrder.revision_comment && (
                    <Typography variant="body2" gutterBottom sx={{ mt: 1, wordBreak: 'break-word' }}>
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
                {/* Стоимость заказа и выплаты */}
                <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  <TextField
                    label="Стоимость, ₽"
                    type="number"
                    value={priceInput}
                    onChange={(e) => setPriceInput(e.target.value)}
                    sx={{ maxWidth: 240 }}
                    inputProps={{ step: '50', min: '0' }}
                  />
                  <TextField
                    label="К выплате, ₽"
                    type="number"
                    value={payoutInput}
                    onChange={(e) => setPayoutInput(e.target.value)}
                    sx={{ maxWidth: 200 }}
                    inputProps={{ step: '50', min: '0' }}
                  />
                  <TextField
                    label="Исполнитель (telegram)"
                    value={executorInput}
                    onChange={(e) => setExecutorInput(e.target.value)}
                    sx={{ maxWidth: 240 }}
                    placeholder="@executor"
                  />
                  <Button variant="outlined" color="error" onClick={() => setExecutorInput('')}>
                    Снять исполнителя
                  </Button>
                </Box>

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
                
                <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {!selectedOrder.is_paid && (
                    <Button
                      variant="outlined"
                      color="success"
                      onClick={handleMarkAsPaid}
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
                      accept=".pdf,.doc,.docx,.txt,.rtf,.odt,.xls,.xlsx,.csv,.ods,.ppt,.pptx,.odp,.zip,.rar,.7z,.tar,.gz,.bz2,.jpg,.jpeg,.png,.gif,.bmp,.svg,.tiff,.py,.js,.html,.css,.json,.xml,.yaml,.yml,.cpp,.c,.java,.php,.rb,.go,.rs,.swift,.md,.log"
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
                      <Typography key={index} variant="body2" color="primary" sx={{ wordBreak: 'break-all' }}>
                        📎 {file}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDialogOpen(false)}>
            Отмена
          </Button>
          <Button onClick={handleSaveAdmin} variant="contained">
            Сохранить изменения
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminPage;