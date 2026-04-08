export interface WorkItem {
  id: string;
  title: string;
  description?: string;
  price?: number; // теперь может быть undefined для работ без цены
  estimatedDays?: number;
}

export interface SubjectData {
  id: string;
  name: string;
  description: string;
  basePrice?: number; // теперь может быть undefined
  course: number; // курс (1, 2, 3)
  semester: number; // семестр (1-6)
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

// Структура курсов и семестров
export const coursesData: CourseData[] = [
  { id: 2, name: "2 курс", semesters: [4] },
  { id: 3, name: "3 курс", semesters: [5, 6] }
];

// Данные по предметам, структурированные по курсам и семестрам
export const subjectsData: SubjectData[] = [
  // 2 курс, 4 семестр
  {
    id: "probability-statistics-methods",
    name: "Вероятностно-статистические методы анализа данных в принятии решений",
    description: "ПР №1 - ПР №10, Курсовая работа",
    basePrice: 1000,
    course: 2,
    semester: 4,
    fullCourseDiscount: 5,
    works: [
      { id: "psm-pr-1", title: "ПР №1", price: 1000, estimatedDays: 2 },
      { id: "psm-pr-2", title: "ПР №2", price: 1000, estimatedDays: 2 },
      { id: "psm-pr-3", title: "ПР №3", price: 1000, estimatedDays: 2 },
      { id: "psm-pr-4", title: "ПР №4", price: 1000, estimatedDays: 2 },
      { id: "psm-pr-5", title: "ПР №5", price: 1000, estimatedDays: 2 },
      { id: "psm-pr-6", title: "ПР №6", price: 1000, estimatedDays: 2 },
      { id: "psm-pr-7", title: "ПР №7", price: 1000, estimatedDays: 2 },
      { id: "psm-pr-8", title: "ПР №8", price: 1000, estimatedDays: 2 },
      { id: "psm-pr-9", title: "ПР №9", price: 1000, estimatedDays: 2 },
      { id: "psm-pr-10", title: "ПР №10", price: 1000, estimatedDays: 2 },
      { id: "psm-coursework", title: "Курсовая работа", price: 5000, estimatedDays: 5 }
    ]
  },
  {
    id: "bp-modeling-4",
    name: "Моделирование бизнес-процессов",
    description: "ПР №1 - ПР №6",
    basePrice: 1000,
    course: 2,
    semester: 4,
    fullCourseDiscount: 5,
    works: [
      { id: "bp4-pr-1", title: "ПР №1", price: 1000, estimatedDays: 2 },
      { id: "bp4-pr-2", title: "ПР №2", price: 1000, estimatedDays: 2 },
      { id: "bp4-pr-3", title: "ПР №3", estimatedDays: 2 },
      { id: "bp4-pr-4", title: "ПР №4", estimatedDays: 2 },
      { id: "bp4-pr-5", title: "ПР №5", estimatedDays: 2 },
      { id: "bp4-pr-6", title: "ПР №6", estimatedDays: 2 }
    ]
  },
  {
    id: "client-server-dev",
    name: "Разработка клиент-серверных приложений",
    description: "Реферат, Python.ПР №1-5, 1С.ПР №1-5, Elma.ПР №1-3",
    basePrice: 1000,
    course: 2,
    semester: 4,
    fullCourseDiscount: 5,
    works: [
      { id: "csd-referat", title: "Реферат", price: 3000, estimatedDays: 3 },
      { id: "csd-python-pr-1", title: "Python.ПР №1", price: 1000, estimatedDays: 2 },
      { id: "csd-python-pr-2", title: "Python.ПР №2", price: 1000, estimatedDays: 2 },
      { id: "csd-python-pr-3", title: "Python.ПР №3", price: 1000, estimatedDays: 2 },
      { id: "csd-python-pr-4", title: "Python.ПР №4", price: 1000, estimatedDays: 2 },
      { id: "csd-python-pr-5", title: "Python.ПР №5", price: 1000, estimatedDays: 2 },
      { id: "csd-1c-pr-1", title: "1С.ПР №1", price: 500, estimatedDays: 2 },
      { id: "csd-1c-pr-2", title: "1С.ПР №2", price: 1000, estimatedDays: 2 },
      { id: "csd-1c-pr-3", title: "1С.ПР №3", price: 1500, estimatedDays: 2 },
      { id: "csd-1c-pr-4", title: "1С.ПР №4", price: 2000, estimatedDays: 3 },
      { id: "csd-1c-pr-5", title: "1С.ПР №5", price: 2000, estimatedDays: 3 },
      { id: "csd-elma-pr-1", title: "Elma.ПР №1", price: 2000, estimatedDays: 3 },
      { id: "csd-elma-pr-2", title: "Elma.ПР №2", price: 2000, estimatedDays: 3 },
      { id: "csd-elma-pr-3", title: "Elma.ПР №3", price: 2000, estimatedDays: 3 }
    ]
  },
  {
    id: "enterprise-process-management",
    name: "Процессное управление предприятием",
    description: "ПР №1 - ПР №5, ИКР, Реферат",
    basePrice: 1000,
    course: 2,
    semester: 4,
    fullCourseDiscount: 5,
    works: [
      { id: "epm-pr-1", title: "ПР №1", price: 1000, estimatedDays: 2 },
      { id: "epm-pr-2", title: "ПР №2", price: 1000, estimatedDays: 2 },
      { id: "epm-pr-3", title: "ПР №3", price: 1250, estimatedDays: 2 },
      { id: "epm-pr-4", title: "ПР №4", price: 1250, estimatedDays: 2 },
      { id: "epm-pr-5", title: "ПР №5", price: 1250, estimatedDays: 2 },
      { id: "epm-ikr", title: "ИКР", price: 1000, estimatedDays: 2 },
      { id: "epm-referat", title: "Реферат", price: 3000, estimatedDays: 3 }
    ]
  },
  {
    id: "digital-economy-management",
    name: "Цифровая экономика и менеджмент предприятия",
    description: "ПР №1 - ПР №5, ЛР №1 - ЛР №4, ИКР",
    basePrice: 1000,
    course: 2,
    semester: 4,
    fullCourseDiscount: 5,
    works: [
      { id: "dem-pr-1", title: "ПР №1", price: 1000, estimatedDays: 2 },
      { id: "dem-pr-2", title: "ПР №2", price: 1000, estimatedDays: 2 },
      { id: "dem-pr-3", title: "ПР №3", price: 1000, estimatedDays: 2 },
      { id: "dem-pr-4", title: "ПР №4", price: 1000, estimatedDays: 2 },
      { id: "dem-pr-5", title: "ПР №5", price: 1000, estimatedDays: 2 },
      { id: "dem-lr-1", title: "ЛР №1", price: 1000, estimatedDays: 2 },
      { id: "dem-lr-2", title: "ЛР №2", price: 1000, estimatedDays: 2 },
      { id: "dem-lr-3", title: "ЛР №3", price: 1000, estimatedDays: 2 },
      { id: "dem-lr-4", title: "ЛР №4", price: 1000, estimatedDays: 2 },
      { id: "dem-ikr", title: "ИКР", price: 1000, estimatedDays: 2 }
    ]
  },

  // 3 курс, 5 семестр
  {
    id: "data-analysis",
    name: "Интеллектуальный анализ данных и предиктивная аналитика",
    description: "Практические работы по анализу данных",
    course: 3,
    semester: 5,
    works: [
      { id: "data-pr-1", title: "ПР №1", price: 1000, estimatedDays: 3 },
      { id: "data-pr-2", title: "ПР №2", price: 1500, estimatedDays: 3 },
      { id: "data-pr-3", title: "ПР №3", price: 1500, estimatedDays: 3 },
      { id: "data-ikr", title: "ИКР", price: 2000, estimatedDays: 3 }
    ]
  },
  {
    id: "system-arch",
    name: "Системно-архитектурный анализ цифрового предприятия",
    description: "Практические работы по системному анализу",
    course: 3,
    semester: 5,
    works: [
      { id: "arch-pr-1", title: "ПР №1", price: 1000, estimatedDays: 3 },
      { id: "arch-pr-2", title: "ПР №2", price: 1000, estimatedDays: 3 },
      { id: "arch-pr-3", title: "ПР №3", price: 1000, estimatedDays: 3 },
      { id: "arch-pr-4", title: "ПР №4", price: 1500, estimatedDays: 3 },
      { id: "arch-pr-5", title: "ПР №5", price: 1250, estimatedDays: 3 },
      { id: "arch-pr-6", title: "ПР №6", price: 2000, estimatedDays: 3 },
      { id: "arch-pr-7", title: "ПР №7", price: 1500, estimatedDays: 3 },
      { id: "arch-pr-8", title: "ПР №8", price: 2000, estimatedDays: 3 },
      { id: "arch-pr-9", title: "ПР №9", price: 1500, estimatedDays: 3 },
      { id: "arch-pr-10", title: "ПР №10", price: 1250, estimatedDays: 3 }
    ]
  },
  {
    id: "it-management",
    name: "Системный подход к управлению IT – проектами.",
    description: "Практические работы по управлению IT-проектами",
    course: 3,
    semester: 5,
    works: [
      { id: "it-pr-1", title: "ПР №1", price: 1000, estimatedDays: 3 },
      { id: "it-pr-2", title: "ПР №2", price: 1500, estimatedDays: 3 },
      { id: "it-pr-3", title: "ПР №3", price: 1500, estimatedDays: 3 },
      { id: "it-pr-4", title: "ПР №4", price: 1500, estimatedDays: 3 },
      { id: "it-pr-5", title: "ПР №5", price: 1500, estimatedDays: 3 },
      { id: "it-pr-6", title: "ПР №6", price: 1500, estimatedDays: 3 },
      { id: "it-ikr", title: "ИКР", price: 1500, estimatedDays: 3 },
      { id: "it-referat", title: "Реферат", price: 3000, estimatedDays: 3 }
    ]
  },
  {
    id: "it-services",
    name: "Управление сервисами, IT-инфраструктурой и безопасностью информационных систем",
    description: "Практические работы по управлению сервисами",
    course: 3,
    semester: 5,
    works: [
      { id: "services-pr-1", title: "ПР №1", price: 1250, estimatedDays: 3 },
      { id: "services-pr-2", title: "ПР №2", price: 1250, estimatedDays: 3 },
      { id: "services-pr-3", title: "ПР №3", price: 1250, estimatedDays: 3 },
      { id: "services-ikr", title: "ИКР", price: 1000, estimatedDays: 3 },
      { id: "services-referat", title: "Реферат", price: 3000, estimatedDays: 3 },
      { id: "services-m2-pr-1", title: "Модуль 2. ПР №1", price: 1000, estimatedDays: 3 },
      { id: "services-m2-pr-2", title: "Модуль 2. ПР №2", price: 1000, estimatedDays: 3 },
      { id: "services-m2-pr-3", title: "Модуль 2. ПР №3", price: 1000, estimatedDays: 3 },
      { id: "services-m2-pr-4", title: "Модуль 2. ПР №4", price: 1250, estimatedDays: 3 }
    ]
  },
  {
    id: "bigdata-architecture",
    name: "Архитектура больших данных",
    description: "Практические работы по архитектуре больших данных",
    course: 3,
    semester: 5,
    works: [
      { id: "bigdata-arch-pr-1", title: "ПР №1", price: 1500, estimatedDays: 3 },
      { id: "bigdata-arch-pr-2", title: "ПР №2", price: 1500, estimatedDays: 3 },
      { id: "bigdata-arch-pr-3", title: "ПР №3", price: 1500, estimatedDays: 3 },
      { id: "bigdata-arch-group", title: "Групповой проект", price: 5000, estimatedDays: 7 }
    ]
  },
  {
    id: "process-approach",
    name: "Процессный подход к моделированию в управлении предприятием",
    description: "Практические работы и итоговые работы по процессному подходу",
    course: 3,
    semester: 5,
    works: [
      { id: "process-pr-1", title: "ПР №1", price: 2500, estimatedDays: 3 },
      { id: "process-pr-2", title: "ПР №2", price: 1250, estimatedDays: 3 },
      { id: "process-pr-3", title: "ПР №3", price: 1500, estimatedDays: 3 },
      { id: "process-pr-4", title: "ПР №4", price: 2000, estimatedDays: 3 },
      { id: "process-ikr", title: "ИКР", price: 1000, estimatedDays: 3 },
      { id: "process-referat", title: "Реферат", price: 3000, estimatedDays: 3 }
    ]
  },
  {
    id: "knir-1",
    name: "КНИР 1",
    description: "Курсовая научно-исследовательская работа, 1 часть",
    course: 3,
    semester: 5,
    works: [
      { id: "knir1-task", title: "Постановка задачи исследования", price: 1000 },
      { id: "knir1-pr1", title: "ПР1 Разработка плана проекта исследования", price: 1000 },
      { id: "knir1-pr2", title: "ПР2  Системный анализ объекта исследования", price: 2000 },
      { id: "knir1-pr3", title: "ПР3 Определение границ предметной области", price: 1500 },
      { id: "knir1-pr4", title: "ПР4 Разработка архитектурных моделей бизнес-процесса", price: 2000 },
      { id: "knir1-pr5", title: "ПР5 Разработка процессных моделей предприятия", price: 2000 },
      { id: "knir1-pr6-1", title: "ПР6.1 Разработка KPI и анализ закономерностей причинно-следственных связей", price: 1250 },
      { id: "knir1-pr6-2", title: "ПР6.2 Разработка требований к сервисному управлению изменениями/инцидентами", price: 1000 },
      { id: "knir1-pr6-3", title: "ПР6.3 Разработка модели базы данных", price: 1000 },
      { id: "knir1-pr7", title: "ПР7 Планирование проекта по разработке и внедрению информационной системы", price: 1250 },
      { id: "knir1-final", title: "Итоговый отчет", price: 1000 }
    ]
  },
  // 3 курс, 6 семестр
  {
    id: "fm-systems",
    name: "Информационные системы управления экономикой, финансами, бюджетами (FM)",
    description: "ПР №1-2, ЛР №1-2, групповой проект",
    basePrice: 1000,
    course: 3,
    semester: 6,
    fullCourseDiscount: 5,
    works: [
      { id: "fm-pr-1", title: "ПР №1", price: 1000, estimatedDays: 2 },
      { id: "fm-pr-2", title: "ПР №2", price: 1000, estimatedDays: 2 },
      { id: "fm-lr-1", title: "ЛР №1", price: 2000, estimatedDays: 3 },
      { id: "fm-lr-2", title: "ЛР №2", price: 2000, estimatedDays: 3 },
      { id: "fm-group-project", title: "Групповой проект", price: 5000, estimatedDays: 5 }
    ]
  },
  {
    id: "scm-logistics",
    name: "Логистические системы и управление цепочками поставок (SCM)",
    description: "ПР №1-4, ЛР №1-3, ИКР",
    basePrice: 1250,
    course: 3,
    semester: 6,
    fullCourseDiscount: 5,
    works: [
      { id: "scm-pr-1", title: "ПР №1", price: 1250, estimatedDays: 2 },
      { id: "scm-pr-2", title: "ПР №2", price: 1250, estimatedDays: 2 },
      { id: "scm-pr-3", title: "ПР №3", price: 1250, estimatedDays: 2 },
      { id: "scm-pr-4", title: "ПР №4", price: 1250, estimatedDays: 2 },
      { id: "scm-lr-1", title: "ЛР №1", price: 2500, estimatedDays: 3 },
      { id: "scm-lr-2", title: "ЛР №2", price: 2500, estimatedDays: 3 },
      { id: "scm-lr-3", title: "ЛР №3", price: 2500, estimatedDays: 3 },
      { id: "scm-ikr", title: "ИКР", price: 1000, estimatedDays: 2 },
      { id: "scm-individual", title: "Индивидуальное задание", estimatedDays: 3 }
    ]
  },
  {
    id: "is-design-management",
    name: "Проектирование, управление разработкой, внедрением и изменениями информационных систем",
    description: "ПР №1-8, ИКР, Реферат",
    basePrice: 1250,
    course: 3,
    semester: 6,
    fullCourseDiscount: 5,
    works: [
      { id: "isdm-pr-1", title: "ПР №1", price: 1250, estimatedDays: 2 },
      { id: "isdm-pr-2", title: "ПР №2", price: 1250, estimatedDays: 2 },
      { id: "isdm-pr-3", title: "ПР №3", price: 1250, estimatedDays: 2 },
      { id: "isdm-pr-4", title: "ПР №4", price: 1750, estimatedDays: 2 },
      { id: "isdm-pr-5", title: "ПР №5", price: 1500, estimatedDays: 2 },
      { id: "isdm-pr-6", title: "ПР №6", price: 2500, estimatedDays: 3 },
      { id: "isdm-pr-7", title: "ПР №7", price: 2500, estimatedDays: 3 },
      { id: "isdm-pr-8", title: "ПР №8", price: 1500, estimatedDays: 2 },
      { id: "isdm-ikr", title: "ИКР", price: 1000, estimatedDays: 2 },
      { id: "isdm-referat", title: "Реферат", price: 3000, estimatedDays: 3 }
    ]
  },
  {
    id: "hr-crm-srm",
    name: "Управление человеческими ресурсами (HR), взаимоотношениями с клиентами(CRM) и поставщиками(SRM)",
    description: "CRM №1-2, HRM, SRM, ECM, ИКР, Реферат, Обзор рынка",
    basePrice: 2000,
    course: 3,
    semester: 6,
    fullCourseDiscount: 5,
    works: [
      { id: "hrcrm-crm-1", title: "CRM №1", price: 2000, estimatedDays: 2 },
      { id: "hrcrm-crm-2", title: "CRM №2", price: 2000, estimatedDays: 2 },
      { id: "hrcrm-hrm", title: "HRM", price: 2000, estimatedDays: 2 },
      { id: "hrcrm-srm", title: "SRM", price: 2000, estimatedDays: 2 },
      { id: "hrcrm-ecm", title: "ECM", price: 2000, estimatedDays: 2 },
      { id: "hrcrm-ikr", title: "ИКР", price: 1000, estimatedDays: 2 },
      { id: "hrcrm-referat", title: "Реферат", price: 3000, estimatedDays: 3 },
      { id: "hrcrm-market-review", title: "Обзор рынка", price: 1250, estimatedDays: 2 }
    ]
  },
  {
    id: "aps-mes-systems",
    name: "Системы планирования и управления основным производством (APS/ MES)",
    description: "Реферат, ПР №1-5",
    basePrice: 2000,
    course: 3,
    semester: 6,
    fullCourseDiscount: 5,
    works: [
      { id: "aps-referat", title: "Реферат", price: 3000, estimatedDays: 3 },
      { id: "aps-pr-1", title: "ПР №1", price: 2000, estimatedDays: 3 },
      { id: "aps-pr-2", title: "ПР №2", price: 2000, estimatedDays: 3 },
      { id: "aps-pr-3", title: "ПР №3", price: 2000, estimatedDays: 3 },
      { id: "aps-pr-4", title: "ПР №4", price: 2000, estimatedDays: 3 },
      { id: "aps-pr-5", title: "ПР №5", price: 2000, estimatedDays: 3 }
    ]
  },
  {
    id: "business-performance-systems",
    name: "Системы управления эффективностью, качеством и стратегией развития бизнеса",
    description: "ПР №1-5, Реферат, ИКР",
    basePrice: 1250,
    course: 3,
    semester: 6,
    fullCourseDiscount: 5,
    works: [
      { id: "bps-pr-1", title: "ПР №1", price: 1250, estimatedDays: 2 },
      { id: "bps-pr-2", title: "ПР №2", price: 1250, estimatedDays: 2 },
      { id: "bps-pr-3", title: "ПР №3", price: 1500, estimatedDays: 2 },
      { id: "bps-pr-4", title: "ПР №4", price: 1500, estimatedDays: 2 },
      { id: "bps-pr-5", title: "ПР №5", price: 2000, estimatedDays: 2 },
      { id: "bps-referat", title: "Реферат", price: 3000, estimatedDays: 3 },
      { id: "bps-ikr", title: "ИКР", price: 1000, estimatedDays: 2 }
    ]
  },
  {
    id: "bigdata-systems-design",
    name: "Проектирование систем обработки больших данных",
    description: "ПР №1-3, Групповой проект",
    basePrice: 1500,
    course: 3,
    semester: 6,
    fullCourseDiscount: 5,
    works: [
      { id: "bds-pr-1", title: "ПР №1", price: 1500, estimatedDays: 3 },
      { id: "bds-pr-2", title: "ПР №2", price: 1500, estimatedDays: 3 },
      { id: "bds-pr-3", title: "ПР №3", price: 1500, estimatedDays: 3 },
      { id: "bds-group-project", title: "Групповой проект", price: 5000, estimatedDays: 7 }
    ]
  }
];

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