# 🚀 Panduan Vercel Deploy + Workflow Update

Panduan lengkap deploy ke Vercel + cara nambahin/edit fitur setelah deploy.

---

## 📋 BAGIAN 1: Initial Deploy ke Vercel (sekali aja)

### Step 1: Push Project ke GitHub (5 menit)

#### 1a. Buat akun GitHub kalau belum ada
- Buka https://github.com/signup
- Daftar pake email lo

#### 1b. Buat repository baru
- Di GitHub, klik "+" di kanan atas → "New repository"
- Repository name: `kelolakos-app`
- Visibility: **Private** (penting! ada credential di .env.local kalau accidental kepush)
- Jangan centang README, .gitignore, license (karena udah ada)
- Klik "Create repository"

#### 1c. Push project lo dari Mac

Di terminal:

```bash
cd ~/Downloads/kelolakos-app

# Initialize git (kalau belum)
git init
git add .
git commit -m "Initial commit: KelolaKos final"

# Push ke GitHub
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kelolakos-app.git
git push -u origin main
```

> Ganti `YOUR_USERNAME` dengan username GitHub lo.

> Kalau diminta login, pakai personal access token (bukan password). Generate di: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token → centang `repo` scope.

⚠️ **PENTING:** Pastiin `.env.local` udah masuk `.gitignore` (harusnya udah, ke-include di project). Jangan sampe credential lo nyangkut di GitHub publik!

```bash
# Verify .env.local di-ignore
git status | grep .env.local
# Output harusnya kosong (artinya gak ke-track)
```

### Step 2: Deploy di Vercel (3 menit)

#### 2a. Daftar Vercel
- Buka https://vercel.com/signup
- Pilih "Continue with GitHub" → authorize Vercel akses GitHub lo
- Skip semua opt-in screen kalau gak relevan

#### 2b. Import project
- Di Vercel dashboard, klik **"Add New..." → "Project"**
- Pilih repository `kelolakos-app` dari list → klik **"Import"**

#### 2c. Configure & set environment variables

Di halaman configure project, **scroll ke "Environment Variables"** dan tambah 3 variable:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_APPS_SCRIPT_URL` | `https://script.google.com/macros/s/AKfycbxcuITZulHkn7ytAxbaKp2KL0CGXRKRi7MMTOG3NelqmUmohVVyF73DFPqgOZqVvXsOrQ/exec` |
| `NEXT_PUBLIC_APPS_SCRIPT_API_KEY` | `89d9722714d1ce9db85780180a76341ce765b22e49e0d3e0` |
| `NEXT_PUBLIC_SUPPORT_WA` | `62895610524580` |

⚠️ **PENTING:** Copy nilai-nilainya **exact** dari `.env.local` file lo, jangan typo.

Settings lain bisa di-default semua:
- Framework Preset: `Next.js` (auto-detected)
- Build Command: `next build` (default)
- Output Directory: `.next` (default)
- Install Command: `npm install` (default)

Klik **"Deploy"**.

#### 2d. Tunggu deployment selesai (~2-3 menit)

Vercel akan:
1. Clone repo dari GitHub
2. Run `npm install`
3. Run `next build`
4. Deploy ke CDN

Saat selesai, lo dapet URL kayak: `https://kelolakos-app-xxxxx.vercel.app`

### Step 3: Test Production Deploy

Buka URL Vercel lo di browser → harusnya:
- AccessCodeGate muncul → input `BETA-4RQQ8R` → masuk dashboard
- Semua page jalan (Beranda, Booking, Keuangan, Laporan, Kwitansi, Layout 3D, Setting)

Kalau ada error:
- Buka **Vercel dashboard → Deployments → klik deployment terbaru → Logs** → lihat error
- Common cause: environment variable typo

### Step 4 (Optional): Custom Domain

Punya domain sendiri (mis. `kelolakos.com`)? Vercel dashboard → Settings → Domains → Add → ikutin instruksi DNS.

