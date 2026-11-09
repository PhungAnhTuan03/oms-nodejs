import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const BASES = [
  'Áo bra thể thao', 'Quần legging cạp cao', 'Quần short chạy bộ', 'Áo croptop tập gym',
  'Set đồ yoga', 'Áo khoác gió', 'Quần jogger', 'Áo tank top', 'Bikini hai mảnh', 'Áo lót không gọng',
];
const COLORS = ['đen', 'hồng'];
const SIZES = ['S', 'M', 'L'];

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@oms.local' },
    update: {},
    create: { email: 'admin@oms.local', passwordHash: await bcrypt.hash('Admin@123', 10), role: 'ADMIN' },
  });
  await prisma.user.upsert({
    where: { email: 'staff@oms.local' },
    update: {},
    create: { email: 'staff@oms.local', passwordHash: await bcrypt.hash('Staff@123', 10), role: 'STAFF' },
  });

  if ((await prisma.product.count()) > 0) {
    console.log('Đã có sản phẩm, bỏ qua phần tạo sản phẩm.');
    return;
  }

  let n = 0;
  for (const base of BASES) {
    for (const color of COLORS) {
      n++;
      const price = 199000 + (n % 6) * 50000;
      await prisma.product.create({
        data: {
          name: `${base} ${color}`,
          variants: {
            create: SIZES.map((size) => ({
              sku: `SWA-${String(n).padStart(3, '0')}-${size}`,
              price,
              inventory: { create: { available: Math.floor(Math.random() * 50) } },
            })),
          },
        },
      });
    }
  }
  console.log(`Đã tạo ${n} sản phẩm, mỗi sản phẩm 3 size.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
