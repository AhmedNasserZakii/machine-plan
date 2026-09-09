import { Injectable } from '@nestjs/common';
import { Locale } from 'src/common/constants/locales';
import { ErrorCode } from 'src/common/constants/error-codes';
import { ReportFormat } from 'src/common/enums/report.enum';
import { AppException } from 'src/common/errors';
import {
  buildReportHtml,
  ExportedFile,
  ExportTable,
  PDF_MIME,
  PdfRendererService,
  toCsv,
  toXlsx,
} from 'src/common/export';
import { reportTitle } from '../report-catalogue';
import { ReportResult } from '../report.types';

/** Header labels for the metadata block, in both locales (`02`). */
const META_LABELS: Record<Locale, { report: string; generatedAt: string; filters: string }> = {
  ar: { report: 'التقرير', generatedAt: 'تاريخ الإصدار', filters: 'عوامل التصفية' },
  en: { report: 'Report', generatedAt: 'Generated at', filters: 'Filters' },
};

/**
 * Turns a finished report into a file (`17`, export formatting).
 *
 * The metadata block is not decoration: rule 6 requires an export to say what it is and which
 * filters produced it, because a spreadsheet outlives the screen it was taken from and a column
 * of numbers with no period on it will eventually be read as the wrong month.
 */
@Injectable()
export class ReportExportService {
  constructor(private readonly pdf: PdfRendererService) {}

  async render(result: ReportResult, format: ReportFormat, locale: Locale): Promise<ExportedFile> {
    const table = this.toTable(result, locale);

    switch (format) {
      case ReportFormat.CSV:
        return toCsv(table);
      case ReportFormat.XLSX:
        return toXlsx(table);
      case ReportFormat.PDF:
        return this.renderPdf(table, locale);
      case ReportFormat.JSON:
      default:
        throw new AppException(ErrorCode.EXPORT_FORMAT_UNAVAILABLE, { params: { format } });
    }
  }

  private async renderPdf(table: ExportTable, locale: Locale): Promise<ExportedFile> {
    const html = buildReportHtml(table);
    const body = await this.pdf.render(html, locale);

    return {
      filename: `${table.title}.pdf`,
      mimeType: PDF_MIME,
      body,
      rowCount: table.rows.length,
    };
  }

  toTable(result: ReportResult, locale: Locale): ExportTable {
    const labels = META_LABELS[locale];

    return {
      title: reportTitle(result.key, locale),
      locale,
      meta: [
        { label: labels.report, value: reportTitle(result.key, locale) },
        { label: labels.generatedAt, value: result.generatedAt },
        { label: labels.filters, value: describeFilters(result.filters) },
      ],
      columns: result.columns,
      rows: result.rows,
      sheetKey: result.sheetKey,
    };
  }
}

/** `branchId=…, from=2026-06-01, to=2026-08-31` — readable in a cell, and complete. */
function describeFilters(filters: Record<string, unknown>): string {
  const parts = Object.entries(filters)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key}=${String(value)}`);

  return parts.length > 0 ? parts.join(', ') : '—';
}
