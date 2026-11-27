export type MappingSnapshotRecord = { mappingId: number; companyId: number; sourceLogicalCode: string; coaId: number; mappingAction: string; costGroupId: number | null; natureId: number | null; validFrom: Date; validTo: Date | null; updatedAt: Date };

export function buildMappingSnapshot(records: MappingSnapshotRecord[]) {
  return records.map((record) => ({ ...record, validFrom: record.validFrom.toISOString(), validTo: record.validTo?.toISOString() ?? null, updatedAt: record.updatedAt.toISOString() }))
    .sort((a, b) => a.sourceLogicalCode.localeCompare(b.sourceLogicalCode) || a.coaId - b.coaId || a.mappingId - b.mappingId);
}

