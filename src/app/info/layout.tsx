import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Top Hills Kost Putri — Kost & Penginapan dekat UNAND, Padang',
  description:
    'Kost putri & penginapan nyaman di Limau Manis, Pauh (dekat UNAND, Padang). AC, kamar mandi dalam, WiFi unlimited, security & CCTV. Booking via WhatsApp.',
  openGraph: {
    title: 'Top Hills Kost Putri — dekat UNAND, Padang',
    description:
      'Kost putri & penginapan nyaman, aman, dekat kampus UNAND. AC, KM dalam, WiFi unlimited, security & CCTV. Booking via WhatsApp.',
    type: 'website',
  },
};

export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
