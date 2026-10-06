/* ===========================================================
   Pages: Produk, Transaksi, Keuangan, Laporan, Pengaturan
   =========================================================== */
const EMOJIS = ['🍗','🌶️','🔥','🍱','🧺','🍛','🍚','🍜','🍲','🥗','🍳','🍔','🍟','🌭','🍕','🥟','🍢','🍡','🧋','🍊','🍵','☕','💧','🥑','🥤','🧃','🍦','🍰','🍩','🍪','✨','🟫','🥬','🍌','🍽️'];

/* ---------------- PRODUK ---------------- */
const PageProducts = {
  q: '', cat: 'Semua', tab: 'list',
  render() {
    const view = document.getElementById('view');
    const all = DB.products();
    const low = all.filter(p => p.trackStock && p.stock <= p.minStock).length;
    const value = all.reduce((a, p) => a + (p.trackStock ? Math.max(0, p.stock) * p.cost : 0), 0);
    view.innerHTML = `
      <div class="kpis">
        ${kpi('Total Produk', all.length, 'box', 'primary')}
        ${kpi('Stok Menipis', low, 'alert', low ? 'warning' : 'success')}
        ${kpi('Kategori', DB.categories().length, 'tag', 'info')}
        ${kpi('Nilai Stok (HPP)', rp(value), 'wallet', 'success')}
      </div>
      <div class="toolbar">
        <div class="seg"><button data-tab="list" class="${this.tab === 'list' ? 'active' : ''}">Daftar</button><button data-tab="log" class="${this.tab === 'log' ? 'active' : ''}">Riwayat Stok</button></div>
        <div class="grow"></div>
        <button class="btn" id="btn-cat">${icon('tag')} Kategori</button>
        <button class="btn btn-primary" id="btn-add">${icon('plus')} Produk</button>
      </div>
      <div id="prod-body"></div>`;
    view.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { this.tab = b.dataset.tab; this.render(); });
    view.querySelector('#btn-add').onclick = () => this.form();
    view.querySelector('#btn-cat').onclick = () => this.categories();
    this.tab === 'list' ? this.renderList() : this.renderLog();
  },
  renderList() {
    const body = document.getElementById('prod-body');
    body.innerHTML = `
      <div class="toolbar">
        <div class="input-icon" style="flex:1;min-width:200px">${icon('search')}<input class="input" id="pq" placeholder="Cari produk / SKU" value="${esc(this.q)}"></div>
        <div class="chips">${['Semua', 'Stok Menipis', ...DB.categories()].map(c => `<button class="chip ${c === this.cat ? 'active' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      </div>
      <div class="table-wrap"><table class="table"><thead><tr>
        <th>Produk</th><th class="hide-sm">Kategori</th><th class="text-right">Harga</th><th class="text-right hide-sm">HPP</th><th class="text-right hide-sm">Margin</th><th class="text-right">Stok</th><th class="text-right">Aksi</th>
      </tr></thead><tbody id="ptb"></tbody></table></div>`;
    const pq = body.querySelector('#pq');
    pq.oninput = () => { this.q = pq.value; this.fillTable(); };
    body.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
      this.cat = b.dataset.c; body.querySelectorAll('[data-c]').forEach(x => x.classList.toggle('active', x === b)); this.fillTable();
    });
    this.fillTable();
  },
  fillTable() {
    const tb = document.getElementById('ptb'); if (!tb) return;
    const q = this.q.toLowerCase();
    const list = DB.products().filter(p =>
      (this.cat === 'Semua' || (this.cat === 'Stok Menipis' ? p.trackStock && p.stock <= p.minStock : p.category === this.cat)) &&
      (!q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q)));
    tb.innerHTML = list.length ? list.map(p => {
      const margin = p.price ? Math.round((p.price - p.cost) / p.price * 100) : 0;
      const st = !p.trackStock ? '<span class="badge">∞</span>' : p.stock <= 0 ? `<span class="badge danger">Habis</span>` : p.stock <= p.minStock ? `<span class="badge warning">${p.stock}</span>` : `<span class="badge success">${p.stock}</span>`;
      return `<tr>
        <td><div class="row"><div class="emoji-box">${esc(p.emoji)}</div><div class="grow"><b>${esc(p.name)}</b>${p.active === false ? ' <span class="badge">nonaktif</span>' : ''}<div class="muted" style="font-size:12px">${esc(p.sku || '-')}</div></div></div></td>
        <td class="hide-sm">${esc(p.category)}</td>
        <td class="text-right num">${rp(p.price)}</td>
        <td class="text-right num hide-sm muted">${rp(p.cost)}</td>
        <td class="text-right hide-sm"><span class="badge ${margin >= 40 ? 'success' : margin >= 20 ? 'warning' : 'danger'}">${margin}%</span></td>
        <td class="text-right">${st}</td>
        <td class="text-right" style="white-space:nowrap">
          <button class="icon-btn sm" data-stock="${p.id}" title="Atur stok">${icon('box')}</button>
          <button class="icon-btn sm" data-edit="${p.id}" title="Edit">${icon('edit')}</button>
          <button class="icon-btn sm" data-del="${p.id}" title="Hapus" style="color:var(--danger)">${icon('trash')}</button>
        </td></tr>`;
    }).join('') : `<tr><td colspan="7"><div class="empty"><div class="em">📦</div><b>Tidak ada produk</b></div></td></tr>`;
    tb.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => this.form(DB.product(b.dataset.edit)));
    tb.querySelectorAll('[data-stock]').forEach(b => b.onclick = () => this.stockForm(DB.product(b.dataset.stock)));
    tb.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const p = DB.product(b.dataset.del);
      if (await confirmDialog({ title: 'Hapus produk?', message: `<b>${esc(p.name)}</b> akan dihapus. Riwayat transaksi tetap tersimpan.`, okText: 'Hapus', danger: true })) {
        DB.deleteProduct(p.id); toast('Produk dihapus'); this.render();
      }
    });
  },
  renderLog() {
    const log = DB.stockLog().slice().reverse().slice(0, 300);
    document.getElementById('prod-body').innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>Waktu</th><th>Produk</th><th class="text-right">Perubahan</th><th class="text-right">Sisa</th><th class="hide-sm">Alasan</th><th class="hide-sm">Oleh</th></tr></thead><tbody>
      ${log.length ? log.map(l => `<tr><td class="num">${fmtDateTime(l.date)}</td><td>${esc(l.name)}</td>
        <td class="text-right"><span class="badge ${l.delta >= 0 ? 'success' : 'danger'}">${l.delta >= 0 ? '+' : ''}${l.delta}</span></td>
        <td class="text-right num">${l.after}</td><td class="hide-sm">${esc(l.reason)}</td><td class="hide-sm muted">${esc(l.user)}</td></tr>`).join('')
        : `<tr><td colspan="6"><div class="empty"><div class="em">📋</div><b>Belum ada penyesuaian stok</b><span>Stok masuk/keluar manual akan tercatat di sini</span></div></td></tr>`}
    </tbody></table></div>`;
  },
  form(p = null) {
    const cats = DB.categories();
    const v = p || { emoji: '🍽️', category: cats[0] || 'Lainnya', trackStock: true, minStock: 5, stock: 0, active: true };
    const m = Modal.open({
      title: p ? 'Edit Produk' : 'Tambah Produk',
      body: `<form class="stack" id="pf" onsubmit="return false">
        <div class="field"><label>Ikon</label><div class="chips wrap" id="emo">${EMOJIS.map(e => `<button type="button" class="chip ${e === v.emoji ? 'active' : ''}" data-e="${e}" style="font-size:20px;padding:0 10px">${e}</button>`).join('')}</div></div>
        <div class="field"><label>Nama Produk *</label><input class="input" name="name" value="${esc(v.name || '')}" maxlength="60" required autofocus></div>
        <div class="grid-2">
          <div class="field"><label>Kategori</label><select class="input" name="category">${cats.map(c => `<option ${c === v.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
          <div class="field"><label>SKU</label><input class="input" name="sku" value="${esc(v.sku || '')}" maxlength="20" placeholder="Opsional"></div>
          <div class="field"><label>Harga Jual *</label><input class="input" name="price" data-money inputmode="numeric" value="${v.price || ''}"></div>
          <div class="field"><label>HPP / Modal</label><input class="input" name="cost" data-money inputmode="numeric" value="${v.cost || ''}"></div>
          ${p ? '' : `<div class="field"><label>Stok Awal</label><input class="input" name="stock" inputmode="numeric" value="${v.stock}"></div>`}
          <div class="field"><label>Batas Stok Minimum</label><input class="input" name="minStock" inputmode="numeric" value="${v.minStock}"></div>
        </div>
        <label class="switch"><span>Lacak stok</span><input type="checkbox" name="trackStock" ${v.trackStock ? 'checked' : ''}></label>
        <label class="switch"><span>Tampil di kasir</span><input type="checkbox" name="active" ${v.active !== false ? 'checked' : ''}></label>
      </form>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary" data-ok>Simpan</button>`,
      onMount: el => {
        let emoji = v.emoji;
        bindMoney(el);
        el.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { emoji = b.dataset.e; el.querySelectorAll('[data-e]').forEach(x => x.classList.toggle('active', x === b)); });
        el.querySelector('[data-ok]').onclick = () => {
          const d = formData(el.querySelector('#pf'));
          try {
            DB.saveProduct({ ...(p || {}), ...d, emoji, stock: p ? p.stock : toInt(d.stock) });
            toast(p ? 'Produk diperbarui' : 'Produk ditambahkan'); Modal.close(m); this.render();
          } catch (e) { toast(e.message, 'error'); }
        };
      },
    });
  },
  stockForm(p) {
    let mode = 'in';
    const m = Modal.open({
      title: `Atur Stok — ${esc(p.name)}`, size: 'sm',
      body: `<div class="stack">
        <div class="pay-total"><div class="lbl">STOK SAAT INI</div><div class="val num">${p.stock}</div></div>
        <div class="seg"><button data-m="in" class="active">Stok Masuk</button><button data-m="out">Stok Keluar</button><button data-m="set">Stok Opname</button></div>
        <div class="field"><label id="lbl-q">Jumlah</label><input class="input" id="sq" inputmode="numeric" autofocus></div>
        <div class="field"><label>Keterangan</label><input class="input" id="sr" placeholder="Contoh: belanja pagi, rusak, hitung ulang" maxlength="60"></div></div>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary" data-ok>Simpan</button>`,
      onMount: el => {
        el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
          mode = b.dataset.m; el.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('active', x === b));
          el.querySelector('#lbl-q').textContent = mode === 'set' ? 'Jumlah stok sebenarnya' : 'Jumlah';
        });
        el.querySelector('[data-ok]').onclick = () => {
          const n = toInt(el.querySelector('#sq').value);
          if (n < 0 || (mode !== 'set' && n === 0)) return toast('Masukkan jumlah yang valid', 'error');
          const delta = mode === 'in' ? n : mode === 'out' ? -n : n - p.stock;
          if (mode === 'out' && n > p.stock) return toast('Stok keluar melebihi stok tersedia', 'error');
          const reason = el.querySelector('#sr').value.trim() || ({ in: 'Stok masuk', out: 'Stok keluar', set: 'Stok opname' })[mode];
          DB.adjustStock(p.id, delta, reason, Auth.user());
          toast('Stok diperbarui'); Modal.close(m); this.render();
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
          const used = DB.products().reduce((a, p) => (a[p.category] = (a[p.category] || 0) + 1, a), {});
          el.querySelector('#cl').innerHTML = DB.categories().map((c, i) => `<div class="list-item"><div class="grow"><b>${esc(c)}</b><div class="muted" style="font-size:12px">${used[c] || 0} produk</div></div>
            <button class="icon-btn sm" data-del="${i}" style="color:var(--danger)" ${used[c] ? 'disabled title="Masih dipakai produk"' : ''}>${icon('trash')}</button></div>`).join('');
          el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const l = DB.categories(); l.splice(+b.dataset.del, 1); DB.saveCategories(l); paint(); });
        };
        const add = () => {
          const inp = el.querySelector('#nc'); const v = inp.value.trim();
          if (!v) return;
          if (DB.categories().some(c => c.toLowerCase() === v.toLowerCase())) return toast('Kategori sudah ada', 'warning');
          DB.saveCategories([...DB.categories(), v]); inp.value = ''; paint();
        };
        el.querySelector('#addc').onclick = add;
        el.querySelector('#nc').onkeydown = e => e.key === 'Enter' && add();
        paint();
      },
    });
    m.onClose = () => this.render();
  },
};

