import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { PaginatedActiveFilterQueryDto } from 'src/common/dto/pagination.dto';
import { WarehouseType } from 'src/common/enums/operations.enum';

export class CreateWarehouseDto {
  @ApiProperty({ enum: WarehouseType })
  @IsEnum(WarehouseType)
  type: WarehouseType;

  @ApiProperty({ example: 'مخزن الشركة الرئيسي', maxLength: 150 })
  @IsString()
  @Length(2, 150)
  name: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Required for a BRANCH warehouse, and rejected for the company-level types.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class QueryWarehousesDto extends PaginatedActiveFilterQueryDto {
  @ApiPropertyOptional({ enum: WarehouseType })
  @IsOptional()
  @IsEnum(WarehouseType)
  type?: WarehouseType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
