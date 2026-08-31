-- READ ONLY post-apply verification.
-- Expected result:
--   mapping_status = PASS
--   target_status = PASS
--   all Nature/TOTAL difference values = 0.00

WITH company AS (
  SELECT id FROM cost_companies WHERE "companyCode" = '2000'
), historical_upload AS (
  SELECT cp.id AS period_id, cu.id AS upload_id
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
    AND COALESCE(sr.amount,0) <> 0
), effective_counts AS (
  SELECT
    nz.source_code,
    nz.coa,
    COUNT(m.id)::int AS mapping_count
  FROM nonzero_pairs nz
  LEFT JOIN cost_coas coa ON coa."coaCode" = nz.coa
  LEFT JOIN cost_coa_mappings m
    ON m."companyId" = (SELECT id FROM company)
   AND m."sourceLogicalCode" = nz.source_code
   AND m."coaId" = coa.id
   AND m.active = TRUE
   AND m."validFrom" <= TIMESTAMP '2025-01-01 00:00:00'
   AND (m."validTo" IS NULL OR m."validTo" >= TIMESTAMP '2025-01-01 00:00:00')
  GROUP BY nz.source_code, nz.coa
), predecessor AS (
  SELECT COUNT(*)::int AS cnt
  FROM cost_coa_mappings m
  JOIN cost_coas coa ON coa.id = m."coaId"
  JOIN nonzero_pairs nz
    ON nz.source_code = m."sourceLogicalCode"
   AND nz.coa = coa."coaCode"
  WHERE m."companyId" = (SELECT id FROM company)
    AND m.active = TRUE
    AND m."validFrom" = TIMESTAMP '2025-01-01 00:00:00'
    AND m."validTo" = TIMESTAMP '2026-06-30 00:00:00'
), baseline AS (
  SELECT COUNT(*)::int AS cnt
  FROM cost_coa_mappings
  WHERE "companyId" = (SELECT id FROM company)
    AND active = TRUE
    AND "validFrom" = TIMESTAMP '2026-07-01 00:00:00'
    AND "validTo" IS NULL
), overlap_pairs AS (
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
), audit_marker AS (
  SELECT COUNT(*)::int AS cnt
  FROM cost_audit_logs
  WHERE action = 'BACKFILL_HISTORICAL_COA_MAPPING'
    AND "entityType" = 'CostCoaMapping'
    AND "entityId" = '2000:2025-01-01:2026-06-30'
)
SELECT
  (SELECT COUNT(*) FROM nonzero_pairs)::int AS nonzero_pairs,
  (SELECT cnt FROM predecessor) AS predecessor_count,
  (SELECT cnt FROM baseline) AS jul_2026_baseline_count,
  (SELECT COUNT(*) FROM effective_counts WHERE mapping_count <> 1)::int AS non_unique_effective_mapping_count,
  (SELECT cnt FROM overlap_pairs) AS overlap_pair_count,
  (SELECT cnt FROM audit_marker) AS audit_marker_count,
  CASE
    WHEN (SELECT COUNT(*) FROM nonzero_pairs) <> 140 THEN 'FAIL_NONZERO_SET'
    WHEN (SELECT cnt FROM predecessor) <> 140 THEN 'FAIL_PREDECESSOR_COUNT'
    WHEN (SELECT cnt FROM baseline) <> 159 THEN 'FAIL_BASELINE_CHANGED'
    WHEN (SELECT COUNT(*) FROM effective_counts WHERE mapping_count <> 1) <> 0 THEN 'FAIL_EFFECTIVE_MAPPING_CARDINALITY'
    WHEN (SELECT cnt FROM overlap_pairs) <> 0 THEN 'FAIL_MAPPING_OVERLAP'
    WHEN (SELECT cnt FROM audit_marker) <> 1 THEN 'FAIL_AUDIT_MARKER'
    ELSE 'PASS'
  END AS mapping_status;

-- Verify the individual expected action/group/nature target for all 140 pairs.
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
    AND COALESCE(sr.amount,0) <> 0
), baseline AS (
  SELECT m.*, coa."coaCode" AS coa
  FROM cost_coa_mappings m
  JOIN cost_coas coa ON coa.id = m."coaId"
  WHERE m."companyId" = (SELECT id FROM company)
    AND m.active = TRUE
    AND m."validFrom" = TIMESTAMP '2026-07-01 00:00:00'
    AND m."validTo" IS NULL
), inherited_expected AS (
  SELECT
    nz.source_code,
    nz.coa,
    b."mappingAction"::text AS expected_action,
    b."costGroupId" AS expected_group_id,
    b."natureId" AS expected_nature_id
  FROM nonzero_pairs nz
  JOIN baseline b
    ON b."sourceLogicalCode" = nz.source_code
   AND b.coa = nz.coa
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
), explicit_expected AS (
  SELECT
    e.source_code,
    e.coa,
    e.action AS expected_action,
    CASE WHEN e.action='EXCLUDE' THEN NULL ELSE g.id END AS expected_group_id,
    CASE WHEN e.action='EXCLUDE' THEN NULL ELSE n.id END AS expected_nature_id
  FROM explicit e
  LEFT JOIN cost_groups g
    ON g."companyId"=(SELECT id FROM company)
   AND g.code=e.group_code
  LEFT JOIN cost_natures n
    ON n."costGroupId"=g.id
   AND n.code=e.nature_code
), expected AS (
  SELECT * FROM inherited_expected
  UNION ALL
  SELECT * FROM explicit_expected
), actual AS (
  SELECT
    m."sourceLogicalCode" AS source_code,
    coa."coaCode" AS coa,
    m."mappingAction"::text AS actual_action,
    m."costGroupId" AS actual_group_id,
    m."natureId" AS actual_nature_id
  FROM cost_coa_mappings m
  JOIN cost_coas coa ON coa.id=m."coaId"
  WHERE m."companyId"=(SELECT id FROM company)
    AND m.active=TRUE
    AND m."validFrom"=TIMESTAMP '2025-01-01 00:00:00'
    AND m."validTo"=TIMESTAMP '2026-06-30 00:00:00'
), comparison AS (
  SELECT
    e.*,
    a.actual_action,
    a.actual_group_id,
    a.actual_nature_id,
    (
      a.actual_action = e.expected_action
      AND a.actual_group_id IS NOT DISTINCT FROM e.expected_group_id
      AND a.actual_nature_id IS NOT DISTINCT FROM e.expected_nature_id
    ) AS exact_match
  FROM expected e
  LEFT JOIN actual a
    ON a.source_code=e.source_code
   AND a.coa=e.coa
)
SELECT
  COUNT(*)::int AS expected_target_count,
  COUNT(*) FILTER (WHERE exact_match)::int AS exact_target_match_count,
  COUNT(*) FILTER (WHERE NOT COALESCE(exact_match,FALSE))::int AS target_mismatch_count,
  CASE
    WHEN COUNT(*) <> 140 THEN 'FAIL_EXPECTED_TARGET_SET'
    WHEN COUNT(*) FILTER (WHERE exact_match) <> 140 THEN 'FAIL_TARGET_MISMATCH'
    ELSE 'PASS'
  END AS target_status
