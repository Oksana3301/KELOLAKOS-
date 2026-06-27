// Tata letak gedung Top Hills — ditranskrip dari denah asli (4 lantai).
// Dipakai untuk Denah 2D (dan nanti visual 3D). Tiap kamar dicocokkan ke status
// live lewat namanya (mis. "1A", "23B", "Executive D01").

// Status kamar di denah. 'dp' = sudah dibooking & bayar DP (belum lunas → belum
// benar-benar terisi); 'terisi' hanya untuk yang sudah Lunas. Booking yang masih
// "Belum Bayar" dianggap masih tersedia ('kosong').
export type RoomStatus3 = 'kosong' | 'dp' | 'terisi' | 'perbaikan' | 'unknown';

export type GedungKey = 'A' | 'B' | 'C';

// Susunan kamar per gedung di satu lantai.
export type Arrangement =
  | { gedung: GedungKey; shape: 'twinCol'; left: string[]; right: string[]; gapAfter: number }
  | { gedung: GedungKey; shape: 'lShape'; top: string[]; side: string[] }
  | { gedung: GedungKey; shape: 'row'; rooms: string[] };

export interface FloorDef {
  lantai: number;
  blocks: Arrangement[];
}

// Helper rentang nomor kamar, mis. seqA(11,20) -> ['11A'..'20A']; turun otomatis.
function seq(prefixFrom: number, to: number, suffix: string): string[] {
  const out: string[] = [];
  const step = prefixFrom <= to ? 1 : -1;
  for (let n = prefixFrom; step > 0 ? n <= to : n >= to; n += step) out.push(n + suffix);
  return out;
}

export const FLOORS: FloorDef[] = [
  {
    lantai: 1,
    blocks: [
      { gedung: 'A', shape: 'twinCol', left: seq(11, 20, 'A'), right: seq(10, 1, 'A'), gapAfter: 6 },
      { gedung: 'B', shape: 'lShape', top: seq(15, 8, 'B'), side: seq(7, 1, 'B') },
    ],
  },
  {
    lantai: 2,
    blocks: [
      { gedung: 'A', shape: 'twinCol', left: seq(31, 40, 'A'), right: seq(30, 21, 'A'), gapAfter: 6 },
      { gedung: 'B', shape: 'lShape', top: seq(30, 23, 'B'), side: seq(22, 16, 'B') },
      { gedung: 'C', shape: 'row', rooms: ['Executive D01', 'Deluxe D02'] },
    ],
  },
  {
    lantai: 3,
    blocks: [
      { gedung: 'A', shape: 'twinCol', left: seq(51, 60, 'A'), right: seq(50, 41, 'A'), gapAfter: 6 },
      { gedung: 'C', shape: 'row', rooms: ['Superior D03', 'Superior D04', 'Superior D05'] },
    ],
  },
  {
    lantai: 4,
    blocks: [{ gedung: 'A', shape: 'twinCol', left: seq(71, 80, 'A'), right: seq(70, 61, 'A'), gapAfter: 6 }],
  },
];

export const GEDUNG_LABEL: Record<GedungKey, string> = {
  A: 'Gedung A',
  B: 'Gedung B',
  C: 'Gedung C (Penginapan)',
};

export type LayananKey = 'kost' | 'penginapan';
/** Gedung A & B = kost, Gedung C = penginapan. */
export function gedungLayanan(g: GedungKey): LayananKey {
  return g === 'C' ? 'penginapan' : 'kost';
}

// ── Palet status kamar (SATU sumber untuk denah 2D & 3D). Warna dibuat sangat
// kontras & beda hue: hijau=Kosong, kuning=DP, abu gelap=Terisi, merah=Perbaikan.
export const STATUS_STYLE: Record<
  RoomStatus3,
  { bg: string; border: string; text: string; hex: string; dot: string; label: string }
