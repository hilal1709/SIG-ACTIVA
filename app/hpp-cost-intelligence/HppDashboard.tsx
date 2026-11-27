'use client';

import { useMemo, useRef, useState, type ReactNode, type ChangeEvent } from 'react';
import { Download, FileUp, RotateCcw } from 'lucide-react';
import { delta, fmt, key, latestPeriod, makeCsv, months, pct, positive, sortRows, status, statusLabel, summarize, validateSnapshot, type HppRow, type Observation, type SortKey } from './model';

const inputStyle = 'h-9 w-full min-w-0 rounded-md border border-border bg-background px-2 text-xs';
const buttonStyle = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-40';
const red = '#ba4d43', teal = '#167c75', blue = '#2878a7';
const PAGE = 15;
const cols: [SortKey, string][] = [['code','Kode material'],['name','Deskripsi'],['plant','Plant'],['base','COGM pembanding'],['cur','COGM analisis'],['dev','Deviasi %'],['qty','Deliv Qty'],['state','Status']];
const note = 'text-[11px] leading-relaxed text-muted-foreground';
function color(v: Observation) { return v === null || v === 0 ? undefined : v > 0 ? red : teal; }
function Panel({children}: {children: ReactNode}) { return <section className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-sm">{children}</section>; }
function Heading({title, sub}: {title: string; sub: string}) { return <div className="mb-3 mt-6 flex flex-wrap items-baseline justify-between gap-2"><h2 className="text-lg font-semibold tracking-tight">{title}</h2><p className={note}>{sub}</p></div>; }
function Field({label, children}: {label: string; children: ReactNode}) { return <label className="block min-w-0 text-[11px] font-semibold text-muted-foreground"><span className="mb-1 block">{label}</span>{children}</label>; }
function Empty({children}: {children: ReactNode}) {return <p className="py-8 text-center text-xs text-muted-foreground">{children}</p>;}
function Rank({rows, value, label, onSelect, tone}: {rows: HppRow[]; value: (r:HppRow)=>number; label: (r:HppRow)=>ReactNode; onSelect:(r:HppRow)=>void; tone:(r:HppRow)=>string}) {
  const max = Math.max(1,...rows.map(r=>Math.abs(value(r))));
  if (!rows.length) return <Empty>Tidak ada kombinasi pada kategori ini.</Empty>;
  return <div className="mt-3">{rows.map(r=><button key={key(r)} type="button" onClick={()=>onSelect(r)} title={r.name+' · '+r.code+' · Plant '+r.plant} className="grid w-full grid-cols-[minmax(0,1.3fr)_minmax(36px,1fr)_auto] items-center gap-2 border-b border-border py-2 text-left hover:bg-muted">
    <span className="min-w-0 text-[11px] font-semibold">{label(r)}</span>
    <span className="h-3.5 overflow-hidden rounded-sm bg-muted"><span className="block h-full rounded-sm" style={{width: Math.abs(value(r))/max*100+'%',background:tone(r)}}/></span>
    <span className="min-w-[60px] text-right text-xs font-semibold tabular-nums" style={{color:tone(r)}}>{tone(r)===red||tone(r)===teal?pct(value(r)):fmt(value(r))}</span>
  </button>)}</div>;
}
function Trend({values,kind,current,base}:{values:Observation[];kind:'c'|'q';current:number;base:number}) {
  const valid=values.filter((v):v is number=>v!==null);
  if(!valid.length)return <Empty>Tidak ada observasi.</Empty>;
  const W=600,H=245,L=84,R=16,T=19,B=32;
  let max=Math.max(...valid),min=kind==='q'?Math.min(0,...valid):Math.min(...valid);
  const pad=(max-min)*.12||Math.max(Math.abs(max)*.1,1);
  min=min>=0?Math.max(0,min-pad):min-pad; max+=pad;
  const x=(i:number)=>L+i*(W-L-R)/11,y=(v:number)=>T+(max-v)/(max-min)*(H-T-B);
  return <svg viewBox={'0 0 '+W+' '+H} className="h-auto w-full" role="img" aria-label={kind==='q'?'Delivery quantity per bulan':'COGM per bulan'}>
    {Array.from({length:5},(_,i)=>{const v=min+(max-min)*i/4;return <g key={i}><line x1={L} x2={W-R} y1={y(v)} y2={y(v)} stroke="#e0e8ee"/><text x={L-8} y={y(v)+4} textAnchor="end" fill="#687c8b" fontSize="11">{fmt(v)}</text></g>;})}
    <rect x={x(current)-10} y={T} width="20" height={H-B-T} fill="#dcebf3" opacity=".7"/>
    {current!==base&&<line x1={x(base)} x2={x(base)} y1={T} y2={H-B} stroke="#9baeba" strokeDasharray="4 4"/>}
    {months.map((m,i)=>{const v=values[i],prev=values[i-1];return <g key={m}><text x={x(i)} y={H-10} textAnchor="middle" fontSize="11" fill="#687c8b" fontWeight={i===current?700:400}>{m}</text>{v!==null&&(kind==='q'?<rect x={x(i)-11} y={Math.min(y(v),y(0))} width="22" height={Math.max(1,Math.abs(y(0)-y(v)))} fill={i===current?blue:'#5f96b5'}><title>{m}: {fmt(v,3)}</title></rect>:<>{i>0&&prev!==null&&<line x1={x(i-1)} y1={y(prev)} x2={x(i)} y2={y(v)} stroke={blue} strokeWidth="2.3"/>}<circle cx={x(i)} cy={y(v)} r={i===current?5:3.5} fill={blue} stroke="white" strokeWidth="1.4"><title>{m}: {fmt(v,3)}</title></circle></>)}</g>;})}
  </svg>;
}

export default function HppDashboard(){
  const [data,setData]=useState<HppRow[]>([]);
  const [source,setSource]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const [current,setCurrent]=useState(9),[base,setBase]=useState(8);
  const [plant,setPlant]=useState('all'),[prefix,setPrefix]=useState('all'),[material,setMaterial]=useState('all');
  const [threshold,setThreshold]=useState('10'),[selection,setSelection]=useState('');
  const [heatCount,setHeatCount]=useState(12),[search,setSearch]=useState(''),[state,setState]=useState('all');
  const [sort,setSort]=useState<SortKey>('dev'),[asc,setAsc]=useState(false),[page,setPage]=useState(0);
  const drill=useRef<HTMLDivElement>(null);
  const fileInput=useRef<HTMLInputElement>(null);
  const latest=latestPeriod(data);
  const limit=Math.max(.1,Math.min(10000,Number(threshold)||10));
  const plants=useMemo(()=>[...new Set(data.map(d=>d.plant))].sort(),[data]);
  const prefixes=useMemo(()=>[...new Set(data.map(d=>d.code.slice(0,3)))].sort(),[data]);
  const codes=useMemo(()=>[...new Map(data.map(d=>[d.code,d.name])).entries()].sort((a,b)=>a[1].localeCompare(b[1])),[data]);
  const scope=useMemo(()=>data.filter(d=>(plant==='all'||d.plant===plant)&&(material==='all'||d.code===material)&&(prefix==='all'||d.code.startsWith(prefix))),[data,plant,material,prefix]);
  const summary=useMemo(()=>summarize(scope,current,base,limit),[scope,current,base,limit]);
  const heat=useMemo(()=>[...scope].sort((a,b)=>Math.abs(delta(b,current,base)??0)-Math.abs(delta(a,current,base)??0)),[scope,current,base]);
  const selected=scope.find(d=>key(d)===selection)||heat.find(d=>delta(d,current,base)!==null)||scope[0];
  const peers=selected?data.filter(d=>d.code===selected.code&&positive(d.c[current])).sort((a,b)=>dvalue(a)-dvalue(b)):[];
  function dvalue(r:HppRow){return r.c[current]??0;}
  const table=useMemo(()=>sortRows(scope.filter(d=>(!search.trim()||[d.code,d.name,d.plant].join(' ').toLowerCase().includes(search.trim().toLowerCase()))&&(state==='all'||status(d,current,base,limit)===state)),sort,asc,current,base,limit),[scope,search,state,sort,asc,current,base,limit]);
  const shownPage=Math.max(0,Math.min(page,Math.ceil(table.length/PAGE)-1));
  function resetSelection(){setSelection('');setPage(0);}
  function reset(period=latest){setCurrent(period);setBase(Math.max(0,period-1));setPlant('all');setPrefix('all');setMaterial('all');setThreshold('10');setHeatCount(12);setSearch('');setState('all');setSort('dev');setAsc(false);resetSelection();}
  async function loadFile(e:ChangeEvent<HTMLInputElement>){
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    setError('');setLoading(true);
    try{
      if(file.size>20*1024*1024)throw new Error('Ukuran snapshot maksimal 20 MB.');
      const rows=validateSnapshot(JSON.parse(await file.text()));
      setData(rows);setSource(file.name);reset(latestPeriod(rows));
    }catch(err){setError(err instanceof Error?err.message:'Snapshot tidak dapat dibaca.');}
    finally{setLoading(false);}
  }
  function choose(d:HppRow){setSelection(key(d));drill.current?.scrollIntoView({behavior:'smooth',block:'start'});}
  function choosePeer(d:HppRow){setPlant(d.plant);setMaterial(d.code);setPrefix('all');setSelection(key(d));setPage(0);}
  function exportCsv(){const url=URL.createObjectURL(new Blob([makeCsv(table,current,base,limit)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='HPP_'+months[current]+'_vs_'+months[base]+'_2026.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const ratio=(n:number,d:number)=>d?fmt(n/d*100,1)+'%':'—';
  const cards=[{title:'COGM terisi',n:summary.available,sub:scope.length+' kombinasi dalam filter',tone:'#68899e'},{title:'Dapat dibandingkan',n:summary.comparable.length,sub:ratio(summary.comparable.length,scope.length)+' dari cakupan',tone:'#68899e'},{title:'COGM naik',n:summary.ups.length,sub:ratio(summary.ups.length,summary.comparable.length)+' dari pembanding valid',tone:red},{title:'COGM turun',n:summary.downs.length,sub:ratio(summary.downs.length,summary.comparable.length)+' dari pembanding valid',tone:teal},{title:'Prioritas review',n:summary.alerts.length,sub:'Kenaikan ≥ '+fmt(limit,limit%1?1:0)+'%',tone:red}];
  const top=summary.ups[0];
  const change=(r:HppRow)=>delta(r,current,base)??0;
  const rankLabel=(r:HppRow)=><><span className="block truncate">{r.name}</span><span className="block truncate font-normal text-muted-foreground">{r.code} · {r.plant}</span></>;
  return <div className="mx-auto max-w-[1600px] min-w-0 space-y-3 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className={note}>{data.length?'Periode data terakhir: '+months[latest]+' 2026 · '+source:'Snapshot 2026 belum dimuat'} · lokal, tidak dikirim ke server</div>
      <input ref={fileInput} type="file" accept=".json,application/json" className="hidden" onChange={loadFile} aria-label="Pilih snapshot JSON"/>
      <button type="button" className={buttonStyle} onClick={()=>fileInput.current?.click()} disabled={loading}><FileUp size={15}/>{loading?'Memuat…':'Muat snapshot JSON'}</button>
    </div>
    {error&&<p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
    {!data.length?<Panel><Empty>Muat snapshot JSON HPP 2026 untuk membuka analisis. Data hanya berada di memori tab browser; refresh menghapus snapshot.</Empty></Panel>:<>
      <Panel><div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3 xl:grid-cols-7">
        <Field label="Periode analisis"><select className={inputStyle} value={current} onChange={e=>{const p=+e.target.value;setCurrent(p);setBase(Math.max(0,p-1));resetSelection();}}>{months.map((m,i)=><option key={m} value={i}>{m} 2026</option>)}</select></Field>
        <Field label="Periode pembanding"><select className={inputStyle} value={base} onChange={e=>{setBase(+e.target.value);resetSelection();}}>{months.map((m,i)=><option key={m} value={i}>{m} 2026</option>)}</select></Field>
        <Field label="Plant"><select className={inputStyle} value={plant} onChange={e=>{setPlant(e.target.value);resetSelection();}}><option value="all">Semua plant</option>{plants.map(p=><option key={p}>{p}</option>)}</select></Field>
        <Field label="Prefix material"><select className={inputStyle} value={prefix} onChange={e=>{const p=e.target.value;setPrefix(p);if(p!=='all'&&material!=='all'&&!material.startsWith(p))setMaterial('all');resetSelection();}}><option value="all">Semua prefix</option>{prefixes.map(p=><option key={p}>{p}</option>)}</select></Field>
        <div className="col-span-2"><Field label="Material (kode & deskripsi)"><select className={inputStyle} value={material} onChange={e=>{const m=e.target.value;setMaterial(m);if(m!=='all'&&prefix!=='all'&&!m.startsWith(prefix))setPrefix('all');resetSelection();}}><option value="all">Semua material</option>{codes.map(([c,n])=><option key={c} value={c}>{n} · {c}</option>)}</select></Field></div>
        <Field label="Ambang kenaikan (%)"><input className={inputStyle} type="number" min=".1" max="10000" step="1" value={threshold} onChange={e=>{setThreshold(e.target.value);resetSelection();}}/></Field>
        <button type="button" className={buttonStyle} onClick={()=>reset()}><RotateCcw size={14}/>Reset filter</button>
      </div></Panel>
      <Heading title="01 / Executive overview" sub={months[current]+' 2026 vs '+months[base]+' 2026 · '+scope.length+' kombinasi'}/>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{cards.map(c=><div key={c.title} className="rounded-lg border border-border border-t-[3px] bg-card p-3 shadow-sm" style={{borderTopColor:c.tone}}><div className={note}>{c.title}</div><div className="text-[28px] font-semibold tabular-nums" style={{color:c.tone===red||c.tone===teal?c.tone:undefined}}>{fmt(c.n)}</div><div className={note}>{c.sub}</div></div>)}</div>
      <div className="rounded-r-md border-l-[3px] border-l-[#2878a7] bg-sky-50 p-3 text-xs leading-relaxed text-slate-800"><b>Fokus keputusan:</b> {summary.comparable.length?<>{summary.alerts.length} dari {summary.comparable.length} kombinasi sebanding mencapai ambang kenaikan {fmt(limit,limit%1?1:0)}%. {top?<>Kenaikan terbesar: <b>{top.name} · plant {top.plant}</b> ({pct(change(top))}; {fmt(top.c[base],2)} → {fmt(top.c[current],2)}). </>:'Tidak terdapat kenaikan COGM. '}<b>{scope.length-summary.comparable.length}</b> kombinasi tidak dapat dibandingkan; validasi data kosong dan nilai tidak positif. {current===base?'Periode analisis dan pembanding sama.':''}</>:'Tidak ada pasangan COGM positif yang sebanding. Ubah filter atau periode pembanding.'}</div>
      <Heading title="02 / Exception monitoring" sub="Klik kombinasi untuk melihat tren detail"/>
      <div className="grid min-w-0 gap-3 xl:grid-cols-2">
        <Panel><h3 className="font-semibold">Kenaikan COGM tertinggi</h3><p className={note}>Top 8 kenaikan relatif terhadap periode pembanding.</p><Rank rows={summary.ups.slice(0,8)} value={change} tone={()=>red} label={rankLabel} onSelect={choose}/></Panel>
        <Panel><h3 className="font-semibold">Penurunan COGM terbesar</h3><p className={note}>Top 8 penurunan relatif. Bukan konfirmasi efisiensi aktual.</p><Rank rows={summary.downs.slice(0,8)} value={change} tone={()=>teal} label={rankLabel} onSelect={choose}/></Panel>
      </div>
      <Panel><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Heatmap perubahan bulanan</h3><p className={note}>MoM, diurutkan menurut absolut deviasi periode analisis.</p></div><Field label="Jumlah kombinasi"><select className={inputStyle} value={heatCount} onChange={e=>setHeatCount(+e.target.value)}><option value={12}>12 teratas</option><option value={25}>25 teratas</option><option value={50000}>Semua</option></select></Field></div>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[860px] table-fixed border-separate border-spacing-[3px] text-[10px]"><thead><tr><th className="w-52 text-left">Material · plant</th>{months.map((m,i)=><th key={m} className={i===current?'outline outline-1 outline-slate-600':''}>{m}</th>)}</tr></thead><tbody>{heat.slice(0,heatCount).map(d=><tr key={key(d)}><td className="truncate"><button title={d.code+' · '+d.name} type="button" className="block w-full truncate text-left hover:underline" onClick={()=>choose(d)}>{d.name} · {d.plant}</button></td>{months.map((m,i)=>{const v=i?delta(d,i,i-1):null,a=v===null?0:Math.min(1,Math.abs(v)/30);const bg=v===null?'#eef1f4':v>0?'rgba(194,80,66,'+(.12+.70*a)+')':v<0?'rgba(36,136,119,'+(.12+.66*a)+')':'#f5f7f9';return <td key={m} style={{background:bg,color:a>.65?'white':'#263d4e'}} className={'rounded-sm text-center tabular-nums '+(i===current?'outline outline-1 outline-slate-600':'')}><button type="button" onClick={()=>choose(d)} title={m+': '+pct(v)} className="min-h-7 w-full" ><span style={{color:a>.65?'white':'#263d4e'}}>{pct(v)}</span></button></td>;})}</tr>)}</tbody></table>{!heat.length&&<Empty>Tidak ada kombinasi sesuai filter.</Empty>}</div>
        <p className={note+' mt-2'}><span style={{color:red}}>■ Naik</span> · <span style={{color:teal}}>■ Turun</span> · Abu-abu: tidak sebanding · Intensitas dibatasi ±30%; label menunjukkan nilai aktual.</p>
      </Panel>
      <div ref={drill} className="scroll-mt-24"><Heading title="03 / Drill-down material & plant" sub="Tren tahunan dan benchmarking kode material yang sama"/></div>
      <Panel>{selected?<><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-semibold">{selected.name}</h3><p className={note}>{selected.code} · Plant {selected.plant} · {months[current]} 2026</p></div><button className={buttonStyle} onClick={()=>{setMaterial(selected.code);setPlant('all');setPrefix('all');setSelection(key(selected));setPage(0);}}>Filter material ini</button></div>
        <div className="my-3 grid grid-cols-2 gap-2 xl:grid-cols-4">{[{l:'COGM analisis',v:fmt(selected.c[current],2)},{l:'Deviasi vs '+months[base],v:pct(delta(selected,current,base)),tone:color(delta(selected,current,base))},{l:'Delivery Qty '+months[current],v:fmt(selected.q[current],2)},{l:'Delivery Qty YTD',v:fmt(selected.q.slice(0,current+1).some(v=>v!==null)?selected.q.slice(0,current+1).reduce<number>((a,b)=>a+(b??0),0):null,2)}].map(c=><div key={c.l} className="rounded-md border border-border bg-muted/30 p-3"><p className={note}>{c.l}</p><strong className="block break-words text-lg tabular-nums" style={{color:c.tone}}>{c.v}</strong></div>)}</div>
        <div className="grid gap-3 xl:grid-cols-2"><div className="min-w-0 rounded-md border border-border p-3"><h4 className="font-semibold">COGM per unit</h4><p className={note}>Nilai asli sumber · titik kosong tidak diinterpolasi</p><Trend values={selected.c} current={current} base={base} kind="c"/></div><div className="min-w-0 rounded-md border border-border p-3"><h4 className="font-semibold">Delivery quantity</h4><p className={note}>Kuantitas asli sumber · satuan belum terverifikasi</p><Trend values={selected.q} current={current} base={base} kind="q"/></div></div>
        <h4 className="mt-4 font-semibold">Benchmark antar-plant</h4><p className={note}>Kode {selected.code} dengan COGM positif, termasuk di luar filter plant. Verifikasi UoM dan price unit.</p><Rank rows={peers} value={dvalue} tone={d=>d.plant===selected.plant?blue:'#90a9b9'} label={d=><>Plant {d.plant} {d.plant===selected.plant?'· terpilih':''}<span className="block font-normal text-muted-foreground">{pct(delta(d,current,base))} vs {months[base]}</span></>} onSelect={choosePeer}/>
      </>:<Empty>Tidak ada kombinasi.</Empty>}</Panel>
      <Heading title="04 / Detail & data quality" sub="Telusuri, urutkan, dan ekspor data hasil filter"/>
      <Panel><h3 className="font-semibold">Register material–plant</h3><p className={note}>Status dihitung dari COGM positif di kedua periode.</p><div className="my-3 flex flex-wrap gap-4 text-xs text-muted-foreground"><span>COGM kosong: <b>{summary.missing}</b></span><span>COGM nol: <b>{summary.zero}</b></span><span>Qty nol: <b>{summary.zeroQty}</b></span><span>Pembanding tidak positif/kosong: <b>{summary.invalidBase}</b></span></div>
        <div className="mb-3 grid items-end gap-2 sm:grid-cols-[1fr_1fr_auto]"><Field label="Cari kode, deskripsi atau plant"><input className={inputStyle} value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Contoh: 7403 / FINE CLAY"/></Field><Field label="Status data"><select className={inputStyle} value={state} onChange={e=>{setState(e.target.value);setPage(0);}}>{[['all','Semua status'],['alert','Naik ≥ ambang'],['up','Naik di bawah ambang'],['down','Turun'],['flat','Tetap'],['quality','Tidak sebanding / kosong']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></Field><button className={buttonStyle} onClick={exportCsv}><Download size={15}/>Ekspor CSV hasil filter</button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] border-collapse text-xs"><thead className="bg-muted"><tr>{cols.map(([c,l],i)=><th key={c} scope="col" aria-sort={sort===c?(asc?'ascending':'descending'):'none'} className={'px-2 py-2 '+(i>=3&&i<=6?'text-right':'text-left')}><button className="font-semibold" type="button" onClick={()=>{setAsc(sort===c?!asc:['code','name','plant','state'].includes(c));setSort(c);setPage(0);}}>{l}{sort===c?(asc?' ↑':' ↓'):''}</button></th>)}</tr></thead><tbody>{table.slice(shownPage*PAGE,(shownPage+1)*PAGE).map(d=>{const v=delta(d,current,base),s=status(d,current,base,limit);return <tr key={key(d)} className={'border-b border-border hover:bg-muted/60 '+(selected&&key(selected)===key(d)?'bg-sky-50':'')}><td className="p-2"><button type="button" onClick={()=>choose(d)} className="font-medium hover:underline">{d.code}</button></td><td className="max-w-[260px] truncate p-2" title={d.name}>{d.name}</td><td className="p-2">{d.plant}</td><td className="p-2 text-right tabular-nums">{fmt(d.c[base],2)}</td><td className="p-2 text-right tabular-nums">{fmt(d.c[current],2)}</td><td className="p-2 text-right font-semibold tabular-nums" style={{color:color(v)}}>{pct(v)}</td><td className="p-2 text-right tabular-nums">{fmt(d.q[current],2)}</td><td className="p-2"><span className={'rounded px-2 py-1 text-[10px] font-medium '+(s==='alert'?'bg-red-100 text-red-800':s==='down'?'bg-teal-100 text-teal-800':s==='quality'?'bg-amber-100 text-amber-900':'bg-muted')}>{statusLabel(d,current,base,limit)}</span></td></tr>;})}{!table.length&&<tr><td colSpan={8}><Empty>Tidak ada data sesuai pencarian.</Empty></td></tr>}</tbody></table></div>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2"><span className={note}>{table.length?(shownPage*PAGE+1)+'–'+Math.min((shownPage+1)*PAGE,table.length)+' dari '+table.length:'0 kombinasi'}</span><button className={buttonStyle} disabled={shownPage===0} onClick={()=>setPage(shownPage-1)}>Sebelumnya</button><button className={buttonStyle} disabled={(shownPage+1)*PAGE>=table.length} onClick={()=>setPage(shownPage+1)}>Berikutnya</button></div>
      </Panel>
      <footer className={note+' border-t border-border pt-3'}><b>Metodologi & batas interpretasi.</b> Snapshot tahun 2026; {data.length} kombinasi unik. Deviasi = (COGM analisis / COGM pembanding − 1) × 100%, hanya untuk kedua COGM positif. Ambang analisis bukan target perusahaan. Bulan kosong berbeda dari nol. Nilai asli tanpa konversi satuan. Tidak menjumlahkan HPP/kuantitas lintas material atau mengestimasi dampak rupiah tanpa verifikasi UoM, price unit dan basis biaya. Penyebab perubahan perlu investigasi SAP. Belum terhubung ke database atau SAP.</footer>
    </>}
  </div>;
}
