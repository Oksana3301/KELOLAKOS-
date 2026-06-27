// Membuat gambar PNG "Ketersediaan Kamar" yang rapih untuk dibagikan ke calon
// penyewa lewat WhatsApp. Dipakai di /info — admin cek tanggal lalu Salin/Bagikan.
// Hanya menampilkan kamar yang TERSEDIA (kosong), lengkap dengan Gedung & Lantai.

export type AvailRoom = { nama: string; gedung: string; lantai: number; tipe?: string };
export type AvailGroup = { key: 'kost' | 'penginapan'; label: string; rooms: AvailRoom[] };

export interface AvailImageOpts {
  title: string;     // mis. "Kamar Tersedia"
  subtitle: string;  // mis. "Menginap 27 Jun – 30 Jun 2026" / "Hari ini (real-time)"
  groups: AvailGroup[];
  footer: string;    // mis. "Hubungi kami untuk booking · tophillspadang.com"
}

// Palet selaras dengan /info (cream + gold) & badge layanan di denah.
const COL = {
  bg: '#F4ECDD',
  card: '#FFFFFF',
  border: '#E0CFA8',
  gold: '#A9802F',
  brown: '#463720',
  brownSoft: '#7A6A4F',
  kostBg: '#1E4E8C',
  penginapanBg: '#6B2FA0',
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

const FONT = "'Inter', system-ui, -apple-system, sans-serif";

/** Render daftar kamar tersedia menjadi PNG Blob (siap dibagikan/disalin). */
export async function buildAvailabilityImage(opts: AvailImageOpts): Promise<Blob> {
  const scale = 2; // tajam di layar HP (retina)
  const W = 760;
  const pad = 36;
  const colGap = 16;
  const cols = 2;
  const colW = (W - pad * 2 - colGap * (cols - 1)) / cols;
  const rowH = 56;
  const ghH = 46;     // tinggi header grup
  const groupGap = 22;

  // ── Hitung tinggi dulu (measure pass) ──
  let h = 0;
  h += 150; // blok header (brand + judul + subjudul)
  for (const g of opts.groups) {
    h += ghH + 12;
    h += Math.ceil(g.rooms.length / cols) * rowH;
    h += groupGap;
  }
  h += 76; // footer
  const H = Math.max(Math.round(h), 360);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak didukung di perangkat ini.');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'alphabetic';

  // Latar + aksen emas di atas
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COL.gold;
  ctx.fillRect(0, 0, W, 8);

  // ── Header ──
  let y = 44;
  ctx.fillStyle = COL.gold;
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText('TOP HILLS', pad, y);
  ctx.fillStyle = COL.brownSoft;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText('Kost Putri & Penginapan · Padang', pad, y + 20);

  y += 56;
  ctx.fillStyle = COL.brown;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(opts.title, pad, y);

  y += 30;
  ctx.fillStyle = COL.gold;
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText(opts.subtitle, pad, y);

  y += 26;
  // garis pemisah tipis
  ctx.strokeStyle = COL.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(W - pad, y);
  ctx.stroke();
  y += 18;

  // ── Grup ──
  for (const g of opts.groups) {
    // Header grup (badge berwarna)
    const badgeBg = g.key === 'kost' ? COL.kostBg : COL.penginapanBg;
    roundRect(ctx, pad, y, W - pad * 2, ghH, 12);
    ctx.fillStyle = badgeBg;
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 17px ${FONT}`;
    ctx.fillText(g.label, pad + 16, y + ghH / 2 + 6);
    const cnt = `${g.rooms.length} kamar tersedia`;
    ctx.font = `700 14px ${FONT}`;
    const cntW = ctx.measureText(cnt).width;
    ctx.globalAlpha = 0.92;
    ctx.fillText(cnt, W - pad - 16 - cntW, y + ghH / 2 + 5);
    ctx.globalAlpha = 1;
    y += ghH + 12;

    // Kartu kamar — 2 kolom
    g.rooms.forEach((r, i) => {
      const col = i % cols;
      const rowIdx = Math.floor(i / cols);
      const x = pad + col * (colW + colGap);
      const cy = y + rowIdx * rowH;
      const ch = rowH - 10;
      roundRect(ctx, x, cy, colW, ch, 11);
      ctx.fillStyle = COL.card;
      ctx.fill();
      ctx.strokeStyle = COL.border;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = COL.brown;
      ctx.font = `800 17px ${FONT}`;
      ctx.fillText(trim(ctx, r.nama, colW - 28), x + 14, cy + 22);

      const loc = `Gedung ${shortGedung(r.gedung)}${r.lantai ? ` · Lantai ${r.lantai}` : ''}`;
      ctx.fillStyle = COL.brownSoft;
      ctx.font = `600 13px ${FONT}`;
      ctx.fillText(trim(ctx, loc, colW - 28), x + 14, cy + 40);
    });
    y += Math.ceil(g.rooms.length / cols) * rowH + groupGap;
  }

  // ── Footer ──
  ctx.strokeStyle = COL.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, H - 52);
  ctx.lineTo(W - pad, H - 52);
  ctx.stroke();
  ctx.fillStyle = COL.brownSoft;
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText(opts.footer, pad, H - 28);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal membuat gambar.'))), 'image/png');
  });
}

// "Gedung C (Penginapan)" / "Gedung A" → "A" · "C". Terima juga "A"/"C" polos.
function shortGedung(g: string): string {
  const m = String(g || '').toUpperCase().match(/\b([ABC])\b/);
  return m ? m[1] : String(g || '').replace(/gedung/i, '').trim() || '-';
}

function trim(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

export type ImageDelivery = 'shared' | 'copied' | 'downloaded' | 'cancelled';

/** Bagikan gambar (Web Share / native sheet → WhatsApp). Fallback: unduh. */
export async function shareAvailabilityImage(blob: Blob, filename: string): Promise<ImageDelivery> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Ketersediaan Kamar Top Hills' });
      return 'shared';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled';
      // selain dibatalkan → lanjut ke unduh
    }
  }
  return downloadImage(blob, filename);
}

/** Salin gambar ke clipboard (paling enak di desktop). Fallback: unduh. */
export async function copyAvailabilityImage(blob: Blob, filename: string): Promise<ImageDelivery> {
  try {
    const CI = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
    if (navigator.clipboard && CI) {
      await navigator.clipboard.write([new CI({ 'image/png': blob })]);
      return 'copied';
    }
  } catch (e) {
    // clipboard gambar tak didukung → unduh
  }
  return downloadImage(blob, filename);
}

function downloadImage(blob: Blob, filename: string): ImageDelivery {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return 'downloaded';
}
