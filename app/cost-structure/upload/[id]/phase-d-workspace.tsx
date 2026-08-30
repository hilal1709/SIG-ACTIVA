'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import CostModuleFrame from '@/app/components/CostModuleFrame';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';

type Item = {
  logicalSourceCode: string;
  coaCodeRaw: string;
  description: string | null;
  rowCount: number;
  totalAmount: string;
  mappingStatus: string;
};

type Group = {
  id: number;
  code: string;
  natures: { id: number; code: string; name: string }[];
};

function isZeroAmount(value: string): boolean {
  const normalized = value.trim().replace(/^[+-]/, '').replace(/[.,]/g, '');
  return normalized.length > 0 && /^0+$/.test(normalized);
}

export default function PhaseDWorkspace({ uploadId }: { uploadId: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [rec, setRec] = useState<Record<string, unknown> | null>(null);
  const [map, setMap] = useState<{ items: Item[]; groups: Group[] } | null>(null);

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      fetch(`/api/cost-structure/uploads/${uploadId}`),
      fetch(`/api/cost-structure/uploads/${uploadId}/reconciliation`),
      fetch(`/api/cost-structure/uploads/${uploadId}/mapping`),
    ]);
    if (!a.ok) throw new Error('Upload tidak ditemukan.');
    setData(await a.json());
    setRec(await b.json());
    setMap(await c.json());
  }, [uploadId]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function run() {
    setBusy(true);
    setError('');
    const response = await fetch(`/api/cost-structure/uploads/${uploadId}/reconciliation/run`, { method: 'POST' });
    const value = await response.json();
    if (!response.ok) setError(value.error);
    await load();
    setBusy(false);
  }

  async function resolve(item: Item, action: string) {
    const groupId = action === 'EXCLUDE' ? undefined : Number(prompt('Cost Group ID:'));
    const group = map?.groups.find((g) => g.id === groupId);
    const natureId = action === 'EXCLUDE'
      ? undefined
      : Number(prompt(`Nature ID (${group?.natures.map((n) => `${n.id}:${n.name}`).join(', ')}):`));
    const reason = action === 'INCLUDE'
      ? prompt('Catatan (opsional):') || ''
      : prompt(`Alasan ${action} (wajib):`) || '';
    if (action !== 'INCLUDE' && !reason) return;

    setBusy(true);
    const response = await fetch(`/api/cost-structure/uploads/${uploadId}/mapping/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        logicalSourceCode: item.logicalSourceCode,
        coaCodeRaw: item.coaCodeRaw,
        mappingAction: action,
        costGroupId: groupId,
        natureId,
        reason,
        note: reason,
      }),
    });
    const value = await response.json();
    if (!response.ok) setError(value.error);
    await load();
    setBusy(false);
  }

  const upload = (data?.upload ?? {}) as Record<string, unknown>;
  const period = (upload.period ?? {}) as Record<string, unknown>;
  const company = (period.company ?? {}) as Record<string, unknown>;
  const sources = (rec?.sources ?? []) as Record<string, unknown>[];
  const completeness = (rec?.completeness ?? {}) as Record<string, unknown>;
  const issues = (upload.validationIssues ?? []) as Record<string, unknown>[];

  const unmappedItems = useMemo(
    () => (map?.items ?? []).filter((item) => item.mappingStatus === 'UNMAPPED'),
    [map]
  );
  const blockingUnmapped = useMemo(
    () => unmappedItems.filter((item) => !isZeroAmount(item.totalAmount)),
    [unmappedItems]
  );
  const zeroUnmapped = useMemo(
    () => unmappedItems.filter((item) => isZeroAmount(item.totalAmount)),
    [unmappedItems]
  );

  return (
    <CostModuleFrame title="Source Reconciliation & Mapping" subtitle="Cost Structure Phase D" contentClassName="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div data-cost-motion className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Upload #{uploadId}</h1>
            <p className="text-muted-foreground">{String(company.companyCode ?? '')} · {String(period.fiscalYear ?? '')}/{String(period.fiscalPeriod ?? '')} · v{String(upload.version ?? '')} · {String(upload.originalFileName ?? '')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{upload.isActiveVersion ? 'Active' : 'Superseded'} · {String(upload.status ?? '')} · Period {String(rec?.periodStatus ?? '')}</p>
          </div>
          <button disabled={busy || !upload.isActiveVersion} onClick={run} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0">{busy ? 'Running…' : 'Run reconciliation'}</button>
        </div>

        {error && <p data-cost-motion className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

        <Card data-cost-motion data-cost-hover className="transition-shadow hover:shadow-md">
          <CardHeader><CardTitle>Source reconciliation</CardTitle></CardHeader>
          <CardContent><Table headers={['Source', 'Detail Rows', 'Detail Amount', 'Reported Amount', 'Difference', 'Status']} rows={sources.map((s) => [s.logicalSourceCode, s.detailRowCount, s.detailAmount, s.reportedAmount ?? '—', s.difference ?? '—', s.status])} /></CardContent>
        </Card>

        <Card data-cost-motion data-cost-hover className="transition-shadow hover:shadow-md">
          <CardHeader><CardTitle>Mapping completeness</CardTitle></CardHeader>
          <CardContent><div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{['mappedAmount', 'excludedAmount', 'reclassifiedAmount', 'unmappedAmount', 'unmappedCoaCount', 'difference'].map((key) => <Metric key={key} label={key} value={String(completeness[key] ?? '—')} />)}</div></CardContent>
        </Card>

        <Card data-cost-motion data-cost-hover className="transition-shadow hover:shadow-md">
          <CardHeader><CardTitle>Unmapped COA work queue</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {blockingUnmapped.length === 0 && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Tidak ada COA non-zero yang membutuhkan mapping. Work queue bersih.</div>}
            {zeroUnmapped.length > 0 && <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{zeroUnmapped.length} COA masih berstatus UNMAPPED dengan amount 0. Ini non-blocking dan tidak perlu dimapping sampai memiliki nilai.</div>}
            <Table headers={['Source', 'COA', 'Description', 'Rows', 'Amount', 'Status', 'Action']} rows={blockingUnmapped.map((item) => [
              item.logicalSourceCode,
              item.coaCodeRaw,
              item.description ?? '—',
              item.rowCount,
              item.totalAmount,
              item.mappingStatus,
              <span className="flex flex-wrap gap-2" key={`${item.logicalSourceCode}:${item.coaCodeRaw}`}>
                <button onClick={() => resolve(item, 'INCLUDE')} className="font-medium text-primary hover:underline">Map</button>
                <button onClick={() => resolve(item, 'EXCLUDE')} className="font-medium text-primary hover:underline">Exclude</button>
                <button onClick={() => resolve(item, 'RECLASS')} className="font-medium text-primary hover:underline">Reclassify</button>
              </span>,
            ])} />
          </CardContent>
        </Card>

        <Card data-cost-motion data-cost-hover className="transition-shadow hover:shadow-md">
          <CardHeader><CardTitle>Validation issues</CardTitle></CardHeader>
          <CardContent><Table headers={['State', 'Severity', 'Code', 'Message']} rows={issues.map((issue) => [issue.resolved ? 'Resolved' : 'Open', issue.severity, issue.issueCode, issue.message])} /></CardContent>
        </Card>

        <Card data-cost-motion data-cost-hover className="transition-shadow hover:shadow-md">
          <CardHeader><CardTitle>Readiness</CardTitle></CardHeader>
          <CardContent><p className="font-semibold">{rec?.ready ? 'SOURCE_RECONCILED' : 'SOURCE_VALIDATION'}</p><ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">{((rec?.blockers ?? []) as string[]).map((x) => <li key={x}>{x}</li>)}</ul></CardContent>
        </Card>
      </div>
    </CostModuleFrame>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: (unknown | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/40"><tr className="border-b">{headers.map((header) => <th className="p-2 font-medium" key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr className="border-b transition-colors hover:bg-muted/30" key={i}>{row.map((value, j) => <td className="p-2" key={j}>{value as React.ReactNode}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted"><div className="text-xs text-muted-foreground">{label}</div><b className="tabular-nums">{value}</b></div>;
}
