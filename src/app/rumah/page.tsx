'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { getCurrentUser, logout } from '@/lib/auth';
import { tierMeta, tierProgress, tenureText, tenureMonths, type RumahProfile } from '@/lib/rumah';

const C = {
  bg: '#F5EDE0', text: '#3A2E1F', soft: '#8A7F6B', muted: '#A9956A',
  gold: '#C9A86A', goldSoft: '#D4B97E', sage: '#7A9F65', card: '#FFFFFF', line: 'rgba(58,46,31,.08)',
};
const SERIF = "'Cormorant Garamond', serif";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 19) return 'Selamat sore';
  return 'Selamat malam';
}
function initials(name?: string): string {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] || '') + (w[1]?.[0] || '')).toUpperCase() || '🌸';
}

export default function RumahDashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<RumahProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2600); };

  useEffect(() => {
    let alive = true;
    getCurrentUser().then((p) => {
      if (!alive) return;
      if (!p) { router.replace('/rumah/login'); return; }
      setProfile(p); setLoading(false);
    });
    return () => { alive = false; };
  }, [router]);

  const months = useMemo(() => (profile ? (profile.tenure_months || tenureMonths(profile.check_in)) : 0), [profile]);
  const prog = useMemo(() => tierProgress(months), [months]);

  const timeline = useMemo(() => {
    if (!profile) return [] as { icon: string; date: string; title: string }[];
    const out: { icon: string; date: string; title: string }[] = [];
    const fmt = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }); };
    if (profile.profile_complete) out.push({ icon: '🎁', date: 'Baru-baru ini', title: 'Profil lengkap — welcome surprise disiapkan' });
    out.push({ icon: tierMeta(profile.tier).label.split(' ')[0], date: `${months} bulan`, title: `Tier kamu sekarang: ${tierMeta(profile.tier).label}` });
    out.push({ icon: '🏡', date: fmt(profile.check_in), title: 'Mulai tinggal di Top Hills' });
    return out;
  }, [profile, months]);

  if (loading || !profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, fontFamily: "'Inter',sans-serif" }}>
        <div style={{ textAlign: 'center', color: C.soft }}>
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 26, color: C.gold }}>Top Hills</div>
          <div style={{ marginTop: 8, fontSize: 14 }}>Memuat rumahmu…</div>
        </div>
      </div>
    );
  }

  const tierLabel = tierMeta(profile.tier).label;
  const quickLinks = [
    { icon: '👤', label: 'Profilku', onClick: () => router.push('/rumah/profil') },
    { icon: '🎁', label: 'Kode Referral', onClick: () => { if (profile.referral_code) { navigator.clipboard?.writeText(profile.referral_code).catch(() => {}); flash(`Kode ${profile.referral_code} disalin 🌸`); } else flash('Kode referral belum tersedia'); } },
    { icon: '🧾', label: 'Tagihan', onClick: () => flash('Rincian tagihan segera hadir di sini 🌸') },
    { icon: '💬', label: 'Chat Admin', onClick: () => window.open('https://wa.me/628116646615?text=' + encodeURIComponent(`Halo Top Hills, saya ${profile.name} (kamar ${profile.kamar || '-'}).`), '_blank') },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(130% 80% at 50% 0%, #F3EAD9 0%, #F5EDE0 45%)', fontFamily: "'Inter',sans-serif", color: C.text }}>
      <div style={{ maxWidth: 460, margin: '0 auto', padding: '26px 18px 40px' }}>

        {/* header card */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}
          style={{ background: C.card, borderRadius: 22, padding: 22, boxShadow: '0 10px 30px -14px rgba(58,46,31,.18)', border: `1px solid ${C.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 999, background: 'linear-gradient(135deg,#D4B97E,#C9A86A)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, flex: 'none' }}>{initials(profile.name)}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600, fontSize: 28, lineHeight: 1.1, color: C.text }}>{greeting()}, {String(profile.name || 'kak').split(' ')[0]}</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '4px 11px', background: '#F4EFE3', border: '1px solid rgba(201,168,106,.45)', borderRadius: 999, fontSize: 12, fontWeight: 600, color: '#6E5F45' }}>{tierLabel}</div>
            </div>
          </div>
          <div style={{ fontSize: 14, color: C.soft, marginTop: 18 }}>Kamu di Top Hills selama <span style={{ color: C.text, fontWeight: 600 }}>{tenureText(profile.check_in)}</span></div>
          <div style={{ height: 6, marginTop: 12, background: '#EBE0CB', borderRadius: 999, overflow: 'hidden' }}>
            <motion.div initial={{ width: 0 }} animate={{ width: `${Math.round(prog.pct * 100)}%` }} transition={{ duration: 0.7, ease: 'easeOut' }}
              style={{ height: '100%', background: `linear-gradient(90deg,${C.goldSoft},${C.gold})`, borderRadius: 999 }} />
          </div>
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 9 }}>
            {prog.next ? `${prog.monthsToNext} bulan lagi jadi ${prog.next}` : 'Kamu sudah di tier tertinggi 🏡 — terima kasih sudah betah!'}
          </div>
        </motion.div>

        {/* quick links */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 22 }}>
          {quickLinks.map((l, i) => (
            <motion.button key={l.label} onClick={l.onClick} className="th-card"
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 * i }}
              style={{ aspectRatio: '1.15', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, cursor: 'pointer', boxShadow: '0 4px 18px rgba(58,46,31,.06)' }}>
              <span style={{ fontSize: 32, lineHeight: 1 }}>{l.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#5A4F3C' }}>{l.label}</span>
            </motion.button>
          ))}
        </div>

        {/* timeline */}
        <div style={{ marginTop: 32 }}>
          <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 24, color: C.text }}>Perjalananmu di Top Hills</div>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {timeline.map((ev, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 * i }}
                style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 999, background: '#F4EFE3', border: '1px solid rgba(201,168,106,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{ev.icon}</div>
                  {i < timeline.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 18, background: 'linear-gradient(#E1D4B8, transparent)' }} />}
                </div>
                <div style={{ paddingBottom: 18, paddingTop: 3 }}>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>{ev.date}</div>
                  <div style={{ fontSize: 15, color: C.text, fontWeight: 600, marginTop: 3 }}>{ev.title}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* footer */}
        <div style={{ marginTop: 18, paddingTop: 20, borderTop: `1px solid ${C.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 12.5, color: C.muted, letterSpacing: '.3px' }}>Top Hills · Padang · {new Date().getFullYear()}</div>
          <button onClick={() => logout()} style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, color: '#B8584F', cursor: 'pointer' }}>Keluar</button>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 28, padding: '13px 22px', background: C.text, color: C.bg, fontSize: 14, fontWeight: 500, borderRadius: 999, boxShadow: '0 12px 30px -8px rgba(58,46,31,.55)', whiteSpace: 'nowrap', zIndex: 70 }}>{toast}</div>
      )}
    </div>
  );
}
