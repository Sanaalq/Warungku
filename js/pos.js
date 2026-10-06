/* ===========================================================
   POS / Kasir
   =========================================================== */
const PagePOS = {
  cat: 'Semua', q: '',
  get cart() {
    return Store.get('cart_draft', null) || { items: [], orderType: 'dine_in', customer: '', discount: { type: 'nominal', value: 0 } };
  },
  saveCart(c) { Store.set('cart_draft', c); },

  totals(c = this.cart) {
    const s = DB.settings();
    const subtotal = c.items.reduce((a, i) => a + i.price * i.qty, 0);
    let discount = c.discount.type === 'percent'
      ? Math.round(subtotal * Math.min(100, Math.max(0, c.discount.value)) / 100)
      : Math.max(0, toInt(c.discount.value));
    discount = Math.min(discount, subtotal);
    const base = subtotal - discount;
    const service = s.serviceEnabled ? Math.round(base * s.serviceRate / 100) : 0;
    const tax = s.taxEnabled ? Math.round((base + service) * s.taxRate / 100) : 0;
    const qty = c.items.reduce((a, i) => a + i.qty, 0);
    return { subtotal, discount, service, tax, total: base + service + tax, qty };
  },

  render() {
    const view = document.getElementById('view');
    const cats = ['Semua', ...DB.categories()];
    view.innerHTML = `
      <div class="pos">
        <div class="catalog">
          <div class="catalog-head">
            <div class="input-icon grow">${icon('search')}
              <input class="input" id="pos-q" placeholder="Cari menu atau SKU…" value="${esc(this.q)}" autocomplete="off" enterkeyhint="search">
            </div>
            <button class="btn" id="pos-held">${icon('clock')}<span class="hide-sm">Tertunda</span><span class="badge primary" id="held-n"></span></button>
          </div>
          <div class="chips" id="pos-cats">
            ${cats.map(c => `<button class="chip ${c === this.cat ? 'active' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}
          </div>
          <div class="product-grid" id="pos-grid"></div>
        </div>
        <div class="cart-scrim" id="cart-scrim"></div>
        <aside class="cart" id="cart"></aside>
        <button class="cart-bar" id="cart-bar"></button>
      </div>`;

    const q = view.querySelector('#pos-q');
    q.oninput = () => { this.q = q.value; this.renderGrid(); };
    q.onkeydown = e => {
      if (e.key === 'Enter') {
        const list = this.filtered();
        if (list.length === 1) { this.add(list[0].id); q.select(); }
      }
    };
    view.querySelectorAll('#pos-cats [data-c]').forEach(b => b.onclick = () => {
      this.cat = b.dataset.c;
      view.querySelectorAll('#pos-cats .chip').forEach(x => x.classList.toggle('active', x === b));
      this.renderGrid();
    });
    view.querySelector('#pos-held').onclick = () => this.showHeld();
    view.querySelector('#cart-bar').onclick = () => this.sheet(true);
    view.querySelector('#cart-scrim').onclick = () => this.sheet(false);
    view.querySelector('#pos-grid').addEventListener('click', e => {
      const card = e.target.closest('[data-p]');
      if (card) this.add(card.dataset.p);
    });
    this.renderGrid();
    this.renderCart();
  },

  sheet(open) {
    document.getElementById('cart')?.classList.toggle('open', open);
    document.getElementById('cart-scrim')?.classList.toggle('show', open);
  },

  filtered() {
    const q = this.q.trim().toLowerCase();
    return DB.products().filter(p => p.active !== false
      && (this.cat === 'Semua' || p.category === this.cat)
      && (!q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)));
  },

  renderGrid() {
    const grid = document.getElementById('pos-grid'); if (!grid) return;
    const list = this.filtered();
    const inCart = Object.fromEntries(this.cart.items.map(i => [i.productId, i.qty]));
    grid.innerHTML = list.length ? list.map(p => {
      const sold = p.trackStock && p.stock <= 0;
      const low = p.trackStock && p.stock <= p.minStock;
      return `<button class="pcard ${sold ? 'soldout' : ''}" data-p="${p.id}">
        ${inCart[p.id] ? `<span class="p-qty">${inCart[p.id]}</span>` : ''}
        <div class="p-emoji">${esc(p.emoji)}</div>
        <div class="p-name">${esc(p.name)}</div>
        <div class="p-price num">${rp(p.price)}</div>
        <div class="p-stock ${low ? 'low' : ''}">${p.trackStock ? `Stok ${p.stock}` : 'Stok ∞'}</div>
      </button>`;
    }).join('') : `<div class="empty" style="grid-column:1/-1"><div class="em">🔍</div><b>Menu tidak ditemukan</b><span>Coba kata kunci atau kategori lain</span></div>`;
  },

  add(pid) {
    const p = DB.product(pid); if (!p) return;
    const c = this.cart;
    const it = c.items.find(i => i.productId === pid && !i.note);
    const totalQty = c.items.filter(i => i.productId === pid).reduce((a, i) => a + i.qty, 0);
    if (p.trackStock && totalQty + 1 > p.stock) { toast(`Stok ${p.name} tinggal ${p.stock}`, 'warning'); return; }
    if (it) it.qty++;
    else c.items.push({ key: uid('c'), productId: p.id, name: p.name, emoji: p.emoji, price: p.price, qty: 1, note: '' });
    this.saveCart(c);
    this.renderCart(); this.renderGrid();
    navigator.vibrate?.(10);
  },

  setQty(key, qty) {
    const c = this.cart;
    const it = c.items.find(i => i.key === key); if (!it) return;
    const p = DB.product(it.productId);
    if (qty > it.qty && p && p.trackStock) {
      const others = c.items.filter(i => i.productId === it.productId && i.key !== key).reduce((a, i) => a + i.qty, 0);
      if (others + qty > p.stock) { toast(`Stok ${p.name} tinggal ${p.stock}`, 'warning'); return; }
    }
    if (qty <= 0) c.items = c.items.filter(i => i.key !== key); else it.qty = qty;
    this.saveCart(c);
    this.renderCart(); this.renderGrid();
  },

  renderCart() {
    const el = document.getElementById('cart'); if (!el) return;
    const c = this.cart; const t = this.totals(c);
    const s = DB.settings();
    el.innerHTML = `
      <div class="cart-head">
        <div class="sheet-handle"></div>
        <div class="row between">
          <b style="font-size:17px">Pesanan <span class="muted num" style="font-weight:600">· ${t.qty} pcs</span></b>
          <div class="row" style="gap:6px">
            ${c.items.length ? `<button class="btn btn-ghost btn-sm" data-a="clear" style="color:var(--danger)">${icon('trash')} Kosongkan</button>` : ''}
            <button class="icon-btn sm sheet-close" data-a="close" aria-label="Tutup keranjang">${icon('down')}</button>
          </div>
        </div>
        <div class="row">
          <div class="seg">
            <button class="${c.orderType === 'dine_in' ? 'active' : ''}" data-ot="dine_in">Makan Sini</button>
            <button class="${c.orderType === 'take_away' ? 'active' : ''}" data-ot="take_away">Bungkus</button>
          </div>
          <input class="input grow" style="min-height:42px" data-a="cust" placeholder="Nama / meja" value="${esc(c.customer)}" maxlength="40">
        </div>
      </div>
      <div class="cart-list">
        ${c.items.length ? c.items.map(i => `
          <div class="citem">
            <button class="c-info" data-note="${i.key}" title="Ketuk untuk catatan">
              <div class="c-name">${esc(i.name)}</div>
              <div class="c-price num">${rp(i.price)} ${i.note ? `· <span class="c-note">${icon('note')} ${esc(i.note)}</span>` : `· <span class="c-addnote">+ catatan</span>`}</div>
            </button>
            <div class="stepper">
              <button data-dec="${i.key}" class="${i.qty === 1 ? 'del' : ''}" aria-label="Kurangi">${icon(i.qty === 1 ? 'trash' : 'minus')}</button>
              <span class="num">${i.qty}</span>
              <button data-inc="${i.key}" aria-label="Tambah">${icon('plus')}</button>
            </div>
            <div class="c-total num">${rp(i.price * i.qty)}</div>
          </div>`).join('') : `<div class="empty"><div class="em">🧾</div><b>Belum ada pesanan</b><span>Ketuk menu untuk menambahkan</span></div>`}
      </div>
      <div class="cart-foot">
        <div class="sumrow"><span>Subtotal</span><b class="num">${rp(t.subtotal)}</b></div>
        <div class="sumrow"><span>Diskon ${c.discount.type === 'percent' && c.discount.value ? `(${c.discount.value}%)` : ''}</span><b class="num" style="${t.discount ? 'color:var(--danger)' : ''}">${t.discount ? '-' + rp(t.discount) : '—'}</b></div>
        ${s.serviceEnabled ? `<div class="sumrow"><span>Service ${s.serviceRate}%</span><b class="num">${rp(t.service)}</b></div>` : ''}
        ${s.taxEnabled ? `<div class="sumrow"><span>Pajak ${s.taxRate}%</span><b class="num">${rp(t.tax)}</b></div>` : ''}
        <div class="sumrow total"><span>Total</span><b class="num">${rp(t.total)}</b></div>
        <div class="cart-actions">
          <button class="btn" data-a="hold" ${c.items.length ? '' : 'disabled'} title="Tunda pesanan" aria-label="Tunda pesanan">${icon('pause')}<span class="hide-md">Tunda</span></button>
          <button class="btn" data-a="disc" ${c.items.length ? '' : 'disabled'} title="Diskon" aria-label="Diskon">${icon('tag')}<span class="hide-md">Diskon</span></button>
          <button class="btn btn-primary btn-lg pay-btn" data-a="pay" ${c.items.length ? '' : 'disabled'}><span>Bayar</span><b class="num">${rp(t.total)}</b></button>
        </div>
      </div>`;

    el.querySelectorAll('[data-ot]').forEach(b => b.onclick = () => { const x = this.cart; x.orderType = b.dataset.ot; this.saveCart(x); this.renderCart(); });
    const cust = el.querySelector('[data-a=cust]');
    cust.onchange = () => { const x = this.cart; x.customer = cust.value.trim(); this.saveCart(x); };
    el.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => { const i = this.cart.items.find(x => x.key === b.dataset.inc); i && this.setQty(i.key, i.qty + 1); });
    el.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => { const i = this.cart.items.find(x => x.key === b.dataset.dec); i && this.setQty(i.key, i.qty - 1); });
    el.querySelectorAll('[data-note]').forEach(b => b.onclick = () => this.editNote(b.dataset.note));
    el.querySelector('[data-a=close]').onclick = () => this.sheet(false);
    el.querySelector('[data-a=hold]').onclick = () => this.hold();
    el.querySelector('[data-a=disc]').onclick = () => this.editDiscount();
    el.querySelector('[data-a=pay]').onclick = () => this.pay();
    el.querySelector('[data-a=clear]')?.addEventListener('click', async () => {
      if (await confirmDialog({ title: 'Kosongkan pesanan?', message: 'Semua item di keranjang akan dihapus.', okText: 'Kosongkan', danger: true })) this.reset();
    });

    // bottom bar (tablet portrait)
    const bar = document.getElementById('cart-bar');
    if (bar) {
      bar.innerHTML = `<span>${icon('cart')} ${t.qty} item</span><span class="num">${rp(t.total)} ${icon('up')}</span>`;
      bar.style.display = '';
      bar.classList.toggle('hidden', t.qty === 0);
    }
    const hn = document.getElementById('held-n');
    if (hn) { const n = DB.held().length; hn.textContent = n || ''; hn.classList.toggle('hidden', !n); }
  },

  reset() {
    Store.remove('cart_draft');
    this.renderCart(); this.renderGrid(); this.sheet(false);
  },

  editNote(key) {
    const it = this.cart.items.find(i => i.key === key); if (!it) return;
    const presets = ['Pedas', 'Tidak pedas', 'Tanpa sambal', 'Es sedikit', 'Dibungkus terpisah'];
    const m = Modal.open({
      title: `Catatan — ${esc(it.name)}`, size: 'sm',
      body: `<div class="stack">
        <input class="input" id="note-in" value="${esc(it.note)}" maxlength="60" placeholder="Contoh: level 3, tanpa timun" autofocus>
        <div class="chips wrap">${presets.map(p => `<button class="chip" data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div></div>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary" data-ok>Simpan</button>`,
      onMount: el => {
        const inp = el.querySelector('#note-in');
        el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { inp.value = inp.value ? `${inp.value}, ${b.dataset.p}` : b.dataset.p; });
        el.querySelector('[data-ok]').onclick = () => {
          const c = this.cart; const x = c.items.find(i => i.key === key);
          if (x) {
            x.note = inp.value.trim();
            // merge with identical line
            const dup = c.items.find(i => i !== x && i.productId === x.productId && i.note === x.note);
            if (dup) { dup.qty += x.qty; c.items = c.items.filter(i => i !== x); }
          }
          this.saveCart(c); this.renderCart(); Modal.close(m);
        };
      },
    });
  },

  editDiscount() {
    const c = this.cart; const t = this.totals(c);
    let type = c.discount.type;
    const m = Modal.open({
      title: 'Diskon', size: 'sm',
      body: `<div class="stack">
        <div class="seg" style="align-self:flex-start"><button data-t="nominal">Rupiah</button><button data-t="percent">Persen</button></div>
        <input class="input" id="disc-in" inputmode="numeric" autofocus>
        <div class="chips wrap" id="disc-quick"></div>
        <p class="muted" style="font-size:13px">Subtotal: ${rp(t.subtotal)}</p></div>`,
      foot: `<button class="btn" data-rm>Hapus Diskon</button><button class="btn btn-primary" data-ok>Terapkan</button>`,
      onMount: el => {
        const inp = el.querySelector('#disc-in');
        const quick = el.querySelector('#disc-quick');
        const paint = () => {
          el.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('active', b.dataset.t === type));
          const opts = type === 'percent' ? [5, 10, 15, 20, 50] : [2000, 5000, 10000, 20000];
          quick.innerHTML = opts.map(o => `<button class="chip" data-v="${o}">${type === 'percent' ? o + '%' : rp(o)}</button>`).join('');
          quick.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { inp.value = b.dataset.v; });
          inp.placeholder = type === 'percent' ? '0 - 100' : 'Nominal rupiah';
        };
        inp.value = c.discount.value || '';
        el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { type = b.dataset.t; inp.value = ''; paint(); });
        paint();
        el.querySelector('[data-rm]').onclick = () => { const x = this.cart; x.discount = { type: 'nominal', value: 0 }; this.saveCart(x); this.renderCart(); Modal.close(m); };
        el.querySelector('[data-ok]').onclick = () => {
          let v = Math.max(0, toInt(inp.value));
          if (type === 'percent' && v > 100) return toast('Persen maksimal 100', 'error');
          if (type === 'nominal' && v > t.subtotal) v = t.subtotal;
          const x = this.cart; x.discount = { type, value: v }; this.saveCart(x); this.renderCart(); Modal.close(m);
        };
      },
    });
  },

  hold() {
    const c = this.cart; if (!c.items.length) return;
    DB.hold({ ...c, label: c.customer || `Pesanan ${fmtTime(new Date())}` });
    this.reset();
    toast('Pesanan disimpan sementara');
  },

  showHeld() {
    const list = DB.held();
    const m = Modal.open({
      title: 'Pesanan Tertunda',
      body: list.length ? `<div class="list">${list.map(h => `
        <div class="list-item">
          <div class="emoji-box">${icon('clock')}</div>
          <div class="grow"><b>${esc(h.label)}</b><div class="muted" style="font-size:13px">${fmtTime(h.date)} · ${h.items.reduce((a, i) => a + i.qty, 0)} item · ${rp(this.totals(h).total)}</div></div>
          <button class="icon-btn sm" data-del="${h.id}" style="color:var(--danger)">${icon('trash')}</button>
          <button class="btn btn-primary btn-sm" data-open="${h.id}">Buka</button>
        </div>`).join('')}</div>` : `<div class="empty"><div class="em">⏸️</div><b>Tidak ada pesanan tertunda</b></div>`,
      onMount: el => {
        el.querySelectorAll('[data-open]').forEach(b => b.onclick = async () => {
          if (this.cart.items.length && !(await confirmDialog({ title: 'Ganti pesanan?', message: 'Keranjang saat ini akan disimpan ke daftar tertunda.', okText: 'Lanjut' }))) return;
          if (this.cart.items.length) DB.hold({ ...this.cart, label: this.cart.customer || `Pesanan ${fmtTime(new Date())}` });
          const o = DB.unhold(b.dataset.open);
          if (o) { const { id, date, label, ...cart } = o; this.saveCart(cart); }
          Modal.close(m); this.renderCart(); this.renderGrid();
        });
        el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
          if (!(await confirmDialog({ title: 'Hapus pesanan tertunda?', okText: 'Hapus', danger: true }))) return;
          DB.unhold(b.dataset.del); Modal.close(m); this.showHeld(); this.renderCart();
        });
      },
    });
  },

  /* ---------- Payment ---------- */
  pay() {
    const c = this.cart; if (!c.items.length) return;
    const t = this.totals(c);
    let method = 'cash';
    let cash = '';
    const quickAmts = [...new Set([t.total, Math.ceil(t.total / 5000) * 5000, Math.ceil(t.total / 10000) * 10000, Math.ceil(t.total / 50000) * 50000, Math.ceil(t.total / 100000) * 100000])].slice(0, 6);
    const methods = [['cash', 'Tunai', 'cash'], ['qris', 'QRIS', 'qr'], ['transfer', 'Transfer', 'bank'], ['ewallet', 'E-Wallet', 'phone']];

    const m = Modal.open({
      title: 'Pembayaran', size: 'lg',
      body: `<div class="pay-grid">
          <div class="stack">
            <div class="pay-total"><div class="lbl">TOTAL TAGIHAN</div><div class="val num">${rp(t.total)}</div></div>
            <div class="methods">${methods.map(([k, l, ic]) => `<button class="method" data-m="${k}">${icon(ic)}${l}</button>`).join('')}</div>
            <div id="pay-cash-quick" class="quick">${quickAmts.map((a, i) => `<button class="btn btn-outline" data-q="${a}">${i === 0 ? 'Uang Pas' : rp(a)}</button>`).join('')}</div>
            <div id="pay-info" class="muted" style="font-size:14px"></div>
          </div>
          <div class="stack" id="pay-right">
            <div class="cash-display num" id="cash-disp">Rp 0</div>
            <div class="numpad" id="pay-pad">
              ${['1','2','3','4','5','6','7','8','9','000','0','B'].map(k => `<button data-k="${k}">${k === 'B' ? icon('backspace') : k}</button>`).join('')}
            </div>
            <div class="change" id="change"></div>
          </div>
        </div>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary btn-lg" id="pay-ok" style="min-width:220px">${icon('check')} Selesaikan</button>`,
      onMount: (el, ctx) => {
        const disp = el.querySelector('#cash-disp');
        const chg = el.querySelector('#change');
        const ok = el.querySelector('#pay-ok');
        const paint = () => {
          el.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('active', b.dataset.m === method));
          const isCash = method === 'cash';
          el.querySelector('#pay-right').classList.toggle('hidden', !isCash);
          el.querySelector('#pay-cash-quick').classList.toggle('hidden', !isCash);
          el.querySelector('#pay-info').innerHTML = isCash ? '' :
            `${icon('info')} Pastikan pembayaran <b>${methods.find(x => x[0] === method)[1]}</b> sebesar <b>${rp(t.total)}</b> sudah diterima sebelum menekan Selesaikan.`;
          const paid = toInt(cash);
          disp.textContent = rp(paid);
          const diff = paid - t.total;
          chg.className = 'change' + (diff < 0 ? ' short' : '');
          chg.innerHTML = diff < 0 ? `<span>Kurang</span><span class="num">${rp(-diff)}</span>` : `<span>Kembalian</span><span class="num">${rp(diff)}</span>`;
          ok.disabled = isCash && paid < t.total;
          el.querySelectorAll('[data-q]').forEach(b => b.classList.toggle('active', toInt(b.dataset.q) === paid));
        };
        el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { method = b.dataset.m; paint(); });
        el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { cash = b.dataset.q; paint(); });
        el.querySelectorAll('#pay-pad [data-k]').forEach(b => b.onclick = () => {
          const k = b.dataset.k;
          if (k === 'B') cash = cash.slice(0, -1);
          else if ((cash + k).length <= 10) cash = (cash === '' || cash === '0') && k.startsWith('0') ? '' : cash + k;
          paint();
        });
        ctx._key = e => {
          if (Modal.stack[Modal.stack.length - 1] !== ctx) return;
          if (method !== 'cash') return;
          if (/^\d$/.test(e.key)) { if (cash.length < 10 && !(cash === '' && e.key === '0')) cash += e.key; paint(); }
          else if (e.key === 'Backspace') { cash = cash.slice(0, -1); paint(); }
          else if (e.key === 'Enter' && !ok.disabled) ok.click();
        };
        document.addEventListener('keydown', ctx._key);
        ctx.onClose = () => document.removeEventListener('keydown', ctx._key);
        ok.onclick = () => {
          if (ok.disabled) return;
          ok.disabled = true; // prevent double submit
          try {
            const paid = method === 'cash' ? toInt(cash) : t.total;
            const cart = this.cart;
            const trx = DB.checkout({
              items: cart.items.map(({ key, ...i }) => i),
              orderType: cart.orderType, customer: cart.customer,
              subtotal: t.subtotal, discount: t.discount, service: t.service, tax: t.tax, total: t.total,
              method, paid, change: paid - t.total,
            }, Auth.user());
            Modal.close(ctx);
            this.reset();
            this.lowStockWarn(trx);
            showReceipt(trx, { fresh: true });
          } catch (err) {
            toast(err.message, 'error');
            ok.disabled = false;
          }
        };
        paint();
      },
    });
  },

  lowStockWarn(trx) {
    if (!DB.settings().lowStockAlert) return;
    const ids = new Set(trx.items.map(i => i.productId));
    const low = DB.products().filter(p => ids.has(p.id) && p.trackStock && p.stock <= p.minStock);
    if (low.length) setTimeout(() => toast(`Stok menipis: ${low.map(p => `${p.name} (${p.stock})`).join(', ')}`, 'warning'), 600);
  },
};

