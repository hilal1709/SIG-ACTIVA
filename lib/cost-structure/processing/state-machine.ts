export const PROCESS_STAGE_KEYS = [
  'UPLOAD',
  'SOURCE_VALIDATION',
  'RECONCILIATION',
  'AUDIT_READINESS',
  'CALCULATION',
  'POST_CHECK',
] as const;

export type ProcessStageKey = typeof PROCESS_STAGE_KEYS[number];
export type ProcessStageStatus = 'COMPLETED' | 'RUNNING' | 'WAITING' | 'BLOCKED' | 'NOT_APPLICABLE';
export type ProcessOverallStatus = 'PROCESSING' | 'BLOCKED' | 'READY' | 'FINALIZED';

export type ProcessBlocker = { code: string; message: string };

export type ProcessStage = {
  key: ProcessStageKey;
  status: ProcessStageStatus;
  title: string;
  message?: string;
  errorCode?: string;
  blockers?: ProcessBlocker[];
};

export type ProcessingSnapshot = {
  uploadId: number;
  periodId: number;
  uploadActive: boolean;
  uploadStatus: string;
  periodStatus: string;
  validationBlockers: ProcessBlocker[];
  reconciliationReady: boolean;
  reconciliationBlockers: ProcessBlocker[];
  auditReady: boolean;
  auditMissing: string[];
  calculation: null | {
    status: 'RUNNING' | 'SUCCESS' | 'FAILED';
    errorMessage?: string | null;
    belongsToUpload: boolean;
  };
  postCheckBlockers: ProcessBlocker[];
};

export type CostStructureProcessStatus = {
  uploadId: number;
  periodId: number;
  overallStatus: ProcessOverallStatus;
  currentStage: ProcessStageKey;
  stages: ProcessStage[];
  canAdvance: boolean;
  canRetry: boolean;
  readyForFinalization: boolean;
};

const titles: Record<ProcessStageKey, string> = {
  UPLOAD: 'Upload',
  SOURCE_VALIDATION: 'Source validation',
  RECONCILIATION: 'Reconciliation and mapping',
  AUDIT_READINESS: 'Audit readiness',
  CALCULATION: 'Calculation',
  POST_CHECK: 'Post-calculation integrity check',
};

function waitingStages(from: ProcessStageKey) {
  const start = PROCESS_STAGE_KEYS.indexOf(from);
  return PROCESS_STAGE_KEYS.slice(start).map((key) => ({ key, title: titles[key], status: 'WAITING' as const }));
}

