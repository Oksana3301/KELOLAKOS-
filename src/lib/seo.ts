// SEO — sumber tunggal URL produksi. Default = domain Vercel saat ini.
// Kalau nanti pakai domain lain, set NEXT_PUBLIC_SITE_URL di Vercel (override).
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://kelolakos-eta.vercel.app').replace(/\/+$/, '');
export const INFO_URL = `${SITE_URL}/info`;
