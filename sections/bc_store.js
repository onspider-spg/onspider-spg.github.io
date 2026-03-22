/**
 * SPG HUB v1.0.0 | 22 MAR 2026 | Siam Palette Group
 * sections/bc_store.js — Store Screens (9 pages)
 * Dashboard, Browse, Cart, Orders, Order Detail, Quota, Stock, Waste, Returns
 *
 * Depends on: bc_core.js (BK global)
 * Design: Pink #db2777 accent, matches Home layout via SPG.shell/toolbar
 */

(() => {
const esc = SPG.esc;
const S = BK.S;

// ═══════════════════════════════════════
// 1. DASHBOARD
// ═══════════════════════════════════════
BK.renderDashboard = function(p) {
  const s = SPG.api.getSession();
  if (!s) return SPG.shell('<div class="content">Loading...</div>', 'Bakery');

  // Role-based: BC gets bc-dashboard
  if (S.role === 'bc') {
    return typeof BK.renderBcDashboard === 'function'
      ? BK.renderBcDashboard(p)
      : SPG.shell(SPG.toolbar('BC Dashboard') + '<div class="content">Loading BC Dashboard...</div>', 'Bakery');
  }

  return SPG.shell(SPG.toolbar('Dashboard') + `
    <div class="content">
      <div style="margin-bottom:20px">
        <div style="font-size:16px;font-weight:900;letter-spacing:-.5px;margin-bottom:4px" class="grad-text">Welcome, ${esc(s.display_name || s.display_label)}</div>
        <div style="font-size:11px;color:var(--t3)">${esc(s.position_id ? s.position_name : s.tier_id)} · ${esc(BK.getStoreName(s.store_id))} · ${esc(s.dept_id || '')}</div>
      </div>

      <div id="dash-kpi" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px">
        ${SPG.ui.skeleton(60, 3)}
      </div>

      <div class="sec-title">Quick Actions</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px">
        ${_qCard('Create Order', S.cart.length > 0 ? 'Continue (' + S.cart.length + ')' : 'New order', "BakerySection.goToBrowse()")}
        ${_qCard('View Orders', 'Check status', "SPG.go('bakery/orders')")}
        ${_qCard('Set Quota', '7-day quota', "SPG.go('bakery/quota')")}
        ${_qCard('Stock History', 'Past entries', "SPG.go('bakery/stock-history')")}
      </div>

      <div class="sec-title">Records</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${_qCard('Waste Log', 'Record waste', "SPG.go('bakery/waste')")}
        ${_qCard('Returns', 'Report returns', "SPG.go('bakery/returns')")}
      </div>

      <div id="dash-recent" style="margin-top:20px"></div>
    </div>`, 'Bakery');
};

function _qCard(title, sub, onclick) {
  return `<div class="card" style="cursor:pointer;padding:14px" onclick="${onclick}">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-size:13px;font-weight:700">${esc(title)}</div><div style="font-size:10px;color:var(--t3);margin-top:2px">${esc(sub)}</div></div>
      <span style="color:var(--t3);font-size:14px">›</span>
    </div>
  </div>`;
}

BK.loadDashboard = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  // Role redirect for BC
  if (S.role === 'bc') {
    if (typeof BK.loadBcDashboard === 'function') BK.loadBcDashboard(p);
    return;
  }

  // Load dashboard data
  if (S._dashPreloaded) {
    S._dashPreloaded = false;
    _fillDashboard();
    return;
  }
  try {
    const data = await BK.api('get_dashboard');
    S.dashboard = data;
    _fillDashboard();
  } catch (e) { console.error('Dashboard load:', e); }
};

function _fillDashboard() {
  const el = document.getElementById('dash-kpi');
  if (!el) return;
  const d = S.dashboard;
  const bs = d?.by_status || {};
  el.innerHTML = `
    ${_kpiCard('Pending', bs.Pending || 0, 'var(--orange)')}
    ${_kpiCard('In Progress', bs.InProgress || bs.Ordered || 0, 'var(--theme, #db2777)')}
    ${_kpiCard('Delivered', bs.Delivered || bs.Fulfilled || 0, 'var(--green)')}`;

  // Recent orders
  const recent = document.getElementById('dash-recent');
  if (recent && d?.recent_orders?.length) {
    recent.innerHTML = `<div class="sec-title">Recent Orders</div>` +
      d.recent_orders.slice(0, 5).map(o => `
        <div class="card" style="padding:10px 14px;margin-bottom:6px;cursor:pointer" onclick="SPG.go('bakery/order-detail',{id:'${esc(o.order_id)}'})">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><div style="font-size:12px;font-weight:600">${esc(o.order_id)}</div><div style="font-size:10px;color:var(--t3)">${BK.fmtDateAU(o.delivery_date)} · ${esc(o.item_count || '?')} items</div></div>
            ${SPG.ui.badge(o.status)}
          </div>
        </div>`).join('');
  }
}

function _kpiCard(label, count, color) {
  return `<div class="card" style="text-align:center;padding:14px">
    <div style="font-size:24px;font-weight:900;color:${color}">${count}</div>
    <div style="font-size:10px;color:var(--t3);margin-top:2px">${label}</div>
  </div>`;
}


// ═══════════════════════════════════════
// 2. BROWSE PRODUCTS
// ═══════════════════════════════════════
BK.renderBrowse = function(p) {
  const dd = S.deliveryDate || BK.tomorrowSydney();
  const isEdit = !!S.editingOrderId;

  const editBanner = isEdit ? `<div class="card" style="background:var(--orange-bg,#fff7ed);border-color:var(--orange);padding:10px 14px;margin-bottom:8px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-size:12px;font-weight:700;color:var(--orange)">Editing ${esc(S.editingOrderId)}</div><div style="font-size:10px;color:var(--orange)">Modify items and submit</div></div>
      <button class="btn btn-sm btn-outline" style="color:var(--orange);border-color:var(--orange)" onclick="BakerySection.cancelEditMode()">Cancel</button>
    </div>
  </div>` : '';

  const resumeBar = !isEdit && (S.cart.length > 0 || Object.keys(S.stockInputs).length > 0)
    ? `<div class="card" style="background:var(--theme-bg,#fce7f3);padding:8px 14px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;font-weight:600">Cart: ${S.cart.length} items</span>
          <button class="btn btn-sm btn-outline" onclick="BakerySection.startOrder()">Clear</button>
        </div>
      </div>` : '';

  return SPG.shell(SPG.toolbar(isEdit ? 'Edit Order' : 'Create Order') + `
    <div class="content">
      ${editBanner}${resumeBar}
      <div style="display:flex;gap:6px;margin-bottom:10px;align-items:center;flex-wrap:wrap">
        <span style="font-size:11px;color:var(--t3);font-weight:600">Deliver:</span>
        <span style="font-size:12px;font-weight:700">${BK.fmtDateAU(dd)}</span>
        <input type="date" id="bk-date" value="${dd}" min="${BK.todaySydney()}" style="font-size:11px;padding:4px 8px;border:1px solid var(--bd);border-radius:var(--rd);background:var(--bg)" onchange="BakerySection.changeDate(this.value)">
      </div>
      <div style="margin-bottom:10px">
        <input class="inp" placeholder="Search products..." value="${esc(S.productSearch)}" oninput="BakerySection.setProductSearch(this.value)" style="font-size:12px;padding:8px 12px">
      </div>
      <div id="bk-cat-chips" style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;overflow-x:auto"></div>
      <div id="bk-product-list">${SPG.ui.skeleton(80, 4)}</div>
      <div id="bk-cart-footer" style="display:none;position:sticky;bottom:0;padding:10px;background:var(--bg);border-top:1px solid var(--bd)">
        <button class="btn btn-primary btn-full" onclick="SPG.go('bakery/cart')">View Cart (<span id="bk-cart-count">0</span>) →</button>
      </div>
    </div>`, 'Bakery');
};

// Search setter — exposed via BakerySection
function _setProductSearch(val) {
  S.productSearch = val;
  _dFilterProducts();
}

BK.loadBrowse = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  if (!S.deliveryDate) S.deliveryDate = BK.tomorrowSydney();
  const d = new Date(S.deliveryDate + 'T00:00:00');
  const dow = d.getDay();

  // Products + Quotas
  if (S._prodsLoaded && S._quotasDay === dow) {
    _fillBrowse();
    return;
  }

  if (S._prodsLoaded && S._quotasDay !== dow) {
    try {
      const qd = await BK.api('get_quotas', { day: String(dow) });
      const flat = {};
      for (const pid in qd) {
        // qd[pid] can be flat number or nested {0:x,1:y,...} — handle both
        const val = qd[pid];
        flat[pid] = (typeof val === 'object' && val !== null) ? (val[dow] ?? 0) : (val ?? 0);
      }
      S.quotas = flat;
      S._quotasDay = dow;
    } catch (e) { console.error('Quota load:', e); }
    _fillBrowse();
    return;
  }

  // Full bundle
  if (S._prodsLoading) return;
  S._prodsLoading = true;
  try {
    const data = await BK.api('init_browse', { day: String(dow) });
    S.products = BK.normalizeProducts((data.products || []).sort((a, b) => (a.product_name || '').localeCompare(b.product_name || '')));
    S._prodsLoaded = true;
    S.quotas = data.quotas || {};
    S._quotasDay = dow;
  } finally { S._prodsLoading = false; }
  _fillBrowse();
};

