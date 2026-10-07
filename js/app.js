/* ===========================================================
   App shell: Supabase auth, router, theme, realtime, alerts
   =========================================================== */
const Auth = {
  user() { return DB.c.profile; },
  can(perm) {
    const u = this.user(); if (!u || !u.active) return false;
    if (u.role === 'owner') return true;
    return ['orders', 'tables', 'pos', 'stock', 'transactions', 'finance_add'].includes(perm);
  },
  async logout() {
    await Live.stop();
    await DB.signOut();
    DB.c.profile = null;
    location.hash = '';
    render();
  },
};

const ROUTES = {
  orders:       { title: 'Pesanan',    icon: 'bell',    perm: 'orders' },
  tables:       { title: 'Meja',       icon: 'table',   perm: 'tables' },
  pos:          { title: 'Kasir',      icon: 'pos',     perm: 'pos' },
  stock:        { title: 'Stok',       icon: 'box',     perm: 'stock' },
  transactions: { title: 'Transaksi',  icon: 'receipt', perm: 'transactions' },
  products:     { title: 'Menu',       icon: 'tag',     perm: 'products' },
  finance:      { title: 'Keuangan',   icon: 'wallet',  perm: 'finance' },
  reports:      { title: 'Laporan',    icon: 'chart',   perm: 'reports' },
  settings:     { title: 'Pengaturan', icon: 'gear',    perm: 'settings' },
};
const PAGES = () => ({ orders: PageOrders, tables: PageTables, pos: PagePOS, stock: PageStock, transactions: PageTransactions, products: PageProducts, finance: PageFinance, reports: PageReports, settings: PageSettings });

let currentPage = null;
function currentRoute() {
  const r = location.hash.replace(/^#\/?/, '');
  return ROUTES[r] && Auth.can(ROUTES[r].perm) ? r : 'orders';
}

function applyTheme() {
  const t = DB.theme();
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'dark' ? '#14171e' : '#ffffff');
}

/* New-order alerts: rail badge + sound */
const Alerts = {
  newCount: 0, known: new Set(), audio: null,
  unlock() {
    if (this.audio) { if (this.audio.state === 'suspended') this.audio.resume(); return; }
    try { const Ctx = window.AudioContext || window.webkitAudioContext; this.audio = new Ctx(); } catch { /* no audio */ }
  },
  beep() {
    const ctx = this.audio; if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const t0 = ctx.currentTime;
    [0, 0.18, 0.36].forEach((d, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = i === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.4, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.16);
      o.connect(g).connect(ctx.destination); o.start(t0 + d); o.stop(t0 + d + 0.18);
    });
    navigator.vibrate?.([120, 60, 120]);
  },
  async refresh(playIfNew = false) {
    try {
      const data = await q(sb.from('orders').select('id').eq('status', 'new').gte('created_at', rangeISO('today')));
      const ids = data.map(r => r.id);
      const fresh = ids.filter(id => !this.known.has(id));
      if (playIfNew && fresh.length) { this.beep(); toast(`🔔 ${fresh.length} pesanan baru masuk!`, 'info'); }
      this.known = new Set(ids);
      this.newCount = ids.length;
      this.paint();
    } catch { /* offline */ }
  },
  paint() {
    const b = document.querySelector('[data-go=orders] .rail-badge');
    if (b) { b.textContent = this.newCount; b.classList.toggle('hidden', !this.newCount); }
    document.title = (this.newCount ? `(${this.newCount}) ` : '') + 'Kasir — ' + (DB.settings().store_name || 'Ayam Kremez');
  },
};

