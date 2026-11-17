// Logika per halaman, dipilih lewat <body data-page="...">.
const pill = (t, c) => `<span class="${c} text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap">${t}</span>`;
const fail = (sel, e) => { $(sel).innerHTML = `<p class="col-span-full text-sm text-error" role="alert">Gagal memuat data: ${esc(e.message)}</p>`; };
const ST = {
  MENUNGGU_KONFIRMASI: ['Menunggu Mitra', 'bg-amber-100 text-amber-800'],
  DISIAPKAN: ['Sedang Dimasak', 'bg-orange-100 text-orange-800'],
  MENUNGGU_DRIVER: ['Menunggu Kurir', 'bg-blue-100 text-blue-800'],
  SEDANG_DIANTAR: ['Sedang Diantar', 'bg-emerald-100 text-emerald-800'],
  SELESAI: ['Selesai Diterima', 'bg-stone-200 text-stone-700'],
  DIBATALKAN: ['Dibatalkan', 'bg-stone-200 text-stone-500'],
};
const METHOD = { qris: 'QRIS', transfer: 'Transfer', cod: 'Tunai' };
const itemsText = (o) => o.order_items.map((i) => `${i.qty}x ${i.name}`).join(', ');
const payPill = (o) => pill(o.payment_status === 'lunas' ? 'Lunas' : `Belum bayar (${METHOD[o.payment_method]})`, o.payment_status === 'lunas' ? 'bg-secondary text-on-secondary' : 'bg-surface-highest text-on-surface-variant');
const input = 'mt-1 w-full bg-surface-low rounded-lg px-3 py-2.5 font-normal outline-none focus:ring-2 focus:ring-primary-container';