function _fillBrowse() {
  // Category chips
  const chipEl = document.getElementById('bk-cat-chips');
  if (chipEl) {
    const f = S.productFilter;
    chipEl.innerHTML = `<button class="btn btn-sm${f === 'all' ? ' btn-primary' : ' btn-outline'}" onclick="BakerySection.filterCat('all')">All</button>` +
      S.categories.map(c => `<button class="btn btn-sm${f === c.cat_id ? ' btn-primary' : ' btn-outline'}" onclick="BakerySection.filterCat('${c.cat_id}')">${esc(c.cat_name)}</button>`).join('');
  }
  _filterProducts();
}

function _filterProducts() {
  const el = document.getElementById('bk-product-list');
  if (!el) return;
  const prods = S.products;
  if (!prods.length) { el.innerHTML = SPG.ui.empty('📦', 'No products found'); return; }

  const search = (S.productSearch || '').toLowerCase();
  const catFilter = S.productFilter;
  let filtered = prods;
  if (catFilter !== 'all') filtered = filtered.filter(p => p.cat_id === catFilter);
  if (search) filtered = filtered.filter(p => (p.product_name || '').toLowerCase().includes(search));
  if (!filtered.length) { el.innerHTML = SPG.ui.empty('🔍', 'No products match', 'Try a different search'); return; }

  const sp = BK.getStockPoints();
  const quotas = S.quotas || {};
  el.innerHTML = filtered.map(p => _productCard(p, sp, quotas[p.product_id])).join('');
  _updateCartFooter();
}

