export type PageMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
};

export type CursorMeta = {
  limit: number;
  nextCursor: string | null;
  hasNext: boolean;
};

export type ListMeta = PageMeta | CursorMeta;

export function isCursorMeta(meta: unknown): meta is CursorMeta {
  return (
    typeof meta === 'object' &&
    meta !== null &&
    'nextCursor' in meta &&
    !('page' in meta) &&
    !('totalPages' in meta)
  );
}

export function isPageMeta(meta: unknown): meta is PageMeta {
  return typeof meta === 'object' && meta !== null && 'page' in meta && 'totalPages' in meta;
}
