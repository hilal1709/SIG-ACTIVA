export type MonthlyResult = {
  id: number;
  resultType: string;
  resultCode: string;
  amount: string;
  reconciliationStatus: string | null;
  reconciliationDifference: string | null;
  costGroupCode: string | null;
  natureName: string | null;
  natureCode: string | null;
  natureCalculationType: string | null;
};

export type MonthlyPeriod = {
  id: number;
  companyCode: string;
  fiscalYear: number;
  fiscalPeriod: number;
  status: string;
  upload: { version: number; status: string } | null;
  run: {
    runNumber: number;
    status: string;
    ruleSetVersion: string;
    completedAt: string | null;
    errorMessage: string | null;
    actualLineCount: number;
    results: MonthlyResult[];
  } | null;
};

export type CompanyFilter = 'ALL' | string;
export type StatusFilter = 'ALL' | string;
