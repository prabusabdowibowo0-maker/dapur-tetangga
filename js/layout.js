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

const PAGE = document.body.dataset.page;
const U = Auth.user();
const NAV = U?.role === 'mitra'
  ? [['dashboard', 'dashboard.html', 'soup_kitchen', 'Dashboard Mitra'], ['mitra-menu', 'menu-mitra.html', 'edit_note', 'Kelola Menu']]
  : [['katalog', 'index.html', 'storefront', 'Katalog Dapur'], ['cart', 'cart.html', 'shopping_bag', 'Keranjang'], ['tracker', 'tracker.html', 'receipt_long', 'Pesanan Saya']];
const btn = 'bg-surface-high hover:bg-surface-highest px-3 py-1.5 rounded-full';
const userArea = () => U
  ? `<div class="flex items-center gap-2">${U.role !== 'mitra' ? `<a href="cart.html" class="${btn} flex items-center gap-1" aria-label="Keranjang">${ic('shopping_bag', '!text-sm')}<span id="cart-badge">${Cart.count()}</span></a>` : ''}<span class="hidden sm:inline text-on-surface-variant">${esc(U.name)}</span><button id="logout" class="${btn}">Keluar</button></div>`
  : `<div class="flex gap-2"><a href="login.html" class="bg-primary-container text-on-primary px-3 py-1.5 rounded-full">Masuk</a><a href="login.html?role=mitra" class="${btn}">Masuk mitra</a></div>`;

$('#site-header').innerHTML = `
<header class="fixed top-0 inset-x-0 z-50 bg-surface/95 backdrop-blur shadow-sm">
  <div class="max-w-7xl mx-auto px-4 lg:px-12 py-3 flex items-center justify-between gap-3">
    <a href="index.html" class="flex items-center gap-3"><div class="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex items-center justify-center">${ic('skillet', '!text-2xl')}</div>
      <div><div class="text-lg font-bold text-primary-container leading-tight">Dapur Tetangga</div><p class="text-xs text-on-surface-variant hidden sm:block">Masakan rumahan dari dapur tetangga</p></div></a>
    <div class="text-xs font-semibold">${userArea()}</div>
  </div>
  <nav class="max-w-7xl mx-auto px-4 lg:px-12 flex gap-6 overflow-x-auto">
    ${NAV.map(([k, h, i, l]) => `<a href="${h}" class="inline-flex items-center gap-1.5 py-2.5 text-xs border-b-2 shrink-0 ${k === PAGE ? 'text-primary-container border-primary-container font-bold' : 'text-on-surface-variant border-transparent font-semibold hover:text-on-surface'}">${ic(i)}${l}</a>`).join('')}
  </nav>
</header>`;
$('#site-footer').innerHTML = `<footer class="bg-surface-low mt-10 py-6 text-center text-xs text-on-surface-variant">&copy; ${new Date().getFullYear()} Dapur Tetangga. Platform kuliner rumahan hyperlocal.</footer>`;
$('#logout')?.addEventListener('click', Auth.logout);
