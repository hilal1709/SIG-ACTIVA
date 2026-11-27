-- CreateEnum
CREATE TYPE "CostNatureCalculationType" AS ENUM ('MAPPED', 'FORMULA', 'RESIDUAL');
CREATE TYPE "CostMappingAction" AS ENUM ('INCLUDE', 'EXCLUDE', 'RECLASS');
CREATE TYPE "CostPeriodStatus" AS ENUM ('NOT_STARTED', 'UPLOADED', 'SOURCE_VALIDATION', 'SOURCE_RECONCILED', 'CALCULATED', 'COST_STRUCTURE_RECONCILED', 'FINALIZED');
CREATE TYPE "CostValidationSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');
CREATE TYPE "CostCalculationRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');
CREATE TYPE "CostActualLineType" AS ENUM ('COA', 'FORMULA', 'RESIDUAL', 'ADJUSTMENT');
CREATE TYPE "CostCalculationResultType" AS ENUM ('TOTAL', 'NATURE', 'CONTROL');

-- CreateTable
CREATE TABLE "cost_companies" (
  "id" SERIAL NOT NULL, "companyCode" TEXT NOT NULL, "companyName" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "cost_companies_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "cost_groups" (
  "id" SERIAL NOT NULL, "companyId" INTEGER NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cost_groups_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "cost_natures" (
  "id" SERIAL NOT NULL, "costGroupId" INTEGER NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL,
  "calculationType" "CostNatureCalculationType" NOT NULL, "ruleCode" TEXT, "displayOrder" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "cost_natures_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "cost_coas" (
  "id" SERIAL NOT NULL, "coaCode" TEXT NOT NULL, "coaDescription" TEXT NOT NULL, "accountGroup" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "cost_coas_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "cost_coa_mappings" (
  "id" SERIAL NOT NULL, "companyId" INTEGER NOT NULL, "costGroupId" INTEGER NOT NULL, "natureId" INTEGER NOT NULL,
  "coaId" INTEGER NOT NULL, "mappingAction" "CostMappingAction" NOT NULL, "validFrom" TIMESTAMP(3) NOT NULL,
  "validTo" TIMESTAMP(3), "note" TEXT, "active" BOOLEAN NOT NULL DEFAULT true, "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cost_coa_mappings_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "cost_periods" (
  "id" SERIAL NOT NULL, "companyId" INTEGER NOT NULL, "fiscalYear" INTEGER NOT NULL, "fiscalPeriod" INTEGER NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL, "periodEnd" TIMESTAMP(3) NOT NULL,
  "status" "CostPeriodStatus" NOT NULL DEFAULT 'NOT_STARTED', "activeCalculationRunId" INTEGER,
  "finalizedAt" TIMESTAMP(3), "finalizedById" INTEGER, "reopenedAt" TIMESTAMP(3), "reopenedById" INTEGER,
  "reopenReason" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cost_periods_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "cost_uploads" (
  "id" SERIAL NOT NULL, "periodId" INTEGER NOT NULL, "version" INTEGER NOT NULL, "originalFileName" TEXT NOT NULL,
  "fileHashSha256" TEXT NOT NULL, "fileSizeBytes" BIGINT NOT NULL, "storageProvider" TEXT NOT NULL, "storageKey" TEXT NOT NULL,
  "uploadNote" TEXT, "status" TEXT NOT NULL DEFAULT 'UPLOADED', "isActiveVersion" BOOLEAN NOT NULL DEFAULT true,
  "uploadedById" INTEGER NOT NULL, "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validatedAt" TIMESTAMP(3), "supersededAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "cost_uploads_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "cost_source_rows" (
  "id" SERIAL NOT NULL, "uploadId" INTEGER NOT NULL, "logicalSourceCode" TEXT NOT NULL, "originalSheetName" TEXT NOT NULL,
  "sourceRowNumber" INTEGER NOT NULL, "coaCodeRaw" TEXT, "coaId" INTEGER, "descriptionRaw" TEXT, "amountRaw" TEXT,
  "amount" DECIMAL(20,2), "sourceGroupRaw" TEXT, "rawDataJson" JSONB, "mappingStatus" TEXT NOT NULL DEFAULT 'UNMAPPED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cost_source_rows_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "cost_validation_issues" (
  "id" SERIAL NOT NULL, "uploadId" INTEGER NOT NULL, "sourceRowId" INTEGER, "issueCode" TEXT NOT NULL,
  "severity" "CostValidationSeverity" NOT NULL, "message" TEXT NOT NULL, "resolved" BOOLEAN NOT NULL DEFAULT false,
  "resolutionType" TEXT, "resolutionNote" TEXT, "resolvedById" INTEGER, "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cost_validation_issues_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "cost_adjustments" (
  "id" SERIAL NOT NULL, "periodId" INTEGER NOT NULL, "uploadId" INTEGER, "costGroupId" INTEGER NOT NULL,
  "natureId" INTEGER NOT NULL, "coaId" INTEGER, "amount" DECIMAL(20,2) NOT NULL, "reason" TEXT NOT NULL,
  "reference" TEXT, "createdById" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "cost_adjustments_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "cost_calculation_runs" (
  "id" SERIAL NOT NULL, "periodId" INTEGER NOT NULL, "runNumber" INTEGER NOT NULL, "uploadId" INTEGER NOT NULL,
  "status" "CostCalculationRunStatus" NOT NULL, "ruleSetVersion" TEXT NOT NULL, "sourceSnapshotJson" JSONB NOT NULL,
  "mappingSnapshotJson" JSONB, "startedById" INTEGER NOT NULL, "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3), "isActive" BOOLEAN NOT NULL DEFAULT false, "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "cost_calculation_runs_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "cost_actual_lines" (
  "id" SERIAL NOT NULL, "calculationRunId" INTEGER NOT NULL, "periodId" INTEGER NOT NULL, "costGroupId" INTEGER NOT NULL,
  "natureId" INTEGER NOT NULL, "coaId" INTEGER, "lineType" "CostActualLineType" NOT NULL,
  "sourceAmount" DECIMAL(20,2), "adjustmentAmount" DECIMAL(20,2) NOT NULL DEFAULT 0,
  "finalAmount" DECIMAL(20,2) NOT NULL, "ruleCode" TEXT, "sourceRowId" INTEGER, "sourceReferenceJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "cost_actual_lines_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "cost_calculation_results" (
  "id" SERIAL NOT NULL, "calculationRunId" INTEGER NOT NULL, "periodId" INTEGER NOT NULL, "costGroupId" INTEGER,
  "natureId" INTEGER, "resultCode" TEXT NOT NULL, "resultType" "CostCalculationResultType" NOT NULL,
  "amount" DECIMAL(20,2) NOT NULL, "ruleCode" TEXT, "reconciliationDifference" DECIMAL(20,2),
  "reconciliationStatus" TEXT, "calculationDetailJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "cost_calculation_results_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "cost_audit_logs" (
  "id" SERIAL NOT NULL, "userId" INTEGER NOT NULL, "periodId" INTEGER, "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL, "entityId" TEXT, "oldValueJson" JSONB, "newValueJson" JSONB, "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "cost_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cost_companies_companyCode_key" ON "cost_companies"("companyCode");
CREATE UNIQUE INDEX "cost_groups_companyId_code_key" ON "cost_groups"("companyId", "code");
CREATE INDEX "cost_groups_companyId_idx" ON "cost_groups"("companyId"); CREATE INDEX "cost_groups_companyId_displayOrder_idx" ON "cost_groups"("companyId", "displayOrder");
CREATE UNIQUE INDEX "cost_natures_costGroupId_code_key" ON "cost_natures"("costGroupId", "code");
CREATE INDEX "cost_natures_costGroupId_idx" ON "cost_natures"("costGroupId"); CREATE INDEX "cost_natures_costGroupId_displayOrder_idx" ON "cost_natures"("costGroupId", "displayOrder");
CREATE UNIQUE INDEX "cost_coas_coaCode_key" ON "cost_coas"("coaCode"); CREATE INDEX "cost_coas_accountGroup_idx" ON "cost_coas"("accountGroup");
CREATE INDEX "cost_coa_mappings_companyId_costGroupId_coaId_idx" ON "cost_coa_mappings"("companyId", "costGroupId", "coaId");
CREATE INDEX "cost_coa_mappings_natureId_idx" ON "cost_coa_mappings"("natureId"); CREATE INDEX "cost_coa_mappings_coaId_idx" ON "cost_coa_mappings"("coaId");
CREATE INDEX "cost_coa_mappings_validFrom_idx" ON "cost_coa_mappings"("validFrom"); CREATE INDEX "cost_coa_mappings_validTo_idx" ON "cost_coa_mappings"("validTo");
CREATE UNIQUE INDEX "cost_periods_activeCalculationRunId_key" ON "cost_periods"("activeCalculationRunId");
CREATE UNIQUE INDEX "cost_periods_companyId_fiscalYear_fiscalPeriod_key" ON "cost_periods"("companyId", "fiscalYear", "fiscalPeriod");
CREATE INDEX "cost_periods_companyId_idx" ON "cost_periods"("companyId"); CREATE INDEX "cost_periods_fiscalYear_fiscalPeriod_idx" ON "cost_periods"("fiscalYear", "fiscalPeriod"); CREATE INDEX "cost_periods_status_idx" ON "cost_periods"("status");
CREATE UNIQUE INDEX "cost_uploads_periodId_version_key" ON "cost_uploads"("periodId", "version"); CREATE UNIQUE INDEX "cost_uploads_periodId_fileHashSha256_key" ON "cost_uploads"("periodId", "fileHashSha256");
CREATE INDEX "cost_uploads_periodId_idx" ON "cost_uploads"("periodId"); CREATE INDEX "cost_uploads_uploadedById_idx" ON "cost_uploads"("uploadedById"); CREATE INDEX "cost_uploads_status_idx" ON "cost_uploads"("status"); CREATE INDEX "cost_uploads_fileHashSha256_idx" ON "cost_uploads"("fileHashSha256");
CREATE UNIQUE INDEX "cost_uploads_one_active_version_per_period" ON "cost_uploads"("periodId") WHERE "isActiveVersion" = true;
CREATE INDEX "cost_source_rows_uploadId_idx" ON "cost_source_rows"("uploadId"); CREATE INDEX "cost_source_rows_logicalSourceCode_idx" ON "cost_source_rows"("logicalSourceCode"); CREATE INDEX "cost_source_rows_coaId_idx" ON "cost_source_rows"("coaId"); CREATE INDEX "cost_source_rows_mappingStatus_idx" ON "cost_source_rows"("mappingStatus"); CREATE INDEX "cost_source_rows_uploadId_logicalSourceCode_idx" ON "cost_source_rows"("uploadId", "logicalSourceCode");
CREATE INDEX "cost_validation_issues_uploadId_idx" ON "cost_validation_issues"("uploadId"); CREATE INDEX "cost_validation_issues_sourceRowId_idx" ON "cost_validation_issues"("sourceRowId"); CREATE INDEX "cost_validation_issues_severity_idx" ON "cost_validation_issues"("severity"); CREATE INDEX "cost_validation_issues_resolved_idx" ON "cost_validation_issues"("resolved"); CREATE INDEX "cost_validation_issues_issueCode_idx" ON "cost_validation_issues"("issueCode");
CREATE INDEX "cost_adjustments_periodId_idx" ON "cost_adjustments"("periodId"); CREATE INDEX "cost_adjustments_costGroupId_idx" ON "cost_adjustments"("costGroupId"); CREATE INDEX "cost_adjustments_natureId_idx" ON "cost_adjustments"("natureId"); CREATE INDEX "cost_adjustments_coaId_idx" ON "cost_adjustments"("coaId");
CREATE UNIQUE INDEX "cost_calculation_runs_periodId_runNumber_key" ON "cost_calculation_runs"("periodId", "runNumber"); CREATE INDEX "cost_calculation_runs_periodId_idx" ON "cost_calculation_runs"("periodId"); CREATE INDEX "cost_calculation_runs_uploadId_idx" ON "cost_calculation_runs"("uploadId"); CREATE INDEX "cost_calculation_runs_status_idx" ON "cost_calculation_runs"("status"); CREATE INDEX "cost_calculation_runs_isActive_idx" ON "cost_calculation_runs"("isActive");
CREATE UNIQUE INDEX "cost_calculation_runs_one_active_per_period" ON "cost_calculation_runs"("periodId") WHERE "isActive" = true;
CREATE INDEX "cost_actual_lines_calculationRunId_idx" ON "cost_actual_lines"("calculationRunId"); CREATE INDEX "cost_actual_lines_periodId_idx" ON "cost_actual_lines"("periodId"); CREATE INDEX "cost_actual_lines_costGroupId_idx" ON "cost_actual_lines"("costGroupId"); CREATE INDEX "cost_actual_lines_natureId_idx" ON "cost_actual_lines"("natureId"); CREATE INDEX "cost_actual_lines_coaId_idx" ON "cost_actual_lines"("coaId"); CREATE INDEX "cost_actual_lines_sourceRowId_idx" ON "cost_actual_lines"("sourceRowId"); CREATE INDEX "cost_actual_lines_periodId_costGroupId_natureId_idx" ON "cost_actual_lines"("periodId", "costGroupId", "natureId");
CREATE INDEX "cost_calculation_results_calculationRunId_idx" ON "cost_calculation_results"("calculationRunId"); CREATE INDEX "cost_calculation_results_periodId_idx" ON "cost_calculation_results"("periodId"); CREATE INDEX "cost_calculation_results_resultCode_idx" ON "cost_calculation_results"("resultCode"); CREATE INDEX "cost_calculation_results_costGroupId_idx" ON "cost_calculation_results"("costGroupId"); CREATE INDEX "cost_calculation_results_natureId_idx" ON "cost_calculation_results"("natureId");
CREATE INDEX "cost_audit_logs_userId_idx" ON "cost_audit_logs"("userId"); CREATE INDEX "cost_audit_logs_periodId_idx" ON "cost_audit_logs"("periodId"); CREATE INDEX "cost_audit_logs_action_idx" ON "cost_audit_logs"("action"); CREATE INDEX "cost_audit_logs_entityType_idx" ON "cost_audit_logs"("entityType"); CREATE INDEX "cost_audit_logs_createdAt_idx" ON "cost_audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "cost_groups" ADD CONSTRAINT "cost_groups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "cost_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_natures" ADD CONSTRAINT "cost_natures_costGroupId_fkey" FOREIGN KEY ("costGroupId") REFERENCES "cost_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_coa_mappings" ADD CONSTRAINT "cost_coa_mappings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "cost_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_coa_mappings" ADD CONSTRAINT "cost_coa_mappings_costGroupId_fkey" FOREIGN KEY ("costGroupId") REFERENCES "cost_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_coa_mappings" ADD CONSTRAINT "cost_coa_mappings_natureId_fkey" FOREIGN KEY ("natureId") REFERENCES "cost_natures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_coa_mappings" ADD CONSTRAINT "cost_coa_mappings_coaId_fkey" FOREIGN KEY ("coaId") REFERENCES "cost_coas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_coa_mappings" ADD CONSTRAINT "cost_coa_mappings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_periods" ADD CONSTRAINT "cost_periods_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "cost_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_periods" ADD CONSTRAINT "cost_periods_activeCalculationRunId_fkey" FOREIGN KEY ("activeCalculationRunId") REFERENCES "cost_calculation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_periods" ADD CONSTRAINT "cost_periods_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cost_periods" ADD CONSTRAINT "cost_periods_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cost_uploads" ADD CONSTRAINT "cost_uploads_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "cost_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_uploads" ADD CONSTRAINT "cost_uploads_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_source_rows" ADD CONSTRAINT "cost_source_rows_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "cost_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cost_source_rows" ADD CONSTRAINT "cost_source_rows_coaId_fkey" FOREIGN KEY ("coaId") REFERENCES "cost_coas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_validation_issues" ADD CONSTRAINT "cost_validation_issues_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "cost_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cost_validation_issues" ADD CONSTRAINT "cost_validation_issues_sourceRowId_fkey" FOREIGN KEY ("sourceRowId") REFERENCES "cost_source_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cost_validation_issues" ADD CONSTRAINT "cost_validation_issues_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cost_adjustments" ADD CONSTRAINT "cost_adjustments_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "cost_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_adjustments" ADD CONSTRAINT "cost_adjustments_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "cost_uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_adjustments" ADD CONSTRAINT "cost_adjustments_costGroupId_fkey" FOREIGN KEY ("costGroupId") REFERENCES "cost_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_adjustments" ADD CONSTRAINT "cost_adjustments_natureId_fkey" FOREIGN KEY ("natureId") REFERENCES "cost_natures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_adjustments" ADD CONSTRAINT "cost_adjustments_coaId_fkey" FOREIGN KEY ("coaId") REFERENCES "cost_coas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_adjustments" ADD CONSTRAINT "cost_adjustments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_calculation_runs" ADD CONSTRAINT "cost_calculation_runs_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "cost_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_calculation_runs" ADD CONSTRAINT "cost_calculation_runs_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "cost_uploads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_calculation_runs" ADD CONSTRAINT "cost_calculation_runs_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_actual_lines" ADD CONSTRAINT "cost_actual_lines_calculationRunId_fkey" FOREIGN KEY ("calculationRunId") REFERENCES "cost_calculation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_actual_lines" ADD CONSTRAINT "cost_actual_lines_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "cost_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_actual_lines" ADD CONSTRAINT "cost_actual_lines_costGroupId_fkey" FOREIGN KEY ("costGroupId") REFERENCES "cost_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_actual_lines" ADD CONSTRAINT "cost_actual_lines_natureId_fkey" FOREIGN KEY ("natureId") REFERENCES "cost_natures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_actual_lines" ADD CONSTRAINT "cost_actual_lines_coaId_fkey" FOREIGN KEY ("coaId") REFERENCES "cost_coas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_actual_lines" ADD CONSTRAINT "cost_actual_lines_sourceRowId_fkey" FOREIGN KEY ("sourceRowId") REFERENCES "cost_source_rows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_calculation_results" ADD CONSTRAINT "cost_calculation_results_calculationRunId_fkey" FOREIGN KEY ("calculationRunId") REFERENCES "cost_calculation_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_calculation_results" ADD CONSTRAINT "cost_calculation_results_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "cost_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_calculation_results" ADD CONSTRAINT "cost_calculation_results_costGroupId_fkey" FOREIGN KEY ("costGroupId") REFERENCES "cost_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_calculation_results" ADD CONSTRAINT "cost_calculation_results_natureId_fkey" FOREIGN KEY ("natureId") REFERENCES "cost_natures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_audit_logs" ADD CONSTRAINT "cost_audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_audit_logs" ADD CONSTRAINT "cost_audit_logs_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "cost_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
