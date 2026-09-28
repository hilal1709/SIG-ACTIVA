import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { aggregateSnapshots } from './aggregate';
import { compareSnapshots } from './compare';
import { financial, variance } from './math';
import { createAnalysisService } from './orchestrator';
import { comparisonLabel, resolveComparisonMonths } from './periods';
import { assertSnapshotReconciles, buildFinalizedMonthlySnapshot, FluctuationIntegrityError } from './snapshot';
import type { AnalysisRepository, AnalyticalSnapshot, PersistedLine, PersistedPeriod, PersistedResult, PersistedSourceRow } from './types';

const d = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
type Code = 'HPP' | 'ADUM' | 'PASAR';
const GROUPS: Record<Code, { id: number; order: number }> = { HPP: { id: 30, order: 1 }, ADUM: { id: 10, order: 2 }, PASAR: { id: 20, order: 3 } };
const COMMON = [
  ['N01', 'Bahan Penolong'], ['N02', 'Bahan Bakar'], ['N03', 'Energi Listrik'], ['N04', 'Tenaga Kerja'], ['N05', 'Pemeliharaan'],
  ['N06', 'DPA'], ['N07', 'Urusan Umum dan Administrasi Kantor'], ['N08', 'Perniagaan'], ['N09', 'Pajak & Asuransi'],
] as const;
const HPP = [
  ['H01', 'Bahan Baku'], ['H02', 'Bahan Penolong'], ['H03', 'Kemasan'], ['H04', 'Batubara'], ['H05', 'Batubara Inbound'],
  ['H06', 'Bahan Bakar lainnya'], ['H07', 'Listrik'], ['H08', 'Tenaga Kerja'], ['H09', 'Pemeliharaan'], ['H10', 'Penyusutan & Amortisasi'],
  ['H11', 'Urusan Umum dan Administrasi Kantor'], ['H12', 'Perniagaan'], ['H13', 'Pajak & Asuransi'], ['H14', 'Pembelian Terak'],
  ['H15', 'Ongkos Angkut FG dan WIP'], ['H16', 'Selisih Persediaan'],
] as const;
const SI: Record<'ADUM' | 'PASAR', readonly string[]> = {
  ADUM: ['180971720','37589668','700733597','49912776104','1998787267','5514747437','44532279743','954509200','4011763175'],
  PASAR: ['0','104942865','220626','6945831605','0','1545220816','1862128642','6029416541','0'],
};
const GHOPO: Record<Code, readonly string[]> = {
  HPP: ['41963786488','8975125427','26664274904','93152232023.32','41023853211.68','6422129096','69402132632','27590902628','35431263500','30907540908','5898145713','30137567870','15046158800','0','1707619761','-21153010152'],
  ADUM: ['0','150337563','311498436','2795914715','3262790203','871635171','2973368724','0','1301839163'],
  PASAR: ['65990693','0','0','0','5146767','0','31917788','9469804797','0','72068727025'],
};
const DERIV: Record<Code, readonly string[]> = {
  HPP: ['0','0','0','0','0','0','0','0','0','0','0','0','0','0','0','4571043173'],
  ADUM: ['0','0','0','0','0','0','0','0','0'],
  PASAR: ['0','12540370','0','1115041922','0','0','192774503','168549750','0','368191098'],
};
const TOTALS = { SI: { ADUM: '107844157911', PASAR: '16487761095' }, GHOPO: { HPP: '413169722810', ADUM: '11667383975', PASAR: '81641587070' } } as const;
const definitions = (code: Code, company: '2000' | '7000') => code === 'HPP' ? HPP : [...COMMON, ...(code === 'PASAR' && company === '7000' ? [['OA', 'OA'] as const] : [])];
const rows = (uploadId: number, logicalSourceCode: string, data: Array<[string, string]>): PersistedSourceRow[] => data.map(([label, amount], index) => ({ id: index + 1, uploadId, logicalSourceCode, sourceRowNumber: index + 1, rawDataJson: { COLUMN_1: label, COLUMN_2: amount } }));
const thousands = (value: string) => d(value).div(1000).toString();