let _dfpTimer = null;
function _dFilterProducts() { clearTimeout(_dfpTimer); _dfpTimer = setTimeout(_filterProducts, 250); }

function _productCard(p, sp, quotaVal) {
  const cart = BK.getCartItem(p.product_id);
  const qty = cart ? cart.qty : 0;
  const pid = p.product_id;
  const qDisplay = quotaVal != null ? quotaVal : '—';
  const stockVal = S.stockInputs[pid];

  let stockHtml;
  if (sp === 2) {
    const v1 = stockVal?.s1 ?? '';
    const v2 = stockVal?.s2 ?? '';
    stockHtml = `<div style="display:flex;gap:4px">
      <input type="number" step="any" class="inp" style="width:50px;padding:4px;font-size:11px;text-align:center" placeholder="Pt1" value="${v1}" oninput="BakerySection.onStock2('${pid}',1,this.value)">
      <input type="number" step="any" class="inp" style="width:50px;padding:4px;font-size:11px;text-align:center" placeholder="Pt2" value="${v2}" oninput="BakerySection.onStock2('${pid}',2,this.value)">
    </div>`;
  } else {
    const v = (typeof stockVal === 'string') ? stockVal : '';
    stockHtml = `<input type="number" step="any" class="inp" style="width:60px;padding:4px;font-size:11px;text-align:center" placeholder="Stock" value="${v}" oninput="BakerySection.onStock1('${pid}',this.value)">`;
  }

  return `<div class="card" style="padding:10px 14px;margin-bottom:6px;${qty > 0 ? 'border-left:3px solid var(--theme,#db2777)' : ''}">
    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
      <div><div style="font-size:13px;font-weight:700">${esc(p.product_name)}</div><div style="font-size:10px;color:var(--t3)">Min ${p.min_order || 1} · Step ${p.order_step || 1} · ${esc(p.unit || '')}</div></div>
      <div style="text-align:right"><div style="font-size:10px;color:var(--t3)">Quota</div><div style="font-size:14px;font-weight:700;color:var(--theme,#db2777)">${qDisplay}</div></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>${stockHtml}</div>
      <div style="display:flex;align-items:center;gap:6px">
        <button class="btn btn-sm btn-outline" style="width:28px;height:28px;padding:0;font-size:16px;line-height:1" onclick="BakerySection.step('${pid}',-1)">−</button>
        <span style="font-size:14px;font-weight:700;min-width:24px;text-align:center;color:${qty > 0 ? 'var(--theme,#db2777)' : 'var(--t3)'}">${qty}</span>
        <button class="btn btn-sm btn-primary" style="width:28px;height:28px;padding:0;font-size:16px;line-height:1" onclick="BakerySection.step('${pid}',1)">+</button>
      </div>
    </div>
  </div>`;
}

function _updateCartFooter() {
  const footer = document.getElementById('bk-cart-footer');
  const count = document.getElementById('bk-cart-count');
  if (footer) footer.style.display = S.cart.length > 0 ? 'block' : 'none';
  if (count) count.textContent = S.cart.length;
}


// ═══════════════════════════════════════
// 3. CART
// ═══════════════════════════════════════
BK.renderCart = function(p) {
  return SPG.shell(SPG.toolbar('Cart') + `
    <div class="content">
      <div id="bk-cart-body">${SPG.ui.skeleton(60, 3)}</div>
    </div>`, 'Bakery');
};

BK.loadCart = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  _fillCart();
};

