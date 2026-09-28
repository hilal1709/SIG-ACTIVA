export const STANDARD_MAPPING_SOURCES = ['CC_PROD', 'CC_ADUM', 'CC_PASAR', 'CC_WHRPG'] as const;
export const SUPPORT_SOURCES = ['TB', 'COAL', 'CLINKER_PURCHASE', 'SOLAR_PP_ORDER', 'OA_STAT', 'ADJUSTMENT'] as const;
export type ReconciliationStatus = 'RECONCILED' | 'NOT_RECONCILED' | 'MISSING_TOTAL' | 'AMBIGUOUS_TOTAL' | 'BLOCKED';
export type SourceRow = { id?: number; coaCodeRaw: string | null; descriptionRaw: string | null; amount: string | null };
export type ClassifiedRow = SourceRow & { kind: 'DETAIL' | 'REPORTED_TOTAL' | 'SUBTOTAL' | 'BLANK' | 'CONTROL' };
export type ReconciliationResult = { status: ReconciliationStatus; detailRowCount: number; controlRowCount: number; detailAmount: string; reportedAmount: string | null; difference: string | null; issueCode: string | null };