async function render() {
  Modal.closeAll();
  applyTheme();
  const root = document.getElementById('app');
  const user = Auth.user();
  currentPage?.destroy?.();
  currentPage = null;
  if (!user) { root.innerHTML = LoginScreen.html(); LoginScreen.mount(root); return; }
  if (!user.active) {
    root.innerHTML = `<div class="login"><div class="login-panel" style="grid-column:1/-1"><div class="login-box" style="text-align:center">
      <div style="font-size:48px">⏳</div><h2>Akun belum aktif</h2>
      <p class="muted">Akun <b>${esc(user.email)}</b> menunggu persetujuan owner. Minta Mbak Indar mengaktifkan akun ini di menu Pengaturan.</p>
      <button class="btn btn-outline btn-block" id="lo">${icon('logout')} Keluar</button></div></div></div>`;
    root.querySelector('#lo').onclick = () => Auth.logout();
    return;
  }

  const route = currentRoute();
  const R = ROUTES[route];
  const s = DB.settings();
  root.innerHTML = `
    <div class="app">
      <nav class="rail">
        <div class="rail-logo" title="${esc(s.store_name)}">${icon('logo')}</div>
        <div class="rail-nav">
          ${Object.entries(ROUTES).filter(([, r]) => Auth.can(r.perm)).map(([k, r]) => `
            <button class="rail-item ${k === route ? 'active' : ''}" data-go="${k}">${icon(r.icon)}<span>${r.title}</span>${k === 'orders' ? '<b class="rail-badge hidden">0</b>' : ''}</button>`).join('')}
        </div>
        <div class="rail-bottom">
          <button class="icon-btn" data-act="theme" title="Mode gelap/terang">${icon(DB.theme() === 'dark' ? 'sun' : 'moon')}</button>
          <button class="avatar" data-act="user" title="${esc(user.name)}">${esc((user.name || '?')[0].toUpperCase())}</button>
        </div>
      </nav>
      <main class="main">
        <header class="topbar">
          <div class="grow">
            <h1>${R.title}</h1>
            <div class="sub truncate">${esc(s.store_name)} · <span id="clock" class="num"></span></div>
          </div>
          <button class="qr-pill" id="qr-pill" title="Buka/tutup pesanan QR">${icon('qr')}<span></span></button>
          <span class="net-pill" id="net">…</span>
          <button class="icon-btn hide-sm" data-act="fullscreen" title="Layar penuh">${icon('fullscreen')}</button>
          <button class="btn btn-ghost hide-sm" data-act="user">${esc(user.name)} <span class="badge ${user.role === 'owner' ? 'primary' : 'info'}">${user.role}</span></button>
          <button class="avatar show-sm" data-act="user" aria-label="Akun">${esc((user.name || '?')[0].toUpperCase())}</button>
        </header>
        <section class="view page-in ${route === 'pos' ? 'flush' : ''}" id="view"><div class="loading"><div class="spinner"></div></div></section>
      </main>
    </div>`;

  root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { Alerts.unlock(); location.hash = '#/' + b.dataset.go; });
  root.querySelectorAll('[data-act=theme]').forEach(b => b.onclick = () => { DB.setTheme(DB.theme() === 'dark' ? 'light' : 'dark'); render(); });
  root.querySelectorAll('[data-act=user]').forEach(b => b.onclick = userMenu);
  root.querySelector('[data-act=fullscreen]')?.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {});
  });
  root.querySelector('#qr-pill').onclick = toggleQr;
  paintQrPill();
  tickClock();
  updateNet();
  Alerts.paint();
  currentPage = PAGES()[route];
  try { await currentPage.render(); }
  catch (e) { console.error(e); const v = document.getElementById('view'); if (v) v.innerHTML = errorBox(e); }
}

function errorBox(e) {
  return `<div class="empty"><div class="em">⚠️</div><b>Gagal memuat data</b><span>${esc(errMsg(e))}</span><button class="btn btn-primary" onclick="render()">${icon('refresh')} Coba lagi</button></div>`;
}

