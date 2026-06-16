/*******************************************************
 * PATCH FASILITAS SATUAN — simpan "per_bulan / per_hari" untuk tiap fasilitas
 *
 * Frontend sekarang mengirim field `satuan` ('per_bulan' atau 'per_hari') saat
 * menyimpan fasilitas, dan butuh `satuan` ikut dikembalikan oleh getFasilitas.
 * Tanpa ini, semua fasilitas dianggap 'per_bulan' (default).
 *
 * LANGKAH:
 *  1) Di sheet FASILITAS, tambah 1 kolom header baru: "Satuan" (huruf bebas).
 *  2) Di fungsi simpan fasilitas (action 'saveFasilitas'), TULIS data.satuan ke
 *     kolom itu. Contoh pola:
 *        var satuan = (data.satuan === 'per_hari') ? 'per_hari' : 'per_bulan';
 *        // ...lalu tulis `satuan` ke kolom "Satuan" saat append/update row.
 *  3) Di fungsi getFasilitas, IKUT kembalikan field `satuan` per baris:
 *        satuan: row[idxSatuan] || 'per_bulan',
 *
 * Setelah itu Deploy ulang. Lalu di app: Pengaturan → Fasilitas → set tiap
 * fasilitas "Per Bulan" / "Per Hari". Saat booking, harganya otomatis dikonversi
 * memakai jumlah hari kalender nyata:
 *   - fasilitas /bulan + sewa bulanan  → harga × jumlah bulan
 *   - fasilitas /bulan + sewa harian   → (harga ÷ hari di bulan itu) × jumlah hari
 *   - fasilitas /hari                  → harga × jumlah hari menginap
 *
 * Kalau Anda paste fungsi `getFasilitas` & `saveFasilitas` Anda ke saya, saya
 * berikan versi lengkap yang sudah ada kolom Satuan-nya (tinggal ganti).
 *******************************************************/