function _fillCart() {
  const el = document.getElementById('bk-cart-body');
  if (!el) return;

  if (S.cart.length === 0) {
    el.innerHTML = SPG.ui.empty('🛒', 'Cart is empty', 'Browse products to add items') +
      `<button class="btn btn-primary btn-full" style="margin-top:16px" onclick="BakerySection.goToBrowse()">Browse Products</button>`;
    return;
  }

  const dd = S.deliveryDate || BK.tomorrowSydney();
  const isEdit = !!S.editingOrderId;

  let html = '';
  if (isEdit) {
    html += `<div class="card" style="background:var(--orange-bg);border-color:var(--orange);padding:8px 14px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:var(--orange)">Editing: ${esc(S.editingOrderId)}</div>
    </div>`;
  }

  html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div><div style="font-size:11px;color:var(--t3)">Delivery Date</div><div style="font-size:14px;font-weight:700">${BK.fmtDateAU(dd)}</div></div>
    <button class="btn btn-sm btn-outline" onclick="BakerySection.goToBrowse()">+ Add More</button>
  </div>`;

  // Items table
  html += '<div style="margin-bottom:16px">';
  S.cart.forEach((item, i) => {
    html += `<div class="card" style="padding:10px 14px;margin-bottom:4px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600">${esc(item.product_name)}${item.is_urgent ? ' <span style="color:var(--orange);font-size:10px">⚡ Urgent</span>' : ''}</div>
          <div style="font-size:10px;color:var(--t3)">${esc(item.unit)} · Qty: ${item.qty}${item.stock_on_hand != null ? ' · Stock: ' + item.stock_on_hand : ''}</div>
          ${item.note ? `<div style="font-size:10px;color:var(--theme,#db2777);margin-top:2px">Note: ${esc(item.note)}</div>` : ''}
        </div>
        <button class="btn btn-sm btn-outline" style="color:var(--red);border-color:var(--red);padding:2px 8px;font-size:10px" onclick="BakerySection.removeCartItem('${esc(item.product_id)}')">✕</button>
      </div>
    </div>`;
  });
  html += '</div>';

  // Header note
  html += `<div style="margin-bottom:16px">
    <div style="font-size:11px;color:var(--t3);margin-bottom:4px">Order Note (optional)</div>
    <textarea class="inp" rows="2" style="font-size:12px" placeholder="Any special instructions..." oninput="BK.S.headerNote=this.value">${esc(S.headerNote)}</textarea>
  </div>`;

  // Summary
  html += `<div class="card" style="padding:14px;background:var(--theme-bg,#fce7f3);margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700">
      <span>Total Items</span><span>${S.cart.length}</span>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--t3);margin-top:4px">
      <span>Total Qty</span><span>${S.cart.reduce((sum, c) => sum + c.qty, 0)}</span>
    </div>
  </div>`;

  // Submit
  html += `<button class="btn btn-primary btn-full" id="bk-submit-btn" onclick="BakerySection.submitOrder()">${isEdit ? 'Update Order' : 'Submit Order'}</button>`;

  el.innerHTML = html;
}


// ═══════════════════════════════════════
// 4. VIEW ORDERS
// ═══════════════════════════════════════
let _ordersPreset = 'this_week';
let _ordersStatus = 'all';

BK.renderOrders = function(p) {
  return SPG.shell(SPG.toolbar('Orders') + `
    <div class="content">
      ${BK.dateFilterChips(_ordersPreset, 'BakerySection.setOrdersPreset')}
      <div id="bk-status-tabs" style="display:flex;gap:6px;margin:10px 0;flex-wrap:wrap"></div>
      <div id="bk-orders-list">${SPG.ui.skeleton(50, 5)}</div>
    </div>`, 'Bakery');
};

BK.loadOrders = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  const range = BK.getDateRange(_ordersPreset);
  try {
    const data = await BK.api('get_orders', { date_from: range.from, date_to: range.to, limit: '200' });
    S.orders = Array.isArray(data) ? data : (data?.orders || []);
    S._ordersLoaded = true;
  } catch (e) { SPG.toast(e.message || 'Failed to load orders', 'error'); }
  _fillOrders();
};

function _fillOrders() {
  // Status tabs
  const tabEl = document.getElementById('bk-status-tabs');
  if (tabEl) {
    const statuses = ['all', 'Pending', 'Accepted', 'InProgress', 'Delivered', 'Cancelled'];
    const counts = {};
    S.orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    tabEl.innerHTML = statuses.map(st => {
      const label = st === 'all' ? `All (${S.orders.length})` : `${st} (${counts[st] || 0})`;
      return `<button class="btn btn-sm${_ordersStatus === st ? ' btn-primary' : ' btn-outline'}" onclick="BakerySection.setOrdersStatus('${st}')" style="font-size:10px;padding:4px 10px">${label}</button>`;
    }).join('');
  }

  const el = document.getElementById('bk-orders-list');
  if (!el) return;

  let filtered = S.orders;
  if (_ordersStatus !== 'all') filtered = filtered.filter(o => o.status === _ordersStatus);

  if (!filtered.length) {
    el.innerHTML = SPG.ui.empty('📋', 'No orders found', 'Try a different filter');
    return;
  }

  // Sort by delivery_date desc
  filtered.sort((a, b) => (b.delivery_date || '').localeCompare(a.delivery_date || ''));

  el.innerHTML = filtered.map(o => `
    <div class="card" style="padding:10px 14px;margin-bottom:6px;cursor:pointer" onclick="SPG.go('bakery/order-detail',{id:'${esc(o.order_id)}'})">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:12px;font-weight:700">${esc(o.order_id)}</div>
          <div style="font-size:10px;color:var(--t3)">Deliver: ${BK.fmtDateAU(o.delivery_date)} · ${o.item_count || '?'} items</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${SPG.ui.badge(o.status)}
          <span style="color:var(--t3);font-size:14px">›</span>
        </div>
      </div>
    </div>`).join('');
}


// ═══════════════════════════════════════
// 5. ORDER DETAIL
// ═══════════════════════════════════════
BK.renderOrderDetail = function(p) {
  return SPG.shell(SPG.toolbar('Order Detail') + `
    <div class="content">
      <div id="bk-order-detail">${SPG.ui.skeleton(100, 3)}</div>
    </div>`, 'Bakery');
};

BK.loadOrderDetail = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  const orderId = p?.id;
  if (!orderId) return;
  try {
    const data = await BK.api('get_order_detail', { order_id: orderId });
    S.currentOrder = data;
    _fillOrderDetail();
  } catch (e) { SPG.toast(e.message || 'Order not found', 'error'); }
};

function _fillOrderDetail() {
  const el = document.getElementById('bk-order-detail');
  if (!el || !S.currentOrder) return;

  const o = S.currentOrder.order || S.currentOrder;
  const items = S.currentOrder.items || [];
  const canEdit = o.status === 'Pending' && BK.hasPerm('fn_edit_order');
  const canCancel = (o.status === 'Pending' || o.status === 'Accepted') && BK.hasPerm('fn_cancel_order');

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">
      <div>
        <div style="font-size:16px;font-weight:900">${esc(o.order_id)}</div>
        <div style="font-size:11px;color:var(--t3);margin-top:2px">Created: ${BK.sydneyDateTime(o.created_at)}</div>
      </div>
      ${SPG.ui.badge(o.status)}
    </div>

    <div class="card" style="padding:14px;margin-bottom:12px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        <div><span style="color:var(--t3)">Store:</span> <strong>${esc(o.store_id)}</strong></div>
        <div><span style="color:var(--t3)">Dept:</span> <strong>${esc(o.dept_id || '—')}</strong></div>
        <div><span style="color:var(--t3)">Delivery:</span> <strong>${BK.fmtDateAU(o.delivery_date)}</strong></div>
        <div><span style="color:var(--t3)">Items:</span> <strong>${items.length}</strong></div>
      </div>
      ${o.header_note ? `<div style="margin-top:8px;padding:8px;background:var(--bg3);border-radius:var(--rd);font-size:11px;color:var(--t2)">Note: ${esc(o.header_note)}</div>` : ''}
    </div>`;

  // Items table
  const st0 = SPG.ui.getSortState('bk-order-items');
  const sortedItems = st0 ? SPG.ui.sortData(items, st0.key, st0.dir) : items;
  html += `<div class="sec-title">Items</div>
    <div style="overflow-x:auto">
      <table class="tbl" id="bk-order-items">
        <thead><tr>${SPG.ui.sortTh('bk-order-items','product_name','Product')}${SPG.ui.sortTh('bk-order-items','qty_ordered','Ordered',' style="text-align:right"')}${SPG.ui.sortTh('bk-order-items','qty_sent','Sent',' style="text-align:right"')}<th>Status</th></tr></thead>
        <tbody>${sortedItems.map(i => `<tr>
          <td style="font-weight:600;font-size:12px">${esc(i.product_name)}</td>
          <td style="text-align:right">${i.qty_ordered}</td>
          <td style="text-align:right">${i.qty_sent != null ? i.qty_sent : '—'}</td>
          <td>${i.qty_sent != null ? (i.qty_sent >= i.qty_ordered ? '<span style="color:var(--green);font-size:10px;font-weight:600">✓ Full</span>' : '<span style="color:var(--orange);font-size:10px;font-weight:600">Partial</span>') : '—'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;

  // Actions
  if (canEdit || canCancel) {
    html += `<div style="display:flex;gap:8px;margin-top:16px">
      ${canEdit ? `<button class="btn btn-primary" onclick="BakerySection.enterEditMode('${esc(o.order_id)}')">Edit Order</button>` : ''}
      ${canCancel ? `<button class="btn btn-outline" style="color:var(--red);border-color:var(--red)" onclick="BakerySection.confirmCancel('${esc(o.order_id)}')">Cancel Order</button>` : ''}
    </div>`;
  }

  el.innerHTML = html;
}