function kpi(label, value, ic, tone, sub = '') {
  return `<div class="kpi"><div class="kpi-icon tone-${tone}">${icon(ic)}</div><div class="kpi-label">${label}</div><div class="kpi-value num">${value}</div>${sub ? `<div class="muted" style="font-size:12px">${sub}</div>` : ''}</div>`;
}

/* ---------------- Date range helper ---------------- */
const RANGES = { today: 'Hari Ini', '7d': '7 Hari', '30d': '30 Hari', month: 'Bulan Ini', all: 'Semua' };
function rangeStart(r) {
  const d = startOfDay();
  if (r === 'today') return d;
  if (r === '7d') { d.setDate(d.getDate() - 6); return d; }
  if (r === '30d') { d.setDate(d.getDate() - 29); return d; }
  if (r === 'month') { d.setDate(1); return d; }
  return new Date(0);
}
function rangeSeg(cur) { return `<div class="seg">${Object.entries(RANGES).map(([k, l]) => `<button data-r="${k}" class="${k === cur ? 'active' : ''}">${l}</button>`).join('')}</div>`; }

/* ---------------- TRANSAKSI ---------------- */
const PageTransactions = {
  range: 'today', q: '', method: 'all',
  render() {
    const view = document.getElementById('view');
    const from = rangeStart(this.range);
    const q = this.q.toLowerCase();
    const me = Auth.user();
    let list = DB.transactions().filter(t => new Date(t.date) >= from)
      .filter(t => this.method === 'all' || t.method === this.method)
      .filter(t => !q || t.invoice.toLowerCase().includes(q) || (t.customer || '').toLowerCase().includes(q) || t.items.some(i => i.name.toLowerCase().includes(q)));
    if (me.role !== 'owner') list = list.filter(t => t.cashierId === me.id || t.cashier === me.name);
    list.sort((a, b) => b.date.localeCompare(a.date));
    const paid = list.filter(t => t.status !== 'void');
    const omzet = paid.reduce((a, t) => a + t.total, 0);
    view.innerHTML = `
      <div class="toolbar">${rangeSeg(this.range)}
        <select class="input" id="tm" style="width:auto;min-height:46px"><option value="all">Semua metode</option>${Object.entries(METHOD_LABEL).map(([k, l]) => `<option value="${k}" ${k === this.method ? 'selected' : ''}>${l}</option>`).join('')}</select>
        <div class="input-icon" style="flex:1;min-width:200px">${icon('search')}<input class="input" id="tq" placeholder="Cari invoice / pelanggan / menu" value="${esc(this.q)}"></div>
      </div>
      <div class="kpis">
        ${kpi('Omzet', rp(omzet), 'trend', 'primary')}
        ${kpi('Transaksi', paid.length, 'receipt', 'info')}
        ${kpi('Rata-rata', rp(paid.length ? omzet / paid.length : 0), 'chart', 'success')}
        ${kpi('Dibatalkan', list.length - paid.length, 'ban', 'danger')}
      </div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Invoice</th><th>Waktu</th><th class="hide-sm">Item</th><th class="hide-sm">Kasir</th><th>Metode</th><th class="text-right">Total</th><th>Status</th></tr></thead><tbody>
        ${list.length ? list.slice(0, 500).map(t => `<tr class="tap" data-id="${t.id}">
          <td><b>${esc(t.invoice)}</b>${t.customer ? `<div class="muted" style="font-size:12px">${esc(t.customer)}</div>` : ''}</td>
          <td class="num">${this.range === 'today' ? fmtTime(t.date) : fmtDateTime(t.date)}</td>
          <td class="hide-sm truncate" style="max-width:240px">${esc(t.items.map(i => `${i.qty}× ${i.name}`).join(', '))}</td>
          <td class="hide-sm">${esc(t.cashier)}</td>
          <td><span class="badge info">${METHOD_LABEL[t.method] || t.method}</span></td>
          <td class="text-right num"><b>${rp(t.total)}</b></td>
          <td>${t.status === 'void' ? '<span class="badge danger">Batal</span>' : '<span class="badge success">Lunas</span>'}</td></tr>`).join('')
          : `<tr><td colspan="7"><div class="empty"><div class="em">🧾</div><b>Belum ada transaksi</b><span>Transaksi dari kasir akan muncul di sini</span></div></td></tr>`}
      </tbody></table></div>`;
    view.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { this.range = b.dataset.r; this.render(); });
    view.querySelector('#tm').onchange = e => { this.method = e.target.value; this.render(); };
    const tq = view.querySelector('#tq');
    tq.oninput = debounce(() => { this.q = tq.value; this.render(); const n = document.getElementById('tq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250);
    view.querySelectorAll('[data-id]').forEach(r => r.onclick = () => this.detail(r.dataset.id));
  },
  detail(id) {
    const t = DB.transactions().find(x => x.id === id); if (!t) return;
    const m = showReceipt(t);
    if (t.status !== 'void' && Auth.can('pos')) {
      const foot = m.el.querySelector('.modal-foot');
      const b = document.createElement('button');
      b.className = 'btn btn-danger'; b.innerHTML = `${icon('ban')} Batalkan`;
      foot.prepend(b);
      b.onclick = () => this.voidForm(t, m);
    }
  },
  voidForm(t, parent) {
    const m = Modal.open({
      title: `Batalkan ${esc(t.invoice)}?`, size: 'sm',
      body: `<div class="stack"><p class="muted">Stok produk akan dikembalikan dan transaksi tidak dihitung di laporan.</p>
        <div class="field"><label>Alasan pembatalan *</label><input class="input" id="vr" maxlength="80" placeholder="Contoh: salah input pesanan" autofocus></div>
        ${Auth.user().role !== 'owner' ? `<div class="field"><label>PIN Owner *</label><input class="input" id="vp" type="password" inputmode="numeric" maxlength="4"></div>` : ''}</div>`,
      foot: `<button class="btn" data-close>Kembali</button><button class="btn btn-danger" data-ok>Batalkan Transaksi</button>`,
      onMount: el => el.querySelector('[data-ok]').onclick = () => {
        const reason = el.querySelector('#vr').value.trim();
        if (!reason) return toast('Alasan wajib diisi', 'error');
        const pinEl = el.querySelector('#vp');
        if (pinEl && !DB.users().some(u => u.role === 'owner' && u.pin === hashPin(pinEl.value))) return toast('PIN Owner salah', 'error');
        DB.voidTransaction(t.id, reason, Auth.user());
        toast('Transaksi dibatalkan'); Modal.close(m); Modal.close(parent); this.render();
      },
    });
  },
};

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

/* ---------------- KEUANGAN ---------------- */
const EXP_CATS = ['Bahan Baku', 'Operasional', 'Gaji', 'Sewa', 'Peralatan', 'Lainnya'];
const PageFinance = {
  range: 'month',
  render() {
    const view = document.getElementById('view');
    const from = rangeStart(this.range);
    const trx = DB.transactions().filter(t => t.status !== 'void' && new Date(t.date) >= from);
    const exp = DB.expenses().filter(e => new Date(e.date) >= from).sort((a, b) => b.date.localeCompare(a.date));
    const income = trx.reduce((a, t) => a + t.total, 0);
    const hpp = trx.reduce((a, t) => a + t.items.reduce((s, i) => s + (i.cost || 0) * i.qty, 0), 0);
    const tax = trx.reduce((a, t) => a + (t.tax || 0), 0);
    const outflow = exp.reduce((a, e) => a + e.amount, 0);
    const net = income - tax - outflow;
    const byCat = EXP_CATS.map(c => [c, exp.filter(e => e.category === c).reduce((a, e) => a + e.amount, 0)]).filter(x => x[1] > 0);
    view.innerHTML = `
      <div class="toolbar">${rangeSeg(this.range)}<div class="grow"></div><button class="btn btn-primary" id="add-exp">${icon('plus')} Catat Pengeluaran</button></div>
      <div class="kpis">
        ${kpi('Pemasukan', rp(income), 'trend', 'success', `${trx.length} transaksi`)}
        ${kpi('Pengeluaran', rp(outflow), 'wallet', 'danger', `${exp.length} catatan`)}
        ${kpi('Estimasi HPP', rp(hpp), 'box', 'warning', 'dari modal produk')}
        ${kpi('Arus Kas Bersih', rp(net), 'cash', net >= 0 ? 'primary' : 'danger', 'pemasukan − pajak − pengeluaran')}
      </div>
      <div class="grid-main">
        <div class="card"><div class="card-title">Pengeluaran</div>
          <div class="list">${exp.length ? exp.map(e => `<div class="list-item">
            <div class="emoji-box">${icon('wallet')}</div>
            <div class="grow"><b>${esc(e.description)}</b><div class="muted" style="font-size:13px">${fmtDate(e.date)} · <span class="badge">${esc(e.category)}</span></div></div>
            <b class="num" style="color:var(--danger)">-${rp(e.amount)}</b>
            <button class="icon-btn sm" data-edit="${e.id}">${icon('edit')}</button>
            <button class="icon-btn sm" data-del="${e.id}" style="color:var(--danger)">${icon('trash')}</button></div>`).join('')
            : `<div class="empty"><div class="em">💸</div><b>Belum ada pengeluaran</b></div>`}</div>
        </div>
        <div class="card"><div class="card-title">Per Kategori</div>
          ${byCat.length ? byCat.sort((a, b) => b[1] - a[1]).map(([c, v]) => `<div style="margin-bottom:14px"><div class="row between" style="margin-bottom:6px"><span>${esc(c)}</span><b class="num">${rp(v)}</b></div><div class="hbar"><span style="width:${(v / outflow * 100).toFixed(1)}%;background:var(--danger)"></span></div></div>`).join('') : '<p class="muted">Tidak ada data</p>'}
        </div>
      </div>`;
    view.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { this.range = b.dataset.r; this.render(); });
    view.querySelector('#add-exp').onclick = () => this.form();
    view.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => this.form(DB.expenses().find(e => e.id === b.dataset.edit)));
    view.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      if (await confirmDialog({ title: 'Hapus pengeluaran?', okText: 'Hapus', danger: true })) { DB.deleteExpense(b.dataset.del); toast('Dihapus'); this.render(); }
    });
  },
  form(e = null) {
    const v = e || { date: new Date().toISOString(), category: 'Bahan Baku' };
    const m = Modal.open({
      title: e ? 'Edit Pengeluaran' : 'Catat Pengeluaran', size: 'sm',
      body: `<form class="stack" id="ef" onsubmit="return false">
        <div class="field"><label>Keterangan *</label><input class="input" name="description" value="${esc(v.description || '')}" maxlength="80" autofocus></div>
        <div class="field"><label>Nominal *</label><input class="input" name="amount" data-money inputmode="numeric" value="${v.amount || ''}"></div>
        <div class="grid-2">
          <div class="field"><label>Kategori</label><select class="input" name="category">${EXP_CATS.map(c => `<option ${c === v.category ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
          <div class="field"><label>Tanggal</label><input class="input" type="date" name="date" value="${dayKey(v.date)}" max="${dayKey(new Date())}"></div>
        </div></form>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary" data-ok>Simpan</button>`,
      onMount: el => {
        bindMoney(el);
        el.querySelector('[data-ok]').onclick = () => {
          const d = formData(el.querySelector('#ef'));
          // keep local date (avoid UTC shift)
          if (d.date) { const [y, mo, da] = d.date.split('-').map(Number); const dt = new Date(y, mo - 1, da, 12); d.date = dt.toISOString(); }
          try { DB.saveExpense({ ...(e || {}), ...d }); toast('Tersimpan'); Modal.close(m); this.render(); }
          catch (err) { toast(err.message, 'error'); }
        };
      },
    });
  },
};

