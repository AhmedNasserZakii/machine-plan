import { Locale } from '../constants/locales';
import { cairoFontFace } from './pdf-font';
import { ExportCell, ExportColumn, ExportTable } from './tabular-export';

/** Label above the totals row, in both locales. */
const TOTAL_LABEL: Record<Locale, string> = { ar: 'الإجمالي', en: 'Total' };

/**
 * Builds the HTML `PdfRendererService` prints (`17`: title, generation time, filters, headers,
 * totals). A pure function on purpose — every branch here is testable without launching a
 * browser, which is the only thing actually worth spending a Chromium process on.
 */
export function buildReportHtml(table: ExportTable): string {
  const dir = table.locale === 'ar' ? 'rtl' : 'ltr';
  const groups = splitIntoSections(table);

  const sections = groups
    .map(
      ([name, rows], index) => `
        <section${index > 0 ? ' class="page-break"' : ''}>
          ${table.sheetKey ? `<h2>${escapeHtml(name)}</h2>` : ''}
          ${renderTable(table.columns, rows, table.locale)}
        </section>
      `,
    )
    .join('\n');

  return `
    <!DOCTYPE html>
    <html dir="${dir}" lang="${table.locale}">
      <head>
        <meta charset="utf-8" />
        <style>${styles()}</style>
      </head>
      <body>
        <h1>${escapeHtml(table.title)}</h1>
        ${renderMeta(table.meta)}
        ${sections}
      </body>
    </html>
  `;
}

/** The header/footer templates Puppeteer's `page.pdf()` renders as separate documents — hence
 * the standalone font-face rather than a shared `<style>` block with the main content. */
export function pdfHeaderTemplate(): string {
  return `<div></div>`;
}

export function pdfFooterTemplate(locale: Locale): string {
  const label = locale === 'ar' ? 'صفحة' : 'Page';
  const of = locale === 'ar' ? 'من' : 'of';

  return `
    <div style="${footerStyle()}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">
      <style>${cairoFontFace()}</style>
      ${label} <span class="pageNumber"></span> ${of} <span class="totalPages"></span>
    </div>
  `;
}

function footerStyle(): string {
  return [
    "font-family: 'Cairo', sans-serif",
    'font-size: 9px',
    'width: 100%',
    'text-align: center',
    'color: #666',
  ].join('; ');
}

function styles(): string {
  return `
    ${cairoFontFace()}

    * { box-sizing: border-box; }

    body {
      font-family: 'Cairo', sans-serif;
      font-size: 11px;
      color: #1a1a1a;
      margin: 0;
      padding: 0 32px;
    }

    h1 {
      font-size: 18px;
      font-weight: 700;
      margin: 24px 0 8px;
    }

    h2 {
      font-size: 14px;
      font-weight: 700;
      margin: 16px 0 8px;
    }

    .meta {
      margin-bottom: 16px;
      border-collapse: collapse;
    }

    .meta td {
      padding: 2px 12px 2px 0;
      font-size: 10px;
      color: #444;
    }

    .meta td:first-child {
      font-weight: 700;
    }

    table.data {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }

    table.data th,
    table.data td {
      border: 1px solid #ddd;
      padding: 5px 8px;
      text-align: start;
    }

    table.data thead th {
      background: #f2f2f2;
      font-weight: 700;
    }

    table.data tbody tr:nth-child(even) {
      background: #fafafa;
    }

    table.data tfoot td {
      font-weight: 700;
      background: #f2f2f2;
      border-top: 2px solid #999;
    }

    /* Numbers, dates and other identifiers stay left-to-right even inside an RTL page — a
       serial or an amount read right-to-left is read wrong (mobile plan \`13\`, same rule). */
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
      display: inline-block;
    }

    .page-break {
      page-break-before: always;
    }
  `;
}

function renderMeta(meta: ExportTable['meta']): string {
  if (meta.length === 0) return '';

  const rows = meta
    .map(
      (entry) => `<tr><td>${escapeHtml(entry.label)}</td><td>${escapeHtml(entry.value)}</td></tr>`,
    )
    .join('');

  return `<table class="meta">${rows}</table>`;
}

function renderTable(
  columns: ExportColumn[],
  rows: Record<string, ExportCell>[],
  locale: Locale,
): string {
  const header = columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join('');

  const body = rows
    .map(
      (row) =>
        `<tr>${columns.map((column) => `<td>${renderCell(column, row[column.key])}</td>`).join('')}</tr>`,
    )
    .join('');

  const footer = renderTotalsRow(columns, rows, locale);

  return `
    <table class="data">
      <thead><tr>${header}</tr></thead>
      <tbody>${body || `<tr><td colspan="${columns.length}">—</td></tr>`}</tbody>
      ${footer}
    </table>
  `;
}

function renderTotalsRow(
  columns: ExportColumn[],
  rows: Record<string, ExportCell>[],
  locale: Locale,
): string {
  const hasNumberColumn = columns.some((column) => column.type === 'number');
  if (!hasNumberColumn || rows.length === 0) return '';

  const cells = columns.map((column, index) => {
    if (index === 0) return `<td>${escapeHtml(TOTAL_LABEL[locale])}</td>`;
    if (column.type !== 'number') return '<td></td>';

    const total = rows.reduce((sum, row) => {
      const value = row[column.key];
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);

    return `<td>${ltr(formatNumber(total))}</td>`;
  });

  return `<tfoot><tr>${cells.join('')}</tr></tfoot>`;
}

function renderCell(column: ExportColumn, value: ExportCell): string {
  if (value === null || value === undefined) return '';

  if (column.type === 'number') return ltr(formatNumber(value as number));
  if (column.type === 'date') return ltr(escapeHtml(String(value)));

  return escapeHtml(String(value));
}

function ltr(html: string): string {
  return `<span class="ltr">${html}</span>`;
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Mirrors `tabular-export.ts`'s `splitIntoSheets`: one group per `sheetKey` value, or a single
 * unnamed group for a flat report. Kept separate rather than shared — a PDF section and an xlsx
 * sheet differ in what happens at the boundary (a page break vs. a new sheet). */
function splitIntoSections(table: ExportTable): Array<[string, Record<string, ExportCell>[]]> {
  if (!table.sheetKey) return [[table.title, table.rows]];

  const groups = new Map<string, Record<string, ExportCell>[]>();

  for (const row of table.rows) {
    const raw = row[table.sheetKey];
    const key = raw === null || raw === undefined ? '—' : String(raw);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  if (groups.size === 0) groups.set(table.title, []);

  return [...groups.entries()];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
