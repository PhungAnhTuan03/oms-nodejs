import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, login, resetDb, seedBasic, stockOf } from './utils.js';

describe('Tồn kho (e2e)', () => {
  let app: INestApplication;
  let admin: string;
  let staff: string;
  let ids: Awaited<ReturnType<typeof seedBasic>>;

  const adjust = (token: string, variantId: number, delta: number) =>
    request(app.getHttpServer())
      .post(`/api/inventory/${variantId}/adjust`)
      .set('Authorization', `Bearer ${token}`)
      .send({ delta, reason: 'kiểm kê' });

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

  it('STAFF chỉnh kho => 403; ADMIN nhập thêm => tồn kho tăng và có nhật ký IN', async () => {
    expect((await adjust(staff, ids.variantS, 20)).status).toBe(403);

    const res = await adjust(admin, ids.variantS, 20);
    expect(res.status).toBe(201);
    expect(await stockOf(app, ids.variantS)).toBe(30);

    const movements = await request(app.getHttpServer())
      .get(`/api/inventory/${ids.variantS}/movements`)
      .set('Authorization', `Bearer ${staff}`);
    expect(movements.body[0]).toMatchObject({ type: 'IN', quantity: 20 });
  });

  it('giảm quá số đang có => 409, tồn kho giữ nguyên', async () => {
    expect((await adjust(admin, ids.variantM, -6)).status).toBe(409);
    expect(await stockOf(app, ids.variantM)).toBe(5);
    expect((await adjust(admin, ids.variantM, -5)).status).toBe(201);
    expect(await stockOf(app, ids.variantM)).toBe(0);
  });

  it('dữ liệu chi tiết sản phẩm không bị cache cũ sau khi chỉnh kho', async () => {
    const get = () =>
      request(app.getHttpServer()).get(`/api/products/${ids.productId}`).set('Authorization', `Bearer ${staff}`);
    const stockS = (body: { variants: { id: number; inventory: { available: number } }[] }) =>
      body.variants.find((v) => v.id === ids.variantS)!.inventory.available;

    expect(stockS((await get()).body)).toBe(10); // lần đầu: lưu vào cache
    await adjust(admin, ids.variantS, 5);
    expect(stockS((await get()).body)).toBe(15); // cache đã bị xoá
  });

  it('cảnh báo nhập hàng: biến thể bán chạy mà còn ít hàng thì xuất hiện', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${staff}`)
      .send({ items: [{ variantId: ids.variantM, quantity: 4 }] });

    const res = await request(app.getHttpServer())
      .get('/api/inventory/alerts')
      .set('Authorization', `Bearer ${staff}`);
    expect(res.status).toBe(200);
    // bán 4 cái/30 ngày => điểm đặt lại = ceil(4/30 × 10) = 2; còn 1 => cảnh báo
    expect(res.body).toEqual([
      expect.objectContaining({ variantId: ids.variantM, available: 1, reorderPoint: 2 }),
    ]);
  });
});
