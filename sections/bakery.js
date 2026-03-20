/**
 * SPG HUB v1.0.0 | 21 MAR 2026 | Siam Palette Group
 * sections/bakery.js — Bakery Center Order Module
 * Branch stores order bakery products from Bakery Center (BC)
 * Roles: Store, BC Staff, Admin, Executive
 */

(() => {
const esc = SPG.esc;
const api = SPG.api;
const ui = SPG.ui;

// ═══════════════════════════════════════
// STATE
// ═══════════════════════════════════════
const S = {
  role: null,           // 'store' | 'bc' | 'admin' | 'executive'
  storeId: null,
  config: null,         // { cutoff_time, timezone, ... }
  categories: [],
  products: [],
  cart: [],             // [{ product_id, product_name, category, unit, price, qty, image_url }]
  quotas: [],
  wasteList: [],
  initLoaded: false,
  sortStates: {},
};

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
const SYDNEY_TZ = 'Australia/Sydney';

function sydneyNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: SYDNEY_TZ }));
}

function sydneyDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-AU', { timeZone: SYDNEY_TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
}

function sydneyDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleString('en-AU', { timeZone: SYDNEY_TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function sydneyTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleTimeString('en-AU', { timeZone: SYDNEY_TZ, hour: '2-digit', minute: '2-digit' });
}

function sydneyToday() {
  const n = sydneyNow();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function isAfterCutoff() {
  if (!S.config || !S.config.cutoff_time) return false;
  const now = sydneyNow();
  const [h, m] = S.config.cutoff_time.split(':').map(Number);
  const cutoff = new Date(now);
  cutoff.setHours(h, m, 0, 0);
  return now > cutoff;
}

function cutoffLabel() {
  if (!S.config || !S.config.cutoff_time) return '';
  return S.config.cutoff_time;
}

function fmtPrice(v) {
  return '$' + Number(v || 0).toFixed(2);
}

function fmtNum(v) {
  return Number(v || 0).toLocaleString();
}

function pct(v) {
  return Number(v || 0).toFixed(1) + '%';
}

function dayNames() {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
}

// Cart helpers
function cartTotal() {
  return S.cart.reduce((sum, i) => sum + (i.qty * i.price), 0);
}

function cartCount() {
  return S.cart.reduce((sum, i) => sum + i.qty, 0);
}

function cartFind(productId) {
  return S.cart.find(i => i.product_id === productId);
}

function cartAdd(product, qty) {
  const existing = cartFind(product.product_id);
  if (existing) {
    existing.qty = Math.max(0, existing.qty + qty);
    if (existing.qty <= 0) {
      S.cart = S.cart.filter(i => i.product_id !== product.product_id);
    }
  } else if (qty > 0) {
    S.cart.push({
      product_id: product.product_id,
      product_name: product.product_name,
      category: product.category || '',
      unit: product.unit || 'pc',
      price: Number(product.price || 0),
      qty,
      image_url: product.image_url || '',
    });
  }
  saveCart();
}

function cartSet(productId, qty) {
  const existing = cartFind(productId);
  if (existing) {
    existing.qty = Math.max(0, qty);
    if (existing.qty <= 0) {
      S.cart = S.cart.filter(i => i.product_id !== productId);
    }
  }
  saveCart();
}

function cartClear() {
  S.cart = [];
  saveCart();
}

function saveCart() {
  try { localStorage.setItem('spg_bakery_cart_' + (S.storeId || ''), JSON.stringify(S.cart)); } catch {}
}

function loadCart() {
  try {
    const raw = localStorage.getItem('spg_bakery_cart_' + (S.storeId || ''));
    S.cart = raw ? JSON.parse(raw) : [];
  } catch { S.cart = []; }
}

// Status badge for bakery statuses
const BC_STATUS = {
  draft:      { cls: 'sts-neutral', label: 'Draft' },
  submitted:  { cls: 'sts-info',    label: 'Submitted' },
  accepted:   { cls: 'sts-warn',    label: 'Accepted' },
  rejected:   { cls: 'sts-err',     label: 'Rejected' },
  fulfilled:  { cls: 'sts-ok',      label: 'Fulfilled' },
  partial:    { cls: 'sts-warn',    label: 'Partial' },
  delivered:  { cls: 'sts-ok',      label: 'Delivered' },
  cancelled:  { cls: 'sts-neutral', label: 'Cancelled' },
  pending:    { cls: 'sts-warn',    label: 'Pending' },
  received:   { cls: 'sts-info',    label: 'Received' },
  resolved:   { cls: 'sts-ok',      label: 'Resolved' },
};

function bcBadge(status) {
  const st = BC_STATUS[status] || { cls: 'sts-neutral', label: status || '-' };
  return `<span class="sts ${st.cls}">${esc(st.label)}</span>`;
}

// Post helper
function bPost(action, data = {}) {
  return api.post('bakery', action, api.tb(data));
}

// Init bundle loader
async function ensureInit() {
  if (S.initLoaded) return true;
  SPG.showLoader();
  try {
    const data = await bPost('bc_init_bundle');
    S.role = data.role || 'store';
    S.storeId = data.store_id || api.getSession()?.store_id || '';
    S.config = data.config || {};
    S.categories = data.categories || [];
    S.initLoaded = true;
    loadCart();
    return true;
  } catch (e) {
    SPG.toast(e.message || 'Failed to load bakery data', 'error');
    return false;
  } finally {
    SPG.hideLoader();
  }
}

// Toolbar with optional back button and cart icon
function bToolbar(title, actions, opts = {}) {
  let left = '';
  if (opts.back) {
    left = `<button class="btn btn-outline btn-sm" onclick="SPG.go('bakery/${esc(opts.back)}')" style="margin-right:8px;font-size:11px">\u2190 Back</button>`;
  }
  let cartIcon = '';
  if (opts.showCart && S.role === 'store') {
    const cnt = cartCount();
    cartIcon = `<button class="btn btn-outline btn-sm" onclick="SPG.go('bakery/cart')" style="position:relative;margin-left:6px">
      \uD83D\uDED2${cnt > 0 ? `<span style="position:absolute;top:-6px;right:-6px;background:var(--red);color:#fff;border-radius:50%;width:16px;height:16px;font-size:9px;display:flex;align-items:center;justify-content:center">${cnt}</span>` : ''}
    </button>`;
  }
  return `<div class="toolbar"><div style="display:flex;align-items:center">${left}<div class="toolbar-title">${esc(title)}</div></div><div style="display:flex;align-items:center;gap:6px">${actions || ''}${cartIcon}</div></div>`;
}

// KPI card
function kpiCard(label, value, sub, color) {
  return `<div class="card" style="flex:1;min-width:140px;text-align:center;padding:14px">
    <div style="font-size:11px;color:var(--t3);margin-bottom:4px">${esc(label)}</div>
    <div style="font-size:22px;font-weight:700;color:${color || 'var(--t1)'}">${esc(String(value))}</div>
    ${sub ? `<div style="font-size:10px;color:var(--t3);margin-top:2px">${esc(sub)}</div>` : ''}
  </div>`;
}

// ═══════════════════════════════════════
// PRINT HELPERS (Epson TM-M30III ePOS XML)
// ═══════════════════════════════════════
function eposPrintXml(title, lines, opts = {}) {
  const width = opts.width || 42;
  const dashes = '-'.repeat(width);
  let xml = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
<s:Body><epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">
<text align="center" font="font_a" smooth="true"/>
<text dw="true" dh="true">${escXml(title)}&#10;</text>
<text dw="false" dh="false"/>`;

  if (opts.subTitle) {
    xml += `<text>${escXml(opts.subTitle)}&#10;</text>`;
  }
  xml += `<text>${dashes}&#10;</text>`;

  for (const line of lines) {
    if (line === '---') {
      xml += `<text>${dashes}&#10;</text>`;
    } else if (line.startsWith('##')) {
      xml += `<text dw="true">${escXml(line.substring(2).trim())}&#10;</text><text dw="false"/>`;
    } else if (line.startsWith('**')) {
      xml += `<text em="true">${escXml(line.substring(2).replace(/\*\*$/, '').trim())}&#10;</text><text em="false"/>`;
    } else {
      xml += `<text>${escXml(line)}&#10;</text>`;
    }
  }

  xml += `<text>${dashes}&#10;</text>`;
  if (opts.footer) {
    xml += `<text align="center">${escXml(opts.footer)}&#10;</text>`;
  }
  xml += `<text>&#10;&#10;&#10;</text>
<cut type="feed"/>
</epos-print></s:Body></s:Envelope>`;
  return xml;
}

function escXml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function padRight(s, len) {
  s = String(s || '');
  return s.length >= len ? s.substring(0, len) : s + ' '.repeat(len - s.length);
}

function padLeft(s, len) {
  s = String(s || '');
  return s.length >= len ? s.substring(0, len) : ' '.repeat(len - s.length) + s;
}

function buildProductionSheet(printData) {
  const lines = [];
  lines.push(`Date: ${sydneyDate(printData.date || new Date())}`);
  lines.push(`Store: ${printData.store_id || 'ALL'}`);
  lines.push('---');
  lines.push(padRight('Product', 24) + padLeft('Qty', 6) + padLeft('Unit', 6));
  lines.push('---');
  (printData.items || []).forEach(item => {
    lines.push(padRight(item.product_name || '', 24) + padLeft(String(item.qty || 0), 6) + padLeft(item.unit || 'pc', 6));
  });
  lines.push('---');
  lines.push(`Total items: ${printData.items?.length || 0}`);
  return eposPrintXml('PRODUCTION SHEET', lines, {
    subTitle: 'Bakery Center',
    footer: `Printed: ${sydneyDateTime(new Date())}`,
  });
}

function buildDeliverySlip(order) {
  const lines = [];
  lines.push(`Order: ${order.order_id || ''}`);
  lines.push(`Store: ${order.store_id || ''}`);
  lines.push(`Date: ${sydneyDate(order.order_date || order.created_at)}`);
  lines.push('---');
  lines.push(padRight('Item', 20) + padLeft('Ord', 5) + padLeft('Ful', 5) + padLeft('Amt', 8));
  lines.push('---');
  (order.items || []).forEach(item => {
    const fulQty = item.fulfilled_qty != null ? item.fulfilled_qty : item.qty;
    lines.push(
      padRight(item.product_name || '', 20) +
      padLeft(String(item.qty || 0), 5) +
      padLeft(String(fulQty), 5) +
      padLeft(fmtPrice(fulQty * (item.price || 0)), 8)
    );
  });
  lines.push('---');
  const total = (order.items || []).reduce((s, i) => s + ((i.fulfilled_qty != null ? i.fulfilled_qty : i.qty) * (i.price || 0)), 0);
  lines.push(`**TOTAL: ${fmtPrice(total)}**`);
  lines.push('');
  lines.push('Received by: ________________');
  lines.push('Signature:   ________________');
  return eposPrintXml('DELIVERY SLIP', lines, {
    subTitle: `Order #${order.order_id || ''}`,
    footer: `Printed: ${sydneyDateTime(new Date())}`,
  });
}

function printEpos(xml) {
  // Open print window with XML content
  const w = window.open('', '_blank', 'width=400,height=600');
  if (!w) { SPG.toast('Popup blocked - please allow popups', 'error'); return; }
  w.document.write(`<!DOCTYPE html><html><head><title>Print</title><style>
    body{font-family:monospace;font-size:12px;padding:10px;max-width:400px;margin:auto}
    pre{white-space:pre-wrap;word-break:break-all}
    .print-actions{text-align:center;margin:20px 0}
    .print-actions button{padding:8px 20px;font-size:14px;cursor:pointer;margin:0 4px}
    @media print{.print-actions{display:none}}
  </style></head><body>
    <div class="print-actions">
      <button onclick="window.print()">Print</button>
      <button onclick="copyXml()">Copy ePOS XML</button>
      <button onclick="window.close()">Close</button>
    </div>
    <pre id="preview"></pre>
    <textarea id="xml-src" style="display:none">${escXml(xml)}</textarea>
    <script>
      var raw = document.getElementById('xml-src').value
        .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
      // Parse XML to readable preview
      var lines = raw.match(/<text[^>]*>([^<]*)<\\/text>/g) || [];
      var txt = lines.map(function(l){return l.replace(/<[^>]+>/g,'').replace(/&#10;/g,'\\n')}).join('');
      document.getElementById('preview').textContent = txt;
      function copyXml(){
        navigator.clipboard.writeText(raw).then(function(){alert('ePOS XML copied!')});
      }
    </script>
  </body></html>`);
  w.document.close();
}


// ═══════════════════════════════════════════════
// ROUTE 1: STORE HOME (default)
// ═══════════════════════════════════════════════
function renderHome() {
  return SPG.shell(`
    ${bToolbar('Bakery Order', '', { showCart: true })}
    <div class="content" id="bc-content">
      ${ui.skeleton(120, 3)}
    </div>`, 'Bakery Order');
}

async function loadHome() {
  if (!await ensureInit()) return;

  // Route based on role
  if (S.role === 'bc') { SPG.go('bakery/bc-home'); return; }
  if (S.role === 'admin') { SPG.go('bakery/admin-config'); return; }
  if (S.role === 'executive') { SPG.go('bakery/exec-overview'); return; }

  // Store dashboard
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_orders', { limit: 5 });
    const orders = data.orders || [];
    const todayOrder = orders.find(o => o.order_date === sydneyToday());
    const afterCutoff = isAfterCutoff();

    let html = '';

    // Cutoff warning
    if (afterCutoff) {
      html += `<div class="card" style="background:var(--orange-bg);border-left:3px solid var(--orange);padding:12px;margin-bottom:12px">
        <div style="font-size:12px;font-weight:600;color:var(--orange)">Cutoff Time Passed (${esc(cutoffLabel())} Sydney)</div>
        <div style="font-size:11px;color:var(--t2);margin-top:4px">Orders placed now will be for the day after tomorrow.</div>
      </div>`;
    }

    // Today's order status
    html += `<div class="card" style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">Today's Order</div>`;
    if (todayOrder) {
      html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-size:12px;color:var(--t2)">Order #${esc(todayOrder.order_id)}</span>
        ${bcBadge(todayOrder.status)}
      </div>
      <div style="font-size:11px;color:var(--t3)">Items: ${todayOrder.item_count || 0} | Total: ${fmtPrice(todayOrder.total)}</div>
      <button class="btn btn-outline btn-sm" style="margin-top:8px" onclick="SPG.go('bakery/order-detail',{id:'${esc(todayOrder.order_id)}'})">View Details</button>`;
    } else {
      html += `<div style="font-size:12px;color:var(--t3);margin-bottom:8px">No order placed yet today</div>
      <button class="btn btn-primary btn-sm" onclick="SPG.go('bakery/browse')">Start Ordering</button>`;
    }
    html += `</div>`;

    // Quick actions
    html += `<div class="card" style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">Quick Actions</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <button class="btn btn-primary btn-sm" onclick="SPG.go('bakery/browse')">Browse Products</button>
        <button class="btn btn-outline btn-sm" onclick="SPG.go('bakery/orders')">My Orders</button>
        <button class="btn btn-outline btn-sm" onclick="SPG.go('bakery/quotas')">Set Quotas</button>
        <button class="btn btn-outline btn-sm" onclick="SPG.go('bakery/waste')">Waste Log</button>
        <button class="btn btn-outline btn-sm" onclick="SPG.go('bakery/returns')">Returns</button>
        <button class="btn btn-outline btn-sm" onclick="SPG.go('bakery/stock-history')">Stock History</button>
      </div>
    </div>`;

    // Recent orders
    if (orders.length > 0) {
      html += `<div class="card">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px">Recent Orders</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr>
          <th>Order ID</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th>
        </tr></thead><tbody>`;
      for (const o of orders) {
        html += `<tr style="cursor:pointer" onclick="SPG.go('bakery/order-detail',{id:'${esc(o.order_id)}'})">
          <td style="font-weight:600">${esc(o.order_id)}</td>
          <td>${sydneyDate(o.order_date || o.created_at)}</td>
          <td>${o.item_count || 0}</td>
          <td>${fmtPrice(o.total)}</td>
          <td>${bcBadge(o.status)}</td>
        </tr>`;
      }
      html += `</tbody></table></div></div>`;
    }

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load dashboard', e.message);
  }
}


// ═══════════════════════════════════════════════
// ROUTE 2: BROWSE PRODUCTS
// ═══════════════════════════════════════════════
function renderBrowse() {
  return SPG.shell(`
    ${bToolbar('Browse Products', '', { back: 'home', showCart: true })}
    <div class="content" id="bc-content">
      ${ui.skeleton(60, 6)}
    </div>`, 'Bakery Order');
}

async function loadBrowse() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_products');
    S.products = data.products || [];
    S.categories = data.categories || S.categories;
    renderBrowseContent(el, '');
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load products', e.message);
  }
}

function renderBrowseContent(el, search, catFilter) {
  let prods = S.products;
  if (catFilter) prods = prods.filter(p => p.category === catFilter);
  if (search) {
    const q = search.toLowerCase();
    prods = prods.filter(p => (p.product_name || '').toLowerCase().includes(q) || (p.product_id || '').toLowerCase().includes(q));
  }

  const catOpts = [{ value: '', label: 'All Categories' }].concat(
    S.categories.map(c => ({ value: c.category_id || c.name, label: c.name || c.category_id }))
  );

  let html = ui.filterBar([
    { id: 'bc-cat', label: 'Category', type: 'select', options: catOpts, value: catFilter || '', onChange: "BakerySection.filterBrowse()" },
    { id: 'bc-search', label: 'Search', type: 'text', value: search || '', placeholder: 'Product name...', onChange: "BakerySection.filterBrowse()" },
  ]);

  if (isAfterCutoff()) {
    html += `<div style="padding:8px 12px;background:var(--orange-bg);border-radius:var(--rd);font-size:11px;color:var(--orange);margin-bottom:10px">
      Cutoff (${esc(cutoffLabel())}) has passed. Orders will be for day after tomorrow.
    </div>`;
  }

  if (prods.length === 0) {
    html += ui.empty('', 'No products found');
  } else {
    // Group by category
    const grouped = {};
    prods.forEach(p => {
      const cat = p.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });

    for (const [cat, items] of Object.entries(grouped)) {
      html += `<div style="font-size:12px;font-weight:700;margin:12px 0 6px;color:var(--t2)">${esc(cat)} (${items.length})</div>`;
      html += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">`;
      for (const p of items) {
        const inCart = cartFind(p.product_id);
        const qtyInCart = inCart ? inCart.qty : 0;
        html += `<div class="card" style="padding:10px;cursor:pointer" onclick="SPG.go('bakery/product-detail',{id:'${esc(p.product_id)}'})">
          ${p.image_url ? `<div style="width:100%;height:80px;background:var(--bg3);border-radius:6px;overflow:hidden;margin-bottom:6px"><img src="${esc(p.image_url)}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'"></div>` : `<div style="width:100%;height:80px;background:var(--bg3);border-radius:6px;margin-bottom:6px;display:flex;align-items:center;justify-content:center;color:var(--t4);font-size:24px">🍞</div>`}
          <div style="font-size:12px;font-weight:600;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.product_name)}</div>
          <div style="font-size:11px;color:var(--t3)">${fmtPrice(p.price)} / ${esc(p.unit || 'pc')}</div>
          ${qtyInCart > 0 ? `<div style="font-size:10px;color:var(--acc);margin-top:2px">In cart: ${qtyInCart}</div>` : ''}
        </div>`;
      }
      html += `</div>`;
    }
  }

  el.innerHTML = html;
}