// ═══════════════════════════════════════
// 6. QUOTA
// ═══════════════════════════════════════
BK.renderQuota = function(p) {
  return SPG.shell(SPG.toolbar('Set Quota') + `
    <div class="content">
      <div id="bk-quota-body">${SPG.ui.skeleton(60, 5)}</div>
    </div>`, 'Bakery');
};

BK.loadQuota = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  await BK.ensureProducts();
  try {
    const data = await BK.api('get_quotas', {});
    S.quotaMap = data || {};
  } catch (e) { SPG.toast('Failed to load quotas', 'error'); }
  _fillQuota();
};

function _fillQuota() {
  const el = document.getElementById('bk-quota-body');
  if (!el) return;
  const prods = S.products;
  if (!prods.length) { el.innerHTML = SPG.ui.empty('📊', 'No products'); return; }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let html = `<div style="font-size:11px;color:var(--t3);margin-bottom:12px">Set daily quota per product (7 days)</div>
    <div style="overflow-x:auto"><table class="tbl" style="font-size:11px">
    <thead><tr><th>Product</th>${days.map(d => `<th style="text-align:center;min-width:50px">${d}</th>`).join('')}</tr></thead>
    <tbody>`;

  prods.forEach(p => {
    const qMap = S.quotaMap[p.product_id] || {};
    html += `<tr><td style="font-weight:600;font-size:11px;white-space:nowrap">${esc(p.product_name)}</td>`;
    for (let d = 0; d < 7; d++) {
      const val = qMap[d] ?? '';
      html += `<td style="text-align:center"><input type="number" class="inp" style="width:50px;padding:3px;text-align:center;font-size:11px" value="${val}" data-pid="${p.product_id}" data-day="${d}" oninput="BakerySection.onQuotaInput(this)"></td>`;
    }
    html += '</tr>';
  });

  html += `</tbody></table></div>
    <button class="btn btn-primary" style="margin-top:16px" onclick="BakerySection.saveQuotas()">Save Quotas</button>`;
  el.innerHTML = html;
}


// ═══════════════════════════════════════
// 7. STOCK
// ═══════════════════════════════════════
BK.renderStock = function(p) {
  return SPG.shell(SPG.toolbar('Stock Entry') + `
    <div class="content">
      <div id="bk-stock-body">${SPG.ui.skeleton(60, 5)}</div>
    </div>`, 'Bakery');
};

BK.loadStock = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  await BK.ensureProducts();
  // Stock screen — same as browse stock inputs but dedicated
  _fillStock();
};

function _fillStock() {
  const el = document.getElementById('bk-stock-body');
  if (!el) return;
  el.innerHTML = SPG.ui.empty('📦', 'Stock entry is integrated into Create Order', 'Enter stock levels when browsing products') +
    `<button class="btn btn-primary" style="margin-top:12px" onclick="BakerySection.goToBrowse()">Go to Create Order</button>`;
}


