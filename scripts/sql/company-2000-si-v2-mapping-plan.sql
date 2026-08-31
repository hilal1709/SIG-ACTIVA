-- REVIEW-ONLY controlled configuration correction for ENGINE1_2000_V2.
-- Never run from application deployment. This transaction intentionally ends in ROLLBACK.
BEGIN;

CREATE TEMP TABLE requested_si_v2_mapping (
  source_code text NOT NULL,
  coa_code text NOT NULL,
  group_code text NOT NULL,
  nature_code text NOT NULL,
  predecessor_action "CostMappingAction" NOT NULL,
  predecessor_nature_code text,
  PRIMARY KEY (source_code, coa_code)
) ON COMMIT DROP;

INSERT INTO requested_si_v2_mapping VALUES
  ('CC_ADUM',  '63110002', 'ADUM',  'N04', 'EXCLUDE', NULL),
  ('CC_ADUM',  '63130015', 'ADUM',  'N04', 'EXCLUDE', NULL),
  ('CC_PASAR', '63130015', 'PASAR', 'N04', 'EXCLUDE', NULL),
  ('CC_PASAR', '66250001', 'PASAR', 'N06', 'EXCLUDE', NULL),
  ('CC_PASAR', '67630009', 'PASAR', 'N07', 'INCLUDE', 'N09'),
  ('CC_PASAR', '67640001', 'PASAR', 'N07', 'INCLUDE', 'N09');

-- Resolve every identity by stable business code and prove production cardinality before mutation.
DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count FROM cost_companies WHERE "companyCode" = '2000';
  IF bad_count <> 1 THEN RAISE EXCEPTION 'Company 2000 resolution count %, expected 1', bad_count; END IF;

  SELECT count(*) INTO bad_count
  FROM requested_si_v2_mapping r
  WHERE (SELECT count(*) FROM cost_coas c WHERE c."coaCode" = r.coa_code) <> 1;
  IF bad_count <> 0 THEN RAISE EXCEPTION '% requested COAs do not resolve exactly once', bad_count; END IF;

  SELECT count(*) INTO bad_count
  FROM requested_si_v2_mapping r
  WHERE (SELECT count(*) FROM cost_groups g JOIN cost_companies c ON c.id = g."companyId"
         WHERE c."companyCode" = '2000' AND g.code = r.group_code) <> 1;
  IF bad_count <> 0 THEN RAISE EXCEPTION '% requested Cost Groups do not resolve exactly once', bad_count; END IF;

  SELECT count(*) INTO bad_count
  FROM requested_si_v2_mapping r
  WHERE (SELECT count(*) FROM cost_natures n
         JOIN cost_groups g ON g.id = n."costGroupId"
         JOIN cost_companies c ON c.id = g."companyId"
         WHERE c."companyCode" = '2000' AND g.code = r.group_code AND n.code = r.nature_code) <> 1;
  IF bad_count <> 0 THEN RAISE EXCEPTION '% requested Natures do not resolve exactly once under their group', bad_count; END IF;

  SELECT count(*) INTO bad_count
  FROM cost_coa_mappings m
  JOIN cost_companies c ON c.id = m."companyId" AND c."companyCode" = '2000'
  JOIN cost_coas coa ON coa.id = m."coaId"
  JOIN requested_si_v2_mapping r ON r.source_code = m."sourceLogicalCode" AND r.coa_code = coa."coaCode"
  LEFT JOIN cost_natures n ON n.id = m."natureId"
  WHERE m.active AND m."validFrom" = DATE '2026-07-01' AND m."validTo" IS NULL
    AND m."mappingAction" = r.predecessor_action
    AND (r.predecessor_nature_code IS NULL OR n.code = r.predecessor_nature_code);
  IF bad_count <> 6 THEN RAISE EXCEPTION 'Predecessor mapping count %, expected exactly 6', bad_count; END IF;

  SELECT count(*) INTO bad_count
  FROM requested_si_v2_mapping r
  WHERE (SELECT count(*) FROM cost_coa_mappings m
         JOIN cost_companies c ON c.id = m."companyId" AND c."companyCode" = '2000'
         JOIN cost_coas coa ON coa.id = m."coaId" AND coa."coaCode" = r.coa_code
         WHERE m."sourceLogicalCode" = r.source_code AND m.active
           AND m."validFrom" <= DATE '2026-07-01'
           AND (m."validTo" IS NULL OR m."validTo" >= DATE '2026-07-01')) <> 1;
  IF bad_count <> 0 THEN RAISE EXCEPTION '% requested keys have ambiguous/missing effective predecessors', bad_count; END IF;
