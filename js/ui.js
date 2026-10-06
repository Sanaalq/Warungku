/* ===========================================================
   UI helpers: icons, formatting, toast, modal, dialogs
   =========================================================== */
const ICONS = {
  logo: '<path d="M3 11h18"/><path d="M5 11a7 7 0 0 1 14 0"/><path d="M4 11l1.5 8a2 2 0 0 0 2 1.6h9a2 2 0 0 0 2-1.6L20 11"/><path d="M12 4V2"/>',
  pos: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 20h10M12 16v4"/>',
  box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  receipt: '<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/><path d="M6 6V4h12v2"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15v3M12 10v8M17 6v12"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  bank: '<path d="M3 10 12 4l9 6"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>',
  backspace: '<path d="M21 5H8l-6 7 6 7h13a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="m16 9-6 6M10 9l6 6"/>',
  up: '<path d="m7 14 5-5 5 5"/>',
  down: '<path d="m7 10 5 5 5-5"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6"/>',
  users: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  upload: '<path d="M12 21V9M7 14l5-5 5 5"/><path d="M4 3h16"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
  store: '<path d="M3 9 4.5 4h15L21 9"/><path d="M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v8h14v-8"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  fullscreen: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
};
function icon(name, cls = '') {
  return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/* ---------- Formatting ---------- */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function rp(n) {
  n = Math.round(Number(n) || 0);
  return (n < 0 ? '-Rp ' : 'Rp ') + Math.abs(n).toLocaleString('id-ID');
}
function rpShort(n) {
  n = Number(n) || 0;
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1).replace('.0', '') + 'M';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'jt';
  if (Math.abs(n) >= 1e3) return Math.round(n / 1e3) + 'rb';
  return String(Math.round(n));
}
function toInt(v) {
  const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}
function fmtDate(d, opt = {}) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', ...opt });
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
function fmtDateTime(d) { return `${fmtDate(d)} ${fmtTime(d)}`; }
function dayKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function uid(prefix = '') { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ---------- Toast ---------- */
function toast(msg, type = 'success') {
  let box = document.querySelector('.toasts');
  if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
  const ic = { success: 'check', error: 'x', warning: 'alert', info: 'info' }[type] || 'info';
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(ic)}<span>${esc(msg)}</span>`;
  box.appendChild(el);
  while (box.children.length > 3) box.firstElementChild.remove();
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 200); };
  el.onclick = kill;
  setTimeout(kill, 2600);
}

/* ---------- Modal ---------- */
const Modal = {
  stack: [],
  open({ title = '', body = '', foot = '', size = '', onMount, dismissable = true } = {}) {
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML = `
      <div class="modal ${size}" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>${title}</h3>
          ${dismissable ? `<button class="icon-btn sm" data-close aria-label="Tutup">${icon('x')}</button>` : ''}
        </div>
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
      </div>`;
    const ctx = { el: wrap, close: () => Modal.close(ctx), dismissable };
    wrap.addEventListener('click', e => {
      if (e.target.closest('[data-close]') || (dismissable && e.target === wrap)) ctx.close();
    });
    document.body.appendChild(wrap);
    Modal.stack.push(ctx);
    if (onMount) onMount(wrap, ctx);
    const first = wrap.querySelector('[autofocus]');
    if (first && matchMedia('(pointer:fine)').matches) setTimeout(() => first.focus(), 50);
    return ctx;
  },
  close(ctx) {
    ctx = ctx || Modal.stack[Modal.stack.length - 1];
    if (!ctx) return;
    Modal.stack = Modal.stack.filter(m => m !== ctx);
    ctx.el.remove();
    if (ctx.onClose) ctx.onClose();
  },
  closeAll() { [...Modal.stack].forEach(m => Modal.close(m)); },
};
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { const top = Modal.stack[Modal.stack.length - 1]; if (top && top.dismissable) Modal.close(top); }
});

function confirmDialog({ title = 'Konfirmasi', message = '', okText = 'Ya', danger = false } = {}) {
  return new Promise(resolve => {
    let done = false;
    const m = Modal.open({
      title: esc(title), size: 'sm',
      body: `<p class="muted">${message}</p>`,
      foot: `<button class="btn" data-close>Batal</button>
             <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okText)}</button>`,
      onMount: el => el.querySelector('[data-ok]').onclick = () => { done = true; resolve(true); Modal.close(m); },
    });
    m.onClose = () => { if (!done) resolve(false); };
  });
}

/* Read all [name] inputs of a form into object */
function formData(root) {
  const o = {};
  root.querySelectorAll('[name]').forEach(el => {
    o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
  });
  return o;
}

/* Money input: live thousand separators */
function bindMoney(root) {
  root.querySelectorAll('input[data-money]').forEach(inp => {
    const f = () => { const n = toInt(inp.value); inp.value = n ? n.toLocaleString('id-ID') : ''; };
    inp.addEventListener('input', f); f();
  });
}

/* Tiny SVG bar chart */
function barChart(data, { height = 240 } = {}) {
  const W = 640, H = height, pl = 44, pb = 26, pt = 10;
  const max = Math.max(1, ...data.map(d => d.value));
  const nice = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / nice) * nice;
  const bw = (W - pl) / Math.max(1, data.length);
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const y = pt + (H - pb - pt) * (1 - i / 4);
    g += `<line class="gridline" x1="${pl}" x2="${W}" y1="${y}" y2="${y}"/><text class="axis" x="${pl - 6}" y="${y + 4}" text-anchor="end">${rpShort(top * i / 4)}</text>`;
  }
  const step = Math.ceil(data.length / 10);
  data.forEach((d, i) => {
    const h = (H - pb - pt) * (d.value / top);
    const x = pl + i * bw + bw * 0.18;
    g += `<rect class="bar" x="${x}" y="${H - pb - h}" width="${bw * 0.64}" height="${Math.max(h, 0)}" rx="4"><title>${esc(d.label)}: ${rp(d.value)}</title></rect>`;
    if (i % step === 0) g += `<text class="axis" x="${x + bw * 0.32}" y="${H - 8}" text-anchor="middle">${esc(d.label)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${g}</svg>`;
}