// ═══════════════════════════════════════
// 8. WASTE LOG
// ═══════════════════════════════════════
BK.renderWaste = function(p) {
  return SPG.shell(SPG.toolbar('Waste Log') + `
    <div class="content">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700">Waste Entries</div>
        <button class="btn btn-sm btn-primary" onclick="BakerySection.showAddWaste()">+ Add Waste</button>
      </div>
      <div id="bk-waste-list">${SPG.ui.skeleton(50, 4)}</div>
    </div>`, 'Bakery');
};

BK.loadWaste = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  await BK.ensureProducts();

  if (S._wasteLoaded) { _fillWaste(); return; }
  S._wasteLoading = true;
  try {
    const d = BK.sydneyNow(); d.setDate(d.getDate() - 14);
    const data = await BK.api('get_waste_log', { date_from: BK.fmtDate(d) });
    S.wasteLog = Array.isArray(data) ? data : (data?.waste_log || []);
    S._wasteLoaded = true;
  } finally { S._wasteLoading = false; }
  _fillWaste();
};

function _fillWaste() {
  const el = document.getElementById('bk-waste-list');
  if (!el) return;
  if (!S.wasteLog.length) { el.innerHTML = SPG.ui.empty('🗑️', 'No waste entries', 'Tap + to record waste'); return; }

  el.innerHTML = S.wasteLog.map(w => `
    <div class="card" style="padding:10px 14px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div>
          <div style="font-size:12px;font-weight:600">${esc(w.product_name || w.product_id)}</div>
          <div style="font-size:10px;color:var(--t3)">${BK.fmtDateAU(w.waste_date || w.created_at)} · ${esc(w.reason || '—')} · Shift: ${esc(w.shift || '—')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:14px;font-weight:700;color:var(--red)">${w.qty}</div>
          <div style="font-size:9px;color:var(--t3)">${esc(w.unit || '')}</div>
        </div>
      </div>
    </div>`).join('');
}


// ═══════════════════════════════════════
// 9. RETURNS
// ═══════════════════════════════════════
BK.renderReturns = function(p) {
  return SPG.shell(SPG.toolbar('Returns') + `
    <div class="content">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700">Return History</div>
        <button class="btn btn-sm btn-primary" onclick="BakerySection.showAddReturn()">+ Report Return</button>
      </div>
      <div id="bk-returns-list">${SPG.ui.skeleton(50, 4)}</div>
    </div>`, 'Bakery');
};

BK.loadReturns = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  await BK.ensureProducts();

  if (S._retsLoaded) { _fillReturns(); return; }
  S._retsLoading = true;
  try {
    const data = await BK.api('get_returns');
    S.returns = Array.isArray(data) ? data : (data?.returns || []);
    S._retsLoaded = true;
  } finally { S._retsLoading = false; }
  _fillReturns();
};

function _fillReturns() {
  const el = document.getElementById('bk-returns-list');
  if (!el) return;
  if (!S.returns.length) { el.innerHTML = SPG.ui.empty('↩️', 'No returns', 'Tap + to report a return'); return; }

  el.innerHTML = S.returns.map(r => `
    <div class="card" style="padding:10px 14px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div>
          <div style="font-size:12px;font-weight:600">${esc(r.product_name || r.product_id)}</div>
          <div style="font-size:10px;color:var(--t3)">${esc(r.return_id || '')} · ${esc(r.reason || '—')}</div>
          <div style="font-size:10px;color:var(--t3)">Order: ${esc(r.order_id || '—')}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:14px;font-weight:700">${r.qty}</div>
          ${SPG.ui.badge(r.status || r.resolution || 'pending')}
        </div>
      </div>
    </div>`).join('');
}


// ═══════════════════════════════════════
// STOCK HISTORY (Store-side, also used by BC)
// ═══════════════════════════════════════
BK.renderStockHistory = function(p) {
  return SPG.shell(SPG.toolbar('Stock History') + `
    <div class="content">
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <div><div style="font-size:10px;color:var(--t3)">From</div><input type="date" class="inp" style="font-size:11px;padding:4px 8px" id="bk-sh-from" value="${S.stockHistDateFrom}" onchange="BakerySection.reloadStockHistory()"></div>
        <div><div style="font-size:10px;color:var(--t3)">To</div><input type="date" class="inp" style="font-size:11px;padding:4px 8px" id="bk-sh-to" value="${S.stockHistDateTo}" onchange="BakerySection.reloadStockHistory()"></div>
      </div>
      <div id="bk-stock-hist">${SPG.ui.skeleton(50, 5)}</div>
    </div>`, 'Bakery');
};

BK.loadStockHistory = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  try {
    const data = await BK.api('get_stock_history', {
      date_from: S.stockHistDateFrom || '',
      date_to: S.stockHistDateTo || '',
    });
    S.stockHistory = Array.isArray(data) ? data : (data?.history || []);
  } catch (e) { console.error('Stock history:', e); }
  _fillStockHistory();
};

function _fillStockHistory() {
  const el = document.getElementById('bk-stock-hist');
  if (!el) return;
  if (!S.stockHistory.length) { el.innerHTML = SPG.ui.empty('📈', 'No stock history', 'Records will appear after orders'); return; }

  const st1 = SPG.ui.getSortState('bk-sh-tbl');
  const sortedHist = st1 ? SPG.ui.sortData(S.stockHistory, st1.key, st1.dir) : S.stockHistory;
  el.innerHTML = `<div style="overflow-x:auto"><table class="tbl" id="bk-sh-tbl" style="font-size:11px">
    <thead><tr>${SPG.ui.sortTh('bk-sh-tbl','date','Date')}${SPG.ui.sortTh('bk-sh-tbl','product_name','Product')}${SPG.ui.sortTh('bk-sh-tbl','stock_on_hand','Stock')}<th>Order</th></tr></thead>
    <tbody>${sortedHist.map(h => `<tr>
      <td>${BK.fmtDateAU(h.created_at || h.date)}</td>
      <td style="font-weight:600">${esc(h.product_name || h.product_id)}</td>
      <td style="text-align:right">${h.stock_on_hand != null ? h.stock_on_hand : '—'}</td>
      <td style="font-size:10px;color:var(--theme,#db2777)">${esc(h.order_id || '—')}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}


