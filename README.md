# KelolaKos · Next.js App

Property OS untuk kos & penginapan — modern web app yang connect ke Google Sheets via Apps Script JSON API.

---

## 🚀 Quick Start (5 menit)

```bash
# 1. Install dependencies
npm install

# 2. Setup env vars
cp .env.local.example .env.local
# (env vars sudah pre-filled untuk deployment lo)

# 3. Jalanin dev server
npm run dev

# 4. Buka http://localhost:3000
# 5. Pas pertama buka, input access code lo (e.g. BETA-4RQQ8R)
```

Itu doang. Kalau access code valid (license ACTIVE), langsung masuk ke Beranda dengan data live dari Google Sheets lo.

---

## 📂 Struktur Project

```
kelolakos-app/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout + providers
│   │   ├── providers.tsx             # React Query + Sonner + AccessCodeGate
│   │   ├── globals.css               # Tailwind + design tokens
│   │   ├── page.tsx                  # /          → Beranda (Dashboard)
│   │   ├── kamar/page.tsx            # /kamar     → Room map
│   │   ├── booking/page.tsx          # /booking   → Booking list + Create modal
│   │   ├── keuangan/page.tsx         # /keuangan  → (placeholder)
│   │   ├── setting/page.tsx          # /setting   → Fasilitas Kamar live
│   │   └── layout3d/page.tsx         # /layout3d  → (placeholder)
│   ├── components/
│   │   ├── access-code-gate.tsx      # License check gate
│   │   └── topbar.tsx                # Shared topbar + nav
│   └── lib/
│       ├── api.ts                    # Core API client + types
│       ├── api-v2.ts                 # V2 endpoints (Fasilitas, etc)
│       └── utils.ts                  # formatRupiah, status colors, dll
├── public/                            # Static assets
├── .env.local.example                # Env var template
├── .gitignore
├── package.json
├── tailwind.config.ts                # Design tokens
├── tsconfig.json
└── next.config.js
```

---

## 🔐 License Flow

1. User buka `https://kelolakos.vercel.app`
2. `<AccessCodeGate>` cek `localStorage['kelolakos_access_code']`
3. Kalau gak ada → prompt input access code (modal welcome)
4. Frontend POST `verifyAccessCode` ke Apps Script → backend validate vs License Master CSV
5. Kalau `ACTIVE` → simpan ke localStorage → masuk app
6. Setiap subsequent API call auto-attach `accessCode` di payload
7. Backend reject kalau license EXPIRED/REVOKED → user prompted re-input

**Logout:** Klik icon logout di kanan topbar → clear localStorage.

---

## ✅ Yang Sudah Jadi (Phase 1)

- ✅ Foundation: Next.js + TS + Tailwind + React Query + Sonner
- ✅ AccessCodeGate dengan license check
- ✅ API client (api.ts + api-v2.ts) dengan auto-attach apiKey + accessCode
- ✅ Topbar + nav consistent
- ✅ **Beranda** — live data dari `getInitialData`:
  - 4 KPI cards (Pendapatan Net, Uang Masuk/Keluar, Net Cash)
  - Perlu Tindakan section (booking yang butuh follow-up)
  - Status Properti (ready/aktif/bermasalah)
  - Detail Finansial 3-column
- ✅ **Kamar** — live data:
  - View toggle (List | Layout 3D link)
  - Search + filter gedung + filter status
  - Grouped by gedung dengan progress bar
  - Room cards dengan status border color
  - Side drawer detail on click
- ✅ **Booking** — live data + write:
  - Status tabs (Semua/Belum Bayar/DP/Lunas/Ekstra)
  - Search filter
  - Booking list dengan badge status
  - **Create Booking Modal** dengan:
    - 5 section progressive
    - Fasilitas checkboxes (live dari V2 API!)
    - Live recalc total + facility subtotal
    - Auto-calc checkout date
    - Permintaan khusus + tag ekstra
    - Submit ke `submitBooking` (V1 — TODO: kirim fasilitasIds ke backend)
- ✅ **Setting (partial)** — Fasilitas Kamar live dari V2 API
- ✅ Logout button (clear localStorage)

## 🚧 Yang Belum (Phase 2 — next iterations)

- ⏳ **Keuangan** — port 4 sub-tab form
- ⏳ **Setting lengkap** — sidebar dengan 10+ panel
- ⏳ **Laporan** — period picker + chart + table + PDF export
- ⏳ **Kwitansi customizer** — split view editor + live preview + logo upload
- ⏳ **Layout 3D** — port Three.js ke @react-three/fiber
- ⏳ Edit Booking modal
- ⏳ Backend wire-up untuk `submitBooking` agar terima `fasilitasIds` + `extraRequest` + `isEkstra` (saat ini frontend kirim, backend belum baca — perlu update `submitBooking` di TopHillsLogic.gs)

