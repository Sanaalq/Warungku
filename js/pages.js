/* ===========================================================
   Pages: Stok, Transaksi, Menu, Keuangan, Laporan, Pengaturan
   =========================================================== */
const EMOJIS = ['🔥','🍗','🍱','🍛','🍚','🌶️','🍜','🍲','🥗','🍳','🍔','🍟','🥟','🍢','🧋','🍊','🍵','☕','💧','🥤','🧃','🍦','🍰','🍪','✨','🥬','🍽️'];

function kpi(label, value, ic, tone, sub = '') {
  return `<div class="kpi"><div class="kpi-icon tone-${tone}">${icon(ic)}</div><div class="kpi-label">${label}</div><div class="kpi-value num">${value}</div>${sub ? `<div class="muted" style="font-size:12px">${sub}</div>` : ''}</div>`;
}
const RANGES = { today: 'Hari Ini', '7d': '7 Hari', '30d': '30 Hari', month: 'Bulan Ini' };
function rangeStart(r) {
  const d = startOfDay();
  if (r === '7d') d.setDate(d.getDate() - 6);
  else if (r === '30d') d.setDate(d.getDate() - 29);
  else if (r === 'month') d.setDate(1);
  return d;
}
function rangeSeg(cur) { return `<div class="seg">${Object.entries(RANGES).map(([k, l]) => `<button data-r="${k}" class="${k === cur ? 'active' : ''}">${l}</button>`).join('')}</div>`; }
function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function loadingView() { const v = document.getElementById('view'); if (v) v.innerHTML = `<div class="loading"><div class="spinner"></div></div>`; }

