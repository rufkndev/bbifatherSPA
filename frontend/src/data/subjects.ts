export interface WorkItem {
  id: string;
  title: string;
  description?: string;
  price: number;
  estimatedDays?: number;
}

export interface SubjectData {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  semester: number;
  works: WorkItem[];
  fullCourseDiscount?: number; // скидка при заказе всего курса в %
}

export const subjectsData: SubjectData[] = [
  {
    id: "practice",
    name: "Летняя практика",
    description: "Системный анализ предприятия, архитектурное моделирование, управление проектами",
    basePrice: 2500,
    semester: 4,
    fullCourseDiscount: 5,
    works: [
      {
        id: "practice-gost-excel",
        title: "ГОСТ + Excel анализ",
        price: 1000,
        estimatedDays: 3
      },
      {
        id: "practice-1-old",
        title: "1. Системный анализ предприятия(Старое предприятие)",
        price: 1000,
        estimatedDays: 3
      }, 
      {
        id: "practice-1-new",
        title: "1. Системный анализ предприятия(Новое предприятие)",
        price: 2000,
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
        price: 2000,
        estimatedDays: 2
      },
      {
        id: "practice-4", 
        title: "4. Управление проектами (в YouGile)",
        price: 1000,
        estimatedDays: 2
      },
      {
        id: "practice-7",
        title: "7. Визуализация данных в Yandex Data Lens",
        price: 1000,
        estimatedDays: 3
      },
      {
        id: "practice-orange",
        title: "8. Предварительный анализ данных в Orange",
        price: 1000,
        estimatedDays: 2
      },
      {
        id: "practice-python",
        title: "9. Анализ данных на Python+SQL",
        price: 1000,
        estimatedDays: 4
      }
    ]
  },
  {
    id: "stat-methods",
    name: "Статистические методы",
    description: "Практические работы по статистическим методам",
    basePrice: 2000,
    semester: 4,
    fullCourseDiscount: 10,
    works: [
      { id: "stat-1", title: "ПР 1", description: "Статистические методы - Практическая работа №1", price: 1000, estimatedDays: 1 },
      { id: "stat-2", title: "ПР 2", description: "Статистические методы - Практическая работа №2", price: 1000, estimatedDays: 1 },
      { id: "stat-3", title: "ПР 3", description: "Статистические методы - Практическая работа №3", price: 1000, estimatedDays: 1 },
      { id: "stat-4", title: "ПР 4", description: "Статистические методы - Практическая работа №4", price: 1000, estimatedDays: 1 },
      { id: "stat-5", title: "ПР 5", description: "Статистические методы - Практическая работа №5", price: 1000, estimatedDays: 1 },
      { id: "stat-6", title: "ПР 6", description: "Статистические методы - Практическая работа №6", price: 1000, estimatedDays: 1 },
      { id: "stat-7", title: "ПР 7", description: "Статистические методы - Практическая работа №7", price: 1000, estimatedDays: 1 },
      { id: "stat-8", title: "ПР 8", description: "Статистические методы - Практическая работа №8", price: 1000, estimatedDays: 1 },
      { id: "stat-9", title: "ПР 9", description: "Статистические методы - Практическая работа №9", price: 1000, estimatedDays: 1 },
      { id: "stat-10", title: "ПР 10", description: "Статистические методы - Практическая работа №10", price: 1000, estimatedDays: 1 },
      { id: "stat-11", title: "ПР 11", description: "Статистические методы - Практическая работа №11", price: 1000, estimatedDays: 1 },
      { id: "stat-12", title: "ПР 12", description: "Статистические методы - Практическая работа №12", price: 1000, estimatedDays: 1 }
    ]
  },
  {
    id: "pup",
    name: "ПУП",
    description: "Практики, ИКР, рефераты по проектированию программного обеспечения",
    basePrice: 2200,
    semester: 4,
    fullCourseDiscount: 7,
    works: [
      { id: "pup-practice-1", title: "ПР 1", description: "ПУП - Практическая работа №1", price: 1000, estimatedDays: 2 },
      { id: "pup-practice-2", title: "ПР 2", description: "ПУП - Практическая работа №2", price: 1000, estimatedDays: 2 },
      { id: "pup-practice-3", title: "ПР 3", description: "ПУП - Практическая работа №3", price: 1000, estimatedDays: 2 },
      { id: "pup-practice-4", title: "ПР 4", description: "ПУП - Практическая работа №4", price: 1000, estimatedDays: 2 },
      {
        id: "pup-5",
        title: "ПР 5",
        description: "Практическая работа №5. IDEF0",
        price: 1500,
        estimatedDays: 7
      },
      {
        id: "pup-6",
        title: "ПР 6",
        description: "Практическая работа №6. EPC и BPMN",
        price: 2000,
        estimatedDays: 7
      },
      {
        id: "pup-ikr",
        title: "ИКР (Итоговая контрольная работа)",
        description: "Итоговая контрольная работа по ПУП",
        price: 1000,
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
    semester: 4,
    fullCourseDiscount: 5,
    works: [
      { id: "digital-pr-1", title: "ПР 1", description: "Практическая работа №1 по цифровой экономике", price: 1000, estimatedDays: 1 },
      { id: "digital-pr-2", title: "ПР 2", description: "Практическая работа №2 по цифровой экономике", price: 1000, estimatedDays: 1 },
      { id: "digital-pr-3", title: "ПР 3", description: "Практическая работа №3 по цифровой экономике", price: 1000, estimatedDays: 1 },
      { id: "digital-pr-4", title: "ПР 4", description: "Практическая работа №4 по цифровой экономике", price: 1000, estimatedDays: 1 },
      { id: "digital-pr-5", title: "ПР 5", description: "Практическая работа №5 по цифровой экономике", price: 1000, estimatedDays: 1 },
      { id: "digital-lr-1", title: "ЛР 1", description: "Лабораторная работа №1 по цифровой экономике", price: 1000, estimatedDays: 2 },
      { id: "digital-lr-2", title: "ЛР 2", description: "Лабораторная работа №2 по цифровой экономике", price: 1000, estimatedDays: 2 },
      { id: "digital-lr-3", title: "ЛР 3", description: "Лабораторная работа №3 по цифровой экономике", price: 1000, estimatedDays: 2 }
    ]
  },
  {
    id: "bp-modeling",
    name: "Моделирование бизнес-процессов",
    description: "Практические работы по моделированию БП",
    basePrice: 2000,
    semester: 4,
    fullCourseDiscount: 7,
    works: [
      { id: "bp-2", title: "ПР 2", description: "Моделирование БП - Практическая работа №2", price: 1000, estimatedDays: 3 },
      { id: "bp-3", title: "ПР 3", description: "Моделирование БП - Практическая работа №3", price: 1000, estimatedDays: 3 },
      { id: "bp-4", title: "ПР 4", description: "Моделирование БП - Практическая работа №4", price: 1000, estimatedDays: 3 },
      { id: "bp-5", title: "ПР 5", description: "Моделирование БП - Практическая работа №5", price: 1000, estimatedDays: 3 }
    ]
  }
];

// Функции для работы с данными
export const getSubjectById = (id: string): SubjectData | undefined => {
  return subjectsData.find(subject => subject.id === id);
};

export const getWorkById = (subjectId: string, workId: string): WorkItem | undefined => {
  const subject = getSubjectById(subjectId);
  return subject?.works.find(work => work.id === workId);
};

export const calculateFullCoursePrice = (subject: SubjectData): number => {
  const totalPrice = subject.works.reduce((sum, work) => sum + work.price, 0);
  const discount = subject.fullCourseDiscount || 0;
  return Math.round(totalPrice * (1 - discount / 100));
};

export const calculateSelectedWorksPrice = (subject: SubjectData, selectedWorkIds: string[]): number => {
  return subject.works
    .filter(work => selectedWorkIds.includes(work.id))
    .reduce((sum, work) => sum + work.price, 0);
};