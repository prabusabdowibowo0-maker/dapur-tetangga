// Logika per halaman, dipilih lewat <body data-page="...">.
const pill = (t, c) => `<span class="${c} text-xs font-bold px-2.5 py-1 rounded-full">${t}</span>`;
const fail = (sel, e) => { $(sel).innerHTML = `<p class="col-span-full text-sm text-error" role="alert">Gagal memuat data: ${esc(e.message)}</p>`; };
const ST = {
  MENUNGGU_KONFIRMASI: ['Menunggu konfirmasi', 'bg-error-container text-on-error-container'],
  DISIAPKAN: ['Disiapkan', 'bg-tertiary-fixed text-on-tertiary-fixed'],
  MENUNGGU_DRIVER: ['Menunggu kurir', 'bg-secondary-fixed text-on-secondary-fixed-variant'],
  SEDANG_DIANTAR: ['Sedang diantar', 'bg-secondary-fixed text-on-secondary-fixed-variant'],
  SELESAI: ['Selesai', 'bg-secondary-fixed text-secondary'],
  DIBATALKAN: ['Dibatalkan', 'bg-surface-highest text-on-surface-variant'],
};
const METHOD = { qris: 'QRIS', transfer: 'Transfer', cod: 'Tunai' };
const itemsText = (o) => o.order_items.map((i) => `${i.qty}x ${i.name}`).join(', ');
const payPill = (o) => pill(o.payment_status === 'lunas' ? 'Lunas' : `Belum bayar (${METHOD[o.payment_method]})`, o.payment_status === 'lunas' ? 'bg-secondary text-on-secondary' : 'bg-surface-highest text-on-surface-variant');
const input = 'mt-1 w-full bg-surface-low rounded-lg px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-primary-container';

