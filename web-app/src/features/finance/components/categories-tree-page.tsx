'use client';

import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Money } from '@/components/common/money';
import { StatusChip } from '@/components/common/status-chip';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { EmptyState } from '@/components/feedback/empty-state';
import { ErrorState } from '@/components/feedback/error-state';
import { PageHeader } from '@/components/feedback/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link } from '@/i18n/navigation';
import { ApiError } from '@/lib/api/client';
import { ErrorCode } from '@/lib/api/error-codes';
import { cn } from '@/lib/utils';

import {
  useCategoriesTree,
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useMoveCategoryMutation,
  useUpdateCategoryMutation,
} from '../hooks';
import { findCategory } from '../lib/categories';
import type { FinanceCategory, FinanceKind } from '../model';

function CategoryNodeRow({
  node,
  depth,
  selectedId,
  expanded,
  onToggle,
  onSelect,
  onDragStart,
  onDrop,
  search,
}: {
  node: FinanceCategory;
  depth: number;
  selectedId: string | null;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDrop: (targetId: string | null) => void;
  search: string;
}) {
  const t = useTranslations();
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const isOpen = expanded.has(node.id);
  const q = search.trim().toLowerCase();
  const matches = !q || node.name.toLowerCase().includes(q);
  const childMatches = hasChildren; // always render children so search can find descendants

  if (!matches && !childMatches && q) {
    // Still walk children for matches
  }

  return (
    <li>
      <div
        role="treeitem"
        aria-selected={selectedId === node.id}
        aria-expanded={hasChildren ? isOpen : undefined}
        draggable={!node.isSystem}
        onDragStart={() => onDragStart(node.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onDrop(node.id);
        }}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(node.id);
          }
        }}
        tabIndex={0}
        className={cn(
          'flex cursor-pointer items-center gap-xs rounded-sm px-sm py-xs hover:bg-surface-alt',
          selectedId === node.id && 'bg-info-surface',
          q && matches && 'ring-1 ring-primary',
        )}
        style={{ paddingInlineStart: `calc(var(--spacing-sm) + ${depth} * var(--spacing-md))` }}
      >
        <span className="text-text-disabled" aria-hidden>
          <GripVertical className="size-3.5" />
        </span>
        {hasChildren ? (
          <button
            type="button"
            className="rounded-sm p-xs hover:bg-neutral-surface"
            aria-label={isOpen ? t('web.common.close') : t('shared.finance_open_subcategories')}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
          >
            {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : (
          <span className="inline-block size-4" />
        )}
        <span className="min-w-0 flex-1 truncate t-body">{node.name}</span>
        {node.isSystem ? (
          <StatusChip status="SYSTEM" tone="neutral" label={t('web.finance.systemCategory')} />
        ) : null}
        <span className="t-caption text-text-secondary t-mono" dir="ltr">
          {node.transactionCount}
        </span>
        <Money value={node.rolledUpTotal} className="t-caption" />
      </div>
      {hasChildren && isOpen ? (
        <ul role="group" className="list-none p-0">
          {children.map((child) => (
            <CategoryNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
              onDragStart={onDragStart}
              onDrop={onDrop}
              search={search}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CategoriesTreePage() {
  const t = useTranslations();
  const [kind, setKind] = useState<FinanceKind | undefined>(undefined);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [creating, setCreating] = useState(false);

  const treeQuery = useCategoriesTree({ kind, includeInactive });
  const createMutation = useCreateCategoryMutation();
  const moveMutation = useMoveCategoryMutation();
  const deleteMutation = useDeleteCategoryMutation();

  const selected = useMemo(
    () => (selectedId ? findCategory(treeQuery.data ?? [], selectedId) : null),
    [treeQuery.data, selectedId],
  );

  const updateMutation = useUpdateCategoryMutation(selected?.id ?? '');

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onDrop = async (targetId: string | null) => {
    if (!draggingId || draggingId === targetId) return;
    try {
      await moveMutation.mutateAsync({
        id: draggingId,
        body: { newParentId: targetId },
      });
      toast.success(t('web.finance.categoryMoved'));
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(t(`errors.${err.code}` as 'errors.CIRCULAR_CATEGORY_REFERENCE'));
      } else {
        toast.error(t('web.errors.generic'));
      }
    } finally {
      setDraggingId(null);
    }
  };

  const onCreate = async () => {
    if (!nameAr.trim()) return;
    const createKind = selected?.kind ?? kind ?? 'EXPENSE';
    try {
      await createMutation.mutateAsync({
        kind: createKind,
        parentId: selected?.id,
        sortOrder: 0,
        translations: {
          ar: { name: nameAr.trim() },
          ...(nameEn.trim() ? { en: { name: nameEn.trim() } } : {}),
        },
      });
      toast.success(t('web.finance.categoryCreated'));
      setNameAr('');
      setNameEn('');
      setCreating(false);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(t(`errors.${err.code}` as 'errors.CATEGORY_KIND_MISMATCH'));
      } else {
        toast.error(t('web.errors.generic'));
      }
    }
  };

  const onRename = async () => {
    if (!selected || selected.isSystem || !nameAr.trim()) return;
    try {
      await updateMutation.mutateAsync({
        translations: {
          ar: { name: nameAr.trim() },
          ...(nameEn.trim() ? { en: { name: nameEn.trim() } } : {}),
        },
      });
      toast.success(t('web.finance.categorySaved'));
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(t(`errors.${err.code}` as 'errors.SYSTEM_CATEGORY_PROTECTED'));
      } else {
        toast.error(t('web.errors.generic'));
      }
    }
  };

  const onDelete = async () => {
    if (!selected) return;
    try {
      await deleteMutation.mutateAsync({ id: selected.id });
      toast.success(t('web.finance.categoryDeleted'));
      setSelectedId(null);
      setDeleteOpen(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === ErrorCode.CATEGORY_HAS_CHILDREN) {
          toast.error(t('web.finance.deleteHasChildren'));
          return;
        }
        if (err.code === ErrorCode.CATEGORY_HAS_TRANSACTIONS) {
          toast.error(t('web.finance.deleteHasTransactions'));
          return;
        }
        if (err.code === ErrorCode.SYSTEM_CATEGORY_PROTECTED) {
          toast.error(t(`errors.${err.code}` as 'errors.SYSTEM_CATEGORY_PROTECTED'));
          return;
        }
        toast.error(t(`errors.${err.code}` as 'errors.INTERNAL_ERROR'));
        return;
      }
      toast.error(t('web.errors.generic'));
    }
  };

  return (
    <div className="space-y-md">
      <PageHeader
        title={t('shared.finance_categories')}
        subtitle={t('web.finance.categoriesSubtitle')}
        actions={
          <Button type="button" onClick={() => setCreating(true)}>
            {t('shared.finance_add_category')}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-sm">
        <select
          className="h-8 rounded-lg border border-border bg-surface px-sm t-body"
          value={kind ?? ''}
          onChange={(e) => setKind((e.target.value || undefined) as FinanceKind | undefined)}
          aria-label={t('shared.finance_kind')}
        >
          <option value="">{t('web.finance.allKinds')}</option>
          <option value="EXPENSE">{t('shared.finance_expense')}</option>
          <option value="INCOME">{t('shared.finance_income')}</option>
        </select>
        <label className="inline-flex items-center gap-xs t-caption">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          {t('web.finance.includeInactive')}
        </label>
        <Input
          className="max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('shared.finance_search_categories')}
        />
      </div>

      {treeQuery.isError ? (
        <ErrorState error={treeQuery.error} onRetry={() => void treeQuery.refetch()} />
      ) : (treeQuery.data ?? []).length === 0 && !treeQuery.isLoading ? (
        <EmptyState
          title={t('shared.finance_no_categories')}
          description={t('shared.finance_no_categories_subtitle')}
        />
      ) : (
        <div className="grid gap-md lg:grid-cols-[1fr_360px]">
          <div
            className="rounded-md border border-border bg-surface p-sm"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onDrop(null);
            }}
          >
            <p className="mb-sm t-caption text-text-secondary">{t('web.finance.dropRootHint')}</p>
            <ul role="tree" className="list-none p-0">
              {(treeQuery.data ?? []).map((node) => (
                <CategoryNodeRow
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedId}
                  expanded={expanded}
                  onToggle={toggle}
                  onSelect={(id) => {
                    setSelectedId(id);
                    const cat = findCategory(treeQuery.data ?? [], id);
                    setNameAr(cat?.name ?? '');
                    setNameEn('');
                  }}
                  onDragStart={setDraggingId}
                  onDrop={(id) => void onDrop(id)}
                  search={search}
                />
              ))}
            </ul>
            {moveMutation.isPending ? (
              <p className="mt-sm t-caption text-text-secondary" role="status">
                {t('web.common.loading')}
              </p>
            ) : null}
          </div>

          <aside className="space-y-md rounded-md border border-border bg-surface p-md">
            {selected ? (
              <>
                <h2 className="t-h3">{selected.name}</h2>
                <dl className="space-y-sm t-body">
                  <div className="flex justify-between gap-sm">
                    <dt className="text-text-secondary">{t('shared.finance_kind')}</dt>
                    <dd>
                      {selected.kind === 'INCOME'
                        ? t('shared.finance_income')
                        : t('shared.finance_expense')}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-sm">
                    <dt className="text-text-secondary">{t('web.finance.transactionsCount')}</dt>
                    <dd className="t-mono" dir="ltr">
                      {selected.transactionCount}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-sm">
                    <dt className="text-text-secondary">{t('web.finance.directTotal')}</dt>
                    <dd>
                      <Money value={selected.totalAmount} />
                    </dd>
                  </div>
                  <div className="flex justify-between gap-sm">
                    <dt className="text-text-secondary">{t('shared.finance_grand_total')}</dt>
                    <dd>
                      <Money value={selected.rolledUpTotal} />
                    </dd>
                  </div>
                </dl>

                {!selected.isSystem ? (
                  <div className="space-y-sm border-t border-divider pt-md">
                    <div className="space-y-xs">
                      <Label htmlFor="cat-name-ar">{t('shared.finance_category_name')} (AR)</Label>
                      <Input
                        id="cat-name-ar"
                        value={nameAr}
                        onChange={(e) => setNameAr(e.target.value)}
                        dir="rtl"
                      />
                    </div>
                    <div className="space-y-xs">
                      <Label htmlFor="cat-name-en">{t('shared.finance_category_name')} (EN)</Label>
                      <Input
                        id="cat-name-en"
                        value={nameEn}
                        onChange={(e) => setNameEn(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                    <div className="flex flex-wrap gap-sm">
                      <Button type="button" onClick={() => void onRename()}>
                        {t('web.form.save')}
                      </Button>
                      <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
                        {t('web.finance.deleteCategory')}
                      </Button>
                    </div>
                    {selected.transactionCount > 0 ? (
                      <Link
                        href={`/finance/transactions?categoryId=${selected.id}`}
                        className="t-caption text-primary underline"
                      >
                        {t('web.finance.showTransactions')}
                      </Link>
                    ) : null}
                  </div>
                ) : (
                  <p className="t-caption text-text-secondary">{t('web.finance.systemLocked')}</p>
                )}
              </>
            ) : (
              <p className="t-body text-text-secondary">{t('shared.finance_selected')}</p>
            )}

            {creating ? (
              <div className="space-y-sm border-t border-divider pt-md">
                <h3 className="t-h3">{t('shared.finance_add_category')}</h3>
                <p className="t-caption text-text-secondary">
                  {selected
                    ? t('web.finance.createUnder', { name: selected.name })
                    : t('shared.finance_root_category')}
                </p>
                <Input
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder={`${t('shared.finance_category_name')} (AR)`}
                  dir="rtl"
                />
                <Input
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder={`${t('shared.finance_category_name')} (EN)`}
                  dir="ltr"
                />
                <div className="flex gap-sm">
                  <Button type="button" onClick={() => void onCreate()} disabled={createMutation.isPending}>
                    {t('web.form.save')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                    {t('shared.cancel')}
                  </Button>
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('shared.finance_delete_category_title')}
        description={t('shared.finance_delete_category_body')}
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
