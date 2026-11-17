-- Jalankan di SQL Editor jika schema.sql sudah pernah dijalankan. Mengubah place_order agar akun mitra juga bisa memesan (kecuali dari dapurnya sendiri).
create or replace function public.place_order(p_kitchen uuid, p_items jsonb, p_method text, p_fulfillment text, p_address text default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me profiles; k kitchens; m menus; it jsonb; q int; sub int := 0; fee int;
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

revoke execute on function public.place_order from public, anon;
grant execute on function public.place_order to authenticated;
