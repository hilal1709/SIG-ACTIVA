'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { LoaderCircle,RefreshCw,Monitor,Play,ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { HppLoadingBar,HppSkeleton,useHppReveal } from '../HppUx';
import { IMPORT_MONTHS,type PeriodPlan } from '@/lib/hpp/import-model';
import type { AgentRow } from '@/lib/hpp/agent-model';
type Device={id:string;name:string;lastSeenAt:string|null;revokedAt:string|null};
type Job={id:string;deviceId:string;fiscalYear:number;fiscalPeriod:number;status:string;sourceMode:string|null;createdAt:string;leaseUntil:string|null;errorCode:string|null;publishedId:number|null};
type Listing={devices:Device[];jobs:Job[];isAdmin:boolean;sapPublishEnabled:boolean};
type Review={id:string;hash:string;mode:string;plan:PeriodPlan;rows:AgentRow[]};
const panel='rounded-xl border border-border bg-card p-4 shadow';
const btn='inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40';
const field='min-h-9 rounded-md border border-border bg-background px-2 text-xs';
const note='text-xs text-muted-foreground';
const when=(s:string|null)=>s?new Date(s).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})+' WIB':'—';
const active=(d:Device)=>!d.revokedAt&&d.lastSeenAt&&Date.now()-Date.parse(d.lastSeenAt)<60000;
async function request(payload?:unknown,id?:string){
 const res=await fetch('/api/hpp/sync'+(id?'?jobId='+encodeURIComponent(id):''),payload===undefined?{cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),cache:'no-store'});
 const x=await res.json();if(!res.ok)throw Error(x.error||'SAP Sync gagal');return x;
}
export default function HppSync(){
 const [listing,setListing]=useState<Listing|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [name,setName]=useState(''),[token,setToken]=useState(''),[deviceId,setDeviceId]=useState('');
 const [year,setYear]=useState(new Date().getFullYear()),[period,setPeriod]=useState(new Date().getMonth()+1);
 const [review,setReview]=useState<Review|null>(null),[reason,setReason]=useState(''),[confirm,setConfirm]=useState(false),[search,setSearch]=useState('');
 const root=useRef<HTMLDivElement>(null), seq=useRef(0),reviewRef=useRef<HTMLElement>(null);
 useHppReveal(root,!!listing);
 const refresh=useCallback(async()=>{
  const n=++seq.current;
  try{const data=await request() as Listing;if(n===seq.current){setListing(data);setError('');}}
  catch(e){if(n===seq.current)setError(e instanceof Error?e.message:'Gagal memuat');}
  finally{if(n===seq.current)setLoading(false);}
 },[]);
 useEffect(()=>{const t=window.setTimeout(()=>void refresh(),0),i=window.setInterval(()=>{if(!document.hidden)void refresh();},15000);return()=>{clearTimeout(t);clearInterval(i);seq.current++;};},[refresh]);
 async function action(payload:Record<string,unknown>){
  if(busy)return;
  setBusy(true);setError('');
  try{const r=await request(payload);
   if(payload.action==='register'){setToken(r.token);setDeviceId(r.device.id);setName('');toast.success('Device terdaftar. Simpan token sekali ini.');}
   else{toast.success(payload.action==='publish'?'Review diselesaikan':payload.action==='enqueue'?'Job masuk antrean':'Perubahan tersimpan');if(payload.action==='publish'||payload.action==='cancel'||payload.action==='revoke')setReview(null);}
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:'Gagal memproses');}
  finally{setBusy(false);}
 }
 async function openReview(id:string){
  setBusy(true);setError('');setReview(null);setReason('');setConfirm(false);setSearch('');
  try{setReview(await request(undefined,id) as Review);window.setTimeout(()=>reviewRef.current?.scrollIntoView({behavior:'auto',block:'start'}),50);}
  catch(e){setError(e instanceof Error?e.message:'Review gagal');}finally{setBusy(false);}
 }
 const devices=listing?.devices??[],jobs=listing?.jobs??[],filtered=review?.rows.filter(r=>[r.code,r.name,r.plant].join(' ').toLowerCase().includes(search.toLowerCase()))??[];
 return <div ref={root} className="space-y-4 text-sm" aria-busy={busy||loading}>
  <HppLoadingBar active={busy}/>
  <div className="flex flex-wrap items-center justify-between gap-2"><p className={note}>Pilot · Hasil agent masuk antrean review; tidak langsung mengubah dashboard.</p><button className={btn} disabled={busy} onClick={()=>void refresh()}><RefreshCw size={14}/>Refresh</button></div>
  {!listing?.sapPublishEnabled&&<div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Publikasi SAP dikunci sampai pilot dan rekonsiliasi disetujui. Hasil sintetis selalu dilarang dipublikasikan.</div>}
  {error&&<p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
  {loading&&!listing?<HppSkeleton kind="table" label="Memuat SAP Sync…"/>:<>
   <section data-hpp-reveal className={panel}><h2 className="flex items-center gap-2 font-semibold"><Monitor size={18} className="text-primary"/>Perangkat Desktop Agent</h2><p className={note+' mt-1'}>Online = heartbeat terakhir kurang dari 60 detik; saat menjalankan script, status dapat terlihat offline.</p>
    {listing?.isAdmin&&<div className="my-3 flex flex-wrap gap-2"><input className={field} placeholder="Nama komputer agent" aria-label="Nama komputer agent" maxLength={80} value={name} onChange={e=>setName(e.target.value)}/><button className={btn} disabled={busy||!name.trim()} onClick={()=>void action({action:'register',name})}>Daftarkan perangkat</button></div>}
    {token&&<div className="my-3 space-y-2 rounded border border-amber-300 bg-amber-50 p-3"><p className="text-xs font-semibold">Token hanya ditampilkan sekali. Simpan pada perangkat yang berwenang; jangan bagikan atau commit.</p><input className={field+' w-full font-mono'} readOnly type="password" value={token} aria-label="Token agent"/><div className="flex gap-2"><button className={btn} onClick={()=>void navigator.clipboard.writeText(token).then(()=>toast.success('Token disalin')).catch(()=>toast.error('Gagal menyalin token'))}>Salin token</button><button className={btn} onClick={()=>setToken('')}>Tutup token</button></div></div>}
    <div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted"><tr>{['Perangkat','Status','Heartbeat terakhir','Aksi'].map(x=><th key={x} className="p-2 text-left">{x}</th>)}</tr></thead><tbody>{devices.map(d=><tr key={d.id} className="border-b border-border"><td className="p-2 font-medium">{d.name}</td><td className="p-2">{d.revokedAt?'Dicabut':active(d)?'Online':'Offline / menjalankan job'}</td><td className="p-2">{when(d.lastSeenAt)}</td><td className="p-2">{listing?.isAdmin&&!d.revokedAt&&<button className={btn} disabled={busy} onClick={()=>{if(window.confirm('Cabut token dan batalkan job terbuka perangkat ini?'))void action({action:'revoke',deviceId:d.id});}}>Cabut akses</button>}</td></tr>)}</tbody></table></div>
    {!devices.length&&<p className={note+' py-4 text-center'}>Belum ada perangkat terdaftar.</p>}
   </section>
   <section data-hpp-reveal className={panel}><h2 className="font-semibold">Permintaan ekstraksi HPP</h2><p className={note+' mt-1'}>Cakupan dikunci dari periode aktif terakhir pada tahun yang sama. Tahun baru membutuhkan baseline Excel terlebih dahulu.</p><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end"><label className="flex flex-col gap-1 text-xs">Tahun<input type="number" min={2000} max={2100} className={field} value={year} onChange={e=>setYear(Number(e.target.value))}/></label><label className="flex flex-col gap-1 text-xs">Periode<select className={field} value={period} onChange={e=>setPeriod(Number(e.target.value))}>{IMPORT_MONTHS.map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select></label><label className="flex flex-col gap-1 text-xs">Perangkat<select className={field} value={deviceId} onChange={e=>setDeviceId(e.target.value)}><option value="">Pilih perangkat</option>{devices.filter(d=>!d.revokedAt).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><button className={btn} disabled={busy||!devices.some(d=>d.id===deviceId&&!d.revokedAt)||!Number.isInteger(year)||year<2000||year>2100} onClick={()=>void action({action:'enqueue',year,period,deviceId})}><Play size={14}/>Tarik data SAP</button></div></section>
   <section data-hpp-reveal className={panel}><h2 className="font-semibold">Antrean & histori job</h2><p className={note+' mt-1'}>100 job terbaru · refresh otomatis 15 detik. Job kedaluwarsa perlu dibatalkan atau diproses saat agent kembali polling.</p><div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><thead className="bg-muted"><tr>{['Periode','Perangkat','Status','Sumber','Diminta','Catatan','Aksi'].map(x=><th className="p-2 text-left" key={x}>{x}</th>)}</tr></thead><tbody>{jobs.map(j=><tr className="border-b border-border" key={j.id}><td className="p-2 whitespace-nowrap">{IMPORT_MONTHS[j.fiscalPeriod-1]} {j.fiscalYear}</td><td className="p-2">{devices.find(d=>d.id===j.deviceId)?.name??j.deviceId}</td><td className="p-2 font-medium">{j.status==='RUNNING'&&j.leaseUntil&&Date.parse(j.leaseUntil)<=Date.now()?'LEASE EXPIRED':j.status}</td><td className="p-2">{j.sourceMode??'—'}</td><td className="p-2">{when(j.createdAt)}</td><td className="p-2">{j.errorCode??(j.publishedId?'Versi #'+j.publishedId:'—')}</td><td className="p-2"><div className="flex flex-wrap gap-1">{j.status==='REVIEW'&&<button className={btn} disabled={busy} onClick={()=>void openReview(j.id)}>Review</button>}{['QUEUED','RUNNING','REVIEW'].includes(j.status)&&<button className={btn} disabled={busy} onClick={()=>{if(window.confirm('Batalkan job ini?'))void action({action:'cancel',jobId:j.id});}}>Batalkan</button>}</div></td></tr>)}</tbody></table></div>{!jobs.length&&<p className={note+' py-4 text-center'}>Belum ada job.</p>}</section>
   {review&&<section ref={reviewRef} className={panel+' scroll-mt-24'}><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18}/>Review hasil agent</h2><p className={note}>{review.mode} · {review.plan.count} kombinasi · {review.plan.action}</p><div className="my-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Terisi',review.plan.filled],['Berubah',review.plan.changed],['Hilang',review.plan.missing],['Menjadi kosong',review.plan.cleared]].map(([l,n])=><div key={l} className="rounded border border-border p-3"><p className={note}>{l}</p><strong className="text-xl">{n}</strong></div>)}</div><input className={field+' w-full'} aria-label="Cari hasil" placeholder="Cari kode, plant, deskripsi" value={search} onChange={e=>setSearch(e.target.value)}/><div className="mt-2 max-h-96 overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-muted"><tr>{['Material','Deskripsi','Plant','COGM','Delivery Qty'].map(x=><th className="p-2 text-left" key={x}>{x}</th>)}</tr></thead><tbody>{filtered.map(r=><tr key={JSON.stringify([r.code,r.plant])} className="border-b border-border"><td className="p-2">{r.code}</td><td className="p-2">{r.name}</td><td className="p-2">{r.plant}</td><td className="p-2 text-right tabular-nums">{r.cogm??'—'}</td><td className="p-2 text-right tabular-nums">{r.deliveryQty??'—'}</td></tr>)}</tbody></table></div><p className={note+' mt-2'}>{filtered.length} baris · nilai sumber tanpa konversi. Verifikasi unit dan rekonsiliasi SAP sebelum publikasi.</p><label className="mt-3 block text-xs">Catatan review<textarea className="mt-1 block w-full rounded border border-border p-2" value={reason} maxLength={1000} onChange={e=>{setReason(e.target.value);setConfirm(false);}}/></label><label className="my-2 flex gap-2 text-xs"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)}/>Saya telah memeriksa sumber, periode, kelengkapan dan nilai hasil SAP.</label><button className={btn} disabled={busy||!listing?.sapPublishEnabled||review.mode!=='SAP_SCRIPT'||['blocked','empty'].includes(review.plan.action)||!confirm||reason.trim().length<5} onClick={()=>void action({action:'publish',jobId:review.id,hash:review.hash,currentId:review.plan.currentId,reason,confirm})}>{busy?<LoaderCircle size={14} className="animate-spin"/>:<ShieldCheck size={14}/>}Publikasikan hasil review</button></section>}
  </>}
 </div>;
}
