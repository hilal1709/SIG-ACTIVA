-- WRITE OPERATION. DO NOT RUN WITHOUT AN APPROVED PRODUCTION CHANGE WINDOW.
-- Transactional + idempotent + fail-closed.
-- Does NOT run reconciliation, calculation, finalization, or change period status.

BEGIN;

CREATE TEMP TABLE _hist_explicit (
  source_code text NOT NULL,
  coa text NOT NULL,
  action text NOT NULL,
  group_code text,
  nature_code text,
  evidence text NOT NULL,
  PRIMARY KEY (source_code, coa)
) ON COMMIT DROP;

INSERT INTO _hist_explicit(source_code, coa, action, group_code, nature_code, evidence) VALUES
  ('CC_ADUM','63130007','INCLUDE','ADUM','N04','Jan-2025 AUDIT_SI N04 residual exact: 12,077,059'),
  ('CC_ADUM','63150002','INCLUDE','ADUM','N04','Jan-2025 AUDIT_SI N04 residual exact: 60,000'),
  ('CC_ADUM','63220009','INCLUDE','ADUM','N04','Jan-2025 AUDIT_SI N04 residual exact: 107,898,101'),
  ('CC_ADUM','64220002','INCLUDE','ADUM','N07','Jan-2025 AUDIT_SI N07 residual exact: 1,283,926,000'),
  ('CC_ADUM','64320009','INCLUDE','ADUM','N07','Jan-2025 AUDIT_SI N07 residual exact: 12,900,000'),
  ('CC_ADUM','65810001','INCLUDE','ADUM','N05','Jan-2025 AUDIT_SI N05 residual exact: 483,500,000'),
  ('CC_ADUM','67110002','INCLUDE','ADUM','N07','Jan-2025 counterpart PASAR mapping is N07; exact aggregate parity'),
  ('CC_ADUM','67120002','INCLUDE','ADUM','N07','Jan-2025 counterpart PASAR mapping is N07; exact aggregate parity'),
  ('CC_ADUM','67610004','INCLUDE','ADUM','N09','Jan-2025 AUDIT_SI N09 residual exact: 26,076,000'),
  ('CC_ADUM','71610001','EXCLUDE',NULL,NULL,'Absent from analytical Rincian/SI; exclusion required for exact parity'),
  ('CC_PASAR','63130007','INCLUDE','PASAR','N04','Jan-2025 AUDIT_SI N04 residual exact: 12,060,888'),
  ('CC_PASAR','63150002','INCLUDE','PASAR','N04','Jan-2025 AUDIT_SI N04 residual exact: 305,000'),
  ('CC_PASAR','64220009','INCLUDE','PASAR','N07','Jan-2025 counterpart ADUM mapping is N07; exact aggregate parity'),
  ('CC_PASAR','65210002','INCLUDE','PASAR','N05','Jan-2025 counterpart ADUM mapping is N05; exact aggregate parity'),
  ('CC_PASAR','65410009','INCLUDE','PASAR','N05','Jan-2025 counterpart ADUM mapping is N05; exact aggregate parity'),
  ('CC_PASAR','67410001','INCLUDE','PASAR','N07','Jan-2025 counterpart ADUM mapping is N07; exact aggregate parity'),
  ('CC_PASAR','67710002','INCLUDE','PASAR','N07','Jan-2025 AUDIT_SI N07 residual exact: 266,103,954'),
  ('CC_PASAR','68320001','INCLUDE','PASAR','N08','Jan-2025 AUDIT_SI N08 residual exact: 393,389,745'),
  ('CC_PASAR','71560001','EXCLUDE',NULL,NULL,'Absent from analytical Rincian/SI; counterpart ADUM is EXCLUDE');

-- Immutable/audited baseline guards before any persistent insert.
DO $$
DECLARE
  v_company_id integer;
  v_upload_id integer;
  v_hash text;
  v_count integer;
