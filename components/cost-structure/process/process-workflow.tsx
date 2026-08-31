'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { costStructureProcessApi, ProcessApiError } from './api';
import { shouldAutoAdvance } from './presentation';
import { ProcessTracker } from './process-tracker';
import type { CostStructureProcess } from './types';

const NETWORK_BACKOFF_MS = [1200, 2500, 5000];

export default function ProcessWorkflow({ uploadId, onProcessChange }: { uploadId: number; onProcessChange?: (value: CostStructureProcess) => void }) {
  const [process, setProcess] = useState<CostStructureProcess | null>(null);
  const [error, setError] = useState<{ message: string; detail?: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const requestInFlight = useRef(false);
  const networkAttempt = useRef(0);

  const update = useCallback((value: CostStructureProcess) => { setProcess(value); onProcessChange?.(value); }, [onProcessChange]);
  const load = useCallback(async () => {
    try { update(await costStructureProcessApi.get(uploadId)); setError(null); networkAttempt.current = 0; }
    catch (caught) {
      const e = caught instanceof ProcessApiError ? caught : new ProcessApiError(caught instanceof Error ? caught.message : 'Koneksi proses gagal.');
      if (e.process) update(e.process);
      setError({ message: e.message, detail: e.technicalDetail });
    }
  }, [uploadId, update]);

  const advance = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true; setSubmitting(true);
    try {
      await costStructureProcessApi.advance(uploadId);
      update(await costStructureProcessApi.get(uploadId));
      setError(null); networkAttempt.current = 0;
    } catch (caught) {
      const e = caught instanceof ProcessApiError ? caught : new ProcessApiError(caught instanceof Error ? caught.message : 'Koneksi proses gagal.');
      if (e.process) {
        update(e.process);
        setError(null);
        networkAttempt.current = 0;
      } else {
        setError({ message: e.message, detail: e.technicalDetail });
        if (e.retryable) networkAttempt.current = Math.min(networkAttempt.current + 1, NETWORK_BACKOFF_MS.length);
        else networkAttempt.current = NETWORK_BACKOFF_MS.length;
      }
    } finally { requestInFlight.current = false; setSubmitting(false); }
  }, [uploadId, update]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!process || !shouldAutoAdvance(process) || requestInFlight.current) return;
    if (error && networkAttempt.current >= NETWORK_BACKOFF_MS.length) return;
    const delay = NETWORK_BACKOFF_MS[Math.max(0, networkAttempt.current - 1)] ?? 900;
    const timer = window.setTimeout(() => void advance(), delay);
    return () => window.clearTimeout(timer);
  }, [advance, process, error]);

  const finalize = async () => {
    if (!process?.readyForFinalization || requestInFlight.current) return;
    requestInFlight.current = true; setSubmitting(true);
    try {
      const response = await fetch(`/api/cost-structure/periods/${process.periodId}/finalize`, { method: 'POST' });
      if (!response.ok) throw new Error('Finalisasi gagal. Periksa kembali kesiapan periode.');
      await load();
    } catch (caught) { setError({ message: caught instanceof Error ? caught.message : 'Finalisasi gagal.' }); }
    finally { requestInFlight.current = false; setSubmitting(false); }
  };

  if (!process) return <section className="min-w-0 rounded-xl border bg-card p-4 sm:p-6">{error ? <InlineError error={error} retry={load} /> : <p className="flex items-center gap-2 text-sm text-muted-foreground"><span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />Memuat status proses…</p>}</section>;
  return <div className="min-w-0 space-y-3"><ProcessTracker process={process} submitting={submitting} onRetry={advance} onFinalize={finalize} />{error && <InlineError error={error} retry={advance} />}</div>;
}

function InlineError({ error, retry }: { error: { message: string; detail?: string }; retry: () => void | Promise<void> }) {
  return <div className="max-w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><p className="font-semibold">Koneksi proses terganggu</p><p className="mt-1 break-words">{error.message}</p>{error.detail && <details className="mt-2"><summary className="cursor-pointer font-medium">Technical detail</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs">{error.detail}</pre></details>}<button type="button" onClick={() => void retry()} className="mt-3 rounded-md border border-amber-700 px-3 py-1.5 font-medium">Coba lagi</button></div>;
}
