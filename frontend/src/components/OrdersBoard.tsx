import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Stack,
  CircularProgress,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { getAllOrders, updateOrderExecutor, updateOrderAdmin, updateOrderStatus, uploadOrderFiles } from '../api';
import { Order, OrderStatus } from '../types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const statusLabels: Record<OrderStatus, string> = {
  [OrderStatus.NEW]: 'Новый',
  [OrderStatus.WAITING_PAYMENT]: 'Ожидание оплаты',
  [OrderStatus.PAID]: 'Оплачен',
  [OrderStatus.IN_PROGRESS]: 'В работе',
  [OrderStatus.COMPLETED]: 'Выполнен',
  // Дополнительные статусы из enum (на будущее)
  [OrderStatus.NEEDS_REVISION]: 'Нужны исправления',
  [OrderStatus.QUEUED]: 'В очереди',
  [OrderStatus.UNDER_REVIEW]: 'На рассмотрении',
};

const OrdersBoard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTelegram, setMyTelegram] = useState<string>('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const allOrders = await getAllOrders();
      setOrders(allOrders);
    } catch (e) {
      console.error('Ошибка загрузки доски заказов:', e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleClaim = async (orderId: number) => {
    if (!myTelegram.trim()) {
      alert('Укажите ваш telegram');
      return;
    }
    setUpdatingId(orderId);
    try {
      const updated = await updateOrderExecutor(orderId, myTelegram.trim().replace('@', ''));
      setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)));
    } catch (e) {
      console.error('Ошибка назначения исполнителя', e);
      alert('Не удалось назначить исполнителя');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRelease = async (orderId: number) => {
    setUpdatingId(orderId);
    try {
      const updated = await updateOrderExecutor(orderId, null);
      setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)));
    } catch (e) {
      console.error('Ошибка снятия исполнителя', e);
      alert('Не удалось снять исполнителя');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = async (orderId: number, status: OrderStatus) => {
    setUpdatingId(orderId);
    try {
      const updated = await updateOrderAdmin(orderId, { status });
      setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)));
    } catch (e) {
      console.error('Ошибка смены статуса', e);
      alert('Не удалось сменить статус');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleUpload = async (orderId: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingId(orderId);
    try {
      const updated = await uploadOrderFiles(orderId, files);
      setOrders(prev => prev.map(o => (o.id === updated.id ? updated : o)));
    } catch (e) {
      console.error('Ошибка загрузки файлов', e);
      alert('Не удалось загрузить файл');
    } finally {
      setUploadingId(null);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 1, sm: 3 }, py: { xs: 2, sm: 4 } }}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
            Доска заказов
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Мой telegram"
              value={myTelegram}
              onChange={(e) => setMyTelegram(e.target.value)}
              placeholder="@username"
              sx={{ maxWidth: 260 }}
            />
            <Button variant="outlined" onClick={loadOrders}>
              Обновить
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {orders.map((order) => (
          <Grid item xs={12} md={6} lg={4} key={order.id}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    #{order.id} • {order.title}
                  </Typography>
                  <Chip
                    label={statusLabels[order.status] || order.status}
                    color="primary"
                    size="small"
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Студент: {order.student?.name} (@{order.student?.telegram})
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Предмет: {order.subject?.name || 'Кастомный'}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Дедлайн: {order.deadline ? format(new Date(order.deadline), 'dd.MM.yyyy', { locale: ru }) : '—'}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
                  Стоимость: {order.actual_price ?? order.subject?.price ?? 0} ₽
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  К выплате: {order.payout_amount != null ? `${order.payout_amount} ₽` : '—'}
                </Typography>

                <Divider sx={{ my: 1.5 }} />
                <Typography variant="body2" gutterBottom>
                  Исполнитель: {order.executor_telegram ? `@${order.executor_telegram}` : '—'}
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {order.executor_telegram ? (
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      disabled={updatingId === order.id}
                      onClick={() => handleRelease(order.id!)}
                    >
                      Снять исполнителя
                    </Button>
                  ) : (
                    <Button
                      variant="contained"
                      size="small"
                      disabled={updatingId === order.id}
                      onClick={() => handleClaim(order.id!)}
                    >
                      Забрать заказ
                    </Button>
                  )}

                  <FormControl size="small" sx={{ minWidth: 170 }}>
                    <InputLabel>Статус</InputLabel>
                    <Select
                      label="Статус"
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id!, e.target.value as OrderStatus)}
                      disabled={updatingId === order.id}
                    >
                      {Object.entries(statusLabels).map(([val, label]) => (
                        <MenuItem key={val} value={val}>
                          {label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <Button
                    variant="outlined"
                    size="small"
                    component="label"
                    startIcon={<CloudUpload />}
                    disabled={uploadingId === order.id}
                  >
                    {uploadingId === order.id ? 'Загрузка...' : 'Прикрепить файл'}
                    <input
                      type="file"
                      hidden
                      multiple
                      onChange={(e) => handleUpload(order.id!, e.target.files)}
                    />
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default OrdersBoard;