FROM comparison;

-- Exact Jan-2025 Nature parity against persisted AUDIT_SI.
WITH company AS (
  SELECT id FROM cost_companies WHERE "companyCode" = '2000'
), historical_upload AS (
  SELECT cu.id AS upload_id
  FROM cost_periods cp
  JOIN cost_uploads cu ON cu."periodId" = cp.id AND cu."isActiveVersion" = TRUE
  WHERE cp."companyId" = (SELECT id FROM company)
    AND cp."fiscalYear" = 2025
    AND cp."fiscalPeriod" = 1
), mapped_detail AS (
  SELECT
    sr."logicalSourceCode" AS source_code,
    n.code AS nature_code,
    SUM(sr.amount)::numeric AS predicted
  FROM cost_source_rows sr
  JOIN cost_coas coa ON coa."coaCode" = sr."coaCodeRaw"
  JOIN cost_coa_mappings m
    ON m."companyId" = (SELECT id FROM company)
   AND m."sourceLogicalCode" = sr."logicalSourceCode"
   AND m."coaId" = coa.id
   AND m.active = TRUE
   AND m."validFrom" <= TIMESTAMP '2025-01-01 00:00:00'
   AND (m."validTo" IS NULL OR m."validTo" >= TIMESTAMP '2025-01-01 00:00:00')
  LEFT JOIN cost_natures n ON n.id = m."natureId"
  WHERE sr."uploadId" = (SELECT upload_id FROM historical_upload)
    AND sr."logicalSourceCode" IN ('CC_ADUM','CC_PASAR')
    AND sr."coaCodeRaw" IS NOT NULL
    AND m."mappingAction" <> 'EXCLUDE'::"CostMappingAction"
  GROUP BY sr."logicalSourceCode", n.code
), expected_rows(source_code, nature_code, audit_row) AS (
  VALUES
    ('CC_ADUM','N01',20),('CC_ADUM','N02',21),('CC_ADUM','N03',22),
    ('CC_ADUM','N04',23),('CC_ADUM','N05',24),('CC_ADUM','N06',25),
    ('CC_ADUM','N07',26),('CC_ADUM','N08',27),('CC_ADUM','N09',28),
    ('CC_PASAR','N01',32),('CC_PASAR','N02',33),('CC_PASAR','N03',34),
    ('CC_PASAR','N04',35),('CC_PASAR','N05',36),('CC_PASAR','N06',37),
    ('CC_PASAR','N07',38),('CC_PASAR','N08',39),('CC_PASAR','N09',40)
), expected AS (
  SELECT
    er.source_code,
    er.nature_code,
    COALESCE(NULLIF(sr."rawDataJson"->>'COLUMN_2','')::numeric,0) * 1000 AS expected
  FROM expected_rows er
  JOIN cost_source_rows sr
    ON sr."uploadId" = (SELECT upload_id FROM historical_upload)
   AND sr."logicalSourceCode" = 'AUDIT_SI'
   AND sr."sourceRowNumber" = er.audit_row
), detail_result AS (
  SELECT
    e.source_code,
    e.nature_code,
    COALESCE(md.predicted,0)::numeric(20,2) AS predicted,
    e.expected::numeric(20,2) AS expected,
    (COALESCE(md.predicted,0) - e.expected)::numeric(20,2) AS difference
  FROM expected e
  LEFT JOIN mapped_detail md
    ON md.source_code = e.source_code
   AND md.nature_code = e.nature_code
), totals AS (
  SELECT
    source_code,
    'TOTAL'::text AS nature_code,
    SUM(predicted)::numeric(20,2) AS predicted,
    SUM(expected)::numeric(20,2) AS expected,
    SUM(difference)::numeric(20,2) AS difference
  FROM detail_result
  GROUP BY source_code
)
SELECT * FROM detail_result
UNION ALL
SELECT * FROM totals
ORDER BY source_code, CASE WHEN nature_code = 'TOTAL' THEN 'ZZZ' ELSE nature_code END;
