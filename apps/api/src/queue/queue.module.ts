import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAINTENANCE_QUEUE, SHOPIFY_QUEUE } from './queues.js';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = new URL(config.getOrThrow<string>('REDIS_URL'));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            db: Number(url.pathname.slice(1) || 0), // redis://host:6379/1 => database số 1
          },
        };
      },
    }),
    BullModule.registerQueue({ name: SHOPIFY_QUEUE }, { name: MAINTENANCE_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
