export type UserRole = 
  | 'ADMIN_SYSTEM'
  | 'STAFF_ACCOUNTING'
  | 'SUPERVISOR_ACCOUNTING'
  | 'AUDITOR_INTERNAL'
  | 'STAFF_PRODUCTION';

export interface RolePermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

// Role permissions mapping berdasarkan tabel
const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  ADMIN_SYSTEM: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
  STAFF_ACCOUNTING: {
    create: true,
    read: true,
    update: true,
    delete: true,
  },
  SUPERVISOR_ACCOUNTING: {
    create: false,
    read: true,
    update: false,
    delete: false,
  },
  AUDITOR_INTERNAL: {
    create: false,
    read: true,
    update: false,
    delete: false,
  },
  STAFF_PRODUCTION: {
    create: false,
    read: true,
    update: false,
    delete: false,
  },
};

// Role descriptions
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN_SYSTEM: 'Kelola user, data, dan sistem',
  STAFF_ACCOUNTING: 'Kelola data, input, update, edit, hapus data, dan generate laporan',
  SUPERVISOR_ACCOUNTING: 'Monitoring data, review laporan, dan verifikasi hasil pencatatan',
  AUDITOR_INTERNAL: 'Akses baca untuk keperluan audit dan penelusuran data historis',
  STAFF_PRODUCTION: 'Mengakses dashboard dan laporan material',
};

// Role labels
export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN_SYSTEM: 'Admin System',
  STAFF_ACCOUNTING: 'Staff Accounting',
  SUPERVISOR_ACCOUNTING: 'Supervisor Accounting',
  AUDITOR_INTERNAL: 'Auditor Internal',
  STAFF_PRODUCTION: 'Staff Production',
};

/**
 * Get role permissions for a specific user role
 */
export function getRolePermissions(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role];
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  role: UserRole,
  permission: keyof RolePermissions
): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

/**
 * Check if user can create
 */
export function canCreate(role: UserRole): boolean {
  return hasPermission(role, 'create');
}

/**
 * Check if user can read
 */
export function canRead(role: UserRole): boolean {
  return hasPermission(role, 'read');
}

/**
 * Check if user can update
 */
export function canUpdate(role: UserRole): boolean {
  return hasPermission(role, 'update');
}

/**
 * Check if user can delete
 */
export function canDelete(role: UserRole): boolean {
  return hasPermission(role, 'delete');
}

/**
 * Check if user is admin
 */
export function isAdmin(role: UserRole): boolean {
  return role === 'ADMIN_SYSTEM';
}

/**
 * Check if user has full access (create, read, update, delete)
 */
export function hasFullAccess(role: UserRole): boolean {
  const permissions = getRolePermissions(role);
  return permissions.create && permissions.read && permissions.update && permissions.delete;
}

/**
 * Check if user has read-only access
 */
export function hasReadOnlyAccess(role: UserRole): boolean {
  const permissions = getRolePermissions(role);
  return permissions.read && !permissions.create && !permissions.update && !permissions.delete;
}

/**
 * Get role label
 */
export function getRoleLabel(role: UserRole): string {
  return ROLE_LABELS[role] || role;
}

/**
 * Get role description
 */
export function getRoleDescription(role: UserRole): string {
  return ROLE_DESCRIPTIONS[role] || '';
}

/**
 * Get current user role from localStorage
 */
export function getCurrentUserRole(): UserRole | null {
  if (typeof window === 'undefined') return null;
  const role = localStorage.getItem('userRole');
  return role as UserRole | null;
}

/**
 * Check if current user has permission
 */
export function currentUserHasPermission(permission: keyof RolePermissions): boolean {
  const role = getCurrentUserRole();
  if (!role) return false;
  return hasPermission(role, permission);
}
