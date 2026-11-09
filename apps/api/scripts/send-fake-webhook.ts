import 'dotenv/config';
import { createHmac, randomUUID } from 'node:crypto';

const URL_ = 'http://localhost:3000/api/webhooks/shopify';
const secret = process.env.SHOPIFY_WEBHOOK_SECRET ?? '';
const body = JSON.stringify({
  id: Date.now(),
  line_items: [{ sku: 'SWA-001-M', quantity: 1, price: '199000.00' }],
});
const hmac = createHmac('sha256', secret).update(body).digest('base64');
const webhookId = randomUUID();

const send = (signature: string) =>
  fetch(URL_, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Topic': 'orders/create',
      'X-Shopify-Hmac-Sha256': signature,
      'X-Shopify-Webhook-Id': webhookId,
    },
    body,
  }).then(async (r) => `${r.status} ${await r.text()}`);

console.log('Lần 1 (chữ ký đúng):', await send(hmac));
console.log('Lần 2 (gửi lại y hệt):', await send(hmac));
console.log('Lần 3 (chữ ký sai):', await send('sai-chu-ky'));
