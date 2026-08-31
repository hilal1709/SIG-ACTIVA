import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ComparisonType } from '../analysis/types';

const decimal = (value: unknown, scale: number) => value === null || value === undefined || value === '' ? null : new Prisma.Decimal(String(value)).toDecimalPlaces(scale);
export async function createMaterialityRule(input: Record<string, unknown>, userId: number) {
  const companyId = Number(input.companyId), costGroupId = input.costGroupId ? Number(input.costGroupId) : null;
  const comparisonType = String(input.comparisonType) as ComparisonType, operator = String(input.operator);
  const amountThreshold = decimal(input.amountThreshold, 2), percentThreshold = decimal(input.percentThreshold, 6);
  const validFrom = new Date(String(input.validFrom)), validTo = input.validTo ? new Date(String(input.validTo)) : null;
  if (!Number.isInteger(companyId) || !['MOM','YOY','YTD'].includes(comparisonType) || !['AND','OR'].includes(operator)) throw new Error('Invalid rule scope or operator.');
  if (!amountThreshold && !percentThreshold) throw new Error('At least one threshold is required.');
  if (amountThreshold?.isNegative() || percentThreshold?.isNegative()) throw new Error('Thresholds must be non-negative.');
  if (Number.isNaN(validFrom.valueOf()) || (validTo && validTo < validFrom)) throw new Error('Invalid effective interval.');
  if (costGroupId && !await prisma.costGroup.findFirst({ where: { id: costGroupId, companyId } })) throw new Error('Cost Group is outside Company scope.');
  const overlap = await prisma.costMaterialityRule.findFirst({ where: { companyId, costGroupId, comparisonType, active: true, validFrom: { lte: validTo ?? new Date('9999-12-31') }, OR: [{ validTo: null }, { validTo: { gte: validFrom } }] } });
  if (overlap) throw new Error('An active materiality rule overlaps this exact scope. End-date it before creating a successor.');
  return prisma.$transaction(async tx => {
    const rule = await tx.costMaterialityRule.create({ data: { companyId, costGroupId, comparisonType, amountThreshold, percentThreshold, operator: operator as 'AND'|'OR', validFrom, validTo, createdById: userId } });
    await tx.costAuditLog.create({ data: { userId, action: 'CHANGE_MATERIALITY', entityType: 'CostMaterialityRule', entityId: String(rule.id), newValueJson: { companyId, costGroupId, comparisonType, amountThreshold: amountThreshold?.toString() ?? null, percentThreshold: percentThreshold?.toString() ?? null, operator, validFrom: validFrom.toISOString(), validTo: validTo?.toISOString() ?? null } } }); return rule;
  });
}
