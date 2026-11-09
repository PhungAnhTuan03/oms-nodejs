import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module.js';
import { ShopifyHmacGuard } from './shopify-hmac.guard.js';
import { ShopifyOrdersProcessor } from './shopify-orders.processor.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  imports: [OrdersModule],
  controllers: [WebhooksController],
  providers: [ShopifyHmacGuard, ShopifyOrdersProcessor],
})
export class WebhooksModule {}
