# Dapur Tetangga

Platform kuliner rumahan hyperlocal: konsumen memesan dari dapur mitra di sekitar RT/RW.
Frontend statis (HTML + Tailwind CDN + JS biasa) dengan backend **Supabase** (Auth + Postgres + RLS). Tidak ada build step.

## Struktur
```
index.html        katalog dapur          login.html        masuk / daftar (konsumen & mitra)
menu.html         menu satu dapur        cart.html         keranjang, checkout, info pembayaran
tracker.html      pesanan saya           dashboard.html    dashboard mitra (pesanan, pengaturan dapur)
menu-mitra.html   CRUD menu mitra
js/config.js      URL + anon key Supabase (isi sendiri)
js/store.js       klien Supabase: Auth, DB, Cart
js/layout.js      header/footer/helper UI      js/app.js   logika tiap halaman
supabase/schema.sql   tabel, RLS, dan fungsi server (harga dihitung di server)
```

## Setup (sekali)
1. Buat project di https://supabase.com, lalu buka **SQL Editor** dan jalankan seluruh isi `supabase/schema.sql`.
2. Salin **Project URL** dan **anon public key** (Project Settings > API) ke `js/config.js`.
   Jangan pernah memakai atau meng-commit `service_role` key.
3. **Authentication > Providers > Email**: untuk uji coba cepat, matikan "Confirm email". Untuk produksi, biarkan aktif.
4. Setelah punya domain: **Authentication > URL Configuration** isi Site URL dan Redirect URLs dengan domain Anda.
5. Jalankan lokal: `python3 -m http.server 8000`, buka http://localhost:8000.

## Alur operasional
- Mitra daftar di `login.html?role=mitra`. Dapurnya **belum tampil** di katalog sampai diverifikasi. Verifikasi di SQL Editor:
  ```sql
  update public.kitchens set is_verified = true where name = 'NAMA DAPUR';
  ```
- Mitra mengisi info pembayaran (rekening/QRIS) di dashboard dan menambah menu di Kelola Menu.
- Konsumen memesan, membayar sesuai info mitra, lalu mitra menekan **Tandai lunas** dan memproses status pesanan.

## Keamanan (sudah ada)
Row Level Security di semua tabel, peran `admin` tidak bisa dipilih lewat pendaftaran, pesanan dibuat lewat fungsi `place_order`
(harga dan komisi dihitung di server), perubahan status lewat fungsi yang memeriksa kepemilikan dapur, semua teks pengguna di-escape.

## Belum ada
Payment gateway otomatis (Midtrans/Xendit, butuh Edge Function + webhook), notifikasi pesanan baru (WhatsApp/email),
langganan mingguan berulang, upload foto dapur/menu, dan peran kurir. Tailwind CDN dipakai untuk kemudahan; ganti ke build Tailwind/Vite jika trafik besar.

## Push ke GitHub
```bash
git remote add origin https://github.com/USERNAME/dapur-tetangga.git
git push -u origin main
```
