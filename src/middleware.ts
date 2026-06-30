import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Gate halaman penghuni /rumah/* (kecuali /rumah/login). Tanpa cookie sesi yang
// valid → diarahkan ke /rumah/login. Berjalan di Edge → tidak verifikasi tanda
// tangan JWT (itu dilakukan route handler & Apps Script), hanya cek ada + belum
// kedaluwarsa (decode payload). /api/rumah/* TIDAK kena (bukan /rumah/*).
export const config = { matcher: ['/rumah', '/rumah/:path*'] };

function decodeBase64Url(s: string): string {
  let b = s.replace(/-/g, '+').replace(/_/g, '/');
  while (b.length % 4) b += '=';
  if (typeof atob !== 'undefined') return atob(b);
  return Buffer.from(b, 'base64').toString('utf-8');
}

function tokenExpired(token: string): boolean {
  try {
    const part = token.split('.')[1];
    if (!part) return true;
    const payload = JSON.parse(decodeBase64Url(part)) as { exp?: number };
    if (payload.exp && Date.now() / 1000 > payload.exp) return true;
    return false;
  } catch {
    return true; // token rusak → anggap invalid
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/rumah/login' || pathname.startsWith('/rumah/login/')) {
    return NextResponse.next();
  }
  const token = req.cookies.get('th_session')?.value;
  if (!token || tokenExpired(token)) {
    const url = req.nextUrl.clone();
    url.pathname = '/rumah/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