function auditRows(uploadId: number, company: '2000' | '7000'): PersistedSourceRow[] {
  const sourceCode = company === '2000' ? 'AUDIT_SI' : 'AUDIT_GHOPO';
  const codes: Code[] = company === '2000' ? ['ADUM', 'PASAR'] : ['HPP', 'ADUM', 'PASAR'];
  const data: Array<[string, string]> = [];
  data.push([company === '2000' ? 'Ctrl' : '710344 OA Clinker keluar', company === '2000' ? '0' : '999']);
  for (const code of codes) {
    data.push([code === 'HPP' ? 'Beban Pokok Penjualan' : code === 'ADUM' ? 'UMUM & ADMINISTRASI' : 'PEMASARAN', '']);
    const values = company === '2000' ? SI[code as 'ADUM' | 'PASAR'] : GHOPO[code];
    definitions(code, company).forEach(([, label], index) => {
      let value = values[index];
      if (company === '7000' && code === 'HPP' && index === 3) value = '93152232023.316';
      if (company === '7000' && code === 'HPP' && index === 4) value = '41023853211.684';
      data.push([label, thousands(value)]);
    });
    if (code === 'PASAR') data.push(['Total Perniagaan', thousands(company === '2000' ? TOTALS.SI.PASAR : '9572860045')]);
    else data.push([code === 'HPP' ? 'Total HPP' : 'Total Adum', thousands(TOTALS[company === '2000' ? 'SI' : 'GHOPO'][code as 'ADUM'])]);
    if (company === '7000' && code === 'PASAR') data.push(['Total Pemasaran', thousands(TOTALS.GHOPO.PASAR)]);
  }
  return rows(uploadId, sourceCode, data);
}

function derivRows(uploadId: number): PersistedSourceRow[] {
  const data: Array<[string, string]> = [];
  for (const code of ['HPP', 'ADUM', 'PASAR'] as Code[]) {
    data.push([code === 'HPP' ? 'Beban Pokok Penjualan' : code === 'ADUM' ? 'UMUM & ADMINISTRASI' : 'PEMASARAN', '']);
    definitions(code, '7000').forEach(([, label], index) => data.push([label, thousands(DERIV[code][index])]));
    data.push([code === 'HPP' ? 'Total HPP' : code === 'ADUM' ? 'Total Adum' : 'Total Perniagaan', thousands(code === 'HPP' ? '4571043173' : code === 'ADUM' ? '0' : '1488906545')]);
    if (code === 'PASAR') data.push(['Total Pemasaran', thousands('1857097643')]);
  }
  return rows(uploadId, 'AUDIT_DERIV', data);
}

function period(company: '2000' | '7000', year = 2026, month = 7): PersistedPeriod {
  const codes: Code[] = company === '2000' ? ['ADUM', 'PASAR'] : ['HPP', 'ADUM', 'PASAR'];
  const results: PersistedResult[] = []; const actualLines: PersistedLine[] = [];
  for (const code of codes) {
    const values = company === '2000' ? SI[code as 'ADUM' | 'PASAR'] : GHOPO[code];
    const total = TOTALS[company === '2000' ? 'SI' : 'GHOPO'][code as 'ADUM'];
    results.push({ costGroupId: GROUPS[code].id, natureId: null, resultCode: `TOTAL_${code}`, resultType: 'TOTAL', amount: d(total), costGroup: { code, name: code, displayOrder: GROUPS[code].order }, nature: null });
    definitions(code, company).forEach(([natureCode, label], index) => {
      const natureId = GROUPS[code].id * 100 + index + 1; const amount = d(values[index]);
      results.push({ costGroupId: GROUPS[code].id, natureId, resultCode: 'NATURE_TOTAL', resultType: 'NATURE', amount, costGroup: { code, name: code, displayOrder: GROUPS[code].order }, nature: { code: natureCode, name: label, displayOrder: index + 1 } });
      if (!amount.isZero()) actualLines.push({ costGroupId: GROUPS[code].id, natureId, coaId: natureId + 10000, lineType: 'COA', finalAmount: amount, ruleCode: null, coa: { coaCode: `COA-${natureCode}`, coaDescription: label } });
    });
  }
  const total = company === '2000' ? '124331919006' : '506478693855';
  results.push({ costGroupId: null, natureId: null, resultCode: 'TOTAL_COMPANY', resultType: 'TOTAL', amount: d(total), costGroup: null, nature: null });
  const id = year * 100 + month + (company === '7000' ? 1_000_000 : 0); const uploadId = id + 2;
  return { id, companyId: company === '2000' ? 20 : 70, companyCode: company, fiscalYear: year, fiscalPeriod: month, status: 'FINALIZED', activeCalculationRunId: id + 1, activeRun: { id: id + 1, periodId: id, uploadId, status: 'SUCCESS', isActive: true, ruleSetVersion: `ENGINE1_${company}_V${company === '2000' ? 2 : 1}`, results, actualLines, sourceRows: [...auditRows(uploadId, company), ...(company === '7000' ? derivRows(uploadId) : [])] } };
}