/* ---------------- LAPORAN ---------------- */
const PageReports = {
  range: '7d',
  render() {
    const view = document.getElementById('view');
    const from = rangeStart(this.range);
    const trx = DB.transactions().filter(t => t.status !== 'void' && new Date(t.date) >= from);
    const exp = DB.expenses().filter(e => new Date(e.date) >= from);
    const omzet = trx.reduce((a, t) => a + t.total, 0);
    const sales = trx.reduce((a, t) => a + t.subtotal - (t.discount || 0), 0);
    const hpp = trx.reduce((a, t) => a + t.items.reduce((s, i) => s + (i.cost || 0) * i.qty, 0), 0);
    const gross = sales - hpp;
    const opex = exp.reduce((a, e) => a + e.amount, 0);
    const netProfit = gross - opex;

    // chart: daily (or hourly for today)
    let chart;
    if (this.range === 'today') {
      const hrs = Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, '0'), value: 0 }));
      trx.forEach(t => hrs[new Date(t.date).getHours()].value += t.total);
      chart = hrs.slice(8, 23);
    } else {
      const days = {}; const start = this.range === 'all' && trx.length ? startOfDay(trx.reduce((m, t) => t.date < m ? t.date : m, trx[0].date)) : new Date(from);
      for (let d = new Date(start); d <= new Date(); d.setDate(d.getDate() + 1)) days[dayKey(d)] = 0;
      trx.forEach(t => { const k = dayKey(t.date); if (k in days) days[k] += t.total; });
      chart = Object.entries(days).map(([k, v]) => ({ label: k.slice(8) + '/' + k.slice(5, 7), value: v }));
    }

    const prod = {};
    trx.forEach(t => t.items.forEach(i => { const p = prod[i.productId] ||= { name: i.name, emoji: i.emoji, qty: 0, rev: 0 }; p.qty += i.qty; p.rev += i.qty * i.price; }));
    const top = Object.values(prod).sort((a, b) => b.qty - a.qty).slice(0, 8);
    const maxQty = top[0]?.qty || 1;
    const methods = Object.keys(METHOD_LABEL).map(k => [k, trx.filter(t => t.method === k).reduce((a, t) => a + t.total, 0)]).filter(x => x[1]);

    view.innerHTML = `
      <div class="toolbar">${rangeSeg(this.range)}<div class="grow"></div><button class="btn" id="csv">${icon('download')} Export CSV</button></div>
      <div class="kpis">
        ${kpi('Omzet', rp(omzet), 'trend', 'primary', `${trx.length} transaksi`)}
        ${kpi('Laba Kotor', rp(gross), 'chart', 'success', sales ? `margin ${Math.round(gross / sales * 100)}%` : '')}
        ${kpi('Biaya Operasional', rp(opex), 'wallet', 'warning')}
        ${kpi('Laba Bersih', rp(netProfit), 'cash', netProfit >= 0 ? 'info' : 'danger', 'laba kotor − biaya')}
      </div>
      <div class="grid-main">
        <div class="card"><div class="card-title">Penjualan ${this.range === 'today' ? 'per Jam' : 'Harian'}</div>${barChart(chart)}</div>
        <div class="card"><div class="card-title">Metode Bayar</div>
          ${methods.length ? methods.map(([k, v]) => `<div style="margin-bottom:14px"><div class="row between" style="margin-bottom:6px"><span>${METHOD_LABEL[k]}</span><b class="num">${rp(v)}</b></div><div class="hbar"><span style="width:${(v / omzet * 100).toFixed(1)}%"></span></div></div>`).join('') : '<p class="muted">Tidak ada data</p>'}
        </div>
      </div>
      <div class="grid-main" style="margin-top:16px">
        <div class="card"><div class="card-title">Produk Terlaris</div>
          <div class="list">${top.length ? top.map((p, i) => `<div class="list-item"><b class="muted num" style="width:20px">${i + 1}</b><div class="emoji-box">${esc(p.emoji)}</div>
            <div class="grow"><b>${esc(p.name)}</b><div class="hbar" style="margin-top:6px"><span style="width:${p.qty / maxQty * 100}%"></span></div></div>
            <div class="text-right"><b class="num">${p.qty}×</b><div class="muted num" style="font-size:12px">${rp(p.rev)}</div></div></div>`).join('') : '<div class="empty"><b>Belum ada penjualan</b></div>'}</div>
        </div>
        <div class="card"><div class="card-title">Laba Rugi Ringkas</div>
          <div class="stack" style="gap:10px">
            <div class="sumrow"><span>Penjualan bersih (setelah diskon)</span><b class="num">${rp(sales)}</b></div>
            <div class="sumrow"><span>HPP</span><b class="num">-${rp(hpp)}</b></div>
            <div class="sumrow" style="border-top:1px dashed var(--border);padding-top:8px"><span>Laba kotor</span><b class="num">${rp(gross)}</b></div>
            <div class="sumrow"><span>Biaya operasional</span><b class="num">-${rp(opex)}</b></div>
            <div class="sumrow total"><span>Laba bersih</span><b class="num" style="color:${netProfit >= 0 ? 'var(--success)' : 'var(--danger)'}">${rp(netProfit)}</b></div>
            <p class="muted" style="font-size:12px">Pajak & service dipisahkan dari laba (titipan).</p>
          </div>
        </div>
      </div>`;
    view.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { this.range = b.dataset.r; this.render(); });
    view.querySelector('#csv').onclick = () => {
      const rows = [['Invoice', 'Tanggal', 'Kasir', 'Tipe', 'Pelanggan', 'Item', 'Subtotal', 'Diskon', 'Service', 'Pajak', 'Total', 'Metode', 'Status']];
      DB.transactions().filter(t => new Date(t.date) >= from).forEach(t => rows.push([t.invoice, fmtDateTime(t.date), t.cashier, t.orderType, t.customer || '', t.items.map(i => `${i.qty}x ${i.name}`).join('; '), t.subtotal, t.discount, t.service || 0, t.tax, t.total, METHOD_LABEL[t.method] || t.method, t.status]));
      const csv = '\ufeff' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
      download(`laporan-${this.range}-${dayKey(new Date())}.csv`, csv, 'text/csv');
    };
  },
};

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------- PENGATURAN ---------------- */
const PageSettings = {
  render() {
    const view = document.getElementById('view');
    const s = DB.settings();
    view.innerHTML = `
      <div class="grid-main">
        <div class="stack" style="gap:16px">
          <div class="card"><div class="card-title">Profil Usaha</div>
            <form class="stack" id="sf" onsubmit="return false">
              <div class="field"><label>Nama Usaha</label><input class="input" name="storeName" value="${esc(s.storeName)}" maxlength="40"></div>
              <div class="field"><label>Alamat</label><input class="input" name="address" value="${esc(s.address)}" maxlength="80"></div>
              <div class="grid-2">
                <div class="field"><label>Telepon</label><input class="input" name="phone" value="${esc(s.phone)}" maxlength="20"></div>
                <div class="field"><label>Pesan di Struk</label><input class="input" name="footer" value="${esc(s.footer)}" maxlength="60"></div>
              </div>
              <label class="switch"><span>Pajak (PB1)</span><input type="checkbox" name="taxEnabled" ${s.taxEnabled ? 'checked' : ''}></label>
              <div class="field"><label>Tarif pajak (%)</label><input class="input" name="taxRate" inputmode="numeric" value="${s.taxRate}"></div>
              <label class="switch"><span>Service charge</span><input type="checkbox" name="serviceEnabled" ${s.serviceEnabled ? 'checked' : ''}></label>
              <div class="field"><label>Tarif service (%)</label><input class="input" name="serviceRate" inputmode="numeric" value="${s.serviceRate}"></div>
              <label class="switch"><span>Peringatan stok menipis</span><input type="checkbox" name="lowStockAlert" ${s.lowStockAlert ? 'checked' : ''}></label>
              <button class="btn btn-primary" id="save-s">${icon('check')} Simpan Pengaturan</button>
            </form>
          </div>
        </div>
        <div class="stack" style="gap:16px">
          <div class="card"><div class="card-title">Pengguna <button class="btn btn-sm btn-primary" id="add-u">${icon('plus')} Tambah</button></div>
            <div class="list">${DB.users().map(u => `<div class="list-item"><div class="avatar">${esc(u.name[0].toUpperCase())}</div>
              <div class="grow"><b>${esc(u.name)}</b><div><span class="badge ${u.role === 'owner' ? 'primary' : 'info'}">${u.role}</span></div></div>
              <button class="icon-btn sm" data-eu="${u.id}">${icon('edit')}</button>
              <button class="icon-btn sm" data-du="${u.id}" style="color:var(--danger)">${icon('trash')}</button></div>`).join('')}</div>
          </div>
          <div class="card"><div class="card-title">Data & Backup</div>
            <div class="stack">
              <button class="btn btn-outline" id="bk">${icon('download')} Backup Data (JSON)</button>
              <label class="btn btn-outline" style="cursor:pointer">${icon('upload')} Restore dari File<input type="file" id="rs" accept=".json,application/json" hidden></label>
              <button class="btn btn-danger" id="rst">${icon('refresh')} Reset ke Data Demo</button>
              <p class="muted" style="font-size:12px">Data disimpan di perangkat ini (offline). Lakukan backup rutin.</p>
              <p class="muted" style="font-size:12px" id="quota"></p>
            </div>
          </div>
        </div>
      </div>`;
    view.querySelector('#save-s').onclick = () => {
      const d = formData(view.querySelector('#sf'));
      if (!d.storeName) return toast('Nama usaha wajib diisi', 'error');
      d.taxRate = Math.min(100, Math.max(0, toInt(d.taxRate)));
      d.serviceRate = Math.min(100, Math.max(0, toInt(d.serviceRate)));
      DB.saveSettings(d); toast('Pengaturan disimpan'); render();
    };
    view.querySelector('#add-u').onclick = () => this.userForm();
    view.querySelectorAll('[data-eu]').forEach(b => b.onclick = () => this.userForm(DB.users().find(u => u.id === b.dataset.eu)));
    view.querySelectorAll('[data-du]').forEach(b => b.onclick = async () => {
      const u = DB.users().find(x => x.id === b.dataset.du);
      if (u.id === Auth.user().id) return toast('Tidak bisa menghapus akun yang sedang dipakai', 'warning');
      if (!(await confirmDialog({ title: `Hapus ${esc(u.name)}?`, okText: 'Hapus', danger: true }))) return;
      try { DB.deleteUser(u.id); toast('Pengguna dihapus'); this.render(); } catch (e) { toast(e.message, 'error'); }
    });
    view.querySelector('#bk').onclick = () => download(`warungku-backup-${dayKey(new Date())}.json`, JSON.stringify(DB.exportAll()), 'application/json');
    view.querySelector('#rs').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const obj = JSON.parse(await f.text());
        if (!(await confirmDialog({ title: 'Restore data?', message: 'Semua data saat ini akan diganti dengan isi file backup.', okText: 'Restore', danger: true }))) return;
        DB.importAll(obj);
        if (!Auth.user()) { toast('Data dipulihkan, silakan login ulang', 'info'); Auth.logout(); return; }
        toast('Data berhasil dipulihkan'); render();
      } catch (err) { toast(err.message || 'File tidak valid', 'error'); }
      e.target.value = '';
    };
    view.querySelector('#rst').onclick = async () => {
      if (!(await confirmDialog({ title: 'Reset semua data?', message: 'Semua produk, transaksi, dan pengaturan akan dihapus dan diganti data demo. Tidak bisa dibatalkan.', okText: 'Reset', danger: true }))) return;
      DB.resetAll(); toast('Data direset'); Auth.logout();
    };
    navigator.storage?.estimate?.().then(q => {
      const el = document.getElementById('quota');
      if (el && q.quota) el.textContent = `Penyimpanan terpakai: ${(q.usage / 1024).toFixed(0)} KB`;
    });
  },
  userForm(u = null) {
    const m = Modal.open({
      title: u ? 'Edit Pengguna' : 'Tambah Pengguna', size: 'sm',
      body: `<form class="stack" id="uf" onsubmit="return false">
        <div class="field"><label>Nama *</label><input class="input" name="name" value="${esc(u?.name || '')}" maxlength="20" autofocus></div>
        <div class="field"><label>Peran</label><select class="input" name="role"><option value="kasir" ${u?.role === 'kasir' ? 'selected' : ''}>Kasir — hanya kasir & transaksinya</option><option value="owner" ${u?.role === 'owner' ? 'selected' : ''}>Owner — akses penuh</option></select></div>
        <div class="field"><label>PIN 4 digit ${u ? '(kosongkan jika tidak diubah)' : '*'}</label><input class="input" name="pin" type="password" inputmode="numeric" maxlength="4" pattern="\\d{4}"></div></form>`,
      foot: `<button class="btn" data-close>Batal</button><button class="btn btn-primary" data-ok>Simpan</button>`,
      onMount: el => el.querySelector('[data-ok]').onclick = () => {
        const d = formData(el.querySelector('#uf'));
        if (!d.name) return toast('Nama wajib diisi', 'error');
        if ((!u || d.pin) && !/^\d{4}$/.test(d.pin)) return toast('PIN harus 4 digit angka', 'error');
        if (u && u.role === 'owner' && d.role !== 'owner' && DB.users().filter(x => x.role === 'owner').length <= 1) return toast('Minimal harus ada 1 Owner', 'error');
        const rec = { ...(u || {}), name: d.name, role: d.role };
        if (d.pin) rec.pin = hashPin(d.pin);
        DB.saveUser(rec); toast('Pengguna disimpan'); Modal.close(m);
        if (u && u.id === Auth.user()?.id) render(); else this.render();
      },
    });
  },
};
