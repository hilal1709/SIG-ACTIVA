import { COST_STRUCTURE_PREPARE_ROLES } from './permissions';

export const COST_STRUCTURE_READ_ROLES = ['ADMIN_SYSTEM', 'STAFF_ACCOUNTING', 'SUPERVISOR_ACCOUNTING', 'AUDITOR_INTERNAL', 'STAFF_PRODUCTION'] as const;
export const COST_STRUCTURE_REVIEW_ROLES = ['ADMIN_SYSTEM', 'SUPERVISOR_ACCOUNTING'] as const;
export const COST_STRUCTURE_ADMIN_ROLES = ['ADMIN_SYSTEM'] as const;
export type CostStructurePermission = 'READ' | 'PREPARE' | 'REVIEW' | 'ADMIN';

const ROLES: Record<CostStructurePermission, readonly string[]> = {
  READ: COST_STRUCTURE_READ_ROLES,
  PREPARE: COST_STRUCTURE_PREPARE_ROLES,
  REVIEW: COST_STRUCTURE_REVIEW_ROLES,
  ADMIN: COST_STRUCTURE_ADMIN_ROLES,
};

/** Authoritative role decision used by every Cost Structure and Phase I request helper. */
export const isCostStructureAuthorized = (role: string, permission: CostStructurePermission) => ROLES[permission].includes(role);
