export type ComparisonType = 'MOM' | 'YOY' | 'YTD';
export type ComparisonStatus = 'AVAILABLE' | 'UNAVAILABLE';
export type MetricStatus = 'AVAILABLE' | 'NM' | 'PARENT_ZERO' | 'NOT_APPLICABLE';

export interface MonthRef { fiscalYear: number; fiscalPeriod: number }
export interface Lineage { periodId: number; fiscalYear: number; fiscalPeriod: number; runId: number; ruleSetVersion: string }
export interface SnapshotItem { key: string; id: number | null; code: string; label: string; amount: import('@prisma/client').Prisma.Decimal; lineType?: string; ruleCode?: string | null }
export interface SnapshotNature extends SnapshotItem { items: SnapshotItem[] }
export interface SnapshotGroup extends SnapshotItem { natures: SnapshotNature[] }
export interface AnalyticalSnapshot { companyId: number; companyCode: string; amount: import('@prisma/client').Prisma.Decimal; groups: SnapshotGroup[]; lineage: Lineage[] }
export interface ComparedMetric { currentAmount: string; comparisonAmount: string; varianceAmount: string; variancePercent: string | null; variancePercentStatus: MetricStatus; contribution: string | null; contributionStatus: MetricStatus; contributionBasis: string | null }
export interface ComparedNode extends ComparedMetric { key: string; id: number | null; code: string; label: string; nodeType: 'COMPANY' | 'COST_GROUP' | 'NATURE' | 'COA' | 'CALCULATED_ITEM'; children?: ComparedNode[]; lineType?: string; ruleCode?: string | null }
