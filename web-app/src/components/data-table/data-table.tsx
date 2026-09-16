'use client';

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type Row,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, Columns3, Rows3 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ErrorState } from '@/components/feedback/error-state';
import { TableSkeleton } from '@/components/feedback/table-skeleton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link } from '@/i18n/navigation';
import { isCursorMeta, isPageMeta, type ListMeta } from '@/lib/api/pagination';
import { cn } from '@/lib/utils';

export type DataTableColumnMeta = {
  label: string;
  /** Identifier columns cannot be hidden. */
  locked?: boolean;
};

export type DataTableColumn<T> = ColumnDef<T, unknown> & {
  id: string;
  meta?: DataTableColumnMeta;
};

export type DataTableSortState = {
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  cursor?: string | null;
};

export type BulkAction<T> = {
  id: string;
  label: string;
  onClick: (rows: T[]) => void;
  destructive?: boolean;
};

export type DataTableSelection<T> = {
  enabled: boolean;
  bulkActions?: BulkAction<T>[];
  getRowId?: (row: T) => string;
};

type Density = 'compact' | 'comfortable';

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  meta?: ListMeta | null;
  state: DataTableSortState;
  onStateChange: (patch: Partial<DataTableSortState>) => void;
  /** Columns the endpoint allows sorting on. */
  sortableColumns?: readonly string[];
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyState?: ReactNode;
  caption?: string;
  rowHref?: (row: T) => string;
  onRowPrefetch?: (row: T) => void;
  selection?: DataTableSelection<T>;
  columnVisibility?: { storageKey: string };
  density?: boolean | { storageKey?: string };
  sticky?: { header?: boolean; firstColumn?: boolean };
  getRowId?: (row: T) => string;
  className?: string;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function selectionFingerprint(state: DataTableSortState): string {
  const filters = { ...state } as Record<string, unknown>;
  delete filters.page;
  delete filters.limit;
  delete filters.cursor;
  delete filters.sortBy;
  delete filters.sortDir;
  return JSON.stringify({
    page: state.page,
    limit: state.limit,
    cursor: state.cursor,
    filters,
  });
}

