import type { MetadataRoute } from 'next';
import { INFO_URL } from '@/lib/seo';

// Hanya halaman publik /info yang masuk sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: INFO_URL,
      changeFrequency: 'monthly',
      priority: 1.0,
    },
  ];
}
