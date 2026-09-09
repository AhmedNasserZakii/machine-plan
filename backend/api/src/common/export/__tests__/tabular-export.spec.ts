import ExcelJS from 'exceljs';
import { ExportTable, toCsv, toXlsx } from '../tabular-export';

function table(overrides: Partial<ExportTable> = {}): ExportTable {
  return {
    title: 'تقرير',
    locale: 'ar',
    meta: [{ label: 'الفترة', value: '2026-01-01 → 2026-03-31' }],
    columns: [
      { key: 'serial', header: 'الرقم التسلسلي', type: 'text' },
      { key: 'cost', header: 'التكلفة', type: 'number' },
    ],
    rows: [
      { serial: 'SN-1', cost: 100.5 },
      { serial: 'SN-2', cost: 0 },
    ],
    ...overrides,
  };
}

function lines(body: Buffer): string[] {
  return body
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .trimEnd()
    .split('\r\n');
}

describe('toCsv', () => {
  it('writes the metadata block, a blank line, the header and one line per row', () => {
    const file = toCsv(table());

    expect(lines(file.body)).toEqual([
      'الفترة,2026-01-01 → 2026-03-31',
      '',
      'الرقم التسلسلي,التكلفة',
      'SN-1,100.5',
      'SN-2,0',
    ]);
  });

  it('reports a row count that matches the data rows, not the file lines', () => {
    expect(toCsv(table()).rowCount).toBe(2);
  });

  it('leads with a BOM, without which Excel opens Arabic as mojibake', () => {
    expect(toCsv(table()).body.toString('utf8').startsWith('\uFEFF')).toBe(true);
  });

  it('quotes a value containing a comma or a quote', () => {
    const file = toCsv(
      table({
        meta: [],
        rows: [
          { serial: 'a,b', cost: 1 },
          { serial: 'say "hi"', cost: 2 },
        ],
      }),
    );

    expect(lines(file.body)).toContain('"a,b",1');
    expect(lines(file.body)).toContain('"say ""hi""",2');
  });

  it('defuses a value a spreadsheet would otherwise evaluate as a formula', () => {
    const file = toCsv(table({ meta: [], rows: [{ serial: '=cmd|calc', cost: 1 }] }));

    expect(file.body.toString('utf8')).toContain('"\t=cmd|calc"');
  });

  it('writes an empty cell for a null', () => {
    const file = toCsv(table({ meta: [], rows: [{ serial: null, cost: null }] }));

    expect(lines(file.body)).toContain(',');
  });

  it('still produces a header when the report found nothing', () => {
    const file = toCsv(table({ meta: [], rows: [] }));

    expect(lines(file.body)).toEqual(['الرقم التسلسلي,التكلفة']);
    expect(file.rowCount).toBe(0);
  });
});

describe('toXlsx', () => {
  async function read(body: Buffer): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    // `exceljs` types its reader against its own `Buffer` alias, which is not Node's.
    await workbook.xlsx.load(body as unknown as ExcelJS.Buffer);

    return workbook;
  }

  it('writes one sheet whose data rows match the report', async () => {
    const file = await toXlsx(table());
    const workbook = await read(file.body);

    expect(workbook.worksheets).toHaveLength(1);
    // Metadata row, spacer, header, then the data.
    expect(workbook.worksheets[0].rowCount).toBe(5);
    expect(file.rowCount).toBe(2);
  });

  it('keeps numbers numeric, so the totals row a user adds actually sums', async () => {
    const workbook = await read((await toXlsx(table())).body);
    const firstData = workbook.worksheets[0].getRow(4);

    expect(firstData.getCell(2).value).toBe(100.5);
    expect(typeof firstData.getCell(2).value).toBe('number');
  });

  it('lays an Arabic report out right to left', async () => {
    const workbook = await read((await toXlsx(table())).body);

    expect(workbook.worksheets[0].views[0].rightToLeft).toBe(true);
  });

  it('lays an English report out left to right', async () => {
    const workbook = await read((await toXlsx(table({ locale: 'en' }))).body);

    expect(workbook.worksheets[0].views[0].rightToLeft).toBe(false);
  });

  it('splits into one sheet per group when the report names a sheet key', async () => {
    const file = await toXlsx(
      table({
        sheetKey: 'serial',
        rows: [
          { serial: 'A', cost: 1 },
          { serial: 'B', cost: 2 },
          { serial: 'A', cost: 3 },
        ],
      }),
    );
    const workbook = await read(file.body);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['A', 'B']);
    expect(file.rowCount).toBe(3);
  });

  it('still produces a sheet when the report found nothing', async () => {
    const file = await toXlsx(table({ rows: [], sheetKey: 'serial' }));
    const workbook = await read(file.body);

    expect(workbook.worksheets).toHaveLength(1);
    expect(file.rowCount).toBe(0);
  });

  it('strips the characters Excel refuses in a sheet name', async () => {
    const file = await toXlsx(table({ sheetKey: 'serial', rows: [{ serial: 'a/b:c', cost: 1 }] }));
    const workbook = await read(file.body);

    expect(workbook.worksheets[0].name).toBe('a b c');
  });
});