Free Vercel URL `*.vercel.app` udah cukup untuk pemakaian internal.

---

## 🔄 BAGIAN 2: Workflow Update Fitur (Setelah Deploy)

Setelah deploy pertama, **semua perubahan ke code Vercel auto-deploy.** Workflow lo simpel:

```
Edit code di local → git commit → git push → Vercel auto-deploy
```

### Cara Add/Edit Fitur (Frontend)

#### Step A: Edit di Local

Buka folder project di editor (VS Code, Cursor, dll):

```bash
cd ~/Downloads/kelolakos-app
code .  # buka di VS Code (kalau punya)
```

Edit file yang mau lo ubah. Contoh skenario:

**Skenario 1: Tambah field baru di form Booking**

```
File: src/components/booking-form-modal.tsx
Action: Tambah <input> baru, plus state-nya
```

**Skenario 2: Ubah warna theme**

```
File: src/app/globals.css
Action: Cari CSS variable :root { --ac: ... } → ganti hex
```

**Skenario 3: Tambah page baru (mis. `/penghuni`)**

```
1. Bikin folder: src/app/penghuni/
2. Bikin file: src/app/penghuni/page.tsx
3. (Opsional) Tambah ke Topbar: src/components/topbar.tsx, NAV_ITEMS array
```

#### Step B: Test Lokal Dulu

```bash
npm run dev
```

Buka `http://localhost:3000` → test fitur baru. Pastiin gak ada error sebelum push.

#### Step C: Commit + Push

```bash
git add .
git commit -m "Tambah fitur xxx"
git push
```

#### Step D: Vercel Auto-Deploy

Begitu lo push, Vercel auto-trigger build. ~2-3 menit kemudian, perubahan udah live di production URL.

Lo bisa cek progress di **Vercel dashboard → Deployments**.

---

## 🛠️ Backend Updates (Apps Script — Terpisah dari Vercel)

Vercel cuma host frontend. **Backend tetap di Apps Script** dan harus di-deploy terpisah.

### Cara Add/Edit Function Backend

1. Buka Apps Script: https://script.google.com → buka project lo
2. Edit `TopHillsLogic.gs` atau `Api.js` atau file lainnya
3. Save (Cmd+S)
4. **Penting:** Deploy → Manage deployments → ✏️ Edit → Version: **NEW VERSION** → Deploy

⚠️ Kalau lupa "NEW VERSION", perubahan **gak akan ke-reflect di production**. Tetap pake versi lama.

### Action Baru di Backend = Update di Frontend Juga

Workflow untuk add new endpoint:

1. **Backend** — tambah function di `TopHillsLogic.gs`:
   ```js
   function getMyNewData() {
     return { hello: 'world' };
   }
   ```

2. **Backend** — dispatch di `Api.js`:
   ```js
   case 'getMyNewData': return getMyNewData();
   ```

3. **Backend** — deploy NEW VERSION

4. **Frontend** — tambah method di `src/lib/api.ts`:
   ```ts
   export const api = {
     // ...existing methods
     getMyNewData: () => callApi<{ hello: string }>('getMyNewData'),
   };
   ```

5. **Frontend** — pakai di page/component:
   ```tsx
   const { data } = useQuery({
     queryKey: ['my-new-data'],
     queryFn: api.getMyNewData,
   });
   ```

6. **Frontend** — git commit + push → Vercel auto-deploy

---

## 📂 Struktur File untuk Add Fitur

Kalau bingung file mana yang harus diedit, ini panduan:

| Mau ngapain | File yang diedit |
|---|---|
| Tambah/edit page | `src/app/<route>/page.tsx` |
| Tambah/edit komponen reusable | `src/components/<name>.tsx` |
| Tambah/edit API call | `src/lib/api.ts` atau `src/lib/api-v2.ts` |
| Edit helper functions (format, dll) | `src/lib/utils.ts` |
| Edit tampilan global (warna, font) | `src/app/globals.css` |
| Edit nav menu | `src/components/topbar.tsx` |
| Tambah environment variable | `.env.local` (local) + Vercel dashboard (production) |
| Tambah npm package | `package.json` lalu `npm install` |

