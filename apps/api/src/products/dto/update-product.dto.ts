import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'Áo bra thể thao xanh navy' })
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;
}

export class UpdatePriceDto {
  @ApiProperty({ example: 279000 })
  @IsInt()
  @Min(0)
  price!: number;
}
