import ExcelJS from 'exceljs';
import type { ComparedNode, ComparisonType } from '../analysis/types';

type Commentary = {
  analysisKey: string;
  status: string;
  reason: string;
  generatedText?: string | null;
  preparedAt?: Date | null;
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
  reviewerNote?: string | null;
  preparedBy?: { name: string } | null;
  reviewedBy?: { name: string } | null;
};
type SuggestedDriver = { key: string; rank: number; grossImpactShare: string };
type Node = ComparedNode & {
  materialityStatus?: string;
  suggestedCommentary?: { text: string; drivers: SuggestedDriver[] };
};
type ExportData = {
  hierarchy: Node[];
  companyCode?: string;
  comparisonLabel: string;
  analysisLineageKey: string;
  commentaries: Commentary[];
};

const safe = (value: string | null | undefined) => value && /^[=+\-@]/.test(value) ? `'${value}` : value ?? '';
const num = (value: string | null) => value === null ? null : Number(value);

export async function buildFluctuationWorkbook(data: ExportData, comparisonType: ComparisonType, generatedAt = new Date()) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIG ACTIVA';
  workbook.created = generatedAt;

  const root = data.hierarchy[0];
  const comments = new Map(data.commentaries.map((row) => [row.analysisKey, row]));
  const allNodes = flatten(data.hierarchy);

  const summary = workbook.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 1 }] });
  summary.addRow(['Analisis Fluktuasi SIG ACTIVA', 'Nilai']);
  [
    ['Company Code', root?.code ?? data.companyCode ?? ''],
    ['Comparison Type', comparisonType],
    ['Comparison Label', data.comparisonLabel],
    ['Generated At', generatedAt],
    ['Analysis Lineage Key', data.analysisLineageKey],
    ['Current Total', num(root?.currentAmount ?? '0')],
    ['Comparison Total', num(root?.comparisonAmount ?? '0')],
    ['Variance', num(root?.varianceAmount ?? '0')],
    ['Variance %', root?.variancePercent === null ? null : Number(root?.variancePercent ?? 0) / 100],
    ['Requires Commentary', allNodes.filter((node) => node.materialityStatus === 'REQUIRES_EXPLANATION').length],
  ].forEach((row) => summary.addRow(row));

  allNodes
    .filter((node) => ['COST_GROUP', 'NATURE'].includes(node.nodeType) && Number(node.varianceAmount) !== 0)
    .sort((a, b) => Math.abs(Number(b.varianceAmount)) - Math.abs(Number(a.varianceAmount)) || a.key.localeCompare(b.key))
    .slice(0, 10)
    .forEach((node, index) => summary.addRow([`Major Driver ${index + 1}`, `${node.nodeType} · ${node.code} · ${node.label} · ${node.varianceAmount}`]));
  summary.getColumn(1).width = 28;
  summary.getColumn(2).width = 80;
  summary.getColumn(2).numFmt = '#,##0.00;[Red]-#,##0.00';
  style(summary, 1);

  const detail = workbook.addWorksheet('Detail Analysis', { views: [{ state: 'frozen', ySplit: 1 }] });
  const headers = ['Company Code', 'Current Period', 'Comparison Type', 'Comparison Period/Range', 'Analysis Basis', 'Node Type', 'Cost Group', 'Nature', 'COA / Calculated Item', 'Description', 'Current Amount', 'Comparison Amount', 'Variance Amount', 'Variance %', 'Variance % Status', 'Contribution', 'Contribution Basis', 'Pareto Rank', 'Gross Impact Share', 'Materiality Status', 'Commentary Status', 'Commentary Text', 'Generated Commentary', 'Analysis Key'];
  detail.addRow(headers);
  for (const row of flattenWithContext(data.hierarchy)) {
    const comment = comments.get(row.node.key);
    const driver = row.parent?.suggestedCommentary?.drivers.find((candidate) => candidate.key === row.node.key);
    detail.addRow([
      root?.code ?? '',
      data.comparisonLabel.split(' vs ')[0] ?? '',
      comparisonType,
      data.comparisonLabel,
      row.basis,
      row.node.nodeType,
      row.group,
      row.nature,
      row.item,
      row.node.label,
      num(row.node.currentAmount),
      num(row.node.comparisonAmount),
      num(row.node.varianceAmount),
      row.node.variancePercent === null ? null : Number(row.node.variancePercent) / 100,
      row.node.variancePercentStatus,
      row.node.contribution === null ? null : Number(row.node.contribution) / 100,
      row.node.contributionBasis,
      driver?.rank ?? null,
      driver ? Number(driver.grossImpactShare) : null,
      row.node.materialityStatus ?? '',
      comment?.status ?? '',
      safe(comment?.reason),
      safe(comment?.generatedText ?? row.node.suggestedCommentary?.text),
      row.node.key,
    ]);
  }
  formatTable(detail, headers.length);

  const governance = workbook.addWorksheet('Commentary & Review', { views: [{ state: 'frozen', ySplit: 1 }] });
  const governanceHeaders = ['Analytical Target', 'Node Type', 'Materiality Status', 'Generated Baseline', 'User Commentary', 'Status', 'Prepared By', 'Prepared At', 'Submitted At', 'Reviewer', 'Reviewer Note', 'Reviewed At', 'Analysis Lineage Key'];
  governance.addRow(governanceHeaders);
  for (const row of allNodes.filter((node) => !['COMPANY', 'ANALYSIS_BASIS'].includes(node.nodeType))) {
    const commentary = comments.get(row.key);
    governance.addRow([
      row.label,
      row.nodeType,
      row.materialityStatus ?? '',
      safe(commentary?.generatedText ?? row.suggestedCommentary?.text),
      safe(commentary?.reason),
      commentary?.status ?? 'OPEN',
      commentary?.preparedBy?.name ?? '',
      commentary?.preparedAt ?? null,
      commentary?.submittedAt ?? null,
      commentary?.reviewedBy?.name ?? '',
      safe(commentary?.reviewerNote),
      commentary?.reviewedAt ?? null,
      data.analysisLineageKey,
    ]);
  }
  formatTable(governance, governanceHeaders.length);
  return workbook;
}

