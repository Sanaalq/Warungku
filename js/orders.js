/* ===========================================================
   Pesanan (antrean QR + dapur) & Meja (denah + tagihan)
   =========================================================== */
const STATUS_LABEL = { new: 'Baru', preparing: 'Disiapkan', served: 'Disajikan', paid: 'Lunas', rejected: 'Ditolak', void: 'Batal' };
const STATUS_TONE  = { new: 'warning', preparing: 'info', served: 'success', paid: 'success', rejected: 'danger', void: 'danger' };
const METHOD_LABEL = { cash: 'Tunai', qris: 'QRIS' };

function ago(d) {
  const m = Math.max(0, Math.round((Date.now() - new Date(d)) / 60000));
  return m < 1 ? 'baru saja' : m < 60 ? `${m} mnt lalu` : `${Math.floor(m / 60)} jam lalu`;
}
function orderPlace(o) { return o.order_type === 'take_away' || !o.table_id ? `${icon('bag')} Bungkus` : `${icon('table')} Meja ${o.table_id}`; }
function itemsHTML(items, { done = false } = {}) {
  return `<div class="oitems">${items.map(i => `
    <div class="oitem ${done ? 'done' : ''}"><b class="num">${i.qty}×</b><div class="grow"><div>${esc(i.name)}</div>${i.note ? `<div class="onote">${icon('note')} ${esc(i.note)}</div>` : ''}</div></div>`).join('')}</div>`;
}

