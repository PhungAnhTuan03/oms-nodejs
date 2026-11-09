import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, login, resetDb, seedBasic, stockOf } from './utils.js';

describe('Đơn hàng và tồn kho (e2e)', () => {
  let app: INestApplication;
  let admin: string;
  let staff: string;
  let ids: Awaited<ReturnType<typeof seedBasic>>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(app);
    ids = await seedBasic(app);
    admin = await login(app, 'admin@test.local', 'Admin@123');
    staff = await login(app, 'staff@test.local', 'Staff@123');
  });

  afterAll(async () => {
    await app.close();
  });

  it('100 đơn đồng thời cho sản phẩm còn 1 chiếc => đúng 1 đơn thành công', async () => {
    await app.get(PrismaService).inventory.update({
      where: { variantId: ids.variantS },
      data: { available: 1 },
    });

    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        request(app.getHttpServer())
          .post('/api/orders')
          .set('Authorization', `Bearer ${staff}`)
          .send({ items: [{ variantId: ids.variantS, quantity: 1 }] }),
      ),
    );

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(99);
    expect(await stockOf(app, ids.variantS)).toBe(0);
  });

  it('một dòng thiếu hàng => cả đơn bị huỷ, dòng kia không bị trừ (rollback)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${staff}`)
      .send({ items: [{ variantId: ids.variantS, quantity: 2 }, { variantId: ids.variantM, quantity: 99 }] });

    expect(res.status).toBe(409);
    expect(await stockOf(app, ids.variantS)).toBe(10);
    expect(await stockOf(app, ids.variantM)).toBe(5);
  });

  it('huỷ đơn cộng lại kho; huỷ lần hai => 409', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${staff}`)
      .send({ items: [{ variantId: ids.variantS, quantity: 3 }] });
    expect(await stockOf(app, ids.variantS)).toBe(7);

    const cancel = () =>
      request(app.getHttpServer())
        .patch(`/api/orders/${created.body.id}/cancel`)
        .set('Authorization', `Bearer ${staff}`);

    expect((await cancel()).status).toBe(200);
    expect(await stockOf(app, ids.variantS)).toBe(10);
    expect((await cancel()).status).toBe(409);
  });

  it('STAFF xoá sản phẩm => 403, ADMIN => 200', async () => {
    const del = (token: string) =>
      request(app.getHttpServer()).delete(`/api/products/${ids.productId}`).set('Authorization', `Bearer ${token}`);
    expect((await del(staff)).status).toBe(403);
    expect((await del(admin)).status).toBe(200);
  });

  it('không có token => 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/products');
    expect(res.status).toBe(401);
  });

  it('dữ liệu sai kiểu => 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${staff}`)
      .send({ items: [{ variantId: 'abc', quantity: 1 }] });
    expect(res.status).toBe(400);
  });
});
