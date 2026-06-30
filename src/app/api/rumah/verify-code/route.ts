import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript, TH_SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/rumah-server';
import type { RumahProfile } from '@/lib/rumah';

// POST /api/rumah/verify-code  { waNumber, code }
// Verifikasi kode → terima JWT dari Apps Script → set cookie httpOnly th_session.
export async function POST(req: NextRequest) {
  let body: { waNumber?: string; code?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const waNumber = String(body.waNumber || '').replace(/[^0-9]/g, '');
  const code = String(body.code || '').replace(/[^0-9]/g, '');
  if (!waNumber || code.length !== 6) {
    return NextResponse.json({ success: false, error: 'Kode harus 6 digit.' }, { status: 400 });
  }
  const r = await callAppsScript<{ success?: boolean; token?: string; profile?: RumahProfile; error?: string }>(
    'verifyLoginCode',
    { waNumber, code },
  );
  if (!r.ok || !r.data?.token || r.data?.success === false) {
    return NextResponse.json(
      { success: false, error: r.data?.error || r.message || 'Kode salah atau sudah kedaluwarsa.' },
      { status: r.ok ? 401 : 502 },
    );
  }
  const res = NextResponse.json({ success: true, profile: r.data.profile });
  res.cookies.set(TH_SESSION_COOKIE, r.data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
