import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSupabaseStorageSignedUrl } from './signed-url';

describe('resolveSupabaseStorageSignedUrl', () => {
  it('preserves the /storage/v1 prefix for the relative path returned by Storage', () => {
    const value = resolveSupabaseStorageSignedUrl(
      'https://example.supabase.co/storage/v1',
      '/object/upload/sign/private/path.xlsx?token=abc',
    );
    assert.equal(
      value,
      'https://example.supabase.co/storage/v1/object/upload/sign/private/path.xlsx?token=abc',
    );
  });

  it('accepts an already absolute signed URL', () => {
    const value = resolveSupabaseStorageSignedUrl(
      'https://example.supabase.co/storage/v1',
      'https://example.supabase.co/storage/v1/object/upload/sign/private/path.xlsx?token=abc',
    );
    assert.equal(
      value,
      'https://example.supabase.co/storage/v1/object/upload/sign/private/path.xlsx?token=abc',
    );
  });

  it('rejects an empty Storage response', () => {
    assert.throws(
      () => resolveSupabaseStorageSignedUrl('https://example.supabase.co/storage/v1', ''),
      /did not return a signed upload URL/,
    );
  });
});
