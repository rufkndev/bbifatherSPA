import axios from 'axios';
import { Order, Subject, CreateOrderRequest, OrderListResponse, Student } from './types';

const API_BASE_URL = 'https://bbifather.ru/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Subjects API
export const getSubjects = async (): Promise<Subject[]> => {
  const response = await api.get('/api/subjects');
  return response.data;
};

// Orders API
export const getOrders = async (page: number = 1, limit: number = 10, telegram?: string | null): Promise<OrderListResponse> => {
  let url = `/api/orders?page=${page}&limit=${limit}`;
  if (telegram) {
    url += `&telegram=${telegram}`;
  }
  const response = await api.get(url);
  return response.data;
};

// Получить все заказы без ограничения 100 записей (используется пагинация)
export const getAllOrders = async (telegram?: string | null, pageSize: number = 200): Promise<Order[]> => {
  const limit = Math.max(1, Math.min(pageSize, 1000)); // защитимся от слишком маленьких/больших значений
  let page = 1;
  let allOrders: Order[] = [];
  let total = 0;

  while (true) {
    const response = await getOrders(page, limit, telegram ?? undefined);
    allOrders = allOrders.concat(response.orders);
    total = response.total || allOrders.length;

    const fetchedCount = response.orders.length;
    if (allOrders.length >= total || fetchedCount < limit) {
      break;
    }

    page += 1;
  }

  return allOrders;
};

export const getOrder = async (id: number): Promise<Order> => {
  const response = await api.get(`/api/orders/${id}`);
  return response.data;
};

export const createOrder = async (orderData: CreateOrderRequest): Promise<Order> => {
  const response = await api.post('/api/orders', orderData);
  return response.data;
};

export const updateOrderStatus = async (id: number, status: string): Promise<Order> => {
  const response = await api.patch(`/api/orders/${id}/status`, { status });
  return response.data;
};

export const markOrderAsPaid = async (id: number): Promise<Order> => {
  const response = await api.patch(`/api/orders/${id}/paid`);
  return response.data;
};

// Обновление цены заказа администратором
export const updateOrderPrice = async (id: number, price: number): Promise<Order> => {
  const response = await api.patch(`/api/orders/${id}/price`, { price });
  return response.data;
};

export const requestOrderRevision = async (id: number, comment: string, grade?: string): Promise<Order> => {
  const response = await api.post(`/api/orders/${id}/request-revision`, { 
    comment, 
    grade 
  });
  return response.data;
};

export const uploadOrderFiles = async (id: number, files: FileList): Promise<Order> => {
  const formData = new FormData();
  Array.from(files).forEach(file => {
    formData.append('files', file);
  });
  
  const response = await api.post(`/api/orders/${id}/files`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const downloadFile = async (orderId: number, filename: string): Promise<void> => {
  const response = await api.get(`/api/orders/${orderId}/download/${filename}`, {
    responseType: 'blob',
  });
  
  // Создаем ссылку для скачивания
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const downloadAllFiles = async (orderId: number): Promise<void> => {
  const response = await api.get(`/api/orders/${orderId}/download-all`, {
    responseType: 'blob',
  });
  
  // Получаем имя файла из заголовков ответа
  const contentDisposition = response.headers['content-disposition'];
  let filename = `Заказ_${orderId}.zip`;
  
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1].replace(/['"]/g, '');
    }
  }
  
  // Создаем ссылку для скачивания
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// Новая функция для отправки файлов в Telegram
export const sendFilesToTelegram = async (orderId: number, telegram: string): Promise<{
  status: string;
  message: string;
  sent_count: number;
  total_files: number;
}> => {
  const response = await api.post('/api/send-files-to-telegram', {
    order_id: orderId,
    telegram: telegram
  });
  return response.data;
};

// Students API
export const getStudents = async (): Promise<Student[]> => {
  const response = await api.get('/api/students');
  return response.data;
};

// Админ: полное обновление заказа
export const updateOrderAdmin = async (id: number, payload: Partial<Order>): Promise<Order> => {
  const response = await api.patch(`/api/orders/${id}/admin`, payload);
  return response.data;
};

// Админ/исполнитель: установка/снятие исполнителя и суммы к выплате
export const updateOrderExecutor = async (
  id: number,
  executorTelegram: string | null,
  payout?: number | null
): Promise<Order> => {
  const response = await api.patch(`/api/orders/${id}/executor`, {
    executor_telegram: executorTelegram,
    payout_amount: payout,
  });
  return response.data;
};

export default api;