import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 50,
  duration: '30s',
  thresholds: { http_req_failed: ['rate<0.01'] },
};

const BASE = __ENV.BASE_URL || 'http://localhost:8080';
const headers = { Authorization: `Bearer ${__ENV.TOKEN}` };

export default function () {
  const res = http.get(`${BASE}/api/products?limit=20`, { headers });
  check(res, { 'status 200': (r) => r.status === 200 });
}
