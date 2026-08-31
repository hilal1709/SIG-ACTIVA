import { ZERO } from './math';
import { money, ratio, variance } from './math';
import type { AnalyticalSnapshot, ComparedNode, SnapshotItem } from './types';

type TreeItem = SnapshotItem & { children?: TreeItem[]; nodeType: ComparedNode['nodeType'] };
const tree = (snapshot: AnalyticalSnapshot): TreeItem => ({ key: `company:${snapshot.companyId}`, id: snapshot.companyId, code: snapshot.companyCode, label: `Company ${snapshot.companyCode}`, amount: snapshot.amount, order: 0, nodeType: 'COMPANY', children: snapshot.groups.map((g) => ({ ...g, nodeType: 'COST_GROUP', children: g.natures.map((n) => ({ ...n, nodeType: 'NATURE', children: n.items.map((i) => ({ ...i, nodeType: i.id ? 'COA' : 'CALCULATED_ITEM' })) })) })) });

function compareNode(current: TreeItem | undefined, comparison: TreeItem | undefined, parentVariance?: import('@prisma/client').Prisma.Decimal): ComparedNode {
  const identity = current ?? comparison!;
  const currentAmount = current?.amount ?? ZERO; const comparisonAmount = comparison?.amount ?? ZERO;
  const calculated = variance(currentAmount, comparisonAmount);
  const contribution = parentVariance === undefined ? { value: null, status: 'NOT_APPLICABLE' as const } : ratio(calculated.amount, parentVariance, 'PARENT_ZERO');
  const currentChildren = new Map((current?.children ?? []).map((item) => [item.key, item]));
  const comparisonChildren = new Map((comparison?.children ?? []).map((item) => [item.key, item]));
  const keys = [...new Set([...currentChildren.keys(), ...comparisonChildren.keys()])].sort((a, b) => { const left = currentChildren.get(a) ?? comparisonChildren.get(a)!; const right = currentChildren.get(b) ?? comparisonChildren.get(b)!; return left.order - right.order || left.code.localeCompare(right.code) || left.key.localeCompare(right.key); });
  return { key: identity.key, id: identity.id, code: identity.code, label: identity.label, nodeType: identity.nodeType, order: identity.order, lineType: identity.lineType, ruleCode: identity.ruleCode,
    currentAmount: money(currentAmount), comparisonAmount: money(comparisonAmount), varianceAmount: money(calculated.amount), variancePercent: calculated.percent, variancePercentStatus: calculated.status,
    contribution: contribution.value, contributionStatus: contribution.status, contributionBasis: parentVariance === undefined ? null : `${identity.nodeType}_VARIANCE_TO_PARENT_VARIANCE`,
    ...(keys.length ? { children: keys.map((key) => compareNode(currentChildren.get(key), comparisonChildren.get(key), calculated.amount)) } : {}),
  };
}
export const compareSnapshots = (current: AnalyticalSnapshot, comparison: AnalyticalSnapshot) => compareNode(tree(current), tree(comparison));