const pages = {
  // ---------- Katalog ----------
  async katalog() {
    let all;
    try { all = await DB.kitchens(); } catch (e) { return fail('#grid', e); }
    const minPrice = (k) => { const p = k.menus.filter((m) => m.available).map((m) => m.price); return p.length ? Math.min(...p) : null; };
    const card = (k) => { const mp = minPrice(k); return `
      <article class="bg-surface-lowest rounded-xl shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between">
        <div><div class="relative h-44 bg-surface-high flex items-center justify-center text-on-surface-variant">${ic('restaurant', '!text-5xl opacity-40')}
          ${k.image_url?.startsWith('https://') ? `<img src="${esc(k.image_url)}" alt="${esc(k.name)}" loading="lazy" onerror="this.remove()" class="absolute inset-0 w-full h-full object-cover">` : ''}
          <span class="absolute top-3 right-3">${pill(k.is_open ? 'Buka' : 'Tutup', k.is_open ? 'bg-secondary-fixed text-on-secondary-fixed-variant' : 'bg-surface-highest text-on-surface-variant')}</span></div>
        <div class="p-4"><h3 class="text-lg font-bold">${esc(k.name)}</h3>
          <p class="text-sm text-on-surface-variant">${esc(k.cook_name || '')}${k.area ? ' &bull; ' + esc(k.area) : ''}</p>
          <p class="text-sm mt-2 line-clamp-2">${esc(k.description || '')}</p>
          <p class="text-sm mt-3 font-bold text-primary-container">${mp ? 'Mulai ' + rp(mp) : 'Belum ada menu'}</p></div></div>
        <div class="p-4 pt-0"><a href="menu.html?dapur=${esc(k.id)}" class="w-full bg-primary-container hover:bg-primary text-on-primary font-semibold text-sm py-2.5 rounded-lg flex items-center justify-center gap-2">Lihat menu ${ic('arrow_forward')}</a></div></article>`; };
    const draw = () => {
      const q = $('#q').value.toLowerCase().trim();
      const list = all.filter((k) => [k.name, k.cook_name, k.area, k.description].join(' ').toLowerCase().includes(q))
        .sort($('#sort').value === 'price' ? (a, b) => (minPrice(a) ?? 1e9) - (minPrice(b) ?? 1e9) : (a, b) => a.name.localeCompare(b.name));
      $('#count').textContent = list.length;
      $('#grid').innerHTML = list.length ? list.map(card).join('') : '<p class="col-span-full text-center text-on-surface-variant py-10">Belum ada dapur yang tampil. Dapur baru muncul setelah diverifikasi pengurus RT.</p>';
    };
    $('#q').oninput = draw; $('#sort').onchange = draw; draw();
  },

  // ---------- Menu satu dapur ----------
  async menu() {
    const id = new URLSearchParams(location.search).get('dapur') || '';
    const gone = (m) => { $('#content').innerHTML = `<p class="text-center py-16 text-on-surface-variant">${m} <a class="text-primary font-semibold" href="index.html">Kembali ke katalog</a></p>`; };
    if (!UUID.test(id)) return gone('Dapur tidak ditemukan.');
    let k, items;
    try { [k, items] = await Promise.all([DB.kitchen(id), DB.menus(id)]); } catch (e) { return gone('Gagal memuat: ' + esc(e.message)); }
    if (!k) return gone('Dapur tidak ditemukan.');
    items = items.filter((m) => m.available);
    $('#k-name').textContent = k.name;
    $('#k-meta').textContent = [k.cook_name, k.area].filter(Boolean).join(' • ');
    $('#k-desc').textContent = k.description || '';
    $('#k-status').textContent = k.is_open ? 'Buka' : 'Tutup';
    const sel = {};
    const total = () => items.reduce((s, m) => s + m.price * (sel[m.id] || 0), 0);
    const draw = () => {
      $('#items').innerHTML = items.map((m) => `<div class="flex items-center justify-between gap-3 p-3 bg-surface-low rounded-xl"><div class="min-w-0"><b class="text-sm">${esc(m.name)}</b><p class="text-xs text-on-surface-variant">${esc(m.description)}</p><b class="text-sm text-primary-container">${rp(m.price)}</b></div>
        <div class="flex items-center gap-1 shrink-0"><button data-id="${m.id}" data-d="-1" aria-label="Kurangi ${esc(m.name)}" class="w-8 h-8 rounded bg-surface-lowest font-bold">-</button><span class="w-6 text-center font-bold">${sel[m.id] || 0}</span><button data-id="${m.id}" data-d="1" aria-label="Tambah ${esc(m.name)}" class="w-8 h-8 rounded bg-surface-lowest font-bold">+</button></div></div>`).join('') || '<p class="text-sm text-on-surface-variant">Belum ada menu tersedia.</p>';
      $('#total').textContent = rp(total());
    };
    const add = () => {
      if (Auth.user()?.role === 'mitra') { toast('Masuk sebagai konsumen untuk memesan'); return false; }
      if (!k.is_open) { toast('Dapur sedang tutup'); return false; }
      const e = Object.entries(sel).filter(([, q]) => q > 0);
      if (!e.length) { toast('Pilih minimal satu menu'); return false; }
      for (const [mid, q] of e) if (!Cart.add(k.id, mid, q)) return false;
      for (const x in sel) delete sel[x];
      const b = $('#cart-badge'); if (b) b.textContent = Cart.count();
      draw(); return true;
    };
    $('#items').onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) { sel[b.dataset.id] = Math.max(0, Math.min(10, (sel[b.dataset.id] || 0) + +b.dataset.d)); draw(); } };
    $('#add').onclick = () => add() && toast('Masuk keranjang');
    $('#now').onclick = () => add() && (location.href = 'cart.html');
    draw();
  },

  // ---------- Keranjang, checkout, pembayaran ----------
  async cart() {
    const FEE = 5000;
    let menus = [];
    const val = (n) => $(`input[name=${n}]:checked`).value;
    const load = async () => { const ids = Cart.get().items.map((i) => i.id); try { menus = ids.length ? await DB.menusByIds(ids) : []; } catch (e) { toast(e.message); } };
    const lines = () => Cart.get().items.map((i) => ({ ...i, ...(menus.find((m) => m.id === i.id) || {}) })).filter((l) => l.price);
    const calc = () => { const L = lines(), sub = L.reduce((s, l) => s + l.price * l.qty, 0), fee = val('ful') === 'antar' && L.length ? FEE : 0; return { L, sub, fee, total: sub + fee }; };
    const draw = () => {
      const { L, sub, fee, total } = calc();
      $('#empty').classList.toggle('hidden', !!L.length); $('#cart-grid').classList.toggle('hidden', !L.length);
      $('#lines').innerHTML = L.map((l) => `<div class="flex items-center justify-between gap-3 py-2"><div class="min-w-0"><b class="text-sm">${esc(l.name)}</b><p class="text-xs text-on-surface-variant">${rp(l.price)}</p></div>
        <div class="flex items-center gap-1 shrink-0"><button data-id="${l.id}" data-q="${l.qty - 1}" aria-label="Kurangi" class="w-8 h-8 rounded bg-surface-low font-bold">-</button><span class="w-6 text-center font-bold">${l.qty}</span><button data-id="${l.id}" data-q="${l.qty + 1}" aria-label="Tambah" class="w-8 h-8 rounded bg-surface-low font-bold">+</button><button data-id="${l.id}" data-q="0" aria-label="Hapus" class="ml-1 text-error">${ic('delete')}</button></div></div>`).join('');
      $('#addr').classList.toggle('hidden', val('ful') === 'ambil');
      $('#sum').innerHTML = `<div class="flex justify-between"><span>Subtotal</span><span>${rp(sub)}</span></div><div class="flex justify-between"><span>Ongkir</span><span>${fee ? rp(fee) : 'Gratis'}</span></div><div class="flex justify-between text-lg font-bold pt-2"><span>Total</span><span class="text-primary-container">${rp(total)}</span></div>`;
      const b = $('#cart-badge'); if (b) b.textContent = Cart.count();
    };
    $('#lines').onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) { Cart.setQty(b.dataset.id, Math.min(20, +b.dataset.q)); draw(); } };
    $$('input[name=ful]').forEach((r) => (r.onchange = draw));
    $('#pay-btn').onclick = async () => {
      const u = Auth.user();
      if (u?.role !== 'konsumen') { toast('Masuk sebagai konsumen dulu'); setTimeout(() => (location.href = 'login.html?next=cart.html'), 900); return; }
      const { L, total } = calc(), ful = val('ful'), method = val('pay'), address = $('#blok').value.trim();
      if (!L.length) return;
      if (ful === 'antar' && !address) { toast('Isi blok / alamat pengantaran'); $('#blok').focus(); return; }
      const b = $('#pay-btn'); b.disabled = true;
      try {
        const kid = Cart.get().kitchen;
        await DB.placeOrder({ kitchen: kid, items: L.map((l) => ({ menu_id: l.id, qty: l.qty })), method, fulfillment: ful, address: ful === 'antar' ? address : null, note: $('#note').value.trim() || null });
        const k = await DB.kitchen(kid).catch(() => null);
        Cart.clear(); draw();
        $('#checkout').classList.add('hidden'); $('#pay').classList.remove('hidden');
        $('#pay-total').textContent = rp(total);
        $('#pay-body').innerHTML = method === 'cod' ? '<p class="text-sm">Bayar tunai ke mitra/kurir saat pesanan tiba.</p>'
          : `<p class="text-sm font-semibold mb-1">Bayar ke ${esc(k?.name || 'dapur')}:</p><pre class="whitespace-pre-wrap text-sm font-sans">${esc(k?.payment_info || 'Mitra belum mengisi info pembayaran. Hubungi mitra untuk detail.')}</pre><p class="text-xs text-on-surface-variant mt-3">Setelah membayar, mitra akan mengonfirmasi dan menandai pesanan Anda lunas.</p>`;
      } catch (e) { toast(e.message); b.disabled = false; }
    };
    await load(); draw();
  },

  // ---------- Pesanan saya ----------
  async tracker() {
    const card = (o) => { const [l, c] = ST[o.status]; return `<article class="bg-surface-lowest rounded-xl p-4 shadow-sm flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2"><b class="text-sm font-mono text-primary-container">${esc(o.code)}</b><b>${esc(o.kitchens?.name || '')}</b>${pill(l, c)}${payPill(o)}</div>
      <p class="text-sm">${esc(itemsText(o))}</p>
      <div class="flex items-center justify-between text-xs text-on-surface-variant"><span>${new Date(o.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} &bull; ${o.fulfillment === 'antar' ? 'Diantar ke ' + esc(o.address) : 'Ambil sendiri'}</span><b class="text-base text-on-surface">${rp(o.total)}</b></div>
      ${o.status === 'MENUNGGU_KONFIRMASI' && o.payment_status === 'belum' ? `<button data-c="${o.id}" class="self-start text-xs font-bold text-error">Batalkan pesanan</button>` : ''}</article>`; };
    const load = async () => { try { const L = await DB.myOrders(); $('#orders').innerHTML = L.map(card).join('') || '<p class="text-center py-10 text-on-surface-variant">Belum ada pesanan. <a href="index.html" class="text-primary font-semibold">Pilih dapur</a></p>'; } catch (e) { fail('#orders', e); } };
    $('#orders').onclick = async (e) => { const b = e.target.closest('[data-c]'); if (b && confirm('Batalkan pesanan ini?')) { try { await DB.cancel(b.dataset.c); toast('Pesanan dibatalkan'); } catch (x) { toast(x.message); } load(); } };
    load(); setInterval(load, 20000);
  },

  // ---------- Dashboard mitra ----------
  async dashboard() {
    const K = Auth.user().kitchen;
    if (!K) { $('#orders').innerHTML = '<p class="text-error">Data dapur tidak ditemukan. Hubungi admin.</p>'; return; }
    $('#banner').classList.toggle('hidden', K.is_verified);
    $('#k-name').textContent = K.name;
    const f = $('#settings'); let open = K.is_open;
    f.desc.value = K.description || ''; f.pinfo.value = K.payment_info || '';
    const drawToggle = () => { $('#toggle').className = `px-3 py-1.5 rounded-lg text-xs font-bold ${open ? 'bg-secondary text-on-secondary' : 'bg-error text-on-error'}`; $('#toggle').textContent = open ? 'Dapur buka (klik untuk tutup)' : 'Dapur tutup (klik untuk buka)'; };
    $('#toggle').onclick = async () => { try { await DB.saveKitchen({ is_open: !open }); open = !open; drawToggle(); toast(open ? 'Dapur dibuka' : 'Dapur ditutup'); } catch (e) { toast(e.message); } };
    f.onsubmit = async (e) => { e.preventDefault(); try { await DB.saveKitchen({ description: f.desc.value.trim().slice(0, 300), payment_info: f.pinfo.value.trim().slice(0, 300) }); toast('Pengaturan disimpan'); } catch (x) { toast(x.message); } };
    drawToggle();

    const NEXT = (o) => ({ MENUNGGU_KONFIRMASI: 'Terima pesanan', DISIAPKAN: o.fulfillment === 'ambil' ? 'Selesai (diambil)' : 'Panggil pengantar', MENUNGGU_DRIVER: 'Mulai antar', SEDANG_DIANTAR: 'Tandai selesai' }[o.status]);
    const load = async () => {
      let L; try { L = await DB.kitchenOrders(); } catch (e) { return fail('#orders', e); }
      const today = new Date().toDateString(), paidToday = L.filter((o) => o.payment_status === 'lunas' && o.status !== 'DIBATALKAN' && new Date(o.created_at).toDateString() === today);
      const sum = (a, k) => a.reduce((s, o) => s + o[k], 0);
      $('#kpis').innerHTML = [['Omzet lunas hari ini', rp(sum(paidToday, 'total'))], ['Komisi platform (10%)', rp(sum(paidToday, 'commission'))],
        ['Pesanan aktif', L.filter((o) => ['MENUNGGU_KONFIRMASI', 'DISIAPKAN', 'MENUNGGU_DRIVER', 'SEDANG_DIANTAR'].includes(o.status)).length], ['Perlu konfirmasi bayar', L.filter((o) => o.payment_status === 'belum' && o.status !== 'DIBATALKAN').length]]
        .map(([l, v]) => `<div class="bg-surface-lowest p-4 rounded-xl shadow-sm"><span class="text-xs font-semibold text-on-surface-variant">${l}</span><div class="text-xl font-extrabold mt-1">${v}</div></div>`).join('');
      $('#orders').innerHTML = L.map((o) => { const [l, c] = ST[o.status], nx = NEXT(o); return `<div class="bg-surface-low rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><b class="text-xs font-mono text-primary-container">${esc(o.code)}</b><b>${esc(o.consumer_name)}</b>${pill(l, c)}${payPill(o)}</div>
          <p class="text-sm">${esc(itemsText(o))} &bull; ${rp(o.total)}</p><p class="text-xs text-on-surface-variant">${o.fulfillment === 'antar' ? 'Antar: ' + esc(o.address) : 'Diambil sendiri'}${o.note ? ' &bull; Catatan: ' + esc(o.note) : ''}</p></div>
        <div class="flex gap-2 shrink-0 text-xs font-bold">${o.payment_status === 'belum' && o.status !== 'DIBATALKAN' ? `<button data-pay="${o.id}" class="bg-secondary-fixed text-on-secondary-fixed-variant px-3 py-2 rounded-lg">Tandai lunas</button>` : ''}${nx ? `<button data-adv="${o.id}" class="bg-primary-container text-on-primary px-3 py-2 rounded-lg">${nx}</button>` : ''}</div></div>`; }).join('') || '<p class="text-sm text-on-surface-variant">Belum ada pesanan.</p>';
    };
    $('#orders').onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      try { if (b.dataset.adv) await DB.advance(b.dataset.adv); else if (b.dataset.pay) await DB.confirmPay(b.dataset.pay); else return; toast('Diperbarui'); } catch (x) { toast(x.message); }
      load();
    };
    load(); setInterval(load, 15000);
  },

  // ---------- Login / daftar ----------
  login() {
    const q = new URLSearchParams(location.search);
    let role = q.get('role') === 'mitra' ? 'mitra' : 'konsumen', reg = false;
    const next = /^[a-z-]+\.html$/.test(q.get('next') || '') ? q.get('next') : null;
    const home = (r) => (r === 'mitra' ? (next === 'menu-mitra.html' ? next : 'dashboard.html') : next && !['dashboard.html', 'menu-mitra.html'].includes(next) ? next : 'index.html');
    if (Auth.user()) { location.replace(home(Auth.user().role)); return; }
    const msg = (t, good) => { $('#err').textContent = t; $('#err').className = `text-sm min-h-5 ${good ? 'text-secondary' : 'text-error'}`; };
    const on = 'bg-primary-container text-on-primary shadow-sm', off = 'text-on-surface-variant';
    const draw = () => {
      $('#t-konsumen').className = `flex-1 py-2 rounded-lg text-sm font-bold ${role === 'konsumen' ? on : off}`;
      $('#t-mitra').className = `flex-1 py-2 rounded-lg text-sm font-bold ${role === 'mitra' ? on : off}`;
      $('#f-name').classList.toggle('hidden', !reg); $('#f-kitchen').classList.toggle('hidden', !(reg && role === 'mitra'));
      $('#switch').textContent = reg ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar';
      $('#title').textContent = (reg ? 'Daftar sebagai ' : 'Masuk sebagai ') + (role === 'mitra' ? 'mitra dapur' : 'konsumen');
      $('#submit').textContent = reg ? 'Daftar' : 'Masuk';
      $('#hint').textContent = role === 'mitra' ? 'Dapur baru tampil di katalog setelah diverifikasi pengurus RT/admin.' : 'Daftar gratis untuk memesan masakan tetangga.';
      msg('');
    };
    $('#t-konsumen').onclick = () => { role = 'konsumen'; draw(); };
    $('#t-mitra').onclick = () => { role = 'mitra'; draw(); };
    $('#switch').onclick = () => { reg = !reg; draw(); };
    $('#auth-form').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target), b = $('#submit'); b.disabled = true;
      try {
        if (reg) {
          const r = await Auth.register(role, f.get('name'), f.get('email'), f.get('pass'), f.get('kitchen') || '');
          if (r === 'konfirmasi') { reg = false; draw(); msg('Pendaftaran berhasil. Cek email untuk konfirmasi, lalu masuk.', true); b.disabled = false; return; }
          await Auth.init();
        } else await Auth.login(f.get('email'), f.get('pass'), role);
        location.href = home(role);
      } catch (x) { msg(x.message); b.disabled = false; }
    };
    draw();
  },

  // ---------- Mitra: kelola menu (CRUD) ----------
  async 'mitra-menu'() {
    const modal = $('#modal'), f = $('#form'); let editing = null, rows = [];
    const draw = () => { $('#list').innerHTML = rows.map((m) => `<article class="bg-surface-lowest rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="min-w-0"><div class="flex items-center gap-2 flex-wrap"><b>${esc(m.name)}</b>${pill(m.available ? 'Tersedia' : 'Habis', m.available ? 'bg-secondary-fixed text-on-secondary-fixed-variant' : 'bg-error-container text-on-error-container')}</div><p class="text-sm text-on-surface-variant">${esc(m.description)}</p><b class="text-primary-container">${rp(m.price)}</b></div>
      <div class="flex gap-2 shrink-0 text-xs font-bold"><button data-t="${m.id}" class="bg-surface-high px-3 py-2 rounded-lg">${m.available ? 'Tandai habis' : 'Tandai tersedia'}</button><button data-e="${m.id}" class="bg-surface-high px-3 py-2 rounded-lg">Edit</button><button data-x="${m.id}" class="bg-error-container text-on-error-container px-3 py-2 rounded-lg">Hapus</button></div></article>`).join('') || '<p class="text-sm text-on-surface-variant">Belum ada menu. Klik "Tambah menu".</p>'; };
    const load = async () => { try { rows = await DB.menus(Auth.user().kitchen.id); draw(); } catch (e) { fail('#list', e); } };
    const open = (m) => { editing = m; f.name.value = m?.name || ''; f.desc.value = m?.description || ''; f.price.value = m?.price || ''; f.on.checked = m ? m.available : true; $('#m-title').textContent = m ? 'Edit menu' : 'Tambah menu'; $('#err').textContent = ''; modal.classList.remove('hidden'); f.name.focus(); };
    $('#add').onclick = () => open(null);
    $$('[data-close]').forEach((b) => (b.onclick = () => modal.classList.add('hidden')));
    $('#list').onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      try {
        if (b.dataset.e) open(rows.find((m) => m.id === b.dataset.e));
        else if (b.dataset.t) { const m = rows.find((x) => x.id === b.dataset.t); await DB.saveMenu({ ...m, available: !m.available }); await load(); }
        else if (b.dataset.x && confirm('Hapus menu ini?')) { await DB.deleteMenu(b.dataset.x); await load(); toast('Menu dihapus'); }
      } catch (x) { toast(x.message); }
    };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const name = f.name.value.trim(), description = f.desc.value.trim(), price = Number(f.price.value);
      const err = !name || name.length > 60 ? 'Nama menu wajib diisi (maks. 60 karakter)' : description.length > 200 ? 'Deskripsi maks. 200 karakter' : !Number.isInteger(price) || price < 1000 || price > 500000 ? 'Harga harus bilangan bulat Rp1.000 - Rp500.000' : '';
      if (err) { $('#err').textContent = err; return; }
      try { await DB.saveMenu({ id: editing?.id, name, description, price, available: f.on.checked }); modal.classList.add('hidden'); await load(); toast('Menu disimpan'); } catch (x) { $('#err').textContent = x.message; }
    };
    load();
  },
};
if (Auth.guard(PAGE)) pages[PAGE]?.();
