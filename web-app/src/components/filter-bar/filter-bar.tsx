'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { can } from '@/lib/auth/can';
import { useSession } from '@/lib/auth/use-session';
import { cn } from '@/lib/utils';

type FilterValues = Record<string, unknown>;

type FilterBarContextValue = {
  state: FilterValues;
  onChange: (patch: Partial<FilterValues>) => void;
  onReset: () => void;
  registerChip: (chip: ActiveChip | null) => void;
};

type ActiveChip = {
  key: string;
  label: string;
  onRemove: () => void;
};

const FilterBarContext = createContext<FilterBarContextValue | null>(null);

function useFilterBar() {
  const ctx = useContext(FilterBarContext);
  if (!ctx) throw new Error('Filter controls must be used inside FilterBar');
  return ctx;
}

type FilterBarProps = {
  state: FilterValues;
  onChange: (patch: Partial<FilterValues>) => void;
  onReset: () => void;
  children: ReactNode;
  storageKey?: string;
  className?: string;
};

type SavedView = { id: string; name: string; query: string };

export function FilterBar({
  state,
  onChange,
  onReset,
  children,
  storageKey = 'filters.views',
  className,
}: FilterBarProps) {
  const t = useTranslations();
  const [chips, setChips] = useState<Record<string, ActiveChip>>({});
  const [viewName, setViewName] = useState('');
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') as SavedView[];
    } catch {
      return [];
    }
  });

  const registerChip = useCallback((chip: ActiveChip | null) => {
    setChips((prev) => {
      if (!chip) return prev;
      if (prev[chip.key]?.label === chip.label) return prev;
      return { ...prev, [chip.key]: chip };
    });
  }, []);

  // Clear stale chip keys when filters removed externally
  useEffect(() => {
    setChips((prev) => {
      const next: Record<string, ActiveChip> = {};
      for (const [key, chip] of Object.entries(prev)) {
        const value = state[key];
        const active =
          value !== undefined &&
          value !== null &&
          value !== '' &&
          !(Array.isArray(value) && value.length === 0);
        // date range uses from/to keys stored on chip.key like "dateFrom|dateTo"
        if (key.includes('|')) {
          const [a, b] = key.split('|');
          if (state[a!] || state[b!]) next[key] = chip;
          continue;
        }
        if (active) next[key] = chip;
      }
      return next;
    });
  }, [state]);

  const activeList = Object.values(chips);

  const persistViews = (views: SavedView[]) => {
    setSavedViews(views);
    window.localStorage.setItem(storageKey, JSON.stringify(views));
  };

  const saveCurrentView = () => {
    const name = viewName.trim();
    if (!name) return;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(state)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) value.forEach((v) => params.append(key, String(v)));
      else params.set(key, String(value));
    }
    persistViews([
      ...savedViews.filter((v) => v.name !== name),
      { id: crypto.randomUUID(), name, query: params.toString() },
    ]);
    setViewName('');
  };

  const applyView = (view: SavedView) => {
    const params = new URLSearchParams(view.query);
    const patch: FilterValues = {};
    for (const key of new Set(params.keys())) {
      const all = params.getAll(key);
      patch[key] = all.length > 1 ? all : all[0];
    }
    onReset();
    onChange(patch);
  };

  return (
    <FilterBarContext.Provider value={{ state, onChange, onReset, registerChip }}>
      <div data-slot="filter-bar" className={cn('space-y-sm', className)}>
        {activeList.length > 0 ? (
          <div
            className="flex flex-wrap items-center gap-xs"
            aria-label={t('web.filters.activeFilters')}
          >
            {activeList.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="inline-flex items-center gap-xs rounded-pill bg-surface-alt px-sm py-xs t-caption hover:bg-neutral-surface"
                onClick={chip.onRemove}
                aria-label={t('web.filters.removeFilter', { label: chip.label })}
              >
                {chip.label}
                <span aria-hidden>×</span>
              </button>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={onReset}>
              {t('web.filters.clearAll')}
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-sm">{children}</div>

        <div className="flex flex-wrap items-center gap-sm">
          <Input
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder={t('web.filters.saveViewPrompt')}
            aria-label={t('web.filters.saveViewName')}
            className="max-w-xs"
          />
          <Button type="button" size="sm" variant="outline" onClick={saveCurrentView}>
            {t('web.filters.saveView')}
          </Button>
          {savedViews.length > 0 ? (
            <div className="flex flex-wrap items-center gap-xs" aria-label={t('web.filters.savedViews')}>
              {savedViews.map((view) => (
                <span key={view.id} className="inline-flex items-center gap-xs">
                  <Button type="button" size="sm" variant="ghost" onClick={() => applyView(view)}>
                    {view.name}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={t('web.filters.deleteView')}
                    onClick={() => persistViews(savedViews.filter((v) => v.id !== view.id))}
                  >
                    ×
                  </Button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </FilterBarContext.Provider>
  );
}

function useChip(key: string, label: string, active: boolean, onRemove: () => void) {
  const { registerChip } = useFilterBar();
  useEffect(() => {
    if (active) registerChip({ key, label, onRemove });
  }, [active, key, label, onRemove, registerChip]);
}

type SearchFilterProps = {
  name: string;
  placeholder?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
  debounceMs?: number;
};

export function SearchFilter({
  name,
  placeholder,
  dir = 'auto',
  debounceMs = 300,
}: SearchFilterProps) {
  const t = useTranslations();
  const { state, onChange } = useFilterBar();
  const value = typeof state[name] === 'string' ? (state[name] as string) : '';
  const [local, setLocal] = useState(value);

  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (local !== value) onChange({ [name]: local || undefined });
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, local, name, onChange, value]);

  useChip(name, local || t('web.filters.search'), !!local, () => onChange({ [name]: undefined }));

  return (
    <div className="min-w-[220px] flex-1 space-y-xs">
      <label className="t-caption text-text-secondary" htmlFor={`filter-${name}`}>
        {t('web.filters.search')}
      </label>
      <Input
        id={`filter-${name}`}
        data-filter-search
        dir={dir}
        value={local}
        placeholder={placeholder ?? t('web.filters.search')}
        onChange={(e) => setLocal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setLocal('');
            onChange({ [name]: undefined });
          }
        }}
      />
    </div>
  );
}

type SelectFilterProps = {
  name: string;
  label?: string;
  options: { value: string; label: string }[];
  multiple?: boolean;
};

export function SelectFilter({ name, label, options, multiple }: SelectFilterProps) {
  const { state, onChange } = useFilterBar();
  const raw = state[name];
  const selected = useMemo(() => {
    if (multiple) {
      if (Array.isArray(raw)) return raw.map(String);
      return raw ? [String(raw)] : [];
    }
    return typeof raw === 'string' ? raw : '';
  }, [multiple, raw]);

  const chipLabel = useMemo(() => {
    if (multiple && Array.isArray(selected)) {
      const labels = options.filter((o) => selected.includes(o.value)).map((o) => o.label);
      return labels.join(', ');
    }
    return options.find((o) => o.value === selected)?.label ?? '';
  }, [multiple, options, selected]);

  useChip(
    name,
    `${label ?? name}: ${chipLabel}`,
    multiple && Array.isArray(selected) ? selected.length > 0 : !!selected,
    () => onChange({ [name]: undefined }),
  );

  if (multiple) {
    const multiSelected = Array.isArray(selected) ? selected : [];
    return (
      <div className="min-w-[180px] space-y-xs">
        {label ? <span className="t-caption text-text-secondary">{label}</span> : null}
        <select
          multiple
          className="min-h-20 w-full rounded-lg border border-border bg-surface px-sm t-body"
          value={multiSelected}
          onChange={(e) => {
            const values = Array.from(e.target.selectedOptions).map((o) => o.value);
            onChange({ [name]: values.length ? values : undefined });
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="min-w-[160px] space-y-xs">
      {label ? (
        <label className="t-caption text-text-secondary" htmlFor={`filter-${name}`}>
          {label}
        </label>
      ) : null}
      <select
        id={`filter-${name}`}
        className="h-8 w-full rounded-lg border border-border bg-surface px-sm t-body"
        value={typeof selected === 'string' ? selected : ''}
        onChange={(e) => onChange({ [name]: e.target.value || undefined })}
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type BranchFilterProps = {
  name?: string;
  /** Permission that must include *.read.all — defaults to any READ_ALL. */
  readAllPerm: string;
};

export function BranchFilter({ name = 'branchId', readAllPerm }: BranchFilterProps) {
  const t = useTranslations();
  const { permissions } = useSession();
  const { state, onChange } = useFilterBar();
  const allowed = can(permissions, readAllPerm);

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', 'filter'],
    enabled: allowed,
    queryFn: async () => {
      const result = await api.get<{ items?: { id: string; name: string }[] } | { id: string; name: string }[]>(
        endpoints.branches.list,
        { limit: 100 },
      );
      const payload = result.data;
      return Array.isArray(payload) ? payload : (payload?.items ?? []);
    },
  });

  const value = typeof state[name] === 'string' ? (state[name] as string) : '';
  const label = branches.find((b) => b.id === value)?.name ?? value;

  useChip(name, `${t('web.filters.branch')}: ${label}`, allowed && !!value, () =>
    onChange({ [name]: undefined }),
  );

  if (!allowed) return null;

  return (
    <div className="min-w-[160px] space-y-xs">
      <label className="t-caption text-text-secondary" htmlFor={`filter-${name}`}>
        {t('web.filters.branch')}
      </label>
      <select
        id={`filter-${name}`}
        className="h-8 w-full rounded-lg border border-border bg-surface px-sm t-body"
        value={value}
        onChange={(e) => onChange({ [name]: e.target.value || undefined })}
      >
        <option value="">{t('web.filters.allBranches')}</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}

type LookupFilterProps = {
  name: string;
  label: string;
  endpoint: string;
  mapOption?: (item: Record<string, unknown>) => { value: string; label: string };
};

export function LookupFilter({
  name,
  label,
  endpoint,
  mapOption = (item) => ({
    value: String(item.id ?? ''),
    label: String(item.name ?? item.label ?? item.id ?? ''),
  }),
}: LookupFilterProps) {
  const { state, onChange } = useFilterBar();
  const [search, setSearch] = useState('');

  const { data: options = [] } = useQuery({
    queryKey: ['lookup-filter', endpoint, search],
    queryFn: async () => {
      const result = await api.get<unknown>(endpoint, search ? { search, limit: 30 } : { limit: 30 });
      const payload = result.data;
      const items = Array.isArray(payload)
        ? payload
        : payload && typeof payload === 'object' && 'items' in payload
          ? ((payload as { items: unknown[] }).items ?? [])
          : [];
      return items
        .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
        .map(mapOption);
    },
  });

  const value = typeof state[name] === 'string' ? (state[name] as string) : '';
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;
  useChip(name, `${label}: ${selectedLabel}`, !!value, () => onChange({ [name]: undefined }));

  return (
    <div className="min-w-[180px] space-y-xs">
      <span className="t-caption text-text-secondary">{label}</span>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={label}
        aria-label={label}
      />
      <select
        className="h-8 w-full rounded-lg border border-border bg-surface px-sm t-body"
        value={value}
        onChange={(e) => onChange({ [name]: e.target.value || undefined })}
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type DateRangeFilterProps = {
  from: string;
  to: string;
  label?: string;
};

export function DateRangeFilter({ from, to, label }: DateRangeFilterProps) {
  const t = useTranslations();
  const { state, onChange } = useFilterBar();
  const fromVal = typeof state[from] === 'string' ? (state[from] as string) : '';
  const toVal = typeof state[to] === 'string' ? (state[to] as string) : '';
  const active = !!(fromVal || toVal);

  useChip(
    `${from}|${to}`,
    `${label ?? t('web.filters.dateFrom')}: ${fromVal || '…'} → ${toVal || '…'}`,
    active,
    () => onChange({ [from]: undefined, [to]: undefined }),
  );

  return (
    <div className="flex flex-wrap items-end gap-sm">
      <div className="space-y-xs">
        <label className="t-caption text-text-secondary" htmlFor={`filter-${from}`}>
          {t('web.filters.dateFrom')}
        </label>
        <Input
          id={`filter-${from}`}
          type="date"
          dir="ltr"
          className="t-mono"
          value={fromVal}
          onChange={(e) => onChange({ [from]: e.target.value || undefined })}
        />
      </div>
      <div className="space-y-xs">
        <label className="t-caption text-text-secondary" htmlFor={`filter-${to}`}>
          {t('web.filters.dateTo')}
        </label>
        <Input
          id={`filter-${to}`}
          type="date"
          dir="ltr"
          className="t-mono"
          value={toVal}
          onChange={(e) => onChange({ [to]: e.target.value || undefined })}
        />
      </div>
    </div>
  );
}

type BooleanFilterProps = {
  name: string;
  label: string;
};

export function BooleanFilter({ name, label }: BooleanFilterProps) {
  const t = useTranslations();
  const { state, onChange } = useFilterBar();
  const raw = state[name];
  const value =
    raw === true || raw === 'true' ? 'true' : raw === false || raw === 'false' ? 'false' : '';

  useChip(
    name,
    `${label}: ${value === 'true' ? t('web.filters.booleanYes') : t('web.filters.booleanNo')}`,
    value !== '',
    () => onChange({ [name]: undefined }),
  );

  return (
    <div className="min-w-[140px] space-y-xs">
      <label className="t-caption text-text-secondary" htmlFor={`filter-${name}`}>
        {label}
      </label>
      <select
        id={`filter-${name}`}
        className="h-8 w-full rounded-lg border border-border bg-surface px-sm t-body"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          onChange({ [name]: v === '' ? undefined : v === 'true' });
        }}
      >
        <option value="">{t('web.filters.booleanAny')}</option>
        <option value="true">{t('web.filters.booleanYes')}</option>
        <option value="false">{t('web.filters.booleanNo')}</option>
      </select>
    </div>
  );
}
