import './globals.css';
import type { Metadata } from 'next';
import { Providers } from './providers';
import { AppShell } from '@/components/kk/app-shell';

// Token verifikasi Google Search Console (metode "HTML tag").
// Isi NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION di Vercel dengan token dari GSC.
const GOOGLE_SITE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
  title: 'Top Hills & Co · Property OS',
  description: 'Top Hills & Co — Kos & Penginapan Management System',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '512x512' },
    ],
    apple: '/apple-touch-icon.png',
  },
  ...(GOOGLE_SITE_VERIFICATION ? { verification: { google: GOOGLE_SITE_VERIFICATION } } : {}),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        {/* Font invoice mewah: Cormorant Garamond (display) + Manrope (body) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
