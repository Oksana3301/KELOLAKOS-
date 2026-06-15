# Accessibility — Elderly Users (MUST PRESERVE)

KelolaKos is built for **owners/caretakers of boarding houses aged 55+ who are not technical**. The entire redesign exists to serve them. When implementing, treat every item below as a hard requirement, not a suggestion. The approved prototype already satisfies all of these — keep them.

## 1. Text size — never shrink
- **No important text below 16px.** Body text is **18–19px**. Headings and amounts are much larger.
- Approved scale: hero 46 · page title 32 · subhead 23 · big number 28–36 · body 18–19 · button 19 · caption (smallest) 16.
- Keep `text-wrap: pretty` / generous line-height (~1.5 for body).

## 2. Contrast — high, verified WCAG (AA minimum, AAA where possible)
- **All text is Navy `#0C2C47` or Ink-soft `#3B5063`** on light backgrounds. Ink-soft is the ONLY gray allowed (8.35:1 on white = AAA). **No pale/light-gray text.**
- Button text on Orange/Green is **white** (Green 8.2:1 AAA; Orange 4.7:1 AA — keep button text bold/large).
- "DP" badge = **navy on yellow** (5.9:1). **Never white on yellow** (2.4:1, fails).
- **Mauve & Mint are background-only — never text** (≈1.6–1.7:1, fail).
- If you add any new color pairing, verify ≥ 4.5:1 before shipping.

## 3. Touch targets & spacing
- Every interactive element (buttons, tabs, filter pills, icon buttons, list rows, nav items) is **≥ 48px** tall/clickable. Primary buttons **≥ 56px** (large 64px).
- Use flex/grid `gap` for spacing between buttons so they never sit edge-to-edge (avoids mis-taps).

## 4. One clear primary action per screen
- Exactly **one prominent Orange button** is the main action on a screen (Tambah / Simpan / Catat). Everything else is visually lighter (secondary/ghost).
- The primary "Tambah …" CTA is **sticky at the top** on phone and pinned in the **sidebar** on laptop — reachable without scrolling.

## 5. Plain Indonesian, no jargon
- Everyday wording: "Tambah Penyewa", "Catat Pembayaran", "Uang Masuk". **No** English/tech terms ("Submit", "Tenant") and **no raw status codes** (AKTIF_DP, READY…). Collapse backend codes into plain statuses: **Lunas / DP / Belum Bayar / Batal** (payments) and **Terisi / Tersedia / Perlu Perhatian** (rooms).

## 6. Reassuring, never scary
- Delete/cancel always shows a **calming confirmation** ("Tenang, data lain tidak terpengaruh…", "Tidak Jadi" / "Ya, Hapus"). Never alarmist copy.
- Success/error feedback is a clear toast: green+check (success), orange+× (error), navy+i (info), in plain language.

## 7. Help is always present
- A round **"?" button** sits top-right on **every** screen → opens a short "what this page is for & how to use it" sheet + a link to the central **Panduan**.
- **Onboarding tour** runs on first launch (skippable, replayable from Panduan).
- Forms carry **inline hints**: a big label + an example ("Contoh: …") on every field.
- **Empty states guide**: illustration + plain text + arrow/button pointing to the action.

## 8. "Teks Lebih Besar" mode — keep it
- Pengaturan has a prominent **Ukuran Teks: Normal / Besar / Ekstra** control that scales the whole UI and persists. Keep this user-facing and easy to find.

## 9. Simplicity
- Few choices per screen. Don't reintroduce dense dashboards, multi-badge rows, or filters shown before the data. Default to "this month" etc., and hide advanced options behind one tap.

## 10. Consistency = learn once
- Same button styles, colors, icon language (thin line icons, no emoji), and the **same CRUD pattern** everywhere (see IMPLEMENTATION.md). A user who learns Booking should instantly understand Kelola Kamar and Keuangan.