async function toggleQr() {
  const open = !DB.settings().qr_open;
  if (!open && !(await confirmDialog({ title: 'Tutup pesanan QR?', message: 'Pelanggan yang scan QR akan diminta memesan langsung ke kasir.', okText: 'Tutup QR', danger: true }))) return;
  try { await DB.setQrOpen(open); toast(open ? 'Pesanan QR dibuka' : 'Pesanan QR ditutup', open ? 'success' : 'warning'); paintQrPill(); }
  catch (e) { toast(e.message, 'error'); }
}
function paintQrPill() {
  const p = document.getElementById('qr-pill'); if (!p) return;
  const on = !!DB.settings().qr_open;
  p.className = `qr-pill ${on ? 'on' : 'off'}`;
  p.querySelector('span').textContent = on ? 'QR Buka' : 'QR Tutup';
}

function userMenu() {
  const u = Auth.user();
  const m = Modal.open({
    title: 'Akun', size: 'sm',
    body: `<div class="row" style="margin-bottom:16px"><div class="avatar" style="width:52px;height:52px;font-size:20px">${esc((u.name || '?')[0])}</div>
             <div><b style="font-size:17px">${esc(u.name)}</b><div class="muted" style="font-size:13px">${esc(u.email || '')}</div><span class="badge ${u.role === 'owner' ? 'primary' : 'info'}">${u.role}</span></div></div>
           <div class="stack">
             <button class="btn btn-outline btn-block" data-a="sound">${icon('bell')} Tes Bunyi Notifikasi</button>
             <button class="btn btn-danger btn-block" data-a="out">${icon('logout')} Keluar</button>
           </div>`,
    onMount: el => {
      el.querySelector('[data-a=sound]').onclick = () => { Alerts.unlock(); Alerts.beep(); };
      el.querySelector('[data-a=out]').onclick = async () => { Modal.close(m); await Auth.logout(); };
    },
  });
}

let clockTimer;
function tickClock() {
  clearInterval(clockTimer);
  const f = () => {
    const el = document.getElementById('clock');
    if (!el) return clearInterval(clockTimer);
    el.textContent = new Date().toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  f(); clockTimer = setInterval(f, 15000);
}

function updateNet() {
  const el = document.getElementById('net'); if (!el) return;
  const online = navigator.onLine;
  const live = Live.status === 'SUBSCRIBED';
  el.textContent = !online ? 'Offline' : live ? 'Live' : 'Menyambung…';
  el.className = 'net-pill ' + (!online ? 'off' : live ? '' : 'wait');
}
window.addEventListener('online', () => { updateNet(); toast('Kembali online', 'info'); if (Auth.user()) DB.load().then(() => currentPage?.refresh?.()).catch(() => {}); });
window.addEventListener('offline', () => { updateNet(); toast('Offline — pesanan tidak bisa diproses sampai internet kembali', 'warning'); });
document.addEventListener('live-status', updateNet);
window.addEventListener('hashchange', () => { if (Auth.user()) render(); });

/* Realtime fan-out (debounced so bursts become one refresh) */
let liveQueue = [];
const flushLive = debounce(async () => {
  const evts = liveQueue; liveQueue = [];
  if (!Auth.user()) return;
  const tables = new Set(evts.map(e => e.table));
  const st = evts.filter(e => e.table === 'settings' && e.new).pop();
  if (st) { DB.c.settings = { ...DB.c.settings, ...st.new }; paintQrPill(); }
  if (tables.has('ingredients') || tables.has('products')) { try { await DB.reloadStock(); } catch {} }
  if (tables.has('orders')) await Alerts.refresh(true);
  currentPage?.onLive?.(tables);
}, 300);
Live.on(evt => { liveQueue.push(evt); flushLive(); });

/* Refresh when tablet wakes up; poll as a safety net if realtime drops */
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !Auth.user()?.active) return;
  try { await DB.load(); await Alerts.refresh(true); currentPage?.refresh?.(); } catch {}
});
setInterval(() => {
  if (Auth.user()?.active && document.visibilityState === 'visible' && Live.status !== 'SUBSCRIBED') {
    Alerts.refresh(true); currentPage?.refresh?.();
  }
}, 15000);

/* ===========================================================
   Login: email + password (Supabase Auth)
   =========================================================== */
