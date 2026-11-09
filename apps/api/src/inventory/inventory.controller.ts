import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto.js';
import { InventoryService } from './inventory.service.js';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('alerts')
  alerts() {
    return this.inventory.getReorderAlerts();
  }

  @Post(':variantId/adjust')
  @Roles('ADMIN')
  adjust(@Param('variantId', ParseIntPipe) variantId: number, @Body() dto: AdjustInventoryDto) {
    return this.inventory.adjust(variantId, dto);
  }

  @Get(':variantId/movements')
  movements(@Param('variantId', ParseIntPipe) variantId: number) {
    return this.inventory.movements(variantId);
  }
}
