import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { ActiveFilterQueryDto } from 'src/common/dto/query.dto';

export class CreateSupplierDto {
  @ApiProperty({ maxLength: 150 })
  @IsString()
  @Length(2, 150)
  name: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @Length(5, 20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 1000)
  notes?: string;
}

export class QuerySuppliersDto extends ActiveFilterQueryDto {
  @ApiPropertyOptional({ description: 'Partial match on name and phone.' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;
}
