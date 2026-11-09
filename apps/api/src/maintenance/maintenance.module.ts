import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module.js';
import { TelegramService } from '../notify/telegram.service.js';
import { MaintenanceController } from './maintenance.controller.js';
import { MaintenanceProcessor } from './maintenance.processor.js';
import { MaintenanceScheduler } from './maintenance.scheduler.js';

@Module({
  imports: [InventoryModule],
  controllers: [MaintenanceController],
  providers: [MaintenanceProcessor, MaintenanceScheduler, TelegramService],
})
export class MaintenanceModule {}
