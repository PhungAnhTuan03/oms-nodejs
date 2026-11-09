import { Module } from '@nestjs/common';
import { MaintenanceController } from './maintenance.controller.js';

@Module({
  controllers: [MaintenanceController],
})
export class MaintenanceModule {}
