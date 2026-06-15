'use client';

import Link from 'next/link';
import { useState } from 'react';
import { clearStoredAccessCode } from '@/lib/api';
import { toast } from 'sonner';
import { ScreenHead, KkButton, KkCard, Sheet, SheetHead, Dialog } from '@/components/kk/ui';
import { KkIcon, type KkIconName } from '@/components/kk/icons';
import { HelpSheet } from '@/components/kk/help-sheet';
import {
  ProfilBisnisPanel,
  HargaUmumPanel,
  HargaMassalPanel,
  FasilitasPanel,
} from '@/components/setting-panels';

const SUPPORT_WA = process.env.NEXT_PUBLIC_SUPPORT_WA || '62895610524580';

const HELP = {
  title: 'Pengaturan',
  tips: [
    'Di sini Anda mengatur data properti: profil bisnis, kamar, harga, dan fasilitas.',
    'Tenang, tidak ada yang permanen — semua bisa Anda ubah lagi kapan saja.',
    'Kalau bingung dengan satu bagian, tekan bagian itu lalu baca penjelasan di dalamnya, atau hubungi kami lewat WhatsApp.',
  ],
};

// Sections that open a Sheet wrapping an existing panel.
type SheetKey = 'profil' | 'harga' | 'bulk' | 'fasilitas';

interface Section {
  icon: KkIconName;
  title: string;
  desc: string;
  // either a sheet to open, or a route to navigate to
  sheet?: SheetKey;
  href?: string;
  sheetTitle?: string;
  sheetSub?: string;
}

const SECTIONS: Section[] = [
  {
    icon: 'toko',
    title: 'Profil Bisnis',
    desc: 'Nama kos, alamat, dan kontak yang muncul di kwitansi.',
    sheet: 'profil',
    sheetTitle: 'Profil Bisnis',
    sheetSub: 'Data ini muncul di kwitansi pembayaran.',
  },
  {
    icon: 'kamar',
    title: 'Kelola Kamar',
    desc: 'Tambah, ubah, atau hapus kamar di properti Anda.',
    href: '/kamar',
  },
  {
    icon: 'harga',
    title: 'Harga Umum',
    desc: 'Atur harga sewa standar untuk kamar baru.',
    sheet: 'harga',
    sheetTitle: 'Harga Umum',
    sheetSub: 'Harga standar untuk setiap Layanan, Gedung, dan Tipe.',
  },
  {
    icon: 'massal',
    title: 'Harga Massal',
    desc: 'Ubah harga banyak kamar sekaligus dalam sekali atur.',
    sheet: 'bulk',
    sheetTitle: 'Harga Massal',
    sheetSub: 'Terapkan satu harga ke banyak kamar sekaligus.',
  },
  {
    icon: 'fasilitas',
    title: 'Fasilitas',
    desc: 'Daftar fasilitas kamar: AC, kamar mandi dalam, WiFi, dll.',
    sheet: 'fasilitas',
    sheetTitle: 'Fasilitas',
    sheetSub: 'Daftar fasilitas yang bisa dipasang ke kamar.',
  },
];

