'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { FileSpreadsheet, RefreshCw, CheckCircle2 } from 'lucide-react';
import { IMPORT_MONTHS, MAX_FILE_BYTES, MAX_IMPORT_ROWS, parseImportGrid, type ImportWorkbook, type PeriodPlan } from '@/lib/hpp/import-model';

type Preview={year:number;hash:string;count:number;periods:PeriodPlan[]};
type HistoryRow={id:number;fiscalYear:number;fiscalPeriod:number;revision:number;sourceType:string;sourceName:string|null;sourceSha256:string|null;correctionNote:string|null;createdAt:string;publishedAt:string|null;isCurrent:boolean;createdBy:{name:string}|null;_count:{observations:number}};
type History={year:number|null;years:number[];history:HistoryRow[];truncated:boolean};
const btn='inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-40';
const muted='text-xs text-muted-foreground';
const panel='min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm';
const actionLabel:Record<PeriodPlan['action'],string>={new:'Baru',unchanged:'Identik',correction:'Koreksi',blocked:'Diblokir',empty:'Kosong'};
const actionStyle:Record<PeriodPlan['action'],string>={new:'bg-blue-50 text-blue-800',unchanged:'bg-slate-100 text-slate-700',correction:'bg-amber-100 text-amber-900',blocked:'bg-red-100 text-red-800',empty:'bg-slate-100 text-slate-600'};
function dateLabel(value:string|null){return value?new Date(value).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB':'—';}
async function api(body?:unknown,year?:number):Promise<unknown>{
  const url='/api/hpp/import'+(year===undefined?'':'?year='+year);
  const res=await fetch(url,body===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const data=await res.json();
  if(!res.ok)throw new Error(data.error||'Permintaan gagal');
  return data;
}
export default function HppDataManagement(){
  const [book,setBook]=useState<ImportWorkbook|null>(null),[fileName,setFileName]=useState('');
  const [preview,setPreview]=useState<Preview|null>(null),[selection,setSelection]=useState<number[]>([]);
  const [reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [history,setHistory]=useState<History|null>(null),[historyError,setHistoryError]=useState(''),[historyBusy,setHistoryBusy]=useState(false);
  const input=useRef<HTMLInputElement>(null),historyRequest=useRef(0);
  const loadHistory=useCallback(async(year?:number)=>{
    const id=++historyRequest.current;setHistoryBusy(true);setHistoryError('');
    try{const result=await api(undefined,year) as History;if(id===historyRequest.current)setHistory(result);}
    catch(e){if(id===historyRequest.current)setHistoryError(e instanceof Error?e.message:'Histori gagal dimuat');}
    finally{if(id===historyRequest.current)setHistoryBusy(false);}
  },[]);
  useEffect(()=>{const t=window.setTimeout(()=>void loadHistory(),0);return()=>{window.clearTimeout(t);historyRequest.current++;};},[loadHistory]);
  const selectedPlans=preview?.periods.filter(p=>selection.includes(p.period))??[];
  const corrections=selectedPlans.filter(p=>p.action==='correction');
  const eligible=preview?.periods.filter(p=>p.action==='new'||p.action==='correction')??[];
  function clearPreview(){setPreview(null);setSelection([]);setReason('');setConfirmed(false);}
  async function chooseFile(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    clearPreview();setBook(null);setFileName('');setError('');setMessage('');setBusy(true);
    try{
      if(!file.name.toLowerCase().endsWith('.xlsx'))throw new Error('Gunakan file .xlsx');
      if(file.size>MAX_FILE_BYTES)throw new Error('Ukuran file maksimal 3 MB');
      const XLSX=await import('xlsx');
      const workbook=XLSX.read(await file.arrayBuffer(),{type:'array',sheets:['Lembar1'],sheetRows:MAX_IMPORT_ROWS+3,cellFormula:true,cellDates:false});
      const sheet=workbook.Sheets['Lembar1'];if(!sheet)throw new Error('Sheet Lembar1 tidak ditemukan');
      if(!sheet['!ref'])throw new Error('Sheet Lembar1 kosong');
      const ref=XLSX.utils.decode_range(sheet['!fullref']||sheet['!ref']);
      if(ref.e.r>MAX_IMPORT_ROWS+1||ref.e.c>26)throw new Error('Rentang Lembar1 di luar template A:AA atau melebihi 1.000 baris data');
      const grid:unknown[][]=[];
      for(let r=0;r<=ref.e.r;r++){
        const row:unknown[]=[];
        for(let c=0;c<27;c++){
          const cell=sheet[XLSX.utils.encode_cell({r,c})];
          if(cell?.f||cell?.F||cell?.t==='e')throw new Error('Formula/error tidak diizinkan pada Lembar1: '+XLSX.utils.encode_cell({r,c}));
          // Preserve a formatted leading-zero plant/material ID when it is represented as an integer.
          row.push(c<3&&r>=2&&cell?.t==='n'&&typeof cell.w==='string'&&/^\d+$/.test(cell.w)?cell.w:cell?.v??null);
        }
        grid.push(row);
      }
      const parsed=parseImportGrid(grid);
      setBook(parsed);setFileName(file.name);
      const result=await api({action:'preview',workbook:parsed,sourceName:file.name}) as Preview;
      setPreview(result);setSelection(result.periods.filter(p=>p.action==='new').map(p=>p.period));
    }catch(e){setError(e instanceof Error?e.message:'File tidak dapat diproses');}
    finally{setBusy(false);}
  }
  async function refreshPreview(){
    if(!book)return;setBusy(true);setError('');setMessage('');clearPreview();
    try{const result=await api({action:'preview',workbook:book,sourceName:fileName}) as Preview;setPreview(result);setSelection(result.periods.filter(p=>p.action==='new').map(p=>p.period));}
    catch(e){setError(e instanceof Error?e.message:'Preview gagal');}
    finally{setBusy(false);}
  }
  async function publish(){
    if(!book||!preview||!selection.length||busy)return;
    if(corrections.length&&(!confirmed||reason.trim().length<5))return;
    setBusy(true);setError('');setMessage('');
    try{
      const result=await api({action:'publish',workbook:book,sourceName:fileName,hash:preview.hash,selection:selectedPlans.map(p=>({period:p.period,currentId:p.currentId})),confirmCorrection:confirmed,correctionNote:reason}) as {year:number;published:{period:number;revision:number}[];skipped:number[]};
      setMessage('Publikasi berhasil: '+result.published.map(p=>IMPORT_MONTHS[p.period-1]+' v'+p.revision).join(', ')+(result.skipped.length?' · Identik dilewati: '+result.skipped.length:''));
      clearPreview();
      await loadHistory(result.year);
      try{const fresh=await api({action:'preview',workbook:book,sourceName:fileName}) as Preview;setPreview(fresh);}catch{setError('Publikasi berhasil, tetapi preview terbaru gagal dimuat.');}
    }catch(e){setError(e instanceof Error?e.message:'Publikasi gagal');clearPreview();}
    finally{setBusy(false);}
  }
  return <div className="space-y-4 text-sm">
    <section className={panel}>
      <h2 className="font-semibold text-base">01 / Upload Excel</h2>
      <p className={muted+' mt-1'}>Template Dashboard HPP: Lembar1, tahun laporan B1, Material, Material Description, Plant, pasangan Deliv Qty dan COGM Jan–Des. Maksimal 3 MB dan 1.000 kombinasi. File asli tidak disimpan; data terstruktur divalidasi pada server.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept=".xlsx" className="hidden" onChange={chooseFile} aria-label="Pilih Excel HPP"/>
        <button type="button" className={btn} disabled={busy} onClick={()=>input.current?.click()}><FileSpreadsheet size={16}/>Pilih Excel &amp; preview</button>
        {book&&<button type="button" className={btn} disabled={busy} onClick={()=>void refreshPreview()}><RefreshCw size={14}/>Preview ulang</button>}
        {fileName&&<span className="break-all text-xs">{fileName} · {book?.year} · {book?.rows.length} kombinasi</span>}
      </div>
      {busy&&<p role="status" className={muted+' mt-2'}>Memproses data…</p>}
      {error&&<p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
      {message&&<p role="status" className="mt-3 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-800"><CheckCircle2 size={16}/>{message}</p>}
    </section>
    {preview&&<section className={panel}>
      <h2 className="font-semibold text-base">02 / Preview &amp; validasi periode</h2>
      <p className={muted+' mt-1'}>{preview.year} · {preview.count} kombinasi material–plant per bulan. Nilai kosong berbeda dari nol. Seluruh baris, termasuk kombinasi kosong, dipertahankan pada bulan yang dipublikasikan.</p>
      <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,145px),1fr))] gap-2">{[['Periode baru',preview.periods.filter(p=>p.action==='new').length],['Identik',preview.periods.filter(p=>p.action==='unchanged').length],['Koreksi',preview.periods.filter(p=>p.action==='correction').length],['Kosong / diblokir',preview.periods.filter(p=>p.action==='blocked'||p.action==='empty').length]].map(([label,n])=><div className="rounded border border-border p-3" key={label}><p className={muted}>{label}</p><strong className="text-xl tabular-nums">{n}</strong></div>)}</div>
      <div className="my-3 flex flex-wrap gap-2"><button type="button" className={btn} disabled={busy} onClick={()=>setSelection(eligible.filter(p=>p.action==='new').map(p=>p.period))}>Pilih periode baru</button><button type="button" className={btn} disabled={busy} onClick={()=>setSelection(eligible.map(p=>p.period))}>Pilih semua yang valid</button><button type="button" className={btn} disabled={busy} onClick={()=>setSelection([])}>Kosongkan pilihan</button></div>
      <div className="overflow-x-auto"><table className="w-full border-collapse text-xs"><thead className="bg-muted"><tr>{['Pilih','Periode','Versi aktif','Terisi','Kosong','Berubah','Tambah','Hilang','Jadi kosong','Metadata','Status'].map(t=><th key={t} className="p-2 text-left">{t}</th>)}</tr></thead><tbody>{preview.periods.map(p=><tr key={p.period} className="border-b border-border"><td className="p-2"><input type="checkbox" aria-label={'Pilih '+IMPORT_MONTHS[p.period-1]} disabled={busy||!eligible.some(x=>x.period===p.period)} checked={selection.includes(p.period)} onChange={e=>{setConfirmed(false);setSelection(old=>e.target.checked?[...old,p.period]:old.filter(x=>x!==p.period));}}/></td><td className="p-2 font-medium">{IMPORT_MONTHS[p.period-1]}</td><td className="p-2">{p.revision===null?'—':'v'+p.revision}</td>{[p.filled,p.blank,p.changed,p.added,p.missing,p.cleared,p.protectedMetadata].map((v,i)=><td className={'p-2 tabular-nums '+(v>0&&i>=4?'font-semibold text-red-700':'')} key={i}>{v}</td>)}<td className="p-2"><span className={'rounded px-2 py-1 '+actionStyle[p.action]}>{actionLabel[p.action]}</span></td></tr>)}</tbody></table></div>
      <p className={muted+' mt-3'}>Hilang = kombinasi versi aktif tidak ada di workbook baru. Jadi kosong = nilai sebelumnya terisi menjadi kosong. Metadata = kombinasi memiliki unit atau mata uang pada versi aktif. Periode dengan kombinasi hilang atau metadata terverifikasi diblokir; periode identik tidak membuat versi baru.</p>
      <h3 className="mt-4 font-semibold">Sampel sumber (10 kombinasi pertama)</h3>
      <div className="mt-2 overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted"><tr>{['Material','Deskripsi','Plant','Periode','COGM','Deliv Qty'].map(s=><th className="p-2 text-left" key={s}>{s}</th>)}</tr></thead><tbody>{book?.rows.slice(0,10).map(r=>{const p=(selection[0]??preview.periods.find(x=>x.filled>0)?.period??1)-1;return <tr className="border-b border-border" key={JSON.stringify([r.code,r.plant])}><td className="p-2">{r.code}</td><td className="p-2">{r.name}</td><td className="p-2">{r.plant}</td><td className="p-2">{IMPORT_MONTHS[p]}</td><td className="p-2">{r.c[p]??'—'}</td><td className="p-2">{r.q[p]??'—'}</td></tr>;})}</tbody></table></div>
    </section>}
    {preview&&<section className={panel}>
      <h2 className="font-semibold text-base">03 / Publikasi</h2>
      <p className={muted+' mt-1'}>{selection.length} periode dipilih; {corrections.length} koreksi. Dashboard membaca versi aktif setelah publikasi berhasil. Versi lama tidak dihapus.</p>
      {corrections.length>0&&<div className="my-3 space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs">
        <label className="block font-medium">Alasan koreksi (wajib)<textarea value={reason} maxLength={1000} disabled={busy} onChange={e=>{setReason(e.target.value);setConfirmed(false);}} className="mt-1 block w-full rounded border border-border bg-white p-2" rows={3}/></label>
        <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>Saya telah memeriksa perubahan nilai dan cakupan periode, serta menyetujui penerbitan versi koreksi.</label>
      </div>}
      <button type="button" className={btn+' mt-3 bg-primary/10'} disabled={busy||selection.length===0||(corrections.length>0&&(!confirmed||reason.trim().length<5))} onClick={()=>void publish()}>Publikasikan {selection.length} periode</button>
    </section>}
    <section className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold text-base">04 / Histori publikasi</h2><p className={muted}>Versi aktif dan historis, pengguna, sumber, waktu dan alasan koreksi.</p></div><div className="flex items-center gap-2"><select aria-label="Tahun histori" className="rounded border border-border p-2 text-xs" value={history?.year??''} disabled={historyBusy} onChange={e=>void loadHistory(e.target.value?Number(e.target.value):undefined)}><option value="">Tahun terbaru</option>{[...new Set([...(history?.years??[]),...(history?.year?[history.year]:[])])].sort((a,b)=>b-a).map(y=><option key={y} value={y}>{y}</option>)}</select><button className={btn} type="button" disabled={historyBusy} onClick={()=>void loadHistory(history?.year??undefined)}><RefreshCw size={14}/>Refresh</button></div></div>
      {historyError&&<p role="alert" className="mt-2 text-xs text-red-700">{historyError}</p>}
      {history?.truncated&&<p className="mt-2 text-xs text-amber-800">Menampilkan 500 versi terbaru pada tahun terpilih.</p>}
      <div className="mt-3 overflow-x-auto"><table className="w-full border-collapse text-xs"><thead className="bg-muted"><tr>{['Periode','Versi','Status','Jumlah','Sumber','Pengguna','Publikasi','Alasan koreksi'].map(s=><th key={s} className="p-2 text-left">{s}</th>)}</tr></thead><tbody>{history?.history.map(h=><tr key={h.id} className="border-b border-border"><td className="p-2 whitespace-nowrap">{IMPORT_MONTHS[h.fiscalPeriod-1]} {h.fiscalYear}</td><td className="p-2">v{h.revision}</td><td className="p-2"><span className={'rounded px-2 py-1 '+(h.isCurrent?'bg-green-100 text-green-800':'bg-muted')}>{h.isCurrent?'Aktif':h.publishedAt?'Historis':'Belum publikasi'}</span></td><td className="p-2 tabular-nums">{h._count.observations}</td><td className="p-2 break-all" title={h.sourceSha256??''}>{h.sourceName??h.sourceType}</td><td className="p-2">{h.createdBy?.name??'—'}</td><td className="p-2 whitespace-nowrap">{dateLabel(h.publishedAt)}</td><td className="p-2 break-words">{h.correctionNote??'—'}</td></tr>)}</tbody></table></div>
      {!history?.history.length&&<p className={muted+' py-5 text-center'}>{historyBusy?'Memuat histori…':'Belum ada histori yang dapat ditampilkan.'}</p>}
    </section>
  </div>;
}
