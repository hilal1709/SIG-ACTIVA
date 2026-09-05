'use client';

import { useState, type FormEvent } from 'react';
import { FileUp } from 'lucide-react';

type SourceResult = {
  logicalSourceCode: string;
  originalSheetName?: string;
  presenceStatus: string;
  fiscalYear?: number;
  fiscalPeriod?: number;
  costCenterGroup?: string;
  detailRowCount: number;
  nonZeroDetailRowCount: number;
  detailTotal?: string;
  debitControl?: string;
  reconciliationDifference?: string;
};

type Result = {
  upload: {
    id: number;
    version: number;
    status: string;
    isActiveVersion: boolean;
    rowCount: number;
    sources: SourceResult[];
    issues: Array<{ severity: string; issueCode: string; message: string }>;
  };
};

export default function RawV2UploadWorkspace() {
  const [year, setYear] = useState(new Date().getUTCFullYear());
  const [period, setPeriod] = useState(new Date().getUTCMonth() + 1);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const init = await fetch('/api/cost-structure/raw-v2/uploads/init', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          companyCode: '2000',
          fiscalYear: year,
          fiscalPeriod: period,
          fileName: file.name,
          fileSize: file.size,
        }),
      });
      const initData = await init.json();
      if (!init.ok) throw new Error(initData.error);

      const upload = await fetch(initData.signedUrl, {
        method: 'PUT',
        headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        body: file,
      });
      if (!upload.ok) throw new Error('Workbook gagal dikirim ke storage.');

      const complete = await fetch('/api/cost-structure/raw-v2/uploads/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uploadContext: initData.uploadContext }),
      });
      const data = await complete.json();
      if (!complete.ok) throw new Error(data.error);
      setResult(data);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Upload gagal.');
    } finally {
      setBusy(false);
    }
  }

  const tbSource = result?.upload.sources.find((source) => source.logicalSourceCode === 'TB');

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
        <h1 className="text-xl font-bold text-slate-900">Stage C — validated raw ingestion</h1>
        <p className="mt-2 text-sm text-slate-700">
          Company 2000 only. This validates TB and authoritative CC columns B:K; it does not calculate or export Cost Structure.
        </p>
      </section>

      <form onSubmit={submit} className="grid gap-4 rounded-2xl border bg-white p-6 shadow-sm sm:grid-cols-2">
        <label className="text-sm font-medium">
          Company Code
          <input value="2000" disabled className="mt-1 w-full rounded-lg border bg-slate-100 p-2" />
        </label>
        <label className="text-sm font-medium">
          Fiscal Year
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border p-2"
            required
          />
        </label>
        <label className="text-sm font-medium">
          Fiscal Period
          <select
            value={period}
            onChange={(e) => setPeriod(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border p-2"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1}>{i + 1}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Raw workbook
          <input
            type="file"
            accept=".xlsx,.xlsm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm"
            required
          />
        </label>
        <button
          disabled={busy || !file}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:bg-slate-300 sm:col-span-2"
        >
          <FileUp className="h-4 w-4" />
          {busy ? 'Validating…' : 'Upload & Validate Raw SAP'}
        </button>
        {error && <p className="text-sm text-red-700 sm:col-span-2">{error}</p>}
      </form>

      {result && (
        <section className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold">
              Upload v{result.upload.version}: {result.upload.status}
            </h2>
            <p className="text-sm">
              {result.upload.isActiveVersion ? 'Active valid version' : 'Inactive diagnostic version'} · {result.upload.rowCount} lineage rows
            </p>
          </div>

          {tbSource && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-emerald-950">TB terbaca</p>
                  <p className="text-xs text-emerald-800">Net TB dapat bernilai 0 karena seluruh akun saling menutup; coverage dilihat dari jumlah COA.</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                  {tbSource.presenceStatus}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-slate-500">COA parsed</p>
                  <p className="text-lg font-bold text-slate-900">{tbSource.detailRowCount}</p>
                </div>
                <div>
                  <p className="text-slate-500">Non-zero COA</p>
                  <p className="text-lg font-bold text-slate-900">{tbSource.nonZeroDetailRowCount}</p>
                </div>
                <div>
                  <p className="text-slate-500">Period</p>
                  <p className="text-lg font-bold text-slate-900">
                    {tbSource.fiscalYear ? `${tbSource.fiscalYear}/${tbSource.fiscalPeriod}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Net monthly variance</p>
                  <p className="text-lg font-bold text-slate-900">{tbSource.detailTotal ?? '—'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th>Source</th>
                  <th>Presence / Period</th>
                  <th>Group</th>
                  <th>Rows (non-zero)</th>
                  <th>Total / Net</th>
                  <th>Debit</th>
                  <th>Difference</th>
                </tr>
              </thead>
              <tbody>
                {result.upload.sources.map((source, index) => {
                  const isTb = source.logicalSourceCode === 'TB';
                  return (
                    <tr key={`${source.logicalSourceCode}-${index}`} className="border-b align-top">
                      <td className="py-2 font-semibold">
                        {source.logicalSourceCode}
                        <br />
                        <span className="font-normal text-slate-500">{source.originalSheetName || 'No sheet'}</span>
                      </td>
                      <td>
                        {source.presenceStatus}
                        <br />
                        {source.fiscalYear ? `${source.fiscalYear}/${source.fiscalPeriod}` : '—'}
                      </td>
                      <td>{source.costCenterGroup || '—'}</td>
                      <td>
                        {source.detailRowCount} {isTb ? 'COA' : 'rows'} ({source.nonZeroDetailRowCount} non-zero)
                      </td>
                      <td>
                        {source.detailTotal || '—'}
                        {isTb && <div className="text-xs text-slate-500">Net full TB, not coverage</div>}
                      </td>
                      <td>{source.debitControl || '—'}</td>
                      <td>{source.reconciliationDifference || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="font-semibold">Validation issues</h3>
            {['ERROR', 'WARNING', 'INFO'].map((severity) => (
              <div key={severity} className="mt-2">
                <p className="text-xs font-bold">
                  {severity} ({result.upload.issues.filter((issue) => issue.severity === severity).length})
                </p>
                <ul className="list-disc pl-5 text-sm">
                  {result.upload.issues
                    .filter((issue) => issue.severity === severity)
                    .map((issue, index) => (
                      <li key={`${issue.issueCode}-${index}`}>
                        <code>{issue.issueCode}</code> — {issue.message}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