function filterBrowse() {
  const el = document.getElementById('bc-content');
  if (!el) return;
  const search = document.getElementById('bc-search')?.value || '';
  const cat = document.getElementById('bc-cat')?.value || '';
  renderBrowseContent(el, search, cat);
}


// ═══════════════════════════════════════════════
// ROUTE 3: PRODUCT DETAIL
// ═══════════════════════════════════════════════
function renderProductDetail(p) {
  return SPG.shell(`
    ${bToolbar('Product Detail', '', { back: 'browse', showCart: true })}
    <div class="content" id="bc-content">
      ${ui.skeleton(200)}
    </div>`, 'Bakery Order');
}

async function loadProductDetail(p) {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;
  const productId = p?.id;
  if (!productId) { el.innerHTML = ui.empty('', 'No product selected'); return; }

  try {
    const data = await bPost('bc_get_product_detail', { product_id: productId });
    const prod = data.product || data;
    const inCart = cartFind(productId);
    const qty = inCart ? inCart.qty : 0;

    el.innerHTML = `<div class="card max-w-sm">
      ${prod.image_url ? `<div style="width:100%;height:200px;background:var(--bg3);border-radius:8px;overflow:hidden;margin-bottom:12px"><img src="${esc(prod.image_url)}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<div style=\\'text-align:center;padding:60px;font-size:48px\\'>🍞</div>'"></div>` : ''}
      <div style="font-size:16px;font-weight:700;margin-bottom:4px">${esc(prod.product_name)}</div>
      <div style="font-size:12px;color:var(--t3);margin-bottom:8px">${esc(prod.category || '')} | ${esc(prod.product_id)}</div>
      <div style="font-size:18px;font-weight:700;color:var(--acc);margin-bottom:12px">${fmtPrice(prod.price)} / ${esc(prod.unit || 'pc')}</div>
      ${prod.description ? `<div style="font-size:12px;color:var(--t2);margin-bottom:12px;line-height:1.5">${esc(prod.description)}</div>` : ''}
      ${prod.min_order ? `<div style="font-size:11px;color:var(--t3);margin-bottom:8px">Min order: ${prod.min_order} ${esc(prod.unit || 'pc')}</div>` : ''}

      <div style="display:flex;align-items:center;gap:12px;margin-top:16px">
        <button class="btn btn-outline btn-sm" onclick="BakerySection.pdAdjust('${esc(productId)}',-1)" style="width:36px;height:36px;font-size:16px">-</button>
        <input class="inp" id="pd-qty" type="number" min="0" value="${qty}" style="width:60px;text-align:center;font-size:16px;font-weight:700">
        <button class="btn btn-outline btn-sm" onclick="BakerySection.pdAdjust('${esc(productId)}',1)" style="width:36px;height:36px;font-size:16px">+</button>
      </div>
      <button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="BakerySection.pdAddToCart('${esc(productId)}')">
        ${qty > 0 ? 'Update Cart' : 'Add to Cart'}
      </button>
      ${qty > 0 ? `<button class="btn btn-outline" style="width:100%;margin-top:6px;color:var(--red);border-color:var(--red)" onclick="BakerySection.pdRemove('${esc(productId)}')">Remove from Cart</button>` : ''}
    </div>`;

    // Store product reference for cart add
    S._currentProduct = prod;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load product', e.message);
  }
}

function pdAdjust(productId, delta) {
  const inp = document.getElementById('pd-qty');
  if (!inp) return;
  inp.value = Math.max(0, (parseInt(inp.value) || 0) + delta);
}

function pdAddToCart(productId) {
  const inp = document.getElementById('pd-qty');
  const qty = parseInt(inp?.value) || 0;
  const prod = S._currentProduct || S.products.find(p => p.product_id === productId);
  if (!prod) { SPG.toast('Product not found', 'error'); return; }
  if (qty <= 0) { SPG.toast('Qty must be greater than 0', 'error'); return; }

  // Remove existing and add fresh
  S.cart = S.cart.filter(i => i.product_id !== productId);
  cartAdd(prod, qty);
  SPG.toast(`${prod.product_name} x${qty} added to cart`, 'success');
  SPG.go('bakery/browse');
}

function pdRemove(productId) {
  S.cart = S.cart.filter(i => i.product_id !== productId);
  saveCart();
  SPG.toast('Removed from cart', 'info');
  SPG.go('bakery/browse');
}


// ═══════════════════════════════════════════════
// ROUTE 4: CART
// ═══════════════════════════════════════════════
function renderCart() {
  return SPG.shell(`
    ${bToolbar('Cart', '', { back: 'browse' })}
    <div class="content" id="bc-content">
      ${ui.skeleton(100, 2)}
    </div>`, 'Bakery Order');
}

async function loadCart_() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;
  renderCartContent(el);
}

function renderCartContent(el) {
  if (S.cart.length === 0) {
    el.innerHTML = ui.empty('🛒', 'Cart is empty', 'Browse products to add items') +
      `<div style="text-align:center;margin-top:12px"><button class="btn btn-primary btn-sm" onclick="SPG.go('bakery/browse')">Browse Products</button></div>`;
    return;
  }

  let html = '';
  if (isAfterCutoff()) {
    html += `<div style="padding:8px 12px;background:var(--orange-bg);border-radius:var(--rd);font-size:11px;color:var(--orange);margin-bottom:10px">
      Cutoff (${esc(cutoffLabel())}) has passed. This order will be for day after tomorrow.
    </div>`;
  }

  html += `<div class="card" style="margin-bottom:12px">`;
  for (let i = 0; i < S.cart.length; i++) {
    const item = S.cart[i];
    html += `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;${i < S.cart.length - 1 ? 'border-bottom:1px solid var(--bd2)' : ''}">
      <div style="flex:1">
        <div style="font-size:12px;font-weight:600">${esc(item.product_name)}</div>
        <div style="font-size:11px;color:var(--t3)">${fmtPrice(item.price)} / ${esc(item.unit)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <button class="btn btn-outline btn-sm" style="width:28px;height:28px;padding:0;font-size:14px" onclick="BakerySection.cartAdjust(${i},-1)">-</button>
        <input class="inp" type="number" min="0" value="${item.qty}" style="width:48px;text-align:center;font-size:12px;padding:4px" onchange="BakerySection.cartSetQty(${i},this.value)">
        <button class="btn btn-outline btn-sm" style="width:28px;height:28px;padding:0;font-size:14px" onclick="BakerySection.cartAdjust(${i},1)">+</button>
      </div>
      <div style="width:70px;text-align:right;font-size:12px;font-weight:600">${fmtPrice(item.qty * item.price)}</div>
      <button class="btn btn-outline btn-sm" style="width:28px;height:28px;padding:0;color:var(--red);border-color:var(--red);font-size:12px" onclick="BakerySection.cartRemove(${i})">✕</button>
    </div>`;
  }
  html += `</div>`;

  // Summary
  html += `<div class="card" style="margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="font-size:12px;color:var(--t3)">Items</span><span style="font-size:12px">${cartCount()}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;padding-top:8px;border-top:1px solid var(--bd2)"><span>Total</span><span style="color:var(--acc)">${fmtPrice(cartTotal())}</span></div>
  </div>`;

  html += `<div style="display:flex;gap:8px">
    <button class="btn btn-outline" style="flex:1;color:var(--red);border-color:var(--red)" onclick="BakerySection.cartClearAll()">Clear Cart</button>
    <button class="btn btn-primary" style="flex:2" onclick="BakerySection.submitOrder()">Submit Order</button>
  </div>`;

  el.innerHTML = html;
}

