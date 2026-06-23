/**
 * Normalisasi nomor WhatsApp/telepon Indonesia ke format 62xxx
 * supaya langsung bisa dihubungi (wa.me / klik telepon).
 *
 *  08123456789   -> 6281234567 89
 *  +62 812-3456  -> 62812 3456
 *  812-3456      -> 62812 3456
 *  0062812...    -> 62812...
 */
export function normalizePhone62(raw: string): string {
  let p = String(raw || '').replace(/[^0-9]/g, '');
  if (!p) return '';
  if (p.startsWith('620')) p = '62' + p.slice(3); // 6208xx -> 628xx
  else if (p.startsWith('0')) p = '62' + p.slice(1); // 08xx -> 628xx
  else if (p.startsWith('62')) p = p; // sudah 62xx
  else if (p.startsWith('8')) p = '62' + p; // 8xx -> 628xx
  else p = '62' + p; // fallback
  return p;
}

/** Versi tampil yang dikelompokkan: 62 812-3456-7890 */
export function formatPhoneDisplay(raw: string): string {
  const p = normalizePhone62(raw);
  if (!p) return '';
  const rest = p.slice(2); // setelah "62"
  const groups = rest.replace(/(\d{3,4})(?=\d)/g, '$1-');
  return '62 ' + groups;
}
