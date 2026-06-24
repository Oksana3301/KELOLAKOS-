// SEO — sumber tunggal URL produksi. Set NEXT_PUBLIC_SITE_URL di Vercel agar
// canonical / OG / sitemap / robots memakai domain yang benar.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://tophills.vercel.app').replace(/\/+$/, '');
export const INFO_URL = `${SITE_URL}/info`;
