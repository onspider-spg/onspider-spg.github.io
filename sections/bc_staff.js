/**
 * SPG HUB v1.0.0 | 22 MAR 2026 | Siam Palette Group
 * sections/bc_staff.js — BC Staff Screens (7 pages)
 * BC Dashboard, Accept Order, Fulfilment, Print Centre, Incoming Returns,
 * Product Management, Product Edit
 * (Stock History already implemented in bc_store.js)
 *
 * Depends on: bc_core.js (BK global)
 * Design: Pink #db2777 accent, matches Home layout via SPG.shell/toolbar
 */

(() => {
const esc = SPG.esc;
const S = BK.S;


// ═══════════════════════════════════════
// 1. BC DASHBOARD
// ═══════════════════════════════════════
BK.renderBcDashboard = function(p) {
  const s = SPG.api.getSession();
  if (!s) return SPG.shell('<div class="content">Loading...</div>', 'Bakery');

  return SPG.shell(SPG.toolbar('BC Dashboard') + `
    <div class="content">
      <div style="margin-bottom:20px">
        <div style="font-size:16px;font-weight:900;letter-spacing:-.5px;margin-bottom:4px" class="grad-text">Welcome, ${esc(s.display_name || s.display_label)}</div>
        <div style="font-size:11px;color:var(--t3)">BC Production · ${esc(BK.getStoreName(s.store_id))}</div>
      </div>

      <div id="bc-kpi" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:20px">
        ${SPG.ui.skeleton(60, 4)}
      </div>

      <div class="sec-title">Quick Actions</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${_bcQCard('View Orders', 'Manage orders', "SPG.go('bakery/orders')")}
        ${_bcQCard('Print Centre', 'Production sheet', "SPG.go('bakery/print')")}
        ${_bcQCard('Waste Log', 'Record waste', "SPG.go('bakery/waste')")}
        ${_bcQCard('Incoming Returns', 'Receive & resolve', "SPG.go('bakery/bc-returns')")}
        ${_bcQCard('Manage Products', 'Products & pricing', "SPG.go('bakery/products')")}
      </div>
    </div>`, 'Bakery');
};

function _bcQCard(title, sub, onclick) {
  return `<div class="card" style="cursor:pointer;padding:14px" onclick="${onclick}">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div><div style="font-size:13px;font-weight:700">${esc(title)}</div><div style="font-size:10px;color:var(--t3);margin-top:2px">${esc(sub)}</div></div>
      <span style="color:var(--t3);font-size:14px">›</span>
    </div>
  </div>`;
}

BK.loadBcDashboard = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  try {
    const data = await BK.api('get_dashboard');
    S.dashboard = data;
    _fillBcDashboard();
  } catch (e) { console.error('BC Dashboard load:', e); }
};

function _fillBcDashboard() {
  const el = document.getElementById('bc-kpi');
  if (!el) return;
  const d = S.dashboard;
  const bs = d?.by_status || {};
  el.innerHTML = `
    ${_bcKpiCard('Pending', bs.Pending || 0, 'var(--orange)')}
    ${_bcKpiCard('Accepted', bs.Accepted || 0, 'var(--blue, #3b82f6)')}
    ${_bcKpiCard('In Progress', bs.InProgress || 0, 'var(--theme, #db2777)')}
    ${_bcKpiCard('Delivered', bs.Delivered || bs.Fulfilled || 0, 'var(--green)')}`;
}

function _bcKpiCard(label, count, color) {
  return `<div class="card" style="text-align:center;padding:14px">
    <div style="font-size:24px;font-weight:900;color:${color}">${count}</div>
    <div style="font-size:10px;color:var(--t3);margin-top:2px">${label}</div>
  </div>`;
}


// ═══════════════════════════════════════
// 2. ACCEPT ORDER
// ═══════════════════════════════════════
BK.renderAccept = function(p) {
  return SPG.shell(SPG.toolbar('Accept Order') + `
    <div class="content">
      <div id="bc-accept-body">${SPG.ui.skeleton(100, 3)}</div>
    </div>`, 'Bakery');
};

BK.loadAccept = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  const orderId = p?.id;
  if (!orderId) { SPG.toast('No order ID', 'error'); return; }

  try {
    const data = await BK.api('get_order_detail', { order_id: orderId });
    S.currentOrder = data;
    _fillAccept();
  } catch (e) { SPG.toast(e.message || 'Order not found', 'error'); }
};

