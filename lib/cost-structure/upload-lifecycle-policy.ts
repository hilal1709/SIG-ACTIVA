export const ARCHIVED_UPLOAD_STATUS = 'ARCHIVED';
export const UPLOAD_LINEAGE_MAPPING_ACTIONS = [
  'AUTO_FAMILY_COA_MAPPING',
  'AUTO_FAMILY_PREDECESSOR_MAPPING',
  'BACKFILL_AUTHORITATIVE_BASELINE_MAPPING',
  'BACKFILL_HISTORICAL_ANALYTICAL_CC_PROD_MAPPING',
  'BACKFILL_HISTORICAL_COA_MAPPING',
  'BOOTSTRAP_MAPPING',
  'RESOLVE_MAPPING',
] as const;

export type UploadLifecycleInput = {
  periodStatus: string;
  uploadStatus: string;
  isActiveVersion: boolean;
  periodCalculationRunCount: number;
  periodMappingMutationCount: number;
  uploadAdjustmentCount: number;
};

export type UploadLifecyclePolicy = {
  canDelete: boolean;
  deleteReason: string | null;
  canArchive: boolean;
  archiveReason: string | null;
};

/**
 * Upload lifecycle is intentionally stricter than row-level cascade rules.
 * Hard delete is only a pre-processing cleanup operation. Once a period has created
 * reusable mapping mutations or calculation lineage, the workbook must remain part of
 * the audit trail and may only be archived after it has been superseded.
 */
export function evaluateUploadLifecycle(input: UploadLifecycleInput): UploadLifecyclePolicy {
  const finalized = input.periodStatus === 'FINALIZED';

  let deleteReason: string | null = null;
  if (finalized) deleteReason = 'Periode FINALIZED tidak dapat menghapus upload.';
  else if (input.periodCalculationRunCount > 0) deleteReason = 'Periode sudah memiliki histori calculation; hard delete dinonaktifkan untuk menjaga lineage.';
  else if (input.periodMappingMutationCount > 0) deleteReason = 'Periode sudah menghasilkan mapping reusable; hard delete dinonaktifkan untuk menjaga audit lineage.';
  else if (input.uploadAdjustmentCount > 0) deleteReason = 'Upload memiliki adjustment yang masih mereferensikan sumber ini.';

  let archiveReason: string | null = null;
  if (finalized) archiveReason = 'Periode FINALIZED tidak dapat mengarsipkan upload.';
  else if (input.uploadStatus === ARCHIVED_UPLOAD_STATUS) archiveReason = 'Upload sudah diarsipkan.';
  else if (input.isActiveVersion) archiveReason = 'Upload aktif harus disupersede oleh versi koreksi terlebih dahulu sebelum diarsipkan.';

  return {
    canDelete: deleteReason === null,
    deleteReason,
    canArchive: archiveReason === null,
    archiveReason,
  };
}
