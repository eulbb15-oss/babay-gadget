# Babay Gadget – Sistem Internal Owner-Only

HRIS (karyawan, gaji, komisi) + akuntansi penjualan gadget. Next.js (App Router, TypeScript) + Tailwind di Vercel;
data di Google Sheets lewat Google Apps Script (GAS).

```
Browser ──(cookie sesi PIN)──▶ Next.js /api/gas ──(POST + GAS_API_SECRET)──▶ Apps Script ──▶ Google Sheets
```

Browser **tidak pernah** tahu URL Apps Script maupun secret. Semua panggilan lewat `/api/gas` yang memeriksa sesi,
whitelist aksi, dan memvalidasi ulang payload sebelum meneruskannya.

## Setup (±15 menit)

### 1. Google Sheets + Apps Script
1. Buat Google Spreadsheet kosong (mis. "Babay Gadget DB").
2. **Extensions → Apps Script**. Hapus isi default, tempel isi `gas/Code.gs`.
3. (Opsional) **Project Settings → Show "appsscript.json"** lalu samakan dengan `gas/appsscript.json` (zona waktu Asia/Jakarta).
4. **Project Settings → Script properties → Add**: kunci `API_SECRET`, nilai acak ≥ 24 karakter
   (`openssl rand -base64 32`). Simpan nilai ini, dipakai lagi di langkah 3.
5. Pilih fungsi `setupSheets` → **Run** (izinkan akses). Ini membuat 5 tab, header, format teks untuk IMEI/tanggal,
   pengaturan komisi default, dan **10 karyawan contoh** (3 Sales, 1 Finance, 2 Media Sosial, 2 E-commerce, 2 Marketing).
   Ganti nama dan gaji lewat menu *Karyawan* di aplikasi.
6. **Deploy → New deployment → Web app**: *Execute as* **Me**, *Who has access* **Anyone**. Salin URL berakhiran `/exec`.
   Setiap kali `Code.gs` diubah: **Deploy → Manage deployments → Edit → New version**.

> "Anyone" diperlukan karena Vercel memanggil tanpa login Google. Satu-satunya pagar adalah `API_SECRET`;
> tanpa token yang cocok semua aksi ditolak, dan jika `API_SECRET` kosong/pendek semuanya ditolak (fail-closed).

### 2. Lokal
```bash
npm install
cp .env.example .env.local     # isi 4 variabel
npm run verify                 # typecheck + test + build
npm run dev
```

### 3. Environment variables (lokal `.env.local`, Vercel → Settings → Environment Variables)
| Variabel | Isi |
|---|---|
| `NEXT_PUBLIC_GAS_API_URL` | URL `/exec` dari langkah 1.6 (hanya dibaca kode server) |
| `GAS_API_SECRET` | Sama persis dengan Script Property `API_SECRET` |
| `OWNER_PIN` | PIN/kata sandi pemilik (disarankan ≥ 8 karakter) |
| `SESSION_SECRET` | ≥ 32 karakter acak; mengganti nilainya = memaksa semua sesi keluar |

### 4. Deploy
Push ke GitHub → import di Vercel → isi 4 variabel di atas → Deploy.

## Skema Google Sheets
| Tab | Kolom |
|---|---|
| `Master_Karyawan` | ID_Karyawan, Nama, Divisi, Jabatan, No_Rekening, Kontak, Gaji_Pokok, Status_Aktif (`Aktif`/`Nonaktif`) |
| `Transaksi_Penjualan` | ID_Transaksi, Tanggal, Periode, Merk_Model, Kondisi, IMEI_SN, HPP, Harga_Jual, Margin_Kotor, Metode_Bayar, ID_Sales, Nama_Sales, Komisi, Catatan, Dibuat_Pada |
| `Payroll_Bulanan` | ID_Payroll, Periode, ID_Karyawan, Nama, Divisi, Jabatan, Gaji_Pokok, Unit_Terjual, Total_Komisi, Potongan_Kasbon, Gaji_Bersih, Dibuat_Pada |
| `Jurnal_Akuntansi` | ID_Jurnal, Tanggal, Periode, Ref_Tipe (PENJUALAN/HPP/PAYROLL/BEBAN), Ref_ID, Keterangan, Kode_Akun, Nama_Akun, Debet, Kredit |
| `Pengaturan_Sistem` | Kunci, Nilai, Keterangan (NAMA_USAHA, KOMISI_MODE, KOMISI_NOMINAL_PER_UNIT, KOMISI_PERSEN_MARGIN) |

