import ExcelJS from 'exceljs';
import { Locale } from '../constants/locales';

export type CellType = 'text' | 'number' | 'date';

export interface ExportColumn {
  /** Key into the row object. */
  key: string;
  header: string;
  type: CellType;
  width?: number;
}

export type ExportCell = string | number | null;

export interface ExportTable {
  /** Used as the file name stem and as the sheet name when the table is not split. */
  title: string;
  locale: Locale;
  /**
   * `17`, rule 6: what the report was, when it ran, and with which filters. Printed above the
   * header so a spreadsheet on somebody's desk still says what it is a month later.
   */
  meta: { label: string; value: string }[];
  columns: ExportColumn[];
  rows: Record<string, ExportCell>[];
  /**
   * Column whose value splits the rows into one worksheet each (`17`, export formatting). Left
   * undefined for a flat report, which then gets a single sheet.
   */
  sheetKey?: string;
}

export interface ExportedFile {
  filename: string;
  mimeType: string;
  body: Buffer;
  /** Data rows written, excluding headers and the metadata block. */
  rowCount: number;
}

export const CSV_MIME = 'text/csv; charset=utf-8';
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const PDF_MIME = 'application/pdf';

const NUMBER_FORMAT = '#,##0.00';
const DATE_FORMAT = 'yyyy-mm-dd';
/** Excel refuses `[]:*?/\` and anything past 31 characters in a sheet name. */
const SHEET_NAME_LIMIT = 31;

/**
 * UTF-8 CSV with a BOM, which is the only thing that makes Excel open Arabic as Arabic rather
 * than as mojibake (`17`, export formatting).
 *
 * The metadata block is written as comment-free leading rows rather than skipped: a CSV that has
 * lost which branch and which dates it covers is a column of numbers nobody can act on.
 */
export function toCsv(table: ExportTable): ExportedFile {
  const lines: string[] = [];

  for (const entry of table.meta) {
    lines.push([entry.label, entry.value].map(csvCell).join(','));
  }
  if (table.meta.length > 0) lines.push('');

  lines.push(table.columns.map((column) => csvCell(column.header)).join(','));

  for (const row of table.rows) {
    lines.push(table.columns.map((column) => csvCell(format(row[column.key]))).join(','));
  }

  return {
    filename: `${table.title}.csv`,
    mimeType: CSV_MIME,
    body: Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8'),
    rowCount: table.rows.length,
  };
}

/**
 * xlsx via `exceljs`: one sheet per group, a frozen header row, RTL when the report was requested
 * in Arabic, numbers as `#,##0.00` and dates as `yyyy-mm-dd` (`17`).
 *
 * Cell *types* are set rather than strings that look like numbers, because a spreadsheet whose
 * totals cannot be summed is a screenshot with extra steps.
 */
export async function toXlsx(table: ExportTable): Promise<ExportedFile> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const groups = splitIntoSheets(table);

  for (const [name, rows] of groups) {
    const sheet = workbook.addWorksheet(sheetName(name), {
      views: [
        {
          state: 'frozen',
          ySplit: table.meta.length + (table.meta.length > 0 ? 1 : 0) + 1,
          rightToLeft: table.locale === 'ar',
        },
      ],
    });

    for (const entry of table.meta) {
      sheet.addRow([entry.label, entry.value]);
    }
    if (table.meta.length > 0) sheet.addRow([]);

    const header = sheet.addRow(table.columns.map((column) => column.header));
    header.font = { bold: true };

    for (const row of rows) {
      const added = sheet.addRow(table.columns.map((column) => cellValue(row[column.key])));

      table.columns.forEach((column, index) => {
        const cell = added.getCell(index + 1);
        if (column.type === 'number') cell.numFmt = NUMBER_FORMAT;
        if (column.type === 'date') cell.numFmt = DATE_FORMAT;
      });
    }

    table.columns.forEach((column, index) => {
      sheet.getColumn(index + 1).width = column.width ?? widthFor(column.header);
    });
  }

  return {
    filename: `${table.title}.xlsx`,
    mimeType: XLSX_MIME,
    body: Buffer.from(await workbook.xlsx.writeBuffer()),
    rowCount: table.rows.length,
  };
}

/**
 * Rows grouped by `sheetKey`, or one unnamed group when the report is flat.
 *
 * Always returns at least one entry: an empty report still has to produce a file with its headers
 * and its filters, or the person who ran it cannot tell an empty answer from a failed export.
 */
function splitIntoSheets(table: ExportTable): Map<string, Record<string, ExportCell>[]> {
  const groups = new Map<string, Record<string, ExportCell>[]>();

  if (!table.sheetKey) {
    groups.set(table.title, table.rows);
    return groups;
  }

  for (const row of table.rows) {
    const key = format(row[table.sheetKey]) || '—';
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  if (groups.size === 0) groups.set(table.title, []);

  return groups;
}

function cellValue(value: ExportCell): string | number | null {
  return value ?? null;
}

function format(value: ExportCell): string {
  return value === null || value === undefined ? '' : String(value);
}

/**
 * RFC 4180 quoting. A leading `=`, `+`, `-` or `@` is prefixed with a tab as well: those four
 * characters are what makes a spreadsheet evaluate a cell as a formula, and a merchant named
 * `=cmd` should not be executable on the accountant's laptop.
 */
function csvCell(value: string): string {
  const guarded = /^[=+\-@]/.test(value) ? `\t${value}` : value;

  return /[",\r\n\t]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

function sheetName(name: string): string {
  const cleaned = name.replace(/[[\]:*?/\\]/g, ' ').trim();

  return (cleaned || 'Sheet').slice(0, SHEET_NAME_LIMIT);
}

function widthFor(header: string): number {
  return Math.min(Math.max(header.length + 4, 12), 40);
}