function _fillAccept() {
  const el = document.getElementById('bc-accept-body');
  if (!el || !S.currentOrder) return;

  const o = S.currentOrder.order || S.currentOrder;
  const items = S.currentOrder.items || [];

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
        <div><span style="color:var(--t3)">Store:</span> <strong>${esc(BK.getStoreName(o.store_id))}</strong></div>
        <div><span style="color:var(--t3)">Dept:</span> <strong>${esc(o.dept_id || '—')}</strong></div>
        <div><span style="color:var(--t3)">Delivery:</span> <strong>${BK.fmtDateAU(o.delivery_date)}</strong></div>
        <div><span style="color:var(--t3)">Items:</span> <strong>${items.length}</strong></div>
      </div>
      ${o.header_note ? `<div style="margin-top:8px;padding:8px;background:var(--bg3);border-radius:var(--rd);font-size:11px;color:var(--t2)">Note: ${esc(o.header_note)}</div>` : ''}
    </div>`;

  // Items table
  const st_acc = SPG.ui.getSortState('bk-accept-items');
  const sorted_acc = st_acc ? SPG.ui.sortData(items, st_acc.key, st_acc.dir) : items;

  html += `<div class="sec-title">Order Items</div>
    <div style="overflow-x:auto">
      <table class="tbl" id="bk-accept-items">
        <thead><tr>${SPG.ui.sortTh('bk-accept-items','product_name','Product')}${SPG.ui.sortTh('bk-accept-items','qty_ordered','Qty','right')}<th>Unit</th><th>Urgent</th></tr></thead>
        <tbody>${sorted_acc.map(i => `<tr>
          <td style="font-weight:600;font-size:12px">${esc(i.product_name)}</td>
          <td style="text-align:right">${i.qty_ordered}</td>
          <td style="font-size:11px;color:var(--t3)">${esc(i.unit || '')}</td>
          <td>${i.is_urgent ? '<span style="color:var(--orange);font-size:10px;font-weight:600">⚡ Yes</span>' : '—'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;

  // Actions (only for Pending orders)
  if (o.status === 'Pending') {
    html += `
      <div style="margin-top:16px">
        <div class="fg"><label class="lb">Rejection Reason (if rejecting)</label>
          <textarea class="inp" rows="2" id="bc-reject-reason" placeholder="Optional reason..." style="font-size:12px"></textarea>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn btn-primary" style="flex:1" onclick="BakerySection.doAcceptOrder('${esc(o.order_id)}')">Accept Order</button>
          <button class="btn btn-outline" style="flex:1;color:var(--red);border-color:var(--red)" onclick="BakerySection.doRejectOrder('${esc(o.order_id)}')">Reject</button>
        </div>
      </div>`;
  }

  el.innerHTML = html;
}


// ═══════════════════════════════════════
// 3. FULFILMENT
// ═══════════════════════════════════════
BK.renderFulfil = function(p) {
  return SPG.shell(SPG.toolbar('Fulfilment') + `
    <div class="content">
      <div id="bc-fulfil-body">${SPG.ui.skeleton(100, 3)}</div>
    </div>`, 'Bakery');
};

BK.loadFulfil = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  const orderId = p?.id;
  if (!orderId) { SPG.toast('No order ID', 'error'); return; }

  try {
    const data = await BK.api('get_order_detail', { order_id: orderId });
    S.currentOrder = data;
    _fillFulfil();
  } catch (e) { SPG.toast(e.message || 'Order not found', 'error'); }
};

function _fillFulfil() {
  const el = document.getElementById('bc-fulfil-body');
  if (!el || !S.currentOrder) return;

  const o = S.currentOrder.order || S.currentOrder;
  const items = S.currentOrder.items || [];

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">
      <div>
        <div style="font-size:16px;font-weight:900">${esc(o.order_id)}</div>
        <div style="font-size:11px;color:var(--t3)">Deliver: ${BK.fmtDateAU(o.delivery_date)} · Store: ${esc(BK.getStoreName(o.store_id))}</div>
      </div>
      ${SPG.ui.badge(o.status)}
    </div>`;

  // Items with qty_sent inputs
  const st_ful = SPG.ui.getSortState('bk-fulfil-items');
  const sorted_ful = st_ful ? SPG.ui.sortData(items, st_ful.key, st_ful.dir) : items;

  html += `<div class="sec-title">Fulfilment</div>
    <div style="overflow-x:auto">
      <table class="tbl" id="bk-fulfil-items">
        <thead><tr>${SPG.ui.sortTh('bk-fulfil-items','product_name','Product')}${SPG.ui.sortTh('bk-fulfil-items','qty_ordered','Ordered','right')}${SPG.ui.sortTh('bk-fulfil-items','qty_sent','Qty Sent','center')}</tr></thead>
        <tbody>${sorted_ful.map(i => `<tr>
          <td style="font-weight:600;font-size:12px">${esc(i.product_name)}<div style="font-size:10px;color:var(--t3)">${esc(i.unit || '')}</div></td>
          <td style="text-align:right;font-size:13px;font-weight:700">${i.qty_ordered}</td>
          <td style="text-align:center">
            <input type="number" class="inp" id="bc-qs-${esc(i.product_id)}" style="width:70px;padding:4px;text-align:center;font-size:12px" value="${i.qty_sent != null ? i.qty_sent : i.qty_ordered}" min="0" data-pid="${esc(i.product_id)}">
          </td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;

  // Action
  if (o.status === 'Accepted' || o.status === 'InProgress') {
    html += `<button class="btn btn-primary btn-full" style="margin-top:16px" id="bc-deliver-btn" onclick="BakerySection.doMarkDelivered('${esc(o.order_id)}')">Mark Delivered</button>`;
  }

  el.innerHTML = html;
}


// ═══════════════════════════════════════
// 4. PRINT CENTRE
// ═══════════════════════════════════════
BK.renderPrint = function(p) {
  const today = BK.todaySydney();
  return SPG.shell(SPG.toolbar('Print Centre') + `
    <div class="content">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
        <span style="font-size:11px;color:var(--t3);font-weight:600">Delivery Date:</span>
        <input type="date" class="inp" id="bc-print-date" value="${today}" style="font-size:11px;padding:4px 8px" onchange="BakerySection.changePrintDate(this.value)">
        <button class="btn btn-sm btn-outline" onclick="window.print()" style="margin-left:auto">Print</button>
      </div>
      <div id="bc-print-body">${SPG.ui.skeleton(50, 6)}</div>
    </div>`, 'Bakery');
};

BK.loadPrint = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  const dateEl = document.getElementById('bc-print-date');
  const deliveryDate = dateEl?.value || BK.todaySydney();

  try {
    const data = await BK.api('get_production_sheet', { delivery_date: deliveryDate });
    S.printData = data;
    _fillPrint();
  } catch (e) { SPG.toast(e.message || 'Failed to load production sheet', 'error'); }
};

function _fillPrint() {
  const el = document.getElementById('bc-print-body');
  if (!el) return;

  const data = S.printData;
  const items = Array.isArray(data) ? data : (data?.items || data?.products || []);

  if (!items.length) {
    el.innerHTML = SPG.ui.empty('🖨️', 'No orders for this date', 'Try a different delivery date');
    return;
  }

  const st_pr = SPG.ui.getSortState('bk-print-sheet');
  const sorted_pr = st_pr ? SPG.ui.sortData(items, st_pr.key, st_pr.dir) : items;

  el.innerHTML = `<div style="overflow-x:auto">
    <table class="tbl" id="bk-print-sheet" style="font-size:12px">
      <thead><tr>${SPG.ui.sortTh('bk-print-sheet','product_name','Product')}${SPG.ui.sortTh('bk-print-sheet','qty_ordered','Qty Ordered','right')}<th style="text-align:right">Qty Fulfilled</th><th>Status</th></tr></thead>
      <tbody>${sorted_pr.map(i => {
        const fulfilled = i.qty_fulfilled != null ? i.qty_fulfilled : (i.qty_sent || 0);
        const ordered = i.qty_ordered || i.total_qty || 0;
        const pct = ordered > 0 ? Math.round((fulfilled / ordered) * 100) : 0;
        return `<tr>
          <td style="font-weight:600">${esc(i.product_name || i.product_id)}</td>
          <td style="text-align:right;font-weight:700">${ordered}</td>
          <td style="text-align:right">${fulfilled}</td>
          <td>${pct >= 100 ? '<span style="color:var(--green);font-size:10px;font-weight:600">✓ Done</span>' : pct > 0 ? '<span style="color:var(--orange);font-size:10px;font-weight:600">' + pct + '%</span>' : '<span style="color:var(--t3);font-size:10px">—</span>'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}


// ═══════════════════════════════════════
// 5. INCOMING RETURNS
// ═══════════════════════════════════════
BK.renderBcReturns = function(p) {
  return SPG.shell(SPG.toolbar('Incoming Returns') + `
    <div class="content">
      <div style="font-size:13px;font-weight:700;margin-bottom:12px">Returns to Process</div>
      <div id="bc-returns-list">${SPG.ui.skeleton(50, 4)}</div>
    </div>`, 'Bakery');
};

BK.loadBcReturns = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  try {
    const data = await BK.api('get_returns');
    S.returns = Array.isArray(data) ? data : (data?.returns || []);
    S._retsLoaded = true;
  } catch (e) { SPG.toast(e.message || 'Failed to load returns', 'error'); }
  _fillBcReturns();
};

function _fillBcReturns() {
  const el = document.getElementById('bc-returns-list');
  if (!el) return;

  if (!S.returns.length) {
    el.innerHTML = SPG.ui.empty('↩️', 'No incoming returns', 'Returns reported by stores will appear here');
    return;
  }

  el.innerHTML = S.returns.map(r => {
    const canReceive = r.status === 'reported' || r.status === 'pending';
    const canResolve = r.status === 'received';

    return `<div class="card" style="padding:10px 14px;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">
        <div>
          <div style="font-size:12px;font-weight:600">${esc(r.product_name || r.product_id)}</div>
          <div style="font-size:10px;color:var(--t3)">${esc(r.return_id || '')} · Qty: ${r.qty} · ${esc(r.reason || '—')}</div>
          <div style="font-size:10px;color:var(--t3)">Order: ${esc(r.order_id || '—')} · Store: ${esc(BK.getStoreName(r.store_id))}</div>
        </div>
        <div style="text-align:right">
          ${SPG.ui.badge(r.status || 'pending')}
        </div>
      </div>
      ${canReceive ? `<div style="display:flex;gap:6px">
        <button class="btn btn-sm btn-primary" onclick="BakerySection.doReceiveReturn('${esc(r.return_id)}')">Receive</button>
      </div>` : ''}
      ${canResolve ? `<div style="display:flex;gap:6px">
        <button class="btn btn-sm btn-primary" onclick="BakerySection.doResolveReturn('${esc(r.return_id)}','rework')">Rework</button>
        <button class="btn btn-sm btn-outline" style="color:var(--red);border-color:var(--red)" onclick="BakerySection.doResolveReturn('${esc(r.return_id)}','waste')">Waste</button>
      </div>` : ''}
    </div>`;
  }).join('');
}


// ═══════════════════════════════════════
// 6. PRODUCT MANAGEMENT
// ═══════════════════════════════════════
BK.renderProducts = function(p) {
  return SPG.shell(SPG.toolbar('Manage Products') + `
    <div class="content">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;font-weight:700">Products</div>
        <button class="btn btn-sm btn-primary" onclick="SPG.go('bakery/prod-edit',{id:'new'})">+ New Product</button>
      </div>
      <div id="bc-products-list">${SPG.ui.skeleton(50, 5)}</div>
    </div>`, 'Bakery');
};

BK.loadProducts = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  try {
    const data = await BK.api('get_all_products');
    S.adminProducts = Array.isArray(data) ? data : (data?.products || []);
  } catch (e) { SPG.toast(e.message || 'Failed to load products', 'error'); }
  _fillProducts();
};