END $$;

-- These are initial 2026-07-01 configuration corrections. Transform exactly the six predecessor
-- rows in place; immutable calculation-run mappingSnapshotJson retains historical V1 evidence.
UPDATE cost_coa_mappings m
SET "costGroupId" = g.id,
    "natureId" = n.id,
    "mappingAction" = 'INCLUDE'::"CostMappingAction",
    note = 'ENGINE1_2000_V2 reviewed SI mapping correction',
    "updatedAt" = CURRENT_TIMESTAMP
FROM requested_si_v2_mapping r
JOIN cost_companies c ON c."companyCode" = '2000'
JOIN cost_coas coa ON coa."coaCode" = r.coa_code
JOIN cost_groups g ON g."companyId" = c.id AND g.code = r.group_code
JOIN cost_natures n ON n."costGroupId" = g.id AND n.code = r.nature_code
WHERE m."companyId" = c.id AND m."coaId" = coa.id
  AND m."sourceLogicalCode" = r.source_code
  AND m.active AND m."validFrom" = DATE '2026-07-01' AND m."validTo" IS NULL;

-- Prove the resulting effective set has exactly six unambiguous, correctly targeted mappings.
DO $$
DECLARE
  effective_count integer;
  ambiguous_count integer;
  wrong_target_count integer;
BEGIN
  SELECT count(*) INTO effective_count
  FROM cost_coa_mappings m
  JOIN cost_companies c ON c.id = m."companyId" AND c."companyCode" = '2000'
  JOIN cost_coas coa ON coa.id = m."coaId"
  JOIN requested_si_v2_mapping r ON r.source_code = m."sourceLogicalCode" AND r.coa_code = coa."coaCode"
  WHERE m.active AND m."validFrom" <= DATE '2026-07-01'
    AND (m."validTo" IS NULL OR m."validTo" >= DATE '2026-07-01');
  IF effective_count <> 6 THEN RAISE EXCEPTION 'Post-change effective mapping count %, expected 6', effective_count; END IF;

  SELECT count(*) INTO ambiguous_count FROM requested_si_v2_mapping r
  WHERE (SELECT count(*) FROM cost_coa_mappings m
         JOIN cost_companies c ON c.id = m."companyId" AND c."companyCode" = '2000'
         JOIN cost_coas coa ON coa.id = m."coaId" AND coa."coaCode" = r.coa_code
         WHERE m."sourceLogicalCode" = r.source_code AND m.active
           AND m."validFrom" <= DATE '2026-07-01'
           AND (m."validTo" IS NULL OR m."validTo" >= DATE '2026-07-01')) <> 1;
  IF ambiguous_count <> 0 THEN RAISE EXCEPTION '% requested keys have post-change overlap/ambiguity', ambiguous_count; END IF;

  SELECT count(*) INTO wrong_target_count
  FROM requested_si_v2_mapping r
  JOIN cost_companies c ON c."companyCode" = '2000'
  JOIN cost_coas coa ON coa."coaCode" = r.coa_code
  JOIN cost_coa_mappings m ON m."companyId" = c.id AND m."coaId" = coa.id
    AND m."sourceLogicalCode" = r.source_code AND m.active
    AND m."validFrom" <= DATE '2026-07-01' AND (m."validTo" IS NULL OR m."validTo" >= DATE '2026-07-01')
  JOIN cost_groups g ON g.id = m."costGroupId"
  JOIN cost_natures n ON n.id = m."natureId"
  WHERE m."mappingAction" <> 'INCLUDE'::"CostMappingAction"
     OR g.code <> r.group_code OR n.code <> r.nature_code OR n."costGroupId" <> g.id;
  IF wrong_target_count <> 0 THEN RAISE EXCEPTION '% requested mappings have incorrect final targets', wrong_target_count; END IF;
END $$;

-- Replace only through a separately approved controlled Supabase operation.
ROLLBACK;
