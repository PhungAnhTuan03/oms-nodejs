import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

// Tự gắn token vào mọi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Token hết hạn (401) thì quay về trang đăng nhập
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

// Lấy thông báo lỗi tiếng Việt từ backend để hiện cho người dùng
export function errorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const msg = e.response?.data?.message;
    return Array.isArray(msg) ? msg.join(', ') : (msg ?? e.message);
  }
  return 'Có lỗi xảy ra';
}

export const formatVnd = (n: number) => `${n.toLocaleString('vi-VN')} ₫`;
