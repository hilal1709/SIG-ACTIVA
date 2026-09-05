export interface WorkbookStorage {
  createSignedUpload(objectKey: string): Promise<{ signedUrl: string; token: string }>;
  download(objectKey: string): Promise<Uint8Array>;
  remove(objectKey: string): Promise<void>;
  exists(objectKey: string): Promise<boolean>;
}
