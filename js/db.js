/* ===========================================================
   Data layer — localStorage, versioned, offline-first
   =========================================================== */
const DB_PREFIX = 'wk2_';
const DB_VERSION = 3;

const Store = {
  _cache: {},
  get(key, fallback) {
    if (key in this._cache) return this._cache[key];
    let v = fallback;
    try {
      const raw = localStorage.getItem(DB_PREFIX + key);
      if (raw !== null) v = JSON.parse(raw);
    } catch (e) { console.warn('Corrupt key', key, e); }
    this._cache[key] = v;
    return v;
  },
  set(key, value) {
    this._cache[key] = value;
    try {
      localStorage.setItem(DB_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      toast('Penyimpanan penuh! Backup lalu hapus data lama.', 'error');
      throw e;
    }
  },
  remove(key) { delete this._cache[key]; localStorage.removeItem(DB_PREFIX + key); },
  keys() { return Object.keys(localStorage).filter(k => k.startsWith(DB_PREFIX)).map(k => k.slice(DB_PREFIX.length)); },
};
// Sync across tabs
window.addEventListener('storage', e => {
  if (e.key && e.key.startsWith(DB_PREFIX)) delete Store._cache[e.key.slice(DB_PREFIX.length)];
});

/* Non-cryptographic PIN hash (cukup untuk demo offline; bukan pengganti auth server) */
function hashPin(pin) {
  let h = 2166136261;
  const s = 'wk-salt:' + pin;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

const DEFAULT_SETTINGS = {
  storeName: 'Ayam Kremez Mbak Indar',
  address: 'Jl. Merdeka No. 10',
  phone: '0812-3456-7890',
  footer: 'Terima kasih, selamat menikmati!',
  taxEnabled: true, taxRate: 10,
  serviceEnabled: false, serviceRate: 5,
  theme: 'light',
  lowStockAlert: true,
};

const DB = {
  /* ---------- settings ---------- */
  settings() { return { ...DEFAULT_SETTINGS, ...Store.get('settings', {}) }; },
  saveSettings(s) { Store.set('settings', { ...this.settings(), ...s }); },

  /* ---------- users ---------- */
  users() { return Store.get('users', []); },
  saveUser(u) {
    const list = this.users();
    const i = list.findIndex(x => x.id === u.id);
    if (i >= 0) list[i] = { ...list[i], ...u }; else list.push({ id: uid('u'), ...u });
    Store.set('users', list);
  },
  deleteUser(id) {
    const list = this.users();
    const target = list.find(u => u.id === id);
    if (target && target.role === 'owner' && list.filter(u => u.role === 'owner').length <= 1)
      throw new Error('Minimal harus ada 1 Owner');
    Store.set('users', list.filter(u => u.id !== id));
  },

  /* ---------- categories ---------- */
  categories() { return Store.get('categories', []); },
  saveCategories(c) { Store.set('categories', c); },

  /* ---------- products ---------- */
  products() { return Store.get('products', []); },
  product(id) { return this.products().find(p => p.id === id); },
  saveProduct(p) {
    const list = this.products();
    const clean = {
      name: String(p.name || '').trim(),
      category: p.category || 'Lainnya',
      price: Math.max(0, toInt(p.price)),
      cost: Math.max(0, toInt(p.cost)),
      stock: toInt(p.stock),
      minStock: Math.max(0, toInt(p.minStock)),
      trackStock: p.trackStock !== false,
      emoji: p.emoji || '🍽️',
      sku: String(p.sku || '').trim(),
      active: p.active !== false,
    };
    if (!clean.name) throw new Error('Nama produk wajib diisi');
    if (clean.price <= 0) throw new Error('Harga jual harus lebih dari 0');
    if (clean.sku && list.some(x => x.sku === clean.sku && x.id !== p.id)) throw new Error('SKU sudah dipakai produk lain');
    const i = list.findIndex(x => x.id === p.id);
    if (i >= 0) list[i] = { ...list[i], ...clean };
    else list.push({ id: uid('p'), createdAt: new Date().toISOString(), ...clean });
    Store.set('products', list);
  },
  deleteProduct(id) { Store.set('products', this.products().filter(p => p.id !== id)); },
  adjustStock(id, delta, reason, user) {
    const list = this.products();
    const p = list.find(x => x.id === id);
    if (!p) return;
    p.stock = toInt(p.stock) + toInt(delta);
    Store.set('products', list);
    const log = Store.get('stocklog', []);
    log.push({ id: uid('s'), productId: id, name: p.name, delta: toInt(delta), after: p.stock, reason, user: user?.name || '-', date: new Date().toISOString() });
    Store.set('stocklog', log.slice(-2000));
  },
  stockLog() { return Store.get('stocklog', []); },

  /* ---------- transactions ---------- */
  transactions() { return Store.get('transactions', []); },
  nextInvoice() {
    const d = new Date();
    const prefix = `INV${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const counter = Store.get('counter', {});
    const n = (counter[prefix] || 0) + 1;
    Store.set('counter', { [prefix]: n });
    return `${prefix}-${String(n).padStart(4, '0')}`;
  },
  /* Atomic checkout: validates stock, writes trx, decrements stock */
  checkout(order, user) {
    const products = this.products();
    for (const it of order.items) {
      const p = products.find(x => x.id === it.productId);
      if (!p) throw new Error(`Produk "${it.name}" sudah dihapus`);
      if (p.trackStock && p.stock < it.qty) throw new Error(`Stok ${p.name} tinggal ${p.stock}`);
    }
    const trx = {
      id: uid('t'),
      invoice: this.nextInvoice(),
      date: new Date().toISOString(),
      cashier: user?.name || '-',
      cashierId: user?.id || null,
      ...order,
      status: 'paid',
    };
    for (const it of order.items) {
      const p = products.find(x => x.id === it.productId);
      if (p.trackStock) p.stock -= it.qty;
      it.cost = p.cost; // snapshot HPP for profit report
    }
    Store.set('products', products);
    const list = this.transactions();
    list.push(trx);
    Store.set('transactions', list);
    return trx;
  },
  voidTransaction(id, reason, user) {
    const list = this.transactions();
    const t = list.find(x => x.id === id);
    if (!t || t.status === 'void') return;
    t.status = 'void';
    t.voidReason = reason;
    t.voidBy = user?.name || '-';
    t.voidAt = new Date().toISOString();
    const products = this.products();
    t.items.forEach(it => {
      const p = products.find(x => x.id === it.productId);
      if (p && p.trackStock) p.stock += it.qty;
    });
    Store.set('products', products);
    Store.set('transactions', list);
  },

  /* ---------- held orders ---------- */
  held() { return Store.get('held', []); },
  hold(order) { const l = this.held(); l.push({ id: uid('h'), date: new Date().toISOString(), ...order }); Store.set('held', l); },
  unhold(id) { const l = this.held(); const o = l.find(x => x.id === id); Store.set('held', l.filter(x => x.id !== id)); return o; },

  /* ---------- expenses ---------- */
  expenses() { return Store.get('expenses', []); },
  saveExpense(e) {
    const list = this.expenses();
    const clean = { date: e.date ? new Date(e.date).toISOString() : new Date().toISOString(), category: e.category || 'Lainnya', description: String(e.description || '').trim(), amount: Math.max(0, toInt(e.amount)) };
    if (!clean.description) throw new Error('Keterangan wajib diisi');
    if (clean.amount <= 0) throw new Error('Nominal harus lebih dari 0');
    const i = list.findIndex(x => x.id === e.id);
    if (i >= 0) list[i] = { ...list[i], ...clean }; else list.push({ id: uid('e'), ...clean });
    Store.set('expenses', list);
  },
  deleteExpense(id) { Store.set('expenses', this.expenses().filter(e => e.id !== id)); },

  /* ---------- backup ---------- */
  exportAll() {
    const o = { app: 'WarungKu POS', version: DB_VERSION, exportedAt: new Date().toISOString(), data: {} };
    Store.keys().forEach(k => o.data[k] = Store.get(k));
    return o;
  },
  importAll(obj) {
    if (!obj || obj.app !== 'WarungKu POS' || typeof obj.data !== 'object') throw new Error('File backup tidak valid');
    Store.keys().forEach(k => Store.remove(k));
    Object.entries(obj.data).forEach(([k, v]) => Store.set(k, v));
  },
  resetAll() { Store.keys().forEach(k => Store.remove(k)); seed(); },
};

/* ---------- Seed demo data ---------- */
function seed() {
  if (Store.get('version', 0) >= DB_VERSION) return;
  // data versi lama (menu/user berbeda) dibersihkan supaya tidak tercampur
  Store.keys().forEach(k => Store.remove(k));

  Store.set('users', [
    { id: 'u_owner', name: 'Mbak Indar', role: 'owner', pin: hashPin('1234') },
    { id: 'u_kasir', name: 'Anas', role: 'kasir', pin: hashPin('0000') },
    { id: 'u_kasir2', name: 'Rizal', role: 'kasir', pin: hashPin('1111') },
  ]);
  Store.set('categories', ['Ayam Bakar', 'Ayam Goreng', 'Paket', 'Minuman', 'Tambahan']);

  // [nama, kategori, harga, HPP, stok, emoji, sku]
  const P = [
    ['Ayam Bakar Dada',  'Ayam Bakar',  9000, 5000, 40, '🔥', 'BKR-001'],
    ['Ayam Bakar Paha',  'Ayam Bakar',  8000, 4500, 45, '🔥', 'BKR-002'],
    ['Ayam Bakar Sayap', 'Ayam Bakar',  7500, 4000, 40, '🔥', 'BKR-003'],
    ['Ayam Goreng Dada',  'Ayam Goreng', 9000, 5000, 40, '🍗', 'GRG-001'],
    ['Ayam Goreng Paha',  'Ayam Goreng', 8000, 4500, 45, '🍗', 'GRG-002'],
    ['Ayam Goreng Sayap', 'Ayam Goreng', 7500, 4000, 40, '🍗', 'GRG-003'],
    ['Paket 1', 'Paket', 13000, 7500, 30, '🍱', 'PKT-001'],
    ['Paket 2', 'Paket', 12000, 7000, 30, '🍛', 'PKT-002'],
    ['Es Teh',      'Minuman', 3000, 1000, 120, '🧋', 'MNM-001'],
    ['Es Jeruk',    'Minuman', 3000, 1200, 100, '🍊', 'MNM-002'],
    ['Air Mineral', 'Minuman', 2000, 1000,  80, '💧', 'MNM-003'],
    ['Nasi',        'Tambahan', 3000, 1200, 150, '🍚', 'TBH-001'],
  ];
  const products = P.map((r, i) => ({
    id: 'p' + (i + 1), name: r[0], category: r[1], price: r[2], cost: r[3], stock: r[4],
    minStock: r[1] === 'Paket' ? 5 : 10, trackStock: true, emoji: r[5],
    sku: r[6], active: true,
    createdAt: new Date().toISOString(),
  }));
  Store.set('products', products);

  // 21 days demo history (deterministic pseudo-random)
  let s = 42; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const trx = [];
  const now = new Date();
  for (let d = 20; d >= 0; d--) {
    const day = new Date(now); day.setDate(now.getDate() - d);
    const count = 18 + Math.floor(rnd() * 16);
    for (let k = 0; k < count; k++) {
      const t = new Date(day); t.setHours(10 + Math.floor(rnd() * 11), Math.floor(rnd() * 60), 0, 0);
      if (t > now) continue;
      const items = [];
      const n = 1 + Math.floor(rnd() * 3);
      for (let j = 0; j < n; j++) {
        const p = products[Math.floor(rnd() * products.length)];
        if (items.some(x => x.productId === p.id)) continue;
        items.push({ productId: p.id, name: p.name, emoji: p.emoji, price: p.price, cost: p.cost, qty: 1 + Math.floor(rnd() * 2), note: '' });
      }
      const subtotal = items.reduce((a, b) => a + b.price * b.qty, 0);
      const tax = Math.round(subtotal * 0.1);
      const total = subtotal + tax;
      const method = ['cash', 'cash', 'qris', 'qris', 'transfer'][Math.floor(rnd() * 5)];
      const paid = method === 'cash' ? Math.ceil(total / 10000) * 10000 : total;
      trx.push({
        id: uid('t'), invoice: `INV-DEMO-${trx.length + 1}`, date: t.toISOString(),
        cashier: ['Anas', 'Rizal', 'Mbak Indar'][Math.floor(rnd() * 3)], cashierId: null, items,
        orderType: rnd() > .4 ? 'dine_in' : 'take_away', customer: '',
        subtotal, discount: 0, tax, service: 0, total, method, paid, change: paid - total, status: 'paid',
      });
    }
  }
  Store.set('transactions', trx);

  const E = [
    [1, 'Bahan Baku', 'Belanja ayam 10 ekor', 350000],
    [2, 'Operasional', 'Gas LPG 2 tabung', 44000],
    [3, 'Bahan Baku', 'Arang, kecap & bumbu bakar', 85000],
    [5, 'Bahan Baku', 'Minyak goreng 5L & tepung kremes', 120000],
    [7, 'Gaji', 'Gaji mingguan Anas & Rizal', 300000],
    [10, 'Operasional', 'Listrik & air', 150000],
    [14, 'Sewa', 'Sewa lapak bulan ini', 400000],
  ];
  Store.set('expenses', E.map(([d, c, desc, a]) => ({ id: uid('e'), date: new Date(Date.now() - d * 864e5).toISOString(), category: c, description: desc, amount: a })));
  Store.set('version', DB_VERSION);
}
