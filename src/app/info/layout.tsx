import type { Metadata } from 'next';
import { SITE_URL, INFO_URL } from '@/lib/seo';

const TITLE = 'Kost Putri & Penginapan Top Hills — Dekat UNAND Padang';
const DESCRIPTION =
  'Kost putri & penginapan umum yang nyaman di Limau Manis, Pauh — dekat kampus UNAND, Padang. Ada rooftop untuk belajar, free air mineral, AC, kamar mandi dalam, WiFi unlimited, security & CCTV. Booking via WhatsApp 0811-6646-615.';
const OG_IMAGE = '/og-tophills.jpg';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'kost putri Padang', 'kost dekat UNAND', 'penginapan Padang', 'kost Limau Manis',
    'kost Pauh', 'penginapan dekat UNAND', 'Top Hills Kost', 'kost murah Padang',
  ],
  alternates: { canonical: INFO_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: INFO_URL,
    siteName: 'Top Hills Kost Putri',
    locale: 'id_ID',
    type: 'website',
    images: [
      { url: OG_IMAGE, width: 1200, height: 630, alt: 'Top Hills — Kost Putri & Penginapan dekat UNAND, Padang' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
