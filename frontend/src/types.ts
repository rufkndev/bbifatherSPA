export interface Student {
  id?: number;
  name: string;
  group?: string;
  telegram?: string;
  email?: string;
  phone?: string;
}

export interface Subject {
  id: number;
  name: string;
  description: string;
  price: number;
}

export enum OrderStatus {
  NEW = 'new',
  WAITING_PAYMENT = 'waiting_payment',
  PAID = 'paid',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  NEEDS_REVISION = 'needs_revision'
}

export interface Order {
  id?: number;
  student_id: number;
  subject_id: number;
  title: string;
  description: string;
  input_data: string;
  variant_info?: string;
  deadline: string;
  status: OrderStatus;
  is_paid: boolean;
  files?: string[];
  created_at?: string;
  updated_at?: string;
  selected_works?: string;
  is_full_course?: boolean;
  actual_price?: number;
  
  // Поля для исправлений
  revision_comment?: string;
  revision_grade?: string;
  
  // Связанные данные
  student?: Student;
  subject?: Subject;
}

export interface CreateOrderRequest {
  student: Student;
  subject_id: number | null; // может быть null для кастомных заказов
  title: string;
  description: string;
  input_data: string;
  variant_info?: string; // информация о варианте
  deadline: string;
  selected_works?: string[]; // ID выбранных работ
  is_full_course?: boolean; // заказ всего курса
  custom_subject?: string; // кастомный предмет
  custom_work?: string; // кастомное название работы
  actual_price?: number; // рассчитанная стоимость
}

export interface OrderListResponse {
  orders: Order[];
  total: number;
}