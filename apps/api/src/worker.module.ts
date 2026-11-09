import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InventoryModule } from './inventory/inventory.module.js';
import { MaintenanceProcessor } from './maintenance/maintenance.processor.js';
import { MaintenanceScheduler } from './maintenance/maintenance.scheduler.js';
import { TelegramService } from './notify/telegram.service.js';
import { OrdersModule } from './orders/orders.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { QueueModule } from './queue/queue.module.js';
import { RedisModule } from './redis/redis.module.js';
import { ShopifyOrdersProcessor } from './webhooks/shopify-orders.processor.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    QueueModule,
    OrdersModule,
    InventoryModule,
  ],
  providers: [ShopifyOrdersProcessor, MaintenanceProcessor, MaintenanceScheduler, TelegramService],
})
export class WorkerModule {}