BEGIN
  SELECT id INTO STRICT v_company_id
  FROM cost_companies
  WHERE "companyCode" = '2000';

  SELECT cu.id, cu."fileHashSha256"
    INTO STRICT v_upload_id, v_hash
  FROM cost_periods cp
  JOIN cost_uploads cu
    ON cu."periodId" = cp.id
   AND cu."isActiveVersion" = TRUE
  WHERE cp."companyId" = v_company_id
    AND cp."fiscalYear" = 2025
    AND cp."fiscalPeriod" = 1;

  IF v_hash <> 'ac0358b1b43cb7233f2826986a097675819388981fe8b65f061d5f2a914484a3' THEN
    RAISE EXCEPTION 'HIST_MAPPING_ABORT: Jan-2025 workbook hash changed';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM cost_coa_mappings
  WHERE "companyId" = v_company_id
    AND active = TRUE
    AND "validFrom" = TIMESTAMP '2026-07-01 00:00:00'
    AND "validTo" IS NULL;
  IF v_count <> 159 THEN
    RAISE EXCEPTION 'HIST_MAPPING_ABORT: expected 159 Jul-2026 baseline mappings, found %', v_count;
  END IF;

  SELECT COUNT(DISTINCT "createdById") INTO v_count
  FROM cost_coa_mappings
  WHERE "companyId" = v_company_id
    AND active = TRUE
    AND "validFrom" = TIMESTAMP '2026-07-01 00:00:00'
    AND "validTo" IS NULL;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'HIST_MAPPING_ABORT: Jul-2026 baseline creator lineage changed';
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM cost_periods
  WHERE "companyId" = v_company_id
    AND status = 'FINALIZED'
    AND "periodStart" BETWEEN TIMESTAMP '2025-01-01 00:00:00' AND TIMESTAMP '2026-06-30 23:59:59';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'HIST_MAPPING_ABORT: % FINALIZED historical period(s) would be affected', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM cost_coa_mappings a
  JOIN cost_coa_mappings b
    ON a."companyId" = b."companyId"
   AND a."sourceLogicalCode" = b."sourceLogicalCode"
   AND a."coaId" = b."coaId"
   AND a.id < b.id
   AND a.active = TRUE
   AND b.active = TRUE
  WHERE a."companyId" = v_company_id
    AND a."validFrom" <= COALESCE(b."validTo", TIMESTAMP '9999-12-31 00:00:00')
    AND b."validFrom" <= COALESCE(a."validTo", TIMESTAMP '9999-12-31 00:00:00');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'HIST_MAPPING_ABORT: existing mapping overlap detected (%)', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM (
    SELECT DISTINCT sr."logicalSourceCode", sr."coaCodeRaw"
    FROM cost_source_rows sr
    WHERE sr."uploadId" = v_upload_id
      AND sr."logicalSourceCode" IN ('CC_ADUM','CC_PASAR')
      AND sr."coaCodeRaw" IS NOT NULL
      AND COALESCE(sr.amount, 0) <> 0
  ) nz;
  IF v_count <> 140 THEN
    RAISE EXCEPTION 'HIST_MAPPING_ABORT: Jan-2025 non-zero source/COA set changed; expected 140, found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM _hist_explicit;
  IF v_count <> 19 THEN
    RAISE EXCEPTION 'HIST_MAPPING_ABORT: explicit candidate set must contain 19 rows';
  END IF;
END $$;