/* ---------------- STOK AYAM ---------------- */
const PageStock = {
  async render() {
    const view = document.getElementById('view');
    const ings = DB.ingredients();
    const low = ings.filter(i => i.stock <= i.min_stock).length;
    view.innerHTML = `
      <div class="kpis">
        ${kpi('Total potong tersedia', ings.reduce((a, i) => a + i.stock, 0), 'box', 'primary')}
        ${kpi('Stok menipis / habis', low, 'alert', low ? 'warning' : 'success')}
        ${kpi('Ayam bakar', ings.filter(i => /bakar/i.test(i.name)).reduce((a, i) => a + i.stock, 0), 'fire', 'danger')}
        ${kpi('Ayam goreng', ings.filter(i => /goreng/i.test(i.name)).reduce((a, i) => a + i.stock, 0), 'logo', 'warning')}
      </div>
      <div class="toolbar">
        <p class="muted grow" style="font-size:13.5px">Stok berkurang otomatis saat pelanggan memesan dan kembali kalau pesanan ditolak/dibatalkan. Nasi & minuman tidak dihitung — tandai <b>Habis</b> di halaman Kasir bila perlu.</p>
        <button class="btn btn-primary" id="bulk">${icon('refresh')} Isi Stok Pagi</button>
      </div>
      <div class="stock-grid" id="sg">${ings.map(i => {
        const tone = i.stock <= 0 ? 'danger' : i.stock <= i.min_stock ? 'warning' : 'ok';
        return `<div class="scard ${tone}">
          <div class="row between"><b>${esc(i.name)}</b><span class="badge ${tone === 'ok' ? 'success' : tone}">${i.stock <= 0 ? 'Habis' : i.stock <= i.min_stock ? 'Menipis' : 'Aman'}</span></div>
          <div class="sval num">${i.stock}<small> ${esc(i.unit)}</small></div>
          <div class="row" style="gap:6px">
            <button class="btn grow" data-d="-1" data-i="${i.id}" ${i.stock <= 0 ? 'disabled' : ''}>${icon('minus')}</button>
            <button class="btn grow" data-d="1" data-i="${i.id}">${icon('plus')}</button>
            <button class="btn btn-outline grow" data-set="${i.id}">Atur</button>
          </div>
          <div class="muted" style="font-size:12px">Batas menipis: ${i.min_stock} · Dipakai: ${DB.c.recipes.filter(r => r.ingredient_id === i.id).map(r => esc(DB.c.products.find(p => p.id === r.product_id)?.name || '')).join(', ') || '-'}</div>
        </div>`;
      }).join('')}</div>
      <h3 class="section-h">${icon('clock')} Riwayat perubahan stok (manual)</h3>
      <div id="slog"><div class="loading"><div class="spinner"></div></div></div>`;
    view.querySelectorAll('[data-d]').forEach(b => b.onclick = () => this.quick(Number(b.dataset.i), Number(b.dataset.d), b));
    view.querySelectorAll('[data-set]').forEach(b => b.onclick = () => this.form(DB.ingredients().find(i => i.id === Number(b.dataset.set))));
    view.querySelector('#bulk').onclick = () => this.bulk();
    this.loadLog();
  },
  onLive(t) { if (t.has('ingredients')) this.render(); },
  refresh() { this.render(); },
  async loadLog() {
    const el = document.getElementById('slog'); if (!el) return;
    try {
      const log = await DB.stockLog(100);
      el.innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>Waktu</th><th>Stok</th><th class="text-right">Perubahan</th><th class="text-right">Sisa</th><th class="hide-sm">Alasan</th><th class="hide-sm">Oleh</th></tr></thead><tbody>
        ${log.length ? log.map(l => `<tr><td class="num">${fmtDateTime(l.created_at)}</td><td>${esc(l.ingredients?.name || '-')}</td>
          <td class="text-right"><span class="badge ${l.delta >= 0 ? 'success' : 'danger'}">${l.delta >= 0 ? '+' : ''}${l.delta}</span></td>
          <td class="text-right num">${l.stock_after}</td><td class="hide-sm">${esc(l.reason)}</td><td class="hide-sm muted">${esc(l.profiles?.name || '-')}</td></tr>`).join('')
        : `<tr><td colspan="6"><div class="empty"><b>Belum ada perubahan manual</b></div></td></tr>`}</tbody></table></div>`;
    } catch (e) { el.innerHTML = errorBox(e); }
  },
  async quick(id, d, btn) {
    btn.disabled = true;
    try { await DB.adjustStock(id, d, d > 0 ? 'Tambah cepat' : 'Kurang cepat (rusak/jatuh)'); this.render(); }
    catch (e) { toast(e.message, 'error'); btn.disabled = false; }
  },
  form(i) {
    let mode = 'set';
    const m = Modal.open({
      title: `Atur Stok — ${esc(i.name)}`, size: 'sm',
      body: `<div class="stack">
        <div class="pay-total"><div class="lbl">STOK SAAT INI</div><div class="val num">${i.stock}</div></div>
        <div class="seg"><button data-m="set" class="active">Hitung Ulang</button><button data-m="in">Tambah</button><button data-m="out">Kurangi</button></div>
        <div class="field"><label id="lq">Jumlah sebenarnya</label><input class="input" id="sq" inputmode="numeric" autofocus></div>
        <div class="field"><label>Keterangan</label><input class="input" id="sr" maxlength="60" placeholder="Contoh: bumbu pagi, gosong, hitung ulang"></div>
        ${Auth.user().role === 'owner' ? `<div class="field"><label>Batas stok menipis</label><input class="input" id="smin" inputmode="numeric" value="${i.min_stock}"></div>` : ''}</div>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary" data-ok>Simpan</button>`,
      onMount: el => {
        el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
          mode = b.dataset.m; el.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('active', x === b));
          el.querySelector('#lq').textContent = mode === 'set' ? 'Jumlah sebenarnya' : 'Jumlah';
        });
        el.querySelector('[data-ok]').onclick = async e => {
          const raw = el.querySelector('#sq').value.trim();
          const n = toInt(raw);
          const minEl = el.querySelector('#smin');
          if (raw === '' && !minEl) return toast('Masukkan jumlah', 'error');
          const delta = raw === '' ? 0 : mode === 'set' ? n - i.stock : mode === 'in' ? n : -n;
          if (n < 0) return toast('Jumlah tidak valid', 'error');
          if (i.stock + delta < 0) return toast('Stok tidak boleh minus', 'error');
          e.currentTarget.disabled = true;
          try {
            if (delta !== 0) await DB.adjustStock(i.id, delta, el.querySelector('#sr').value.trim() || ({ set: 'Hitung ulang', in: 'Stok masuk', out: 'Stok keluar' })[mode]);
            if (minEl && toInt(minEl.value) !== i.min_stock) await DB.saveIngredient({ ...i, min_stock: toInt(minEl.value) });
            toast('Stok diperbarui'); Modal.close(m); this.render();
          } catch (err) { toast(err.message, 'error'); e.currentTarget.disabled = false; }
        };
      },
    });
  },
  bulk() {
    const ings = DB.ingredients();
    const m = Modal.open({
      title: 'Isi Stok Pagi', size: 'lg',
      body: `<p class="muted" style="margin-bottom:12px">Masukkan jumlah ayam yang sudah dibumbui hari ini. Stok akan diganti dengan angka ini.</p>
        <div class="grid-2">${ings.map(i => `<div class="field"><label>${esc(i.name)} <span class="muted">(sekarang ${i.stock})</span></label><input class="input" data-ing="${i.id}" inputmode="numeric" value="${i.stock}"></div>`).join('')}</div>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary" data-ok>Simpan Semua</button>`,
      onMount: el => el.querySelector('[data-ok]').onclick = async e => {
        e.currentTarget.disabled = true;
        try {
          for (const inp of el.querySelectorAll('[data-ing]')) {
            const i = ings.find(x => x.id === Number(inp.dataset.ing));
            const delta = Math.max(0, toInt(inp.value)) - i.stock;
            if (delta) await DB.adjustStock(i.id, delta, 'Stok pagi');
          }
          toast('Stok pagi tersimpan'); Modal.close(m); this.render();
        } catch (err) { toast(err.message, 'error'); e.currentTarget.disabled = false; }
      },
    });
  },
};

