export const COST_STRUCTURE_PREPARE_ROLES = ['ADMIN_SYSTEM','STAFF_ACCOUNTING'] as const;
export function isCostStructurePrepareRole(role:string) { return COST_STRUCTURE_PREPARE_ROLES.includes(role as typeof COST_STRUCTURE_PREPARE_ROLES[number]); }