function cartAdjust(idx, delta) {
  if (!S.cart[idx]) return;
  S.cart[idx].qty = Math.max(0, S.cart[idx].qty + delta);
  if (S.cart[idx].qty <= 0) S.cart.splice(idx, 1);
  saveCart();
  const el = document.getElementById('bc-content');
  if (el) renderCartContent(el);
}

function cartSetQty(idx, val) {
  if (!S.cart[idx]) return;
  const q = parseInt(val) || 0;
  if (q <= 0) { S.cart.splice(idx, 1); } else { S.cart[idx].qty = q; }
  saveCart();
  const el = document.getElementById('bc-content');
  if (el) renderCartContent(el);
}

function cartRemove(idx) {
  S.cart.splice(idx, 1);
  saveCart();
  const el = document.getElementById('bc-content');
  if (el) renderCartContent(el);
}

function cartClearAll() {
  SPG.showDialog(`<div class="popup-sheet" style="width:300px">
    <div class="popup-header"><div class="popup-title">Clear Cart?</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div style="font-size:12px;color:var(--t2);margin-bottom:14px">All items will be removed from your cart.</div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" style="background:var(--red)" onclick="BakerySection.doCartClear()">Clear</button>
    </div>
  </div>`);
}

function doCartClear() {
  cartClear();
  SPG.closeDialog();
  const el = document.getElementById('bc-content');
  if (el) renderCartContent(el);
  SPG.toast('Cart cleared', 'info');
}

async function submitOrder() {
  if (S.cart.length === 0) { SPG.toast('Cart is empty', 'error'); return; }

  const items = S.cart.map(i => ({
    product_id: i.product_id,
    qty: i.qty,
    price: i.price,
  }));

  SPG.showLoader();
  try {
    const data = await bPost('bc_create_order', { items, after_cutoff: isAfterCutoff() });
    cartClear();
    SPG.hideLoader();
    SPG.toast('Order submitted!', 'success');
    SPG.go('bakery/order-confirmed', { id: data.order_id });
  } catch (e) {
    SPG.hideLoader();
    SPG.toast(e.message || 'Failed to submit order', 'error');
  }
}


// ═══════════════════════════════════════════════
// ROUTE 5: ORDER CONFIRMED
// ═══════════════════════════════════════════════
function renderOrderConfirmed(p) {
  return SPG.shell(`
    ${bToolbar('Order Confirmed')}
    <div class="content" id="bc-content">
      ${ui.skeleton(200)}
    </div>`, 'Bakery Order');
}

async function loadOrderConfirmed(p) {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;
  const orderId = p?.id;
  if (!orderId) { el.innerHTML = ui.empty('', 'No order ID'); return; }

  try {
    const data = await bPost('bc_get_order_detail', { order_id: orderId });
    const order = data.order || data;
    const items = order.items || [];

    el.innerHTML = `<div class="card max-w-sm" style="text-align:center;padding:24px">
      <div style="font-size:36px;margin-bottom:8px">✅</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:4px">Order Submitted!</div>
      <div style="font-size:12px;color:var(--t3);margin-bottom:16px">Your order has been sent to Bakery Center</div>
      <div style="background:var(--bg3);border-radius:var(--rd);padding:12px;margin-bottom:16px;text-align:left">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:11px;color:var(--t3)">Order ID</span><span style="font-size:12px;font-weight:600">${esc(order.order_id)}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:11px;color:var(--t3)">Date</span><span style="font-size:12px">${sydneyDate(order.order_date || order.created_at)}</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:11px;color:var(--t3)">Items</span><span style="font-size:12px">${items.length}</span></div>
        <div style="display:flex;justify-content:space-between"><span style="font-size:11px;color:var(--t3)">Total</span><span style="font-size:14px;font-weight:700;color:var(--acc)">${fmtPrice(order.total || items.reduce((s, i) => s + i.qty * i.price, 0))}</span></div>
      </div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button class="btn btn-outline btn-sm" onclick="SPG.go('bakery/order-detail',{id:'${esc(order.order_id)}'})">View Order</button>
        <button class="btn btn-primary btn-sm" onclick="SPG.go('bakery/home')">Back to Home</button>
      </div>
    </div>`;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load order', e.message);
  }
}


// ═══════════════════════════════════════════════
// ROUTE 6: ORDERS LIST
// ═══════════════════════════════════════════════
function renderOrders() {
  return SPG.shell(`
    ${bToolbar('My Orders', '', { back: 'home' })}
    <div class="content" id="bc-content">
      ${ui.skeleton(60, 5)}
    </div>`, 'Bakery Order');
}

async function loadOrders() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_orders');
    const orders = data.orders || [];
    renderOrdersList(el, orders, '');
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load orders', e.message);
  }
}

function renderOrdersList(el, orders, statusFilter) {
  const filtered = statusFilter ? orders.filter(o => o.status === statusFilter) : orders;

  const statusOpts = [
    { value: '', label: 'All' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'fulfilled', label: 'Fulfilled' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'rejected', label: 'Rejected' },
  ];

  let html = ui.filterBar([
    { id: 'ord-status', label: 'Status', type: 'select', options: statusOpts, value: statusFilter, onChange: "BakerySection.filterOrders()" },
  ]);

  if (filtered.length === 0) {
    html += ui.empty('', 'No orders found');
  } else {
    html += `<div class="tbl-wrap"><table class="tbl"><thead><tr>
      ${ui.sortTh('orders', 'order_id', 'Order ID')}
      ${ui.sortTh('orders', 'order_date', 'Date')}
      <th>Items</th>
      ${ui.sortTh('orders', 'total', 'Total')}
      <th>Status</th>
    </tr></thead><tbody>`;
    const sorted = ui.getSortState('orders')
      ? ui.sortData(filtered, ui.getSortState('orders').key, ui.getSortState('orders').dir)
      : filtered;
    for (const o of sorted) {
      html += `<tr style="cursor:pointer" onclick="SPG.go('bakery/order-detail',{id:'${esc(o.order_id)}'})">
        <td style="font-weight:600">${esc(o.order_id)}</td>
        <td>${sydneyDate(o.order_date || o.created_at)}</td>
        <td>${o.item_count || 0}</td>
        <td>${fmtPrice(o.total)}</td>
        <td>${bcBadge(o.status)}</td>
      </tr>`;
    }
    html += `</tbody></table></div>`;
  }

  el.innerHTML = html;
  // Store for filter
  el._orders = orders;
}

function filterOrders() {
  const el = document.getElementById('bc-content');
  if (!el || !el._orders) return;
  const status = document.getElementById('ord-status')?.value || '';
  renderOrdersList(el, el._orders, status);
}


// ═══════════════════════════════════════════════
// ROUTE 7: ORDER DETAIL
// ═══════════════════════════════════════════════
function renderOrderDetail(p) {
  return SPG.shell(`
    ${bToolbar('Order Detail', '', { back: 'orders' })}
    <div class="content" id="bc-content">
      ${ui.skeleton(300)}
    </div>`, 'Bakery Order');
}

async function loadOrderDetail(p) {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;
  const orderId = p?.id;
  if (!orderId) { el.innerHTML = ui.empty('', 'No order ID'); return; }

  try {
    const data = await bPost('bc_get_order_detail', { order_id: orderId });
    const order = data.order || data;
    const items = order.items || [];
    const timeline = order.timeline || [];

    let html = `<div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:14px;font-weight:700">Order #${esc(order.order_id)}</div>
        ${bcBadge(order.status)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;margin-bottom:12px">
        <div><span style="color:var(--t3)">Store:</span> ${esc(order.store_id)}</div>
        <div><span style="color:var(--t3)">Date:</span> ${sydneyDate(order.order_date || order.created_at)}</div>
        <div><span style="color:var(--t3)">Submitted:</span> ${sydneyDateTime(order.created_at)}</div>
        <div><span style="color:var(--t3)">Updated:</span> ${sydneyDateTime(order.updated_at)}</div>
      </div>

      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th>Product</th><th style="text-align:right">Qty</th><th style="text-align:right">Fulfilled</th><th style="text-align:right">Price</th><th style="text-align:right">Subtotal</th>
      </tr></thead><tbody>`;
    let total = 0;
    for (const item of items) {
      const fulQty = item.fulfilled_qty != null ? item.fulfilled_qty : item.qty;
      const sub = fulQty * (item.price || 0);
      total += sub;
      html += `<tr>
        <td>${esc(item.product_name)}</td>
        <td style="text-align:right">${item.qty}</td>
        <td style="text-align:right">${item.fulfilled_qty != null ? item.fulfilled_qty : '-'}</td>
        <td style="text-align:right">${fmtPrice(item.price)}</td>
        <td style="text-align:right;font-weight:600">${fmtPrice(sub)}</td>
      </tr>`;
    }
    html += `</tbody></table></div>
      <div style="text-align:right;font-size:14px;font-weight:700;margin-top:8px">Total: <span style="color:var(--acc)">${fmtPrice(order.total || total)}</span></div>
    </div>`;

    // Timeline
    if (timeline.length > 0) {
      html += `<div class="card">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px">Timeline</div>`;
      for (const t of timeline) {
        html += `<div style="display:flex;gap:10px;padding:6px 0;border-bottom:1px solid var(--bd2)">
          <div style="width:6px;height:6px;border-radius:50%;background:var(--acc);margin-top:4px;flex-shrink:0"></div>
          <div>
            <div style="font-size:11px;font-weight:600">${esc(t.action || t.status)}</div>
            <div style="font-size:10px;color:var(--t3)">${sydneyDateTime(t.created_at)} ${t.user_name ? '- ' + esc(t.user_name) : ''}</div>
            ${t.note ? `<div style="font-size:10px;color:var(--t2);margin-top:2px">${esc(t.note)}</div>` : ''}
          </div>
        </div>`;
      }
      html += `</div>`;
    }

    // Reorder note
    if (order.reject_reason) {
      html += `<div class="card" style="background:var(--red-bg);border-left:3px solid var(--red);margin-top:12px">
        <div style="font-size:12px;font-weight:600;color:var(--red)">Rejection Reason</div>
        <div style="font-size:11px;color:var(--t2);margin-top:4px">${esc(order.reject_reason)}</div>
      </div>`;
    }

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load order', e.message);
  }
}


// ═══════════════════════════════════════════════
// ROUTE 8: QUOTAS
// ═══════════════════════════════════════════════
function renderQuotas() {
  return SPG.shell(`
    ${bToolbar('Daily Quotas', '<button class="btn btn-primary btn-sm" id="btn-save-quotas" onclick="BakerySection.saveQuotas()">Save</button>', { back: 'home' })}
    <div class="content" id="bc-content">
      ${ui.skeleton(200)}
    </div>`, 'Bakery Order');
}

async function loadQuotas() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_quotas');
    S.quotas = data.quotas || [];
    renderQuotasTable(el);
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load quotas', e.message);
  }
}

function renderQuotasTable(el) {
  const days = dayNames();

  let html = `<div style="font-size:11px;color:var(--t3);margin-bottom:10px">Set expected daily quantities for each product. These help Bakery Center plan production.</div>`;
  html += `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Product</th>`;
  days.forEach(d => { html += `<th style="text-align:center;min-width:50px">${d}</th>`; });
  html += `</tr></thead><tbody>`;

  if (S.quotas.length === 0) {
    html += `<tr><td colspan="8" style="text-align:center;color:var(--t3);padding:20px">No products configured for quotas</td></tr>`;
  } else {
    S.quotas.forEach((q, idx) => {
      html += `<tr><td style="font-size:11px;font-weight:600;white-space:nowrap">${esc(q.product_name)}</td>`;
      days.forEach((d, di) => {
        const key = d.toLowerCase();
        const val = q[key] || q.days?.[di] || 0;
        html += `<td style="text-align:center"><input class="inp" type="number" min="0" value="${val}" style="width:50px;text-align:center;font-size:11px;padding:3px" data-quota="${idx}" data-day="${di}"></td>`;
      });
      html += `</tr>`;
    });
  }

  html += `</tbody></table></div>`;
  el.innerHTML = html;
}

