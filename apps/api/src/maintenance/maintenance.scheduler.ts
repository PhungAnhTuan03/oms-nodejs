import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MAINTENANCE_QUEUE } from '../queue/queues.js';

@Injectable()
export class MaintenanceScheduler implements OnModuleInit {
  constructor(@InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    // upsert: chạy lại nhiều lần cũng chỉ có 1 lịch, không bị nhân đôi
    await this.queue.upsertJobScheduler(
      'cooccurrence-nightly',
      { pattern: '0 2 * * *', tz: 'Asia/Ho_Chi_Minh' }, // 2 giờ sáng mỗi ngày
      { name: 'cooccurrence' },
    );
    await this.queue.upsertJobScheduler(
      'reorder-alerts-morning',
      { pattern: '0 8 * * *', tz: 'Asia/Ho_Chi_Minh' }, // 8 giờ sáng mỗi ngày
      { name: 'reorder-alerts' },
    );
  }
}
