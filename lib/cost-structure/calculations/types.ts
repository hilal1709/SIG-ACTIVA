import { Prisma } from '@prisma/client';

export type Company2000GroupCode = 'ADUM' | 'PASAR';
export type Company7000GroupCode = 'HPP' | 'ADUM' | 'PASAR';

export type ResolvedSourceLine = {
  sourceRowId: number;
  uploadId: number;
  uploadVersion: number;
  logicalSourceCode: string;
  sourceRowNumber: number;
  coaId: number;
  coaCode: string;
  amount: Prisma.Decimal;
  disposition: 'MAPPED' | 'RECLASSIFIED' | 'EXCLUDED' | 'CONTROL_ROW' | 'SUPPORT_SOURCE' | 'UNMAPPED';
  mappingId?: number;
  mappingAction?: 'INCLUDE' | 'EXCLUDE' | 'RECLASS';
  costGroupId?: number;
  groupCode?: string;
  natureId?: number;
  natureCode?: string;
  targetActive?: boolean;
  natureCalculationType?: string;
  applicableMappingCount?: number;
};

export type ResolvedAdjustment = {
  adjustmentId: number;
  costGroupId: number;
  groupCode: string;
  natureId: number;
  natureCode: string;
  coaId: number | null;
  amount: Prisma.Decimal;
  reason: string;
  reference: string | null;
  targetActive: boolean;
  natureCalculationType: string;
};

export type EngineActualLine = {
  costGroupId: number;
  natureId: number;
  coaId: number | null;
  lineType: 'COA' | 'FORMULA' | 'RESIDUAL' | 'ADJUSTMENT';
  sourceAmount: Prisma.Decimal | null;
  adjustmentAmount: Prisma.Decimal;
  finalAmount: Prisma.Decimal;
  sourceRowId: number | null;
  sourceReference: Record<string, unknown>;
  ruleCode?: string;
};

export type Company7000NatureTarget = {
  costGroupId: number;
  natureId: number;
  groupCode: Company7000GroupCode;
  natureCode: string;
  calculationType: 'MAPPED' | 'FORMULA' | 'RESIDUAL';
  ruleCode?: string | null;
  active: boolean;
};

export type FormulaDependency = {
  amount: Prisma.Decimal;
  logicalSourceCode: string;
  sourceRowIds: number[];
  sourceReference: Record<string, unknown>;
};

export type EngineResult = {
  actualLines: EngineActualLine[];
  natureTotals: Array<{ costGroupId: number; natureId: number; groupCode: Company2000GroupCode; natureCode: string; amount: Prisma.Decimal }>;
  groupTotals: Record<Company2000GroupCode, Prisma.Decimal>;
  companyTotal: Prisma.Decimal;
  controls: Array<{ resultCode: string; costGroupId: number; amount: Prisma.Decimal; difference: Prisma.Decimal }>;
};
