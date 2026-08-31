'use client';

import { useMemo, useState } from 'react';

type PeriodOption = { id: number; companyCode: string; fiscalYear: number; fiscalPeriod: number };
type Commentary = { id: number; analysisKey: string; status: string; reason: string };
type Row = { key: string; label: string; nodeType: string; varianceAmount: string; variancePercent: string | null; materialityStatus: string; children?: Row[] };
const flatten = (rows: Row[], depth = 0): Array<Row & { depth: number }> => rows.flatMap((row) => [{ ...row, depth }, ...flatten(row.children ?? [], depth + 1)]);
const isCommentaryTarget = (row: Row) => !['COMPANY', 'ANALYSIS_BASIS'].includes(row.nodeType);

export default function FluctuationWorkflow({ periodOptions }: { periodOptions: PeriodOption[] }) {
  const [companyCode, setCompanyCode] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [comparison, setComparison] = useState('MOM');
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [data, setData] = useState<{ hierarchy?: Row[]; status?: string; comparisonLabel?: string; commentaries?: Commentary[]; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const companies = useMemo(
    () => [...new Set(periodOptions.map((period) => period.companyCode))].sort(),
    [periodOptions]
  );
  const companyPeriods = useMemo(
    () => periodOptions.filter((period) => period.companyCode === companyCode),
    [companyCode, periodOptions]
  );

  function resetAnalysis() {
    setData(null);
    setSelected('');
    setReason('');
    setNote('');
  }

  function changeCompany(nextCompany: string) {
    setCompanyCode(nextCompany);
    const latestPeriod = periodOptions.find((period) => period.companyCode === nextCompany);
    setPeriodId(latestPeriod ? String(latestPeriod.id) : '');
    resetAnalysis();
  }

  async function load() {
    setLoading(true);
    const response = await fetch(`/api/cost-fluctuation/commentary?periodId=${periodId}&comparison=${comparison}`);
    setData(await response.json());
    setLoading(false);
  }

  async function mutate(path: string, body: object = {}) {
    setLoading(true);
    const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) {
      const result = await response.json();
      setData((old) => ({ ...old, error: result.error }));
    } else await load();
    setLoading(false);
  }

  const statuses = new Map(data?.commentaries?.map((item) => [item.analysisKey, item.status]));
  const current = data?.commentaries?.find((item) => item.analysisKey === selected);

  return <section className="space-y-4 rounded-xl border bg-white p-5">
    <div className="flex flex-wrap gap-3">
      <select className="min-w-48 rounded border px-3 py-2" value={companyCode} onChange={(event) => changeCompany(event.target.value)}>
        <option value="">Pilih Company Code</option>
        {companies.map((code) => <option key={code} value={code}>{code}</option>)}
      </select>
      <select className="min-w-52 rounded border px-3 py-2" value={periodId} disabled={!companyCode} onChange={(event) => { setPeriodId(event.target.value); resetAnalysis(); }}>
        <option value="">Pilih Periode</option>
        {companyPeriods.map((period) => <option key={period.id} value={period.id}>{period.fiscalYear}/{String(period.fiscalPeriod).padStart(2, '0')}</option>)}
      </select>
      <select className="rounded border px-3 py-2" value={comparison} onChange={(event) => { setComparison(event.target.value); resetAnalysis(); }}><option>MOM</option><option>YOY</option><option>YTD</option></select>
      <button className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50" onClick={load} disabled={loading || !companyCode || !periodId}>{loading ? 'Memuat…' : 'Tampilkan analisis'}</button>
    </div>
    {periodOptions.length === 0 && <p className="text-sm text-amber-700">Belum ada periode Cost Structure berstatus FINALIZED.</p>}
    <p className="text-xs text-slate-500">Periode yang dapat dipilih hanya Cost Structure yang sudah berstatus FINALIZED.</p>
    {data?.error && <p className="text-red-700">{data.error}</p>}
    {data?.status && <p className="text-sm">{data.comparisonLabel}: <strong>{data.status}</strong></p>}
    {data?.hierarchy && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Analytical target</th><th>Variance</th><th>Variance %</th><th>Materiality</th><th>Commentary</th></tr></thead><tbody>{flatten(data.hierarchy).map((row) => {
      const selectable = isCommentaryTarget(row);
      return <tr className={`${selectable ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default bg-slate-50/50'} border-b`} key={row.key} onClick={() => { if (!selectable) return; setSelected(row.key); setReason(data.commentaries?.find((item) => item.analysisKey === row.key)?.reason ?? ''); }}>
        <td className="p-2" style={{ paddingLeft: 8 + row.depth * 18 }}>{row.label}</td><td>{row.varianceAmount}</td><td>{row.variancePercent ?? 'N/M'}</td><td>{row.materialityStatus}</td><td>{selectable ? statuses.get(row.key) ?? (row.materialityStatus === 'REQUIRES_EXPLANATION' ? 'OPEN' : '—') : '—'}</td>
      </tr>;
    })}</tbody></table></div>}
    {selected && <div className="space-y-2 rounded border p-3"><strong>{selected} — {current?.status ?? 'OPEN'}</strong><textarea className="block w-full rounded border p-2" maxLength={5000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Commentary reason"/><input className="w-full rounded border p-2" maxLength={5000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Reviewer note (required to return)"/><div className="flex flex-wrap gap-2"><button className="rounded bg-slate-700 px-3 py-2 text-white" onClick={() => mutate('/api/cost-fluctuation/commentary/draft', { periodId: Number(periodId), comparisonType: comparison, analysisKey: selected, reason })}>Save Draft</button>{current?.status === 'DRAFT' && <button className="rounded bg-blue-700 px-3 py-2 text-white" onClick={() => mutate(`/api/cost-fluctuation/commentary/${current.id}/submit`)}>Submit</button>}{current?.status === 'SUBMITTED' && <><button className="rounded bg-amber-700 px-3 py-2 text-white" onClick={() => mutate(`/api/cost-fluctuation/commentary/${current.id}/return`, { reviewerNote: note })}>Return</button><button className="rounded bg-green-700 px-3 py-2 text-white" onClick={() => mutate(`/api/cost-fluctuation/commentary/${current.id}/review`, { reviewerNote: note })}>Review</button></>}</div></div>}
    <button className="rounded border px-3 py-2 disabled:opacity-50" disabled={loading || !periodId} onClick={() => mutate('/api/cost-fluctuation/review/complete', { periodId: Number(periodId), note })}>Complete period review</button>
    <p className="text-xs text-slate-500">Nilai analitis bersifat read-only; Analysis Basis hanya konteks sumber dan bukan target commentary/materiality.</p>
  </section>;
}
