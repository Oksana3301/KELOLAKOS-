# Handoff: KelolaKos — Redesign Ramah Lansia (Elderly-Friendly Redesign)

## Start here — bundle contents
- **`IMPLEMENTATION.md`** — how to apply this: **reskin only, do not touch logic.** Page→reference mapping + definition of done. **Read first.**
- **`ACCESSIBILITY.md`** — non-negotiable elderly-friendly rules to preserve.
- **`tokens.css`** / **`tailwind.tokens.ts`** — copy-paste design tokens (colors, fonts, spacing, radius, touch sizes).
- **`Design System.html`** — visual reference: palette + verified contrast matrix, type, components, icons, CRUD pattern.
- **`KelolaKos Prototype.html`** + **`app/*.jsx`** — the working reference implementation to lift exact values from.
- **This README** — per-page specs (below).

## Overview
KelolaKos is a property-management app for boarding houses ("kos") and lodgings in Indonesia. This handoff covers a **complete UX/UI redesign** focused on **elderly, non-technical users (55+)**: large type, high contrast, big touch targets, plain Indonesian copy, one primary action per screen, short journeys, always-present help, and reassuring delete confirmations.

The redesign covers all 8 menus — **Beranda (dashboard), Booking, Kamar, Keuangan (Uang), Laporan, Kwitansi, Layout Properti, Pengaturan** — plus a responsive navigation shell (bottom tab bar on phone, labeled sidebar on laptop), modals, and a shared "money" component system (period filter + KPI cards) used across Beranda, Keuangan, and Laporan.

