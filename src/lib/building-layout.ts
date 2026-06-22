// Tata letak gedung Top Hills — ditranskrip dari denah asli (4 lantai).
// Dipakai untuk Denah 2D (dan nanti visual 3D). Tiap kamar dicocokkan ke status
// live lewat namanya (mis. "1A", "23B", "Executive D01").

export type RoomStatus3 = 'kosong' | 'terisi' | 'perbaikan' | 'unknown';

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
