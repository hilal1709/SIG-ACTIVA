-- REVIEW-ONLY controlled data-change plan for ENGINE1_2000_V2.
-- Do not run from application deployment and do not apply without production approval.
-- Stable business identities are resolved by codes; no database IDs are embedded.
BEGIN;

CREATE TEMP TABLE requested_si_v2_mapping (
  source_code text NOT NULL, coa_code text NOT NULL, group_code text NOT NULL, nature_code text NOT NULL
) ON COMMIT DROP;
INSERT INTO requested_si_v2_mapping VALUES
  ('CC_ADUM','63110002','ADUM','N04'),
  ('CC_ADUM','63130015','ADUM','N04'),
  ('CC_PASAR','63130015','PASAR','N04'),
  ('CC_PASAR','66250001','PASAR','N06'),
  ('CC_PASAR','67630009','PASAR','N07'),
  ('CC_PASAR','67640001','PASAR','N07');

-- Preserve history by retiring the superseded effective rows rather than overwriting them.
UPDATE cost_coa_mappings m
SET active = false, "validTo" = DATE '2026-06-30', "updatedAt" = CURRENT_TIMESTAMP
FROM cost_companies c, cost_coas coa, requested_si_v2_mapping r
WHERE m."companyId" = c.id AND c."companyCode" = '2000'
  AND m."coaId" = coa.id AND coa."coaCode" = r.coa_code
  AND m."sourceLogicalCode" = r.source_code AND m.active
  AND m."validFrom" < DATE '2026-07-01';

INSERT INTO cost_coa_mappings
  ("companyId", "sourceLogicalCode", "costGroupId", "natureId", "coaId", "mappingAction",
   "validFrom", "validTo", note, active, "createdById", "createdAt", "updatedAt")
SELECT c.id, r.source_code, g.id, n.id, coa.id, 'INCLUDE'::"CostMappingAction",
       DATE '2026-07-01', NULL, 'ENGINE1_2000_V2 reviewed SI mapping', true, u.id,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM requested_si_v2_mapping r
JOIN cost_companies c ON c."companyCode" = '2000'
JOIN cost_groups g ON g."companyId" = c.id AND g.code = r.group_code
JOIN cost_natures n ON n."costGroupId" = g.id AND n.code = r.nature_code
JOIN cost_coas coa ON coa."coaCode" = r.coa_code
JOIN users u ON u.username = 'admin'
WHERE NOT EXISTS (
  SELECT 1 FROM cost_coa_mappings m
  WHERE m."companyId" = c.id AND m."sourceLogicalCode" = r.source_code
    AND m."coaId" = coa.id AND m."validFrom" = DATE '2026-07-01'
    AND m."costGroupId" = g.id AND m."natureId" = n.id
    AND m."mappingAction" = 'INCLUDE'::"CostMappingAction" AND m.active
);

-- Safety gate: all six stable identities must resolve before an operator may COMMIT.
DO $$ BEGIN
  IF (SELECT count(*) FROM requested_si_v2_mapping) <> 6 THEN RAISE EXCEPTION 'Unexpected SI V2 request set'; END IF;
END $$;

-- Replace with COMMIT only in a separately approved controlled Supabase change.
ROLLBACK;
