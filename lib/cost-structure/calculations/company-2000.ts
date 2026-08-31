import { Prisma } from '@prisma/client';
import { COMPANY_2000_GROUPS, COMPANY_2000_SOURCES, COMPANY_2000_SUPPORT_SOURCES } from './constants';
import type { Company2000GroupCode, EngineActualLine, EngineResult, ResolvedAdjustment, ResolvedSourceLine } from './types';
import type { Company2000SupportControls } from './company-2000-si-adapter';

const zero = () => new Prisma.Decimal(0);
const allowedGroups = new Set<string>(COMPANY_2000_GROUPS);
const allowedSources = new Set<string>(COMPANY_2000_SOURCES);
const supportSources = new Set<string>(COMPANY_2000_SUPPORT_SOURCES);

function validateTarget(line: { groupCode?: string; targetActive?: boolean; natureCalculationType?: string; costGroupId?: number; natureId?: number }) {
  if (!line.costGroupId || !line.natureId || !line.groupCode || !allowedGroups.has(line.groupCode)) throw new Error('Mapping target must be Company 2000 ADUM or PASAR.');
  if (!line.targetActive) throw new Error('Mapping target is inactive.');
  if (line.natureCalculationType !== 'MAPPED') throw new Error('Company 2000 Phase E accepts only MAPPED Nature targets.');
}

