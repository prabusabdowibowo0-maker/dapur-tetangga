-- Jalankan SEKALI di Supabase > SQL Editor (setelah schema.sql dan 002).
-- 1) Kolom gambar menu + deskripsi boleh lebih panjang (untuk list poin)
alter table public.menus add column if not exists image_url text;
alter table public.menus drop constraint if exists menus_image_url_check;
alter table public.menus add constraint menus_image_url_check check (image_url is null or (image_url ~ '^https://' and char_length(image_url) <= 500));
alter table public.menus drop constraint if exists menus_description_check;
alter table public.menus add constraint menus_description_check check (char_length(description) <= 300);

-- 2) Bucket penyimpanan foto menu: publik untuk dibaca, hanya pemilik dapur yang boleh tulis di foldernya
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('menu-images', 'menu-images', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "mitra lihat foto menu sendiri" on storage.objects;
drop policy if exists "mitra unggah foto menu" on storage.objects;
drop policy if exists "mitra ganti foto menu" on storage.objects;
drop policy if exists "mitra hapus foto menu" on storage.objects;
create policy "mitra lihat foto menu sendiri" on storage.objects for select to authenticated
  using (bucket_id = 'menu-images' and (storage.foldername(name))[1] in (select id::text from public.kitchens where owner_id = auth.uid()));
create policy "mitra unggah foto menu" on storage.objects for insert to authenticated
  with check (bucket_id = 'menu-images' and (storage.foldername(name))[1] in (select id::text from public.kitchens where owner_id = auth.uid()));
create policy "mitra ganti foto menu" on storage.objects for update to authenticated
  using (bucket_id = 'menu-images' and (storage.foldername(name))[1] in (select id::text from public.kitchens where owner_id = auth.uid()));
create policy "mitra hapus foto menu" on storage.objects for delete to authenticated
  using (bucket_id = 'menu-images' and (storage.foldername(name))[1] in (select id::text from public.kitchens where owner_id = auth.uid()));
