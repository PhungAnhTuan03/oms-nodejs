import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto.js';
import { reorderPoint } from './reorder.js';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async adjust(variantId: number, dto: AdjustInventoryDto) {
    return this.prisma.$transaction(async (tx) => {
      const affected = await tx.$executeRaw`
        UPDATE "Inventory"
        SET available = available + ${dto.delta}, "updatedAt" = now()
        WHERE "variantId" = ${variantId} AND available + ${dto.delta} >= 0`;
      if (affected === 0) {
        throw new ConflictException('Biến thể không tồn tại hoặc tồn kho sẽ bị âm');
      }
      await tx.stockMovement.create({
        data: {
          variantId,
          type: dto.delta > 0 ? 'IN' : 'ADJUST',
          quantity: dto.delta, // ADJUST mang số âm = giảm
          reason: dto.reason,
        },
      });
      return tx.inventory.findUniqueOrThrow({ where: { variantId } });
    });
  }

  movements(variantId: number) {
    return this.prisma.stockMovement.findMany({
      where: { variantId },
      orderBy: { id: 'desc' },
      take: 50,
    });
  }
  async getReorderAlerts() {
    const rows = await this.prisma.$queryRaw<
      { variantId: number; sku: string; name: string; available: number; avgDaily: number }[]
    >`
      SELECT v.id AS "variantId", v.sku, p.name, i.available,
             (COALESCE(s.sold, 0) / 30.0)::float8 AS "avgDaily"
      FROM "Variant" v
      JOIN "Product" p   ON p.id = v."productId"
      JOIN "Inventory" i ON i."variantId" = v.id
      LEFT JOIN (
        SELECT "variantId", SUM(quantity) AS sold
        FROM "StockMovement"
        WHERE type = 'OUT' AND "createdAt" >= now() - interval '30 days'
        GROUP BY "variantId"
      ) s ON s."variantId" = v.id
      WHERE COALESCE(s.sold, 0) > 0`;

    return rows
      .map((r) => ({ ...r, reorderPoint: reorderPoint(r.avgDaily) }))
      .filter((r) => r.available <= r.reorderPoint)
      .sort((a, b) => a.available - b.available);
  }
}
