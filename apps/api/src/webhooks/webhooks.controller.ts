import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Body, Controller, Headers, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service.js';
import { SHOPIFY_QUEUE } from '../queue/queues.js';
import { ShopifyHmacGuard } from './shopify-hmac.guard.js';

@ApiExcludeController() // không hiện trên Swagger
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SHOPIFY_QUEUE) private readonly queue: Queue,
  ) {}

  @Post('shopify')
  @HttpCode(200)
  @UseGuards(ShopifyHmacGuard)
  async shopify(
    @Headers('x-shopify-webhook-id') webhookId: string,
    @Headers('x-shopify-topic') topic: string,
    @Body() payload: unknown,
  ) {
    if (!webhookId || !topic) throw new BadRequestException('Thiếu header Shopify');

    // Idempotent: ID sự kiện là khoá chính, ghi lần 2 sẽ lỗi P2002 => bỏ qua
    try {
      await this.prisma.webhookEvent.create({ data: { id: webhookId, topic } });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') return { duplicate: true };
      throw e;
    }

    // Đẩy vào hàng đợi rồi trả 200 ngay (Shopify chỉ chờ vài giây)
    await this.queue.add(topic, payload, {
      jobId: webhookId,
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 }, // thử lại sau 5s, 10s, 20s...
      removeOnComplete: 1000,
      removeOnFail: 5000,
    });
    return { received: true };
  }
}
