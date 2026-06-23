'use client';

// Top Hills — Invoice A4-portrait. Pixel-match brand spec, teks diperbesar untuk
// keterbacaan (lansia 60+). Dua variant: 'krem' (Krem Klasik) & 'pita' (Pita Emas).
// forExport: tanpa background halaman — hanya kartu invoice (kartu jadi solid).

import { deriveInvoice, rp, type Invoice, type InvoiceIdentity } from '@/lib/invoice';

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
  forExport?: boolean; // sembunyikan tombol salin + tanpa background halaman
  copied?: string | null;
  onCopyRek?: () => void;
  onCopyTotal?: () => void;
}

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
  // html2canvas tidak mendukung background-clip:text → saat export pakai emas solid.
  const goldText: React.CSSProperties = forExport ? { color: '#9C7A2E' } : goldTextGrad;
  const { subtotal, totalPaid, balance, fullyPaid } = deriveInvoice(inv);
  const balanceLabel = fullyPaid ? 'TOTAL' : 'SISA TAGIHAN';
  const balanceVal = fullyPaid ? subtotal : balance;
  const paidLines = inv.payments.map((p) => ({ label: p.label, text: '− ' + rp(p.amount) }));

  const metaRows: [string, string][] = [
    ['NO. INVOICE', inv.id],
    ['TANGGAL', inv.date],
    ['JATUH TEMPO', inv.due],
  ];

  // Kartu: solid saat export (kontras tinggi), glass saat preview.
  const cardBg = forExport
    ? 'linear-gradient(160deg, #FFFDF8, #F7F0E3)'
    : 'linear-gradient(160deg, rgba(255,253,247,.74), rgba(248,242,231,.56))';

  return (
    <div
      style={{
        width: 1080, minHeight: forExport ? undefined : 1560, padding: forExport ? 0 : 46,
        position: 'relative', fontFamily: SANS, overflow: 'hidden',
        background: forExport ? 'transparent' : 'radial-gradient(120% 82% at 18% 0%, #F4ECDC 0%, #EBE2CF 52%, #E2D8C2 100%)',
      }}
    >
      {!forExport && <>
        <div style={{ position: 'absolute', width: 560, height: 560, top: -190, right: -150, background: 'radial-gradient(circle, rgba(156,122,46,.13), rgba(156,122,46,0) 68%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', width: 520, height: 520, bottom: -200, left: -170, background: 'radial-gradient(circle, rgba(156,122,46,.10), rgba(156,122,46,0) 70%)', pointerEvents: 'none' }} />
      </>}

      <div style={{ position: 'relative', borderRadius: forExport ? 0 : 26, overflow: 'hidden', background: cardBg, backdropFilter: forExport ? undefined : 'blur(26px)', WebkitBackdropFilter: forExport ? undefined : 'blur(26px)', border: forExport ? 'none' : '1px solid rgba(156,122,46,.30)', boxShadow: forExport ? 'none' : '0 42px 92px -34px rgba(120,96,40,.40), inset 0 1px 0 rgba(255,255,255,.65)' }}>

        {/* KREM: top accent line */}
        {isKrem && (
          <div style={{ height: 4, background: 'linear-gradient(90deg, rgba(156,122,46,0), #C9A24B 28%, #9C7A2E 50%, #C9A24B 72%, rgba(156,122,46,0))' }} />
        )}

        {/* PITA: gold band header */}
        {isPita && (
          <div style={{ background: 'linear-gradient(135deg,#A6802F 0%,#8A6A24 55%,#6E551C 100%)', padding: '38px 60px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'inset 0 -1px 0 rgba(0,0,0,.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/invoice/logo-mark-cream.png" alt="Top Hills" style={{ height: 104, width: 'auto', display: 'block', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.18))' }} />
              <div style={{ borderLeft: '1px solid rgba(243,236,221,.4)', paddingLeft: 20 }}>
                <div style={{ fontSize: 13, letterSpacing: 3, color: 'rgba(243,236,221,.9)', fontWeight: 600 }}>KOST &amp; PENGINAPAN</div>
                <div style={{ fontSize: 15, color: 'rgba(243,236,221,.78)', marginTop: 8 }}>Limau Manis, Pauh — Padang</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 58, letterSpacing: 9, lineHeight: .9, color: '#F6EFDF' }}>INVOICE</div>
              {inv.tag && <div style={{ display: 'inline-block', marginTop: 11, padding: '6px 16px', border: '1px solid rgba(246,239,223,.55)', borderRadius: 22, fontSize: 12, letterSpacing: 2.5, color: '#F6EFDF', fontWeight: 700 }}>{inv.tag}</div>}
              <div style={{ display: 'inline-grid', gridTemplateColumns: 'auto auto', gap: '8px 18px', marginTop: 16, textAlign: 'right' }}>
                {metaRows.map(([k, v]) => (
                  <FragmentRow key={k} k={k} v={v} kColor="rgba(243,236,221,.66)" vColor="#F6EFDF" />
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ position: 'relative', padding: '50px 60px 46px' }}>

          {/* KREM: classic header */}
          {isKrem && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/invoice/logo-mark.png" alt="Top Hills" style={{ height: 118, width: 'auto', display: 'block', margin: '-2px 0 0 -2px' }} />
                  <div style={{ fontSize: 14, color: '#8A8170', marginTop: 8, letterSpacing: .3 }}>Limau Manis, Pauh — Padang</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 62, letterSpacing: 9, lineHeight: .9, ...goldText }}>INVOICE</div>
                  {inv.tag && <div style={{ display: 'inline-block', marginTop: 12, padding: '6px 16px', border: '1px solid rgba(156,122,46,.5)', borderRadius: 22, fontSize: 12, letterSpacing: 2.5, color: GOLD, fontWeight: 700 }}>{inv.tag}</div>}
                  <div style={{ display: 'inline-grid', gridTemplateColumns: 'auto auto', gap: '9px 20px', marginTop: 20, textAlign: 'right' }}>
                    {metaRows.map(([k, v]) => (
                      <FragmentRow key={k} k={k} v={v} kColor="#9C8A6A" vColor="#3A332A" />
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(156,122,46,.08), rgba(156,122,46,.34), rgba(156,122,46,.08))', margin: '30px 0' }} />
            </>
          )}

          <div style={{ height: isPita ? 8 : 0 }} />

          {/* BILL TO / DETAIL */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 40 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, letterSpacing: 2.4, color: GOLD, fontWeight: 700, marginBottom: 13 }}>DITAGIHKAN KEPADA</div>
              <div style={{ fontFamily: SERIF, fontSize: 33, fontWeight: 600, color: '#2C2620', lineHeight: 1.05 }}>{inv.customer.name}</div>
              {inv.customer.phone && <div style={{ fontSize: 16.5, color: '#6A6256', marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>{inv.customer.phone}</div>}
              <div style={{ fontSize: 16.5, color: '#6A6256', marginTop: 4 }}>{inv.customer.kind}</div>
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontSize: 13, letterSpacing: 2.4, color: GOLD, fontWeight: 700, marginBottom: 13 }}>DETAIL PEMESANAN</div>
              <div style={{ fontSize: 18.5, color: '#2C2620', fontWeight: 700 }}>{inv.booking.room}</div>
              {inv.booking.period && <div style={{ fontSize: 16.5, color: '#6A6256', marginTop: 8 }}>{inv.booking.period}</div>}
              <div style={{ fontSize: 16.5, color: '#6A6256', marginTop: 4 }}>Check-in 13.00 · Check-out 12.00</div>
            </div>
          </div>

          {/* LINE ITEMS */}
          <div style={{ marginTop: 34 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 190px 200px', padding: '0 4px 14px', borderBottom: '1px solid rgba(156,122,46,.32)' }}>
              <div style={hdr()}>DESKRIPSI</div>
              <div style={hdr('center')}>QTY</div>
              <div style={hdr('right')}>HARGA</div>
              <div style={hdr('right')}>JUMLAH</div>
            </div>
            {inv.items.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 190px 200px', alignItems: 'center', padding: '20px 4px', borderBottom: '1px solid rgba(60,52,40,.10)' }}>
                <div>
                  <div style={{ fontSize: 20, color: '#2C2620', fontWeight: 600 }}>{row.desc}</div>
                  {row.note && <div style={{ fontSize: 15, color: '#8A8170', marginTop: 4 }}>{row.note}</div>}
                </div>
                <div style={{ fontSize: 18, color: '#4A4438', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{row.qty}</div>
                <div style={{ fontSize: 18, color: '#4A4438', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{rp(row.price)}</div>
                <div style={{ fontSize: 18, color: '#2C2620', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{rp(row.qty * row.price)}</div>
              </div>
            ))}
          </div>

          {/* TOTALS */}
          {isKrem ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 26 }}>
              <div style={{ width: 470 }}>
                <TotRow label="Subtotal" value={rp(subtotal)} />
                {paidLines.map((pl, i) => <TotRow key={i} label={pl.label} value={pl.text} />)}
                <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(156,122,46,.12), rgba(156,122,46,.42))', margin: '12px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 4px 0' }}>
                  <span style={{ fontSize: 13, letterSpacing: 2, color: GOLD, fontWeight: 700 }}>{balanceLabel}</span>
                  <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 48, lineHeight: 1, ...goldText, fontVariantNumeric: 'tabular-nums' }}>{rp(balanceVal)}</span>
                </div>
                {!fullyPaid && !forExport && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                    <CopyBtn onClick={onCopyTotal} done={copied === 'total'} doneText="Tersalin ✓" text="Salin nominal" theme="gold" />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 28 }}>
              <div style={{ width: 490, borderRadius: 18, padding: '26px 30px', background: 'linear-gradient(135deg,#A6802F,#7C5F22)', boxShadow: '0 16px 36px -16px rgba(120,96,40,.6)' }}>
                <TotRow label="Subtotal" value={rp(subtotal)} cream />
                {paidLines.map((pl, i) => <TotRow key={i} label={pl.label} value={pl.text} cream />)}
                <div style={{ height: 1, background: 'rgba(246,239,223,.30)', margin: '13px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, letterSpacing: 2, color: 'rgba(246,239,223,.9)', fontWeight: 700 }}>{balanceLabel}</span>
                  <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 48, lineHeight: 1, color: '#FBF6EC', fontVariantNumeric: 'tabular-nums' }}>{rp(balanceVal)}</span>
                </div>
                {!fullyPaid && !forExport && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                    <CopyBtn onClick={onCopyTotal} done={copied === 'total'} doneText="Tersalin ✓" text="Salin nominal" theme="cream" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PAYMENT + QR */}
          <div style={{ display: 'flex', gap: 24, marginTop: 38, alignItems: 'stretch' }}>
            <div style={{ flex: 1, border: '1px solid rgba(156,122,46,.26)', borderRadius: 18, padding: '26px 28px', background: 'rgba(156,122,46,.05)' }}>
              <div style={{ fontSize: 13, letterSpacing: 2.4, color: GOLD, fontWeight: 700, marginBottom: 16 }}>PEMBAYARAN · TRANSFER</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '11px 16px' }}>
                <span style={{ fontSize: 15.5, color: '#8A8170', alignSelf: 'center' }}>Bank</span>
                <span style={{ fontSize: 17, color: '#2C2620', fontWeight: 600, textAlign: 'right' }}>{identity.bankName}</span>
                <span style={{ fontSize: 15.5, color: '#8A8170', alignSelf: 'center' }}>No. Rekening</span>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
                  <span style={{ fontSize: 17, color: '#2C2620', fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>{identity.accountNo}</span>
                  {!forExport && <CopyBtn small onClick={onCopyRek} done={copied === 'rek'} doneText="Tersalin ✓" text="Salin" theme="gold" />}
                </span>
                <span style={{ fontSize: 15.5, color: '#8A8170', alignSelf: 'center' }}>Atas Nama</span>
                <span style={{ fontSize: 17, color: '#2C2620', fontWeight: 600, textAlign: 'right' }}>{identity.accountName}</span>
              </div>
              <div style={{ fontSize: 14.5, color: '#6A6256', marginTop: 18, lineHeight: 1.55 }}>Kirim bukti transfer <span style={{ color: '#4A4438', fontWeight: 600 }}>asli</span> ke WhatsApp Resmi · {identity.waResmi} untuk diverifikasi admin.</div>
            </div>
            {showQR && (
              <div style={{ width: 188, flex: 'none', border: '1px solid rgba(156,122,46,.26)', borderRadius: 18, padding: 18, background: 'rgba(156,122,46,.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {identity.qrisBase64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={identity.qrisBase64} alt="QRIS" style={{ width: 134, height: 134, borderRadius: 12, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 134, height: 134, borderRadius: 12, background: 'repeating-linear-gradient(45deg,#9C7A2E 0 6px, #EFE7D6 6px 12px)', opacity: .55, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: SANS, fontSize: 11, letterSpacing: 1.5, color: '#F6EFDF', background: GOLD, padding: '4px 8px', borderRadius: 5, fontWeight: 700 }}>QRIS</span>
                  </div>
                )}
                <div style={{ fontSize: 12.5, letterSpacing: 1.6, color: '#6A6256', marginTop: 13, textAlign: 'center' }}>SCAN UNTUK BAYAR</div>
              </div>
            )}
          </div>

          {/* TERMS */}
          <div style={{ marginTop: 34 }}>
            <div style={{ fontSize: 13, letterSpacing: 2.4, color: GOLD, fontWeight: 700, marginBottom: 14 }}>SYARAT &amp; KETENTUAN</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '11px 34px' }}>
              <Term>Uang muka / DP <b style={{ color: '#4A4438', fontWeight: 600 }}>tidak dapat dikembalikan</b> apabila booking dibatalkan.</Term>
              <Term>Pelunasan dilakukan di awal sebelum menempati kamar.</Term>
              <Term>Bukti pembayaran asli wajib dikirim &amp; diverifikasi admin.</Term>
              <Term>Air sudah termasuk · listrik token diisi sendiri (khusus kost).</Term>
            </div>
          </div>

          <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(156,122,46,.06), rgba(156,122,46,.26), rgba(156,122,46,.06))', margin: '34px 0 28px' }} />

          {/* FOOTER + SIGNATURE */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 40 }}>
            <div style={{ maxWidth: 380 }}>
              <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 26, color: '#4A443C', lineHeight: 1.3 }}>Terima kasih telah mempercayai Top Hills 🌸</div>
              <div style={{ fontSize: 14.5, color: '#7A7164', marginTop: 12, lineHeight: 1.5 }}>Pembayaran dianggap sah setelah bukti diverifikasi oleh admin resmi.</div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 290 }}>
              <div style={{ fontSize: 13, letterSpacing: 2.4, color: '#9C8A6A', fontWeight: 700 }}>HORMAT KAMI</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/invoice/signature-ink.png" alt="Tanda tangan" style={{ width: 210, height: 'auto', display: 'block', margin: '4px 0 -6px auto' }} />
              <div style={{ height: 1, width: 260, marginLeft: 'auto', background: 'linear-gradient(90deg, rgba(156,122,46,0), rgba(156,122,46,.55))' }} />
              <div style={{ fontFamily: SERIF, fontSize: 25, fontWeight: 600, color: '#2C2620', marginTop: 12 }}>{identity.ownerName}</div>
              <div style={{ fontSize: 14.5, color: '#7A7164', letterSpacing: .5, marginTop: 3 }}>{identity.ownerTitle}</div>
            </div>
          </div>

          {/* STAMP */}
          {showStamp && fullyPaid && (
            <div style={{ position: 'absolute', bottom: 130, left: '51%', transform: 'translateX(-50%) rotate(-13deg)', pointerEvents: 'none' }}>
              <div style={{ border: '3px double #9C7A2E', borderRadius: 16, padding: '14px 32px 12px', textAlign: 'center', boxShadow: '0 0 26px rgba(156,122,46,.16)', background: 'rgba(156,122,46,.05)' }}>
                <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 52, letterSpacing: 7, lineHeight: .9, color: '#9C7A2E' }}>LUNAS</div>
                <div style={{ fontSize: 13, letterSpacing: 5, color: '#9C7A2E', marginTop: 6, opacity: .85 }}>PAID IN FULL</div>
                <div style={{ fontSize: 11.5, letterSpacing: 1.5, color: '#A6802F', marginTop: 5, opacity: .7 }}>{inv.date}</div>
              </div>
            </div>
          )}
          {showStamp && !fullyPaid && (
            <div style={{ position: 'absolute', bottom: 130, left: '51%', transform: 'translateX(-50%) rotate(-13deg)', pointerEvents: 'none' }}>
              <div style={{ border: '3px double #B05C3B', borderRadius: 16, padding: '15px 30px 13px', textAlign: 'center', boxShadow: '0 0 26px rgba(176,92,59,.16)', background: 'rgba(176,92,59,.05)' }}>
                <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 35, letterSpacing: 4, lineHeight: .92, color: '#B05C3B' }}>BELUM LUNAS</div>
                <div style={{ fontSize: 12.5, letterSpacing: 3, color: '#B05C3B', marginTop: 7, opacity: .9 }}>{totalPaid > 0 ? `DP ${rp(totalPaid)} DITERIMA` : 'TAGIHAN BELUM DIBAYAR'}</div>
                <div style={{ fontSize: 11, letterSpacing: 1.5, color: '#B05C3B', marginTop: 5, opacity: .65 }}>{inv.date}</div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function hdr(align: 'left' | 'center' | 'right' = 'left'): React.CSSProperties {
  return { fontSize: 12.5, letterSpacing: 2, color: GOLD, fontWeight: 700, textAlign: align };
}
function FragmentRow({ k, v, kColor, vColor }: { k: string; v: string; kColor: string; vColor: string }) {
  return (
    <>
      <div style={{ fontSize: 12, letterSpacing: 1.6, color: kColor, alignSelf: 'center' }}>{k}</div>
      <div style={{ fontSize: 16.5, color: vColor, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
    </>
  );
}
function TotRow({ label, value, cream }: { label: string; value: string; cream?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: cream ? '6px 0' : '8px 4px' }}>
      <span style={{ fontSize: 16.5, color: cream ? 'rgba(246,239,223,.8)' : '#6A6256' }}>{label}</span>
      <span style={{ fontSize: 16.5, color: cream ? '#F6EFDF' : '#3A332A', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}
function Term({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 15, color: '#6A6256', lineHeight: 1.5 }}>
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
        display: 'inline-flex', alignItems: 'center', gap: small ? 6 : 7,
        border: `1px solid ${cream ? 'rgba(246,239,223,.55)' : 'rgba(156,122,46,.45)'}`,
        background: cream ? 'rgba(246,239,223,.16)' : 'rgba(156,122,46,.10)',
        color: cream ? '#F6EFDF' : GOLD, fontSize: small ? 13 : 14, fontWeight: 700, letterSpacing: .4,
        padding: small ? '6px 11px' : '9px 16px', borderRadius: small ? 9 : 10, cursor: 'pointer',
        fontFamily: SANS, lineHeight: 1,
      }}
    >
      <CopyIcon />{done ? doneText : text}
    </button>
  );
}
