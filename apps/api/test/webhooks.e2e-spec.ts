import { INestApplication } from '@nestjs/common';
import { createHmac, randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDb, seedBasic, stockOf, waitFor } from './utils.js';

describe('Webhook Shopify (e2e)', () => {
  let app: INestApplication;
  let ids: Awaited<ReturnType<typeof seedBasic>>;

  const send = (body: string, webhookId: string, signature?: string, topic = 'orders/create') =>
    request(app.getHttpServer())
      .post('/api/webhooks/shopify')
      .set('Content-Type', 'application/json')
      .set('X-Shopify-Topic', topic)
      .set('X-Shopify-Webhook-Id', webhookId)
      .set(
        'X-Shopify-Hmac-Sha256',
        signature ?? createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET!).update(body).digest('base64'),
      )
      .send(body);

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(app);
    ids = await seedBasic(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('webhook hợp lệ => tạo đơn và trừ kho', async () => {
    const body = JSON.stringify({ id: 9001, line_items: [{ sku: 'T-S', quantity: 2, price: '100000.00' }] });
    const res = await send(body, randomUUID());
    expect(res.status).toBe(200);

    const prisma = app.get(PrismaService);
    await waitFor(async () => !!(await prisma.order.findUnique({ where: { shopifyOrderId: '9001' } })));
    expect(await stockOf(app, ids.variantS)).toBe(8);
  });

  it('gửi lại cùng webhook ID => chỉ 1 đơn', async () => {
    const body = JSON.stringify({ id: 9002, line_items: [{ sku: 'T-S', quantity: 1, price: '100000.00' }] });
    const id = randomUUID();
    expect((await send(body, id)).body).toEqual({ received: true });
    expect((await send(body, id)).body).toEqual({ duplicate: true });

    const prisma = app.get(PrismaService);
    await waitFor(async () => (await prisma.order.count()) === 1);
    await new Promise((r) => setTimeout(r, 500)); // chờ thêm để chắc không có đơn thứ hai
    expect(await prisma.order.count()).toBe(1);
  });

  it('chữ ký sai => 401 và không ghi gì', async () => {
    const body = JSON.stringify({ id: 9003, line_items: [] });
    const res = await send(body, randomUUID(), 'chu-ky-sai');
    expect(res.status).toBe(401);
    expect(await app.get(PrismaService).webhookEvent.count()).toBe(0);
  });

  it('orders/cancelled => đơn chuyển CANCELLED và kho được cộng lại', async () => {
    const body = JSON.stringify({ id: 9004, line_items: [{ sku: 'T-M', quantity: 2, price: '100000.00' }] });
    await send(body, randomUUID());
    const prisma = app.get(PrismaService);
    await waitFor(async () => (await stockOf(app, ids.variantM)) === 3);

    await send(body, randomUUID(), undefined, 'orders/cancelled');
    await waitFor(async () => (await prisma.order.findUnique({ where: { shopifyOrderId: '9004' } }))?.status === 'CANCELLED');
    expect(await stockOf(app, ids.variantM)).toBe(5);
  });

  it('SKU không có trong OMS => không tạo đơn', async () => {
    const body = JSON.stringify({ id: 9005, line_items: [{ sku: 'KHONG-CO', quantity: 1, price: '1.00' }] });
    expect((await send(body, randomUUID())).status).toBe(200);
    await new Promise((r) => setTimeout(r, 500));
    expect(await app.get(PrismaService).order.count()).toBe(0);
  });

  it('Shopify bán nhiều hơn tồn kho OMS => vẫn tạo đơn, kho về 0 và ghi lệch kho', async () => {
    const body = JSON.stringify({ id: 9006, line_items: [{ sku: 'T-M', quantity: 7, price: '100000.00' }] });
    await send(body, randomUUID());
    const prisma = app.get(PrismaService);
    await waitFor(async () => !!(await prisma.order.findUnique({ where: { shopifyOrderId: '9006' } })));
    expect(await stockOf(app, ids.variantM)).toBe(0);
    const adjust = await prisma.stockMovement.findFirst({ where: { variantId: ids.variantM, type: 'ADJUST' } });
    expect(adjust?.reason).toContain('lech_kho');
  });

  it('topic lạ => nhận 200 nhưng không tạo đơn', async () => {
    const body = JSON.stringify({ id: 9007, line_items: [{ sku: 'T-S', quantity: 1, price: '1.00' }] });
    expect((await send(body, randomUUID(), undefined, 'products/update')).status).toBe(200);
    await new Promise((r) => setTimeout(r, 500));
    expect(await app.get(PrismaService).order.count()).toBe(0);
  });

  it('thiếu header webhook ID => 400', async () => {
    const body = JSON.stringify({ id: 9008, line_items: [] });
    const res = await request(app.getHttpServer())
      .post('/api/webhooks/shopify')
      .set('Content-Type', 'application/json')
      .set('X-Shopify-Topic', 'orders/create')
      .set('X-Shopify-Hmac-Sha256', createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET!).update(body).digest('base64'))
      .send(body);
    expect(res.status).toBe(400);
  });
});