const pages = {
  // ---------- Katalog ----------
  async katalog() {
    let all, cat = 'Semua';
    try { all = await DB.kitchens(); } catch (e) { return fail('#grid', e); }
    const CATS = ['Semua', 'Sunda', 'Padang', 'Jawa Timur', 'Sehat', 'Sarapan/Bekal', 'Lauk & Sambal'];
    const harian = (k) => k.menus.filter((m) => m.available && m.kind !== 'langganan').sort((a, b) => a.price - b.price);
    const minPrice = (k) => harian(k)[0]?.price ?? 1e9;
    const cover = (k) => k.image_url || k.menus.find((m) => m.available && m.image_url)?.image_url;
    const card = (k) => { const s = harian(k)[0], cv = cover(k), sub = k.menus.some((m) => m.available && m.kind === 'langganan'); return `
      <article class="card custom-shadow card-hover overflow-hidden flex flex-col">
        <div class="relative h-48 bg-surface-high flex items-center justify-center text-on-surface-variant">${ic('restaurant', '!text-5xl opacity-40')}
          ${cv?.startsWith('https://') ? `<img src="${esc(cv)}" alt="${esc(k.name)}" loading="lazy" onerror="this.remove()" class="absolute inset-0 w-full h-full object-cover">` : ''}
          <span class="absolute top-3 left-3 chip bg-black/60 text-white backdrop-blur">${esc(k.category ? 'Masakan ' + k.category + ' Rumahan' : 'Masakan Rumahan')}</span>
          <span class="absolute top-3 right-3 chip ${k.is_open ? 'bg-secondary-fixed text-on-secondary-fixed-variant' : 'bg-white/90 text-on-surface-variant'}">${k.is_open ? 'Buka' : 'Tutup'}</span></div>
        <div class="p-5 flex-1 flex flex-col gap-3">
          <div class="flex items-center justify-between gap-2 text-xs text-on-surface-variant"><span class="truncate">${esc(k.cook_name || '')}${k.area ? ' &bull; ' + esc(k.area) : ''}</span><b class="text-secondary flex items-center shrink-0">${ic('location_on', '!text-sm')}${k.distance_m} m</b></div>
          <h3 class="text-xl font-extrabold -mt-1">${esc(k.name)}</h3>
          <div class="border border-line rounded-xl bg-surface p-3"><p class="text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">Menu andalan rumah:</p>
            ${s ? `<div class="flex items-center justify-between gap-2 mt-0.5"><b class="text-sm">${esc(s.name)}</b><b class="text-primary-container text-sm shrink-0">${rp(s.price)}</b></div>` : '<p class="text-sm text-on-surface-variant mt-0.5">Belum ada menu harian</p>'}</div>
          <div class="flex flex-wrap gap-1.5">${(k.badges || []).map((b) => `<span class="chip bg-secondary-fixed text-on-secondary-fixed-variant border border-line">${esc(b)}</span>`).join('')}${sub ? '<span class="chip bg-primary-fixed text-primary-container border border-orange-200">Ada Opsi Langganan</span>' : ''}</div>
        </div>
        <div class="p-5 pt-0"><a href="menu.html?dapur=${esc(k.id)}" class="btn btn-ink w-full">Lihat Menu &amp; Pesan ${ic('chevron_right')}</a></div></article>`; };
    const draw = () => {
      const q = $('#q').value.toLowerCase().trim(), srt = $('#sort').value;
      $('#cats').innerHTML = CATS.map((c) => `<button data-c="${esc(c)}" role="tab" aria-selected="${c === cat}" class="px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${c === cat ? 'bg-primary-container text-white shadow' : 'bg-surface-low text-on-surface-variant hover:bg-surface-high'}">${esc(c)}</button>`).join('');
      const list = all.filter((k) => k.distance_m <= 800 && (cat === 'Semua' || k.category === cat) && [k.name, k.cook_name, k.area, k.category, k.description, ...k.menus.map((m) => m.name)].join(' ').toLowerCase().includes(q))
        .sort(srt === 'price' ? (a, b) => minPrice(a) - minPrice(b) : srt === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => a.distance_m - b.distance_m);
      $('#count').textContent = list.length;
      $('#grid').innerHTML = list.length ? list.map(card).join('') : '<p class="col-span-full text-center text-on-surface-variant py-10">Belum ada dapur yang cocok. Dapur baru tampil setelah diverifikasi pengurus RT.</p>';
    };
    $('#cats').onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) { cat = b.dataset.c; draw(); } };
    $('#q').oninput = draw; $('#sort').onchange = draw; draw();
  },

  // ---------- Menu satu dapur (detail dapur) ----------
  async menu() {
    const id = new URLSearchParams(location.search).get('dapur') || '';
    const gone = (m) => { $('#content').innerHTML = `<p class="text-center py-16 text-on-surface-variant">${m} <a class="text-primary font-semibold" href="index.html">Kembali ke katalog</a></p>`; };
    if (!UUID.test(id)) return gone('Dapur tidak ditemukan.');
    let k, items;
    try { [k, items] = await Promise.all([DB.kitchen(id), DB.menus(id)]); } catch (e) { return gone('Gagal memuat: ' + esc(e.message)); }
    if (!k) return gone('Dapur tidak ditemukan.');
    items = items.filter((m) => m.available);
    const cv = k.image_url || items.find((m) => m.image_url)?.image_url;
    $('#k-cover').innerHTML = cv?.startsWith('https://') ? `<img src="${esc(cv)}" alt="${esc(k.name)}" onerror="this.remove()" class="w-full h-full object-cover">` : '';
    $('#k-cat').textContent = k.category ? 'Masakan ' + k.category + ' Rumahan' : 'Masakan Rumahan';
    $('#k-rad').textContent = `Jarak ${k.distance_m} m`;
    $('#k-status').textContent = k.is_open ? 'Buka' : 'Tutup';
    $('#k-name').textContent = k.name;
    $('#k-meta').textContent = [k.cook_name, k.area].filter(Boolean).join(' • ');
    $('#k-desc').innerHTML = fmtDesc(k.story || k.description || 'Masakan rumahan hangat dari dapur tetangga Anda.');
    $('#k-badges').innerHTML = (k.badges || []).map((b) => `<span class="chip bg-secondary-fixed text-on-secondary-fixed-variant border border-line">${ic('verified_user', '!text-sm')}${esc(b)}</span>`).join('') || '<span class="text-sm text-on-surface-variant">Belum ada keterangan.</span>';
    const sel = {}; let tab = 'harian';
    const total = () => items.reduce((s, m) => s + m.price * (sel[m.id] || 0), 0);
    const draw = () => {
      const list = items.filter((m) => (m.kind || 'harian') === tab);
      $$('[data-tab]').forEach((b) => (b.className = `px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 ${b.dataset.tab === tab ? 'bg-primary-container text-white shadow' : 'text-on-surface-variant hover:text-on-surface'}`));
      $('#tab-hint').textContent = tab === 'harian' ? 'Dimasak hangat & diantar sekitar 20-30 menit.' : 'Lima kali makan, Senin-Jumat. Harga tertera adalah harga satu paket.';
      $('#items-title').textContent = tab === 'harian' ? 'Pilihan Menu Harian' : 'Paket Langganan Mingguan';
      $('#items').innerHTML = list.map((m) => `<div class="flex items-center gap-3 p-3 bg-surface rounded-xl border border-line">${thumb(m.image_url, 'w-20 h-20 rounded-lg')}<div class="min-w-0 flex-1"><b class="text-sm">${esc(m.name)}</b><div class="text-xs text-on-surface-variant desc">${fmtDesc(m.description)}</div><b class="text-sm text-primary-container">${rp(m.price)}</b>${tab === 'langganan' ? `<span class="text-xs text-on-surface-variant"> / 5 hari (${rp(Math.round(m.price / 5))} per porsi)</span>` : ''}</div>
        <div class="flex items-center gap-1 shrink-0"><button data-id="${m.id}" data-d="-1" aria-label="Kurangi ${esc(m.name)}" class="w-10 h-10 rounded-lg bg-white border border-line font-bold text-lg">-</button><span class="w-6 text-center font-bold">${sel[m.id] || 0}</span><button data-id="${m.id}" data-d="1" aria-label="Tambah ${esc(m.name)}" class="w-10 h-10 rounded-lg bg-white border border-line font-bold text-lg">+</button></div></div>`).join('')
        || `<p class="text-sm text-on-surface-variant py-6 text-center">${tab === 'harian' ? 'Belum ada menu harian tersedia.' : 'Dapur ini belum membuka paket langganan.'}</p>`;
      $('#total').textContent = rp(total());
    };
    const add = () => {
      if (Auth.user()?.mode !== 'konsumen' && Auth.user()) { toast('Pindah ke peran Konsumen untuk memesan'); return false; }
      if (Auth.user()?.kitchen?.id === k.id) { toast('Ini dapur Anda sendiri'); return false; }
      if (!k.is_open) { toast('Dapur sedang tutup'); return false; }
      const e = Object.entries(sel).filter(([, q]) => q > 0);
      if (!e.length) { toast('Pilih minimal satu menu'); return false; }
      for (const [mid, q] of e) if (!Cart.add(k.id, mid, q)) return false;
      for (const x in sel) delete sel[x];
      const b = $('#cart-badge'); if (b) b.textContent = Cart.count();
      draw(); return true;
    };
    $$('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
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
    const calc = () => { const L = lines(), sub = L.reduce((s, l) => s + l.price * l.qty, 0), fee = val('ful') === 'antar' && L.length ? (L.some((l) => l.kind === 'langganan') ? 15000 : FEE) : 0; return { L, sub, fee, total: sub + fee }; };
    const draw = () => {
      const { L, sub, fee, total } = calc();
      $('#empty').classList.toggle('hidden', !!L.length); $('#cart-grid').classList.toggle('hidden', !L.length);
      $('#lines').innerHTML = L.map((l) => `<div class="flex items-center justify-between gap-3 py-2"><div class="flex items-center gap-3 min-w-0">${thumb(l.image_url, 'w-12 h-12 rounded-lg')}<div class="min-w-0"><b class="text-sm">${esc(l.name)}</b><p class="text-xs text-on-surface-variant">${rp(l.price)}</p></div></div>
        <div class="flex items-center gap-1 shrink-0"><button data-id="${l.id}" data-q="${l.qty - 1}" aria-label="Kurangi" class="w-10 h-10 rounded-lg bg-surface-low font-bold text-lg">-</button><span class="w-6 text-center font-bold">${l.qty}</span><button data-id="${l.id}" data-q="${l.qty + 1}" aria-label="Tambah" class="w-10 h-10 rounded-lg bg-surface-low font-bold text-lg">+</button><button data-id="${l.id}" data-q="0" aria-label="Hapus" class="ml-1 text-error">${ic('delete')}</button></div></div>`).join('');
      $('#addr').classList.toggle('hidden', val('ful') === 'ambil');
      $('#sum').innerHTML = `<div class="flex justify-between"><span>Subtotal</span><span>${rp(sub)}</span></div><div class="flex justify-between"><span>Ongkir</span><span>${fee ? rp(fee) : 'Gratis'}</span></div><div class="flex justify-between text-xs text-on-surface-variant"><span>Komisi platform 10% (dipotong dari mitra)</span><span>${rp(Math.round(sub * 0.1))}</span></div><div class="flex justify-between text-lg font-bold pt-2"><span>Total</span><span class="text-primary-container">${rp(total)}</span></div>`;
      const b = $('#cart-badge'); if (b) b.textContent = Cart.count();
    };
    $('#lines').onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) { Cart.setQty(b.dataset.id, Math.min(20, +b.dataset.q)); draw(); } };
    $$('input[name=ful]').forEach((r) => (r.onchange = draw));
    $('#pay-btn').onclick = async () => {
      const u = Auth.user();
      if (!u) { toast('Masuk dulu untuk memesan'); setTimeout(() => (location.href = 'login.html?next=cart.html'), 900); return; }
      if (u.mode === 'mitra') { toast('Pindah ke mode konsumen untuk memesan'); return; }
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

  // ---------- Pesanan saya (live tracker) ----------
  async tracker() {
    const STEPS = [['MENUNGGU_KONFIRMASI', 'Menunggu Mitra', 'hourglass_top'], ['DISIAPKAN', 'Sedang Dimasak', 'skillet'], ['MENUNGGU_DRIVER', 'Menunggu Kurir', 'two_wheeler'], ['SEDANG_DIANTAR', 'Sedang Diantar', 'local_shipping'], ['SELESAI', 'Selesai Diterima', 'task_alt']];
    const stepper = (o) => { const cur = STEPS.findIndex((x) => x[0] === o.status); if (cur < 0) return '';
      return `<ol class="flex items-start mt-1">${STEPS.map(([, l, i], n) => `<li class="flex-1 flex flex-col items-center text-center relative">${n ? `<span class="absolute top-[18px] right-1/2 w-full h-0.5 ${n <= cur ? 'bg-secondary' : 'bg-surface-highest'}"></span>` : ''}
        <span class="relative z-10 w-9 h-9 rounded-full flex items-center justify-center ${n <= cur ? 'bg-secondary text-white' : 'bg-surface-high text-on-surface-variant'} ${n === cur && cur < 4 ? 'ring-4 ring-secondary-fixed animate-pulse' : ''}">${ic(n < cur ? 'check' : i, '!text-lg')}</span>
        <span class="text-[10px] sm:text-xs font-bold mt-1 ${n <= cur ? 'text-on-surface' : 'text-on-surface-variant'}">${l}</span></li>`).join('')}</ol>`; };
    const eta = (o) => { if (o.status !== 'SEDANG_DIANTAR' || !o.eta_minutes) return '';
      const ev = (o.order_events || []).find((e) => e.status === 'SEDANG_DIANTAR'), t0 = ev ? new Date(ev.created_at).getTime() : Date.now(), left = Math.ceil((t0 + o.eta_minutes * 60000 - Date.now()) / 60000);
      return `<div class="bg-secondary-fixed text-on-secondary-fixed-variant rounded-xl p-3 text-sm flex items-center gap-3">${ic('two_wheeler', '!text-3xl')}<div><b>${esc(o.driver_name || 'Kurir')}</b> (${esc(o.driver_vehicle || 'kurir')}) sedang mengantar pesanan Anda.<br><b>Estimasi tiba ${left > 0 ? '±' + left + ' menit lagi' : 'sebentar lagi'}</b></div></div>`; };
    const hist = (o) => { const ev = [...(o.order_events || [])].sort((a, b) => (a.created_at < b.created_at ? -1 : 1)); return ev.length ? `<details class="text-xs"><summary class="cursor-pointer font-bold text-primary-container">Riwayat status</summary><ul class="mt-2 space-y-1">${ev.map((e) => `<li><span class="font-mono text-on-surface-variant">${new Date(e.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span> ${esc(e.note)}</li>`).join('')}</ul></details>` : ''; };
    const card = (o) => { const [l, c] = ST[o.status]; return `<article class="card p-5 flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2"><b class="text-sm font-mono text-primary-container">${esc(o.code)}</b><b class="font-heading text-lg">${esc(o.kitchens?.name || '')}</b>${pill(l, c)}${payPill(o)}${o.mode === 'langganan' ? pill('Langganan', 'bg-primary-fixed text-primary-container') : ''}</div>
      <p class="text-sm">${esc(itemsText(o))}</p>
      ${stepper(o)}${eta(o)}
      <div class="flex items-center justify-between text-xs text-on-surface-variant"><span>${new Date(o.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })} &bull; ${o.fulfillment === 'antar' ? 'Diantar ke ' + esc(o.address) : 'Ambil sendiri'}</span><b class="text-lg text-on-surface font-heading">${rp(o.total)}</b></div>
      ${hist(o)}
      ${o.status === 'MENUNGGU_KONFIRMASI' && o.payment_status === 'belum' ? `<button data-c="${o.id}" class="self-start text-xs font-bold text-error">Batalkan pesanan</button>` : ''}</article>`; };
    const load = async () => { try { const L = await DB.myOrders(); $('#orders').innerHTML = L.map(card).join('') || '<p class="text-center py-10 text-on-surface-variant">Belum ada pesanan. <a href="index.html" class="text-primary font-semibold">Pilih dapur</a></p>'; } catch (e) { fail('#orders', e); } };
    $('#orders').onclick = async (e) => { const b = e.target.closest('[data-c]'); if (b && confirm('Batalkan pesanan ini?')) { try { await DB.cancel(b.dataset.c); toast('Pesanan dibatalkan'); } catch (x) { toast(x.message); } load(); } };
    load(); setInterval(load, 10000);
  },

  // ---------- Driver: ambil & antar pesanan ----------
  async driver() {
    const me = Auth.user().id;
    const row = (o, mine) => `<div class="bg-surface rounded-xl border border-line p-4 flex flex-col gap-2">
      <div class="flex flex-wrap items-center gap-2"><b class="text-xs font-mono text-primary-container">${esc(o.code)}</b><b>${esc(o.kitchens?.name || '')}</b>${o.mode === 'langganan' ? pill('Langganan', 'bg-primary-fixed text-primary-container') : ''}</div>
      <p class="text-sm">${esc(itemsText(o))}</p>
      <p class="text-xs text-on-surface-variant flex items-start gap-1">${ic('location_on', '!text-sm')}<span>Jemput di ${esc(o.kitchens?.area || 'dapur mitra')} &rarr; antar ke <b>${esc(o.address || '-')}</b> (${esc(o.consumer_name)})</span></p>
      ${o.payment_method === 'cod' && o.payment_status === 'belum' ? `<p class="text-xs font-bold text-tertiary">${ic('payments', '!text-sm')} Tagih tunai ${rp(o.total)}</p>` : ''}
      <div class="flex items-center justify-between gap-2 pt-1"><span class="text-xs text-on-surface-variant">Ongkir <b class="text-on-surface">${rp(o.delivery_fee)}</b></span>
        ${mine ? `<button data-done="${o.id}" class="btn btn-primary !min-h-10">${ic('task_alt')}Tandai sampai</button>`
          : `<div class="flex items-center gap-2"><select data-eta="${o.id}" aria-label="Estimasi tiba" class="bg-white border border-line rounded-lg px-2 py-2 text-xs font-bold">${[5, 10, 15, 20, 30].map((m) => `<option value="${m}" ${m === 10 ? 'selected' : ''}>±${m} menit</option>`).join('')}</select><button data-claim="${o.id}" class="btn btn-primary !min-h-10">Ambil</button></div>`}</div></div>`;
    const load = async () => {
      let L; try { L = await DB.driverOrders(); } catch (e) { return fail('#avail', e); }
      const avail = L.filter((o) => o.status === 'MENUNGGU_DRIVER'), mine = L.filter((o) => o.driver_id === me && o.status === 'SEDANG_DIANTAR');
      const done = L.filter((o) => o.driver_id === me && o.status === 'SELESAI' && new Date(o.created_at).toDateString() === new Date().toDateString());
      $('#kpis').innerHTML = [['Tugas tersedia', avail.length], ['Sedang saya antar', mine.length], ['Selesai hari ini', done.length], ['Ongkir hari ini', rp(done.reduce((t, o) => t + o.delivery_fee, 0))]]
        .map(([l, v]) => `<div class="card p-4"><span class="text-xs font-semibold text-on-surface-variant">${l}</span><div class="text-2xl font-extrabold font-heading mt-1">${v}</div></div>`).join('');
      $('#avail').innerHTML = avail.map((o) => row(o, false)).join('') || '<p class="text-sm text-on-surface-variant text-center py-6">Belum ada pesanan yang siap dijemput.</p>';
      $('#mine').innerHTML = mine.map((o) => row(o, true)).join('') || '<p class="text-sm text-on-surface-variant text-center py-6">Tidak ada pesanan yang sedang Anda antar.</p>';
    };
    $('#kpis').parentElement.onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      try {
        if (b.dataset.claim) { await DB.claim(b.dataset.claim, +$(`[data-eta="${b.dataset.claim}"]`).value); toast('Pesanan diambil. Segera antar ya!'); }
        else if (b.dataset.done) { await DB.deliver(b.dataset.done); toast('Pesanan selesai diantar'); }
        else return;
      } catch (x) { toast(x.message); }
      load();
    };
    load(); setInterval(load, 10000);
  },

  // ---------- Dashboard mitra ----------
  async dashboard() {
    const K = Auth.user().kitchen;
    if (!K) { $('#orders').innerHTML = '<p class="text-error">Data dapur tidak ditemukan. Hubungi admin.</p>'; return; }
    $('#banner').classList.toggle('hidden', K.is_verified);
    $('#k-name').textContent = K.name;
    const f = $('#settings'); let open = K.is_open;
    f.desc.value = K.description || ''; f.pinfo.value = K.payment_info || ''; f.category.value = K.category || ''; f.distance.value = K.distance_m ?? 300; f.story.value = K.story || ''; f.badges.value = (K.badges || []).join(', ');
    const drawToggle = () => { $('#toggle').className = `btn ${open ? 'bg-secondary text-on-secondary' : 'bg-error text-on-error'}`; $('#toggle').innerHTML = `${ic(open ? 'check_circle' : 'do_not_disturb_on')}<span>${open ? 'Dapur buka' : 'Dapur tutup'}</span><span class="font-normal opacity-80 hidden sm:inline">&middot; ketuk untuk ${open ? 'tutup' : 'buka'}</span>`; };
    $('#toggle').onclick = async () => { try { await DB.saveKitchen({ is_open: !open }); open = !open; drawToggle(); toast(open ? 'Dapur dibuka' : 'Dapur ditutup'); } catch (e) { toast(e.message); } };
    f.onsubmit = async (e) => { e.preventDefault(); try { const dist = Math.round(Number(f.distance.value)); if (!(dist >= 0 && dist <= 800)) throw new Error('Jarak harus 0-800 meter');
      await DB.saveKitchen({ description: f.desc.value.trim().slice(0, 300), payment_info: f.pinfo.value.trim().slice(0, 300), category: f.category.value || null, distance_m: dist, story: f.story.value.trim().slice(0, 300) || null, badges: f.badges.value.split(',').map((x) => x.trim().slice(0, 30)).filter(Boolean).slice(0, 4) }); toast('Pengaturan disimpan'); } catch (x) { toast(x.message); } };
    drawToggle();

    const NEXT = (o) => ({ MENUNGGU_KONFIRMASI: 'Terima pesanan', DISIAPKAN: o.fulfillment === 'ambil' ? 'Selesai (diambil)' : 'Siap dijemput kurir' }[o.status]);
    const load = async () => {
      let L; try { L = await DB.kitchenOrders(); } catch (e) { return fail('#orders', e); }
      const today = new Date().toDateString(), paidToday = L.filter((o) => o.payment_status === 'lunas' && o.status !== 'DIBATALKAN' && new Date(o.created_at).toDateString() === today);
      const sum = (a, k) => a.reduce((s, o) => s + o[k], 0);
      $('#kpis').innerHTML = [['Omzet lunas hari ini', rp(sum(paidToday, 'total'))], ['Komisi platform (10%)', rp(sum(paidToday, 'commission'))],
        ['Pesanan aktif', L.filter((o) => ['MENUNGGU_KONFIRMASI', 'DISIAPKAN', 'MENUNGGU_DRIVER', 'SEDANG_DIANTAR'].includes(o.status)).length], ['Perlu konfirmasi bayar', L.filter((o) => o.payment_status === 'belum' && o.status !== 'DIBATALKAN').length]]
        .map(([l, v]) => `<div class="bg-surface-lowest p-4 rounded-xl shadow-sm"><span class="text-xs font-semibold text-on-surface-variant">${l}</span><div class="text-xl font-extrabold mt-1">${v}</div></div>`).join('');
      $('#orders').innerHTML = L.map((o) => { const [l, c] = ST[o.status], nx = NEXT(o); return `<div class="bg-surface-low rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><b class="text-xs font-mono text-primary-container">${esc(o.code)}</b><b>${esc(o.consumer_name)}</b>${pill(l, c)}${payPill(o)}</div>
          <p class="text-sm">${esc(itemsText(o))} &bull; ${rp(o.total)}</p><p class="text-xs text-on-surface-variant">${o.fulfillment === 'antar' ? 'Antar: ' + esc(o.address) : 'Diambil sendiri'}${o.driver_name ? ' &bull; Kurir: ' + esc(o.driver_name) : ''}${o.note ? ' &bull; Catatan: ' + esc(o.note) : ''}</p></div>
        <div class="flex gap-2 shrink-0 text-xs font-bold">${o.payment_status === 'belum' && o.status !== 'DIBATALKAN' ? `<button data-pay="${o.id}" class="bg-secondary-fixed text-on-secondary-fixed-variant px-3 py-2 rounded-lg">Tandai lunas</button>` : ''}${nx ? `<button data-adv="${o.id}" class="bg-primary-container text-on-primary px-3 py-2 rounded-lg">${nx}</button>` : ''}</div></div>`; }).join('') || `<div class="text-center py-8 text-on-surface-variant">${ic('inbox', '!text-5xl opacity-40')}<p class="font-semibold mt-2">Belum ada pesanan masuk</p><p class="text-xs">Pastikan dapur berstatus buka dan menu sudah tersedia.</p></div>`;
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
    const q = new URLSearchParams(location.search), RS = ['konsumen', 'mitra', 'driver'];
    let role = ['mitra', 'driver'].includes(q.get('role')) ? q.get('role') : 'konsumen', reg = false;
    const next = /^[a-z-]+\.html$/.test(q.get('next') || '') ? q.get('next') : null;
    const home = (r) => (r === 'mitra' ? (next === 'menu-mitra.html' ? next : 'dashboard.html') : r === 'driver' ? 'driver.html' : next && !['dashboard.html', 'menu-mitra.html', 'driver.html'].includes(next) ? next : 'index.html');
    if (Auth.user()) { location.replace(home(Auth.user().mode)); return; }
    const LBL = { konsumen: 'konsumen', mitra: 'mitra dapur', driver: 'driver pengantar' };
    const HINT = { konsumen: 'Daftar gratis untuk memesan. Akun mitra juga bisa masuk di sini untuk memesan dari dapur lain.', mitra: 'Dapur baru tampil di katalog setelah diverifikasi pengurus RT/admin.', driver: 'Driver mengambil pesanan yang siap dijemput dan mengantarnya ke warga dalam radius 800 m.' };
    const msg = (t, good) => { $('#err').textContent = t; $('#err').className = `text-sm min-h-5 ${good ? 'text-secondary' : 'text-error'}`; };
    const on = 'bg-primary-container text-on-primary shadow-sm', off = 'text-on-surface-variant';
    const draw = () => {
      RS.forEach((r) => ($('#t-' + r).className = `flex-1 py-2 rounded-lg text-sm font-bold ${role === r ? on : off}`));
      $('#f-name').classList.toggle('hidden', !reg); $('#f-kitchen').classList.toggle('hidden', !(reg && role === 'mitra')); $('#f-vehicle').classList.toggle('hidden', !(reg && role === 'driver'));
      $('#switch').textContent = reg ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar';
      $('#title').textContent = (reg ? 'Daftar sebagai ' : 'Masuk sebagai ') + LBL[role];
      $('#submit').textContent = reg ? 'Daftar' : 'Masuk'; $('#hint').textContent = HINT[role]; msg('');
    };
    RS.forEach((r) => ($('#t-' + r).onclick = () => { role = r; draw(); }));
    $('#switch').onclick = () => { reg = !reg; draw(); };
    $('#auth-form').onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target), b = $('#submit'); b.disabled = true;
      try {
        if (reg) {
          const r = await Auth.register(role, f.get('name'), f.get('email'), f.get('pass'), f.get('kitchen') || '', f.get('vehicle') || '');
          if (r === 'konfirmasi') { reg = false; draw(); msg('Pendaftaran berhasil. Cek email untuk konfirmasi, lalu masuk.', true); b.disabled = false; return; }
          localStorage.setItem('dt_mode', role); await Auth.init();
        } else await Auth.login(f.get('email'), f.get('pass'), role);
        location.href = home(role);
      } catch (x) { msg(x.message); b.disabled = false; }
    };
    draw();
  },

  // ---------- Mitra: kelola menu (CRUD + foto) ----------
  async 'mitra-menu'() {
    const modal = $('#modal'), f = $('#form'); let editing = null, rows = [], pic = {}, avail = true;
    const toggleBtn = (m) => `<button data-t="${m.id}" role="switch" aria-checked="${m.available}" class="switch" aria-label="Ketersediaan ${esc(m.name)}"></button>`;
    const draw = () => {
      $('#list').innerHTML = rows.map((m) => `<article class="card card-hover overflow-hidden flex flex-col ${m.available ? '' : 'opacity-75'}">
        <div class="relative">${thumb(m.image_url, 'w-full aspect-[4/3]')}<span class="absolute top-3 left-3">${pill(m.available ? 'Tersedia' : 'Habis', m.available ? 'bg-secondary-fixed text-on-secondary-fixed-variant' : 'bg-error-container text-on-error-container')}</span></div>
        <div class="p-4 flex-1 flex flex-col gap-1"><div class="flex items-start gap-2 flex-wrap"><b class="text-lg leading-tight">${esc(m.name)}</b>${m.kind === 'langganan' ? pill('Paket mingguan', 'bg-primary-fixed text-primary-container') : ''}</div><div class="text-sm text-on-surface-variant desc">${fmtDesc(m.description) || '<p class="italic">Belum ada deskripsi</p>'}</div><b class="text-xl text-primary-container mt-auto pt-2">${rp(m.price)}</b></div>
        <div class="px-4 py-3 border-t border-surface-high flex items-center gap-2"><label class="flex items-center gap-2 text-xs font-bold mr-auto">${toggleBtn(m)}<span>${m.available ? 'Tersedia' : 'Habis'}</span></label>
          <button data-e="${m.id}" class="btn btn-soft !px-3" aria-label="Edit ${esc(m.name)}">${ic('edit')}Edit</button><button data-x="${m.id}" class="btn btn-danger !px-3" aria-label="Hapus ${esc(m.name)}">${ic('delete')}</button></div></article>`).join('')
        || `<div class="col-span-full card p-10 text-center text-on-surface-variant">${ic('restaurant_menu', '!text-5xl opacity-40')}<p class="font-bold text-on-surface mt-2">Belum ada menu</p><p class="text-sm mb-4">Tambahkan menu pertama Anda lengkap dengan foto agar pembeli tertarik.</p><button data-add class="btn btn-primary">${ic('add')}Tambah menu pertama</button></div>`;
    };
    const load = async () => { try { rows = await DB.menus(Auth.user().kitchen.id); draw(); } catch (e) { fail('#list', e); } };

    // --- foto ---
    const drawPic = () => {
      const src = pic.prev || pic.url;
      $('#preview').src = src || ''; $('#preview').classList.toggle('hidden', !src);
      $('#drop-hint').classList.toggle('hidden', !!src); $('#drop-change').classList.toggle('hidden', !src); $('#img-del').classList.toggle('hidden', !src);
    };
    const setFile = (file) => {
      if (!file) return;
      if (!/^image\//.test(file.type)) { $('#err').textContent = 'File harus berupa gambar (JPG / PNG)'; return; }
      if (file.size > 15e6) { $('#err').textContent = 'Foto terlalu besar (maks. 15 MB)'; return; }
      if (pic.prev) URL.revokeObjectURL(pic.prev);
      pic = { ...pic, file, prev: URL.createObjectURL(file) }; $('#err').textContent = ''; drawPic();
    };
    const clearPic = () => { if (pic.prev) URL.revokeObjectURL(pic.prev); pic = {}; $('#file').value = ''; drawPic(); };
    $('#drop').onclick = () => $('#file').click();
    $('#drop').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#file').click(); } };
    $('#file').onchange = (e) => setFile(e.target.files[0]);
    $('#img-del').onclick = clearPic;
    ['dragover', 'dragenter'].forEach((t) => ($('#drop').addEventListener(t, (e) => { e.preventDefault(); $('#drop').classList.add('over'); })));
    ['dragleave', 'drop'].forEach((t) => ($('#drop').addEventListener(t, (e) => { e.preventDefault(); $('#drop').classList.remove('over'); })));
    $('#drop').addEventListener('drop', (e) => setFile(e.dataTransfer.files[0]));

    // --- deskripsi list ---
    const drawDesc = () => { const v = f.desc.value; $('#desc-count').textContent = `${v.length}/300`; $('#desc-prev').innerHTML = fmtDesc(v); $('#desc-prev-wrap').classList.toggle('hidden', !v.trim()); };
    f.desc.oninput = drawDesc;
    f.desc.onkeydown = (e) => { // Enter di baris poin -> otomatis poin baru; Enter di poin kosong -> keluar dari list
      if (e.key !== 'Enter') return;
      const t = f.desc, s = t.selectionStart, ls = t.value.lastIndexOf('\n', s - 1) + 1, line = t.value.slice(ls, s), m = line.match(/^\s*[-*\u2022]\s/);
      if (!m) return;
      e.preventDefault();
      if (!line.slice(m[0].length).trim()) t.setRangeText('', ls, s, 'end'); else t.setRangeText('\n- ', s, s, 'end');
      drawDesc();
    };
    $('#bullet').onclick = () => {
      const t = f.desc, s = t.selectionStart, ls = t.value.lastIndexOf('\n', s - 1) + 1;
      if (!/^\s*[-*\u2022]\s/.test(t.value.slice(ls))) t.setRangeText('- ', ls, ls, 'preserve');
      t.focus(); drawDesc();
    };

    // --- ketersediaan (switch di dalam form) ---
    const drawOn = () => { $('#on').setAttribute('aria-checked', avail); $('#on-hint').textContent = avail ? 'Pembeli bisa memesan menu ini' : 'Ditandai habis, tidak bisa dipesan'; };
    $('#on').onclick = () => { avail = !avail; drawOn(); };

    const close = () => { modal.classList.add('hidden'); clearPic(); };
    const open = (m) => {
      editing = m; f.name.value = m?.name || ''; f.desc.value = m?.description || ''; f.price.value = m?.price || ''; f.kind.value = m?.kind || 'harian'; avail = m ? m.available : true;
      pic = m?.image_url ? { url: m.image_url } : {}; $('#file').value = ''; $('#m-title').textContent = m ? 'Edit menu' : 'Tambah menu'; $('#err').textContent = '';
      drawPic(); drawDesc(); drawOn(); modal.classList.remove('hidden'); f.name.focus();
    };
    $('#add').onclick = () => open(null);
    $$('[data-close]').forEach((b) => (b.onclick = close));
    modal.onclick = (e) => { if (e.target === modal) close(); };
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });

    $('#list').onclick = async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      try {
        if (b.dataset.add !== undefined) open(null);
        else if (b.dataset.e) open(rows.find((m) => m.id === b.dataset.e));
        else if (b.dataset.t) { // switch: berubah langsung, dikembalikan bila gagal
          const m = rows.find((x) => x.id === b.dataset.t); m.available = !m.available; draw();
          try { await DB.saveMenu(m); toast(m.available ? 'Menu ditandai tersedia' : 'Menu ditandai habis'); } catch (x) { m.available = !m.available; draw(); throw x; }
        } else if (b.dataset.x) {
          const m = rows.find((x) => x.id === b.dataset.x);
          if (confirm(`Hapus menu "${m.name}"? Foto menu juga ikut terhapus.`)) { await DB.deleteMenu(m.id); DB.removeImage(m.image_url); await load(); toast('Menu dihapus'); }
        }
      } catch (x) { toast(x.message); }
    };

    f.onsubmit = async (e) => {
      e.preventDefault();
      const name = f.name.value.trim(), description = f.desc.value.trim(), price = Number(f.price.value);
      const err = !name || name.length > 60 ? 'Nama menu wajib diisi (maks. 60 karakter)' : description.length > 300 ? 'Deskripsi maks. 300 karakter' : !Number.isInteger(price) || price < 1000 || price > 500000 ? 'Harga harus bilangan bulat Rp1.000 - Rp500.000' : '';
      if (err) { $('#err').textContent = err; return; }
      const btn = $('#save'), old = editing?.image_url || null; let url = pic.url || null, uploaded = null;
      btn.disabled = true; btn.textContent = pic.file ? 'Mengunggah foto...' : 'Menyimpan...';
      try {
        if (pic.file) url = uploaded = await DB.uploadMenuImage(pic.file);
        await DB.saveMenu({ id: editing?.id, name, description, price, available: avail, image_url: url, kind: f.kind.value });
        if (old && old !== url) DB.removeImage(old);
        close(); await load(); toast('Menu disimpan');
      } catch (x) { if (uploaded) DB.removeImage(uploaded); $('#err').textContent = x.message; }
      btn.disabled = false; btn.textContent = 'Simpan';
    };
    load();
  },
};
if (Auth.guard(PAGE)) pages[PAGE]?.();
