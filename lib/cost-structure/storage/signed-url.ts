export function resolveSupabaseStorageSignedUrl(storageApiUrl: string, returnedUrl: string) {
  const base = storageApiUrl.replace(/\/$/, '');
  const value = returnedUrl.trim();
  if (!value) throw new Error('Supabase Storage did not return a signed upload URL');
  if (/^https?:\/\//i.test(value)) return new URL(value).toString();
  return new URL(`${base}${value.startsWith('/') ? '' : '/'}${value}`).toString();
}
