import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsString, Length, Min, ValidateNested } from 'class-validator';

export class CreateVariantDto {
  @ApiProperty({ example: 'SWA-021-M' })
  @IsString()
  @Length(3, 50)
  sku!: string;

  @ApiProperty({ example: 249000, description: 'Giá bán, đơn vị VND' })
  @IsInt()
  @Min(0)
  price!: number;

  @ApiProperty({ example: 10, description: 'Tồn kho ban đầu' })
  @IsInt()
  @Min(0)
  initialStock!: number;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Áo bra thể thao xanh' })
  @IsString()
  @Length(2, 200)
  name!: string;

  @ApiProperty({ type: [CreateVariantDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants!: CreateVariantDto[];
}
