import { NextRequest, NextResponse } from 'next/server';
import { requireSession, type SessionUser } from '@/lib/api-auth';
import { verifySessionToken } from '@/lib/session';
import { COST_STRUCTURE_PREPARE_ROLES } from './permissions';
import { COST_STRUCTURE_READ_ROLES, isCostStructureAuthorized, type CostStructurePermission } from './role-authorization';
export { COST_STRUCTURE_PREPARE_ROLES, isCostStructurePrepareRole } from './permissions';
export { COST_STRUCTURE_ADMIN_ROLES, COST_STRUCTURE_READ_ROLES, COST_STRUCTURE_REVIEW_ROLES, isCostStructureAuthorized } from './role-authorization';

type AuthorizationResult =
  | { user: SessionUser }
  | { error: NextResponse };

async function requireCostStructureRole(
  request: NextRequest,
  permission: CostStructurePermission
): Promise<AuthorizationResult> {
  const auth = await requireSession(request);
  if ('error' in auth) return auth;

  if (!isCostStructureAuthorized(auth.user.role, permission)) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return auth;
}

export function requireCostStructureRead(request: NextRequest) {
  return requireCostStructureRole(request, 'READ');
}

export function requireCostStructurePrepare(request: NextRequest) {
  return requireCostStructureRole(request, 'PREPARE');
}

export function requireCostStructureReview(request: NextRequest) {
  return requireCostStructureRole(request, 'REVIEW');
}

export function requireCostStructureAdmin(request: NextRequest) {
  return requireCostStructureRole(request, 'ADMIN');
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
