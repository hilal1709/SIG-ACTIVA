import { prisma } from '@/lib/prisma';
import type { ComparisonType } from '../analysis/types';
import { getCommentaryOverlay } from '../commentary/service';
import type { MaterialityNode } from '../materiality/types';

const TYPES: ComparisonType[] = ['MOM','YOY','YTD'];
const flatten = (nodes: MaterialityNode[]): MaterialityNode[] => nodes.flatMap(node => [node, ...flatten(node.children ?? [])]);
export async function reviewReadiness(periodId: number) {
  const period = await prisma.costPeriod.findUnique({ where: { id: periodId }, include: { fluctuationReview: true } });
  if (!period) throw new Error('Period not found.');
  const analyses = await Promise.all(TYPES.map(async comparisonType => ({ comparisonType, overlay: await getCommentaryOverlay(periodId, comparisonType) })));
  const blockers: string[] = []; let available = 0;
  if (period.status !== 'FINALIZED') blockers.push('Cost Period must remain FINALIZED.');
  for (const { comparisonType, overlay } of analyses) {
    if (overlay.kind !== 'OK' || overlay.status !== 'AVAILABLE') continue; available++;
    const rows = flatten(overlay.hierarchy); const commentary = new Map(overlay.commentaries.map(row => [row.analysisKey, row]));
    if (rows.some(row => ['NOT_CONFIGURED','NOT_EVALUABLE'].includes(row.materialityStatus))) blockers.push(`${comparisonType}: materiality configuration is incomplete or not evaluable.`);
    for (const row of rows.filter(row => row.materialityStatus === 'REQUIRES_EXPLANATION')) if (commentary.get(row.key)?.status !== 'REVIEWED') blockers.push(`${comparisonType}: ${row.key} requires reviewed commentary.`);
  }
  if (!available) blockers.push('At least one comparison must be AVAILABLE.');
  return { periodId, periodStatus: period.status, review: period.fluctuationReview, availableComparisons: available, blockers: [...new Set(blockers)], ready: blockers.length === 0 };
}
export async function completePeriodReview(periodId: number, userId: number, note?: unknown) {
  const readiness = await reviewReadiness(periodId); if (!readiness.ready) throw new Error(readiness.blockers.join(' '));
  const cleanNote = typeof note === 'string' ? note.trim().slice(0, 5000) : null;
  return prisma.$transaction(async tx => {
    const review = await tx.costPeriodReview.upsert({ where: { periodId }, create: { periodId, reviewStatus: 'COMPLETED', reviewedById: userId, reviewedAt: new Date(), note: cleanNote }, update: { reviewStatus: 'COMPLETED', reviewedById: userId, reviewedAt: new Date(), note: cleanNote } });
    await tx.costAuditLog.create({ data: { userId, periodId, action: 'COMPLETE_FLUCTUATION_REVIEW', entityType: 'CostPeriodReview', entityId: String(review.id), newValueJson: { reviewStatus: review.reviewStatus, availableComparisons: readiness.availableComparisons } } }); return review;
  });
}
