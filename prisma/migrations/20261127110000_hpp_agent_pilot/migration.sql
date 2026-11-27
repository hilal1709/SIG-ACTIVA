-- Additive isolated HPP job queue. No modification of published history.
CREATE TABLE "desktop_agent_devices" (
 "id" VARCHAR(36) PRIMARY KEY,
 "name" VARCHAR(80) NOT NULL,
 "tokenHash" VARCHAR(64) NOT NULL UNIQUE,
 "createdById" INTEGER NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "lastSeenAt" TIMESTAMP(3),
 "revokedAt" TIMESTAMP(3)
);
CREATE TABLE "hpp_sync_jobs" (
 "id" VARCHAR(36) PRIMARY KEY,
 "fiscalYear" INTEGER NOT NULL CHECK ("fiscalYear" BETWEEN 2000 AND 2100),
 "fiscalPeriod" INTEGER NOT NULL CHECK ("fiscalPeriod" BETWEEN 1 AND 12),
 "baselineId" INTEGER NOT NULL,
 "requestedById" INTEGER NOT NULL,
 "deviceId" VARCHAR(36) NOT NULL,
 "status" VARCHAR(24) NOT NULL CHECK ("status" IN ('QUEUED','RUNNING','REVIEW','PUBLISHED','UNCHANGED','FAILED','CANCELLED')),
 "scope" JSONB NOT NULL,
 "result" JSONB,
 "resultHash" VARCHAR(64),
 "sourceMode" VARCHAR(24) CHECK ("sourceMode" IN ('SYNTHETIC','SAP_SCRIPT')),
 "leaseHash" VARCHAR(64),
 "leaseUntil" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "startedAt" TIMESTAMP(3),
 "completedAt" TIMESTAMP(3),
 "reviewedAt" TIMESTAMP(3),
 "reviewedById" INTEGER,
 "publishedId" INTEGER,
 "errorCode" VARCHAR(40),
 CONSTRAINT "hpp_sync_jobs_device_fk" FOREIGN KEY ("deviceId") REFERENCES "desktop_agent_devices"("id") ON DELETE RESTRICT,
 CONSTRAINT "hpp_sync_jobs_baseline_fk" FOREIGN KEY ("baselineId") REFERENCES "hpp_period_versions"("id") ON DELETE RESTRICT,
 CONSTRAINT "hpp_sync_jobs_published_fk" FOREIGN KEY ("publishedId") REFERENCES "hpp_period_versions"("id") ON DELETE RESTRICT
);
CREATE INDEX "hpp_sync_jobs_deviceId_status_createdAt_idx" ON "hpp_sync_jobs" ("deviceId","status","createdAt");
CREATE INDEX "hpp_sync_jobs_fiscalYear_fiscalPeriod_status_idx" ON "hpp_sync_jobs" ("fiscalYear","fiscalPeriod","status");
CREATE UNIQUE INDEX "hpp_sync_jobs_one_open_period" ON "hpp_sync_jobs" ("fiscalYear","fiscalPeriod") WHERE "status" IN ('QUEUED','RUNNING','REVIEW');
CREATE UNIQUE INDEX "hpp_sync_jobs_one_running_device" ON "hpp_sync_jobs" ("deviceId") WHERE "status"='RUNNING';
ALTER TABLE "desktop_agent_devices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hpp_sync_jobs" ENABLE ROW LEVEL SECURITY;
