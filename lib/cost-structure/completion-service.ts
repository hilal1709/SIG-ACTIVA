import { createHash } from 'crypto';
import type { ParsedWorkbook } from './parsers';

export class DuplicateUploadError extends Error {
  constructor(public readonly existingUpload: unknown) { super('Workbook yang sama sudah pernah diunggah untuk periode ini.'); }
}

export type UploadCompletionStage = 'DOWNLOAD' | 'SIZE_VERIFY' | 'PARSE' | 'PERSIST';

export class UploadCompletionStageError extends Error {
  constructor(public readonly stage: UploadCompletionStage, message: string, public readonly causeError?: unknown) {
    super(message);
    this.name = 'UploadCompletionStageError';
  }
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
    let bytes: Uint8Array;
    try {
      bytes=await deps.download(candidate.objectKey);
    } catch (error) {
      throw new UploadCompletionStageError('DOWNLOAD','File berhasil dikirim, tetapi server tidak dapat membaca kembali object Storage.',error);
    }

    if(bytes.byteLength!==candidate.expectedSize) {
      throw new UploadCompletionStageError('SIZE_VERIFY',`Ukuran file tersimpan (${bytes.byteLength} byte) berbeda dari file yang dipilih (${candidate.expectedSize} byte).`);
    }

    hash=createHash('sha256').update(bytes).digest('hex');
    const duplicate=await deps.findDuplicate(candidate.periodId,hash);
    if(duplicate) { if((duplicate as {storageKey?:string}).storageKey===candidate.objectKey)shouldCleanup=false; throw new DuplicateUploadError(duplicate); }

    let parsed: ParsedWorkbook;
    try {
      parsed=await deps.parse(bytes,candidate.companyCode);
    } catch (error) {
      throw new UploadCompletionStageError('PARSE','File tersimpan dengan benar, tetapi workbook tidak dapat dibaca oleh parser.',error);
    }

    let result: T;
    try {
      result=await deps.persistAtomically({hash,bytes,parsed});
    } catch (error) {
      throw new UploadCompletionStageError('PERSIST','Workbook berhasil dibaca, tetapi hasil normalisasi gagal disimpan ke database.',error);
    }

    shouldCleanup=false;
    return {result,hash,parsed};
  } finally {
    if(shouldCleanup&&hash) { const winner=await deps.findDuplicate(candidate.periodId,hash).catch(()=>null); if((winner as {storageKey?:string}|null)?.storageKey===candidate.objectKey)shouldCleanup=false; }
    if(shouldCleanup) await deps.remove(candidate.objectKey).catch(()=>undefined);
  }
}
