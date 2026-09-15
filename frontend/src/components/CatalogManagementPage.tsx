import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLogin from './AdminLogin';
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
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Paper
} from '@mui/material';
import { ArrowBack, Delete, Save, Add } from '@mui/icons-material';
import { CourseData, SubjectData, WorkItem } from '../data/subjects';
import { getCatalog, addCatalogWork, updateCatalogWork, deleteCatalogWork } from '../api';

const CatalogManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('adminAuth') === 'true'
  );

  const [courses, setCourses] = useState<CourseData[]>([]);
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [courseId, setCourseId] = useState<number>(0);
  const [semester, setSemester] = useState<number>(0);
  const [subjectId, setSubjectId] = useState<string>('');

  // Черновики правок для уже существующих работ: workId -> {title, price}
  const [drafts, setDrafts] = useState<Record<string, { title: string; price: string }>>({});
  const [savingWorkId, setSavingWorkId] = useState<string | null>(null);
  const [deletingWorkId, setDeletingWorkId] = useState<string | null>(null);

  const [newWorkTitle, setNewWorkTitle] = useState('');
  const [newWorkPrice, setNewWorkPrice] = useState('');
  const [addingWork, setAddingWork] = useState(false);

  const loadCatalog = async () => {
    try {
      setLoading(true);
      const catalog = await getCatalog();
      setCourses(catalog.courses);
      setSubjects(catalog.subjects);
    } catch (e) {
      console.error('Ошибка загрузки каталога:', e);
      setError('Не удалось загрузить каталог предметов');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadCatalog();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <AdminLogin onLogin={() => setIsAuthenticated(true)} />;
  }

  const selectedCourse = courses.find(c => c.id === courseId);
  const availableSubjects = subjects.filter(s => s.course === courseId && s.semester === semester);
  const selectedSubject = subjects.find(s => s.id === subjectId);

  const resetDraftsForSubject = (subject: SubjectData | undefined) => {
    if (!subject) {
      setDrafts({});
      return;
    }
    const next: Record<string, { title: string; price: string }> = {};
    subject.works.forEach(work => {
      next[work.id] = { title: work.title, price: work.price != null ? String(work.price) : '' };
    });
    setDrafts(next);
  };

  const handleSelectCourse = (value: number) => {
    setCourseId(value);
    setSemester(0);
    setSubjectId('');
    setDrafts({});
  };

  const handleSelectSemester = (value: number) => {
    setSemester(value);
    setSubjectId('');
    setDrafts({});
  };

  const handleSelectSubject = (value: string) => {
    setSubjectId(value);
    resetDraftsForSubject(subjects.find(s => s.id === value));
  };

  const applyWorkChange = (work: WorkItem) => {
    setSubjects(prev => prev.map(subject => {
      if (subject.id !== subjectId) return subject;
      return { ...subject, works: subject.works.map(w => (w.id === work.id ? work : w)) };
    }));
  };

  const handleSaveWork = async (workId: string) => {
    const draft = drafts[workId];
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) {
      setError('Название работы не может быть пустым');
      return;
    }
    const priceValue = draft.price.trim() === '' ? null : Number(draft.price.replace(',', '.'));
    if (priceValue !== null && (isNaN(priceValue) || priceValue < 0)) {
      setError('Введите корректную цену');
      return;
    }

    setError('');
    setSavingWorkId(workId);
    try {
      const updated = await updateCatalogWork(workId, { title, price: priceValue });
      applyWorkChange(updated);
      setSuccess('Работа обновлена');
    } catch (e: any) {
      console.error('Ошибка обновления работы:', e);
      setError(e?.response?.data?.detail || 'Не удалось сохранить изменения');
    } finally {
      setSavingWorkId(null);
    }
  };

  const handleDeleteWork = async (workId: string) => {
    if (!window.confirm('Удалить эту практическую работу из каталога?')) return;

    setError('');
    setDeletingWorkId(workId);
    try {
      await deleteCatalogWork(workId);
      setSubjects(prev => prev.map(subject => {
        if (subject.id !== subjectId) return subject;
        return { ...subject, works: subject.works.filter(w => w.id !== workId) };
      }));
      setDrafts(prev => {
        const next = { ...prev };
        delete next[workId];
        return next;
      });
      setSuccess('Работа удалена');
    } catch (e: any) {
      console.error('Ошибка удаления работы:', e);
      setError(e?.response?.data?.detail || 'Не удалось удалить работу');
    } finally {
      setDeletingWorkId(null);
    }
  };

  const handleAddWork = async () => {
    if (!subjectId) return;
    const title = newWorkTitle.trim();
    if (!title) {
      setError('Укажите название новой работы');
      return;
    }
    const priceValue = newWorkPrice.trim() === '' ? null : Number(newWorkPrice.replace(',', '.'));
    if (priceValue !== null && (isNaN(priceValue) || priceValue < 0)) {
      setError('Введите корректную цену');
      return;
    }

    setError('');
    setAddingWork(true);
    try {
      const created = await addCatalogWork(subjectId, { title, price: priceValue });
      setSubjects(prev => prev.map(subject => {
        if (subject.id !== subjectId) return subject;
        return { ...subject, works: [...subject.works, created] };
      }));
      setDrafts(prev => ({
        ...prev,
        [created.id]: { title: created.title, price: created.price != null ? String(created.price) : '' }
      }));
      setNewWorkTitle('');
      setNewWorkPrice('');
      setSuccess('Работа добавлена');
    } catch (e: any) {
      console.error('Ошибка добавления работы:', e);
      setError(e?.response?.data?.detail || 'Не удалось добавить работу');
    } finally {
      setAddingWork(false);
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
    <Box sx={{ maxWidth: 1000, mx: 'auto', px: { xs: 1, sm: 3 }, py: { xs: 2, sm: 4 } }}>
      <Box
        display="flex"
        alignItems="center"
        mb={4}
        sx={{
          background: '#ffffff',
          borderRadius: 4,
          p: 3,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        }}
      >
        <IconButton
          onClick={() => navigate('/admin')}
          sx={{ mr: 2, background: 'rgba(37, 99, 235, 0.1)', border: '1px solid rgba(37, 99, 235, 0.2)' }}
        >
          <ArrowBack sx={{ color: '#2563eb' }} />
        </IconButton>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: '#1e293b' }}>
            Управление практическими работами
          </Typography>
          <Typography variant="body2" sx={{ color: 'grey.600' }}>
            Добавляйте, редактируйте название/цену и удаляйте работы по предметам без изменения кода
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Card sx={{ mb: 3, border: '1px solid #e2e8f0' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Выберите предмет
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Курс</InputLabel>
                <Select
                  label="Курс"
                  value={courseId}
                  onChange={(e) => handleSelectCourse(Number(e.target.value))}
                >
                  <MenuItem value={0} disabled>Выберите курс</MenuItem>
                  {courses.map(course => (
                    <MenuItem key={course.id} value={course.id}>{course.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth disabled={!selectedCourse}>
                <InputLabel>Семестр</InputLabel>
                <Select
                  label="Семестр"
                  value={semester}
                  onChange={(e) => handleSelectSemester(Number(e.target.value))}
                >
                  <MenuItem value={0} disabled>Выберите семестр</MenuItem>
                  {selectedCourse?.semesters.map(sem => (
                    <MenuItem key={sem} value={sem}>{sem} семестр</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth disabled={!semester}>
                <InputLabel>Предмет</InputLabel>
                <Select
                  label="Предмет"
                  value={subjectId}
                  onChange={(e) => handleSelectSubject(String(e.target.value))}
                >
                  <MenuItem value="" disabled>Выберите предмет</MenuItem>
                  {availableSubjects.map(subject => (
                    <MenuItem key={subject.id} value={subject.id}>{subject.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {selectedSubject && (
        <Card sx={{ border: '1px solid #e2e8f0' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {selectedSubject.name}
            </Typography>
            <Typography variant="body2" sx={{ color: 'grey.600', mb: 3 }}>
              {selectedSubject.works.length > 0
                ? `${selectedSubject.works.length} работ в каталоге`
                : 'В каталоге пока нет работ по этому предмету'}
            </Typography>

            {selectedSubject.works.map(work => {
              const draft = drafts[work.id] || { title: work.title, price: work.price != null ? String(work.price) : '' };
              return (
                <Paper key={work.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Название работы"
                        value={draft.title}
                        onChange={(e) => setDrafts(prev => ({ ...prev, [work.id]: { ...draft, title: e.target.value } }))}
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField
                        fullWidth
                        label="Цена, ₽"
                        type="number"
                        value={draft.price}
                        onChange={(e) => setDrafts(prev => ({ ...prev, [work.id]: { ...draft, price: e.target.value } }))}
                        inputProps={{ min: 0, step: 50 }}
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <Box display="flex" gap={1} justifyContent="flex-end">
                        <IconButton
                          color="primary"
                          onClick={() => handleSaveWork(work.id)}
                          disabled={savingWorkId === work.id}
                          title="Сохранить"
                        >
                          {savingWorkId === work.id ? <CircularProgress size={20} /> : <Save />}
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => handleDeleteWork(work.id)}
                          disabled={deletingWorkId === work.id}
                          title="Удалить"
                        >
                          {deletingWorkId === work.id ? <CircularProgress size={20} /> : <Delete />}
                        </IconButton>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              );
            })}

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Добавить новую работу
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Название работы"
                  value={newWorkTitle}
                  onChange={(e) => setNewWorkTitle(e.target.value)}
                  placeholder="Например: ПР №11"
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  label="Цена, ₽"
                  type="number"
                  value={newWorkPrice}
                  onChange={(e) => setNewWorkPrice(e.target.value)}
                  inputProps={{ min: 0, step: 50 }}
                  placeholder="Необязательно"
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={addingWork ? <CircularProgress size={18} color="inherit" /> : <Add />}
                  onClick={handleAddWork}
                  disabled={addingWork || newWorkTitle.trim() === ''}
                >
                  Добавить
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default CatalogManagementPage;
