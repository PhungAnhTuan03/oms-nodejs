import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto.js';

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
}