Jangan mengedit tab ini manual saat aplikasi dipakai. Margin, komisi, dan jurnal dihitung server (GAS), bukan dipercaya dari browser.

## API Apps Script
Semua respons: `{ ok: true, data }` atau `{ ok: false, error: { code, message } }`.
- Baca (`doGet` atau `doPost`): `getSummary` (param `periode=YYYY-MM`), `getEmployees`, `getSales` (`periode` atau `from`+`to`), `getPayroll`, `getJournal`, `getSettings`
- Tulis (hanya `doPost`): `addSale`, `updateEmployee` (tanpa `id` = tambah baru), `generatePayroll`, `addExpense`, `updateSettings`

Apps Script **tidak bisa membaca header HTTP kustom**, jadi token dikirim sebagai field `token`. Aplikasi memakai POST untuk semua
panggilan agar token tidak masuk URL. `doGet` tetap ada untuk uji manual.

## Aturan bisnis (ubah di menu Pengaturan)
- **Komisi per unit**: `FIXED` (nominal tetap) atau `PERSEN_MARGIN` (persen × margin, dibulatkan ke Rupiah).
  Margin ≤ 0 → komisi 0. Komisi di-*snapshot* ke baris transaksi, jadi mengubah aturan tidak mengubah bulan lalu.
- **Gaji bersih** = Gaji pokok + Σ komisi bulan itu − potongan/kasbon. Gaji bersih negatif ditolak.
- **Jurnal otomatis**: Penjualan → Dr Kas/Bank, Cr Penjualan; Dr HPP, Cr Persediaan. Payroll → Dr Beban Gaji, Dr Beban Komisi,
  Cr Kas (neto), Cr Piutang Karyawan (potongan). Beban lain → Dr Beban Lainnya, Cr Kas/Bank.
- Laba rugi dihitung dari jurnal. "Simpan ulang payroll" menimpa payroll + jurnal payroll periode itu saja (idempoten).
- IMEI/SN yang sama pada tanggal yang sama ditolak (mencegah input ganda).

## Keamanan: yang sudah dan yang perlu Anda tahu
Sudah: PIN dibandingkan lewat hash waktu-konstan; cookie `HttpOnly`+`SameSite=Strict`+`Secure`, kedaluwarsa 8 jam, ditandatangani HMAC;
sesi diperiksa di middleware **dan** di route handler; batas 5 salah PIN/15 menit/IP; open-redirect diblok; `server-only` pada modul
yang memegang secret; payload dibangun ulang dari nilai tervalidasi (field asing seperti `token` dibuang); header keamanan + `noindex`.

Batasan: pembatas PIN berada di memori (best-effort di serverless, jadi pakai PIN panjang); tidak ada CSP ketat; sesi tidak bisa dicabut
satu per satu (ganti `SESSION_SECRET` untuk keluar-semua); mengganti `API_SECRET` butuh Script Property **dan** env Vercel diubah bersamaan.

## Pengujian
`npm test` (84 test, `node:test` + `tsx`, tanpa dependensi tambahan): rumus komisi/HPP/margin/laba rugi, payroll, validasi, parser JSON GAS,
auth/sesi, whitelist proxy, **dan simulasi `Code.gs` di VM** (token, validasi, idempotensi, serta paritas hasil hitung GAS ↔ TypeScript).

## Struktur
```
gas/Code.gs, appsscript.json        Backend Apps Script
src/lib/                            Logika murni (accounting, payroll, validasi, parser, auth) + gas-server (server-only) + gas-client
src/app/api/{gas,auth}/             Proxy ber-token & login/logout
src/middleware.ts                   Proteksi semua route kecuali /lock dan /api/auth/login
src/app/(app)/                      Ringkasan, penjualan, karyawan, payroll, laporan, pengaturan
tests/                              Unit test + simulasi GAS
```
