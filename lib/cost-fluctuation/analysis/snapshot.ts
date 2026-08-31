import { Prisma } from '@prisma/client';
import { financial, ZERO } from './math';
import type { AnalysisBasisCode, AnalyticalSnapshot, PersistedPeriod, PersistedSourceRow, SnapshotBasis, SnapshotGroup, SnapshotItem, SnapshotNature } from './types';

export class FluctuationIntegrityError extends Error { constructor(message: string) { super(message); this.name = 'FluctuationIntegrityError'; } }
const CANONICAL: Record<string, readonly string[]> = { '2000': ['TOTAL_ADUM', 'TOTAL_PASAR'], '7000': ['TOTAL_HPP', 'TOTAL_ADUM', 'TOTAL_PASAR'] };
const byOrder = <T extends { order: number; code: string; key: string }>(a: T, b: T) => a.order - b.order || a.code.localeCompare(b.code) || a.key.localeCompare(b.key);
const norm = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase('id-ID').replace(/[.&]/g, ' ').replace(/\s+/g, ' ');
const aliases: Record<string, string> = {
  'bahan baku':'bahan baku', 'bahan penolong':'bahan penolong', kemasan:'kemasan', 'batu bara':'batubara', batubara:'batubara',
  'batubara inbound':'batubara inbound', 'bahan bakar lainnya':'bahan bakar lainnya', 'bahan bakar':'bahan bakar', listrik:'listrik',
  'energi listrik':'energi listrik', energi:'energi', 'tenaga kerja':'tenaga kerja', pemeliharaan:'pemeliharaan',
  'penyusutan amortisasi':'penyusutan amortisasi', 'deplesi, penyusutan amortisasi':'penyusutan amortisasi', dpa:'dpa',
  'urusan umum adm kantor':'uua', 'urusan umum dan administrasi kantor':'uua', 'umum administrasi':'uua', uua:'uua', perniagaan:'perniagaan',
  'pajak dan asuransi':'pajak asuransi', 'pajak asuransi':'pajak asuransi', 'pembelian terak':'pembelian terak',
  'ongkos angkut fg dan wip':'ongkos angkut fg dan wip', 'selisih persediaan':'selisih persediaan', oa:'oa',
};
const canonicalLabel = (value: unknown) => aliases[norm(value)] ?? norm(value);
const sectionFor = (label: string) => label.includes('beban pokok penjualan') ? 'HPP' : label.includes('umum') && label.includes('administrasi') ? 'ADUM' : label === 'pemasaran' ? 'PASAR' : null;
const totalFor = (label: string) => label === 'total hpp' ? 'HPP' : label === 'total adum' ? 'ADUM' : label === 'total perniagaan' ? 'PASAR_REGULAR' : null;
const amountFrom = (row: PersistedSourceRow) => {
  const raw = (row.rawDataJson && typeof row.rawDataJson === 'object' ? row.rawDataJson : {}) as Record<string, unknown>;
  const value = raw.COLUMN_2;
  if (value === null || value === undefined || String(value).trim() === '') return ZERO;
  try { return financial(new Prisma.Decimal(String(value).replace(/,/g, '')).mul(1000)); }
  catch { throw new FluctuationIntegrityError(`${row.logicalSourceCode} row ${row.sourceRowNumber} has an invalid financial amount.`); }
};

interface ParsedAudit { values: Map<string, Prisma.Decimal>; totals: Map<string, Prisma.Decimal>; present: boolean }
function parseAudit(rows: PersistedSourceRow[], sourceCode: string, allowedLabels: Set<string>, strictUnknown: boolean): ParsedAudit {
  const source = rows.filter((row) => row.logicalSourceCode === sourceCode);
  if (!source.length) throw new FluctuationIntegrityError(`Required ${sourceCode} source is missing from the active calculation run upload.`);
  let section: string | null = null; const values = new Map<string, Prisma.Decimal>(); const totals = new Map<string, Prisma.Decimal>();
  for (const row of source) {
    const raw = (row.rawDataJson && typeof row.rawDataJson === 'object' ? row.rawDataJson : {}) as Record<string, unknown>;
    const label = norm(raw.COLUMN_1); if (!label) continue;
    const nextSection = sectionFor(label); if (nextSection) { section = nextSection; continue; }
    const total = totalFor(label); if (total) { totals.set(total, amountFrom(row)); continue; }
    const semantic = canonicalLabel(label); const amount = amountFrom(row);
    if (semantic === 'oa') { values.set('PASAR:oa', amount); continue; }
    if (!section || !allowedLabels.has(semantic)) {
      if (strictUnknown && !amount.isZero()) throw new FluctuationIntegrityError(`${sourceCode} contains unknown non-zero Nature label "${String(raw.COLUMN_1)}".`);
      continue;
    }
    values.set(`${section}:${semantic}`, (values.get(`${section}:${semantic}`) ?? ZERO).add(amount));
  }
  return { values, totals, present: true };
}