const repository = (periods: PersistedPeriod[]): AnalysisRepository => ({ async findPeriodById(id) { return periods.find(p => p.id === id) ?? null; }, async findPeriod(companyId, ref) { return periods.find(p => p.companyId === companyId && p.fiscalYear === ref.fiscalYear && p.fiscalPeriod === ref.fiscalPeriod) ?? null; } });

test('production-shaped SI parses UUA as Nature and reconciles every Nature', () => {
  const snapshot = buildFinalizedMonthlySnapshot(period('2000'))!;
  assert.deepEqual(snapshot.bases.map(b => b.code), ['SI']); assert.equal(snapshot.amount.toFixed(2), '124331919006.00');
  assert.deepEqual(snapshot.bases[0].groups.map(g => [g.code, g.amount.toFixed(2)]), [['ADUM','107844157911.00'],['PASAR','16487761095.00']]);
  assert.equal(snapshot.bases[0].groups.find(g => g.code === 'ADUM')!.natures.find(n => n.code === 'N07')!.amount.toFixed(2), '44532279743.00');
  assert.equal(snapshot.bases[0].groups.find(g => g.code === 'PASAR')!.natures.find(n => n.code === 'N07')!.amount.toFixed(2), '1862128642.00');
});

test('production-shaped GHoPO and DERIV preserve all stable Nature identities and goldens', () => {
  const snapshot = buildFinalizedMonthlySnapshot(period('7000'))!; const [ghopo, deriv] = snapshot.bases;
  assert.deepEqual(snapshot.bases.map(b => b.code), ['GHOPO','DERIV']); assert.equal(ghopo.amount.toFixed(2), '506478693855.00'); assert.equal(deriv.amount.toFixed(2), '6428140816.00'); assert.equal(snapshot.amount.toFixed(2), '512906834671.00');
  assert.deepEqual(ghopo.groups.map(g => [g.code, g.amount.toFixed(2)]), [['HPP','413169722810.00'],['ADUM','11667383975.00'],['PASAR','81641587070.00']]);
  assert.deepEqual(deriv.groups.map(g => [g.code, g.amount.toFixed(2)]), [['HPP','4571043173.00'],['ADUM','0.00'],['PASAR','1857097643.00']]);
  assert.equal(deriv.groups.find(g => g.code === 'PASAR')!.natures.find(n => n.code === 'N07')!.amount.toFixed(2), '192774503.00');
  assert.equal(deriv.groups.find(g => g.code === 'PASAR')!.natures.find(n => n.code === 'OA')!.amount.toFixed(2), '368191098.00');
  assert.deepEqual(deriv.groups.find(g => g.code === 'HPP')!.natures.map(n => n.code), HPP.map(([code]) => code));
  assert.equal(deriv.groups.flatMap(g => g.natures).filter(n => !n.amount.isZero()).every(n => n.items.length === 1 && n.items[0].id === null), true);
});

test('financial parity normalizes only to deterministic cent precision', () => { assert.equal(financial('93152232023.316').toFixed(2), '93152232023.32'); assert.equal(financial('41023853211.684').toFixed(2), '41023853211.68'); });

test('financial arithmetic retains negative and large full-IDR Decimal precision', () => {
  assert.equal(financial('-0.005').toFixed(2), '-0.01');
  assert.equal(financial('9007199254740993.004').toFixed(2), '9007199254740993.00');
  assert.equal(financial('9007199254740993.005').toFixed(2), '9007199254740993.01');
  assert.equal(financial('93152232023.316').sub(financial('93152232023.312')).toFixed(2), '0.01');
});

