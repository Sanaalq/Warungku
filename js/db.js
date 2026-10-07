/* ===========================================================
   Data layer — Supabase (PostgreSQL + Auth + Realtime)
   Local storage is used ONLY for device-local state:
   cart draft, held carts, theme.
   =========================================================== */
const sb = window.supabase.createClient(SB_CONFIG.url, SB_CONFIG.anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'wk-auth' },
  realtime: { params: { eventsPerSecond: 10 } },
});

/* ---------- local device storage ---------- */
const Store = {
  P: 'wk3_',
  get(k, fb) { try { const r = localStorage.getItem(this.P + k); return r === null ? fb : JSON.parse(r); } catch { return fb; } },
  set(k, v) { localStorage.setItem(this.P + k, JSON.stringify(v)); },
  remove(k) { localStorage.removeItem(this.P + k); },
};

/* Translate Postgres / PostgREST errors into friendly Indonesian */
function errMsg(e) {
  if (!e) return 'Terjadi kesalahan';
  const m = e.message || String(e);
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'Tidak ada koneksi internet';
  if (/JWT|jwt expired|refresh_token/i.test(m)) return 'Sesi habis, silakan login ulang';
  if (/Invalid login credentials/i.test(m)) return 'Email atau password salah';
  if (/Email not confirmed/i.test(m)) return 'Email belum dikonfirmasi';
  if (/row-level security|permission denied/i.test(m)) return 'Tidak punya akses untuk aksi ini';
  if (/duplicate key/i.test(m)) return 'Data sudah ada (duplikat)';
  if (/violates foreign key/i.test(m)) return 'Data masih dipakai, tidak bisa dihapus';
  return m;
}

async function rpc(fn, args = {}) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(errMsg(error));
  return data;
}
async function q(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(errMsg(error));
  return data;
}
/* RPCs declared as RETURNS TABLE give an array */
const one = rows => (Array.isArray(rows) ? rows[0] : rows);

function rangeISO(r) { return rangeStart(r).toISOString(); }

