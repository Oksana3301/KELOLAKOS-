'use client';

// KelolaKos · responsive navigation shell (ported from Navigasi spec).
// Laptop (≥900px) = labeled sidebar; phone = bottom tab bar + "Lainnya" sheet.
// Same menu set, order, and text labels in both — users learn it once.

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { KkIcon, type KkIconName } from './icons';
import { Sheet, SheetHead, Dialog, KkButton } from './ui';
import { clearStoredAccessCode } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface NavEntry {
  href: string;
  label: string;
  icon: KkIconName;
  desc?: string;
}

const PRIMARY: NavEntry[] = [
  { href: '/', label: 'Beranda', icon: 'beranda' },
  { href: '/booking', label: 'Booking', icon: 'booking' },
  { href: '/kamar', label: 'Kamar', icon: 'kamar' },
  { href: '/keuangan', label: 'Uang', icon: 'uang' },
];

const MORE: NavEntry[] = [
  { href: '/laporan', label: 'Laporan', icon: 'laporan', desc: 'Ringkasan untung-rugi & laporan PDF.' },
  { href: '/kwitansi', label: 'Kwitansi', icon: 'kwitansi', desc: 'Buat & kirim kwitansi ke penyewa.' },
  { href: '/layout3d', label: 'Layout Properti', icon: 'layout', desc: 'Peta semua kamar dan kondisinya.' },
  { href: '/setting', label: 'Pengaturan', icon: 'setting', desc: 'Profil bisnis, harga, fasilitas, akun.' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const supportWa = process.env.NEXT_PUBLIC_SUPPORT_WA || '62895610524580';

  function doLogout() {
    clearStoredAccessCode();
    toast.success('Anda sudah keluar');
    setTimeout(() => window.location.reload(), 600);
  }

  const moreActive = MORE.some((m) => isActive(pathname, m.href));

  return (
    <div className="min-h-screen bg-kk-paper text-kk-navy">
      {/* ───────── Laptop sidebar ───────── */}
      <aside className="hidden min-[900px]:flex fixed inset-y-0 left-0 w-72 flex-col border-r-2 border-kk-mauve bg-white px-5 py-6 z-30">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-[14px] bg-kk-orange text-white grid place-items-center font-heading font-black text-[22px]">
            K
          </div>
          <div>
            <div className="font-heading font-bold text-[19px] leading-tight">KelolaKos</div>
            <div className="text-caption text-kk-ink">Properti Anda</div>
          </div>
        </div>

        {/* Primary CTA */}
        <Link href="/booking?new=1" className="block mb-6">
          <KkButton variant="primary" block>
            <KkIcon name="tambah" size={22} /> Tambah Penyewa
          </KkButton>
        </Link>

        <SidebarGroup label="Menu Utama">
          {PRIMARY.map((e) => (
            <SidebarItem key={e.href} entry={e} active={isActive(pathname, e.href)} />
          ))}
        </SidebarGroup>

        <SidebarGroup label="Lainnya">
          {MORE.map((e) => (
            <SidebarItem key={e.href} entry={e} active={isActive(pathname, e.href)} />
          ))}
        </SidebarGroup>

        <div className="mt-auto pt-4 space-y-1">
          <a
            href={`https://wa.me/${supportWa}?text=Halo,%20saya%20butuh%20bantuan%20KelolaKos`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3.5 min-h-kk-touch rounded-kk-btn text-kk-navy hover:bg-kk-mint-soft font-body font-semibold text-body"
          >
            <KkIcon name="bantuan" size={24} /> Bantuan
          </a>
          <button
            onClick={() => setLogoutOpen(true)}
            className="w-full flex items-center gap-3 px-3.5 min-h-kk-touch rounded-kk-btn text-kk-navy hover:bg-kk-orange-soft font-body font-semibold text-body"
          >
            <KkIcon name="logout" size={24} /> Keluar
          </button>
        </div>
      </aside>

      {/* ───────── Content ───────── */}
      <main className="min-[900px]:pl-72 pb-28 min-[900px]:pb-10">
        <div className="mx-auto max-w-kk-content px-5 min-[900px]:px-9 pt-6 min-[900px]:pt-9 animate-kkFadeIn">
          {children}
        </div>
      </main>

      {/* ───────── Phone bottom tab bar ───────── */}
      <nav className="min-[900px]:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t-2 border-kk-mauve grid grid-cols-5 print:hidden">
        {PRIMARY.map((e) => (
          <TabItem key={e.href} entry={e} active={isActive(pathname, e.href)} />
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            'flex flex-col items-center justify-center gap-1 min-h-[64px] py-2 font-body font-semibold text-[13px] relative',
            moreActive ? 'text-kk-navy' : 'text-kk-ink',
          )}
        >
          {moreActive && <span className="absolute top-1.5 w-1.5 h-1.5 rounded-full bg-kk-orange" />}
          <KkIcon name="lainnya" size={26} />
          Lainnya
        </button>
      </nav>

      {/* ───────── "Lainnya" sheet (phone) ───────── */}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)}>
        <SheetHead title="Menu Lainnya" onClose={() => setMoreOpen(false)} />
        <div className="px-5 pb-7 space-y-3">
          {MORE.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              onClick={() => setMoreOpen(false)}
              className="flex items-center gap-4 bg-white border-2 border-kk-mauve rounded-kk-card p-4"
            >
              <div className="flex-shrink-0 w-12 h-12 rounded-[14px] bg-kk-mauve-soft text-kk-navy grid place-items-center">
                <KkIcon name={e.icon} size={26} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-heading font-bold text-[19px]">{e.label}</div>
                <div className="text-caption text-kk-ink leading-snug">{e.desc}</div>
              </div>
              <KkIcon name="chevron" size={22} className="text-kk-ink flex-shrink-0" />
            </Link>
          ))}
        </div>
      </Sheet>

      {/* ───────── Logout confirm ───────── */}
      <Dialog open={logoutOpen}>
        <div className="w-14 h-14 rounded-full bg-kk-orange-soft text-kk-orange grid place-items-center mx-auto mb-4">
          <KkIcon name="logout" size={30} />
        </div>
        <h3 className="font-heading font-bold text-subhead text-center m-0 mb-2">Keluar dari aplikasi?</h3>
        <p className="text-body text-kk-ink text-center mt-0 mb-6 leading-snug">
          Anda perlu memasukkan kode akses lagi saat membuka aplikasi nanti.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <KkButton variant="secondary" onClick={() => setLogoutOpen(false)}>
            Tidak Jadi
          </KkButton>
          <KkButton variant="primary" onClick={doLogout}>
            Ya, Keluar
          </KkButton>
        </div>
      </Dialog>
    </div>
  );
}

function SidebarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="px-3.5 mb-2 text-[14px] font-body font-semibold uppercase tracking-wide text-kk-ink">
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function SidebarItem({ entry, active }: { entry: NavEntry; active: boolean }) {
  return (
    <Link
      href={entry.href}
      className={cn(
        'flex items-center gap-3 px-3.5 min-h-kk-touch rounded-kk-btn font-body font-semibold text-body',
        active ? 'bg-kk-navy text-white' : 'text-kk-navy hover:bg-kk-mauve-soft',
      )}
    >
      <KkIcon name={entry.icon} size={24} />
      {entry.label}
    </Link>
  );
}

function TabItem({ entry, active }: { entry: NavEntry; active: boolean }) {
  return (
    <Link
      href={entry.href}
      className={cn(
        'flex flex-col items-center justify-center gap-1 min-h-[64px] py-2 font-body font-semibold text-[13px] relative',
        active ? 'text-kk-navy' : 'text-kk-ink',
      )}
    >
      {active && <span className="absolute top-1.5 w-1.5 h-1.5 rounded-full bg-kk-orange" />}
      <KkIcon name={entry.icon} size={26} />
      {entry.label}
    </Link>
  );
}
