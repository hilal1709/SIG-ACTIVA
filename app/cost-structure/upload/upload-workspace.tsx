'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Loader2, UploadCloud } from 'lucide-react';
import Sidebar from '@/app/components/Sidebar';
import Header from '@/app/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';

type Company = { companyCode: string; name: string };
type History = { id: number; companyCode: string; fiscalYear: number; fiscalPeriod: number; version: number; originalFileName: string; fileSizeBytes: string; status: string; uploadedAt: string };
type Result = { id: number; version: number; status: string; hash: string; rowCount: number; issueCount: number; sources: { code: string; sheetName: string; rowCount: number }[]; issues: { message: string; severity: string }[] };
const steps = ['Metadata', 'Upload File', 'Verify File', 'Detect Sources', 'Normalize Data', 'Validation Result'];

export default function UploadWorkspace({ companies }: { companies: Company[] }) {
  const now = new Date();
  const [mobile, setMobile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<History[]>([]);

  const refresh = () => fetch('/api/cost-structure/uploads?limit=10')
    .then((response) => response.ok ? response.json() : null)
    .then((data) => data && setHistory(data.uploads));

  useEffect(() => { void refresh(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setResult(null);
    const data = new FormData(event.currentTarget);
    const file = data.get('workbook') as File;
    if (!file || !file.name) { setError('Pilih source workbook.'); return; }
    if (!/\.(xlsx|xlsm)$/i.test(file.name) || file.size > 50 * 1024 * 1024) {
      setError('Workbook harus .xlsx/.xlsm dan maksimum 50 MB.');
      return;
    }

    setBusy(true);
    setStep(1);
    try {
      const init = await fetch('/api/cost-structure/uploads/init', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          companyCode: data.get('companyCode'),
          fiscalYear: Number(data.get('fiscalYear')),
          fiscalPeriod: Number(data.get('fiscalPeriod')),
          uploadNote: data.get('uploadNote'),
          fileName: file.name,
          fileSize: file.size,
        }),
      });
      const info = await init.json();
      if (!init.ok) throw new Error(info.error);

      setStep(2);
      const storageForm = new FormData();
      storageForm.append('cacheControl', '3600');
      storageForm.append('', file);
      const uploaded = await fetch(info.signedUrl, {
        method: 'PUT',
        headers: { 'x-upsert': 'false' },
        body: storageForm,
      });
      if (!uploaded.ok) throw new Error('Upload ke penyimpanan privat gagal.');

      setStep(3);
      const complete = await fetch('/api/cost-structure/uploads/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ uploadContext: info.uploadContext }),
      });
      setStep(5);
      const done = await complete.json();
      if (!complete.ok) throw new Error(done.error);
      setResult(done.upload);
      setStep(6);
      void refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload gagal.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex min-h-screen bg-background">
    <aside className="fixed inset-y-0 left-0 z-40 hidden lg:block"><Sidebar /></aside>
    {mobile && <>
      <button className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobile(false)} />
      <aside className="fixed inset-y-0 left-0 z-50"><Sidebar isOpen onClose={() => setMobile(false)} /></aside>
    </>}
    <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
      <Header title="Upload & Proses" subtitle="Cost Structure & Fluktuasi Biaya" onMenuClick={() => setMobile(true)} />
      <main className="flex-1 p-4 sm:p-6 lg:p-8"><div className="mx-auto max-w-6xl space-y-6">
        <div><h1 className="text-3xl font-bold">Upload & Proses</h1><p className="mt-1 text-muted-foreground">Unggah workbook sumber bulanan ke penyimpanan privat dan validasi struktur datanya.</p></div>
        <Card><CardHeader><CardTitle>Input Data</CardTitle></CardHeader><CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <Field label="Company"><select name="companyCode" required className="input" defaultValue=""><option value="" disabled>Pilih company</option>{companies.map((company) => <option key={company.companyCode} value={company.companyCode}>{company.companyCode} — {company.name}</option>)}</select></Field>
            <Field label="Fiscal Year"><input className="input" name="fiscalYear" type="number" required min={now.getFullYear() - 5} max={now.getFullYear() + 2} defaultValue={now.getFullYear()} /></Field>
            <Field label="Fiscal Period"><select className="input" name="fiscalPeriod" required defaultValue={now.getMonth() + 1}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{String(index + 1).padStart(2, '0')}</option>)}</select></Field>
            <Field label="Upload Note (opsional)"><input className="input" name="uploadNote" maxLength={1000} placeholder="Catatan sumber atau koreksi" /></Field>
            <div className="md:col-span-2"><Field label="Source Workbook (.xlsx / .xlsm, maks. 50 MB)"><input className="block w-full rounded-md border p-2 text-sm" name="workbook" type="file" accept=".xlsx,.xlsm" required /></Field></div>
            {error && <p className="md:col-span-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            <button disabled={busy} className="inline-flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}{busy ? 'Memproses…' : 'Upload & Validasi'}</button>
          </form>
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Progress</CardTitle></CardHeader><CardContent><div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{steps.map((label, index) => <div key={label} className={`rounded-lg border p-3 text-sm ${step >= index + 1 ? 'border-primary bg-primary/5' : 'text-muted-foreground'}`}><span className="mb-1 block text-xs">{index + 1}</span>{step > index + 1 ? <CheckCircle2 className="mb-1 h-4 w-4 text-primary" /> : null}{label}</div>)}</div></CardContent></Card>
        {result && <Card><CardHeader><CardTitle>Latest Upload Result</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-3 sm:grid-cols-4"><Metric label="Status" value={result.status} /><Metric label="Version" value={`v${result.version}`} /><Metric label="SHA-256" value={`${result.hash.slice(0, 12)}…`} /><Metric label="Rows / Issues" value={`${result.rowCount} / ${result.issueCount}`} /></div><div className="flex flex-wrap gap-2">{result.sources.map((source) => <span className="rounded-full bg-muted px-3 py-1 text-xs" key={source.code}>{source.code}: {source.rowCount}</span>)}</div>{result.issues.length > 0 && <ul className="list-disc pl-5 text-sm text-destructive">{result.issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul>}</CardContent></Card>}
        <Card><CardHeader><CardTitle>Recent Uploads</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-muted-foreground"><tr><th className="p-2">Period</th><th>File</th><th>Version</th><th>Status</th><th>Size</th><th>Uploaded</th></tr></thead><tbody>{history.map((item) => <tr key={item.id} className="border-b"><td className="p-2">{item.companyCode} · {item.fiscalYear}/{String(item.fiscalPeriod).padStart(2, '0')}</td><td><span className="inline-flex items-center gap-1"><FileSpreadsheet className="h-4 w-4" />{item.originalFileName}</span></td><td>v{item.version}</td><td>{item.status}</td><td>{(Number(item.fileSizeBytes) / 1024 / 1024).toFixed(2)} MB</td><td>{new Date(item.uploadedAt).toLocaleString('id-ID')}</td></tr>)}</tbody></table>{history.length === 0 && <p className="py-8 text-center text-muted-foreground">Belum ada riwayat upload.</p>}</div></CardContent></Card>
      </div></main>
    </div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1.5 text-sm font-medium"><span>{label}</span>{children}</label>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-muted/50 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-semibold">{value}</div></div>; }
