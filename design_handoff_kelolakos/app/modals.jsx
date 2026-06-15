// ===== KelolaKos · Modal & alur =====
const { Btn: MB, Card: MC, Sheet, Dialog, BayarBadge: MBadge, InfoRow: MRow,
        RUPIAH: MRP, TANGGAL: MTGL, TANGGAL_SHORT: MTGLS, ROOM_STATUS: MRST } = window;

// (BookingFlow & BookingDetail kini ada di app/booking.jsx)

// --------- Detail kamar ---------
function RoomDetail({ room, onClose }) {
  if (!room) return null;
  const s = MRST[room.status];
  return (
    <Sheet open={!!room} onClose={onClose} maxH="70%">
      <div style={{ padding: '20px 22px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ width: 16, height: 16, borderRadius: '50%', background: s.dot }} />
          <span style={{ fontSize: 18, fontWeight: 600 }}>{s.label}</span>
        </div>
        <h2 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 28, margin: '0 0 18px' }}>{room.nama}</h2>
        <MC style={{ marginBottom: 18 }}>
          <MRow label="Gedung" value={room.gedung} />
          <MRow label="Lantai" value={String(room.lantai)} />
          <MRow label="Harga sewa" value={MRP(room.harga) + ' / bulan'} />
          <MRow label="Penyewa" value={room.penyewa || 'Belum ada'} />
          {room.bayar && <div style={{ paddingTop: 12 }}><MBadge status={room.bayar} big /></div>}
        </MC>
        {room.status === 'tersedia'
          ? <MB variant="primary" size="lg" block onClick={onClose}>＋ Isi Kamar Ini</MB>
          : <MB variant="secondary" block onClick={onClose}>Tutup</MB>}
      </div>
    </Sheet>
  );
}

// --------- Konfirmasi pembayaran ---------
function PayConfirm({ booking, onClose, onConfirm }) {
  return (
    <Dialog open={!!booking}>
      {booking && (<>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--mint-soft)', display: 'grid', placeItems: 'center', marginBottom: 16, color: 'var(--green)' }}><window.LineIcon name="cek" size={30} sw={2.2} /></div>
        <h3 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 25, margin: '0 0 10px' }}>Tandai sudah lunas?</h3>
        <p style={{ fontSize: 18, color: 'var(--ink-soft)', margin: '0 0 22px' }}>
          Pembayaran dari <b style={{ color: 'var(--navy)' }}>{booking.nama}</b> sebesar <b style={{ color: 'var(--navy)' }}>{MRP(booking.total - booking.dibayar)}</b> akan dicatat sebagai lunas.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <MB variant="secondary" block onClick={onClose}>Nanti Dulu</MB>
          <MB variant="success" block onClick={onConfirm}>Ya, Lunas</MB>
        </div>
      </>)}
    </Dialog>
  );
}

// --------- Konfirmasi hapus (menenangkan) ---------
function DeleteConfirm({ target, onClose, onConfirm }) {
  return (
    <Dialog open={!!target}>
      {target && (<>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--mauve-soft)', display: 'grid', placeItems: 'center', marginBottom: 16, color: 'var(--navy)' }}><window.LineIcon name="hapus" size={28} sw={2.2} /></div>
        <h3 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 25, margin: '0 0 10px' }}>Hapus data {target.nama}?</h3>
        <p style={{ fontSize: 18, color: 'var(--ink-soft)', margin: '0 0 22px' }}>Tenang, data lain tidak terpengaruh. Anda bisa menambah penyewa baru kapan saja jika diperlukan.</p>
        <div style={{ display: 'flex', gap: 12 }}>
          <MB variant="secondary" block onClick={onClose}>Tidak Jadi</MB>
          <MB variant="primary" block onClick={onConfirm}>Ya, Hapus</MB>
        </div>
      </>)}
    </Dialog>
  );
}

// --------- Logout ---------
function LogoutConfirm({ open, onClose, onConfirm }) {
  return (
    <Dialog open={open}>
      <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--mauve-soft)', display: 'grid', placeItems: 'center', marginBottom: 16, color: 'var(--navy)' }}><window.LineIcon name="logout" size={28} sw={2.2} /></div>
      <h3 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 25, margin: '0 0 10px' }}>Keluar dari aplikasi?</h3>
      <p style={{ fontSize: 18, color: 'var(--ink-soft)', margin: '0 0 22px' }}>Anda perlu memasukkan kode akses lagi saat membuka aplikasi nanti.</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <MB variant="secondary" block onClick={onClose}>Batal</MB>
        <MB variant="primary" block onClick={onConfirm}>Ya, Keluar</MB>
      </div>
    </Dialog>
  );
}