> = {
  kosong:    { bg: '#DCFCE7', border: '#16A34A', text: '#15803D', hex: '#22C55E', dot: '#16A34A', label: 'Kosong' },
  dp:        { bg: '#FEF3C7', border: '#D97706', text: '#B45309', hex: '#F59E0B', dot: '#D97706', label: 'DP (dipesan)' },
  terisi:    { bg: '#E2E8F0', border: '#475569', text: '#334155', hex: '#64748B', dot: '#475569', label: 'Terisi' },
  perbaikan: { bg: '#FEE2E2', border: '#DC2626', text: '#B91C1C', hex: '#EF4444', dot: '#DC2626', label: 'Perbaikan' },
  unknown:   { bg: '#F1F5F9', border: '#CBD5E1', text: '#64748B', hex: '#CBD5E1', dot: '#94A3B8', label: 'Belum ada data' },
};

/** Flat list of every room (for 3D & lookups). */
export interface LayoutRoom {
  nama: string;
  gedung: GedungKey;
  lantai: number;
}
export const ALL_ROOMS: LayoutRoom[] = FLOORS.flatMap((f) =>
  f.blocks.flatMap((b) => {
    const names = b.shape === 'twinCol' ? [...b.left, ...b.right] : b.shape === 'lShape' ? [...b.top, ...b.side] : b.rooms;
    return names.map((nama) => ({ nama, gedung: b.gedung, lantai: f.lantai }));
  }),
);

/** Normalize a room name for status matching ("Executive D01" → "D01", "1A" → "1A"). */
export function roomKey(nama: string): string {
  const s = String(nama || '').trim().toUpperCase();
  // For penginapan, prefer the code (D01..D05) if present.
  const code = s.match(/\bD0?\d+\b/);
  return (code ? code[0] : s).replace(/\s+/g, '');
}

// ── 3D positions ──────────────────────────────────────────────────────────
// Each room becomes a box. (cx, cz) = footprint center on a floor; the floor
// (lantai) sets the height (y). World units; the viewer recenters automatically.
export const FLOOR_H = 1.1; // tinggi antar lantai
export const ROOM_H = 0.62; // tinggi kotak kamar
const SP = 1.18; // jarak antar kamar

export interface Room3D {
  nama: string;
  gedung: GedungKey;
  lantai: number;
  cx: number;
  cz: number;
  w: number;
  d: number;
}

export function room3DPositions(): Room3D[] {
  const out: Room3D[] = [];
  for (const f of FLOORS) {
    for (const b of f.blocks) {
      if (b.shape === 'twinCol') {
        const place = (list: string[], colX: number) =>
          list.forEach((nama, i) => {
            const row = i < b.gapAfter ? i : i + 1; // koridor (gap)
            out.push({ nama, gedung: b.gedung, lantai: f.lantai, cx: colX, cz: row * SP, w: 0.92, d: 0.92 });
          });
        place(b.left, 0);
        place(b.right, 2.05); // kolom kanan, koridor di tengah
      } else if (b.shape === 'lShape') {
        const bx = 8.5;
        b.top.forEach((nama, i) =>
          out.push({ nama, gedung: b.gedung, lantai: f.lantai, cx: bx + i * SP, cz: 0, w: 0.92, d: 0.92 }),
        );
        const sideX = bx + (b.top.length - 1) * SP;
        b.side.forEach((nama, j) =>
          out.push({ nama, gedung: b.gedung, lantai: f.lantai, cx: sideX, cz: (j + 1) * SP, w: 0.92, d: 0.92 }),
        );
      } else {
        // row (Gedung C / penginapan), taruh di depan B
        const cx0 = 9;
        const cz0 = -3.2;
        b.rooms.forEach((nama, i) =>
          out.push({ nama, gedung: b.gedung, lantai: f.lantai, cx: cx0 + i * 1.8, cz: cz0, w: 1.5, d: 0.95 }),
        );
      }
    }
  }
  return out;
}
