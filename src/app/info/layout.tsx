import type { Metadata } from 'next';
import { SITE_URL, INFO_URL } from '@/lib/seo';
import { FAQ } from '@/lib/faq';

const TITLE = 'Kost Putri & Penginapan Top Hills — Dekat UNAND Padang';
// Meta description — tanpa "&" (opengraph/Google menghitung &amp; sebagai 5 char). ~140.
const DESCRIPTION =
  'Kost putri dan penginapan nyaman dekat kampus UNAND, Limau Manis Padang. AC, kamar mandi dalam, WiFi, rooftop belajar. Booking online cepat.';
// Deskripsi pendek untuk social preview (OG/X ~110 char, anti-truncate).
const DESCRIPTION_SHORT =
  'Kost putri dan penginapan nyaman dekat UNAND, Padang. AC, KM dalam, WiFi, rooftop belajar. Booking online 🌸';
const OG_IMAGE = '/og-tophills-v3.jpg';

// Structured data — bantu Google paham ini bisnis kost/penginapan lokal (UNAND, Padang).
const LD_JSON = {
  '@context': 'https://schema.org',
  '@type': 'LodgingBusiness',
  '@id': `${SITE_URL}/#tophills`,
  name: 'Top Hills Kost Putri & Penginapan',
  description: DESCRIPTION,
  url: INFO_URL,
  image: `${SITE_URL}${OG_IMAGE}`,
  telephone: '+628116646615',
  priceRange: 'Rp',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Limau Manis, Pauh',
    addressLocality: 'Kota Padang',
    addressRegion: 'Sumatera Barat',
    postalCode: '25176',
    addressCountry: 'ID',
  },
  areaServed: ['Universitas Andalas (UNAND)', 'Limau Manis', 'Pauh', 'Kota Padang'],
  amenityFeature: [
    { '@type': 'LocationFeatureSpecification', name: 'AC', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Kamar mandi dalam', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'WiFi unlimited', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'CCTV & Security 24 jam', value: true },
    { '@type': 'LocationFeatureSpecification', name: 'Rooftop belajar', value: true },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    'kost UNAND', 'kost dekat UNAND', 'kost bagus UNAND', 'kost dekat kampus UNAND',
    'kost putri UNAND', 'kost mahasiswi UNAND', 'kost Padang', 'kost putri Padang',
    'kost murah Padang', 'kost mantap Padang', 'kost Limau Manis', 'kost Pauh',
    'sewa kamar dekat UNAND', 'kost dekat Universitas Andalas',
    'penginapan Padang', 'penginapan dekat UNAND', 'penginapan UNAND Padang',
    'penginapan Limau Manis Padang', 'Top Hills Padang', 'Top Hills Kost',
  ],
  alternates: { canonical: INFO_URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION_SHORT,
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
    description: DESCRIPTION_SHORT,
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

// FAQPage structured data — bisa muncul sebagai rich snippet (accordion Q&A) di Google.
const FAQ_JSON = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LD_JSON) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON) }} />
      {children}
    </>
  );
}
