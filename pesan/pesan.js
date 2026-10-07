/* ===========================================================
   App Pelanggan — scan QR meja → pilih menu → pesan → status
   Tanpa login. Semua akses lewat RPC aman (security definer).
   =========================================================== */
const sb = window.supabase.createClient(SB_CONFIG.url, SB_CONFIG.anonKey, { auth: { persistSession: false } });

const params = new URLSearchParams(location.search);
const TOKEN = params.get('t') || '';
const KEY = 'wkc_' + TOKEN.slice(0, 12);

const S = {
  shop: null, menu: [], cat: 'Semua', cart: [], type: 'dine_in', name: '',
  orders: [], view: 'menu', busy: false,
};
const saved = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } })();
S.cart = saved.cart || []; S.name = saved.name || ''; S.type = saved.type || 'dine_in';
const myOrderIds = () => (saved.orders || []).filter(o => Date.now() - o.t < 12 * 3600e3).map(o => o.id);
function persist() {
  saved.cart = S.cart; saved.name = S.name; saved.type = S.type;
  localStorage.setItem(KEY, JSON.stringify(saved));
}

/* ---------- helpers ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rp = n => 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID');
const $ = sel => document.querySelector(sel);
function toast(msg, type = 'ok') {
  let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
  const el = document.createElement('div'); el.className = 'toast ' + type; el.textContent = msg; box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, 2800);
}
function friendly(e) {
  const m = e?.message || String(e);
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Koneksi internet bermasalah, coba lagi';
  return m;
}
const totalQty = () => S.cart.reduce((a, i) => a + i.qty, 0);
const subtotal = () => S.cart.reduce((a, i) => a + i.price * i.qty, 0);
const prod = id => S.menu.find(p => p.id === id);
const inCart = id => S.cart.filter(i => i.id === id).reduce((a, i) => a + i.qty, 0);

/* ---------- data ---------- */
async function loadMenu() {
  const [shop, menu] = await Promise.all([sb.rpc('shop_info', { p_token: TOKEN }), sb.rpc('menu_public')]);
  if (shop.error) throw shop.error; if (menu.error) throw menu.error;
  S.shop = shop.data; S.menu = menu.data || [];
  // keep cart in sync with live prices & availability
  S.cart = S.cart.filter(i => prod(i.id)).map(i => ({ ...i, price: prod(i.id).price, name: prod(i.id).name }));
  persist();
}
async function loadOrders() {
  const ids = myOrderIds();
  if (!ids.length) { S.orders = []; return; }
  const { data, error } = await sb.rpc('order_status', { p_ids: ids });
  if (!error) S.orders = data || [];
}

/* ---------- render ---------- */
function render() {
  const app = $('#app');
  if (!S.shop) return;
  if (!TOKEN || (!S.shop.table_no)) {
    app.innerHTML = `<div class="center"><div class="big-ico">📷</div><h2>QR tidak valid</h2><p>Silakan scan ulang QR yang tertempel di meja, atau pesan langsung ke kasir.</p></div>`;
    return;
  }
  const activeOrders = S.orders.filter(o => !['paid', 'void'].includes(o.status));
  app.innerHTML = `
    <header class="hdr">
      <div class="hdr-row">
        <div class="logo">🍗</div>
        <div class="grow"><div class="store">${esc(S.shop.store_name)}</div>
          <div class="tableno">${S.type === 'take_away' ? '🛍️ Bungkus' : `🪑 Meja ${S.shop.table_no}`}</div></div>
        ${S.orders.length ? `<button class="hdr-btn" id="go-status">Pesananku${activeOrders.length ? `<b>${activeOrders.length}</b>` : ''}</button>` : ''}
      </div>
      ${!S.shop.qr_open ? `<div class="closed">⛔ Pesanan online sedang ditutup. Silakan pesan langsung ke kasir.</div>` : ''}
    </header>
    <main id="main"></main>
    <div id="sheet-root"></div>`;
  $('#go-status')?.addEventListener('click', () => { S.view = 'status'; renderMain(); });
  renderMain();
}

