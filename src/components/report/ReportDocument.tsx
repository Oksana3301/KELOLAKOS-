'use client';

// Top Hills — Laporan Keuangan (1080 wide). Sama design system dengan Invoice.
import { rp, type PeriodReport } from '@/lib/report';

const SERIF = "'Cormorant Garamond', serif";
const SANS = "'Manrope', sans-serif";
const GOLD = '#9C7A2E';
const GLASS: React.CSSProperties = {
  borderRadius: 20, background: 'linear-gradient(160deg, rgba(255,253,247,.74), rgba(248,242,231,.56))',
  backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(156,122,46,.28)',
  boxShadow: '0 22px 50px -32px rgba(120,96,40,.34)',
};
const goldGrad: React.CSSProperties = {
  background: 'linear-gradient(135deg,#B68A33,#9C7A2E 60%,#6E551C)',
  WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
};

type DetailKey = 'bersih' | 'masuk' | 'keluar' | 'sisa';

interface Props {
  rep: PeriodReport;
  showTrend?: boolean;
  showDetailLinks?: boolean;
  forExport?: boolean;
  onShow?: (k: DetailKey) => void;
}

function lbl(text: string): React.CSSProperties {
  return { fontSize: 11, letterSpacing: 2, color: GOLD, fontWeight: 700 };
}

