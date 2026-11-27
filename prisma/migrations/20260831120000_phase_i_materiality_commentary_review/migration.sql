-- Phase I: additive materiality, commentary, history, and analytical review workflow.
CREATE TYPE "CostFluctuationComparisonType" AS ENUM ('MOM', 'YOY', 'YTD');
CREATE TYPE "CostMaterialityOperator" AS ENUM ('AND', 'OR');
CREATE TYPE "CostCommentaryAnalysisLevel" AS ENUM ('COST_GROUP', 'NATURE', 'COA', 'CALCULATED_ITEM');
CREATE TYPE "CostCommentaryStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'REVIEWED');
CREATE TYPE "CostPeriodReviewStatus" AS ENUM ('OPEN', 'COMPLETED');

CREATE TABLE "cost_materiality_rules" (
 "id" SERIAL PRIMARY KEY, "companyId" INTEGER NOT NULL, "costGroupId" INTEGER,
 "comparisonType" "CostFluctuationComparisonType" NOT NULL,
 "amountThreshold" NUMERIC(20,2), "percentThreshold" NUMERIC(20,6),
 "operator" "CostMaterialityOperator" NOT NULL, "validFrom" TIMESTAMP(3) NOT NULL,
 "validTo" TIMESTAMP(3), "active" BOOLEAN NOT NULL DEFAULT true, "createdById" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "cost_materiality_rules_threshold_check" CHECK ("amountThreshold" IS NOT NULL OR "percentThreshold" IS NOT NULL),
 CONSTRAINT "cost_materiality_rules_nonnegative_check" CHECK (("amountThreshold" IS NULL OR "amountThreshold" >= 0) AND ("percentThreshold" IS NULL OR "percentThreshold" >= 0)),
 CONSTRAINT "cost_materiality_rules_interval_check" CHECK ("validTo" IS NULL OR "validTo" >= "validFrom")
);
CREATE INDEX "cost_materiality_rules_companyId_comparisonType_active_valid_idx" ON "cost_materiality_rules"("companyId","comparisonType","active","validFrom","validTo");
CREATE INDEX "cost_materiality_rules_costGroupId_idx" ON "cost_materiality_rules"("costGroupId");

CREATE TABLE "cost_commentaries" (
 "id" SERIAL PRIMARY KEY, "periodId" INTEGER NOT NULL, "comparisonType" "CostFluctuationComparisonType" NOT NULL,
 "analysisLevel" "CostCommentaryAnalysisLevel" NOT NULL, "analysisKey" TEXT NOT NULL, "costGroupId" INTEGER NOT NULL,
 "natureId" INTEGER, "coaId" INTEGER, "calculatedItemKey" TEXT, "analysisLineageKey" TEXT NOT NULL,
 "reason" TEXT NOT NULL, "status" "CostCommentaryStatus" NOT NULL, "preparedById" INTEGER, "preparedAt" TIMESTAMP(3),
 "submittedAt" TIMESTAMP(3), "reviewedById" INTEGER, "reviewedAt" TIMESTAMP(3), "reviewerNote" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "cost_commentaries_target_check" CHECK (
   ("analysisLevel" = 'COST_GROUP' AND "natureId" IS NULL AND "coaId" IS NULL AND "calculatedItemKey" IS NULL) OR
   ("analysisLevel" = 'NATURE' AND "natureId" IS NOT NULL AND "coaId" IS NULL AND "calculatedItemKey" IS NULL) OR
   ("analysisLevel" = 'COA' AND "natureId" IS NOT NULL AND "coaId" IS NOT NULL AND "calculatedItemKey" IS NULL) OR
   ("analysisLevel" = 'CALCULATED_ITEM' AND "natureId" IS NOT NULL AND "coaId" IS NULL AND "calculatedItemKey" IS NOT NULL)
 )
);
CREATE UNIQUE INDEX "cost_commentaries_business_identity_key" ON "cost_commentaries"("periodId","comparisonType","analysisKey","analysisLineageKey");
CREATE INDEX "cost_commentaries_period_comparison_lineage_idx" ON "cost_commentaries"("periodId","comparisonType","analysisLineageKey");
CREATE INDEX "cost_commentaries_costGroupId_idx" ON "cost_commentaries"("costGroupId"); CREATE INDEX "cost_commentaries_natureId_idx" ON "cost_commentaries"("natureId"); CREATE INDEX "cost_commentaries_coaId_idx" ON "cost_commentaries"("coaId");

CREATE TABLE "cost_commentary_history" (
 "id" SERIAL PRIMARY KEY, "commentaryId" INTEGER NOT NULL, "version" INTEGER NOT NULL, "reason" TEXT NOT NULL,
 "status" "CostCommentaryStatus" NOT NULL, "reviewerNote" TEXT, "changedById" INTEGER NOT NULL,
 "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "cost_commentary_history_commentaryId_version_key" ON "cost_commentary_history"("commentaryId","version");
CREATE INDEX "cost_commentary_history_changedById_idx" ON "cost_commentary_history"("changedById");

CREATE TABLE "cost_period_reviews" (
 "id" SERIAL PRIMARY KEY, "periodId" INTEGER NOT NULL, "reviewStatus" "CostPeriodReviewStatus" NOT NULL DEFAULT 'OPEN',
 "reviewedById" INTEGER, "reviewedAt" TIMESTAMP(3), "note" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "cost_period_reviews_periodId_key" ON "cost_period_reviews"("periodId"); CREATE INDEX "cost_period_reviews_reviewStatus_idx" ON "cost_period_reviews"("reviewStatus");

ALTER TABLE "cost_materiality_rules" ADD CONSTRAINT "cost_materiality_rules_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "cost_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_materiality_rules" ADD CONSTRAINT "cost_materiality_rules_costGroupId_fkey" FOREIGN KEY ("costGroupId") REFERENCES "cost_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_materiality_rules" ADD CONSTRAINT "cost_materiality_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_commentaries" ADD CONSTRAINT "cost_commentaries_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "cost_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_commentaries" ADD CONSTRAINT "cost_commentaries_costGroupId_fkey" FOREIGN KEY ("costGroupId") REFERENCES "cost_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_commentaries" ADD CONSTRAINT "cost_commentaries_natureId_fkey" FOREIGN KEY ("natureId") REFERENCES "cost_natures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_commentaries" ADD CONSTRAINT "cost_commentaries_coaId_fkey" FOREIGN KEY ("coaId") REFERENCES "cost_coas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_commentaries" ADD CONSTRAINT "cost_commentaries_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cost_commentaries" ADD CONSTRAINT "cost_commentaries_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cost_commentary_history" ADD CONSTRAINT "cost_commentary_history_commentaryId_fkey" FOREIGN KEY ("commentaryId") REFERENCES "cost_commentaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_commentary_history" ADD CONSTRAINT "cost_commentary_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_period_reviews" ADD CONSTRAINT "cost_period_reviews_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "cost_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_period_reviews" ADD CONSTRAINT "cost_period_reviews_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