/* ===========================================================
   Receipt (shared by POS & Transactions)
   =========================================================== */
const METHOD_LABEL = { cash: 'Tunai', qris: 'QRIS', transfer: 'Transfer', ewallet: 'E-Wallet' };

function receiptHTML(t) {
  const s = DB.settings();
  return `<div class="receipt">
    <div class="c big">${esc(s.storeName)}</div>
    <div class="c">${esc(s.address)}</div>
    <div class="c">${esc(s.phone)}</div>
    <hr>
    <div class="r"><span>${esc(t.invoice)}</span><span>${fmtDate(t.date, { month: '2-digit' })} ${fmtTime(t.date)}</span></div>
    <div class="r"><span>Kasir: ${esc(t.cashier)}</span><span>${t.orderType === 'take_away' ? 'Bungkus' : 'Makan Sini'}</span></div>
    ${t.customer ? `<div>Pelanggan: ${esc(t.customer)}</div>` : ''}
    <hr>
    ${t.items.map(i => `<div>${esc(i.name)}</div>
      ${i.note ? `<div>&nbsp;&nbsp;* ${esc(i.note)}</div>` : ''}
      <div class="r"><span>&nbsp;&nbsp;${i.qty} x ${(i.price).toLocaleString('id-ID')}</span><span>${(i.qty * i.price).toLocaleString('id-ID')}</span></div>`).join('')}
    <hr>
    <div class="r"><span>Subtotal</span><span>${t.subtotal.toLocaleString('id-ID')}</span></div>
    ${t.discount ? `<div class="r"><span>Diskon</span><span>-${t.discount.toLocaleString('id-ID')}</span></div>` : ''}
    ${t.service ? `<div class="r"><span>Service</span><span>${t.service.toLocaleString('id-ID')}</span></div>` : ''}
    ${t.tax ? `<div class="r"><span>Pajak</span><span>${t.tax.toLocaleString('id-ID')}</span></div>` : ''}
    <div class="r big"><span>TOTAL</span><span>${rp(t.total)}</span></div>
    <div class="r"><span>${METHOD_LABEL[t.method] || t.method}</span><span>${(t.paid).toLocaleString('id-ID')}</span></div>
    ${t.method === 'cash' ? `<div class="r"><span>Kembali</span><span>${(t.change).toLocaleString('id-ID')}</span></div>` : ''}
    ${t.status === 'void' ? `<div class="void-stamp">BATAL</div><div class="c">${esc(t.voidReason || '')}</div>` : ''}
    <hr>
    <div class="c">${esc(s.footer)}</div>
  </div>`;
}

function printReceipt(t) {
  let pa = document.getElementById('print-area');
  if (!pa) { pa = document.createElement('div'); pa.id = 'print-area'; document.body.appendChild(pa); }
  pa.innerHTML = receiptHTML(t);
  setTimeout(() => window.print(), 50);
}

function showReceipt(t, { fresh = false } = {}) {
  const m = Modal.open({
    title: fresh ? `${icon('check')} Transaksi Berhasil` : `Struk ${esc(t.invoice)}`,
    size: 'sm',
    body: `${fresh && t.method === 'cash' ? `<div class="change" style="margin-bottom:14px"><span>Kembalian</span><span class="num" style="font-size:22px">${rp(t.change)}</span></div>` : ''}${receiptHTML(t)}`,
    foot: `<button class="btn" data-print>${icon('print')} Cetak</button><button class="btn btn-primary" data-close>${fresh ? 'Pesanan Baru' : 'Tutup'}</button>`,
    onMount: el => el.querySelector('[data-print]').onclick = () => printReceipt(t),
  });
  return m;
}
