export const COMPANY_2000_CODE = '2000';
export const COMPANY_2000_GROUPS = ['ADUM', 'PASAR'] as const;
// Verified July-2026 golden workbook derives Company 2000 Cost Structure from cc_adm and cc pasar only.
// cc_prod is a structural workbook sheet and must not contribute to ADUM/PASAR.
export const COMPANY_2000_SOURCES = ['CC_ADUM', 'CC_PASAR'] as const;
export const DERIVATIVE_SOURCE_CODES = ['DERIVATIF', 'CC_DERIVATIF', 'CC_DRV'] as const;
export const ENGINE1_2000_RULE_SET_VERSION = 'ENGINE1_2000_V1';

