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
            // Freshness vs. load balance. Data is "fresh" for 30s; after that,
            // returning to the app/tab (focus) refetches automatically — so a
            // booking made on one device shows up on another without hard reload.
            staleTime: 30 * 1000,
            gcTime: 10 * 60 * 1000, // 10 min — cache data setelah komponen unmount
            refetchOnWindowFocus: true, // balik ke app → muat data terbaru
            refetchOnReconnect: 'always', // refetch kalau internet reconnect
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