async function saveQuotas() {
  const inputs = document.querySelectorAll('[data-quota]');
  const quotaMap = {};
  inputs.forEach(inp => {
    const idx = parseInt(inp.dataset.quota);
    const day = parseInt(inp.dataset.day);
    if (!quotaMap[idx]) quotaMap[idx] = { product_id: S.quotas[idx]?.product_id, days: [0, 0, 0, 0, 0, 0, 0] };
    quotaMap[idx].days[day] = parseInt(inp.value) || 0;
  });

  const quotas = Object.values(quotaMap);
  SPG.showLoader();
  try {
    await bPost('bc_save_quotas', { quotas });
    SPG.toast('Quotas saved', 'success');
  } catch (e) {
    SPG.toast(e.message || 'Failed to save quotas', 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ═══════════════════════════════════════════════
// ROUTE 9: WASTE
// ═══════════════════════════════════════════════
function renderWaste() {
  return SPG.shell(`
    ${bToolbar('Waste Log', '<button class="btn btn-primary btn-sm" onclick="BakerySection.showWasteForm()">+ Log Waste</button>', { back: 'home' })}
    <div class="content" id="bc-content">
      ${ui.skeleton(60, 4)}
    </div>`, 'Bakery Order');
}

async function loadWaste() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_waste');
    S.wasteList = data.waste || [];
    renderWasteList(el);
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load waste records', e.message);
  }
}

function renderWasteList(el) {
  if (S.wasteList.length === 0) {
    el.innerHTML = ui.empty('', 'No waste records', 'Use + Log Waste to add entries');
    return;
  }

  let html = `<div class="tbl-wrap"><table class="tbl"><thead><tr>
    ${ui.sortTh('waste', 'date', 'Date')}
    ${ui.sortTh('waste', 'product_name', 'Product')}
    <th style="text-align:right">Qty</th>
    <th>Reason</th>
    <th>Actions</th>
  </tr></thead><tbody>`;

  const sorted = ui.getSortState('waste')
    ? ui.sortData(S.wasteList, ui.getSortState('waste').key, ui.getSortState('waste').dir)
    : S.wasteList;

  for (const w of sorted) {
    html += `<tr>
      <td>${sydneyDate(w.date)}</td>
      <td>${esc(w.product_name)}</td>
      <td style="text-align:right">${w.qty} ${esc(w.unit || 'pc')}</td>
      <td>${esc(w.reason)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-outline btn-sm" style="font-size:10px;padding:2px 6px" onclick="BakerySection.showWasteForm('${esc(w.waste_id)}')">Edit</button>
        <button class="btn btn-outline btn-sm" style="font-size:10px;padding:2px 6px;color:var(--red);border-color:var(--red)" onclick="BakerySection.deleteWaste('${esc(w.waste_id)}')">Del</button>
      </td>
    </tr>`;
  }
  html += `</tbody></table></div>`;
  el.innerHTML = html;
}

function showWasteForm(wasteId) {
  const existing = wasteId ? S.wasteList.find(w => w.waste_id === wasteId) : null;
  const reasons = ['spoilage', 'overproduction', 'damaged', 'other'];

  const reasonOpts = reasons.map(r =>
    `<option value="${r}"${existing && existing.reason === r ? ' selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`
  ).join('');

  SPG.showDialog(`<div class="popup-sheet" style="width:360px">
    <div class="popup-header"><div class="popup-title">${existing ? 'Edit' : 'Log'} Waste</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Date *</label><input class="inp" type="date" id="wf-date" value="${existing ? (existing.date || '') : sydneyToday()}"></div>
    <div class="fg"><label class="lb">Product *</label><input class="inp" id="wf-product" value="${existing ? esc(existing.product_name || '') : ''}" placeholder="Product name or ID"${existing ? ' data-pid="' + esc(existing.product_id) + '"' : ''}></div>
    <div class="fg"><label class="lb">Qty *</label><input class="inp" type="number" id="wf-qty" min="1" value="${existing ? existing.qty : ''}"></div>
    <div class="fg"><label class="lb">Reason *</label><select class="inp" id="wf-reason">${reasonOpts}</select></div>
    <div class="fg"><label class="lb">Notes</label><textarea class="inp" id="wf-notes" rows="2" style="width:100%;box-sizing:border-box">${existing ? esc(existing.notes || '') : ''}</textarea></div>
    <div class="error-msg" id="wf-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="BakerySection.doSaveWaste('${wasteId || ''}')">Save</button>
    </div>
  </div>`);
}

async function doSaveWaste(wasteId) {
  const date = document.getElementById('wf-date')?.value;
  const product_name = document.getElementById('wf-product')?.value.trim();
  const product_id = document.getElementById('wf-product')?.dataset?.pid || product_name;
  const qty = parseInt(document.getElementById('wf-qty')?.value) || 0;
  const reason = document.getElementById('wf-reason')?.value;
  const notes = document.getElementById('wf-notes')?.value.trim();

  if (!date || !product_name || qty <= 0) {
    SPG.showError('wf-error', 'Please fill date, product and qty');
    return;
  }

  SPG.showLoader();
  try {
    const action = wasteId ? 'bc_update_waste' : 'bc_log_waste';
    const payload = { date, product_id, product_name, qty, reason, notes };
    if (wasteId) payload.waste_id = wasteId;
    await bPost(action, payload);
    SPG.closeDialog();
    SPG.toast('Waste record saved', 'success');
    // Reload
    const data = await bPost('bc_get_waste');
    S.wasteList = data.waste || [];
    const el = document.getElementById('bc-content');
    if (el) renderWasteList(el);
  } catch (e) {
    SPG.showError('wf-error', e.message);
  } finally {
    SPG.hideLoader();
  }
}

async function deleteWaste(wasteId) {
  SPG.showDialog(`<div class="popup-sheet" style="width:300px">
    <div class="popup-header"><div class="popup-title">Delete Waste Record?</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div style="font-size:12px;color:var(--t2);margin-bottom:14px">This action cannot be undone.</div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" style="background:var(--red)" onclick="BakerySection.doDeleteWaste('${esc(wasteId)}')">Delete</button>
    </div>
  </div>`);
}

async function doDeleteWaste(wasteId) {
  SPG.showLoader();
  try {
    await bPost('bc_delete_waste', { waste_id: wasteId });
    SPG.closeDialog();
    SPG.toast('Waste record deleted', 'info');
    S.wasteList = S.wasteList.filter(w => w.waste_id !== wasteId);
    const el = document.getElementById('bc-content');
    if (el) renderWasteList(el);
  } catch (e) {
    SPG.toast(e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ═══════════════════════════════════════════════
// ROUTE 10: RETURNS
// ═══════════════════════════════════════════════
function renderReturns() {
  return SPG.shell(`
    ${bToolbar('Returns', '<button class="btn btn-primary btn-sm" onclick="BakerySection.showReturnForm()">+ New Return</button>', { back: 'home' })}
    <div class="content" id="bc-content">
      ${ui.skeleton(60, 3)}
    </div>`, 'Bakery Order');
}

async function loadReturns() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_returns');
    const returns = data.returns || [];
    renderReturnsList(el, returns);
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load returns', e.message);
  }
}

function renderReturnsList(el, returns) {
  if (returns.length === 0) {
    el.innerHTML = ui.empty('', 'No returns', 'Use + New Return to create one');
    return;
  }

  let html = `<div class="tbl-wrap"><table class="tbl"><thead><tr>
    <th>Return ID</th><th>Date</th><th>Order</th><th>Product</th><th>Qty</th><th>Reason</th><th>Status</th>
  </tr></thead><tbody>`;

  for (const r of returns) {
    html += `<tr>
      <td style="font-weight:600">${esc(r.return_id)}</td>
      <td>${sydneyDate(r.created_at)}</td>
      <td>${esc(r.order_id || '-')}</td>
      <td>${esc(r.product_name)}</td>
      <td>${r.qty}</td>
      <td>${esc(r.reason)}</td>
      <td>${bcBadge(r.status)}</td>
    </tr>`;
  }

  html += `</tbody></table></div>`;
  el.innerHTML = html;
}

function showReturnForm() {
  SPG.showDialog(`<div class="popup-sheet" style="width:380px">
    <div class="popup-header"><div class="popup-title">New Return</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Order ID (optional)</label><input class="inp" id="rf-order" placeholder="e.g. ORD-20260321-001"></div>
    <div class="fg"><label class="lb">Product *</label><input class="inp" id="rf-product" placeholder="Product name or ID"></div>
    <div class="fg"><label class="lb">Qty *</label><input class="inp" type="number" id="rf-qty" min="1"></div>
    <div class="fg"><label class="lb">Reason *</label><select class="inp" id="rf-reason">
      <option value="damaged">Damaged</option>
      <option value="wrong_item">Wrong Item</option>
      <option value="quality">Quality Issue</option>
      <option value="excess">Excess / Over-delivery</option>
      <option value="other">Other</option>
    </select></div>
    <div class="fg"><label class="lb">Notes</label><textarea class="inp" id="rf-notes" rows="2" style="width:100%;box-sizing:border-box"></textarea></div>
    <div class="error-msg" id="rf-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="BakerySection.doCreateReturn()">Submit Return</button>
    </div>
  </div>`);
}

async function doCreateReturn() {
  const order_id = document.getElementById('rf-order')?.value.trim();
  const product_name = document.getElementById('rf-product')?.value.trim();
  const qty = parseInt(document.getElementById('rf-qty')?.value) || 0;
  const reason = document.getElementById('rf-reason')?.value;
  const notes = document.getElementById('rf-notes')?.value.trim();

  if (!product_name || qty <= 0) {
    SPG.showError('rf-error', 'Please fill product and qty');
    return;
  }

  SPG.showLoader();
  try {
    await bPost('bc_create_return', { order_id, product_name, qty, reason, notes });
    SPG.closeDialog();
    SPG.toast('Return submitted', 'success');
    loadReturns();
  } catch (e) {
    SPG.showError('rf-error', e.message);
  } finally {
    SPG.hideLoader();
  }
}


// ═══════════════════════════════════════════════
// ROUTE 11: STOCK HISTORY
// ═══════════════════════════════════════════════
function renderStockHistory() {
  return SPG.shell(`
    ${bToolbar('Stock Received History', '', { back: 'home' })}
    <div class="content" id="bc-content">
      ${ui.skeleton(60, 5)}
    </div>`, 'Bakery Order');
}

async function loadStockHistory() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_stock_history');
    const history = data.history || [];

    if (history.length === 0) {
      el.innerHTML = ui.empty('', 'No stock history');
      return;
    }

    let html = ui.filterBar([
      { id: 'sh-date', label: 'Date', type: 'date', value: '', onChange: "BakerySection.filterStockHistory()" },
    ]);

    html += `<div class="tbl-wrap"><table class="tbl" id="sh-table"><thead><tr>
      ${ui.sortTh('stock', 'date', 'Date')}
      <th>Order ID</th>
      ${ui.sortTh('stock', 'product_name', 'Product')}
      <th style="text-align:right">Ordered</th>
      <th style="text-align:right">Received</th>
      <th>Status</th>
    </tr></thead><tbody>`;

    for (const h of history) {
      html += `<tr>
        <td>${sydneyDate(h.date)}</td>
        <td>${esc(h.order_id || '-')}</td>
        <td>${esc(h.product_name)}</td>
        <td style="text-align:right">${h.ordered_qty || 0}</td>
        <td style="text-align:right">${h.received_qty || 0}</td>
        <td>${bcBadge(h.status || 'received')}</td>
      </tr>`;
    }

    html += `</tbody></table></div>`;
    el.innerHTML = html;
    el._history = history;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load stock history', e.message);
  }
}

function filterStockHistory() {
  const el = document.getElementById('bc-content');
  if (!el || !el._history) return;
  const dateVal = document.getElementById('sh-date')?.value;
  // Re-render with filter — simplified: just reload
  loadStockHistory();
}


// ════════════════════════════════════════════════════
// ROUTE 12: BC HOME (BC Staff Dashboard)
// ════════════════════════════════════════════════════
function renderBcHome() {
  return SPG.shell(`
    ${bToolbar('Bakery Center Dashboard')}
    <div class="content" id="bc-content">
      ${ui.skeleton(100, 3)}
    </div>`, 'Bakery Order');
}

