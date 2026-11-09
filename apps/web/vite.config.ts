import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Mọi request bắt đầu bằng /api được chuyển sang NestJS ở cổng 3000.
    // Nhờ vậy frontend và backend coi như cùng một địa chỉ, không cần cấu hình CORS.
    proxy: { '/api': 'http://localhost:3000' },
  },
});