---

## 🛠️ Development

```bash
# Dev server (Turbopack)
npm run dev

# Production build
npm run build
npm run start

# Lint
npm run lint
```

### Hot reload
Edit file di `src/`, save → browser auto-reload dengan state preserved (Fast Refresh).

### Type check
```bash
npx tsc --noEmit
```

---

## 🌐 Deploy ke Vercel

### Option 1: Via Vercel CLI (cepat)

```bash
npm i -g vercel
vercel login
vercel deploy
# Follow prompts, set production = yes
```

### Option 2: Via GitHub + Vercel Dashboard (recommended)

1. Push repo ke GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial KelolaKos Next.js app"
   git remote add origin https://github.com/USERNAME/kelolakos-app.git
   git push -u origin main
   ```

2. Buka https://vercel.com → "Add New Project" → import repo

3. **Framework Preset:** Next.js (auto-detected)

4. **Environment Variables** — copy dari `.env.local`:
   ```
   NEXT_PUBLIC_APPS_SCRIPT_URL    = https://script.google.com/macros/s/AKfycb.../exec
   NEXT_PUBLIC_APPS_SCRIPT_API_KEY = 89d97227...
   NEXT_PUBLIC_SUPPORT_WA          = 62895610524580
   ```

5. **Deploy** → tunggu 2-3 menit

6. Live di `https://kelolakos-app.vercel.app` (atau custom domain)

### Auto-deploy
Setelah connect GitHub, setiap `git push` ke main branch → Vercel auto-rebuild + deploy. Notif via email.

---

## 🐛 Troubleshooting

### "Network error" / CORS blocked

- Cek `.env.local` benar (URL & API key)
- Cek Apps Script Web App deployed dengan access "Anyone"
- Restart dev server setelah edit `.env.local`

### "NEED_CODE" terus walau udah input

- Buka DevTools Console → cek `localStorage.getItem('kelolakos_access_code')`
- Kalau kosong → input lagi
- Kalau ada tapi tetap reject → access code expired/revoked. Hubungi support.

### "Unknown action: xxx"

- Action belum di-dispatch di Api.gs Apps Script lo
- Re-deploy Apps Script Web App dengan "New version"

### Build error di Vercel: type error

- Run `npx tsc --noEmit` di local dulu untuk catch sebelum push
- Common issue: missing field di payload type

### Logo image upload error >500KB

- Google Sheets cell max ~37KB base64
- Solusi: compress image di client sebelum kirim (gunakan canvas resize)

---

## 📊 Architecture

```
┌─────────────────────┐         ┌────────────────────────┐
│  Browser (User)     │         │  Apps Script Web App   │
│  https://...vercel  │         │  https://script...exec │
│                     │  HTTPS  │                        │
│  ┌──────────────┐  │ ──POST→ │  ┌──────────────────┐ │
│  │ Next.js App  │  │         │  │ Api.js handler   │ │
│  │ - Beranda    │  │ ←JSON── │  │ ├─ apiKey check  │ │
│  │ - Kamar      │  │         │  │ ├─ license check │ │
│  │ - Booking    │  │         │  │ └─ dispatch      │ │
│  │ + ...        │  │         │  └──────┬───────────┘ │
│  │              │  │         │         │             │
│  │  api.ts      │  │         │  ┌──────▼───────────┐ │
│  │  ├─ apiKey   │  │         │  │ V1 / V2 / License│ │
│  │  └─ accessC. │  │         │  │ TopHillsLogic    │ │
│  │   (storage)  │  │         │  │ ApiV2 functions  │ │
│  └──────────────┘  │         │  └──────┬───────────┘ │
│                     │         │         │             │
└─────────────────────┘         │  ┌──────▼───────────┐ │
                                 │  │  Google Sheets    │ │
                                 │  │  - BOOKINGS       │ │
                                 │  │  - ROOMS          │ │
                                 │  │  - Fasilitas      │ │
                                 │  │  - PAYMENTS, dll  │ │
                                 │  └───────────────────┘ │
                                 └────────────────────────┘
```

---

## 📚 Tech Stack

- **Framework:** Next.js 15 (App Router, Turbopack)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 3.4
- **State:** React Query 5 (server state) + useState (UI state)
- **Notif:** Sonner (toast)
- **Backend:** Google Apps Script (JSON API)
- **Storage:** Google Sheets
- **Hosting:** Vercel
- **Auth:** Custom license code via localStorage

---

## ✉️ Support

Stuck di setup? Hubungi WhatsApp support yang tertera di `<AccessCodeGate>`.

Roadmap & roadmap-driven development — semua progress di-commit ke main branch.

Happy launching! 🚀
