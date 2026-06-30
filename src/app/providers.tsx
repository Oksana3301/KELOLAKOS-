'use client';

import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState } from 'react';
import { AccessCodeGate } from '@/components/access-code-gate';
import { LicenseError, clearStoredAccessCode } from '@/lib/api';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        // Lisensi kedaluwarsa/dicabut DI TENGAH SESI: query data akan melempar
        // LicenseError. Bersihkan kode lalu beri sinyal ke AccessCodeGate agar
        // minta kode ulang (user tidak mentok di toast/halaman kosong).
        // Halaman publik /info dikecualikan (aksinya skipLicense).
        queryCache: new QueryCache({
          onError: (error) => {
            if (!(error instanceof LicenseError)) return;
            if (typeof window === 'undefined') return;
            if (window.location.pathname.startsWith('/info')) return;
            clearStoredAccessCode();
            window.dispatchEvent(new Event('kk-license-error'));
          },
        }),
        defaultOptions: {
          queries: {
            // Performa: data dianggap "fresh" 5 menit → pindah-pindah halaman
            // (booking ↔ kamar ↔ layout) pakai cache, instan, tanpa loading ulang.
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000, // simpan cache 30 menit setelah komponen unmount
            // Jangan refetch tiap balik ke tab (bikin spinner & boros di HP).
            // Data tetap segar lewat staleTime + saat reconnect / buka halaman.
            refetchOnWindowFocus: false,
            refetchOnReconnect: 'always',
            retry: 1, // cuma retry 1x kalau gagal (default 3x bikin lama)
          },
          mutations: {
            retry: 0, // mutation gak boleh retry (avoid double-write)
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AccessCodeGate>{children}</AccessCodeGate>
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
