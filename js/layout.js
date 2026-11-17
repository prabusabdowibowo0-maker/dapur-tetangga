// Helper UI + header/footer bersama.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ic = (n, c = '') => `<span class="material-symbols-outlined ${c}">${n}</span>`;
const rp = (n) => 'Rp' + Number(n).toLocaleString('id-ID');
function toast(msg) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status');
    t.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-inverse-surface text-inverse-on-surface text-sm font-semibold px-4 py-2.5 rounded-lg shadow-lg transition-opacity opacity-0';
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.opacity = 1;
  clearTimeout(t._h); t._h = setTimeout(() => (t.style.opacity = 0), 3000);
}

// Teks deskripsi -> HTML: baris diawali "-", "*", "•" atau "1." jadi list; baris lain jadi paragraf.
const fmtDesc = (t) => {
  let out = '', li = [];
  const flush = () => { if (li.length) out += `<ul class="desc-list">${li.join('')}</ul>`; li = []; };
  for (const l of String(t ?? '').split('\n').map((x) => x.trim()).filter(Boolean)) {
    const m = l.match(/^(?:[-*\u2022]|\d+[.)])\s+(.*)$/);
    if (m) li.push(`<li>${esc(m[1])}</li>`); else { flush(); out += `<p>${esc(l)}</p>`; }
  }
  flush(); return out;
};
const thumb = (url, cls = 'w-20 h-20 rounded-lg') => `<div class="${cls} shrink-0 bg-surface-high overflow-hidden flex items-center justify-center text-on-surface-variant">${url?.startsWith('https://') ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()" class="w-full h-full object-cover">` : ic('restaurant', 'opacity-40')}</div>`;

const PAGE = document.body.dataset.page;
const U = Auth.user();
const ROLES = [['konsumen', '1. Konsumen (Pembeli)', 'person'], ['mitra', '2. Mitra (Penjual)', 'skillet'], ['driver', '3. Driver (Pengantar)', 'two_wheeler']];
const curRole = U ? U.mode : (PAGE === 'login' && ['mitra', 'driver'].includes(new URLSearchParams(location.search).get('role')) ? new URLSearchParams(location.search).get('role') : 'konsumen');
const NAV = {
  mitra: [['dashboard', 'dashboard.html', 'soup_kitchen', 'Dashboard Mitra'], ['mitra-menu', 'menu-mitra.html', 'edit_note', 'Kelola Menu']],
  driver: [['driver', 'driver.html', 'two_wheeler', 'Antaran Saya']],
}[U?.mode] || [['katalog', 'index.html', 'storefront', 'Katalog Dapur'], ['tracker', 'tracker.html', 'receipt_long', 'Pesanan Saya (Live Tracker)']];
const cartBtn = () => U?.mode === 'konsumen' || !U ? `<a href="cart.html" class="relative bg-primary-container hover:bg-primary text-on-primary px-4 py-2.5 rounded-xl font-semibold text-sm shadow-md flex items-center gap-2">${ic('shopping_bag', '!text-base')}<span class="hidden sm:inline">Keranjang</span><span id="cart-badge" class="min-w-5 h-5 px-1 rounded-full bg-white text-primary-container font-extrabold text-[11px] flex items-center justify-center">${Cart.count()}</span></a>` : '';
const userArea = () => U
  ? `<div class="flex items-center gap-2">${cartBtn()}<span class="hidden md:inline text-sm text-on-surface-variant font-semibold">${esc(U.name)}</span><button id="logout" class="bg-white border border-line hover:bg-surface px-3.5 py-2.5 rounded-xl text-sm font-semibold">Keluar</button></div>`
  : `<div class="flex items-center gap-2">${cartBtn()}<a href="login.html" class="bg-ink text-white px-4 py-2.5 rounded-xl text-sm font-semibold">Masuk</a></div>`;

$('#site-header').innerHTML = `
<div class="bg-ink text-white border-b border-stone-800">
  <div class="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-center md:justify-between gap-2 text-xs">
    <div class="hidden md:flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><b class="uppercase tracking-wide text-stone-300 text-[11px]">Terhubung real-time</b><span class="bg-stone-800 text-stone-200 px-2.5 py-0.5 rounded-full font-mono text-[11px]">Radius maks. 800 m</span></div>
    <div class="flex items-center bg-stone-800 p-1 rounded-xl border border-stone-700 overflow-x-auto" role="tablist" aria-label="Pilih peran">
      ${ROLES.map(([r, l, i]) => `<button data-role="${r}" role="tab" aria-selected="${r === curRole}" class="px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 whitespace-nowrap ${r === curRole ? 'bg-primary-container text-white shadow' : 'text-stone-300 hover:text-white'}">${ic(i, '!text-base')}${l}</button>`).join('')}
    </div>
  </div>
</div>
<header class="bg-white border-b border-line shadow-sm">
  <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
    <a href="index.html" class="flex items-center gap-3 min-w-0"><div class="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shadow-md shrink-0">${ic('skillet', '!text-2xl')}</div>
      <div class="min-w-0"><div class="flex items-center gap-2"><span class="font-heading font-extrabold text-xl tracking-tight">Dapur Tetangga</span><span class="chip hidden sm:inline-flex bg-secondary-fixed text-secondary border border-line">Radius 1 Kompleks</span></div>
        <p class="text-xs text-on-surface-variant hidden sm:block truncate">Makanan Rumahan Hangat dari Dapur Tetangga untuk Warga Sekitar</p></div></a>
    ${userArea()}
  </div>
  <nav class="max-w-7xl mx-auto px-4 flex gap-6 overflow-x-auto" aria-label="Menu utama">
    ${NAV.map(([k, h, i, l]) => `<a href="${h}" class="inline-flex items-center gap-1.5 py-3 text-sm border-b-2 shrink-0 ${k === PAGE || (k === 'katalog' && PAGE === 'menu') ? 'text-primary-container border-primary-container font-bold' : 'text-on-surface-variant border-transparent font-semibold hover:text-on-surface'}">${ic(i)}${l}</a>`).join('')}
  </nav>
</header>`;
$('#site-footer').innerHTML = `<footer class="bg-surface-low mt-10 py-6 text-center text-xs text-on-surface-variant">&copy; ${new Date().getFullYear()} Dapur Tetangga &bull; Cita Rasa Rumahan dalam Radius 1 Kompleks RT/RW.</footer>`;
$('#logout')?.addEventListener('click', Auth.logout);
$$('[data-role]').forEach((b) => (b.onclick = () => {
  const r = b.dataset.role;
  if (r === curRole) return;
  if (!U) return (location.href = r === 'konsumen' ? 'index.html' : 'login.html?role=' + r);
  if (r === 'konsumen' || U.role === r) return Auth.setMode(r);
  toast(`Akun ini bukan akun ${r}. Keluar dulu untuk masuk dengan akun ${r}.`);
}));
