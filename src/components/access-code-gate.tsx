'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api, getStoredAccessCode, setStoredAccessCode, clearStoredAccessCode, LicenseError } from '@/lib/api';
import { RoleProvider, roleFromTier } from '@/components/kk/role';

type GateStatus = 'checking' | 'need_code' | 'verifying' | 'active' | 'error';

interface AccessCodeGateProps {
  children: React.ReactNode;
}

export function AccessCodeGate({ children }: AccessCodeGateProps) {
  const [status, setStatus] = useState<GateStatus>('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [tier, setTier] = useState('');
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const pathname = usePathname();

  const supportWa = process.env.NEXT_PUBLIC_SUPPORT_WA || '62895610524580';

  // On mount, check stored code
  useEffect(() => {
    const stored = getStoredAccessCode();
    if (!stored) {
      setStatus('need_code');
      return;
    }
    verifyExistingCode(stored);
  }, []);

  async function verifyExistingCode(code: string) {
    try {
      const result = await api.verifyAccessCode(code);
      if (result.status === 'ACTIVE') {
        setTier(result.tier || '');
        setDaysRemaining(result.daysRemaining ?? null);
        setStatus('active');
      } else {
        // Expired/revoked — clear & ask for new code
        clearStoredAccessCode();
        setErrorMsg(result.message || `Akses ${result.status}`);
        setStatus('need_code');
      }
    } catch (e) {
      if (e instanceof LicenseError) {
        clearStoredAccessCode();
        setErrorMsg(e.message);
        setStatus('need_code');
      } else {
        setErrorMsg((e as Error).message || 'Gagal verifikasi akses');
        setStatus('error');
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = inputCode.trim().toUpperCase();
    if (!code) {
      setErrorMsg('Access code tidak boleh kosong');
      return;
    }

    setStatus('verifying');
    setErrorMsg('');
    try {
      const result = await api.verifyAccessCode(code);
      if (result.status === 'ACTIVE') {
        setStoredAccessCode(code);
        setTier(result.tier || '');
        setDaysRemaining(result.daysRemaining ?? null);
        setStatus('active');
      } else {
        setErrorMsg(result.message || `Akses ${result.status}`);
        setStatus('need_code');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Verifikasi gagal';
      setErrorMsg(msg);
      setStatus('need_code');
    }
  }

  function handleRetry() {
    setErrorMsg('');
    setStatus('checking');
    const stored = getStoredAccessCode();
    if (stored) verifyExistingCode(stored);
    else setStatus('need_code');
  }

  // === Render ===

  if (status === 'active') {
    return (
      <RoleProvider role={roleFromTier(tier)}>
        {/* Optional: license warning banner kalau hampir expire */}
        {daysRemaining !== null && daysRemaining <= 7 && daysRemaining > 0 && (
          <div className="bg-amb text-am text-center py-2 text-xs font-semibold">
            ⚠️ Akses kamu berakhir dalam {daysRemaining} hari. Hubungi {supportWa} untuk lanjut.
          </div>
        )}
        {children}
      </RoleProvider>
    );
  }

  // Public pages (e.g. the /info landing) are NOT behind the access code.
  if (pathname && pathname.startsWith('/info')) {
    return <>{children}</>;
  }

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-center">
          <div className="text-4xl mb-3">🔐</div>
          <div className="text-tx3 text-sm">Memverifikasi akses…</div>
        </div>
      </div>
    );
  }

  // need_code or error — show input form
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="max-w-md w-full bg-sf border border-bd rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-md bg-ac text-inv grid place-items-center font-extrabold text-xl">
            K
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">KelolaKos</h1>
            <p className="text-tx3 text-xs">Property OS</p>
          </div>
        </div>

        <h2 className="page-title text-[28px] mb-2">Welcome 👋</h2>
        <p className="text-tx3 text-sm mb-6">
          Masukkan access code yang dikirim via WhatsApp untuk mulai pakai.
        </p>

        {errorMsg && (
          <div className="bg-rdb border border-rd rounded-md p-3 mb-4 text-rd text-xs font-semibold">
            ❌ {errorMsg}
          </div>
        )}

        {status === 'error' ? (
          <div className="text-center py-4">
            <button
              onClick={handleRetry}
              className="btn btn-pri w-full"
            >
              🔄 Coba Lagi
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="access-code" className="block text-xs font-semibold text-tx2 mb-1.5">
                Access Code
              </label>
              <input
                id="access-code"
                type="text"
                className="input font-mono tracking-widest text-center text-base uppercase"
                placeholder="BETA-XXXXXX"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={status === 'verifying'}
                autoFocus
              />
              <p className="text-tx3 text-[11px] mt-1.5">
                Format: BETA-XXXXXX atau USR-XXXXXX
              </p>
            </div>

            <button
              type="submit"
              className="btn btn-pri btn-lg w-full"
              disabled={status === 'verifying' || !inputCode.trim()}
            >
              {status === 'verifying' ? '⏳ Memverifikasi…' : '✓ Verifikasi & Masuk'}
            </button>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-bd">
          <p className="text-tx3 text-xs mb-2">Belum punya access code?</p>
          <a
            href={`https://wa.me/${supportWa}?text=Halo,%20saya%20butuh%20access%20code%20KelolaKos`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-tx font-semibold text-xs hover:underline"
          >
            💬 Hubungi WhatsApp support →
          </a>
        </div>
      </div>
    </div>
  );
}