export default function SettingPage() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeSheet, setActiveSheet] = useState<SheetKey | null>(null);

  function handleLogout() {
    setLoggingOut(true);
    clearStoredAccessCode();
    toast.success('✓ Anda sudah keluar');
    setTimeout(() => window.location.reload(), 800);
  }

  const sheetSection = SECTIONS.find((s) => s.sheet === activeSheet);

  return (
    <>
      <ScreenHead
        title="Pengaturan"
        sub="Atur data properti dan akun Anda."
        onHelp={() => setHelpOpen(true)}
      />

      {/* Profil akun */}
      <KkCard tone="mint" className="flex items-center gap-4 mb-4">
        <div className="w-[60px] h-[60px] rounded-full bg-kk-navy text-white grid place-items-center flex-shrink-0">
          <KkIcon name="akun" size={30} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-heading font-bold text-[21px] text-kk-navy truncate">Pemilik Kos</div>
          <div className="text-body text-kk-ink">Pemilik · Akun KelolaKos</div>
        </div>
        <Link href="/kwitansi" className="flex-shrink-0">
          <KkButton variant="secondary">Akun</KkButton>
        </Link>
      </KkCard>

      {/* Petunjuk menenangkan */}
      <KkCard className="flex items-start gap-3.5 mb-6">
        <span className="text-kk-green flex-shrink-0 mt-0.5">
          <KkIcon name="info" size={26} />
        </span>
        <div>
          <div className="font-heading font-bold text-[18px] text-kk-navy mb-1">
            Ini menu pengaturan lanjutan
          </div>
          <p className="text-body text-kk-ink m-0 leading-snug">
            Tenang, tidak ada yang permanen di sini — semua bisa Anda ubah lagi kapan saja. Kalau
            ragu, tekan tombol bantuan di pojok atas.
          </p>
        </div>
      </KkCard>

      {/* 5 bagian */}
      <div className="space-y-3 mb-6">
        {SECTIONS.map((s, i) => {
          const inner = (
            <KkCard
              className="flex items-center gap-4 hover:border-kk-navy transition-colors"
              onClick={s.sheet ? () => setActiveSheet(s.sheet!) : undefined}
            >
              <div className="w-[54px] h-[54px] rounded-[14px] bg-kk-mauve-soft text-kk-navy grid place-items-center flex-shrink-0">
                <KkIcon name={s.icon} size={26} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5">
                  <span className="font-heading font-black text-[16px] text-kk-orange">{i + 1}</span>
                  <span className="font-heading font-bold text-[19px] text-kk-navy">{s.title}</span>
                </div>
                <p className="text-body text-kk-ink mt-1 m-0 leading-snug">{s.desc}</p>
              </div>
              <span className="text-kk-mauve flex-shrink-0">
                <KkIcon name="chevron" size={22} strokeWidth={2.4} />
              </span>
            </KkCard>
          );

          return s.href ? (
            <Link key={s.title} href={s.href} className="block">
              {inner}
            </Link>
          ) : (
            <div key={s.title}>{inner}</div>
          );
        })}
      </div>

      {/* Bantuan */}
      <KkCard tone="mint" className="mb-6">
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-[50px] h-[50px] rounded-[14px] bg-white text-kk-green grid place-items-center flex-shrink-0">
            <KkIcon name="bantuan" size={26} />
          </div>
          <div>
            <div className="font-heading font-bold text-[19px] text-kk-navy">
              Butuh bantuan mengatur?
            </div>
            <div className="text-body text-kk-ink">Tim kami siap memandu lewat WhatsApp.</div>
          </div>
        </div>
        <a
          href={`https://wa.me/${SUPPORT_WA}?text=Halo,%20saya%20butuh%20bantuan%20mengatur%20KelolaKos`}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <KkButton variant="success" size="lg" block>
            <KkIcon name="kirim" size={22} /> Chat lewat WhatsApp
          </KkButton>
        </a>
      </KkCard>

      {/* Keluar */}
      <KkButton
        variant="ghost"
        block
        onClick={() => setLogoutOpen(true)}
        className="text-kk-orange border-kk-orange-soft"
      >
        <KkIcon name="logout" size={20} /> Keluar dari Aplikasi
      </KkButton>

      <div className="text-center text-body text-kk-ink my-5">KelolaKos · versi 1.0</div>

      {/* Section sheets (wrap existing panels — data wiring unchanged) */}
      <Sheet open={!!activeSheet} onClose={() => setActiveSheet(null)}>
        {sheetSection && (
          <>
            <SheetHead title={sheetSection.sheetTitle || ''} onClose={() => setActiveSheet(null)}>
              {sheetSection.sheetSub && (
                <p className="text-body text-kk-ink mt-1 m-0">{sheetSection.sheetSub}</p>
              )}
            </SheetHead>
            <div className="px-6 pb-7">
              {activeSheet === 'profil' && <ProfilBisnisPanel />}
              {activeSheet === 'harga' && <HargaUmumPanel />}
              {activeSheet === 'bulk' && <HargaMassalPanel />}
              {activeSheet === 'fasilitas' && <FasilitasPanel />}
            </div>
          </>
        )}
      </Sheet>

      {/* Help */}
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP} />

      {/* Logout confirm */}
      <Dialog open={logoutOpen}>
        <div className="w-14 h-14 rounded-full bg-kk-orange-soft text-kk-orange grid place-items-center mx-auto mb-4">
          <KkIcon name="logout" size={30} />
        </div>
        <h3 className="font-heading font-bold text-subhead text-center m-0 mb-2">
          Keluar dari aplikasi?
        </h3>
        <p className="text-body text-kk-ink text-center mt-0 mb-6 leading-snug">
          Tenang, data Anda tetap aman. Anda hanya perlu memasukkan kode akses lagi saat masuk
          kembali.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <KkButton variant="secondary" onClick={() => setLogoutOpen(false)} disabled={loggingOut}>
            Tidak Jadi
          </KkButton>
          <KkButton variant="primary" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? 'Keluar…' : 'Ya, Keluar'}
          </KkButton>
        </div>
      </Dialog>
    </>
  );
}
