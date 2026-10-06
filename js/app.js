/* ===========================================================
   App shell: auth (PIN), router, theme, network status
   =========================================================== */
const Auth = {
  user() {
    const id = sessionStorage.getItem('wk_session');
    return id ? DB.users().find(u => u.id === id) || null : null;
  },
  login(id, pin) {
    const u = DB.users().find(x => x.id === id);
    if (!u || u.pin !== hashPin(pin)) return false;
    sessionStorage.setItem('wk_session', u.id);
    return true;
  },
  logout() { sessionStorage.removeItem('wk_session'); location.hash = ''; render(); },
  can(perm) {
    const u = this.user(); if (!u) return false;
    if (u.role === 'owner') return true;
    return ['pos', 'transactions', 'void_own'].includes(perm);
  },
};

const ROUTES = {
  pos:          { title: 'Kasir',     icon: 'pos',     perm: 'pos',          render: () => PagePOS.render() },
  products:     { title: 'Produk',    icon: 'box',     perm: 'products',     render: () => PageProducts.render() },
  transactions: { title: 'Transaksi', icon: 'receipt', perm: 'transactions', render: () => PageTransactions.render() },
  finance:      { title: 'Keuangan',  icon: 'wallet',  perm: 'finance',      render: () => PageFinance.render() },
  reports:      { title: 'Laporan',   icon: 'chart',   perm: 'reports',      render: () => PageReports.render() },
  settings:     { title: 'Pengaturan',icon: 'gear',    perm: 'settings',     render: () => PageSettings.render() },
};

function currentRoute() {
  const r = location.hash.replace(/^#\/?/, '');
  return ROUTES[r] && Auth.can(ROUTES[r].perm) ? r : 'pos';
}

function applyTheme() {
  const t = DB.settings().theme;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', t === 'dark' ? '#14171e' : '#ffffff');
}

function render() {
  Modal.closeAll();
  applyTheme();
  const root = document.getElementById('app');
  const user = Auth.user();
  if (!user) { root.innerHTML = LoginScreen.html(); LoginScreen.mount(root); return; }

  const route = currentRoute();
  const R = ROUTES[route];
  const s = DB.settings();
  root.innerHTML = `
    <div class="app">
      <nav class="rail">
        <div class="rail-logo" title="${esc(s.storeName)}">${icon('logo')}</div>
        <div class="rail-nav">
          ${Object.entries(ROUTES).filter(([, r]) => Auth.can(r.perm)).map(([k, r]) => `
            <button class="rail-item ${k === route ? 'active' : ''}" data-go="${k}">${icon(r.icon)}<span>${r.title}</span></button>`).join('')}
        </div>
        <div class="rail-bottom">
          <button class="icon-btn" data-act="theme" title="Mode gelap/terang">${icon(s.theme === 'dark' ? 'sun' : 'moon')}</button>
          <button class="avatar" data-act="user" title="${esc(user.name)}">${esc(user.name[0].toUpperCase())}</button>
        </div>
      </nav>
      <main class="main">
        <header class="topbar">
          <div class="grow">
            <h1>${R.title}</h1>
            <div class="sub truncate">${esc(s.storeName)} · <span id="clock" class="num"></span></div>
          </div>
          <span class="net-pill ${navigator.onLine ? '' : 'off'}" id="net">${navigator.onLine ? 'Online' : 'Offline'}</span>
          <button class="icon-btn hide-sm" data-act="fullscreen" title="Layar penuh">${icon('fullscreen')}</button>
          <button class="btn btn-ghost hide-sm" data-act="user">${esc(user.name)} <span class="badge ${user.role === 'owner' ? 'primary' : 'info'}">${user.role}</span></button>
          <button class="avatar show-sm" data-act="user" aria-label="Akun">${esc(user.name[0].toUpperCase())}</button>
        </header>
        <section class="view page-in ${route === 'pos' ? 'flush' : ''}" id="view"></section>
      </main>
    </div>`;

  root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { location.hash = '#/' + b.dataset.go; });
  root.querySelectorAll('[data-act=theme]').forEach(b => b.onclick = () => {
    DB.saveSettings({ theme: DB.settings().theme === 'dark' ? 'light' : 'dark' }); render();
  });
  root.querySelectorAll('[data-act=user]').forEach(b => b.onclick = userMenu);
  root.querySelector('[data-act=fullscreen]')?.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {});
  });
  tickClock();
  R.render();
}

