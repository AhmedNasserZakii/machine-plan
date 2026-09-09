/** Central registry of cache key shapes, so invalidation never guesses a prefix. */
export const CacheKeys = {
  userPermissions: (userId: string) => `perm:${userId}`,
  userPermissionsPattern: () => 'perm:*',
  loginAttempts: (phone: string, ip: string) => `login:attempts:${phone}:${ip}`,
  loginLock: (phone: string, ip: string) => `login:lock:${phone}:${ip}`,
  passwordChangeAttempts: (userId: string) => `pwchange:attempts:${userId}`,
  passwordChangeLock: (userId: string) => `pwchange:lock:${userId}`,
  report: (reportKey: string, hash: string) => `report:${reportKey}:${hash}`,
  reportPattern: (reportKey: string) => `report:${reportKey}:*`,
  /**
   * `17`, rule 7. The caller's id is part of the key because branch scope is resolved per
   * principal: two supervisors asking for the same report are asking two different questions.
   */
  reportForUser: (reportKey: string, filtersHash: string, userId: string) =>
    `report:${reportKey}:${filtersHash}:${userId}`,
  notificationTemplates: (locale: string) => `notif:templates:${locale}`,
  setting: (key: string) => `setting:${key}`,
} as const;