/* ---------------- PESANAN ---------------- */
const PageOrders = {
  filter: 'active', orders: [], kitchen: [], timer: null,
  async render() {
    const view = document.getElementById('view');
    view.innerHTML = `
      <div class="orders-layout">
        <div class="orders-main">
          <div class="toolbar">
            <div class="seg" id="of">
              <button data-f="active">Aktif</button><button data-f="new">Baru</button><button data-f="preparing">Disiapkan</button><button data-f="served">Disajikan</button>
            </div>
            <div class="grow"></div>
            <button class="btn" id="o-refresh">${icon('refresh')}<span class="hide-md">Muat ulang</span></button>
          </div>
          <div class="order-board" id="ob"><div class="loading"><div class="spinner"></div></div></div>
        </div>
        <aside class="kitchen card">
          <div class="card-title">${icon('fire')} Rekap Dapur</div>
          <p class="muted" style="font-size:12.5px;margin:-8px 0 10px">Total yang harus dimasak (pesanan Baru + Disiapkan)</p>
          <div id="kq"></div>
          <div class="card-title" style="margin-top:18px">${icon('box')} Stok Ayam</div>
          <div id="ks"></div>
        </aside>
      </div>`;
    view.querySelectorAll('#of [data-f]').forEach(b => b.onclick = () => { this.filter = b.dataset.f; this.paint(); });
    view.querySelector('#o-refresh').onclick = () => this.refresh();
    await this.refresh();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.paintTimes(), 30000);
  },
  destroy() { clearInterval(this.timer); },
  onLive(tables) { if (tables.has('orders') || tables.has('table_sessions') || tables.has('ingredients')) this.refresh(); },
  async refresh() {
    try {
      const [orders, kitchen] = await Promise.all([DB.activeOrders(), DB.kitchenQueue()]);
      this.orders = orders; this.kitchen = kitchen || [];
      this.paint();
    } catch (e) { const ob = document.getElementById('ob'); if (ob) ob.innerHTML = errorBox(e); }
  },
  paint() {
    const ob = document.getElementById('ob'); if (!ob) return;
    document.querySelectorAll('#of [data-f]').forEach(b => b.classList.toggle('active', b.dataset.f === this.filter));
    // "paid" = sudah dibayar di kasir tapi belum disajikan → tetap tampil sebagai preparing
    const norm = o => (o.status === 'paid' && !o.served_at ? 'preparing' : o.status === 'paid' ? 'served' : o.status);
    let list = this.orders.map(o => ({ ...o, _st: norm(o) }));
    list = list.filter(o => this.filter === 'active' ? ['new', 'preparing'].includes(o._st) : o._st === this.filter);
    const cnt = s => this.orders.filter(o => norm(o) === s).length;
    document.querySelectorAll('#of [data-f]').forEach(b => {
      const f = b.dataset.f, n = f === 'active' ? cnt('new') + cnt('preparing') : cnt(f);
      b.innerHTML = `${{ active: 'Aktif', new: 'Baru', preparing: 'Disiapkan', served: 'Disajikan' }[f]}${n ? ` <span class="badge ${f === 'new' ? 'warning' : ''}">${n}</span>` : ''}`;
    });
    ob.innerHTML = list.length ? list.map(o => this.card(o)).join('') :
      `<div class="empty" style="grid-column:1/-1"><div class="em">${this.filter === 'served' ? '✅' : '🍗'}</div><b>${this.filter === 'served' ? 'Belum ada yang disajikan hari ini' : 'Belum ada pesanan'}</b><span>Pesanan dari QR meja akan muncul di sini otomatis</span></div>`;
    ob.querySelectorAll('[data-act]').forEach(b => b.onclick = () => this.act(b.dataset.id, b.dataset.act, b));

    // Rekap dapur
    const kq = document.getElementById('kq');
    if (kq) kq.innerHTML = this.kitchen.length ? `<div class="list">${this.kitchen.map(k => `
      <div class="list-item"><div class="emoji-box">${esc(k.emoji)}</div><div class="grow"><b>${esc(k.name)}</b></div><b class="kq-n num">${k.qty}</b></div>`).join('')}</div>`
      : `<p class="muted">Tidak ada yang perlu dimasak 🎉</p>`;
    this.paintStock();
  },
  paintStock() {
    const ks = document.getElementById('ks'); if (!ks) return;
    ks.innerHTML = `<div class="stock-mini">${DB.ingredients().map(i => {
      const tone = i.stock <= 0 ? 'danger' : i.stock <= i.min_stock ? 'warning' : 'ok';
      return `<div class="sm-cell ${tone}"><span>${esc(i.name)}</span><b class="num">${i.stock}</b></div>`;
    }).join('')}</div><a href="#/stock" class="btn btn-sm btn-ghost btn-block" style="margin-top:8px">Atur stok →</a>`;
  },
  paintTimes() { document.querySelectorAll('[data-ago]').forEach(el => el.textContent = ago(el.dataset.ago)); },
  card(o) {
    const st = o._st;
    const btns = st === 'new'
      ? `<button class="btn btn-danger" data-act="reject" data-id="${o.id}">${icon('x')} Tolak</button>
         <button class="btn btn-primary btn-lg grow" data-act="preparing" data-id="${o.id}">${icon('fire')} Siapkan</button>`
      : st === 'preparing'
      ? `<button class="btn btn-success btn-lg grow" data-act="served" data-id="${o.id}">${icon('check')} Sajikan</button>`
      : '';
    return `<article class="ocard st-${st}">
      <header class="ocard-h">
        <div class="ocode">${esc(o.code)}</div>
        <div class="grow"><div class="oplace">${orderPlace(o)}</div><div class="muted" style="font-size:13px">${esc(o.customer_name || '-')} · <span data-ago="${o.created_at}">${ago(o.created_at)}</span></div></div>
        <span class="badge ${STATUS_TONE[st]}">${STATUS_LABEL[st]}</span>
      </header>
      ${itemsHTML(o.order_items || [], { done: st === 'served' })}
      <footer class="ocard-f">
        <div class="row between" style="width:100%"><span class="muted">${o.source === 'qr' ? '📱 QR' : '🧾 Kasir'}${o.status === 'paid' ? ' · <b style="color:var(--success)">Lunas</b>' : ''}</span><b class="num">${rp(o.total)}</b></div>
        ${btns ? `<div class="row" style="width:100%;gap:8px">${btns}</div>` : ''}
      </footer>
    </article>`;
  },
  async act(id, action, btn) {
    if (action === 'reject') {
      const o = this.orders.find(x => x.id === id);
      const reason = await promptReject(o);
      if (reason === null) return;
      return this.run(btn, () => DB.setOrderStatus(id, 'rejected', reason), 'Pesanan ditolak, stok dikembalikan');
    }
    return this.run(btn, () => DB.setOrderStatus(id, action), action === 'preparing' ? 'Pesanan disiapkan 🔥' : 'Pesanan disajikan ✅');
  },
  async run(btn, fn, okMsg) {
    btn.disabled = true;
    try { await fn(); toast(okMsg); await this.refresh(); await Alerts.refresh(false); }
    catch (e) { toast(e.message, 'error'); btn.disabled = false; }
  },
};

