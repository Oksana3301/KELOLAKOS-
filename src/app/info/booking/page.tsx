'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BookingShell } from '@/components/info/booking-shell';
import { TH, TH_SERIF } from '@/lib/tophills-theme';

// Perpanjang sementara DITUTUP (data penghuni lama sedang disinkronkan).
// Penghuni lama diarahkan ke "Booking Kamar Baru" — datanya tetap masuk ke
// admin sebagai bukti. Ubah ke true bila perpanjang sudah siap dibuka lagi.
const PERPANJANG_OPEN = false;

export default function BookingLanding() {
  const [confirm, setConfirm] = useState<null | 'baru' | 'perpanjang'>(null);

  return (
    <BookingShell back={{ href: '/info', label: 'Beranda' }}>
      <div className="text-center mb-7 mt-2">
        <h1 style={{ fontFamily: TH_SERIF, color: TH.brown }} className="text-[28px] sm:text-[30px] font-bold leading-tight m-0">Booking Top Hills</h1>
        <p className="text-[14.5px] mt-2 m-0" style={{ color: TH.brownSoft }}>Pilih sesuai kebutuhanmu 🌸</p>
      </div>

      <div className="grid gap-4">
        <Choice
          onClick={() => setConfirm('baru')}
          emoji="🆕"
          title="Booking Kamar Baru"
          desc="Pertama kali booking di Top Hills? Pilih kamar & isi data baru di sini."
        />
        <Choice
          onClick={() => setConfirm('perpanjang')}
          emoji="♻️"
          title="Perpanjang Kontrak"
          desc="Penghuni lama yang ingin memperpanjang kontrak."
          closed={!PERPANJANG_OPEN}
        />
      </div>

      {confirm && (
        <ConfirmModal kind={confirm} onClose={() => setConfirm(null)} perpanjangOpen={PERPANJANG_OPEN} />
      )}
    </BookingShell>
  );
}

function Choice({ onClick, emoji, title, desc, closed }: {
  onClick: () => void; emoji: string; title: string; desc: string; closed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full text-left rounded-[20px] p-5 sm:p-6 transition-transform active:scale-[0.99]"
      style={{ background: TH.card, border: `1.5px solid ${TH.border}`, boxShadow: '0 10px 30px -18px rgba(70,55,32,0.35)', opacity: closed ? 0.86 : 1 }}
    >
      <div className="flex items-start gap-4">
        <div className="grid place-items-center rounded-[16px] flex-shrink-0" style={{ width: 56, height: 56, background: TH.cream, border: `1px solid ${TH.border}`, fontSize: 28 }}>
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontFamily: TH_SERIF, color: TH.brown }} className="text-[20px] sm:text-[22px] font-bold leading-tight">{title}</span>
            {closed && (
              <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: '#FBE9E2', color: TH.danger, border: '1px solid #E8C3B3' }}>
                Sementara ditutup
              </span>
            )}
          </div>
          <div className="text-[13.5px] mt-1.5 leading-snug" style={{ color: TH.brownSoft }}>{desc}</div>
          <div className="text-[14px] font-bold mt-3 inline-flex items-center gap-1" style={{ color: TH.gold }}>
            {closed ? 'Lihat info ›' : 'Pilih ini ›'}
          </div>
        </div>
      </div>
    </button>
  );
}

function ConfirmModal({ kind, onClose, perpanjangOpen }: {
  kind: 'baru' | 'perpanjang'; onClose: () => void; perpanjangOpen: boolean;
}) {
  const isBaru = kind === 'baru';
  const perpanjangClosed = kind === 'perpanjang' && !perpanjangOpen;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ background: 'rgba(40,30,15,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-[420px] rounded-[20px] p-5 sm:p-6"
        style={{ background: TH.card, border: `1.5px solid ${TH.border}`, boxShadow: '0 20px 60px -20px rgba(40,30,15,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {isBaru ? (
          <>
            <div className="text-[40px] text-center">🆕</div>
            <h2 style={{ fontFamily: TH_SERIF, color: TH.brown }} className="text-[22px] font-bold text-center mt-1 mb-2">Booking Kamar Baru</h2>
            <p className="text-[14px] leading-relaxed text-center m-0" style={{ color: TH.brownSoft }}>
              Kamu akan memilih kamar yang <b>tersedia</b>, mengisi data diri &amp; durasi, lalu upload bukti pembayaran.
              Data dikirim ke admin untuk <b>diverifikasi</b> (maks 1×24 jam). Lanjutkan?
            </p>
            <div className="grid gap-2 mt-5">
              <Link
                href="/info/booking/baru"
                className="flex items-center justify-center min-h-[50px] rounded-[14px] font-bold text-[15px] no-underline"
                style={{ background: TH.gold, color: '#fff' }}
              >
                Ya, lanjut booking ›
              </Link>
              <button onClick={onClose} className="min-h-[46px] rounded-[14px] font-semibold text-[14px]" style={{ background: '#fff', color: TH.brown, border: `1.5px solid ${TH.border}` }}>
                Batal
              </button>
            </div>
          </>
        ) : perpanjangClosed ? (
          <>
            <div className="text-[40px] text-center">🔧</div>
            <h2 style={{ fontFamily: TH_SERIF, color: TH.brown }} className="text-[21px] font-bold text-center mt-1 mb-2">Perpanjang Sementara Ditutup</h2>
            <p className="text-[14px] leading-relaxed text-center m-0" style={{ color: TH.brownSoft }}>
              Mohon maaf, fitur <b>Perpanjang Kontrak</b> sedang kami siapkan (data penghuni lama sedang disinkronkan).
            </p>
            <div className="rounded-[12px] p-3.5 mt-3 text-[13.5px] leading-relaxed" style={{ background: TH.cream, border: `1px solid ${TH.border}`, color: TH.brown }}>
              💡 Untuk sekarang, penghuni lama yang ingin perpanjang silakan pakai <b>Booking Kamar Baru</b> — pilih kamar yang sedang kamu tempati.
              Datamu tetap <b>tercatat ke admin sebagai bukti perpanjangan</b>. 🌸
            </div>
            <div className="grid gap-2 mt-5">
              <Link
                href="/info/booking/baru"
                className="flex items-center justify-center min-h-[50px] rounded-[14px] font-bold text-[15px] no-underline"
                style={{ background: TH.gold, color: '#fff' }}
              >
                Ke Booking Baru ›
              </Link>
              <button onClick={onClose} className="min-h-[46px] rounded-[14px] font-semibold text-[14px]" style={{ background: '#fff', color: TH.brown, border: `1.5px solid ${TH.border}` }}>
                Tutup
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-[40px] text-center">♻️</div>
            <h2 style={{ fontFamily: TH_SERIF, color: TH.brown }} className="text-[22px] font-bold text-center mt-1 mb-2">Perpanjang Kontrak</h2>
            <p className="text-[14px] leading-relaxed text-center m-0" style={{ color: TH.brownSoft }}>
              Masukkan nomor WA / data kontrak lama, data kami tarik otomatis untuk diperpanjang. Lanjutkan?
            </p>
            <div className="grid gap-2 mt-5">
              <Link
                href="/info/booking/perpanjang"
                className="flex items-center justify-center min-h-[50px] rounded-[14px] font-bold text-[15px] no-underline"
                style={{ background: TH.gold, color: '#fff' }}
              >
                Ya, lanjut ›
              </Link>
              <button onClick={onClose} className="min-h-[46px] rounded-[14px] font-semibold text-[14px]" style={{ background: '#fff', color: TH.brown, border: `1.5px solid ${TH.border}` }}>
                Batal
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
