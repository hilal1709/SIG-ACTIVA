import { Prisma } from '@prisma/client';
import { COMPANY_2000_GROUPS, COMPANY_2000_SOURCES, DERIVATIVE_SOURCE_CODES } from './constants';
import type { Company2000GroupCode, EngineActualLine, EngineResult, ResolvedAdjustment, ResolvedSourceLine } from './types';

const zero = () => new Prisma.Decimal(0);
const allowedGroups = new Set<string>(COMPANY_2000_GROUPS);
const allowedSources = new Set<string>(COMPANY_2000_SOURCES);
const derivativeSources = new Set<string>(DERIVATIVE_SOURCE_CODES);

function validateTarget(line: { groupCode?: string; targetActive?: boolean; natureCalculationType?: string; costGroupId?: number; natureId?: number }) {
  if (!line.costGroupId || !line.natureId || !line.groupCode || !allowedGroups.has(line.groupCode)) throw new Error('Mapping target must be Company 2000 ADUM or PASAR.');
  if (!line.targetActive) throw new Error('Mapping target is inactive.');
  if (line.natureCalculationType !== 'MAPPED') throw new Error('Company 2000 Phase E accepts only MAPPED Nature targets.');
}

export function calculateCompany2000(input: { sourceLines: ResolvedSourceLine[]; adjustments?: ResolvedAdjustment[] }): EngineResult {
  const actualLines: EngineActualLine[] = [];
  const natureMetadata = new Map<string, { costGroupId: number; natureId: number; groupCode: Company2000GroupCode; natureCode: string }>();

  for (const line of input.sourceLines) {
    if (derivativeSources.has(line.logicalSourceCode) || !allowedSources.has(line.logicalSourceCode)) continue;
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
      costGroupId: line.costGroupId!, natureId: line.natureId!, coaId: line.coaId, lineType: 'COA',
      sourceAmount: line.amount, adjustmentAmount: zero(), finalAmount: line.amount, sourceRowId: line.sourceRowId,
      sourceReference: { uploadId: line.uploadId, uploadVersion: line.uploadVersion, logicalSourceCode: line.logicalSourceCode, sourceRowNumber: line.sourceRowNumber, mappingId: line.mappingId, mappingAction: line.mappingAction, coaCode: line.coaCode },
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
  const controls = COMPANY_2000_GROUPS.map((code) => {
    const sum = natureTotals.filter((nature) => nature.groupCode === code).reduce((value, nature) => value.add(nature.amount), zero());
    return { resultCode: `${code}_NATURE_RECONCILIATION`, costGroupId: groupIds.get(code) ?? 0, amount: groupTotals[code], difference: groupTotals[code].sub(sum) };
  });
  return { actualLines, natureTotals, groupTotals, companyTotal: groupTotals.ADUM.add(groupTotals.PASAR), controls };
}
