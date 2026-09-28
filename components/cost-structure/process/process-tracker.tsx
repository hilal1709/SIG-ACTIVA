'use client';

import { Check, Circle, CircleAlert, Loader2, Minus, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import type { CostStructureProcess, ProcessStage } from './types';
import { blockedActionLabel, blockerText, friendlyStageError, stageStatusLabel } from './presentation';

export function ProcessTracker({ process, submitting, onRetry, onFinalize }: {
  process: CostStructureProcess;
  submitting: boolean;
  onRetry: () => void;
  onFinalize: () => void;
}) {
  return <section aria-labelledby="process-title" className="min-w-0 rounded-xl border bg-card p-4 shadow-sm sm:p-6">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0"><h2 id="process-title" className="text-lg font-semibold">Proses Cost Structure</h2><p className="text-sm text-muted-foreground">Tahapan berjalan otomatis dan aman dilanjutkan saat halaman dibuka kembali.</p></div>
      <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-semibold">{process.overallStatus}</span>
    </div>
    <ol className="mt-6 space-y-0">{process.stages.map((stage, index) => <StageItem key={stage.key} stage={stage} last={index === process.stages.length - 1} submitting={submitting} onRetry={onRetry} uploadId={process.uploadId} />)}</ol>

    {process.overallStatus === 'READY' && <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
      <p className="font-semibold">Cost Structure siap — menunggu Finalisasi</p>
      <p className="mt-1 text-sm">Seluruh proses otomatis selesai. Periode siap untuk Finalisasi.</p>
    </div>}
    {process.overallStatus === 'FINALIZED' && <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"><p className="font-semibold">Cost Structure telah difinalisasi</p><p className="mt-1 text-sm">Hasil periode ini telah menjadi data historis resmi.</p></div>}
    {process.readyForFinalization && process.overallStatus !== 'FINALIZED' && <button type="button" disabled={submitting} onClick={onFinalize} className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 sm:w-auto">Finalisasi Cost Structure</button>}
  </section>;
}

function StageItem({ stage, last, submitting, onRetry, uploadId }: { stage: ProcessStage; last: boolean; submitting: boolean; onRetry: () => void; uploadId: number }) {
  const blocked = stage.status === 'BLOCKED';
  const error = blocked ? friendlyStageError(stage) : null;
  const action = blockedActionLabel(stage);
  return <li className="relative flex min-w-0 gap-3 pb-5 last:pb-0">
    {!last && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-border" />}
    <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${stage.status === 'COMPLETED' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : blocked ? 'border-red-300 bg-red-50 text-red-700' : 'bg-background text-muted-foreground'}`}>
      {stage.status === 'COMPLETED' ? <Check className="h-4 w-4" /> : stage.status === 'RUNNING' ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : blocked ? <CircleAlert className="h-4 w-4" /> : stage.status === 'NOT_APPLICABLE' ? <Minus className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
    </span>
    <div className="min-w-0 flex-1 pt-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h3 className={`break-words text-sm font-semibold ${stage.status === 'NOT_APPLICABLE' ? 'text-muted-foreground' : ''}`}>{stage.title}</h3><span className="text-xs text-muted-foreground">{stageStatusLabel(stage.status)}</span></div>
      {!blocked && stage.message && <p className="mt-1 break-words text-sm text-muted-foreground">{stage.message}</p>}
      {blocked && error && <div className="mt-2 max-w-full rounded-lg border border-red-200 bg-red-50 p-3 text-red-950"><p className="font-semibold">{error.title}</p><p className="mt-1 break-words text-sm">{error.message}</p>
        {!!stage.blockers?.length && <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">Detail blocker ({stage.blockers.length})</summary><ul className="mt-2 list-disc space-y-1 pl-5">{stage.blockers.map((item, i) => <li className="break-words" key={i}>{blockerText(item)}</li>)}</ul></details>}
        {error.technicalDetail && <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">Technical detail</summary><pre className="mt-2 max-h-40 max-w-full overflow-auto whitespace-pre-wrap break-all rounded bg-black/5 p-2 text-xs">{error.technicalDetail}</pre></details>}
        {action === 'Perbaiki mapping' ? <Link href={`/cost-structure/upload/${uploadId}#mapping-detail`} className="mt-3 inline-flex rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white">{action}</Link> : <button type="button" disabled={submitting} onClick={onRetry} className="mt-3 inline-flex items-center gap-2 rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"><RotateCcw className="h-4 w-4" />{submitting ? 'Mencoba kembali…' : action}</button>}
      </div>}
    </div>
  </li>;
}
