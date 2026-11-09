import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { InventoryModule } from './inventory/inventory.module.js';
import { MaintenanceModule } from './maintenance/maintenance.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProductsModule } from './products/products.module.js';
import { QueueModule } from './queue/queue.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    QueueModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    InventoryModule,
    WebhooksModule,
    MaintenanceModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
