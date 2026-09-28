-- READ ONLY.
-- Company 2000 historical mapping preflight for 2025-01-01 through 2026-06-30.

WITH company AS (
  SELECT id
  FROM cost_companies
  WHERE "companyCode" = '2000'
), historical_upload AS (
  SELECT
    cp.id AS period_id,
    cp.status AS period_status,
    cp."periodStart" AS period_start,
    cu.id AS upload_id,
    cu."fileHashSha256" AS file_hash,
    cu."originalFileName" AS file_name,
    cu.status AS upload_status
  FROM cost_periods cp
  JOIN cost_uploads cu
    ON cu."periodId" = cp.id
   AND cu."isActiveVersion" = TRUE
  WHERE cp."companyId" = (SELECT id FROM company)
    AND cp."fiscalYear" = 2025
    AND cp."fiscalPeriod" = 1
), baseline AS (
  SELECT m.*
  FROM cost_coa_mappings m
  WHERE m."companyId" = (SELECT id FROM company)
    AND m.active = TRUE
    AND m."validFrom" = TIMESTAMP '2026-07-01 00:00:00'
    AND m."validTo" IS NULL
), nonzero_pairs AS (
  SELECT DISTINCT
    sr."logicalSourceCode" AS source_code,
    sr."coaCodeRaw" AS coa
  FROM cost_source_rows sr
  WHERE sr."uploadId" = (SELECT upload_id FROM historical_upload)
    AND sr."logicalSourceCode" IN ('CC_ADUM', 'CC_PASAR')
    AND sr."coaCodeRaw" IS NOT NULL
    AND COALESCE(sr.amount, 0) <> 0
), inherited AS (
  SELECT DISTINCT
    nz.source_code,
    nz.coa,
    b.id AS baseline_mapping_id,
    b."costGroupId" AS expected_group_id,
    b."natureId" AS expected_nature_id,
    b."mappingAction"::text AS expected_action
  FROM nonzero_pairs nz
  JOIN cost_coas coa ON coa."coaCode" = nz.coa
  JOIN baseline b
    ON b."sourceLogicalCode" = nz.source_code
   AND b."coaId" = coa.id
), explicit(source_code, coa, action, group_code, nature_code) AS (
  VALUES
    ('CC_ADUM','63130007','INCLUDE','ADUM','N04'),
    ('CC_ADUM','63150002','INCLUDE','ADUM','N04'),
    ('CC_ADUM','63220009','INCLUDE','ADUM','N04'),
    ('CC_ADUM','64220002','INCLUDE','ADUM','N07'),
    ('CC_ADUM','64320009','INCLUDE','ADUM','N07'),
    ('CC_ADUM','65810001','INCLUDE','ADUM','N05'),
    ('CC_ADUM','67110002','INCLUDE','ADUM','N07'),
    ('CC_ADUM','67120002','INCLUDE','ADUM','N07'),
    ('CC_ADUM','67610004','INCLUDE','ADUM','N09'),
    ('CC_ADUM','71610001','EXCLUDE',NULL,NULL),
    ('CC_PASAR','63130007','INCLUDE','PASAR','N04'),
    ('CC_PASAR','63150002','INCLUDE','PASAR','N04'),
    ('CC_PASAR','64220009','INCLUDE','PASAR','N07'),
    ('CC_PASAR','65210002','INCLUDE','PASAR','N05'),
    ('CC_PASAR','65410009','INCLUDE','PASAR','N05'),
    ('CC_PASAR','67410001','INCLUDE','PASAR','N07'),
    ('CC_PASAR','67710002','INCLUDE','PASAR','N07'),
    ('CC_PASAR','68320001','INCLUDE','PASAR','N08'),
    ('CC_PASAR','71560001','EXCLUDE',NULL,NULL)
), explicit_targets AS (
  SELECT
    e.*,
    g.id AS group_id,
    n.id AS nature_id
  FROM explicit e
  LEFT JOIN cost_groups g
    ON g."companyId" = (SELECT id FROM company)
   AND g.code = e.group_code
   AND g.active = TRUE
  LEFT JOIN cost_natures n
    ON n."costGroupId" = g.id
   AND n.code = e.nature_code
   AND n.active = TRUE
   AND n."calculationType" = 'MAPPED'
), explicit_in_nonzero AS (
  SELECT e.source_code, e.coa
  FROM explicit e
  JOIN nonzero_pairs nz
    ON nz.source_code = e.source_code
   AND nz.coa = e.coa
), explicit_with_baseline AS (
  SELECT e.source_code, e.coa
  FROM explicit e
  JOIN cost_coas coa ON coa."coaCode" = e.coa
  JOIN baseline b
    ON b."sourceLogicalCode" = e.source_code
   AND b."coaId" = coa.id
), finalized_impacted AS (
  SELECT COUNT(*)::int AS cnt
  FROM cost_periods
  WHERE "companyId" = (SELECT id FROM company)
    AND status = 'FINALIZED'
    AND "periodStart" BETWEEN TIMESTAMP '2025-01-01 00:00:00' AND TIMESTAMP '2026-06-30 23:59:59'
), existing_overlap_pairs AS (
  SELECT COUNT(*)::int AS cnt
  FROM cost_coa_mappings a
  JOIN cost_coa_mappings b
    ON a."companyId" = b."companyId"
   AND a."sourceLogicalCode" = b."sourceLogicalCode"
   AND a."coaId" = b."coaId"
   AND a.id < b.id
   AND a.active = TRUE
   AND b.active = TRUE
  WHERE a."companyId" = (SELECT id FROM company)
    AND a."validFrom" <= COALESCE(b."validTo", TIMESTAMP '9999-12-31 00:00:00')
    AND b."validFrom" <= COALESCE(a."validTo", TIMESTAMP '9999-12-31 00:00:00')
), candidate_interval_rows AS (
  SELECT
    m.id,
    m."sourceLogicalCode" AS source_code,
    coa."coaCode" AS coa
  FROM cost_coa_mappings m
  JOIN cost_coas coa ON coa.id = m."coaId"
  JOIN nonzero_pairs nz
    ON nz.source_code = m."sourceLogicalCode"
   AND nz.coa = coa."coaCode"
  WHERE m."companyId" = (SELECT id FROM company)
    AND m.active = TRUE
    AND m."validFrom" <= TIMESTAMP '2026-06-30 00:00:00'
    AND COALESCE(m."validTo", TIMESTAMP '9999-12-31 00:00:00') >= TIMESTAMP '2025-01-01 00:00:00'
), candidate_exact_interval AS (
  SELECT COUNT(*)::int AS cnt
  FROM candidate_interval_rows cir
  JOIN cost_coa_mappings m ON m.id = cir.id
  WHERE m."validFrom" = TIMESTAMP '2025-01-01 00:00:00'
    AND m."validTo" = TIMESTAMP '2026-06-30 00:00:00'
), stats AS (
  SELECT
    (SELECT COUNT(*) FROM company)::int AS company_count,
    (SELECT COUNT(*) FROM historical_upload)::int AS historical_upload_count,
    (SELECT file_hash FROM historical_upload LIMIT 1) AS historical_file_hash,
    (SELECT COUNT(*) FROM baseline)::int AS baseline_count,
    (SELECT COUNT(DISTINCT "createdById") FROM baseline)::int AS baseline_creator_count,
    (SELECT COUNT(*) FROM nonzero_pairs)::int AS nonzero_pair_count,
    (SELECT COUNT(*) FROM inherited)::int AS inherited_count,
    (SELECT COUNT(*) FROM explicit)::int AS explicit_count,
    (SELECT COUNT(*) FROM explicit_in_nonzero)::int AS explicit_in_nonzero_count,
    (SELECT COUNT(*) FROM explicit_with_baseline)::int AS explicit_with_baseline_count,
    (SELECT COUNT(*) FROM explicit_targets WHERE action <> 'EXCLUDE' AND (group_id IS NULL OR nature_id IS NULL))::int AS explicit_target_missing_count,
    (SELECT COUNT(DISTINCT e.coa) FROM explicit e LEFT JOIN cost_coas c ON c."coaCode" = e.coa WHERE c.id IS NULL)::int AS missing_coa_master_count,
    (SELECT cnt FROM finalized_impacted)::int AS finalized_impacted_count,
    (SELECT cnt FROM existing_overlap_pairs)::int AS existing_overlap_count,
    (SELECT COUNT(*) FROM candidate_interval_rows)::int AS candidate_interval_count,
    (SELECT cnt FROM candidate_exact_interval)::int AS candidate_exact_interval_count
)
SELECT
  *,
  CASE
    WHEN company_count <> 1 THEN 'BLOCKED_COMPANY'
    WHEN historical_upload_count <> 1 THEN 'BLOCKED_HISTORICAL_UPLOAD'
    WHEN historical_file_hash <> 'ac0358b1b43cb7233f2826986a097675819388981fe8b65f061d5f2a914484a3' THEN 'BLOCKED_WORKBOOK_HASH_CHANGED'
    WHEN baseline_count <> 159 THEN 'BLOCKED_BASELINE_COUNT_CHANGED'
    WHEN baseline_creator_count <> 1 THEN 'BLOCKED_BASELINE_CREATOR_CHANGED'
    WHEN nonzero_pair_count <> 140 THEN 'BLOCKED_NONZERO_SET_CHANGED'
    WHEN inherited_count <> 121 THEN 'BLOCKED_INHERITED_SET_CHANGED'
    WHEN explicit_count <> 19 OR explicit_in_nonzero_count <> 19 THEN 'BLOCKED_EXPLICIT_SET_CHANGED'
    WHEN explicit_with_baseline_count <> 0 THEN 'BLOCKED_EXPLICIT_NOW_HAS_BASELINE'
    WHEN explicit_target_missing_count <> 0 THEN 'BLOCKED_TARGET_MISSING'
    WHEN finalized_impacted_count <> 0 THEN 'BLOCKED_FINALIZED_PERIOD'
    WHEN existing_overlap_count <> 0 THEN 'BLOCKED_EXISTING_MAPPING_OVERLAP'
    WHEN candidate_interval_count = 0 THEN 'READY_TO_APPLY'
    WHEN candidate_interval_count = 140 AND candidate_exact_interval_count = 140 THEN 'ALREADY_APPLIED_VERIFY_TARGETS'
    ELSE 'BLOCKED_PARTIAL_OR_CONFLICTING_PREDECESSOR'
  END AS preflight_status
FROM stats;
