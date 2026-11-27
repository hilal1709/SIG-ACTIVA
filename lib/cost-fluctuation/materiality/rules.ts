import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ComparisonType } from '../analysis/types';
import { MATERIALITY_OPERATORS, positiveSafeInteger } from '../validation';
import { parseBusinessDate, predecessorEndForSuccessor } from './business-date';

export interface MaterialityRuleInput {
  companyId: unknown; costGroupId?: unknown; comparisonType: unknown; operator: unknown;
  amountThreshold?: unknown; percentThreshold?: unknown; validFrom: unknown; validTo?: unknown;
}
export interface MaterialitySuccessorInput {
  validFrom: unknown; validTo?: unknown; operator: unknown; amountThreshold?: unknown; percentThreshold?: unknown;
}
const serializable = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;
const farFuture = new Date('9999-12-31T23:59:59.999Z');
function decimal(value: unknown, scale: number) {
  if (value === null || value === undefined || value === '') return null;
  try { return new Prisma.Decimal(String(value)).toDecimalPlaces(scale); } catch { throw new Error('Threshold must be a valid decimal.'); }
}
function values(input: Pick<MaterialityRuleInput, 'amountThreshold'|'percentThreshold'|'operator'|'validFrom'|'validTo'>) {
  const amountThreshold = decimal(input.amountThreshold, 2), percentThreshold = decimal(input.percentThreshold, 6);
  if (!amountThreshold && !percentThreshold) throw new Error('At least one threshold is required.');
  if (amountThreshold?.isNegative() || percentThreshold?.isNegative()) throw new Error('Thresholds must be non-negative.');
  if (typeof input.operator !== 'string' || !MATERIALITY_OPERATORS.includes(input.operator as 'AND'|'OR')) throw new Error('operator must be AND or OR.');
  const validFrom = parseBusinessDate(input.validFrom, 'validFrom', 'start')!, validTo = parseBusinessDate(input.validTo, 'validTo', 'end', true);
  if (validTo && validTo < validFrom) throw new Error('validTo must not precede validFrom.');
  return { amountThreshold, percentThreshold, operator: input.operator as 'AND'|'OR', validFrom, validTo };
}
async function scopeLock(tx: Prisma.TransactionClient, companyId: number, costGroupId: number | null, comparisonType: ComparisonType) {
  const scope = `cost-materiality:${companyId}:${costGroupId ?? 'all'}:${comparisonType}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))`;
}
async function assertScope(tx: Prisma.TransactionClient, companyId: number, costGroupId: number | null) {
  const company = await tx.costCompany.findFirst({ where: { id: companyId, active: true } });
  if (!company) throw new Error('Active Company not found.');
  if (costGroupId && !await tx.costGroup.findFirst({ where: { id: costGroupId, companyId, active: true } })) throw new Error('Active Cost Group is outside Company scope.');
}
async function assertNoOverlap(tx: Prisma.TransactionClient, scope: { companyId:number;costGroupId:number|null;comparisonType:ComparisonType }, validFrom: Date, validTo: Date|null, excludeId?:number) {
  const overlap = await tx.costMaterialityRule.findFirst({ where: { ...scope, active: true, ...(excludeId ? { id: { not: excludeId } } : {}), validFrom: { lte: validTo ?? farFuture }, OR: [{ validTo: null }, { validTo: { gte: validFrom } }] } });
  if (overlap) throw new Error('An active materiality rule overlaps this exact scope.');
 }
export async function createMaterialityRule(input: MaterialityRuleInput, userId: number) {
  positiveSafeInteger(userId, 'userId');
  const companyId = positiveSafeInteger(input.companyId, 'companyId');
  const costGroupId = input.costGroupId == null || input.costGroupId === '' ? null : positiveSafeInteger(input.costGroupId, 'costGroupId');
  if (typeof input.comparisonType !== 'string' || !['MOM','YOY','YTD'].includes(input.comparisonType)) throw new Error('comparisonType must be MOM, YOY, or YTD.');
  const comparisonType = input.comparisonType as ComparisonType, configured = values(input);
  return prisma.$transaction(async tx => {
    await scopeLock(tx, companyId, costGroupId, comparisonType); await assertScope(tx, companyId, costGroupId);
    await assertNoOverlap(tx, { companyId, costGroupId, comparisonType }, configured.validFrom, configured.validTo);
    const rule = await tx.costMaterialityRule.create({ data: { companyId, costGroupId, comparisonType, ...configured, createdById: userId } });
    await tx.costAuditLog.create({ data: { userId, action: 'CHANGE_MATERIALITY', entityType: 'CostMaterialityRule', entityId: String(rule.id), newValueJson: { companyId, costGroupId, comparisonType, amountThreshold: configured.amountThreshold?.toString() ?? null, percentThreshold: configured.percentThreshold?.toString() ?? null, operator: configured.operator, validFrom: configured.validFrom.toISOString(), validTo: configured.validTo?.toISOString() ?? null } } });
    return rule;
  }, serializable);
}

/** Inclusive intervals: predecessor ends exactly one millisecond before successor starts. */
export async function createMaterialitySuccessor(ruleId: number, input: MaterialitySuccessorInput, userId: number) {
  positiveSafeInteger(ruleId, 'ruleId'); positiveSafeInteger(userId, 'userId'); const configured = values(input);
  return prisma.$transaction(async tx => {
    const predecessor = await tx.costMaterialityRule.findUnique({ where: { id: ruleId } }); if (!predecessor || !predecessor.active) throw new Error('Active predecessor rule not found.');
    await scopeLock(tx, predecessor.companyId, predecessor.costGroupId, predecessor.comparisonType);
    const locked = await tx.costMaterialityRule.findUniqueOrThrow({ where: { id: ruleId } });
    if (!locked.active || configured.validFrom <= locked.validFrom) throw new Error('Successor validFrom must be after predecessor validFrom.');
    const predecessorEnd = predecessorEndForSuccessor(configured.validFrom);
    if (locked.validTo && predecessorEnd > locked.validTo) throw new Error('Successor must start within or immediately after the predecessor interval.');
    await assertScope(tx, locked.companyId, locked.costGroupId);
    await assertNoOverlap(tx, { companyId: locked.companyId, costGroupId: locked.costGroupId, comparisonType: locked.comparisonType }, configured.validFrom, configured.validTo, locked.id);
    const updated = await tx.costMaterialityRule.update({ where: { id: locked.id }, data: { validTo: predecessorEnd } });
    const successor = await tx.costMaterialityRule.create({ data: { companyId: locked.companyId, costGroupId: locked.costGroupId, comparisonType: locked.comparisonType, ...configured, createdById: userId } });
    await tx.costAuditLog.create({ data: { userId, action: 'CHANGE_MATERIALITY', entityType: 'CostMaterialityRule', entityId: String(successor.id), oldValueJson: { id: locked.id, validTo: locked.validTo?.toISOString() ?? null }, newValueJson: { predecessorId: updated.id, predecessorValidTo: predecessorEnd.toISOString(), successorId: successor.id, validFrom: successor.validFrom.toISOString(), amountThreshold: successor.amountThreshold?.toString() ?? null, percentThreshold: successor.percentThreshold?.toString() ?? null, operator: successor.operator } } });
    return { predecessor: updated, successor };
  }, serializable);
}
