import { NextResponse } from 'next/server';
import { TH_SESSION_COOKIE } from '@/lib/rumah-server';

// POST /api/rumah/logout — hapus cookie sesi penghuni.
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(TH_SESSION_COOKIE);
  return res;
}
