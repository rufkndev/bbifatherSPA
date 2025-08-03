import axios from 'axios';
import { Order, Subject, CreateOrderRequest, OrderListResponse, Student } from './types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

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
export const getOrders = async (page: number = 1, limit: number = 10): Promise<OrderListResponse> => {
  const response = await api.get(`/api/orders?page=${page}&limit=${limit}`);
  return response.data;
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

// Students API
export const getStudents = async (): Promise<Student[]> => {
  const response = await api.get('/api/students');
  return response.data;
};

export default api;