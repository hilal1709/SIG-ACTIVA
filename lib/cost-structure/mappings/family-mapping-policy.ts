export type FamilyMappingAction = 'INCLUDE' | 'EXCLUDE' | 'RECLASS';

export type FamilyMappingEvidence = {
  companyId: number;
  coaCode: string;
  mappingAction: FamilyMappingAction;
  groupCode: string | null;
  natureCode: string | null;
};

export type InferredFamilyMapping = {
  mappingAction: 'INCLUDE' | 'EXCLUDE';
  groupCode: string | null;
  natureCode: string | null;
  scope: 'SAME_COMPANY' | 'CROSS_COMPANY';
  evidenceCount: number;
};

export function coaFamilyPrefix(coaCode: string): string | null {
  const normalized = coaCode.trim();
  return /^\d{4,}$/.test(normalized) ? normalized.slice(0, 4) : null;
}

function usableEvidence(item: FamilyMappingEvidence) {
  if (item.mappingAction === 'RECLASS') return false;
  if (item.mappingAction === 'EXCLUDE') return true;
  return Boolean(item.groupCode && item.natureCode);
}

function signature(item: FamilyMappingEvidence) {
  return `${item.mappingAction}|${item.groupCode ?? ''}|${item.natureCode ?? ''}`;
}

function infer(items: FamilyMappingEvidence[], scope: InferredFamilyMapping['scope']): InferredFamilyMapping | null {
  const usable = items.filter(usableEvidence);
  if (!usable.length) return null;
  const signatures = new Set(usable.map(signature));
  if (signatures.size !== 1) return null;
  const sample = usable[0];
  if (sample.mappingAction !== 'INCLUDE' && sample.mappingAction !== 'EXCLUDE') return null;
  return {
    mappingAction: sample.mappingAction,
    groupCode: sample.mappingAction === 'EXCLUDE' ? null : sample.groupCode,
    natureCode: sample.mappingAction === 'EXCLUDE' ? null : sample.natureCode,
    scope,
    evidenceCount: usable.length,
  };
}

/**
 * Family inference is fail-closed:
 * 1. same company + same source family evidence has priority;
 * 2. if same-company evidence exists but conflicts, no fallback is allowed;
 * 3. cross-company evidence is used only when there is no same-company evidence and
 *    every usable mapping in that same source/four-digit family has one target signature;
 * 4. RECLASS is never inferred automatically.
 */
export function inferFamilyMappingTarget(
  evidence: FamilyMappingEvidence[],
  currentCompanyId: number
): InferredFamilyMapping | null {
  const sameCompany = evidence.filter((item) => item.companyId === currentCompanyId && usableEvidence(item));
  if (sameCompany.length) return infer(sameCompany, 'SAME_COMPANY');
  return infer(evidence.filter((item) => item.companyId !== currentCompanyId), 'CROSS_COMPANY');
}
