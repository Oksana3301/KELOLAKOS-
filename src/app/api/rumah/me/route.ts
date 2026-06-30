import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { callAppsScript, TH_SESSION_COOKIE } from '@/lib/rumah-server';
import type { RumahProfile } from '@/lib/rumah';

// GET /api/rumah/me — profil penghuni dari cookie th_session (JWT).
export async function GET(req: NextRequest) {
  const token = req.cookies.get(TH_SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ profile: null }, { status: 401 });

  // Verifikasi tanda tangan JWT bila JWT_SECRET tersedia (selaras backend).
  const secret = process.env.JWT_SECRET;
  if (secret) {
    try { jwt.verify(token, secret, { algorithms: ['HS256'] }); }
    catch {
      const res = NextResponse.json({ profile: null }, { status: 401 });
      res.cookies.delete(TH_SESSION_COOKIE);
      return res;
    }
  }

  const r = await callAppsScript<{ profile?: RumahProfile } & RumahProfile>('getMyProfile', { token });
  if (!r.ok) return NextResponse.json({ profile: null }, { status: r.error === 'CONFIG' ? 500 : 502 });
  // Apps Script bisa balas { profile } atau langsung field-nya.
  const profile = (r.data as { profile?: RumahProfile })?.profile ?? (r.data as RumahProfile);
  if (!profile || !(profile as RumahProfile).waNumber) {
    const res = NextResponse.json({ profile: null }, { status: 401 });
    res.cookies.delete(TH_SESSION_COOKIE);
    return res;
  }
  return NextResponse.json({ profile });
}
