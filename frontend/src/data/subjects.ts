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
  semester: number; // семестр (1-5)
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
  { id: 1, name: "1 курс", semesters: [1, 2] },
  { id: 2, name: "2 курс", semesters: [3, 4] },
  { id: 3, name: "3 курс", semesters: [5] }
];

// Данные по предметам, структурированные по курсам и семестрам
export const subjectsData: SubjectData[] = [
  // 2 курс, 4 семестр - существующие предметы
  {
    id: "practice",
    name: "Летняя практика",
    description: "Системный анализ предприятия, архитектурное моделирование, управление проектами",
    basePrice: 2500,
    course: 2,
    semester: 4,
    fullCourseDiscount: 5,
    works: [
      {
        id: "practice-gost-excel",
        title: "ГОСТ + Excel анализ",
        price: 1250,
        estimatedDays: 3
      },
      {
        id: "practice-1-old",
        title: "1. Системный анализ предприятия(Старое предприятие)",
        price: 1250,
        estimatedDays: 3
      }, 
      {
        id: "practice-1-new",
        title: "1. Системный анализ предприятия(Новое предприятие)",
        price: 2250,
        estimatedDays: 3
      },
      {
        id: "practice-1-4-1-6",
        title: "1.4-1.6. Анализ производственной структуры предприятия",
        price: 2000,
        estimatedDays: 2
      },
      {
        id: "practice-2",
        title: "2. Архитектурное моделирование в среде Archi",
        price: 2500,
        estimatedDays: 3
      },
      {
        id: "practice-3",
        title: "3. Процессное управление предприятием",
        price: 2500,
        estimatedDays: 2
      },
      {
        id: "practice-4", 
        title: "4. Управление проектами (в YouGile)",
        price: 1250,
        estimatedDays: 2
      },
      {
        id: "practice-elma",
        title: "5. Исполнение бизнес-процессов в среде Elma 365",
        price: 1750,
        estimatedDays: 3
      },
      {
        id: "practice-7",
        title: "7. Визуализация данных в Yandex Data Lens",
        price: 1250,
        estimatedDays: 3
      },
      {
        id: "practice-orange",
        title: "8. Предварительный анализ данных в Orange",
        price: 1250,
        estimatedDays: 2
      },
      {
        id: "practice-python",
        title: "9. Анализ данных на Python+SQL",
        price: 1250,
        estimatedDays: 4
      }
    ]
  },
  {
    id: "stat-methods",
    name: "Статистические методы",
    description: "Практические работы по статистическим методам",
    basePrice: 2000,
    course: 2,
    semester: 4,
    fullCourseDiscount: 10,
    works: [
      { id: "stat-1", title: "ПР 1", description: "Статистические методы - Практическая работа №1", price: 1250, estimatedDays: 1 },
      { id: "stat-2", title: "ПР 2", description: "Статистические методы - Практическая работа №2", price: 1250, estimatedDays: 1 },
      { id: "stat-3", title: "ПР 3", description: "Статистические методы - Практическая работа №3", price: 1250, estimatedDays: 1 },
      { id: "stat-4", title: "ПР 4", description: "Статистические методы - Практическая работа №4", price: 1250, estimatedDays: 1 },
      { id: "stat-5", title: "ПР 5", description: "Статистические методы - Практическая работа №5", price: 1250, estimatedDays: 1 },
      { id: "stat-6", title: "ПР 6", description: "Статистические методы - Практическая работа №6", price: 1250, estimatedDays: 1 },
      { id: "stat-7", title: "ПР 7", description: "Статистические методы - Практическая работа №7", price: 1250, estimatedDays: 1 },
      { id: "stat-8", title: "ПР 8", description: "Статистические методы - Практическая работа №8", price: 1250, estimatedDays: 1 },
      { id: "stat-9", title: "ПР 9", description: "Статистические методы - Практическая работа №9", price: 1250, estimatedDays: 1 },
      { id: "stat-10", title: "ПР 10", description: "Статистические методы - Практическая работа №10", price: 1250, estimatedDays: 1 },
      { id: "stat-11", title: "ПР 11", description: "Статистические методы - Практическая работа №11", price: 1250, estimatedDays: 1 },
      { id: "stat-12", title: "ПР 12", description: "Статистические методы - Практическая работа №12", price: 1250, estimatedDays: 1 }
    ]
  },
  {
    id: "pup",
    name: "ПУП",
    description: "Практики, ИКР, рефераты по проектированию программного обеспечения",
    basePrice: 2200,
    course: 2,
    semester: 4,
    fullCourseDiscount: 7,
    works: [
      { id: "pup-practice-1", title: "ПР 1", description: "ПУП - Практическая работа №1", price: 1250, estimatedDays: 2 },
      { id: "pup-practice-2", title: "ПР 2", description: "ПУП - Практическая работа №2", price: 1250, estimatedDays: 2 },
      { id: "pup-practice-3", title: "ПР 3", description: "ПУП - Практическая работа №3", price: 1250, estimatedDays: 2 },
      { id: "pup-practice-4", title: "ПР 4", description: "ПУП - Практическая работа №4", price: 1250, estimatedDays: 2 },
      {
        id: "pup-5",
        title: "ПР 5",
        description: "Практическая работа №5. IDEF0",
        price: 2000,
        estimatedDays: 7
      },
      {
        id: "pup-6",
        title: "ПР 6",
        description: "Практическая работа №6. EPC и BPMN",
        price: 2500,
        estimatedDays: 7
      },
      {
        id: "pup-ikr",
        title: "ИКР (Итоговая контрольная работа)",
        description: "Итоговая контрольная работа по ПУП",
        price: 1250,
        estimatedDays: 7
      },
      {
        id: "pup-referat",
        title: "Реферат",
        description: "Реферат — это небольшое письменное сообщение по определенной теме, основанное на обзоре различных источников",
        price: 2000,
        estimatedDays: 2
      }
    ]
  },
  {
    id: "digital-economy",
    name: "Цифровая экономика",
    description: "Практические и лабораторные работы по цифровой экономике",
    basePrice: 1800,
    course: 2,
    semester: 4,
    fullCourseDiscount: 5,
    works: [
      { id: "digital-pr-1", title: "ПР 1", description: "Практическая работа №1 по цифровой экономике", price: 1250, estimatedDays: 1 },
      { id: "digital-pr-2", title: "ПР 2", description: "Практическая работа №2 по цифровой экономике", price: 1250, estimatedDays: 1 },
      { id: "digital-pr-3", title: "ПР 3", description: "Практическая работа №3 по цифровой экономике", price: 1250, estimatedDays: 1 },
      { id: "digital-pr-4", title: "ПР 4", description: "Практическая работа №4 по цифровой экономике", price: 1250, estimatedDays: 1 },
      { id: "digital-pr-5", title: "ПР 5", description: "Практическая работа №5 по цифровой экономике", price: 1250, estimatedDays: 1 },
      { id: "digital-lr-1", title: "ЛР 1", description: "Лабораторная работа №1 по цифровой экономике", price: 1250, estimatedDays: 2 },
      { id: "digital-lr-2", title: "ЛР 2", description: "Лабораторная работа №2 по цифровой экономике", price: 1250, estimatedDays: 2 },
      { id: "digital-lr-3", title: "ЛР 3", description: "Лабораторная работа №3 по цифровой экономике", price: 1250, estimatedDays: 2 }
    ]
  },
  {
    id: "bp-modeling-4",
    name: "Моделирование бизнес-процессов",
    description: "Практические работы по моделированию БП",
    basePrice: 2000,
    course: 2,
    semester: 4,
    fullCourseDiscount: 7,
    works: [
      { id: "bp-2", title: "ПР 2", description: "Моделирование БП - Практическая работа №2", price: 1250, estimatedDays: 3 },
      { id: "bp-3", title: "ПР 3", description: "Моделирование БП - Практическая работа №3", price: 1250, estimatedDays: 3 },
      { id: "bp-4", title: "ПР 4", description: "Моделирование БП - Практическая работа №4", price: 1250, estimatedDays: 3 },
      { id: "bp-5", title: "ПР 5", description: "Моделирование БП - Практическая работа №5", price: 1250, estimatedDays: 3 }
    ]
  },

  // 2 курс, 3 семестр - новые предметы
  {
    id: "databases",
    name: "Базы данных",
    description: "Стоимость от 1000 Р",
    basePrice: 1000,
    course: 2,
    semester: 3,
    isCustomForm: true,
    priceNote: "Стоимость уточняется у администратора",
    works: []
  },
  {
    id: "bp-modeling-3",
    name: "Моделирование бизнес-процессов",
    description: "Стоимость от 1000 Р",
    basePrice: 1000,
    course: 2,
    semester: 3,
    isCustomForm: true,
    priceNote: "Стоимость уточняется у администратора",
    works: []
  },
  {
    id: "management-theory",
    name: "Теория и практика управления предприятием",
    description: "Стоимость от 1000 Р",
    basePrice: 1000,
    course: 2,
    semester: 3,
    isCustomForm: true,
    priceNote: "Стоимость уточняется у администратора",
    works: []
  },
  {
    id: "programming-tech",
    name: "Технологии программирования",
    description: "Стоимость от 1000 Р",
    basePrice: 1000,
    course: 2,
    semester: 3,
    isCustomForm: true,
    priceNote: "Стоимость уточняется у администратора",
    works: []
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
      { id: "data-pr-3", title: "ПР №3", price: 1500, estimatedDays: 3 }
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
      { id: "arch-pr-9", title: "ПР №9", estimatedDays: 3 },
      { id: "arch-pr-10", title: "ПР №10", estimatedDays: 3 }
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
      { id: "services-ikr", title: "ИКР", estimatedDays: 3 },
      { id: "services-referat", title: "Реферат", price: 3000, estimatedDays: 3 }
    ]
  }
  ,
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
      { id: "process-pr-3", title: "ПР №3", estimatedDays: 3 },
      { id: "process-pr-4", title: "ПР №4", estimatedDays: 3 },
      { id: "process-ikr", title: "ИКР", estimatedDays: 3 },
      { id: "process-referat", title: "Реферат", price: 3000, estimatedDays: 3 }
    ]
  }
  ,
  {
    id: "erp-ais",
    name: "Архитектура прикладных информационных систем (ERP)",
    description: "Практические работы по ERP",
    course: 3,
    semester: 5,
    works: [
      { id: "erp-pr-1", title: "ПР №1", price: 2500, estimatedDays: 3 },
      { id: "erp-pr-2", title: "ПР №2", price: 2500, estimatedDays: 3 }
    ]
  }
  ,
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
  if (course === 1) {
    return semester === 1 ? "1 семестр" : "2 семестр";
  } else if (course === 2) {
    return semester === 3 ? "3 семестр" : "4 семестр";
  } else if (course === 3) {
    return "5 семестр";
  }
  return `${semester} семестр`;
};