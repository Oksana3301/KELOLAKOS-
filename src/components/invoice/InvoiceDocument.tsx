'use client';

// Top Hills — Invoice A4-portrait. Layout pakai FLEXBOX (bukan grid) supaya
// html2canvas merender rapi di semua perangkat (grid sering berantakan saat
// copy-as-png). Warna sesuai aset; tulisan sedikit diperbesar & seimbang.
// forExport: tanpa background halaman — full warna invoice (kartu solid).

import { deriveInvoice, rp, type Invoice, type InvoiceIdentity } from '@/lib/invoice';
import { CHECK_IN_TIME, CHECK_OUT_TIME } from '@/lib/booking-rules';

const SERIF = "'Cormorant Garamond', serif";
const SANS = "'Manrope', sans-serif";
const GOLD = '#9C7A2E';
const goldTextGrad: React.CSSProperties = {
  background: 'linear-gradient(135deg,#B68A33,#9C7A2E 60%,#6E551C)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

interface Props {
  inv: Invoice;
  identity: InvoiceIdentity;
  variant?: 'krem' | 'pita';
  showStamp?: boolean;
  showQR?: boolean;
  forExport?: boolean;
  copied?: string | null;
  onCopyRek?: () => void;
  onCopyTotal?: () => void;
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

export function InvoiceDocument({
  inv, identity, variant = 'krem', showStamp = true, showQR = true,
  forExport = false, copied = null, onCopyRek, onCopyTotal,
}: Props) {
  const isPita = variant === 'pita';
  const isKrem = !isPita;
  const goldText: React.CSSProperties = forExport ? { color: '#9C7A2E' } : goldTextGrad;
  const { subtotal, totalPaid, balance, fullyPaid } = deriveInvoice(inv);
  const balanceLabel = fullyPaid ? 'TOTAL' : 'SISA TAGIHAN';
  const balanceVal = fullyPaid ? subtotal : balance;
  // Pembayaran mengurangi tagihan ("− Rp"). Baris refund (amount negatif) menambah
  // kembali yang harus dibayar → tampil "+ Rp X" (bukan "− Rp -X" yg membingungkan).
  const paidLines = inv.payments.map((p) => ({
    label: p.label,
    text: (p.amount < 0 ? '+ ' : '− ') + rp(Math.abs(p.amount)),
  }));
  // LUNAS → dokumen jadi KWITANSI (tanda terima); DP/belum → INVOICE (tagihan).
  const docType = fullyPaid && subtotal > 0 ? 'KWITANSI' : 'INVOICE';

  const metaRows: [string, string][] = [
    [`NO. ${docType}`, inv.id],
    ['TANGGAL', inv.date],
    ['JATUH TEMPO', inv.due],
  ];

  const cardBg = forExport
    ? 'linear-gradient(160deg, #FFFDF7, #F8F2E7)'
    : 'linear-gradient(160deg, rgba(255,253,247,.74), rgba(248,242,231,.56))';

  // Lebar kolom tabel item (flex, bukan grid)
  const COL_QTY = 64, COL_HARGA = 172, COL_JUMLAH = 184;

  return (
    <div
      style={{
        width: 1080, minHeight: forExport ? undefined : 1528, padding: forExport ? 0 : 46,
        position: 'relative', fontFamily: SANS, overflow: 'hidden',
        background: forExport ? 'transparent' : 'radial-gradient(120% 82% at 18% 0%, #F4ECDC 0%, #EBE2CF 52%, #E2D8C2 100%)',
      }}
    >
      {!forExport && <>
        <div style={{ position: 'absolute', width: 560, height: 560, top: -190, right: -150, background: 'radial-gradient(circle, rgba(156,122,46,.13), rgba(156,122,46,0) 68%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 520, height: 520, bottom: -200, left: -170, background: 'radial-gradient(circle, rgba(156,122,46,.10), rgba(156,122,46,0) 70%)', pointerEvents: 'none' }} />
      </>}

      <div style={{ position: 'relative', borderRadius: forExport ? 0 : 26, overflow: 'hidden', background: cardBg, backdropFilter: forExport ? undefined : 'blur(26px)', WebkitBackdropFilter: forExport ? undefined : 'blur(26px)', border: forExport ? 'none' : '1px solid rgba(156,122,46,.30)', boxShadow: forExport ? 'none' : '0 42px 92px -34px rgba(120,96,40,.40), inset 0 1px 0 rgba(255,255,255,.65)' }}>

        {isKrem && (
          <div style={{ height: 3, background: 'linear-gradient(90deg, rgba(156,122,46,0), #C9A24B 28%, #9C7A2E 50%, #C9A24B 72%, rgba(156,122,46,0))' }} />
        )}

        {/* PITA: gold band header */}
        {isPita && (
          <div style={{ background: 'linear-gradient(135deg,#A6802F 0%,#8A6A24 55%,#6E551C 100%)', padding: '34px 56px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/invoice/logo-mark-cream.png" alt="Top Hills" style={{ height: 92, width: 'auto', display: 'block', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.18))' }} />
              <div style={{ borderLeft: '1px solid rgba(243,236,221,.4)', paddingLeft: 18 }}>
                <div style={{ fontSize: 13, letterSpacing: 3, color: 'rgba(243,236,221,.85)', fontWeight: 600 }}>KOST &amp; PENGINAPAN</div>
                <div style={{ fontSize: 15, color: 'rgba(243,236,221,.7)', marginTop: 7 }}>Limau Manis, Pauh — Padang</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 58, letterSpacing: 8, lineHeight: .9, color: '#F6EFDF' }}>{docType}</div>
              {inv.tag && <div style={{ display: 'inline-block', marginTop: 10, padding: '6px 15px', border: '1px solid rgba(246,239,223,.55)', borderRadius: 20, fontSize: 12, letterSpacing: 2.5, color: '#F6EFDF', fontWeight: 700 }}>{inv.tag}</div>}
              <MetaBlock rows={metaRows} kColor="rgba(243,236,221,.62)" vColor="#F6EFDF" />
            </div>
          </div>
        )}

        <div style={{ position: 'relative', padding: '46px 56px 42px' }}>

          {/* KREM: classic header */}
          {isKrem && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/invoice/logo-mark.png" alt="Top Hills" style={{ height: 106, width: 'auto', display: 'block', margin: '-2px 0 0 -2px' }} />
                  <div style={{ fontSize: 14, color: '#8A8170', marginTop: 6, letterSpacing: .3 }}>Limau Manis, Pauh — Padang</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 62, letterSpacing: 8, lineHeight: .9, ...goldText }}>{docType}</div>
                  {inv.tag && <div style={{ display: 'inline-block', marginTop: 11, padding: '6px 15px', border: '1px solid rgba(156,122,46,.5)', borderRadius: 20, fontSize: 12, letterSpacing: 2.5, color: GOLD, fontWeight: 700 }}>{inv.tag}</div>}
                  <MetaBlock rows={metaRows} kColor="#9C8A6A" vColor="#3A332A" />
                </div>
              </div>
              <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(156,122,46,.08), rgba(156,122,46,.34), rgba(156,122,46,.08))', margin: '26px 0' }} />
            </>
          )}

          <div style={{ height: isPita ? 6 : 0 }} />

          {/* BILL TO / DETAIL */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 40 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, letterSpacing: 2.2, color: GOLD, fontWeight: 700, marginBottom: 11 }}>DITAGIHKAN KEPADA</div>
              <div style={{ fontFamily: SERIF, fontSize: 32, fontWeight: 600, color: '#2C2620', lineHeight: 1.1 }}>{inv.customer.name}</div>
              {inv.customer.phone && <div style={{ fontSize: 16, color: '#7A7164', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{inv.customer.phone}</div>}
              <div style={{ fontSize: 16, color: '#7A7164', marginTop: 3 }}>{inv.customer.kind}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontSize: 13, letterSpacing: 2.2, color: GOLD, fontWeight: 700, marginBottom: 11 }}>DETAIL PEMESANAN</div>
              <div style={{ fontSize: 18, color: '#2C2620', fontWeight: 700 }}>{inv.booking.room}</div>
              {inv.booking.period && <div style={{ fontSize: 16, color: '#7A7164', marginTop: 6 }}>{inv.booking.period}</div>}
              <div style={{ fontSize: 16, color: '#7A7164', marginTop: 3 }}>Check-in {CHECK_IN_TIME} · Check-out {CHECK_OUT_TIME}</div>
            </div>
          </div>

          {/* LINE ITEMS — flex table */}
          <div style={{ marginTop: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px 12px', borderBottom: '1px solid rgba(156,122,46,.32)' }}>
              <div style={{ flex: 1, ...hdr() }}>DESKRIPSI</div>
              <div style={{ width: COL_QTY, ...hdr('center') }}>QTY</div>
              <div style={{ width: COL_HARGA, ...hdr('right') }}>HARGA</div>
              <div style={{ width: COL_JUMLAH, ...hdr('right') }}>JUMLAH</div>
            </div>
            {inv.items.map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '18px 4px', borderBottom: '1px solid rgba(60,52,40,.10)' }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
                  <div style={{ fontSize: 20, color: '#2C2620', fontWeight: 600 }}>{row.desc}</div>
                  {row.note && <div style={{ fontSize: 15, color: '#8A8170', marginTop: 3 }}>{row.note}</div>}
                </div>
                <div style={{ width: COL_QTY, fontSize: 18, color: '#5A5446', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{row.qty}</div>
                <div style={{ width: COL_HARGA, fontSize: 18, color: '#5A5446', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{rp(row.price)}</div>
                <div style={{ width: COL_JUMLAH, fontSize: 18, color: '#2C2620', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{rp(row.qty * row.price)}</div>
              </div>
            ))}
          </div>

          {/* TOTALS */}
          {isKrem ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <div style={{ width: 420 }}>
                <TotRow label="Subtotal" value={rp(subtotal)} />
                {paidLines.map((pl, i) => <TotRow key={i} label={pl.label} value={pl.text} />)}
                <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(156,122,46,.12), rgba(156,122,46,.42))', margin: '10px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '4px 4px 0' }}>
                  <span style={{ fontSize: 13, letterSpacing: 2, color: GOLD, fontWeight: 700, paddingBottom: 6 }}>{balanceLabel}</span>
                  <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 46, lineHeight: 1, ...goldText, fontVariantNumeric: 'tabular-nums' }}>{rp(balanceVal)}</span>
                </div>
                {!fullyPaid && !forExport && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                    <CopyBtn onClick={onCopyTotal} done={copied === 'total'} doneText="Tersalin ✓" text="Salin nominal" theme="gold" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 26 }}>
              <div style={{ width: 440, borderRadius: 16, padding: '22px 26px', background: 'linear-gradient(135deg,#A6802F,#7C5F22)', boxShadow: '0 16px 36px -16px rgba(120,96,40,.6)' }}>
                <TotRow label="Subtotal" value={rp(subtotal)} cream />
                {paidLines.map((pl, i) => <TotRow key={i} label={pl.label} value={pl.text} cream />)}
                <div style={{ height: 1, background: 'rgba(246,239,223,.30)', margin: '11px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <span style={{ fontSize: 13, letterSpacing: 2, color: 'rgba(246,239,223,.9)', fontWeight: 700, paddingBottom: 6 }}>{balanceLabel}</span>
                  <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 46, lineHeight: 1, color: '#FBF6EC', fontVariantNumeric: 'tabular-nums' }}>{rp(balanceVal)}</span>
                </div>
                {!fullyPaid && !forExport && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                    <CopyBtn onClick={onCopyTotal} done={copied === 'total'} doneText="Tersalin ✓" text="Salin nominal" theme="cream" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEMPEL status — IN-FLOW & terpusat (tidak menumpuk teks, aman di
              preview & PNG). LUNAS bila lunas, BELUM LUNAS bila masih DP. */}
          {showStamp && (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '30px 0 4px' }}>
              {fullyPaid && subtotal > 0 ? (
                <div style={{ transform: 'rotate(-6deg)', border: '3px double #9C7A2E', borderRadius: 14, padding: '12px 30px 10px', textAlign: 'center', background: 'rgba(156,122,46,.06)' }}>
                  <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 46, letterSpacing: 6, lineHeight: .9, color: '#9C7A2E' }}>LUNAS</div>
                  <div style={{ fontSize: 12.5, letterSpacing: 5, color: '#9C7A2E', marginTop: 5, opacity: .85 }}>PAID IN FULL · {inv.date}</div>
                </div>
              ) : (
                <div style={{ transform: 'rotate(-6deg)', border: '3px double #B05C3B', borderRadius: 14, padding: '12px 28px 10px', textAlign: 'center', background: 'rgba(176,92,59,.06)' }}>
                  <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 32, letterSpacing: 4, lineHeight: .92, color: '#B05C3B' }}>BELUM LUNAS</div>
                  <div style={{ fontSize: 12, letterSpacing: 2.5, color: '#B05C3B', marginTop: 6, opacity: .9 }}>{totalPaid > 0 ? `DP ${rp(totalPaid)} DITERIMA · ${inv.date}` : `TAGIHAN BELUM DIBAYAR · ${inv.date}`}</div>
                </div>
              )}
            </div>
          )}

          {/* PAYMENT + QR */}
          <div style={{ display: 'flex', gap: 22, marginTop: 30, alignItems: 'stretch' }}>
            <div style={{ flex: 1, border: '1px solid rgba(156,122,46,.26)', borderRadius: 16, padding: '22px 24px', background: 'rgba(156,122,46,.05)' }}>
              <div style={{ fontSize: 13, letterSpacing: 2.2, color: GOLD, fontWeight: 700, marginBottom: 14 }}>PEMBAYARAN · TRANSFER</div>
              <PayRow label="Bank" value={<span style={{ fontSize: 16.5, color: '#2C2620', fontWeight: 600 }}>{identity.bankName}</span>} />
              <PayRow label="No. Rekening" value={
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16.5, color: '#2C2620', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>{identity.accountNo}</span>
                  {!forExport && <CopyBtn small onClick={onCopyRek} done={copied === 'rek'} doneText="Tersalin ✓" text="Salin" theme="gold" />}
                </span>
              } />
              <PayRow label="Atas Nama" value={<span style={{ fontSize: 16.5, color: '#2C2620', fontWeight: 600 }}>{identity.accountName}</span>} />
              <div style={{ fontSize: 14, color: '#8A8170', marginTop: 16, lineHeight: 1.55 }}>Kirim bukti transfer <span style={{ color: '#5A5446' }}>asli</span> ke WhatsApp Resmi · {identity.waResmi} untuk diverifikasi admin.</div>
            </div>
            {/* QR hanya tampil bila ADA gambar QRIS (kost = tanpa QR). Bila QR
                dimatikan / kosong, blok QR ini hilang & kolom bayar full-width. */}
            {showQR && identity.qrisBase64 && (
              <div style={{ width: 172, flex: 'none', border: '1px solid rgba(156,122,46,.26)', borderRadius: 16, padding: 16, background: 'rgba(156,122,46,.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={identity.qrisBase64} alt="QRIS" style={{ width: 120, height: 120, borderRadius: 10, objectFit: 'cover' }} />
                <div style={{ fontSize: 12.5, letterSpacing: 1.6, color: '#7A7164', marginTop: 12, textAlign: 'center' }}>SCAN UNTUK BAYAR</div>
              </div>
            )}
          </div>

          {/* TERMS — dua kolom via flex */}
          <div style={{ marginTop: 30 }}>
            <div style={{ fontSize: 13, letterSpacing: 2.2, color: GOLD, fontWeight: 700, marginBottom: 12 }}>SYARAT &amp; KETENTUAN</div>
            <div style={{ display: 'flex', gap: 32 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Term>Uang muka / DP <b style={{ color: '#5A5446', fontWeight: 600 }}>tidak dapat dikembalikan</b> apabila booking dibatalkan.</Term>
                <Term>Bukti pembayaran asli wajib dikirim &amp; diverifikasi admin.</Term>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Term>Pelunasan dilakukan di awal sebelum menempati kamar.</Term>
              </div>
            </div>
          </div>

          <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(156,122,46,.06), rgba(156,122,46,.26), rgba(156,122,46,.06))', margin: '30px 0 26px' }} />

          {/* FOOTER + SIGNATURE */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 40 }}>
            <div style={{ maxWidth: 360 }}>
              <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 26, color: '#4A443C', lineHeight: 1.3 }}>Terima kasih telah mempercayai Top Hills 🌸</div>
              <div style={{ fontSize: 14, color: '#8A8170', marginTop: 10, lineHeight: 1.5 }}>Pembayaran dianggap sah setelah bukti diverifikasi oleh admin resmi.</div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 280 }}>
              <div style={{ fontSize: 13, letterSpacing: 2.2, color: '#9C8A6A', fontWeight: 700 }}>HORMAT KAMI</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/invoice/signature-ink.png" alt="Tanda tangan" style={{ width: 188, height: 'auto', display: 'block', margin: '2px 0 -6px auto' }} />
              <div style={{ height: 1, width: 240, marginLeft: 'auto', background: 'linear-gradient(90deg, rgba(156,122,46,0), rgba(156,122,46,.55))' }} />
              <div style={{ fontFamily: SERIF, fontSize: 25, fontWeight: 600, color: '#2C2620', marginTop: 10 }}>{identity.ownerName}</div>
              <div style={{ fontSize: 14, color: '#7A7164', letterSpacing: .5, marginTop: 2 }}>{identity.ownerTitle}</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function hdr(align: 'left' | 'center' | 'right' = 'left'): React.CSSProperties {
  return { fontSize: 12.5, letterSpacing: 2, color: GOLD, fontWeight: 700, textAlign: align };
}
// Meta (NO INVOICE / TANGGAL / JATUH TEMPO) — flex rows, nilai rata kanan & sejajar.
function MetaBlock({ rows, kColor, vColor }: { rows: [string, string][]; kColor: string; vColor: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9, marginTop: 16 }}>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16 }}>
          <span style={{ fontSize: 12, letterSpacing: 1.6, color: kColor }}>{k}</span>
          <span style={{ fontSize: 16, color: vColor, fontWeight: 600, fontVariantNumeric: 'tabular-nums', minWidth: 170, textAlign: 'right' }}>{v}</span>
        </div>
      ))}
    </div>
  );
}
function PayRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '5px 0' }}>
      <span style={{ fontSize: 15, color: '#8A8170' }}>{label}</span>
      {value}
    </div>
  );
}
function TotRow({ label, value, cream }: { label: string; value: string; cream?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: cream ? '6px 0' : '8px 4px' }}>
      <span style={{ fontSize: 16.5, color: cream ? 'rgba(246,239,223,.78)' : '#7A7164' }}>{label}</span>
      <span style={{ fontSize: 16.5, color: cream ? '#F6EFDF' : '#3A332A', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}
function Term({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 9, fontSize: 15, color: '#8A8170', lineHeight: 1.5 }}>
      <span style={{ color: GOLD }}>✦</span><span>{children}</span>
    </div>
  );
}
function CopyBtn({ onClick, done, doneText, text, theme, small }: { onClick?: () => void; done?: boolean; doneText: string; text: string; theme: 'gold' | 'cream'; small?: boolean }) {
  const cream = theme === 'cream';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: small ? 5 : 6,
        border: `1px solid ${cream ? 'rgba(246,239,223,.55)' : 'rgba(156,122,46,.45)'}`,
        background: cream ? 'rgba(246,239,223,.16)' : 'rgba(156,122,46,.10)',
        color: cream ? '#F6EFDF' : GOLD, fontSize: small ? 13 : 14, fontWeight: 700, letterSpacing: .4,
        padding: small ? '5px 10px' : '8px 14px', borderRadius: small ? 8 : 9, cursor: 'pointer',
        fontFamily: SANS, lineHeight: 1,
      }}
    >
      <CopyIcon />{done ? doneText : text}
    </button>
  );
}
