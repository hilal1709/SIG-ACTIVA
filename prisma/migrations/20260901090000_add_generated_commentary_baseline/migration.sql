-- Additive audit fields for the immutable machine-generated analytical baseline.
ALTER TABLE "cost_commentaries"
  ADD COLUMN "generatedText" TEXT,
  ADD COLUMN "generationMetadataJson" JSONB,
  ADD COLUMN "generatedAt" TIMESTAMP(3);