function renderMain() {
  const main = $('#main'); if (!main) return;
  if (S.view === 'status') return renderStatus(main);
  const cats = ['Semua', ...new Set(S.menu.map(p => p.category))];
  const list = S.menu.filter(p => S.cat === 'Semua' || p.category === S.cat);
  main.innerHTML = `
    <nav class="cats">${cats.map(c => `<button class="cat ${c === S.cat ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</nav>
    <section class="menu">${list.map(p => {
      const q = inCart(p.id);
      const left = p.remaining === null ? Infinity : p.remaining - q;
      const off = !p.available;
      return `<article class="item ${off ? 'off' : ''}">
        <div class="emo">${esc(p.emoji)}</div>
        <div class="info">
          <div class="nm">${esc(p.name)}</div>
          <div class="pr">${rp(p.price)}</div>
          <div class="st">${off ? '<span class="tag gray">Habis</span>' : p.remaining !== null && p.remaining <= 5 ? `<span class="tag orange">Sisa ${p.remaining}</span>` : ''}</div>
        </div>
        <div class="act">${off ? '' : q ? `
          <div class="step"><button data-dec="${p.id}" aria-label="Kurangi">−</button><span>${q}</span><button data-inc="${p.id}" ${left <= 0 ? 'disabled' : ''} aria-label="Tambah">+</button></div>`
          : `<button class="add" data-inc="${p.id}" ${!S.shop.qr_open ? 'disabled' : ''}>Tambah</button>`}</div>
      </article>`;
    }).join('') || '<p class="muted center">Menu belum tersedia.</p>'}</section>
    ${totalQty() ? `<div class="bar-space"></div><button class="cartbar" id="open-cart"><span><b>${totalQty()}</b> item</span><span>Lihat pesanan · <b>${rp(subtotal())}</b></span></button>` : ''}`;
  main.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { S.cat = b.dataset.c; renderMain(); });
  main.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => add(Number(b.dataset.inc)));
  main.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => dec(Number(b.dataset.dec)));
  $('#open-cart')?.addEventListener('click', openCart);
}

function add(id) {
  const p = prod(id); if (!p || !p.available) return;
  if (p.remaining !== null && inCart(id) >= p.remaining) return toast(`Stok ${p.name} tinggal ${p.remaining}`, 'warn');
  const line = S.cart.find(i => i.id === id && !i.note);
  if (line) line.qty++; else S.cart.push({ key: Math.random().toString(36).slice(2), id, name: p.name, price: p.price, qty: 1, note: '' });
  navigator.vibrate?.(8); persist(); renderMain();
  if ($('.sheet')) openCart();
}
function dec(id) {
  const lines = S.cart.filter(i => i.id === id); if (!lines.length) return;
  const l = lines[lines.length - 1]; l.qty--;
  if (l.qty <= 0) S.cart = S.cart.filter(i => i !== l);
  persist(); renderMain();
  if ($('.sheet')) S.cart.length ? openCart() : closeSheet();
}

function closeSheet() { $('#sheet-root').innerHTML = ''; document.body.classList.remove('lock'); }
function openCart() {
  document.body.classList.add('lock');
  const root = $('#sheet-root');
  root.innerHTML = `<div class="scrim" id="scrim"></div>
    <section class="sheet" role="dialog" aria-label="Pesananmu">
      <div class="grab"></div>
      <div class="sheet-h"><h3>Pesananmu</h3><button class="x" id="x" aria-label="Tutup">✕</button></div>
      <div class="sheet-b">
        <div class="lines">${S.cart.map(i => `
          <div class="line">
            <div class="grow"><div class="nm">${esc(i.name)}</div><div class="muted">${rp(i.price)} × ${i.qty} = <b>${rp(i.price * i.qty)}</b></div>
              <input class="note" data-note="${i.key}" maxlength="80" placeholder="Catatan (mis. pedas, sambal dipisah)" value="${esc(i.note)}"></div>
            <div class="step sm"><button data-ldec="${i.key}">−</button><span>${i.qty}</span><button data-linc="${i.key}">+</button></div>
          </div>`).join('')}</div>
        <div class="seg"><button data-t="dine_in" class="${S.type === 'dine_in' ? 'on' : ''}">🪑 Makan di Meja ${S.shop.table_no}</button><button data-t="take_away" class="${S.type === 'take_away' ? 'on' : ''}">🛍️ Bungkus</button></div>
        <label class="fld"><span>Nama pemesan *</span><input id="nm" maxlength="40" placeholder="Nama kamu" value="${esc(S.name)}" autocomplete="given-name"></label>
        <div class="sum"><span>Total</span><b>${rp(subtotal())}</b></div>
        <p class="pay-note">💵 Bayar di kasir <b>setelah makan</b> — Tunai atau QRIS.</p>
      </div>
      <div class="sheet-f"><button class="cta" id="send" ${S.busy || !S.shop.qr_open ? 'disabled' : ''}>${S.busy ? 'Mengirim…' : `Pesan Sekarang · ${rp(subtotal())}`}</button></div>
    </section>`;
  $('#scrim').onclick = closeSheet; $('#x').onclick = closeSheet;
  root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { S.type = b.dataset.t; persist(); openCart(); render(); openCart(); });
  root.querySelectorAll('[data-note]').forEach(inp => inp.oninput = () => { const l = S.cart.find(i => i.key === inp.dataset.note); if (l) { l.note = inp.value.slice(0, 80); persist(); } });
  root.querySelectorAll('[data-linc]').forEach(b => b.onclick = () => {
    const l = S.cart.find(i => i.key === b.dataset.linc); const p = prod(l.id);
    if (p.remaining !== null && inCart(l.id) >= p.remaining) return toast(`Stok ${p.name} tinggal ${p.remaining}`, 'warn');
    l.qty++; persist(); openCart(); renderMain();
  });
  root.querySelectorAll('[data-ldec]').forEach(b => b.onclick = () => {
    const l = S.cart.find(i => i.key === b.dataset.ldec); l.qty--;
    if (l.qty <= 0) S.cart = S.cart.filter(i => i !== l);
    persist(); renderMain(); S.cart.length ? openCart() : closeSheet();
  });
  $('#nm').oninput = e => { S.name = e.target.value; persist(); };
  $('#send').onclick = send;
}

async function send() {
  if (S.busy) return;
  const name = (S.name || '').trim();
  if (!name) { toast('Isi nama pemesan dulu ya', 'warn'); $('#nm')?.focus(); return; }
  if (!S.cart.length) return;
  S.busy = true; openCart();
  try {
    const { data, error } = await sb.rpc('place_customer_order', {
      p_token: TOKEN, p_name: name, p_type: S.type,
      p_items: S.cart.map(i => ({ product_id: i.id, qty: i.qty, note: (i.note || '').trim() })),
    });
    if (error) throw error;
    const r = Array.isArray(data) ? data[0] : data;
    saved.orders = [...(saved.orders || []).filter(o => Date.now() - o.t < 12 * 3600e3), { id: r.order_id, t: Date.now() }];
    S.cart = []; persist();
    S.busy = false; closeSheet();
    toast(`Pesanan ${r.order_code} terkirim! 🎉`);
    await Promise.all([loadOrders(), loadMenu()]);
    S.view = 'status'; render();
  } catch (e) {
    S.busy = false;
    toast(friendly(e), 'err');
    try { await loadMenu(); renderMain(); } catch {}
    openCart();
  }
}

const STEPS = [['new', 'Menunggu konfirmasi', '⏳'], ['preparing', 'Sedang disiapkan', '🔥'], ['served', 'Sudah diantar', '🍽️'], ['paid', 'Lunas', '✅']];
function renderStatus(main) {
  const list = S.orders;
  const unpaid = list.filter(o => !['paid', 'rejected', 'void'].includes(o.status));
  main.innerHTML = `
    <div class="status-top"><button class="back" id="back">← Menu</button><h2>Pesananku</h2></div>
    ${list.length ? list.map(o => {
      const bad = ['rejected', 'void'].includes(o.status);
      const idx = STEPS.findIndex(s => s[0] === o.status);
      return `<article class="ord ${bad ? 'bad' : ''}">
        <div class="ord-h"><div><div class="code">${esc(o.code)}</div><div class="muted">${o.order_type === 'take_away' ? 'Bungkus' : `Meja ${o.table_no}`} · ${new Date(o.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div></div><b>${rp(o.total)}</b></div>
        ${bad ? `<div class="rej">❌ ${o.status === 'rejected' ? 'Pesanan ditolak' : 'Pesanan dibatalkan'}${o.reject_reason ? `: <b>${esc(o.reject_reason)}</b>` : ''}</div>` : `
        <ol class="steps">${STEPS.map((s, i) => `<li class="${i < idx ? 'done' : i === idx ? 'now' : ''}"><span>${s[2]}</span>${s[1]}</li>`).join('')}</ol>
        ${o.status === 'new' && o.queue_ahead ? `<p class="muted q">Antrean di depanmu: <b>${o.queue_ahead}</b> pesanan</p>` : ''}`}
        <ul class="oi">${(o.items || []).map(i => `<li><span>${i.qty}× ${esc(i.name)}${i.note ? ` <i>(${esc(i.note)})</i>` : ''}</span><span>${rp(i.qty * i.price)}</span></li>`).join('')}</ul>
      </article>`;
    }).join('') : `<div class="center"><div class="big-ico">🧾</div><p>Belum ada pesanan.</p></div>`}
    ${unpaid.length ? `<div class="pay-box">💵 Total belum dibayar: <b>${rp(unpaid.reduce((a, o) => a + o.total, 0))}</b><br><span class="muted">Bayar di kasir setelah makan (Tunai / QRIS).</span></div>` : ''}
    <button class="cta ghost" id="more">+ Tambah Pesanan</button>
    <p class="muted center live">● Status diperbarui otomatis</p>`;
  $('#back').onclick = () => { S.view = 'menu'; renderMain(); };
  $('#more').onclick = () => { S.view = 'menu'; renderMain(); };
}

/* ---------- realtime-ish: poll status & stock (anon cannot subscribe to private tables) ---------- */
let pollT;
function startPolling() {
  clearInterval(pollT);
  pollT = setInterval(async () => {
    if (document.visibilityState !== 'visible') return;
    const before = JSON.stringify(S.orders.map(o => o.status));
    try {
      await Promise.all([loadOrders(), loadMenu()]);
      const after = JSON.stringify(S.orders.map(o => o.status));
      if (before !== after && S.orders.length) {
        const latest = S.orders[0];
        if (latest?.status === 'preparing') toast('🔥 Pesananmu sedang disiapkan!');
        if (latest?.status === 'served') { toast('🍽️ Pesananmu sudah diantar. Selamat makan!'); navigator.vibrate?.([100, 50, 100]); }
        if (latest?.status === 'rejected') toast('Maaf, pesananmu ditolak', 'err');
      }
      if (!$('.sheet')) render();
    } catch { /* keep trying */ }
  }, 5000);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') loadOrders().then(() => { if (!$('.sheet')) render(); }); });

/* ---------- boot ---------- */
(async function boot() {
  $('#app').innerHTML = `<div class="center"><div class="spin"></div><p class="muted">Memuat menu…</p></div>`;
  if (!TOKEN) { S.shop = { table_no: null }; return render(); }
  try {
    await Promise.all([loadMenu(), loadOrders()]);
    if (S.orders.some(o => !['paid', 'rejected', 'void'].includes(o.status))) S.view = 'status';
    render(); startPolling();
  } catch (e) {
    $('#app').innerHTML = `<div class="center"><div class="big-ico">📡</div><h2>Gagal memuat</h2><p>${esc(friendly(e))}</p><button class="cta" onclick="location.reload()">Coba lagi</button></div>`;
  }
})();
