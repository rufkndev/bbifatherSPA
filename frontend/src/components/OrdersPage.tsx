import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Grid,
  CircularProgress,
  LinearProgress,
  CardActions,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  Add as AddIcon,
  CalendarToday,
  AttachFile,
  FileDownload,
  Edit as EditIcon,
  Search as SearchIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { Order, OrderStatus } from '../types';
import { getOrders, downloadFile, downloadAllFiles, api, requestOrderRevision } from '../api';
import { format, differenceInDays } from 'date-fns';
import { ru } from 'date-fns/locale';

const statusConfig = {
  [OrderStatus.NEW]: { 
    color: 'info' as const, 
    label: 'Новый', 
    icon: '🆕',
    progress: 10
  },
  [OrderStatus.WAITING_PAYMENT]: { 
    color: 'warning' as const, 
    label: 'Ожидание оплаты', 
    icon: '💰',
    progress: 20
  },
  [OrderStatus.PAID]: { 
    color: 'primary' as const, 
    label: 'Оплачен', 
    icon: '💳',
    progress: 40
  },
  [OrderStatus.IN_PROGRESS]: { 
    color: 'secondary' as const, 
    label: 'В работе', 
    icon: '⚙️',
    progress: 70
  },
  [OrderStatus.COMPLETED]: { 
    color: 'success' as const, 
    label: 'Выполнен', 
    icon: '✅',
    progress: 100
  },
  [OrderStatus.NEEDS_REVISION]: { 
    color: 'error' as const, 
    label: 'Нужны исправления', 
    icon: '🔄',
    progress: 80
  },
};

