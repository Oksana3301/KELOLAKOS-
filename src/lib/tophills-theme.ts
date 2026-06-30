// Token brand Top Hills (cream + gold) — dipakai halaman publik booking
// (/info/booking/*) supaya konsisten dengan landing /info tanpa import dari page.
export const TH = {
  cream: '#F4ECDD',
  creamDeep: '#EEE3CE',
  card: '#FCF8F0',
  gold: '#A9802F',
  goldSoft: '#C2A062',
  border: '#E0CFA8',
  brown: '#463720',
  brownSoft: '#7A6A4F',
  green: '#3E7C5A',
  greenSoft: '#E6F1EA',
  danger: '#B05C3B',
};
export const TH_SERIF = "'Cormorant Garamond', serif";
export const TH_BODY = "'Manrope', system-ui, sans-serif";

/** Normalisasi nomor WA Indonesia → format 62xxxx (digit saja). */
export function normWa(raw: string): string {
  let p = String(raw || '').replace(/[^0-9]/g, '');
  if (p.startsWith('620')) p = '62' + p.slice(3); // "62" diketik lalu masih ada "0…"
  else if (p.startsWith('0')) p = '62' + p.slice(1);
  else if (p.startsWith('8')) p = '62' + p;
  return p;
}
/** Valid kalau mulai '62' & total 10–15 digit. */
export function isValidWa(raw: string): boolean {
  const p = normWa(raw);
  return /^62\d{8,13}$/.test(p);
}
