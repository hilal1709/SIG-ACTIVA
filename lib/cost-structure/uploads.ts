import { createHmac, timingSafeEqual } from 'crypto';

export const MAX_WORKBOOK_BYTES = 50 * 1024 * 1024;
export const COST_UPLOAD_STATUSES = {
  PENDING_UPLOAD: 'PENDING_UPLOAD', PROCESSING: 'PROCESSING', VALIDATED: 'VALIDATED',
  VALIDATION_FAILED: 'VALIDATION_FAILED', FAILED: 'FAILED', ARCHIVED: 'ARCHIVED',
} as const;

export type PendingUpload = { companyId: number; companyCode: string; fiscalYear: number; fiscalPeriod: number; fileName: string; fileSize: number; uploadNote?: string; objectKey: string; userId: number; expiresAt: number };

export function sanitizeWorkbookName(name: string) {
  const base = name.split(/[\\/]/).pop()?.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^\.+/, '') || 'workbook.xlsx';
  return base.slice(-180);
}

export function createStorageKey(companyCode: string, fiscalYear: number, fiscalPeriod: number, fileName: string, token: string) {
  const safeCompany=companyCode.replace(/[^A-Za-z0-9_-]/g,'');
  const safeToken=token.replace(/[^A-Za-z0-9-]/g,'');
  return `cost-structure/${safeCompany}/${fiscalYear}/${String(fiscalPeriod).padStart(2,'0')}/${safeToken}-${sanitizeWorkbookName(fileName)}`;
}

export function validateWorkbookDeclaration(name: string, size: number) {
  const safe = sanitizeWorkbookName(name);
  if (!/\.(xlsx|xlsm)$/i.test(safe)) return 'Workbook harus berformat .xlsx atau .xlsm.';
  if (!Number.isSafeInteger(size) || size <= 0) return 'Workbook kosong atau ukuran file tidak valid.';
  if (size > MAX_WORKBOOK_BYTES) return 'Ukuran workbook melebihi batas 50 MB.';
  return null;
}

function secret() { return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || ''; }
export function signPendingUpload(value: PendingUpload) {
  if (!secret()) throw new Error('Upload signing secret is not configured');
  const body = Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${body}.${createHmac('sha256', secret()).update(body).digest('base64url')}`;
}
export function verifyPendingUpload(token: string): PendingUpload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature || !secret()) return null;
  const expected = createHmac('sha256', secret()).update(body).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try { const value = JSON.parse(Buffer.from(body, 'base64url').toString()) as PendingUpload; return value.expiresAt > Date.now() ? value : null; } catch { return null; }
}
