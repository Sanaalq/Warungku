/* ===========================================================
   Kasir: jual langsung (bayar sekarang) ATAU tambah ke tagihan meja
   =========================================================== */
const PagePOS = {
  cat: 0, q: '', target: null, // target = table no (number) when adding to a table bill

  get cart() { return Store.get('cart', null) || { items: [], orderType: 'take_away', customer: '' }; },
  saveCart(c) { Store.set('cart', c); },
  totals(c = this.cart) {
    const subtotal = c.items.reduce((a, i) => a + i.price * i.qty, 0);
    return { subtotal, total: subtotal, qty: c.items.reduce((a, i) => a + i.qty, 0) };
  },

  startForTable(no) { this.target = no; const c = this.cart; c.orderType = 'dine_in'; this.saveCart(c); location.hash = '#/pos'; if (location.hash === '#/pos') render(); },

  async render() {
    const view = document.getElementById('view');
    const cats = [{ id: 0, name: 'Semua' }, ...DB.categories()];
    view.innerHTML = `
      <div class="pos">
        <div class="catalog">
          <div class="catalog-head">
            <div class="input-icon grow">${icon('search')}
              <input class="input" id="pos-q" placeholder="Cari menu…" value="${esc(this.q)}" autocomplete="off" enterkeyhint="search">
            </div>
            <button class="btn" id="pos-held">${icon('clock')}<span class="hide-sm">Tertunda</span><span class="badge primary hidden" id="held-n"></span></button>
          </div>
          <div class="chips" id="pos-cats">
            ${cats.map(c => `<button class="chip ${c.id === this.cat ? 'active' : ''}" data-c="${c.id}">${esc(c.name)}</button>`).join('')}
          </div>
          <div class="product-grid" id="pos-grid"></div>
        </div>
        <div class="cart-scrim" id="cart-scrim"></div>
        <aside class="cart" id="cart"></aside>
        <button class="cart-bar hidden" id="cart-bar"></button>
      </div>`;
    const q = view.querySelector('#pos-q');
    q.oninput = () => { this.q = q.value; this.renderGrid(); };
    q.onkeydown = e => { if (e.key === 'Enter') { const l = this.filtered().filter(p => p.available); if (l.length === 1) { this.add(l[0].id); q.select(); } } };
    view.querySelectorAll('#pos-cats [data-c]').forEach(b => b.onclick = () => {
      this.cat = Number(b.dataset.c);
      view.querySelectorAll('#pos-cats .chip').forEach(x => x.classList.toggle('active', x === b));
      this.renderGrid();
    });
    view.querySelector('#pos-held').onclick = () => this.showHeld();
    view.querySelector('#cart-bar').onclick = () => this.sheet(true);
    view.querySelector('#cart-scrim').onclick = () => this.sheet(false);
    view.querySelector('#pos-grid').addEventListener('click', e => {
      const card = e.target.closest('[data-p]'); if (!card) return;
      if (e.target.closest('[data-soldout]')) return this.toggleSoldOut(Number(card.dataset.p));
      this.add(Number(card.dataset.p));
    });
    this.renderGrid();
    this.renderCart();
  },
  onLive(tables) { if (tables.has('ingredients') || tables.has('products')) { this.renderGrid(); this.clampCart(); } },
  refresh() { this.renderGrid(); this.clampCart(); },
  sheet(open) {
    document.getElementById('cart')?.classList.toggle('open', open);
    document.getElementById('cart-scrim')?.classList.toggle('show', open);
  },
  filtered() {
    const q = this.q.trim().toLowerCase();
    return DB.products().filter(p => p.active !== false
      && (!this.cat || p.category_id === this.cat)
      && (!q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)));
  },
  renderGrid() {
    const grid = document.getElementById('pos-grid'); if (!grid) return;
    const list = this.filtered();
    const items = this.cart.items;
    const inCart = items.reduce((a, i) => (a[i.productId] = (a[i.productId] || 0) + i.qty, a), {});
    grid.innerHTML = list.length ? list.map(p => {
      const left = DB.maxAddable(p.id, items);
      const sold = !p.available;
      const stockTxt = p.sold_out ? 'Ditandai habis' : p.remaining === null ? 'Tersedia' : `Sisa ${p.remaining}`;
      return `<button class="pcard ${sold ? 'soldout' : ''} ${!sold && left <= 0 ? 'maxed' : ''}" data-p="${p.id}">
        ${inCart[p.id] ? `<span class="p-qty">${inCart[p.id]}</span>` : ''}
        <div class="p-emoji">${esc(p.emoji)}</div>
        <div class="p-name">${esc(p.name)}</div>
        <div class="p-price num">${rp(p.price)}</div>
        <div class="p-stock ${p.low ? 'low' : ''}">${stockTxt}
          ${p.remaining === null ? `<span class="so-toggle" data-soldout title="Tandai habis / tersedia">${p.sold_out ? 'Tersedia?' : 'Habis?'}</span>` : ''}</div>
      </button>`;
    }).join('') : `<div class="empty" style="grid-column:1/-1"><div class="em">🔍</div><b>Menu tidak ditemukan</b></div>`;
  },
  async toggleSoldOut(pid) {
    const p = DB.product(pid); if (!p) return;
    const v = !p.sold_out;
    if (!(await confirmDialog({ title: v ? `Tandai ${esc(p.name)} habis?` : `${esc(p.name)} tersedia lagi?`, message: v ? 'Menu ini (dan paket yang memakainya) tidak bisa dipesan pelanggan.' : 'Menu bisa dipesan lagi.', okText: v ? 'Tandai Habis' : 'Tersedia', danger: v }))) return;
    try { await DB.setSoldOut(pid, v); toast(v ? `${p.name} ditandai habis` : `${p.name} tersedia`); this.renderGrid(); }
    catch (e) { toast(e.message, 'error'); }
  },
  add(pid) {
    const p = DB.product(pid); if (!p) return;
    if (!p.available) return toast(`${p.name} sedang habis`, 'warning');
    const c = this.cart;
    if (DB.maxAddable(pid, c.items) <= 0) return toast(`Stok ${p.name} tidak cukup`, 'warning');
    const it = c.items.find(i => i.productId === pid && !i.note);
    if (it) it.qty++;
    else c.items.push({ key: uid('c'), productId: p.id, name: p.name, emoji: p.emoji, price: p.price, qty: 1, note: '' });
    this.saveCart(c);
    this.renderCart(); this.renderGrid();
    navigator.vibrate?.(10);
  },
  setQty(key, qty) {
    const c = this.cart;
    const it = c.items.find(i => i.key === key); if (!it) return;
    if (qty > it.qty) {
      const others = c.items.filter(i => i.key !== key);
      if (DB.maxAddable(it.productId, [...others, { ...it, qty: qty - 1 }]) <= 0) return toast(`Stok ${it.name} tidak cukup`, 'warning');
    }
    if (qty <= 0) c.items = c.items.filter(i => i.key !== key); else it.qty = qty;
    this.saveCart(c);
    this.renderCart(); this.renderGrid();
  },
  /* after stock changes elsewhere, drop items that are no longer available */
  clampCart() {
    const c = this.cart; let changed = false;
    c.items.forEach(it => { const p = DB.product(it.productId); if (!p || p.active === false) { it.qty = 0; changed = true; } else it.price = p.price; });
    if (changed) { c.items = c.items.filter(i => i.qty > 0); this.saveCart(c); toast('Sebagian menu di keranjang sudah tidak tersedia', 'warning'); }
    this.renderCart();
  },
  renderCart() {
    const el = document.getElementById('cart'); if (!el) return;
    const c = this.cart; const t = this.totals(c);
    const forTable = this.target;
    el.innerHTML = `
      <div class="cart-head">
        <div class="sheet-handle"></div>
        <div class="row between">
          <b style="font-size:17px">${forTable ? `Tambah ke Meja ${forTable}` : 'Pesanan'} <span class="muted num" style="font-weight:600">· ${t.qty} pcs</span></b>
          <div class="row" style="gap:6px">
            ${c.items.length ? `<button class="btn btn-ghost btn-sm" data-a="clear" style="color:var(--danger)">${icon('trash')} Kosongkan</button>` : ''}
            <button class="icon-btn sm sheet-close" data-a="close" aria-label="Tutup keranjang">${icon('down')}</button>
          </div>
        </div>
        ${forTable ? `<div class="target-pill">${icon('table')} Masuk ke tagihan Meja ${forTable} · bayar nanti <button class="btn btn-ghost btn-sm" data-a="untarget">Batal</button></div>` : `
        <div class="row">
          <div class="seg">
            <button class="${c.orderType === 'take_away' ? 'active' : ''}" data-ot="take_away">Bungkus</button>
            <button class="${c.orderType === 'dine_in' ? 'active' : ''}" data-ot="dine_in">Makan Sini</button>
          </div>
          <input class="input grow" style="min-height:42px" data-a="cust" placeholder="Nama pelanggan" value="${esc(c.customer)}" maxlength="40">
        </div>
        ${c.orderType === 'dine_in' ? `<div class="row wrap" style="gap:6px"><span class="muted" style="font-size:13px">Pilih meja (bayar nanti):</span>${DB.c.tables.filter(x => x.active).map(x => `<button class="chip" data-tbl="${x.id}">Meja ${x.id}</button>`).join('')}</div>` : ''}`}
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
        <div class="sumrow total"><span>Total</span><b class="num">${rp(t.total)}</b></div>
        <div class="cart-actions">
          <button class="btn" data-a="hold" ${c.items.length && !forTable ? '' : 'disabled'} title="Tunda pesanan" aria-label="Tunda pesanan">${icon('pause')}<span class="hide-md">Tunda</span></button>
          ${forTable
            ? `<button class="btn btn-primary btn-lg pay-btn" data-a="send" ${c.items.length ? '' : 'disabled'} style="grid-column:2/4"><span>Kirim ke Meja ${forTable}</span><b class="num">${rp(t.total)}</b></button>`
            : `<button class="btn btn-primary btn-lg pay-btn" data-a="pay" ${c.items.length ? '' : 'disabled'} style="grid-column:2/4"><span>Bayar Sekarang</span><b class="num">${rp(t.total)}</b></button>`}
        </div>
      </div>`;
    el.querySelectorAll('[data-ot]').forEach(b => b.onclick = () => { const x = this.cart; x.orderType = b.dataset.ot; this.saveCart(x); this.renderCart(); });
    el.querySelectorAll('[data-tbl]').forEach(b => b.onclick = () => { this.target = Number(b.dataset.tbl); this.renderCart(); });
    const cust = el.querySelector('[data-a=cust]');
    if (cust) cust.onchange = () => { const x = this.cart; x.customer = cust.value.trim(); this.saveCart(x); };
    el.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => { const i = this.cart.items.find(x => x.key === b.dataset.inc); i && this.setQty(i.key, i.qty + 1); });
    el.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => { const i = this.cart.items.find(x => x.key === b.dataset.dec); i && this.setQty(i.key, i.qty - 1); });
    el.querySelectorAll('[data-note]').forEach(b => b.onclick = () => this.editNote(b.dataset.note));
    el.querySelector('[data-a=close]').onclick = () => this.sheet(false);
    el.querySelector('[data-a=untarget]')?.addEventListener('click', () => { this.target = null; this.renderCart(); });
    el.querySelector('[data-a=hold]').onclick = () => this.hold();
    el.querySelector('[data-a=pay]')?.addEventListener('click', () => this.pay());
    el.querySelector('[data-a=send]')?.addEventListener('click', e => this.sendToTable(e.currentTarget));
    el.querySelector('[data-a=clear]')?.addEventListener('click', async () => {
      if (await confirmDialog({ title: 'Kosongkan pesanan?', message: 'Semua item di keranjang akan dihapus.', okText: 'Kosongkan', danger: true })) this.reset();
    });
    const bar = document.getElementById('cart-bar');
    if (bar) { bar.innerHTML = `<span>${icon('cart')} ${t.qty} item</span><span class="num">${rp(t.total)} ${icon('up')}</span>`; bar.classList.toggle('hidden', t.qty === 0); }
    const hn = document.getElementById('held-n');
    if (hn) { const n = DB.held().length; hn.textContent = n || ''; hn.classList.toggle('hidden', !n); }
  },
  reset() { Store.remove('cart'); this.target = null; this.renderCart(); this.renderGrid(); this.sheet(false); },
  payload() { return this.cart.items.map(i => ({ product_id: i.productId, qty: i.qty, note: i.note || '' })); },

  async sendToTable(btn) {
    const c = this.cart; if (!c.items.length) return;
    btn.disabled = true;
    try {
      const r = await DB.staffOrder(this.target, c.customer || 'Kasir', 'dine_in', this.payload());
      toast(`Pesanan ${r.order_code} masuk ke Meja ${this.target}`);
      const no = this.target;
      this.reset(); await DB.reloadStock();
      location.hash = '#/tables';
      if (location.hash === '#/tables') render();
      void no;
    } catch (e) { toast(e.message, 'error'); btn.disabled = false; await DB.reloadStock().catch(() => {}); this.renderGrid(); }
  },

  pay() {
    const c = this.cart; if (!c.items.length) return;
    const t = this.totals(c);
    const snapshot = c.items.map(i => ({ name: i.name, qty: i.qty, price: i.price, note: i.note }));
    payDialog({
      total: t.total, title: 'Pembayaran',
      receipt: { orders: [{ table_id: null, order_items: snapshot }] },
      onPay: async (method, paid, disc) => {
        const r = await DB.posSale(this.payload(), c.orderType, method, paid, disc, c.customer);
        this.reset(); await DB.reloadStock(); this.renderGrid();
        return r;
      },
    }).catch(() => {});
  },

  editNote(key) {
    const it = this.cart.items.find(i => i.key === key); if (!it) return;
    const presets = ['Pedas', 'Tidak pedas', 'Tanpa sambal', 'Sambal dipisah', 'Es sedikit', 'Tanpa es'];
    const m = Modal.open({
      title: `Catatan — ${esc(it.name)}`, size: 'sm',
      body: `<div class="stack">
        <input class="input" id="note-in" value="${esc(it.note)}" maxlength="80" placeholder="Contoh: sambal dipisah" autofocus>
        <div class="chips wrap">${presets.map(p => `<button class="chip" data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div></div>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary" data-ok>Simpan</button>`,
      onMount: el => {
        const inp = el.querySelector('#note-in');
        el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { inp.value = inp.value ? `${inp.value}, ${b.dataset.p}` : b.dataset.p; });
        el.querySelector('[data-ok]').onclick = () => {
          const c = this.cart; const x = c.items.find(i => i.key === key);
          if (x) {
            x.note = inp.value.trim().slice(0, 80);
            const dup = c.items.find(i => i !== x && i.productId === x.productId && i.note === x.note);
            if (dup) { dup.qty += x.qty; c.items = c.items.filter(i => i !== x); }
          }
          this.saveCart(c); this.renderCart(); Modal.close(m);
        };
      },
    });
  },
  hold() {
    const c = this.cart; if (!c.items.length) return;
    DB.hold({ ...c, label: c.customer || `Pesanan ${fmtTime(new Date())}` });
    this.reset(); toast('Pesanan disimpan sementara');
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
          Modal.close(m); this.clampCart(); this.renderGrid();
        });
        el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
          if (!(await confirmDialog({ title: 'Hapus pesanan tertunda?', okText: 'Hapus', danger: true }))) return;
          DB.unhold(b.dataset.del); Modal.close(m); this.showHeld(); this.renderCart();
        });
      },
    });
  },
};