export function calculateCompany2000(input: { sourceLines: ResolvedSourceLine[]; adjustments?: ResolvedAdjustment[]; supportControl?: Company2000SupportControls }): EngineResult {
  const actualLines: EngineActualLine[] = [];
  const natureMetadata = new Map<string, { costGroupId: number; natureId: number; groupCode: Company2000GroupCode; natureCode: string }>();

  for (const line of input.sourceLines) {
    if (!allowedSources.has(line.logicalSourceCode) && !supportSources.has(line.logicalSourceCode)) continue;
    if (line.disposition === 'CONTROL_ROW' || line.disposition === 'SUPPORT_SOURCE' || line.disposition === 'EXCLUDED') continue;
    if (line.disposition === 'UNMAPPED' && line.amount.isZero()) continue;
    if (line.applicableMappingCount !== 1) {
      throw new Error(line.applicableMappingCount === 0 ? 'Non-zero source row has no effective mapping.' : 'Source row has ambiguous effective mappings.');
    }
    if (line.disposition === 'UNMAPPED') {
      throw new Error('Non-zero UNMAPPED source amount blocks calculation.');
    }
    validateTarget(line);
    const groupCode = line.groupCode as Company2000GroupCode;
    const key = `${line.costGroupId}:${line.natureId}`;
    natureMetadata.set(key, { costGroupId: line.costGroupId!, natureId: line.natureId!, groupCode, natureCode: line.natureCode! });
    actualLines.push({
      costGroupId: line.costGroupId!, natureId: line.natureId!, coaId: line.coaId, lineType: supportSources.has(line.logicalSourceCode) ? 'ADJUSTMENT' : 'COA',
      sourceAmount: supportSources.has(line.logicalSourceCode) ? null : line.amount, adjustmentAmount: supportSources.has(line.logicalSourceCode) ? line.amount : zero(), finalAmount: line.amount, sourceRowId: line.sourceRowId,
      ruleCode: line.ruleCode,
      sourceReference: { uploadId: line.uploadId, uploadVersion: line.uploadVersion, logicalSourceCode: line.logicalSourceCode, sourceRowNumber: line.sourceRowNumber, mappingId: line.mappingId, mappingAction: line.mappingAction, coaCode: line.coaCode, ...line.sourceReference },
    });
  }

  for (const adjustment of input.adjustments ?? []) {
    validateTarget(adjustment);
    const groupCode = adjustment.groupCode as Company2000GroupCode;
    const key = `${adjustment.costGroupId}:${adjustment.natureId}`;
    natureMetadata.set(key, { costGroupId: adjustment.costGroupId, natureId: adjustment.natureId, groupCode, natureCode: adjustment.natureCode });
    actualLines.push({ costGroupId: adjustment.costGroupId, natureId: adjustment.natureId, coaId: adjustment.coaId, lineType: 'ADJUSTMENT', sourceAmount: null, adjustmentAmount: adjustment.amount, finalAmount: adjustment.amount, sourceRowId: null, sourceReference: { adjustmentId: adjustment.adjustmentId, reason: adjustment.reason, reference: adjustment.reference } });
  }

  const totals = new Map<string, Prisma.Decimal>();
  for (const line of actualLines) {
    const key = `${line.costGroupId}:${line.natureId}`;
    totals.set(key, (totals.get(key) ?? zero()).add(line.finalAmount));
  }
  const natureTotals = [...natureMetadata.entries()].map(([key, metadata]) => ({ ...metadata, amount: totals.get(key) ?? zero() }))
    .sort((a, b) => a.groupCode.localeCompare(b.groupCode) || a.natureCode.localeCompare(b.natureCode) || a.natureId - b.natureId);
  const groupTotals = { ADUM: zero(), PASAR: zero() };
  for (const nature of natureTotals) groupTotals[nature.groupCode] = groupTotals[nature.groupCode].add(nature.amount);
  const groupIds = new Map(natureTotals.map((nature) => [nature.groupCode, nature.costGroupId]));
  const contribution = (groupCode: Company2000GroupCode, predicate: (line: EngineActualLine) => boolean) => actualLines
    .filter((line) => line.costGroupId === groupIds.get(groupCode) && predicate(line))
    .reduce((sum, line) => sum.add(line.finalAmount), zero());
  const raw = { ADUM: contribution('ADUM', (line) => line.lineType === 'COA'), PASAR: contribution('PASAR', (line) => line.lineType === 'COA') };
  const rincianDelta = { ADUM: contribution('ADUM', (line) => line.ruleCode === 'RINCIAN_DELTA_ADUM'), PASAR: contribution('PASAR', (line) => line.ruleCode === 'RINCIAN_DELTA_PASAR') };
  const derivative = contribution('PASAR', (line) => line.ruleCode === 'CC_DRV_DERIVATIVE_OFFSET');
  const manual = { ADUM: contribution('ADUM', (line) => line.lineType === 'ADJUSTMENT' && !line.ruleCode), PASAR: contribution('PASAR', (line) => line.lineType === 'ADJUSTMENT' && !line.ruleCode) };
  const rincianActual = { ADUM: raw.ADUM.add(rincianDelta.ADUM), PASAR: raw.PASAR.add(rincianDelta.PASAR) };
  const evidence = input.supportControl ?? { rincianAdumTotal: rincianActual.ADUM, rincianPasarTotal: rincianActual.PASAR, derivativeDetailTotal: derivative.abs(), derivativeControlTotal: derivative.abs() };
  const expectedSi = {
    ADUM: evidence.rincianAdumTotal.add(manual.ADUM),
    PASAR: evidence.rincianPasarTotal.sub(evidence.derivativeSiTotal ?? evidence.derivativeControlTotal).add(manual.PASAR),
  };
  const controls = COMPANY_2000_GROUPS.map((code) => {
    const sum = natureTotals.filter((nature) => nature.groupCode === code).reduce((value, nature) => value.add(nature.amount), zero());
    return { resultCode: `${code}_NATURE_RECONCILIATION`, costGroupId: groupIds.get(code) ?? 0, amount: groupTotals[code], difference: groupTotals[code].sub(sum) };
  });
  controls.push(
    { resultCode: 'RINCIAN_ADUM_RECONCILIATION', costGroupId: groupIds.get('ADUM') ?? 0, amount: evidence.rincianAdumTotal, difference: rincianActual.ADUM.sub(evidence.rincianAdumTotal) },
    { resultCode: 'RINCIAN_PASAR_RECONCILIATION', costGroupId: groupIds.get('PASAR') ?? 0, amount: evidence.rincianPasarTotal, difference: rincianActual.PASAR.sub(evidence.rincianPasarTotal) },
    { resultCode: 'CC_DRV_DETAIL_RECONCILIATION', costGroupId: groupIds.get('PASAR') ?? 0, amount: evidence.derivativeControlTotal, difference: evidence.derivativeDetailTotal.sub(evidence.derivativeControlTotal) },
    { resultCode: 'SI_ADUM_RECONCILIATION', costGroupId: groupIds.get('ADUM') ?? 0, amount: expectedSi.ADUM, difference: groupTotals.ADUM.sub(expectedSi.ADUM) },
    { resultCode: 'SI_PASAR_RECONCILIATION', costGroupId: groupIds.get('PASAR') ?? 0, amount: expectedSi.PASAR, difference: groupTotals.PASAR.sub(expectedSi.PASAR) },
    { resultCode: 'SI_COMPANY_RECONCILIATION', costGroupId: groupIds.get('PASAR') ?? 0, amount: expectedSi.ADUM.add(expectedSi.PASAR), difference: groupTotals.ADUM.add(groupTotals.PASAR).sub(expectedSi.ADUM.add(expectedSi.PASAR)) },
  );
  return { actualLines, natureTotals, groupTotals, companyTotal: groupTotals.ADUM.add(groupTotals.PASAR), controls };
}
