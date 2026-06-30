// Top Hills · /rumah — helper auth penghuni (client). Memanggil route handler
// /api/rumah/* yang mengurus cookie httpOnly th_session & verifikasi JWT.

import type { RumahProfile } from './rumah';

async function postJSON(url: string, body: unknown) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, j };
}

export async function requestLoginCode(waNumber: string): Promise<{ success: boolean; error?: string }> {
  const { j } = await postJSON('/api/rumah/request-code', { waNumber });
  return { success: !!j.success, error: j.error };
}

export async function verifyLoginCode(
  waNumber: string,
  code: string,
): Promise<{ success: boolean; profile?: RumahProfile; error?: string }> {
  const { j } = await postJSON('/api/rumah/verify-code', { waNumber, code });
  return { success: !!j.success, profile: j.profile, error: j.error };
}

export async function getCurrentUser(): Promise<RumahProfile | null> {
  try {
    const r = await fetch('/api/rumah/me', { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return (j.profile as RumahProfile) || null;
  } catch {
    return null;
  }
}

export async function updateMyProfile(
  updates: Partial<Pick<RumahProfile, 'tanggal_lahir' | 'email' | 'fakultas' | 'kampung_asal'>>,
): Promise<{ success: boolean; error?: string }> {
  const { j } = await postJSON('/api/rumah/profile', updates);
  return { success: !!j.success, error: j.error };
}

export async function logout(): Promise<void> {
  try { await fetch('/api/rumah/logout', { method: 'POST' }); } catch { /* ignore */ }
  if (typeof window !== 'undefined') window.location.href = '/rumah/login';
}
