import { NextRequest, NextResponse } from 'next/server';
import { callAppsScript } from '@/lib/rumah-server';

// POST /api/rumah/request-code  { waNumber }
// Minta kode login 6 digit dikirim via WhatsApp (Fonnte) ke penyewa aktif.
export async function POST(req: NextRequest) {
  let body: { waNumber?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const waNumber = String(body.waNumber || '').replace(/[^0-9]/g, '');
  if (!waNumber || waNumber.length < 9) {
    return NextResponse.json({ success: false, error: 'Nomor WhatsApp belum benar.' }, { status: 400 });
  }
  const r = await callAppsScript<{ success?: boolean; error?: string }>('requestLoginCode', { waNumber });
  if (!r.ok) {
    return NextResponse.json(
      { success: false, error: r.message || 'Gagal mengirim kode. Coba lagi sebentar ya.' },
      { status: r.error === 'CONFIG' ? 500 : 502 },
    );
  }
  // Apps Script bisa balas { success:false, error } (mis. nomor tak terdaftar).
  const ok = r.data?.success !== false;
  return NextResponse.json({ success: ok, error: ok ? undefined : (r.data?.error || 'Nomor tidak terdaftar sebagai penghuni aktif.') });
}
