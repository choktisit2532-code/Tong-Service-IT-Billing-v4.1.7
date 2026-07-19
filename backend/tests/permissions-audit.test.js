const test = require('node:test');
const assert = require('node:assert/strict');
const { hasPermission, ROLE_PERMISSIONS } = require('../src/utils/permissions');

test('viewer can only read and print documents, not mutate data', () => {
  const viewer = { role: 'viewer' };
  assert.equal(hasPermission(viewer, 'document.view'), true);
  assert.equal(hasPermission(viewer, 'document.print'), true);
  assert.equal(hasPermission(viewer, 'document.create'), false);
  assert.equal(hasPermission(viewer, 'document.update'), false);
  assert.equal(hasPermission(viewer, 'document.delete'), false);
  assert.equal(hasPermission(viewer, 'settings.update'), false);
});

test('staff cannot manage users, settings, backup, or audit', () => {
  const staff = { role: 'staff' };
  assert.equal(hasPermission(staff, 'document.create'), true);
  assert.equal(hasPermission(staff, 'report.export'), true);
  assert.equal(hasPermission(staff, 'user.manage'), false);
  assert.equal(hasPermission(staff, 'settings.update'), false);
  assert.equal(hasPermission(staff, 'backup.export'), false);
  assert.equal(hasPermission(staff, 'audit.export'), false);
});

test('admin has all registered permissions', () => {
  const admin = { role: 'admin' };
  for (const permission of ROLE_PERMISSIONS.admin) {
    assert.equal(hasPermission(admin, permission), true, permission);
  }
});
