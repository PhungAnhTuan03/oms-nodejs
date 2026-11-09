import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service.js';
import { productKey } from '../redis/product-cache.js';
import { REDIS } from '../redis/redis.module.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsQuery } from './dto/list-products.query.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

const WITH_VARIANTS = { variants: { include: { inventory: true } } } as const;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async create(dto: CreateProductDto) {
    try {
      return await this.prisma.product.create({
        data: {
          name: dto.name,
          variants: {
            create: dto.variants.map((v) => ({
              sku: v.sku,
              price: v.price,
              inventory: { create: { available: v.initialStock } },
            })),
          },
        },
        include: WITH_VARIANTS,
      });
    } catch (e) {
      // P2002 = vi phạm ràng buộc unique, ở đây là SKU bị trùng
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('SKU đã tồn tại');
      }
      throw e;
    }
  }

  // Phân trang cursor: lấy dư 1 bản ghi để biết còn trang sau hay không
  async list(query: ListProductsQuery) {
    if (query.q?.trim()) {
      const q = query.q.trim();
      const ranked = await this.prisma.$queryRaw<{ id: number }[]>`
        SELECT id
        FROM "Product"
        WHERE search @@ plainto_tsquery('simple', immutable_unaccent(${q}::text))
        ORDER BY ts_rank(search, plainto_tsquery('simple', immutable_unaccent(${q}::text))) DESC
        LIMIT ${query.limit}::int`;
      const found = await this.prisma.product.findMany({
        where: { id: { in: ranked.map((r) => r.id) } },
        include: WITH_VARIANTS,
      });
      // Giữ đúng thứ tự xếp hạng
      const items = ranked.map((r) => found.find((p) => p.id === r.id)!).filter(Boolean);
      return { items, nextCursor: null };
    }

    const { cursor, limit } = query;
    const items = await this.prisma.product.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'desc' },
      include: WITH_VARIANTS,
    });
    const hasNext = items.length > limit;
    if (hasNext) items.pop();
    return { items, nextCursor: hasNext ? items[items.length - 1].id : null };
  }

  async findOne(id: number) {
    const ttl = Number(process.env.PRODUCT_CACHE_TTL ?? 60); // 0 = tắt cache
    if (ttl > 0) {
      const cached = await this.redis.get(productKey(id));
      if (cached) return JSON.parse(cached);
    }
    const product = await this.prisma.product.findUnique({ where: { id }, include: WITH_VARIANTS });
    if (!product) throw new NotFoundException(`Không tìm thấy sản phẩm ${id}`);
    if (ttl > 0) await this.redis.set(productKey(id), JSON.stringify(product), 'EX', ttl);
    return product;
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOne(id);
    const product = await this.prisma.product.update({ where: { id }, data: dto, include: WITH_VARIANTS });
    await this.redis.del(productKey(id));
    return product;
  }

  async updatePrice(variantId: number, price: number) {
    const variant = await this.prisma.variant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException(`Không tìm thấy biến thể ${variantId}`);
    const updated = await this.prisma.variant.update({ where: { id: variantId }, data: { price } });
    await this.redis.del(productKey(variant.productId));
    return updated;
  }

  async remove(id: number) {
    await this.findOne(id);
    const used = await this.prisma.orderItem.count({ where: { variant: { productId: id } } });
    if (used > 0) {
      throw new ConflictException('Sản phẩm đã có trong đơn hàng, không thể xoá');
    }
    // Xoá theo thứ tự con trước, cha sau, trong một transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.inventory.deleteMany({ where: { variant: { productId: id } } });
      await tx.variant.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
    });
    await this.redis.del(productKey(id));
    return { deleted: true };
  }
  // 5 biến thể hay được mua cùng variantId nhất
  async boughtTogether(variantId: number) {
    const pairs = await this.prisma.$queryRaw<{ variantId: number; count: number }[]>`
      SELECT CASE WHEN "variantA" = ${variantId} THEN "variantB" ELSE "variantA" END AS "variantId",
             count
      FROM "VariantPair"
      WHERE "variantA" = ${variantId} OR "variantB" = ${variantId}
      ORDER BY count DESC
      LIMIT 5`;
    const variants = await this.prisma.variant.findMany({
      where: { id: { in: pairs.map((p) => p.variantId) } },
      include: { product: true },
    });
    return pairs.map((p) => ({ ...p, variant: variants.find((v) => v.id === p.variantId) }));
  }
}
