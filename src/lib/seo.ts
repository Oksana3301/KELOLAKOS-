// SEO — sumber tunggal URL produksi. Default = domain resmi tophillspadang.com.
// Bisa di-override via NEXT_PUBLIC_SITE_URL di Vercel kalau perlu.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://tophillspadang.com').replace(/\/+$/, '');
export const INFO_URL = `${SITE_URL}/info`;
