# Blue Carbon Field App

Aplikasi pencatatan data lapangan lamun dan mangrove untuk MRV karbon biru — Direktorat Konservasi Ekosistem, KKP.
GPS, foto bermetadata, kode sampel + QR, validasi otomatis, mode offline, dan sinkronisasi ke Supabase. Pasangan dari MRV Calculator.

**Alamat aplikasi:** https://riniwidayanti312-droid.github.io/blue-carbon-field-app/

## Isi repositori

| Berkas | Fungsi |
|---|---|
| `index.html` | Aplikasi lengkap (hasil build). Blok `<script id="app-metadata">` mengatur seluruh form, jenis, aturan validasi, status lab, dan pola kode sampel. |
| `manifest.webmanifest`, `icons/` | Membuat aplikasi bisa dipasang di layar utama HP. |
| `sw.js` | Service worker: aplikasi tetap terbuka tanpa internet. |
| `supabase/schema.sql` | Tabel, jejak audit, dan aturan akses (RLS) di Supabase. |
| `supabase/functions/identify-species/` | Edge Function untuk identifikasi jenis dengan AI (Claude). |
| `src/` | Kode sumber dan `build.js` untuk pengembang. |

## Server Supabase (sudah disiapkan)

Proyek: `dgijsrvnattwiunyguay` (https://dgijsrvnattwiunyguay.supabase.co). Tabel, jejak audit, aturan akses, dan Edge Function `identify-species` sudah terpasang, dan alamat server + kunci publik sudah tertanam di `index.html`.

**Menambah petugas:** Supabase → **Authentication → Users → Add user → Create new user** → isi email & kata sandi → centang **Auto Confirm User**. Akun langsung menjadi anggota tim. Akun pertama yang dibuat otomatis menjadi admin.

**Mencabut akses petugas:** hapus usernya di Authentication → Users.

Akun yang mendaftar sendiri tanpa dibuat admin tidak bisa melihat atau menulis data apa pun.

## Langkah 3 — Identifikasi jenis dengan AI (opsional)

Edge Function sudah terpasang. Tinggal menambahkan kunci API Anthropic (https://console.anthropic.com) di Supabase → **Edge Functions → Secrets** dengan nama `ANTHROPIC_API_KEY`. Kunci disimpan di Supabase, tidak di aplikasi.

Dengan Supabase CLI:
```bash
supabase login
supabase link --project-ref <ref-proyek>
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy identify-species
```
Atau lewat dashboard: **Edge Functions → Deploy a new function → Via editor**, beri nama `identify-species`, tempel isi `index.ts`, lalu tambahkan secret `ANTHROPIC_API_KEY` di **Edge Functions → Secrets**.

Tanpa langkah ini, kunci identifikasi berbasis ciri tetap berfungsi offline.

## Langkah 4 — Pasang di HP

1. Buka alamat aplikasi di **Chrome** (Android) atau **Safari** (iPhone).
2. Android: **⋮ → Tambahkan ke layar utama / Instal aplikasi**. iPhone: **Bagikan → Tambahkan ke Layar Utama**.
3. Buka sekali saat ada internet dan masuk ke akun tim. Setelah itu aplikasi bisa dipakai di lokasi tanpa sinyal; data dikirim otomatis saat sinyal kembali.

## Memperbarui aplikasi

- **Form, jenis, aturan, status lab:** ubah metadata. Naikkan `app.metadataVersion`. Admin juga bisa menerbitkannya dari menu **Data → Lihat / ubah metadata → Terbitkan ke semua perangkat** tanpa mengubah repositori.
- **Kode:** ubah berkas di `src/`, jalankan `node src/build.js --web-only`, lalu naikkan `VERSION` di `sw.js` agar perangkat mengambil versi baru.

## Google Play (nanti)

Aplikasi ini sudah berbentuk PWA sehingga bisa dibungkus menjadi aplikasi Android (Trusted Web Activity) dengan https://www.pwabuilder.com. Untuk itu berkas Digital Asset Links harus ada di akar domain (`/.well-known/assetlinks.json`), jadi diperlukan domain sendiri (mis. subdomain kkp.go.id) atau repositori situs pengguna `riniwidayanti312-droid.github.io`.
