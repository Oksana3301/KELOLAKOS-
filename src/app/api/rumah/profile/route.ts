import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { callAppsScript, TH_SESSION_COOKIE } from '@/lib/rumah-server';

// POST /api/rumah/profile — update field profil editable penghuni.
const EDITABLE = ['tanggal_lahir', 'email', 'fakultas', 'kampung_asal'] as const;

export async function POST(req: NextRequest) {
  const token = req.cookies.get(TH_SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ success: false, error: 'Sesi habis. Masuk lagi ya.' }, { status: 401 });

  const secret = process.env.JWT_SECRET;
  if (secret) {
    try { jwt.verify(token, secret, { algorithms: ['HS256'] }); }
    catch { return NextResponse.json({ success: false, error: 'Sesi tidak valid.' }, { status: 401 }); }
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const updates: Record<string, string> = {};
  for (const k of EDITABLE) if (body[k] !== undefined) updates[k] = String(body[k] ?? '').trim();

  const r = await callAppsScript<{ success?: boolean; error?: string }>('updateMyProfile', { token, ...updates });
  if (!r.ok || r.data?.success === false) {
    return NextResponse.json(
      { success: false, error: r.data?.error || r.message || 'Gagal menyimpan. Coba lagi ya.' },
      { status: r.ok ? 400 : 502 },
    );
  }
  return NextResponse.json({ success: true });
}
