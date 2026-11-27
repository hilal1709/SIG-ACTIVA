// Pure contract validation: no SAP assumptions, no unit conversion.
export type ScopeRow={code:string;name:string;plant:string};
export type AgentRow=ScopeRow&{cogm:string|null;deliveryQty:string|null};
export type AgentResult={year:number;period:number;mode:'SYNTHETIC'|'SAP_SCRIPT';rows:AgentRow[]};
export const AGENT_MAX_ROWS=1000;
export const AGENT_LEASE_MS=30*60*1000;
export const AGENT_ERRORS=['SCRIPT_FAILED','SCRIPT_TIMEOUT','INVALID_OUTPUT','SAP_UNAVAILABLE','LOCAL_ERROR'] as const;
function object(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Invalid object');return v as Record<string,unknown>;}
function str(v:unknown,max:number){if(typeof v!=='string'||!v.trim()||v!==v.trim()||v.length>max||/[\u0000-\u001f\u007f]/.test(v))throw Error('Invalid text');return v;}
function dec(v:unknown):string|null{
 if(v===null)return null;
 if(typeof v!=='string'||! /^-?\d{1,26}(\.\d{1,12})?$/.test(v))throw Error('Invalid decimal string');
 const [whole,fraction='']=v.replace(/^-/,'').split('.');
 const a=whole.replace(/^0+(?=\d)/,''),b=fraction.replace(/0+$/,'');
 return (v.startsWith('-')&&(a!=='0'||b)?'-':'')+a+(b?'.'+b:'');
}
export function validatePeriod(y:unknown,p:unknown):{year:number;period:number}{
 if(typeof y!=='number'||!Number.isInteger(y)||y<2000||y>2100||typeof p!=='number'||!Number.isInteger(p)||p<1||p>12)throw Error('Invalid period');
 return {year:y,period:p};
}
export const scopeKey=(r:ScopeRow)=>JSON.stringify([r.code,r.plant]);
export function validateScope(v:unknown):ScopeRow[]{
 if(!Array.isArray(v)||!v.length||v.length>AGENT_MAX_ROWS)throw Error('Invalid scope size');
 const seen=new Set<string>();
 return v.map(x=>{const o=object(x);const r={code:str(o.code,80),name:str(o.name,240),plant:str(o.plant,40)};const k=scopeKey(r);if(seen.has(k))throw Error('Duplicate scope');seen.add(k);return r;}).sort((a,b)=>scopeKey(a)<scopeKey(b)?-1:scopeKey(a)>scopeKey(b)?1:0);
}
export function validateAgentResult(v:unknown,year:number,period:number,expected:ScopeRow[]):AgentResult{
 const o=object(v);
 validatePeriod(o.year,o.period);
 if(o.year!==year||o.period!==period)throw Error('Wrong period');
 if(o.mode!=='SYNTHETIC'&&o.mode!=='SAP_SCRIPT')throw Error('Invalid source mode');
 if(!Array.isArray(o.rows)||o.rows.length!==expected.length)throw Error('Incomplete scope');
 const scope=validateScope(expected),rows=validateScope(o.rows);
 const raw=new Map(o.rows.map(x=>{const a=object(x);return [scopeKey({code:String(a.code),plant:String(a.plant),name:String(a.name)}),a];}));
 const normalized=rows.map((r,i)=>{
  if(scopeKey(r)!==scopeKey(scope[i])||r.name!==scope[i].name)throw Error('Scope mismatch');
  const x=raw.get(scopeKey(r))!;
  return {...r,cogm:dec(x.cogm),deliveryQty:dec(x.deliveryQty)};
 });
 if(!normalized.some(r=>r.cogm!==null||r.deliveryQty!==null))throw Error('Empty result');
 return {year,period,mode:o.mode,rows:normalized};
}
export function canPublishSource(mode:string|null){return mode==='SAP_SCRIPT';}
export function leaseValid(status:string,until:Date|null,now:Date){return status==='RUNNING'&&until!==null&&until.getTime()>now.getTime();}
