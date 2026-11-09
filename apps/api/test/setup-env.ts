import { config } from 'dotenv';

// Trên máy: đọc .env.test. Trên CI: không có file này, biến môi trường do CI cung cấp.
config({ path: '.env.test', override: true });
