import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportFormat, ReportJobStatus, ReportKey } from 'src/common/enums/report.enum';

export class ReportColumnResponse {
  @ApiProperty({ example: 'serial' }) key: string;
  @ApiProperty({ example: 'الرقم التسلسلي' }) header: string;
  @ApiProperty({ enum: ['text', 'number', 'date'] }) type: string;
}

/**
 * One shape for all seventeen reports (`17`, shared contract).
 *
 * `columns` and `rows` are the grid; `totals` is what the footer shows; `extra` carries the parts
 * a grid cannot express — the custody groups, the profit-and-loss series — and is absent on the
 * reports that are only a table.
 */
export class ReportResponse {
  @ApiProperty({ enum: ReportKey }) key: ReportKey;
  @ApiProperty({ example: 'جرد الماكينات' }) title: string;
  @ApiProperty({ example: '2026-09-07T10:15:00.000Z' }) generatedAt: string;

  @ApiProperty({
    type: Object,
    description: 'Exactly the filters the report ran with, including the resolved branch scope.',
  })
  filters: Record<string, unknown>;

  @ApiProperty({ type: [ReportColumnResponse] }) columns: ReportColumnResponse[];
  @ApiProperty({ type: [Object] }) rows: Record<string, unknown>[];
  @ApiProperty({ type: Object }) totals: Record<string, number | string>;

  @ApiProperty({ description: 'Rows before paging — what an export of this report would contain.' })
  rowCount: number;

  @ApiProperty({ description: 'True when the row cap cut the answer short.' })
  truncated: boolean;

  @ApiPropertyOptional({ type: Object })
  extra?: Record<string, unknown>;
}

/** `202 Accepted` for a non-JSON format (`17`). */
export class ReportJobAcceptedResponse {
  @ApiProperty({ format: 'uuid' }) jobId: string;
  @ApiProperty({ enum: ReportJobStatus }) status: ReportJobStatus;
  @ApiProperty({ example: '/api/v1/reports/jobs/…' }) pollUrl: string;
}

export class ReportJobResponse {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ enum: ReportKey }) reportKey: ReportKey;
  @ApiProperty({ enum: ReportFormat }) format: ReportFormat;
  @ApiProperty({ enum: ReportJobStatus }) status: ReportJobStatus;
  @ApiProperty({ type: Object }) filters: Record<string, unknown>;

  @ApiProperty({
    nullable: true,
    description: 'Rows in the produced file. Null until it is ready.',
  })
  rowCount: number | null;

  @ApiProperty({ nullable: true }) filename: string | null;
  @ApiProperty({ nullable: true }) sizeBytes: number | null;

  @ApiProperty({ nullable: true, description: 'Present only on READY.' })
  downloadUrl: string | null;

  @ApiProperty({ nullable: true, description: 'A stable ErrorCode. Present only on FAILED.' })
  errorCode: string | null;

  @ApiProperty() expiresAt: string;
  @ApiProperty() createdAt: string;
  @ApiProperty({ nullable: true }) completedAt: string | null;
}

/** `GET /reports` — the tiles the caller is actually allowed to open. */
export class ReportCatalogueEntryResponse {
  @ApiProperty({ enum: ReportKey }) key: ReportKey;
  @ApiProperty({ example: 'جرد الماكينات' }) title: string;
  @ApiProperty({ example: 'reports.machines' }) permission: string;
  @ApiProperty({ example: '/reports/machines/inventory' }) path: string;
  @ApiProperty() allowed: boolean;
}
