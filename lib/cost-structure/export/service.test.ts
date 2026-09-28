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

test('mandatory persisted audit templates remain fail-closed', async () => {
  const source = await readFile(servicePath, 'utf8');
  assert.match(source, /requireAuditRows/);
  assert.match(source, /Audit snapshot .* belum dipersist/);
  assert.match(source, /requireAuditRows\(allRows, 'AUDIT_RINCIAN'/);
});

test('absent historical DERIV is rendered as zero and does not require SI2000_DRV', async () => {
  const source = await readFile(servicePath, 'utf8');
  assert.match(source, /const derivRows = rowsByCode\(allRows, 'AUDIT_DERIV'\)/);
  assert.match(source, /else writeZeroDerivSheet\(workbook, run\)/);
  assert.match(source, /if \(hasDeriv\) addSourceSheet\(workbook, 'SI2000_DRV'/);
  assert.doesNotMatch(source, /writeRawMatrix\(deriv, requireAuditRows\(allRows, 'AUDIT_DERIV'/);
});

test('AUDIT_CC_DRV remains period-optional', async () => {
  const source = await readFile(servicePath, 'utf8');
  assert.match(source, /addSourceSheet\(workbook, 'cc_drv', rowsByCode\(allRows, 'AUDIT_CC_DRV'\)\)/);
  assert.doesNotMatch(source, /requireAuditRows\(allRows, 'AUDIT_CC_DRV'/);
});

test('export rejects a SUCCESS run tied to an inactive upload version', async () => {
  const source = await readFile(servicePath, 'utf8');
  assert.match(source, /upload\.isActiveVersion/);
  assert.match(source, /upload versi lama/);
});