function promptReject(o) {
  return new Promise(resolve => {
    let done = false;
    const presets = ['Stok habis', 'Warung mau tutup', 'Pesanan dobel', 'Meja tidak sesuai'];
    const m = Modal.open({
      title: `Tolak pesanan ${esc(o?.code || '')}?`, size: 'sm',
      body: `<div class="stack"><p class="muted">Alasan akan terlihat oleh pelanggan. Stok ayam dikembalikan otomatis.</p>
        <input class="input" id="rr" maxlength="80" placeholder="Alasan penolakan" autofocus>
        <div class="chips wrap">${presets.map(p => `<button class="chip" data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div></div>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-danger" data-ok>Tolak Pesanan</button>`,
      onMount: el => {
        el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { el.querySelector('#rr').value = b.dataset.p; });
        el.querySelector('[data-ok]').onclick = () => {
          const v = el.querySelector('#rr').value.trim();
          if (!v) return toast('Isi alasan penolakan', 'error');
          done = true; resolve(v); Modal.close(m);
        };
      },
    });
    m.onClose = () => { if (!done) resolve(null); };
  });
}

/* ---------------- MEJA ---------------- */
const PageTables = {
  sessions: [],
  async render() {
    const view = document.getElementById('view');
    view.innerHTML = `
      <div class="toolbar">
        <div class="legend">
          <span><i class="dot t-empty"></i>Kosong</span><span><i class="dot t-new"></i>Pesanan baru</span>
          <span><i class="dot t-prep"></i>Disiapkan</span><span><i class="dot t-bill"></i>Menunggu bayar</span>
        </div>
        <div class="grow"></div>
        <button class="btn" id="t-refresh">${icon('refresh')}<span class="hide-md">Muat ulang</span></button>
      </div>
      <div class="table-grid" id="tg"><div class="loading"><div class="spinner"></div></div></div>
      <h3 class="section-h">${icon('bag')} Bungkus belum dibayar</h3>
      <div class="ta-list" id="ta"></div>`;
    view.querySelector('#t-refresh').onclick = () => this.refresh();
    await this.refresh();
  },
  onLive(tables) { if (tables.has('orders') || tables.has('table_sessions')) this.refresh(); },
  async refresh() {
    try { this.sessions = await DB.openSessions(); this.paint(); }
    catch (e) { const tg = document.getElementById('tg'); if (tg) tg.innerHTML = errorBox(e); }
  },
  live(s) { return (s.orders || []).filter(o => !['rejected', 'void'].includes(o.status)); },
  stateOf(s) {
    const os = this.live(s);
    if (!os.length) return 'empty';
    if (os.some(o => o.status === 'new')) return 'new';
    if (os.some(o => o.status === 'preparing')) return 'prep';
    return 'bill';
  },
  paint() {
    const tg = document.getElementById('tg'); if (!tg) return;
    const tables = DB.c.tables.filter(t => t.active);
    tg.innerHTML = tables.map(t => {
      const s = this.sessions.find(x => x.table_id === t.id);
      const st = s ? this.stateOf(s) : 'empty';
      const os = s ? this.live(s) : [];
      const names = [...new Set(os.map(o => o.customer_name).filter(Boolean))];
      return `<button class="tcard t-${st}" data-t="${t.id}">
        <div class="tno">Meja <b>${t.id}</b></div>
        ${st === 'empty' ? `<div class="tsub muted">Kosong</div>` : `
          <div class="ttotal num">${rp(os.reduce((a, o) => a + o.total, 0))}</div>
          <div class="tsub">${os.length} pesanan · ${esc(names.slice(0, 2).join(', '))}${names.length > 2 ? '…' : ''}</div>
          <div class="tsince muted">sejak ${fmtTime(s.opened_at)}</div>`}
        <span class="tstate">${{ empty: '', new: '🔔 Baru', prep: '🔥 Dimasak', bill: '💰 Bayar' }[st]}</span>
      </button>`;
    }).join('');
    tg.querySelectorAll('[data-t]').forEach(b => b.onclick = () => this.open(Number(b.dataset.t)));

    const ta = document.getElementById('ta');
    const take = this.sessions.filter(s => !s.table_id && this.live(s).length);
    ta.innerHTML = take.length ? take.map(s => {
      const os = this.live(s);
      return `<button class="list-item tap card" data-s="${s.id}" style="margin-bottom:8px">
        <div class="emoji-box">${icon('bag')}</div>
        <div class="grow"><b>${esc(os[0]?.customer_name || 'Bungkus')}</b> <span class="badge ${STATUS_TONE[os[0]?.status] || ''}">${STATUS_LABEL[os[0]?.status] || ''}</span>
          <div class="muted" style="font-size:13px">${esc(os.map(o => o.code).join(', '))} · ${fmtTime(s.opened_at)}</div></div>
        <b class="num">${rp(os.reduce((a, o) => a + o.total, 0))}</b></button>`;
    }).join('') : `<p class="muted">Tidak ada pesanan bungkus yang menunggu bayar.</p>`;
    ta.querySelectorAll('[data-s]').forEach(b => b.onclick = () => this.openSession(b.dataset.s));
  },
  open(tableNo) {
    const s = this.sessions.find(x => x.table_id === tableNo);
    if (!s) return this.emptyTable(tableNo);
    this.openSession(s.id);
  },
  emptyTable(no) {
    const m = Modal.open({
      title: `Meja ${no}`, size: 'sm',
      body: `<div class="empty" style="padding:20px"><div class="em">🪑</div><b>Meja kosong</b><span>Pelanggan bisa scan QR di meja, atau tambahkan pesanan dari kasir.</span></div>`,
      foot: `<button class="btn" data-close>Tutup</button><button class="btn btn-primary" data-add>${icon('plus')} Tambah Pesanan</button>`,
      onMount: el => el.querySelector('[data-add]').onclick = () => { Modal.close(m); PagePOS.startForTable(no); },
    });
  },
  openSession(id) {
    const s = this.sessions.find(x => x.id === id); if (!s) return;
    const os = this.live(s);
    const total = os.reduce((a, o) => a + o.total, 0);
    const pending = os.filter(o => o.status === 'new');
    const title = s.table_id ? `Meja ${s.table_id}` : `Bungkus — ${esc(os[0]?.customer_name || '')}`;
    const m = Modal.open({
      title, size: 'lg',
      body: `<div class="bill">
        ${os.map(o => `<div class="bill-order">
          <div class="row between"><div><b>${esc(o.code)}</b> · ${esc(o.customer_name || '-')} <span class="badge ${STATUS_TONE[o.status]}">${STATUS_LABEL[o.status]}</span></div>
            <span class="muted" style="font-size:13px">${fmtTime(o.created_at)}</span></div>
          ${(o.order_items || []).map(i => `<div class="bill-line"><span>${i.qty}× ${esc(i.name)}${i.note ? ` <i class="muted">(${esc(i.note)})</i>` : ''}</span><span class="num">${rp(i.qty * i.price)}</span></div>`).join('')}
        </div>`).join('')}
        <div class="sumrow total" style="margin-top:12px"><span>Total tagihan</span><b class="num">${rp(total)}</b></div>
        ${pending.length ? `<p class="warn-line">${icon('alert')} ${pending.length} pesanan belum dikonfirmasi. Siapkan atau tolak dulu di halaman Pesanan sebelum bayar.</p>` : ''}
      </div>`,
      foot: `${s.table_id ? `<button class="btn btn-danger" data-clear>${icon('trash')} Kosongkan</button>
               <button class="btn" data-add>${icon('plus')} Tambah</button>` : `<button class="btn btn-danger" data-voidta>${icon('trash')} Batalkan</button>`}
             <button class="btn btn-primary btn-lg" data-pay ${pending.length || !total ? 'disabled' : ''}>${icon('cash')} Bayar ${rp(total)}</button>`,
      onMount: el => {
        el.querySelector('[data-pay]').onclick = () => { Modal.close(m); payDialog({ total, title, onPay: (method, paid, disc) => DB.checkout(s.id, method, paid, disc), receipt: { session: s, orders: os } }).then(ok => ok && this.refresh()); };
        el.querySelector('[data-add]')?.addEventListener('click', () => { Modal.close(m); PagePOS.startForTable(s.table_id); });
        el.querySelector('[data-clear]')?.addEventListener('click', async () => {
          if (!(await confirmDialog({ title: `Kosongkan Meja ${s.table_id}?`, message: 'Semua pesanan di meja ini dibatalkan dan stok ayam dikembalikan. Pakai ini kalau pelanggan pergi / batal.', okText: 'Kosongkan', danger: true }))) return;
          try { await DB.clearTable(s.table_id); toast(`Meja ${s.table_id} dikosongkan`); Modal.close(m); this.refresh(); } catch (e) { toast(e.message, 'error'); }
        });
        el.querySelector('[data-voidta]')?.addEventListener('click', async () => {
          if (!(await confirmDialog({ title: 'Batalkan pesanan bungkus?', message: 'Stok ayam dikembalikan.', okText: 'Batalkan', danger: true }))) return;
          try { await DB.voidSession(s.id, 'Bungkus dibatalkan'); toast('Dibatalkan'); Modal.close(m); this.refresh(); } catch (e) { toast(e.message, 'error'); }
        });
      },
    });
  },
};

