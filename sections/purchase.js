/**
 * SPG HUB v1.0.0 | 21 MAR 2026 | Siam Palette Group
 * sections/purchase.js — Purchase Module
 * Store ordering, receiving, invoices | Warehouse pick, pack, dispatch
 *
 * ⚠️ REWORK NEEDED: This module needs migration to:
 *    - Use SPG.perm.canDo() for function-level permissions
 *    - Use pur_ prefix for all API actions
 *    - Remove admin/config/audit routes (moved to Home)
 *    - Apply Gen Z Design Guide (see MODULE-DEV-GUIDE.md)
 */

(() => {
const esc = SPG.esc;
const api = SPG.api;

// ═══ REGISTER ENDPOINT ═══
api.registerEndpoint('purchase', 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/purchase');

// ═══ HELPERS ═══
function po(action, data = {}) { return api.post('purchase', action, api.tb(data)); }

function sydneyNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
}
function fmtDate(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(d) {
  if (!d) return '-';
  const dt = new Date(d);
  return dt.toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtCurrency(v) {
  const n = Number(v) || 0;
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function calcGST(subtotal) { return Math.round(subtotal * 0.1 * 100) / 100; }
function calcTotal(subtotal) { return Math.round(subtotal * 1.1 * 100) / 100; }

// ═══ ROLE ═══
let _role = 'store'; // 'store' | 'warehouse'
let _initData = null;

function isWarehouse() { return _role === 'warehouse'; }

// ═══ CART STATE ═══
let _cart = JSON.parse(localStorage.getItem('spg_po_cart') || '[]');

function saveCart() { localStorage.setItem('spg_po_cart', JSON.stringify(_cart)); }
function getCart() { return _cart; }
function clearCart() { _cart = []; saveCart(); }

function addToCart(item) {
  // item: { supplier_id, supplier_name, product_id, product_name, unit, qty, price, image_url }
  const idx = _cart.findIndex(c => c.product_id === item.product_id && c.supplier_id === item.supplier_id);
  if (idx >= 0) {
    _cart[idx].qty += (item.qty || 1);
  } else {
    _cart.push({ ...item, qty: item.qty || 1 });
  }
  saveCart();
}

function updateCartQty(productId, supplierId, qty) {
  const idx = _cart.findIndex(c => c.product_id === productId && c.supplier_id === supplierId);
  if (idx < 0) return;
  if (qty <= 0) { _cart.splice(idx, 1); } else { _cart[idx].qty = qty; }
  saveCart();
}

function removeFromCart(productId, supplierId) {
  _cart = _cart.filter(c => !(c.product_id === productId && c.supplier_id === supplierId));
  saveCart();
}

function cartSubtotal() { return _cart.reduce((sum, c) => sum + (c.qty * c.price), 0); }
function cartCount() { return _cart.reduce((sum, c) => sum + c.qty, 0); }

// ═══ CACHED DATA ═══
let _suppliers = [];
let _products = [];
let _categories = [];
let _orders = [];
let _dashboard = null;
let _whDashboard = null;

// ═══ STORE TAB BAR ═══
function storeTabBar(active) {
  const tabs = [
    { id: 'home',    icon: '◇', label: 'Home' },
    { id: 'suppliers', icon: '🏪', label: 'Order' },
    { id: 'receive', icon: '📦', label: 'Receive' },
    { id: 'stock',   icon: '📊', label: 'Stock' },
    { id: 'profile', icon: '⋯', label: 'More' },
  ];
  return `<div class="po-tabbar">${tabs.map(t => {
    const act = t.id === active ? ' active' : '';
    const route = t.id === 'profile' ? 'purchase/profile' : 'purchase/' + t.id;
    return `<div class="po-tab${act}" onclick="SPG.go('${route}')"><span class="po-tab-icon">${t.icon}</span><span class="po-tab-label">${esc(t.label)}</span></div>`;
  }).join('')}</div>`;
}

// ═══ WAREHOUSE SIDEBAR NAV ═══
function whNav(active) {
  const items = [
    { id: 'wh-home',        icon: '◇',  label: 'Dashboard' },
    { id: 'wh-incoming',    icon: '📥', label: 'Incoming' },
    { id: 'wh-pick-list',   icon: '📋', label: 'Pick & Pack' },
    { id: 'wh-invoices',    icon: '🧾', label: 'Invoices' },
    { id: 'wh-stock',       icon: '📊', label: 'Stock' },
    { id: 'wh-transfers',   icon: '🔄', label: 'Transfers' },
    { id: 'wh-notifications', icon: '🔔', label: 'Notifications' },
    { id: 'wh-profile',     icon: '👤', label: 'Profile' },
  ];
  return `<nav class="po-wh-nav">${items.map(t => {
    const act = t.id === active ? ' active' : '';
    return `<div class="po-wh-nav-item${act}" onclick="SPG.go('purchase/${t.id}')"><span class="po-wh-nav-icon">${t.icon}</span><span class="po-wh-nav-label">${esc(t.label)}</span></div>`;
  }).join('')}</nav>`;
}

// ═══ LAYOUT WRAPPERS ═══
function storeShell(inner, activeTab) {
  return SPG.shell(`<div class="po-store-shell">${inner}${storeTabBar(activeTab)}</div>`, 'Purchase');
}

function whShell(inner, activeNav) {
  return SPG.shell(`<div class="po-wh-shell"><div class="po-wh-body">${whNav(activeNav)}<div class="po-wh-main">${inner}</div></div></div>`, 'Warehouse');
}

// ═══ CART FLOATING BUTTON ═══
function cartFab() {
  const count = cartCount();
  if (!count) return '';
  return `<div class="po-cart-fab" onclick="SPG.go('purchase/cart')">🛒 <span class="po-cart-fab-count">${count}</span></div>`;
}

// ═══ STATUS BADGES (purchase-specific) ═══
const PO_STATUS = {
  draft:      { cls: 'sts-neutral', label: 'Draft' },
  pending:    { cls: 'sts-warn',    label: 'Pending' },
  approved:   { cls: 'sts-info',    label: 'Approved' },
  dispatched: { cls: 'sts-warn',    label: 'Dispatched' },
  completed:  { cls: 'sts-ok',      label: 'Completed' },
  cancelled:  { cls: 'sts-neutral', label: 'Cancelled' },
  partial:    { cls: 'sts-warn',    label: 'Partial' },
  invoiced:   { cls: 'sts-ok',      label: 'Invoiced' },
  picked:     { cls: 'sts-info',    label: 'Picked' },
  sent:       { cls: 'sts-ok',      label: 'Sent' },
};

function poBadge(status) {
  const s = PO_STATUS[status?.toLowerCase()] || { cls: 'sts-neutral', label: status || '-' };
  return `<span class="sts ${s.cls}">${esc(s.label)}</span>`;
}

// ═══ ORDER TIMELINE ═══
function orderTimeline(status) {
  const steps = ['draft', 'pending', 'approved', 'dispatched', 'completed'];
  const idx = steps.indexOf(status?.toLowerCase());
  return `<div class="po-timeline">${steps.map((st, i) => {
    let cls = 'po-tl-step';
    if (i < idx) cls += ' done';
    else if (i === idx) cls += ' active';
    return `<div class="${cls}"><div class="po-tl-dot"></div><div class="po-tl-label">${esc(st.charAt(0).toUpperCase() + st.slice(1))}</div></div>`;
  }).join('<div class="po-tl-line"></div>')}</div>`;
}


// ══════════════════════════════════════════════
//   STORE ROUTES
// ══════════════════════════════════════════════

// ──── 1. HOME (DASHBOARD) ────
function renderHome() {
  return storeShell(`
    ${SPG.toolbar('Purchase')}
    <div class="content" id="po-home-content">
      <div style="margin-bottom:16px">
        <div style="font-size:15px;font-weight:700" id="po-greeting">Purchase Orders</div>
        <div style="font-size:11px;color:var(--t3)" id="po-store-label"></div>
      </div>
      <div class="po-quick-actions" id="po-quick-actions">${SPG.ui.skeleton(80, 2)}</div>
      <div class="sec-title" style="margin-top:16px">Recent Orders</div>
      <div id="po-recent-orders">${SPG.ui.skeleton(60, 3)}</div>
    </div>${cartFab()}`, 'home');
}

async function loadHome() {
  const s = api.getSession();
  if (!s) return;
  const greet = document.getElementById('po-greeting');
  const storeLbl = document.getElementById('po-store-label');
  if (greet) greet.textContent = `Welcome, ${s.display_name || ''}`;
  if (storeLbl) storeLbl.textContent = `${s.store_id || 'HQ'} · ${fmtDate(sydneyNow())}`;

  try {
    const data = await po('po_get_dashboard', { store_id: s.store_id });
    _dashboard = data;
    _role = data.role || 'store';
    _initData = data;

    if (isWarehouse()) { SPG.go('purchase/wh-home'); return; }

    const qa = document.getElementById('po-quick-actions');
    if (qa) qa.innerHTML = `
      <div class="po-action-card" onclick="SPG.go('purchase/suppliers')">
        <div class="po-action-icon">🛒</div>
        <div class="po-action-label">New Order</div>
      </div>
      <div class="po-action-card" onclick="SPG.go('purchase/orders')">
        <div class="po-action-icon">📋</div>
        <div class="po-action-label">My Orders</div>
        ${data.pending_count ? `<div class="po-action-badge">${data.pending_count}</div>` : ''}
      </div>
      <div class="po-action-card" onclick="SPG.go('purchase/receive')">
        <div class="po-action-icon">📦</div>
        <div class="po-action-label">Receive</div>
        ${data.receive_count ? `<div class="po-action-badge">${data.receive_count}</div>` : ''}
      </div>
      <div class="po-action-card" onclick="SPG.go('purchase/stock')">
        <div class="po-action-icon">📊</div>
        <div class="po-action-label">Stock</div>
      </div>`;

    const recent = document.getElementById('po-recent-orders');
    if (recent) {
      const orders = data.recent_orders || [];
      if (!orders.length) {
        recent.innerHTML = SPG.ui.empty('📋', 'No recent orders', 'Start by creating a new order');
      } else {
        recent.innerHTML = orders.map(o => `
          <div class="po-order-card" onclick="SPG.go('purchase/order-detail',{id:'${esc(o.order_id)}'})">
            <div class="po-order-card-top">
              <span class="po-order-id">${esc(o.order_id)}</span>
              ${poBadge(o.status)}
            </div>
            <div class="po-order-card-mid">
              <span>${esc(o.supplier_name || '-')}</span>
              <span class="po-order-total">${fmtCurrency(o.total_inc_gst)}</span>
            </div>
            <div class="po-order-card-bot">${fmtDate(o.created_at)}</div>
          </div>`).join('');
      }
    }
  } catch (e) {
    SPG.toast(e.message || 'Failed to load dashboard', 'error');
  }
}


// ──── 2. SUPPLIERS ────
function renderSuppliers() {
  return storeShell(`
    ${SPG.toolbar('Select Supplier', `<button class="btn btn-outline btn-sm" onclick="SPG.go('purchase/home')">← Back</button>`)}
    <div class="content">
      <input class="inp" id="po-sup-search" placeholder="Search suppliers..." oninput="PurchaseSection.filterSuppliers()" style="margin-bottom:12px">
      <div class="po-sup-grid" id="po-sup-grid">${SPG.ui.skeleton(100, 4)}</div>
    </div>${cartFab()}`, 'suppliers');
}

async function loadSuppliers() {
  try {
    const s = api.getSession();
    const data = await po('po_get_suppliers', { store_id: s.store_id });
    _suppliers = data.suppliers || [];
    renderSupplierGrid(_suppliers);
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function renderSupplierGrid(list) {
  const el = document.getElementById('po-sup-grid');
  if (!el) return;
  if (!list.length) { el.innerHTML = SPG.ui.empty('🏪', 'No suppliers found'); return; }
  el.innerHTML = list.map(s => `
    <div class="po-sup-card" onclick="PurchaseSection.selectSupplier('${esc(s.supplier_id)}')">
      <div class="po-sup-avatar" style="background:${esc(s.color || 'var(--acc2)')}">${esc((s.supplier_name || '?').charAt(0))}</div>
      <div class="po-sup-name">${esc(s.supplier_name)}</div>
      <div class="po-sup-meta">${esc(s.category || '')} · ${esc(s.product_count || 0)} items</div>
    </div>`).join('');
}

function filterSuppliers() {
  const q = (document.getElementById('po-sup-search')?.value || '').toLowerCase();
  const filtered = _suppliers.filter(s => (s.supplier_name || '').toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q));
  renderSupplierGrid(filtered);
}

function selectSupplier(supplierId) {
  SPG.go('purchase/catalog', { supplier_id: supplierId });
}


// ──── 3. CATALOG ────
let _catalogSupplier = '';
let _catalogCategory = '';
let _catalogSearch = '';

function renderCatalog(p) {
  _catalogSupplier = p?.supplier_id || _catalogSupplier || '';
  const sup = _suppliers.find(s => s.supplier_id === _catalogSupplier);
  return storeShell(`
    ${SPG.toolbar(sup ? esc(sup.supplier_name) : 'Catalog', `<button class="btn btn-outline btn-sm" onclick="SPG.go('purchase/suppliers')">← Back</button>`)}
    <div class="content">
      <input class="inp" id="po-cat-search" placeholder="Search products..." oninput="PurchaseSection.filterCatalog()" style="margin-bottom:8px">
      <div class="po-cat-filters" id="po-cat-filters"></div>
      <div class="po-product-grid" id="po-product-grid">${SPG.ui.skeleton(120, 6)}</div>
    </div>${cartFab()}`, 'suppliers');
}

async function loadCatalog(p) {
  _catalogSupplier = p?.supplier_id || _catalogSupplier || '';
  try {
    const s = api.getSession();
    const data = await po('po_get_products', { store_id: s.store_id, supplier_id: _catalogSupplier });
    _products = data.products || [];
    _categories = data.categories || [];

    const filtersEl = document.getElementById('po-cat-filters');
    if (filtersEl && _categories.length) {
      filtersEl.innerHTML = `<button class="po-cat-chip active" onclick="PurchaseSection.setCatalogCategory('')">All</button>` +
        _categories.map(c => `<button class="po-cat-chip" onclick="PurchaseSection.setCatalogCategory('${esc(c)}')">${esc(c)}</button>`).join('');
    }
    renderProductGrid(_products);
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function setCatalogCategory(cat) {
  _catalogCategory = cat;
  document.querySelectorAll('.po-cat-chip').forEach(el => el.classList.remove('active'));
  const chips = document.querySelectorAll('.po-cat-chip');
  chips.forEach(el => { if ((cat === '' && el.textContent === 'All') || el.textContent === cat) el.classList.add('active'); });
  filterCatalog();
}

function filterCatalog() {
  const q = (document.getElementById('po-cat-search')?.value || '').toLowerCase();
  _catalogSearch = q;
  let filtered = _products;
  if (_catalogCategory) filtered = filtered.filter(p => p.category === _catalogCategory);
  if (q) filtered = filtered.filter(p => (p.product_name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
  renderProductGrid(filtered);
}

function renderProductGrid(list) {
  const el = document.getElementById('po-product-grid');
  if (!el) return;
  if (!list.length) { el.innerHTML = SPG.ui.empty('📦', 'No products found'); return; }
  el.innerHTML = list.map(p => {
    const inCart = _cart.find(c => c.product_id === p.product_id && c.supplier_id === (p.supplier_id || _catalogSupplier));
    const cartQty = inCart ? inCart.qty : 0;
    return `<div class="po-prod-card" onclick="SPG.go('purchase/product',{id:'${esc(p.product_id)}',supplier_id:'${esc(p.supplier_id || _catalogSupplier)}'})">
      <div class="po-prod-img">${p.image_url ? `<img src="${esc(p.image_url)}" alt="">` : '<div class="po-prod-img-ph">📦</div>'}</div>
      <div class="po-prod-info">
        <div class="po-prod-name">${esc(p.product_name)}</div>
        <div class="po-prod-meta">${esc(p.unit || 'ea')} · ${esc(p.category || '')}</div>
        <div class="po-prod-price">${fmtCurrency(p.price)}</div>
      </div>
      ${cartQty ? `<div class="po-prod-cart-badge">${cartQty}</div>` : ''}
      <button class="po-prod-add" onclick="event.stopPropagation();PurchaseSection.quickAdd('${esc(p.product_id)}','${esc(p.supplier_id || _catalogSupplier)}')">+</button>
    </div>`;
  }).join('');
}

function quickAdd(productId, supplierId) {
  const p = _products.find(x => x.product_id === productId);
  if (!p) return;
  const sup = _suppliers.find(s => s.supplier_id === supplierId);
  addToCart({
    supplier_id: supplierId,
    supplier_name: sup?.supplier_name || '',
    product_id: p.product_id,
    product_name: p.product_name,
    unit: p.unit || 'ea',
    qty: 1,
    price: p.price || 0,
    image_url: p.image_url || '',
  });
  SPG.toast(`Added ${p.product_name}`, 'success');
  filterCatalog();
}


// ──── 4. PRODUCT DETAIL ────
let _productDetail = null;

function renderProduct(p) {
  return storeShell(`
    ${SPG.toolbar('Product', `<button class="btn btn-outline btn-sm" onclick="history.back()">← Back</button>`)}
    <div class="content" id="po-product-detail">${SPG.ui.skeleton(200)}</div>${cartFab()}`, 'suppliers');
}

async function loadProduct(p) {
  try {
    const data = await po('po_get_product_detail', { product_id: p?.id, supplier_id: p?.supplier_id });
    _productDetail = data;
    const el = document.getElementById('po-product-detail');
    if (!el) return;

    const inCart = _cart.find(c => c.product_id === data.product_id && c.supplier_id === (p?.supplier_id || data.supplier_id));
    const qty = inCart ? inCart.qty : 1;

    el.innerHTML = `
      <div class="po-pd-image">${data.image_url ? `<img src="${esc(data.image_url)}" alt="" style="width:100%;border-radius:var(--rd)">` : '<div class="po-prod-img-ph" style="height:200px;font-size:48px">📦</div>'}</div>
      <div class="po-pd-body">
        <div class="po-pd-name">${esc(data.product_name)}</div>
        <div class="po-pd-meta">${esc(data.sku || '')} · ${esc(data.unit || 'ea')} · ${esc(data.category || '')}</div>
        <div class="po-pd-price">${fmtCurrency(data.price)} <span style="font-size:11px;color:var(--t3)">excl. GST</span></div>
        ${data.description ? `<div class="po-pd-desc">${esc(data.description)}</div>` : ''}
        <div class="po-pd-stock">
          ${data.stock_level != null ? `<span>Stock: <strong>${data.stock_level}</strong> ${esc(data.unit || 'ea')}</span>` : ''}
          ${data.min_order ? `<span>Min order: <strong>${data.min_order}</strong></span>` : ''}
        </div>
        <div class="po-pd-qty">
          <button class="po-qty-btn" onclick="PurchaseSection.pdQty(-1)">-</button>
          <input class="po-qty-input" id="po-pd-qty" type="number" value="${qty}" min="1" inputmode="numeric">
          <button class="po-qty-btn" onclick="PurchaseSection.pdQty(1)">+</button>
        </div>
        <button class="btn btn-primary btn-full" style="margin-top:12px" onclick="PurchaseSection.pdAddToCart()">
          ${inCart ? 'Update Cart' : 'Add to Cart'} — ${fmtCurrency((data.price || 0) * qty)}
        </button>
      </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function pdQty(delta) {
  const inp = document.getElementById('po-pd-qty');
  if (!inp) return;
  let v = parseInt(inp.value) || 1;
  v = Math.max(1, v + delta);
  inp.value = v;
}

function pdAddToCart() {
  if (!_productDetail) return;
  const qty = parseInt(document.getElementById('po-pd-qty')?.value) || 1;
  const d = _productDetail;
  const supplierId = d.supplier_id || SPG.currentParams?.supplier_id || '';
  const sup = _suppliers.find(s => s.supplier_id === supplierId);

  // Remove existing then add fresh
  removeFromCart(d.product_id, supplierId);
  addToCart({
    supplier_id: supplierId,
    supplier_name: sup?.supplier_name || '',
    product_id: d.product_id,
    product_name: d.product_name,
    unit: d.unit || 'ea',
    qty,
    price: d.price || 0,
    image_url: d.image_url || '',
  });
  SPG.toast(`${d.product_name} added (${qty})`, 'success');
  SPG.go('purchase/cart');
}


// ──── 5. CART ────
function renderCart() {
  return storeShell(`
    ${SPG.toolbar('Cart', `<button class="btn btn-outline btn-sm" onclick="history.back()">← Back</button>`)}
    <div class="content" id="po-cart-content"></div>`, 'suppliers');
}

function loadCart() { renderCartContent(); }

function renderCartContent() {
  const el = document.getElementById('po-cart-content');
  if (!el) return;

  if (!_cart.length) {
    el.innerHTML = SPG.ui.empty('🛒', 'Cart is empty', 'Browse products to add items') +
      `<button class="btn btn-primary btn-full" style="margin-top:16px" onclick="SPG.go('purchase/suppliers')">Browse Suppliers</button>`;
    return;
  }

  // Group by supplier
  const groups = {};
  _cart.forEach(c => {
    if (!groups[c.supplier_id]) groups[c.supplier_id] = { name: c.supplier_name, items: [] };
    groups[c.supplier_id].items.push(c);
  });

  const sub = cartSubtotal();
  const gst = calcGST(sub);
  const total = calcTotal(sub);

  let html = '';
  Object.entries(groups).forEach(([sid, g]) => {
    html += `<div class="po-cart-group">
      <div class="po-cart-group-header">${esc(g.name || sid)}</div>
      ${g.items.map(item => `
        <div class="po-cart-item">
          <div class="po-cart-item-info">
            <div class="po-cart-item-name">${esc(item.product_name)}</div>
            <div class="po-cart-item-price">${fmtCurrency(item.price)} / ${esc(item.unit)}</div>
          </div>
          <div class="po-cart-item-qty">
            <button class="po-qty-btn-sm" onclick="PurchaseSection.cartQty('${esc(item.product_id)}','${esc(item.supplier_id)}',-1)">-</button>
            <span class="po-cart-qty-val">${item.qty}</span>
            <button class="po-qty-btn-sm" onclick="PurchaseSection.cartQty('${esc(item.product_id)}','${esc(item.supplier_id)}',1)">+</button>
          </div>
          <div class="po-cart-item-total">${fmtCurrency(item.qty * item.price)}</div>
          <button class="po-cart-item-remove" onclick="PurchaseSection.cartRemove('${esc(item.product_id)}','${esc(item.supplier_id)}')">&times;</button>
        </div>`).join('')}
    </div>`;
  });

  html += `
    <div class="po-cart-summary">
      <div class="po-cart-sum-row"><span>Subtotal (excl. GST)</span><span>${fmtCurrency(sub)}</span></div>
      <div class="po-cart-sum-row"><span>GST (10%)</span><span>${fmtCurrency(gst)}</span></div>
      <div class="po-cart-sum-row total"><span>Total (incl. GST)</span><span>${fmtCurrency(total)}</span></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-outline" style="flex:1" onclick="PurchaseSection.doClearCart()">Clear Cart</button>
      <button class="btn btn-primary" style="flex:2" onclick="PurchaseSection.doSubmitOrder()">Submit Order</button>
    </div>`;

  el.innerHTML = html;
}

function cartQty(productId, supplierId, delta) {
  const item = _cart.find(c => c.product_id === productId && c.supplier_id === supplierId);
  if (!item) return;
  updateCartQty(productId, supplierId, item.qty + delta);
  renderCartContent();
}

function cartRemove(productId, supplierId) {
  removeFromCart(productId, supplierId);
  renderCartContent();
}

function doClearCart() {
  SPG.showDialog(`<div class="popup-sheet">
    <div class="popup-header"><div class="popup-title">Clear Cart?</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:16px">Remove all items from cart?</div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" style="background:var(--red)" onclick="SPG.closeDialog();PurchaseSection.confirmClearCart()">Clear</button>
    </div>
  </div>`);
}

function confirmClearCart() { clearCart(); renderCartContent(); SPG.toast('Cart cleared', 'info'); }

async function doSubmitOrder() {
  if (!_cart.length) return;
  const s = api.getSession();

  // Group by supplier
  const groups = {};
  _cart.forEach(c => {
    if (!groups[c.supplier_id]) groups[c.supplier_id] = [];
    groups[c.supplier_id].push({ product_id: c.product_id, qty: c.qty, price: c.price });
  });

  SPG.showLoader();
  try {
    const results = [];
    for (const [supplier_id, items] of Object.entries(groups)) {
      const sub = items.reduce((s, i) => s + i.qty * i.price, 0);
      const result = await po('po_create_order', {
        store_id: s.store_id,
        supplier_id,
        items,
        subtotal: sub,
        gst: calcGST(sub),
        total_inc_gst: calcTotal(sub),
        notes: '',
      });
      results.push(result);
    }
    clearCart();
    SPG.hideLoader();
    SPG.go('purchase/confirmed', { order_ids: results.map(r => r.order_id) });
  } catch (e) {
    SPG.hideLoader();
    SPG.toast(e.message || 'Failed to submit order', 'error');
  }
}


// ──── 6. CONFIRMED ────
function renderConfirmed(p) {
  const orderIds = p?.order_ids || [];
  return storeShell(`
    <div class="content" style="text-align:center;padding-top:60px">
      <div style="font-size:48px;margin-bottom:12px">✅</div>
      <div style="font-size:18px;font-weight:700;margin-bottom:8px">Order Submitted!</div>
      <div style="font-size:13px;color:var(--t3);margin-bottom:24px">
        ${orderIds.length ? `Order${orderIds.length > 1 ? 's' : ''}: ${orderIds.map(id => esc(id)).join(', ')}` : 'Your order has been placed successfully.'}
      </div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button class="btn btn-primary" onclick="SPG.go('purchase/orders')">View Orders</button>
        <button class="btn btn-outline" onclick="SPG.go('purchase/home')">Home</button>
      </div>
    </div>`, 'home');
}


// ──── 7. ORDERS ────
let _ordersFilter = 'all';

function renderOrders() {
  return storeShell(`
    ${SPG.toolbar('My Orders')}
    <div class="content">
      <div class="po-filter-chips" id="po-orders-chips">
        <button class="po-cat-chip active" onclick="PurchaseSection.setOrderFilter('all')">All</button>
        <button class="po-cat-chip" onclick="PurchaseSection.setOrderFilter('pending')">Pending</button>
        <button class="po-cat-chip" onclick="PurchaseSection.setOrderFilter('approved')">Approved</button>
        <button class="po-cat-chip" onclick="PurchaseSection.setOrderFilter('dispatched')">Dispatched</button>
        <button class="po-cat-chip" onclick="PurchaseSection.setOrderFilter('completed')">Completed</button>
      </div>
      <div id="po-orders-list">${SPG.ui.skeleton(70, 4)}</div>
    </div>`, 'suppliers');
}

async function loadOrders() {
  try {
    const s = api.getSession();
    const data = await po('po_get_orders', { store_id: s.store_id });
    _orders = data.orders || [];
    renderOrdersList();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function setOrderFilter(f) {
  _ordersFilter = f;
  document.querySelectorAll('#po-orders-chips .po-cat-chip').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('#po-orders-chips .po-cat-chip').forEach(el => { if (el.textContent.toLowerCase() === f || (f === 'all' && el.textContent === 'All')) el.classList.add('active'); });
  renderOrdersList();
}

function renderOrdersList() {
  const el = document.getElementById('po-orders-list');
  if (!el) return;
  let list = _orders;
  if (_ordersFilter !== 'all') list = list.filter(o => o.status === _ordersFilter);
  if (!list.length) { el.innerHTML = SPG.ui.empty('📋', 'No orders found'); return; }
  el.innerHTML = list.map(o => `
    <div class="po-order-card" onclick="SPG.go('purchase/order-detail',{id:'${esc(o.order_id)}'})">
      <div class="po-order-card-top">
        <span class="po-order-id">${esc(o.order_id)}</span>
        ${poBadge(o.status)}
      </div>
      <div class="po-order-card-mid">
        <span>${esc(o.supplier_name || '-')}</span>
        <span class="po-order-total">${fmtCurrency(o.total_inc_gst)}</span>
      </div>
      <div class="po-order-card-bot">${esc(o.item_count || 0)} items · ${fmtDate(o.created_at)}</div>
    </div>`).join('');
}


// ──── 8. ORDER DETAIL ────
let _orderDetail = null;

function renderOrderDetail(p) {
  return storeShell(`
    ${SPG.toolbar('Order', `<button class="btn btn-outline btn-sm" onclick="SPG.go('purchase/orders')">← Back</button>`)}
    <div class="content" id="po-order-detail">${SPG.ui.skeleton(300)}</div>`, 'suppliers');
}

async function loadOrderDetail(p) {
  try {
    const data = await po('po_get_order_detail', { order_id: p?.id });
    _orderDetail = data;
    const el = document.getElementById('po-order-detail');
    if (!el) return;

    const items = data.items || [];
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div>
          <div style="font-size:15px;font-weight:700">${esc(data.order_id)}</div>
          <div style="font-size:11px;color:var(--t3)">${fmtDateTime(data.created_at)}</div>
        </div>
        ${poBadge(data.status)}
      </div>
      ${orderTimeline(data.status)}
      <div class="po-od-section">
        <div class="po-od-label">Supplier</div>
        <div class="po-od-value">${esc(data.supplier_name || '-')}</div>
      </div>
      <div class="po-od-section">
        <div class="po-od-label">Items</div>
        <div class="po-od-items">
          ${items.map(i => `<div class="po-od-item">
            <div class="po-od-item-name">${esc(i.product_name)}</div>
            <div class="po-od-item-meta">${i.qty} x ${fmtCurrency(i.price)} / ${esc(i.unit || 'ea')}</div>
            <div class="po-od-item-total">${fmtCurrency(i.qty * i.price)}</div>
          </div>`).join('')}
        </div>
      </div>
      <div class="po-cart-summary" style="margin-top:12px">
        <div class="po-cart-sum-row"><span>Subtotal</span><span>${fmtCurrency(data.subtotal)}</span></div>
        <div class="po-cart-sum-row"><span>GST (10%)</span><span>${fmtCurrency(data.gst)}</span></div>
        <div class="po-cart-sum-row total"><span>Total</span><span>${fmtCurrency(data.total_inc_gst)}</span></div>
      </div>
      ${data.notes ? `<div class="po-od-section"><div class="po-od-label">Notes</div><div style="font-size:12px;color:var(--t2)">${esc(data.notes)}</div></div>` : ''}
      ${data.status === 'draft' ? `<button class="btn btn-primary btn-full" style="margin-top:16px" onclick="PurchaseSection.cancelOrder('${esc(data.order_id)}')">Cancel Order</button>` : ''}`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function cancelOrder(orderId) {
  SPG.showDialog(`<div class="popup-sheet">
    <div class="popup-header"><div class="popup-title">Cancel Order?</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:16px">This action cannot be undone.</div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">No</button>
      <button class="btn btn-primary" style="background:var(--red)" onclick="SPG.closeDialog();PurchaseSection.confirmCancel('${esc(orderId)}')">Cancel Order</button>
    </div>
  </div>`);
}

async function confirmCancel(orderId) {
  SPG.showLoader();
  try {
    await po('po_create_order', { order_id: orderId, action: 'cancel' });
    SPG.toast('Order cancelled', 'info');
    SPG.go('purchase/orders');
  } catch (e) { SPG.toast(e.message, 'error'); }
  finally { SPG.hideLoader(); }
}


// ──── 9. RECEIVE ────
function renderReceive() {
  return storeShell(`
    ${SPG.toolbar('Receive Orders')}
    <div class="content">
      <div id="po-receive-list">${SPG.ui.skeleton(70, 4)}</div>
    </div>`, 'receive');
}

async function loadReceive() {
  try {
    const s = api.getSession();
    const data = await po('po_get_receive_list', { store_id: s.store_id });
    const list = data.orders || [];
    const el = document.getElementById('po-receive-list');
    if (!el) return;
    if (!list.length) { el.innerHTML = SPG.ui.empty('📦', 'No orders to receive', 'Dispatched orders will appear here'); return; }
    el.innerHTML = list.map(o => `
      <div class="po-order-card" onclick="SPG.go('purchase/receive-check',{id:'${esc(o.order_id)}'})">
        <div class="po-order-card-top">
          <span class="po-order-id">${esc(o.order_id)}</span>
          ${poBadge(o.status)}
        </div>
        <div class="po-order-card-mid">
          <span>${esc(o.supplier_name || '-')}</span>
          <span class="po-order-total">${fmtCurrency(o.total_inc_gst)}</span>
        </div>
        <div class="po-order-card-bot">Dispatched ${fmtDate(o.dispatched_at)} · ${esc(o.item_count || 0)} items</div>
      </div>`).join('');
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ──── 10. RECEIVE CHECK ────
let _receiveOrder = null;

function renderReceiveCheck(p) {
  return storeShell(`
    ${SPG.toolbar('Check Delivery', `<button class="btn btn-outline btn-sm" onclick="SPG.go('purchase/receive')">← Back</button>`)}
    <div class="content" id="po-receive-check">${SPG.ui.skeleton(300)}</div>`, 'receive');
}

async function loadReceiveCheck(p) {
  try {
    const data = await po('po_get_order_detail', { order_id: p?.id });
    _receiveOrder = data;
    const el = document.getElementById('po-receive-check');
    if (!el) return;

    const items = data.items || [];
    el.innerHTML = `
      <div style="margin-bottom:12px">
        <div style="font-size:14px;font-weight:700">${esc(data.order_id)}</div>
        <div style="font-size:11px;color:var(--t3)">${esc(data.supplier_name)} · Dispatched ${fmtDate(data.dispatched_at)}</div>
      </div>
      <div class="po-rc-items">
        ${items.map((item, i) => `
          <div class="po-rc-item">
            <div class="po-rc-item-info">
              <div style="font-weight:600;font-size:12px">${esc(item.product_name)}</div>
              <div style="font-size:11px;color:var(--t3)">Ordered: ${item.qty} ${esc(item.unit || 'ea')}</div>
            </div>
            <div class="po-rc-item-input">
              <label style="font-size:10px;color:var(--t3)">Received</label>
              <input class="inp po-rc-qty" data-idx="${i}" type="number" value="${item.qty}" min="0" style="width:60px;text-align:center">
            </div>
            <div class="po-rc-item-check">
              <label style="font-size:10px;color:var(--t3)">OK</label>
              <input type="checkbox" class="po-rc-ok" data-idx="${i}" checked>
            </div>
          </div>`).join('')}
      </div>
      <div class="fg" style="margin-top:12px">
        <label class="lb">Notes</label>
        <textarea class="inp" id="po-rc-notes" rows="2" placeholder="Any discrepancies or damage..." style="width:100%;box-sizing:border-box"></textarea>
      </div>
      <button class="btn btn-primary btn-full" style="margin-top:12px" onclick="PurchaseSection.doConfirmReceive()">Confirm Receipt</button>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function doConfirmReceive() {
  if (!_receiveOrder) return;
  const items = (_receiveOrder.items || []).map((item, i) => {
    const qtyEl = document.querySelector(`.po-rc-qty[data-idx="${i}"]`);
    const okEl = document.querySelector(`.po-rc-ok[data-idx="${i}"]`);
    return {
      item_id: item.item_id,
      product_id: item.product_id,
      ordered_qty: item.qty,
      received_qty: parseInt(qtyEl?.value) || 0,
      is_ok: okEl?.checked ?? true,
    };
  });
  const notes = document.getElementById('po-rc-notes')?.value.trim() || '';

  SPG.showLoader();
  try {
    await po('po_confirm_receive', { order_id: _receiveOrder.order_id, items, notes });
    SPG.hideLoader();
    SPG.toast('Receipt confirmed', 'success');
    SPG.go('purchase/invoice-capture', { id: _receiveOrder.order_id });
  } catch (e) { SPG.hideLoader(); SPG.toast(e.message, 'error'); }
}


// ──── 11. INVOICE CAPTURE ────
function renderInvoiceCapture(p) {
  return storeShell(`
    ${SPG.toolbar('Invoice Capture', `<button class="btn btn-outline btn-sm" onclick="SPG.go('purchase/receive')">← Back</button>`)}
    <div class="content">
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:14px;font-weight:600;margin-bottom:4px">Take a photo of the invoice</div>
        <div style="font-size:11px;color:var(--t3)">Order: ${esc(p?.id || '')}</div>
      </div>
      <div class="po-ic-upload" id="po-ic-upload" onclick="document.getElementById('po-ic-file').click()">
        <div class="po-ic-icon">📸</div>
        <div class="po-ic-text">Tap to capture or upload invoice</div>
        <input type="file" id="po-ic-file" accept="image/*" capture="environment" style="display:none" onchange="PurchaseSection.onInvoiceFile(event)">
      </div>
      <div id="po-ic-preview" style="display:none;margin-top:12px;text-align:center">
        <img id="po-ic-img" style="max-width:100%;border-radius:var(--rd);border:1px solid var(--bd2)">
        <div style="margin-top:12px;display:flex;gap:8px;justify-content:center">
          <button class="btn btn-outline" onclick="PurchaseSection.retakeInvoice()">Retake</button>
          <button class="btn btn-primary" id="po-ic-submit" onclick="PurchaseSection.doUploadInvoice('${esc(p?.id || '')}')">Upload & OCR</button>
        </div>
      </div>
      <div style="text-align:center;margin-top:16px">
        <button class="btn btn-outline btn-sm" onclick="SPG.go('purchase/receive')">Skip for now</button>
      </div>
    </div>`, 'receive');
}

let _invoiceFile = null;

function onInvoiceFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  _invoiceFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = document.getElementById('po-ic-img');
    const preview = document.getElementById('po-ic-preview');
    const upload = document.getElementById('po-ic-upload');
    if (img) img.src = ev.target.result;
    if (preview) preview.style.display = 'block';
    if (upload) upload.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function retakeInvoice() {
  _invoiceFile = null;
  const preview = document.getElementById('po-ic-preview');
  const upload = document.getElementById('po-ic-upload');
  if (preview) preview.style.display = 'none';
  if (upload) upload.style.display = 'flex';
  document.getElementById('po-ic-file').value = '';
}

async function doUploadInvoice(orderId) {
  if (!_invoiceFile) { SPG.toast('Please capture an invoice', 'error'); return; }
  const btn = document.getElementById('po-ic-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }
  SPG.showLoader();
  try {
    // Convert to base64
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result.split(',')[1]);
      reader.readAsDataURL(_invoiceFile);
    });
    await po('po_upload_invoice', { order_id: orderId, image_base64: base64, filename: _invoiceFile.name });
    SPG.hideLoader();
    SPG.toast('Invoice uploaded', 'success');
    SPG.go('purchase/invoice-review', { id: orderId });
  } catch (e) {
    SPG.hideLoader();
    SPG.toast(e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Upload & OCR'; }
  }
}


// ──── 12. INVOICE REVIEW ────
function renderInvoiceReview(p) {
  return storeShell(`
    ${SPG.toolbar('Invoice Review', `<button class="btn btn-outline btn-sm" onclick="SPG.go('purchase/receive')">← Back</button>`)}
    <div class="content" id="po-inv-review">${SPG.ui.skeleton(300)}</div>`, 'receive');
}

async function loadInvoiceReview(p) {
  try {
    const data = await po('po_get_invoice_review', { order_id: p?.id });
    const el = document.getElementById('po-inv-review');
    if (!el) return;

    const lines = data.ocr_lines || [];
    const confidence = data.confidence || 0;
    const confColor = confidence >= 0.8 ? 'var(--green)' : confidence >= 0.5 ? 'var(--orange)' : 'var(--red)';

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:14px;font-weight:700">OCR Results</div>
        <div style="font-size:11px;padding:2px 8px;border-radius:10px;background:${confColor}20;color:${confColor}">
          Confidence: ${Math.round(confidence * 100)}%
        </div>
      </div>
      ${data.image_url ? `<img src="${esc(data.image_url)}" style="width:100%;border-radius:var(--rd);margin-bottom:12px;border:1px solid var(--bd2)">` : ''}
      <div class="po-inv-lines">
        ${lines.length ? lines.map((l, i) => `
          <div class="po-inv-line" style="border-left:3px solid ${l.confidence >= 0.8 ? 'var(--green)' : l.confidence >= 0.5 ? 'var(--orange)' : 'var(--red)'}">
            <div style="display:flex;justify-content:space-between">
              <span style="font-size:12px;font-weight:600">${esc(l.product_name || l.text)}</span>
              <span style="font-size:11px;color:var(--t3)">${Math.round((l.confidence || 0) * 100)}%</span>
            </div>
            ${l.qty != null ? `<div style="font-size:11px;color:var(--t3)">Qty: ${l.qty} · ${fmtCurrency(l.amount || 0)}</div>` : ''}
          </div>`).join('') : '<div style="font-size:12px;color:var(--t3);padding:12px">No lines detected</div>'}
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-outline" style="flex:1" onclick="SPG.go('purchase/invoice-capture',{id:'${esc(p?.id || '')}'})">Re-scan</button>
        <button class="btn btn-primary" style="flex:1" onclick="SPG.toast('Invoice accepted','success');SPG.go('purchase/orders')">Accept</button>
      </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ──── 13. STOCK ────
function renderStock() {
  return storeShell(`
    ${SPG.toolbar('Stock Overview')}
    <div class="content">
      <input class="inp" id="po-stock-search" placeholder="Search products..." oninput="PurchaseSection.filterStock()" style="margin-bottom:12px">
      <div id="po-stock-list">${SPG.ui.skeleton(50, 6)}</div>
    </div>`, 'stock');
}

let _stockItems = [];

async function loadStock() {
  try {
    const s = api.getSession();
    const data = await po('po_get_stock', { store_id: s.store_id });
    _stockItems = data.items || [];
    renderStockList(_stockItems);
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function renderStockList(list) {
  const el = document.getElementById('po-stock-list');
  if (!el) return;
  if (!list.length) { el.innerHTML = SPG.ui.empty('📊', 'No stock data'); return; }
  el.innerHTML = `<table class="tbl" style="width:100%">
    <thead><tr>
      ${SPG.ui.sortTh('po-stock', 'product_name', 'Product')}
      ${SPG.ui.sortTh('po-stock', 'category', 'Category')}
      ${SPG.ui.sortTh('po-stock', 'current_qty', 'Qty', ' style="text-align:right"')}
      <th>Status</th>
    </tr></thead>
    <tbody>${list.map(i => {
      const level = i.current_qty <= (i.min_level || 0) ? 'low' : i.current_qty <= (i.reorder_level || 0) ? 'medium' : 'ok';
      const levelBadge = level === 'low' ? SPG.ui.badge('fail', 'Low') : level === 'medium' ? SPG.ui.badge('pending', 'Reorder') : SPG.ui.badge('active', 'OK');
      return `<tr>
        <td style="font-weight:600;font-size:12px">${esc(i.product_name)}</td>
        <td style="font-size:11px;color:var(--t3)">${esc(i.category || '-')}</td>
        <td style="text-align:right;font-weight:600">${i.current_qty} ${esc(i.unit || '')}</td>
        <td>${levelBadge}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}

function filterStock() {
  const q = (document.getElementById('po-stock-search')?.value || '').toLowerCase();
  const filtered = _stockItems.filter(i => (i.product_name || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));
  renderStockList(filtered);
}


// ──── 14. NOTIFICATIONS ────
function renderNotifications() {
  return storeShell(`
    ${SPG.toolbar('Notifications')}
    <div class="content" id="po-notif-list">${SPG.ui.skeleton(60, 5)}</div>`, 'profile');
}

function loadNotifications() {
  // Notifications loaded from init bundle or separate endpoint
  const el = document.getElementById('po-notif-list');
  if (!el) return;
  const notifs = _initData?.notifications || [];
  if (!notifs.length) { el.innerHTML = SPG.ui.empty('🔔', 'No notifications'); return; }
  el.innerHTML = notifs.map(n => `
    <div class="po-notif-card${n.read ? '' : ' unread'}">
      <div class="po-notif-title">${esc(n.title)}</div>
      <div class="po-notif-body">${esc(n.body)}</div>
      <div class="po-notif-time">${fmtDateTime(n.created_at)}</div>
    </div>`).join('');
}


// ──── 15. PROFILE ────
function renderProfile() {
  const s = api.getSession();
  if (!s) return SPG.go('login');

  return storeShell(`
    ${SPG.toolbar('Profile')}
    <div class="content">
      <div class="card max-w-sm">
        <div class="profile-header">
          <div class="profile-avatar" style="background:var(--orange-bg);color:var(--orange)">${esc((s.display_name || '?').charAt(0).toUpperCase())}</div>
          <div>
            <div class="profile-name">${esc(s.display_name)}</div>
            <div class="profile-meta">${esc(s.position_name || s.tier_id)} · ${esc(s.store_id || 'HQ')}</div>
          </div>
        </div>
        <div class="po-profile-links">
          <div class="po-profile-link" onclick="SPG.go('purchase/notifications')">🔔 Notifications</div>
          <div class="po-profile-link" onclick="SPG.go('purchase/orders')">📋 My Orders</div>
          <div class="po-profile-link" onclick="SPG.go('purchase/stock')">📊 Stock Overview</div>
          <div class="po-profile-link" onclick="SPG.go('profile')">👤 Edit Profile</div>
          <div class="po-profile-link" onclick="SPG.go('purchase/home')">◇ Purchase Home</div>
        </div>
      </div>
    </div>`, 'profile');
}


// ══════════════════════════════════════════════
//   WAREHOUSE ROUTES
// ══════════════════════════════════════════════

// ──── 16. WH HOME ────
function renderWhHome() {
  return whShell(`
    ${SPG.toolbar('Warehouse Dashboard')}
    <div class="content" id="po-wh-home">${SPG.ui.skeleton(80, 3)}</div>`, 'wh-home');
}

async function loadWhHome() {
  try {
    const s = api.getSession();
    const data = await po('po_get_wh_dashboard', { store_id: s.store_id });
    _whDashboard = data;
    const el = document.getElementById('po-wh-home');
    if (!el) return;

    el.innerHTML = `
      <div style="margin-bottom:16px">
        <div style="font-size:15px;font-weight:700">Warehouse</div>
        <div style="font-size:11px;color:var(--t3)">${esc(s.store_id)} · ${fmtDate(sydneyNow())}</div>
      </div>
      <div class="po-wh-metrics">
        <div class="po-wh-metric" onclick="SPG.go('purchase/wh-incoming')">
          <div class="po-wh-metric-val">${data.incoming_count || 0}</div>
          <div class="po-wh-metric-label">Incoming</div>
        </div>
        <div class="po-wh-metric" onclick="SPG.go('purchase/wh-pick-list')">
          <div class="po-wh-metric-val">${data.pick_count || 0}</div>
          <div class="po-wh-metric-label">To Pick</div>
        </div>
        <div class="po-wh-metric" onclick="SPG.go('purchase/wh-invoices')">
          <div class="po-wh-metric-val">${data.invoice_count || 0}</div>
          <div class="po-wh-metric-label">Invoices</div>
        </div>
        <div class="po-wh-metric" onclick="SPG.go('purchase/wh-stock')">
          <div class="po-wh-metric-val">${data.low_stock_count || 0}</div>
          <div class="po-wh-metric-label">Low Stock</div>
        </div>
      </div>
      <div class="sec-title" style="margin-top:20px">Recent Activity</div>
      <div id="po-wh-activity">
        ${(data.recent_activity || []).length ? (data.recent_activity || []).map(a => `
          <div class="po-wh-activity-row">
            <div class="po-wh-activity-dot" style="background:${a.type === 'pick' ? 'var(--blue)' : a.type === 'receive' ? 'var(--green)' : 'var(--orange)'}"></div>
            <div>
              <div style="font-size:12px;font-weight:600">${esc(a.title)}</div>
              <div style="font-size:10px;color:var(--t3)">${fmtDateTime(a.created_at)}</div>
            </div>
          </div>`).join('') : SPG.ui.empty('📋', 'No recent activity')}
      </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ──── 17. WH INCOMING ────
function renderWhIncoming() {
  return whShell(`
    ${SPG.toolbar('Incoming Orders')}
    <div class="content" id="po-wh-incoming">${SPG.ui.skeleton(70, 5)}</div>`, 'wh-incoming');
}

async function loadWhIncoming() {
  try {
    const data = await po('po_get_wh_incoming');
    const list = data.orders || [];
    const el = document.getElementById('po-wh-incoming');
    if (!el) return;
    if (!list.length) { el.innerHTML = SPG.ui.empty('📥', 'No incoming orders'); return; }
    el.innerHTML = list.map(o => `
      <div class="po-order-card" onclick="SPG.go('purchase/wh-pick-detail',{id:'${esc(o.order_id)}'})">
        <div class="po-order-card-top">
          <span class="po-order-id">${esc(o.order_id)}</span>
          ${poBadge(o.status)}
        </div>
        <div class="po-order-card-mid">
          <span>${esc(o.store_id || '-')}</span>
          <span class="po-order-total">${fmtCurrency(o.total_inc_gst)}</span>
        </div>
        <div class="po-order-card-bot">${esc(o.item_count || 0)} items · ${fmtDate(o.created_at)}</div>
      </div>`).join('');
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ──── 18. WH PICK LIST ────
function renderWhPickList() {
  return whShell(`
    ${SPG.toolbar("Today's Pick List")}
    <div class="content" id="po-wh-pick-list">${SPG.ui.skeleton(70, 5)}</div>`, 'wh-pick-list');
}

async function loadWhPickList() {
  try {
    const data = await po('po_get_wh_pick_list');
    const list = data.orders || [];
    const el = document.getElementById('po-wh-pick-list');
    if (!el) return;
    if (!list.length) { el.innerHTML = SPG.ui.empty('📋', 'No orders to pick today'); return; }
    el.innerHTML = list.map(o => `
      <div class="po-order-card" onclick="SPG.go('purchase/wh-pick-detail',{id:'${esc(o.order_id)}'})">
        <div class="po-order-card-top">
          <span class="po-order-id">${esc(o.order_id)}</span>
          ${poBadge(o.status)}
        </div>
        <div class="po-order-card-mid">
          <span>Store: ${esc(o.store_id || '-')}</span>
          <span>${esc(o.item_count || 0)} items</span>
        </div>
        <div class="po-order-card-bot">Priority: ${esc(o.priority || 'Normal')} · ${fmtDate(o.created_at)}</div>
      </div>`).join('');
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ──── 19. WH PICK DETAIL ────
let _pickDetail = null;

function renderWhPickDetail(p) {
  return whShell(`
    ${SPG.toolbar('Pick Detail', `<button class="btn btn-outline btn-sm" onclick="SPG.go('purchase/wh-pick-list')">← Back</button>`)}
    <div class="content" id="po-wh-pick-detail">${SPG.ui.skeleton(300)}</div>`, 'wh-pick-list');
}

async function loadWhPickDetail(p) {
  try {
    const data = await po('po_get_wh_pick_detail', { order_id: p?.id });
    _pickDetail = data;
    const el = document.getElementById('po-wh-pick-detail');
    if (!el) return;

    const items = data.items || [];
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div>
          <div style="font-size:14px;font-weight:700">${esc(data.order_id)}</div>
          <div style="font-size:11px;color:var(--t3)">Store: ${esc(data.store_id)} · ${fmtDate(data.created_at)}</div>
        </div>
        ${poBadge(data.status)}
      </div>
      <div class="po-pick-items">
        ${items.map((item, i) => `
          <div class="po-pick-item">
            <div class="po-pick-item-info">
              <div style="font-weight:600;font-size:12px">${esc(item.product_name)}</div>
              <div style="font-size:11px;color:var(--t3)">${esc(item.sku || '')} · ${esc(item.location || '-')}</div>
              <div style="font-size:11px;color:var(--t2)">Ordered: <strong>${item.qty}</strong> ${esc(item.unit || 'ea')}</div>
            </div>
            <div class="po-pick-item-qty">
              <label style="font-size:10px;color:var(--t3)">Picked</label>
              <input class="inp po-pick-qty" data-idx="${i}" type="number" value="${item.picked_qty != null ? item.picked_qty : item.qty}" min="0" style="width:60px;text-align:center">
            </div>
          </div>`).join('')}
      </div>
      <div class="fg" style="margin-top:12px">
        <label class="lb">Picker Notes</label>
        <textarea class="inp" id="po-pick-notes" rows="2" placeholder="Substitutions, missing items..." style="width:100%;box-sizing:border-box">${esc(data.pick_notes || '')}</textarea>
      </div>
      <button class="btn btn-primary btn-full" style="margin-top:12px" onclick="PurchaseSection.doCompletePick('${esc(data.order_id)}')">Complete Pick</button>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function doCompletePick(orderId) {
  if (!_pickDetail) return;
  const items = (_pickDetail.items || []).map((item, i) => {
    const qtyEl = document.querySelector(`.po-pick-qty[data-idx="${i}"]`);
    return { item_id: item.item_id, product_id: item.product_id, ordered_qty: item.qty, picked_qty: parseInt(qtyEl?.value) || 0 };
  });
  const notes = document.getElementById('po-pick-notes')?.value.trim() || '';

  SPG.showLoader();
  try {
    await po('po_complete_pick', { order_id: orderId, items, notes });
    SPG.hideLoader();
    SPG.toast('Pick completed', 'success');
    SPG.go('purchase/wh-invoice-gen', { id: orderId });
  } catch (e) { SPG.hideLoader(); SPG.toast(e.message, 'error'); }
}


// ──── 20. WH INVOICE GEN ────
function renderWhInvoiceGen(p) {
  return whShell(`
    ${SPG.toolbar('Generate Invoice', `<button class="btn btn-outline btn-sm" onclick="SPG.go('purchase/wh-pick-list')">← Back</button>`)}
    <div class="content" id="po-wh-inv-gen">${SPG.ui.skeleton(300)}</div>`, 'wh-invoices');
}

async function loadWhInvoiceGen(p) {
  try {
    const data = await po('po_get_wh_invoice_data', { order_id: p?.id });
    const el = document.getElementById('po-wh-inv-gen');
    if (!el) return;

    const items = data.items || [];
    const sub = items.reduce((s, i) => s + (i.picked_qty || i.qty) * i.price, 0);
    const gst = calcGST(sub);
    const total = calcTotal(sub);

    el.innerHTML = `
      <div style="margin-bottom:12px">
        <div style="font-size:14px;font-weight:700">Invoice for ${esc(data.order_id)}</div>
        <div style="font-size:11px;color:var(--t3)">Store: ${esc(data.store_id)}</div>
      </div>
      <div class="po-od-items">
        ${items.map(i => `<div class="po-od-item">
          <div class="po-od-item-name">${esc(i.product_name)}</div>
          <div class="po-od-item-meta">${i.picked_qty || i.qty} x ${fmtCurrency(i.price)}</div>
          <div class="po-od-item-total">${fmtCurrency((i.picked_qty || i.qty) * i.price)}</div>
        </div>`).join('')}
      </div>
      <div class="po-cart-summary" style="margin-top:12px">
        <div class="po-cart-sum-row"><span>Subtotal</span><span>${fmtCurrency(sub)}</span></div>
        <div class="po-cart-sum-row"><span>GST (10%)</span><span>${fmtCurrency(gst)}</span></div>
        <div class="po-cart-sum-row total"><span>Total</span><span>${fmtCurrency(total)}</span></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-outline" style="flex:1" onclick="SPG.go('purchase/wh-invoice-preview',{id:'${esc(data.order_id)}'})">Preview</button>
        <button class="btn btn-primary" style="flex:1" onclick="PurchaseSection.doSendInvoice('${esc(data.order_id)}')">Send Invoice</button>
      </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function doSendInvoice(orderId) {
  SPG.showLoader();
  try {
    await po('po_send_wh_invoice', { order_id: orderId });
    SPG.hideLoader();
    SPG.toast('Invoice sent', 'success');
    SPG.go('purchase/wh-invoices');
  } catch (e) { SPG.hideLoader(); SPG.toast(e.message, 'error'); }
}


// ──── 21. WH INVOICE PREVIEW ────
function renderWhInvoicePreview(p) {
  return whShell(`
    ${SPG.toolbar('Invoice Preview', `<button class="btn btn-outline btn-sm" onclick="history.back()">← Back</button>`)}
    <div class="content" id="po-wh-inv-preview">${SPG.ui.skeleton(400)}</div>`, 'wh-invoices');
}

async function loadWhInvoicePreview(p) {
  try {
    const data = await po('po_get_wh_invoice_data', { order_id: p?.id });
    const el = document.getElementById('po-wh-inv-preview');
    if (!el) return;

    const items = data.items || [];
    const sub = items.reduce((s, i) => s + (i.picked_qty || i.qty) * i.price, 0);
    const gst = calcGST(sub);
    const total = calcTotal(sub);

    el.innerHTML = `
      <div class="po-inv-doc">
        <div class="po-inv-doc-header">
          <div style="font-size:18px;font-weight:700">TAX INVOICE</div>
          <div style="font-size:11px;color:var(--t3)">Siam Palette Group</div>
        </div>
        <div class="po-inv-doc-meta">
          <div><span style="color:var(--t3)">Invoice #:</span> <strong>${esc(data.invoice_id || data.order_id)}</strong></div>
          <div><span style="color:var(--t3)">Date:</span> ${fmtDate(sydneyNow())}</div>
          <div><span style="color:var(--t3)">Order:</span> ${esc(data.order_id)}</div>
          <div><span style="color:var(--t3)">Store:</span> ${esc(data.store_id)}</div>
        </div>
        <table class="tbl" style="width:100%;margin-top:12px">
          <thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amount</th></tr></thead>
          <tbody>
            ${items.map(i => `<tr>
              <td style="font-size:11px">${esc(i.product_name)}</td>
              <td style="text-align:right;font-size:11px">${i.picked_qty || i.qty}</td>
              <td style="text-align:right;font-size:11px">${fmtCurrency(i.price)}</td>
              <td style="text-align:right;font-size:11px;font-weight:600">${fmtCurrency((i.picked_qty || i.qty) * i.price)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <div class="po-cart-summary" style="margin-top:12px;border-top:2px solid var(--bd)">
          <div class="po-cart-sum-row"><span>Subtotal (excl. GST)</span><span>${fmtCurrency(sub)}</span></div>
          <div class="po-cart-sum-row"><span>GST (10%)</span><span>${fmtCurrency(gst)}</span></div>
          <div class="po-cart-sum-row total"><span>Total (incl. GST)</span><span>${fmtCurrency(total)}</span></div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;justify-content:center">
        <button class="btn btn-outline" onclick="window.print()">Print</button>
        <button class="btn btn-primary" onclick="PurchaseSection.doSendInvoice('${esc(data.order_id)}')">Send Invoice</button>
      </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ──── 22. WH INVOICES ────
let _whInvoices = [];
let _whInvFilter = 'all';

function renderWhInvoices() {
  return whShell(`
    ${SPG.toolbar('Invoices')}
    <div class="content">
      <div class="po-filter-chips" id="po-wh-inv-chips">
        <button class="po-cat-chip active" onclick="PurchaseSection.setWhInvFilter('all')">All</button>
        <button class="po-cat-chip" onclick="PurchaseSection.setWhInvFilter('draft')">Draft</button>
        <button class="po-cat-chip" onclick="PurchaseSection.setWhInvFilter('sent')">Sent</button>
        <button class="po-cat-chip" onclick="PurchaseSection.setWhInvFilter('paid')">Paid</button>
      </div>
      <div id="po-wh-inv-list">${SPG.ui.skeleton(70, 5)}</div>
    </div>`, 'wh-invoices');
}

async function loadWhInvoices() {
  try {
    const data = await po('po_get_wh_invoices');
    _whInvoices = data.invoices || [];
    renderWhInvoicesList();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function setWhInvFilter(f) {
  _whInvFilter = f;
  document.querySelectorAll('#po-wh-inv-chips .po-cat-chip').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('#po-wh-inv-chips .po-cat-chip').forEach(el => { if (el.textContent.toLowerCase() === f || (f === 'all' && el.textContent === 'All')) el.classList.add('active'); });
  renderWhInvoicesList();
}

function renderWhInvoicesList() {
  const el = document.getElementById('po-wh-inv-list');
  if (!el) return;
  let list = _whInvoices;
  if (_whInvFilter !== 'all') list = list.filter(inv => inv.status === _whInvFilter);
  if (!list.length) { el.innerHTML = SPG.ui.empty('🧾', 'No invoices found'); return; }
  el.innerHTML = list.map(inv => `
    <div class="po-order-card" onclick="SPG.go('purchase/wh-invoice-detail',{id:'${esc(inv.invoice_id)}'})">
      <div class="po-order-card-top">
        <span class="po-order-id">${esc(inv.invoice_id)}</span>
        ${poBadge(inv.status)}
      </div>
      <div class="po-order-card-mid">
        <span>Store: ${esc(inv.store_id || '-')}</span>
        <span class="po-order-total">${fmtCurrency(inv.total_inc_gst)}</span>
      </div>
      <div class="po-order-card-bot">Order: ${esc(inv.order_id || '-')} · ${fmtDate(inv.created_at)}</div>
    </div>`).join('');
}


// ──── 23. WH INVOICE DETAIL ────
function renderWhInvoiceDetail(p) {
  return whShell(`
    ${SPG.toolbar('Invoice Detail', `<button class="btn btn-outline btn-sm" onclick="SPG.go('purchase/wh-invoices')">← Back</button>`)}
    <div class="content" id="po-wh-inv-detail">${SPG.ui.skeleton(300)}</div>`, 'wh-invoices');
}

async function loadWhInvoiceDetail(p) {
  try {
    const data = await po('po_get_wh_invoice_detail', { invoice_id: p?.id });
    const el = document.getElementById('po-wh-inv-detail');
    if (!el) return;

    const items = data.items || [];
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div>
          <div style="font-size:15px;font-weight:700">${esc(data.invoice_id)}</div>
          <div style="font-size:11px;color:var(--t3)">Order: ${esc(data.order_id || '-')} · ${fmtDate(data.created_at)}</div>
        </div>
        ${poBadge(data.status)}
      </div>
      <div class="po-od-section">
        <div class="po-od-label">Store</div>
        <div class="po-od-value">${esc(data.store_id || '-')}</div>
      </div>
      <div class="po-od-items">
        ${items.map(i => `<div class="po-od-item">
          <div class="po-od-item-name">${esc(i.product_name)}</div>
          <div class="po-od-item-meta">${i.qty} x ${fmtCurrency(i.price)} / ${esc(i.unit || 'ea')}</div>
          <div class="po-od-item-total">${fmtCurrency(i.qty * i.price)}</div>
        </div>`).join('')}
      </div>
      <div class="po-cart-summary" style="margin-top:12px">
        <div class="po-cart-sum-row"><span>Subtotal</span><span>${fmtCurrency(data.subtotal)}</span></div>
        <div class="po-cart-sum-row"><span>GST (10%)</span><span>${fmtCurrency(data.gst)}</span></div>
        <div class="po-cart-sum-row total"><span>Total</span><span>${fmtCurrency(data.total_inc_gst)}</span></div>
      </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ──── 24. WH STOCK ────
let _whStockItems = [];
let _whStockCategory = '';

function renderWhStock() {
  return whShell(`
    ${SPG.toolbar('Warehouse Stock')}
    <div class="content">
      <input class="inp" id="po-wh-stock-search" placeholder="Search products..." oninput="PurchaseSection.filterWhStock()" style="margin-bottom:8px">
      <div class="po-cat-filters" id="po-wh-stock-cats"></div>
      <div id="po-wh-stock-list">${SPG.ui.skeleton(50, 6)}</div>
    </div>`, 'wh-stock');
}

async function loadWhStock() {
  try {
    const data = await po('po_get_wh_stock');
    _whStockItems = data.items || [];
    const cats = [...new Set(_whStockItems.map(i => i.category).filter(Boolean))];
    const catsEl = document.getElementById('po-wh-stock-cats');
    if (catsEl && cats.length) {
      catsEl.innerHTML = `<button class="po-cat-chip active" onclick="PurchaseSection.setWhStockCat('')">All</button>` +
        cats.map(c => `<button class="po-cat-chip" onclick="PurchaseSection.setWhStockCat('${esc(c)}')">${esc(c)}</button>`).join('');
    }
    renderWhStockList(_whStockItems);
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function setWhStockCat(cat) {
  _whStockCategory = cat;
  document.querySelectorAll('#po-wh-stock-cats .po-cat-chip').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('#po-wh-stock-cats .po-cat-chip').forEach(el => { if ((cat === '' && el.textContent === 'All') || el.textContent === cat) el.classList.add('active'); });
  filterWhStock();
}

function filterWhStock() {
  const q = (document.getElementById('po-wh-stock-search')?.value || '').toLowerCase();
  let filtered = _whStockItems;
  if (_whStockCategory) filtered = filtered.filter(i => i.category === _whStockCategory);
  if (q) filtered = filtered.filter(i => (i.product_name || '').toLowerCase().includes(q));
  renderWhStockList(filtered);
}

function renderWhStockList(list) {
  const el = document.getElementById('po-wh-stock-list');
  if (!el) return;
  if (!list.length) { el.innerHTML = SPG.ui.empty('📊', 'No stock data'); return; }
  el.innerHTML = `<table class="tbl" style="width:100%">
    <thead><tr>
      ${SPG.ui.sortTh('po-wh-stock', 'product_name', 'Product')}
      ${SPG.ui.sortTh('po-wh-stock', 'category', 'Category')}
      ${SPG.ui.sortTh('po-wh-stock', 'current_qty', 'Qty', ' style="text-align:right"')}
      ${SPG.ui.sortTh('po-wh-stock', 'location', 'Location')}
      <th>Status</th>
    </tr></thead>
    <tbody>${list.map(i => {
      const level = i.current_qty <= (i.min_level || 0) ? 'low' : i.current_qty <= (i.reorder_level || 0) ? 'medium' : 'ok';
      const levelBadge = level === 'low' ? SPG.ui.badge('fail', 'Low') : level === 'medium' ? SPG.ui.badge('pending', 'Reorder') : SPG.ui.badge('active', 'OK');
      return `<tr>
        <td style="font-weight:600;font-size:12px">${esc(i.product_name)}</td>
        <td style="font-size:11px;color:var(--t3)">${esc(i.category || '-')}</td>
        <td style="text-align:right;font-weight:600">${i.current_qty} ${esc(i.unit || '')}</td>
        <td style="font-size:11px">${esc(i.location || '-')}</td>
        <td>${levelBadge}</td>
      </tr>`;
    }).join('')}</tbody></table>`;
}


// ──── 25. WH TRANSFERS ────
let _whTransfers = [];

function renderWhTransfers() {
  return whShell(`
    ${SPG.toolbar('Transfer Records')}
    <div class="content" id="po-wh-transfers">${SPG.ui.skeleton(70, 5)}</div>`, 'wh-transfers');
}

async function loadWhTransfers() {
  try {
    const data = await po('po_get_wh_transfers');
    _whTransfers = data.transfers || [];
    const el = document.getElementById('po-wh-transfers');
    if (!el) return;
    if (!_whTransfers.length) { el.innerHTML = SPG.ui.empty('🔄', 'No transfers'); return; }
    el.innerHTML = `<table class="tbl" style="width:100%">
      <thead><tr>
        <th>ID</th><th>From</th><th>To</th><th>Items</th><th>Date</th><th>Status</th>
      </tr></thead>
      <tbody>${_whTransfers.map(t => `<tr>
        <td style="font-weight:600;font-size:11px">${esc(t.transfer_id)}</td>
        <td style="font-size:11px">${esc(t.from_location || '-')}</td>
        <td style="font-size:11px">${esc(t.to_location || '-')}</td>
        <td style="font-size:11px">${t.item_count || 0}</td>
        <td style="font-size:11px">${fmtDate(t.created_at)}</td>
        <td>${poBadge(t.status)}</td>
      </tr>`).join('')}</tbody></table>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ──── 26. WH NOTIFICATIONS ────
function renderWhNotifications() {
  return whShell(`
    ${SPG.toolbar('Notifications')}
    <div class="content" id="po-wh-notif-list">${SPG.ui.skeleton(60, 5)}</div>`, 'wh-notifications');
}

function loadWhNotifications() {
  const el = document.getElementById('po-wh-notif-list');
  if (!el) return;
  const notifs = _whDashboard?.notifications || _initData?.notifications || [];
  if (!notifs.length) { el.innerHTML = SPG.ui.empty('🔔', 'No notifications'); return; }
  el.innerHTML = notifs.map(n => `
    <div class="po-notif-card${n.read ? '' : ' unread'}">
      <div class="po-notif-title">${esc(n.title)}</div>
      <div class="po-notif-body">${esc(n.body)}</div>
      <div class="po-notif-time">${fmtDateTime(n.created_at)}</div>
    </div>`).join('');
}


// ──── 27. WH PROFILE ────
function renderWhProfile() {
  const s = api.getSession();
  if (!s) return SPG.go('login');

  return whShell(`
    ${SPG.toolbar('Profile')}
    <div class="content">
      <div class="card max-w-sm">
        <div class="profile-header">
          <div class="profile-avatar" style="background:var(--blue-bg);color:var(--blue)">${esc((s.display_name || '?').charAt(0).toUpperCase())}</div>
          <div>
            <div class="profile-name">${esc(s.display_name)}</div>
            <div class="profile-meta">${esc(s.position_name || s.tier_id)} · ${esc(s.store_id || 'Warehouse')}</div>
          </div>
        </div>
        <div class="po-profile-links">
          <div class="po-profile-link" onclick="SPG.go('purchase/wh-notifications')">🔔 Notifications</div>
          <div class="po-profile-link" onclick="SPG.go('purchase/wh-stock')">📊 Stock Overview</div>
          <div class="po-profile-link" onclick="SPG.go('purchase/wh-transfers')">🔄 Transfers</div>
          <div class="po-profile-link" onclick="SPG.go('profile')">👤 Edit Profile</div>
          <div class="po-profile-link" onclick="SPG.go('purchase/wh-home')">◇ Warehouse Home</div>
        </div>
      </div>
    </div>`, 'wh-profile');
}


// ══════════════════════════════════════════════
//   SORT LISTENER
// ══════════════════════════════════════════════
document.addEventListener('spg-sort', (e) => {
  const tid = e.detail?.tableId;
  const st = SPG.ui.getSortState(tid);
  if (!st) return;
  if (tid === 'po-stock') { renderStockList(SPG.ui.sortData(_stockItems, st.key, st.dir)); }
  if (tid === 'po-wh-stock') { renderWhStockList(SPG.ui.sortData(_whStockItems, st.key, st.dir)); }
});


// ══════════════════════════════════════════════
//   INJECT STYLES
// ══════════════════════════════════════════════
const poStyles = document.createElement('style');
poStyles.textContent = `
/* ── Store Tab Bar ── */
.po-tabbar{position:fixed;bottom:0;left:0;right:0;display:flex;background:var(--bg);border-top:1px solid var(--bd2);z-index:90;padding:4px 0 env(safe-area-inset-bottom)}
.po-tab{flex:1;display:flex;flex-direction:column;align-items:center;padding:6px 0;cursor:pointer;color:var(--t3);font-size:9px;transition:color .15s}
.po-tab.active{color:var(--acc)}
.po-tab-icon{font-size:18px;line-height:1}
.po-tab-label{margin-top:2px}
.po-store-shell{padding-bottom:60px}

/* ── Warehouse Nav ── */
.po-wh-shell{display:flex;flex-direction:column;height:100%}
.po-wh-body{display:flex;flex:1;overflow:hidden}
.po-wh-nav{width:200px;background:var(--bg2);border-right:1px solid var(--bd2);padding:8px 0;overflow-y:auto;flex-shrink:0}
.po-wh-nav-item{display:flex;align-items:center;gap:8px;padding:10px 16px;cursor:pointer;font-size:12px;color:var(--t2);transition:background .15s}
.po-wh-nav-item:hover{background:var(--bg3)}
.po-wh-nav-item.active{background:var(--acc2);color:var(--acc);font-weight:600}
.po-wh-nav-icon{font-size:16px;width:20px;text-align:center}
.po-wh-nav-label{}
.po-wh-main{flex:1;overflow-y:auto}
@media(max-width:768px){.po-wh-nav{display:none}.po-wh-main{width:100%}}

/* ── Quick Actions ── */
.po-quick-actions{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px}
.po-action-card{background:var(--bg);border:1px solid var(--bd2);border-radius:var(--rd);padding:16px;text-align:center;cursor:pointer;transition:border-color .15s;position:relative}
.po-action-card:hover{border-color:var(--acc)}
.po-action-icon{font-size:24px;margin-bottom:6px}
.po-action-label{font-size:12px;font-weight:600;color:var(--t1)}
.po-action-badge{position:absolute;top:8px;right:8px;background:var(--red);color:#fff;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center;padding:0 4px}

/* ── Order Cards ── */
.po-order-card{background:var(--bg);border:1px solid var(--bd2);border-radius:var(--rd);padding:12px;margin-bottom:8px;cursor:pointer;transition:border-color .15s}
.po-order-card:hover{border-color:var(--acc)}
.po-order-card-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.po-order-id{font-weight:700;font-size:13px;color:var(--acc)}
.po-order-card-mid{display:flex;justify-content:space-between;font-size:12px;color:var(--t2)}
.po-order-total{font-weight:700}
.po-order-card-bot{font-size:10px;color:var(--t3);margin-top:4px}

/* ── Supplier Grid ── */
.po-sup-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.po-sup-card{background:var(--bg);border:1px solid var(--bd2);border-radius:var(--rd);padding:14px;text-align:center;cursor:pointer;transition:border-color .15s}
.po-sup-card:hover{border-color:var(--acc)}
.po-sup-avatar{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:#fff;margin:0 auto 8px}
.po-sup-name{font-size:13px;font-weight:600;color:var(--t1)}
.po-sup-meta{font-size:10px;color:var(--t3);margin-top:2px}

/* ── Catalog Chips ── */
.po-cat-filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.po-cat-chip{background:var(--bg2);border:1px solid var(--bd2);border-radius:20px;padding:4px 12px;font-size:11px;cursor:pointer;color:var(--t2);transition:all .15s}
.po-cat-chip.active{background:var(--acc);color:#fff;border-color:var(--acc)}
.po-filter-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}

/* ── Product Grid ── */
.po-product-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
.po-prod-card{background:var(--bg);border:1px solid var(--bd2);border-radius:var(--rd);overflow:hidden;cursor:pointer;transition:border-color .15s;position:relative}
.po-prod-card:hover{border-color:var(--acc)}
.po-prod-img{height:100px;background:var(--bg2);display:flex;align-items:center;justify-content:center;overflow:hidden}
.po-prod-img img{width:100%;height:100%;object-fit:cover}
.po-prod-img-ph{font-size:32px;color:var(--t4)}
.po-prod-info{padding:8px 10px}
.po-prod-name{font-size:12px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.po-prod-meta{font-size:10px;color:var(--t3);margin-top:2px}
.po-prod-price{font-size:13px;font-weight:700;color:var(--acc);margin-top:4px}
.po-prod-add{position:absolute;bottom:8px;right:8px;width:28px;height:28px;border-radius:50%;background:var(--acc);color:#fff;border:none;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;box-shadow:0 2px 6px rgba(0,0,0,.15)}
.po-prod-cart-badge{position:absolute;top:6px;right:6px;background:var(--acc);color:#fff;font-size:10px;font-weight:700;min-width:18px;height:18px;border-radius:9px;display:flex;align-items:center;justify-content:center}

/* ── Product Detail ── */
.po-pd-body{padding:16px}
.po-pd-name{font-size:18px;font-weight:700;margin-bottom:4px}
.po-pd-meta{font-size:12px;color:var(--t3);margin-bottom:8px}
.po-pd-price{font-size:20px;font-weight:700;color:var(--acc);margin-bottom:8px}
.po-pd-desc{font-size:12px;color:var(--t2);line-height:1.6;margin-bottom:12px}
.po-pd-stock{font-size:11px;color:var(--t3);display:flex;gap:16px;margin-bottom:12px}
.po-pd-qty{display:flex;align-items:center;gap:8px;justify-content:center}
.po-qty-btn{width:36px;height:36px;border-radius:50%;border:1px solid var(--bd2);background:var(--bg);font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.po-qty-input{width:60px;text-align:center;font-size:16px;font-weight:700;border:1px solid var(--bd2);border-radius:var(--rd);padding:6px}

/* ── Cart ── */
.po-cart-fab{position:fixed;bottom:70px;right:16px;background:var(--acc);color:#fff;border-radius:50px;padding:10px 16px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.2);z-index:80;display:flex;align-items:center;gap:6px}
.po-cart-fab-count{background:#fff;color:var(--acc);font-size:11px;font-weight:700;min-width:20px;height:20px;border-radius:10px;display:flex;align-items:center;justify-content:center}
.po-cart-group{margin-bottom:16px}
.po-cart-group-header{font-size:12px;font-weight:700;color:var(--t1);padding:8px 0;border-bottom:1px solid var(--bd2)}
.po-cart-item{display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--bd2)}
.po-cart-item-info{flex:1;min-width:0}
.po-cart-item-name{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.po-cart-item-price{font-size:10px;color:var(--t3)}
.po-cart-item-qty{display:flex;align-items:center;gap:6px}
.po-qty-btn-sm{width:24px;height:24px;border-radius:50%;border:1px solid var(--bd2);background:var(--bg);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.po-cart-qty-val{font-size:13px;font-weight:700;min-width:20px;text-align:center}
.po-cart-item-total{font-size:12px;font-weight:700;min-width:60px;text-align:right}
.po-cart-item-remove{background:none;border:none;color:var(--red);font-size:18px;cursor:pointer;padding:0 4px}
.po-cart-summary{border-top:1px solid var(--bd2);padding-top:12px}
.po-cart-sum-row{display:flex;justify-content:space-between;font-size:12px;padding:4px 0;color:var(--t2)}
.po-cart-sum-row.total{font-size:14px;font-weight:700;color:var(--t1);border-top:1px solid var(--bd);padding-top:8px;margin-top:4px}

/* ── Order Detail ── */
.po-od-section{margin-bottom:12px}
.po-od-label{font-size:10px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.po-od-value{font-size:13px;color:var(--t1)}
.po-od-items{border:1px solid var(--bd2);border-radius:var(--rd);overflow:hidden}
.po-od-item{display:flex;align-items:center;padding:8px 10px;border-bottom:1px solid var(--bd2)}
.po-od-item:last-child{border-bottom:none}
.po-od-item-name{flex:1;font-size:12px;font-weight:600}
.po-od-item-meta{font-size:10px;color:var(--t3);margin:0 8px}
.po-od-item-total{font-size:12px;font-weight:700}

/* ── Timeline ── */
.po-timeline{display:flex;align-items:center;justify-content:center;margin:16px 0;flex-wrap:wrap;gap:0}
.po-tl-step{display:flex;flex-direction:column;align-items:center;min-width:60px}
.po-tl-dot{width:16px;height:16px;border-radius:50%;background:var(--bd2);border:2px solid var(--bd2);margin-bottom:4px}
.po-tl-step.done .po-tl-dot{background:var(--green);border-color:var(--green)}
.po-tl-step.active .po-tl-dot{background:var(--acc);border-color:var(--acc);box-shadow:0 0 0 3px var(--acc2)}
.po-tl-label{font-size:9px;color:var(--t3)}
.po-tl-step.done .po-tl-label{color:var(--green)}
.po-tl-step.active .po-tl-label{color:var(--acc);font-weight:600}
.po-tl-line{width:24px;height:2px;background:var(--bd2);margin-bottom:18px}
.po-tl-step.done+.po-tl-line{background:var(--green)}

/* ── Receive Check ── */
.po-rc-items{border:1px solid var(--bd2);border-radius:var(--rd);overflow:hidden}
.po-rc-item{display:flex;align-items:center;gap:8px;padding:10px;border-bottom:1px solid var(--bd2)}
.po-rc-item:last-child{border-bottom:none}
.po-rc-item-info{flex:1}
.po-rc-item-input{display:flex;flex-direction:column;align-items:center}
.po-rc-item-check{display:flex;flex-direction:column;align-items:center}

/* ── Invoice Capture ── */
.po-ic-upload{display:flex;flex-direction:column;align-items:center;justify-content:center;border:2px dashed var(--bd2);border-radius:var(--rd);padding:40px 20px;cursor:pointer;transition:border-color .15s}
.po-ic-upload:hover{border-color:var(--acc)}
.po-ic-icon{font-size:48px;margin-bottom:8px}
.po-ic-text{font-size:13px;color:var(--t3)}

/* ── Invoice Review Lines ── */
.po-inv-lines{border:1px solid var(--bd2);border-radius:var(--rd);overflow:hidden}
.po-inv-line{padding:8px 10px;border-bottom:1px solid var(--bd2);padding-left:14px}
.po-inv-line:last-child{border-bottom:none}

/* ── Invoice Document ── */
.po-inv-doc{background:var(--bg);border:1px solid var(--bd2);border-radius:var(--rd);padding:24px;max-width:600px;margin:0 auto}
.po-inv-doc-header{text-align:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid var(--t1)}
.po-inv-doc-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;margin-bottom:12px}

/* ── Pick Items ── */
.po-pick-items{border:1px solid var(--bd2);border-radius:var(--rd);overflow:hidden}
.po-pick-item{display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--bd2)}
.po-pick-item:last-child{border-bottom:none}
.po-pick-item-info{flex:1}
.po-pick-item-qty{display:flex;flex-direction:column;align-items:center}

/* ── WH Metrics ── */
.po-wh-metrics{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.po-wh-metric{background:var(--bg);border:1px solid var(--bd2);border-radius:var(--rd);padding:16px;text-align:center;cursor:pointer;transition:border-color .15s}
.po-wh-metric:hover{border-color:var(--acc)}
.po-wh-metric-val{font-size:24px;font-weight:700;color:var(--acc)}
.po-wh-metric-label{font-size:11px;color:var(--t3);margin-top:4px}

/* ── WH Activity ── */
.po-wh-activity-row{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--bd2)}
.po-wh-activity-row:last-child{border-bottom:none}
.po-wh-activity-dot{width:8px;height:8px;border-radius:50%;margin-top:4px;flex-shrink:0}

/* ── Notifications ── */
.po-notif-card{padding:12px;border-bottom:1px solid var(--bd2);cursor:default}
.po-notif-card.unread{background:var(--acc2)}
.po-notif-title{font-size:13px;font-weight:600;margin-bottom:2px}
.po-notif-body{font-size:11px;color:var(--t2);line-height:1.5}
.po-notif-time{font-size:10px;color:var(--t3);margin-top:4px}

/* ── Profile Links ── */
.po-profile-links{margin-top:16px}
.po-profile-link{padding:12px 0;border-bottom:1px solid var(--bd2);font-size:13px;cursor:pointer;color:var(--t1);transition:color .15s}
.po-profile-link:hover{color:var(--acc)}
.po-profile-link:last-child{border-bottom:none}
`;
document.head.appendChild(poStyles);


// ══════════════════════════════════════════════
//   REGISTER SECTION
// ══════════════════════════════════════════════
SPG.section('purchase', {
  defaultRoute: 'home',
  routes: {
    // Store routes
    'home':            { render: renderHome,            onLoad: loadHome },
    'suppliers':       { render: renderSuppliers,       onLoad: loadSuppliers },
    'catalog':         { render: renderCatalog,         onLoad: loadCatalog },
    'product':         { render: renderProduct,         onLoad: loadProduct },
    'cart':            { render: renderCart,             onLoad: loadCart },
    'confirmed':       { render: renderConfirmed },
    'orders':          { render: renderOrders,          onLoad: loadOrders },
    'order-detail':    { render: renderOrderDetail,     onLoad: loadOrderDetail },
    'receive':         { render: renderReceive,         onLoad: loadReceive },
    'receive-check':   { render: renderReceiveCheck,    onLoad: loadReceiveCheck },
    'invoice-capture': { render: renderInvoiceCapture },
    'invoice-review':  { render: renderInvoiceReview,   onLoad: loadInvoiceReview },
    'stock':           { render: renderStock,           onLoad: loadStock },
    'notifications':   { render: renderNotifications,   onLoad: loadNotifications },
    'profile':         { render: renderProfile },

    // Warehouse routes
    'wh-home':           { render: renderWhHome,           onLoad: loadWhHome },
    'wh-incoming':       { render: renderWhIncoming,       onLoad: loadWhIncoming },
    'wh-pick-list':      { render: renderWhPickList,       onLoad: loadWhPickList },
    'wh-pick-detail':    { render: renderWhPickDetail,     onLoad: loadWhPickDetail },
    'wh-invoice-gen':    { render: renderWhInvoiceGen,     onLoad: loadWhInvoiceGen },
    'wh-invoice-preview':{ render: renderWhInvoicePreview, onLoad: loadWhInvoicePreview },
    'wh-invoices':       { render: renderWhInvoices,       onLoad: loadWhInvoices },
    'wh-invoice-detail': { render: renderWhInvoiceDetail,  onLoad: loadWhInvoiceDetail },
    'wh-stock':          { render: renderWhStock,          onLoad: loadWhStock },
    'wh-transfers':      { render: renderWhTransfers,      onLoad: loadWhTransfers },
    'wh-notifications':  { render: renderWhNotifications,  onLoad: loadWhNotifications },
    'wh-profile':        { render: renderWhProfile },
  },
});


// ══════════════════════════════════════════════
//   PUBLIC API
// ══════════════════════════════════════════════
window.PurchaseSection = {
  // Suppliers
  filterSuppliers, selectSupplier,
  // Catalog
  filterCatalog, setCatalogCategory, quickAdd,
  // Product detail
  pdQty, pdAddToCart,
  // Cart
  cartQty, cartRemove, doClearCart, confirmClearCart, doSubmitOrder,
  // Orders
  setOrderFilter, cancelOrder, confirmCancel,
  // Receive
  doConfirmReceive,
  // Invoice
  onInvoiceFile, retakeInvoice, doUploadInvoice,
  // Stock
  filterStock,
  // Warehouse
  doCompletePick, doSendInvoice,
  setWhInvFilter, setWhStockCat, filterWhStock,
  // Helpers (for debug)
  getCart, clearCart,
};

})();