function _fillProducts() {
  const el = document.getElementById('bc-products-list');
  if (!el) return;

  const prods = S.adminProducts || [];
  if (!prods.length) {
    el.innerHTML = SPG.ui.empty('📦', 'No products found', 'Tap + to add a product');
    return;
  }

  const st_prod = SPG.ui.getSortState('bk-products');
  const sorted_prod = st_prod ? SPG.ui.sortData(prods, st_prod.key, st_prod.dir) : prods;

  el.innerHTML = `<div style="overflow-x:auto">
    <table class="tbl" id="bk-products" style="font-size:11px">
      <thead><tr>${SPG.ui.sortTh('bk-products','product_name','Product')}${SPG.ui.sortTh('bk-products','category_name','Category')}${SPG.ui.sortTh('bk-products','price','Price','right')}<th>Unit</th><th style="text-align:center">Active</th><th></th></tr></thead>
      <tbody>${sorted_prod.map(p => `<tr>
        <td style="font-weight:600">${esc(p.product_name)}</td>
        <td style="color:var(--t3)">${esc(p.category_name || p.cat_id || '—')}</td>
        <td style="text-align:right">${p.price != null ? '$' + Number(p.price).toFixed(2) : '—'}</td>
        <td>${esc(p.unit || '')}</td>
        <td style="text-align:center">
          <label style="position:relative;display:inline-block;width:36px;height:20px;cursor:pointer">
            <input type="checkbox" ${p.is_active !== false ? 'checked' : ''} onchange="BakerySection.toggleProductActive('${esc(p.product_id)}',this.checked)" style="opacity:0;width:0;height:0">
            <span style="position:absolute;top:0;left:0;right:0;bottom:0;background:${p.is_active !== false ? 'var(--theme,#db2777)' : 'var(--bd)'};border-radius:10px;transition:.3s"></span>
            <span style="position:absolute;top:2px;left:${p.is_active !== false ? '18px' : '2px'};width:16px;height:16px;background:#fff;border-radius:50%;transition:.3s"></span>
          </label>
        </td>
        <td><button class="btn btn-sm btn-outline" onclick="SPG.go('bakery/prod-edit',{id:'${esc(p.product_id)}'})">Edit</button></td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}


