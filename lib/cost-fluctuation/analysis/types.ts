import type { Prisma } from '@prisma/client';

export type ComparisonType = 'MOM' | 'YOY' | 'YTD';
export type AnalysisBasisCode = 'SI' | 'GHOPO' | 'DERIV';
export type MetricStatus = 'AVAILABLE' | 'NM' | 'PARENT_ZERO' | 'NOT_APPLICABLE';
export interface MonthRef { fiscalYear: number; fiscalPeriod: number }
export interface Lineage extends MonthRef { periodId: number; runId: number; ruleSetVersion: string; uploadId: number; basisCode: AnalysisBasisCode }
export interface SnapshotItem { key: string; id: number | null; code: string; label: string; amount: Prisma.Decimal; order: number; lineType?: string; ruleCode?: string | null }
export interface SnapshotNature extends SnapshotItem { items: SnapshotItem[] }
export interface SnapshotGroup extends SnapshotItem { natures: SnapshotNature[] }
export interface SnapshotBasis extends SnapshotItem { basisCode: AnalysisBasisCode; groups: SnapshotGroup[] }
export interface AnalyticalSnapshot { companyId: number; companyCode: string; amount: Prisma.Decimal; bases: SnapshotBasis[]; lineage: Lineage[] }
export interface ComparedMetric { currentAmount: string; comparisonAmount: string; varianceAmount: string; variancePercent: string | null; variancePercentStatus: MetricStatus; contribution: string | null; contributionStatus: MetricStatus; contributionBasis: string | null }
export interface ComparedNode extends ComparedMetric { key: string; id: number | null; code: string; label: string; nodeType: 'COMPANY' | 'ANALYSIS_BASIS' | 'COST_GROUP' | 'NATURE' | 'COA' | 'CALCULATED_ITEM'; order: number; children?: ComparedNode[]; lineType?: string; ruleCode?: string | null }

export interface PersistedResult { costGroupId: number | null; natureId: number | null; resultCode: string; resultType: string; amount: Prisma.Decimal; costGroup: { code: string; name: string; displayOrder: number } | null; nature: { code: string; name: string; displayOrder: number } | null }
export interface PersistedLine { costGroupId: number; natureId: number; coaId: number | null; lineType: string; finalAmount: Prisma.Decimal; ruleCode: string | null; coa: { coaCode: string; coaDescription: string | null } | null }
export interface PersistedSourceRow { id: number; uploadId: number; logicalSourceCode: string; sourceRowNumber: number; rawDataJson: unknown }
export interface PersistedPeriod extends MonthRef { id: number; companyId: number; companyCode: string; status: string; activeCalculationRunId: number | null; activeRun: null | { id: number; periodId: number; uploadId: number; uploadIsActiveVersion: boolean; status: string; isActive: boolean; ruleSetVersion: string; results: PersistedResult[]; actualLines: PersistedLine[]; sourceRows: PersistedSourceRow[] } }
export interface AnalysisRepository { findPeriodById(id: number): Promise<PersistedPeriod | null>; findPeriod(companyId: number, month: MonthRef): Promise<PersistedPeriod | null> }
