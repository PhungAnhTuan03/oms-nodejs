import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsQuery } from './dto/list-products.query.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

const WITH_VARIANTS = { variants: { include: { inventory: true } } } as const;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    try {
      return await this.prisma.product.create({
        data: {
          name: dto.name,
          variants: {
            create: dto.variants.map((v) => ({
              sku: v.sku,
              price: v.price,
              inventory: { create: { available: v.initialStock } },
            })),
          },
        },
        include: WITH_VARIANTS,
      });
    } catch (e) {
      // P2002 = vi phạm ràng buộc unique, ở đây là SKU bị trùng
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException('SKU đã tồn tại');
      }
      throw e;
    }
  }

  // Phân trang cursor: lấy dư 1 bản ghi để biết còn trang sau hay không
  async list({ cursor, limit }: ListProductsQuery) {
    const items = await this.prisma.product.findMany({
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'desc' },
      include: WITH_VARIANTS,
    });
    const hasNext = items.length > limit;
    if (hasNext) items.pop();
    return { items, nextCursor: hasNext ? items[items.length - 1].id : null };
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: WITH_VARIANTS });
    if (!product) throw new NotFoundException(`Không tìm thấy sản phẩm ${id}`);
    return product;
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOne(id);
    return this.prisma.product.update({ where: { id }, data: dto, include: WITH_VARIANTS });
  }

  async updatePrice(variantId: number, price: number) {
    const variant = await this.prisma.variant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException(`Không tìm thấy biến thể ${variantId}`);
    return this.prisma.variant.update({ where: { id: variantId }, data: { price } });
  }

  async remove(id: number) {
    await this.findOne(id);
    const used = await this.prisma.orderItem.count({ where: { variant: { productId: id } } });
    if (used > 0) {
      throw new ConflictException('Sản phẩm đã có trong đơn hàng, không thể xoá');
    }
    // Xoá theo thứ tự con trước, cha sau, trong một transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.inventory.deleteMany({ where: { variant: { productId: id } } });
      await tx.variant.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
    });
    return { deleted: true };
  }
}
