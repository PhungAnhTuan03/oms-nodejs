import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import { Redis } from 'ioredis';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { REDIS } from '../src/redis/redis.module.js';
import { configureApp } from '../src/setup-app.js';
import { WorkerModule } from '../src/worker.module.js';

export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule, WorkerModule] }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  configureApp(app);
  await app.init();
  return app;
}

// Xoá sạch dữ liệu, đánh số id lại từ 1, xoá cache Redis
export async function resetDb(app: INestApplication) {
  const prisma = app.get(PrismaService);
  await prisma.$executeRawUnsafe(`
    TRUNCATE "OrderItem", "Order", "StockMovement", "Inventory", "Variant",
             "Product", "User", "WebhookEvent", "VariantPair"
    RESTART IDENTITY CASCADE`);
  await app.get<Redis>(REDIS).flushdb();
}

// Dữ liệu tối thiểu: 2 tài khoản, 1 sản phẩm có 2 biến thể (SKU T-S còn 10, T-M còn 5)
export async function seedBasic(app: INestApplication) {
  const prisma = app.get(PrismaService);
  await prisma.user.create({
    data: { email: 'admin@test.local', passwordHash: await bcrypt.hash('Admin@123', 4), role: 'ADMIN' },
  });
  await prisma.user.create({
    data: { email: 'staff@test.local', passwordHash: await bcrypt.hash('Staff@123', 4), role: 'STAFF' },
  });
  const product = await prisma.product.create({
    data: {
      name: 'Áo test',
      variants: {
        create: [
          { sku: 'T-S', price: 100000, inventory: { create: { available: 10 } } },
          { sku: 'T-M', price: 100000, inventory: { create: { available: 5 } } },
        ],
      },
    },
    include: { variants: true },
  });
  return { productId: product.id, variantS: product.variants[0].id, variantM: product.variants[1].id };
}

export async function login(app: INestApplication, email: string, password: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password });
  return res.body.accessToken as string;
}

export async function stockOf(app: INestApplication, variantId: number) {
  const inv = await app.get(PrismaService).inventory.findUniqueOrThrow({ where: { variantId } });
  return inv.available;
}

// Chờ đến khi điều kiện đúng (dùng cho việc xử lý bất đồng bộ trong hàng đợi)
export async function waitFor(check: () => Promise<boolean>, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Hết thời gian chờ');
}
