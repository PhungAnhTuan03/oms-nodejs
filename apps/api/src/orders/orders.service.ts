import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { ListOrdersQuery } from './dto/list-orders.query.js';

// maxWait: chờ tối đa 10 giây để lấy kết nối; timeout: transaction chạy tối đa 10 giây
const TX_OPTIONS = { maxWait: 10_000, timeout: 10_000 };
const WITH_ITEMS = { items: { include: { variant: { include: { product: true } } } } } as const;

type Line = { variantId: number; quantity: number; unitPrice: number };

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.$transaction(async (tx) => {
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
  }

  async cancel(id: number) {
    return this.prisma.$transaction(async (tx) => {
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
}
