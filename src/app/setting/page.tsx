'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Topbar } from '@/components/topbar';
import {
  ProfilBisnisPanel,
  KelolaKamarPanel,
  HargaUmumPanel,
  HargaMassalPanel,
  FasilitasPanel,
} from '@/components/setting-panels';

type PanelKey = 'profil' | 'kamar' | 'harga' | 'bulk' | 'fasilitas';

interface PanelConfig {
  key: PanelKey;
  icon: string;
  label: string;
  description: string;
}

const PANELS: PanelConfig[] = [
  { key: 'profil', icon: '🏢', label: 'Profil Bisnis', description: 'Nama bisnis, alamat, kontak, dan setting kwitansi' },
  { key: 'kamar', icon: '🏠', label: 'Kelola Kamar', description: 'Tambah, edit, atau nonaktifkan kamar di master ROOMS' },
  { key: 'harga', icon: '💰', label: 'Harga Umum', description: 'Set harga default per Layanan + Gedung + Tipe + Paket' },
  { key: 'bulk', icon: '📋', label: 'Harga Massal', description: 'Apply harga khusus per-kamar ke banyak kamar sekaligus' },
  { key: 'fasilitas', icon: '🛋️', label: 'Fasilitas Kamar', description: 'CRUD fasilitas (AC, WiFi, dll)' },
];

export default function SettingPage() {
  const [activePanel, setActivePanel] = useState<PanelKey>('profil');

  const currentPanel = PANELS.find((p) => p.key === activePanel)!;

  return (
    <>
      <Topbar />

      <div className="px-6 py-6 max-w-7xl mx-auto">
        <div className="mb-5">
          <Link href="/" className="text-tx3 text-xs hover:text-ac inline-flex items-center gap-1 mb-1">
            ← Beranda
          </Link>
          <h1 className="font-serif text-3xl tracking-tight">Setting</h1>
          <p className="text-tx3 text-sm mt-1">
            Konfigurasi profil bisnis, master kamar, harga, dan fasilitas
          </p>
        </div>

        <div className="grid md:grid-cols-[240px_1fr] gap-5">
          {/* SIDEBAR */}
          <aside className="space-y-1">
            {PANELS.map((p) => (
              <button
                key={p.key}
                onClick={() => setActivePanel(p.key)}
                className={
                  activePanel === p.key
                    ? 'w-full flex items-center gap-2 px-3 py-2.5 rounded-md bg-ac text-inv text-xs font-semibold text-left'
                    : 'w-full flex items-center gap-2 px-3 py-2.5 rounded-md hover:bg-sf2 text-tx text-xs font-medium text-left'
                }
              >
                <span className="text-base">{p.icon}</span>
                <span>{p.label}</span>
              </button>
            ))}

            <div className="pt-3 mt-3 border-t border-bd">
              <div className="text-tx3 text-[10px] uppercase tracking-wider font-bold mb-2 px-3">
                Quick Links
              </div>
              <Link
                href="/laporan"
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md hover:bg-sf2 text-tx text-xs font-medium text-left"
              >
                <span className="text-base">📊</span>
                <span>Laporan</span>
              </Link>
              <Link
                href="/kwitansi"
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md hover:bg-sf2 text-tx text-xs font-medium text-left"
              >
                <span className="text-base">🧾</span>
                <span>Kwitansi Customizer</span>
              </Link>
              <Link
                href="/layout3d"
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md hover:bg-sf2 text-tx text-xs font-medium text-left"
              >
                <span className="text-base">🏗️</span>
                <span>Layout Properti</span>
              </Link>
            </div>
          </aside>

          {/* MAIN PANEL */}
          <main className="bg-sf border border-bd rounded-md p-5 md:p-6 min-h-[60vh]">
            <div className="mb-5 pb-4 border-b border-bd">
              <h2 className="font-bold text-base flex items-center gap-2">
                <span className="text-xl">{currentPanel.icon}</span>
                {currentPanel.label}
              </h2>
              <p className="text-tx3 text-xs mt-1">{currentPanel.description}</p>
            </div>

            {activePanel === 'profil' && <ProfilBisnisPanel />}
            {activePanel === 'kamar' && <KelolaKamarPanel />}
            {activePanel === 'harga' && <HargaUmumPanel />}
            {activePanel === 'bulk' && <HargaMassalPanel />}
            {activePanel === 'fasilitas' && <FasilitasPanel />}
          </main>
        </div>
      </div>
    </>
  );
}
