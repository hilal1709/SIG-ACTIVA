export const MAX_IMPORT_ROWS = 1000;
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
export const IMPORT_MONTHS = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
export type ImportRow = { code:string; name:string; plant:string; c:(string|null)[]; q:(string|null)[] };
export type ImportWorkbook = { year:number; rows:ImportRow[] };
export type ImportObservation = { materialCode:string; materialName:string; plant:string; cogm:string|null; deliveryQty:string|null };
export type ExistingObservation = ImportObservation & { currency?:string|null; quantityUnit?:string|null; priceUnit?:string|null };
export type PeriodPlan = { period:number; currentId:number|null; revision:number|null; count:number; filled:number; blank:number; changed:number; added:number; missing:number; cleared:number; protectedMetadata:number; action:'new'|'unchanged'|'correction'|'blocked'|'empty' };
const identity = (code:string,plant:string)=>JSON.stringify([code,plant]);
export function decimal(value:unknown):string|null {
  if(value===null||value===undefined||value==='')return null;
  if(typeof value!=='string'&&typeof value!=='number')throw new Error('Nilai harus numerik atau kosong');
  if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Nilai numerik tidak valid');
  const raw=String(value);
  if(!/^-?\d{1,26}(\.\d{1,12})?$/.test(raw))throw new Error('Format/presisi angka di luar DECIMAL(38,12)');
  const [whole,fraction='']=raw.replace(/^-/,'').split('.');
  const a=whole.replace(/^0+(?=\d)/,'');
  const b=fraction.replace(/0+$/,'');
  return (raw.startsWith('-')&&(a!=='0'||b)?'-':'')+a+(b?'.'+b:'');
}
function text(value:unknown,max:number,field:string):string {
  if(typeof value!=='string'&&!(typeof value==='number'&&Number.isSafeInteger(value)&&value>=0))throw new Error(field+' tidak valid');
  const s=String(value).trim();
  if(!s||s.length>max||/[\u0000-\u001f\u007f]/.test(s))throw new Error(field+' tidak valid');
  return s;
}
export function validateImport(value:unknown):ImportWorkbook {
  if(!value||typeof value!=='object')throw new Error('Data import tidak valid');
  const v=value as Record<string,unknown>;
  if(typeof v.year!=='number'||!Number.isInteger(v.year)||v.year<2000||v.year>2100)throw new Error('Tahun harus 2000–2100');
  if(!Array.isArray(v.rows)||v.rows.length===0||v.rows.length>MAX_IMPORT_ROWS)throw new Error('Jumlah baris harus 1–'+MAX_IMPORT_ROWS);
  const seen=new Set<string>();
  const rows=v.rows.map((raw:unknown,i:number):ImportRow=>{
    try{
      if(!raw||typeof raw!=='object')throw new Error('Baris tidak valid');
      const r=raw as Record<string,unknown>;
      const code=text(r.code,80,'Material'),name=text(r.name,240,'Deskripsi'),plant=text(r.plant,40,'Plant');
      if(!Array.isArray(r.c)||r.c.length!==12||!Array.isArray(r.q)||r.q.length!==12)throw new Error('Harus ada 12 pasangan bulan');
      const k=identity(code,plant);if(seen.has(k))throw new Error('Duplikasi material–plant '+code+' / '+plant);seen.add(k);
      return {code,name,plant,c:r.c.map(decimal),q:r.q.map(decimal)};
    }catch(e){throw new Error('Baris '+(i+3)+': '+(e instanceof Error?e.message:'tidak valid'));}
  });
  rows.sort((a,b)=>a.code<b.code?-1:a.code>b.code?1:a.plant<b.plant?-1:a.plant>b.plant?1:0);
  return {year:v.year,rows};
}
export function parseImportGrid(grid:unknown[][]):ImportWorkbook {
  const h1=grid[0]??[],h2=grid[1]??[];
  if(h1[0]!=='Tahun laporan'||h2[0]!=='Material'||h2[1]!=='Material Description'||h2[2]!=='Plant')throw new Error('Header Lembar1 tidak sesuai template Dashboard HPP');
  for(let i=0;i<12;i++){
    const j=3+i*2;
    if(h1[j]!==IMPORT_MONTHS[i]||h2[j]!=='Deliv Qty'||h2[j+1]!=='COGM')throw new Error('Header bulan '+IMPORT_MONTHS[i]+' tidak sesuai');
  }
  const rows=grid.slice(2).filter(r=>r.some(v=>v!==null&&v!==undefined&&v!=='')).map(r=>({code:r[0],name:r[1],plant:r[2],q:IMPORT_MONTHS.map((_,i)=>r[3+i*2]??null),c:IMPORT_MONTHS.map((_,i)=>r[4+i*2]??null)}));
  const y=h1[1];
  if(typeof y!=='number'&&!(typeof y==='string'&&/^\d{4}$/.test(y)))throw new Error('Tahun laporan B1 tidak valid');
  return validateImport({year:Number(y),rows});
}
export function monthRows(workbook:ImportWorkbook,period:number):ImportObservation[]{
  return workbook.rows.map(r=>({materialCode:r.code,materialName:r.name,plant:r.plant,cogm:r.c[period-1],deliveryQty:r.q[period-1]}));
}
export function planPeriod(period:number,next:ImportObservation[],previous:ExistingObservation[],currentId:number|null,revision:number|null):PeriodPlan{
  const before=new Map(previous.map(r=>[identity(r.materialCode,r.plant),r]));
  const keys=new Set(next.map(r=>identity(r.materialCode,r.plant)));
  let changed=0,added=0,cleared=0,protectedMetadata=0;
  const filled=next.filter(r=>r.cogm!==null||r.deliveryQty!==null).length;
  for(const r of next){
    const old=before.get(identity(r.materialCode,r.plant));
    if(!old){added++;continue;}
    if(old.materialName!==r.materialName||old.cogm!==r.cogm||old.deliveryQty!==r.deliveryQty)changed++;
    if((old.cogm!==null&&r.cogm===null)||(old.deliveryQty!==null&&r.deliveryQty===null))cleared++;
    if(old.currency!=null||old.quantityUnit!=null||old.priceUnit!=null)protectedMetadata++;
  }
  const missing=previous.filter(r=>!keys.has(identity(r.materialCode,r.plant))).length;
  const action:PeriodPlan['action']=!filled?'empty':missing||protectedMetadata?'blocked':currentId===null?'new':changed||added?'correction':'unchanged';
  return {period,currentId,revision,count:next.length,filled,blank:next.length-filled,changed,added,missing,cleared,protectedMetadata,action};
}
export function validateSelection(value:unknown):{period:number;currentId:number|null}[]{
  if(!Array.isArray(value)||!value.length||value.length>12)throw new Error('Pilih periode yang akan dipublikasikan');
  const seen=new Set<number>();
  return value.map(v=>{
    if(!v||typeof v!=='object'||!Number.isInteger(v.period)||v.period<1||v.period>12||seen.has(v.period)||!(v.currentId===null||(Number.isSafeInteger(v.currentId)&&v.currentId>0)))throw new Error('Pilihan periode tidak valid');
    seen.add(v.period);return {period:v.period,currentId:v.currentId};
  }).sort((a,b)=>a.period-b.period);
}
