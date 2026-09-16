import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DataTable, type DataTableColumn } from './data-table';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => {
    if (key === 'web.table.rows') {
      return `${values?.from}–${values?.to} of ${values?.total}`;
    }
    if (key === 'web.table.selected') return `${values?.count} selected`;
    if (key === 'web.table.page') return 'Page';
    return key;
  },
  useLocale: () => 'en',
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children?: React.ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

type Row = { id: string; name: string };

const columns: DataTableColumn<Row>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: 'Name',
    meta: { label: 'Name', locked: true },
  },
];

const data: Row[] = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
  { id: '3', name: 'Gamma' },
];

describe('DataTable', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders a numbered pager from PageMeta and clears selection on page change', async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    const { rerender } = render(
      <DataTable
        columns={columns}
        data={data}
        meta={{ page: 1, limit: 20, total: 43, totalPages: 3, hasNext: true }}
        state={{ page: 1, limit: 20 }}
        onStateChange={onStateChange}
        selection={{ enabled: true }}
        columnVisibility={{ storageKey: 'test.columns' }}
      />,
    );

    expect(screen.getByText('1–20 of 43')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Alpha').closest('table')?.querySelector('caption')).toBeTruthy();

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]!);
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    rerender(
      <DataTable
        columns={columns}
        data={data}
        meta={{ page: 2, limit: 20, total: 43, totalPages: 3, hasNext: true }}
        state={{ page: 2, limit: 20 }}
        onStateChange={onStateChange}
        selection={{ enabled: true }}
        columnVisibility={{ storageKey: 'test.columns' }}
      />,
    );

    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
  });

  it('shows load more for CursorMeta', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        meta={{ limit: 20, nextCursor: 'abc', hasNext: true }}
        state={{ limit: 20 }}
        onStateChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'web.table.loadMore' })).toBeInTheDocument();
  });

  it('exposes rowHref as a real anchor', () => {
    render(
      <DataTable
        columns={columns}
        data={data}
        state={{ page: 1 }}
        onStateChange={vi.fn()}
        rowHref={(row) => `/machines/${row.id}`}
        density={false}
      />,
    );
    const links = screen.getAllByRole('link', { name: 'web.table.openRow' });
    expect(links[0]).toHaveAttribute('href', '/machines/1');
    expect(links).toHaveLength(3);
  });
});