/* ===========================================================
   Payment dialog (shared: tagihan meja & kasir langsung)
   onPay(method, paid, discount) -> {total, change}
   =========================================================== */
function payDialog({ total, title = 'Pembayaran', onPay, allowDiscount = true, receipt }) {
  return new Promise(resolve => {
    let method = 'cash', cash = '', disc = 0, finished = false;
    const net = () => Math.max(0, total - disc);
    const quick = () => [...new Set([net(), Math.ceil(net() / 5000) * 5000, Math.ceil(net() / 10000) * 10000, Math.ceil(net() / 50000) * 50000, 100000])].filter(v => v >= net()).slice(0, 4);
    const m = Modal.open({
      title, size: 'lg',
      body: `<div class="pay-grid">
          <div class="stack">
            <div class="pay-total"><div class="lbl">TOTAL TAGIHAN</div><div class="val num" id="pt"></div><div class="muted" id="pdisc" style="font-size:13px"></div></div>
            <div class="methods two">
              <button class="method" data-m="cash">${icon('cash')}Tunai</button>
              <button class="method" data-m="qris">${icon('qr')}QRIS</button>
            </div>
            <div id="pay-cash-quick" class="quick"></div>
            ${allowDiscount ? `<button class="btn btn-ghost btn-sm" id="pdisc-btn" style="align-self:flex-start">${icon('tag')} Diskon</button>` : ''}
          </div>
          <div class="stack" id="pay-right"></div>
        </div>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary btn-lg" id="pay-ok" style="min-width:220px">${icon('check')} Selesaikan</button>`,
      onMount: async (el, ctx) => {
        const ok = el.querySelector('#pay-ok');
        const right = el.querySelector('#pay-right');
        let qrisUrl = null; const qrisP = DB.qrisUrl().then(u => { qrisUrl = u; if (method === 'qris') paintRight(); });
        const paintRight = () => {
          if (method === 'cash') {
            right.innerHTML = `<div class="cash-display num" id="cash-disp">Rp 0</div>
              <div class="numpad" id="pay-pad">${['1','2','3','4','5','6','7','8','9','000','0','B'].map(k => `<button data-k="${k}">${k === 'B' ? icon('backspace') : k}</button>`).join('')}</div>
              <div class="change" id="change"></div>`;
            right.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
              const k = b.dataset.k;
              if (k === 'B') cash = cash.slice(0, -1);
              else if ((cash + k).length <= 9) cash = cash === '' && k.startsWith('0') ? '' : cash + k;
              paint();
            });
          } else {
            right.innerHTML = `<div class="qris-box">
              ${qrisUrl ? `<img src="${esc(qrisUrl)}" alt="QRIS warung">` : `<div class="empty" style="padding:18px"><div class="em">🖼️</div><b>Gambar QRIS belum diunggah</b><span>Owner bisa unggah di Pengaturan → QRIS. Pelanggan tetap bisa scan stiker QRIS di meja kasir.</span></div>`}
              <div class="qris-amt">Bayar <b class="num">${rp(net())}</b></div>
              <p class="muted" style="font-size:13px;text-align:center">Cek notifikasi dana masuk di HP / aplikasi bank, lalu tekan <b>Sudah Diterima</b>.</p></div>`;
          }
          paint();
        };
        const paint = () => {
          el.querySelector('#pt').textContent = rp(net());
          el.querySelector('#pdisc').textContent = disc ? `Diskon ${rp(disc)} dari ${rp(total)}` : '';
          el.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('active', b.dataset.m === method));
          const qz = el.querySelector('#pay-cash-quick');
          qz.classList.toggle('hidden', method !== 'cash');
          qz.innerHTML = quick().map((a, i) => `<button class="btn btn-outline ${toInt(cash) === a ? 'active' : ''}" data-q="${a}">${i === 0 ? 'Uang Pas' : rp(a)}</button>`).join('');
          qz.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { cash = b.dataset.q; paint(); });
          if (method === 'cash') {
            const paid = toInt(cash), diff = paid - net();
            const d = el.querySelector('#cash-disp'); if (d) d.textContent = rp(paid);
            const c = el.querySelector('#change');
            if (c) { c.className = 'change' + (diff < 0 ? ' short' : ''); c.innerHTML = diff < 0 ? `<span>Kurang</span><span class="num">${rp(-diff)}</span>` : `<span>Kembalian</span><span class="num">${rp(diff)}</span>`; }
            ok.disabled = paid < net();
            ok.innerHTML = `${icon('check')} Selesaikan`;
          } else { ok.disabled = false; ok.innerHTML = `${icon('check')} Sudah Diterima`; }
        };
        el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { method = b.dataset.m; paintRight(); });
        el.querySelector('#pdisc-btn')?.addEventListener('click', async () => {
          const v = await askDiscount(total, disc); if (v === null) return;
          disc = v; cash = ''; paint();
        });
        ctx._key = e => {
          if (Modal.stack[Modal.stack.length - 1] !== ctx || method !== 'cash') return;
          if (/^\d$/.test(e.key)) { if (cash.length < 9 && !(cash === '' && e.key === '0')) cash += e.key; paint(); }
          else if (e.key === 'Backspace') { cash = cash.slice(0, -1); paint(); }
          else if (e.key === 'Enter' && !ok.disabled) ok.click();
        };
        document.addEventListener('keydown', ctx._key);
        ctx.onClose = () => { document.removeEventListener('keydown', ctx._key); if (!finished) resolve(false); };
        ok.onclick = async () => {
          if (ok.disabled) return;
          ok.disabled = true; ok.innerHTML = 'Memproses…';
          try {
            const paid = method === 'cash' ? toInt(cash) : net();
            const r = await onPay(method, paid, disc);
            finished = true; Modal.close(ctx); resolve(true);
            toast('Pembayaran berhasil 💰');
            showPaidReceipt({ ...receipt, method, paid, total: r?.total ?? net(), change: r?.change ?? (paid - net()), discount: disc, code: r?.order_code });
          } catch (e) { toast(e.message, 'error'); ok.disabled = false; paint(); }
        };
        paintRight();
        await qrisP;
      },
    });
  });
}

