// Proxy gambar same-origin → supaya bisa digambar ke <canvas> tanpa "taint"
// (Drive/Google tidak kirim header CORS, jadi toBlob() akan gagal kalau di-load
// langsung). Dipakai oleh fitur "Salin/Bagikan ketersediaan sebagai PNG" di /info.
// Hanya host Google yang diizinkan agar tidak jadi open-proxy.

import { NextRequest } from 'next/server';

function isAllowedHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === 'google.com' ||
    h.endsWith('.google.com') ||
    h === 'googleusercontent.com' ||
    h.endsWith('.googleusercontent.com')
  );
}

export async function GET(req: NextRequest) {
  const u = req.nextUrl.searchParams.get('u');
  if (!u) return new Response('missing u', { status: 400 });

  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return new Response('bad url', { status: 400 });
  }
  if (url.protocol !== 'https:' || !isAllowedHost(url.hostname)) {
    return new Response('forbidden host', { status: 403 });
  }

  try {
    const upstream = await fetch(url.toString(), { redirect: 'follow' });
    if (!upstream.ok) return new Response('upstream ' + upstream.status, { status: 502 });
    const ct = upstream.headers.get('content-type') || 'image/jpeg';
    if (!ct.startsWith('image/')) return new Response('not an image', { status: 415 });
    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': ct,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch {
    return new Response('fetch error', { status: 502 });
  }
}
