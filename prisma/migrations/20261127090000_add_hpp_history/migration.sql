-- Additive only. Historical versions and source observations are retained.
CREATE TABLE "hpp_period_versions" (
  "id" SERIAL NOT NULL,
  "fiscalYear" INTEGER NOT NULL,
  "fiscalPeriod" INTEGER NOT NULL,
  "revision" INTEGER NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceName" TEXT,
  "sourceSha256" VARCHAR(64),
  "createdById" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "isCurrent" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "hpp_period_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hpp_period_versions_year_check" CHECK ("fiscalYear" BETWEEN 2000 AND 2100),
  CONSTRAINT "hpp_period_versions_period_check" CHECK ("fiscalPeriod" BETWEEN 1 AND 12),
  CONSTRAINT "hpp_period_versions_revision_check" CHECK ("revision" >= 1),
  CONSTRAINT "hpp_period_versions_current_check" CHECK (NOT "isCurrent" OR "publishedAt" IS NOT NULL),
  CONSTRAINT "hpp_period_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "hpp_period_versions_fiscalYear_fiscalPeriod_revision_key"
  ON "hpp_period_versions" ("fiscalYear", "fiscalPeriod", "revision");
-- Enforce exactly at most one current publication per month, including concurrent writers.
CREATE UNIQUE INDEX "hpp_period_versions_one_current"
  ON "hpp_period_versions" ("fiscalYear", "fiscalPeriod") WHERE "isCurrent";
CREATE INDEX "hpp_period_versions_isCurrent_fiscalYear_fiscalPeriod_idx"
  ON "hpp_period_versions" ("isCurrent", "fiscalYear", "fiscalPeriod");
CREATE INDEX "hpp_period_versions_createdById_idx" ON "hpp_period_versions" ("createdById");

CREATE TABLE "hpp_observations" (
  "id" SERIAL NOT NULL,
  "periodVersionId" INTEGER NOT NULL,
  "materialCode" TEXT NOT NULL,
  "materialName" TEXT NOT NULL,
  "plant" TEXT NOT NULL,
  "cogm" DECIMAL(38,12),
  "deliveryQty" DECIMAL(38,12),
  "currency" TEXT,
  "quantityUnit" TEXT,
  "priceUnit" DECIMAL(38,12),
  CONSTRAINT "hpp_observations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hpp_observations_periodVersionId_fkey" FOREIGN KEY ("periodVersionId") REFERENCES "hpp_period_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "hpp_observations_identity_check" CHECK (length(btrim("materialCode")) > 0 AND length(btrim("materialName")) > 0 AND length(btrim("plant")) > 0),
  CONSTRAINT "hpp_observations_price_unit_check" CHECK ("priceUnit" IS NULL OR "priceUnit" > 0)
);
CREATE UNIQUE INDEX "hpp_observations_periodVersionId_materialCode_plant_key"
  ON "hpp_observations" ("periodVersionId", "materialCode", "plant");
CREATE INDEX "hpp_observations_materialCode_plant_idx" ON "hpp_observations" ("materialCode", "plant");

-- Same server-only RLS pattern as the existing cost cycle module.
ALTER TABLE "hpp_period_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hpp_observations" ENABLE ROW LEVEL SECURITY;