// ═══════════════════════════════════════
// ACTION HANDLERS (exposed via BakerySection)
// ═══════════════════════════════════════

// Browse: stepper
function step(pid, dir) {
  const p = S.products.find(pr => pr.product_id === pid);
  if (!p) return;
  const minOrder = p.min_order || 1;
  const orderStep = p.order_step || 1;
  const maxOrder = p.max_order || 9999;
  const cart = BK.getCartItem(pid);
  let qty = cart ? cart.qty : 0;

  if (dir > 0) {
    qty = qty === 0 ? minOrder : Math.min(qty + orderStep, maxOrder);
  } else {
    qty = qty <= minOrder ? 0 : qty - orderStep;
  }

  BK.setCartQty(pid, qty);
  _filterProducts(); // re-render product list
}

// Browse: change delivery date
function changeDate(val) {
  S.deliveryDate = val;
  S._quotasDay = -1; // force quota reload
  BK.loadBrowse({});
}

// Browse: filter by category
function filterCat(catId) {
  S.productFilter = catId;
  _filterProducts();
}

// Browse: stock input (1-point)
function onStock1(pid, val) {
  S.stockInputs[pid] = val;
}

// Browse: stock input (2-point)
function onStock2(pid, pt, val) {
  if (!S.stockInputs[pid] || typeof S.stockInputs[pid] !== 'object') {
    S.stockInputs[pid] = { s1: '', s2: '' };
  }
  S.stockInputs[pid][pt === 1 ? 's1' : 's2'] = val;
}

// Cart: remove item
function removeCartItem(pid) {
  BK.setCartQty(pid, 0);
  _fillCart();
}

