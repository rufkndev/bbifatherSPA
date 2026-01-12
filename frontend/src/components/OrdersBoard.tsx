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
import { getAllOrders, updateOrderExecutor, updateOrderAdmin, uploadOrderFiles } from '../api';
import { Order, OrderStatus } from '../types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

const statusLabels: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.NEW]: 'Новый',
  [OrderStatus.WAITING_PAYMENT]: 'Ожидание оплаты',
  [OrderStatus.PAID]: 'Оплачен',
  [OrderStatus.IN_PROGRESS]: 'В работе',
  [OrderStatus.COMPLETED]: 'Выполнен',
};

const allowedStatuses: OrderStatus[] = [
  OrderStatus.WAITING_PAYMENT,
  OrderStatus.PAID,
  OrderStatus.IN_PROGRESS,
  OrderStatus.COMPLETED,
];

const statusBg: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.WAITING_PAYMENT]: 'rgba(234, 179, 8, 0.12)',
  [OrderStatus.PAID]: 'rgba(14, 165, 233, 0.12)',
  [OrderStatus.IN_PROGRESS]: 'rgba(99, 102, 241, 0.12)',
  [OrderStatus.COMPLETED]: 'rgba(16, 185, 129, 0.15)',
};

const statusChip: Partial<Record<OrderStatus, { bg: string; color: string }>> = {
  [OrderStatus.WAITING_PAYMENT]: { bg: 'rgba(234,179,8,0.2)', color: '#a16207' },
  [OrderStatus.PAID]: { bg: 'rgba(14,165,233,0.2)', color: '#0ea5e9' },
  [OrderStatus.IN_PROGRESS]: { bg: 'rgba(99,102,241,0.2)', color: '#6366f1' },
  [OrderStatus.COMPLETED]: { bg: 'rgba(16,185,129,0.2)', color: '#059669' },
};

const OrdersBoard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTelegram, setMyTelegram] = useState<string>('');
  const [filterExecutor, setFilterExecutor] = useState<string>('');
  const [authorized, setAuthorized] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  const getDefaultPayout = (order: Order) => {
    const base = order.actual_price ?? order.subject?.price ?? 0;
    return base ? Math.round(base * 0.75 * 100) / 100 : 0;
  };

  useEffect(() => {
    const saved = localStorage.getItem('board_pass');
    if (saved === 'Admin321') {
      setAuthorized(true);
      return;
    }
    const input = window.prompt('Введите пароль для доступа к доске заказов');
    if (input === 'Admin321') {
      localStorage.setItem('board_pass', 'Admin321');
      setAuthorized(true);
    } else {
      setAuthorized(false);
    }
  }, []);

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

  if (!authorized) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <Typography variant="h6">Доступ к доске ограничен</Typography>
      </Box>
    );
  }

  const visibleStatuses: OrderStatus[] = [
    OrderStatus.WAITING_PAYMENT,
    OrderStatus.PAID,
    OrderStatus.IN_PROGRESS,
    OrderStatus.NEEDS_REVISION,
  ];

  const filteredOrders = orders
    .filter(o => visibleStatuses.includes(o.status))
    .filter(o => {
      if (!filterExecutor.trim()) return true;
      return (o.executor_telegram || '').toLowerCase().includes(filterExecutor.trim().replace('@', '').toLowerCase());
    });

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 1, sm: 3 }, py: { xs: 2, sm: 4 }, background: '#ffffff' }}>
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
            <TextField
              label="Фильтр по исполнителю"
              value={filterExecutor}
              onChange={(e) => setFilterExecutor(e.target.value)}
              placeholder="@executor"
              sx={{ maxWidth: 260 }}
            />
            <Button variant="outlined" onClick={loadOrders}>
              Обновить
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        {filteredOrders.map((order) => (
          <Grid item xs={12} md={6} lg={4} key={order.id}>
            <Card sx={{ height: '100%', background: statusBg[order.status] || 'background.paper' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    #{order.id} • {order.title}
                  </Typography>
                  <Chip
                    label={statusLabels[order.status] || order.status}
                    size="small"
                    sx={{
                      backgroundColor: statusChip[order.status]?.bg || 'rgba(37,99,235,0.12)',
                      color: statusChip[order.status]?.color || '#2563eb',
                      fontWeight: 700,
                    }}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Студент: {order.student?.name} (@{order.student?.telegram})
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Предмет: {order.subject?.name || '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Дедлайн: {order.deadline ? format(new Date(order.deadline), 'dd.MM.yyyy', { locale: ru }) : '—'}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
                  Стоимость: {order.actual_price ?? order.subject?.price ?? 0} ₽
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  К выплате: {order.payout_amount != null ? `${order.payout_amount} ₽` : `${getDefaultPayout(order)} ₽`}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Доп. требования: {order.input_data || '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Инфо о варианте: {order.variant_info || '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Описание: {order.description || '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Файлы: {order.files?.length || 0}
                </Typography>

                <Divider sx={{ my: 1.5 }} />
                <Typography variant="body2" gutterBottom>
                  Исполнитель: {order.executor_telegram ? `@${order.executor_telegram} (забран)` : '—'}
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {!order.executor_telegram && order.status !== OrderStatus.COMPLETED && (
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
                      {allowedStatuses.map((val) => (
                        <MenuItem key={val} value={val}>
                          {statusLabels[val]}
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