function askDiscount(subtotal, current = 0) {
  return new Promise(resolve => {
    let done = false, type = 'nominal';
    const m = Modal.open({
      title: 'Diskon', size: 'sm',
      body: `<div class="stack">
        <div class="seg" style="align-self:flex-start"><button data-t="nominal">Rupiah</button><button data-t="percent">Persen</button></div>
        <input class="input" id="di" inputmode="numeric" autofocus value="${current || ''}">
        <div class="chips wrap" id="dq"></div><p class="muted" style="font-size:13px">Tagihan: ${rp(subtotal)}</p></div>`,
      foot: `<button class="btn" data-rm>Tanpa Diskon</button><button class="btn btn-primary" data-ok>Terapkan</button>`,
      onMount: el => {
        const inp = el.querySelector('#di');
        const paint = () => {
          el.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('active', b.dataset.t === type));
          const opts = type === 'percent' ? [5, 10, 20, 50] : [1000, 2000, 5000, 10000];
          el.querySelector('#dq').innerHTML = opts.map(o => `<button class="chip" data-v="${o}">${type === 'percent' ? o + '%' : rp(o)}</button>`).join('');
          el.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { inp.value = b.dataset.v; });
        };
        el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { type = b.dataset.t; inp.value = ''; paint(); });
        paint();
        el.querySelector('[data-rm]').onclick = () => { done = true; resolve(0); Modal.close(m); };
        el.querySelector('[data-ok]').onclick = () => {
          let v = Math.max(0, toInt(inp.value));
          if (type === 'percent') { if (v > 100) return toast('Persen maksimal 100', 'error'); v = Math.round(subtotal * v / 100); }
          done = true; resolve(Math.min(v, subtotal)); Modal.close(m);
        };
      },
    });
    m.onClose = () => { if (!done) resolve(null); };
  });
}

