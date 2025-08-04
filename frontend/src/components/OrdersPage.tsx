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
  [OrderStatus.NEW]: { color: 'info' as const, label: 'Новый', icon: '🆕', progress: 10 },
  [OrderStatus.WAITING_PAYMENT]: { color: 'warning' as const, label: 'Ожидание оплаты', icon: '💰', progress: 20 },
  [OrderStatus.PAID]: { color: 'primary' as const, label: 'Оплачен', icon: '💳', progress: 40 },
  [OrderStatus.IN_PROGRESS]: { color: 'secondary' as const, label: 'В работе', icon: '⚙️', progress: 70 },
  [OrderStatus.COMPLETED]: { color: 'success' as const, label: 'Выполнен', icon: '✅', progress: 100 },
  [OrderStatus.NEEDS_REVISION]: { color: 'error' as const, label: 'Нужны исправления', icon: '🔄', progress: 80 },
};

const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [paymentNotifications, setPaymentNotifications] = useState<Set<number>>(new Set());
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [isAdminView, setIsAdminView] = useState(false);
  const [telegramInput, setTelegramInput] = useState('');
  
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [selectedOrderForRevision, setSelectedOrderForRevision] = useState<Order | null>(null);
  const [revisionComment, setRevisionComment] = useState('');
  const [revisionGrade, setRevisionGrade] = useState('');
  const [submittingRevision, setSubmittingRevision] = useState(false);

  // 1. Эффект для определения текущего пользователя
  useEffect(() => {
    const urlTelegram = searchParams.get('telegram');
    if (urlTelegram) {
      const cleanUser = urlTelegram.startsWith('@') ? urlTelegram.substring(1) : urlTelegram;
      localStorage.setItem('telegramUser', cleanUser);
      setCurrentUser(cleanUser);
      setIsAdminView(false);
      setSearchParams({}, { replace: true });
    } else {
      const storedUser = localStorage.getItem('telegramUser');
      if (storedUser) {
        setCurrentUser(storedUser);
        setIsAdminView(storedUser === 'admin_view');
      } else {
        setLoading(false); // Нет пользователя, заканчиваем загрузку
      }
    }
  }, [searchParams, setSearchParams]);

  // 2. Эффект для загрузки заказов, когда пользователь изменился
  useEffect(() => {
    const fetchOrders = async () => {
      if (currentUser === null) {
          setOrders([]);
          setLoading(false);
          return;
      };

      setLoading(true);
      try {
        const userToFetch = isAdminView ? null : currentUser;
        const response = await getOrders(1, 100, userToFetch);
        setOrders(response.orders);
      } catch (error) {
        console.error('Ошибка загрузки заказов:', error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchOrders();

  }, [currentUser, isAdminView]);

  const handleLogin = () => {
    if (telegramInput) {
      const cleanTelegram = telegramInput.startsWith('@') ? telegramInput.substring(1) : telegramInput;
      localStorage.setItem('telegramUser', cleanTelegram);
      setCurrentUser(cleanTelegram);
      setIsAdminView(false);
    }
  };

  const handleAdminLogin = () => {
    const password = prompt('Введите пароль администратора:');
    if (password === 'admin123') {
      localStorage.setItem('telegramUser', 'admin_view');
      setCurrentUser('admin_view');
      setIsAdminView(true);
    } else if (password !== null) {
      alert('Неверный пароль!');
    }
  };
  
  const handleLogout = () => {
    localStorage.removeItem('telegramUser');
    setCurrentUser(null);
    setIsAdminView(false);
    setOrders([]);
  };

  const handleDownloadFile = async (orderId: number, filename: string) => {
    const downloadKey = `${orderId}-${filename}`;
    setDownloadingFiles(prev => new Set(prev).add(downloadKey));
    try {
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
    setDownloadingFiles(prev => new Set(prev).add(downloadKey));
    try {
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
      await api.post(`/api/orders/${orderId}/payment-notification`);
      setPaymentNotifications(prev => new Set(prev).add(orderId));
      alert('✅ Уведомление об оплате отправлено администратору!');
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
    setSubmittingRevision(true);
    try {
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
  };

  const getDeadlineStatus = (deadline: string) => {
    const daysLeft = differenceInDays(new Date(deadline), new Date());
    if (daysLeft < 0) return { text: 'Просрочен', color: 'error' as const };
    if (daysLeft === 0) return { text: 'Сегодня', color: 'warning' as const };
    if (daysLeft <= 3) return { text: `${daysLeft} дн.`, color: 'warning' as const };
    return { text: `${daysLeft} дн.`, color: 'default' as const };
  };
  
  const statsData = Object.entries(statusConfig).map(([status, config]) => ({
    status,
    config,
    count: orders.filter(o => o.status === status).length,
  }));

  if (loading) {
    return <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh"><CircularProgress size={60} /></Box>;
  }

  // Форма входа для студента
  if (!currentUser) {
    return (
      <Box sx={{ maxWidth: 500, mx: 'auto', px: 3, py: 8, textAlign: 'center' }}>
         <Card sx={{ p: 4, borderRadius: 4, boxShadow: 3 }}>
           <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>Мои заказы</Typography>
           <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>Введите ваш Telegram никнейм.</Typography>
           <TextField
              fullWidth
              label="Ваш Telegram никнейм"
              value={telegramInput}
              onChange={(e) => setTelegramInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="@username"
              sx={{ mb: 2 }}
            />
            <Button fullWidth variant="contained" size="large" onClick={handleLogin} startIcon={<SearchIcon />}>Найти</Button>
            <Button fullWidth variant="text" onClick={handleAdminLogin} sx={{ mt: 2, color: 'text.secondary' }}>Войти как администратор</Button>
         </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: 3, py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p:3, mb: 4, background: '#fff', borderRadius: 4, border: '1px solid #e2e8f0' }}>
        <div>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
            {isAdminView ? 'Все заказы' : `Заказы ${currentUser}`}
          </Typography>
          <Typography variant="subtitle1" sx={{ color: 'grey.600' }}>
            {isAdminView ? 'Панель администратора' : 'Отслеживайте статус ваших работ'}
          </Typography>
        </div>
        <Button variant="outlined" onClick={handleLogout} startIcon={<LogoutIcon />}>Выйти</Button>
      </Box>

      <Grid container spacing={2} mb={4}>
         {statsData.map(({ status, config, count }) => (
            <Grid item xs={6} sm={4} md={2} key={status}>
              <Card sx={{ textAlign: 'center', p: 1, border: '1px solid #e2e8f0' }}>
                <Typography sx={{ fontSize: '1.5rem' }}>{config.icon}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{count}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>{config.label}</Typography>
              </Card>
            </Grid>
          ))}
      </Grid>
      
      {orders.length === 0 ? (
        <Card sx={{ textAlign: 'center', py: 8, border: '2px dashed #d1d5db', borderRadius: 4 }}>
          <CardContent>
             <Typography sx={{ fontSize: '4rem' }}>📝</Typography>
             <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>Заказов не найдено</Typography>
             <Button component={Link} to="/create" variant="contained" size="large" startIcon={<AddIcon />}>Создать новый заказ</Button>
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
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{order.title}</Typography>
                      <Chip label={`${statusInfo.icon} ${statusInfo.label}`} size="small" color={statusInfo.color} sx={{ fontWeight: 600 }} />
                    </Box>

                    <Box mb={3}>
                       <LinearProgress variant="determinate" value={statusInfo.progress} color={statusInfo.color} />
                    </Box>

                    <Stack spacing={1} mb={2}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <CalendarToday sx={{ fontSize: 16 }} />
                        <Typography variant="body2">{format(new Date(order.deadline), 'dd MMM yyyy', { locale: ru })} ({deadlineStatus.text})</Typography>
                      </Box>
                      {isAdminView && order.student && (
                        <Typography variant="body2"><strong>Студент:</strong> {order.student.name} (@{order.student.telegram})</Typography>
                      )}
                    </Stack>
                  </CardContent>
                  <CardActions sx={{ p: 2, flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
                     {/* Блок для статуса "ожидание оплаты" */}
                     {order.status === 'waiting_payment' && !isAdminView && (
                       <Box sx={{ p: 2, bgcolor: '#fff3cd', borderRadius: 2, border: '1px solid #ffeaa7' }}>
                         <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#856404' }}>
                           💳 Реквизиты для оплаты
                         </Typography>
                         <Typography variant="body2" sx={{ mb: 1 }}>
                           <strong>Номер карты:</strong> 2202 2023 4567 8901
                         </Typography>
                         <Typography variant="body2" sx={{ mb: 1 }}>
                           <strong>Получатель:</strong> Иван Иванович И.
                         </Typography>
                         <Typography variant="body2" sx={{ mb: 2 }}>
                           <strong>Сумма:</strong> {order.actual_price || order.subject?.price} ₽
                         </Typography>
                         
                         {!paymentNotifications.has(order.id!) && (
                           <Button
                             size="small"
                             variant="contained"
                             color="success"
                             onClick={() => handlePaymentNotification(order.id!)}
                             sx={{ fontWeight: 600 }}
                           >
                             ✅ Я оплатил
                           </Button>
                         )}
                         {paymentNotifications.has(order.id!) && (
                           <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
                             ✅ Уведомление об оплате отправлено
                           </Typography>
                         )}
                       </Box>
                     )}

                     {/* Блок для статуса "выполнено" */}
                     {order.status === 'completed' && !isAdminView && (
                       <Box sx={{ p: 2, bgcolor: '#d4edda', borderRadius: 2, border: '1px solid #c3e6cb' }}>
                         <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#155724' }}>
                           ✅ Работа выполнена
                         </Typography>
                         <Button
                           size="small"
                           variant="outlined"
                           color="warning"
                           onClick={() => handleRequestRevision(order)}
                           sx={{ fontWeight: 600 }}
                         >
                           🔄 Нужны исправления
                         </Button>
                       </Box>
                     )}

                     <Box display="flex" justifyContent="space-between" alignItems="center">
                       <Box display="flex" gap={1}>
                         {order.files && order.files.length > 0 &&
                           <Button size="small" variant="contained" onClick={() => handleDownloadAllFiles(order.id!)}>Скачать</Button>
                         }
                       </Box>
                       <Typography variant="h6" color="primary" sx={{ fontWeight: 600 }}>#{order.id}</Typography>
                     </Box>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
      
      {/* Диалог запроса исправлений */}
      <Dialog 
        open={revisionDialogOpen} 
        onClose={handleCloseRevisionDialog}
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
          🔄 Запрос исправлений для заказа #{selectedOrderForRevision?.id}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            <strong>Заказ:</strong> {selectedOrderForRevision?.title}
          </Typography>
          
          <TextField
            autoFocus
            multiline
            rows={4}
            margin="dense"
            label="Комментарий к исправлениям *"
            fullWidth
            variant="outlined"
            value={revisionComment}
            onChange={(e) => setRevisionComment(e.target.value)}
            placeholder="Опишите, что нужно исправить..."
            sx={{ mb: 2 }}
            helperText="Укажите конкретные моменты, которые требуют доработки"
          />
          
          <TextField
            margin="dense"
            label="Оценка из Moodle (опционально)"
            fullWidth
            variant="outlined"
            value={revisionGrade}
            onChange={(e) => setRevisionGrade(e.target.value)}
            placeholder="Например: 3 из 5 или незачет"
            helperText="Если есть оценка преподавателя, укажите её"
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseRevisionDialog} variant="outlined">
            Отмена
          </Button>
          <Button 
            onClick={handleSubmitRevision} 
            variant="contained"
            color="warning"
            disabled={!revisionComment.trim() || submittingRevision}
            sx={{ fontWeight: 600 }}
          >
            {submittingRevision ? 'Отправка...' : '🔄 Отправить запрос'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrdersPage;