// Cart: submit order
async function submitOrder() {
  if (S.cart.length === 0) { SPG.toast('Cart is empty', 'error'); return; }

  const btn = document.getElementById('bk-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
  SPG.showLoader();

  const sp = BK.getStockPoints();
  const items = S.cart.map(c => {
    const stockVal = S.stockInputs[c.product_id];
    let soh = null;
    if (sp === 2 && typeof stockVal === 'object') {
      soh = (parseFloat(stockVal.s1) || 0) + (parseFloat(stockVal.s2) || 0);
    } else if (typeof stockVal === 'string' && stockVal !== '') {
      soh = parseFloat(stockVal) || 0;
    }
    return {
      product_id: c.product_id,
      qty: c.qty,
      is_urgent: c.is_urgent,
      note: c.note || '',
      stock_on_hand: soh,
    };
  });

  const body = {
    delivery_date: S.deliveryDate,
    header_note: S.headerNote,
    items,
  };

  try {
    if (S.editingOrderId) {
      body.order_id = S.editingOrderId;
      await BK.api('edit_order', body);
      SPG.toast('Order updated!', 'success');
    } else {
      await BK.api('create_order', body);
      SPG.toast('Order submitted!', 'success');
    }

    // Reset cart
    S.cart = [];
    S.stockInputs = {};
    S.headerNote = '';
    S.editingOrderId = null;
    S._ordersLoaded = false;
    SPG.go('bakery/orders');
  } catch (e) {
    SPG.toast(e.message || 'Submit failed', 'error');
    if (btn) { btn.disabled = false; btn.textContent = S.editingOrderId ? 'Update Order' : 'Submit Order'; }
  } finally {
    SPG.hideLoader();
  }
}

// Orders: change date preset
function setOrdersPreset(preset) {
  _ordersPreset = preset;
  BK.loadOrders({});
}

// Orders: filter by status
function setOrdersStatus(st) {
  _ordersStatus = st;
  _fillOrders();
}

// Order Detail: cancel
function confirmCancel(orderId) {
  SPG.showDialog(`<div class="popup-sheet" style="width:340px">
    <div class="popup-header"><div class="popup-title">Cancel Order</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:16px">Cancel order <strong>${esc(orderId)}</strong>? This cannot be undone.</div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">No, keep it</button>
      <button class="btn btn-primary" style="background:var(--red)" onclick="BakerySection.doCancel('${esc(orderId)}')">Yes, cancel</button>
    </div>
  </div>`);
}

async function doCancel(orderId) {
  SPG.closeDialog();
  SPG.showLoader();
  try {
    await BK.api('cancel_order', { order_id: orderId });
    SPG.toast('Order cancelled', 'success');
    S._ordersLoaded = false;
    SPG.go('bakery/orders');
  } catch (e) {
    SPG.toast(e.message || 'Cancel failed', 'error');
  } finally {
    SPG.hideLoader();
  }
}

// Waste: add waste dialog
function showAddWaste() {
  const prodOptions = S.products.map(p => `<option value="${esc(p.product_id)}">${esc(p.product_name)}</option>`).join('');
  SPG.showDialog(`<div class="popup-sheet" style="width:380px">
    <div class="popup-header"><div class="popup-title">Record Waste</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Product</label><select class="inp" id="bk-w-prod"><option value="">-- Select --</option>${prodOptions}</select></div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Qty</label><input class="inp" type="number" id="bk-w-qty" min="1" placeholder="0"></div>
      <div class="fg" style="flex:1"><label class="lb">Shift</label><select class="inp" id="bk-w-shift"><option value="Morning">Morning</option><option value="Afternoon">Afternoon</option><option value="Evening">Evening</option></select></div>
    </div>
    <div class="fg"><label class="lb">Reason</label><select class="inp" id="bk-w-reason"><option value="Expired">Expired</option><option value="Damaged">Damaged</option><option value="Production Error">Production Error</option><option value="Overstock">Overstock</option><option value="Other">Other</option></select></div>
    <div class="error-msg" id="bk-w-err"></div>
    <div class="popup-actions"><button class="btn btn-primary" onclick="BakerySection.doAddWaste()">Save</button></div>
  </div>`);
}

async function doAddWaste() {
  const product_id = document.getElementById('bk-w-prod')?.value;
  const qty = parseInt(document.getElementById('bk-w-qty')?.value);
  const shift = document.getElementById('bk-w-shift')?.value;
  const reason = document.getElementById('bk-w-reason')?.value;
  if (!product_id || !qty) { SPG.showError('bk-w-err', 'Select product and enter qty'); return; }

  SPG.showLoader();
  try {
    await BK.api('create_waste', { product_id, qty, shift, reason });
    SPG.closeDialog();
    SPG.toast('Waste recorded', 'success');
    S._wasteLoaded = false;
    BK.loadWaste({});
  } catch (e) {
    SPG.showError('bk-w-err', e.message || 'Failed');
  } finally { SPG.hideLoader(); }
}

// Returns: add return dialog
function showAddReturn() {
  const prodOptions = S.products.map(p => `<option value="${esc(p.product_id)}">${esc(p.product_name)}</option>`).join('');
  SPG.showDialog(`<div class="popup-sheet" style="width:380px">
    <div class="popup-header"><div class="popup-title">Report Return</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Order ID</label><input class="inp" id="bk-r-order" placeholder="e.g. BC-2403-001"></div>
    <div class="fg"><label class="lb">Product</label><select class="inp" id="bk-r-prod"><option value="">-- Select --</option>${prodOptions}</select></div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Qty</label><input class="inp" type="number" id="bk-r-qty" min="1" placeholder="0"></div>
      <div class="fg" style="flex:1"><label class="lb">Reason</label><select class="inp" id="bk-r-reason"><option value="Wrong item">Wrong item</option><option value="Quality issue">Quality issue</option><option value="Damaged">Damaged</option><option value="Expired on arrival">Expired on arrival</option><option value="Other">Other</option></select></div>
    </div>
    <div class="error-msg" id="bk-r-err"></div>
    <div class="popup-actions"><button class="btn btn-primary" onclick="BakerySection.doAddReturn()">Submit</button></div>
  </div>`);
}

async function doAddReturn() {
  const order_id = document.getElementById('bk-r-order')?.value.trim();
  const product_id = document.getElementById('bk-r-prod')?.value;
  const qty = parseInt(document.getElementById('bk-r-qty')?.value);
  const reason = document.getElementById('bk-r-reason')?.value;
  if (!product_id || !qty) { SPG.showError('bk-r-err', 'Select product and enter qty'); return; }

  SPG.showLoader();
  try {
    await BK.api('report_return', { order_id, product_id, qty, reason });
    SPG.closeDialog();
    SPG.toast('Return reported', 'success');
    S._retsLoaded = false;
    BK.loadReturns({});
  } catch (e) {
    SPG.showError('bk-r-err', e.message || 'Failed');
  } finally { SPG.hideLoader(); }
}

// Quota: input handler
function onQuotaInput(el) {
  const pid = el.dataset.pid;
  const day = parseInt(el.dataset.day);
  if (!S.quotaMap[pid]) S.quotaMap[pid] = {};
  S.quotaMap[pid][day] = el.value !== '' ? parseInt(el.value) : null;
}

// Quota: save
async function saveQuotas() {
  SPG.showLoader();
  try {
    await BK.api('save_quotas', { quotas: S.quotaMap });
    SPG.toast('Quotas saved!', 'success');
  } catch (e) {
    SPG.toast(e.message || 'Save failed', 'error');
  } finally { SPG.hideLoader(); }
}

// Stock History: reload with new dates
function reloadStockHistory() {
  S.stockHistDateFrom = document.getElementById('bk-sh-from')?.value || '';
  S.stockHistDateTo = document.getElementById('bk-sh-to')?.value || '';
  BK.loadStockHistory({});
}


// ═══════════════════════════════════════
// EXTEND BakerySection (onclick handlers)
// ═══════════════════════════════════════
Object.assign(window.BakerySection, {
  // Browse
  step,
  changeDate,
  filterCat,
  onStock1,
  onStock2,
  setProductSearch: _setProductSearch,

  // Cart
  removeCartItem,
  submitOrder,

  // Orders
  setOrdersPreset,
  setOrdersStatus,

  // Order Detail
  confirmCancel,
  doCancel,

  // Waste
  showAddWaste,
  doAddWaste,

  // Returns
  showAddReturn,
  doAddReturn,

  // Quota
  onQuotaInput,
  saveQuotas,

  // Stock History
  reloadStockHistory,
});

// Sort event listener
document.addEventListener('spg-sort', (e) => {
  const id = e.detail.tableId;
  if (id === 'bk-order-items') _fillOrderDetail();
  if (id === 'bk-sh-tbl') _fillStockHistory();
});

})();
