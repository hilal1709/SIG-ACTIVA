import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('Company 2000 SI mapping plan is guarded, code-resolved, and rollback-only', () => {
  const sql = readFileSync(resolve('scripts/sql/company-2000-si-v2-mapping-plan.sql'), 'utf8');
  const requests = [...sql.matchAll(/\('CC_(?:ADUM|PASAR)',\s*'\d{8}',\s*'(?:ADUM|PASAR)',\s*'N\d{2}'/g)];
  assert.equal(requests.length, 6);
  for (const gate of [
    'Company 2000 resolution count',
    'requested COAs do not resolve exactly once',
    'requested Cost Groups do not resolve exactly once',
    'requested Natures do not resolve exactly once under their group',
    'Predecessor mapping count',
    'Post-change effective mapping count',
    'post-change overlap/ambiguity',
    'incorrect final targets',
  ]) assert.match(sql, new RegExp(gate));
  assert.doesNotMatch(sql, /(?:companyId|costGroupId|natureId|coaId)"?\s*=\s*\d+/i);
  assert.match(sql.trim(), /ROLLBACK;$/);
});
