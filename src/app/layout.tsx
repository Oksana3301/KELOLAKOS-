import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';
import { AppShell } from '@/components/kk/app-shell';

export const metadata: Metadata = {
  title: 'KelolaKos · Property OS',
  description: 'Kos & Penginapan Management System',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
