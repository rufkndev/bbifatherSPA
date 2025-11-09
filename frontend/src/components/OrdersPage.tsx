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
import { getOrders, downloadFile, downloadAllFiles, sendFilesToTelegram, api, requestOrderRevision } from '../api';
import { format, differenceInDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';

const statusConfig = {
  [OrderStatus.NEW]: { color: 'info' as const, label: 'Новый', icon: '🆕', progress: 10 },
  [OrderStatus.WAITING_PAYMENT]: { color: 'warning' as const, label: 'Ожидание оплаты', icon: '💰', progress: 20 },
  [OrderStatus.PAID]: { color: 'primary' as const, label: 'Оплачен', icon: '💳', progress: 40 },
  [OrderStatus.IN_PROGRESS]: { color: 'secondary' as const, label: 'В работе', icon: '⚙️', progress: 70 },
  [OrderStatus.COMPLETED]: { color: 'success' as const, label: 'Выполнен', icon: '✅', progress: 100 },
  [OrderStatus.NEEDS_REVISION]: { color: 'error' as const, label: 'Нужны исправления', icon: '🔄', progress: 80 },
  [OrderStatus.QUEUED]: { color: 'default' as const, label: 'В очереди', icon: '🕒', progress: 5 },
  [OrderStatus.UNDER_REVIEW]: { color: 'info' as const, label: 'На рассмотрении', icon: '👀', progress: 50 },
};

const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [sendingToTelegram, setSendingToTelegram] = useState<Set<number>>(new Set());
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

  // Telegram WebApp интеграция
  const { user, isInTelegram, hapticFeedback, showAlert, showConfirm } = useTelegramWebApp();

  // 1. Эффект для определения текущего пользователя (с Telegram WebApp поддержкой)
  useEffect(() => {
    const urlTelegram = searchParams.get('telegram');
    
    // Приоритет: Telegram WebApp пользователь
    if (isInTelegram && user?.username) {
      const telegramUsername = user.username;
      localStorage.setItem('telegramUser', telegramUsername);
      setCurrentUser(telegramUsername);
      setIsAdminView(false);
      setSearchParams({}, { replace: true });
      return;
    }
    
    // Второй приоритет: URL параметр
    if (urlTelegram) {
      const cleanUser = urlTelegram.startsWith('@') ? urlTelegram.substring(1) : urlTelegram;
      localStorage.setItem('telegramUser', cleanUser);
      setCurrentUser(cleanUser);
      setIsAdminView(false);
      setSearchParams({}, { replace: true });
    } else {
      // Третий приоритет: сохранённый пользователь
      const storedUser = localStorage.getItem('telegramUser');
      if (storedUser) {
        setCurrentUser(storedUser);
        setIsAdminView(storedUser === 'admin_view');
      } else {
        setLoading(false); // Нет пользователя, заканчиваем загрузку
      }
    }
  }, [searchParams, setSearchParams, isInTelegram, user]);

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

  const handleSendFilesToTelegram = async (orderId: number, telegram: string) => {
    setSendingToTelegram(prev => new Set(prev).add(orderId));
    
    try {
      // Тактильная обратная связь
      hapticFeedback.impactLight();
      
      const result = await sendFilesToTelegram(orderId, telegram);
      
      // Показываем результат пользователю
      const message = `✅ ${result.sent_count} из ${result.total_files} файлов отправлено в Telegram!`;
      
      if (isInTelegram) {
        hapticFeedback.success();
        showAlert(message);
      } else {
        alert(message);
      }
    } catch (error: any) {
      console.error('Ошибка отправки файлов в Telegram:', error);
      
      let errorMessage = '❌ Ошибка отправки файлов';
      
      if (error?.response?.data?.detail) {
        errorMessage = `❌ ${error.response.data.detail}`;
      } else if (error?.message) {
        errorMessage = `❌ ${error.message}`;
      }
      
      if (isInTelegram) {
        hapticFeedback.error();
        showAlert(errorMessage);
      } else {
        alert(errorMessage);
      }
    } finally {
      setSendingToTelegram(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const handlePaymentNotification = async (orderId: number) => {
    try {
      // Тактильная обратная связь
      hapticFeedback.impactLight();
      
      await api.post(`/api/orders/${orderId}/payment-notification`);
      setPaymentNotifications(prev => new Set(prev).add(orderId));
      
      // Используем Telegram уведомление или обычный alert
      if (isInTelegram) {
        hapticFeedback.success();
        showAlert('✅ Уведомление об оплате отправлено администратору!');
      } else {
        alert('✅ Уведомление об оплате отправлено администратору!');
      }
    } catch (error) {
      console.error('Ошибка отправки уведомления об оплате:', error);
      
      if (isInTelegram) {
        hapticFeedback.error();
        showAlert('❌ Ошибка отправки уведомления. Попробуйте позже.');
      }
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
    
    // Тактильная обратная связь
    hapticFeedback.impactMedium();
    
    try {
      const updatedOrder = await requestOrderRevision(
        selectedOrderForRevision.id,
        revisionComment.trim(),
        revisionGrade.trim() || undefined
      );
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
      handleCloseRevisionDialog();
      
      if (isInTelegram) {
        hapticFeedback.success();
        showAlert('✅ Запрос на исправления отправлен!');
      } else {
        alert('✅ Запрос на исправления отправлен!');
      }
    } catch (error) {
      console.error('Ошибка отправки запроса исправлений:', error);
      
      if (isInTelegram) {
        hapticFeedback.error();
        showAlert('❌ Ошибка отправки запроса. Попробуйте позже.');
      }
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

  // Форма входа для студента - адаптированная под мобильную версию
  if (!currentUser) {
    return (
      <Box sx={{ 
        maxWidth: { xs: '100%', sm: 500 }, 
        mx: 'auto', 
        px: { xs: 2, sm: 3 }, 
        py: { xs: 4, sm: 8 }, 
        textAlign: 'center' 
      }}>
         <Card sx={{ 
           p: { xs: 3, sm: 4 }, 
           borderRadius: { xs: 3, sm: 4 }, 
           boxShadow: 3,
           border: '1px solid #e2e8f0',
         }}>
           <Typography 
             variant="h4" 
             sx={{ 
               fontWeight: 700, 
               mb: 2,
               fontSize: { xs: '1.5rem', sm: '2.125rem' }
             }}
           >
             Мои заказы
           </Typography>
           <Typography 
             variant="body1" 
             color="text.secondary" 
             sx={{ 
               mb: 4,
               fontSize: { xs: '0.9rem', sm: '1rem' }
             }}
           >
             Введите ваш Telegram никнейм.
           </Typography>
           <TextField
              fullWidth
              label="Ваш Telegram никнейм"
              value={telegramInput}
              onChange={(e) => setTelegramInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="@username"
              sx={{ 
                mb: 2,
                '& .MuiInputBase-root': {
                  height: { xs: 48, sm: 56 },
                },
                '& .MuiInputLabel-root': {
                  fontSize: { xs: '0.9rem', sm: '1rem' }
                }
              }}
            />
            <Button 
              fullWidth 
              variant="contained" 
              size="large" 
              onClick={handleLogin} 
              startIcon={<SearchIcon />}
              sx={{
                height: { xs: 48, sm: 56 },
                fontSize: { xs: '0.9rem', sm: '1rem' },
                fontWeight: 600
              }}
            >
              Найти
            </Button>
            <Button 
              fullWidth 
              variant="text" 
              onClick={handleAdminLogin} 
              sx={{ 
                mt: 2, 
                color: 'text.secondary',
                height: { xs: 40, sm: 48 },
                fontSize: { xs: '0.85rem', sm: '1rem' }
              }}
            >
              Войти как администратор
            </Button>
         </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 1, sm: 3 }, py: { xs: 2, sm: 4 } }}>
      {/* Мобильный header */}
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'stretch', sm: 'center' }, 
        p: { xs: 2, sm: 3 }, 
        mb: { xs: 2, sm: 4 }, 
        background: '#fff', 
        borderRadius: 4, 
        border: '1px solid #e2e8f0' 
      }}>
        <div>
          <Typography 
            variant="h5" 
            component="h1" 
            sx={{ 
              fontWeight: 700,
              fontSize: { xs: '1.4rem', sm: '2.125rem' }
            }}
          >
            {isAdminView ? 'Все заказы' : `Заказы ${currentUser}`}
          </Typography>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              color: 'grey.600',
              fontSize: { xs: '0.9rem', sm: '1rem' },
              mb: { xs: 2, sm: 0 }
            }}
          >
            {isAdminView ? 'Панель администратора' : 'Отслеживайте статус ваших работ'}
          </Typography>
        </div>
        <Button 
          variant="outlined" 
          onClick={handleLogout} 
          startIcon={<LogoutIcon />}
          size={window.innerWidth < 600 ? 'medium' : 'large'}
          sx={{
            alignSelf: { xs: 'flex-start', sm: 'center' },
          }}
        >
          Выйти
        </Button>
      </Box>

      {/* Адаптивная статистика */}
      <Grid container spacing={{ xs: 1, sm: 2 }} mb={{ xs: 3, sm: 4 }}>
         {statsData.map(({ status, config, count }) => (
            <Grid item xs={6} sm={4} md={2} key={status}>
              <Card sx={{ 
                textAlign: 'center', 
                p: { xs: 1, sm: 1.5 }, 
                border: '1px solid #e2e8f0',
                borderRadius: 2,
              }}>
                <Typography sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' } }}>{config.icon}</Typography>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    fontWeight: 700,
                    fontSize: { xs: '1.3rem', sm: '2.125rem' }
                  }}
                >
                  {count}
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    color: 'text.secondary', 
                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                    lineHeight: 1.2
                  }}
                >
                  {config.label}
                </Typography>
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
        <Grid container spacing={{ xs: 2, sm: 3 }}>
          {orders.map((order) => {
            const statusInfo = statusConfig[order.status as OrderStatus];
            const deadlineStatus = getDeadlineStatus(order.deadline);
            
            return (
              <Grid item xs={12} md={6} lg={4} key={order.id}>
                <Card sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  borderRadius: { xs: 3, sm: 4 }, 
                  boxShadow: 1,
                  border: '1px solid #e2e8f0',
                }}>
                  <CardContent sx={{ 
                    flexGrow: 1, 
                    p: { xs: 2, sm: 3 },
                  }}>
                    {/* Мобильная версия заголовка */}
                    <Box 
                      display="flex" 
                      flexDirection={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between" 
                      alignItems={{ xs: 'start', sm: 'start' }} 
                      mb={2}
                      gap={1}
                    >
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          fontWeight: 700,
                          fontSize: { xs: '1rem', sm: '1.25rem' },
                          lineHeight: 1.2,
                          order: { xs: 2, sm: 1 }
                        }}
                      >
                        {order.title}
                      </Typography>
                      <Chip 
                        label={`${statusInfo.icon} ${statusInfo.label}`} 
                        size="small" 
                        color={statusInfo.color} 
                        sx={{ 
                          fontWeight: 600,
                          fontSize: { xs: '0.7rem', sm: '0.75rem' },
                          height: { xs: 24, sm: 32 },
                          order: { xs: 1, sm: 2 },
                          alignSelf: { xs: 'flex-start', sm: 'flex-start' }
                        }} 
                      />
                    </Box>

                    {/* Прогресс-бар */}
                    <Box mb={{ xs: 2, sm: 3 }}>
                       <LinearProgress 
                         variant="determinate" 
                         value={statusInfo.progress} 
                         color={statusInfo.color} 
                         sx={{
                           height: { xs: 6, sm: 4 },
                           borderRadius: 3,
                         }}
                       />
                    </Box>

                    {/* Информация о заказе */}
                    <Stack spacing={1} mb={2}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <CalendarToday sx={{ fontSize: { xs: 14, sm: 16 } }} />
                        <Typography 
                          variant="body2"
                          sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                        >
                          {format(new Date(order.deadline), 'dd MMM yyyy', { locale: ru })} ({deadlineStatus.text})
                        </Typography>
                      </Box>
                      {isAdminView && order.student && (
                        <Typography 
                          variant="body2"
                          sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}
                        >
                          <strong>Студент:</strong> {order.student.name} (@{order.student.telegram})
                        </Typography>
                      )}
                    </Stack>
                  </CardContent>
                  <CardActions sx={{ 
                    p: { xs: 1.5, sm: 2 }, 
                    flexDirection: 'column', 
                    alignItems: 'stretch', 
                    gap: { xs: 1.5, sm: 2 } 
                  }}>
                     {/* Блок для статуса "ожидание оплаты" */}
                     {order.status === OrderStatus.WAITING_PAYMENT && !isAdminView && (
                       <Box sx={{ 
                         p: { xs: 1.5, sm: 2 }, 
                         bgcolor: '#fff3cd', 
                         borderRadius: { xs: 1.5, sm: 2 }, 
                         border: '1px solid #ffeaa7' 
                       }}>
                         <Typography 
                           variant="subtitle2" 
                           sx={{ 
                             fontWeight: 600, 
                             mb: 1, 
                             color: '#856404',
                             fontSize: { xs: '0.85rem', sm: '0.875rem' }
                           }}
                         >
                           💳 Реквизиты для оплаты
                         </Typography>
                         <Typography 
                           variant="body2" 
                           sx={{ 
                             mb: 1,
                             fontSize: { xs: '0.8rem', sm: '0.875rem' }
                           }}
                         >
                           <strong>Карта Тбанк:</strong> +7 962 120 63 60
                         </Typography>
                         <Typography 
                           variant="body2" 
                           sx={{ 
                             mb: 1,
                             fontSize: { xs: '0.8rem', sm: '0.875rem' }
                           }}
                         >
                           <strong>Получатель:</strong> Таранов А. И.
                         </Typography>
                         <Typography 
                           variant="body2" 
                           sx={{ 
                             mb: 2,
                             fontSize: { xs: '0.8rem', sm: '0.875rem' }
                           }}
                         >
                           <strong>Сумма:</strong> {order.actual_price || order.subject?.price} ₽
                         </Typography>
                         
                         {!paymentNotifications.has(order.id!) && (
                           <Button
                             size="small"
                             variant="contained"
                             color="success"
                             onClick={() => handlePaymentNotification(order.id!)}
                             sx={{ 
                               fontWeight: 600,
                               width: { xs: '100%', sm: 'auto' },
                               py: { xs: 1, sm: 0.5 },
                             }}
                           >
                             ✅ Я оплатил
                           </Button>
                         )}
                         {paymentNotifications.has(order.id!) && (
                           <Typography 
                             variant="body2" 
                             color="success.main" 
                             sx={{ 
                               fontWeight: 600,
                               fontSize: { xs: '0.8rem', sm: '0.875rem' }
                             }}
                           >
                             ✅ Уведомление об оплате отправлено
                           </Typography>
                         )}
                       </Box>
                     )}

                     {/* Блок для статуса "выполнено" */}
                     {order.status === OrderStatus.COMPLETED && !isAdminView && (
                       <Box sx={{ 
                         p: { xs: 1.5, sm: 2 }, 
                         bgcolor: '#d4edda', 
                         borderRadius: { xs: 1.5, sm: 2 }, 
                         border: '1px solid #c3e6cb' 
                       }}>
                         <Typography 
                           variant="subtitle2" 
                           sx={{ 
                             fontWeight: 600, 
                             mb: 1, 
                             color: '#155724',
                             fontSize: { xs: '0.85rem', sm: '0.875rem' }
                           }}
                         >
                           ✅ Работа выполнена
                         </Typography>
                         <Button
                           size="small"
                           variant="outlined"
                           color="warning"
                           onClick={() => handleRequestRevision(order)}
                           sx={{ 
                             fontWeight: 600,
                             width: { xs: '100%', sm: 'auto' },
                             py: { xs: 1, sm: 0.5 },
                           }}
                         >
                           🔄 Нужны исправления
                         </Button>
                       </Box>
                     )}

                     {/* Нижняя панель карточки */}
                     <Box 
                       display="flex" 
                       flexDirection={{ xs: 'column', sm: 'row' }}
                       justifyContent="space-between" 
                       alignItems={{ xs: 'stretch', sm: 'center' }}
                       gap={{ xs: 1, sm: 0 }}
                     >
                       <Box display="flex" flexDirection="column" gap={1}>
                         {order.files && order.files.length > 0 && (
                           <>
                             {/* Основная кнопка - отправить в Telegram */}
                             {!isAdminView && currentUser && (
                               <Button 
                                 size="small" 
                                 variant="contained" 
                                 color="primary"
                                 disabled={sendingToTelegram.has(order.id!)}
                                 onClick={() => handleSendFilesToTelegram(order.id!, currentUser)}
                                 sx={{
                                   py: { xs: 1, sm: 0.5 },
                                   fontSize: { xs: '0.8rem', sm: '0.875rem' },
                                   fontWeight: 600
                                 }}
                               >
                                 {sendingToTelegram.has(order.id!) ? 
                                   '⏳ Отправляю...' : 
                                   '📱 Отправить в Telegram'
                                 }
                               </Button>
                             )}
                             
                             {/* Дополнительная кнопка - классическое скачивание */}
                             <Button 
                               size="small" 
                               variant="outlined" 
                               onClick={() => handleDownloadAllFiles(order.id!)}
                               disabled={downloadingFiles.has(`${order.id}-all`) || sendingToTelegram.has(order.id!)}
                               sx={{
                                 py: { xs: 1, sm: 0.5 },
                                 fontSize: { xs: '0.75rem', sm: '0.8rem' }
                               }}
                             >
                               {downloadingFiles.has(`${order.id}-all`) ? 
                                 '⏳ Скачиваю...' : 
                                 '💾 Скачать в браузер'
                               }
                             </Button>
                           </>
                         )}
                       </Box>
                       <Typography 
                         variant="h6" 
                         color="primary" 
                         sx={{ 
                           fontWeight: 600,
                           fontSize: { xs: '1rem', sm: '1.25rem' },
                           textAlign: { xs: 'center', sm: 'right' },
                           mt: { xs: 1, sm: 0 }
                         }}
                       >
                         #{order.id}
                       </Typography>
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
