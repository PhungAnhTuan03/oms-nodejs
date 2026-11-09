import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 50, // 50 người dùng ảo cùng lúc
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'], // dưới 1% request lỗi
    http_req_duration: ['p(95)<300'], // 95% request dưới 300ms
  },
};

const BASE = __ENV.BASE_URL || 'http://localhost:8080';
const headers = { Authorization: `Bearer ${__ENV.TOKEN}` };

export default function () {
  const id = 1 + Math.floor(Math.random() * 5); // đọc ngẫu nhiên sản phẩm 1–5
  const res = http.get(`${BASE}/api/products/${id}`, { headers });
  check(res, { 'status 200': (r) => r.status === 200 });
}
