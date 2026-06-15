'use client';

// KelolaKos · role/access control derived from the license tier.
// Owner/Admin sees everything; Penjaga (caretaker) is restricted.
// Default is 'admin' so existing codes keep full access — a code is only
// treated as 'penjaga' when its tier clearly marks it as staff.

import { createContext, useContext } from 'react';

export type Role = 'admin' | 'penjaga';

/** Derive the app role from the license tier string returned by verifyAccessCode. */
export function roleFromTier(tier: string | null | undefined): Role {
  const t = (tier || '').toUpperCase();
  if (/STAFF|PENJAGA|KASIR|GUARD|KARYAWAN|CARETAKER/.test(t)) return 'penjaga';
  return 'admin';
}

const RoleContext = createContext<Role>('admin');

export function RoleProvider({ role, children }: { role: Role; children: React.ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

/** Current role. */
export function useRole(): Role {
  return useContext(RoleContext);
}

/** Convenience: true when the current user is the owner/admin. */
export function useIsAdmin(): boolean {
  return useContext(RoleContext) === 'admin';
}
