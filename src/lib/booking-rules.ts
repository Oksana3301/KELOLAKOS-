// Aturan jam check-in / check-out penginapan (satu sumber agar konsisten di
// form booking, invoice, & pesan WhatsApp). Ubah di sini bila jamnya berubah.
export const CHECK_IN_TIME = '14.00';
export const CHECK_OUT_TIME = '12.00';

/** Ringkas: "Check-in mulai 14.00 WIB · Check-out maksimal 12.00 WIB" */
export const JAM_NOTE = `Check-in mulai ${CHECK_IN_TIME} WIB · Check-out maksimal ${CHECK_OUT_TIME} WIB`;

/** Penjelasan lengkap untuk tamu (anti rugi / kemalaman). */
export const JAM_NOTE_LONG =
  `Check-in mulai pukul ${CHECK_IN_TIME} WIB, check-out maksimal pukul ${CHECK_OUT_TIME} WIB. ` +
  `Datang setelah jam check-in & pulang sebelum check-out ya — lewat dari pukul ${CHECK_OUT_TIME} bisa dihitung tambah 1 malam.`;
