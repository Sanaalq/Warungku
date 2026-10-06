# Ayam Kremez Mbak Indar — Aplikasi Kasir (POS)

Aplikasi kasir (Point of Sale) berbasis **PWA** untuk UMKM **Ayam Kremez Mbak Indar** (ayam bakar & ayam goreng). Dirancang untuk **tablet** (landscape & portrait), tetap bisa dipakai di HP dan laptop. Berjalan **offline penuh** dan tidak perlu server/database.

> Tugas Mata Kuliah Rekayasa Perangkat Lunak (RPL): Software untuk UMKM

## Cara Menjalankan

PWA dan Service Worker **harus** dijalankan lewat `http://localhost` atau `https://`, bukan dengan membuka file langsung (`file://`).

```bash
# opsi 1 — Python
python -m http.server 8080
# opsi 2 — Node
npx serve .
```

Lalu buka `http://localhost:8080`.

**Akun demo** (login pakai PIN):

| User | Peran | PIN |
|------|-------|-----|
| Mbak Indar | Owner | `1234` |
| Anas | Kasir | `0000` |
| Rizal | Kasir | `1111` |

### Daftar Menu

| Kategori | Menu | Harga |
|---|---|---|
| Ayam Bakar | Dada / Paha / Sayap | Rp 9.000 / 8.000 / 7.500 |
| Ayam Goreng | Dada / Paha / Sayap | Rp 9.000 / 8.000 / 7.500 |
| Paket | Paket 1 / Paket 2 | Rp 13.000 / 12.000 |
| Minuman | Es Teh / Es Jeruk / Air Mineral | Rp 3.000 / 3.000 / 2.000 |
| Tambahan | Nasi | Rp 3.000 |

Harga, HPP, stok, dan isi paket bisa diubah di menu **Produk** (login sebagai Owner).

### Instal di Tablet (Android)
1. Deploy gratis ke **GitHub Pages / Netlify / Vercel** (wajib HTTPS).
2. Buka di Chrome tablet → menu ⋮ → **Install app / Tambahkan ke layar utama**.
3. Aplikasi terbuka fullscreen seperti app native dan tetap jalan tanpa internet.

## Fitur

| Modul | Fitur |
|---|---|
| **Kasir** | Grid menu bisa disentuh, filter kategori, cari nama/SKU, catatan per item (pedas, dll), diskon (Rp/%), pajak & service otomatis, tipe pesanan (makan sini/bungkus), **tunda pesanan** (hold), keranjang tetap tersimpan walau aplikasi tertutup |
| **Pembayaran** | Tunai (numpad + tombol uang cepat + hitung kembalian), QRIS, Transfer, E-Wallet; anti double-submit |
| **Struk** | Preview + cetak (format thermal 58mm) |
| **Produk & Stok** | CRUD produk, kategori, HPP & margin, stok minimum, stok masuk/keluar/opname, riwayat stok, peringatan stok menipis, produk habis otomatis tidak bisa dipilih |
| **Transaksi** | Filter tanggal/metode/pencarian, detail struk, **pembatalan (void)** dengan alasan, stok dikembalikan; kasir butuh PIN owner untuk void |
| **Keuangan** | Catat pengeluaran per kategori, pemasukan vs pengeluaran, arus kas |
| **Laporan** | Omzet, laba kotor, laba bersih, grafik penjualan harian/per jam, produk terlaris, metode bayar, export CSV (bisa dibuka di Excel) |
| **Pengaturan** | Profil usaha (untuk struk), pajak/service, manajemen user & PIN, backup/restore JSON, reset data, mode gelap |
| **Hak akses** | Owner: semua menu · Kasir: hanya Kasir & Transaksi miliknya |

## Desain Responsif

| Layar | Tata letak |
|---|---|
| Tablet landscape (≥ 961px) | Nav rail kiri · katalog · keranjang tetap di kanan |
| Tablet portrait (641–960px) | Keranjang jadi **bottom sheet** dengan bar ringkasan di bawah |
| HP (≤ 640px) | Navigasi pindah ke bawah, modal jadi sheet |

Ukuran tombol minimal 44–58px supaya enak disentuh. Ikon menggunakan SVG inline, jadi tidak perlu CDN dan tetap tampil saat offline.

## Struktur Proyek

```
WarungKu-POS/
├── index.html              # app shell (SPA)
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # service worker (offline cache)
├── css/app.css             # design system + responsive
├── js/
│   ├── ui.js               # ikon, format Rupiah, toast, modal, chart
│   ├── db.js               # data layer (localStorage) + seed demo
│   ├── pos.js              # halaman kasir, pembayaran, struk
│   ├── pages.js            # produk, transaksi, keuangan, laporan, pengaturan
│   └── app.js              # router, auth PIN, boot, registrasi SW
├── assets/                 # ikon PWA (svg, 192, 512, maskable)
├── docs/screenshots/
└── tools/make_icons.py     # generator ikon PNG
```

Dibuat dengan **Vanilla JS** tanpa framework atau build step.

## Arsitektur (untuk laporan RPL)

- **Model**: SPA + hash router (`#/pos`, `#/products`, …)
- **Penyimpanan**: `localStorage` (prefix `wk2_`), dengan backup/restore JSON
- **Offline**: Service Worker menyimpan semua aset (strategi *stale-while-revalidate*; untuk navigasi pakai *network-first* dengan fallback ke cache). Ganti `VERSION` di `sw.js` setiap rilis.
- **Integritas transaksi**: `DB.checkout()` memvalidasi stok, menyimpan transaksi, dan mengurangi stok sekaligus. HPP dicatat saat transaksi (snapshot) supaya laporan laba tetap akurat walau harga modal berubah.
- **Keamanan**: PIN disimpan dalam bentuk hash, semua input di-escape (anti-XSS). Catatan: ini autentikasi lokal untuk demo. Versi produksi perlu backend.

### Aktor & Use Case
- **Owner**: kelola produk/stok, lihat laporan & keuangan, kelola user, void transaksi, pengaturan.
- **Kasir**: login PIN, input pesanan, terima pembayaran, cetak struk, lihat transaksinya sendiri.

### Pengembangan Lanjutan
Sinkronisasi cloud (Firebase/Supabase), multi-outlet, printer Bluetooth ESC/POS, integrasi QRIS dinamis, scan barcode kamera.
