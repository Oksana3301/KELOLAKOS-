import type { MetadataRoute } from 'next';
import { SITE_URL, INFO_URL } from '@/lib/seo';

// Halaman publik (di balik /info, indexable) yang masuk sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: INFO_URL, changeFrequency: 'monthly', priority: 1.0 },
    { url: `${SITE_URL}/info/booking`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE_URL}/info/booking/baru`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/info/booking/perpanjang`, changeFrequency: 'monthly', priority: 0.8 },
  ];
}
