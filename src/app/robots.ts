import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// Hanya halaman publik /info yang boleh di-index. Seluruh dashboard internal
// (di balik access-code-gate) di-disallow agar tidak muncul di hasil pencarian.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/info', '/info/'],
        disallow: ['/', '/booking', '/kamar', '/keuangan', '/kwitansi', '/laporan', '/layout3d', '/setting'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
