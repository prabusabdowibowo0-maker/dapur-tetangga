-- Dapur Tetangga: skema + RLS + fungsi server. Jalankan SEKALI di Supabase > SQL Editor.
create type public.order_status as enum ('MENUNGGU_KONFIRMASI','DISIAPKAN','MENUNGGU_DRIVER','SEDANG_DIANTAR','SELESAI','DIBATALKAN');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'konsumen' check (role in ('konsumen','mitra','admin')),
  full_name text not null check (char_length(full_name) between 2 and 60),
  phone text check (phone is null or char_length(phone) <= 20),
  created_at timestamptz not null default now()
);
create table public.kitchens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  cook_name text, area text,
  description text check (description is null or char_length(description) <= 300),
  payment_info text check (payment_info is null or char_length(payment_info) <= 300),
  image_url text,
  is_verified boolean not null default false,
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.menus (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references public.kitchens on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 200),
  price integer not null check (price between 1000 and 500000),
  available boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  consumer_id uuid not null references public.profiles,
  consumer_name text not null,
  kitchen_id uuid not null references public.kitchens,
  status public.order_status not null default 'MENUNGGU_KONFIRMASI',
  payment_method text not null check (payment_method in ('qris','transfer','cod')),
  payment_status text not null default 'belum' check (payment_status in ('belum','lunas')),
  fulfillment text not null check (fulfillment in ('antar','ambil')),
  address text, note text,
  subtotal integer not null, delivery_fee integer not null,
  commission_rate numeric(4,3) not null, commission integer not null, total integer not null,
  created_at timestamptz not null default now()
);
create table public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders on delete cascade,
  menu_id uuid references public.menus on delete set null,
  name text not null, price integer not null,
  qty integer not null check (qty between 1 and 20)
);
create index on public.menus (kitchen_id);
create index on public.orders (consumer_id);
create index on public.orders (kitchen_id);
create index on public.order_items (order_id);

-- Profil otomatis saat daftar. Peran HANYA 'konsumen' atau 'mitra' (admin hanya lewat SQL manual).
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare
  r text := case when new.raw_user_meta_data->>'role' = 'mitra' then 'mitra' else 'konsumen' end;
  n text := left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Warga'), 60);
begin
  insert into profiles (id, role, full_name) values (new.id, r, n);
  if r = 'mitra' then
    insert into kitchens (owner_id, name, cook_name)
    values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'kitchen_name'), ''), 'Dapur ' || n), 60), n);
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.owns_kitchen(k uuid) returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from kitchens where id = k and owner_id = auth.uid())
$$;

-- Hak akses tabel: tulis hanya lewat kolom/fungsi yang diizinkan
alter table public.profiles enable row level security;
alter table public.kitchens enable row level security;
alter table public.menus enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke insert, update, delete on public.profiles, public.kitchens, public.orders, public.order_items from anon, authenticated;
revoke insert, update, delete on public.menus from anon;
grant update (full_name, phone) on public.profiles to authenticated;
grant update (name, cook_name, area, description, payment_info, image_url, is_open) on public.kitchens to authenticated;

create policy "profil sendiri" on public.profiles for select to authenticated using (id = auth.uid());
create policy "ubah profil sendiri" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "dapur terverifikasi terlihat publik" on public.kitchens for select to anon, authenticated using (is_verified or owner_id = auth.uid());
create policy "ubah dapur sendiri" on public.kitchens for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "menu terlihat publik" on public.menus for select to anon, authenticated
  using (owns_kitchen(kitchen_id) or (available and exists (select 1 from public.kitchens k where k.id = kitchen_id and k.is_verified)));
create policy "mitra tambah menu" on public.menus for insert to authenticated with check (owns_kitchen(kitchen_id));
create policy "mitra ubah menu" on public.menus for update to authenticated using (owns_kitchen(kitchen_id)) with check (owns_kitchen(kitchen_id));
create policy "mitra hapus menu" on public.menus for delete to authenticated using (owns_kitchen(kitchen_id));

create policy "pesanan milik pembeli atau dapur" on public.orders for select to authenticated using (consumer_id = auth.uid() or owns_kitchen(kitchen_id));
create policy "item pesanan mengikuti pesanan" on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id));

-- Fungsi server: harga dihitung di sini, bukan dipercaya dari browser
create function public.place_order(p_kitchen uuid, p_items jsonb, p_method text, p_fulfillment text, p_address text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me profiles; k kitchens; m menus; it jsonb; q int; sub int := 0; fee int;
  oid uuid := gen_random_uuid(); rate constant numeric := 0.10;  -- komisi platform 10%
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.role <> 'konsumen' then raise exception 'Masuk sebagai konsumen untuk memesan'; end if;
  select * into k from kitchens where id = p_kitchen and is_verified and is_open;
  if k.id is null then raise exception 'Dapur sedang tutup atau belum terverifikasi'; end if;
  if p_method not in ('qris','transfer','cod') or p_fulfillment not in ('antar','ambil') then raise exception 'Data pesanan tidak valid'; end if;
  if p_fulfillment = 'antar' and coalesce(trim(p_address), '') = '' then raise exception 'Alamat pengantaran wajib diisi'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then raise exception 'Keranjang tidak valid'; end if;
  fee := case when p_fulfillment = 'antar' then 5000 else 0 end;
  insert into orders (id, code, consumer_id, consumer_name, kitchen_id, payment_method, fulfillment, address, note, subtotal, delivery_fee, commission_rate, commission, total)
  values (oid, 'DT-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)), me.id, me.full_name, k.id, p_method, p_fulfillment, left(p_address, 120), left(p_note, 200), 0, fee, rate, 0, 0);
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

create function public.advance_order(p_order uuid) returns void language plpgsql security definer set search_path = public as $$
declare o orders;
begin
  select * into o from orders where id = p_order and owns_kitchen(kitchen_id);
  if o.id is null then raise exception 'Tidak diizinkan'; end if;
  update orders set status = case
    when o.status = 'MENUNGGU_KONFIRMASI' then 'DISIAPKAN'
    when o.status = 'DISIAPKAN' and o.fulfillment = 'ambil' then 'SELESAI'
    when o.status = 'DISIAPKAN' then 'MENUNGGU_DRIVER'
    when o.status = 'MENUNGGU_DRIVER' then 'SEDANG_DIANTAR'
    when o.status = 'SEDANG_DIANTAR' then 'SELESAI'
    else o.status end
  where id = p_order;
end $$;

create function public.confirm_payment(p_order uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update orders set payment_status = 'lunas' where id = p_order and owns_kitchen(kitchen_id) and status <> 'DIBATALKAN';
  if not found then raise exception 'Tidak diizinkan'; end if;
end $$;

create function public.cancel_order(p_order uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update orders set status = 'DIBATALKAN' where id = p_order and consumer_id = auth.uid() and status = 'MENUNGGU_KONFIRMASI' and payment_status = 'belum';
  if not found then raise exception 'Pesanan tidak bisa dibatalkan'; end if;
end $$;

revoke execute on function public.place_order, public.advance_order, public.confirm_payment, public.cancel_order from public, anon;
grant execute on function public.place_order, public.advance_order, public.confirm_payment, public.cancel_order to authenticated;
