import { DEFAULT_LOCALE, Locale } from 'src/common/constants/locales';
import { FinanceKind } from 'src/common/enums/finance.enum';
import { FinanceCategory } from '../entities/finance-category.entity';
import { FinanceCategoryTranslation } from '../entities/finance-category-translation.entity';
import {
  assembleCategoryTree,
  CategoryAggregate,
  categoryName,
  flattenCategoryTree,
  indexByPathLabel,
  limitTreeDepth,
  localizedCategoryPath,
  pruneCategoryTree,
  subtreeRows,
} from '../category-tree';
import { buildPath, depthOf, toPathLabel } from '../category-path';

const OPERATIONS = '11111111111111111111111111111111';
const MAINTENANCE = '22222222222222222222222222222222';
const SPARE_PARTS = '33333333333333333333333333333333';
const LABOUR = '44444444444444444444444444444444';
const RENT = '55555555555555555555555555555555';

function category(
  id: string,
  parent: FinanceCategory | null,
  names: Partial<Record<Locale, string>>,
  overrides: Partial<FinanceCategory> = {},
): FinanceCategory {
  const path = buildPath(parent?.path ?? null, id);

  return {
    id,
    code: null,
    parentId: parent?.id ?? null,
    path,
    depth: depthOf(path),
    kind: FinanceKind.EXPENSE,
    isSystem: false,
    isActive: true,
    sortOrder: 0,
    translations: Object.entries(names).map(
      ([locale, name]) => ({ locale, name, description: null }) as FinanceCategoryTranslation,
    ),
    ...overrides,
  } as FinanceCategory;
}

/** `مصاريف تشغيل → صيانة → { قطع غيار, أجور فنيين }`, plus a second root. */
function threeLevelTree(): FinanceCategory[] {
  const operations = category(OPERATIONS, null, { ar: 'مصاريف تشغيل', en: 'Operations' });
  const maintenance = category(MAINTENANCE, operations, { ar: 'صيانة', en: 'Maintenance' });

  return [
    operations,
    maintenance,
    category(SPARE_PARTS, maintenance, { ar: 'قطع غيار', en: 'Spare parts' }),
    category(LABOUR, maintenance, { ar: 'أجور فنيين', en: 'Technician labour' }, { sortOrder: 1 }),
    category(RENT, null, { ar: 'إيجارات', en: 'Rent' }, { sortOrder: 1 }),
  ];
}

function aggregates(entries: Record<string, [number, number]>): Map<string, CategoryAggregate> {
  return new Map(Object.entries(entries).map(([id, [total, count]]) => [id, { total, count }]));
}

describe('assembleCategoryTree', () => {
  it('nests the rows and orders siblings by sortOrder', () => {
    const roots = assembleCategoryTree(threeLevelTree(), new Map());

    expect(roots.map((node) => node.category.id)).toEqual([OPERATIONS, RENT]);
    expect(roots[0].children[0].children.map((node) => node.category.id)).toEqual([
      SPARE_PARTS,
      LABOUR,
    ]);
  });

  it('rolls a grandchild total all the way up to the root', () => {
    const roots = assembleCategoryTree(
      threeLevelTree(),
      aggregates({ [SPARE_PARTS]: [24200, 31], [LABOUR]: [4200, 6] }),
    );

    const operations = roots[0];
    const maintenance = operations.children[0];

    expect(operations.directTotal).toBe(0);
    expect(operations.rolledUpTotal).toBe(28400);
    expect(operations.rolledUpCount).toBe(37);
    expect(maintenance.rolledUpTotal).toBe(28400);
    expect(maintenance.children[0].rolledUpTotal).toBe(24200);
  });

  it('adds a node\u2019s own spend to what its descendants contribute', () => {
    const roots = assembleCategoryTree(
      threeLevelTree(),
      aggregates({ [MAINTENANCE]: [1000, 2], [SPARE_PARTS]: [500, 1] }),
    );

    expect(roots[0].children[0].directTotal).toBe(1000);
    expect(roots[0].children[0].rolledUpTotal).toBe(1500);
  });

  it('makes a node whose parent was filtered out a root, so a subtree needs no second pass', () => {
    const rows = threeLevelTree();
    const maintenance = rows[1];
    const roots = assembleCategoryTree(subtreeRows(rows, maintenance), new Map());

    expect(roots.map((node) => node.category.id)).toEqual([MAINTENANCE]);
    expect(roots[0].children).toHaveLength(2);
  });

  it('trims the pennies that accumulate summing floats at each level', () => {
    const roots = assembleCategoryTree(
      threeLevelTree(),
      aggregates({ [SPARE_PARTS]: [0.1, 1], [LABOUR]: [0.2, 1] }),
    );

    expect(roots[0].rolledUpTotal).toBe(0.3);
  });
});

describe('pruneCategoryTree', () => {
  it('drops a rejected node together with its whole subtree', () => {
    const rows = threeLevelTree();
    rows[1].isActive = false;

    const roots = pruneCategoryTree(
      assembleCategoryTree(rows, new Map()),
      (node) => node.category.isActive,
    );

    expect(flattenCategoryTree(roots).map((node) => node.category.id)).toEqual([OPERATIONS, RENT]);
  });

  it('leaves the roll-up of a hidden node inside its ancestors, since the history stands', () => {
    const rows = threeLevelTree();
    rows[2].isActive = false;

    const roots = pruneCategoryTree(
      assembleCategoryTree(rows, aggregates({ [SPARE_PARTS]: [24200, 31] })),
      (node) => node.category.isActive,
    );

    expect(roots[0].rolledUpTotal).toBe(24200);
    expect(roots[0].children[0].children).toHaveLength(1);
  });
});

describe('limitTreeDepth', () => {
  it('returns the roots alone at depth 0', () => {
    const roots = limitTreeDepth(assembleCategoryTree(threeLevelTree(), new Map()), 0);

    expect(roots).toHaveLength(2);
    expect(roots[0].children).toEqual([]);
  });

  it('keeps the roll-ups of the levels it cut away', () => {
    const roots = limitTreeDepth(
      assembleCategoryTree(threeLevelTree(), aggregates({ [SPARE_PARTS]: [24200, 31] })),
      1,
    );

    expect(roots[0].children[0].rolledUpTotal).toBe(24200);
    expect(roots[0].children[0].children).toEqual([]);
  });
});

describe('categoryName', () => {
  it('reads the requested locale', () => {
    const rows = threeLevelTree();

    expect(categoryName(rows[1], 'en')).toBe('Maintenance');
    expect(categoryName(rows[1], DEFAULT_LOCALE)).toBe('صيانة');
  });
});

describe('localizedCategoryPath', () => {
  it('reads the ancestry off the materialized path', () => {
    const rows = threeLevelTree();

    expect(localizedCategoryPath(rows[2], indexByPathLabel(rows), DEFAULT_LOCALE)).toBe(
      'مصاريف تشغيل / صيانة / قطع غيار',
    );
  });

  it('skips an ancestor the caller did not load rather than rendering a blank segment', () => {
    const rows = threeLevelTree();
    const withoutRoot = indexByPathLabel(rows.filter((row) => row.id !== OPERATIONS));

    expect(localizedCategoryPath(rows[2], withoutRoot, DEFAULT_LOCALE)).toBe('صيانة / قطع غيار');
  });
});

describe('indexByPathLabel', () => {
  it('keys on the hyphen-free label the path actually carries', () => {
    const rows = threeLevelTree();

    expect(indexByPathLabel(rows).get(toPathLabel(MAINTENANCE))?.id).toBe(MAINTENANCE);
  });
});
