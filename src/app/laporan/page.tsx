'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { ScreenHead, KkButton, KkCard } from '@/components/kk/ui';
import { KkIcon } from '@/components/kk/icons';
import { KkPeriodFilter, resolvePeriod, type PeriodValue } from '@/components/kk/money';
import { HelpSheet } from '@/components/kk/help-sheet';
import { exportGeneralLedgerExcel } from '@/lib/excel-export';
import { kwitansiApi } from '@/lib/api-v2';
import { downloadAsPNG } from '@/lib/image-export';
import { ReportDocument } from '@/components/report/ReportDocument';
import { reportDataToPeriod, rp, type PeriodReport, type RLine } from '@/lib/report';

const HELP = {
  title: 'Laporan',
  tips: [
    'Pilih periode di atas untuk melihat ringkasan keuangan pada rentang waktu tersebut.',
    'Tekan "Unduh PNG" / "Unduh PDF" untuk laporan mewah yang bisa dibagikan, atau "Excel" untuk data rinci.',
    'Tekan "Lihat rincian" di kartu untuk melihat detail uang masuk / keluar.',
  ],
};

const PREVIEW_W = 540;

function fmtLabel(start: string, end: string): string {
  const s = new Date(start); const e = new Date(end);
  const same = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  if (same) return s.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  return `${s.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
function fmtRange(start: string, end: string): string {
  const s = new Date(start); const e = new Date(end); const now = new Date();
  return `Periode ${s.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })} – ${e.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · per ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}, ${now.getHours()}.${String(now.getMinutes()).padStart(2, '0')} WIB`;
}

export default function LaporanPage() {
  const [period, setPeriod] = useState<PeriodValue>({ preset: 'this_month' });
  const [helpOpen, setHelpOpen] = useState(false);
  const [detail, setDetail] = useState<'bersih' | 'masuk' | 'keluar' | 'sisa' | null>(null);
  const [docH, setDocH] = useState(1700);

  const exportRef = useRef<HTMLDivElement>(null);

  const resolved = useMemo(() => resolvePeriod(period), [period]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['report-data', resolved?.start, resolved?.end],
    queryFn: () => api.getReportData(resolved!.start, resolved!.end),
    enabled: !!resolved,
  });
  const { data: initData } = useQuery({ queryKey: ['initial-data'], queryFn: api.getInitialData });

  const rep: PeriodReport | null = useMemo(() => {
    if (!data || !resolved) return null;
    return reportDataToPeriod(data, initData?.roomStatus, fmtLabel(resolved.start, resolved.end), fmtRange(resolved.start, resolved.end));
  }, [data, resolved, initData]);

  // Measure the full-size doc to size the scaled preview correctly.
  useEffect(() => {
    if (!exportRef.current) return;
    const el = exportRef.current;
    const ro = new ResizeObserver(() => setDocH(el.offsetHeight || 1700));
    ro.observe(el);
    setDocH(el.offsetHeight || 1700);
    return () => ro.disconnect();
  }, [rep]);

  async function fontsReady() {
    if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 120));
  }

  async function handlePNG() {
    if (!exportRef.current) return;
    const id = toast.loading('Menyiapkan laporan…');
    try {
      await fontsReady();
      await downloadAsPNG({ element: exportRef.current, filename: `laporan-${(rep?.label || 'tophills').replace(/\s+/g, '_')}-${Date.now()}`, scale: 2, backgroundColor: '#E3D9C4' });
      toast.success('Laporan tersimpan (PNG).', { id });
    } catch (e) { toast.error('Gagal: ' + (e as Error).message, { id }); }
  }

  async function handlePDF() {
    if (!exportRef.current) return;
    const id = toast.loading('Menyiapkan PDF…');
    try {
      await fontsReady();
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(exportRef.current, { scale: 2, backgroundColor: '#E3D9C4', useCORS: true });
      const url = canvas.toDataURL('image/png');
      const w = window.open('', '_blank');
      if (!w) { toast.error('Popup diblokir — izinkan popup untuk PDF.', { id }); return; }
      w.document.write(`<html><head><title>Laporan ${rep?.label || ''}</title><style>@page{margin:0}body{margin:0}img{width:100%;display:block}</style></head><body><img src="${url}" onload="window.focus();window.print();" /></body></html>`);
      w.document.close();
      toast.success('Laporan siap dicetak / simpan PDF.', { id });
    } catch (e) { toast.error('Gagal: ' + (e as Error).message, { id }); }
  }

  async function handleExcel() {
    if (!data) return;
    const id = toast.loading('Menyiapkan Excel…');
    try {
      let businessName = 'Top Hills & Co';
      try { const s = await kwitansiApi.get(); if (s?.business_name) businessName = s.business_name; } catch { /* ignore */ }
      await exportGeneralLedgerExcel({ reportData: data, businessName, saldoAwal: 0 });
      toast.success('File Excel berhasil diunduh.', { id });
    } catch (e) { toast.error('Gagal membuat Excel: ' + (e as Error).message, { id }); }
  }

  const scale = PREVIEW_W / 1080;

  return (
    <>
      <ScreenHead title="Laporan" sub="Ringkasan keuangan properti Anda." onHelp={() => setHelpOpen(true)} />

      <KkPeriodFilter value={period} onChange={setPeriod} />

      {isLoading ? (
        <div className="py-20 text-center">
          <div className="w-12 h-12 rounded-full border-4 border-kk-mauve border-t-kk-orange animate-spin mx-auto mb-4" />
          <div className="text-body text-kk-ink">Memuat laporan…</div>
        </div>
      ) : isError || !rep ? (
        <KkCard className="text-center py-12">
          <div className="w-14 h-14 rounded-full bg-kk-orange-soft text-kk-orange grid place-items-center mx-auto mb-4"><KkIcon name="info" size={30} /></div>
          <h2 className="font-heading font-bold text-subhead mb-2">Gagal memuat laporan</h2>
          <p className="text-body text-kk-ink mb-5">{(error as Error)?.message || 'Terjadi kesalahan'}</p>
          <KkButton variant="primary" onClick={() => refetch()}>Coba Lagi</KkButton>
        </KkCard>
      ) : (
        <>
          {/* Aksi unduh */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <KkButton variant="primary" block onClick={handlePNG}><KkIcon name="unduh" size={20} strokeWidth={2.2} /> PNG</KkButton>
            <KkButton variant="secondary" block onClick={handlePDF}><KkIcon name="unduh" size={20} strokeWidth={2.2} /> PDF</KkButton>
            <KkButton variant="secondary" block onClick={handleExcel}><KkIcon name="unduh" size={20} strokeWidth={2.2} /> Excel</KkButton>
          </div>

          {/* Preview mewah (skala) */}
          <div className="mt-5 flex justify-center">
            <div style={{ width: PREVIEW_W, height: Math.round(docH * scale), overflow: 'hidden', borderRadius: 16, boxShadow: '0 18px 50px -22px rgba(120,96,40,.5)' }}>
              <div style={{ width: 1080, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <ReportDocument rep={rep} onShow={(k) => setDetail(k)} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Node export tersembunyi (ukuran penuh, tanpa tombol rincian) */}
      {rep && (
        <div style={{ position: 'fixed', left: -100000, top: 0, pointerEvents: 'none' }} aria-hidden>
          <div ref={exportRef}>
            <ReportDocument rep={rep} forExport />
          </div>
        </div>
      )}

      {detail && rep && <DetailModal kind={detail} rep={rep} onClose={() => setDetail(null)} />}
      <HelpSheet open={helpOpen} onClose={() => setHelpOpen(false)} content={HELP} />
    </>
  );
}

function DetailModal({ kind, rep, onClose }: { kind: 'bersih' | 'masuk' | 'keluar' | 'sisa'; rep: PeriodReport; onClose: () => void }) {
  const net = rep.cashIn - rep.cashOut;
  const sisa = rep.openingBalance + rep.cashIn - rep.cashOut;
  let title = ''; let rows: { primary: string; secondary: string; amount: string }[] = []; let totalLabel = ''; let totalText = ''; let empty = false; let note = '';
  if (kind === 'masuk') {
    title = 'Rincian Uang Masuk';
    rows = rep.income.map((r: RLine) => ({ primary: r.label, secondary: r.sub, amount: rp(r.amount) }));
    totalLabel = 'Total uang masuk'; totalText = rp(rep.cashIn);
    if (!rows.length) { empty = true; note = 'Belum ada pemasukan pada periode ini.'; }
  } else if (kind === 'keluar') {
    title = 'Rincian Uang Keluar';
    if (!rep.expense.length) { empty = true; note = 'Belum ada pengeluaran pada periode ini.'; }
    else { rows = rep.expense.map((r) => ({ primary: r.label, secondary: r.sub, amount: rp(r.amount) })); totalLabel = 'Total uang keluar'; totalText = rp(rep.cashOut); }
  } else if (kind === 'bersih') {
    title = 'Rincian Pendapatan Bersih';
    rows = [
      { primary: 'Total uang masuk', secondary: 'semua pemasukan', amount: rp(rep.cashIn) },
      { primary: 'Total uang keluar', secondary: 'semua pengeluaran', amount: rep.cashOut ? '− ' + rp(rep.cashOut) : rp(0) },
    ];
    totalLabel = 'Untung bersih'; totalText = rp(net);
  } else {
    title = 'Rincian Arus Kas Bersih';
    rows = [
      { primary: 'Uang masuk', secondary: 'pemasukan periode', amount: rp(rep.cashIn) },
      { primary: 'Uang keluar', secondary: 'pengeluaran periode', amount: rep.cashOut ? '− ' + rp(rep.cashOut) : rp(0) },
    ];
    totalLabel = 'Arus kas bersih'; totalText = rp(sisa);
  }
  return (
    <div onClick={onClose} className="fixed inset-0 z-[70] flex items-center justify-center p-6" style={{ background: 'rgba(44,38,32,.46)', backdropFilter: 'blur(3px)' }}>
      <div onClick={(e) => e.stopPropagation()} className="w-[560px] max-w-full rounded-[22px] p-7" style={{ background: 'linear-gradient(160deg,#FBF7EE,#F2EBDC)', border: '1px solid rgba(156,122,46,.34)', boxShadow: '0 44px 100px -30px rgba(60,45,20,.55)' }}>
        <div className="flex justify-between items-start gap-4">
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif" }} className="font-bold text-[26px] text-[#2C2620] leading-none">{title}</div>
            <div className="text-[12.5px] text-[#8A8170] mt-1.5">{rep.label}</div>
          </div>
          <button onClick={onClose} className="w-[34px] h-[34px] flex-none rounded-full text-[19px]" style={{ border: '1px solid rgba(156,122,46,.35)', background: 'rgba(156,122,46,.07)', color: '#9C7A2E' }}>×</button>
        </div>
        <div className="h-px my-4" style={{ background: 'linear-gradient(90deg, rgba(156,122,46,.1), rgba(156,122,46,.34), rgba(156,122,46,.1))' }} />
        {empty ? (
          <div className="text-center py-8">
            <div className="w-[50px] h-[50px] mx-auto rounded-full grid place-items-center" style={{ border: '1.5px dashed rgba(156,122,46,.4)' }}><span className="w-[18px] h-0.5 inline-block" style={{ background: 'rgba(156,122,46,.5)' }} /></div>
            <div className="text-[14px] text-[#5A5446] mt-3.5 font-semibold">{note}</div>
          </div>
        ) : (
          <>
            {rows.map((r, i) => (
              <div key={i} className="flex justify-between items-center py-3.5" style={{ borderBottom: '1px solid rgba(60,52,40,.10)' }}>
                <div>
                  <div className="text-[15px] text-[#2C2620] font-semibold">{r.primary}</div>
                  <div className="text-[12.5px] text-[#8A8170] mt-0.5">{r.secondary}</div>
                </div>
                <div className="text-[15px] text-[#2C2620] font-bold tabular-nums">{r.amount}</div>
              </div>
            ))}
            <div className="flex justify-between items-baseline pt-4">
              <span className="text-[11px] tracking-[2px] text-[#9C7A2E] font-bold">{totalLabel}</span>
              <span style={{ fontFamily: "'Cormorant Garamond',serif" }} className="font-bold text-[32px] text-[#2C2620] tabular-nums">{totalText}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
