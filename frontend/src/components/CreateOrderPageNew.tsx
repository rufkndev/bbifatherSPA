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
  CheckCircle,
  Add,
  Remove
} from '@mui/icons-material';
import { Subject } from '../types';
import { getSubjects, createOrder } from '../api';
import { 
  coursesData, 
  subjectsData, 
  getSubjectById, 
  calculateFullCoursePrice, 
  calculateSelectedWorksPrice, 
  SubjectData, 
  getCourseById, 
  getSubjectsByCourseAndSemester, 
  getSemesterName 
} from '../data/subjects';
import { useTelegramWebApp } from '../hooks/useTelegramWebApp';

const steps = ['Выберите курс', 'Выберите семестр', 'Выберите предмет', 'Выберите работы', 'Ваши данные', 'Подтверждение'];

const CreateOrderPage: React.FC = () => {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [activeStep, setActiveStep] = useState(0);
  
  // Telegram WebApp интеграция
  const { user, isInTelegram, hapticFeedback, showAlert, backButton } = useTelegramWebApp();
  
  const [formData, setFormData] = useState({
    // Данные студента
    studentName: '',
    studentGroup: '',
    studentTelegram: '',
    
    // Данные заказа
    courseId: 0,
    semesterId: 0,
    subjectId: '',
    selectedWorks: [] as string[],
    isFullCourse: false,
    isCustom: false,
    customSubject: '',
    customWork: '',
    customWorksList: [] as { title: string; description: string }[],
    title: '',
    description: '',
    inputData: '',
    variantInfo: '',
    deadline: '',
  });

  useEffect(() => {
    loadSubjects();
    
    // Автоматическое заполнение данных из Telegram
    if (isInTelegram && user) {
      setFormData(prev => ({
        ...prev,
        studentName: user.firstName + (user.lastName ? ` ${user.lastName}` : ''),
        studentTelegram: user.username ? `@${user.username}` : '',
      }));
    }
    
    // Настройка Telegram Back Button
    if (isInTelegram) {
      backButton.show();
      const handleBack = () => navigate('/');
      backButton.onClick(handleBack);
      
      return () => {
        backButton.hide();
        backButton.offClick(handleBack);
      };
    }
  }, [isInTelegram, user, backButton, navigate]);

  const loadSubjects = async () => {
    try {
      const data = await getSubjects();
      setSubjects(data);
    } catch (error) {
      console.error('Ошибка загрузки предметов:', error);
      setError('Не удалось загрузить список предметов');
    }
  };

  const canProceedToNextStep = () => {
    switch (activeStep) {
      case 0: // Выбор курса
        return formData.courseId > 0 || formData.isCustom;
      case 1: // Выбор семестра или кастомная форма
        if (formData.isCustom) {
          return formData.customSubject.trim() !== '' && formData.customWork.trim() !== '' && formData.customWorksList.length > 0;
        }
        return formData.semesterId > 0;
      case 2: // Выбор предмета
        if (formData.isCustom || formData.courseId === 1) {
          return formData.customSubject.trim() !== '' && formData.customWorksList.length > 0;
        }
        return formData.subjectId !== '';
      case 3: // Выбор работ
        if (formData.isCustom || formData.courseId === 1) {
          return true; // Уже проверено на предыдущих шагах
        }
        const selectedSubject = getSubjectById(formData.subjectId);
        if (selectedSubject?.isCustomForm) {
          return formData.customWorksList.length > 0;
        }
        return formData.selectedWorks.length > 0 || formData.isFullCourse;
      case 4: // Данные студента
        return (
          formData.studentName.trim() !== '' &&
          formData.studentGroup.trim() !== '' &&
          formData.studentTelegram.trim() !== '' &&
          formData.deadline.trim() !== ''
        );
      case 5: // Подтверждение
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceedToNextStep()) {
      // Логика пропуска шагов для кастомных работ и 1 курса
      if (activeStep === 0 && formData.isCustom) {
        setActiveStep(1); // Переходим к кастомной форме
      } else if (activeStep === 1 && formData.courseId === 1) {
        setActiveStep(2); // Переходим к кастомной форме предмета для 1 курса
      } else if ((activeStep === 2 && formData.courseId === 1) || (activeStep === 1 && formData.isCustom)) {
        setActiveStep(4); // Пропускаем выбор работ, переходим к данным студента
      } else if (activeStep === 2 && formData.isCustom) {
        setActiveStep(4); // Пропускаем выбор работ для кастомных заказов
      } else {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
      }
    }
  };

  const handleBack = () => {
    // Логика возврата с учетом пропущенных шагов
    if (activeStep === 4 && (formData.isCustom || formData.courseId === 1)) {
      if (formData.isCustom) {
        setActiveStep(1); // Возвращаемся к кастомной форме
      } else if (formData.courseId === 1) {
        setActiveStep(2); // Возвращаемся к форме предмета для 1 курса
      }
    } else if (activeStep === 2 && formData.courseId === 1) {
      setActiveStep(1); // Возвращаемся к выбору семестра
    } else if (activeStep === 1 && formData.isCustom) {
      setActiveStep(0); // Возвращаемся к выбору курса
    } else {
      setActiveStep((prevActiveStep) => prevActiveStep - 1);
    }
  };

  const getTotalPrice = (): number => {
    if (formData.isCustom || formData.courseId === 1) {
      return 0; // Цена уточняется у администратора
    }
    
    const selectedSubject = getSubjectById(formData.subjectId);
    if (!selectedSubject) return 0;
    
    // Если это предмет с кастомной формой или без цен, возвращаем 0
    if (selectedSubject.isCustomForm || !selectedSubject.basePrice) {
      return 0;
    }
    
    if (formData.isFullCourse) {
      return calculateFullCoursePrice(selectedSubject);
    }
    
    return calculateSelectedWorksPrice(selectedSubject, formData.selectedWorks);
  };

  const addCustomWork = () => {
    setFormData(prev => ({
      ...prev,
      customWorksList: [...prev.customWorksList, { title: '', description: '' }]
    }));
  };

  const updateCustomWork = (index: number, field: 'title' | 'description', value: string) => {
    setFormData(prev => ({
      ...prev,
      customWorksList: prev.customWorksList.map((work, i) => 
        i === index ? { ...work, [field]: value } : work
      )
    }));
  };

  const removeCustomWork = (index: number) => {
    setFormData(prev => ({
      ...prev,
      customWorksList: prev.customWorksList.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      // Подготовка данных для отправки
      let title = '';
      let description = '';
      
      if (formData.isCustom) {
        title = `Кастомная работа: ${formData.customSubject} - ${formData.customWork}`;
        description = formData.customWorksList.map((work, index) => 
          `Работа ${index + 1}: ${work.title}\nОписание: ${work.description}`
        ).join('\n\n');
      } else if (formData.courseId === 1) {
        title = `${getSemesterName(formData.courseId, formData.semesterId)} - ${formData.customSubject}`;
        description = formData.customWorksList.map((work, index) => 
          `Работа ${index + 1}: ${work.title}\nОписание: ${work.description}`
        ).join('\n\n');
      } else {
        const selectedSubject = getSubjectById(formData.subjectId);
        if (selectedSubject?.isCustomForm) {
          title = `${selectedSubject.name} - кастомные работы`;
          description = formData.customWorksList.map((work, index) => 
            `Работа ${index + 1}: ${work.title}\nОписание: ${work.description}`
          ).join('\n\n');
        } else {
          title = `${selectedSubject?.name} - ${formData.isFullCourse ? 'Весь курс' : 'Выборочные работы'}`;
          if (formData.isFullCourse) {
            description = 'Заказан весь курс';
          } else {
            const selectedWorks = selectedSubject?.works.filter(work => 
              formData.selectedWorks.includes(work.id)
            );
            description = selectedWorks?.map(work => work.title).join(', ') || '';
          }
        }
      }

      // Определяем subject_id
      let finalSubjectId: number | null = null;
      if (!formData.isCustom && formData.courseId !== 1 && formData.subjectId) {
        const selectedSubjectData = getSubjectById(formData.subjectId);
        if (selectedSubjectData) {
          const apiSubject = subjects.find(s => s.name === selectedSubjectData.name);
          finalSubjectId = apiSubject?.id || null;
        }
      }

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
        custom_subject: formData.isCustom ? formData.customSubject : (formData.courseId === 1 ? formData.customSubject : undefined),
        custom_work: formData.isCustom ? formData.customWork : undefined,
        actual_price: getTotalPrice() || 0,
      };

      await createOrder(orderData);
      
      // Уведомление об успехе
      if (isInTelegram) {
        hapticFeedback.success();
        showAlert('✅ Заказ успешно создан! Вы получите уведомления о статусе.');
      }
      
      // Сохраняем telegram в localStorage и перенаправляем
      const cleanTelegram = formData.studentTelegram.startsWith('@') 
        ? formData.studentTelegram.substring(1) 
        : formData.studentTelegram;
      
      navigate(`/?telegram=${cleanTelegram}`);
    } catch (error: any) {
      console.error('Ошибка создания заказа:', error);
      setError(error?.response?.data?.detail || error?.message || 'Произошла ошибка при создании заказа');
      
      if (isInTelegram) {
        hapticFeedback.error();
        showAlert('❌ Ошибка создания заказа');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ color: '#1e293b', fontWeight: 600 }}>
              Выберите курс
            </Typography>
            
            {/* Переключатель кастомной работы */}
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isCustom}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      isCustom: e.target.checked, 
                      courseId: 0, 
                      semesterId: 0, 
                      subjectId: '' 
                    }))}
                    color="primary"
                  />
                }
                label="Заказать кастомную работу"
                sx={{ 
                  '& .MuiFormControlLabel-label': { 
                    fontSize: '1rem', 
                    fontWeight: 500 
                  } 
                }}
              />
            </Box>

            {formData.isCustom ? (
              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                  <strong>Кастомная работа:</strong> Стоимость уточняется у администратора индивидуально
                </Typography>
              </Alert>
            ) : (
              <Grid container spacing={3}>
                {coursesData.map((course) => (
                  <Grid item xs={12} sm={6} md={4} key={course.id}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        border: formData.courseId === course.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: formData.courseId === course.id ? 'rgba(37, 99, 235, 0.05)' : '#ffffff',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
                          border: '2px solid #2563eb'
                        },
                        ...(formData.courseId === course.id ? {
                          boxShadow: '0 8px 25px rgba(37, 99, 235, 0.2)'
                        } : {})
                      }}
                      onClick={() => setFormData(prev => ({ 
                        ...prev, 
                        courseId: course.id, 
                        semesterId: 0, 
                        subjectId: '' 
                      }))}
                    >
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Assignment sx={{ color: '#2563eb', mr: 2 }} />
                          <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b' }}>
                            {course.name}
                          </Typography>
                        </Box>
                        
                        <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                          Семестры: {course.semesters.join(', ')}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        );

      case 1:
        if (formData.isCustom) {
          return (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: '#1e293b', fontWeight: 600 }}>
                Кастомная работа
              </Typography>
              
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Курс"
                    value={formData.customSubject}
                    onChange={(e) => setFormData(prev => ({ ...prev, customSubject: e.target.value }))}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Предмет"
                    value={formData.customWork}
                    onChange={(e) => setFormData(prev => ({ ...prev, customWork: e.target.value }))}
                    variant="outlined"
                    sx={{ mb: 2 }}
                  />
                </Grid>
              </Grid>

              <Typography variant="h6" gutterBottom sx={{ color: '#1e293b', fontWeight: 600, mt: 3, mb: 2 }}>
                Практические работы
              </Typography>
              
              {formData.customWorksList.map((work, index) => (
                <Paper key={index} sx={{ p: 3, mb: 2, border: '1px solid #e2e8f0' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Работа {index + 1}
                    </Typography>
                    <Button 
                      color="error" 
                      size="small"
                      onClick={() => removeCustomWork(index)}
                    >
                      Удалить
                    </Button>
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Название работы"
                        value={work.title}
                        onChange={(e) => updateCustomWork(index, 'title', e.target.value)}
                        variant="outlined"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Описание работы"
                        value={work.description}
                        onChange={(e) => updateCustomWork(index, 'description', e.target.value)}
                        variant="outlined"
                        multiline
                        rows={2}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              ))}
              
              <Button 
                variant="outlined" 
                onClick={addCustomWork}
                sx={{ mb: 3 }}
              >
                Добавить работу
              </Button>
              
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Стоимость каждой практической работы уточняется у администратора</strong>
                </Typography>
              </Alert>
            </Box>
          );
        }
        
        const selectedCourse = getCourseById(formData.courseId);
        if (!selectedCourse) return null;
        
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ color: '#1e293b', fontWeight: 600 }}>
              Выберите семестр ({selectedCourse.name})
            </Typography>
            
            <Grid container spacing={3}>
              {selectedCourse.semesters.map((semester) => (
                <Grid item xs={12} sm={6} key={semester}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      border: formData.semesterId === semester ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: formData.semesterId === semester ? 'rgba(37, 99, 235, 0.05)' : '#ffffff',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
                        border: '2px solid #2563eb'
                      },
                      ...(formData.semesterId === semester ? {
                        boxShadow: '0 8px 25px rgba(37, 99, 235, 0.2)'
                      } : {})
                    }}
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      semesterId: semester, 
                      subjectId: '' 
                    }))}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Assignment sx={{ color: '#2563eb', mr: 2 }} />
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b' }}>
                          {getSemesterName(formData.courseId, semester)}
                        </Typography>
                      </Box>
                      
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        {getSubjectsByCourseAndSemester(formData.courseId, semester).length} предметов
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        );

      case 2:
        if (formData.courseId === 1) {
          // Для 1 курса - кастомная форма
          return (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: '#1e293b', fontWeight: 600 }}>
                Введите данные предмета ({getSemesterName(formData.courseId, formData.semesterId)})
              </Typography>
              
              <TextField
                fullWidth
                label="Название предмета"
                value={formData.customSubject}
                onChange={(e) => setFormData(prev => ({ ...prev, customSubject: e.target.value }))}
                variant="outlined"
                sx={{ mb: 3 }}
              />
              
              <Typography variant="h6" gutterBottom sx={{ color: '#1e293b', fontWeight: 600, mt: 3, mb: 2 }}>
                Практические работы
              </Typography>
              
              {formData.customWorksList.map((work, index) => (
                <Paper key={index} sx={{ p: 3, mb: 2, border: '1px solid #e2e8f0' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Работа {index + 1}
                    </Typography>
                    <Button 
                      color="error" 
                      size="small"
                      onClick={() => removeCustomWork(index)}
                    >
                      Удалить
                    </Button>
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Название работы"
                        value={work.title}
                        onChange={(e) => updateCustomWork(index, 'title', e.target.value)}
                        variant="outlined"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Описание работы"
                        value={work.description}
                        onChange={(e) => updateCustomWork(index, 'description', e.target.value)}
                        variant="outlined"
                        multiline
                        rows={2}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              ))}
              
              <Button 
                variant="outlined" 
                onClick={addCustomWork}
                sx={{ mb: 3 }}
              >
                Добавить работу
              </Button>
              
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Стоимость каждой практической работы уточняется у администратора</strong>
                </Typography>
              </Alert>
            </Box>
          );
        }
        
        const availableSubjects = getSubjectsByCourseAndSemester(formData.courseId, formData.semesterId);
        
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ color: '#1e293b', fontWeight: 600 }}>
              Выберите предмет ({getSemesterName(formData.courseId, formData.semesterId)})
            </Typography>
            
            <Grid container spacing={3}>
              {availableSubjects.map((subject) => (
                <Grid item xs={12} sm={6} md={4} key={subject.id}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      border: formData.subjectId === subject.id ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      background: formData.subjectId === subject.id ? 'rgba(37, 99, 235, 0.05)' : '#ffffff',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
                        border: '2px solid #2563eb'
                      },
                      ...(formData.subjectId === subject.id ? {
                        boxShadow: '0 8px 25px rgba(37, 99, 235, 0.2)'
                      } : {})
                    }}
                    onClick={() => setFormData(prev => ({ ...prev, subjectId: subject.id }))}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 2 }}>
                        <Assignment sx={{ color: '#2563eb', mr: 2, mt: 0.5 }} />
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b', mb: 1 }}>
                            {subject.name}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
                            {subject.description}
                          </Typography>
                          {subject.priceNote && (
                            <Typography variant="body2" sx={{ color: '#f59e0b', fontWeight: 500 }}>
                              {subject.priceNote}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Chip 
                          label={subject.works.length > 0 ? `${subject.works.length} работ` : 'Кастомные работы'}
                          size="small"
                          sx={{ 
                            background: 'rgba(37, 99, 235, 0.1)',
                            color: '#2563eb',
                            fontWeight: 500
                          }}
                        />
                        {subject.basePrice && (
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#059669' }}>
                            от {subject.basePrice} ₽
                          </Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        );

      case 3:
        // Пропускаем для кастомных и 1 курса
        if (formData.isCustom || formData.courseId === 1) {
          return null;
        }
        
        const selectedSubject = getSubjectById(formData.subjectId);
        if (!selectedSubject) return null;

        // Если предмет с кастомной формой
        if (selectedSubject.isCustomForm) {
          return (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ color: '#1e293b', fontWeight: 600 }}>
                {selectedSubject.name} - Введите работы
              </Typography>
              
              {formData.customWorksList.map((work, index) => (
                <Paper key={index} sx={{ p: 3, mb: 2, border: '1px solid #e2e8f0' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Работа {index + 1}
                    </Typography>
                    <Button 
                      color="error" 
                      size="small"
                      onClick={() => removeCustomWork(index)}
                    >
                      Удалить
                    </Button>
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Название работы"
                        value={work.title}
                        onChange={(e) => updateCustomWork(index, 'title', e.target.value)}
                        variant="outlined"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Описание работы"
                        value={work.description}
                        onChange={(e) => updateCustomWork(index, 'description', e.target.value)}
                        variant="outlined"
                        multiline
                        rows={2}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              ))}
              
              <Button 
                variant="outlined" 
                onClick={addCustomWork}
                sx={{ mb: 3 }}
              >
                Добавить работу
              </Button>
              
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Стоимость уточняется у администратора</strong>
                </Typography>
              </Alert>
            </Box>
          );
        }

        // Обычный выбор работ
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ color: '#1e293b', fontWeight: 600 }}>
              Выберите работы - {selectedSubject.name}
            </Typography>
            
            {/* Переключатель полного курса */}
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isFullCourse}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      isFullCourse: e.target.checked,
                      selectedWorks: e.target.checked ? [] : prev.selectedWorks
                    }))}
                    color="primary"
                  />
                }
                label={`Заказать весь курс (${selectedSubject.works.length} работ)`}
                sx={{ 
                  '& .MuiFormControlLabel-label': { 
                    fontSize: '1rem', 
                    fontWeight: 500 
                  } 
                }}
              />
              
              {formData.isFullCourse && selectedSubject.fullCourseDiscount && (
                <Chip 
                  label={`Скидка ${selectedSubject.fullCourseDiscount}%`}
                  color="success"
                  size="small"
                  sx={{ ml: 2 }}
                />
              )}
            </Box>

            {!formData.isFullCourse && (
              <Grid container spacing={2}>
                {selectedSubject.works.map((work) => (
                  <Grid item xs={12} sm={6} md={4} key={work.id}>
                    <Card
                      sx={{
                        border: formData.selectedWorks.includes(work.id) 
                          ? '2px solid #2563eb' 
                          : '1px solid #e2e8f0',
                        background: formData.selectedWorks.includes(work.id) 
                          ? 'rgba(37, 99, 235, 0.05)' 
                          : '#ffffff'
                      }}
                    >
                      <CardContent sx={{ p: 2 }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={formData.selectedWorks.includes(work.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFormData(prev => ({
                                    ...prev,
                                    selectedWorks: [...prev.selectedWorks, work.id]
                                  }));
                                } else {
                                  setFormData(prev => ({
                                    ...prev,
                                    selectedWorks: prev.selectedWorks.filter(id => id !== work.id)
                                  }));
                                }
                              }}
                              color="primary"
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {work.title}
                              </Typography>
                              {work.description && (
                                <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                                  {work.description}
                                </Typography>
                              )}
                              {work.price && (
                                <Typography variant="h6" sx={{ color: '#059669', fontWeight: 700, mt: 1 }}>
                                  {work.price} ₽
                                </Typography>
                              )}
                            </Box>
                          }
                          sx={{ alignItems: 'flex-start', m: 0 }}
                        />
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        );

      case 4:
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ color: '#1e293b', fontWeight: 600 }}>
              Ваши данные
            </Typography>
            
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Ваше имя"
                  value={formData.studentName}
                  onChange={(e) => setFormData(prev => ({ ...prev, studentName: e.target.value }))}
                  variant="outlined"
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Группа"
                  value={formData.studentGroup}
                  onChange={(e) => setFormData(prev => ({ ...prev, studentGroup: e.target.value }))}
                  variant="outlined"
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Telegram (например: @username)"
                  value={formData.studentTelegram}
                  onChange={(e) => setFormData(prev => ({ ...prev, studentTelegram: e.target.value }))}
                  variant="outlined"
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Дедлайн"
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
                  variant="outlined"
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Исходные данные (если есть)"
                  value={formData.inputData}
                  onChange={(e) => setFormData(prev => ({ ...prev, inputData: e.target.value }))}
                  variant="outlined"
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Номер варианта или дополнительная информация"
                  value={formData.variantInfo}
                  onChange={(e) => setFormData(prev => ({ ...prev, variantInfo: e.target.value }))}
                  variant="outlined"
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 5:
        const totalPrice = getTotalPrice();
        
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ color: '#1e293b', fontWeight: 600 }}>
              Подтверждение заказа
            </Typography>
            
            <Paper sx={{ p: 3, mb: 3, border: '1px solid #e2e8f0' }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">Студент:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{formData.studentName}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">Группа:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{formData.studentGroup}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">Telegram:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{formData.studentTelegram}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="textSecondary">Дедлайн:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>{formData.deadline}</Typography>
                </Grid>
                
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="textSecondary">Заказ:</Typography>
                  {formData.isCustom ? (
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      Кастомная работа: {formData.customSubject} - {formData.customWork}
                    </Typography>
                  ) : formData.courseId === 1 ? (
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {getSemesterName(formData.courseId, formData.semesterId)} - {formData.customSubject}
                    </Typography>
                  ) : (
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {getSubjectById(formData.subjectId)?.name}
                      {formData.isFullCourse ? ' - Весь курс' : ` - ${formData.selectedWorks.length} работ`}
                    </Typography>
                  )}
                </Grid>
                
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                      Общая стоимость:
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700, color: '#059669' }}>
                      {totalPrice > 0 ? `${totalPrice} ₽` : 'Уточняется у администратора'}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Paper>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ 
      maxWidth: 1200, 
      mx: 'auto', 
      px: { xs: 1, sm: 3 }, 
      py: { xs: 2, sm: 4 } 
    }}>
      {/* Мобильный Header */}
      <Box 
        display="flex" 
        flexDirection={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        mb={{ xs: 3, sm: 4 }}
        sx={{
          background: '#ffffff',
          borderRadius: { xs: 6, sm: 8 },
          p: { xs: 2, sm: 3 },
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Box display="flex" alignItems="center" mb={{ xs: 2, sm: 0 }}>
          <IconButton 
            onClick={() => navigate('/')} 
            sx={{ 
              mr: { xs: 2, sm: 3 },
              background: 'rgba(37, 99, 235, 0.1)',
              border: '1px solid rgba(37, 99, 235, 0.2)',
              borderRadius: 6,
              p: { xs: 1, sm: 1.5 },
              '&:hover': {
                background: 'rgba(37, 99, 235, 0.2)',
              }
            }}
          >
            <ArrowBack sx={{ 
              color: '#2563eb',
              fontSize: { xs: 20, sm: 24 }
            }} />
          </IconButton>
          
          <Box sx={{ position: 'relative' }}>
            <Typography 
              variant="h4"
              sx={{ 
                fontWeight: 700, 
                color: '#1e293b',
                fontSize: { xs: '1.5rem', sm: '2.125rem' }
              }}
            >
              Новый заказ
            </Typography>
            <Typography 
              variant="subtitle1" 
              sx={{ 
                color: 'grey.600',
                fontWeight: 500,
                fontSize: { xs: '0.9rem', sm: '1.1rem' },
                mt: 0.5
              }}
            >
              Шаг {activeStep + 1} из {steps.length}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Мобильный Stepper */}
      <Card 
        sx={{ 
          mb: { xs: 4, sm: 6 },
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Stepper 
            activeStep={activeStep} 
            orientation={window.innerWidth < 600 ? "vertical" : "horizontal"}
            sx={{
              '& .MuiStepLabel-root': {
                fontSize: { xs: '0.875rem', sm: '1rem' }
              }
            }}
          >
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel
                  sx={{
                    '& .MuiStepLabel-label': {
                      fontSize: { xs: '0.8rem', sm: '0.9rem' },
                      fontWeight: activeStep === index ? 600 : 400
                    }
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      {/* Основной контент */}
      <Card 
        sx={{ 
          mb: 4,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Навигация */}
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 2, sm: 0 }
        }}
      >
        <Box>
          {activeStep > 0 && (
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              startIcon={<ArrowBack />}
              size="large"
              sx={{ 
                fontWeight: 600,
                px: { xs: 3, sm: 4 },
                py: { xs: 1.5, sm: 2 }
              }}
            >
              Назад
            </Button>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          {getTotalPrice() > 0 && (
            <Paper 
              sx={{ 
                px: 3, 
                py: 1.5, 
                display: 'flex', 
                alignItems: 'center',
                background: 'rgba(5, 150, 105, 0.1)',
                border: '1px solid rgba(5, 150, 105, 0.2)'
              }}
            >
              <ShoppingCart sx={{ mr: 1, color: '#059669' }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#059669' }}>
                {getTotalPrice()} ₽
              </Typography>
            </Paper>
          )}

          {activeStep === steps.length - 1 ? (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={loading || !canProceedToNextStep()}
              startIcon={loading ? <CircularProgress size={20} /> : <CheckCircle />}
              size="large"
              sx={{ 
                fontWeight: 600,
                px: { xs: 3, sm: 4 },
                py: { xs: 1.5, sm: 2 }
              }}
            >
              {loading ? 'Создание...' : 'Создать заказ'}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!canProceedToNextStep()}
              endIcon={<ArrowForward />}
              size="large"
              sx={{ 
                fontWeight: 600,
                px: { xs: 3, sm: 4 },
                py: { xs: 1.5, sm: 2 }
              }}
            >
              Далее
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default CreateOrderPage;
