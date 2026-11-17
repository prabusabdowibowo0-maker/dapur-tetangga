// Lapisan data: Supabase (Auth + Postgres) + keranjang di localStorage.
if (/GANTI-DENGAN/.test(SUPABASE_URL + SUPABASE_ANON_KEY)) alert('Isi js/config.js dengan Project URL dan publishable key Supabase Anda dulu.');
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

const Auth = {
  cur: null,
  user: () => Auth.cur,
  async init() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { Auth.cur = null; return; }
    const { data: p } = await sb.from('profiles').select('full_name, role').eq('id', session.user.id).maybeSingle();
    if (!p) { Auth.cur = null; return; }
    let kitchen = null;
    if (p.role === 'mitra') kitchen = (await sb.from('kitchens').select('id, name, is_verified, is_open, description, payment_info, category, distance_m, story, badges').eq('owner_id', session.user.id).maybeSingle()).data;
    const saved = localStorage.getItem('dt_mode');
    const mode = ['mitra', 'driver'].includes(p.role) && saved !== 'konsumen' ? p.role : 'konsumen';
    Auth.cur = { id: session.user.id, name: p.full_name, role: p.role, mode, kitchen };
  },
  async login(email, pass, role) {
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pass });
    if (error) throw new Error(/confirm/i.test(error.message) ? 'Email belum dikonfirmasi. Cek kotak masuk Anda.' : /invalid login credentials/i.test(error.message) ? 'Email atau kata sandi salah' : error.message);
    localStorage.setItem('dt_mode', role);
    await Auth.init();
    if (!Auth.cur || (role !== 'konsumen' && Auth.cur.role !== role)) {
      await sb.auth.signOut(); Auth.cur = null; localStorage.removeItem('dt_mode');
      throw new Error(role !== 'konsumen' ? 'Akun ini bukan akun ' + role : 'Profil akun tidak ditemukan');
    }
  },
  async register(role, name, email, pass, kitchen, vehicle = '') {
    name = name.trim(); email = email.trim();
    if (name.length < 2 || name.length > 60) throw new Error('Nama harus 2-60 karakter');
    if (pass.length < 8) throw new Error('Kata sandi minimal 8 karakter');
    if (role === 'mitra' && kitchen.trim().length < 2) throw new Error('Isi nama dapur');
    const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { full_name: name, role, kitchen_name: kitchen.trim(), vehicle } } });
    if (error) throw new Error(/registered/i.test(error.message) ? 'Email sudah terdaftar' : error.message);
    return data.session ? 'masuk' : 'konfirmasi';
  },
  async logout() { await sb.auth.signOut(); localStorage.removeItem('dt_cart'); localStorage.removeItem('dt_mode'); location.href = 'login.html'; },
  setMode(m) { localStorage.setItem('dt_mode', m); location.href = m === 'mitra' ? 'dashboard.html' : m === 'driver' ? 'driver.html' : 'index.html'; },
  guard(page) {
    const u = Auth.cur;
    if (['dashboard', 'mitra-menu'].includes(page) && u?.role !== 'mitra') { location.replace('login.html?role=mitra&next=' + page_file()); return false; }
    if (page === 'driver' && u?.role !== 'driver') { location.replace('login.html?role=driver&next=driver.html'); return false; }
    if (page === 'tracker' && !u) { location.replace('login.html?next=' + page_file()); return false; }
    return true;
  },
};
const page_file = () => location.pathname.split('/').pop() || 'index.html';

