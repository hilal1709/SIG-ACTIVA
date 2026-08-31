'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CalculationButton({ periodId, rerun }: { periodId: number; rerun: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  async function calculate() {
    setBusy(true); setError('');
    const response = await fetch(`/api/cost-structure/periods/${periodId}/calculate`, { method: 'POST' });
    const payload = await response.json();
    if (!response.ok) setError(payload.error ?? 'Calculation gagal.'); else router.refresh();
    setBusy(false);
  }
  const [summary, ...technicalLines] = error.split('\n');
  return <div className="max-w-full"><button type="button" disabled={busy} onClick={calculate} className="min-h-11 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Menghitung…' : rerun ? 'Rerun' : 'Run Calculation'}</button>{error && <div role="alert" className="mt-2 max-w-full rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"><p className="font-semibold">Calculation blocked</p><p className="mt-1 break-words">{summary}</p>{technicalLines.length > 0 && <details className="mt-2"><summary className="cursor-pointer font-medium">Technical detail</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words">{technicalLines.join('\n')}</pre></details>}</div>}</div>;
}
