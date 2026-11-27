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
  return <div><button type="button" disabled={busy} onClick={calculate} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Menghitung…' : rerun ? 'Rerun' : 'Run Calculation'}</button>{error && <p className="mt-2 text-xs text-red-600">{error}</p>}</div>;
}

