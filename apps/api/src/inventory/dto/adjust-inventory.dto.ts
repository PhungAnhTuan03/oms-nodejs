import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Length, NotEquals } from 'class-validator';

export class AdjustInventoryDto {
  @ApiProperty({ example: 20, description: 'Số dương = nhập thêm, số âm = giảm (kiểm kê, hàng lỗi)' })
  @IsInt()
  @NotEquals(0)
  delta!: number;

  @ApiProperty({ example: 'Nhập hàng đợt 11/2026' })
  @IsString()
  @Length(3, 200)
  reason!: string;
}
