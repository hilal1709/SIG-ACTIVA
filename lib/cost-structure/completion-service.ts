import { createHash } from 'crypto';
import type { ParsedWorkbook } from './parsers';

export class DuplicateUploadError extends Error {
  constructor(public readonly existingUpload: unknown) { super('Workbook yang sama sudah pernah diunggah untuk periode ini.'); }
}

export type CompletionCandidate = {
  periodId: number; objectKey: string; expectedSize: number; companyCode: string;
};

export type CompletionDependencies<T> = {
  download(key:string):Promise<Uint8Array>;
  remove(key:string):Promise<void>;
  findDuplicate(periodId:number,hash:string):Promise<unknown|null>;
  parse(bytes:Uint8Array,companyCode:string):Promise<ParsedWorkbook>;
  persistAtomically(input:{hash:string;bytes:Uint8Array;parsed:ParsedWorkbook}):Promise<T>;
};

/** Orchestrates completion without trusting client metadata. Atomic activation is a repository invariant. */
export async function completeStoredUpload<T>(candidate:CompletionCandidate,deps:CompletionDependencies<T>) {
  let shouldCleanup=true,hash:string|undefined;
  try {
    const bytes=await deps.download(candidate.objectKey);
    if(bytes.byteLength!==candidate.expectedSize) throw new Error('Ukuran file tersimpan tidak sesuai deklarasi.');
    hash=createHash('sha256').update(bytes).digest('hex');
    const duplicate=await deps.findDuplicate(candidate.periodId,hash);
    if(duplicate) { if((duplicate as {storageKey?:string}).storageKey===candidate.objectKey)shouldCleanup=false; throw new DuplicateUploadError(duplicate); }
    const parsed=await deps.parse(bytes,candidate.companyCode);
    const result=await deps.persistAtomically({hash,bytes,parsed});
    shouldCleanup=false;
    return {result,hash,parsed};
  } finally {
    if(shouldCleanup&&hash) { const winner=await deps.findDuplicate(candidate.periodId,hash).catch(()=>null); if((winner as {storageKey?:string}|null)?.storageKey===candidate.objectKey)shouldCleanup=false; }
    if(shouldCleanup) await deps.remove(candidate.objectKey).catch(()=>undefined);
  }
}
