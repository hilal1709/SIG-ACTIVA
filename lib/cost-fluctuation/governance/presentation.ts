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

export function commentaryActions(status: string | undefined, permissions: GovernancePermissions) {
  return {
    canEdit: permissions.canPrepare && (!status || status === 'DRAFT' || status === 'RETURNED'),
    canSubmit: permissions.canPrepare && (status === 'DRAFT' || status === 'RETURNED'),
    canCheck: permissions.canReview && status === 'SUBMITTED',
    immutable: status === 'REVIEWED',
  };
}

export function explainMaterialityRule(amount: string, percent: string, operator: 'AND' | 'OR') {
  const criteria = [amount && `variance amount ≥ ${amount}`, percent && `absolute variance % ≥ ${percent}%`].filter(Boolean);
  if (!criteria.length) return 'Enter at least one threshold. No business threshold is assumed.';
  return `Requires explanation when ${criteria.join(operator === 'AND' ? ' AND ' : ' OR ')}.`;
}