export function DataTable<T>({
  columns,
  data,
  meta,
  state,
  onStateChange,
  sortableColumns,
  isLoading,
  isFetching,
  error,
  onRetry,
  emptyState,
  caption,
  rowHref,
  onRowPrefetch,
  selection,
  columnVisibility,
  density: densityProp = true,
  sticky = { header: true, firstColumn: true },
  getRowId: getRowIdProp,
  className,
}: DataTableProps<T>) {
  const t = useTranslations();
  const densityKey =
    typeof densityProp === 'object' && densityProp.storageKey
      ? densityProp.storageKey
      : columnVisibility?.storageKey
        ? `${columnVisibility.storageKey}.density`
        : 'datatable.density';
  const visibilityKey = columnVisibility?.storageKey ?? 'datatable.columns';

  const [density, setDensity] = useState<Density>(() =>
    readJson<Density>(densityKey, 'comfortable'),
  );
  const [visibility, setVisibility] = useState<VisibilityState>(() =>
    readJson<VisibilityState>(visibilityKey, {}),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedIndex = useRef<number | null>(null);
  const prefetchTimer = useRef<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const getRowId = useCallback(
    (row: T, index: number) => {
      if (selection?.getRowId) return selection.getRowId(row);
      if (getRowIdProp) return getRowIdProp(row);
      if (row && typeof row === 'object' && 'id' in row) return String((row as { id: unknown }).id);
      return String(index);
    },
    [getRowIdProp, selection],
  );

  const fingerprint = selectionFingerprint(state);
  useEffect(() => {
    setSelectedIds(new Set());
    lastClickedIndex.current = null;
  }, [fingerprint]);

  useEffect(() => {
    writeJson(densityKey, density);
  }, [density, densityKey]);

  useEffect(() => {
    writeJson(visibilityKey, visibility);
  }, [visibility, visibilityKey]);

  const sortable = useMemo(
    () => new Set(sortableColumns ?? columns.filter((c) => c.enableSorting).map((c) => c.id)),
    [columns, sortableColumns],
  );

  const tableColumns = useMemo(() => {
    const cols: DataTableColumn<T>[] = [...columns];
    if (selection?.enabled) {
      cols.unshift({
        id: '__select',
        enableSorting: false,
        enableHiding: false,
        meta: { label: t('web.table.selectRow'), locked: true },
        header: ({ table: tbl }) => {
          const pageIds = tbl.getRowModel().rows.map((r) => r.id);
          const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
          const someSelected = pageIds.some((id) => selectedIds.has(id));
          return (
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = someSelected && !allSelected;
              }}
              aria-label={t('web.table.selectAll')}
              onChange={(e) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (e.target.checked) pageIds.forEach((id) => next.add(id));
                  else pageIds.forEach((id) => next.delete(id));
                  return next;
                });
              }}
            />
          );
        },
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={selectedIds.has(row.id)}
            aria-label={t('web.table.selectRow')}
            onClick={(e: MouseEvent<HTMLInputElement>) => {
              e.stopPropagation();
              e.preventDefault();
              const index = row.index;
              const shift = e.shiftKey;
              const willSelect = !selectedIds.has(row.id);
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (shift && lastClickedIndex.current !== null) {
                  const start = Math.min(lastClickedIndex.current, index);
                  const end = Math.max(lastClickedIndex.current, index);
                  for (let i = start; i <= end; i += 1) {
                    const id = data[i] ? getRowId(data[i]!, i) : null;
                    if (!id) continue;
                    if (willSelect) next.add(id);
                    else next.delete(id);
                  }
                } else if (willSelect) {
                  next.add(row.id);
                } else {
                  next.delete(row.id);
                }
                return next;
              });
              lastClickedIndex.current = index;
            }}
            onChange={() => {
              /* selection handled in onClick for shift-range support */
            }}
          />
        ),
      });
    }
    return cols.map((col) => ({
      ...col,
      enableSorting: sortable.has(col.id),
      enableHiding: col.meta?.locked || col.id === '__select' ? false : col.enableHiding !== false,
    }));
  }, [columns, data, getRowId, selectedIds, selection?.enabled, sortable, t]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { columnVisibility: visibility },
    onColumnVisibilityChange: setVisibility,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row, index) => getRowId(row, index),
    manualSorting: true,
    manualPagination: true,
  });

  const selectedRows = useMemo(() => {
    return data.filter((row, index) => selectedIds.has(getRowId(row, index)));
  }, [data, getRowId, selectedIds]);

  const schedulePrefetch = (row: T) => {
    if (!onRowPrefetch) return;
    if (prefetchTimer.current) window.clearTimeout(prefetchTimer.current);
    prefetchTimer.current = window.setTimeout(() => onRowPrefetch(row), 150);
  };

  const clearPrefetch = () => {
    if (prefetchTimer.current) {
      window.clearTimeout(prefetchTimer.current);
      prefetchTimer.current = null;
    }
  };

  const toggleSort = (columnId: string) => {
    if (!sortable.has(columnId)) return;
    if (state.sortBy === columnId) {
      onStateChange({
        sortBy: columnId,
        sortDir: state.sortDir === 'asc' ? 'desc' : 'asc',
        page: 1,
      });
    } else {
      onStateChange({ sortBy: columnId, sortDir: 'asc', page: 1 });
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const rows = table.getRowModel().rows;
    if (!rows.length) return;
    if (e.key === 'j') {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(rows.length - 1, Math.max(0, i + 1)));
    } else if (e.key === 'k') {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(0, i <= 0 ? 0 : i - 1));
    } else if (e.key === 'Enter' && focusedIndex >= 0 && rowHref) {
      const row = rows[focusedIndex]?.original;
      if (row) {
        const href = rowHref(row);
        window.location.assign(href);
      }
    }
  };

  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const rowHeightClass = density === 'compact' ? 'h-10' : 'h-[52px]';

  if (error && !data.length) {
    return <ErrorState error={error} onRetry={onRetry} />;
  }

  if (isLoading && !data.length) {
    return (
      <TableSkeleton
        columns={Math.max(visibleColumnCount, columns.length)}
        density={density}
        className={className}
      />
    );
  }

  if (!isLoading && data.length === 0) {
    return <>{emptyState}</>;
  }

  const pageMeta = isPageMeta(meta) ? meta : null;
  const cursorMeta = isCursorMeta(meta) ? meta : null;

  return (
    <div
      className={cn('relative flex flex-col gap-sm', className)}
      data-slot="data-table"
      data-density={density}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      {isFetching ? (
        <div
          className="absolute inset-inline-0 top-0 z-20 h-0.5 overflow-hidden bg-surface-alt"
          role="status"
          aria-label={t('web.table.fetching')}
        >
          <div className="h-full w-1/3 animate-pulse bg-primary" />
        </div>
      ) : null}

      <div
        data-slot="data-table-toolbar"
        className="no-print flex flex-wrap items-center justify-between gap-sm"
      >
        <div className="flex flex-wrap items-center gap-sm">
          {selectedIds.size > 0 ? (
            <div
              data-slot="data-table-selection"
              className="flex flex-wrap items-center gap-sm rounded-md bg-info-surface px-sm py-xs"
            >
              <span className="t-caption">{t('web.table.selected', { count: selectedIds.size })}</span>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                {t('web.table.clearSelection')}
              </Button>
              {selection?.bulkActions?.map((action) => (
                <Button
                  key={action.id}
                  type="button"
                  size="sm"
                  variant={action.destructive ? 'destructive' : 'outline'}
                  onClick={() => action.onClick(selectedRows)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-xs">
          {columnVisibility ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button type="button" size="sm" variant="outline">
                    <Columns3 className="size-4" aria-hidden />
                    {t('web.table.columns')}
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{t('web.table.columns')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllLeafColumns()
                  .filter((col) => col.id !== '__select')
                  .map((col) => {
                    const locked = (col.columnDef.meta as DataTableColumnMeta | undefined)?.locked;
                    return (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={col.getIsVisible()}
                        disabled={locked || !col.getCanHide()}
                        onCheckedChange={(checked) => col.toggleVisibility(!!checked)}
                      >
                        {(col.columnDef.meta as DataTableColumnMeta | undefined)?.label ?? col.id}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {densityProp ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setDensity((d) => (d === 'compact' ? 'comfortable' : 'compact'))}
              aria-label={t('web.table.density')}
            >
              <Rows3 className="size-4" aria-hidden />
              {density === 'compact' ? t('web.table.densityCompact') : t('web.table.densityComfortable')}
            </Button>
          ) : null}
        </div>
      </div>

      <div
        data-slot="data-table-scroll"
        className="overflow-x-auto rounded-md border border-border bg-surface"
      >
        <table className="w-full min-w-max border-collapse text-start">
          <caption className="sr-only">{caption ?? t('web.table.caption')}</caption>
          <thead
            className={cn(
              'bg-surface-alt t-caption text-text-secondary',
              sticky.header && 'sticky top-0 z-10',
            )}
          >
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header, headerIndex) => {
                  const canSort = header.column.getCanSort() && sortable.has(header.column.id);
                  const isSorted = state.sortBy === header.column.id;
                  const isFirstData =
                    sticky.firstColumn &&
                    (selection?.enabled ? headerIndex === 1 : headerIndex === 0);
                  const label =
                    (header.column.columnDef.meta as DataTableColumnMeta | undefined)?.label ??
                    header.column.id;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      data-sticky={isFirstData || undefined}
                      className={cn(
                        'border-b border-border px-md text-start font-medium whitespace-nowrap',
                        rowHeightClass,
                        isFirstData && 'sticky start-0 z-[11] bg-surface-alt',
                        header.column.id === '__select' && 'w-10 px-sm',
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-xs hover:text-text-primary"
                          onClick={() => toggleSort(header.column.id)}
                          aria-label={
                            isSorted && state.sortDir === 'asc'
                              ? t('web.table.sortDesc')
                              : t('web.table.sortAsc')
                          }
                        >
                          {header.column.columnDef.header
                            ? flexRender(header.column.columnDef.header, header.getContext())
                            : label}
                          {isSorted ? (
                            state.sortDir === 'asc' ? (
                              <ArrowUp className="size-3.5" aria-hidden />
                            ) : (
                              <ArrowDown className="size-3.5" aria-hidden />
                            )
                          ) : null}
                        </button>
                      ) : (
                        <span>
                          {header.column.columnDef.header
                            ? flexRender(header.column.columnDef.header, header.getContext())
                            : label}
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, rowIndex) => (
              <DataTableRow
                key={row.id}
                row={row}
                rowIndex={rowIndex}
                focused={focusedIndex === rowIndex}
                densityClass={rowHeightClass}
                stickyFirst={!!sticky.firstColumn}
                selectionEnabled={!!selection?.enabled}
                href={rowHref?.(row.original)}
                openLabel={t('web.table.openRow')}
                onMouseEnter={() => schedulePrefetch(row.original)}
                onMouseLeave={clearPrefetch}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-sm t-caption text-text-secondary">
        {pageMeta ? (
          <>
            <span>
              {t('web.table.rows', {
                from: pageMeta.total === 0 ? 0 : (pageMeta.page - 1) * pageMeta.limit + 1,
                to: Math.min(pageMeta.page * pageMeta.limit, pageMeta.total),
                total: pageMeta.total,
              })}
            </span>
            <div className="flex flex-wrap items-center gap-sm">
              <label className="inline-flex items-center gap-xs">
                <span>{t('web.table.limit')}</span>
                <select
                  className="h-8 rounded-md border border-border bg-surface px-sm"
                  value={state.limit ?? pageMeta.limit}
                  onChange={(e) =>
                    onStateChange({ limit: Number(e.target.value), page: 1 })
                  }
                >
                  {[20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-center gap-xs">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pageMeta.page <= 1}
                  aria-label={t('web.table.previousPage')}
                  onClick={() => onStateChange({ page: Math.max(1, pageMeta.page - 1) })}
                >
                  ‹
                </Button>
                <span>
                  {t('web.table.page')} {pageMeta.page} / {pageMeta.totalPages}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!pageMeta.hasNext}
                  aria-label={t('web.table.nextPage')}
                  onClick={() => onStateChange({ page: pageMeta.page + 1 })}
                >
                  ›
                </Button>
              </div>
            </div>
          </>
        ) : null}
        {cursorMeta ? (
          <div className="ms-auto">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!cursorMeta.hasNext || !cursorMeta.nextCursor || isFetching}
              onClick={() => onStateChange({ cursor: cursorMeta.nextCursor ?? undefined })}
            >
              {t('web.table.loadMore')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DataTableRow<T>({
  row,
  focused,
  densityClass,
  stickyFirst,
  selectionEnabled,
  href,
  openLabel,
  onMouseEnter,
  onMouseLeave,
}: {
  row: Row<T>;
  rowIndex: number;
  focused: boolean;
  densityClass: string;
  stickyFirst: boolean;
  selectionEnabled: boolean;
  href?: string;
  openLabel: string;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  return (
    <tr
      data-focused={focused || undefined}
      className={cn(
        'border-b border-divider hover:bg-surface-alt/60',
        focused && 'bg-info-surface/50',
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {row.getVisibleCells().map((cell, cellIndex) => {
        const isFirstData = stickyFirst && (selectionEnabled ? cellIndex === 1 : cellIndex === 0);
        const isSelect = cell.column.id === '__select';
        return (
          <td
            key={cell.id}
            data-sticky={isFirstData || undefined}
            className={cn(
              'relative px-md text-start t-body',
              densityClass,
              isFirstData && 'sticky start-0 z-[1] bg-surface',
              isSelect && 'w-10 px-sm',
            )}
          >
            {href && isFirstData ? (
              <>
                <Link href={href} className="absolute inset-0 z-[1]" aria-label={openLabel} />
                <div className="relative z-0 pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto [&_label]:pointer-events-auto">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              </>
            ) : (
              <div className={cn(isSelect && 'relative z-[2]')}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
}