async function loadBcHome() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_bc_dashboard');
    const d = data.dashboard || data;

    let html = '';

    // KPIs
    html += `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      ${kpiCard('Pending Orders', d.pending_orders || 0, 'Awaiting acceptance', 'var(--orange)')}
      ${kpiCard('In Fulfilment', d.fulfilling_orders || 0, 'Being prepared', 'var(--blue)')}
      ${kpiCard('Fulfilled Today', d.fulfilled_today || 0, '', 'var(--green)')}
      ${kpiCard('Total Items Today', d.total_items_today || 0, '', 'var(--t1)')}
    </div>`;

    // Quick actions
    html += `<div class="card" style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">Quick Actions</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <button class="btn btn-primary btn-sm" onclick="SPG.go('bakery/bc-accept')">Accept Orders</button>
        <button class="btn btn-outline btn-sm" onclick="SPG.go('bakery/bc-fulfil')">Fulfilment</button>
        <button class="btn btn-outline btn-sm" onclick="SPG.go('bakery/bc-print')">Print Centre</button>
        <button class="btn btn-outline btn-sm" onclick="SPG.go('bakery/bc-returns')">Returns</button>
        <button class="btn btn-outline btn-sm" onclick="SPG.go('bakery/bc-products')">Products</button>
      </div>
    </div>`;

    // Today's summary
    if (d.store_summary && d.store_summary.length > 0) {
      html += `<div class="card">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px">Today's Orders by Store</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr>
          <th>Store</th><th style="text-align:right">Orders</th><th style="text-align:right">Items</th><th>Status</th>
        </tr></thead><tbody>`;
      for (const s of d.store_summary) {
        html += `<tr>
          <td style="font-weight:600">${esc(s.store_id)}</td>
          <td style="text-align:right">${s.order_count || 0}</td>
          <td style="text-align:right">${s.item_count || 0}</td>
          <td>${bcBadge(s.latest_status)}</td>
        </tr>`;
      }
      html += `</tbody></table></div></div>`;
    }

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load dashboard', e.message);
  }
}


// ════════════════════════════════════════════════════
// ROUTE 13: BC ACCEPT ORDERS
// ════════════════════════════════════════════════════
function renderBcAccept() {
  return SPG.shell(`
    ${bToolbar('Accept / Reject Orders', '', { back: 'bc-home' })}
    <div class="content" id="bc-content">
      ${ui.skeleton(60, 5)}
    </div>`, 'Bakery Order');
}

async function loadBcAccept() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_pending_orders');
    const orders = data.orders || [];

    if (orders.length === 0) {
      el.innerHTML = ui.empty('', 'No pending orders', 'All orders have been processed');
      return;
    }

    let html = '';
    for (const o of orders) {
      html += `<div class="card" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div>
            <div style="font-size:13px;font-weight:700">Order #${esc(o.order_id)}</div>
            <div style="font-size:11px;color:var(--t3)">${esc(o.store_id)} | ${sydneyDateTime(o.created_at)}</div>
          </div>
          ${bcBadge(o.status)}
        </div>
        <div class="tbl-wrap"><table class="tbl" style="font-size:11px"><thead><tr>
          <th>Product</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th>
        </tr></thead><tbody>`;
      for (const item of (o.items || [])) {
        html += `<tr><td>${esc(item.product_name)}</td><td style="text-align:right">${item.qty}</td><td style="text-align:right">${fmtPrice(item.price)}</td></tr>`;
      }
      html += `</tbody></table></div>
        <div style="text-align:right;font-size:12px;font-weight:600;margin:6px 0">Total: ${fmtPrice(o.total)}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red)" onclick="BakerySection.rejectOrder('${esc(o.order_id)}')">Reject</button>
          <button class="btn btn-primary btn-sm" onclick="BakerySection.acceptOrder('${esc(o.order_id)}')">Accept</button>
        </div>
      </div>`;
    }

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load orders', e.message);
  }
}

async function acceptOrder(orderId) {
  SPG.showLoader();
  try {
    await bPost('bc_accept_order', { order_id: orderId });
    SPG.toast('Order accepted', 'success');
    loadBcAccept();
  } catch (e) {
    SPG.toast(e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}

function rejectOrder(orderId) {
  SPG.showDialog(`<div class="popup-sheet" style="width:340px">
    <div class="popup-header"><div class="popup-title">Reject Order</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Reason *</label><textarea class="inp" id="rej-reason" rows="3" style="width:100%;box-sizing:border-box" placeholder="Why is this order being rejected?"></textarea></div>
    <div class="error-msg" id="rej-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" style="background:var(--red)" onclick="BakerySection.doRejectOrder('${esc(orderId)}')">Reject</button>
    </div>
  </div>`);
}

async function doRejectOrder(orderId) {
  const reason = document.getElementById('rej-reason')?.value.trim();
  if (!reason) { SPG.showError('rej-error', 'Reason is required'); return; }
  SPG.showLoader();
  try {
    await bPost('bc_reject_order', { order_id: orderId, reason });
    SPG.closeDialog();
    SPG.toast('Order rejected', 'info');
    loadBcAccept();
  } catch (e) {
    SPG.showError('rej-error', e.message);
  } finally {
    SPG.hideLoader();
  }
}


// ════════════════════════════════════════════════════
// ROUTE 14: BC FULFIL
// ════════════════════════════════════════════════════
function renderBcFulfil() {
  return SPG.shell(`
    ${bToolbar('Fulfilment', '', { back: 'bc-home' })}
    <div class="content" id="bc-content">
      ${ui.skeleton(80, 4)}
    </div>`, 'Bakery Order');
}

async function loadBcFulfil() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_fulfil_orders');
    const orders = data.orders || [];

    if (orders.length === 0) {
      el.innerHTML = ui.empty('', 'No orders to fulfil', 'All accepted orders have been fulfilled');
      return;
    }

    let html = '';
    for (const o of orders) {
      html += `<div class="card" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div>
            <div style="font-size:13px;font-weight:700">#${esc(o.order_id)} - ${esc(o.store_id)}</div>
            <div style="font-size:11px;color:var(--t3)">${sydneyDateTime(o.created_at)}</div>
          </div>
          ${bcBadge(o.status)}
        </div>`;

      html += `<div class="tbl-wrap"><table class="tbl" style="font-size:11px"><thead><tr>
        <th>Product</th><th style="text-align:center">Ordered</th><th style="text-align:center">Fulfil</th>
      </tr></thead><tbody>`;
      for (const item of (o.items || [])) {
        const fulQty = item.fulfilled_qty != null ? item.fulfilled_qty : item.qty;
        html += `<tr>
          <td>${esc(item.product_name)}</td>
          <td style="text-align:center">${item.qty}</td>
          <td style="text-align:center">
            <input class="inp" type="number" min="0" max="${item.qty}" value="${fulQty}" style="width:60px;text-align:center;font-size:11px;padding:3px" data-order="${esc(o.order_id)}" data-item="${esc(item.item_id || item.product_id)}">
          </td>
        </tr>`;
      }
      html += `</tbody></table></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">
          <button class="btn btn-primary btn-sm" onclick="BakerySection.doFulfil('${esc(o.order_id)}')">Mark Fulfilled</button>
        </div>
      </div>`;
    }

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load fulfilment data', e.message);
  }
}

