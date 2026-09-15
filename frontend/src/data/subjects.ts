export interface WorkItem {
  id: string;
  title: string;
  description?: string;
  price?: number; // может быть undefined для работ без цены
  estimatedDays?: number;
}

export interface SubjectData {
  id: string;
  name: string;
  description: string;
  basePrice?: number; // может быть undefined
  course: number; // курс (2, 3, 4, ...)
  semester: number; // семестр
  works: WorkItem[];
  fullCourseDiscount?: number; // скидка при заказе всего курса в %
  isCustomForm?: boolean; // флаг для кастомной формы ввода работ
  priceNote?: string; // примечание о цене
}

export interface CourseData {
  id: number;
  name: string;
  semesters: number[];
}

export interface SemesterData {
  course: number;
  semester: number;
  name: string;
  subjects: SubjectData[];
}

// Каталог курсов/семестров/предметов/работ больше не хардкодится в коде: он
// хранится в backend/data/catalog.json и редактируется через страницу /add
// (см. getCatalog в api.ts). Эти переменные — просто последний загруженный
// снимок каталога; setCatalogData обновляет их после загрузки с backend'а.
export let coursesData: CourseData[] = [];
export let subjectsData: SubjectData[] = [];

export const setCatalogData = (courses: CourseData[], subjects: SubjectData[]): void => {
  coursesData = courses;
  subjectsData = subjects;
};

// Функции для работы с данными
export const getCourseById = (courseId: number): CourseData | undefined => {
  return coursesData.find(course => course.id === courseId);
};

export const getSubjectsByCourseAndSemester = (course: number, semester: number): SubjectData[] => {
  return subjectsData.filter(subject => subject.course === course && subject.semester === semester);
};

export const getSubjectById = (id: string): SubjectData | undefined => {
  return subjectsData.find(subject => subject.id === id);
};

export const getWorkById = (subjectId: string, workId: string): WorkItem | undefined => {
  const subject = getSubjectById(subjectId);
  return subject?.works.find(work => work.id === workId);
};

export const calculateFullCoursePrice = (subject: SubjectData): number => {
  const totalPrice = subject.works.reduce((sum, work) => sum + (work.price || 0), 0);
  const discount = subject.fullCourseDiscount || 0;
  return Math.round(totalPrice * (1 - discount / 100));
};

export const calculateSelectedWorksPrice = (subject: SubjectData, selectedWorkIds: string[]): number => {
  return subject.works
    .filter(work => selectedWorkIds.includes(work.id))
    .reduce((sum, work) => sum + (work.price || 0), 0);
};

export const getSemesterName = (course: number, semester: number): string => {
  return `${semester} семестр`;
};
