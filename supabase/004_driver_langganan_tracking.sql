-- Jalankan SEKALI di Supabase > SQL Editor (setelah 002 dan 003).
-- Menambah: peran DRIVER, kategori/jarak/cerita/jaminan kualitas dapur, paket langganan mingguan,
-- riwayat status pesanan (live tracking), dan estimasi tiba dari driver.

-- 1) Peran & profil
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('konsumen','mitra','driver','admin'));
alter table public.profiles add column if not exists vehicle text check (vehicle is null or vehicle in ('Jalan Kaki','Sepeda','Motor'));

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare
  r text := case when new.raw_user_meta_data->>'role' in ('mitra','driver') then new.raw_user_meta_data->>'role' else 'konsumen' end;
  n text := left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Warga'), 60);
  v text := case when new.raw_user_meta_data->>'vehicle' in ('Jalan Kaki','Sepeda','Motor') then new.raw_user_meta_data->>'vehicle' else 'Motor' end;
begin
  insert into profiles (id, role, full_name, vehicle) values (new.id, r, n, case when r = 'driver' then v else null end);
  if r = 'mitra' then
    insert into kitchens (owner_id, name, cook_name)
    values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'kitchen_name'), ''), 'Dapur ' || n), 60), n);
  end if;
  return new;
end $$;

-- 2) Profil dapur
alter table public.kitchens add column if not exists category text check (category is null or category in ('Sunda','Padang','Jawa Timur','Sehat','Sarapan/Bekal','Lauk & Sambal'));
alter table public.kitchens add column if not exists distance_m integer not null default 300 check (distance_m between 0 and 800);
alter table public.kitchens add column if not exists story text check (story is null or char_length(story) <= 300);
alter table public.kitchens add column if not exists badges text[] not null default '{}' check (cardinality(badges) <= 4);
grant update (category, distance_m, story, badges) on public.kitchens to authenticated;

-- 3) Menu harian vs paket langganan mingguan
alter table public.menus add column if not exists kind text not null default 'harian' check (kind in ('harian','langganan'));

-- 4) Pesanan: mode, driver, estimasi
alter table public.orders add column if not exists mode text not null default 'harian' check (mode in ('harian','langganan'));
alter table public.orders add column if not exists driver_id uuid references public.profiles;
alter table public.orders add column if not exists driver_name text;
alter table public.orders add column if not exists driver_vehicle text;
alter table public.orders add column if not exists eta_minutes integer check (eta_minutes is null or eta_minutes between 1 and 60);
create index if not exists orders_driver_idx on public.orders (driver_id);

-- 5) Riwayat status (diisi otomatis oleh trigger)
create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders on delete cascade,
  status public.order_status not null,
  note text not null,
  created_at timestamptz not null default now()
);
create index if not exists order_events_order_idx on public.order_events (order_id);
alter table public.order_events enable row level security;
revoke insert, update, delete on public.order_events from anon, authenticated;
drop policy if exists "riwayat mengikuti pesanan" on public.order_events;
create policy "riwayat mengikuti pesanan" on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

create or replace function public.log_order_event() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into order_events (order_id, status, note) values (new.id, new.status, case new.status
      when 'MENUNGGU_KONFIRMASI' then 'Pesanan dibuat, diteruskan ke mitra dapur'
      when 'DISIAPKAN' then 'Mitra mengonfirmasi dan mulai memasak'
      when 'MENUNGGU_DRIVER' then 'Makanan dikemas hangat, menunggu kurir'
      when 'SEDANG_DIANTAR' then 'Kurir ' || coalesce(new.driver_name, 'warga') || ' membawa pesanan'
      when 'SELESAI' then 'Pesanan sampai dengan selamat'
      else 'Pesanan dibatalkan' end);
  end if;
  return new;
end $$;
drop trigger if exists order_status_log on public.orders;
create trigger order_status_log after insert or update of status on public.orders for each row execute function public.log_order_event();

-- 6) Driver boleh melihat pesanan yang siap dijemput + pesanan yang ia antar
create or replace function public.is_driver() returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'driver')
$$;
drop policy if exists "pesanan milik pembeli atau dapur" on public.orders;
drop policy if exists "pesanan pembeli dapur atau driver" on public.orders;
create policy "pesanan pembeli dapur atau driver" on public.orders for select to authenticated
  using (consumer_id = auth.uid() or owns_kitchen(kitchen_id) or driver_id = auth.uid()
         or (status = 'MENUNGGU_DRIVER' and fulfillment = 'antar' and is_driver()));

