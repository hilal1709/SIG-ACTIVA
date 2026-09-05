'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Archive, CheckCircle2, FileSpreadsheet, Loader2, Trash2, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import CostModuleFrame from '@/app/components/CostModuleFrame';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { getCurrentUserRole, isAdmin } from '@/app/utils/rolePermissions';

type Company = { companyCode: string; name: string };
type Lifecycle = { canDelete: boolean; deleteReason: string | null; canArchive: boolean; archiveReason: string | null };
type History = {
  id: number;
  companyCode: string;
  fiscalYear: number;
  fiscalPeriod: number;
  version: number;
  originalFileName: string;
  fileSizeBytes: string;
  status: string;
  isActiveVersion: boolean;
  uploadedAt: string;
  lifecycle: Lifecycle;
};
type Result = { id: number; version: number; status: string; hash: string; rowCount: number; issueCount: number; sources: { code: string; sheetName: string; rowCount: number }[]; issues: { message: string; severity: string }[] };
type LifecycleAction = { mode: 'DELETE' | 'ARCHIVE'; item: History };
const steps = ['Metadata', 'Upload File', 'Verify File', 'Detect Sources', 'Normalize Data', 'Validation Result'];

export default function UploadWorkspace({ companies }: { companies: Company[] }) {
  const router = useRouter();
  const now = new Date();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [admin, setAdmin] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<LifecycleAction | null>(null);

  const refresh = useCallback(() => fetch(`/api/cost-structure/uploads?limit=20${showArchived ? '&includeArchived=1' : ''}`)
    .then((response) => response.ok ? response.json() : null)
    .then((data) => data && setHistory(data.uploads)), [showArchived]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const role = getCurrentUserRole();
    setAdmin(role !== null && isAdmin(role));
  }, []);

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
      router.push(`/cost-structure/upload/${done.upload.id}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload gagal.');
    } finally {
      setBusy(false);
    }
  }

  async function applyLifecycleAction() {
    if (!lifecycleAction) return;
    setBusy(true);
    setError('');
    const { item, mode } = lifecycleAction;
    try {
      const response = await fetch(`/api/cost-structure/uploads/${item.id}`, {
        method: mode === 'DELETE' ? 'DELETE' : 'PATCH',
        headers: mode === 'ARCHIVE' ? { 'content-type': 'application/json' } : undefined,
        body: mode === 'ARCHIVE' ? JSON.stringify({ action: 'ARCHIVE' }) : undefined,
      });
      const value = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(value.error ?? `${mode === 'DELETE' ? 'Delete' : 'Archive'} upload gagal.`);
      setLifecycleAction(null);
      await refresh();
      if (mode === 'DELETE' && value.storageRemoved === false) {
        setError('Record upload sudah dihapus, tetapi cleanup object storage gagal. Kejadian ini sudah dicatat di audit log untuk maintenance.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Perubahan lifecycle upload gagal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <CostModuleFrame title="Upload & Proses" contentClassName="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div data-cost-motion>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Upload & Proses</h1>
          <p className="mt-1 text-muted-foreground">Unggah workbook sumber bulanan ke penyimpanan privat dan validasi struktur datanya.</p>
        </div>

        <Card data-cost-motion data-cost-hover className="transition-shadow hover:shadow-md">
          <CardHeader><CardTitle>Input Data</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
              <Field label="Company"><select name="companyCode" required className="input" defaultValue=""><option value="" disabled>Pilih company</option>{companies.map((company) => <option key={company.companyCode} value={company.companyCode}>{company.companyCode} — {company.name}</option>)}</select></Field>
              <Field label="Fiscal Year"><input className="input" name="fiscalYear" type="number" required min={now.getFullYear() - 5} max={now.getFullYear() + 2} defaultValue={now.getFullYear()} /></Field>
              <Field label="Fiscal Period"><select className="input" name="fiscalPeriod" required defaultValue={now.getMonth() + 1}>{Array.from({ length: 12 }, (_, index) => <option key={index + 1} value={index + 1}>{String(index + 1).padStart(2, '0')}</option>)}</select></Field>
              <Field label="Upload Note (opsional)"><input className="input" name="uploadNote" maxLength={1000} placeholder="Catatan sumber atau koreksi" /></Field>
              <div className="md:col-span-2"><Field label="Source Workbook (.xlsx / .xlsm, maks. 50 MB)"><input className="block w-full rounded-md border p-2 text-sm transition-colors hover:border-primary/50" name="workbook" type="file" accept=".xlsx,.xlsm" required /></Field></div>
              {error && <p className="md:col-span-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              <button disabled={busy} className="inline-flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}{busy ? 'Memproses…' : 'Upload & Validasi'}</button>
            </form>
          </CardContent>
        </Card>

        <Card data-cost-motion data-cost-hover className="transition-shadow hover:shadow-md">
          <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
          <CardContent><div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{steps.map((label, index) => <div key={label} className={`rounded-lg border p-3 text-sm transition-all ${step >= index + 1 ? 'border-primary bg-primary/5 shadow-sm' : 'text-muted-foreground'}`}><span className="mb-1 block text-xs">{index + 1}</span>{step > index + 1 ? <CheckCircle2 className="mb-1 h-4 w-4 text-primary" /> : null}{label}</div>)}</div></CardContent>
        </Card>

        {result && <Card data-cost-motion data-cost-hover className="transition-shadow hover:shadow-md"><CardHeader><CardTitle>Latest Upload Result</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-3 sm:grid-cols-4"><Metric label="Status" value={result.status} /><Metric label="Version" value={`v${result.version}`} /><Metric label="SHA-256" value={`${result.hash.slice(0, 12)}…`} /><Metric label="Rows / Issues" value={`${result.rowCount} / ${result.issueCount}`} /></div><div className="flex flex-wrap gap-2">{result.sources.map((source) => <span className="rounded-full bg-muted px-3 py-1 text-xs" key={source.code}>{source.code}: {source.rowCount}</span>)}</div>{result.issues.length > 0 && <ul className="list-disc pl-5 text-sm text-destructive">{result.issues.map((issue, index) => <li key={index}>{issue.message}</li>)}</ul>}</CardContent></Card>}

        <Card data-cost-motion data-cost-hover className="transition-shadow hover:shadow-md">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><CardTitle>Recent Uploads</CardTitle><p className="mt-1 text-xs text-muted-foreground">Hard delete hanya tersedia sebelum mapping reusable/calculation terbentuk. Upload ber-lineage dipertahankan untuk audit dan hanya dapat diarsipkan setelah superseded.</p></div>
              {admin && <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />Tampilkan arsip</label>}
            </div>
          </CardHeader>
          <CardContent><div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="border-b bg-muted/40 text-muted-foreground"><tr><th className="p-2">Period</th><th>File</th><th>Version</th><th>Status</th><th>Size</th><th>Uploaded</th>{admin && <th className="pr-2">Aksi</th>}</tr></thead><tbody>{history.map((item) => <tr key={item.id} className="border-b transition-colors hover:bg-muted/30"><td className="p-2">{item.companyCode} · {item.fiscalYear}/{String(item.fiscalPeriod).padStart(2, '0')}</td><td><Link className="inline-flex items-center gap-1 font-medium text-primary hover:underline" href={`/cost-structure/upload/${item.id}`}><FileSpreadsheet className="h-4 w-4" />{item.originalFileName}</Link></td><td>v{item.version}</td><td><span>{item.status}</span>{item.isActiveVersion && <span className="ml-1 text-xs text-emerald-700">Active</span>}</td><td>{(Number(item.fileSizeBytes) / 1024 / 1024).toFixed(2)} MB</td><td>{new Date(item.uploadedAt).toLocaleString('id-ID')}</td>{admin && <td className="pr-2"><div className="flex min-w-32 flex-wrap gap-2">{item.lifecycle.canDelete && <button disabled={busy} onClick={() => setLifecycleAction({ mode: 'DELETE', item })} className="inline-flex items-center gap-1 font-medium text-destructive hover:underline disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Delete</button>}{item.lifecycle.canArchive && <button disabled={busy} onClick={() => setLifecycleAction({ mode: 'ARCHIVE', item })} className="inline-flex items-center gap-1 font-medium text-amber-700 hover:underline disabled:opacity-50"><Archive className="h-3.5 w-3.5" />Archive</button>}{!item.lifecycle.canDelete && !item.lifecycle.canArchive && <span className="text-xs text-muted-foreground" title={item.lifecycle.deleteReason ?? item.lifecycle.archiveReason ?? ''}>Terkunci</span>}</div></td>}</tr>)}</tbody></table>{history.length === 0 && <p className="py-8 text-center text-muted-foreground">Belum ada riwayat upload.</p>}</div></CardContent>
        </Card>
      </div>

      {lifecycleAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Konfirmasi lifecycle upload">
          <div className="w-full max-w-md rounded-xl bg-background p-5 shadow-xl">
            <h2 className="text-lg font-semibold">{lifecycleAction.mode === 'DELETE' ? 'Hapus upload?' : 'Arsipkan upload?'}</h2>
            <div className="mt-3 rounded-lg bg-muted/60 p-3 text-sm">
              <p><strong>{lifecycleAction.item.companyCode} · {lifecycleAction.item.fiscalYear}/{String(lifecycleAction.item.fiscalPeriod).padStart(2, '0')} · v{lifecycleAction.item.version}</strong></p>
              <p className="mt-1 break-all">{lifecycleAction.item.originalFileName}</p>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{lifecycleAction.mode === 'DELETE' ? 'Database source rows/issues akan dihapus dan file private storage dibersihkan. Aksi ini hanya diizinkan sebelum mapping reusable atau calculation lineage terbentuk.' : 'Upload superseded akan disembunyikan dari daftar normal, tetapi workbook, source rows, dan seluruh lineage tetap dipertahankan untuk audit.'}</p>
            <div className="mt-5 flex justify-end gap-2"><button disabled={busy} onClick={() => setLifecycleAction(null)} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50">Batal</button><button disabled={busy} onClick={() => void applyLifecycleAction()} className={`rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50 ${lifecycleAction.mode === 'DELETE' ? 'bg-destructive' : 'bg-amber-700'}`}>{busy ? 'Memproses…' : lifecycleAction.mode === 'DELETE' ? 'Ya, hapus' : 'Ya, arsipkan'}</button></div>
          </div>
        </div>
      )}
    </CostModuleFrame>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1.5 text-sm font-medium"><span>{label}</span>{children}</label>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-semibold">{value}</div></div>; }