// ═══════════════════════════════════════
// 7. PRODUCT EDIT
// ═══════════════════════════════════════
BK.renderProdEdit = function(p) {
  const isNew = !p?.id || p.id === 'new';
  return SPG.shell(SPG.toolbar(isNew ? 'New Product' : 'Edit Product') + `
    <div class="content">
      <div id="bc-prod-edit-body">${isNew ? '' : SPG.ui.skeleton(60, 4)}</div>
    </div>`, 'Bakery');
};

BK.loadProdEdit = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  const productId = p?.id;
  const isNew = !productId || productId === 'new';

  let product = null;
  if (!isNew) {
    // Try to find from cached adminProducts first
    if (S.adminProducts) {
      product = S.adminProducts.find(pr => pr.product_id === productId);
    }
    // Fallback: load from API
    if (!product) {
      try {
        const data = await BK.api('get_all_products');
        const prods = Array.isArray(data) ? data : (data?.products || []);
        product = prods.find(pr => pr.product_id === productId);
      } catch (e) { SPG.toast(e.message || 'Product not found', 'error'); }
    }
  }

  _fillProdEdit(product, isNew);
};

function _fillProdEdit(product, isNew) {
  const el = document.getElementById('bc-prod-edit-body');
  if (!el) return;

  const pr = product || {};
  const cats = S.categories || [];
  const catOptions = cats.map(c => `<option value="${esc(c.cat_id)}" ${pr.cat_id === c.cat_id || pr.category_id === c.cat_id ? 'selected' : ''}>${esc(c.cat_name)}</option>`).join('');

  el.innerHTML = `
    <div class="fg"><label class="lb">Product Name</label><input class="inp" id="bc-pe-name" value="${esc(pr.product_name || '')}" placeholder="Product name"></div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Price</label><input class="inp" type="number" step="0.01" id="bc-pe-price" value="${pr.price != null ? pr.price : ''}" placeholder="0.00"></div>
      <div class="fg" style="flex:1"><label class="lb">Unit</label><input class="inp" id="bc-pe-unit" value="${esc(pr.unit || '')}" placeholder="e.g. pack, pcs"></div>
    </div>
    <div class="fg"><label class="lb">Category</label><select class="inp" id="bc-pe-cat"><option value="">-- Select --</option>${catOptions}</select></div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Min Order</label><input class="inp" type="number" id="bc-pe-min" value="${pr.min_order || 1}" min="1"></div>
      <div class="fg" style="flex:1"><label class="lb">Max Order</label><input class="inp" type="number" id="bc-pe-max" value="${pr.max_order || ''}" placeholder="No limit"></div>
    </div>
    <div class="fg"><label class="lb">Order Step</label><input class="inp" type="number" id="bc-pe-step" value="${pr.order_step || 1}" min="1"></div>
    <div class="fg" style="margin-top:8px">
      <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer">
        <input type="checkbox" id="bc-pe-active" ${pr.is_active !== false ? 'checked' : ''}>
        <span>Active</span>
      </label>
    </div>
    <div class="error-msg" id="bc-pe-err"></div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-primary" style="flex:1" onclick="BakerySection.doSaveProduct('${isNew ? '' : esc(pr.product_id)}')">Save Product</button>
      <button class="btn btn-outline" style="flex:1" onclick="SPG.go('bakery/products')">Cancel</button>
    </div>`;
}