function userMenu() {
  const u = Auth.user();
  const m = Modal.open({
    title: 'Akun', size: 'sm',
    body: `<div class="row" style="margin-bottom:16px"><div class="avatar" style="width:52px;height:52px;font-size:20px">${esc(u.name[0])}</div>
             <div><b style="font-size:17px">${esc(u.name)}</b><div class="muted" style="text-transform:capitalize">${u.role}</div></div></div>
           <div class="stack">
             <button class="btn btn-outline btn-block" data-a="lock">${icon('users')} Ganti Pengguna</button>
             <button class="btn btn-danger btn-block" data-a="out">${icon('logout')} Keluar</button>
           </div>`,
    onMount: el => {
      el.querySelector('[data-a=lock]').onclick = () => { Modal.close(m); Auth.logout(); };
      el.querySelector('[data-a=out]').onclick = () => { Modal.close(m); Auth.logout(); };
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
  el.textContent = navigator.onLine ? 'Online' : 'Offline';
  el.classList.toggle('off', !navigator.onLine);
}
window.addEventListener('online', () => { updateNet(); toast('Kembali online', 'info'); });
window.addEventListener('offline', () => { updateNet(); toast('Offline — data tetap tersimpan di perangkat', 'warning'); });
window.addEventListener('hashchange', render);

/* ===========================================================
   Login: pilih user + PIN pad
   =========================================================== */
const LoginScreen = {
  sel: null, pin: '',
  html() {
    const users = DB.users();
    const s = DB.settings();
    if (!this.sel || !users.some(u => u.id === this.sel)) this.sel = users[0]?.id;
    return `
    <div class="login">
      <div class="login-hero">
        <div class="row" style="gap:12px"><div class="rail-logo" style="margin:0;background:rgba(255,255,255,.18);box-shadow:none">${icon('logo')}</div><b style="font-size:20px">${esc(s.storeName)}</b></div>
        <div>
          <h2>Ayam bakar & ayam goreng, kasirnya cepat.</h2>
          <p>Transaksi, stok, pengeluaran, dan laporan laba — semua jalan offline langsung di tablet.</p>
        </div>
        <div class="hero-feats">
          <div class="hero-feat">${icon('pos')} Kasir sentuh dengan numpad & struk</div>
          <div class="hero-feat">${icon('box')} Stok otomatis berkurang tiap transaksi</div>
          <div class="hero-feat">${icon('chart')} Laporan laba kotor & produk terlaris</div>
        </div>
      </div>
      <div class="login-panel">
        <div class="login-box">
          <div>
            <h2 style="font-size:26px;font-weight:900;line-height:1.2">Masuk ${esc(s.storeName)}</h2>
            <p class="muted">Pilih nama lalu masukkan PIN</p>
          </div>
          <div class="user-pick">
            ${users.map(u => `<button class="user-opt ${u.id === this.sel ? 'active' : ''}" data-u="${u.id}">
              <div class="avatar">${esc(u.name[0].toUpperCase())}</div>${esc(u.name)}<small>${u.role}</small></button>`).join('')}
          </div>
          <div class="pin-dots" id="dots">${'<span></span>'.repeat(4)}</div>
          <div class="numpad" id="pinpad">
            ${[1,2,3,4,5,6,7,8,9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
            <button data-k="C" style="font-size:15px">Hapus</button><button data-k="0">0</button><button data-k="B">${icon('backspace')}</button>
          </div>
          <p class="muted" style="text-align:center;font-size:13px">PIN demo — Mbak Indar: <b>1234</b> · Anas: <b>0000</b> · Rizal: <b>1111</b></p>
        </div>
      </div>
    </div>`;
  },
  mount(root) {
    this.pin = '';
    const dots = root.querySelector('#dots');
    const paint = () => dots.querySelectorAll('span').forEach((d, i) => d.classList.toggle('on', i < this.pin.length));
    const press = k => {
      if (k === 'C') this.pin = '';
      else if (k === 'B') this.pin = this.pin.slice(0, -1);
      else if (this.pin.length < 4) this.pin += k;
      paint();
      if (this.pin.length === 4) {
        const ok = Auth.login(this.sel, this.pin);
        if (ok) { toast(`Halo, ${Auth.user().name}!`); this.pin = ''; render(); }
        else {
          dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake');
          toast('PIN salah', 'error');
          setTimeout(() => { this.pin = ''; paint(); }, 350);
        }
      }
    };
    root.querySelectorAll('[data-u]').forEach(b => b.onclick = () => {
      this.sel = b.dataset.u; this.pin = '';
      root.querySelectorAll('[data-u]').forEach(x => x.classList.toggle('active', x === b)); paint();
    });
    root.querySelectorAll('#pinpad [data-k]').forEach(b => b.onclick = () => press(b.dataset.k));
    this._key && document.removeEventListener('keydown', this._key);
    this._key = e => { if (!document.querySelector('.login')) return; if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('B'); };
    document.addEventListener('keydown', this._key);
  },
};

/* ===========================================================
   Boot
   =========================================================== */
seed();
render();

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
