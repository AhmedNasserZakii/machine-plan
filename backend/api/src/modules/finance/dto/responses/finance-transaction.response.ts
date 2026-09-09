import { ApiProperty } from '@nestjs/swagger';
import {
  FINANCE_KINDS,
  FinanceKind,
  TRANSACTION_SOURCES,
  TransactionSource,
} from 'src/common/enums/finance.enum';

export class FinanceCategoryRefResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ nullable: true }) code: string | null;
  @ApiProperty({ example: 'قطع غيار' }) name: string;

  @ApiProperty({
    example: 'مصاريف تشغيل / صيانة / قطع غيار',
    description: 'Localized ancestry, so a row reads on its own without a second call.',
  })
  path: string;
}

export class FinanceNamedRefResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() name: string;
}

export class FinanceTransactionResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'EXP-2026-000512' }) referenceNo: string;
  @ApiProperty({ enum: FINANCE_KINDS }) kind: FinanceKind;
  @ApiProperty({ example: 1250.5 }) amount: number;
  @ApiProperty({ type: FinanceCategoryRefResponse }) category: FinanceCategoryRefResponse;
  @ApiProperty({ example: '2026-09-01' }) transactionDate: string;
  @ApiProperty({ type: FinanceNamedRefResponse }) paymentMethod: FinanceNamedRefResponse;

  @ApiProperty({ type: FinanceNamedRefResponse, nullable: true, description: 'Null = company.' })
  branch: FinanceNamedRefResponse | null;

  @ApiProperty({ type: FinanceNamedRefResponse, nullable: true })
  supplier: FinanceNamedRefResponse | null;

  @ApiProperty({ format: 'uuid', nullable: true }) invoiceMediaId: string | null;
  @ApiProperty({ nullable: true }) notes: string | null;
  @ApiProperty({ enum: TRANSACTION_SOURCES }) source: TransactionSource;

  @ApiProperty({ nullable: true, description: 'The record that owns an auto-posted row.' })
  sourceRefType: string | null;

  @ApiProperty({ format: 'uuid', nullable: true }) sourceRefId: string | null;
  @ApiProperty() isVoided: boolean;
  @ApiProperty({ nullable: true }) voidedAt: string | null;
  @ApiProperty({ nullable: true }) voidReason: string | null;

  @ApiProperty({
    description: 'False for auto-posted rows and for anything past the edit window (`15`).',
  })
  isEditable: boolean;

  @ApiProperty({ description: 'False for auto-posted rows and for already-voided ones.' })
  isVoidable: boolean;

  @ApiProperty() createdAt: string;
}
