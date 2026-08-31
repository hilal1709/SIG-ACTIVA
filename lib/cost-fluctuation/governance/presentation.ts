export const COMMENTARY_TARGET_TYPES = ['COST_GROUP', 'NATURE', 'COA', 'CALCULATED_ITEM'] as const;

export type GovernancePermissions = { canPrepare: boolean; canReview: boolean; canAdmin: boolean };

export function governancePermissions(role: string): GovernancePermissions {
  return {
    canPrepare: role === 'ADMIN_SYSTEM' || role === 'STAFF_ACCOUNTING',
    canReview: role === 'ADMIN_SYSTEM' || role === 'SUPERVISOR_ACCOUNTING',
    canAdmin: role === 'ADMIN_SYSTEM',
  };
}

export function isCommentaryTarget(nodeType: string) {
  return (COMMENTARY_TARGET_TYPES as readonly string[]).includes(nodeType);
}

export function commentaryActions(
  status: string | undefined,
  permissions: GovernancePermissions,
  preparedById?: number,
  actorId?: number,
) {
  const sameMaker = preparedById !== undefined && actorId !== undefined && preparedById === actorId;
  return {
    canEdit: permissions.canPrepare && (!status || status === 'DRAFT' || status === 'RETURNED'),
    // RETURNED must first be saved, which transitions it back to DRAFT on the server.
    canSubmit: permissions.canPrepare && status === 'DRAFT',
    canCheck: permissions.canReview && status === 'SUBMITTED' && !sameMaker,
    immutable: status === 'REVIEWED',
    makerCheckerBlocked: permissions.canReview && status === 'SUBMITTED' && sameMaker,
  };
}

export function explainMaterialityRule(amount: string, percent: string, operator: 'AND' | 'OR') {
  const criteria = [amount && `variance amount ≥ ${amount}`, percent && `absolute variance % ≥ ${percent}%`].filter(Boolean);
  if (!criteria.length) return 'Enter at least one threshold. No business threshold is assumed.';
  return `Requires explanation when ${criteria.join(operator === 'AND' ? ' AND ' : ' OR ')}.`;
}