---

## 🐛 Common Issues & Fix

### Issue 1: Build Error di Vercel

**Gejala:** Vercel deployment failed, log error.

**Penyebab umum:**
- TypeScript error (lokal jalan tapi production gak)
- Import path salah (`@/lib/xxx` vs `../lib/xxx`)
- Environment variable lupa di-set

**Fix:**
1. Jalanin `npm run build` lokal dulu sebelum push:
   ```bash
   npm run build
   ```
   Kalau lokal udah lolos, biasanya production lolos juga.

2. Cek Vercel deployment log untuk pesan error spesifik.

### Issue 2: Environment Variable gak ke-baca di Production

**Gejala:** Lokal jalan, production blank atau error "URL not set".

**Fix:**
- Vercel dashboard → Project → Settings → Environment Variables → verify 3 variable ada
- Pastiin spelling sama: `NEXT_PUBLIC_APPS_SCRIPT_URL` (case-sensitive)
- Setelah ubah env var, **REDEPLOY**: Deployments → ... → Redeploy

### Issue 3: Backend Function "Unknown action"

**Gejala:** Frontend manggil endpoint baru, dapet error `Unknown action: xxx`.

**Penyebab:** Dispatch case di `Api.js` belum ada / belum deploy.

**Fix:**
1. Buka `Api.js` di Apps Script
2. Cari function `dispatchV1_` (atau `dispatchV2_` untuk V2 actions)
3. Tambah case yang missing
4. Deploy NEW VERSION

### Issue 4: Perubahan Code Gak Live di Production

**Gejala:** Push ke GitHub tapi production tetap versi lama.

**Fix:**
- Cek Vercel dashboard → Deployments → ada deployment baru gak?
- Kalau gak ada → cek GitHub repo, push-nya berhasil gak? (`git log` di local vs di GitHub)
- Kalau deployment gagal → buka log, fix error
- Force redeploy: Deployments → ... → Redeploy

### Issue 5: Cache Browser

**Gejala:** Update udah deploy, tapi browser nampilin versi lama.

**Fix:**
- Hard refresh: `Cmd+Shift+R` (Mac) atau `Ctrl+Shift+R` (Windows)
- Atau buka di Incognito/Private mode

---

## 🎓 Panduan Belajar Lanjutan (Optional)

Kalau lo mau bisa edit sendiri tanpa minta bantuan terus:

### React/Next.js Basics
- https://react.dev/learn — official React tutorial
- https://nextjs.org/learn — Next.js interactive course (gratis)

### TypeScript Basics
- https://www.typescriptlang.org/docs/handbook/intro.html

### Tailwind CSS (untuk styling)
- https://tailwindcss.com/docs

### Apps Script Reference
- https://developers.google.com/apps-script/reference

---

## 🆘 Kalau Stuck

1. **Search dulu di Google**: copy-paste error message-nya
2. **Stack Overflow** untuk question programming
3. **GitHub Issues** project terkait (Next.js, React Three Fiber, dll)
4. **AI assistant** (ChatGPT, Claude, dll) — paste error + code, minta debug

---

## ✅ Checklist Initial Deploy

Sebelum claim production-ready, pastiin:

- [ ] `.env.local` udah di-isi credential yang benar
- [ ] Project udah di-push ke GitHub (private repo!)
- [ ] `.gitignore` udah include `.env.local` (sensitive!)
- [ ] Vercel deploy berhasil tanpa error
- [ ] 3 environment variable udah di-set di Vercel
- [ ] Production URL bisa diakses, AccessCodeGate muncul
- [ ] Bisa input `BETA-4RQQ8R` dan masuk dashboard
- [ ] Backend Apps Script keep-warm trigger udah di-set (5 menit)
- [ ] Test minimal: buka tiap page, gak ada error

Selamat deploy! 🚀