// ═══════════════════════════════════════
// ACTION HANDLERS
// ═══════════════════════════════════════

// Accept Order
async function doAcceptOrder(orderId) {
  SPG.showLoader();
  try {
    await BK.api('accept_order', { order_id: orderId });
    SPG.toast('Order accepted!', 'success');
    S._ordersLoaded = false;
    SPG.go('bakery/orders');
  } catch (e) {
    SPG.toast(e.message || 'Accept failed', 'error');
  } finally { SPG.hideLoader(); }
}

async function doRejectOrder(orderId) {
  const reason = document.getElementById('bc-reject-reason')?.value.trim() || '';
  SPG.showLoader();
  try {
    await BK.api('reject_order', { order_id: orderId, reason });
    SPG.toast('Order rejected', 'success');
    S._ordersLoaded = false;
    SPG.go('bakery/orders');
  } catch (e) {
    SPG.toast(e.message || 'Reject failed', 'error');
  } finally { SPG.hideLoader(); }
}

// Fulfilment: mark delivered
async function doMarkDelivered(orderId) {
  const btn = document.getElementById('bc-deliver-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }
  SPG.showLoader();

  // Collect qty_sent values
  const data = S.currentOrder;
  const items = (data?.items || []).map(i => {
    const input = document.getElementById('bc-qs-' + i.product_id);
    return {
      product_id: i.product_id,
      qty_sent: input ? parseInt(input.value) || 0 : i.qty_ordered,
    };
  });

  try {
    await BK.api('update_fulfilment', { order_id: orderId, items });
    await BK.api('mark_delivered', { order_id: orderId });
    SPG.toast('Order marked as delivered!', 'success');
    S._ordersLoaded = false;
    SPG.go('bakery/orders');
  } catch (e) {
    SPG.toast(e.message || 'Delivery failed', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Mark Delivered'; }
  } finally { SPG.hideLoader(); }
}

// Print: change date
function changePrintDate(val) {
  BK.loadPrint({});
}

// Incoming Returns: receive
async function doReceiveReturn(returnId) {
  SPG.showLoader();
  try {
    await BK.api('receive_return', { return_id: returnId });
    SPG.toast('Return received', 'success');
    S._retsLoaded = false;
    BK.loadBcReturns({});
  } catch (e) {
    SPG.toast(e.message || 'Receive failed', 'error');
  } finally { SPG.hideLoader(); }
}

// Incoming Returns: resolve
async function doResolveReturn(returnId, resolution) {
  SPG.showLoader();
  try {
    await BK.api('resolve_return', { return_id: returnId, resolution });
    SPG.toast('Return resolved: ' + resolution, 'success');
    S._retsLoaded = false;
    BK.loadBcReturns({});
  } catch (e) {
    SPG.toast(e.message || 'Resolve failed', 'error');
  } finally { SPG.hideLoader(); }
}

// Product: toggle active
async function toggleProductActive(productId, isActive) {
  try {
    await BK.api('save_product', { product_id: productId, is_active: isActive });
    // Update cached list
    if (S.adminProducts) {
      const p = S.adminProducts.find(pr => pr.product_id === productId);
      if (p) p.is_active = isActive;
    }
    SPG.toast(isActive ? 'Product activated' : 'Product deactivated', 'success');
  } catch (e) {
    SPG.toast(e.message || 'Update failed', 'error');
    BK.loadProducts({}); // reload to revert toggle
  }
}

// Product: save (new or edit)
async function doSaveProduct(productId) {
  const name = document.getElementById('bc-pe-name')?.value.trim();
  const price = document.getElementById('bc-pe-price')?.value;
  const unit = document.getElementById('bc-pe-unit')?.value.trim();
  const cat_id = document.getElementById('bc-pe-cat')?.value;
  const min_order = parseInt(document.getElementById('bc-pe-min')?.value) || 1;
  const max_order = document.getElementById('bc-pe-max')?.value ? parseInt(document.getElementById('bc-pe-max').value) : null;
  const order_step = parseInt(document.getElementById('bc-pe-step')?.value) || 1;
  const is_active = document.getElementById('bc-pe-active')?.checked ?? true;

  if (!name) { SPG.showError('bc-pe-err', 'Product name is required'); return; }

  const formData = {
    product_name: name,
    price: price !== '' ? parseFloat(price) : null,
    unit,
    cat_id: cat_id || null,
    category_id: cat_id || null,
    min_order,
    max_order,
    order_step,
    is_active,
  };
  if (productId) formData.product_id = productId;

  SPG.showLoader();
  try {
    await BK.api('save_product', formData);
    SPG.toast(productId ? 'Product updated!' : 'Product created!', 'success');
    S.adminProducts = null; // force reload
    S._prodsLoaded = false; // invalidate product cache
    SPG.go('bakery/products');
  } catch (e) {
    SPG.showError('bc-pe-err', e.message || 'Save failed');
  } finally { SPG.hideLoader(); }
}


// ═══════════════════════════════════════
// EXTEND BakerySection (onclick handlers)
// ═══════════════════════════════════════
Object.assign(window.BakerySection, {
  // Accept Order
  doAcceptOrder,
  doRejectOrder,

  // Fulfilment
  doMarkDelivered,

  // Print
  changePrintDate,

  // Incoming Returns
  doReceiveReturn,
  doResolveReturn,

  // Products
  toggleProductActive,
  doSaveProduct,
});

// ═══════════════════════════════════════
// SORT EVENT LISTENER
// ═══════════════════════════════════════
document.addEventListener('spg-sort', (e) => {
  const id = e.detail.tableId;
  if (id === 'bk-accept-items') _fillAccept && _fillAccept();
  if (id === 'bk-fulfil-items') _fillFulfil && _fillFulfil();
  if (id === 'bk-products') BK.loadProducts && BK.loadProducts({});
  if (id === 'bk-print-sheet') _fillPrint && _fillPrint();
});

})();
