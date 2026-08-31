import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const routePath = path.resolve('app/api/cost-structure/uploads/[id]/revalidate/route.ts');
const workspacePath = path.resolve('app/cost-structure/upload/[id]/phase-d-workspace.tsx');

test('revalidation is limited to active VALIDATION_FAILED uploads not used by calculation runs', async () => {
  const source = await readFile(routePath, 'utf8');
  assert.match(source, /!upload\.isActiveVersion/);
  assert.match(source, /upload\.status !== 'VALIDATION_FAILED'/);
  assert.match(source, /upload\.calculationRuns\.length > 0/);
  assert.match(source, /FOR UPDATE/);
});

test('revalidation verifies immutable stored bytes before reparsing', async () => {
  const source = await readFile(routePath, 'utf8');
  assert.match(source, /costStructureStorage\.download\(upload\.storageKey\)/);
  assert.match(source, /BigInt\(bytes\.byteLength\) !== upload\.fileSizeBytes/);
  assert.match(source, /createHash\('sha256'\)/);
  assert.match(source, /hash !== upload\.fileHashSha256/);
  assert.match(source, /parseWorkbook\(bytes, upload\.period\.company\.companyCode\)/);
});

test('revalidation atomically replaces normalized rows and issues without creating another upload version', async () => {
  const source = await readFile(routePath, 'utf8');
  assert.match(source, /costValidationIssue\.deleteMany/);
  assert.match(source, /costSourceRow\.deleteMany/);
  assert.match(source, /costSourceRow\.createMany/);
  assert.match(source, /costValidationIssue\.createMany/);
  assert.doesNotMatch(source, /costUpload\.create\(/);
  assert.match(source, /action: 'REVALIDATE_COST_UPLOAD'/);
});

test('failed upload workspace exposes revalidate action without fabricating a new upload', async () => {
  const source = await readFile(workspacePath, 'utf8');
  assert.match(source, /upload\.status === 'VALIDATION_FAILED'/);
  assert.match(source, /\/revalidate/);
  assert.match(source, /Revalidate file/);
  assert.match(source, /tanpa membuat upload version duplikat/);
});
