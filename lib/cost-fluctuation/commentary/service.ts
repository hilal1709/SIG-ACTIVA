import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { ComparisonType } from '../analysis/types';
import { resolveCommentaryTarget } from './context';

const MAX_TEXT = 5000;
const text = (value: unknown, required = false) => { const result = typeof value === 'string' ? value.trim() : ''; if (required && !result) throw new Error('Commentary reason is required.'); if (result.length > MAX_TEXT) throw new Error(`Text must not exceed ${MAX_TEXT} characters.`); return result; };
const auditJson = (value: unknown) => value as Prisma.InputJsonValue;

export async function getCommentaryOverlay(periodId: number, comparisonType: ComparisonType) {
  const { getMateriality } = await import('../materiality/service');
  const materiality = await getMateriality(periodId, comparisonType);
  if (materiality.kind !== 'OK' || materiality.status !== 'AVAILABLE') return materiality;
  const key = (await import('./context')).lineageKey(comparisonType, materiality.current.periods, materiality.comparison.periods);
  const rows = await prisma.costCommentary.findMany({ where: { periodId, comparisonType, analysisLineageKey: key }, include: { preparedBy: { select: { id: true, name: true } }, reviewedBy: { select: { id: true, name: true } }, history: { orderBy: { version: 'asc' } } } });
  return { ...materiality, analysisLineageKey: key, commentaries: rows };
}

export async function saveDraft(input: { periodId: number; comparisonType: ComparisonType; analysisKey: string; reason?: unknown }, userId: number) {
  const context = await resolveCommentaryTarget(input.periodId, input.comparisonType, input.analysisKey); const reason = text(input.reason);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.costCommentary.findUnique({ where: { periodId_comparisonType_analysisKey_analysisLineageKey: { periodId: input.periodId, comparisonType: input.comparisonType, analysisKey: context.target.node.key, analysisLineageKey: context.analysisLineageKey } }, include: { history: { orderBy: { version: 'desc' }, take: 1 } } });
    if (existing && !['DRAFT', 'RETURNED'].includes(existing.status)) throw new Error('Only DRAFT or RETURNED commentary can be saved as draft.');
    const data = { reason, status: 'DRAFT' as const, preparedById: userId, preparedAt: new Date(), reviewerNote: null, reviewedById: null, reviewedAt: null };
    const row = existing ? await tx.costCommentary.update({ where: { id: existing.id }, data }) : await tx.costCommentary.create({ data: { ...data, periodId: input.periodId, comparisonType: input.comparisonType, analysisLevel: context.analysisLevel, analysisKey: context.target.node.key, analysisLineageKey: context.analysisLineageKey, costGroupId: context.target.groupId, natureId: context.target.natureId, coaId: context.coaId, calculatedItemKey: context.calculatedItemKey } });
    const version = (existing?.history[0]?.version ?? 0) + 1;
    await tx.costCommentaryHistory.create({ data: { commentaryId: row.id, version, reason, status: 'DRAFT', changedById: userId } });
    await tx.costAuditLog.create({ data: { userId, periodId: input.periodId, action: 'SAVE_COMMENTARY', entityType: 'CostCommentary', entityId: String(row.id), newValueJson: auditJson({ analysisKey: row.analysisKey, comparisonType: row.comparisonType, status: row.status, version }) } });
    return row;
  });
}

async function transition(id: number, userId: number, action: 'submit'|'return'|'review', note?: unknown) {
  const row = await prisma.costCommentary.findUnique({ where: { id } }); if (!row) throw new Error('Commentary not found.');
  const context = await resolveCommentaryTarget(row.periodId, row.comparisonType, row.analysisKey); if (context.analysisLineageKey !== row.analysisLineageKey) throw new Error('Commentary lineage is stale.');
  const config = action === 'submit' ? { from: 'DRAFT', to: 'SUBMITTED', audit: 'SUBMIT_COMMENTARY' } : action === 'return' ? { from: 'SUBMITTED', to: 'RETURNED', audit: 'RETURN_COMMENTARY' } : { from: 'SUBMITTED', to: 'REVIEWED', audit: 'REVIEW_COMMENTARY' };
  if (row.status !== config.from) throw new Error(`Invalid commentary transition ${row.status} -> ${config.to}.`);
  if (action === 'submit') text(row.reason, true); const reviewerNote = action === 'return' ? text(note, true) : text(note);
  if (action === 'review' && row.preparedById === userId) throw new Error('Maker/checker violation: preparer cannot review own commentary.');
  return prisma.$transaction(async (tx) => {
    const current = await tx.costCommentary.findUniqueOrThrow({ where: { id }, include: { history: { orderBy: { version: 'desc' }, take: 1 } } });
    if (current.status !== config.from || current.analysisLineageKey !== context.analysisLineageKey) throw new Error('Commentary changed concurrently or is stale.');
    const data = action === 'submit' ? { status: 'SUBMITTED' as const, submittedAt: new Date() } : action === 'return' ? { status: 'RETURNED' as const, reviewerNote } : { status: 'REVIEWED' as const, reviewerNote: reviewerNote || null, reviewedById: userId, reviewedAt: new Date() };
    const updated = await tx.costCommentary.update({ where: { id }, data }); const version = (current.history[0]?.version ?? 0) + 1;
    await tx.costCommentaryHistory.create({ data: { commentaryId: id, version, reason: updated.reason, status: updated.status, reviewerNote: updated.reviewerNote, changedById: userId } });
    await tx.costAuditLog.create({ data: { userId, periodId: row.periodId, action: config.audit, entityType: 'CostCommentary', entityId: String(id), newValueJson: auditJson({ status: updated.status, version }) } }); return updated;
  });
}
export const submitCommentary = (id: number, userId: number) => transition(id, userId, 'submit');
export const returnCommentary = (id: number, userId: number, note: unknown) => transition(id, userId, 'return', note);
export const reviewCommentary = (id: number, userId: number, note?: unknown) => transition(id, userId, 'review', note);