test('source parity fails closed for missing, unknown, duplicate, and mismatched audit data', () => {
  const mutations: Array<(p: PersistedPeriod) => void> = [
    p => { p.activeRun!.sourceRows = p.activeRun!.sourceRows.filter(r => !(r.logicalSourceCode === 'AUDIT_SI' && (r.rawDataJson as Record<string,string>).COLUMN_1 === 'Bahan Penolong')); },
    p => { p.activeRun!.sourceRows.push(...rows(p.activeRun!.uploadId, 'AUDIT_SI', [['Mystery Nature','1']])); },
    p => { const total = p.activeRun!.sourceRows.find(r => r.logicalSourceCode === 'AUDIT_SI' && (r.rawDataJson as Record<string,string>).COLUMN_1 === 'Total Adum')!; p.activeRun!.sourceRows.push({ ...total, id: 999 }); },
    p => { (p.activeRun!.sourceRows.find(r => r.logicalSourceCode === 'AUDIT_SI' && (r.rawDataJson as Record<string,string>).COLUMN_1 === 'Bahan Penolong')!.rawDataJson as Record<string,string>).COLUMN_2 = '1'; },
  ];
  for (const mutate of mutations) { const raw = period('2000'); mutate(raw); assert.throws(() => buildFinalizedMonthlySnapshot(raw), FluctuationIntegrityError); }
  const missingDeriv = period('7000');
  missingDeriv.activeRun!.sourceRows = missingDeriv.activeRun!.sourceRows.filter(r => r.logicalSourceCode !== 'AUDIT_DERIV');
  const historical = buildFinalizedMonthlySnapshot(missingDeriv)!;
  assert.deepEqual(historical.bases.map((basis) => [basis.code, basis.amount.toFixed(2)]), [['GHOPO', '506478693855.00'], ['DERIV', '0.00']]);
  assert.deepEqual(historical.lineage.map((line) => line.basisCode), ['GHOPO']);
});

test('audit parsing accepts only locked headers, controls, and zero unknown rows', () => {
  const zeroUnknown = period('2000');
  zeroUnknown.activeRun!.sourceRows.unshift(...rows(zeroUnknown.activeRun!.uploadId, 'AUDIT_SI', [['Unknown blank', ''], ['Unknown zero', '0']]));
  assert.equal(buildFinalizedMonthlySnapshot(zeroUnknown)!.amount.toFixed(2), '124331919006.00');

  const wrongHeader = period('2000');
  const header = wrongHeader.activeRun!.sourceRows.find((row) => row.logicalSourceCode === 'AUDIT_SI' && (row.rawDataJson as Record<string, string>).COLUMN_1 === 'UMUM & ADMINISTRASI')!;
  (header.rawDataJson as Record<string, string>).COLUMN_1 = 'ADMIN SECTION';
  assert.throws(() => buildFinalizedMonthlySnapshot(wrongHeader), FluctuationIntegrityError);

  const beforeSection = period('2000');
  beforeSection.activeRun!.sourceRows.unshift(...rows(beforeSection.activeRun!.uploadId, 'AUDIT_SI', [['Bahan Penolong', '1']]));
  assert.throws(() => buildFinalizedMonthlySnapshot(beforeSection), FluctuationIntegrityError);
});

test('snapshot reconciliation enforces company, basis, group, and zero-Nature item invariants', () => {
  const valid = buildFinalizedMonthlySnapshot(period('2000'))!;
  valid.bases[0].amount = valid.bases[0].amount.sub(1); assert.throws(() => assertSnapshotReconciles(valid), /Analysis Basis|Analysis Bases/);
  const zero = buildFinalizedMonthlySnapshot(period('2000'))!; const nature = zero.bases[0].groups.find(g => g.code === 'PASAR')!.natures.find(n => n.code === 'N01')!;
  nature.items.push({ key: `${nature.key}:calculated:BAD:BAD`, id: null, code: 'BAD', label: 'bad', amount: d(1), order: 1 }); assert.throws(() => assertSnapshotReconciles(zero), /analytical items/);
  const total = period('2000'); total.activeRun!.results.find(r => r.resultCode === 'TOTAL_COMPANY')!.amount = d('1'); assert.throws(() => buildFinalizedMonthlySnapshot(total), /TOTAL_COMPANY/);
});