// --------- Bantuan kontekstual ---------
const HELP_TEXT = {
  beranda: { t: 'Tentang Beranda', items: ['Lihat ringkasan uang dan kamar Anda di satu layar.', 'Bagian "Perlu Ditagih" menampilkan penyewa yang belum lunas.', 'Tekan tombol oranye "Tambah Penyewa" untuk menambah penyewa baru.'] },
  kamar: { t: 'Tentang Kamar', items: ['Lihat semua kamar beserta kondisinya.', 'Warna hijau berarti terisi, oranye berarti perlu perhatian.', 'Tekan satu kamar untuk melihat detailnya.'] },
  booking: { t: 'Tentang Booking', items: ['Daftar semua penyewa Anda ada di sini.', 'Gunakan kotak cari untuk menemukan nama dengan cepat.', 'Tekan satu penyewa untuk catat pembayaran atau ubah data.'] },
  keuangan: { t: 'Tentang Keuangan', items: ['Semua uang masuk dan keluar tercatat di sini.', 'Hijau = uang masuk, oranye = uang keluar.', 'Tekan "Catat Transaksi" untuk menambah catatan baru.'] },
  laporan: { t: 'Tentang Laporan', items: ['Lihat perkembangan keuangan tiap bulan.', 'Batang hijau = pemasukan, oranye = pengeluaran.', 'Anda bisa mengunduh laporan dalam bentuk PDF.'] },
  kwitansi: { t: 'Tentang Kwitansi', items: ['Buat bukti pembayaran untuk penyewa.', 'Pilih nama penyewa, lalu lihat pratinjaunya.', 'Kirim langsung lewat WhatsApp.'] },
  layout: { t: 'Tentang Layout Properti', items: ['Lihat peta seluruh kamar per gedung dan lantai.', 'Warna menunjukkan kondisi tiap kamar.', 'Tekan kotak kamar untuk melihat detail.'] },
  setting: { t: 'Tentang Pengaturan', items: ['Atur data properti, kamar, dan akun Anda.', 'Butuh bantuan? Hubungi tim kami lewat WhatsApp.', 'Tekan "Keluar" untuk keluar dari aplikasi.'] },
  panduan: { t: 'Tentang Panduan', items: ['Pelajari cara memakai aplikasi langkah demi langkah.', 'Tekan judul panduan untuk melihat langkahnya.', 'Tekan "Lihat Tur Singkat Lagi" untuk mengulang perkenalan.'] },
};
function HelpSheet({ topic, onClose, onPanduan }) {
  const h = HELP_TEXT[topic];
  return (
    <Sheet open={!!topic} onClose={onClose} maxH="70%">
      {h && (
        <div style={{ padding: '22px 22px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--mint-soft)', border: '2px solid var(--mint)', display: 'grid', placeItems: 'center', fontFamily: 'var(--heading)', fontWeight: 900, fontSize: 24 }}>?</div>
            <h2 style={{ fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 24, margin: 0 }}>{h.t}</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 22 }}>
            {h.items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: '50%', background: 'var(--navy)', color: '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--heading)', fontWeight: 700, fontSize: 16 }}>{i + 1}</span>
                <span style={{ fontSize: 18, lineHeight: 1.45 }}>{it}</span>
              </div>
            ))}
          </div>
          <window.Card tone="mint" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, padding: 16 }}>
            <span style={{ color: 'var(--navy)', flexShrink: 0, display: 'grid' }}><window.LineIcon name="bantuan" size={26} /></span>
            <span style={{ fontSize: 17 }}>Masih bingung? Chat tim KelolaKos lewat WhatsApp, kami bantu.</span>
          </window.Card>
          {onPanduan && topic !== 'panduan' && <MB variant="secondary" block onClick={onPanduan} style={{ marginBottom: 12 }}><window.LineIcon name="bantuan" size={20} sw={2.2} color="currentColor" /> Buka Panduan Lengkap</MB>}
          <MB variant="primary" block onClick={onClose}>Saya Mengerti</MB>
        </div>
      )}
    </Sheet>
  );
}

Object.assign(window, { RoomDetail, PayConfirm, DeleteConfirm, LogoutConfirm, HelpSheet });
