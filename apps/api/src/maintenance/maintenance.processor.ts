import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InventoryService } from '../inventory/inventory.service.js';
import { TelegramService } from '../notify/telegram.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MAINTENANCE_QUEUE } from '../queue/queues.js';

@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly telegram: TelegramService,
  ) {
    super();
  }

  async process(job: Job) {
    if (job.name === 'cooccurrence') return this.rebuildPairs();
    if (job.name === 'reorder-alerts') return this.sendReorderAlerts();
    this.logger.warn(`Không biết job ${job.name}`);
    return null;
  }

  // Đếm số đơn có cả 2 biến thể A và B (self-join bảng OrderItem)
  private async rebuildPairs() {
    const [, inserted] = await this.prisma.$transaction([
      this.prisma.$executeRaw`DELETE FROM "VariantPair"`,
      this.prisma.$executeRaw`
        INSERT INTO "VariantPair" ("variantA", "variantB", "count")
        SELECT a."variantId", b."variantId", COUNT(*)
        FROM "OrderItem" a
        JOIN "OrderItem" b ON a."orderId" = b."orderId" AND a."variantId" < b."variantId"
        JOIN "Order" o     ON o.id = a."orderId" AND o.status <> 'CANCELLED'
        GROUP BY a."variantId", b."variantId"
        HAVING COUNT(*) >= 2`,
    ]);
    this.logger.log(`Đã tính lại ${inserted} cặp sản phẩm hay mua kèm`);
    return { pairs: inserted };
  }

  private async sendReorderAlerts() {
    const alerts = await this.inventory.getReorderAlerts();
    if (alerts.length === 0) return { alerts: 0 };
    const lines = alerts.map(
      (a) => `- ${a.name} (${a.sku}): còn ${a.available}, nên nhập khi còn ≤ ${a.reorderPoint}`,
    );
    await this.telegram.send(`⚠️ Sắp hết hàng (${alerts.length} biến thể):\n${lines.join('\n')}`);
    return { alerts: alerts.length };
  }
}
