import type { LogicalSourceCode } from './types';

type Definition = { code: LogicalSourceCode; companies: string[]; required: boolean; aliases: string[] };
const definitions: Definition[] = [
  { code:'TB', companies:['2000','7000'], required:true, aliases:['TB'] },
  { code:'CC_PROD', companies:['2000','7000'], required:true, aliases:['CC PROD','CC_PROD'] },
  { code:'CC_ADUM', companies:['2000','7000'], required:true, aliases:['CC ADUM','CC_ADUM','CC ADM','CC_ADM'] },
  { code:'CC_PASAR', companies:['2000','7000'], required:true, aliases:['CC PASAR','CC_PASAR'] },
  { code:'CC_WHRPG', companies:['7000'], required:true, aliases:['CC WHRPG','CC_WHRPG','WHRPG'] },
  { code:'COAL', companies:['7000'], required:true, aliases:['COAL','BATU BARA'] },
  { code:'CLINKER_PURCHASE', companies:['7000'], required:true, aliases:['CLINKER PURCHASE','CLINKER_PURCHASE','BELI'] },
  { code:'SOLAR_PP_ORDER', companies:['7000'], required:true, aliases:['SOLAR PP ORDER','SOLAR_PP_ORDER'] },
  { code:'OA_STAT', companies:['7000'], required:true, aliases:['OA STAT','OA_STAT','STATISTICAL PASAR'] },
  { code:'ADJUSTMENT', companies:['2000','7000'], required:false, aliases:['ADJUSTMENT'] },

  // Audit-only worksheet snapshots. They are persisted for DB-only Excel export and never
  // participate in source reconciliation, mapping completeness, or Engine 1 contribution.
  { code:'AUDIT_SI', companies:['2000'], required:false, aliases:['SI'] },
  { code:'AUDIT_GHOPO', companies:['7000'], required:false, aliases:['GHOPO'] },
  { code:'AUDIT_DERIV', companies:['7000'], required:false, aliases:['DERIV'] },
  { code:'AUDIT_RINCIAN', companies:['2000','7000'], required:false, aliases:['RINCIAN BIAYA'] },
  { code:'AUDIT_CC_DRV', companies:['2000','7000'], required:false, aliases:['CC DRV','CC_DRV','CC DERIVATIF'] },
  { code:'AUDIT_SI2000_DRV', companies:['7000'], required:false, aliases:['SI2000 DRV','SI2000_DRV'] },
];
export const normalizeLabel = (v: string) => v.trim().toUpperCase().replace(/[\s_.-]+/g, ' ');
export function sourceDefinitions(companyCode: string) { return definitions.filter((d) => d.companies.includes(companyCode)); }
export function detectSource(sheetName: string, companyCode: string) { const n=normalizeLabel(sheetName); return sourceDefinitions(companyCode).find((d)=>d.aliases.some((a)=>normalizeLabel(a)===n)); }