/* ---------------- TRANSAKSI ---------------- */
const PageTransactions = {
  range: 'today', q: '', method: 'all', data: [],
  async render() {
    loadingView();
    try { this.data = await DB.sessions(this.range); } catch (e) { document.getElementById('view').innerHTML = errorBox(e); return; }
    this.paint();
  },
  refresh() { this.render(); },
  onLive(t) { if (t.has('table_sessions')) this.render(); },
  paint() {
    const view = document.getElementById('view'); if (!view) return;
    const q = this.q.toLowerCase();
    const me = Auth.user();
    let list = this.data
      .filter(s => this.method === 'all' || s.pay_method === this.method)
      .filter(s => !q || (s.orders || []).some(o => o.code.toLowerCase().includes(q) || (o.customer_name || '').toLowerCase().includes(q) || (o.order_items || []).some(i => i.name.toLowerCase().includes(q))));
    if (me.role !== 'owner') list = list.filter(s => s.cashier_id === me.id);
    const paid = list.filter(s => s.status === 'paid');
    const omzet = paid.reduce((a, s) => a + s.total, 0);
    view.innerHTML = `
      <div class="toolbar">${rangeSeg(this.range)}
        <div class="seg"><button data-m="all" class="${this.method === 'all' ? 'active' : ''}">Semua</button><button data-m="cash" class="${this.method === 'cash' ? 'active' : ''}">Tunai</button><button data-m="qris" class="${this.method === 'qris' ? 'active' : ''}">QRIS</button></div>
        <div class="input-icon" style="flex:1;min-width:200px">${icon('search')}<input class="input" id="tq" placeholder="Cari kode / nama / menu" value="${esc(this.q)}"></div>
      </div>
      <div class="kpis">
        ${kpi('Omzet', rp(omzet), 'trend', 'primary')}
        ${kpi('Transaksi', paid.length, 'receipt', 'info')}
        ${kpi('Tunai', rp(paid.filter(s => s.pay_method === 'cash').reduce((a, s) => a + s.total, 0)), 'cash', 'success')}
        ${kpi('QRIS', rp(paid.filter(s => s.pay_method === 'qris').reduce((a, s) => a + s.total, 0)), 'qr', 'info')}
      </div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Kode</th><th>Waktu</th><th>Meja</th><th class="hide-sm">Item</th><th>Metode</th><th class="text-right">Total</th><th>Status</th></tr></thead><tbody>
        ${list.length ? list.map(s => { const os = s.orders || []; const items = os.flatMap(o => o.order_items || []); return `<tr class="tap" data-id="${s.id}">
          <td><b>${esc(os.map(o => o.code).join(', ') || '-')}</b><div class="muted" style="font-size:12px">${esc([...new Set(os.map(o => o.customer_name).filter(Boolean))].join(', '))}</div></td>
          <td class="num">${this.range === 'today' ? fmtTime(s.closed_at) : fmtDateTime(s.closed_at)}</td>
          <td>${s.table_id ? `Meja ${s.table_id}` : 'Bungkus'}</td>
          <td class="hide-sm truncate" style="max-width:260px">${esc(items.map(i => `${i.qty}× ${i.name}`).join(', '))}</td>
          <td>${s.pay_method ? `<span class="badge info">${METHOD_LABEL[s.pay_method]}</span>` : '-'}</td>
          <td class="text-right num"><b>${rp(s.total)}</b></td>
          <td>${s.status === 'void' ? '<span class="badge danger">Batal</span>' : '<span class="badge success">Lunas</span>'}</td></tr>`; }).join('')
          : `<tr><td colspan="7"><div class="empty"><div class="em">🧾</div><b>Belum ada transaksi</b></div></td></tr>`}
      </tbody></table></div>`;
    view.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { this.range = b.dataset.r; this.render(); });
    view.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { this.method = b.dataset.m; this.paint(); });
    const tq = view.querySelector('#tq');
    tq.oninput = debounce(() => { this.q = tq.value; this.paint(); const n = document.getElementById('tq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250);
    view.querySelectorAll('[data-id]').forEach(r => r.onclick = () => this.detail(r.dataset.id));
  },
  detail(id) {
    const s = this.data.find(x => x.id === id); if (!s) return;
    const os = (s.orders || []).filter(o => s.status === 'void' || !['rejected'].includes(o.status));
    const html = receiptHTML({ orders: os, method: s.pay_method, paid: s.paid, total: s.total, change: s.change, discount: os.reduce((a, o) => a + (o.discount || 0), 0), tableNo: s.table_id, date: s.closed_at, status: s.status, cashier: s.cashier?.name });
    const canVoid = s.status === 'paid' && Auth.user().role === 'owner';
    const m = Modal.open({
      title: `Transaksi ${esc(os.map(o => o.code).join(', '))}`, size: 'sm',
      body: html + (s.status === 'void' ? `<p class="muted" style="margin-top:10px">Alasan batal: ${esc(os[0]?.reject_reason || '-')}</p>` : ''),
      foot: `${canVoid ? `<button class="btn btn-danger" data-void>${icon('ban')} Batalkan</button>` : ''}<button class="btn" data-print>${icon('print')} Cetak</button><button class="btn btn-primary" data-close>Tutup</button>`,
      onMount: el => {
        el.querySelector('[data-print]').onclick = () => printReceipt(html);
        el.querySelector('[data-void]')?.addEventListener('click', async () => {
          const reason = await promptReject({ code: os.map(o => o.code).join(', ') });
          if (reason === null) return;
          try { await DB.voidSession(s.id, reason); toast('Transaksi dibatalkan, stok dikembalikan'); Modal.close(m); this.render(); }
          catch (e) { toast(e.message, 'error'); }
        });
      },
    });
  },
};

/* ---------------- MENU (owner) ---------------- */
const PageProducts = {
  render() {
    const view = document.getElementById('view');
    const all = DB.products();
    view.innerHTML = `
      <div class="toolbar">
        <p class="muted grow" style="font-size:13.5px">Menu yang <b>dinonaktifkan</b> tidak tampil di kasir maupun HP pelanggan. Hubungkan menu ke stok ayam lewat <b>Resep</b>.</p>
        <button class="btn" id="btn-cat">${icon('tag')} Kategori</button>
        <button class="btn btn-primary" id="btn-add">${icon('plus')} Menu</button>
      </div>
      <div class="table-wrap"><table class="table"><thead><tr>
        <th>Menu</th><th class="hide-sm">Kategori</th><th class="text-right">Harga</th><th class="text-right hide-sm">HPP</th><th class="hide-sm">Resep stok</th><th>Status</th><th class="text-right">Aksi</th>
      </tr></thead><tbody>
      ${all.map(p => {
        const rec = DB.recipeOf(p.id).map(r => `${r.qty}× ${esc(DB.c.ingredients.find(i => i.id === r.ingredient_id)?.name || '?')}`).join(', ');
        return `<tr>
          <td><div class="row"><div class="emoji-box">${esc(p.emoji)}</div><div><b>${esc(p.name)}</b><div class="muted" style="font-size:12px">${esc(p.sku || '')}</div></div></div></td>
          <td class="hide-sm">${esc(p.category)}</td>
          <td class="text-right num">${rp(p.price)}</td>
          <td class="text-right num hide-sm muted">${rp(p.cost)}</td>
          <td class="hide-sm muted" style="font-size:13px">${rec || 'Tidak dihitung'}</td>
          <td>${p.active === false ? '<span class="badge">Nonaktif</span>' : p.sold_out ? '<span class="badge danger">Habis</span>' : p.remaining === 0 ? '<span class="badge warning">Stok 0</span>' : '<span class="badge success">Aktif</span>'}</td>
          <td class="text-right" style="white-space:nowrap"><button class="icon-btn sm" data-edit="${p.id}" title="Edit">${icon('edit')}</button></td></tr>`;
      }).join('')}</tbody></table></div>`;
    view.querySelector('#btn-add').onclick = () => this.form();
    view.querySelector('#btn-cat').onclick = () => this.categories();
    view.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => this.form(DB.product(b.dataset.edit)));
  },
  onLive(t) { if (t.has('products')) this.render(); },
  form(p = null) {
    const cats = DB.categories(), ings = DB.ingredients();
    const v = p || { emoji: '🍽️', category_id: cats[0]?.id, active: true, price: '', cost: '' };
    let recipe = p ? DB.recipeOf(p.id).map(r => ({ ingredient_id: r.ingredient_id, qty: r.qty })) : [];
    const m = Modal.open({
      title: p ? 'Edit Menu' : 'Tambah Menu', size: 'lg',
      body: `<form class="stack" id="pf" onsubmit="return false">
        <div class="field"><label>Ikon</label><div class="chips wrap">${EMOJIS.map(e => `<button type="button" class="chip ${e === v.emoji ? 'active' : ''}" data-e="${e}" style="font-size:20px;padding:0 10px">${e}</button>`).join('')}</div></div>
        <div class="grid-2">
          <div class="field"><label>Nama Menu *</label><input class="input" name="name" value="${esc(v.name || '')}" maxlength="60" autofocus></div>
          <div class="field"><label>Kategori</label><select class="input" name="category_id">${cats.map(c => `<option value="${c.id}" ${c.id === v.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Harga Jual *</label><input class="input" name="price" data-money inputmode="numeric" value="${v.price || ''}"></div>
          <div class="field"><label>HPP / Modal</label><input class="input" name="cost" data-money inputmode="numeric" value="${v.cost || ''}"></div>
          <div class="field"><label>SKU</label><input class="input" name="sku" value="${esc(v.sku || '')}" maxlength="20" placeholder="Opsional"></div>
          <div class="field"><label>Urutan</label><input class="input" name="sort" inputmode="numeric" value="${v.sort ?? 0}"></div>
        </div>
        <div class="field"><label>Resep stok (potong ayam yang dipakai per porsi)</label><div id="rec"></div>
          <button type="button" class="btn btn-sm btn-ghost" id="rec-add" style="align-self:flex-start">${icon('plus')} Tambah bahan</button></div>
        <label class="switch"><span>Aktif (tampil di kasir & HP pelanggan)</span><input type="checkbox" name="active" ${v.active !== false ? 'checked' : ''}></label>
      </form>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary" data-ok>Simpan</button>`,
      onMount: el => {
        let emoji = v.emoji;
        bindMoney(el);
        const paintRec = () => {
          el.querySelector('#rec').innerHTML = recipe.length ? recipe.map((r, i) => `<div class="row" style="margin-bottom:6px">
            <select class="input grow" data-ri="${i}">${ings.map(g => `<option value="${g.id}" ${g.id === r.ingredient_id ? 'selected' : ''}>${esc(g.name)}</option>`).join('')}</select>
            <input class="input" style="width:80px" data-rq="${i}" inputmode="numeric" value="${r.qty}">
            <button type="button" class="icon-btn sm" data-rd="${i}" style="color:var(--danger)">${icon('trash')}</button></div>`).join('')
            : `<p class="muted" style="font-size:13px">Tanpa resep = stok tidak dihitung (seperti nasi & minuman).</p>`;
          el.querySelectorAll('[data-ri]').forEach(s => s.onchange = () => { recipe[s.dataset.ri].ingredient_id = Number(s.value); });
          el.querySelectorAll('[data-rq]').forEach(s => s.oninput = () => { recipe[s.dataset.rq].qty = Math.max(1, toInt(s.value)); });
          el.querySelectorAll('[data-rd]').forEach(b => b.onclick = () => { recipe.splice(Number(b.dataset.rd), 1); paintRec(); });
        };
        el.querySelector('#rec-add').onclick = () => { if (!ings.length) return toast('Belum ada data stok', 'error'); recipe.push({ ingredient_id: ings[0].id, qty: 1 }); paintRec(); };
        paintRec();
        el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { emoji = b.dataset.e; el.querySelectorAll('[data-e]').forEach(x => x.classList.toggle('active', x === b)); });
        el.querySelector('[data-ok]').onclick = async e => {
          const d = formData(el.querySelector('#pf'));
          e.currentTarget.disabled = true;
          try { await DB.saveProduct({ ...(p || {}), ...d, emoji, recipe }); toast(p ? 'Menu diperbarui' : 'Menu ditambahkan'); Modal.close(m); this.render(); }
          catch (err) { toast(err.message, 'error'); e.currentTarget.disabled = false; }
        };
      },
    });
  },
  categories() {
    const m = Modal.open({
      title: 'Kelola Kategori', size: 'sm',
      body: `<div class="row" style="margin-bottom:12px"><input class="input grow" id="nc" placeholder="Kategori baru" maxlength="24"><button class="btn btn-primary" id="addc">${icon('plus')}</button></div><div class="list" id="cl"></div>`,
      onMount: el => {
        const paint = () => {
          const used = DB.c.products.reduce((a, p) => (a[p.category_id] = (a[p.category_id] || 0) + 1, a), {});
          el.querySelector('#cl').innerHTML = DB.categories().map(c => `<div class="list-item"><div class="grow"><b>${esc(c.name)}</b><div class="muted" style="font-size:12px">${used[c.id] || 0} menu</div></div>
            <button class="icon-btn sm" data-del="${c.id}" style="color:var(--danger)" ${used[c.id] ? 'disabled title="Masih dipakai menu"' : ''}>${icon('trash')}</button></div>`).join('');
          el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { try { await DB.deleteCategory(Number(b.dataset.del)); paint(); } catch (e) { toast(e.message, 'error'); } });
        };
        const add = async () => {
          const inp = el.querySelector('#nc'); const v = inp.value.trim(); if (!v) return;
          if (DB.categories().some(c => c.name.toLowerCase() === v.toLowerCase())) return toast('Kategori sudah ada', 'warning');
          try { await DB.addCategory(v); inp.value = ''; paint(); } catch (e) { toast(e.message, 'error'); }
        };
        el.querySelector('#addc').onclick = add;
        el.querySelector('#nc').onkeydown = e => e.key === 'Enter' && add();
        paint();
      },
    });
    m.onClose = () => this.render();
  },
};

