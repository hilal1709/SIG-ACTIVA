import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ComparisonType } from '../analysis/types';
import { boundedText, positiveSafeInteger } from '../validation';
import { resolveCommentaryTarget } from './context';
import { assertCurrentLineage } from './lineage';

const auditJson = (value: unknown) => value as Prisma.InputJsonValue;
const transactionOptions = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;

export async function getCommentaryOverlay(periodId: number, comparisonType: ComparisonType) {
  positiveSafeInteger(periodId, 'periodId');
  const { getMateriality } = await import('../materiality/service');
  const materiality = await getMateriality(periodId, comparisonType);
  if (materiality.kind !== 'OK' || materiality.status !== 'AVAILABLE') return materiality;
  const key = (await import('./context')).lineageKey(comparisonType, materiality.current.periods, materiality.comparison.periods);
  const rows = await prisma.costCommentary.findMany({
    where: { periodId, comparisonType, analysisLineageKey: key },
    include: { preparedBy: { select: { id: true, name: true } }, reviewedBy: { select: { id: true, name: true } }, history: { orderBy: { version: 'asc' } } },
    orderBy: { analysisKey: 'asc' },
  });
  return { ...materiality, analysisLineageKey: key, commentaries: rows };
}

export interface SaveDraftInput { periodId: number; comparisonType: ComparisonType; analysisKey: string; reason?: unknown }
export async function saveDraft(input: SaveDraftInput, userId: number) {
  positiveSafeInteger(input.periodId, 'periodId'); positiveSafeInteger(userId, 'userId');
  if (typeof input.analysisKey !== 'string' || !input.analysisKey.trim()) throw new Error('analysisKey is required.');
  const context = await resolveCommentaryTarget(input.periodId, input.comparisonType, input.analysisKey);
  const reason = boundedText(input.reason, 'reason');
  return prisma.$transaction(async (tx) => {
    await assertCurrentLineage(tx, input.comparisonType, context.analysis.current.periods, context.analysis.comparison.periods, context.analysisLineageKey);
    const identity = { periodId: input.periodId, comparisonType: input.comparisonType, analysisKey: context.target.node.key, analysisLineageKey: context.analysisLineageKey };
    const existing = await tx.costCommentary.findUnique({ where: { periodId_comparisonType_analysisKey_analysisLineageKey: identity }, include: { history: { orderBy: { version: 'desc' }, take: 1 } } });
    if (existing && !['DRAFT', 'RETURNED'].includes(existing.status)) throw new Error('Only DRAFT or RETURNED commentary can be saved as draft.');
    const data = { reason, status: 'DRAFT' as const, preparedById: userId, preparedAt: new Date(), reviewerNote: null, reviewedById: null, reviewedAt: null };
    const row = existing
      ? await tx.costCommentary.update({ where: { id: existing.id }, data })
      : await tx.costCommentary.create({ data: { ...data, ...identity, analysisLevel: context.analysisLevel, costGroupId: context.target.groupId, natureId: context.target.natureId, coaId: context.coaId, calculatedItemKey: context.calculatedItemKey } });
    const version = (existing?.history[0]?.version ?? 0) + 1;
    await tx.costCommentaryHistory.create({ data: { commentaryId: row.id, version, reason, status: 'DRAFT', changedById: userId } });
    await tx.costAuditLog.create({ data: { userId, periodId: input.periodId, action: 'SAVE_COMMENTARY', entityType: 'CostCommentary', entityId: String(row.id), newValueJson: auditJson({ analysisKey: row.analysisKey, comparisonType: row.comparisonType, status: row.status, version }) } });
    return row;
  }, transactionOptions);
}

async function transition(id: number, userId: number, action: 'submit' | 'return' | 'review', note?: unknown) {
  positiveSafeInteger(id, 'commentaryId'); positiveSafeInteger(userId, 'userId');
  const row = await prisma.costCommentary.findUnique({ where: { id } });
  if (!row) throw new Error('Commentary not found.');
  const context = await resolveCommentaryTarget(row.periodId, row.comparisonType, row.analysisKey);
  const config = action === 'submit'
    ? { from: 'DRAFT' as const, audit: 'SUBMIT_COMMENTARY' }
    : action === 'return' ? { from: 'SUBMITTED' as const, audit: 'RETURN_COMMENTARY' }
      : { from: 'SUBMITTED' as const, audit: 'REVIEW_COMMENTARY' };
  if (action === 'submit') boundedText(row.reason, 'reason', true);
  const reviewerNote = action === 'return' ? boundedText(note, 'reviewerNote', true) : boundedText(note, 'reviewerNote');
  return prisma.$transaction(async (tx) => {
    await assertCurrentLineage(tx, row.comparisonType, context.analysis.current.periods, context.analysis.comparison.periods, row.analysisLineageKey);
    const current = await tx.costCommentary.findUniqueOrThrow({ where: { id }, include: { history: { orderBy: { version: 'desc' }, take: 1 } } });
    if (current.status !== config.from || current.analysisLineageKey !== context.analysisLineageKey) throw new Error('Commentary changed concurrently, has an invalid transition, or is stale.');
    if (action === 'review' && current.preparedById === userId) throw new Error('Maker/checker violation: preparer cannot review own commentary.');
    const data = action === 'submit'
      ? { status: 'SUBMITTED' as const, submittedAt: new Date() }
      : action === 'return' ? { status: 'RETURNED' as const, reviewerNote }
        : { status: 'REVIEWED' as const, reviewerNote: reviewerNote || null, reviewedById: userId, reviewedAt: new Date() };
    const updated = await tx.costCommentary.update({ where: { id }, data });
    const version = (current.history[0]?.version ?? 0) + 1;
    await tx.costCommentaryHistory.create({ data: { commentaryId: id, version, reason: updated.reason, status: updated.status, reviewerNote: updated.reviewerNote, changedById: userId } });
    await tx.costAuditLog.create({ data: { userId, periodId: row.periodId, action: config.audit, entityType: 'CostCommentary', entityId: String(id), newValueJson: auditJson({ status: updated.status, version }) } });
    return updated;
  }, transactionOptions);
}

export const submitCommentary = (id: number, userId: number) => transition(id, userId, 'submit');
export const returnCommentary = (id: number, userId: number, note: unknown) => transition(id, userId, 'return', note);
export const reviewCommentary = (id: number, userId: number, note?: unknown) => transition(id, userId, 'review', note);