const LoginScreen = {
  html() {
    return `
    <div class="login">
      <div class="login-hero">
        <div class="row" style="gap:12px"><div class="rail-logo" style="margin:0;background:rgba(255,255,255,.18);box-shadow:none">${icon('logo')}</div><b style="font-size:20px">Ayam Kremez Mbak Indar</b></div>
        <div>
          <h2>Ayam bakar & ayam goreng, kasirnya cepat.</h2>
          <p>Pesanan dari QR meja langsung masuk, stok ayam terhitung otomatis, bayar tunai atau QRIS.</p>
        </div>
        <div class="hero-feats">
          <div class="hero-feat">${icon('bell')} Pesanan QR masuk realtime + bunyi</div>
          <div class="hero-feat">${icon('table')} Denah 6 meja & tagihan per meja</div>
          <div class="hero-feat">${icon('box')} Stok ayam bakar & goreng terpisah</div>
        </div>
      </div>
      <div class="login-panel">
        <form class="login-box" id="lf" novalidate>
          <div>
            <h2 style="font-size:26px;font-weight:900;line-height:1.2">Masuk Ayam Kremez Mbak Indar</h2>
            <p class="muted">Gunakan email & password akun kasir/owner</p>
          </div>
          <div class="field"><label for="le">Email</label>
            <div class="input-icon">${icon('users')}<input class="input" id="le" type="email" autocomplete="username" inputmode="email" placeholder="nama@email.com"></div></div>
          <div class="field"><label for="lp">Password</label>
            <div class="input-icon">${icon('lock')}<input class="input" id="lp" type="password" autocomplete="current-password" placeholder="••••••">
            <button type="button" class="pw-eye" id="eye" aria-label="Tampilkan password">${icon('eye')}</button></div></div>
          <button class="btn btn-primary btn-lg btn-block" id="lb" type="submit">Masuk</button>
          <p class="muted" style="text-align:center;font-size:13px">Akun kasir dibuat oleh owner di menu <b>Pengaturan</b>.</p>
        </form>
      </div>
    </div>`;
  },
  mount(root) {
    const f = root.querySelector('#lf'), b = root.querySelector('#lb');
    const last = Store.get('last_email', '');
    if (last) root.querySelector('#le').value = last;
    root.querySelector('#eye').onclick = () => { const p = root.querySelector('#lp'); p.type = p.type === 'password' ? 'text' : 'password'; };
    f.onsubmit = async e => {
      e.preventDefault(); Alerts.unlock();
      const email = root.querySelector('#le').value.trim(), pw = root.querySelector('#lp').value;
      if (!email || !pw) return toast('Email dan password wajib diisi', 'error');
      b.disabled = true; b.textContent = 'Memproses…';
      try {
        await DB.signIn(email, pw);
        Store.set('last_email', email);
        await boot();
      } catch (err) {
        toast(err.message, 'error');
        b.disabled = false; b.textContent = 'Masuk';
      }
    };
    if (matchMedia('(pointer:fine)').matches) setTimeout(() => root.querySelector(last ? '#lp' : '#le')?.focus(), 50);
  },
};

/* ===========================================================
   Boot
   =========================================================== */
async function boot() {
  const root = document.getElementById('app');
  root.innerHTML = `<div class="boot"><div class="rail-logo">${icon('logo')}</div><div class="spinner"></div></div>`;
  try {
    const profile = await DB.loadProfile();
    if (profile?.active) {
      await DB.load();
      Live.start();
      await Alerts.refresh(false);
    }
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="boot">${errorBox(e)}</div>`;
    return;
  }
  render();
}

sb.auth.onAuthStateChange(event => {
  if (event === 'SIGNED_OUT' && DB.c.profile) { DB.c.profile = null; Live.stop(); render(); }
});
document.addEventListener('pointerdown', () => Alerts.unlock(), { once: true });

applyTheme();
boot();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('Versi baru tersedia — memuat ulang…', 'info');
            setTimeout(() => location.reload(), 1200);
          }
        });
      });
    }).catch(err => console.warn('SW gagal', err));
  });
}
