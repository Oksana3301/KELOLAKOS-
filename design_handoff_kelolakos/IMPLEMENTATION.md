# Implementation Guide — Replace the Visual Layer Only

> **Golden rule: this is a UI/UX reskin, NOT a rewrite.**
> Replace the old look-and-feel with the approved design. **Do not change, remove, or "improve" any business logic, data flow, API calls, auth/license flow, or state contracts.** Only the presentation layer (markup, styles, copy, component structure) changes.

## What MUST NOT change (keep exactly as-is)
- **Backend**: Google Apps Script endpoints and any `.gs` files.
- **Data layer**: `src/lib/api.ts`, `api-v2.ts`, the access-code/license flow, all fetch/mutation functions (`getInitialData`, `getReportData`, `submitBooking`, transaction/finance calls, facilities V2, etc.).
- **React Query** hooks, query keys, caching, and the shapes of request/response types.
- **Routing**: existing App Router routes/params and navigation targets.
- **Calculations & validation rules** already implemented (totals, payment math, status derivation).

## What you ARE replacing
- The **visual components and layouts** of each page (markup + Tailwind classes).
- **Copy** → plain Indonesian per ACCESSIBILITY.md (but keep field names/data bindings identical).
- **Status display** → map existing backend codes to the 4 plain payment statuses / 3 room statuses **at the view layer only** (keep raw codes in data).
- **Navigation chrome** → responsive shell (laptop sidebar ≥ 900px / phone bottom tabs) with text labels.

## How to work
1. **Read the design** in this bundle:
   - `README.md` — per-page specs (sections 1–8), components, modals, CRUD, state notes.
   - `KelolaKos Prototype.html` + `app/*.jsx` — the working reference implementation. Lift exact spacing, sizes, colors, copy, and interaction structure from here.
   - `tokens.css` / `tailwind.tokens.ts` — paste the design tokens into your theme; build with Tailwind utilities mapped to them.
   - `Design System.html` — palette/contrast/type/components/CRUD reference.
   - `ACCESSIBILITY.md` — non-negotiable elderly-friendly requirements.
2. **Port the tokens first** (Tailwind theme + global CSS + fonts: Lato, Josefin Sans). Verify a sample button/card matches before doing pages.
3. **Reskin page by page**, wiring each redesigned component to the **existing** hooks/props. Replace the prototype's mock data (`app/data.jsx`) and its local list states with the real API data — do not keep the mock.
4. **Keep the standard CRUD pattern identical across every menu** (so users learn once):
   - **Tambah** → prominent Orange CTA (sticky top / sidebar) → form sheet (big labels + examples) → green "Simpan" → success toast.
   - **Lihat** → list of large cards → tap a card → **detail sheet**.
   - **Ubah** → "Ubah" in the detail sheet → same form, prefilled.
   - **Hapus** → "Hapus" in the detail sheet → reassuring confirm dialog → toast.
   Booking, Kelola Kamar, and Keuangan already follow this — match it everywhere.
5. **Convert the in-browser-Babel files** (`app/*.jsx`, shared via `window`) into proper ES module React components with imports. The prototype splits scope across `<script>` tags for the sandbox only; that is not needed in the real app.

## Page → reference mapping
| Page | Prototype source | Notes |
|---|---|---|
| Beranda (dashboard) | `screens-core.jsx` `Beranda` + `money.jsx` | 4 KPI cards, period filter (presets + custom range), Status Kamar, Perlu Tindakan |
| Booking (most-used) | `booking.jsx` | 3-step add flow + success, detail → Ubah/Catat Pembayaran/Batal-Refund/Hapus |
| Kamar = "Kelola Kamar" | `kamar.jsx` | master-data CRUD mirrors Booking |
| Keuangan (Uang) | `keuangan.jsx` | 4 record types, per-type form, deletable transactions |
| Laporan | `screens-more.jsx` `Laporan` | insight card, KPI, trend, category breakdowns, occupancy |
| Kwitansi | `screens-more.jsx` `Kwitansi` | numbered steps, receipt preview, send/PDF |
| Layout Properti | `screens-more.jsx` `LayoutProperti` | occupancy summary + room tiles |
| Pengaturan | `screens-more.jsx` `Setting` | 5 sections + reassurance + Ukuran Teks control |
| Panduan + Onboarding + Help "?" + Toast + Empty | `help.jsx`, `modals.jsx` | app-wide help system |

## Definition of done (per page)
- Pixel-faithful to the prototype (sizes, colors, spacing, copy).
- All existing data/actions still work — wired to the same hooks, no logic touched.
- Passes the elderly checklist: text ≥ 16px (body 18–19), contrast AA/AAA, touch targets ≥ 48px, one Orange primary action, "?" help present, reassuring confirmations.
- No console errors; behaves identically to before, just looks/reads better.
