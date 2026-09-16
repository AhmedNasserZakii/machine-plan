export const can = (perms: readonly string[], p: string) => perms.includes(p);

export const canAny = (perms: readonly string[], ps: readonly string[]) =>
  ps.some((p) => perms.includes(p));

export const canAll = (perms: readonly string[], ps: readonly string[]) =>
  ps.every((p) => perms.includes(p));
