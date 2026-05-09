// ── Permission Modules & Actions ─────────────────────
// Central source of truth for all RBAC permission definitions.

const MODULES = {
  dashboard: { label: 'Dashboard', actions: ['view'] },
  clients: { label: 'Clients', actions: ['view', 'create', 'edit', 'delete'] },
  vendors: { label: 'Vendors', actions: ['view', 'create', 'edit', 'delete'] },
  products: { label: 'Products', actions: ['view', 'create', 'edit', 'delete'] },
  invoices: { label: 'Invoices', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  payments: { label: 'Payments', actions: ['view', 'create', 'edit', 'delete'] },
  projects: { label: 'Projects', actions: ['view', 'create', 'edit', 'delete'] },
  expenses: { label: 'Expenses', actions: ['view', 'create', 'edit', 'delete', 'export'] },
  reports: { label: 'Reports', actions: ['view', 'export'] },
  settings: { label: 'Settings', actions: ['view', 'edit'] },
  users: { label: 'Users', actions: ['view', 'create', 'edit', 'delete'] },
  hsnMaster: { label: 'HSN/SAC Master', actions: ['view', 'create', 'edit', 'delete'] },
  busyExports: { label: 'BUSY Exports', actions: ['view', 'export'] },
};

// ── Role Presets ─────────────────────────────────────
// Used as defaults when creating users with a specific role.
// Admin always bypasses checks — no preset needed.

const ROLE_PRESETS = {
  Manager: {
    dashboard: { view: true },
    clients: { view: true, create: true, edit: true, delete: false },
    vendors: { view: true, create: true, edit: true, delete: false },
    products: { view: true, create: false, edit: false, delete: false },
    invoices: { view: true, create: true, edit: true, delete: false, export: true },
    payments: { view: true, create: true, edit: true, delete: false },
    projects: { view: true, create: true, edit: true, delete: false },
    expenses: { view: true, create: true, edit: true, delete: false, export: true },
    reports: { view: true, export: true },
    settings: { view: true, edit: false },
    users: { view: true, create: true, edit: true, delete: false },
    hsnMaster: { view: true, create: true, edit: true, delete: false },
    busyExports: { view: true, export: true },
  },
  Accountant: {
    dashboard: { view: true },
    clients: { view: true, create: true, edit: true, delete: false },
    vendors: { view: true, create: true, edit: true, delete: false },
    products: { view: true, create: true, edit: true, delete: false },
    invoices: { view: true, create: true, edit: true, delete: false, export: true },
    payments: { view: true, create: true, edit: true, delete: false },
    projects: { view: true, create: false, edit: false, delete: false },
    expenses: { view: true, create: true, edit: true, delete: false, export: true },
    reports: { view: true, export: true },
    settings: { view: true, edit: false },
    users: { view: false, create: false, edit: false, delete: false },
    hsnMaster: { view: true, create: true, edit: true, delete: false },
    busyExports: { view: true, export: true },
  },
  Executive: {
    dashboard: { view: false },
    clients: { view: false, create: false, edit: false, delete: false },
    vendors: { view: false, create: false, edit: false, delete: false },
    products: { view: false, create: false, edit: false, delete: false },
    invoices: { view: false, create: false, edit: false, delete: false, export: false },
    payments: { view: false, create: false, edit: false, delete: false },
    projects: { view: true, create: false, edit: false, delete: false },
    expenses: { view: true, create: true, edit: true, delete: false, export: false },
    reports: { view: false, export: false },
    settings: { view: false, edit: false },
    users: { view: true, create: false, edit: false, delete: false },
    hsnMaster: { view: false, create: false, edit: false, delete: false },
    busyExports: { view: false, export: false },
  },
  Staff: {
    dashboard: { view: true },
    clients: { view: true, create: false, edit: false, delete: false },
    vendors: { view: true, create: false, edit: false, delete: false },
    products: { view: true, create: false, edit: false, delete: false },
    invoices: { view: true, create: false, edit: false, delete: false, export: false },
    payments: { view: true, create: false, edit: false, delete: false },
    projects: { view: true, create: false, edit: false, delete: false },
    expenses: { view: true, create: true, edit: true, delete: false, export: false },
    reports: { view: false, export: false },
    settings: { view: false, edit: false },
    users: { view: true, create: false, edit: false, delete: false },
    hsnMaster: { view: true, create: false, edit: false, delete: false },
    busyExports: { view: false, export: false },
  },
  Custom: {},
};

/**
 * Build a full permissions object with all modules/actions set to a default value.
 */
function buildDefaultPermissions(defaultValue = false) {
  const perms = {};
  for (const [mod, def] of Object.entries(MODULES)) {
    perms[mod] = {};
    for (const action of def.actions) {
      perms[mod][action] = defaultValue;
    }
  }
  return perms;
}

/**
 * Get the preset permissions for a given role name.
 * Returns full-access for Admin, empty for unknown.
 */
function getPresetForRole(roleName) {
  if (roleName === 'Admin') return buildDefaultPermissions(true);
  const preset = ROLE_PRESETS[roleName];
  if (!preset) return buildDefaultPermissions(false);
  // Merge with defaults so any missing module/action = false
  const full = buildDefaultPermissions(false);
  for (const [mod, actions] of Object.entries(preset)) {
    if (full[mod]) {
      for (const [action, val] of Object.entries(actions)) {
        if (action in full[mod]) full[mod][action] = val;
      }
    }
  }
  return full;
}

/**
 * Sanitize incoming permissions — strip unknown modules/actions.
 */
function sanitizePermissions(incoming) {
  const clean = buildDefaultPermissions(false);
  if (!incoming || typeof incoming !== 'object') return clean;
  for (const [mod, def] of Object.entries(MODULES)) {
    if (incoming[mod] && typeof incoming[mod] === 'object') {
      for (const action of def.actions) {
        if (typeof incoming[mod][action] === 'boolean') {
          clean[mod][action] = incoming[mod][action];
        }
      }
    }
  }
  return clean;
}

module.exports = {
  MODULES,
  ROLE_PRESETS,
  buildDefaultPermissions,
  getPresetForRole,
  sanitizePermissions,
};
