'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileCheck2, Loader2, LockKeyhole, RefreshCw, RotateCcw } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';

type PeriodOption = { id: number; fiscalYear: number; fiscalPeriod: number; status: string; company: { companyCode: string; companyName: string } };
type Dashboard = {
  period: { id: number; companyCode: string; companyName: string; fiscalYear: number; fiscalPeriod: number; status: string; finalizedAt: string | null };
  run: { id: number; runNumber: number; status: string; isActive: boolean; ruleSetVersion: string; calculatedAt: string | null };
  upload: { id: number; version: number; fileName: string };
  auditSnapshot: { ready: boolean; required: string[]; present: string[]; missing: string[] };
  totals: Record<string, string>;
  controls: Array<{ code: string; status: string | null; difference: string | null }>;
  natures: Array<{ groupCode: string; groupName: string; natureCode: string; natureName: string; calculationType: string; ruleCode: string | null; amount: string; calculationDetail: unknown; lines: Array<{ id: number; coa: string | null; coaDescription: string | null; sourceAmount: string | null; adjustmentAmount: string; finalAmount: string; lineType: string; ruleCode: string | null; sourceLogicalCode: string | null; sourceSheet: string | null; sourceRow: number | null; sourceReference: unknown }> }>;
};
const rupiah = (value?: string) => value == null ? '—' : new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));

