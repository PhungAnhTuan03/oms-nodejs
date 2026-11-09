import { Module } from '@nestjs/common';
import { ShopifyHmacGuard } from './shopify-hmac.guard.js';
import { WebhooksController } from './webhooks.controller.js';

@Module({
  controllers: [WebhooksController],
  providers: [ShopifyHmacGuard],
})
export class WebhooksModule {}
