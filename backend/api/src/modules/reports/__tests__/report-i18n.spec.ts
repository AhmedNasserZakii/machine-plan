import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { ReportKey } from 'src/common/enums/report.enum';
import { HEADERS_EN, localizeReport, TOTAL_LABELS, VALUE_LABELS } from '../report-i18n';
import { ReportResult } from '../report.types';

const SERVICES_DIR = join(__dirname, '..', 'services');

/** Every `header: '…'` literal the report services declare. */
function declaredHeaders(): string[] {
  return readdirSync(SERVICES_DIR)
    .filter((file) => file.endsWith('-reports.service.ts'))
    .flatMap((file) =>
      [...readFileSync(join(SERVICES_DIR, file), 'utf8').matchAll(/header: '([^']+)'/g)].map(
        (match) => match[1],
      ),
    );
}

const sample: ReportResult = {
  key: ReportKey.TRANSFERS_LOG,
  generatedAt: '2026-10-07T00:00:00.000Z',
  filters: {},
  columns: [
    { key: 'status', header: 'الحالة', type: 'text' },
    { key: 'fromParty', header: 'من', type: 'text' },
    { key: 'serial', header: 'الرقم التسلسلي', type: 'text' },
  ],
  rows: [{ status: 'CONFIRMED', fromParty: 'Ali (REPRESENTATIVE)', serial: 'OPEN' }],
  totals: { transfers: 1, unknownKey: 2 },
};

describe('report-i18n', () => {
  it('has English for every column header a report declares', () => {
    const missing = declaredHeaders().filter((header) => !(header in HEADERS_EN));

    expect(missing).toEqual([]);
  });

  it('words every value label in both locales', () => {
    for (const label of [...Object.values(VALUE_LABELS), ...Object.values(TOTAL_LABELS)]) {
      expect(label.ar).toBeTruthy();
      expect(label.en).toBeTruthy();
    }
  });

  it('keeps Arabic headers and translates codes for an Arabic reader', () => {
    const result = localizeReport(sample, 'ar');

    expect(result.columns.map((column) => column.header)).toEqual([
      'الحالة',
      'من',
      'الرقم التسلسلي',
    ]);
    expect(result.rows[0]).toEqual({
      status: 'مؤكد',
      fromParty: 'Ali (مندوب)',
      serial: 'OPEN',
    });
    expect(result.totalLabels).toEqual({ transfers: 'التسليمات', unknownKey: 'unknownKey' });
  });

  it('translates headers, codes and totals for an English reader', () => {
    const result = localizeReport(sample, 'en');

    expect(result.columns.map((column) => column.header)).toEqual(['Status', 'From', 'Serial']);
    expect(result.rows[0].status).toBe('Confirmed');
    expect(result.rows[0].fromParty).toBe('Ali (Representative)');
    expect(result.totalLabels?.transfers).toBe('Transfers');
  });
});
