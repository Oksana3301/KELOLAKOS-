import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// PENTING: jangan blokir "/" (root), karena itu juga memblokir /sitemap.xml &
// /robots.txt → Google jadi "Couldn't fetch" sitemap. Dashboard internal cukup
// di-disallow per-path; halaman /info & sitemap tetap boleh di-crawl.
// Homepage internal dijaga keluar dari index lewat meta noindex (root layout).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/booking', '/kamar', '/keuangan', '/kwitansi', '/laporan', '/layout3d', '/setting'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
