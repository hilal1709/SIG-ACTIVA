'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Upload } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import type { ComparisonReadiness, CurrentPeriodReadiness, ReadinessMatrix, ReadinessState } from '@/lib/cost-fluctuation/readiness/types';

const month = (year: number, period: number) => `${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][period - 1]}-${String(year).slice(-2)}`;
const stateText: Record<ReadinessState, string> = { AVAILABLE: 'TERSEDIA', MISSING: 'BELUM ADA', NOT_FINALIZED: 'BELUM FINAL', INVALID_ACTIVE_RUN: 'ACTIVE RUN BERMASALAH' };
const stateClass: Record<ReadinessState, string> = { AVAILABLE: 'bg-emerald-100 text-emerald-800', MISSING: 'bg-amber-100 text-amber-900', NOT_FINALIZED: 'bg-blue-100 text-blue-900', INVALID_ACTIVE_RUN: 'bg-red-100 text-red-800' };

function StateBadge({ state }: { state: ReadinessState }) {
  return <Badge className={stateClass[state]}>{stateText[state]}</Badge>;
}

function ReadinessCard({ title, current, value }: { title: string; current: CurrentPeriodReadiness; value: ComparisonReadiness }) {
  const unavailable = value.required.filter((item) => item.readiness !== 'AVAILABLE');
  return <Card className="h-full">
    <CardHeader className="pb-3"><div className="flex items-center justify-between gap-2"><CardTitle className="text-base">{title}</CardTitle><StateBadge state={value.readiness} /></div></CardHeader>
    <CardContent className="space-y-3 text-sm">
      <p><span className="text-muted-foreground">Current:</span> <strong>{month(current.fiscalYear, current.fiscalPeriod)}</strong></p>
      <div><p className="text-muted-foreground">Required:</p><div className="mt-1 flex flex-wrap gap-1">{value.required.map((item) => <span key={`${item.fiscalYear}-${item.fiscalPeriod}`} className={`rounded px-2 py-1 text-xs ${item.readiness === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{month(item.fiscalYear, item.fiscalPeriod)}</span>)}</div></div>
      {unavailable.length > 0 && <div className="space-y-1 border-t pt-3">{unavailable.map((item) => <p key={`${item.fiscalYear}-${item.fiscalPeriod}`}><strong>{month(item.fiscalYear, item.fiscalPeriod)}</strong>: {item.reason}</p>)}</div>}
    </CardContent>
  </Card>;
}

export default function ReadinessWorkspace({ data }: { data: ReadinessMatrix }) {
  const [company, setCompany] = useState('ALL');
  const periodKeys = useMemo(() => [...new Set(data.periods.map((item) => `${item.fiscalYear}-${item.fiscalPeriod}`))], [data.periods]);
  const [periodKey, setPeriodKey] = useState(periodKeys[0] ?? '');
  const filtered = data.periods.filter((item) => company === 'ALL' || item.companyCode === company);
  const selected = filtered.filter((item) => `${item.fiscalYear}-${item.fiscalPeriod}` === periodKey);

  return <div className="space-y-6">
    <Card><CardContent className="flex flex-wrap gap-3 pt-6">
      <label className="grid gap-1 text-sm"><span className="font-medium">Company</span><select className="min-w-40 rounded-md border bg-background px-3 py-2" value={company} onChange={(event) => setCompany(event.target.value)}><option value="ALL">All</option>{data.companies.map((code) => <option key={code}>{code}</option>)}</select></label>
      <label className="grid gap-1 text-sm"><span className="font-medium">Current period</span><select className="min-w-48 rounded-md border bg-background px-3 py-2" value={periodKey} onChange={(event) => setPeriodKey(event.target.value)}>{periodKeys.map((key) => { const [year, period] = key.split('-').map(Number); return <option key={key} value={key}>{month(year, period)}</option>; })}</select></label>
    </CardContent></Card>

    {selected.length === 0 ? <Card><CardContent className="flex items-center gap-3 py-8 text-muted-foreground"><Clock3 className="h-5 w-5" />Tidak ada Cost Structure untuk company dan periode yang dipilih.</CardContent></Card> : selected.map((current) => <section key={current.periodId} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Company {current.companyCode} · {month(current.fiscalYear, current.fiscalPeriod)}</h2><p className="text-sm text-muted-foreground">Period ID {current.periodId} · {current.activeRun ? `Run ${current.activeRun.id} · ${current.activeRun.ruleSetVersion}` : 'Tidak ada active run'}</p></div><div className="flex gap-2"><Badge variant="outline">{current.status.replaceAll('_', ' ')}</Badge><StateBadge state={current.currentReadiness} /></div></div>
      <div className="grid gap-4 lg:grid-cols-3"><ReadinessCard title="MoM" current={current} value={current.mom} /><ReadinessCard title="YoY" current={current} value={current.yoy} /><ReadinessCard title="YTD" current={current} value={current.ytd} /></div>
    </section>)}

    <Card className="border-amber-200 bg-amber-50/50"><CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><p className="font-medium">Lengkapi histori tanpa membuat data semu</p><p className="text-sm text-muted-foreground">Upload and finalize the missing Cost Structure period before comparison can be analyzed.</p></div></div><Link href="/cost-structure/upload" className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm font-medium"><Upload className="h-4 w-4" />Buka Upload Data</Link></CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base">Matriks periode Cost Structure</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Period</th><th>Company</th><th>Lifecycle</th><th>Authoritative run</th><th>MoM</th><th>YoY</th><th>YTD</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.periodId} className="border-b"><td className="p-2 font-medium">{month(item.fiscalYear, item.fiscalPeriod)}</td><td>{item.companyCode}</td><td><Badge variant="outline">{item.status.replaceAll('_', ' ')}</Badge></td><td>{item.currentReadiness === 'AVAILABLE' ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" />Valid</span> : <StateBadge state={item.currentReadiness} />}</td><td><StateBadge state={item.mom.readiness} /></td><td><StateBadge state={item.yoy.readiness} /></td><td><StateBadge state={item.ytd.readiness} /></td></tr>)}</tbody></table></CardContent></Card>
  </div>;
}
