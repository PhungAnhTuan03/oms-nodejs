import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service.js';
import { invalidateProductsOfVariants } from '../redis/product-cache.js';
import { REDIS } from '../redis/redis.module.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { ListOrdersQuery } from './dto/list-orders.query.js';
import type { ShopifyOrderPayload } from '../webhooks/shopify.types.js';

// maxWait: chờ tối đa 10 giây để lấy kết nối; timeout: transaction chạy tối đa 10 giây
const TX_OPTIONS = { maxWait: 10_000, timeout: 10_000 };
const WITH_ITEMS = { items: { include: { variant: { include: { product: true } } } } } as const;

type Line = { variantId: number; quantity: number; unitPrice: number };

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  async create(dto: CreateOrderDto) {
    // 1. Gộp các dòng trùng variant (ví dụ gửi variant 1 hai lần) thành một dòng
    const merged = new Map<number, number>();
    for (const it of dto.items) {
      merged.set(it.variantId, (merged.get(it.variantId) ?? 0) + it.quantity);
    }
    // 2. Sắp xếp theo variantId để mọi transaction khoá dòng theo cùng thứ tự => tránh deadlock
    const items = [...merged.entries()]
      .map(([variantId, quantity]) => ({ variantId, quantity }))
      .sort((a, b) => a.variantId - b.variantId);

    const order = await this.prisma.$transaction(async (tx) => {
      let total = 0;
      const lines: Line[] = [];

      for (const it of items) {
        // 3. Kiểm tra và trừ kho trong MỘT câu lệnh
        const affected = await tx.$executeRaw`
          UPDATE "Inventory"
          SET available = available - ${it.quantity}, "updatedAt" = now()
          WHERE "variantId" = ${it.variantId} AND available >= ${it.quantity}`;

        if (affected === 0) {
          // throw => toàn bộ transaction rollback, kể cả các dòng đã trừ trước đó
          throw new ConflictException(`Biến thể ${it.variantId} không đủ hàng hoặc không tồn tại`);
        }

        const variant = await tx.variant.findUniqueOrThrow({ where: { id: it.variantId } });
        total += variant.price * it.quantity;
        lines.push({ variantId: it.variantId, quantity: it.quantity, unitPrice: variant.price });
      }

      // 4. Tạo đơn (bán tại quầy nên trạng thái là PAID)
      const order = await tx.order.create({
        data: { total, status: 'PAID', items: { create: lines } },
        include: WITH_ITEMS,
      });

      // 5. Ghi nhật ký xuất kho
      await tx.stockMovement.createMany({
        data: lines.map((l) => ({
          variantId: l.variantId,
          type: 'OUT' as const,
          quantity: l.quantity,
          reason: 'order',
          orderId: order.id,
        })),
      });

      return order;
    }, TX_OPTIONS);

    await invalidateProductsOfVariants(this.redis, this.prisma, items.map((i) => i.variantId));
    return order;
  }

  async cancel(id: number) {
    const order = await this.prisma.$transaction(async (tx) => {
      // SELECT ... FOR UPDATE: khoá dòng đơn hàng, để 2 người cùng bấm "Huỷ"
      // thì người thứ hai phải chờ và thấy trạng thái đã là CANCELLED => không cộng kho 2 lần
      const rows = await tx.$queryRaw<{ status: string }[]>`
        SELECT status FROM "Order" WHERE id = ${id} FOR UPDATE`;
      if (rows.length === 0) throw new NotFoundException(`Không tìm thấy đơn ${id}`);
      if (!['PENDING', 'PAID'].includes(rows[0].status)) {
        throw new ConflictException(`Không thể huỷ đơn đang ở trạng thái ${rows[0].status}`);
      }

      const items = await tx.orderItem.findMany({ where: { orderId: id } });
      for (const it of items) {
        await tx.$executeRaw`
          UPDATE "Inventory"
          SET available = available + ${it.quantity}, "updatedAt" = now()
          WHERE "variantId" = ${it.variantId}`;
      }
      await tx.stockMovement.createMany({
        data: items.map((it) => ({
          variantId: it.variantId,
          type: 'IN' as const,
          quantity: it.quantity,
          reason: 'order_cancelled',
          orderId: id,
        })),
      });

      return tx.order.update({ where: { id }, data: { status: 'CANCELLED' }, include: WITH_ITEMS });
    }, TX_OPTIONS);

    await invalidateProductsOfVariants(this.redis, this.prisma, order.items.map((i) => i.variantId));
    return order;
  }

  async ship(id: number) {
    const order = await this.findOne(id);
    if (order.status !== 'PAID') {
      throw new ConflictException('Chỉ giao được đơn đã thanh toán (PAID)');
    }
    return this.prisma.order.update({ where: { id }, data: { status: 'SHIPPED' }, include: WITH_ITEMS });
  }

  async list({ cursor, limit, status }: ListOrdersQuery) {
    const items = await this.prisma.order.findMany({
      where: status ? { status } : undefined,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'desc' },
      include: WITH_ITEMS,
    });
    const hasNext = items.length > limit;
    if (hasNext) items.pop();
    return { items, nextCursor: hasNext ? items[items.length - 1].id : null };
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: WITH_ITEMS });
    if (!order) throw new NotFoundException(`Không tìm thấy đơn ${id}`);
    return order;
  }
  async createFromShopify(payload: ShopifyOrderPayload) {
    const shopifyOrderId = String(payload.id);

    // Lớp idempotent thứ hai: đơn đã có thì thôi
    const existing = await this.prisma.order.findUnique({ where: { shopifyOrderId } });
    if (existing) return existing;

    // Ghép SKU của Shopify với biến thể trong OMS
    const skus = payload.line_items.map((li) => li.sku).filter((s): s is string => !!s);
    const variants = await this.prisma.variant.findMany({ where: { sku: { in: skus } } });
    const bySku = new Map(variants.map((v) => [v.sku, v]));

    const merged = new Map<number, Line>();
    for (const li of payload.line_items) {
      const v = li.sku ? bySku.get(li.sku) : undefined;
      if (!v) {
        this.logger.warn(`Đơn Shopify ${shopifyOrderId}: SKU "${li.sku}" không có trong OMS, bỏ qua`);
        continue;
      }
      const old = merged.get(v.id);
      merged.set(v.id, {
        variantId: v.id,
        quantity: (old?.quantity ?? 0) + li.quantity,
        unitPrice: Math.round(Number(li.price)),
      });
    }
    const lines = [...merged.values()].sort((a, b) => a.variantId - b.variantId);
    if (lines.length === 0) return null;

    const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);

    const order = await this.prisma.$transaction(async (tx) => {
      for (const l of lines) {
        const affected = await tx.$executeRaw`
          UPDATE "Inventory" SET available = available - ${l.quantity}, "updatedAt" = now()
          WHERE "variantId" = ${l.variantId} AND available >= ${l.quantity}`;
        if (affected === 0) {
          // Shopify đã bán xong nên không thể từ chối đơn.
          // OMS thiếu hàng nghĩa là kho hai bên lệch: đưa về 0 và ghi lại để kiểm tra.
          await tx.$executeRaw`
            UPDATE "Inventory" SET available = 0, "updatedAt" = now() WHERE "variantId" = ${l.variantId}`;
          await tx.stockMovement.create({
            data: {
              variantId: l.variantId,
              type: 'ADJUST',
              quantity: 0,
              reason: `lech_kho: thieu hang khi dong bo don Shopify ${shopifyOrderId}`,
            },
          });
          this.logger.warn(`Lệch kho: biến thể ${l.variantId} không đủ hàng cho đơn Shopify ${shopifyOrderId}`);
        }
      }

      const order = await tx.order.create({
        data: { shopifyOrderId, total, status: 'PAID', items: { create: lines } },
      });
      await tx.stockMovement.createMany({
        data: lines.map((l) => ({
          variantId: l.variantId,
          type: 'OUT' as const,
          quantity: l.quantity,
          reason: 'shopify_order',
          orderId: order.id,
        })),
      });
      return order;
    }, TX_OPTIONS);

    await invalidateProductsOfVariants(this.redis, this.prisma, lines.map((l) => l.variantId));
    return order;
  }

  async cancelFromShopify(payload: ShopifyOrderPayload) {
    const order = await this.prisma.order.findUnique({ where: { shopifyOrderId: String(payload.id) } });
    if (!order || order.status === 'CANCELLED') return null;
    return this.cancel(order.id);
  }
}