/* ---------------- KEUANGAN ---------------- */
const EXP_CATS = ['Bahan Baku', 'Operasional', 'Gaji', 'Sewa', 'Peralatan', 'Lainnya'];
const PageFinance = {
  range: 'month',
  async render() {
    loadingView();
    let sess, exp;
    try { [sess, exp] = await Promise.all([DB.sessions(this.range), DB.expenses(this.range)]); }
    catch (e) { document.getElementById('view').innerHTML = errorBox(e); return; }
    const view = document.getElementById('view'); if (!view) return;
    const paid = sess.filter(s => s.status === 'paid');
    const income = paid.reduce((a, s) => a + s.total, 0);
    const hpp = paid.reduce((a, s) => a + (s.orders || []).filter(o => o.status === 'paid').flatMap(o => o.order_items || []).reduce((x, i) => x + (i.cost || 0) * i.qty, 0), 0);
    const outflow = exp.reduce((a, e) => a + e.amount, 0);
    const net = income - outflow;
    const byCat = EXP_CATS.map(c => [c, exp.filter(e => e.category === c).reduce((a, e) => a + e.amount, 0)]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
    const isOwner = Auth.user().role === 'owner';
    view.innerHTML = `
      <div class="toolbar">${rangeSeg(this.range)}<div class="grow"></div><button class="btn btn-primary" id="add-exp">${icon('plus')} Catat Pengeluaran</button></div>
      <div class="kpis">
        ${kpi('Pemasukan', rp(income), 'trend', 'success', `${paid.length} transaksi`)}
        ${kpi('Pengeluaran', rp(outflow), 'wallet', 'danger', `${exp.length} catatan`)}
        ${kpi('Estimasi HPP', rp(hpp), 'box', 'warning', 'dari modal menu')}
        ${kpi('Arus Kas Bersih', rp(net), 'cash', net >= 0 ? 'primary' : 'danger', 'pemasukan − pengeluaran')}
      </div>
      <div class="grid-main">
        <div class="card"><div class="card-title">Pengeluaran</div>
          <div class="list">${exp.length ? exp.map(e => `<div class="list-item">
            <div class="emoji-box">${icon('wallet')}</div>
            <div class="grow"><b>${esc(e.description)}</b><div class="muted" style="font-size:13px">${fmtDate(e.date)} · <span class="badge">${esc(e.category)}</span></div></div>
            <b class="num" style="color:var(--danger)">-${rp(e.amount)}</b>
            ${isOwner ? `<button class="icon-btn sm" data-edit="${e.id}">${icon('edit')}</button><button class="icon-btn sm" data-del="${e.id}" style="color:var(--danger)">${icon('trash')}</button>` : ''}</div>`).join('')
            : `<div class="empty"><div class="em">💸</div><b>Belum ada pengeluaran</b></div>`}</div>
        </div>
        <div class="card"><div class="card-title">Per Kategori</div>
          ${byCat.length ? byCat.map(([c, v]) => `<div style="margin-bottom:14px"><div class="row between" style="margin-bottom:6px"><span>${esc(c)}</span><b class="num">${rp(v)}</b></div><div class="hbar"><span style="width:${(v / outflow * 100).toFixed(1)}%;background:var(--danger)"></span></div></div>`).join('') : '<p class="muted">Tidak ada data</p>'}
        </div>
      </div>`;
    view.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { this.range = b.dataset.r; this.render(); });
    view.querySelector('#add-exp').onclick = () => this.form();
    view.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => this.form(exp.find(e => e.id === Number(b.dataset.edit))));
    view.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (!(await confirmDialog({ title: 'Hapus pengeluaran?', okText: 'Hapus', danger: true }))) return;
      try { await DB.deleteExpense(Number(b.dataset.del)); toast('Dihapus'); this.render(); } catch (e) { toast(e.message, 'error'); }
    });
  },
  refresh() { this.render(); },
  form(e = null) {
    const v = e || { date: dayKey(new Date()), category: 'Bahan Baku' };
    const m = Modal.open({
      title: e ? 'Edit Pengeluaran' : 'Catat Pengeluaran', size: 'sm',
      body: `<form class="stack" id="ef" onsubmit="return false">
        <div class="field"><label>Keterangan *</label><input class="input" name="description" value="${esc(v.description || '')}" maxlength="80" autofocus></div>
        <div class="field"><label>Nominal *</label><input class="input" name="amount" data-money inputmode="numeric" value="${v.amount || ''}"></div>
        <div class="grid-2">
          <div class="field"><label>Kategori</label><select class="input" name="category">${EXP_CATS.map(c => `<option ${c === v.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
          <div class="field"><label>Tanggal</label><input class="input" type="date" name="date" value="${esc(v.date)}" max="${dayKey(new Date())}"></div>
        </div></form>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary" data-ok>Simpan</button>`,
      onMount: el => {
        bindMoney(el);
        el.querySelector('[data-ok]').onclick = async ev => {
          ev.currentTarget.disabled = true;
          try { await DB.saveExpense({ ...(e || {}), ...formData(el.querySelector('#ef')) }); toast('Tersimpan'); Modal.close(m); this.render(); }
          catch (err) { toast(err.message, 'error'); ev.currentTarget.disabled = false; }
        };
      },
    });
  },
};

