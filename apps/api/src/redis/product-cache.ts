import { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service.js';

export const productKey = (id: number) => `product:${id}`;

// Xoá cache của các sản phẩm chứa những biến thể vừa thay đổi tồn kho
export async function invalidateProductsOfVariants(
  redis: Redis,
  prisma: PrismaService,
  variantIds: number[],
) {
  if (variantIds.length === 0) return;
  const variants = await prisma.variant.findMany({
    where: { id: { in: variantIds } },
    select: { productId: true },
  });
  const keys = [...new Set(variants.map((v) => productKey(v.productId)))];
  if (keys.length) await redis.del(...keys);
}
