'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { getCurrentUser, updateMyProfile } from '@/lib/auth';
import { tierMeta, tenureText, filledOptionalCount, RUMAH_FACULTIES, type RumahProfile } from '@/lib/rumah';

const C = {
  bg: '#F5EDE0', text: '#3A2E1F', soft: '#8A7F6B', muted: '#9C8F7A', mutedGold: '#A9956A',
  gold: '#C9A86A', sage: '#7A9F65', card: '#FFFFFF', inputBg: '#FBF7EF', border: '#E6DCC8', label: '#5A4F3C', line: 'rgba(58,46,31,.07)',
};
const SERIF = "'Cormorant Garamond', serif";

export default function RumahProfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<RumahProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState('');
  const [fak, setFak] = useState('');
  const [kampung, setKampung] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2800); };

  useEffect(() => {
    let alive = true;
    getCurrentUser().then((p) => {
      if (!alive) return;
      if (!p) { router.replace('/rumah/login'); return; }
      setProfile(p);
      setDob(p.tanggal_lahir || ''); setEmail(p.email || ''); setFak(p.fakultas || ''); setKampung(p.kampung_asal || '');
      setLoading(false);
    });
    return () => { alive = false; };
  }, [router]);

  const filled = filledOptionalCount({ tanggal_lahir: dob, email, fakultas: fak, kampung_asal: kampung });
  const showIncentive = !!profile && !profile.profile_complete;

  async function onSave() {
    setBusy(true);
    const r = await updateMyProfile({ tanggal_lahir: dob, email, fakultas: fak, kampung_asal: kampung });
    setBusy(false);
    if (!r.success) { flash(r.error || 'Gagal menyimpan. Coba lagi ya.'); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 1300);
    // Refresh profil (profile_complete bisa berubah → backend kabari Mezi).
    getCurrentUser().then((p) => { if (p) setProfile(p); });
  }

  if (loading || !profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, fontFamily: "'Inter',sans-serif" }}>
        <div style={{ textAlign: 'center', color: C.soft }}>
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 26, color: C.gold }}>Top Hills</div>
          <div style={{ marginTop: 8, fontSize: 14 }}>Memuat profil…</div>
        </div>
      </div>
    );
  }

  const inputBase: React.CSSProperties = {
    width: '100%', marginTop: 8, padding: '14px 16px', fontSize: 15, color: C.text, background: C.inputBg,
    border: `1px solid ${C.border}`, borderRadius: 12, outline: 'none',
  };
  const infoRows: { label: string; value: string }[] = [
    { label: 'Nama', value: profile.name || '—' },
    { label: 'Kamar', value: [profile.kamar, profile.gedung].filter(Boolean).join(' · ') || '—' },
    { label: 'Tier', value: tierMeta(profile.tier).label },
    { label: 'Lama tinggal', value: tenureText(profile.check_in) },
    ...(profile.referral_code ? [{ label: 'Kode referral', value: profile.referral_code }] : []),
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: "'Inter',sans-serif", color: C.text }}>
      <div style={{ maxWidth: 460, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, padding: '20px 18px 8px' }}>
          {/* header */}
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 40px', alignItems: 'center' }}>
            <button onClick={() => router.push('/rumah')} aria-label="Kembali"
              style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.card, border: '1px solid rgba(58,46,31,.08)', borderRadius: 12, cursor: 'pointer', color: C.label, boxShadow: '0 3px 10px rgba(58,46,31,.06)' }}>‹</button>
            <div style={{ textAlign: 'center', fontFamily: SERIF, fontWeight: 600, fontSize: 26, color: C.text }}>Profilmu</div>
            <div />
          </div>

          {showIncentive && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginTop: 18, padding: '15px 16px', background: 'linear-gradient(135deg, rgba(201,168,106,.20), rgba(201,168,106,.10))', border: '1px solid rgba(201,168,106,.4)', borderRadius: 16 }}>
              <span style={{ fontSize: 22, lineHeight: 1, flex: 'none' }}>🎁</span>
              <span style={{ fontSize: 13.5, color: C.label, lineHeight: 1.45 }}>
                Lengkapi <span style={{ fontWeight: 600, color: C.text }}>{filled}/4</span> field di bawah, kami kirim welcome surprise ke kamarmu.
              </span>
            </motion.div>
          )}

          {/* info penghuni */}
          <div style={{ marginTop: 26 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, color: C.mutedGold }}>INFO PENGHUNI</div>
            <div style={{ marginTop: 12, background: C.card, border: '1px solid rgba(58,46,31,.06)', borderRadius: 14, padding: '4px 16px', boxShadow: '0 4px 18px rgba(58,46,31,.05)' }}>
              {infoRows.map((row, i) => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '13px 0', borderBottom: i < infoRows.length - 1 ? `1px solid ${C.line}` : 'none' }}>
                  <span style={{ fontSize: 13.5, color: C.soft }}>{row.label}</span>
                  <span style={{ fontSize: 14, color: C.text, fontWeight: 600, textAlign: 'right' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* lengkapi profil */}
          <div style={{ marginTop: 26 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.6, color: C.mutedGold }}>LENGKAPI PROFIL</div>

            <Field label="Tanggal Lahir" hint="Biar bisa kasih kejutan pas ultah 🎂">
              <input className="th-input" type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={inputBase} />
            </Field>
            <Field label="Email" hint="Buat year-recap akhir tahun (opsional)">
              <input className="th-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" style={inputBase} />
            </Field>
            <Field label="Fakultas" hint="Auto-join grup teman se-fakultas">
              <select className="th-input" value={fak} onChange={(e) => setFak(e.target.value)} style={{ ...inputBase, cursor: 'pointer', appearance: 'none' }}>
                {RUMAH_FACULTIES.map((f) => <option key={f} value={f}>{f || '— pilih fakultas —'}</option>)}
              </select>
            </Field>
            <Field label="Kampung Asal" hint="Ketemu teman se-daerah di Top Hills">
              <input className="th-input" type="text" value={kampung} onChange={(e) => setKampung(e.target.value)} placeholder="cth: Bukittinggi" style={inputBase} />
            </Field>
          </div>
        </div>

        {/* sticky save bar */}
        <div style={{ position: 'sticky', bottom: 0, padding: '24px 18px 22px', background: 'linear-gradient(180deg, rgba(245,237,224,0) 0%, #F5EDE0 38%)' }}>
          <button className="th-gold" onClick={onSave} disabled={busy}
            style={{ width: '100%', padding: 16, fontSize: 16, fontWeight: 600, color: C.text, background: C.gold, border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: '0 8px 22px -8px rgba(201,168,106,.7)', opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Menyimpan…' : 'Simpan'}
          </button>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button onClick={() => router.push('/rumah')} style={{ background: 'none', border: 'none', padding: 4, fontSize: 13.5, color: C.soft, cursor: 'pointer' }}>Skip dulu</button>
          </div>
        </div>
      </div>

      {/* save tick overlay */}
      <AnimatePresence>
        {saved && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245,237,224,.78)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}
              style={{ width: 104, height: 104, borderRadius: 999, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 16px 44px -12px rgba(122,159,101,.5)', color: C.sage, fontSize: 48 }}>✓</motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {toast && (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 100, padding: '13px 22px', background: C.text, color: C.bg, fontSize: 14, fontWeight: 500, borderRadius: 999, boxShadow: '0 12px 30px -8px rgba(58,46,31,.55)', whiteSpace: 'nowrap', zIndex: 70 }}>{toast}</div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <label style={{ fontSize: 13.5, fontWeight: 600, color: '#5A4F3C' }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 13, color: '#9C8F7A', marginTop: 7 }}>{hint}</div>}
    </div>
  );
}
