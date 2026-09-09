import { buildReportHtml, pdfFooterTemplate, pdfHeaderTemplate } from '../pdf-template';
import { ExportTable } from '../tabular-export';

// The real font is ~600KB base64-encoded; letting it into a failing assertion's diff makes any
// failure in this file unreadable. A short stub keeps the `@font-face` block's shape (still
// asserted on below) without dragging the actual bytes through the test output.
jest.mock('../pdf-font', () => ({
  cairoFontBase64: () => 'stub-base64-font-bytes',
  cairoFontFace: () => `
    @font-face {
      font-family: 'Cairo';
      src: url(data:font/ttf;base64,stub-base64-font-bytes) format('truetype-variations');
      font-weight: 200 1000;
      font-style: normal;
    }
  `,
}));

function table(overrides: Partial<ExportTable> = {}): ExportTable {
  return {
    title: 'تقرير-الجرد',
    locale: 'ar',
    meta: [
      { label: 'التقرير', value: 'جرد الماكينات' },
      { label: 'تاريخ الإصدار', value: '2026-09-08T20:00:00.000Z' },
    ],
    columns: [
      { key: 'serial', header: 'الرقم التسلسلي', type: 'text' },
      { key: 'cost', header: 'التكلفة', type: 'number' },
      { key: 'purchaseDate', header: 'تاريخ الشراء', type: 'date' },
    ],
    rows: [
      { serial: 'SN-1', cost: 100.5, purchaseDate: '2025-01-15' },
      { serial: 'SN-2', cost: 50, purchaseDate: '2025-02-01' },
    ],
    ...overrides,
  };
}

describe('buildReportHtml', () => {
  it('sets the document direction and lang from the table locale', () => {
    expect(buildReportHtml(table({ locale: 'ar' }))).toContain('<html dir="rtl" lang="ar">');
    expect(buildReportHtml(table({ locale: 'en' }))).toContain('<html dir="ltr" lang="en">');
  });

  it('prints the title and the metadata block', () => {
    const html = buildReportHtml(table());

    expect(html).toContain('<h1>تقرير-الجرد</h1>');
    expect(html).toContain('التقرير');
    expect(html).toContain('جرد الماكينات');
    expect(html).toContain('تاريخ الإصدار');
  });

  it('prints one header cell per column and one row per data row', () => {
    const html = buildReportHtml(table());

    expect(html).toContain('الرقم التسلسلي');
    expect(html).toContain('SN-1');
    expect(html).toContain('SN-2');
  });

  it('wraps numbers and dates in an LTR span so they read correctly inside an RTL page', () => {
    const html = buildReportHtml(table());

    expect(html).toMatch(/<span class="ltr">100\.50<\/span>/);
    expect(html).toMatch(/<span class="ltr">2025-01-15<\/span>/);
  });

  it('adds a totals row that sums every numeric column and leaves the rest blank', () => {
    const html = buildReportHtml(table());

    expect(html).toContain('<tfoot>');
    expect(html).toContain('الإجمالي');
    // 100.50 + 50.00
    expect(html).toMatch(/<span class="ltr">150\.50<\/span>/);
  });

  it('labels the totals row in English for an English table', () => {
    const html = buildReportHtml(
      table({
        locale: 'en',
        columns: [
          { key: 'serial', header: 'Serial', type: 'text' },
          { key: 'cost', header: 'Cost', type: 'number' },
        ],
      }),
    );

    expect(html).toContain('Total');
    expect(html).not.toContain('الإجمالي');
  });

  it('omits the totals row entirely when no column is numeric', () => {
    const html = buildReportHtml(
      table({ columns: [{ key: 'serial', header: 'الرقم التسلسلي', type: 'text' }] }),
    );

    expect(html).not.toContain('<tfoot>');
  });

  it('omits the totals row when there are no data rows', () => {
    const html = buildReportHtml(table({ rows: [] }));

    expect(html).not.toContain('<tfoot>');
    expect(html).toContain('—');
  });

  it('renders one page-broken section per sheetKey group, in first-seen order', () => {
    const html = buildReportHtml(
      table({
        sheetKey: 'branch',
        rows: [
          { serial: 'SN-1', cost: 10, purchaseDate: '2025-01-01', branch: 'القاهرة' },
          { serial: 'SN-2', cost: 20, purchaseDate: '2025-01-02', branch: 'الإسكندرية' },
          { serial: 'SN-3', cost: 30, purchaseDate: '2025-01-03', branch: 'القاهرة' },
        ],
      }),
    );

    const cairoIndex = html.indexOf('القاهرة');
    const alexIndex = html.indexOf('الإسكندرية');
    expect(cairoIndex).toBeGreaterThan(-1);
    expect(alexIndex).toBeGreaterThan(cairoIndex);

    // Exactly one page break, before the second group.
    expect(html.match(/class="page-break"/g)).toHaveLength(1);
  });

  it('escapes HTML-significant characters in cell values and the title', () => {
    const html = buildReportHtml(
      table({
        title: '<script>alert(1)</script>',
        rows: [{ serial: '<b>SN</b>', cost: 1, purchaseDate: '2025-01-01' }],
      }),
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<b>SN</b>');
  });

  it('embeds the Cairo font as a base64 data URI so no system font is required', () => {
    const html = buildReportHtml(table());

    expect(html).toContain("font-family: 'Cairo'");
    expect(html).toMatch(/data:font\/ttf;base64,[A-Za-z0-9+/]+/);
  });
});

describe('pdf header/footer templates', () => {
  it('renders an empty header', () => {
    expect(pdfHeaderTemplate()).toBe('<div></div>');
  });

  it('localizes the page-number footer and embeds the font for it independently', () => {
    const ar = pdfFooterTemplate('ar');
    expect(ar).toContain('صفحة');
    expect(ar).toContain('من');
    expect(ar).toContain('pageNumber');
    expect(ar).toContain('totalPages');
    expect(ar).toContain("font-family: 'Cairo'");

    const en = pdfFooterTemplate('en');
    expect(en).toContain('Page');
    expect(en).toContain('of');
  });
});
