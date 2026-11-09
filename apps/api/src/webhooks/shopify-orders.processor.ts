import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrdersService } from '../orders/orders.service.js';
import { SHOPIFY_QUEUE } from '../queue/queues.js';
import type { ShopifyOrderPayload } from './shopify.types.js';

@Processor(SHOPIFY_QUEUE)
export class ShopifyOrdersProcessor extends WorkerHost {
  private readonly logger = new Logger(ShopifyOrdersProcessor.name);

  constructor(private readonly orders: OrdersService) {
    super();
  }

  async process(job: Job<ShopifyOrderPayload>) {
    this.logger.log(`Xử lý ${job.name} cho đơn Shopify ${job.data.id} (lần thử ${job.attemptsMade + 1})`);
    switch (job.name) {
      case 'orders/create':
        return this.orders.createFromShopify(job.data);
      case 'orders/cancelled':
        return this.orders.cancelFromShopify(job.data);
      default:
        this.logger.warn(`Bỏ qua topic ${job.name}`);
        return null;
    }
  }
}
