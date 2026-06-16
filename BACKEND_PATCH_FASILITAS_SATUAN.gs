/*******************************************************
 * PATCH FASILITAS SATUAN — simpan "per_hari / per_bulan / per_tahun" tiap fasilitas
 *
 * Frontend sekarang mengirim field `satuan` ('per_hari', 'per_bulan', atau
 * 'per_tahun') saat menyimpan fasilitas, dan butuh `satuan` ikut dikembalikan
 * oleh getFasilitas. Tanpa ini, semua fasilitas dianggap 'per_bulan' (default).
 *
 * LANGKAH:
 *  1) Di sheet FASILITAS, tambah 1 kolom header baru: "Satuan" (huruf bebas).
 *  2) Di fungsi simpan fasilitas (action 'saveFasilitas'), TULIS data.satuan ke
 *     kolom itu — SIMPAN APA ADANYA (jangan dipaksa ke per_bulan). Contoh pola:
 *        var allowed = ['per_hari', 'per_bulan', 'per_tahun'];
 *        var satuan = allowed.indexOf(data.satuan) >= 0 ? data.satuan : 'per_bulan';
 *        // ...lalu tulis `satuan` ke kolom "Satuan" saat append/update row.
 *  3) Di fungsi getFasilitas, IKUT kembalikan field `satuan` per baris:
 *        satuan: row[idxSatuan] || 'per_bulan',
 *
 * Setelah itu Deploy ulang. Lalu di app: Pengaturan → Fasilitas → set tiap
 * fasilitas "Per Hari" / "Per Bulan" / "Per Tahun". Saat booking, harganya
 * otomatis dikonversi memakai jumlah hari/bulan nyata:
 *   - fasilitas /hari   → harga × jumlah hari menginap
 *   - fasilitas /bulan  → harga × jumlah bulan (sewa harian/custom: prorate per hari)
 *   - fasilitas /tahun  → harga × (jumlah bulan ÷ 12); sewa harian/custom: (harga ÷ 365) × hari
 *
 * Kalau Anda paste fungsi `getFasilitas` & `saveFasilitas` Anda ke saya, saya
 * berikan versi lengkap yang sudah ada kolom Satuan-nya (tinggal ganti).
 *******************************************************/
