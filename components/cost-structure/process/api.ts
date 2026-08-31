import type { CostStructureProcess } from './types';

export class ProcessApiError extends Error {
  constructor(message: string, readonly technicalDetail?: string) {
    super(message);
    this.name = 'ProcessApiError';
  }
}

function safeTechnicalDetail(value?: string): string | undefined {
  if (!value) return undefined;
  const withoutStack = value.split('\n').filter((line) => !/^\s*at\s/.test(line)).join('\n').trim();
  return withoutStack.slice(0, 4000) || undefined;
}

async function readResponse(response: Response): Promise<CostStructureProcess> {
  const text = await response.text();
  let value: unknown;
  try { value = text ? JSON.parse(text) : null; } catch { value = null; }
  if (!response.ok) {
    const payload = value as { error?: string; message?: string } | null;
    throw new ProcessApiError('Status proses belum dapat dimuat. Coba lagi beberapa saat.', safeTechnicalDetail(payload?.error ?? payload?.message ?? text));
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