-- Create only COA masters that the normal mapping resolver would have created.
-- Description is sourced from the immutable audited Jan-2025 workbook rows.
WITH company AS (
  SELECT id FROM cost_companies WHERE "companyCode" = '2000'
), historical_upload AS (
  SELECT cu.id AS upload_id
  FROM cost_periods cp
  JOIN cost_uploads cu ON cu."periodId" = cp.id AND cu."isActiveVersion" = TRUE
  WHERE cp."companyId" = (SELECT id FROM company)
    AND cp."fiscalYear" = 2025
    AND cp."fiscalPeriod" = 1
), missing AS (
  SELECT DISTINCT e.coa
  FROM _hist_explicit e
  LEFT JOIN cost_coas c ON c."coaCode" = e.coa
  WHERE c.id IS NULL
), descriptions AS (
  SELECT
    m.coa,
    COALESCE(MAX(NULLIF(TRIM(sr."descriptionRaw"), '')), m.coa) AS description
  FROM missing m
  LEFT JOIN cost_source_rows sr
    ON sr."uploadId" = (SELECT upload_id FROM historical_upload)
   AND sr."coaCodeRaw" = m.coa
   AND sr."logicalSourceCode" IN ('CC_ADUM','CC_PASAR')
  GROUP BY m.coa
)
INSERT INTO cost_coas(
  "coaCode", "coaDescription", "accountGroup", active, "createdAt", "updatedAt"
)
SELECT coa, description, NULL, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM descriptions
ON CONFLICT ("coaCode") DO NOTHING;

CREATE TEMP TABLE _hist_candidates (
  company_id integer NOT NULL,
  source_code text NOT NULL,
  coa_id integer NOT NULL,
  cost_group_id integer,
  nature_id integer,
  mapping_action "CostMappingAction" NOT NULL,
  note text NOT NULL,
  created_by_id integer NOT NULL,
  PRIMARY KEY(source_code, coa_id)
) ON COMMIT DROP;

-- 121 inherited candidates: copy the authoritative Jul-2026 disposition backward.
WITH company AS (
  SELECT id FROM cost_companies WHERE "companyCode" = '2000'
), historical_upload AS (
  SELECT cu.id AS upload_id
  FROM cost_periods cp
  JOIN cost_uploads cu ON cu."periodId" = cp.id AND cu."isActiveVersion" = TRUE
  WHERE cp."companyId" = (SELECT id FROM company)
    AND cp."fiscalYear" = 2025
    AND cp."fiscalPeriod" = 1
), nonzero_pairs AS (
  SELECT DISTINCT sr."logicalSourceCode" AS source_code, sr."coaCodeRaw" AS coa
  FROM cost_source_rows sr
  WHERE sr."uploadId" = (SELECT upload_id FROM historical_upload)
    AND sr."logicalSourceCode" IN ('CC_ADUM','CC_PASAR')
    AND sr."coaCodeRaw" IS NOT NULL
    AND COALESCE(sr.amount, 0) <> 0
), baseline AS (
  SELECT m.*
  FROM cost_coa_mappings m
  WHERE m."companyId" = (SELECT id FROM company)
    AND m.active = TRUE
    AND m."validFrom" = TIMESTAMP '2026-07-01 00:00:00'
    AND m."validTo" IS NULL
)
INSERT INTO _hist_candidates(
  company_id, source_code, coa_id, cost_group_id, nature_id,
  mapping_action, note, created_by_id
)
SELECT DISTINCT
  (SELECT id FROM company),
  nz.source_code,
  coa.id,
  b."costGroupId",
  b."natureId",
  b."mappingAction",
  'Historical predecessor validated against Jan-2025 AUDIT_SI exact parity; inherited from Jul-2026 baseline mapping ' || b.id::text,
  b."createdById"
FROM nonzero_pairs nz
JOIN cost_coas coa ON coa."coaCode" = nz.coa
JOIN baseline b
  ON b."sourceLogicalCode" = nz.source_code
 AND b."coaId" = coa.id;

