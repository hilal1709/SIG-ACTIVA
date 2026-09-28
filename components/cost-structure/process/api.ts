import type { CostStructureProcess } from './types';

export class ProcessApiError extends Error {
  constructor(
    message: string,
    readonly technicalDetail?: string,
    readonly process?: CostStructureProcess,
    readonly retryable = true
  ) {
    super(message);
    this.name = 'ProcessApiError';
  }
}

function safeTechnicalDetail(value?: string): string | undefined {
  if (!value) return undefined;
  const withoutStack = value.split('\n').filter((line) => !/^\s*at\s/.test(line)).join('\n').trim();
  return withoutStack.slice(0, 4000) || undefined;
}

function isProcess(value: unknown): value is CostStructureProcess {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CostStructureProcess>;
  return typeof candidate.uploadId === 'number'
    && typeof candidate.periodId === 'number'
    && typeof candidate.overallStatus === 'string'
    && Array.isArray(candidate.stages)
    && typeof candidate.canAdvance === 'boolean'
    && typeof candidate.canRetry === 'boolean';
}

async function readResponse(response: Response): Promise<CostStructureProcess> {
  const text = await response.text();
  let value: unknown;
  try { value = text ? JSON.parse(text) : null; } catch { value = null; }
  if (!response.ok) {
    const payload = value as ({ error?: string; message?: string } & Partial<CostStructureProcess>) | null;
    const process = isProcess(value) ? value : undefined;
    const detail = safeTechnicalDetail(payload?.error ?? payload?.message ?? text);
    if (process) {
      throw new ProcessApiError(
        payload?.error ?? payload?.message ?? 'Proses berhenti pada tahap yang membutuhkan intervensi.',
        detail,
        process,
        false
      );
    }
    throw new ProcessApiError('Status proses belum dapat dimuat. Coba lagi beberapa saat.', detail, undefined, response.status >= 500);
  }
  return value as CostStructureProcess;
}

/** Isolated transport adapter for the backend process orchestrator contract. */
export const costStructureProcessApi = {
  get: (uploadId: number, signal?: AbortSignal) =>
    fetch(`/api/cost-structure/uploads/${uploadId}/process`, { signal, cache: 'no-store' }).then(readResponse),
  advance: (uploadId: number, signal?: AbortSignal) =>
    fetch(`/api/cost-structure/uploads/${uploadId}/process`, { method: 'POST', signal }).then(readResponse),
};
