export type NodeType = 'COMPANY' | 'ANALYSIS_BASIS' | 'COST_GROUP' | 'NATURE' | 'COA' | 'CALCULATED_ITEM';

export type SuggestedParetoDriver = {
  key: string;
  code: string;
  label: string;
  nodeType: NodeType;
  varianceAmount: string;
  rank: number;
  grossImpactShare: string;
  direction: 'PRIMARY' | 'OFFSET' | 'NEUTRAL';
};

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
  suggestedCommentary?: { text: string; metadata: Record<string, unknown>; drivers: SuggestedParetoDriver[] };
};

export type Commentary = {
  id: number;
  analysisKey: string;
  status: string;
  reason: string;
  generatedText?: string | null;
  reviewerNote?: string | null;
  preparedBy?: { id: number; name: string };
  reviewedBy?: { id: number; name: string };
  history?: Array<{ id: number; version: number; status: string; reason: string; reviewerNote?: string | null }>;
};

export type AnalysisResponse = {
  kind?: string;
  status?: string;
  comparisonType?: string;
  comparisonLabel?: string;
  hierarchy?: AnalysisNode[];
  commentaries?: Commentary[];
  analysisLineageKey?: string;
  error?: string;
  code?: string;
};

export type Filters = {
  group: string;
  nature: string;
  materialOnly: boolean;
  needsCommentary: boolean;
};
