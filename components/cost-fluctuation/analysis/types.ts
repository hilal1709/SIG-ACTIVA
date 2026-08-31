export type NodeType = 'COMPANY' | 'ANALYSIS_BASIS' | 'COST_GROUP' | 'NATURE' | 'COA' | 'CALCULATED_ITEM';

export type AnalysisNode = {
  key: string;
  id: number | null;
  code: string;
  label: string;
  nodeType: NodeType;
  currentAmount: string;
  comparisonAmount: string;
  varianceAmount: string;
  variancePercent: string | null;
  variancePercentStatus: string;
  contribution: string | null;
  contributionStatus: string;
  contributionBasis: string | null;
  materialityStatus?: string;
  lineType?: string;
  ruleCode?: string | null;
  children?: AnalysisNode[];
};

export type Commentary = { id: number; analysisKey: string; status: string; reason: string };
export type AnalysisResponse = {
  kind?: string;
  status?: string;
  comparisonType?: string;
  comparisonLabel?: string;
  hierarchy?: AnalysisNode[];
  commentaries?: Commentary[];
  error?: string;
  code?: string;
};

export type Filters = {
  group: string;
  nature: string;
  materialOnly: boolean;
  needsCommentary: boolean;
};
