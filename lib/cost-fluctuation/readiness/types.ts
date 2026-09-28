import type { MonthRef } from '../analysis/types';

export type ReadinessState = 'AVAILABLE' | 'MISSING' | 'NOT_FINALIZED' | 'INVALID_ACTIVE_RUN';

export interface ReadinessPeriod extends MonthRef {
  id: number;
  companyId: number;
  companyCode: string;
  status: string;
  activeCalculationRunId: number | null;
  activeRun: null | {
    id: number;
    periodId: number;
    status: string;
    isActive: boolean;
    ruleSetVersion: string;
  };
}

export interface PeriodCheck extends MonthRef {
  periodId: number | null;
  status: string | null;
  readiness: ReadinessState;
  reason: string;
}

export interface ComparisonReadiness {
  readiness: ReadinessState;
  required: PeriodCheck[];
  available: PeriodCheck[];
  missing: PeriodCheck[];
  nonFinalized: PeriodCheck[];
  invalidActiveRuns: PeriodCheck[];
}

export interface CurrentPeriodReadiness {
  companyCode: string;
  fiscalYear: number;
  fiscalPeriod: number;
  periodId: number;
  status: string;
  finalized: boolean;
  activeRun: ReadinessPeriod['activeRun'];
  currentReadiness: ReadinessState;
  mom: ComparisonReadiness;
  yoy: ComparisonReadiness;
  ytd: ComparisonReadiness;
}

export interface ReadinessMatrix {
  periods: CurrentPeriodReadiness[];
  companies: string[];
}
