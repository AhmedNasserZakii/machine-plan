const enc = encodeURIComponent;

export const endpoints = {
  auth: {
    login: 'auth/login',
    logout: 'auth/logout',
    refresh: 'auth/refresh',
    me: 'auth/me',
    changePassword: 'auth/change-password',
    biometricEnroll: 'auth/biometric/enroll',
    devices: 'auth/devices',
    device: (id: string) => `auth/devices/${enc(id)}`,
  },
  devices: {
    list: 'devices',
    byId: (id: string) => `devices/${enc(id)}`,
  },
  sync: {
    bootstrap: 'sync/bootstrap',
    delta: 'sync/delta',
    batch: 'sync/batch',
    status: 'sync/status',
  },
  machines: {
    list: 'machines',
    byId: (id: string) => `machines/${enc(id)}`,
    bySerial: (serial: string) => `machines/by-serial/${enc(serial)}`,
    bulk: 'machines/bulk',
    lookup: 'machines/lookup',
    timeline: (id: string) => `machines/${enc(id)}/timeline`,
    costSummary: (id: string) => `machines/${enc(id)}/cost-summary`,
    maintenanceHistory: (id: string) => `machines/${enc(id)}/maintenance-history`,
    replacementChain: (id: string) => `machines/${enc(id)}/replacement-chain`,
    replace: (id: string) => `machines/${enc(id)}/replace`,
    decommission: (id: string) => `machines/${enc(id)}/decommission`,
    decommissionRevert: (id: string) => `machines/${enc(id)}/decommission/revert`,
    decommissionCandidates: 'machines/decommission-candidates',
  },
  decommissions: {
    list: 'decommissions',
  },
  replacements: {
    list: 'replacements',
  },
  machineTypes: {
    list: 'machine-types',
    byId: (id: string) => `machine-types/${enc(id)}`,
  },
  machineModels: {
    list: 'machine-models',
    byId: (id: string) => `machine-models/${enc(id)}`,
  },
  transfers: {
    list: 'transfers',
    byId: (id: string) => `transfers/${enc(id)}`,
    incoming: 'transfers/pending/incoming',
    outgoing: 'transfers/pending/outgoing',
    validate: 'transfers/validate',
    recipients: 'transfers/recipients',
    creatableTypes: 'transfers/creatable-types',
    confirm: (id: string) => `transfers/${enc(id)}/confirm`,
    reject: (id: string) => `transfers/${enc(id)}/reject`,
    cancel: (id: string) => `transfers/${enc(id)}/cancel`,
    signatureMedia: (id: string, signatureId: string) =>
      `transfers/${enc(id)}/signatures/${enc(signatureId)}/media`,
  },
  merchants: {
    list: 'merchants',
    byId: (id: string) => `merchants/${enc(id)}`,
    pickable: 'merchants/pickable',
    check: 'merchants/check',
    machines: (id: string) => `merchants/${enc(id)}/machines`,
    timeline: (id: string) => `merchants/${enc(id)}/timeline`,
    subscriptions: (id: string) => `merchants/${enc(id)}/subscriptions`,
    deactivate: (id: string) => `merchants/${enc(id)}/deactivate`,
  },
  subscriptions: {
    byId: (id: string) => `subscriptions/${enc(id)}`,
    collect: (id: string) => `subscriptions/${enc(id)}/collect`,
  },
  maintenance: {
    list: 'maintenance-orders',
    byId: (id: string) => `maintenance-orders/${enc(id)}`,
    send: (id: string) => `maintenance-orders/${enc(id)}/send`,
    receive: (id: string) => `maintenance-orders/${enc(id)}/receive`,
    cancel: (id: string) => `maintenance-orders/${enc(id)}/cancel`,
    close: (id: string) => `maintenance-orders/${enc(id)}/close`,
  },
  violations: {
    list: 'violations',
    byId: (id: string) => `violations/${enc(id)}`,
    acknowledge: (id: string) => `violations/${enc(id)}/acknowledge`,
    charge: (id: string) => `violations/${enc(id)}/charge`,
    waive: (id: string) => `violations/${enc(id)}/waive`,
  },
  finance: {
    summary: 'finance/summary',
    transactions: 'finance/transactions',
    transaction: (id: string) => `finance/transactions/${enc(id)}`,
    transactionVoid: (id: string) => `finance/transactions/${enc(id)}/void`,
    byCategory: 'finance/by-category',
    categories: 'finance/categories',
    categoriesTree: 'finance/categories/tree',
    category: (id: string) => `finance/categories/${enc(id)}`,
    categoryMove: (id: string) => `finance/categories/${enc(id)}/move`,
    categoryBreadcrumb: (id: string) => `finance/categories/${enc(id)}/breadcrumb`,
    budgets: 'finance/budgets',
    budgetsStatus: 'finance/budgets/status',
    budget: (id: string) => `finance/budgets/${enc(id)}`,
    export: 'finance/export',
  },
  reports: {
    catalogue: 'reports',
    machinesInventory: 'reports/machines/inventory',
    machinesCustody: 'reports/machines/custody',
    machinesCosts: 'reports/machines/costs',
    machinesIdle: 'reports/machines/idle',
    machinesWarranty: 'reports/machines/warranty',
    machineLifecycle: (id: string) => `reports/machines/${enc(id)}/lifecycle`,
    transfers: 'reports/transfers',
    transfersPending: 'reports/transfers/pending',
    maintenance: 'reports/maintenance',
    violations: 'reports/violations',
    merchants: 'reports/merchants',
    representatives: 'reports/representatives',
    branchesComparison: 'reports/branches/comparison',
    financeExpenses: 'reports/finance/expenses',
    financeIncome: 'reports/finance/income',
    financePnl: 'reports/finance/pnl',
    financeBudgets: 'reports/finance/budgets',
    job: (id: string) => `reports/jobs/${enc(id)}`,
  },
  notifications: {
    list: 'notifications',
    unreadCount: 'notifications/unread-count',
    read: (id: string) => `notifications/${enc(id)}/read`,
    readAll: 'notifications/read-all',
    preferences: 'notification-preferences',
  },
  users: {
    list: 'users',
    byId: (id: string) => `users/${enc(id)}`,
    permissions: (id: string) => `users/${enc(id)}/permissions`,
    activate: (id: string) => `users/${enc(id)}/activate`,
    deactivate: (id: string) => `users/${enc(id)}/deactivate`,
    resetPassword: (id: string) => `users/${enc(id)}/reset-password`,
    custody: (id: string) => `users/${enc(id)}/custody`,
    violations: (id: string) => `users/${enc(id)}/violations`,
    violationsSummary: (id: string) => `users/${enc(id)}/violations/summary`,
  },
  roles: {
    list: 'roles',
    byId: (id: string) => `roles/${enc(id)}`,
    permissions: (id: string) => `roles/${enc(id)}/permissions`,
  },
  permissions: {
    list: 'permissions',
  },
  branches: {
    list: 'branches',
    byId: (id: string) => `branches/${enc(id)}`,
    summary: (id: string) => `branches/${enc(id)}/summary`,
    activate: (id: string) => `branches/${enc(id)}/activate`,
    deactivate: (id: string) => `branches/${enc(id)}/deactivate`,
  },
  warehouses: {
    list: 'warehouses',
    byId: (id: string) => `warehouses/${enc(id)}`,
  },
  lookups: {
    paymentMethods: 'payment-methods',
    paymentMethod: (id: string) => `payment-methods/${enc(id)}`,
    violationTypes: 'violation-types',
    violationType: (id: string) => `violation-types/${enc(id)}`,
    maintenanceLocations: 'maintenance-locations',
    decommissionReasons: 'decommission-reasons',
    suppliers: 'suppliers',
  },
  media: {
    presign: 'media/presign',
    confirm: 'media/confirm',
    upload: 'media/upload',
    blob: 'media/blob',
    byId: (id: string) => `media/${enc(id)}`,
  },
  settings: {
    list: 'settings',
    byKey: (key: string) => `settings/${enc(key)}`,
  },
  audit: {
    list: 'audit-logs',
    entity: (type: string, id: string) => `audit-logs/entity/${enc(type)}/${enc(id)}`,
    user: (userId: string) => `audit-logs/user/${enc(userId)}`,
  },
} as const;

export function flattenEndpointTemplates(value: unknown, acc: string[] = []): string[] {
  if (typeof value === 'string') {
    acc.push(value);
    return acc;
  }
  if (typeof value === 'function') {
    acc.push(
      String(value('__id__', '__id2__'))
        .replace(/__id2__/g, '{id}')
        .replace(/__id__/g, '{id}'),
    );
    return acc;
  }
  if (value && typeof value === 'object') {
    for (const child of Object.values(value as Record<string, unknown>)) {
      flattenEndpointTemplates(child, acc);
    }
  }
  return acc;
}