test('snapshot reconciliation independently enforces group and Nature rollups', () => {
  const groupMismatch = buildFinalizedMonthlySnapshot(period('2000'))!;
  groupMismatch.bases[0].groups[0].amount = groupMismatch.bases[0].groups[0].amount.add(1);
  assert.throws(() => assertSnapshotReconciles(groupMismatch), /Cost Group|Analysis Basis/);

  const natureMismatch = buildFinalizedMonthlySnapshot(period('2000'))!;
  const nature = natureMismatch.bases[0].groups[0].natures.find((candidate) => !candidate.amount.isZero())!;
  nature.items[0].amount = nature.items[0].amount.sub(1);
  assert.throws(() => assertSnapshotReconciles(natureMismatch), /Nature|analytical items/);

  const validZero = buildFinalizedMonthlySnapshot(period('2000'))!;
  const zeroNature = validZero.bases[0].groups.find((group) => group.code === 'PASAR')!.natures.find((candidate) => candidate.code === 'N01')!;
  assert.equal(zeroNature.amount.toFixed(2), '0.00');
  assert.deepEqual(zeroNature.items, []);
  assert.doesNotThrow(() => assertSnapshotReconciles(validZero));
});

test('canonical identities, display ordering, and unrelated subtotals are deterministic', () => {
  const raw = period('7000'); raw.activeRun!.results.push({ ...raw.activeRun!.results.find(r => r.resultCode === 'TOTAL_PASAR')!, resultCode: 'TOTAL_PASAR_REGULAR', amount: d(1) }); raw.activeRun!.results.reverse();
  const snapshot = buildFinalizedMonthlySnapshot(raw)!; assert.deepEqual(snapshot.bases[0].groups.map(g => g.code), ['HPP','ADUM','PASAR']); assert.deepEqual(snapshot.bases[0].groups[0].natures.map(n => n.code), HPP.map(([code]) => code));
  const duplicate = period('2000'); duplicate.activeRun!.results.push({ ...duplicate.activeRun!.results.find(r => r.resultCode === 'TOTAL_ADUM')! }); assert.throws(() => buildFinalizedMonthlySnapshot(duplicate), FluctuationIntegrityError);
  const mismatch = period('2000'); mismatch.activeRun!.results.find(r => r.resultCode === 'TOTAL_ADUM')!.costGroup = { code: 'PASAR', name: 'PASAR', displayOrder: 3 }; assert.throws(() => buildFinalizedMonthlySnapshot(mismatch), /stable Cost Group identity/);
});

test('basis-qualified complete paths prevent Nature and COA collisions', () => {
  const snapshot = buildFinalizedMonthlySnapshot(period('7000'))!; const ghopo = snapshot.bases[0]; const deriv = snapshot.bases[1];
  assert.notEqual(ghopo.groups[0].natures[0].key, deriv.groups[0].natures[0].key);
  const first = ghopo.groups.find(g => g.code === 'PASAR')!.natures.find(n => n.code === 'N07')!.items[0]; const other = ghopo.groups.find(g => g.code === 'ADUM')!.natures.find(n => n.code === 'N07')!.items[0]; other.id = first.id; other.key = `${other.key.slice(0, other.key.lastIndexOf(':coa:'))}:coa:${first.id}`; assert.notEqual(first.key, other.key);
});

test('period resolution and labels cover MoM, January, YoY, and full YTD', () => {
  assert.deepEqual(resolveComparisonMonths({ fiscalYear: 2026, fiscalPeriod: 7 }, 'MOM').comparison, [{ fiscalYear: 2026, fiscalPeriod: 6 }]); assert.deepEqual(resolveComparisonMonths({ fiscalYear: 2026, fiscalPeriod: 1 }, 'MOM').comparison, [{ fiscalYear: 2025, fiscalPeriod: 12 }]); assert.deepEqual(resolveComparisonMonths({ fiscalYear: 2026, fiscalPeriod: 7 }, 'YOY').comparison, [{ fiscalYear: 2025, fiscalPeriod: 7 }]); assert.equal(resolveComparisonMonths({ fiscalYear: 2026, fiscalPeriod: 7 }, 'YTD').current.length, 7);
  assert.equal(comparisonLabel('MOM',{fiscalYear:2026,fiscalPeriod:7},{fiscalYear:2026,fiscalPeriod:6}),'MoM: Jul-2026 vs Jun-2026'); assert.equal(comparisonLabel('YOY',{fiscalYear:2026,fiscalPeriod:7},{fiscalYear:2025,fiscalPeriod:7}),'YoY: Jul-2026 vs Jul-2025'); assert.equal(comparisonLabel('YTD',{fiscalYear:2026,fiscalPeriod:7},{fiscalYear:2025,fiscalPeriod:7}),'YTD: Jan-Jul-2026 vs Jan-Jul-2025');
});

