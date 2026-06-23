'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { api, type RoomStatus, type PriceItem, type BookingFullData } from '@/lib/api';
import { facilityApi, type Fasilitas } from '@/lib/api-v2';
import { formatRupiah, formatRupiahShort } from '@/lib/utils';
import { normalizePhone62, formatPhoneDisplay } from '@/lib/phone';
import { DatePicker } from './ui/date-picker';
import { toast } from 'sonner';

export type BookingFormMode = 'create' | 'edit';

interface BookingFormModalProps {
  mode: BookingFormMode;
  rooms: RoomStatus[];
  prices: PriceItem[];
  /** Existing booking data for edit mode */
  existingBooking?: BookingFullData;
  onClose: () => void;
}

export function BookingFormModal({
  mode,
  rooms,
  prices,
  existingBooking,
  onClose,
}: BookingFormModalProps) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [customerName, setCustomerName] = useState(existingBooking?.Nama_Customer || '');
  const [whatsapp, setWhatsapp] = useState(existingBooking?.WhatsApp || '');
  // Layanan: 'KOS' | 'PENGINAPAN' — dipilih dulu di create mode untuk memfilter kamar
  const [selectedLayanan, setSelectedLayanan] = useState(existingBooking?.Layanan || '');
  const [selectedRoomId, setSelectedRoomId] = useState(existingBooking?.RoomID || '');
  const [selectedPaket, setSelectedPaket] = useState(existingBooking?.Paket || 'Bulanan');
  const [jumlahPeriode, setJumlahPeriode] = useState(existingBooking?.Jumlah_Periode || 1);
  const [checkIn, setCheckIn] = useState(
    existingBooking?.CheckIn
      ? new Date(existingBooking.CheckIn).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
  );
  const [hargaKamar, setHargaKamar] = useState(existingBooking?.Harga_Kamar || 0);
  const [extraCharge, setExtraCharge] = useState(existingBooking?.Extra_Charge || 0);
  const [diskon, setDiskon] = useState(existingBooking?.Diskon || 0);
  const [dpAwal, setDpAwal] = useState(0); // Hanya untuk create mode
  const [dpTanggal, setDpTanggal] = useState(''); // opsional
  const [pelunasanNominal, setPelunasanNominal] = useState(0); // opsional
  const [pelunasanTanggal, setPelunasanTanggal] = useState(''); // opsional
  const [extraRequest, setExtraRequest] = useState(existingBooking?.Extra_Request || '');
  const [isEkstra, setIsEkstra] = useState(existingBooking?.Is_Ekstra === 'YA');
  const [catatan, setCatatan] = useState(existingBooking?.Catatan || '');
  const [selectedFacIds, setSelectedFacIds] = useState<Set<string>>(new Set());

  const isEdit = mode === 'edit';

  // Fetch facilities list
  const { data: fasilitasList = [] } = useQuery({
    queryKey: ['fasilitas'],
    queryFn: facilityApi.list,
  });

  // For edit mode: load current facility assignment for this booking's room
  const { data: bookingDetail } = useQuery({
    queryKey: ['booking-detail', existingBooking?.BookingID],
    queryFn: () => api.getBookingDetail(existingBooking!.BookingID),
    enabled: isEdit && !!existingBooking?.BookingID,
  });

  // Pre-populate facility selection when bookingDetail loads
  useEffect(() => {
    if (isEdit && bookingDetail?.facilities) {
      setSelectedFacIds(new Set(bookingDetail.facilities.map((f) => f.id)));
    }
  }, [isEdit, bookingDetail]);

  // For create mode: rooms must be READY *and* match the chosen layanan (Kost/Penginapan).
  // Layanan dipilih lebih dulu, lalu daftar kamar muncul terfilter.
  const availableRooms = useMemo(() => {
    if (isEdit) return rooms; // edit: selected room is locked anyway
    if (!selectedLayanan) return [];
    return rooms.filter((r) => r.Status_Code === 'READY' && r.Layanan_Default === selectedLayanan);
  }, [rooms, isEdit, selectedLayanan]);

  const selectedRoom = rooms.find((r) => r.RoomID === selectedRoomId);

  // Paket yang tersedia untuk kamar terpilih — diambil dari price list, lalu
  // dibatasi sesuai layanan (Kost: 6 Bulan/Setahun · Penginapan: Harian/Bulanan/Tahunan).
  const availablePakets = useMemo(() => {
    if (isEdit || !selectedRoom) return [];
    const fromPrices = [
      ...new Set(
        prices
          .filter(
            (p) =>
              p.Layanan === selectedRoom.Layanan_Default &&
              p.Gedung === selectedRoom.Gedung &&
              p.Tipe_Kamar === selectedRoom.Tipe_Kamar,
          )
          .map((p) => p.Paket),
      ),
    ];
    const allowed =
      selectedRoom.Layanan_Default === 'KOS'
        ? ['6 Bulan', 'Setahun']
        : ['Harian', 'Bulanan', 'Tahunan', 'Setahun', 'Mingguan'];
    const ordered = allowed.filter((a) => fromPrices.includes(a));
    if (ordered.length) return ordered;
    if (fromPrices.length) return fromPrices;
    // fallback bila price list belum diisi: tampilkan opsi sesuai layanan
    return selectedRoom.Layanan_Default === 'KOS'
      ? ['6 Bulan', 'Setahun']
      : ['Harian', 'Bulanan', 'Tahunan'];
  }, [isEdit, selectedRoom, prices]);

  // Saat ganti layanan → reset kamar terpilih (create mode)
  useEffect(() => {
    if (!isEdit) setSelectedRoomId('');
  }, [selectedLayanan, isEdit]);

  // Pastikan paket terpilih valid untuk kamar ini (create mode)
  useEffect(() => {
    if (!isEdit && availablePakets.length && !availablePakets.includes(selectedPaket)) {
      setSelectedPaket(availablePakets[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availablePakets, isEdit]);

  // Find matching price for selected room + paket
  const matchingPrice = useMemo(() => {
    if (!selectedRoom) return null;
    return prices.find(
      (p) =>
        p.Layanan === selectedRoom.Layanan_Default &&
        p.Gedung === selectedRoom.Gedung &&
        p.Tipe_Kamar === selectedRoom.Tipe_Kamar &&
        p.Paket === selectedPaket,
    );
  }, [selectedRoom, selectedPaket, prices]);

  // In create mode, auto-update hargaKamar based on selected price
  useEffect(() => {
    if (!isEdit && matchingPrice) {
      setHargaKamar(matchingPrice.Harga_Satuan);
    }
  }, [matchingPrice, isEdit]);

  // Live calc
  const facSubtotalPerPeriode = useMemo(() => {
    let total = 0;
    fasilitasList.forEach((f) => {
      if (selectedFacIds.has(f.id)) total += f.price_adjust;
    });
    return total;
  }, [fasilitasList, selectedFacIds]);

  // In create mode: hargaKamar is PER PERIODE, so total = harga * jumlah
  // In edit mode: hargaKamar from existing booking is already TOTAL
  const baseTotal = isEdit ? hargaKamar : hargaKamar * jumlahPeriode;
  const facTotal = isEdit ? 0 : facSubtotalPerPeriode * jumlahPeriode; // Facility add only in create
  const totalNet = Math.max(baseTotal + facTotal + extraCharge - diskon, 0);
  const totalBayarAwal = dpAwal + pelunasanNominal;
  const sisa = isEdit ? 0 : Math.max(totalNet - totalBayarAwal, 0);

  // Auto-calc checkout date (create mode only — edit lets user set directly)
  const checkOut = useMemo(() => {
    if (isEdit && existingBooking?.CheckOut) {
      return new Date(existingBooking.CheckOut).toISOString().split('T')[0];
    }
    if (!checkIn || !jumlahPeriode) return checkIn;
    const d = new Date(checkIn);
    if (selectedPaket === 'Harian') d.setDate(d.getDate() + jumlahPeriode);
    else if (selectedPaket === 'Mingguan') d.setDate(d.getDate() + jumlahPeriode * 7);
    else if (selectedPaket === 'Bulanan') d.setMonth(d.getMonth() + jumlahPeriode);
    else if (selectedPaket === 'Setahun' || selectedPaket === 'Tahunan')
      d.setFullYear(d.getFullYear() + jumlahPeriode);
    else if (selectedPaket === '6 Bulan') d.setMonth(d.getMonth() + jumlahPeriode * 6);
    return d.toISOString().split('T')[0];
  }, [checkIn, jumlahPeriode, selectedPaket, isEdit, existingBooking]);

  const [checkOutEdit, setCheckOutEdit] = useState(checkOut);
  useEffect(() => {
    if (!isEdit) setCheckOutEdit(checkOut);
  }, [checkOut, isEdit]);

  function toggleFacility(id: string) {
    setSelectedFacIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!customerName.trim()) {
      toast.error('Nama customer wajib diisi');
      return;
    }
    if (!isEdit && !selectedRoom) {
      toast.error('Pilih kamar dulu');
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && existingBooking) {
        // EDIT MODE
        await api.submitBookingEdit({
          bookingId: existingBooking.BookingID,
          customerName: customerName.trim(),
          whatsapp: whatsapp ? normalizePhone62(whatsapp) : '',
          checkIn,
          checkOut: checkOutEdit,
          hargaKamar,
          extraCharge,
          diskon,
          hargaTotal: totalNet,
          catatan,
          extraRequest,
          isEkstra,
          fasilitasIds: Array.from(selectedFacIds),
        });
        toast.success('Booking berhasil diupdate ✓');
      } else {
        // CREATE MODE
        if (!selectedRoom) return;
        await api.submitBooking({
          roomId: selectedRoom.RoomID,
          customerName: customerName.trim(),
          whatsapp: whatsapp ? normalizePhone62(whatsapp) : '',
          checkIn,
          checkOut: checkOutEdit,
          paket: selectedPaket,
          jumlahPeriode,
          hargaKamar,
          extraCharge,
          diskon,
          dpAwal,
          dpTanggal,
          pelunasanNominal,
          pelunasanTanggal,
          catatan,
          extraRequest,
          isEkstra,
          fasilitasIds: Array.from(selectedFacIds),
        });
        toast.success('Booking berhasil dibuat ✓');
      }

      queryClient.invalidateQueries({ queryKey: ['initial-data'] });
      if (existingBooking) {
        queryClient.invalidateQueries({ queryKey: ['booking-detail', existingBooking.BookingID] });
      }
      onClose();
    } catch (e) {
      toast.error('Gagal: ' + (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-tx/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-sf w-full max-w-3xl rounded-lg shadow-lg max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-bd flex justify-between items-start sticky top-0 bg-sf rounded-t-lg">
          <div>
            <h2 className="font-bold text-base">
              {isEdit ? '✏️ Edit Booking' : '+ Booking Baru'}
            </h2>
            <p className="text-tx3 text-xs mt-0.5">
              {isEdit
                ? `${existingBooking?.BookingID} · ${existingBooking?.Nama_Kamar}`
                : 'Isi form di bawah, harga auto-calc'}
            </p>
          </div>
          <button onClick={onClose} className="text-tx3 hover:text-tx p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5 space-y-5 flex-1">
          {/* 1. Customer */}
          <Section number={1} title="Customer">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Nama Customer" required>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Pak Budi Santoso"
                  className="input"
                  required
                />
              </FormField>
              <FormField label="WhatsApp">
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="0812... / +62 812-..."
                  className="input"
                />
                {whatsapp.trim() && (
                  <div className="text-tx3 text-[10px] mt-1">
                    Tersimpan sebagai{' '}
                    <span className="font-semibold text-gr tabular-nums">{formatPhoneDisplay(whatsapp)}</span>{' '}
                    — siap dihubungi
                  </div>
                )}
              </FormField>
            </div>
          </Section>

          {/* 2. Layanan & Kamar */}
          <Section number={2} title="Layanan & Kamar">
            {!isEdit && (
              <FormField label="Mau booking apa?" required>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: 'KOS', emoji: '🏠', label: 'Kost Putri', desc: 'Gedung A & B · jangka panjang' },
                    { v: 'PENGINAPAN', emoji: '🛏️', label: 'Penginapan', desc: 'Gedung C · harian–tahunan' },
                  ].map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setSelectedLayanan(o.v)}
                      className={
                        'text-left p-3 rounded-md border-2 transition-all ' +
                        (selectedLayanan === o.v
                          ? 'border-ac bg-sf2 shadow-sm'
                          : 'border-bd bg-white hover:border-bds')
                      }
                    >
                      <div className="text-sm font-bold">
                        {o.emoji} {o.label}
                      </div>
                      <div className="text-[10px] text-tx3 mt-0.5">{o.desc}</div>
                    </button>
                  ))}
                </div>
              </FormField>
            )}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Pilih Kamar" required>
                {isEdit ? (
                  <div className="input bg-sf2 cursor-not-allowed">
                    {selectedRoom?.Nama_Kamar || '(unknown room)'}
                    <span className="block text-[10px] text-tx3 mt-0.5">
                      🔒 Kamar tidak bisa diubah saat edit
                    </span>
                  </div>
                ) : (
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="input"
                    required
                    disabled={!selectedLayanan}
                  >
                    <option value="">
                      {selectedLayanan ? '— Pilih kamar tersedia —' : '— pilih layanan dulu —'}
                    </option>
                    {availableRooms.map((r) => (
                      <option key={r.RoomID} value={r.RoomID}>
                        {r.Nama_Kamar} · {r.Gedung} · {r.Tipe_Kamar}
                      </option>
                    ))}
                  </select>
                )}
                {!isEdit && !selectedLayanan && (
                  <div className="text-tx3 text-[11px] mt-1">Pilih layanan dulu untuk melihat daftar kamar.</div>
                )}
                {!isEdit && selectedLayanan && availableRooms.length === 0 && (
                  <div className="text-rd text-[11px] mt-1">
                    ⚠️ Tidak ada kamar {selectedLayanan === 'KOS' ? 'kost' : 'penginapan'} yang tersedia.
                  </div>
                )}
              </FormField>
              <FormField label="Paket" required>
                {isEdit ? (
                  <div className="input bg-sf2 cursor-not-allowed">
                    {selectedPaket} · {existingBooking?.Jumlah_Periode} periode
                    <span className="block text-[10px] text-tx3 mt-0.5">🔒 Tidak bisa diubah</span>
                  </div>
                ) : (
                  <select
                    value={selectedPaket}
                    onChange={(e) => setSelectedPaket(e.target.value)}
                    className="input"
                    disabled={!selectedRoom}
                  >
                    {availablePakets.length === 0 && <option value="">— pilih kamar dulu —</option>}
                    {availablePakets.map((pk) => (
                      <option key={pk} value={pk}>
                        {pk}
                      </option>
                    ))}
                  </select>
                )}
                {!isEdit && selectedRoom && (
                  <div className="text-tx3 text-[10px] mt-1">
                    {selectedRoom.Layanan_Default === 'KOS'
                      ? 'Kost: pilihan 6 Bulan atau Setahun.'
                      : 'Penginapan: harian, bulanan, atau tahunan.'}
                  </div>
                )}
                {!isEdit && selectedRoom && !matchingPrice && (
                  <div className="text-am text-[11px] mt-1">
                    ⚠️ Belum ada harga {selectedPaket} untuk kamar ini
                  </div>
                )}
              </FormField>
            </div>
            {!isEdit && (
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Jumlah Periode" required>
                  <input
                    type="number"
                    value={jumlahPeriode}
                    onChange={(e) => setJumlahPeriode(parseInt(e.target.value) || 1)}
                    min={1}
                    className="input"
                  />
                </FormField>
                <FormField label="Harga per periode">
                  <div className="input bg-sf2 tabular-nums">{formatRupiah(matchingPrice?.Harga_Satuan || 0)}</div>
                </FormField>
              </div>
            )}

            {/* Fasilitas */}
            {fasilitasList.length > 0 && (
              <div className="bg-sf2 border border-bd rounded-md p-3 mt-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] font-semibold text-tx2">🛋️ Fasilitas Tambahan</label>
                  <span className="text-[10px] text-tx3 font-medium">{selectedFacIds.size} dipilih</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {fasilitasList.map((f) => (
                    <FacilityCheckbox
                      key={f.id}
                      facility={f}
                      checked={selectedFacIds.has(f.id)}
                      onToggle={() => toggleFacility(f.id)}
                    />
                  ))}
                </div>
                {!isEdit && (
                  <div className="mt-2 pt-2 border-t border-dashed border-bd flex justify-between text-[11px]">
                    <span className="text-tx3">Subtotal fasilitas / periode:</span>
                    <span className="font-bold tabular-nums">{formatRupiah(facSubtotalPerPeriode)}</span>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* 3. Tanggal menginap (opsional) */}
          <Section number={3} title="Tanggal Menginap">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Check-in">
                <DatePicker value={checkIn} onChange={setCheckIn} clearable placeholder="Pilih tanggal" />
              </FormField>
              <FormField label={isEdit ? 'Check-out' : 'Check-out (auto)'}>
                <DatePicker
                  value={checkOutEdit}
                  onChange={setCheckOutEdit}
                  clearable
                  min={checkIn || undefined}
                  placeholder="Pilih tanggal"
                />
                {!isEdit && (
                  <div className="text-tx3 text-[10px] mt-1">
                    Otomatis dari check-in + periode · bisa diubah manual
                  </div>
                )}
              </FormField>
            </div>
            {!isEdit && (
              <div className="text-tx3 text-[10px]">Semua tanggal opsional — boleh dikosongkan dulu.</div>
            )}
          </Section>

          {/* 4. Harga */}
          <Section number={4} title="Harga & Pembayaran">
            {isEdit && (
              <div className="bg-amb border border-am rounded-md p-2.5 text-xs text-am">
                💡 Edit harga akan langsung re-calc total dan status pembayaran (Lunas/DP/dll).
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              {isEdit && (
                <FormField label="Harga Kamar (total)">
                  <RupiahInput value={hargaKamar} onChange={setHargaKamar} />
                </FormField>
              )}
              <FormField label="Extra Charge">
                <RupiahInput value={extraCharge} onChange={setExtraCharge} />
              </FormField>
              <FormField label="Diskon">
                <RupiahInput value={diskon} onChange={setDiskon} />
              </FormField>
            </div>

            {/* Pembayaran awal: DP + Pelunasan (opsional) — create mode */}
            {!isEdit && (
              <div className="bg-sf2 border border-bd rounded-md p-3 space-y-3">
                <div className="text-[11px] font-semibold text-tx2">💸 Pembayaran Awal (opsional)</div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Tanggal DP">
                    <DatePicker value={dpTanggal} onChange={setDpTanggal} clearable placeholder="—" />
                  </FormField>
                  <FormField label="Nominal DP">
                    <RupiahInput value={dpAwal} onChange={setDpAwal} />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Tanggal Pelunasan">
                    <DatePicker value={pelunasanTanggal} onChange={setPelunasanTanggal} clearable placeholder="—" />
                  </FormField>
                  <FormField label="Nominal Pelunasan">
                    <RupiahInput value={pelunasanNominal} onChange={setPelunasanNominal} />
                  </FormField>
                </div>
                <div className="text-tx3 text-[10px]">
                  Isi tanggal & nominal bila ingin sekalian mencatat pembayaran. Boleh dikosongkan = belum bayar.
                </div>
              </div>
            )}

            {/* Live calc */}
            <div className="bg-sf2 border border-bd rounded-md p-3 space-y-1.5">
              {!isEdit ? (
                <>
                  <CalcRow
                    label={`Harga kamar (${jumlahPeriode} × ${formatRupiahShort(hargaKamar)})`}
                    value={formatRupiah(baseTotal)}
                  />
                  {selectedFacIds.size > 0 && (
                    <CalcRow
                      label={`Fasilitas (${selectedFacIds.size} × ${jumlahPeriode})`}
                      value={'+' + formatRupiah(facTotal)}
                      accent="text-am"
                    />
                  )}
                </>
              ) : (
                <CalcRow label="Harga Kamar (total)" value={formatRupiah(baseTotal)} />
              )}
              <CalcRow label="Extra Charge" value={formatRupiah(extraCharge)} />
              <CalcRow label="Diskon" value={'-' + formatRupiah(diskon)} accent="text-rd" />
              <div className="border-t border-bd pt-2 mt-2 flex justify-between text-sm">
                <span className="font-bold">Total Net</span>
                <span className="font-bold tabular-nums">{formatRupiah(totalNet)}</span>
              </div>
              {!isEdit && dpAwal > 0 && (
                <CalcRow label="DP" value={'-' + formatRupiah(dpAwal)} accent="text-gr" />
              )}
              {!isEdit && pelunasanNominal > 0 && (
                <CalcRow label="Pelunasan" value={'-' + formatRupiah(pelunasanNominal)} accent="text-gr" />
              )}
              {!isEdit && (
                <CalcRow label="Sisa" value={formatRupiah(sisa)} muted />
              )}
              {isEdit && existingBooking && (
                <>
                  <CalcRow
                    label="Sudah Dibayar"
                    value={formatRupiah(existingBooking.Net_Diterima || 0)}
                    accent="text-gr"
                  />
                  <CalcRow
                    label="Sisa Setelah Edit"
                    value={formatRupiah(Math.max(totalNet - (existingBooking.Net_Diterima || 0), 0))}
                    muted
                  />
                </>
              )}
            </div>
          </Section>

          {/* 5. Permintaan Khusus + Catatan */}
          <Section number={5} title="✨ Permintaan Khusus & Catatan">
            <FormField label="Permintaan Khusus">
              <textarea
                value={extraRequest}
                onChange={(e) => setExtraRequest(e.target.value)}
                placeholder="Misal: minta extra pillow, late checkout, request kamar lantai atas..."
                rows={2}
                className="input resize-y"
              />
            </FormField>
            <FormField label="Catatan Internal">
              <textarea
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Catatan internal (tidak ditampilkan ke customer)..."
                rows={2}
                className="input resize-y"
              />
            </FormField>
            <label className="flex items-center gap-2 p-2.5 bg-vib border border-vi rounded-md cursor-pointer">
              <input
                type="checkbox"
                checked={isEkstra}
                onChange={(e) => setIsEkstra(e.target.checked)}
                className="w-4 h-4 accent-vi"
              />
              <span className="text-xs text-vi font-semibold">
                ⭐ Tandai sebagai <strong>customer ekstra</strong> — masuk grup follow-up khusus
              </span>
            </label>
          </Section>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-bd flex justify-between items-center sticky bottom-0 bg-sf rounded-b-lg">
          <span className="text-tx3 text-[11px]">
            Wajib diisi: <span className="text-rd font-semibold">*</span>
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn btn-sec">
              Batal
            </button>
            <button onClick={handleSubmit} disabled={submitting} className="btn btn-pri" type="submit">
              {submitting ? '⏳ Saving...' : isEdit ? '💾 Simpan Perubahan' : '✓ Simpan Booking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-bold text-sm mb-3 flex items-center gap-2">
        <span className="w-5 h-5 bg-ac text-inv rounded-full grid place-items-center text-[10px] font-bold">
          {number}
        </span>
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-tx2 mb-1 block">
        {label}
        {required && <span className="text-rd ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function RupiahInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tx3 text-xs font-semibold pointer-events-none">
        Rp
      </span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="input pl-9 tabular-nums"
        min={0}
      />
    </div>
  );
}

function CalcRow({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: string;
  muted?: boolean;
}) {
  return (
    <div className={`flex justify-between text-xs ${muted ? 'text-tx3' : ''}`}>
      <span className={muted ? '' : 'text-tx3'}>{label}</span>
      <span className={`font-semibold tabular-nums ${accent || 'text-tx'}`}>{value}</span>
    </div>
  );
}

function FacilityCheckbox({
  facility,
  checked,
  onToggle,
}: {
  facility: Fasilitas;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={
        checked
          ? 'flex items-center gap-2 p-2 bg-amb border-2 border-am rounded-md cursor-pointer transition-all'
          : 'flex items-center gap-2 p-2 bg-white border-2 border-bd rounded-md cursor-pointer hover:border-bds transition-all'
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="w-3.5 h-3.5 accent-ac flex-shrink-0"
      />
      <span className="text-xs font-medium flex-1 truncate">
        {facility.emoji} {facility.nama}
      </span>
      <span
        className={
          checked
            ? 'bg-am text-white px-1.5 py-0.5 rounded text-[9px] font-bold tabular-nums whitespace-nowrap'
            : 'bg-sf2 text-tx3 px-1.5 py-0.5 rounded text-[9px] font-bold tabular-nums whitespace-nowrap'
        }
      >
        {facility.price_adjust > 0 ? '+' + formatRupiahShort(facility.price_adjust) : 'Free'}
      </span>
    </label>
  );
}
