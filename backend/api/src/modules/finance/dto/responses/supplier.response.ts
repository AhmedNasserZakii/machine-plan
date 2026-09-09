import { ApiProperty } from '@nestjs/swagger';

export class SupplierResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'شركة قطع الغيار المتحدة' }) name: string;
  @ApiProperty({ nullable: true }) phone: string | null;
  @ApiProperty({ nullable: true }) notes: string | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty() createdAt: string;
}
