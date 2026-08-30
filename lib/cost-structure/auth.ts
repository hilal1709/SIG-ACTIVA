import { NextRequest, NextResponse } from 'next/server';
import { requireSession, type SessionUser } from '@/lib/api-auth';
import { verifySessionToken } from '@/lib/session';

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

export const COST_STRUCTURE_PREPARE_ROLES = [
  'ADMIN_SYSTEM',
  'STAFF_ACCOUNTING',
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

export async function verifyCostStructureReadSession(
  token?: string | null
): Promise<SessionUser | null> {
  const session = await verifySessionToken(token);
  if (!session || !COST_STRUCTURE_READ_ROLES.includes(
    session.role as (typeof COST_STRUCTURE_READ_ROLES)[number]
  )) {
    return null;
  }

  return {
    uid: session.uid,
    role: session.role,
    name: session.name,
  };
}