-- 7) Fungsi server
create or replace function public.place_order(p_kitchen uuid, p_items jsonb, p_method text, p_fulfillment text, p_address text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me profiles; k kitchens; m menus; it jsonb; q int; sub int := 0; fee int; has_sub boolean;
  oid uuid := gen_random_uuid(); rate constant numeric := 0.10;  -- komisi platform 10%
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.role not in ('konsumen','mitra') then raise exception 'Masuk dulu untuk memesan'; end if;
  select * into k from kitchens where id = p_kitchen and is_verified and is_open;
  if k.id is null then raise exception 'Dapur sedang tutup atau belum terverifikasi'; end if;
  if k.owner_id = me.id then raise exception 'Tidak bisa memesan dari dapur sendiri'; end if;
  if p_method not in ('qris','transfer','cod') or p_fulfillment not in ('antar','ambil') then raise exception 'Data pesanan tidak valid'; end if;
  if p_fulfillment = 'antar' and coalesce(trim(p_address), '') = '' then raise exception 'Alamat pengantaran wajib diisi'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then raise exception 'Keranjang tidak valid'; end if;
  select coalesce(bool_or(kind = 'langganan'), false) into has_sub from menus
   where kitchen_id = k.id and available and id in (select (e->>'menu_id')::uuid from jsonb_array_elements(p_items) e);
  fee := case when p_fulfillment = 'antar' then (case when has_sub then 15000 else 5000 end) else 0 end;
  insert into orders (id, code, consumer_id, consumer_name, kitchen_id, mode, payment_method, fulfillment, address, note, subtotal, delivery_fee, commission_rate, commission, total)
  values (oid, 'DT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)), me.id, me.full_name, k.id, case when has_sub then 'langganan' else 'harian' end, p_method, p_fulfillment, left(p_address, 120), left(p_note, 200), 0, fee, rate, 0, 0);
  for it in select * from jsonb_array_elements(p_items) loop
    q := (it->>'qty')::int;
    if q is null or q not between 1 and 20 then raise exception 'Jumlah tidak valid'; end if;
    select * into m from menus where id = (it->>'menu_id')::uuid and kitchen_id = k.id and available;
    if m.id is null then raise exception 'Ada menu yang sudah tidak tersedia'; end if;
    insert into order_items (order_id, menu_id, name, price, qty) values (oid, m.id, m.name, m.price, q);
    sub := sub + m.price * q;
  end loop;
  update orders set subtotal = sub, commission = round(sub * rate), total = sub + fee where id = oid;
  return oid;
end $$;

-- Mitra hanya mengurus sampai "siap dijemput"; pengantaran dipegang driver
create or replace function public.advance_order(p_order uuid) returns void language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where id = p_order and owns_kitchen(kitchen_id);
  if o.id is null then raise exception 'Tidak diizinkan'; end if;
  update orders set status = case
    when o.status = 'MENUNGGU_KONFIRMASI' then 'DISIAPKAN'
    when o.status = 'DISIAPKAN' and o.fulfillment = 'ambil' then 'SELESAI'
    when o.status = 'DISIAPKAN' then 'MENUNGGU_DRIVER'
    else o.status end
  where id = p_order;
end $$;

create or replace function public.claim_order(p_order uuid, p_eta int) returns void language plpgsql security definer set search_path = public as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid() and role = 'driver';
  if me.id is null then raise exception 'Hanya akun driver yang bisa mengambil pesanan'; end if;
  if p_eta is null or p_eta not between 1 and 60 then raise exception 'Estimasi tidak valid'; end if;
  update orders set status = 'SEDANG_DIANTAR', driver_id = me.id, driver_name = me.full_name, driver_vehicle = me.vehicle, eta_minutes = p_eta
   where id = p_order and status = 'MENUNGGU_DRIVER' and driver_id is null and fulfillment = 'antar';
  if not found then raise exception 'Pesanan sudah diambil driver lain'; end if;
end $$;

create or replace function public.complete_delivery(p_order uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update orders set status = 'SELESAI' where id = p_order and driver_id = auth.uid() and status = 'SEDANG_DIANTAR';
  if not found then raise exception 'Tidak diizinkan'; end if;
end $$;

revoke execute on function public.place_order, public.advance_order, public.claim_order, public.complete_delivery from public, anon;
grant execute on function public.place_order, public.advance_order, public.claim_order, public.complete_delivery to authenticated;
