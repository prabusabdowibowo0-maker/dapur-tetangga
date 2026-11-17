// Muat sesi dulu, baru gambar layout dan jalankan logika halaman.
(async () => {
  try { await Auth.init(); } catch (e) { console.error(e); }
  for (const src of ['js/layout.js', 'js/app.js']) {
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
})();
