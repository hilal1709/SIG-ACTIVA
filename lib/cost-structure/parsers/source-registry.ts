import type { LogicalSourceCode } from './types';

type Definition = { code: LogicalSourceCode; companies: string[]; required: boolean; aliases: string[] };
const definitions: Definition[] = [
  { code:'TB', companies:['2000','7000'], required:true, aliases:['TB'] },
  { code:'CC_PROD', companies:['2000','7000'], required:true, aliases:['CC PROD','CC_PROD'] },
  { code:'CC_ADUM', companies:['2000','7000'], required:true, aliases:['CC ADUM','CC_ADUM','CC ADM','CC_ADM'] },
  { code:'CC_PASAR', companies:['2000','7000'], required:true, aliases:['CC PASAR','CC_PASAR'] },
  { code:'CC_WHRPG', companies:['7000'], required:true, aliases:['CC WHRPG','CC_WHRPG'] },
  { code:'COAL', companies:['7000'], required:true, aliases:['COAL'] },
  { code:'CLINKER_PURCHASE', companies:['7000'], required:true, aliases:['CLINKER PURCHASE','CLINKER_PURCHASE'] },
  { code:'SOLAR_PP_ORDER', companies:['7000'], required:true, aliases:['SOLAR PP ORDER','SOLAR_PP_ORDER'] },
  { code:'OA_STAT', companies:['7000'], required:true, aliases:['OA STAT','OA_STAT'] },
  { code:'ADJUSTMENT', companies:['2000','7000'], required:false, aliases:['ADJUSTMENT'] },
];
export const normalizeLabel = (v: string) => v.trim().toUpperCase().replace(/[\s_.-]+/g, ' ');
export function sourceDefinitions(companyCode: string) { return definitions.filter((d) => d.companies.includes(companyCode)); }
export function detectSource(sheetName: string, companyCode: string) { const n=normalizeLabel(sheetName); return sourceDefinitions(companyCode).find((d)=>d.aliases.some((a)=>normalizeLabel(a)===n)); }