/* ---------------- Receipt ---------------- */
function receiptHTML({ orders = [], method, paid, total, change, discount = 0, code, tableNo, date, status, cashier }) {
  const s = DB.settings();
  const items = orders.flatMap(o => o.order_items || []);
  const sub = items.reduce((a, i) => a + i.qty * i.price, 0);
  const tno = tableNo ?? orders[0]?.table_id;
  return `<div class="receipt">
    <div class="c big">${esc(s.store_name)}</div>
    ${s.address ? `<div class="c">${esc(s.address)}</div>` : ''}${s.phone ? `<div class="c">${esc(s.phone)}</div>` : ''}
    <hr>
    <div class="r"><span>${esc(code || orders.map(o => o.code).join(','))}</span><span>${fmtDate(date || new Date(), { month: '2-digit' })} ${fmtTime(date || new Date())}</span></div>
    <div class="r"><span>${tno ? `Meja ${tno}` : 'Bungkus'}</span><span>Kasir: ${esc(cashier || Auth.user()?.name || '-')}</span></div>
    <hr>
    ${items.map(i => `<div>${esc(i.name)}</div>${i.note ? `<div>&nbsp;&nbsp;* ${esc(i.note)}</div>` : ''}
      <div class="r"><span>&nbsp;&nbsp;${i.qty} x ${i.price.toLocaleString('id-ID')}</span><span>${(i.qty * i.price).toLocaleString('id-ID')}</span></div>`).join('')}
    <hr>
    <div class="r"><span>Subtotal</span><span>${sub.toLocaleString('id-ID')}</span></div>
    ${discount ? `<div class="r"><span>Diskon</span><span>-${discount.toLocaleString('id-ID')}</span></div>` : ''}
    <div class="r big"><span>TOTAL</span><span>${rp(total)}</span></div>
    <div class="r"><span>${METHOD_LABEL[method] || method || '-'}</span><span>${(paid || 0).toLocaleString('id-ID')}</span></div>
    ${method === 'cash' ? `<div class="r"><span>Kembali</span><span>${(change || 0).toLocaleString('id-ID')}</span></div>` : ''}
    ${status === 'void' ? `<div class="void-stamp">BATAL</div>` : ''}
    <hr><div class="c">${esc(s.receipt_footer || 'Terima kasih!')}</div>
  </div>`;
}
function printReceipt(html, { page = '58mm auto', cls = '' } = {}) {
  let pa = document.getElementById('print-area');
  if (!pa) { pa = document.createElement('div'); pa.id = 'print-area'; document.body.appendChild(pa); }
  pa.className = cls;
  pa.innerHTML = html;
  let st = document.getElementById('print-page');
  if (!st) { st = document.createElement('style'); st.id = 'print-page'; document.head.appendChild(st); }
  st.textContent = `@media print { @page { size: ${page}; margin: ${page.startsWith('A4') ? '12mm' : '2mm'}; } }`;
  setTimeout(() => window.print(), 50);
}
function showPaidReceipt(r) {
  const html = receiptHTML(r);
  Modal.open({
    title: `${icon('check')} Lunas`, size: 'sm',
    body: `${r.method === 'cash' ? `<div class="change" style="margin-bottom:14px"><span>Kembalian</span><span class="num" style="font-size:22px">${rp(r.change)}</span></div>` : ''}${html}`,
    foot: `<button class="btn" data-print>${icon('print')} Cetak</button><button class="btn btn-primary" data-close>Selesai</button>`,
    onMount: el => el.querySelector('[data-print]').onclick = () => printReceipt(html),
  });
}