function engineGroups(period: PersistedPeriod, basisCode: AnalysisBasisCode): SnapshotGroup[] {
  const run = period.activeRun!; const allowed = CANONICAL[period.companyCode];
  const canonical = run.results.filter((result) => result.resultType === 'TOTAL' && allowed.includes(result.resultCode));
  if (canonical.length !== allowed.length || new Set(canonical.map((r) => r.costGroupId)).size !== canonical.length || canonical.some((r) => !r.costGroupId || !r.costGroup)) throw new FluctuationIntegrityError(`Company ${period.companyCode} does not have its canonical Cost Group structure.`);
  return canonical.map((groupResult) => {
    if (groupResult.resultCode !== `TOTAL_${groupResult.costGroup!.code}`) throw new FluctuationIntegrityError('Canonical total code does not match its stable Cost Group identity.');
    const groupKey = `basis:${basisCode}:group:${groupResult.costGroupId}`;
    const natures = run.results.filter((r) => r.resultType === 'NATURE' && r.costGroupId === groupResult.costGroupId && r.natureId && r.nature).map((natureResult): SnapshotNature => {
      const natureKey = `${groupKey}:nature:${natureResult.natureId}`; const grouped = new Map<string, SnapshotItem>();
      for (const line of run.actualLines.filter((item) => item.costGroupId === groupResult.costGroupId && item.natureId === natureResult.natureId)) {
        const key = line.coaId ? `${natureKey}:coa:${line.coaId}` : `${natureKey}:calculated:${line.lineType}:${line.ruleCode ?? 'NO_RULE'}`;
        const existing = grouped.get(key); grouped.set(key, { key, id: line.coaId, code: line.coa?.coaCode ?? line.ruleCode ?? line.lineType, label: line.coa?.coaDescription ?? line.ruleCode ?? `${line.lineType} item`, amount: (existing?.amount ?? ZERO).add(line.finalAmount), order: line.coaId ? 0 : 1, lineType: line.lineType, ruleCode: line.ruleCode });
      }
      return { key: natureKey, id: natureResult.natureId, code: natureResult.nature!.code, label: natureResult.nature!.name, amount: natureResult.amount, order: natureResult.nature!.displayOrder, items: [...grouped.values()].sort(byOrder) };
    }).sort(byOrder);
    return { key: groupKey, id: groupResult.costGroupId, code: groupResult.costGroup!.code, label: groupResult.costGroup!.name, amount: groupResult.amount, order: groupResult.costGroup!.displayOrder, natures };
  }).sort(byOrder);
}

const natureSemantic = (nature: SnapshotNature) => canonicalLabel(nature.label);
function assertEngineParity(groups: SnapshotGroup[], audit: ParsedAudit, sourceCode: string) {
  for (const group of groups) for (const nature of group.natures) {
    const expected = audit.values.get(`${group.code}:${natureSemantic(nature)}`);
    if (expected !== undefined && !financial(nature.amount).equals(expected)) throw new FluctuationIntegrityError(`${sourceCode} parity failed for ${group.code}/${nature.code}.`);
  }
  for (const group of groups) {
    const total = audit.totals.get(group.code) ?? (group.code === 'PASAR' ? audit.totals.get('PASAR_REGULAR')?.add(audit.values.get('PASAR:oa') ?? ZERO) : undefined);
    if (total !== undefined && !financial(group.amount).equals(financial(total))) throw new FluctuationIntegrityError(`${sourceCode} parity failed for Total ${group.code}.`);
  }
}