async function doFulfil(orderId) {
  const inputs = document.querySelectorAll(`[data-order="${orderId}"]`);
  const items = [];
  inputs.forEach(inp => {
    items.push({
      item_id: inp.dataset.item,
      fulfilled_qty: parseInt(inp.value) || 0,
    });
  });

  SPG.showLoader();
  try {
    await bPost('bc_update_fulfilment', { order_id: orderId, items });
    SPG.toast('Order fulfilled', 'success');
    loadBcFulfil();
  } catch (e) {
    SPG.toast(e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ════════════════════════════════════════════════════
// ROUTE 15: BC PRINT
// ════════════════════════════════════════════════════
function renderBcPrint() {
  return SPG.shell(`
    ${bToolbar('Print Centre', '', { back: 'bc-home' })}
    <div class="content" id="bc-content">
      ${ui.skeleton(100, 2)}
    </div>`, 'Bakery Order');
}

async function loadBcPrint() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_print_data');
    const printData = data;

    let html = `<div class="card" style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">Production Sheet</div>
      <div style="font-size:11px;color:var(--t3);margin-bottom:10px">Consolidated production sheet for today's orders</div>`;

    if (printData.production_items && printData.production_items.length > 0) {
      html += `<div class="tbl-wrap"><table class="tbl" style="font-size:11px"><thead><tr>
        <th>Product</th><th>Category</th><th style="text-align:right">Total Qty</th><th>Unit</th>
      </tr></thead><tbody>`;
      for (const item of printData.production_items) {
        html += `<tr>
          <td>${esc(item.product_name)}</td>
          <td>${esc(item.category || '-')}</td>
          <td style="text-align:right;font-weight:600">${item.qty}</td>
          <td>${esc(item.unit || 'pc')}</td>
        </tr>`;
      }
      html += `</tbody></table></div>`;
    } else {
      html += `<div style="text-align:center;padding:12px;color:var(--t3);font-size:11px">No production data for today</div>`;
    }

    html += `<button class="btn btn-primary btn-sm" style="margin-top:10px" onclick="BakerySection.printProduction()">Print Production Sheet</button>
    </div>`;

    // Delivery slips
    html += `<div class="card">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">Delivery Slips</div>
      <div style="font-size:11px;color:var(--t3);margin-bottom:10px">Print delivery slips per store order</div>`;

    const orders = printData.orders || [];
    if (orders.length > 0) {
      html += `<div class="tbl-wrap"><table class="tbl" style="font-size:11px"><thead><tr>
        <th>Order</th><th>Store</th><th>Items</th><th>Status</th><th>Print</th>
      </tr></thead><tbody>`;
      for (const o of orders) {
        html += `<tr>
          <td style="font-weight:600">${esc(o.order_id)}</td>
          <td>${esc(o.store_id)}</td>
          <td>${o.item_count || 0}</td>
          <td>${bcBadge(o.status)}</td>
          <td><button class="btn btn-outline btn-sm" style="font-size:10px;padding:2px 6px" onclick="BakerySection.printDeliverySlip('${esc(o.order_id)}')">Print</button></td>
        </tr>`;
      }
      html += `</tbody></table></div>`;
    } else {
      html += `<div style="text-align:center;padding:12px;color:var(--t3);font-size:11px">No orders ready for delivery slips</div>`;
    }

    html += `</div>`;
    el.innerHTML = html;
    el._printData = printData;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load print data', e.message);
  }
}

function printProduction() {
  const el = document.getElementById('bc-content');
  const printData = el?._printData;
  if (!printData) { SPG.toast('No print data', 'error'); return; }
  const xml = buildProductionSheet({
    date: new Date(),
    store_id: 'ALL',
    items: printData.production_items || [],
  });
  printEpos(xml);
}

async function printDeliverySlip(orderId) {
  SPG.showLoader();
  try {
    const data = await bPost('bc_get_order_detail', { order_id: orderId });
    const order = data.order || data;
    const xml = buildDeliverySlip(order);
    printEpos(xml);
  } catch (e) {
    SPG.toast(e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ════════════════════════════════════════════════════
// ROUTE 16: BC RETURNS
// ════════════════════════════════════════════════════
function renderBcReturns() {
  return SPG.shell(`
    ${bToolbar('Incoming Returns', '', { back: 'bc-home' })}
    <div class="content" id="bc-content">
      ${ui.skeleton(60, 4)}
    </div>`, 'Bakery Order');
}

async function loadBcReturns() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_incoming_returns');
    const returns = data.returns || [];

    if (returns.length === 0) {
      el.innerHTML = ui.empty('', 'No incoming returns');
      return;
    }

    let html = `<div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th>Return ID</th><th>Store</th><th>Product</th><th>Qty</th><th>Reason</th><th>Status</th><th>Actions</th>
    </tr></thead><tbody>`;

    for (const r of returns) {
      const actions = r.status === 'pending'
        ? `<button class="btn btn-outline btn-sm" style="font-size:10px;padding:2px 6px" onclick="BakerySection.receiveReturn('${esc(r.return_id)}')">Receive</button>`
        : r.status === 'received'
        ? `<button class="btn btn-outline btn-sm" style="font-size:10px;padding:2px 6px" onclick="BakerySection.resolveReturn('${esc(r.return_id)}')">Resolve</button>`
        : '-';

      html += `<tr>
        <td style="font-weight:600">${esc(r.return_id)}</td>
        <td>${esc(r.store_id)}</td>
        <td>${esc(r.product_name)}</td>
        <td>${r.qty}</td>
        <td>${esc(r.reason)}</td>
        <td>${bcBadge(r.status)}</td>
        <td>${actions}</td>
      </tr>`;
    }

    html += `</tbody></table></div>`;
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load returns', e.message);
  }
}

async function receiveReturn(returnId) {
  SPG.showLoader();
  try {
    await bPost('bc_receive_return', { return_id: returnId });
    SPG.toast('Return received', 'success');
    loadBcReturns();
  } catch (e) {
    SPG.toast(e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}

function resolveReturn(returnId) {
  SPG.showDialog(`<div class="popup-sheet" style="width:340px">
    <div class="popup-header"><div class="popup-title">Resolve Return</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Resolution Notes</label><textarea class="inp" id="resolve-notes" rows="3" style="width:100%;box-sizing:border-box" placeholder="How was this return resolved?"></textarea></div>
    <div class="fg"><label class="lb">Action</label><select class="inp" id="resolve-action">
      <option value="credit">Credit to store</option>
      <option value="replace">Replace product</option>
      <option value="discard">Discard</option>
    </select></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="BakerySection.doResolveReturn('${esc(returnId)}')">Resolve</button>
    </div>
  </div>`);
}

async function doResolveReturn(returnId) {
  const notes = document.getElementById('resolve-notes')?.value.trim();
  const action = document.getElementById('resolve-action')?.value;
  SPG.showLoader();
  try {
    await bPost('bc_resolve_return', { return_id: returnId, resolution_notes: notes, resolution_action: action });
    SPG.closeDialog();
    SPG.toast('Return resolved', 'success');
    loadBcReturns();
  } catch (e) {
    SPG.toast(e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ════════════════════════════════════════════════════
// ROUTE 17: BC PRODUCTS
// ════════════════════════════════════════════════════
function renderBcProducts() {
  return SPG.shell(`
    ${bToolbar('Product Management', '<button class="btn btn-primary btn-sm" onclick="BakerySection.showProductForm()">+ Add Product</button>', { back: 'bc-home' })}
    <div class="content" id="bc-content">
      ${ui.skeleton(60, 6)}
    </div>`, 'Bakery Order');
}

async function loadBcProducts() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_all_products');
    const products = data.products || [];
    renderBcProductsList(el, products);
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load products', e.message);
  }
}

function renderBcProductsList(el, products) {
  let html = ui.filterBar([
    { id: 'bp-search', label: 'Search', type: 'text', value: '', placeholder: 'Product name...', onChange: "BakerySection.filterBcProducts()" },
  ]);

  html += `<div class="tbl-wrap"><table class="tbl"><thead><tr>
    ${ui.sortTh('bcprods', 'product_id', 'ID')}
    ${ui.sortTh('bcprods', 'product_name', 'Name')}
    <th>Category</th>
    <th style="text-align:right">Price</th>
    <th>Unit</th>
    <th>Visible</th>
    <th>Actions</th>
  </tr></thead><tbody>`;

  const sorted = ui.getSortState('bcprods')
    ? ui.sortData(products, ui.getSortState('bcprods').key, ui.getSortState('bcprods').dir)
    : products;

  for (const p of sorted) {
    html += `<tr>
      <td style="font-size:10px">${esc(p.product_id)}</td>
      <td style="font-weight:600">${esc(p.product_name)}</td>
      <td>${esc(p.category || '-')}</td>
      <td style="text-align:right">${fmtPrice(p.price)}</td>
      <td>${esc(p.unit || 'pc')}</td>
      <td>${p.is_visible !== false ? '<span style="color:var(--green)">Yes</span>' : '<span style="color:var(--red)">No</span>'}</td>
      <td><button class="btn btn-outline btn-sm" style="font-size:10px;padding:2px 6px" onclick="BakerySection.showProductForm('${esc(p.product_id)}')">Edit</button></td>
    </tr>`;
  }
  html += `</tbody></table></div>`;
  el.innerHTML = html;
  el._products = products;
}

function filterBcProducts() {
  const el = document.getElementById('bc-content');
  if (!el || !el._products) return;
  const q = (document.getElementById('bp-search')?.value || '').toLowerCase();
  const filtered = q ? el._products.filter(p => (p.product_name || '').toLowerCase().includes(q)) : el._products;
  // Re-render table body only — simplified: re-render all
  renderBcProductsList(el, filtered);
}

function showProductForm(productId) {
  const el = document.getElementById('bc-content');
  const existing = productId && el?._products ? el._products.find(p => p.product_id === productId) : null;

  const catOpts = S.categories.map(c =>
    `<option value="${esc(c.category_id || c.name)}"${existing && existing.category === (c.category_id || c.name) ? ' selected' : ''}>${esc(c.name || c.category_id)}</option>`
  ).join('');

  SPG.showDialog(`<div class="popup-sheet" style="width:400px">
    <div class="popup-header"><div class="popup-title">${existing ? 'Edit' : 'Add'} Product</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    ${!existing ? `<div class="fg"><label class="lb">Product ID *</label><input class="inp" id="pf-id" placeholder="e.g. BK-001"></div>` : ''}
    <div class="fg"><label class="lb">Product Name *</label><input class="inp" id="pf-name" value="${existing ? esc(existing.product_name) : ''}"></div>
    <div class="fg"><label class="lb">Category</label><select class="inp" id="pf-cat"><option value="">-- Select --</option>${catOpts}</select></div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Price *</label><input class="inp" type="number" step="0.01" id="pf-price" value="${existing ? existing.price : ''}"></div>
      <div class="fg" style="flex:1"><label class="lb">Unit</label><input class="inp" id="pf-unit" value="${existing ? esc(existing.unit || 'pc') : 'pc'}"></div>
    </div>
    <div class="fg"><label class="lb">Image URL</label><input class="inp" id="pf-image" value="${existing ? esc(existing.image_url || '') : ''}" placeholder="https://..."></div>
    <div class="fg"><label class="lb">Description</label><textarea class="inp" id="pf-desc" rows="2" style="width:100%;box-sizing:border-box">${existing ? esc(existing.description || '') : ''}</textarea></div>
    <div class="fg"><label style="font-size:11px;display:flex;align-items:center;gap:6px">
      <input type="checkbox" id="pf-visible" ${!existing || existing.is_visible !== false ? 'checked' : ''}> Visible to stores
    </label></div>
    <div class="error-msg" id="pf-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="BakerySection.doSaveProduct('${esc(productId || '')}')">Save</button>
    </div>
  </div>`);
}

async function doSaveProduct(productId) {
  const product_id = productId || document.getElementById('pf-id')?.value.trim();
  const product_name = document.getElementById('pf-name')?.value.trim();
  const category = document.getElementById('pf-cat')?.value;
  const price = parseFloat(document.getElementById('pf-price')?.value) || 0;
  const unit = document.getElementById('pf-unit')?.value.trim() || 'pc';
  const image_url = document.getElementById('pf-image')?.value.trim();
  const description = document.getElementById('pf-desc')?.value.trim();
  const is_visible = document.getElementById('pf-visible')?.checked !== false;

  if (!product_id || !product_name || price <= 0) {
    SPG.showError('pf-error', 'ID, name and price are required');
    return;
  }

  SPG.showLoader();
  try {
    const action = productId ? 'bc_update_product' : 'bc_create_product';
    await bPost(action, { product_id, product_name, category, price, unit, image_url, description, is_visible });
    SPG.closeDialog();
    SPG.toast('Product saved', 'success');
    loadBcProducts();
  } catch (e) {
    SPG.showError('pf-error', e.message);
  } finally {
    SPG.hideLoader();
  }
}


// ════════════════════════════════════════════════════
// ROUTE 18: ADMIN CONFIG
// ════════════════════════════════════════════════════
function renderAdminConfig() {
  return SPG.shell(`
    ${bToolbar('Bakery System Config', '<button class="btn btn-primary btn-sm" onclick="BakerySection.saveConfig()">Save</button>')}
    <div class="content" id="bc-content">
      ${ui.skeleton(200)}
    </div>`, 'Bakery Order');
}

async function loadAdminConfig() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_config');
    const cfg = data.config || data;

    // Admin nav
    let html = renderAdminNav('config');

    html += `<div class="card max-w-sm">
      <div style="font-size:13px;font-weight:700;margin-bottom:12px">System Configuration</div>
      <div class="fg"><label class="lb">Cutoff Time (Sydney) *</label><input class="inp" type="time" id="cfg-cutoff" value="${esc(cfg.cutoff_time || '15:00')}"></div>
      <div class="fg"><label class="lb">Timezone</label><input class="inp" id="cfg-tz" value="${esc(cfg.timezone || 'Australia/Sydney')}" readonly class="inp-readonly"></div>
      <div class="fg"><label class="lb">Order ID Prefix</label><input class="inp" id="cfg-prefix" value="${esc(cfg.order_prefix || 'ORD')}"></div>
      <div class="fg"><label class="lb">Max Items per Order</label><input class="inp" type="number" id="cfg-max-items" value="${cfg.max_items_per_order || 50}"></div>
      <div class="fg"><label class="lb">Allow After-Cutoff Orders</label>
        <select class="inp" id="cfg-allow-after"><option value="true"${cfg.allow_after_cutoff ? ' selected' : ''}>Yes (for next+1 day)</option><option value="false"${!cfg.allow_after_cutoff ? ' selected' : ''}>No</option></select>
      </div>
      <div class="fg"><label class="lb">Auto-Accept Orders</label>
        <select class="inp" id="cfg-auto-accept"><option value="false"${!cfg.auto_accept ? ' selected' : ''}>No</option><option value="true"${cfg.auto_accept ? ' selected' : ''}>Yes</option></select>
      </div>
      <div class="fg"><label class="lb">Notification Email</label><input class="inp" type="email" id="cfg-email" value="${esc(cfg.notification_email || '')}"></div>
    </div>`;

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load config', e.message);
  }
}

function renderAdminNav(active) {
  const tabs = [
    { id: 'config', label: 'Config', route: 'admin-config' },
    { id: 'dept-map', label: 'Dept Map', route: 'admin-dept-map' },
    { id: 'visibility', label: 'Visibility', route: 'admin-visibility' },
    { id: 'access', label: 'Access', route: 'admin-access' },
    { id: 'waste-dash', label: 'Waste', route: 'admin-waste-dash' },
    { id: 'reports', label: 'Reports', route: 'admin-reports' },
    { id: 'audit', label: 'Audit', route: 'admin-audit' },
  ];

  return `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:14px">${
    tabs.map(t => `<button class="btn ${t.id === active ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="SPG.go('bakery/${t.route}')">${t.label}</button>`).join('')
  }</div>`;
}

async function saveConfig() {
  const config = {
    cutoff_time: document.getElementById('cfg-cutoff')?.value,
    order_prefix: document.getElementById('cfg-prefix')?.value.trim(),
    max_items_per_order: parseInt(document.getElementById('cfg-max-items')?.value) || 50,
    allow_after_cutoff: document.getElementById('cfg-allow-after')?.value === 'true',
    auto_accept: document.getElementById('cfg-auto-accept')?.value === 'true',
    notification_email: document.getElementById('cfg-email')?.value.trim(),
  };

  SPG.showLoader();
  try {
    await bPost('bc_update_config', { config });
    S.config = { ...S.config, ...config };
    SPG.toast('Config saved', 'success');
  } catch (e) {
    SPG.toast(e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ════════════════════════════════════════════════════
// ROUTE 19: ADMIN DEPT MAP
// ════════════════════════════════════════════════════
function renderAdminDeptMap() {
  return SPG.shell(`
    ${bToolbar('Department Mapping', '<button class="btn btn-primary btn-sm" onclick="BakerySection.saveDeptMap()">Save</button>')}
    <div class="content" id="bc-content">
      ${ui.skeleton(200)}
    </div>`, 'Bakery Order');
}

async function loadAdminDeptMap() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_dept_mapping');
    const mappings = data.mappings || [];

    let html = renderAdminNav('dept-map');

    html += `<div class="card">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">Department to Bakery Center Mapping</div>
      <div style="font-size:11px;color:var(--t3);margin-bottom:10px">Map store departments to BC product categories they can order from.</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th>Department</th><th>Store</th><th>Allowed Categories</th><th>Active</th>
      </tr></thead><tbody>`;

    if (mappings.length === 0) {
      html += `<tr><td colspan="4" style="text-align:center;color:var(--t3);padding:20px">No mappings configured</td></tr>`;
    } else {
      mappings.forEach((m, i) => {
        html += `<tr>
          <td>${esc(m.dept_id)}</td>
          <td>${esc(m.store_id || 'ALL')}</td>
          <td><input class="inp" value="${esc((m.categories || []).join(', '))}" data-dmap="${i}" style="font-size:11px"></td>
          <td><input type="checkbox" data-dmap-active="${i}" ${m.is_active !== false ? 'checked' : ''}></td>
        </tr>`;
      });
    }

    html += `</tbody></table></div></div>`;
    el.innerHTML = html;
    el._deptMappings = mappings;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load dept mapping', e.message);
  }
}

async function saveDeptMap() {
  const el = document.getElementById('bc-content');
  if (!el || !el._deptMappings) return;

  const mappings = el._deptMappings.map((m, i) => {
    const catInput = document.querySelector(`[data-dmap="${i}"]`);
    const activeInput = document.querySelector(`[data-dmap-active="${i}"]`);
    return {
      dept_id: m.dept_id,
      store_id: m.store_id,
      categories: (catInput?.value || '').split(',').map(s => s.trim()).filter(Boolean),
      is_active: activeInput?.checked !== false,
    };
  });

  SPG.showLoader();
  try {
    await bPost('bc_update_dept_mapping', { mappings });
    SPG.toast('Dept mapping saved', 'success');
  } catch (e) {
    SPG.toast(e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ════════════════════════════════════════════════════
// ROUTE 20: ADMIN VISIBILITY
// ════════════════════════════════════════════════════
function renderAdminVisibility() {
  return SPG.shell(`
    ${bToolbar('Product Visibility', '<button class="btn btn-primary btn-sm" onclick="BakerySection.saveVisibility()">Save</button>')}
    <div class="content" id="bc-content">
      ${ui.skeleton(200)}
    </div>`, 'Bakery Order');
}

async function loadAdminVisibility() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_visibility_matrix');
    const matrix = data.matrix || [];
    const stores = data.stores || [];
    const products = data.products || [];

    let html = renderAdminNav('visibility');

    html += `<div class="card">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">Product Visibility Matrix</div>
      <div style="font-size:11px;color:var(--t3);margin-bottom:10px">Check which products are visible to each store.</div>
      <div class="tbl-wrap"><table class="tbl" style="font-size:10px"><thead><tr><th>Product</th>`;
    for (const store of stores) {
      html += `<th style="text-align:center;writing-mode:vertical-rl;min-width:30px">${esc(store.store_id)}</th>`;
    }
    html += `</tr></thead><tbody>`;

    for (const prod of products) {
      html += `<tr><td style="white-space:nowrap">${esc(prod.product_name)}</td>`;
      for (const store of stores) {
        const entry = matrix.find(m => m.product_id === prod.product_id && m.store_id === store.store_id);
        const checked = entry ? entry.is_visible : true;
        html += `<td style="text-align:center"><input type="checkbox" data-vis-prod="${esc(prod.product_id)}" data-vis-store="${esc(store.store_id)}" ${checked ? 'checked' : ''}></td>`;
      }
      html += `</tr>`;
    }

    html += `</tbody></table></div></div>`;
    el.innerHTML = html;
    el._visStores = stores;
    el._visProducts = products;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load visibility', e.message);
  }
}

async function saveVisibility() {
  const checks = document.querySelectorAll('[data-vis-prod]');
  const updates = [];
  checks.forEach(cb => {
    updates.push({
      product_id: cb.dataset.visProd,
      store_id: cb.dataset.visStore,
      is_visible: cb.checked,
    });
  });

  SPG.showLoader();
  try {
    await bPost('bc_update_visibility', { updates });
    SPG.toast('Visibility saved', 'success');
  } catch (e) {
    SPG.toast(e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ════════════════════════════════════════════════════
// ROUTE 21: ADMIN ACCESS
// ════════════════════════════════════════════════════
function renderAdminAccess() {
  return SPG.shell(`
    ${bToolbar('User Access Permissions', '<button class="btn btn-primary btn-sm" onclick="BakerySection.saveAccess()">Save</button>')}
    <div class="content" id="bc-content">
      ${ui.skeleton(200)}
    </div>`, 'Bakery Order');
}

async function loadAdminAccess() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_access_matrix');
    const users = data.users || [];
    const roles = ['store', 'bc', 'admin', 'executive'];

    let html = renderAdminNav('access');

    html += `<div class="card">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">Access Permissions</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th>User</th><th>Store</th><th>Role</th>
      </tr></thead><tbody>`;

    for (const u of users) {
      const roleOpts = roles.map(r =>
        `<option value="${r}"${u.bakery_role === r ? ' selected' : ''}>${r.charAt(0).toUpperCase() + r.slice(1)}</option>`
      ).join('');
      html += `<tr>
        <td>${esc(u.display_name)} <span style="font-size:10px;color:var(--t3)">${esc(u.user_id)}</span></td>
        <td>${esc(u.store_id || '-')}</td>
        <td><select class="inp" data-access-user="${esc(u.user_id)}" style="font-size:11px">${roleOpts}</select></td>
      </tr>`;
    }

    html += `</tbody></table></div></div>`;
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load access', e.message);
  }
}

async function saveAccess() {
  const selects = document.querySelectorAll('[data-access-user]');
  const updates = [];
  selects.forEach(sel => {
    updates.push({
      user_id: sel.dataset.accessUser,
      bakery_role: sel.value,
    });
  });

  SPG.showLoader();
  try {
    await bPost('bc_update_access', { updates });
    SPG.toast('Access permissions saved', 'success');
  } catch (e) {
    SPG.toast(e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ════════════════════════════════════════════════════
// ROUTE 22: ADMIN WASTE DASHBOARD
// ════════════════════════════════════════════════════
function renderAdminWasteDash() {
  return SPG.shell(`
    ${bToolbar('Waste Dashboard')}
    <div class="content" id="bc-content">
      ${ui.skeleton(150, 2)}
    </div>`, 'Bakery Order');
}

async function loadAdminWasteDash() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_waste_dashboard');
    const d = data.dashboard || data;

    let html = renderAdminNav('waste-dash');

    // KPIs
    html += `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      ${kpiCard('Total Waste (Week)', fmtNum(d.total_waste_week || 0), 'units', 'var(--red)')}
      ${kpiCard('Total Waste ($)', fmtPrice(d.total_waste_value_week || 0), 'this week', 'var(--red)')}
      ${kpiCard('Waste Rate', pct(d.waste_rate || 0), 'of production', 'var(--orange)')}
      ${kpiCard('Top Reason', d.top_reason || '-', '', 'var(--t1)')}
    </div>`;

    // By store
    if (d.by_store && d.by_store.length > 0) {
      html += `<div class="card" style="margin-bottom:12px">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px">Waste by Store</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr>
          <th>Store</th><th style="text-align:right">Qty</th><th style="text-align:right">Value</th><th style="text-align:right">Rate</th>
        </tr></thead><tbody>`;
      for (const s of d.by_store) {
        html += `<tr>
          <td style="font-weight:600">${esc(s.store_id)}</td>
          <td style="text-align:right">${fmtNum(s.qty)}</td>
          <td style="text-align:right">${fmtPrice(s.value)}</td>
          <td style="text-align:right">${pct(s.rate)}</td>
        </tr>`;
      }
      html += `</tbody></table></div></div>`;
    }

    // By product
    if (d.by_product && d.by_product.length > 0) {
      html += `<div class="card">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px">Top Wasted Products</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr>
          <th>Product</th><th style="text-align:right">Qty</th><th style="text-align:right">Value</th><th>Main Reason</th>
        </tr></thead><tbody>`;
      for (const p of d.by_product.slice(0, 10)) {
        html += `<tr>
          <td>${esc(p.product_name)}</td>
          <td style="text-align:right">${fmtNum(p.qty)}</td>
          <td style="text-align:right">${fmtPrice(p.value)}</td>
          <td>${esc(p.top_reason || '-')}</td>
        </tr>`;
      }
      html += `</tbody></table></div></div>`;
    }

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load waste dashboard', e.message);
  }
}


// ════════════════════════════════════════════════════
// ROUTE 23: ADMIN REPORTS
// ════════════════════════════════════════════════════
function renderAdminReports() {
  return SPG.shell(`
    ${bToolbar('Reports')}
    <div class="content" id="bc-content">
      ${ui.skeleton(200)}
    </div>`, 'Bakery Order');
}

async function loadAdminReports() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  let html = renderAdminNav('reports');

  html += `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
    <button class="btn btn-primary btn-sm" onclick="BakerySection.loadReport('top-products')">Top Products</button>
    <button class="btn btn-outline btn-sm" onclick="BakerySection.loadReport('cutoff-violations')">Cutoff Violations</button>
  </div>`;

  html += `<div id="report-content">${ui.empty('', 'Select a report above')}</div>`;
  el.innerHTML = html;
}

async function loadReport(type) {
  const el = document.getElementById('report-content');
  if (!el) return;
  el.innerHTML = ui.skeleton(200);

  try {
    if (type === 'top-products') {
      const data = await bPost('bc_get_top_products');
      const products = data.products || [];
      let html = `<div class="card">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px">Top Products (by order volume)</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr>
          <th>#</th><th>Product</th><th>Category</th><th style="text-align:right">Orders</th><th style="text-align:right">Total Qty</th><th style="text-align:right">Revenue</th>
        </tr></thead><tbody>`;
      products.forEach((p, i) => {
        html += `<tr>
          <td>${i + 1}</td>
          <td style="font-weight:600">${esc(p.product_name)}</td>
          <td>${esc(p.category || '-')}</td>
          <td style="text-align:right">${p.order_count || 0}</td>
          <td style="text-align:right">${fmtNum(p.total_qty)}</td>
          <td style="text-align:right">${fmtPrice(p.revenue)}</td>
        </tr>`;
      });
      html += `</tbody></table></div></div>`;
      el.innerHTML = html;
    } else if (type === 'cutoff-violations') {
      const data = await bPost('bc_get_cutoff_violations');
      const violations = data.violations || [];
      let html = `<div class="card">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px">Cutoff Violations</div>
        <div style="font-size:11px;color:var(--t3);margin-bottom:10px">Orders placed after cutoff time</div>`;
      if (violations.length === 0) {
        html += `<div style="text-align:center;padding:20px;color:var(--t3);font-size:11px">No violations found</div>`;
      } else {
        html += `<div class="tbl-wrap"><table class="tbl"><thead><tr>
          <th>Order ID</th><th>Store</th><th>Date</th><th>Submitted At</th><th>Cutoff Time</th>
        </tr></thead><tbody>`;
        for (const v of violations) {
          html += `<tr>
            <td style="font-weight:600">${esc(v.order_id)}</td>
            <td>${esc(v.store_id)}</td>
            <td>${sydneyDate(v.order_date)}</td>
            <td style="color:var(--red)">${sydneyDateTime(v.submitted_at)}</td>
            <td>${esc(v.cutoff_time)}</td>
          </tr>`;
        }
        html += `</tbody></table></div>`;
      }
      html += `</div>`;
      el.innerHTML = html;
    }
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load report', e.message);
  }
}


// ════════════════════════════════════════════════════
// ROUTE 24: ADMIN AUDIT
// ════════════════════════════════════════════════════
function renderAdminAudit() {
  return SPG.shell(`
    ${bToolbar('Audit Trail')}
    <div class="content" id="bc-content">
      ${ui.skeleton(60, 8)}
    </div>`, 'Bakery Order');
}

async function loadAdminAudit() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_audit_log');
    const logs = data.logs || [];

    let html = renderAdminNav('audit');

    html += ui.filterBar([
      { id: 'aud-date', label: 'Date', type: 'date', value: '', onChange: "BakerySection.filterAudit()" },
      { id: 'aud-action', label: 'Action', type: 'text', value: '', placeholder: 'Filter action...', onChange: "BakerySection.filterAudit()" },
    ]);

    html += `<div id="audit-table-wrap">`;
    html += renderAuditTable(logs);
    html += `</div>`;

    el.innerHTML = html;
    el._auditLogs = logs;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load audit log', e.message);
  }
}

function renderAuditTable(logs) {
  if (logs.length === 0) return ui.empty('', 'No audit records');

  let html = `<div class="tbl-wrap"><table class="tbl" style="font-size:11px"><thead><tr>
    <th>Timestamp</th><th>User</th><th>Action</th><th>Target</th><th>Details</th>
  </tr></thead><tbody>`;

  for (const log of logs) {
    html += `<tr>
      <td style="white-space:nowrap">${sydneyDateTime(log.created_at)}</td>
      <td>${esc(log.user_name || log.user_id)}</td>
      <td><span style="font-weight:600">${esc(log.action)}</span></td>
      <td>${esc(log.target_type || '')} ${esc(log.target_id || '')}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(JSON.stringify(log.details || ''))}">${esc(log.summary || JSON.stringify(log.details || '').substring(0, 60))}</td>
    </tr>`;
  }

  html += `</tbody></table></div>`;
  return html;
}

function filterAudit() {
  const el = document.getElementById('bc-content');
  if (!el || !el._auditLogs) return;
  const dateVal = document.getElementById('aud-date')?.value;
  const actionVal = (document.getElementById('aud-action')?.value || '').toLowerCase();

  let logs = el._auditLogs;
  if (dateVal) logs = logs.filter(l => (l.created_at || '').startsWith(dateVal));
  if (actionVal) logs = logs.filter(l => (l.action || '').toLowerCase().includes(actionVal));

  const wrap = document.getElementById('audit-table-wrap');
  if (wrap) wrap.innerHTML = renderAuditTable(logs);
}


// ════════════════════════════════════════════════════
// ROUTE 25: EXEC OVERVIEW
// ════════════════════════════════════════════════════
function renderExecOverview() {
  return SPG.shell(`
    ${bToolbar('Executive Overview')}
    <div class="content" id="bc-content">
      ${ui.skeleton(120, 3)}
    </div>`, 'Bakery Order');
}

async function loadExecOverview() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_exec_overview');
    const d = data.overview || data;

    let html = renderExecNav('overview');

    // KPIs
    html += `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      ${kpiCard('Orders Today', fmtNum(d.orders_today || 0), '', 'var(--blue)')}
      ${kpiCard('Revenue Today', fmtPrice(d.revenue_today || 0), '', 'var(--green)')}
      ${kpiCard('Fulfilment Rate', pct(d.fulfilment_rate || 0), '', d.fulfilment_rate >= 90 ? 'var(--green)' : 'var(--orange)')}
      ${kpiCard('Waste Rate', pct(d.waste_rate || 0), '', d.waste_rate <= 5 ? 'var(--green)' : 'var(--red)')}
    </div>`;

    // Weekly trend
    html += `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      ${kpiCard('Orders (Week)', fmtNum(d.orders_week || 0), 'vs last week: ' + (d.orders_week_change || '0%'), 'var(--t1)')}
      ${kpiCard('Revenue (Week)', fmtPrice(d.revenue_week || 0), 'vs last week: ' + (d.revenue_week_change || '0%'), 'var(--t1)')}
      ${kpiCard('Active Stores', d.active_stores || 0, 'ordering today', 'var(--acc)')}
      ${kpiCard('Products', d.total_products || 0, 'active', 'var(--t1)')}
    </div>`;

    // Store performance
    if (d.store_performance && d.store_performance.length > 0) {
      html += `<div class="card">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px">Store Performance</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr>
          <th>Store</th><th style="text-align:right">Orders</th><th style="text-align:right">Revenue</th><th style="text-align:right">Avg Order</th><th style="text-align:right">Waste %</th>
        </tr></thead><tbody>`;
      for (const s of d.store_performance) {
        html += `<tr>
          <td style="font-weight:600">${esc(s.store_id)}</td>
          <td style="text-align:right">${s.order_count || 0}</td>
          <td style="text-align:right">${fmtPrice(s.revenue)}</td>
          <td style="text-align:right">${fmtPrice(s.avg_order)}</td>
          <td style="text-align:right;color:${(s.waste_rate || 0) > 5 ? 'var(--red)' : 'var(--green)'}">${pct(s.waste_rate)}</td>
        </tr>`;
      }
      html += `</tbody></table></div></div>`;
    }

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load overview', e.message);
  }
}

function renderExecNav(active) {
  const tabs = [
    { id: 'overview', label: 'Overview', route: 'exec-overview' },
    { id: 'health', label: 'Health', route: 'exec-health' },
    { id: 'alerts', label: 'Alerts', route: 'exec-alerts' },
  ];
  return `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:14px">${
    tabs.map(t => `<button class="btn ${t.id === active ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="SPG.go('bakery/${t.route}')">${t.label}</button>`).join('')
  }</div>`;
}


// ════════════════════════════════════════════════════
// ROUTE 26: EXEC HEALTH
// ════════════════════════════════════════════════════
function renderExecHealth() {
  return SPG.shell(`
    ${bToolbar('Operational Health')}
    <div class="content" id="bc-content">
      ${ui.skeleton(200)}
    </div>`, 'Bakery Order');
}

async function loadExecHealth() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_operational_health');
    const d = data.health || data;

    let html = renderExecNav('health');

    // Health matrix
    html += `<div class="card" style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">Operational Health Matrix</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th>Metric</th><th>Current</th><th>Target</th><th>Status</th>
      </tr></thead><tbody>`;

    const metrics = d.metrics || [];
    for (const m of metrics) {
      const isOk = m.status === 'ok' || m.status === 'green';
      const isWarn = m.status === 'warn' || m.status === 'yellow';
      const color = isOk ? 'var(--green)' : isWarn ? 'var(--orange)' : 'var(--red)';
      const icon = isOk ? '✓' : isWarn ? '!' : '✕';
      html += `<tr>
        <td style="font-weight:600">${esc(m.name)}</td>
        <td>${esc(String(m.current))}</td>
        <td style="color:var(--t3)">${esc(String(m.target))}</td>
        <td><span style="color:${color};font-weight:700">${icon} ${esc(m.status_label || m.status)}</span></td>
      </tr>`;
    }

    html += `</tbody></table></div></div>`;

    // Alerts
    if (d.active_alerts && d.active_alerts.length > 0) {
      html += `<div class="card">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--red)">Active Alerts</div>`;
      for (const a of d.active_alerts) {
        const alertColor = a.severity === 'critical' ? 'var(--red)' : a.severity === 'warning' ? 'var(--orange)' : 'var(--blue)';
        html += `<div style="padding:8px 10px;background:var(--bg3);border-left:3px solid ${alertColor};border-radius:4px;margin-bottom:6px">
          <div style="font-size:12px;font-weight:600">${esc(a.title)}</div>
          <div style="font-size:10px;color:var(--t3)">${esc(a.message)} | ${sydneyDateTime(a.created_at)}</div>
        </div>`;
      }
      html += `</div>`;
    }

    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load health data', e.message);
  }
}