-- 19 explicit candidates: targets are business-key resolved, no generated IDs are hardcoded.
WITH company AS (
  SELECT id FROM cost_companies WHERE "companyCode" = '2000'
), baseline_creator AS (
  SELECT MIN("createdById") AS user_id
  FROM cost_coa_mappings
  WHERE "companyId" = (SELECT id FROM company)
    AND active = TRUE
    AND "validFrom" = TIMESTAMP '2026-07-01 00:00:00'
    AND "validTo" IS NULL
), resolved AS (
  SELECT
    e.*,
    coa.id AS coa_id,
    g.id AS group_id,
    n.id AS nature_id
  FROM _hist_explicit e
  JOIN cost_coas coa ON coa."coaCode" = e.coa
  LEFT JOIN cost_groups g
    ON g."companyId" = (SELECT id FROM company)
   AND g.code = e.group_code
   AND g.active = TRUE
  LEFT JOIN cost_natures n
    ON n."costGroupId" = g.id
   AND n.code = e.nature_code
   AND n.active = TRUE
   AND n."calculationType" = 'MAPPED'
)
INSERT INTO _hist_candidates(
  company_id, source_code, coa_id, cost_group_id, nature_id,
  mapping_action, note, created_by_id
)
SELECT
  (SELECT id FROM company),
  r.source_code,
  r.coa_id,
  CASE WHEN r.action = 'EXCLUDE' THEN NULL ELSE r.group_id END,
  CASE WHEN r.action = 'EXCLUDE' THEN NULL ELSE r.nature_id END,
  r.action::"CostMappingAction",
  'Historical predecessor validated against Jan-2025 AUDIT_SI exact parity: ' || r.evidence,
  (SELECT user_id FROM baseline_creator)
FROM resolved r;

-- Candidate and target guards after business-key resolution.
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count FROM _hist_candidates;
  IF v_count <> 140 THEN
    RAISE EXCEPTION 'HIST_MAPPING_ABORT: expected 140 resolved candidates, found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM _hist_candidates
  WHERE mapping_action <> 'EXCLUDE'::"CostMappingAction"
    AND (cost_group_id IS NULL OR nature_id IS NULL);
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'HIST_MAPPING_ABORT: % INCLUDE/RECLASS candidate(s) have unresolved target', v_count;
  END IF;

  -- Any interval touching the desired predecessor range must either be the exact
  -- expected predecessor or the operation aborts.
  SELECT COUNT(*) INTO v_count
  FROM _hist_candidates c
  JOIN cost_coa_mappings m
    ON m."companyId" = c.company_id
   AND m."sourceLogicalCode" = c.source_code
   AND m."coaId" = c.coa_id
   AND m.active = TRUE
  WHERE m."validFrom" <= TIMESTAMP '2026-06-30 00:00:00'
    AND COALESCE(m."validTo", TIMESTAMP '9999-12-31 00:00:00') >= TIMESTAMP '2025-01-01 00:00:00'
    AND NOT (
      m."validFrom" = TIMESTAMP '2025-01-01 00:00:00'
      AND m."validTo" = TIMESTAMP '2026-06-30 00:00:00'
      AND m."mappingAction" = c.mapping_action
      AND m."costGroupId" IS NOT DISTINCT FROM c.cost_group_id
      AND m."natureId" IS NOT DISTINCT FROM c.nature_id
    );
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'HIST_MAPPING_ABORT: % conflicting predecessor interval(s) detected', v_count;
  END IF;
END $$;

INSERT INTO cost_coa_mappings(
  "companyId", "sourceLogicalCode", "costGroupId", "natureId", "coaId",
  "mappingAction", "validFrom", "validTo", note, active,
  "createdById", "createdAt", "updatedAt"
)
SELECT
  c.company_id,
  c.source_code,
  c.cost_group_id,
  c.nature_id,
  c.coa_id,
  c.mapping_action,
  TIMESTAMP '2025-01-01 00:00:00',
  TIMESTAMP '2026-06-30 00:00:00',
  c.note,
  TRUE,
  c.created_by_id,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM _hist_candidates c