/* ---------------- LAPORAN ---------------- */
const PageReports = {
  range: '7d',
  async render() {
    loadingView();
    let sess, exp;
    try { [sess, exp] = await Promise.all([DB.sessions(this.range), DB.expenses(this.range)]); }
    catch (e) { document.getElementById('view').innerHTML = errorBox(e); return; }
    const view = document.getElementById('view'); if (!view) return;
    const paid = sess.filter(s => s.status === 'paid');
    const orders = paid.flatMap(s => (s.orders || []).filter(o => o.status === 'paid').map(o => ({ ...o, closed_at: s.closed_at, method: s.pay_method })));
    const items = orders.flatMap(o => o.order_items || []);
    const omzet = paid.reduce((a, s) => a + s.total, 0);
    const hpp = items.reduce((a, i) => a + (i.cost || 0) * i.qty, 0);
    const gross = omzet - hpp;
    const opex = exp.reduce((a, e) => a + e.amount, 0);
    const netProfit = gross - opex;

    let chart;
    if (this.range === 'today') {
      const hrs = Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, '0'), value: 0 }));
      paid.forEach(s => hrs[new Date(s.closed_at).getHours()].value += s.total);
      chart = hrs.slice(8, 23);
    } else {
      const days = {};
      for (let d = new Date(rangeStart(this.range)); d <= new Date(); d.setDate(d.getDate() + 1)) days[dayKey(d)] = 0;
      paid.forEach(s => { const k = dayKey(s.closed_at); if (k in days) days[k] += s.total; });
      chart = Object.entries(days).map(([k, v]) => ({ label: k.slice(8) + '/' + k.slice(5, 7), value: v }));
    }
    const prod = {};
    items.forEach(i => { const p = prod[i.name] ||= { name: i.name, emoji: i.emoji, qty: 0, rev: 0 }; p.qty += i.qty; p.rev += i.qty * i.price; });
    const top = Object.values(prod).sort((a, b) => b.qty - a.qty).slice(0, 8);
    const maxQty = top[0]?.qty || 1;
    const qrCount = orders.filter(o => o.source === 'qr').length;

    view.innerHTML = `
      <div class="toolbar">${rangeSeg(this.range)}<div class="grow"></div><button class="btn" id="csv">${icon('download')} Export CSV</button></div>
      <div class="kpis">
        ${kpi('Omzet', rp(omzet), 'trend', 'primary', `${paid.length} transaksi`)}
        ${kpi('Laba Kotor', rp(gross), 'chart', 'success', omzet ? `margin ${Math.round(gross / omzet * 100)}%` : '')}
        ${kpi('Biaya Operasional', rp(opex), 'wallet', 'warning')}
        ${kpi('Laba Bersih', rp(netProfit), 'cash', netProfit >= 0 ? 'info' : 'danger', 'laba kotor − biaya')}
      </div>
      <div class="grid-main">
        <div class="card"><div class="card-title">Penjualan ${this.range === 'today' ? 'per Jam' : 'Harian'}</div>${barChart(chart)}</div>
        <div class="card"><div class="card-title">Ringkasan</div>
          <div class="stack" style="gap:10px">
            ${['cash', 'qris'].map(k => { const v = paid.filter(s => s.pay_method === k).reduce((a, s) => a + s.total, 0); return `<div><div class="row between" style="margin-bottom:6px"><span>${METHOD_LABEL[k]}</span><b class="num">${rp(v)}</b></div><div class="hbar"><span style="width:${omzet ? (v / omzet * 100).toFixed(1) : 0}%"></span></div></div>`; }).join('')}
            <div class="sumrow" style="margin-top:6px"><span>Pesanan via QR</span><b class="num">${qrCount} / ${orders.length}</b></div>
            <div class="sumrow"><span>Rata-rata per transaksi</span><b class="num">${rp(paid.length ? omzet / paid.length : 0)}</b></div>
          </div>
        </div>
      </div>
      <div class="grid-main" style="margin-top:16px">
        <div class="card"><div class="card-title">Menu Terlaris</div>
          <div class="list">${top.length ? top.map((p, i) => `<div class="list-item"><b class="muted num" style="width:20px">${i + 1}</b><div class="emoji-box">${esc(p.emoji)}</div>
            <div class="grow"><b>${esc(p.name)}</b><div class="hbar" style="margin-top:6px"><span style="width:${p.qty / maxQty * 100}%"></span></div></div>
            <div class="text-right"><b class="num">${p.qty}×</b><div class="muted num" style="font-size:12px">${rp(p.rev)}</div></div></div>`).join('') : '<div class="empty"><b>Belum ada penjualan</b></div>'}</div>
        </div>
        <div class="card"><div class="card-title">Laba Rugi Ringkas</div>
          <div class="stack" style="gap:10px">
            <div class="sumrow"><span>Penjualan (setelah diskon)</span><b class="num">${rp(omzet)}</b></div>
            <div class="sumrow"><span>HPP</span><b class="num">-${rp(hpp)}</b></div>
            <div class="sumrow" style="border-top:1px dashed var(--border);padding-top:8px"><span>Laba kotor</span><b class="num">${rp(gross)}</b></div>
            <div class="sumrow"><span>Biaya operasional</span><b class="num">-${rp(opex)}</b></div>
            <div class="sumrow total"><span>Laba bersih</span><b class="num" style="color:${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">${rp(netProfit)}</b></div>
          </div>
        </div>
      </div>`;
    view.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { this.range = b.dataset.r; this.render(); });
    view.querySelector('#csv').onclick = () => {
      const rows = [['Kode', 'Waktu Bayar', 'Meja', 'Pelanggan', 'Sumber', 'Item', 'Subtotal', 'Diskon', 'Total', 'Metode', 'Status']];
      sess.forEach(s => (s.orders || []).forEach(o => rows.push([o.code, fmtDateTime(s.closed_at), s.table_id ? `Meja ${s.table_id}` : 'Bungkus', o.customer_name, o.source === 'qr' ? 'QR' : 'Kasir', (o.order_items || []).map(i => `${i.qty}x ${i.name}`).join('; '), o.subtotal, o.discount, o.total, METHOD_LABEL[s.pay_method] || '-', s.status === 'void' ? 'Batal' : 'Lunas'])));
      const csv = '\ufeff' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
      download(`laporan-${this.range}-${dayKey(new Date())}.csv`, csv, 'text/csv');
    };
  },
  refresh() { this.render(); },
};

