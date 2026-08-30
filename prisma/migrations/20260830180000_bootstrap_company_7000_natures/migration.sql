-- Phase F reviewed Supabase DDL: idempotent Company 7000 Nature master bootstrap only.
-- This file is not intended to replay the legacy Prisma migration chain in production.
WITH requested("groupCode", "code", "name", "calculationType", "ruleCode", "displayOrder") AS (
  VALUES
    ('HPP','H01','Bahan Baku','MAPPED'::"CostNatureCalculationType",NULL,1),
    ('HPP','H02','Bahan Penolong','MAPPED'::"CostNatureCalculationType",NULL,2),
    ('HPP','H03','Kemasan','MAPPED'::"CostNatureCalculationType",NULL,3),
    ('HPP','H04','Batubara','FORMULA'::"CostNatureCalculationType",'COAL_7000_EXISTING',4),
    ('HPP','H05','Batubara Inbound','FORMULA'::"CostNatureCalculationType",'COAL_INBOUND_7000_EXISTING',5),
    ('HPP','H06','Bahan Bakar lainnya','MAPPED'::"CostNatureCalculationType",NULL,6),
    ('HPP','H07','Listrik','MAPPED'::"CostNatureCalculationType",NULL,7),
    ('HPP','H08','Tenaga Kerja','MAPPED'::"CostNatureCalculationType",NULL,8),
    ('HPP','H09','Pemeliharaan','MAPPED'::"CostNatureCalculationType",NULL,9),
    ('HPP','H10','Penyusutan & Amortisasi','MAPPED'::"CostNatureCalculationType",NULL,10),
    ('HPP','H11','Urusan Umum & Adm. Kantor','MAPPED'::"CostNatureCalculationType",NULL,11),
    ('HPP','H12','Perniagaan','MAPPED'::"CostNatureCalculationType",NULL,12),
    ('HPP','H13','Pajak dan Asuransi','MAPPED'::"CostNatureCalculationType",NULL,13),
    ('HPP','H14','Pembelian Terak','MAPPED'::"CostNatureCalculationType",NULL,14),
    ('HPP','H15','Ongkos Angkut FG dan WIP','MAPPED'::"CostNatureCalculationType",NULL,15),
    ('HPP','H16','Selisih Persediaan','RESIDUAL'::"CostNatureCalculationType",'HPP_INVENTORY_DIFF_7000',16),
    ('ADUM','N01','Bahan Penolong','MAPPED'::"CostNatureCalculationType",NULL,1),
    ('ADUM','N02','Bahan Bakar','MAPPED'::"CostNatureCalculationType",NULL,2),
    ('ADUM','N03','Energi Listrik','MAPPED'::"CostNatureCalculationType",NULL,3),
    ('ADUM','N04','Tenaga Kerja','MAPPED'::"CostNatureCalculationType",NULL,4),
    ('ADUM','N05','Pemeliharaan','MAPPED'::"CostNatureCalculationType",NULL,5),
    ('ADUM','N06','Deplesi, Penyusutan & Amortisasi','MAPPED'::"CostNatureCalculationType",NULL,6),
    ('ADUM','N07','Umum & Adm. Kantor','MAPPED'::"CostNatureCalculationType",NULL,7),
    ('ADUM','N08','Perniagaan','MAPPED'::"CostNatureCalculationType",NULL,8),
    ('ADUM','N09','Pajak & Asuransi','MAPPED'::"CostNatureCalculationType",NULL,9),
    ('PASAR','N01','Bahan Penolong','MAPPED'::"CostNatureCalculationType",NULL,1),
    ('PASAR','N02','Bahan Bakar','MAPPED'::"CostNatureCalculationType",NULL,2),
    ('PASAR','N03','Energi Listrik','MAPPED'::"CostNatureCalculationType",NULL,3),
    ('PASAR','N04','Tenaga Kerja','MAPPED'::"CostNatureCalculationType",NULL,4),
    ('PASAR','N05','Pemeliharaan','MAPPED'::"CostNatureCalculationType",NULL,5),
    ('PASAR','N06','Deplesi, Penyusutan & Amortisasi','MAPPED'::"CostNatureCalculationType",NULL,6),
    ('PASAR','N07','Umum & Adm. Kantor','MAPPED'::"CostNatureCalculationType",NULL,7),
    ('PASAR','N08','Perniagaan','MAPPED'::"CostNatureCalculationType",NULL,8),
    ('PASAR','N09','Pajak & Asuransi','MAPPED'::"CostNatureCalculationType",NULL,9),
    ('PASAR','OA','OA','FORMULA'::"CostNatureCalculationType",'OA_7000_EXISTING',10)
)
INSERT INTO "cost_natures" ("costGroupId", "code", "name", "calculationType", "ruleCode", "displayOrder", "active", "createdAt", "updatedAt")
SELECT g.id, r."code", r."name", r."calculationType", r."ruleCode", r."displayOrder", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM requested r
JOIN "cost_companies" c ON c."companyCode" = '7000'
JOIN "cost_groups" g ON g."companyId" = c.id AND g.code = r."groupCode"
ON CONFLICT ("costGroupId", "code") DO UPDATE SET
  "name" = EXCLUDED."name", "calculationType" = EXCLUDED."calculationType", "ruleCode" = EXCLUDED."ruleCode",
  "displayOrder" = EXCLUDED."displayOrder", "active" = true, "updatedAt" = CURRENT_TIMESTAMP;
