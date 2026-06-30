// Membuat gambar PNG "Kamar Tersedia" bergaya DENAH untuk dibagikan ke calon
// penyewa lewat WhatsApp. Dipakai di /info — admin isi tanggal lalu "Salin Gambar".
// Hanya menampilkan kamar KOSONG sebagai kotak (nama kamar di dalam kotak),
// dikelompokkan per Gedung & Lantai, plus foto preview per kategori.

export type AvailRoom = { nama: string; gedung: string; lantai: number; tipe?: string };
export type AvailPhoto = { img: HTMLImageElement; caption?: string };
export type AvailGroup = {
  key: 'kost' | 'penginapan';
  label: string;
  rooms: AvailRoom[];
  photos?: AvailPhoto[];
};

// Kamar yang kosong SEBAGIAN (dalam rentang) → tampil sebagai baris teks dgn
// tanggal kosongnya, mis. "D02 · Superior (Gedung C) — kosong 2 Jul – 4 Jul".
export type AvailPartial = { nama: string; tipe?: string; gedung?: string; dates: string };

export interface AvailImageOpts {
  title: string;     // "Kamar Tersedia"
  subtitle: string;  // "Tersedia 27 Jun – 30 Jun 2026"
  note?: string;     // "Penginapan: Check-in mulai 13.00 WIB · Check-out maksimal 12.00 WIB"
  groups: AvailGroup[];
  partial?: AvailPartial[]; // kamar kosong sebagian (rekomendasi tanggal x–y)
  footer: string;
}

// Palet selaras /info (cream + gold) + status kosong (hijau) & badge layanan.
const COL = {
  bg: '#F4ECDD',
  card: '#FFFFFF',
  border: '#E0CFA8',
  gold: '#A9802F',
  brown: '#463720',
  brownSoft: '#7A6A4F',
  kostBg: '#1E4E8C',
  penginapanBg: '#6B2FA0',
  boxBg: '#DCFCE7',
  boxBorder: '#16A34A',
  boxText: '#15803D',
};

const FONT = "'Inter', system-ui, -apple-system, sans-serif";

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

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number) {
  const ar = img.width / img.height;
  const tar = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ar > tar) { sh = img.height; sw = sh * tar; sx = (img.width - sw) / 2; }
  else { sw = img.width; sh = sw / tar; sy = (img.height - sh) / 2; }
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

function trim(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

// "Gedung C (Penginapan)" / "Gedung A" → "A" · "C". Terima juga "A"/"C" polos.
function shortGedung(g: string): string {
  const m = String(g || '').toUpperCase().match(/\b([ABC])\b/);
  return m ? m[1] : String(g || '').replace(/gedung/i, '').trim() || '-';
}
function roomNum(s: string): number {
  const m = String(s || '').match(/\d+/);
  return m ? Number(m[0]) : 9999;
}

/**
 * URL gambar yang AMAN untuk canvas (tidak meng-"taint"). Gambar Google/Drive
 * di-route lewat proxy same-origin; selain itu '' (di-skip).
 */
export function proxiedImageUrl(url: string): string {
  if (!url) return '';
  if (/(google\.com|googleusercontent\.com)/i.test(url)) {
    return `/api/img?u=${encodeURIComponent(url)}`;
  }
  return '';
}

export function loadImage(url: string, timeoutMs = 8000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    let done = false;
    const finish = (v: HTMLImageElement | null) => { if (!done) { done = true; resolve(v); } };
    img.crossOrigin = 'anonymous';
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    setTimeout(() => finish(null), timeoutMs);
    img.src = url;
  });
}

