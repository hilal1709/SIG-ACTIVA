import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const servicePath = path.resolve('lib/cost-structure/export/service.ts');

test('Phase G export remains DB-only and never reads Storage/XLSX on download', async () => {
  const source = await readFile(servicePath, 'utf8');
  assert.doesNotMatch(source, /costStructureStorage/);
  assert.doesNotMatch(source, /from ['\"]xlsx['\"]/);
  assert.doesNotMatch(source, /\.download\(/);
  assert.match(source, /sourceRows/);
  assert.match(source, /results/);
  assert.match(source, /actualLines/);
});

test('Company 7000 export contract contains official and manual-audit sheets', async () => {
  const source = await readFile(servicePath, 'utf8');
  for (const sheet of ['GHoPO','DERIV','rincian biaya','cc_prod','cc_adm','cc pasar','cc_drv','SI2000_DRV','WHRPG','Batu bara','statistical pasar','beli','solar PP order','Formula Audit']) {
    assert.ok(source.toLowerCase().includes(sheet.toLowerCase()), `${sheet} missing from export contract`);
  }
});

test('export fails explicitly when mandatory persisted audit templates are absent', async () => {
  const source = await readFile(servicePath, 'utf8');
  assert.match(source, /requireAuditRows/);
  assert.match(source, /Audit snapshot .* belum dipersist/);
});
