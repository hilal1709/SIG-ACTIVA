-- Phase D additive DDL. Apply separately through controlled Supabase migration tooling.
ALTER TABLE "cost_coa_mappings"
  ADD COLUMN "sourceLogicalCode" TEXT;

-- Production currently has no mapping rows. NOT NULL deliberately follows the
-- additive column creation so deployment remains explicit and reviewable.
ALTER TABLE "cost_coa_mappings"
  ALTER COLUMN "sourceLogicalCode" SET NOT NULL,
  ALTER COLUMN "costGroupId" DROP NOT NULL,
  ALTER COLUMN "natureId" DROP NOT NULL;

CREATE INDEX "cost_coa_mappings_companyId_sourceLogicalCode_coaId_valid_idx"
  ON "cost_coa_mappings"("companyId", "sourceLogicalCode", "coaId", "validFrom", "validTo");