function derivBasis(template: SnapshotGroup[], audit: ParsedAudit): SnapshotBasis {
  const groups = template.map((group): SnapshotGroup => {
    const groupKey = `basis:DERIV:group:${group.id}`;
    const natures = group.natures.map((nature): SnapshotNature => {
      const amount = audit.values.get(`${group.code}:${natureSemantic(nature)}`) ?? ZERO; const natureKey = `${groupKey}:nature:${nature.id}`;
      const items: SnapshotItem[] = amount.isZero() ? [] : [{ key: `${natureKey}:calculated:DERIV_SOURCE:DERIV_SHEET_AMOUNT`, id: null, code: 'DERIV_SHEET_AMOUNT', label: `${nature.label} (DERIV source)`, amount, order: 1, lineType: 'DERIV_SOURCE', ruleCode: 'DERIV_SHEET_AMOUNT' }];
      return { ...nature, key: natureKey, amount, items };
    });
    const amount = natures.reduce((sum, n) => sum.add(n.amount), ZERO);
    const control = group.code === 'PASAR' ? audit.totals.get('PASAR_REGULAR')?.add(audit.values.get('PASAR:oa') ?? ZERO) : audit.totals.get(group.code);
    if (control === undefined || !financial(amount).equals(financial(control))) throw new FluctuationIntegrityError(`AUDIT_DERIV ${group.code} leaf sum does not match its persisted total control.`);
    return { ...group, key: groupKey, amount, natures };
  });
  return { key: 'basis:DERIV', id: null, basisCode: 'DERIV', code: 'DERIV', label: 'DERIV', amount: groups.reduce((s, g) => s.add(g.amount), ZERO), order: 2, groups };
}

export function assertSnapshotReconciles(snapshot: AnalyticalSnapshot) {
  if (!snapshot.bases.reduce((s, b) => s.add(b.amount), ZERO).equals(snapshot.amount)) throw new FluctuationIntegrityError(`Company ${snapshot.companyCode} snapshot does not reconcile to its Analysis Bases.`);
  for (const basis of snapshot.bases) for (const group of basis.groups) {
    if (!group.natures.reduce((s, n) => s.add(n.amount), ZERO).equals(group.amount)) throw new FluctuationIntegrityError(`Cost Group ${basis.code}/${group.code} does not reconcile to its Natures.`);
    for (const nature of group.natures) if (!nature.amount.isZero() && !nature.items.reduce((s, i) => s.add(i.amount), ZERO).equals(nature.amount)) throw new FluctuationIntegrityError(`Nature ${basis.code}/${group.code}/${nature.code} does not reconcile to its analytical items.`);
  }
}

export function buildFinalizedMonthlySnapshot(period: PersistedPeriod | null): AnalyticalSnapshot | null {
  if (!period || period.status !== 'FINALIZED') return null; const run = period.activeRun;
  if (!run || period.activeCalculationRunId !== run.id || run.periodId !== period.id || run.status !== 'SUCCESS' || !run.isActive) throw new FluctuationIntegrityError(`Finalized period ${period.id} has invalid active calculation-run lineage.`);
  if (!CANONICAL[period.companyCode]) throw new FluctuationIntegrityError(`Company ${period.companyCode} is outside the Engine 2 scope.`);
  const totals = run.results.filter((r) => r.resultType === 'TOTAL' && r.resultCode === 'TOTAL_COMPANY'); if (totals.length !== 1) throw new FluctuationIntegrityError(`Finalized period ${period.id} must have exactly one TOTAL_COMPANY result.`);
  const basisCode: AnalysisBasisCode = period.companyCode === '2000' ? 'SI' : 'GHOPO'; const groups = engineGroups(period, basisCode);
  if (period.companyCode === '2000' && groups.some((g) => g.code === 'HPP')) throw new FluctuationIntegrityError('Company 2000 must not contain HPP.');
  const labels = new Set(groups.flatMap((g) => g.natures.map(natureSemantic)));
  const sourceRows = run.sourceRows.filter((row) => row.uploadId === run.uploadId);
  const audit = parseAudit(sourceRows, basisCode === 'SI' ? 'AUDIT_SI' : 'AUDIT_GHOPO', labels, false); assertEngineParity(groups, audit, `AUDIT_${basisCode}`);
  const bases: SnapshotBasis[] = [{ key: `basis:${basisCode}`, id: null, basisCode, code: basisCode, label: basisCode === 'GHOPO' ? 'GHoPO' : 'SI', amount: totals[0].amount, order: 1, groups }];
  if (basisCode === 'GHOPO') bases.push(derivBasis(groups, parseAudit(sourceRows, 'AUDIT_DERIV', labels, true)));
  const snapshot: AnalyticalSnapshot = { companyId: period.companyId, companyCode: period.companyCode, amount: bases.reduce((s, b) => s.add(b.amount), ZERO), bases, lineage: bases.map((b) => ({ periodId: period.id, fiscalYear: period.fiscalYear, fiscalPeriod: period.fiscalPeriod, runId: run.id, ruleSetVersion: run.ruleSetVersion, uploadId: run.uploadId, basisCode: b.basisCode })) };
  assertSnapshotReconciles(snapshot); return snapshot;
}