const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [paymentNotifications, setPaymentNotifications] = useState<Set<number>>(new Set());
  
  // Состояние для "логина"
  const [searchParams, setSearchParams] = useSearchParams();
  const [telegramUser, setTelegramUser] = useState<string | null>(localStorage.getItem('telegramUser') || searchParams.get('telegram'));
  const [telegramInput, setTelegramInput] = useState('');
  const [isAdminView, setIsAdminView] = useState(false);


  // Состояние для модального окна исправлений
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [selectedOrderForRevision, setSelectedOrderForRevision] = useState<Order | null>(null);
  const [revisionComment, setRevisionComment] = useState('');
  const [revisionGrade, setRevisionGrade] = useState('');
  const [submittingRevision, setSubmittingRevision] = useState(false);

  const loadOrders = useCallback(async (user: string | null) => {
    try {
      setLoading(true);
      const response = await getOrders(1, 100, user); // Загружаем до 100 заказов
      setOrders(response.orders);
    } catch (error) {
      console.error('Ошибка загрузки заказов:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Приоритет: параметр в URL -> localStorage
    const urlTelegram = searchParams.get('telegram');
    if (urlTelegram) {
      localStorage.setItem('telegramUser', urlTelegram);
      setTelegramUser(urlTelegram);
      // Очищаем URL от параметра
      setSearchParams({}, { replace: true });
    }
    
    // Если пользователь определен, загружаем его заказы
    if (telegramUser) {
      setIsAdminView(false);
      loadOrders(telegramUser);
    } else {
      // Иначе - вид администратора
      setIsAdminView(true);
      loadOrders(null);
    }
  }, [telegramUser, loadOrders, searchParams, setSearchParams]);

  const handleLogin = () => {
    if (telegramInput) {
      const cleanTelegram = telegramInput.startsWith('@') ? telegramInput.substring(1) : telegramInput;
      localStorage.setItem('telegramUser', cleanTelegram);
      setTelegramUser(cleanTelegram);
    }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('telegramUser');
    setTelegramUser(null);
    setOrders([]);
  };

  const handleAdminLogin = () => {
    const password = prompt('Введите пароль администратора:');
    if (password === 'admin123') {
      const adminUser = 'admin_view';
      localStorage.setItem('telegramUser', adminUser);
      setTelegramUser(adminUser);
      setIsAdminView(true);
    } else if (password !== null) {
      alert('Неверный пароль!');
    }
  };

  const handleDownloadFile = async (orderId: number, filename: string) => {
    const downloadKey = `${orderId}-${filename}`;
    
    try {
      setDownloadingFiles(prev => new Set(prev).add(downloadKey));
      await downloadFile(orderId, filename);
    } catch (error) {
      console.error('Ошибка скачивания файла:', error);
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(downloadKey);
        return newSet;
      });
    }
  };

  const handleDownloadAllFiles = async (orderId: number) => {
    const downloadKey = `${orderId}-all`;
    
    try {
      setDownloadingFiles(prev => new Set(prev).add(downloadKey));
      await downloadAllFiles(orderId);
    } catch (error) {
      console.error('Ошибка скачивания всех файлов:', error);
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(downloadKey);
        return newSet;
      });
    }
  };

  const handlePaymentNotification = async (orderId: number) => {
    try {
      const response = await api.post(`/api/orders/${orderId}/payment-notification`);
      if (response.status === 200) {
        setPaymentNotifications(prev => new Set(prev).add(orderId));
        alert('✅ Уведомление об оплате отправлено администратору!');
      }
    } catch (error) {
      console.error('Ошибка отправки уведомления об оплате:', error);
    }
  };

  const handleRequestRevision = (order: Order) => {
    setSelectedOrderForRevision(order);
    setRevisionComment('');
    setRevisionGrade('');
    setRevisionDialogOpen(true);
  };

  const handleSubmitRevision = async () => {
    if (!selectedOrderForRevision?.id || !revisionComment.trim()) return;

    try {
      setSubmittingRevision(true);
      const updatedOrder = await requestOrderRevision(
        selectedOrderForRevision.id,
        revisionComment.trim(),
        revisionGrade.trim() || undefined
      );
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      handleCloseRevisionDialog();
      alert('✅ Запрос на исправления отправлен!');
    } catch (error) {
      console.error('Ошибка отправки запроса исправлений:', error);
    } finally {
      setSubmittingRevision(false);
    }
  };

  const handleCloseRevisionDialog = () => {
    setRevisionDialogOpen(false);
    setSelectedOrderForRevision(null);
    setRevisionComment('');
    setRevisionGrade('');
  };

  const getDeadlineStatus = (deadline: string) => {
    const daysLeft = differenceInDays(new Date(deadline), new Date());
    if (daysLeft < 0) return { type: 'overdue', text: 'Просрочен', color: 'error' as const };
    if (daysLeft === 0) return { type: 'today', text: 'Сегодня', color: 'warning' as const };
    if (daysLeft <= 3) return { type: 'urgent', text: `${daysLeft} дн.`, color: 'warning' as const };
    return { type: 'normal', text: `${daysLeft} дн.`, color: 'default' as const };
  };
  
  const ordersByStatus = orders.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || []).concat(order);
    return acc;
  }, {} as Record<string, Order[]>);

  const statsData = Object.entries(statusConfig).map(([status, config]) => ({
    status,
    config,
    count: ordersByStatus[status]?.length || 0
  }));

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  // Форма входа для студента
  if (!telegramUser) {
    return (
      <Box sx={{ maxWidth: 500, mx: 'auto', px: 3, py: 8, textAlign: 'center' }}>
         <Card sx={{ p: 4, borderRadius: 4, boxShadow: 3 }}>
           <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>Мои заказы</Typography>
           <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
             Введите ваш Telegram никнейм, чтобы посмотреть свои заказы.
           </Typography>
           <TextField
              fullWidth
              label="Ваш Telegram никнейм"
              variant="outlined"
              value={telegramInput}
              onChange={(e) => setTelegramInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="@username"
              sx={{ mb: 2 }}
            />
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleLogin}
              startIcon={<SearchIcon />}
              sx={{ py: 1.5, fontWeight: 600, borderRadius: 3 }}
            >
              Найти мои заказы
            </Button>
            <Button 
              fullWidth 
              variant="text" 
              onClick={handleAdminLogin}
              sx={{ mt: 2, color: 'text.secondary' }}
            >
              Войти как администратор
            </Button>
         </Card>
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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 0.5, color: '#1e293b' }}>
            {isAdminView ? 'Все заказы' : `Заказы ${telegramUser}`}
          </Typography>
          <Typography variant="subtitle1" sx={{ color: 'grey.600' }}>
            {isAdminView ? 'Панель администратора' : 'Отслеживайте статус ваших работ'}
          </Typography>
        </div>
        <Button
          variant="outlined"
          onClick={handleLogout}
          startIcon={<LogoutIcon />}
          sx={{ fontWeight: 600, borderRadius: 3 }}
        >
          Выйти
        </Button>
      </Box>

      {/* Статистика */}
      <Grid container spacing={2} mb={4}>
         {statsData.map(({ status, config, count }) => (
            <Grid item xs={6} sm={4} md={2} key={status}>
              <Card sx={{ textAlign: 'center', p: 1, border: '1px solid #e2e8f0' }}>
                <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>{config.icon}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{count}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>{config.label}</Typography>
              </Card>
            </Grid>
          ))}
      </Grid>
      
      {/* Список Заказов */}
      {orders.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 8, border: '2px dashed #d1d5db', borderRadius: 4 }}>
          <CardContent>
             <Typography sx={{ fontSize: '4rem', mb: 2 }}>📝</Typography>
             <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>Заказов не найдено</Typography>
             <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
               {isAdminView ? 'Пока нет ни одного заказа.' : 'У вас еще нет заказов с таким никнеймом.'}
             </Typography>
            <Button component={Link} to="/create" variant="contained" size="large" startIcon={<AddIcon />}>
              Создать новый заказ
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {orders.map((order) => {
            const statusInfo = statusConfig[order.status as OrderStatus];
            const deadlineStatus = getDeadlineStatus(order.deadline);
            
            return (
              <Grid item xs={12} md={6} lg={4} key={order.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, boxShadow: 1 }}>
                  <CardContent sx={{ flexGrow: 1, p: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                        {order.title}
                      </Typography>
                      <Chip label={`${statusInfo.icon} ${statusInfo.label}`} size="small" color={statusInfo.color} sx={{ fontWeight: 600 }} />
                    </Box>

                    <Box mb={3}>
                       <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                         <Typography variant="body2" color="text.secondary">Прогресс</Typography>
                         <Typography variant="body2" sx={{ fontWeight: 600 }}>{statusInfo.progress}%</Typography>
                       </Box>
                       <LinearProgress variant="determinate" value={statusInfo.progress} color={statusInfo.color} />
                    </Box>

                    <Stack spacing={1} mb={2}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color={deadlineStatus.color === 'error' ? 'error.main' : 'text.secondary'}>
                          {format(new Date(order.deadline), 'dd MMM yyyy', { locale: ru })} ({deadlineStatus.text})
                        </Typography>
                      </Box>
                      {isAdminView && order.student && (
                        <Typography variant="body2" color="text.secondary">
                          <strong>Студент:</strong> {order.student.name} ({order.student.telegram})
                        </Typography>
                      )}
                    </Stack>

                    {order.status === OrderStatus.WAITING_PAYMENT && (
                        <Card sx={{ mt: 2, bgcolor: 'warning.light' }}>
                           <CardContent>
                             <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Реквизиты для оплаты</Typography>
                             <Typography variant="body2"><strong>Карта:</strong> +79621206360 (Тбанк)</Typography>
                             <Typography variant="body2"><strong>Получатель:</strong> Таранов А. И.</Typography>
                             <Typography variant="body2"><strong>Сумма:</strong> {order.actual_price || order.subject?.price} ₽</Typography>
                             <Box display="flex" alignItems="center" mt={2}>
                                {paymentNotifications.has(order.id!) ? (
                                   <Typography variant="body2" sx={{ color: 'success.dark', fontWeight: 600 }}>✅ Уведомление отправлено</Typography>
                                ) : (
                                  <>
                                     <input type="checkbox" id={`payment-${order.id}`} onChange={(e) => e.target.checked && handlePaymentNotification(order.id!)} />
                                     <label htmlFor={`payment-${order.id}`} style={{ marginLeft: 8, cursor: 'pointer' }}>Я оплатил(а)</label>
                                  </>
                                )}
                             </Box>
                           </CardContent>
                        </Card>
                    )}

                  </CardContent>
                  <CardActions sx={{ p: 2, display: 'flex', justifyContent: 'space-between' }}>
                     <Box display="flex" gap={1} flexWrap="wrap">
                       {order.files && order.files.length > 1 && (
                         <Button size="small" variant="contained" onClick={() => handleDownloadAllFiles(order.id!)} startIcon={downloadingFiles.has(`${order.id}-all`) ? <CircularProgress size={14} /> : <FileDownload />}>
                           Скачать все
                         </Button>
                       )}
                       {order.files && order.files.slice(0, 1).map((file, i) => (
                          <Button key={i} size="small" variant="outlined" onClick={() => handleDownloadFile(order.id!, file)} startIcon={downloadingFiles.has(`${order.id}-${file}`) ? <CircularProgress size={14} /> : <AttachFile />}>
                             {file.length > 15 ? file.substring(0, 12) + '...' : file}
                          </Button>
                       ))}
                     </Box>
                     <Typography variant="h6" color="primary" sx={{ fontWeight: 600 }}>#{order.id}</Typography>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
};

export default OrdersPage;
