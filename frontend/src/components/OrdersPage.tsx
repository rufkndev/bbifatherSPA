import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  Edit as EditIcon
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
  
  // Состояние для модального окна исправлений
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [selectedOrderForRevision, setSelectedOrderForRevision] = useState<Order | null>(null);
  const [revisionComment, setRevisionComment] = useState('');
  const [revisionGrade, setRevisionGrade] = useState('');
  const [submittingRevision, setSubmittingRevision] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await getOrders(1, 50); // Загружаем больше заказов
      setOrders(response.orders);
    } catch (error) {
      console.error('Ошибка загрузки заказов:', error);
    } finally {
      setLoading(false);
    }
  };



  const handleDownloadFile = async (orderId: number, filename: string) => {
    const downloadKey = `${orderId}-${filename}`;
    
    try {
      setDownloadingFiles(prev => new Set(prev).add(downloadKey));
      await downloadFile(orderId, filename);
      console.log(`✅ Файл скачан: ${filename} для заказа #${orderId}`);
    } catch (error) {
      console.error('Ошибка скачивания файла:', error);
      alert('Ошибка скачивания файла. Попробуйте еще раз.');
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
      console.log(`✅ Все файлы скачаны для заказа #${orderId}`);
    } catch (error) {
      console.error('Ошибка скачивания всех файлов:', error);
      alert('Ошибка скачивания файлов. Попробуйте еще раз.');
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
        console.log(`✅ Уведомление об оплате отправлено для заказа #${orderId}`);
        // Добавляем ID в список отправленных уведомлений
        setPaymentNotifications(prev => new Set(prev).add(orderId));
        // Показываем подтверждение пользователю
        alert('✅ Уведомление об оплате отправлено администратору!');
      }
    } catch (error) {
      console.error('Ошибка отправки уведомления об оплате:', error);
      alert('Ошибка отправки уведомления. Попробуйте еще раз.');
    }
  };

  const handleRequestRevision = (order: Order) => {
    setSelectedOrderForRevision(order);
    setRevisionComment('');
    setRevisionGrade('');
    setRevisionDialogOpen(true);
  };

  const handleSubmitRevision = async () => {
    if (!selectedOrderForRevision || !selectedOrderForRevision.id || !revisionComment.trim()) {
      alert('Пожалуйста, введите комментарий к исправлениям');
      return;
    }

    try {
      setSubmittingRevision(true);
      const updatedOrder = await requestOrderRevision(
        selectedOrderForRevision.id,
        revisionComment.trim(),
        revisionGrade.trim() || undefined
      );
      
      // Обновляем заказ в списке
      setOrders(prev => prev.map(order => 
        order.id === updatedOrder.id ? updatedOrder : order
      ));
      
      setRevisionDialogOpen(false);
      setSelectedOrderForRevision(null);
      setRevisionComment('');
      setRevisionGrade('');
      
      alert('✅ Запрос на исправления отправлен!');
      console.log(`✅ Запрос исправлений отправлен для заказа #${selectedOrderForRevision.id}`);
    } catch (error) {
      console.error('Ошибка отправки запроса исправлений:', error);
      alert('Ошибка отправки запроса. Попробуйте еще раз.');
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
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const daysLeft = differenceInDays(deadlineDate, today);
    
    if (daysLeft < 0) {
      return { type: 'overdue', text: 'Просрочен', color: 'error' };
    } else if (daysLeft === 0) {
      return { type: 'today', text: 'Сегодня', color: 'warning' };
    } else if (daysLeft <= 3) {
      return { type: 'urgent', text: `${daysLeft} дн.`, color: 'warning' };
    } else {
      return { type: 'normal', text: `${daysLeft} дн.`, color: 'default' };
    }
  };

  const getOrdersByStatus = () => {
    const grouped = orders.reduce((acc, order) => {
      const status = order.status;
      if (!acc[status]) acc[status] = [];
      acc[status].push(order);
      return acc;
    }, {} as Record<string, Order[]>);
    return grouped;
  };

  const ordersByStatus = getOrdersByStatus();
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
          Мои заказы
        </Typography>
        <Typography 
          variant="subtitle1" 
          sx={{ 
            color: 'grey.600',
            fontWeight: 500,
            fontSize: '1.1rem',
          }}
        >
          Отслеживайте статус ваших работ
        </Typography>
      </Box>

      {/* Статистика */}
      {orders.length > 0 && (
        <Grid container spacing={1} mb={4}>
          {statsData.map(({ status, config, count }) => (
            <Grid item xs={6} sm={4} md={2} key={status}>
              <Card 
                sx={{ 
                  textAlign: 'center',
                  background: count > 0 
                    ? 'rgba(37, 99, 235, 0.05)'
                    : '#ffffff',
                  border: count > 0 
                    ? '1px solid rgba(37, 99, 235, 0.2)'
                    : '1px solid #e2e8f0',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                  },
                }}
              >
                <CardContent sx={{ py: 2, px: 1 }}>
                  <Box
                    sx={{
                      fontSize: '1.5rem',
                      mb: 1,
                      opacity: count > 0 ? 1 : 0.5,
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '2rem',
                      lineHeight: 1,
                    }}
                  >
                    {config.icon}
                  </Box>
                  
                  <Typography 
                    variant="h5" 
                    sx={{ 
                      fontWeight: 700,
                      mb: 0.5,
                      color: count > 0 ? '#2563eb' : '#64748b',
                      fontSize: '1.5rem',
                    }}
                  >
                    {count}
                  </Typography>
                  
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      color: count > 0 ? '#374151' : '#6b7280',
                      fontWeight: 500,
                      fontSize: '0.75rem',
                      lineHeight: 1.2,
                    }}
                  >
                    {config.label}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Блок тех поддержки */}
      <Card 
        sx={{ 
          mb: 4,
          background: 'rgba(37, 99, 235, 0.05)',
          border: '1px solid rgba(37, 99, 235, 0.2)', 
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
        <CardContent sx={{ py: 3 }}>
          <Box display="flex" alignItems="center" gap={3}>
            <Box sx={{ 
              width: 48, 
              height: 48, 
              borderRadius: '8px', 
              background: '#2563eb',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.2)',
            }}>
              <Typography 
                variant="h6" 
                sx={{ 
                  color: 'white',
                  fontSize: '1.5rem',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                💬
              </Typography>
            </Box>
            <Box flexGrow={1}>
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 600, 
                  mb: 1,
                  color: '#1e293b',
                }}
              >
                Техническая поддержка
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  color: 'grey.700',
                  fontWeight: 500,
                  fontSize: '1rem',
                }}
              >
                По сложным вопросам пишите в Telegram:{' '}
                <Box 
                  component="span" 
                  sx={{ 
                    fontWeight: 600,
                    color: '#2563eb',
                  }}
                >
                  @artemonnnnnnn
                </Box>
              </Typography>
            </Box>
            <Button
              variant="contained"
              href="https://t.me/artemonnnnnnn"
              target="_blank"
              sx={{ 
                borderRadius: 6,
                px: 2,
                py: 1,
                fontWeight: 600,
                textTransform: 'none',
                background: '#2563eb',
                '&:hover': {
                  background: '#1d4ed8',
                }
              }}
            >
              Написать
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Заказы */}
      {orders.length === 0 ? (
        <Card 
          sx={{ 
            textAlign: 'center', 
            py: 8,
            background: '#ffffff',
            border: '2px dashed #d1d5db',
            borderRadius: 4,
          }}
        >
          <CardContent sx={{ position: 'relative', zIndex: 1 }}>
            <Box
              sx={{
                fontSize: '4rem',
                mb: 3,
                opacity: 0.7,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '5rem',
                lineHeight: 1,
              }}
            >
              📝
            </Box>
            
            <Typography 
              variant="h3" 
              gutterBottom 
              sx={{ 
                fontWeight: 700, 
                mb: 2,
                color: '#1e293b',
              }}
            >
              У вас пока нет заказов
            </Typography>
            
            <Typography 
              variant="h6" 
              sx={{ 
                mb: 4,
                color: 'grey.600',
                fontWeight: 500,
                maxWidth: 400,
                mx: 'auto',
              }}
            >
              Создайте свой первый заказ прямо сейчас и начните работать с нашими экспертами!
            </Typography>
            
            <Button
              component={Link}
              to="/create"
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              sx={{ 
                borderRadius: 4, 
                px: 3, 
                py: 1.5,
                fontSize: '0.9rem',
                fontWeight: 600,
                textTransform: 'none',
                background: '#2563eb',
                '&:hover': {
                  background: '#1d4ed8',
                }
              }}
            >
              Создать заказ
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
                <Card 
                  sx={{ 
                    height: '100%',
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 4,
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    },
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <CardContent sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    p: 3,
                    '&:last-child': { pb: 3 }
                  }}>
                    {/* Заголовок и статус */}
                    <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                      <Typography 
                        variant="h6" 
                        component="h3" 
                        sx={{ 
                          fontWeight: 700,
                          color: '#1e293b',
                          flexGrow: 1,
                          pr: 1,
                          lineHeight: 1.3,
                        }}
                      >
                        {order.title}
                      </Typography>
                      <Chip
                        label={`${statusInfo.icon} ${statusConfig[order.status].label}`}
                        size="small"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          background: statusInfo.color === 'success'
                            ? 'rgba(16, 185, 129, 0.1)'
                            : statusInfo.color === 'error'
                            ? 'rgba(239, 68, 68, 0.1)'
                            : 'rgba(37, 99, 235, 0.1)',
                          color: statusInfo.color === 'success'
                            ? '#059669'
                            : statusInfo.color === 'error'
                            ? '#dc2626'
                            : '#2563eb',
                          border: `1px solid ${
                            statusInfo.color === 'success'
                              ? '#10b981'
                              : statusInfo.color === 'error'
                              ? '#ef4444'
                              : '#2563eb'
                          }33`,
                        }}
                      />
                    </Box>

                    {/* Прогресс */}
                    <Box mb={3}>
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            color: 'grey.600',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                          }}
                        >
                          Прогресс: {statusInfo.progress}%
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          width: '100%',
                          height: 6,
                          borderRadius: 3,
                          background: 'rgba(37, 99, 235, 0.1)',
                          position: 'relative',
                        }}
                      >
                        <Box
                          sx={{
                            width: `${statusInfo.progress}%`,
                            height: '100%',
                            background: statusInfo.color === 'success' 
                              ? '#10b981'
                              : statusInfo.color === 'error' 
                              ? '#ef4444'
                              : '#2563eb',
                            borderRadius: 3,
                            transition: 'width 0.3s ease-in-out',
                          }}
                        />
                      </Box>
                    </Box>

                    {/* Описание */}
                    <Typography 
                      variant="body2" 
                      color="text.secondary" 
                      sx={{ 
                        mb: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {order.description}
                    </Typography>

                    {/* Детали */}
                    <Stack spacing={1} mb={2}>
                      <Box display="flex" alignItems="center" gap={1}>
                        <CalendarToday sx={{ fontSize: 16, color: deadlineStatus.color === 'error' ? 'error.main' : 'text.secondary' }} />
                        <Typography 
                          variant="body2" 
                          color={deadlineStatus.color === 'error' ? 'error.main' : 'text.secondary'}
                          sx={{ fontWeight: deadlineStatus.type === 'urgent' ? 600 : 400 }}
                        >
                          {format(new Date(order.deadline), 'dd MMM yyyy', { locale: ru })} 
                          ({deadlineStatus.text})
                        </Typography>
                      </Box>

                      {order.created_at && (
                        <Typography variant="body2" color="text.secondary">
                          Создан: {format(new Date(order.created_at), 'dd.MM.yyyy', { locale: ru })}
                        </Typography>
                      )}

                      {/* Блок оплаты для статуса "ожидание оплаты" */}
                      {order.status === OrderStatus.WAITING_PAYMENT && (
                        <Card sx={{ mt: 2, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.300' }}>
                          <CardContent sx={{ py: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: 'warning.dark' }}>
                              💳 Реквизиты для оплаты
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Карта Тбанк:</strong> +79621206360
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Получатель:</strong> Таранов А. И. 
                            </Typography>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                              <strong>Сумма к оплате:</strong> {order.actual_price || order.subject?.price} ₽
                            </Typography>
                            <Box display="flex" alignItems="center" mt={2}>
                              {paymentNotifications.has(order.id!) ? (
                                <Box display="flex" alignItems="center" sx={{ color: 'success.main' }}>
                                  <span style={{ marginRight: 8 }}>✅</span>
                                  <Typography variant="body2" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                                    Уведомление отправлено администратору
                                  </Typography>
                                </Box>
                              ) : (
                                <>
                                  <input 
                                    type="checkbox" 
                                    id={`payment-${order.id}`}
                                    onChange={(e) => e.target.checked && handlePaymentNotification(order.id!)}
                                    style={{ marginRight: 8 }}
                                  />
                                  <label htmlFor={`payment-${order.id}`} style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
                                    Я оплатил(а)
                                  </label>
                                </>
                              )}
                            </Box>
                          </CardContent>
                        </Card>
                      )}
                    </Stack>
                  </CardContent>

                  {/* Footer */}
                  <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" width="100%">
                      <Box display="flex" gap={1} flexWrap="wrap">
                        {order.files && order.files.length > 0 && (
                          <>
                            {/* Кнопка "Скачать все" если файлов больше одного */}
                            {order.files.length > 1 && (
                              <Button
                                size="small"
                                variant="contained"
                                color="primary"
                                startIcon={downloadingFiles.has(`${order.id || 'unknown'}-all`) ? 
                                  <CircularProgress size={14} color="inherit" /> : 
                                  <FileDownload sx={{ fontSize: 14 }} />
                                }
                                onClick={() => order.id && handleDownloadAllFiles(order.id)}
                                disabled={downloadingFiles.has(`${order.id || 'unknown'}-all`) || !order.id}
                                sx={{ 
                                  fontSize: '0.75rem',
                                  px: 1.5,
                                  py: 0.5,
                                  textTransform: 'none',
                                  fontWeight: 600
                                }}
                              >
                                {downloadingFiles.has(`${order.id || 'unknown'}-all`) ? 
                                  'Архивирование...' : 
                                  `Скачать все (${order.files.length})`
                                }
                              </Button>
                            )}
                            
                            {/* Отдельные файлы */}
                            <Box display="flex" gap={0.5} flexWrap="wrap">
                              {order.files.slice(0, order.files.length > 1 ? 2 : 3).map((filename, index) => {
                                const downloadKey = `${order.id || 'unknown'}-${filename}`;
                                const isDownloading = downloadingFiles.has(downloadKey);
                                
                                return (
                                  <Button
                                    key={index}
                                    size="small"
                                    variant="outlined"
                                    color="primary"
                                    startIcon={isDownloading ? <CircularProgress size={14} /> : <AttachFile sx={{ fontSize: 14 }} />}
                                    onClick={() => order.id && handleDownloadFile(order.id, filename)}
                                    disabled={isDownloading || !order.id}
                                    sx={{ 
                                      minWidth: 'auto',
                                      fontSize: '0.75rem',
                                      px: 1,
                                      py: 0.5,
                                      textTransform: 'none'
                                    }}
                                  >
                                    {isDownloading ? 'Скачивание...' : filename.length > 15 ? filename.substring(0, 15) + '...' : filename}
                                  </Button>
                                );
                              })}
                              
                              {/* Показываем "еще X файлов" если их больше чем показано */}
                              {order.files.length > (order.files.length > 1 ? 2 : 3) && (
                                <Typography 
                                  variant="body2" 
                                  color="text.secondary" 
                                  sx={{ 
                                    alignSelf: 'center',
                                    fontSize: '0.75rem',
                                    fontStyle: 'italic'
                                  }}
                                >
                                  +{order.files.length - (order.files.length > 1 ? 2 : 3)} еще
                                </Typography>
                              )}
                            </Box>
                          </>
                        )}
                      </Box>
                      
                      <Box display="flex" alignItems="center" gap={1}>
                        {/* Кнопка "Нужны исправления" для выполненных работ */}
                        {order.status === OrderStatus.COMPLETED && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                            onClick={() => handleRequestRevision(order)}
                            sx={{ 
                              fontSize: '0.75rem',
                              px: 1.5,
                              py: 0.5,
                              textTransform: 'none',
                              borderColor: 'error.light',
                              '&:hover': {
                                borderColor: 'error.main',
                                backgroundColor: 'error.light',
                                color: 'white'
                              }
                            }}
                          >
                            Нужны исправления
                          </Button>
                        )}
                        
                        <Typography variant="h6" color="primary" sx={{ fontWeight: 600 }}>
                          #{order.id}
                        </Typography>
                      </Box>
                    </Box>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Модальное окно для запроса исправлений */}
      <Dialog
        open={revisionDialogOpen}
        onClose={handleCloseRevisionDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Запрос исправлений
          {selectedOrderForRevision && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Заказ: {selectedOrderForRevision.title}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Комментарий преподавателя из Moodle *"
              value={revisionComment}
              onChange={(e) => setRevisionComment(e.target.value)}
              placeholder="Вставьте комментарий преподавателя из системы Moodle..."
              helperText="Скопируйте комментарий преподавателя из Moodle с указанием, что нужно исправить"
              sx={{ mb: 3 }}
            />
            
            <TextField
              fullWidth
              label="Оценка из Moodle (необязательно)"
              value={revisionGrade}
              onChange={(e) => setRevisionGrade(e.target.value)}
              placeholder="Например: 3.5, зачтено, незачтено, 85 баллов"
              helperText="Укажите оценку, которую поставил преподаватель в Moodle"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleCloseRevisionDialog}>
            Отмена
          </Button>
          <Button
            onClick={handleSubmitRevision}
            variant="contained"
            color="error"
            disabled={submittingRevision || !revisionComment.trim()}
            startIcon={submittingRevision ? <CircularProgress size={20} /> : undefined}
          >
            {submittingRevision ? 'Отправка...' : 'Отправить запрос'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Условия использования */}
      <Box 
        sx={{ 
          mt: 6, 
          pt: 4, 
          borderTop: '1px solid #e2e8f0',
          textAlign: 'center'
        }}
      >
        <Typography 
          variant="body2" 
          sx={{ 
            color: '#6b7280',
            fontSize: '0.75rem',
            lineHeight: 1.4,
            maxWidth: 800,
            mx: 'auto',
            px: 2,
          }}
        >
          Используя данный сервис для заказа практических работ вы подтверждаете свое согласие со следующими условиями использования:
          <br />
          1. Администратор имеет право отказать в выполнении практической работы без объяснения причин
          <br />
          2. Пользователь имеет право на одно бесплатное исправление. Полный список замечаний по работе необходимо узнать у преподавателя до подачи заявки на исправление
          <br />
          3. Цены на практические работы могут изменяться в течение всего учебного периода
          <br />
          4. Администратор может прикрепить практическую работу позже выставленного пользователем дедлайна, если пользователь выставил дедлайн, срок до которого менее одной недели
        </Typography>
      </Box>

    </Box>
  );
};

export default OrdersPage;