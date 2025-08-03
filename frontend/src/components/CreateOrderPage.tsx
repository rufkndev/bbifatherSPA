import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Chip,
  Checkbox,
  FormControlLabel,
  Paper,
  Divider,
  IconButton,
  Badge,
  Switch
} from '@mui/material';
import {
  ArrowBack,
  ArrowForward,
  ShoppingCart,
  Assignment,
  CheckCircle
} from '@mui/icons-material';
import { Subject } from '../types';
import { getSubjects, createOrder } from '../api';
import { subjectsData, getSubjectById, calculateFullCoursePrice, calculateSelectedWorksPrice, SubjectData } from '../data/subjects';

const steps = ['Выберите предмет', 'Выберите работы', 'Ваши данные', 'Подтверждение'];

const CreateOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeStep, setActiveStep] = useState(0);
  
  const [formData, setFormData] = useState({
    // Данные студента
    studentName: '',
    studentGroup: '',
    studentTelegram: '',
    
    // Данные заказа
    subjectId: '',
    selectedWorks: [] as string[],
    isFullCourse: false,
    isCustom: false,
    customSubject: '',
    customWork: '',
    title: '',
    description: '',
    inputData: '',
    variantInfo: '',
    deadline: '',
  });

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    try {
      const data = await getSubjects();
      setSubjects(data);
    } catch (error) {
      console.error('Ошибка загрузки предметов:', error);
      setError('Не удалось загрузить список предметов');
    }
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleInputChange = (field: string) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | any
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleWorkToggle = (workId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedWorks: prev.selectedWorks.includes(workId)
        ? prev.selectedWorks.filter(id => id !== workId)
        : [...prev.selectedWorks, workId],
      isFullCourse: false
    }));
  };

  const handleFullCourseToggle = () => {
    const selectedSubjectData = getSubjectById(formData.subjectId);
    setFormData(prev => ({
      ...prev,
      isFullCourse: !prev.isFullCourse,
      selectedWorks: !prev.isFullCourse ? selectedSubjectData?.works.map(w => w.id) || [] : []
    }));
  };

  const getSelectedSubjectData = (): SubjectData | undefined => {
    return getSubjectById(formData.subjectId);
  };

  const getTotalPrice = (): number => {
    const subjectData = getSelectedSubjectData();
    if (!subjectData) return 0;
    
    if (formData.isFullCourse) {
      return calculateFullCoursePrice(subjectData);
    }
    return calculateSelectedWorksPrice(subjectData, formData.selectedWorks);
  };

  const canProceedToNextStep = (): boolean => {
    switch (activeStep) {
      case 0: // Выбор предмета
        if (formData.isCustom) {
          return formData.customSubject.trim() !== '';
        } else {
          return formData.subjectId !== '';
        }
      case 1: // Выбор работ
        if (formData.isCustom) {
          return formData.customWork.trim() !== '' && formData.deadline !== '';
        }
        return formData.selectedWorks.length > 0 || formData.isFullCourse;
      case 2: // Данные студента
        return formData.studentName.trim() !== '' && 
               formData.studentGroup.trim() !== '' && 
               formData.studentTelegram.trim() !== '' &&
               formData.deadline !== '';
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      console.log('🔍 Отладка формы:');
      console.log('formData:', formData);
      console.log('subjects из API (количество):', subjects.length);
      console.log('subjects из API:', subjects);
      console.log('subjectsData (локальные, количество):', subjectsData.length);
      
      // Проверяем что subjects загружены из API
      if (subjects.length === 0) {
        throw new Error('Предметы не загружены из API. Обновите страницу или проверьте backend.');
      }
      const subjectData = getSelectedSubjectData();
      const selectedWorks = formData.isCustom ? [] : (formData.isFullCourse ? subjectData?.works || [] : subjectData?.works.filter(w => formData.selectedWorks.includes(w.id)) || []);
      
      let title = formData.isCustom ? formData.customWork : '';
      let description = formData.description || '';
      
      if (!formData.isCustom) {
        if (formData.isFullCourse) {
          title = `Весь курс: ${subjectData?.name}`;
          description = `Все работы по предмету ${subjectData?.name}: ${selectedWorks.map(w => w.title).join(', ')}`;
        } else {
          title = selectedWorks.length === 1 ? selectedWorks[0].title : `${selectedWorks.length} работ по ${subjectData?.name}`;
          description = selectedWorks.map(w => `${w.title}${w.description ? ` (${w.description})` : ''}`).join('; ');
        }
      }

      // Определяем subject_id
      let finalSubjectId;
      if (formData.isCustom) {
        const customSubject = subjects.find(s => s.name === 'Другой предмет');
        if (customSubject) {
          finalSubjectId = customSubject.id;
        } else {
          // Если "Другой предмет" не найден, используем первый доступный
          finalSubjectId = subjects[0]?.id || 1;
        }
      } else {
        // Проверяем что subjectId не пустой
        if (!formData.subjectId || formData.subjectId === '') {
          throw new Error('Не выбран предмет');
        }
        
        // Ищем предмет в API по имени из subjectsData
        const selectedSubjectData = getSubjectById(formData.subjectId);
        if (!selectedSubjectData) {
          throw new Error('Предмет не найден в локальных данных');
        }
        
        // Ищем соответствующий предмет в API subjects по имени
        const apiSubject = subjects.find(s => s.name === selectedSubjectData.name);
        if (!apiSubject) {
          console.log('❌ Не найден предмет в API:', selectedSubjectData.name);
          console.log('📋 Доступные предметы в API:', subjects.map(s => s.name));
          throw new Error(`Предмет "${selectedSubjectData.name}" не найден в базе данных. Доступные: ${subjects.map(s => s.name).join(', ')}`);
        }
        
        finalSubjectId = apiSubject.id;
      }
      
      console.log('🔍 Сопоставление предметов:');
      console.log('formData.subjectId (из UI):', formData.subjectId);
      if (!formData.isCustom) {
        const selectedSubjectData = getSubjectById(formData.subjectId);
        console.log('Найден в subjectsData:', selectedSubjectData?.name);
        const apiSubject = subjects.find(s => s.name === selectedSubjectData?.name);
        console.log('Найден в API subjects:', apiSubject);
      }
      
      console.log('Отправляемые данные заказа:', {
        student: formData.studentName,
        subject_id: finalSubjectId,
        title,
        description,
        deadline: formData.deadline,
        isCustom: formData.isCustom
      });

      const orderData = {
        student: {
          name: formData.studentName,
          group: formData.studentGroup,
          telegram: formData.studentTelegram,
        },
        subject_id: finalSubjectId,
        title,
        description,
        input_data: formData.inputData,
        variant_info: formData.variantInfo,
        deadline: formData.deadline,
        selected_works: formData.selectedWorks,
        is_full_course: formData.isFullCourse,
        custom_subject: formData.isCustom ? formData.customSubject : undefined,
        custom_work: formData.isCustom ? formData.customWork : undefined,
        actual_price: formData.isCustom ? 1500 : getTotalPrice(), // Рассчитанная стоимость
      };

      await createOrder(orderData);
      navigate('/');
    } catch (error: any) {
      console.error('Ошибка создания заказа:', error);
      setError(error.response?.data?.detail || 'Не удалось создать заказ');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
              📚 Выберите предмет
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={formData.isCustom}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    isCustom: e.target.checked,
                    subjectId: e.target.checked ? '' : prev.subjectId
                  }))}
                />
              }
              label="Другой предмет (не из списка)"
              sx={{ mb: 3 }}
            />
            
            {formData.isCustom ? (
              <TextField
                fullWidth
                label="Название предмета"
                value={formData.customSubject}
                onChange={handleInputChange('customSubject')}
                placeholder="Например: Высшая математика"
                sx={{ mb: 2 }}
              />
            ) : (
              <Grid container spacing={3}>
                {subjectsData.map((subject) => (
                  <Grid item xs={12} md={6} key={subject.id}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer',
                        background: formData.subjectId === subject.id 
                          ? 'rgba(37, 99, 235, 0.05)'
                          : '#ffffff',
                        border: formData.subjectId === subject.id 
                          ? '2px solid #2563eb' 
                          : '1px solid #e2e8f0',
                        borderRadius: 4,
                        position: 'relative',
                        transition: 'all 0.2s ease',
                        '&:hover': { 
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                          background: formData.subjectId === subject.id 
                            ? 'rgba(37, 99, 235, 0.08)'
                            : '#ffffff',
                        },
                        '&::before': formData.subjectId === subject.id ? {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '3px',
                          background: '#2563eb',
                        } : {}
                      }}
                      onClick={() => setFormData(prev => ({ ...prev, subjectId: subject.id }))}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                          <Typography 
                            variant="h6" 
                            component="h3" 
                            sx={{ 
                              fontWeight: 700,
                              color: 'grey.800',
                              fontSize: '1.2rem',
                              pr: 1,
                            }}
                          >
                            {subject.name}
                          </Typography>
                          <Chip 
                            label={`${subject.semester} семестр`} 
                            size="small"
                            sx={{
                              background: 'rgba(37, 99, 235, 0.1)',
                              color: '#2563eb',
                              fontWeight: 600,
                              border: '1px solid rgba(37, 99, 235, 0.2)',
                            }}
                          />
                        </Box>

                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Chip 
                            label={`${subject.works.length} работ`} 
                            size="small" 
                            icon={<Assignment sx={{ fontSize: 16 }} />}
                            sx={{
                              background: 'rgba(37, 99, 235, 0.08)',
                              color: '#2563eb',
                              fontWeight: 500,
                              border: '1px solid rgba(37, 99, 235, 0.15)',
                              '& .MuiChip-icon': {
                                color: '#2563eb',
                              }
                            }}
                          />
                          <Typography 
                            variant="h6" 
                            sx={{ 
                              fontWeight: 700,
                              color: '#2563eb',
                            }}
                          >
                            от {Math.min(...subject.works.map(w => w.price))} ₽
                          </Typography>
                        </Box>
                        
                        {formData.subjectId === subject.id && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 12,
                              right: 12,
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: '#10b981',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontSize: '14px',
                              fontWeight: 700,
                              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                              zIndex: 1,
                            }}
                          >
                            ✓
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        );

      case 1:
        const selectedSubjectData = getSelectedSubjectData();
        
        if (formData.isCustom) {
          return (
            <Box>
              <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
                ✏️ Опишите вашу работу
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    required
                    fullWidth
                    label="Название работы"
                    value={formData.customWork}
                    onChange={handleInputChange('customWork')}
                    placeholder="Например: Курсовая работа по высшей математике"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label="Описание задания"
                    value={formData.description}
                    onChange={handleInputChange('description')}
                    placeholder="Подробное описание того, что нужно сделать"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    required
                    fullWidth
                    type="date"
                    label="Дедлайн"
                    value={formData.deadline}
                    onChange={handleInputChange('deadline')}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
            </Box>
          );
        }

        if (!selectedSubjectData) return null;

        return (
          <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h5" sx={{ fontWeight: 600 }}>
                📝 Выберите работы
              </Typography>
              <Badge badgeContent={formData.selectedWorks.length} color="primary">
                <ShoppingCart />
              </Badge>
            </Box>

            {/* Весь курс */}
            <Card sx={{ mb: 3, border: formData.isFullCourse ? 2 : 1, borderColor: formData.isFullCourse ? 'primary.main' : 'divider' }}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      🎓 Весь курс целиком
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Все {selectedSubjectData.works.length} работ по предмету
                      {selectedSubjectData.fullCourseDiscount && (
                        <Chip 
                          label={`-${selectedSubjectData.fullCourseDiscount}% скидка`} 
                          size="small" 
                          color="success" 
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Typography>
                  </Box>
                  <Box textAlign="right">
                    <Typography variant="h6" color="primary" sx={{ fontWeight: 600 }}>
                      {calculateFullCoursePrice(selectedSubjectData)} ₽
                    </Typography>
                    {selectedSubjectData.fullCourseDiscount && (
                      <Typography variant="body2" sx={{ textDecoration: 'line-through', color: 'text.secondary' }}>
                        {selectedSubjectData.works.reduce((sum, work) => sum + work.price, 0)} ₽
                      </Typography>
                    )}
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.isFullCourse}
                          onChange={handleFullCourseToggle}
                          color="primary"
                        />
                      }
                      label="Выбрать"
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>

            <Divider sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary">
                или выберите отдельные работы
              </Typography>
            </Divider>

            {/* Отдельные работы */}
            <Grid container spacing={2}>
              {selectedSubjectData.works.map((work) => (
                <Grid item xs={12} sm={6} lg={4} key={work.id}>
                  <Card 
                    sx={{ 
                      height: '100%',
                      border: formData.selectedWorks.includes(work.id) ? 2 : 1,
                      borderColor: formData.selectedWorks.includes(work.id) ? 'primary.main' : 'divider',
                      opacity: formData.isFullCourse ? 0.7 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 4,
                    }}
                  >
                    <CardContent sx={{ 
                      height: '100%', 
                      display: 'flex', 
                      flexDirection: 'column',
                      p: 3,
                      '&:last-child': { pb: 3 }
                    }}>
                      <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
                        <Typography variant="subtitle1" sx={{ 
                          fontWeight: 600, 
                          flexGrow: 1,
                          fontSize: '0.95rem',
                          lineHeight: 1.3,
                          pr: 1,
                        }}>
                          {work.title}
                        </Typography>
                        <Checkbox
                          checked={formData.selectedWorks.includes(work.id) || formData.isFullCourse}
                          onChange={() => handleWorkToggle(work.id)}
                          disabled={formData.isFullCourse}
                          color="primary"
                          size="small"
                          sx={{ 
                            ml: 1,
                            width: 32,
                            height: 32,
                            padding: 0.5,
                            '& .MuiSvgIcon-root': {
                              fontSize: '1.2rem',
                              width: '1.2rem',
                              height: '1.2rem',
                            }
                          }}
                        />
                      </Box>
                      
                      {work.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ 
                          mb: 2, 
                          flexGrow: 1,
                          fontSize: '0.85rem',
                          lineHeight: 1.4,
                        }}>
                          {work.description}
                        </Typography>
                      )}
                      
                      <Box display="flex" justifyContent="flex-end" alignItems="center" mt="auto" pt={1}>
                        <Typography variant="h6" color="primary" sx={{ 
                          fontWeight: 600,
                          fontSize: '1.1rem',
                        }}>
                          {work.price} ₽
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {!formData.isFullCourse && formData.selectedWorks.length > 0 && (
              <Paper sx={{ mt: 3, p: 2, bgcolor: 'primary.50' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6">
                    Выбрано работ: {formData.selectedWorks.length}
                  </Typography>
                  <Typography variant="h5" color="primary" sx={{ fontWeight: 600 }}>
                    Итого: {getTotalPrice()} ₽
                  </Typography>
                </Box>
              </Paper>
            )}
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
              👤 Ваши данные
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label="ФИО"
                  value={formData.studentName}
                  onChange={handleInputChange('studentName')}
                  placeholder="Иванов Иван Иванович"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label="Группа"
                  value={formData.studentGroup}
                  onChange={handleInputChange('studentGroup')}
                  placeholder="ИСТ-21"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  label="@ Телеграм"
                  value={formData.studentTelegram}
                  onChange={handleInputChange('studentTelegram')}
                  placeholder="@ivan_ivanov"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  required
                  fullWidth
                  type="date"
                  label="Дедлайн"
                  value={formData.deadline}
                  onChange={handleInputChange('deadline')}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Информация о варианте"
                  value={formData.variantInfo}
                  onChange={handleInputChange('variantInfo')}
                  placeholder="Номер варианта, особенности задания, исходные данные..."
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Дополнительные требования"
                  value={formData.inputData}
                  onChange={handleInputChange('inputData')}
                  placeholder="Особые требования к оформлению, пожелания по выполнению..."
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 3:
        const subjectData = getSelectedSubjectData();
        return (
          <Box>
            <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
              ✅ Подтверждение заказа
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Детали заказа</Typography>
                    
                    <Box mb={2}>
                      <Typography variant="subtitle2" color="text.secondary">Предмет:</Typography>
                      <Typography variant="body1">
                        {formData.isCustom ? formData.customSubject : subjectData?.name}
                      </Typography>
                    </Box>
                    
                    <Box mb={2}>
                      <Typography variant="subtitle2" color="text.secondary">Работы:</Typography>
                      {formData.isCustom ? (
                        <Typography variant="body1">{formData.customWork}</Typography>
                      ) : formData.isFullCourse ? (
                        <Typography variant="body1">Весь курс ({subjectData?.works.length} работ)</Typography>
                      ) : (
                        <Box>
                          {subjectData?.works.filter(w => formData.selectedWorks.includes(w.id)).map(work => (
                            <Typography key={work.id} variant="body2">• {work.title}</Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                    
                    <Box mb={2}>
                      <Typography variant="subtitle2" color="text.secondary">Дедлайн:</Typography>
                      <Typography variant="body1">{formData.deadline}</Typography>
                    </Box>
                    
                    {formData.inputData && (
                      <Box mb={2}>
                        <Typography variant="subtitle2" color="text.secondary">Дополнительные требования:</Typography>
                        <Typography variant="body1">{formData.inputData}</Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Студент</Typography>
                    <Typography variant="body2">{formData.studentName}</Typography>
                    <Typography variant="body2">Группа: {formData.studentGroup}</Typography>
                    <Typography variant="body2">Telegram: {formData.studentTelegram}</Typography>
                  </CardContent>
                </Card>
                
                <Card sx={{ mt: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Стоимость</Typography>
                    <Typography variant="h4" color="primary" sx={{ fontWeight: 600 }}>
                      {getTotalPrice()} ₽
                    </Typography>
                    {formData.isFullCourse && subjectData?.fullCourseDiscount && (
                      <Typography variant="body2" color="success.main">
                        Скидка {subjectData.fullCourseDiscount}% применена
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', px: 3, py: 4 }}>
      {/* Header */}
      <Box 
        display="flex" 
        alignItems="center" 
        mb={4}
        sx={{
          background: '#ffffff',
          borderRadius: 8,
          p: 3,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        <IconButton 
          onClick={() => navigate('/')} 
          sx={{ 
            mr: 3,
            background: 'rgba(37, 99, 235, 0.1)',
            border: '1px solid rgba(37, 99, 235, 0.2)',
            borderRadius: 6,
            p: 1.5,
            '&:hover': {
              background: 'rgba(37, 99, 235, 0.2)',
            }
          }}
        >
          <ArrowBack sx={{ color: '#2563eb' }} />
        </IconButton>
        
        <Box sx={{ position: 'relative' }}>
          <Typography 
            variant="h2" 
            sx={{ 
              fontWeight: 700, 
              color: '#1e293b',
            }}
          >
            Новый заказ
          </Typography>
          <Typography 
            variant="subtitle1" 
            sx={{ 
              color: 'grey.600',
              fontWeight: 500,
              fontSize: '1.1rem',
              mt: 0.5
            }}
          >
            Шаг {activeStep + 1} из {steps.length}
          </Typography>
        </Box>
      </Box>

      {/* Stepper */}
      <Card 
        sx={{ 
          mb: 6,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
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
        <CardContent sx={{ py: 4 }}>
          <Stepper 
            activeStep={activeStep} 
            alternativeLabel
            sx={{
              '& .MuiStepConnector-root': {
                top: 22,
                left: 'calc(-50% + 16px)',
                right: 'calc(50% + 16px)',
                '& .MuiStepConnector-line': {
                  borderColor: 'rgba(99, 102, 241, 0.2)',
                  borderTopWidth: 3,
                  borderRadius: 2,
                }
              },
              '& .MuiStepConnector-active .MuiStepConnector-line': {
                background: 'linear-gradient(90deg, #6366f1 0%, #8b5cf6 100%)',
                border: 'none',
                height: 3,
              },
              '& .MuiStepConnector-completed .MuiStepConnector-line': {
                background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
                border: 'none',
                height: 3,
              },
              '& .MuiStepLabel-label': {
                fontWeight: 600,
                fontSize: '1rem',
                '&.Mui-active': {
                  color: '#6366f1',
                  fontWeight: 700,
                },
                '&.Mui-completed': {
                  color: '#059669',
                  fontWeight: 600,
                }
              }
            }}
          >
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel
                  StepIconComponent={({ active, completed }) => (
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.1rem',
                        fontWeight: 700,
                        background: completed 
                          ? 'linear-gradient(135deg, #10b981 0%, #34d399 100%)'
                          : active 
                          ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                          : 'rgba(99, 102, 241, 0.1)',
                        color: completed || active ? 'white' : '#6366f1',
                        border: completed || active ? 'none' : '2px solid rgba(99, 102, 241, 0.3)',
                        boxShadow: completed || active ? '0 4px 15px rgba(99, 102, 241, 0.3)' : 'none',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      {completed ? '✓' : index + 1}
                    </Box>
                  )}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* Content */}
      <Card 
        sx={{
          background: 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(99, 102, 241, 0.15)',
          borderRadius: 6,
          boxShadow: '0 8px 32px rgba(99, 102, 241, 0.1)',
        }}
      >
        <CardContent sx={{ minHeight: 500, p: 4 }}>
          {renderStepContent(activeStep)}
          
          {error && (
            <Alert 
              severity="error" 
              sx={{ 
                mt: 3,
                borderRadius: 3,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                backdropFilter: 'blur(10px)',
                '& .MuiAlert-message': {
                  fontWeight: 500,
                }
              }}
            >
              {error}
            </Alert>
          )}
          
          {/* Navigation */}
          <Box 
            display="flex" 
            justifyContent="space-between" 
            mt={6}
            sx={{
              pt: 3,
              borderTop: '1px solid rgba(99, 102, 241, 0.1)',
            }}
          >
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              startIcon={<ArrowBack />}
              size="large"
              sx={{
                borderRadius: 4,
                px: 3,
                py: 1.5,
                fontWeight: 600,
                textTransform: 'none',
                color: '#2563eb',
                border: '1px solid rgba(37, 99, 235, 0.3)',
                background: 'rgba(37, 99, 235, 0.05)',
                '&:hover': {
                  background: 'rgba(37, 99, 235, 0.1)',
                  borderColor: '#2563eb',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.2)',
                },
                '&:disabled': {
                  background: 'rgba(37, 99, 235, 0.03)',
                  color: 'rgba(37, 99, 235, 0.4)',
                  border: '1px solid rgba(37, 99, 235, 0.1)',
                }
              }}
            >
              Назад
            </Button>
            
            <Box display="flex" gap={2}>
              {activeStep < steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!canProceedToNextStep()}
                  endIcon={<ArrowForward />}
                  size="large"
                  sx={{
                    borderRadius: 4,
                    px: 4,
                    py: 1.5,
                    fontSize: '1rem',
                    fontWeight: 700,
                    textTransform: 'none',
                    background: '#2563eb',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                    '&:hover': {
                      background: '#1d4ed8',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                    },
                    '&:disabled': {
                      background: 'rgba(37, 99, 235, 0.3)',
                      color: 'rgba(255, 255, 255, 0.7)',
                      boxShadow: 'none',
                    }
                  }}
                >
                  Далее
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleSubmit}
                  disabled={loading || !canProceedToNextStep()}
                  startIcon={loading ? <CircularProgress size={20} /> : <CheckCircle />}
                  size="large"
                  sx={{
                    borderRadius: 4,
                    px: 5,
                    py: 2,
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    textTransform: 'none',
                    background: loading 
                      ? 'rgba(37, 99, 235, 0.6)'
                      : '#10b981',
                    boxShadow: loading 
                      ? 'none'
                      : '0 4px 12px rgba(16, 185, 129, 0.3)',
                    '&:hover': !loading ? {
                      background: '#059669',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                    } : {},
                    '&:disabled': {
                      background: 'rgba(37, 99, 235, 0.3)',
                      color: 'rgba(255, 255, 255, 0.7)',
                      boxShadow: 'none',
                    }
                  }}
                >
                  {loading ? 'Создание...' : 'Создать заказ'}
                </Button>
              )}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default CreateOrderPage;