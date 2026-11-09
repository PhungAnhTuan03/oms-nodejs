import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListProductsQuery {
  @ApiPropertyOptional({ description: 'id cuối cùng của trang trước (nextCursor)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  cursor?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ description: 'Từ khoá tìm kiếm (dùng ở Giai đoạn 5)' })
  @IsOptional()
  @IsString()
  q?: string;
}