WHERE NOT EXISTS (
  SELECT 1
  FROM cost_coa_mappings m
  WHERE m."companyId" = c.company_id
    AND m."sourceLogicalCode" = c.source_code
    AND m."coaId" = c.coa_id
    AND m.active = TRUE
    AND m."validFrom" = TIMESTAMP '2025-01-01 00:00:00'
    AND m."validTo" = TIMESTAMP '2026-06-30 00:00:00'
    AND m."mappingAction" = c.mapping_action
    AND m."costGroupId" IS NOT DISTINCT FROM c.cost_group_id
    AND m."natureId" IS NOT DISTINCT FROM c.nature_id
);

-- Post-write guards run inside the same transaction. Any failure rolls back all changes.
DO $$
DECLARE
  v_count integer;
  v_company_id integer;
BEGIN
  SELECT id INTO STRICT v_company_id FROM cost_companies WHERE "companyCode" = '2000';

  SELECT COUNT(*) INTO v_count
  FROM _hist_candidates c
  JOIN cost_coa_mappings m
    ON m."companyId" = c.company_id
   AND m."sourceLogicalCode" = c.source_code
   AND m."coaId" = c.coa_id
   AND m.active = TRUE
   AND m."validFrom" = TIMESTAMP '2025-01-01 00:00:00'
   AND m."validTo" = TIMESTAMP '2026-06-30 00:00:00'
   AND m."mappingAction" = c.mapping_action
   AND m."costGroupId" IS NOT DISTINCT FROM c.cost_group_id
   AND m."natureId" IS NOT DISTINCT FROM c.nature_id;
  IF v_count <> 140 THEN
    RAISE EXCEPTION 'HIST_MAPPING_ABORT: exact predecessor verification expected 140, found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM cost_coa_mappings a
  JOIN cost_coa_mappings b
    ON a."companyId" = b."companyId"
   AND a."sourceLogicalCode" = b."sourceLogicalCode"
   AND a."coaId" = b."coaId"
   AND a.id < b.id
   AND a.active = TRUE
   AND b.active = TRUE
  WHERE a."companyId" = v_company_id
    AND a."validFrom" <= COALESCE(b."validTo", TIMESTAMP '9999-12-31 00:00:00')
    AND b."validFrom" <= COALESCE(a."validTo", TIMESTAMP '9999-12-31 00:00:00');
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'HIST_MAPPING_ABORT: post-write overlap detected (%)', v_count;
  END IF;
END $$;

-- One operational audit marker; idempotent on rerun.
WITH company AS (
  SELECT id FROM cost_companies WHERE "companyCode" = '2000'
), historical_period AS (
  SELECT id
  FROM cost_periods
  WHERE "companyId" = (SELECT id FROM company)
    AND "fiscalYear" = 2025
    AND "fiscalPeriod" = 1
), creator AS (
  SELECT MIN("createdById") AS user_id
  FROM cost_coa_mappings
  WHERE "companyId" = (SELECT id FROM company)
    AND active = TRUE
    AND "validFrom" = TIMESTAMP '2026-07-01 00:00:00'
    AND "validTo" IS NULL
)
INSERT INTO cost_audit_logs(
  "userId", "periodId", action, "entityType", "entityId",
  "newValueJson", reason, "createdAt"
)
SELECT
  (SELECT user_id FROM creator),
  (SELECT id FROM historical_period),
  'BACKFILL_HISTORICAL_COA_MAPPING',
  'CostCoaMapping',
  '2000:2025-01-01:2026-06-30',
  jsonb_build_object(
    'companyCode','2000',
    'validFrom','2025-01-01',
    'validTo','2026-06-30',
    'mappingCount',140,
    'inheritedCount',121,
    'explicitCount',19,
    'workbookSha256','ac0358b1b43cb7233f2826986a097675819388981fe8b65f061d5f2a914484a3'
  ),
  'Historical predecessor mappings validated to exact Jan-2025 AUDIT_SI Nature parity.',
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM cost_audit_logs
  WHERE action = 'BACKFILL_HISTORICAL_COA_MAPPING'
    AND "entityType" = 'CostCoaMapping'
    AND "entityId" = '2000:2025-01-01:2026-06-30'
);

COMMIT;
