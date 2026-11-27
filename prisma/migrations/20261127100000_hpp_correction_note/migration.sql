-- Add audit explanation without modifying previous source observations.
ALTER TABLE "hpp_period_versions" ADD COLUMN "correctionNote" TEXT;