export function ReportDocument({ rep, showTrend = true, showDetailLinks = true, forExport = false, onShow }: Props) {
  const net = rep.cashIn - rep.cashOut;
  const sisa = rep.openingBalance + rep.cashIn - rep.cashOut;
  const heroStyle: React.CSSProperties = forExport ? { color: '#9C7A2E' } : goldGrad;
  const occPct = rep.occupancy.total > 0 ? Math.round((rep.occupancy.occupied / rep.occupancy.total) * 100) : 0;
  const kosong = rep.occupancy.total - rep.occupancy.occupied;
  const keluarZero = rep.cashOut === 0;

  // Trend chart geometry
  const n = rep.trend.length;
  const maxV = Math.max(1, ...rep.trend.map((t) => Math.max(t.inn, t.out)));
  const X = (i: number) => 40 + (n > 1 ? i * (900 / (n - 1)) : 450);
  const Y = (v: number) => 240 - (v / maxV) * 210;
  const masukPts = rep.trend.map((t, i) => `${X(i).toFixed(0)},${Y(t.inn).toFixed(0)}`).join(' ');
  const keluarPts = rep.trend.map((t, i) => `${X(i).toFixed(0)},${Y(t.out).toFixed(0)}`).join(' ');
  const areaPts = n > 1 ? `40,240 ${masukPts} 940,240` : '';
  const labelStep = Math.max(1, Math.ceil(n / 12));

  return (
    <div style={{ width: 1080, minHeight: 1700, padding: 46, position: 'relative', fontFamily: SANS, overflow: 'hidden', background: 'radial-gradient(120% 70% at 18% 0%, #F4ECDC 0%, #EBE2CF 52%, #E2D8C2 100%)' }}>
      <div style={{ position: 'absolute', width: 560, height: 560, top: -200, right: -150, background: 'radial-gradient(circle, rgba(156,122,46,.12), rgba(156,122,46,0) 68%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 520, height: 520, bottom: -220, left: -170, background: 'radial-gradient(circle, rgba(156,122,46,.10), rgba(156,122,46,0) 70%)', pointerEvents: 'none' }} />

      {/* HEADER */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/invoice/logo-mark.png" alt="Top Hills" style={{ height: 92, width: 'auto', display: 'block', margin: '-2px 0 0 -2px' }} />
          <div style={{ fontSize: 12, color: '#8A8170', marginTop: 6, letterSpacing: .3 }}>Limau Manis, Pauh — Padang</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, letterSpacing: 3, color: GOLD, fontWeight: 700 }}>LAPORAN KEUANGAN</div>
          <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 46, letterSpacing: 1, lineHeight: 1, color: '#2C2620', marginTop: 8 }}>{rep.label}</div>
          <div style={{ fontSize: 12.5, color: '#7A7164', marginTop: 8 }}>{rep.range}</div>
        </div>
      </div>

      {/* HERO */}
      <div style={{ position: 'relative', borderRadius: 22, overflow: 'hidden', padding: '34px 38px', background: 'linear-gradient(135deg, rgba(166,128,47,.16), rgba(156,122,46,.05))', backdropFilter: 'blur(26px)', WebkitBackdropFilter: 'blur(26px)', border: '1px solid rgba(156,122,46,.34)', boxShadow: '0 30px 70px -34px rgba(120,96,40,.40), inset 0 1px 0 rgba(255,255,255,.6)' }}>
        <div style={{ position: 'absolute', top: 0, left: 38, right: 38, height: 2, background: 'linear-gradient(90deg, rgba(156,122,46,0), #C9A24B 30%, #9C7A2E 50%, #C9A24B 70%, rgba(156,122,46,0))' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 30 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '9px solid #9C7A2E', display: 'inline-block' }} />
              <span style={{ fontSize: 11, letterSpacing: 2.6, color: GOLD, fontWeight: 700 }}>BULAN INI · UNTUNG BERSIH</span>
            </div>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 72, lineHeight: .95, marginTop: 10, ...heroStyle, fontVariantNumeric: 'tabular-nums' }}>{rp(net)}</div>
            <div style={{ fontSize: 14, color: '#5A5446', marginTop: 12, maxWidth: 600, lineHeight: 1.55 }}>
              Anda menerima <b style={{ color: '#2C2620', fontWeight: 600 }}>{rp(rep.cashIn)}</b> dan mengeluarkan <b style={{ color: '#2C2620', fontWeight: 600 }}>{rp(rep.cashOut)}</b> — keuntungan bersih Anda <b style={{ color: '#2C2620', fontWeight: 600 }}>{rp(net)}</b>.
            </div>
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 15px', borderRadius: 30, border: '1px solid rgba(156,122,46,.4)', background: 'rgba(156,122,46,.08)' }}>
              <span style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '8px solid #9C7A2E', display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: GOLD, fontWeight: 700 }}>{net >= 0 ? 'Untung bersih' : 'Rugi'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, marginTop: 22 }}>
        <Kpi label="PENDAPATAN BERSIH" sub="Untung Anda — uang masuk dikurangi uang keluar" value={rp(net)} onClick={showDetailLinks && !forExport ? () => onShow?.('bersih') : undefined} />
        <Kpi label="UANG MASUK" sub="Semua uang yang Anda terima" value={rp(rep.cashIn)} onClick={showDetailLinks && !forExport ? () => onShow?.('masuk') : undefined} />
        <Kpi label="UANG KELUAR" sub="Semua uang yang Anda keluarkan" value={rp(rep.cashOut)} muted={keluarZero} dotMuted={keluarZero} onClick={showDetailLinks && !forExport ? () => onShow?.('keluar') : undefined} />
        <Kpi label="SISA UANG" sub="Uang tunai yang Anda punya sekarang" value={rp(sisa)} onClick={showDetailLinks && !forExport ? () => onShow?.('sisa') : undefined} />
      </div>

      {/* TREND */}
      {showTrend && (
        <div style={{ ...GLASS, padding: '26px 30px 22px', marginTop: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 24, color: '#2C2620' }}>Tren {rep.label}</div>
            <div style={{ display: 'flex', gap: 20 }}>
              <Legend color="#9C7A2E" text="Masuk" />
              <Legend color="#B05C3B" text="Keluar" />
            </div>
          </div>
          {n >= 2 ? (
            <svg viewBox="0 0 980 290" style={{ width: '100%', height: 'auto', display: 'block' }}>
              <defs>
                <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9C7A2E" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#9C7A2E" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[30, 100, 170].map((y) => <line key={y} x1="40" y1={y} x2="940" y2={y} stroke="rgba(156,122,46,.12)" strokeWidth="1" />)}
              <line x1="40" y1="240" x2="940" y2="240" stroke="rgba(156,122,46,.20)" strokeWidth="1" />
              <polygon points={areaPts} fill="url(#areaG)" />
              <polyline points={masukPts} fill="none" stroke="#9C7A2E" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
              <polyline points={keluarPts} fill="none" stroke="#B05C3B" strokeWidth="2.2" strokeDasharray="2 6" strokeLinecap="round" opacity="0.75" />
              {rep.trend.map((t, i) => <circle key={i} cx={X(i)} cy={Y(t.inn)} r="3.2" fill="#9C7A2E" />)}
              <g fill="#9A8F7C" fontFamily="Manrope, sans-serif" fontSize="13" textAnchor="middle">
                {rep.trend.map((t, i) => (i % labelStep === 0 || i === n - 1) ? <text key={i} x={X(i)} y="266">{t.label}</text> : null)}
              </g>
            </svg>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#8A8170', fontSize: 13 }}>Data tren belum cukup untuk periode ini.</div>
          )}
        </div>
      )}

      {/* BREAKDOWN */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, marginTop: 22, alignItems: 'start' }}>
        <div style={{ ...GLASS, padding: '26px 28px' }}>
          <div style={lbl('')}>DARI MANA UANG MASUK</div>
          {rep.income.length === 0 ? (
            <div style={{ color: '#8A8170', fontSize: 13.5, marginTop: 16 }}>Belum ada pemasukan pada periode ini.</div>
          ) : rep.income.map((r, i) => (
            <BreakRow key={i} label={r.label} amount={rp(r.amount)} pct={rep.cashIn ? Math.round((r.amount / rep.cashIn) * 100) : 0} sub={r.sub} gold />
          ))}
        </div>
        <div style={{ ...GLASS, padding: '26px 28px', display: 'flex', flexDirection: 'column' }}>
          <div style={lbl('')}>KE MANA UANG KELUAR</div>
          {rep.expense.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '34px 0 14px' }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', border: '1.5px dashed rgba(156,122,46,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: 16, height: 2, background: 'rgba(156,122,46,.5)', display: 'inline-block' }} />
              </div>
              <div style={{ fontSize: 14, color: '#5A5446', marginTop: 14, fontWeight: 600 }}>Belum ada pengeluaran</div>
              <div style={{ fontSize: 12.5, color: '#8A8170', marginTop: 5 }}>Tidak ada uang keluar pada periode ini.</div>
            </div>
          ) : rep.expense.map((r, i) => (
            <BreakRow key={i} label={r.label} amount={rp(r.amount)} pct={rep.cashOut ? Math.round((r.amount / rep.cashOut) * 100) : 0} sub={r.sub} />
          ))}
        </div>
      </div>

      {/* OCCUPANCY */}
      <div style={{ ...GLASS, padding: '28px 30px', marginTop: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={lbl('')}>HUNIAN KAMAR</div>
            <div style={{ fontSize: 13.5, color: '#8A8170', marginTop: 7 }}>{occPct}% kamar Anda sedang disewa</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 48, color: '#2C2620', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{rep.occupancy.occupied}</span>
            <span style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 28, color: '#9A938A' }}> / {rep.occupancy.total}</span>
            <div style={{ fontSize: 12, color: '#8A8170', marginTop: 2 }}>kamar terisi</div>
          </div>
        </div>
        <div style={{ height: 14, borderRadius: 8, background: 'rgba(156,122,46,.10)', marginTop: 18, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 8, background: 'linear-gradient(90deg,#C9A24B,#9C7A2E)', width: `${occPct}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 9 }}>
          <span style={{ fontSize: 12, color: '#8A8170' }}>Terisi {rep.occupancy.occupied}</span>
          <span style={{ fontSize: 12, color: '#8A8170' }}>Kosong {kosong}</span>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 30, paddingTop: 18, borderTop: '1px solid rgba(156,122,46,.20)' }}>
        <div style={{ fontSize: 12, color: '#8A8170' }}>Laporan dibuat otomatis oleh sistem Top Hills · angka dalam Rupiah (Rp).</div>
        <div style={{ fontFamily: SERIF, fontSize: 16, color: GOLD, letterSpacing: 1 }}>Top Hills</div>
      </div>
    </div>
  );
}

function Kpi({ label, sub, value, muted, dotMuted, onClick }: { label: string; sub: string; value: string; muted?: boolean; dotMuted?: boolean; onClick?: () => void }) {
  return (
    <div style={{ ...GLASS, padding: '26px 28px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotMuted ? '#B0966A' : '#9C7A2E', display: 'inline-block' }} />
        <span style={{ fontSize: 11, letterSpacing: 2, color: dotMuted ? '#9A8A6A' : '#9C7A2E', fontWeight: 700 }}>{label}</span>
      </div>
      <div style={{ fontSize: 13, color: '#8A8170', marginTop: 7, lineHeight: 1.5 }}>{sub}</div>
      <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 40, color: muted ? '#9A938A' : '#2C2620', marginTop: 14, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {onClick && (
        <button onClick={onClick} style={{ background: 'none', border: 'none', padding: 0, marginTop: 16, fontSize: 13, color: GOLD, fontWeight: 700, letterSpacing: .3, cursor: 'pointer', fontFamily: SANS, textAlign: 'left' }}>Lihat rincian ›</button>
      )}
    </div>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span style={{ width: 14, height: 3, borderRadius: 2, background: color, display: 'inline-block' }} />
      <span style={{ fontSize: 12.5, color: '#5A5446', fontWeight: 600 }}>{text}</span>
    </div>
  );
}

function BreakRow({ label, amount, pct, sub, gold }: { label: string; amount: string; pct: number; sub: string; gold?: boolean }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 14.5, color: '#2C2620', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 14.5, color: '#2C2620', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{amount}</span>
      </div>
      <div style={{ height: 9, borderRadius: 6, background: gold ? 'rgba(156,122,46,.10)' : 'rgba(176,92,59,.10)', marginTop: 9, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 6, background: gold ? 'linear-gradient(90deg,#C9A24B,#9C7A2E)' : 'linear-gradient(90deg,#C77A56,#B05C3B)', width: `${pct}%` }} />
      </div>
      <div style={{ fontSize: 12, color: '#8A8170', marginTop: 7 }}>{sub ? `${sub} · ${pct}%` : `${pct}%`}</div>
    </div>
  );
}
