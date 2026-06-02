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
            // [B7] Latency improvements:
            staleTime: 60 * 1000, // 1 min — data dianggap fresh, gak auto-refetch
            gcTime: 10 * 60 * 1000, // 10 min — cache data setelah komponen unmount
            refetchOnWindowFocus: false, // jangan refetch saat user balik ke tab
            refetchOnReconnect: 'always', // tapi refetch kalau internet reconnect
            retry: 1, // cuma retry 1x kalau gagal (default 3x bikin slow)
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
