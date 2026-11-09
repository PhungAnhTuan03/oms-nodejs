import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { MAINTENANCE_QUEUE } from '../queue/queues.js';

@ApiTags('maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('maintenance')
export class MaintenanceController {
  constructor(@InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue) {}

  @Post('run/:job')
  async run(@Param('job') job: string) {
    if (!['cooccurrence', 'reorder-alerts'].includes(job)) {
      throw new BadRequestException('job phải là cooccurrence hoặc reorder-alerts');
    }
    const added = await this.queue.add(job, {});
    return { queued: job, jobId: added.id };
  }
}