/** Pure projection of persisted accounting state. It never advances or finalizes a period. */
export function deriveProcessStatus(snapshot: ProcessingSnapshot): CostStructureProcessStatus {
  const completed: ProcessStage[] = [];
  const result = (currentStage: ProcessStageKey, stage: ProcessStage, tail: ProcessStage[], canRetry = false): CostStructureProcessStatus => ({
    uploadId: snapshot.uploadId,
    periodId: snapshot.periodId,
    overallStatus: stage.status === 'BLOCKED' ? 'BLOCKED' : 'PROCESSING',
    currentStage,
    stages: [...completed, stage, ...tail],
    canAdvance: stage.status === 'WAITING',
    canRetry,
    readyForFinalization: false,
  });

  if (snapshot.periodStatus === 'FINALIZED') {
    return {
      uploadId: snapshot.uploadId,
      periodId: snapshot.periodId,
      overallStatus: 'FINALIZED',
      currentStage: 'POST_CHECK',
      stages: PROCESS_STAGE_KEYS.map((key) => ({ key, title: titles[key], status: 'COMPLETED' })),
      canAdvance: false,
      canRetry: false,
      readyForFinalization: false,
    };
  }

  if (!snapshot.uploadActive) {
    return result('UPLOAD', { key: 'UPLOAD', title: titles.UPLOAD, status: 'BLOCKED', errorCode: 'UPLOAD_NOT_ACTIVE', message: 'Upload bukan versi aktif.' }, waitingStages('SOURCE_VALIDATION'));
  }
  completed.push({ key: 'UPLOAD', title: titles.UPLOAD, status: 'COMPLETED' });

  if (snapshot.uploadStatus === 'VALIDATION_FAILED' || snapshot.validationBlockers.length) {
    return result('SOURCE_VALIDATION', { key: 'SOURCE_VALIDATION', title: titles.SOURCE_VALIDATION, status: 'BLOCKED', errorCode: 'SOURCE_VALIDATION_FAILED', message: snapshot.validationBlockers[0]?.message ?? 'Source validation gagal.', blockers: snapshot.validationBlockers }, waitingStages('RECONCILIATION'), true);
  }
  if (snapshot.uploadStatus !== 'VALIDATED') {
    return result('SOURCE_VALIDATION', { key: 'SOURCE_VALIDATION', title: titles.SOURCE_VALIDATION, status: 'WAITING', message: 'Menunggu validasi source selesai.' }, waitingStages('RECONCILIATION'));
  }
  completed.push({ key: 'SOURCE_VALIDATION', title: titles.SOURCE_VALIDATION, status: 'COMPLETED' });

  if (!snapshot.reconciliationReady) {
    const blocked = snapshot.reconciliationBlockers.length > 0;
    return result('RECONCILIATION', {
      key: 'RECONCILIATION', title: titles.RECONCILIATION, status: blocked ? 'BLOCKED' : 'WAITING',
      errorCode: blocked ? 'RECONCILIATION_BLOCKED' : undefined,
      message: blocked ? snapshot.reconciliationBlockers[0].message : 'Reconciliation dan mapping siap dijalankan.',
      blockers: blocked ? snapshot.reconciliationBlockers : undefined,
    }, waitingStages('AUDIT_READINESS'), blocked);
  }
  completed.push({ key: 'RECONCILIATION', title: titles.RECONCILIATION, status: 'COMPLETED' });

  if (!snapshot.auditReady) {
    const blockers = snapshot.auditMissing.map((code) => ({ code: 'MISSING_AUDIT_SOURCE', message: `Audit source ${code} belum tersedia.` }));
    return result('AUDIT_READINESS', { key: 'AUDIT_READINESS', title: titles.AUDIT_READINESS, status: 'WAITING', message: blockers[0]?.message, blockers }, waitingStages('CALCULATION'));
  }
  completed.push({ key: 'AUDIT_READINESS', title: titles.AUDIT_READINESS, status: 'COMPLETED' });

  if (!snapshot.calculation || !snapshot.calculation.belongsToUpload) {
    return result('CALCULATION', { key: 'CALCULATION', title: titles.CALCULATION, status: 'WAITING', message: 'Calculation siap dijalankan.' }, waitingStages('POST_CHECK'));
  }
  if (snapshot.calculation.status === 'RUNNING') {
    return result('CALCULATION', { key: 'CALCULATION', title: titles.CALCULATION, status: 'RUNNING', message: 'Calculation sedang berjalan.' }, waitingStages('POST_CHECK'));
  }
  if (snapshot.calculation.status === 'FAILED') {
    const message = snapshot.calculation.errorMessage || 'Calculation gagal.';
    return result('CALCULATION', { key: 'CALCULATION', title: titles.CALCULATION, status: 'BLOCKED', errorCode: 'CALCULATION_FAILED', message, blockers: [{ code: 'CALCULATION_FAILED', message }] }, waitingStages('POST_CHECK'), true);
  }
  completed.push({ key: 'CALCULATION', title: titles.CALCULATION, status: 'COMPLETED' });

  if (snapshot.postCheckBlockers.length) {
    return result('POST_CHECK', { key: 'POST_CHECK', title: titles.POST_CHECK, status: 'BLOCKED', errorCode: 'POST_CHECK_FAILED', message: snapshot.postCheckBlockers[0].message, blockers: snapshot.postCheckBlockers }, [], true);
  }

  if (snapshot.periodStatus !== 'COST_STRUCTURE_RECONCILED') {
    return result('POST_CHECK', { key: 'POST_CHECK', title: titles.POST_CHECK, status: 'WAITING', message: 'Integrity check siap dijalankan.' }, []);
  }

  completed.push({ key: 'POST_CHECK', title: titles.POST_CHECK, status: 'COMPLETED' });
  return { uploadId: snapshot.uploadId, periodId: snapshot.periodId, overallStatus: 'READY', currentStage: 'POST_CHECK', stages: completed, canAdvance: false, canRetry: false, readyForFinalization: true };
}

export type ProcessAdvanceActions = Partial<Record<ProcessStageKey, () => Promise<void>>>;

/** Runs no more than the current deterministic stage, then reloads authoritative state. */
export async function executeNextProcessStage(
  before: CostStructureProcessStatus,
  actions: ProcessAdvanceActions,
  reload: () => Promise<CostStructureProcessStatus>
) {
  if (before.overallStatus === 'FINALIZED' || before.overallStatus === 'READY' || (!before.canAdvance && !before.canRetry)) return before;
  const action = actions[before.currentStage];
  if (!action) return before;
  await action();
  return reload();
}