const DB = {
  kitchens: async () => ok(await sb.from('kitchens').select('id, name, cook_name, area, description, image_url, is_open, category, distance_m, badges, menus(name, price, available, image_url, kind)').eq('is_verified', true).order('created_at')),
  kitchen: async (id) => ok(await sb.from('kitchens').select('id, name, cook_name, area, description, payment_info, is_open, image_url, category, distance_m, story, badges').eq('id', id).maybeSingle()),
  menus: async (kid) => ok(await sb.from('menus').select('id, name, description, price, available, image_url, kind').eq('kitchen_id', kid).order('created_at')),
  menusByIds: async (ids) => ok(await sb.from('menus').select('id, name, price, kitchen_id, image_url, kind').in('id', ids).eq('available', true)),
  async saveMenu(m) {
    const row = { name: m.name, description: m.description, price: m.price, available: m.available, image_url: m.image_url ?? null, kind: m.kind || 'harian' };
    return ok(m.id ? await sb.from('menus').update(row).eq('id', m.id) : await sb.from('menus').insert({ ...row, kitchen_id: Auth.cur.kitchen.id }));
  },
  // Foto menu: dikecilkan di browser (maks. 900px, JPEG) lalu diunggah ke bucket 'menu-images/<id-dapur>/'.
  async uploadMenuImage(file) {
    const blob = await shrinkImage(file);
    const path = `${Auth.cur.kitchen.id}/${crypto.randomUUID()}.jpg`;
    ok(await sb.storage.from('menu-images').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }));
    return sb.storage.from('menu-images').getPublicUrl(path).data.publicUrl;
  },
  async removeImage(url) {
    const i = (url || '').indexOf('/menu-images/'); if (i < 0) return;
    try { await sb.storage.from('menu-images').remove([decodeURIComponent(url.slice(i + 13))]); } catch {}
  },
  deleteMenu: async (id) => ok(await sb.from('menus').delete().eq('id', id)),
  placeOrder: async (o) => ok(await sb.rpc('place_order', { p_kitchen: o.kitchen, p_items: o.items, p_method: o.method, p_fulfillment: o.fulfillment, p_address: o.address, p_note: o.note })),
  myOrders: async () => ok(await sb.from('orders').select('*, order_items(name, qty, price), kitchens(name), order_events(status, note, created_at)').eq('consumer_id', Auth.cur.id).order('created_at', { ascending: false })),
  kitchenOrders: async () => ok(await sb.from('orders').select('*, order_items(name, qty, price)').eq('kitchen_id', Auth.cur.kitchen.id).order('created_at', { ascending: false }).limit(100)),
  driverOrders: async () => ok(await sb.from('orders').select('*, order_items(name, qty, price), kitchens(name, area)').order('created_at', { ascending: false }).limit(100)),
  claim: async (id, eta) => ok(await sb.rpc('claim_order', { p_order: id, p_eta: eta })),
  deliver: async (id) => ok(await sb.rpc('complete_delivery', { p_order: id })),
  advance: async (id) => ok(await sb.rpc('advance_order', { p_order: id })),
  confirmPay: async (id) => ok(await sb.rpc('confirm_payment', { p_order: id })),
  cancel: async (id) => ok(await sb.rpc('cancel_order', { p_order: id })),
  saveKitchen: async (p) => ok(await sb.from('kitchens').update(p).eq('id', Auth.cur.kitchen.id)),
};

const shrinkImage = (file, max = 900) => new Promise((res, rej) => {
  if (!/^image\//.test(file.type)) return rej(new Error('File harus berupa gambar'));
  const img = new Image(), src = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(src);
    const r = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    c.toBlob((b) => (b ? res(b) : rej(new Error('Gagal memproses gambar'))), 'image/jpeg', 0.85);
  };
  img.onerror = () => { URL.revokeObjectURL(src); rej(new Error('Gambar tidak bisa dibaca. Coba format JPG atau PNG.')); };
  img.src = src;
});

const Cart = {
  get() { try { return JSON.parse(localStorage.getItem('dt_cart')) || { kitchen: null, items: [] }; } catch { return { kitchen: null, items: [] }; } },
  set: (c) => localStorage.setItem('dt_cart', JSON.stringify(c)),
  count: () => Cart.get().items.reduce((s, i) => s + i.qty, 0),
  clear: () => Cart.set({ kitchen: null, items: [] }),
  add(kitchen, id, qty) {
    let c = Cart.get();
    if (c.kitchen && c.kitchen !== kitchen) { if (!confirm('Keranjang berisi menu dari dapur lain. Kosongkan dulu?')) return false; c = { kitchen: null, items: [] }; }
    c.kitchen = kitchen;
    const i = c.items.find((x) => x.id === id);
    i ? (i.qty = Math.min(20, i.qty + qty)) : c.items.push({ id, qty });
    Cart.set(c); return true;
  },
  setQty(id, q) { const c = Cart.get(); c.items = c.items.map((i) => (i.id === id ? { ...i, qty: q } : i)).filter((i) => i.qty > 0); if (!c.items.length) c.kitchen = null; Cart.set(c); },
};
