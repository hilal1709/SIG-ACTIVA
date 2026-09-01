import type { CostStructureProcess, ProcessBlocker, ProcessStage } from './types';

export function blockerText(blocker: ProcessBlocker): string {
  return typeof blocker === 'string' ? blocker : blocker.message ?? blocker.code ?? 'Tindakan pengguna diperlukan.';
}

export function blockedActionLabel(stage: ProcessStage): string {
  const haystack = [stage.errorCode, stage.message, ...(stage.blockers ?? []).map(blockerText)].join(' ').toUpperCase();
  return /MAPPING|UNMAPPED|COA/.test(haystack) ? 'Perbaiki mapping' : 'Retry proses';
}

export function friendlyStageError(stage: ProcessStage): { title: string; message: string; technicalDetail?: string } {
  const defaultTitle = stage.key === 'RECONCILIATION' ? 'Rekonsiliasi gagal' : `${stage.title} gagal`;
  const raw = stage.message?.trim();
  const technical = raw && /(Prisma|Invalid `|stack|\bat .+\(.+:\d+:\d+\))/i.test(raw);
  return {
    title: defaultTitle,
    message: technical ? 'Proses tidak dapat diselesaikan. Periksa data sumber, lalu coba kembali.' : raw || 'Proses berhenti karena terdapat data yang perlu diperbaiki.',
    technicalDetail: technical ? raw : undefined,
  };
}

export function shouldAutoAdvance(process: CostStructureProcess): boolean {
  return process.canAdvance && process.overallStatus !== 'BLOCKED' && process.overallStatus !== 'FINALIZED';
}

/**
 * Existing uploads can already be persisted as RECONCILIATION_BLOCKED before a newly
 * approved effective-dated baseline becomes available. The backend reconciliation
 * action is idempotent and performs the controlled authoritative predecessor backfill.
 * Permit exactly a caller-controlled one-shot recovery for mapping blockers; do not
 * broaden this to arbitrary business blockers or automatic retry loops.
 */
export function shouldAttemptMappingRecovery(process: CostStructureProcess): boolean {
  if (process.overallStatus !== 'BLOCKED' || !process.canRetry || process.currentStage !== 'RECONCILIATION') return false;
  const stage = process.stages.find((item) => item.key === 'RECONCILIATION');
  return Boolean(stage && stage.status === 'BLOCKED' && blockedActionLabel(stage) === 'Perbaiki mapping');
}

export function stageStatusLabel(status: ProcessStage['status']): string {
  return ({ COMPLETED: 'Selesai', RUNNING: 'Sedang diproses...', WAITING: 'Menunggu', BLOCKED: 'Terhenti', NOT_APPLICABLE: 'Tidak diperlukan' })[status];
}