// ════════════════════════════════════════════════════
// ROUTE 27: EXEC ALERTS
// ════════════════════════════════════════════════════
function renderExecAlerts() {
  return SPG.shell(`
    ${bToolbar('Alert Setup', '<button class="btn btn-primary btn-sm" onclick="BakerySection.saveAlerts()">Save</button>')}
    <div class="content" id="bc-content">
      ${ui.skeleton(200)}
    </div>`, 'Bakery Order');
}

async function loadExecAlerts() {
  if (!await ensureInit()) return;
  const el = document.getElementById('bc-content');
  if (!el) return;

  try {
    const data = await bPost('bc_get_alerts_config');
    const alerts = data.alerts || [];

    let html = renderExecNav('alerts');

    html += `<div class="card">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">Alert Thresholds</div>
      <div style="font-size:11px;color:var(--t3);margin-bottom:10px">Configure when alerts should be triggered</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th>Alert</th><th>Threshold</th><th>Severity</th><th>Enabled</th>
      </tr></thead><tbody>`;

    const defaultAlerts = [
      { key: 'waste_rate', label: 'Waste rate exceeds', unit: '%', default_threshold: 5 },
      { key: 'fulfilment_rate_low', label: 'Fulfilment rate below', unit: '%', default_threshold: 90 },
      { key: 'late_orders', label: 'Orders after cutoff exceeds', unit: 'count', default_threshold: 3 },
      { key: 'no_orders', label: 'Store has no orders by', unit: 'time', default_threshold: '12:00' },
      { key: 'returns_spike', label: 'Returns exceed', unit: 'count', default_threshold: 5 },
    ];

    defaultAlerts.forEach((da, i) => {
      const existing = alerts.find(a => a.key === da.key);
      const threshold = existing ? existing.threshold : da.default_threshold;
      const severity = existing ? existing.severity : 'warning';
      const enabled = existing ? existing.enabled : true;

      const sevOpts = ['info', 'warning', 'critical'].map(s =>
        `<option value="${s}"${severity === s ? ' selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
      ).join('');

      html += `<tr>
        <td style="font-size:11px">${esc(da.label)} (${esc(da.unit)})</td>
        <td><input class="inp" ${da.unit === 'time' ? 'type="time"' : 'type="number"'} value="${esc(String(threshold))}" style="width:80px;font-size:11px;padding:3px" data-alert-key="${esc(da.key)}" data-alert-field="threshold"></td>
        <td><select class="inp" style="font-size:11px" data-alert-key="${esc(da.key)}" data-alert-field="severity">${sevOpts}</select></td>
        <td><input type="checkbox" data-alert-key="${esc(da.key)}" data-alert-field="enabled" ${enabled ? 'checked' : ''}></td>
      </tr>`;
    });

    html += `</tbody></table></div></div>`;
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load alerts config', e.message);
  }
}

async function saveAlerts() {
  const thresholds = document.querySelectorAll('[data-alert-field="threshold"]');
  const alerts = [];
  thresholds.forEach(inp => {
    const key = inp.dataset.alertKey;
    const severityEl = document.querySelector(`[data-alert-key="${key}"][data-alert-field="severity"]`);
    const enabledEl = document.querySelector(`[data-alert-key="${key}"][data-alert-field="enabled"]`);
    alerts.push({
      key,
      threshold: inp.type === 'time' ? inp.value : (parseFloat(inp.value) || 0),
      severity: severityEl?.value || 'warning',
      enabled: enabledEl?.checked !== false,
    });
  });

  SPG.showLoader();
  try {
    await bPost('bc_update_alerts_config', { alerts });
    SPG.toast('Alert config saved', 'success');
  } catch (e) {
    SPG.toast(e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ═══════════════════════════════════════════════
// SORT EVENT LISTENER
// ═══════════════════════════════════════════════
document.addEventListener('spg-sort', (e) => {
  const tid = e.detail?.tableId;
  if (tid === 'orders') loadOrders();
  else if (tid === 'waste') { const el = document.getElementById('bc-content'); if (el) renderWasteList(el); }
  else if (tid === 'stock') loadStockHistory();
  else if (tid === 'bcprods') loadBcProducts();
});


// ═══════════════════════════════════════════════
// SECTION REGISTRATION
// ═══════════════════════════════════════════════
SPG.section('bakery', {
  defaultRoute: 'home',
  routes: {
    // Store routes
    'home':             { render: renderHome,            onLoad: loadHome },
    'browse':           { render: renderBrowse,          onLoad: loadBrowse },
    'product-detail':   { render: renderProductDetail,   onLoad: loadProductDetail },
    'cart':             { render: renderCart,             onLoad: loadCart_ },
    'order-confirmed':  { render: renderOrderConfirmed,  onLoad: loadOrderConfirmed },
    'orders':           { render: renderOrders,          onLoad: loadOrders },
    'order-detail':     { render: renderOrderDetail,     onLoad: loadOrderDetail },
    'quotas':           { render: renderQuotas,          onLoad: loadQuotas },
    'waste':            { render: renderWaste,           onLoad: loadWaste },
    'returns':          { render: renderReturns,         onLoad: loadReturns },
    'stock-history':    { render: renderStockHistory,    onLoad: loadStockHistory },

    // BC Staff routes
    'bc-home':          { render: renderBcHome,          onLoad: loadBcHome },
    'bc-accept':        { render: renderBcAccept,        onLoad: loadBcAccept },
    'bc-fulfil':        { render: renderBcFulfil,        onLoad: loadBcFulfil },
    'bc-print':         { render: renderBcPrint,         onLoad: loadBcPrint },
    'bc-returns':       { render: renderBcReturns,       onLoad: loadBcReturns },
    'bc-products':      { render: renderBcProducts,      onLoad: loadBcProducts },

    // Admin routes
    'admin-config':     { render: renderAdminConfig,     onLoad: loadAdminConfig },
    'admin-dept-map':   { render: renderAdminDeptMap,    onLoad: loadAdminDeptMap },
    'admin-visibility': { render: renderAdminVisibility, onLoad: loadAdminVisibility },
    'admin-access':     { render: renderAdminAccess,     onLoad: loadAdminAccess },
    'admin-waste-dash': { render: renderAdminWasteDash,  onLoad: loadAdminWasteDash },
    'admin-reports':    { render: renderAdminReports,    onLoad: loadAdminReports },
    'admin-audit':      { render: renderAdminAudit,      onLoad: loadAdminAudit },

    // Executive routes
    'exec-overview':    { render: renderExecOverview,    onLoad: loadExecOverview },
    'exec-health':      { render: renderExecHealth,      onLoad: loadExecHealth },
    'exec-alerts':      { render: renderExecAlerts,      onLoad: loadExecAlerts },
  },
});


// ═══════════════════════════════════════════════
// PUBLIC API (for onclick handlers)
// ═══════════════════════════════════════════════
window.BakerySection = {
  // Browse
  filterBrowse,

  // Product detail
  pdAdjust, pdAddToCart, pdRemove,

  // Cart
  cartAdjust, cartSetQty, cartRemove, cartClearAll, doCartClear,
  submitOrder,

  // Orders
  filterOrders,

  // Quotas
  saveQuotas,

  // Waste
  showWasteForm, doSaveWaste, deleteWaste, doDeleteWaste,

  // Returns
  showReturnForm, doCreateReturn,

  // Stock history
  filterStockHistory,

  // BC Accept
  acceptOrder, rejectOrder, doRejectOrder,

  // BC Fulfil
  doFulfil,

  // BC Print
  printProduction, printDeliverySlip,

  // BC Returns
  receiveReturn, resolveReturn, doResolveReturn,

  // BC Products
  filterBcProducts, showProductForm, doSaveProduct,

  // Admin
  saveConfig, saveDeptMap, saveVisibility, saveAccess,
  loadReport, filterAudit,

  // Executive
  saveAlerts,
};

})();