function tiny(companyAmount: string, basisAmount: string, groupAmounts: [string,string]): AnalyticalSnapshot {
  const makeGroup = (code: string, amount: string, id: number) => ({ key:`basis:SI:group:${id}`,id,code,label:code,amount:d(amount),order:id,natures:[{key:`basis:SI:group:${id}:nature:${id}`,id,code:'N',label:'N',amount:d(amount),order:1,items:[]}] });
  return { companyId: 1, companyCode: '2000', amount:d(companyAmount), bases:[{key:'basis:SI',id:null,basisCode:'SI',code:'SI',label:'SI',amount:d(basisAmount),order:1,groups:[makeGroup('ADUM',groupAmounts[0],1),makeGroup('PASAR',groupAmounts[1],2)]}],lineage:[] };
}

test('comparison preserves signed variance, NM/both-zero, signed contribution, and every basis label', () => {
  assert.equal(variance(d(-80),d(-100)).percent,'20.000000'); assert.equal(variance(d(100),d(0)).status,'NM'); assert.equal(variance(d(0),d(0)).percent,'0.000000');
  const compared = compareSnapshots(tiny('20','20',['-100','120']), tiny('100','100',['100','0'])); const basis = compared.children![0]; const [adum,pasar] = basis.children!;
  assert.equal(adum.contribution,'250.000000'); assert.equal(pasar.contribution,'-150.000000'); assert.equal(basis.contribution,'100.000000'); assert.equal(basis.contributionBasis,'ANALYSIS_BASIS_TO_COMPANY'); assert.equal(adum.contributionBasis,'COST_GROUP_TO_ANALYSIS_BASIS'); assert.equal(adum.children![0].contributionBasis,'NATURE_TO_COST_GROUP');
  const same = compareSnapshots(tiny('0','0',['0','0']),tiny('0','0',['0','0'])); assert.equal(same.children![0].contributionStatus,'PARENT_ZERO');
});

test('comparison is deterministic, treats a missing leaf as zero, and keeps calculated items fake-COA-free', () => {
  const current = buildFinalizedMonthlySnapshot(period('7000'))!; const comparison = buildFinalizedMonthlySnapshot(period('7000',2025,7))!; const nature = current.bases[1].groups.find(g=>g.code==='PASAR')!.natures.find(n=>n.code==='N02')!; const calculated = nature.items[0];
  comparison.bases[1].groups.find(g=>g.code==='PASAR')!.natures.find(n=>n.code==='N02')!.items=[];
  const first=compareSnapshots(current,comparison), second=compareSnapshots(current,comparison); assert.deepEqual(first,second); const node=first.children![1].children!.find(g=>g.code==='PASAR')!.children!.find(n=>n.code==='N02')!.children![0]; assert.equal(node.comparisonAmount,'0.00'); assert.equal(node.id,null); assert.equal(node.key,calculated.key); assert.equal(node.contributionBasis,'CALCULATED_ITEM_TO_NATURE');
});

