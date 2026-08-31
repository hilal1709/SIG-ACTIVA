import 'server-only';
import { prisma } from '@/lib/prisma';
import { getAuditSnapshotReadiness } from '@/lib/cost-structure/audit-hydration/readiness';
import { hydrateAuditSnapshot } from '@/lib/cost-structure/audit-hydration/service';
import { runCostStructureCalculation } from '@/lib/cost-structure/calculations/run-service';
import { reconcileCostStructure } from '@/lib/cost-structure/finalization/service';
import { getPhaseDReport, refreshPeriodReadiness, runPhaseD } from '@/lib/cost-structure/reconciliation/service';
import { deriveProcessStatus, executeNextProcessStage, type CostStructureProcessStatus, type ProcessBlocker, type ProcessingSnapshot } from './state-machine';

export class CostStructureProcessNotFoundError extends Error {}

function issueBlocker(issue: { issueCode: string; message: string }): ProcessBlocker {
  return { code: issue.issueCode, message: issue.message };
}

export async function getCostStructureProcessStatus(uploadId: number): Promise<CostStructureProcessStatus> {
  const upload = await prisma.costUpload.findUnique({
    where: { id: uploadId },
    include: {
      period: { include: { company: { select: { companyCode: true } }, activeCalculationRun: { include: { results: { where: { resultType: 'CONTROL' }, select: { resultCode: true, reconciliationDifference: true, reconciliationStatus: true } } } } } },
      validationIssues: { where: { resolved: false, severity: 'ERROR' }, orderBy: { createdAt: 'asc' }, select: { issueCode: true, message: true } },
      sourceRows: { where: { mappingStatus: { notIn: ['UNMAPPED', 'AUDIT_ONLY'] } }, take: 1, select: { id: true } },
      calculationRuns: { orderBy: { runNumber: 'desc' }, take: 1, select: { uploadId: true, status: true, errorMessage: true } },
    },
  });
  if (!upload) throw new CostStructureProcessNotFoundError('Upload tidak ditemukan.');

  const report = await getPhaseDReport(uploadId);
  if (!report) throw new CostStructureProcessNotFoundError('Upload tidak ditemukan.');
  const audit = await getAuditSnapshotReadiness(uploadId, upload.period.company.companyCode);
  const phaseDIssueCodes = new Set([
    'CC_GROUP_TOTAL_NOT_FOUND',
    'CC_GROUP_TOTAL_AMBIGUOUS',
    'CC_GROUP_NOT_RECONCILED',
    'SOURCE_ROW_MISSING_COA',
    'UNMAPPED_COA',
    'MAPPING_AMBIGUOUS',
    'MAPPING_OVERLAP',
    'MAPPING_TARGET_INVALID',
  ]);
  const structuralIssues = upload.validationIssues.filter((issue) => !phaseDIssueCodes.has(issue.issueCode));
  const phaseDStarted = upload.sourceRows.length > 0 || upload.validationIssues.some((issue) => phaseDIssueCodes.has(issue.issueCode));
  const activeRun = upload.period.activeCalculationRun;
  const postCheckBlockers = activeRun?.status === 'SUCCESS'
    ? activeRun.results.filter((control) => control.reconciliationStatus !== 'RECONCILED' || !control.reconciliationDifference?.isZero()).map((control) => ({ code: control.resultCode, message: `${control.resultCode} belum reconciled (difference ${control.reconciliationDifference?.toString() ?? 'N/A'}).` }))
    : [];
  const latestRun = upload.calculationRuns[0] ?? null;
  const snapshot: ProcessingSnapshot = {
    uploadId,
    periodId: upload.periodId,
    uploadActive: upload.isActiveVersion,
    uploadStatus: upload.status,
    periodStatus: upload.period.status,
    validationBlockers: structuralIssues.map(issueBlocker),
    reconciliationReady: report.ready,
    reconciliationBlockers: phaseDStarted ? report.blockers.map((message) => ({ code: 'RECONCILIATION_BLOCKER', message })) : [],
    auditReady: audit.ready,
    auditMissing: audit.missing,
    calculation: activeRun ? { status: activeRun.status, errorMessage: activeRun.errorMessage, belongsToUpload: activeRun.uploadId === uploadId } : latestRun ? { status: latestRun.status, errorMessage: latestRun.errorMessage, belongsToUpload: latestRun.uploadId === uploadId } : null,
    postCheckBlockers,
  };
  return deriveProcessStatus(snapshot);
}

type AdvanceDependencies = {
  status(uploadId: number): Promise<CostStructureProcessStatus>;
  reconcile(uploadId: number): Promise<void>;
  hydrate(periodId: number, uploadId: number, userId: number): Promise<void>;
  calculate(periodId: number, userId: number): Promise<void>;
  postCheck(periodId: number, userId: number): Promise<void>;
};

const dependencies: AdvanceDependencies = {
  status: getCostStructureProcessStatus,
  reconcile: async (uploadId) => { await runPhaseD(uploadId); await refreshPeriodReadiness(uploadId); },
  hydrate: async (periodId, uploadId, userId) => { await hydrateAuditSnapshot(periodId, userId, uploadId); },
  calculate: async (periodId, userId) => { await runCostStructureCalculation(periodId, userId); },
  postCheck: async (periodId, userId) => { await reconcileCostStructure(periodId, userId); },
};

/** Executes at most one persisted stage. FINALIZE is deliberately absent. */
export async function advanceCostStructureProcess(uploadId: number, userId: number, deps: AdvanceDependencies = dependencies) {
  const before = await deps.status(uploadId);
  return executeNextProcessStage(before, {
    RECONCILIATION: () => deps.reconcile(uploadId),
    AUDIT_READINESS: () => deps.hydrate(before.periodId, uploadId, userId),
    CALCULATION: () => deps.calculate(before.periodId, userId),
    POST_CHECK: () => deps.postCheck(before.periodId, userId),
  }, () => deps.status(uploadId));
}
