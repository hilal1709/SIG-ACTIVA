import { NextRequest, NextResponse } from 'next/server';
import { requireSession, type SessionUser } from '@/lib/api-auth';
import { verifySessionToken } from '@/lib/session';
import { COST_STRUCTURE_PREPARE_ROLES } from './permissions';
export { COST_STRUCTURE_PREPARE_ROLES, isCostStructurePrepareRole } from './permissions';

type AuthorizationResult =
  | { user: SessionUser }
  | { error: NextResponse };

export const COST_STRUCTURE_READ_ROLES = [
  'ADMIN_SYSTEM',
  'STAFF_ACCOUNTING',
  'SUPERVISOR_ACCOUNTING',
  'AUDITOR_INTERNAL',
  'STAFF_PRODUCTION',
] as const;

export const COST_STRUCTURE_REVIEW_ROLES = [
  'ADMIN_SYSTEM',
  'SUPERVISOR_ACCOUNTING',
] as const;

export const COST_STRUCTURE_ADMIN_ROLES = ['ADMIN_SYSTEM'] as const;

async function requireCostStructureRole(
  request: NextRequest,
  allowedRoles: readonly string[]
): Promise<AuthorizationResult> {
  const auth = await requireSession(request);
  if ('error' in auth) return auth;

  if (!allowedRoles.includes(auth.user.role)) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return auth;
}

export function requireCostStructureRead(request: NextRequest) {
  return requireCostStructureRole(request, COST_STRUCTURE_READ_ROLES);
}

export function requireCostStructurePrepare(request: NextRequest) {
  return requireCostStructureRole(request, COST_STRUCTURE_PREPARE_ROLES);
}

export function requireCostStructureReview(request: NextRequest) {
  return requireCostStructureRole(request, COST_STRUCTURE_REVIEW_ROLES);
}

export function requireCostStructureAdmin(request: NextRequest) {
  return requireCostStructureRole(request, COST_STRUCTURE_ADMIN_ROLES);
}

async function verifyCostStructureSessionRole(
  token: string | null | undefined,
  allowedRoles: readonly string[]
): Promise<SessionUser | null> {
  const session = await verifySessionToken(token);
  if (!session || !allowedRoles.includes(session.role)) {
    return null;
  }

  return {
    uid: session.uid,
    role: session.role,
    name: session.name,
  };
}

export function verifyCostStructureReadSession(token?: string | null) {
  return verifyCostStructureSessionRole(token, COST_STRUCTURE_READ_ROLES);
}

export function verifyCostStructurePrepareSession(token?: string | null) {
  return verifyCostStructureSessionRole(token, COST_STRUCTURE_PREPARE_ROLES);
}