export default function CostStructureDashboard({ periods }: { periods: PeriodOption[] }) {
  const router = useRouter();
  const companies = useMemo(() => [...new Set(periods.map((period) => period.company.companyCode))], [periods]);
  const [company, setCompany] = useState(companies[0] ?? '');
  const companyPeriods = periods.filter((period) => period.company.companyCode === company);
  const [periodId, setPeriodId] = useState(companyPeriods[0]?.id ?? periods[0]?.id ?? 0);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (companyPeriods.length && !companyPeriods.some((period) => period.id === periodId)) setPeriodId(companyPeriods[0].id);
  }, [company, companyPeriods, periodId]);

  useEffect(() => {
    if (!periodId) return;
    let active = true;
    setLoading(true); setError('');
    fetch(`/api/cost-structure/periods/${periodId}/dashboard`, { cache: 'no-store' })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); if (active) setData(body); })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : 'Data tidak tersedia.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [periodId, refreshKey]);

  const refresh = () => { setRefreshKey((value) => value + 1); router.refresh(); };
  const post = async (path: string, body?: BodyInit) => {
    setActionLoading(true); setError('');
    try {
      const response = await fetch(path, { method: 'POST', headers: body ? { 'content-type': 'application/json' } : undefined, body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Proses gagal.');
      refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Proses gagal.'); }
    finally { setActionLoading(false); }
  };
  const runAction = async (action: 'reconcile' | 'finalize' | 'reopen') => {
    if (!data) return;
    let body: BodyInit | undefined;
    if (action === 'reopen') {
      const reason = window.prompt('Alasan reopen periode wajib diisi:')?.trim();
      if (!reason) return;
      body = JSON.stringify({ reason });
    }
    await post(`/api/cost-structure/periods/${data.period.id}/${action}`, body);
  };
  const hydrateAudit = async () => {
    if (!data || data.auditSnapshot.ready) return;
    if (!window.confirm(`Persist audit snapshot dari workbook authoritative?\n\nMissing: ${data.auditSnapshot.missing.join(', ')}\n\nAksi ini tidak mengubah angka Cost Structure atau active calculation run.`)) return;
    await post(`/api/cost-structure/periods/${data.period.id}/hydrate-audit`);
  };

  const totalCards = data ? (data.period.companyCode === '7000' ? [['HPP', 'TOTAL_HPP'], ['ADUM', 'TOTAL_ADUM'], ['PASAR', 'TOTAL_PASAR'], ['TOTAL', 'TOTAL_COMPANY']] : [['ADUM', 'TOTAL_ADUM'], ['PASAR', 'TOTAL_PASAR'], ['TOTAL', 'TOTAL_COMPANY']]) : [];
  return <div className="mx-auto max-w-7xl space-y-6">
    <div data-cost-motion className="space-y-2"><Badge variant="secondary">Authoritative Engine 1</Badge><h1 className="text-2xl font-bold sm:text-3xl">Dashboard Cost Structure</h1><p className="text-sm text-muted-foreground">Membaca active persisted calculation run — tanpa menjalankan kalkulasi ulang saat halaman dibuka.</p></div>
    <Card data-cost-motion data-cost-hover><CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
      <label className="text-sm font-medium">Company<select className="mt-2 w-full rounded-md border bg-background p-2" value={company} onChange={(event) => setCompany(event.target.value)}>{companies.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="text-sm font-medium sm:col-span-2">Fiscal Year / Period<select className="mt-2 w-full rounded-md border bg-background p-2" value={periodId} onChange={(event) => setPeriodId(Number(event.target.value))}>{companyPeriods.map((period) => <option key={period.id} value={period.id}>{period.fiscalYear}-{String(period.fiscalPeriod).padStart(2, '0')} · {period.status}</option>)}</select></label>
    </CardContent></Card>
    {loading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Memuat persisted run…</div>}{error && <Card className="border-destructive"><CardContent className="pt-6 text-destructive">{error}</CardContent></Card>}
    {data && !loading && <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{totalCards.map(([label, code]) => <Card key={code} data-cost-motion data-cost-hover className="transition-shadow hover:shadow-md"><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><div className="text-xl font-bold tabular-nums">Rp {rupiah(data.totals[code])}</div></CardContent></Card>)}</div>
      <Card data-cost-motion><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Status & lineage</CardTitle><div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={refresh} disabled={actionLoading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
        {!data.auditSnapshot.ready && <Button variant="outline" size="sm" onClick={hydrateAudit} disabled={actionLoading}><RefreshCw className="mr-2 h-4 w-4" />Hydrate Audit Snapshot</Button>}
        {data.period.status === 'CALCULATED' && <Button size="sm" onClick={() => runAction('reconcile')} disabled={actionLoading}><FileCheck2 className="mr-2 h-4 w-4" />Reconcile Cost Structure</Button>}
        {data.period.status === 'COST_STRUCTURE_RECONCILED' && <Button size="sm" onClick={() => runAction('finalize')} disabled={actionLoading}><LockKeyhole className="mr-2 h-4 w-4" />Finalize</Button>}
        {data.period.status === 'FINALIZED' && <Button variant="outline" size="sm" onClick={() => runAction('reopen')} disabled={actionLoading}><RotateCcw className="mr-2 h-4 w-4" />Reopen</Button>}
        <Button asChild variant="outline" size="sm"><a href={`/api/cost-structure/periods/${data.period.id}/export`}><Download className="mr-2 h-4 w-4" />Export Excel</a></Button>
      </div></div></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><span className="text-muted-foreground">Period status</span><p className="font-semibold">{data.period.status}</p></div><div><span className="text-muted-foreground">Upload / run</span><p>v{data.upload.version} · Run #{data.run.runNumber}</p></div><div><span className="text-muted-foreground">Audit snapshot</span><p className="font-medium">{data.auditSnapshot.ready ? 'READY' : `MISSING ${data.auditSnapshot.missing.length}`}</p></div><div><span className="text-muted-foreground">Rule set</span><p>{data.run.ruleSetVersion}</p></div><div><span className="text-muted-foreground">Calculated</span><p>{data.run.calculatedAt ? new Date(data.run.calculatedAt).toLocaleString('id-ID') : '—'}</p></div>{data.controls.map((control) => <div key={control.code}><span className="text-muted-foreground">{control.code}</span><p className="flex items-center gap-1 font-medium"><FileCheck2 className="h-4 w-4" />{control.status} · {control.difference ?? '—'}</p></div>)}</CardContent></Card>
      <Card data-cost-motion><CardHeader><CardTitle>Cost Group → Nature → COA / calculation lines</CardTitle></CardHeader><CardContent className="space-y-2">{data.natures.map((nature) => { const key = `${nature.groupCode}:${nature.natureCode}`; return <div key={key} className="rounded-lg border"><button className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-muted/50" onClick={() => setExpanded(expanded === key ? null : key)}><span><strong>{nature.groupCode}</strong> · {nature.natureCode} — {nature.natureName}<span className="ml-2 text-xs text-muted-foreground">{nature.calculationType}{nature.ruleCode ? ` · ${nature.ruleCode}` : ''}</span></span><span className="font-semibold tabular-nums">{rupiah(nature.amount)}</span></button>{expanded === key && <div className="border-t p-4"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">COA / Rule</th><th className="p-2">Type</th><th className="p-2">Source</th><th className="p-2 text-right">Source</th><th className="p-2 text-right">Adjustment</th><th className="p-2 text-right">Final</th></tr></thead><tbody>{nature.lines.map((line) => <tr key={line.id} className="border-b"><td className="p-2"><div className="font-medium">{line.coa ?? line.ruleCode ?? 'Formula/Residual'}</div><div className="text-xs text-muted-foreground">{line.coaDescription ?? ''}</div></td><td className="p-2">{line.lineType}</td><td className="p-2">{line.sourceLogicalCode ?? line.sourceSheet ?? 'Persisted lineage'}{line.sourceRow ? ` · row ${line.sourceRow}` : ''}</td><td className="p-2 text-right tabular-nums">{rupiah(line.sourceAmount ?? undefined)}</td><td className="p-2 text-right tabular-nums">{rupiah(line.adjustmentAmount)}</td><td className="p-2 text-right font-medium tabular-nums">{rupiah(line.finalAmount)}</td></tr>)}</tbody></table></div>{(nature.ruleCode || nature.calculationType !== 'MAPPED') && <details className="mt-4 rounded-md bg-muted/40 p-3"><summary className="cursor-pointer font-medium">Persisted formula / residual lineage</summary><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify({ calculationDetail: nature.calculationDetail, lines: nature.lines.map((line) => ({ ruleCode: line.ruleCode, sourceReference: line.sourceReference })) }, null, 2)}</pre></details>}</div>}</div>; })}</CardContent></Card>
    </>}
  </div>;
}
