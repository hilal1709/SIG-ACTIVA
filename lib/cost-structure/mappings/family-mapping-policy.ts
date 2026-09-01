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

export type HierarchicalFamilyEvidenceLevel = {
  familyPrefix: string;
  evidence: FamilyMappingEvidence[];
};

export type HierarchicalInferredFamilyMapping = InferredFamilyMapping & {
  familyPrefix: string;
  evidenceCoaCount: number;
};

export function coaFamilyPrefixes(coaCode: string): string[] {
  const normalized = coaCode.trim();
  if (!/^\d{4,}$/.test(normalized)) return [];
  return [normalized.slice(0, 4), normalized.slice(0, 3)];
}

/** Backward-compatible primary family key. */
export function coaFamilyPrefix(coaCode: string): string | null {
  return coaFamilyPrefixes(coaCode)[0] ?? null;
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
 * 2. if same-company evidence exists but conflicts, no cross-company fallback is allowed;
 * 3. cross-company evidence is used only when there is no same-company evidence and
 *    every usable mapping in that same source/family has one target signature;
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

/**
 * Tries family levels from narrowest to broadest (currently 4 digits, then 3 digits).
 * A conflicting narrower family stops inference completely; it is never hidden by a
 * broader consensus. The broader 3-digit fallback additionally requires at least two
 * distinct evidence COAs in the selected scope so one sibling cannot define a broad family.
 */
export function inferHierarchicalFamilyMappingTarget(
  levels: HierarchicalFamilyEvidenceLevel[],
  currentCompanyId: number
): HierarchicalInferredFamilyMapping | null {
  for (const level of levels) {
    const usable = level.evidence.filter(usableEvidence);
    if (!usable.length) continue;

    const inferred = inferFamilyMappingTarget(level.evidence, currentCompanyId);
    // Evidence exists at this more-specific level but does not agree: fail closed.
    if (!inferred) return null;

    const sameCompany = usable.filter((item) => item.companyId === currentCompanyId);
    const scopedEvidence = inferred.scope === 'SAME_COMPANY'
      ? sameCompany
      : usable.filter((item) => item.companyId !== currentCompanyId);
    const evidenceCoaCount = new Set(scopedEvidence.map((item) => item.coaCode)).size;

    if (level.familyPrefix.length === 3 && evidenceCoaCount < 2) return null;

    return {
      ...inferred,
      familyPrefix: level.familyPrefix,
      evidenceCoaCount,
    };
  }
  return null;
}
