import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RateLimitGuard } from '../common/rate-limit.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsQuery } from './dto/list-products.query.js';
import { UpdatePriceDto, UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsService } from './products.service.js';

@ApiTags('products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, RateLimitGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: ListProductsQuery) {
    return this.products.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.products.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Patch('variants/:variantId/price')
  @Roles('ADMIN')
  updatePrice(@Param('variantId', ParseIntPipe) variantId: number, @Body() dto: UpdatePriceDto) {
    return this.products.updatePrice(variantId, dto.price);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.products.remove(id);
  }
  @Get('variants/:variantId/bought-together')
  boughtTogether(@Param('variantId', ParseIntPipe) variantId: number) {
    return this.products.boughtTogether(variantId);
  }
}
