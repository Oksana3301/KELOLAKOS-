'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { requestLoginCode, verifyLoginCode } from '@/lib/auth';

const C = {
  bg: '#F5EDE0', text: '#3A2E1F', soft: '#8A7F6B', muted: '#9C8F7A',
  gold: '#C9A86A', sage: '#7A9F65', inputBg: '#FBF7EF', border: '#E6DCC8', label: '#5A4F3C',
};
const SERIF = "'Cormorant Garamond', serif";

function normWa(raw: string): string {
  let p = String(raw || '').replace(/[^0-9]/g, '');
  if (p.startsWith('620')) p = '62' + p.slice(3);
  else if (p.startsWith('0')) p = '62' + p.slice(1);
  else if (p.startsWith('8')) p = '62' + p;
  return p;
}

export default function RumahLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [toast, setToast] = useState('');
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2600); }

  async function onSendCode() {
    setErr('');
    const wa = normWa(phone);
    if (!/^62\d{8,13}$/.test(wa)) { setErr('Nomor WA belum benar. Contoh: 628123456789'); return; }
    setBusy(true);
    const r = await requestLoginCode(wa);
    setBusy(false);
    if (!r.success) { setErr(r.error || 'Gagal mengirim kode. Coba lagi ya.'); return; }
    setStep('code');
    setDigits(['', '', '', '', '', '']);
    flash('Kode dikirim ke WhatsApp-mu 🌸');
    setTimeout(() => boxes.current[0]?.focus(), 120);
  }

  function setDigit(i: number, v: string) {
    const d = v.replace(/[^0-9]/g, '').slice(-1);
    setDigits((prev) => { const next = [...prev]; next[i] = d; return next; });
    if (d && i < 5) boxes.current[i + 1]?.focus();
  }
  function onKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) boxes.current[i - 1]?.focus();
  }
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const t = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
    if (t.length) { e.preventDefault(); setDigits(t.padEnd(6, ' ').split('').map((c) => c.trim())); boxes.current[Math.min(t.length, 5)]?.focus(); }
  }

  async function onLogin() {
    setErr('');
    const code = digits.join('');
    if (code.length !== 6) { setErr('Masukkan 6 digit kode.'); return; }
    setBusy(true);
    const r = await verifyLoginCode(normWa(phone), code);
    setBusy(false);
    if (!r.success) { setErr(r.error || 'Kode salah atau kedaluwarsa.'); return; }
    router.replace('/rumah');
  }

  const inputBase: React.CSSProperties = {
    width: '100%', padding: '16px 18px', fontSize: 17, color: C.text, background: C.inputBg,
    border: `1px solid ${C.border}`, borderRadius: 12, outline: 'none', letterSpacing: '.5px',
  };
  const goldBtn: React.CSSProperties = {
    width: '100%', padding: 16, fontSize: 16, fontWeight: 600, color: C.text, background: C.gold,
    border: 'none', borderRadius: 12, cursor: 'pointer', boxShadow: '0 6px 18px -6px rgba(201,168,106,.6)',
    opacity: busy ? 0.7 : 1,
  };

  return (
    <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '28px 16px', fontFamily: "'Inter', sans-serif", background: 'radial-gradient(130% 100% at 50% 0%, #F3EAD9 0%, #EADFC9 55%, #E0D2B6 100%)' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: 430, maxWidth: '100%', background: 'rgba(255,255,255,.96)', borderRadius: 24, padding: 32, boxShadow: '0 24px 60px -22px rgba(58,46,31,.28)' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600, fontSize: 30, color: C.gold, lineHeight: 1 }}>Top Hills</div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: C.soft, marginTop: 4, fontWeight: 600 }}>RUMAH PENGHUNI</div>
        </div>

        <AnimatePresence mode="wait">
          {step === 'phone' ? (
            <motion.div key="phone" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600, fontSize: 34, lineHeight: 1.05, color: C.text }}>Selamat datang, kak.</div>
              <div style={{ fontSize: 15, color: C.soft, marginTop: 10, lineHeight: 1.5 }}>Masuk dengan nomor WA-mu yang terdaftar di Top Hills.</div>

              <div style={{ marginTop: 26 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.label }}>Nomor WhatsApp</label>
                <input
                  className="th-input" type="tel" inputMode="numeric" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onSendCode(); }}
                  placeholder="628123…" style={{ ...inputBase, marginTop: 9 }} autoFocus
                />
              </div>

              {err && <div style={{ marginTop: 12, fontSize: 13, color: '#B8584F' }}>⚠️ {err}</div>}

              <button className="th-gold" onClick={onSendCode} disabled={busy} style={{ ...goldBtn, marginTop: 18 }}>
                {busy ? 'Mengirim…' : 'Kirim Kode'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20, padding: '12px 14px', background: '#F4EFE3', borderRadius: 12 }}>
                <span style={{ flex: 'none' }}>🛡️</span>
                <span style={{ fontSize: 12.5, color: C.soft, lineHeight: 1.45 }}>Aman, tanpa password. Kode hanya berlaku 10 menit.</span>
              </div>
            </motion.div>
          ) : (
            <motion.div key="code" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 600, fontSize: 32, lineHeight: 1.08, color: C.text }}>Kode sudah dikirim ke WA-mu.</div>
              <div style={{ fontSize: 14, color: C.soft, marginTop: 10, lineHeight: 1.5 }}>
                Cek WA dari Top Hills <span style={{ color: C.label, fontWeight: 500 }}>(628116646615)</span>, masukkan kodenya.
              </div>

              <div style={{ display: 'flex', gap: 9, marginTop: 24, justifyContent: 'space-between' }} onPaste={onPaste}>
                {digits.map((d, i) => (
                  <input
                    key={i} ref={(el) => { boxes.current[i] = el; }} className="th-input"
                    inputMode="numeric" maxLength={1} value={d}
                    onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => onKey(i, e)}
                    style={{ width: '100%', minWidth: 0, aspectRatio: '1', textAlign: 'center', fontSize: 24, fontWeight: 600, color: C.text, background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 12, outline: 'none' }}
                  />
                ))}
              </div>

              {err && <div style={{ marginTop: 14, fontSize: 13, color: '#B8584F' }}>⚠️ {err}</div>}

              <button className="th-gold" onClick={onLogin} disabled={busy} style={{ ...goldBtn, marginTop: 22 }}>
                {busy ? 'Memeriksa…' : 'Masuk'}
              </button>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 }}>
                <button onClick={() => { setStep('phone'); setErr(''); }} style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, color: C.soft, cursor: 'pointer' }}>‹ Ganti nomor</button>
                <button onClick={onSendCode} disabled={busy} style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, color: C.gold, fontWeight: 600, cursor: 'pointer' }}>Kirim ulang</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 14, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 14, x: '-50%' }}
            style={{ position: 'fixed', left: '50%', bottom: 36, padding: '13px 22px', background: C.text, color: C.bg, fontSize: 14, fontWeight: 500, borderRadius: 999, boxShadow: '0 12px 30px -8px rgba(58,46,31,.55)', whiteSpace: 'nowrap', zIndex: 70 }}
          >{toast}</motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