test('variance uses the union of current and comparison items with exact zero semantics', () => {
  const current = buildFinalizedMonthlySnapshot(period('2000'))!;
  const comparison = buildFinalizedMonthlySnapshot(period('2000', 2025, 7))!;
  const currentNature = current.bases[0].groups[0].natures.find((nature) => !nature.amount.isZero())!;
  const comparisonNature = comparison.bases[0].groups[0].natures.find((nature) => nature.key === currentNature.key)!;
  const template = currentNature.items[0];
  currentNature.items = [
    { ...template, key: `${currentNature.key}:coa:70001`, id: 70001, code: 'CURRENT_ONLY', amount: d(25), order: 1 },
    { ...template, key: `${currentNature.key}:coa:70002`, id: 70002, code: 'BOTH', amount: d(0), order: 2 },
    { ...template, key: `${currentNature.key}:coa:70003`, id: 70003, code: 'BOTH_ZERO', amount: d(0), order: 3 },
  ];
  comparisonNature.items = [
    { ...template, key: `${currentNature.key}:coa:70002`, id: 70002, code: 'BOTH', amount: d(10), order: 2 },
    { ...template, key: `${currentNature.key}:coa:70003`, id: 70003, code: 'BOTH_ZERO', amount: d(0), order: 3 },
    { ...template, key: `${currentNature.key}:coa:70004`, id: 70004, code: 'COMPARISON_ONLY', amount: d(40), order: 4 },
  ];
  const nodes = compareSnapshots(current, comparison).children![0].children![0].children!.find((nature) => nature.key === currentNature.key)!.children!;
  assert.deepEqual(nodes.map((node) => [node.code, node.currentAmount, node.comparisonAmount, node.varianceAmount, node.variancePercentStatus]), [
    ['CURRENT_ONLY', '25.00', '0.00', '25.00', 'NM'],
    ['BOTH', '0.00', '10.00', '-10.00', 'AVAILABLE'],
    ['BOTH_ZERO', '0.00', '0.00', '0.00', 'AVAILABLE'],
    ['COMPARISON_ONLY', '0.00', '40.00', '-40.00', 'AVAILABLE'],
  ]);
});

test('finalization and active SUCCESS lineage gates reject invalid or superseded runs', () => {
  const provisional=period('2000'); provisional.status='CALCULATED'; assert.equal(buildFinalizedMonthlySnapshot(provisional),null);
  for (const mutate of [(p:PersistedPeriod)=>{p.activeRun!.status='FAILED';},(p:PersistedPeriod)=>{p.activeRun!.isActive=false;},(p:PersistedPeriod)=>{p.activeRun!.periodId++;},(p:PersistedPeriod)=>{p.activeCalculationRunId!++;}]) { const raw=period('2000'); mutate(raw); assert.throws(()=>buildFinalizedMonthlySnapshot(raw),/lineage/); }
  const unrelated=period('7000'); unrelated.activeRun!.sourceRows.push(...rows(999,'AUDIT_DERIV',[['Unknown','999']])); assert.equal(buildFinalizedMonthlySnapshot(unrelated)!.amount.toFixed(2),'512906834671.00');
});

test('missing/non-finalized comparisons and incomplete YTD are UNAVAILABLE', async () => {
  const current=period('2000',2026,3); let result=await createAnalysisService(repository([current]))(current.id,'MOM'); assert.equal(result.kind==='OK'&&result.status,'UNAVAILABLE');
  const prior=period('2000',2026,2); prior.status='CALCULATED'; result=await createAnalysisService(repository([current,prior]))(current.id,'MOM'); assert.equal(result.kind==='OK'&&result.status,'UNAVAILABLE');
  const history=[current,period('2000',2026,1),period('2000',2026,2),period('2000',2025,1),period('2000',2025,3)]; result=await createAnalysisService(repository(history))(current.id,'YTD'); assert.equal(result.kind==='OK'&&result.status,'UNAVAILABLE'); if(result.kind==='OK'&&result.status==='UNAVAILABLE') assert.deepEqual(result.missingPeriods,[{fiscalYear:2025,fiscalPeriod:2}]);
});

test('available YTD keeps basis separation and every constituent run/basis lineage', async () => {
  const periods=[2025,2026].flatMap(year=>[1,2,3].map(month=>period('7000',year,month))); const current=periods.find(p=>p.fiscalYear===2026&&p.fiscalPeriod===3)!; const result=await createAnalysisService(repository(periods))(current.id,'YTD'); assert.equal(result.kind==='OK'&&result.status,'AVAILABLE');
  if(result.kind==='OK'&&result.status==='AVAILABLE'){assert.equal(result.current.periods.length,6);assert.equal(result.comparison.periods.length,6);assert.deepEqual(result.hierarchy[0].children!.map(n=>n.code),['GHOPO','DERIV']);}
  const aggregated=aggregateSnapshots([buildFinalizedMonthlySnapshot(period('7000',2026,1))!,buildFinalizedMonthlySnapshot(period('7000',2026,2))!]); assert.deepEqual(aggregated.bases.map(b=>b.code),['GHOPO','DERIV']); assert.equal(aggregated.lineage.length,4);
});
