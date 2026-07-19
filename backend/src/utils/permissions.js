const ALL_PERMISSIONS = [
  'dashboard.view',
  'customer.view', 'customer.create', 'customer.update', 'customer.deactivate', 'customer.restore',
  'product.view', 'product.create', 'product.update', 'product.deactivate', 'product.restore',
  'document.view', 'document.create', 'document.update', 'document.status', 'document.cancel', 'document.delete', 'document.restore', 'document.print',
  'report.view', 'report.export',
  'settings.view', 'settings.update',
  'user.manage',
  'backup.export',
  'audit.view', 'audit.export'
];

const ROLE_PERMISSIONS = {
  admin: ALL_PERMISSIONS,
  staff: [
    'dashboard.view',
    'customer.view', 'customer.create', 'customer.update',
    'product.view', 'product.create', 'product.update',
    'document.view', 'document.create', 'document.update', 'document.status', 'document.cancel', 'document.delete', 'document.print',
    'report.view', 'report.export'
  ],
  viewer: [
    'dashboard.view',
    'customer.view',
    'product.view',
    'document.view', 'document.print',
    'report.view'
  ]
};

function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}

function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return getPermissionsForRole(user.role).includes(permission);
}

function serializePermissions(user) {
  return getPermissionsForRole(user?.role);
}

module.exports = {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  getPermissionsForRole,
  hasPermission,
  serializePermissions
};