function flatten(nodes: Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...flatten((node.children ?? []) as Node[])]);
}

function flattenWithContext(
  nodes: Node[],
  context = { basis: '', group: '', nature: '' },
  parent?: Node,
): Array<{ node: Node; basis: string; group: string; nature: string; item: string; parent?: Node }> {
  return nodes.flatMap((node) => {
    const next = {
      basis: node.nodeType === 'ANALYSIS_BASIS' ? node.code : context.basis,
      group: node.nodeType === 'COST_GROUP' ? node.label : context.group,
      nature: node.nodeType === 'NATURE' ? node.label : context.nature,
    };
    const item = ['COA', 'CALCULATED_ITEM'].includes(node.nodeType)
      ? node.nodeType === 'COA' ? `${node.code} ${node.label}` : node.label
      : '';
    return [{ node, ...next, item, parent }, ...flattenWithContext((node.children ?? []) as Node[], next, node)];
  });
}

function style(sheet: ExcelJS.Worksheet, header: number) {
  sheet.getRow(header).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(header).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  sheet.autoFilter = { from: { row: header, column: 1 }, to: { row: sheet.rowCount, column: sheet.columnCount } };
}

function formatTable(sheet: ExcelJS.Worksheet, count: number) {
  style(sheet, 1);
  for (let index = 1; index <= count; index += 1) {
    sheet.getColumn(index).width = Math.min(50, Math.max(14, String(sheet.getCell(1, index).value).length + 2));
  }
  for (const index of [11, 12, 13, 14, 16, 19]) {
    sheet.getColumn(index).numFmt = index === 14 || index === 19 ? '0.00%' : '#,##0.00;[Red]-#,##0.00';
  }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: sheet.rowCount, column: count } };
}
