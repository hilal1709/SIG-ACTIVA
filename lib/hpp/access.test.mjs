import test from 'node:test';
import assert from 'node:assert/strict';
import { HPP_ROUTE, canReadHpp, isHppPath, canManageHpp, HPP_MANAGE_ROUTE } from './access.ts';

for (const role of ['ADMIN_SYSTEM', 'STAFF_ACCOUNTING', 'SUPERVISOR_ACCOUNTING', 'AUDITOR_INTERNAL', 'STAFF_PRODUCTION']) {
  test('allows existing finance read role: ' + role, () => assert.equal(canReadHpp(role), true));
}
test('rejects absent, unsupported and malformed roles', () => {
  for (const role of [null, undefined, '', 'USER', 'admin_system', 'ADMIN_SYSTEM ', 'constructor']) assert.equal(canReadHpp(role), false);
});
test('protects HPP root and descendants but not unrelated routes', () => {
  for (const path of [HPP_ROUTE, HPP_ROUTE + '/', HPP_ROUTE + '/detail']) assert.equal(isHppPath(path), true);
  for (const path of ['/', '/cost-structure', '/api/hpp', HPP_ROUTE + '-other']) assert.equal(isHppPath(path), false);
});

test('write roles only and management route', () => {
  assert.equal(HPP_MANAGE_ROUTE, HPP_ROUTE + '/data-management');
  for (const role of ['ADMIN_SYSTEM','STAFF_ACCOUNTING']) assert.equal(canManageHpp(role),true);
  for (const role of ['SUPERVISOR_ACCOUNTING','AUDITOR_INTERNAL','STAFF_PRODUCTION','UNKNOWN',null,undefined]) assert.equal(canManageHpp(role),false);
});