## About the Design Files
The files in this bundle are **design references created in HTML + React (via in-browser Babel)** — prototypes that show the intended look, copy, and behavior. **They are not production code to ship directly.** The existing KelolaKos app is **Next.js 15 + TypeScript + Tailwind CSS 3.4 + React Query**, with a Google Apps Script + Google Sheets backend (see the app's `src/lib/api.ts`).

**The task is to recreate these designs inside the existing Next.js codebase**, using its established patterns (App Router pages under `src/app/...`, components under `src/components/...`, Tailwind, React Query for data). **Do not touch or replace the backend logic** — the Apps Script API, license/access-code flow, and `api.ts`/`api-v2.ts` data layer stay exactly as they are. Only the UI/presentation layer is redesigned. Wire the redesigned components to the existing data hooks (`api.getInitialData`, `api.getReportData`, `submitBooking`, etc.).

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, and interactions are specified. Recreate the UI faithfully using the codebase's Tailwind setup. Translate the exact hex values and the type scale below into Tailwind theme tokens (`tailwind.config.ts`) and reuse them. Mock data in the prototype (names, amounts) is placeholder — bind real fields from the existing API types.

---

## Design Tokens

### Colors (use EXACTLY)
| Token | Hex | Role |
|---|---|---|
| White | `#FFFFFF` | Main background |
| Navy | `#0C2C47` | **All text**, headings, nav, icons |
| Green | `#2E5749` | Positive / income / status "Lunas" / success buttons |
| Orange | `#BF512C` | **Primary CTA buttons**, emphasis, status "Belum Bayar" |
| Yellow | `#DA9B2B` | Warning, status "DP / Parsial" (navy text on top) |
| Mauve | `#D6C9C5` | Section bg, borders, dividers — **never text** |
| Mint | `#ABCBCA` | Highlight bg, secondary cards, info badges — **never text** |

Derived tints (used for soft backgrounds): paper `#FAF8F7`, mauve-soft `#EFE9E7`, mint-soft `#E4EFEE`, orange-soft `#FBEFE9`, ink-soft (muted text, passes AA) `#3B5063`. Button drop-shadows: orange `#8F3C20`, green `#1F3D32`.

### Contrast rules (elderly accessibility — verified WCAG 2.1)
- Body text is **always Navy on White or Mint**. Navy/White = 14.3:1 (AAA), Navy/Mint = 8.3:1 (AAA), Navy/Mauve = 8.9:1 (AAA), Navy/Yellow = 5.9:1 (AA).
- Button text on Orange/Green is **White** (Orange 4.8:1 AA, Green 8.2:1 AAA).
- **Never** use Mauve, Mint, or Yellow as a text color on white; **never** white text on Yellow.

### Typography
- **Headings:** `Lato`, weight 700 (and 900 for hero/big numbers). Google Fonts.
- **Body:** `Josefin Sans`, weight 500–600 (never thinner — readability). Google Fonts.
- **Minimum body size 18px.** Scale used: hero/greeting 30px (900), page title 32px (Lato 700 / 900), section heading 21–23px, big number 28–36px (900, tabular-nums), body 18–19px, sub/explanation 15–16px (only for secondary text on high-contrast bg), button text 18–19px (600).
- Letter-spacing roughly -0.01em to -0.02em on large headings/numbers; line-height ~1.05 for numbers, ~1.3–1.5 for body.

### Spacing scale
4, 8, 12, 16, 24, 32, 48, 64 px. Layout is intentionally spacious.

### Radius
Cards 18px, buttons 14px, pills/filters 12px, small tiles 10–16px, status badges 999px (full).

### Buttons
- Min height **56px** (large 64px); generous padding; full-width on phone.
- **Primary (Orange):** bg `#BF512C`, white text, `box-shadow: 0 4px 0 #8F3C20`, press = translateY(2px).
- **Success (Green):** bg `#2E5749`, white text, `box-shadow: 0 4px 0 #1F3D32`.
- **Secondary:** white bg, navy text, 2px navy border.
- **Ghost:** transparent, navy text, 2px mauve border.
- Touch targets never below 48px.

### Status badges (pill, 999px radius, icon dot + label)
- **Lunas** → green bg, white text/dot.
- **Belum Bayar** → orange bg, white text/dot.
- **DP** → yellow bg, **navy** text/dot.
- **Batal** (cancelled booking) → mauve bg, navy text, ink-soft dot; the booking's name is shown struck-through and the card muted to ~72% opacity.
- Room/info ("Tersedia") → mint bg, navy text/dot.

### Iconography
All icons are **thin line icons, 2–2.4px stroke, currentColor, 24×24 viewBox** (no emoji anywhere). Set used: home (beranda), calendar (booking), bed (kamar), card (uang), list (lainnya), bar-chart (laporan), receipt (kwitansi), floor-plan (layout), sliders (setting), user (akun), chat (bantuan), trash (hapus), check-circle (cek), logout, chevron, calendar (kalender), send/paper-plane (kirim), download (unduh), up/down arrows (masuk/keluar). See `app/ui.jsx` → `LineIcon` for exact SVG paths.

---

## Navigation Shell (responsive)

Breakpoint: **≥ 900px viewport = laptop sidebar; < 900px = phone bottom tab bar.** Same menu set, order, and labels in both — users learn it once. Labels are **always text + icon** (elderly cannot guess icon-only nav).

- **Primary menus (always visible):** Beranda, Booking, Kamar, Uang (Keuangan), Lainnya.
- **Behind "Lainnya":** Laporan, Kwitansi, Layout Properti, Pengaturan. On phone, "Lainnya" opens a bottom sheet listing these four (colored icon tile + title + one-line description + chevron). On laptop, all four appear directly in the sidebar under a "Lainnya" label (muted), plus "Bantuan" and "Keluar" at the bottom.
- **Laptop sidebar (width 288px):** brand (logo "K" + "KelolaKos" + property name), a prominent orange "Tambah Penyewa" button at top, then "Menu Utama" group, "Lainnya" group, spacer, Bantuan + Keluar. Active item = navy fill, white text. Main content area max-width 840px, centered, padding 34–40px.
- **Phone bottom bar:** 5 items (icon + label), active item navy with an orange dot indicator; content scrolls above it; sticky status bar on top showing time + "KelolaKos".

---

## Screens / Views

> Layout note: every screen has a header (page title + one-line subtitle) and a round **"?" help button** (top-right, 48px, mint bg, navy "?"). Help opens a bottom sheet with 3 numbered plain-language tips + a WhatsApp prompt.

### 1. Beranda (Dashboard)
- **Purpose:** Calm daily summary + the most common actions, finance-literate-free.
- **Layout (top→bottom):**
  1. Greeting: h1 "Selamat datang, Bu Endang." (Lato 900, 30px) + subtitle "Ini ringkasan properti Anda hari ini." (19px, ink-soft) + help button.
  2. **Period filter** (shared component) — pills: Hari Ini / Minggu Ini / Bulan Ini (default) / Tahun Ini + a "Pilih Tanggal" pill (calendar icon) that opens a custom date-range panel (two `<input type=date>` "Dari tanggal" / "Sampai tanggal" + "Terapkan Rentang Ini" primary button; validates end ≥ start).
  3. **4 KPI cards** (shared component) — `.kpi-grid`: **1 column on phone, 2×2 on laptop**. Each card: title (Lato 700, 19px), one-line plain explanation (15px), big value (Lato 900, 28px, tabular-nums, nowrap), "Lihat rincian ›" affordance. Whole card is a button → opens a detail dialog.
     - **Pendapatan Bersih** (green featured card, white text) — "Untung Anda — uang masuk dikurangi uang keluar".
     - **Uang Masuk** (white card, value green) — "Semua uang yang Anda terima".
     - **Uang Keluar** (white card, value orange) — "Semua uang yang Anda keluarkan".
     - **Sisa Uang** (navy featured card, white text) — "Uang tunai yang Anda punya sekarang" (a cash-on-hand snapshot; does NOT change with the time filter).
  4. **Status Kamar** card (button → go to Kamar): 3 columns — Terisi (green dot), Masih Kosong (ink dot), Perlu Perhatian (orange dot), each a big count (Lato 900, 30px) + label; "Lihat semua ›".
  5. **Perlu Tindakan**: heading + count badge (orange). List of bookings that are Belum Bayar / DP — each card: name (20px), "{kamar} · Sisa {Rp}", status badge, and a green **"Tagih"** button (min 50px) that opens the payment confirm dialog. Empty state = mint card with check icon + "Semua sudah lunas...".
  6. Full-width orange **"＋ Tambah Penyewa Baru"** button.
- **KPI detail dialog:** period label, KPI title, big value, plain explanation; for "Pendapatan Bersih" shows the formula (Uang masuk + / Uang keluar − / Pendapatan bersih =); for masuk/keluar shows a small category breakdown; "Mengerti" primary button to close.

### 2. Booking
- **Purpose:** List & manage tenants — **the most-used feature; the new-booking flow must be the smoothest path in the app.**
- **List layout:** header; search input (19px); status tabs (Semua / Belum Bayar / DP / Lunas / **Batal**, active = navy pill); list of large booking cards. Card: name (20px) + room, single payment **status badge** (one badge only), date range, total amount. Cancelled bookings render muted (72% opacity) with a struck-through name. Tap a card → **booking detail sheet**.
- **Primary CTA:** prominent orange "＋ Tambah Penyewa Baru" — sticky at top on phone; the laptop sidebar's orange "Tambah Penyewa" serves the same on desktop.
- **Add-booking flow (3 numbered steps, in a bottom sheet):** a numbered step header (① Data Penyewa → ② Pilih Kamar → ③ Pembayaran; done steps show a green check, current is navy). Each field has a **big label + example + a help hint line** (chat icon).
  - **Step 1 — Data Penyewa:** "Nama Lengkap Penyewa" (example "Pak Budi Santoso"), "Nomor HP / WhatsApp" (example "0812 3456 7890", optional, used for kwitansi & reminders).
  - **Step 2 — Pilih Kamar & lama sewa:** selectable list of available rooms (each shows price/month, green check when chosen); a big **−/+ duration stepper** ("{n} bulan", min 1 max 24) plus quick pills 1/3/6/12; a "Tanggal Mulai Masuk" date field; and an **auto-calculated price box** (mint) showing `{harga} × {lama} bulan` + end date + a big **Total Sewa**.
  - **Step 3 — Pembayaran:** a big navy box "Total yang harus dibayar"; payment-status choice (Lunas / DP / Belum Bayar, each a card with badge + one-line description); if DP, an "amount paid now" field appears and **sisa** computes live; a mauve summary card (penyewa, kamar, periode, total, dibayar, sisa).
  - **Nav:** Kembali / Lanjut (disabled until the step is valid) / big green "✓ Simpan Booking".
  - **Success state:** after save, a confirmation screen — big green check, "Booking Tersimpan!", a summary card, and a "Selesai" button. (Show the full flow from tapping Tambah to Tersimpan.)
- **Booking detail sheet:** name + status badge; a card with Nomor HP, tanggal masuk/keluar, total, sudah dibayar (green), sisa tagihan (orange). Actions, all clearly visible:
  - **Catat Pembayaran** (green, primary — only when sisa > 0) → payment confirm dialog.
  - Row of two: **Ubah Booking** (secondary — reopens the flow prefilled in edit mode) | **Batal / Refund** (secondary, orange-tinted) → cancel/refund dialog.
  - **Hapus Booking** (ghost) → reassuring delete dialog.
  - For an already-cancelled booking: a calm note ("Booking ini sudah dibatalkan. Kamar sudah kembali tersedia.") + only "Hapus dari Daftar".
- **Cancel/Refund dialog (reassuring):** refund icon, "Batalkan booking {nama}?", calm copy ("Tenang, ini tidak menghapus data. Kamar {kamar} akan kembali tersedia…"); if the tenant already paid, a mint note explains the amount can be refunded as a record; buttons "Tidak Jadi" / "Ya, Batalkan".

### 3. Kamar — "Kelola Kamar" (master data, CRUD)
- **Purpose:** Manage the room master data — add / edit / delete rooms. **CRUD is intentionally identical to Booking so users learn it once.**
- **List layout:** header ("Kelola Kamar", "{n} kamar di {g} gedung"); a **sticky orange "＋ Tambah Kamar Baru"** CTA (same placement as Booking's Tambah); a one-line instruction ("Tekan satu kamar untuk ubah atau hapus."); rooms grouped by building (home icon + name + count) as **tappable row cards** (bed-icon tile, room name, "Lantai {n} · {harga}/bulan", chevron). Tap a card → **room detail sheet**.
- **Room detail sheet:** room name + status pill; a card (Gedung, Lantai, Harga sewa, Penyewa); if occupied, a mint note advising against deletion; actions = **Ubah Kamar** | **Hapus Kamar** (the same detail→Ubah/Hapus pattern as Booking).
- **Add/Edit form (bottom sheet):** title "Tambah Kamar Baru" / "Ubah Kamar"; **few fields, big labels + examples**: "Nomor Kamar" (example "A7 atau B3"), "Gedung" (pills of existing buildings), "Lantai" (−/+ stepper), "Harga Sewa per Bulan" (numeric, digits only). A live mint price preview; a big green "Simpan Kamar" / "Simpan Perubahan".
- **Delete confirm (reassuring):** "Hapus {nama}?" — if the room is occupied, the copy names the tenant and reassures the tenant's data is not deleted; otherwise "Tenang, kamar lain tidak terpengaruh…". Buttons "Tidak Jadi" / "Ya, Hapus".
- **Production note:** rooms are local state in the prototype; bind to the real rooms master-data API (create/update/delete) and reflect changes across Beranda, Layout Properti, and the booking room picker.

### 4. Keuangan (Uang)
- **Purpose:** Record money in/out across **4 clearly-separated types**, see the money summary, and review/delete recent transactions.
- **Layout (top→bottom):**
  1. Header + help.
  2. **"Catat Transaksi Baru"** — a 2×2 grid of **4 big labeled type cards** (1 column on phone). Each card: a tinted icon tile, a colored tag (**Pemasukan** green / **Pengeluaran** orange), the type name, and a one-line plain explanation. Tapping a card opens that type's record form. The four types:
     - **Pembayaran** (Pemasukan/green) — "Uang sewa yang diterima dari penyewa."
     - **Refund** (Pengeluaran/orange) — "Uang yang dikembalikan ke penyewa, misal saat booking dibatalkan."
     - **Fee Penjaga** (Pengeluaran/orange) — "Gaji atau upah untuk penjaga kos."
     - **Belanja Operasional** (Pengeluaran/orange) — "Pengeluaran untuk keperluan kos, misal beli galon, bayar listrik."
  3. **Shared period filter + shared 4 KPI cards** (the money summary, same as Beranda).
  4. **"Riwayat Transaksi"** list — each row: a tinted icon (green/mint for masuk, orange/soft for keluar), category, "{name} · {date}", a signed amount (**+ green** for income / **− orange** for expense), and a **delete button** (trash). Income vs. expense color is always distinct.
- **Record form (bottom sheet, per type):** header with the type's icon + name + Pemasukan/Pengeluaran tag; a reminder of the type's explanation; **few fields**, each with label + example: a "who/what" text field (label varies per type — "Diterima dari" / "Dikembalikan ke" / "Nama penjaga" / "Untuk apa?"), a numeric "amount" field (digits only, hint "tanpa titik atau Rp"), and a date (default today). A **live colored preview** ("Uang masuk + Rp …" green / "Uang keluar − Rp …" orange) sits above a big **"Simpan Catatan"** button (green for income, orange for expense). On save → toast and the transaction prepends to the list.
- **Delete transaction:** trash button → reassuring center dialog ("Hapus catatan ini? Catatan {kategori} sebesar {Rp} akan dihapus. Tenang, catatan lain tidak terpengaruh.") → removes the row.
- **Production note:** map each type to the backend's transaction model (Pembayaran = income; Refund/Fee/Belanja = expense categories). Use the existing finance/transaction API instead of the prototype's local list state.

### 5. Laporan (Report)
- **Purpose:** Plain-language period summary, trend, and where money comes from / goes.
- **Layout (top→bottom):** header; sticky orange "Unduh Laporan PDF"; **shared period filter**; a **plain-language insight card** (green when net profit, orange when net loss) showing "{periode} · Untung/Rugi Bersih", the big net amount, and a sentence "Anda menerima {masuk} dan mengeluarkan {keluar}…"; **shared 4 KPI cards**; "Tren 5 Bulan Terakhir" grouped bar chart (green masuk / orange keluar, legend + month labels); **"Dari Mana Uang Masuk"** — category breakdown rows with proportional green bars (Pembayaran sewa, Uang muka); **"Ke Mana Uang Keluar"** — breakdown rows with orange bars (Gaji penjaga, Listrik & air, Perbaikan & lainnya); **"Hunian Kamar"** — "{terisi} dari {total}" with a navy progress bar + percent sentence. (Breakdown percentages are derived in the prototype; bind real category sums from the finance API.)

### 6. Kwitansi (Receipt)
- **Purpose:** Generate a payment receipt and send it.
- **Layout:** header; **numbered steps** for clarity:
  - "1. Pilih penyewa" — horizontal pills of tenants (Lunas/DP), active = navy.
  - "2. Periksa kwitansi" — a receipt preview card: header row with KelolaKos logo (orange "K" tile + name) and a **payment status badge**, dashed divider, info rows (Nama penyewa, Kamar, Periode sewa, Total sewa, Sudah dibayar [green], Sisa tagihan [orange] if any), and an emphasized total box at the bottom (mint-soft if fully paid → "Lunas — tidak ada sisa" green amount; orange-soft if outstanding → "Masih harus dibayar" orange amount).
  - "3. Kirim ke penyewa" — primary "Kirim lewat WhatsApp" (send icon) + secondary "Simpan PDF" (download icon).

### 7. Layout Properti
- **Purpose:** Visual map of all rooms with occupancy at a glance.
- **Layout:** header; **occupancy summary** — 3 status-tinted count cards (Terisi / Kosong / Perhatian); a one-line instruction; then per building (with a home icon + name) → per floor ("LANTAI 1/2") → a **2-column grid of larger room tiles**. Each tile (status-tinted bg + border): room name (big), status dot, status label, and the tenant's first name (or "Siap disewa"). Tap a tile → room detail sheet.

### 8. Pengaturan (Settings) — advanced / master-data hub
- **Purpose:** Property & account settings, framed as an **advanced menu** with extra reassurance so non-technical users aren't afraid to change things.
- **Layout:** header; **profile card** (mint, avatar + name + role + "Akun" button); a calming **"Ini menu pengaturan lanjutan"** info banner (info icon, copy: "Tenang, tidak ada yang permanen di sini — semua bisa Anda ubah lagi kapan saja…"); then **5 big numbered, labeled section cards** (icon tile + number + title + one-line explanation + chevron):
  1. **Profil Bisnis** — "Nama kos, alamat, dan kontak yang muncul di kwitansi."
  2. **Kelola Kamar** — "Tambah, ubah, atau hapus kamar di properti Anda." (navigates to the Kelola Kamar screen — same as the Kamar nav tab).
  3. **Harga Umum** — "Atur harga sewa standar untuk kamar baru."
  4. **Harga Massal** — "Ubah harga banyak kamar sekaligus dalam sekali atur."
  5. **Fasilitas** — "Daftar fasilitas kamar: AC, kamar mandi dalam, WiFi, dll."
  Then a prominent mint help card ("Butuh bantuan mengatur?" + green "Chat lewat WhatsApp"), a ghost orange "Keluar dari Aplikasi" → logout confirm, and a centered "KelolaKos · versi 1.0".

---

## Help & Onboarding System
A cohesive, app-wide help layer for elderly / easily-confused users (file: `app/help.jsx`):
- **Onboarding tour** (`Onboarding`): a 5-step welcome shown on first launch (gated by `localStorage 'kk_onboarded'`). Centered card, friendly icon illustration per step, progress dots (tappable), **"Lewati"** skip, Kembali/Lanjut, final "Mulai Pakai" + "Buka Panduan lengkap". **Replayable** anytime via the Panduan screen's "Lihat Tur Singkat Lagi".
- **Per-page Help "?"** (`HelpSheet`, in `modals.jsx`): the round mint "?" on every screen header opens a sheet with a "Tentang {halaman}" title, 3 numbered plain-language tips, a WhatsApp prompt, and a **"Buka Panduan Lengkap"** button.
- **Guided empty state** (`EmptyState`): illustration + title + plain text + an optional bouncing up-arrow pointing at the (sticky) primary CTA + a direct action button. Wired into the Booking list first-use case ("Belum ada booking. Tekan tombol Tambah Penyewa di atas…").
- **Inline form hints**: every form field (`BookingField`, Keuangan/Kamar forms) carries a big label + an example ("Contoh: …") + an optional help-hint line (chat icon).
- **Toast** (`KkToast`): success (green + check), error (orange + ×), info (navy + i) — `showToast(msg, type?)` infers success from a leading "✓". Clear, reassuring, plain-language messages.
- **Central Panduan screen** (`Panduan`): a dedicated screen (in the "Lainnya" group + SCREENS) with accordion, illustrated, numbered step-by-step guides for the main tasks — Cara Buat Booking Baru, Cara Catat Pembayaran, Cara Lihat Laporan — plus a WhatsApp help card.

## Modals & Sheets
- **Bottom sheet** (`Sheet`): slide-up panel, semi-opaque navy backdrop (`rgba(12,44,71,.45)`), top corners 26px radius, drag-handle, **max-width 640px centered on laptop**, content scrolls. Animate **transform only** (translateY) — never animate from opacity:0 (so paused/print states still show content). Used for: Tambah Penyewa flow, Booking detail, Room detail, Help, "Lainnya" menu (phone).
- **Center dialog** (`Dialog`): centered card, max-width 460px, 22px radius, navy backdrop `rgba(12,44,71,.5)`, popIn (scale only). Used for: payment confirm, delete confirm, logout confirm, KPI detail.
- **Tambah / Ubah Booking flow & Cancel/Refund:** see the Booking screen above — 3 numbered steps with auto-calculated price and a "Booking Tersimpan!" success state (reused prefilled for edit), plus the reassuring cancel/refund dialog.
- **Keuangan record form & delete:** see the Keuangan screen — per-type form with a live colored amount preview, and a reassuring "Hapus catatan ini?" dialog.
- **Payment confirm:** check-circle icon, "Tandai sudah lunas?", plain sentence with name + amount, buttons "Nanti Dulu" (secondary) / "Ya, Lunas" (green).
- **Delete confirm (reassuring):** trash icon, "Hapus data {nama}?", calming copy ("Tenang, data lain tidak terpengaruh..."), buttons "Tidak Jadi" (secondary) / "Ya, Hapus" (primary). Never use scary language.

## Interactions & Behavior
- **Navigation:** sidebar/tab item → set current screen; "Lainnya" (phone) opens sheet; selecting a Lainnya item sets the screen and closes the sheet.
- **Period filter:** preset pills set `{preset}`; "Pilih Tanggal" reveals a custom range panel; applying sets `{preset:'custom', start, end}`. The pill then shows the formatted range; KPI numbers recompute. (In the prototype, custom range is computed proportionally from a daily rate; in production, call the real period-scoped API, e.g. `api.getReportData(start, end)`.)
- **Toasts:** bottom-centered navy pill, auto-dismiss ~2.6s, transform-in only.
- **Animations:** screen change fades/translates in (transform only); sheets slide up; dialogs pop in. Respect `prefers-reduced-motion`. Durations ~0.18–0.26s, ease/cubic-bezier(.2,.8,.2,1).
- **Responsive:** single `wide = innerWidth >= 900` switch chooses sidebar vs. bottom-tab shell; both render the same screen components and modals.

## State Management
- **UI state (local):** current screen; open/close flags for each modal (booking flow, booking detail, room detail, payment target, delete target, logout, help topic, "Lainnya" sheet); selected period `{preset}` or `{preset:'custom',start,end}` per money screen; selected KPI detail id; Kwitansi selected tenant; Booking search + active tab; Kamar filter; `wide` (viewport) flag.
- **Server state (existing — reuse, do not rebuild):** dashboard/init data (`api.getInitialData`), period report (`api.getReportData(start,end)`), bookings & room status, create/edit booking (`submitBooking`), transactions/finance (Pembayaran/Refund/Fee/Belanja), facilities (V2). Use the existing React Query hooks and types in `src/lib/api.ts` / `api-v2.ts`. Replace prototype mock data (`app/data.jsx`) and the prototype's local list states (Keuangan transactions, booking status changes) with these.
- **Status mapping:** collapse the backend's many codes into the **4 plain payment statuses** (Lunas / DP / Belum Bayar / Batal) and **3 room statuses** (Terisi / Tersedia / Perlu Perhatian) for display. Keep internal codes in the data layer.

## Assets
- **Fonts:** Google Fonts — `Lato` (400/700/900) and `Josefin Sans` (400/500/600/700). Self-host or use the existing font pipeline.
- **Icons:** inline SVG line icons defined in `app/ui.jsx` (`LineIcon` component) — copy the paths, or swap for the codebase's existing icon set with equivalent line-style glyphs (stroke ~2px). No emoji.
- **Images:** none required. Logo is a simple orange rounded tile with the letter "K".

## Files (in this bundle)
- `KelolaKos Prototype.html` — the full interactive prototype (responsive shell + all 8 screens + modals + Tweaks). Open this first.
- `app/data.jsx` — mock data + formatters (`RUPIAH`, dates) + `PERIODE` presets. **Replace with real API data.**
- `app/ui.jsx` — design-system primitives: `Btn`, `Card`, `BayarBadge`, `ScreenHead`, `Sheet`, `Dialog`, `InfoRow`, `LineIcon` (all icon SVG paths).
- `app/money.jsx` — shared money system: `PeriodFilter` (presets + custom range), `MoneyKpiGrid`, `MoneyKpiDetail`, `resolvePeriode`.
- `app/screens-core.jsx` — Beranda, Booking (list).
- `app/screens-more.jsx` — Laporan, Kwitansi, Layout Properti, Pengaturan.
- `app/booking.jsx` — full booking flow: `BookingFlow` (3-step add/edit + success), `BookingDetail`, `CancelConfirm`, plus a reusable `Field` (label + example + hint) exported as `BookingField`.
- `app/keuangan.jsx` — Keuangan screen: 4 record-type cards, per-type `TransaksiForm`, `HapusTransaksi` confirm, local transaction list state.
- `app/kamar.jsx` — Kelola Kamar (master data): `Kamar` screen, `KamarForm` (add/edit), `KamarDetail` (Ubah/Hapus actions), `HapusKamar` confirm — CRUD mirrors `booking.jsx`.
- `app/help.jsx` — app-wide help system: `Onboarding` (first-launch tour), `Panduan` (central illustrated guides), `EmptyState` (guided), `KkToast` (success/error/info).
- `app/modals.jsx` — Room detail, Pay/Delete/Logout confirm, Help sheet.
- `app/tweaks-panel.jsx` — optional in-prototype tweak panel (text size, accent, corners); not part of the product.
- `Design System.html` — the full style guide with the verified contrast matrix, type scale, components.
- `Analisis UX KelolaKos.html` — UX audit + prioritized problem list (rationale for the redesign).
- `Navigasi KelolaKos.html` — navigation spec (laptop sidebar + phone tabs) + journey maps for the top 3 tasks.

### Implementation notes
- Each `app/*.jsx` is loaded as a separate in-browser-Babel script and shares globals via `window`. In a real Next.js app, convert each to proper ES modules/components with imports.
- The prototype uses inline styles + CSS variables. Port the tokens above into `tailwind.config.ts` and rebuild with Tailwind utility classes to match the codebase.
- Keep all elderly-friendly invariants: ≥18px body, ≥48px touch targets, one primary orange action per screen, text always navy-on-light, line icons + text labels in nav, reassuring confirmations, a help affordance on every screen.
