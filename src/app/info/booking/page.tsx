'use client';

import Link from 'next/link';
import { BookingShell } from '@/components/info/booking-shell';
import { TH, TH_SERIF } from '@/lib/tophills-theme';

export default function BookingLanding() {
  return (
    <BookingShell back={{ href: '/info', label: 'Beranda' }}>
      <div className="text-center mb-7 mt-2">
        <h1 style={{ fontFamily: TH_SERIF, color: TH.brown }} className="text-[30px] font-bold leading-tight m-0">Booking Top Hills</h1>
        <p className="text-[14.5px] mt-2 m-0" style={{ color: TH.brownSoft }}>Pilih sesuai kebutuhanmu 🌸</p>
      </div>

      <div className="grid gap-4">
        <Choice
          href="/info/booking/baru"
          emoji="🆕"
          title="Booking Kamar Baru"
          desc="Pertama kali booking di Top Hills? Pilih kamar & isi data baru di sini."
        />
        <Choice
          href="/info/booking/perpanjang"
          emoji="♻️"
          title="Perpanjang Kontrak"
          desc="Mau perpanjang kontrak yang berjalan? Cukup masukkan nomor WA-mu, data lama kami tarik otomatis."
        />
      </div>

    </BookingShell>
  );
}

function Choice({ href, emoji, title, desc }: { href: string; emoji: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="block rounded-[20px] p-6 no-underline transition-transform active:scale-[0.99]"
      style={{ background: TH.card, border: `1.5px solid ${TH.border}`, boxShadow: '0 10px 30px -18px rgba(70,55,32,0.35)' }}
    >
      <div className="flex items-start gap-4">
        <div className="grid place-items-center rounded-[16px] flex-shrink-0" style={{ width: 60, height: 60, background: TH.cream, border: `1px solid ${TH.border}`, fontSize: 30 }}>
          {emoji}
        </div>
        <div className="flex-1">
          <div style={{ fontFamily: TH_SERIF, color: TH.brown }} className="text-[22px] font-bold leading-tight">{title}</div>
          <div className="text-[13.5px] mt-1.5 leading-snug" style={{ color: TH.brownSoft }}>{desc}</div>
          <div className="text-[14px] font-bold mt-3 inline-flex items-center gap-1" style={{ color: TH.gold }}>Pilih ini ›</div>
        </div>
      </div>
    </Link>
  );
}
