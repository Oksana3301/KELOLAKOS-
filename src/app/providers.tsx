'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useState } from 'react';
import { AccessCodeGate } from '@/components/access-code-gate';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
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