/* ---------------- PENGATURAN (owner) ---------------- */
function customerUrl(token) { return new URL(`pesan/?t=${encodeURIComponent(token)}`, location.href.split('#')[0].replace(/index\.html$/, '')).href; }
function qrSvg(text, size = 220) {
  const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
  return qr.createSvgTag({ cellSize: Math.max(2, Math.floor(size / (qr.getModuleCount() + 8))), margin: 4, scalable: true });
}

const PageSettings = {
  async render() {
    const view = document.getElementById('view');
    const s = DB.settings();
    let staff = [];
    try { staff = await DB.staff(); } catch (e) { toast(e.message, 'error'); }
    const qris = await DB.qrisUrl();
    view.innerHTML = `
      <div class="grid-main">
        <div class="stack" style="gap:16px">
          <div class="card"><div class="card-title">Profil Warung (untuk struk)</div>
            <form class="stack" id="sf" onsubmit="return false">
              <div class="field"><label>Nama Warung</label><input class="input" name="store_name" value="${esc(s.store_name)}" maxlength="40"></div>
              <div class="field"><label>Alamat</label><input class="input" name="address" value="${esc(s.address)}" maxlength="80"></div>
              <div class="grid-2">
                <div class="field"><label>Telepon</label><input class="input" name="phone" value="${esc(s.phone)}" maxlength="20"></div>
                <div class="field"><label>Pesan di Struk</label><input class="input" name="receipt_footer" value="${esc(s.receipt_footer)}" maxlength="60"></div>
              </div>
              <label class="switch"><span>Terima pesanan dari QR meja</span><input type="checkbox" name="qr_open" ${s.qr_open ? 'checked' : ''}></label>
              <button class="btn btn-primary" id="save-s">${icon('check')} Simpan</button>
            </form>
          </div>
          <div class="card"><div class="card-title">QRIS Warung (bayar manual)</div>
            <div class="row" style="align-items:flex-start;gap:16px">
              <div class="qris-thumb">${qris ? `<img src="${esc(qris)}" alt="QRIS">` : icon('image')}</div>
              <div class="stack grow">
                <p class="muted" style="font-size:13.5px">Unggah gambar QRIS statis warung. Gambar ini tampil besar di tablet saat pelanggan memilih bayar QRIS.</p>
                <label class="btn btn-outline" style="cursor:pointer">${icon('upload')} ${qris ? 'Ganti' : 'Unggah'} QRIS<input type="file" id="qris-f" accept="image/png,image/jpeg,image/webp" hidden></label>
              </div>
            </div>
          </div>
        </div>
        <div class="stack" style="gap:16px">
          <div class="card"><div class="card-title">Akun Staf <button class="btn btn-sm btn-primary" id="add-u">${icon('plus')} Tambah</button></div>
            <div class="list">${staff.map(u => `<div class="list-item"><div class="avatar">${esc((u.name || '?')[0].toUpperCase())}</div>
              <div class="grow"><b>${esc(u.name)}</b>${u.id === Auth.user().id ? ' <span class="muted">(Anda)</span>' : ''}<div><span class="badge ${u.role === 'owner' ? 'primary' : 'info'}">${u.role}</span> ${u.active ? '' : '<span class="badge warning">Nonaktif</span>'}</div></div>
              <button class="icon-btn sm" data-eu="${u.id}">${icon('edit')}</button></div>`).join('')}</div>
          </div>
          <div class="card"><div class="card-title">QR Meja <button class="btn btn-sm" id="print-qr">${icon('print')} Cetak Semua</button></div>
            <p class="muted" style="font-size:13px;margin-bottom:10px">Tempel di tiap meja. Pelanggan scan → pilih menu → pesanan masuk ke tablet.</p>
            <div class="qr-grid">${DB.c.tables.map(t => `<div class="qr-cell"><div class="qr-img">${qrSvg(customerUrl(t.qr_token), 140)}</div><b>Meja ${t.id}</b>
              <div class="row" style="gap:4px"><button class="btn btn-sm btn-ghost" data-copy="${t.id}" title="Salin link">${icon('link')}</button><button class="btn btn-sm btn-ghost" data-rot="${t.id}" title="Ganti QR (QR lama tidak berlaku)">${icon('refresh')}</button></div></div>`).join('')}</div>
          </div>
        </div>
      </div>`;
    view.querySelector('#save-s').onclick = async e => {
      const d = formData(view.querySelector('#sf'));
      if (!d.store_name) return toast('Nama warung wajib diisi', 'error');
      e.currentTarget.disabled = true;
      try { await DB.saveSettings(d); toast('Pengaturan disimpan'); render(); } catch (err) { toast(err.message, 'error'); e.currentTarget.disabled = false; }
    };
    view.querySelector('#qris-f').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { await DB.uploadQris(f); toast('QRIS tersimpan'); this.render(); } catch (err) { toast(err.message, 'error'); }
    };
    view.querySelector('#add-u').onclick = () => this.userForm();
    view.querySelectorAll('[data-eu]').forEach(b => b.onclick = () => this.userForm(staff.find(u => u.id === b.dataset.eu)));
    view.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => {
      const t = DB.c.tables.find(x => x.id === Number(b.dataset.copy));
      try { await navigator.clipboard.writeText(customerUrl(t.qr_token)); toast('Link disalin'); } catch { prompt('Salin link:', customerUrl(t.qr_token)); }
    });
    view.querySelectorAll('[data-rot]').forEach(b => b.onclick = async () => {
      const no = Number(b.dataset.rot);
      if (!(await confirmDialog({ title: `Ganti QR Meja ${no}?`, message: 'QR lama langsung tidak berlaku. Cetak & tempel QR baru. Pakai ini kalau QR disalahgunakan.', okText: 'Ganti QR', danger: true }))) return;
      try { await DB.rotateToken(no); toast(`QR Meja ${no} diganti`); this.render(); } catch (e) { toast(e.message, 'error'); }
    });
    view.querySelector('#print-qr').onclick = () => this.printQr();
  },
  printQr() {
    const s = DB.settings();
    printReceipt(`<div class="qr-print">${DB.c.tables.filter(t => t.active).map(t => `<div class="qr-card">
      <div class="qp-store">${esc(s.store_name)}</div><div class="qp-no">MEJA ${t.id}</div>
      <div class="qp-img">${qrSvg(customerUrl(t.qr_token), 260)}</div>
      <div class="qp-hint">Scan untuk pesan · Bayar di kasir setelah makan</div></div>`).join('')}</div>`, { page: 'A4 portrait', cls: 'print-qr' });
  },
  userForm(u = null) {
    const isSelf = u && u.id === Auth.user().id;
    const m = Modal.open({
      title: u ? `Edit ${esc(u.name)}` : 'Tambah Akun Staf', size: 'sm',
      body: `<form class="stack" id="uf" onsubmit="return false">
        <div class="field"><label>Nama *</label><input class="input" name="name" value="${esc(u?.name || '')}" maxlength="30" autofocus></div>
        ${u ? '' : `<div class="field"><label>Email (untuk login) *</label><input class="input" name="email" type="email" inputmode="email" placeholder="anas@warung.com"></div>`}
        <div class="field"><label>Peran</label><select class="input" name="role" ${isSelf ? 'disabled' : ''}>
          <option value="kasir" ${u?.role !== 'owner' ? 'selected' : ''}>Kasir — pesanan, meja, kasir, stok</option>
          <option value="owner" ${u?.role === 'owner' ? 'selected' : ''}>Owner — akses penuh</option></select></div>
        <div class="field"><label>Password ${u ? '(kosongkan jika tidak diganti)' : '* (min. 6 karakter)'}</label><input class="input" name="password" type="password" autocomplete="new-password"></div>
        ${u && !isSelf ? `<label class="switch"><span>Akun aktif</span><input type="checkbox" name="active" ${u.active ? 'checked' : ''}></label>` : ''}
      </form>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary" data-ok>Simpan</button>`,
      onMount: el => el.querySelector('[data-ok]').onclick = async e => {
        const d = formData(el.querySelector('#uf'));
        if (!d.name) return toast('Nama wajib diisi', 'error');
        if (d.password && d.password.length < 6) return toast('Password minimal 6 karakter', 'error');
        e.currentTarget.disabled = true;
        try {
          if (!u) {
            if (!d.email) throw new Error('Email wajib diisi');
            if (!d.password) throw new Error('Password wajib diisi');
            await DB.createStaff(d.email, d.password, d.name, d.role);
            toast(`Akun ${d.name} dibuat. Login dengan ${d.email}`);
          } else {
            await DB.updateStaff(u.id, d.name, isSelf ? u.role : d.role, isSelf ? true : d.active !== false);
            if (d.password) await DB.setStaffPassword(u.id, d.password);
            toast('Akun diperbarui');
            if (isSelf) await DB.loadProfile();
          }
          Modal.close(m); isSelf ? render() : this.render();
        } catch (err) { toast(err.message, 'error'); e.currentTarget.disabled = false; }
      },
    });
  },
};