/** Render denah kamar tersedia menjadi PNG Blob. */
export async function buildAvailabilityImage(opts: AvailImageOpts): Promise<Blob> {
  const scale = 2;
  const W = 760;
  const pad = 36;
  const contentW = W - pad * 2;
  const colGap = 16;

  // Foto: 2 per baris
  const photoCols = 2;
  const photoW = (contentW - colGap * (photoCols - 1)) / photoCols;
  const photoH = Math.round(photoW * 0.62);
  const photoGap = 10;

  // Kotak denah
  const boxH = 44, boxGap = 8, boxPadX = 14, minBoxW = 56;
  const ghH = 46;        // header grup (badge)
  const subHeadH = 22;   // sub-judul "Gedung A · Lantai 1"
  const groupGap = 20;
  const subGap = 14;

  // Header
  const brandY = 44;
  const titleY = brandY + 56;
  const subtitleY = titleY + 28;
  const noteY = subtitleY + 20;
  const dividerY = opts.note ? noteY + 12 : subtitleY + 22;
  const contentStart = dividerY + 18;

  // Sub-grup kamar per Gedung + Lantai (urut Gedung A→C, lantai kecil→besar).
  function subGroupsOf(rooms: AvailRoom[]) {
    const map = new Map<string, { gedung: string; lantai: number; rooms: AvailRoom[] }>();
    for (const r of rooms) {
      const k = `${shortGedung(r.gedung)}|${r.lantai}`;
      if (!map.has(k)) map.set(k, { gedung: r.gedung, lantai: r.lantai, rooms: [] });
      map.get(k)!.rooms.push(r);
    }
    const arr = [...map.values()];
    arr.sort((a, b) => {
      const ga = shortGedung(a.gedung), gb = shortGedung(b.gedung);
      if (ga !== gb) return ga < gb ? -1 : 1;
      return (a.lantai || 0) - (b.lantai || 0);
    });
    arr.forEach((s) => s.rooms.sort((a, b) => (roomNum(a.nama) - roomNum(b.nama)) || a.nama.localeCompare(b.nama)));
    return arr;
  }

  // Tata letak kotak (wrap) untuk satu sub-grup. Mengembalikan rects + tinggi.
  function layoutBoxes(ctx: CanvasRenderingContext2D, names: string[], ox: number, oy: number, maxW: number) {
    ctx.font = `800 16px ${FONT}`;
    const rects: { x: number; y: number; w: number; h: number; name: string }[] = [];
    let x = ox, y = oy;
    for (const name of names) {
      const w = Math.max(minBoxW, Math.ceil(ctx.measureText(name).width) + boxPadX * 2);
      if (x > ox && x + w > ox + maxW) { x = ox; y += boxH + boxGap; }
      rects.push({ x, y, w, h: boxH, name });
      x += w + boxGap;
    }
    const height = rects.length ? rects[rects.length - 1].y + boxH - oy : 0;
    return { rects, height };
  }

  // ── Canvas + ctx (tinggi sementara dulu, lalu di-resize setelah ukur) ──
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(W * scale);
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak didukung di perangkat ini.');
  ctx.scale(scale, scale);

  // ── Ukur tinggi total ──
  let total = contentStart;
  for (const g of opts.groups) {
    total += ghH + 12;
    const photos = g.photos || [];
    if (photos.length) total += Math.ceil(photos.length / photoCols) * (photoH + photoGap) + 6;
    for (const sub of subGroupsOf(g.rooms)) {
      total += subHeadH + 6;
      total += layoutBoxes(ctx, sub.rooms.map((r) => r.nama), 0, 0, contentW).height;
      total += subGap;
    }
    total += groupGap;
  }
  const partial = opts.partial || [];
  if (partial.length) total += 34 + partial.length * 23 + 12; // seksi "tersedia sebagian"
  total += 76; // footer
  const H = Math.max(Math.round(total), 360);

  // resize → reset transform → re-scale
  canvas.height = Math.round(H * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.textBaseline = 'alphabetic';

  // ── Latar ──
  ctx.fillStyle = COL.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = COL.gold;
  ctx.fillRect(0, 0, W, 8);

  // ── Header ──
  ctx.fillStyle = COL.gold;
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText('TOP HILLS', pad, brandY);
  ctx.fillStyle = COL.brownSoft;
  ctx.font = `600 13px ${FONT}`;
  ctx.fillText('Kost Putri & Penginapan · Padang', pad, brandY + 20);

  ctx.fillStyle = COL.brown;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(opts.title, pad, titleY);

  ctx.fillStyle = COL.gold;
  ctx.font = `600 16px ${FONT}`;
  ctx.fillText(opts.subtitle, pad, subtitleY);

  if (opts.note) {
    ctx.fillStyle = COL.brownSoft;
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText(opts.note, pad, noteY);
  }

  ctx.strokeStyle = COL.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad, dividerY);
  ctx.lineTo(W - pad, dividerY);
  ctx.stroke();

  // ── Grup ──
  let y = contentStart;
  for (const g of opts.groups) {
    // Badge header
    const badgeBg = g.key === 'kost' ? COL.kostBg : COL.penginapanBg;
    roundRect(ctx, pad, y, contentW, ghH, 12);
    ctx.fillStyle = badgeBg;
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `800 17px ${FONT}`;
    ctx.fillText(g.label, pad + 16, y + ghH / 2 + 6);
    const cnt = `${g.rooms.length} kamar kosong`;
    ctx.font = `700 14px ${FONT}`;
    const cntW = ctx.measureText(cnt).width;
    ctx.globalAlpha = 0.92;
    ctx.fillText(cnt, W - pad - 16 - cntW, y + ghH / 2 + 5);
    ctx.globalAlpha = 1;
    y += ghH + 12;

    // Foto preview
    const photos = g.photos || [];
    if (photos.length) {
      photos.forEach((p, i) => {
        const col = i % photoCols;
        const rowIdx = Math.floor(i / photoCols);
        const x = pad + col * (photoW + colGap);
        const py = y + rowIdx * (photoH + photoGap);
        drawCover(ctx, p.img, x, py, photoW, photoH, 12);
        roundRect(ctx, x, py, photoW, photoH, 12);
        ctx.strokeStyle = COL.border;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        if (p.caption) {
          const gh = 30;
          const grad = ctx.createLinearGradient(0, py + photoH - gh, 0, py + photoH);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, 'rgba(0,0,0,0.62)');
          ctx.save();
          roundRect(ctx, x, py, photoW, photoH, 12);
          ctx.clip();
          ctx.fillStyle = grad;
          ctx.fillRect(x, py + photoH - gh, photoW, gh);
          ctx.restore();
          ctx.fillStyle = '#FFFFFF';
          ctx.font = `700 13px ${FONT}`;
          ctx.fillText(trim(ctx, p.caption, photoW - 20), x + 12, py + photoH - 10);
        }
      });
      y += Math.ceil(photos.length / photoCols) * (photoH + photoGap) + 6;
    }

    // Denah per Gedung & Lantai
    for (const sub of subGroupsOf(g.rooms)) {
      ctx.fillStyle = COL.brown;
      ctx.font = `800 14px ${FONT}`;
      const head = `Gedung ${shortGedung(sub.gedung)}${sub.lantai ? ` · Lantai ${sub.lantai}` : ''}`;
      ctx.fillText(head, pad, y + 15);
      y += subHeadH + 6;

      const { rects, height } = layoutBoxes(ctx, sub.rooms.map((r) => r.nama), pad, y, contentW);
      rects.forEach((b) => {
        roundRect(ctx, b.x, b.y, b.w, b.h, 10);
        ctx.fillStyle = COL.boxBg;
        ctx.fill();
        ctx.strokeStyle = COL.boxBorder;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = COL.boxText;
        ctx.font = `800 16px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 6);
        ctx.textAlign = 'left';
      });
      y += height + subGap;
    }
    y += groupGap;
  }

  // ── Tersedia sebagian (rekomendasi tanggal x–y di dalam rentang) ──
  if (partial.length) {
    ctx.fillStyle = COL.brown;
    ctx.font = `800 15px ${FONT}`;
    ctx.fillText('Tersedia sebagian (tanggal di dalam rentang):', pad, y + 14);
    y += 32;
    partial.forEach((p) => {
      const head = `${p.nama}${p.tipe ? ' · ' + p.tipe : ''}${p.gedung ? ' (Gedung ' + shortGedung(p.gedung) + ')' : ''} — `;
      ctx.font = `700 13.5px ${FONT}`;
      ctx.fillStyle = COL.brown;
      const headTxt = trim(ctx, head, contentW - 4);
      ctx.fillText(headTxt, pad, y + 13);
      const hw = ctx.measureText(headTxt).width;
      ctx.fillStyle = COL.boxText; // hijau utk tanggal kosong
      ctx.fillText('kosong ' + p.dates, pad + hw, y + 13);
      y += 23;
    });
    y += 12;
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

export type ImageDelivery = 'shared' | 'copied' | 'downloaded' | 'cancelled';

/** Salin gambar ke clipboard. Fallback: unduh (untuk dilampirkan ke chat). */
export async function copyAvailabilityImage(blob: Blob, filename: string): Promise<ImageDelivery> {
  try {
    const CI = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
    if (navigator.clipboard && CI) {
      await navigator.clipboard.write([new CI({ 'image/png': blob })]);
      return 'copied';
    }
  } catch {
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