const DB = {
  c: { settings: null, categories: [], products: [], ingredients: [], recipes: [], tables: [], profile: null },

  /* ---------- auth ---------- */
  async session() { const { data } = await sb.auth.getSession(); return data.session; },
  async signIn(email, password) {
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(errMsg(error));
  },
  async signOut() { await sb.auth.signOut(); },
  async loadProfile() {
    const s = await this.session();
    if (!s) return (this.c.profile = null);
    const { data, error } = await sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    if (error) throw new Error(errMsg(error));
    this.c.profile = data ? { ...data, email: s.user.email } : null;
    return this.c.profile;
  },

  /* ---------- master data ---------- */
  async load() {
    const [settings, categories, products, ingredients, recipes, tables] = await Promise.all([
      q(sb.from('settings').select('*').eq('id', 1).maybeSingle()),
      q(sb.from('categories').select('*').order('sort')),
      q(sb.from('products').select('*').order('sort')),
      q(sb.from('ingredients').select('*').order('sort')),
      q(sb.from('product_ingredients').select('*')),
      q(sb.from('tables').select('*').order('id')),
    ]);
    Object.assign(this.c, { settings: settings || {}, categories, products, ingredients, recipes, tables });
    return this.c;
  },
  async reloadStock() {
    const [ingredients, products] = await Promise.all([
      q(sb.from('ingredients').select('*').order('sort')),
      q(sb.from('products').select('*').order('sort')),
    ]);
    this.c.ingredients = ingredients; this.c.products = products;
  },
  settings() { return this.c.settings || {}; },
  categories() { return this.c.categories; },
  catName(id) { return this.c.categories.find(c => c.id === id)?.name || '-'; },
  products() {
    const cs = id => this.c.categories.find(c => c.id === id)?.sort ?? 999;
    return this.c.products
      .map(p => ({ ...p, category: this.catName(p.category_id), ...this.availability(p) }))
      .sort((a, b) => cs(a.category_id) - cs(b.category_id) || a.sort - b.sort || a.name.localeCompare(b.name));
  },
  product(id) { return this.products().find(p => p.id === Number(id)); },
  ingredients() { return this.c.ingredients; },
  recipeOf(pid) { return this.c.recipes.filter(r => r.product_id === Number(pid)); },

  /* remaining = min(stock / qty) over its ingredients; null = unlimited */
  availability(p) {
    const rec = this.recipeOf(p.id);
    let remaining = null;
    if (rec.length) {
      remaining = Math.min(...rec.map(r => {
        const ing = this.c.ingredients.find(i => i.id === r.ingredient_id);
        return ing ? Math.floor(ing.stock / r.qty) : 0;
      }));
    }
    const available = p.active !== false && !p.sold_out && (remaining === null || remaining > 0);
    const low = remaining !== null && remaining > 0 && remaining <= 5;
    return { remaining, available, low };
  },
  /* how many of product pid can still be added given the cart (handles shared ingredients) */
  maxAddable(pid, cartItems) {
    const rec = this.recipeOf(pid);
    if (!rec.length) return Infinity;
    return Math.min(...rec.map(r => {
      const ing = this.c.ingredients.find(i => i.id === r.ingredient_id);
      if (!ing) return 0;
      const used = cartItems.reduce((a, it) => {
        const rr = this.recipeOf(it.productId).find(x => x.ingredient_id === r.ingredient_id);
        return a + (rr ? rr.qty * it.qty : 0);
      }, 0);
      return Math.floor((ing.stock - used) / r.qty);
    }));
  },

  async saveSettings(patch) {
    await q(sb.from('settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1));
    this.c.settings = { ...this.c.settings, ...patch };
  },

  async saveProduct(p) {
    const row = {
      name: String(p.name || '').trim(),
      category_id: Number(p.category_id),
      sku: String(p.sku || '').trim() || null,
      price: Math.max(0, toInt(p.price)),
      cost: Math.max(0, toInt(p.cost)),
      emoji: p.emoji || '🍽️',
      active: p.active !== false,
      sort: toInt(p.sort) || 0,
    };
    if (!row.name) throw new Error('Nama produk wajib diisi');
    if (!row.category_id) throw new Error('Kategori wajib dipilih');
    if (row.price <= 0) throw new Error('Harga jual harus lebih dari 0');
    let id = p.id;
    if (id) await q(sb.from('products').update(row).eq('id', id));
    else id = (await q(sb.from('products').insert(row).select('id').single())).id;
    if (Array.isArray(p.recipe)) {
      await q(sb.from('product_ingredients').delete().eq('product_id', id));
      const seen = new Set();
      const rows = p.recipe
        .filter(r => r.ingredient_id && toInt(r.qty) > 0 && !seen.has(r.ingredient_id) && seen.add(r.ingredient_id))
        .map(r => ({ product_id: id, ingredient_id: Number(r.ingredient_id), qty: toInt(r.qty) }));
      if (rows.length) await q(sb.from('product_ingredients').insert(rows));
    }
    await this.load();
    return id;
  },
  async deleteProduct(id) {
    await q(sb.from('products').update({ active: false }).eq('id', id)); // soft delete keeps history
    await this.load();
  },
  async setSoldOut(id, v) { await rpc('set_sold_out', { p_product: id, p_value: v }); await this.reloadStock(); },

  async addCategory(name) {
    const sort = Math.max(0, ...this.c.categories.map(c => c.sort)) + 1;
    await q(sb.from('categories').insert({ name: name.trim(), sort }));
    await this.load();
  },
  async deleteCategory(id) { await q(sb.from('categories').delete().eq('id', id)); await this.load(); },

  /* ---------- stock ---------- */
  async adjustStock(ingId, delta, reason) {
    const after = await rpc('adjust_stock', { p_ing: ingId, p_delta: toInt(delta), p_reason: reason || '' });
    const ing = this.c.ingredients.find(i => i.id === ingId); if (ing) ing.stock = after;
    return after;
  },
  async saveIngredient(i) {
    const row = { name: String(i.name || '').trim(), min_stock: Math.max(0, toInt(i.min_stock)), unit: i.unit || 'potong', sort: toInt(i.sort) || 0 };
    if (!row.name) throw new Error('Nama stok wajib diisi');
    if (i.id) await q(sb.from('ingredients').update(row).eq('id', i.id));
    else await q(sb.from('ingredients').insert({ ...row, stock: Math.max(0, toInt(i.stock)) }));
    await this.load();
  },
  async stockLog(limit = 200) {
    return q(sb.from('stock_movements').select('*, ingredients(name), profiles(name)').order('created_at', { ascending: false }).limit(limit));
  },

  /* ---------- orders & tables ---------- */
  async activeOrders() {
    return q(sb.from('orders').select('*, order_items(*)')
      .in('status', ['new', 'preparing', 'served', 'paid'])
      .gte('created_at', rangeISO('today'))
      .order('created_at', { ascending: true }));
  },
  async openSessions() {
    return q(sb.from('table_sessions').select('*, orders(*, order_items(*))').eq('status', 'open').order('opened_at'));
  },
  async kitchenQueue() { return rpc('kitchen_queue'); },
  async setOrderStatus(id, status, reason) { await rpc('set_order_status', { p_order: id, p_status: status, p_reason: reason || null }); },
  async staffOrder(table, name, type, items) {
    return one(await rpc('staff_order', { p_table: table, p_name: name, p_type: type, p_items: items }));
  },
  async checkout(sessionId, method, paid, discount = 0) {
    return one(await rpc('cashier_checkout', { p_session: sessionId, p_method: method, p_paid: toInt(paid), p_discount: toInt(discount) }));
  },
  async posSale(items, type, method, paid, discount, customer) {
    return one(await rpc('pos_sale', { p_items: items, p_type: type, p_method: method, p_paid: toInt(paid), p_discount: toInt(discount), p_customer: customer || '' }));
  },
  async clearTable(no) { await rpc('clear_table', { p_table: no }); },
  async voidSession(id, reason) { await rpc('void_session', { p_session: id, p_reason: reason }); },
  async setQrOpen(v) { await rpc('set_qr_open', { p_value: v }); this.c.settings.qr_open = v; },
  async rotateToken(tableNo) { const t = await rpc('rotate_table_token', { p_table: tableNo }); await this.load(); return t; },

  /* ---------- history / reports ---------- */
  async sessions(range) {
    return q(sb.from('table_sessions')
      .select('*, orders(*, order_items(*)), cashier:profiles!table_sessions_cashier_id_fkey(name)')
      .in('status', ['paid', 'void'])
      .gte('closed_at', rangeISO(range))
      .order('closed_at', { ascending: false })
      .limit(1000));
  },

  /* ---------- expenses ---------- */
  async expenses(range) {
    return q(sb.from('expenses').select('*').gte('date', dayKey(rangeStart(range))).order('date', { ascending: false }).order('id', { ascending: false }));
  },
  async saveExpense(e) {
    const row = { date: e.date || dayKey(new Date()), category: e.category || 'Lainnya', description: String(e.description || '').trim(), amount: Math.max(0, toInt(e.amount)) };
    if (!row.description) throw new Error('Keterangan wajib diisi');
    if (row.amount <= 0) throw new Error('Nominal harus lebih dari 0');
    if (e.id) await q(sb.from('expenses').update(row).eq('id', e.id));
    else await q(sb.from('expenses').insert({ ...row, user_id: this.c.profile?.id }));
  },
  async deleteExpense(id) { await q(sb.from('expenses').delete().eq('id', id)); },

  /* ---------- staff ---------- */
  async staff() { return q(sb.from('profiles').select('*').order('created_at')); },
  async createStaff(email, password, name, role) { return rpc('owner_create_staff', { p_email: email, p_password: password, p_name: name, p_role: role }); },
  async updateStaff(id, name, role, active) { await rpc('owner_update_staff', { p_id: id, p_name: name, p_role: role, p_active: active }); },
  async setStaffPassword(id, pw) { await rpc('owner_set_password', { p_id: id, p_password: pw }); },

  /* ---------- QRIS image (private bucket, signed URL) ---------- */
  async uploadQris(file) {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Format harus PNG, JPG, atau WEBP');
    if (file.size > 2 * 1024 * 1024) throw new Error('Ukuran gambar maksimal 2 MB');
    const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
    const path = `qris-${Date.now()}.${ext}`;
    const { error } = await sb.storage.from('qris').upload(path, file, { upsert: true, contentType: file.type });
    if (error) throw new Error(errMsg(error));
    await this.saveSettings({ qris_image_url: path });
  },
  async qrisUrl() {
    const path = this.settings().qris_image_url;
    if (!path) return null;
    const { data, error } = await sb.storage.from('qris').createSignedUrl(path, 3600);
    return error ? null : data.signedUrl;
  },

  /* ---------- local-only ---------- */
  held() { return Store.get('held', []); },
  hold(order) { const l = this.held(); l.push({ id: uid('h'), date: new Date().toISOString(), ...order }); Store.set('held', l); },
  unhold(id) { const l = this.held(); const o = l.find(x => x.id === id); Store.set('held', l.filter(x => x.id !== id)); return o; },
  theme() { return Store.get('theme', 'light'); },
  setTheme(t) { Store.set('theme', t); },
};

/* ---------- Realtime: one channel, fan-out to listeners ---------- */
const Live = {
  ch: null, status: 'CLOSED', listeners: new Set(),
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
  emit(evt) { this.listeners.forEach(fn => { try { fn(evt); } catch (e) { console.error(e); } }); },
  start() {
    if (this.ch) return;
    this.ch = sb.channel('pos-live');
    ['orders', 'table_sessions', 'ingredients', 'products', 'settings'].forEach(t =>
      this.ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, p => this.emit({ table: t, ...p })));
    this.ch.subscribe(status => { this.status = status; document.dispatchEvent(new CustomEvent('live-status', { detail: status })); });
  },
  async stop() { if (this.ch) { await sb.removeChannel(this.ch); this.ch = null; } },
};
