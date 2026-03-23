/**
 * SPG HUB v2.0.0 | 23 MAR 2026 | Siam Palette Group
 * sections/bc_staff.js — BC Staff Screens (7 pages)
 * BC Dashboard, Accept Order (Incoming Orders), Fulfilment, Print Centre,
 * Incoming Returns, Product Management, Product Edit
 *
 * Depends on: bc_core.js (BK global)
 * HTML: Wireframe v4 CSS classes (wf-card, wf-table, wf-chip, wf-badge, etc.)
 * Logic: Ported from legacy screens2_bcorder.js + current bc_staff.js
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
      <div class="welcome-card">
        <div class="welcome-avatar">BC</div>
        <div>
          <div class="welcome-name">BC Kitchen &#129473;</div>
          <div class="welcome-meta">Production Hub | Central Bakery</div>
          <div class="welcome-badge" style="background:var(--pink-bg,#fce7f3);color:var(--pink,#db2777)">BC Staff</div>
        </div>
      </div>
      <div class="stats-row" style="grid-template-columns:repeat(4,1fr)" id="bcKpis">
        <div class="stat-card"><div class="stat-num" style="color:var(--orange)">-</div><div class="stat-label">Incoming Orders</div></div>
        <div class="stat-card"><div class="stat-num" style="color:var(--acc)">-</div><div class="stat-label">Items to Produce</div></div>
        <div class="stat-card"><div class="stat-num" style="color:var(--blue)">-</div><div class="stat-label">Orders to Fulfil</div></div>
        <div class="stat-card"><div class="stat-num" style="color:var(--red)">-</div><div class="stat-label">Returns Pending</div></div>
      </div>
      <div class="sec-title">Today's Production</div>
      <div class="wf-card" id="bcProduction"></div>
      <div class="sec-title">Orders by Store</div>
      <div class="wf-card" id="bcStoreOrders"></div>
    </div>`, 'Bakery');
};

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
  const d = S.dashboard;
  if (!d?.by_status) return;
  const bs = d.by_status;
  const done = (bs.Fulfilled || 0) + (bs.Delivered || 0);
  const total = d.today_total || 0;
  const pending = bs.Pending || 0;
  const ordered = bs.Ordered || 0;
  const inProg = bs.InProgress || 0;
  const itemsToProduce = d.items_to_produce || 0;
  const ordersToFulfil = (ordered + inProg) || 0;
  const returnsPending = d.pending_returns || 0;

  // KPI stats
  const kpiEl = document.getElementById('bcKpis');
  if (kpiEl) {
    kpiEl.innerHTML =
      `<div class="stat-card"><div class="stat-num" style="color:var(--orange)">${pending}</div><div class="stat-label">Incoming Orders</div></div>` +
      `<div class="stat-card"><div class="stat-num" style="color:var(--acc)">${itemsToProduce}</div><div class="stat-label">Items to Produce</div></div>` +
      `<div class="stat-card"><div class="stat-num" style="color:var(--blue)">${ordersToFulfil}</div><div class="stat-label">Orders to Fulfil</div></div>` +
      `<div class="stat-card"><div class="stat-num" style="color:var(--red)">${returnsPending}</div><div class="stat-label">Returns Pending</div></div>`;
  }

  // Today's Production bars
  const prodEl = document.getElementById('bcProduction');
  if (prodEl) {
    const prods = d.production_summary || [];
    if (prods.length) {
      prodEl.innerHTML = prods.map(p => {
        const pct = p.total > 0 ? Math.min(Math.round(p.done / p.total * 100), 100) : 0;
        return `<div class="wf-bar-row"><div class="wf-bar-label">${esc(p.product_name)}</div><div class="wf-bar-fill" style="width:${pct}%"></div><div class="wf-bar-val">${p.done}</div></div>`;
      }).join('');
    } else {
      prodEl.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--t3);text-align:center">No production data</div>';
    }
  }

  // Orders by Store
  const storeEl = document.getElementById('bcStoreOrders');
  if (storeEl) {
    const storeData = d.by_store || [];
    if (storeData.length) {
      storeEl.innerHTML = storeData.map((s, idx) => {
        const isLast = idx === storeData.length - 1;
        const pendingCount = s.pending || 0;
        let badgeHtml;
        if (pendingCount > 0) {
          badgeHtml = `<span class="wf-badge" style="background:var(--orange-bg);color:var(--orange)">${pendingCount} Pending</span>`;
        } else {
          badgeHtml = '<span class="wf-badge" style="background:var(--green-bg);color:var(--green)">All Accepted</span>';
        }
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0${isLast ? '' : ';border-bottom:1px solid var(--bd2)'}">
          <div><b>${esc(s.store_id)}</b> <span style="font-size:11px;color:var(--t3)">${esc(BK.getStoreName(s.store_id))}</span></div>
          <div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px;font-weight:600">${s.order_count || 0} orders</span>${badgeHtml}</div>
        </div>`;
      }).join('');
    } else {
      storeEl.innerHTML = '<div style="padding:12px;font-size:12px;color:var(--t3);text-align:center">No orders today</div>';
    }
  }
}


// ═══════════════════════════════════════
// 2. ACCEPT ORDER (Incoming Orders)
// ═══════════════════════════════════════
let _acceptTab = 'Pending';

BK.renderAccept = function(p) {
  _acceptTab = 'Pending';
  return SPG.shell(SPG.toolbar('Incoming Orders') + `
    <div class="content">
      <div style="margin-bottom:12px" id="acceptChips"></div>
      <div id="acceptContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>
    </div>`, 'Bakery');
};

BK.loadAccept = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  // If a specific order ID is passed, load single order detail
  const orderId = p?.id;
  if (orderId) {
    try {
      const data = await BK.api('get_order_detail', { order_id: orderId });
      S.currentOrder = data;
      _fillAcceptDetail();
    } catch (e) { SPG.toast(e.message || 'Order not found', 'error'); }
    return;
  }

  // Otherwise load all orders
  try {
    const data = await BK.api('get_orders');
    S.orders = Array.isArray(data) ? data : (data?.orders || []);
  } catch (e) { SPG.toast(e.message || 'Failed to load orders', 'error'); }
  _fillAcceptList();
};

function _fillAcceptList() {
  const chipEl = document.getElementById('acceptChips');
  const el = document.getElementById('acceptContent');
  if (!el) return;

  const all = S.orders || [];
  const pending = all.filter(o => o.status === 'Pending');
  const accepted = all.filter(o => o.status === 'Ordered');

  // Chip tabs
  if (chipEl) {
    const pendingCount = pending.length;
    chipEl.innerHTML =
      `<span class="wf-chip${_acceptTab === 'Pending' ? ' active' : ''}" onclick="BakerySection.setAcceptTab('Pending')">Pending ${pendingCount > 0 ? '<span style="background:var(--red);color:#fff;font-size:9px;padding:1px 5px;border-radius:8px;margin-left:4px">' + pendingCount + '</span>' : ''}</span>` +
      `<span class="wf-chip${_acceptTab === 'Accepted' ? ' active' : ''}" onclick="BakerySection.setAcceptTab('Accepted')">Accepted</span>` +
      `<span class="wf-chip${_acceptTab === 'All' ? ' active' : ''}" onclick="BakerySection.setAcceptTab('All')">All Today</span>`;
  }

  let shown;
  if (_acceptTab === 'Pending') shown = pending;
  else if (_acceptTab === 'Accepted') shown = accepted;
  else shown = all;

  if (!shown.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">\u274C</div><div class="empty-title">No orders</div></div>';
    return;
  }

  el.innerHTML = shown.map(o => _makeOrderCard(o)).join('');
}

function _makeOrderCard(o) {
  const isPending = o.status === 'Pending';
  const statusMap = {
    Pending: 'background:var(--orange-bg);color:var(--orange)',
    Ordered: 'background:var(--blue-bg);color:var(--blue)',
    InProgress: 'background:var(--blue-bg);color:var(--blue)',
    Fulfilled: 'background:var(--green-bg);color:var(--green)',
    Delivered: 'background:var(--green-bg);color:var(--green)',
    Rejected: 'background:var(--red-bg);color:var(--red)',
    Cancelled: 'background:var(--bg3);color:var(--t3)',
  };
  const badgeStyle = statusMap[o.status] || 'background:var(--bg3);color:var(--t3)';
  const itemCount = o.item_count || o.items?.length || 0;
  const deliveryDate = o.delivery_date ? BK.fmtDateThai(o.delivery_date) : '';

  let actionHtml = '';
  if (isPending) {
    actionHtml = `<div style="display:flex;gap:6px;margin-top:8px">
      <button class="wf-btn wf-btn-success" style="padding:4px 12px;font-size:11px" onclick="event.stopPropagation();BakerySection.doAcceptOrder('${o.order_id}')">\u2713 Accept</button>
      <button class="wf-btn wf-btn-danger" style="padding:4px 12px;font-size:11px" onclick="event.stopPropagation();BakerySection.showRejectDialog('${o.order_id}')">\u2717 Reject</button>
    </div>`;
  }

  return `<div class="order-card" onclick="SPG.go('bakery/accept',{id:'${o.order_id}'})">
    <div style="display:flex;justify-content:space-between;align-items:start">
      <div>
        <div style="font-weight:700;color:var(--acc)">${esc(o.order_id)}</div>
        <div style="font-size:11px;color:var(--t3)">Store: <b>${esc(o.store_id)}</b> | ${itemCount} items</div>
        <div style="font-size:11px;color:var(--t3)">Delivery: ${esc(deliveryDate)}</div>
      </div>
      <span class="wf-badge" style="${badgeStyle}">${esc(o.status)}</span>
    </div>
    <div style="font-size:11px;color:var(--t3);margin-top:6px;cursor:pointer;text-decoration:underline">View items &#9662;</div>
    ${actionHtml}
  </div>`;
}

function _fillAcceptDetail() {
  const el = document.getElementById('acceptContent');
  const chipEl = document.getElementById('acceptChips');
  if (!el) return;
  if (chipEl) chipEl.innerHTML = '';

  const data = S.currentOrder;
  if (!data) { el.innerHTML = '<div class="empty"><div class="empty-icon">\u274C</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25</div></div>'; return; }

  const o = data.order;
  const items = data.items || [];
  if (o.status !== 'Pending') {
    el.innerHTML = `<div class="empty"><div class="empty-icon">\u2139\uFE0F</div><div class="empty-title">\u0E2A\u0E16\u0E32\u0E19\u0E30 ${esc(o.status)}</div><div class="empty-desc">Accept \u0E44\u0E14\u0E49\u0E40\u0E09\u0E1E\u0E32\u0E30 Pending \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19</div><button class="wf-btn wf-btn-gradient" style="margin-top:12px" onclick="SPG.go('bakery/order-detail',{id:'${o.order_id}'})">\u0E14\u0E39\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14 \u2192</button></div>`;
    return;
  }

  const cutoffBadge = o.is_cutoff_violation ? '<span class="wf-badge" style="background:var(--orange-bg);color:var(--orange);margin-left:6px">cutoff</span>' : '';

  const rows = items.map(i => `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--bd2);border-left:3px solid ${i.is_urgent ? 'var(--red)' : 'var(--bd)'};border-radius:0 var(--rd) var(--rd) 0;background:var(--bg)">
    <div style="flex:1"><div style="font-size:13px;font-weight:700">${esc(i.product_name)}</div><div style="font-size:11px;color:var(--t3)">${i.qty_ordered} ${esc(i.unit)}${i.is_urgent ? ' \u00B7 <span style="color:var(--red)">\u26A1 URGENT</span>' : ''}${i.item_note ? ' \u00B7 \uD83D\uDCDD ' + esc(i.item_note) : ''}</div></div>
  </div>`).join('');

  el.innerHTML = `
    <div style="padding:12px 16px;background:var(--red-bg);border-radius:var(--rd);margin-bottom:10px;font-size:12px;color:var(--red);font-weight:600">
      ${esc(o.order_id)} \u00B7 ${esc(BK.getStoreName(o.store_id))}${o.dept_id ? ' \u00B7 ' + esc(o.dept_id) : ''} \u00B7 ${esc(o.display_name || '')} \u00B7 \u0E2A\u0E48\u0E07 ${BK.fmtDateThai(o.delivery_date)}${cutoffBadge}
    </div>
    ${o.header_note ? '<div style="padding:8px 12px;background:var(--bg3);border-radius:var(--rd);margin-bottom:10px;font-size:12px">\uD83D\uDCDD ' + esc(o.header_note) + '</div>' : ''}
    <div style="font-size:11px;color:var(--t3);margin-bottom:6px">${items.length} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23</div>
    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:14px">${rows}</div>
    <div style="display:flex;gap:6px">
      <button class="wf-btn wf-btn-success" style="flex:1" id="acceptBtn" onclick="BakerySection.doAcceptOrder('${o.order_id}')">\u2713 Accept All</button>
      <button class="wf-btn wf-btn-danger" style="flex:1" id="rejectBtn" onclick="BakerySection.showRejectDialog('${o.order_id}')">\u2717 Reject</button>
    </div>
    <button class="wf-btn" style="width:100%;margin-top:6px;color:var(--red);border:1px solid var(--red);background:transparent" onclick="BakerySection.confirmCancel('${o.order_id}')">\uD83D\uDEAB Cancel Order</button>`;
}

function setAcceptTab(tab) { _acceptTab = tab; _fillAcceptList(); }


// ═══════════════════════════════════════
// 3. FULFILMENT
// ═══════════════════════════════════════
let _fulfilState = {}; // { item_id: { status, qty_sent, note } }

BK.renderFulfil = function(p) {
  _fulfilState = {};
  return SPG.shell(SPG.toolbar('Fulfilment') + `
    <div class="content">
      <div class="wf-filter-bar" id="fulfilSelect"></div>
      <div id="fulfilContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>
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
  const el = document.getElementById('fulfilContent');
  const selEl = document.getElementById('fulfilSelect');
  if (!el) return;
  const data = S.currentOrder;
  if (!data) { el.innerHTML = '<div class="empty"><div class="empty-icon">\u274C</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25</div></div>'; return; }

  const o = data.order;
  const items = data.items || [];

  // Order select dropdown in filter bar
  if (selEl) {
    const otherOrders = (S.orders || []).filter(x => ['Ordered', 'InProgress'].includes(x.status));
    selEl.innerHTML = `<select class="wf-select" onchange="if(this.value)SPG.go('bakery/fulfil',{id:this.value})">
      <option>Select Order...</option>
      ${otherOrders.map(x => `<option value="${x.order_id}"${x.order_id === o.order_id ? ' selected' : ''}>${esc(x.order_id)} (${esc(x.store_id)})</option>`).join('')}
    </select>`;
  }

  if (!['Ordered', 'InProgress'].includes(o.status)) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">\u2139\uFE0F</div><div class="empty-title">\u0E2A\u0E16\u0E32\u0E19\u0E30 ${esc(o.status)}</div><div class="empty-desc">Fulfilment \u0E44\u0E14\u0E49\u0E40\u0E09\u0E1E\u0E32\u0E30 Ordered/InProgress</div><button class="wf-btn wf-btn-gradient" style="margin-top:12px" onclick="SPG.go('bakery/order-detail',{id:'${o.order_id}'})">\u0E14\u0E39\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14 \u2192</button></div>`;
    return;
  }

  // Init state from existing data
  items.forEach(i => {
    if (!_fulfilState[i.item_id]) {
      _fulfilState[i.item_id] = {
        status: i.fulfilment_status || '',
        qty_sent: i.qty_sent ?? i.qty_ordered,
        note: i.fulfilment_note || '',
      };
    }
  });

  _renderFulfilBody(el, o, items);
}

function _renderFulfilBody(el, o, items) {
  const rows = items.map(i => {
    const fs = _fulfilState[i.item_id] || {};
    const st = fs.status;
    const isFull = st === 'full';
    const isPartial = st === 'partial';
    const radioName = 'ff_' + i.item_id;
    const qtyVal = isPartial ? (fs.qty_sent || 0) : (i.qty_sent ?? i.qty_ordered);

    return `<tr>
      <td>${esc(i.product_name)}</td>
      <td>${i.qty_ordered}</td>
      <td>
        <label style="font-size:10px;margin-right:6px"><input type="radio" name="${radioName}" ${isFull ? 'checked' : ''} onchange="BakerySection.fulfilFull('${i.item_id}')"> Full</label>
        <label style="font-size:10px;margin-right:6px"><input type="radio" name="${radioName}" ${isPartial ? 'checked' : ''} onchange="BakerySection.fulfilPartial('${i.item_id}')"> Partial</label>
        <label style="font-size:10px"><input type="radio" name="${radioName}" ${!isFull && !isPartial && st === 'unable' ? 'checked' : ''} onchange="BakerySection.fulfilClear('${i.item_id}')"> Unable</label>
      </td>
      <td><input class="product-qty" value="${qtyVal}" style="width:50px" oninput="BakerySection.setFulfilQty('${i.item_id}',this.value)"></td>
      <td><input class="wf-input" style="width:100px" placeholder="..." value="${esc(fs.note || '')}" oninput="BakerySection.setFulfilNote('${i.item_id}',this.value)"></td>
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="wf-card">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">Order: <span style="color:var(--acc)">${esc(o.order_id)}</span> | Store: ${esc(o.store_id)} | Delivery: ${BK.fmtDateThai(o.delivery_date)}</div>
      <table class="wf-table">
        <thead><tr><th>Product</th><th>Ordered</th><th>Fulfil</th><th>Qty Sent</th><th>Note</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="text-align:right;margin-top:8px">
      <button class="wf-btn-gradient" id="fulfilSaveBtn" onclick="BakerySection.saveFulfilment('${o.order_id}')">Save Fulfilment</button>
    </div>
    <div style="text-align:right;margin-top:6px">
      <button class="wf-btn" style="color:var(--acc);border:1px solid var(--acc);background:transparent;padding:6px 16px;font-size:12px" id="deliverBtn" onclick="BakerySection.doMarkDelivered('${o.order_id}')">\uD83D\uDE9A Mark as Delivered</button>
    </div>`;
}

function fulfilFull(itemId) {
  const data = S.currentOrder;
  if (!data) return;
  const item = data.items.find(i => i.item_id === itemId);
  if (!item) return;
  _fulfilState[itemId] = { status: 'full', qty_sent: item.qty_ordered, note: '' };
  const el = document.getElementById('fulfilContent');
  if (el) _renderFulfilBody(el, data.order, data.items);
}

function fulfilPartial(itemId) {
  const data = S.currentOrder;
  if (!data) return;
  _fulfilState[itemId] = { status: 'partial', qty_sent: 0, note: '' };
  const el = document.getElementById('fulfilContent');
  if (el) _renderFulfilBody(el, data.order, data.items);
}

function fulfilClear(itemId) {
  const data = S.currentOrder;
  if (!data) return;
  const item = data.items.find(i => i.item_id === itemId);
  if (!item) return;
  _fulfilState[itemId] = { status: '', qty_sent: item.qty_ordered, note: '' };
  const el = document.getElementById('fulfilContent');
  if (el) _renderFulfilBody(el, data.order, data.items);
}

function setFulfilQty(itemId, val) {
  if (_fulfilState[itemId]) _fulfilState[itemId].qty_sent = parseInt(val) || 0;
}

function setFulfilNote(itemId, val) {
  if (_fulfilState[itemId]) _fulfilState[itemId].note = val;
}

async function saveFulfilment(orderId) {
  const btn = document.getElementById('fulfilSaveBtn');
  if (!btn || btn.disabled) return;

  const marked = [];
  for (const itemId in _fulfilState) {
    const fs = _fulfilState[itemId];
    if (fs.status) {
      marked.push({ item_id: itemId, fulfilment_status: fs.status, qty_sent: fs.qty_sent, fulfilment_note: fs.note || '' });
    }
  }
  if (!marked.length) { SPG.toast('\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49 mark \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32', 'warning'); return; }

  btn.disabled = true; btn.textContent = '\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01...';
  try {
    const resp = await BK.api('update_fulfilment', { order_id: orderId, items: marked });
    if (resp.success) {
      SPG.toast(resp.message || '\u2705 \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22', 'success');
      if (S.currentOrder?.order) S.currentOrder.order.status = 'InProgress';
      const idx = (S.orders || []).findIndex(o => o.order_id === orderId);
      if (idx >= 0) S.orders[idx].status = 'InProgress';
      marked.forEach(m => {
        const item = S.currentOrder?.items?.find(i => i.item_id === m.item_id);
        if (item) { item.fulfilment_status = m.fulfilment_status; item.qty_sent = m.qty_sent; item.fulfilment_note = m.fulfilment_note; }
      });
    } else {
      SPG.toast(resp.message || 'Error', 'error');
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Fulfilment';
  }
}

async function doMarkDelivered(orderId) {
  const btn = document.getElementById('deliverBtn');
  if (!btn || btn.disabled) return;
  btn.disabled = true; btn.textContent = '\u0E01\u0E33\u0E25\u0E31\u0E07\u0E2A\u0E48\u0E07...';
  try {
    const resp = await BK.api('mark_delivered', { order_id: orderId });
    if (resp.success) {
      SPG.toast(resp.message || '\u2705 \u0E2A\u0E48\u0E07\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22', 'success');
      if (S.currentOrder?.order) S.currentOrder.order.status = 'Delivered';
      const idx = (S.orders || []).findIndex(o => o.order_id === orderId);
      if (idx >= 0) S.orders[idx].status = 'Delivered';
      SPG.go('bakery/orders');
    } else {
      SPG.toast(resp.message || 'Error', 'error');
      btn.disabled = false; btn.textContent = '\uD83D\uDE9A Mark as Delivered';
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
    btn.disabled = false; btn.textContent = '\uD83D\uDE9A Mark as Delivered';
  }
}


// ═══════════════════════════════════════
// 4. PRINT CENTRE
// ═══════════════════════════════════════
let _printTab = 'sheet'; // 'sheet' | 'slip'
let _printSections = new Set(); // empty = all selected
let _printDate = '';
let _slipStore = '';

BK.renderPrint = function(p) {
  _printTab = 'sheet';
  _printSections = new Set();
  _printDate = BK.todaySydney();
  _slipStore = '';
  return SPG.shell(SPG.toolbar('Print Centre') + `
    <div class="content" id="printContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.loadPrint = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  const deliveryDate = _printDate || BK.todaySydney();

  try {
    const data = await BK.api('get_production_sheet', { delivery_date: deliveryDate });
    S.printData = data;
    _fillPrint();
  } catch (e) { SPG.toast(e.message || 'Failed to load production sheet', 'error'); }
};

function _fillPrint() {
  const el = document.getElementById('printContent');
  if (!el) return;
  const d = S.printData;
  if (!d) { el.innerHTML = '<div class="empty"><div class="empty-icon">\uD83D\uDDA8\uFE0F</div><div class="empty-title">\u0E01\u0E33\u0E25\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14...</div></div>'; return; }

  // Filter bar with date + print button
  const filterBar = `<div class="wf-filter-bar">
    <label class="wf-label" style="margin-bottom:0">Delivery Date</label>
    <input class="wf-input" type="date" value="${_printDate}" style="width:150px" onchange="BakerySection.setPrintDate(this.value)">
    <button class="wf-btn-gradient" style="margin-left:auto;padding:6px 16px;font-size:12px" onclick="window.print()">&#128424; Print</button>
  </div>`;

  // Tab chips for sheet/slip
  const tabs = `<div style="display:flex;gap:5px;margin-bottom:8px">
    <div class="wf-chip${_printTab === 'sheet' ? ' active' : ''}" onclick="BakerySection.setPrintTab('sheet')">\uD83D\uDCC4 Production Sheet</div>
    <div class="wf-chip${_printTab === 'slip' ? ' active' : ''}" onclick="BakerySection.setPrintTab('slip')">\uD83E\uDDFE Delivery Slip</div>
  </div>`;

  // Section checkboxes
  const sorted = [...new Set((S.categories || []).map(c => c.section_id).filter(Boolean))].sort();
  const allChecked = _printSections.size === 0;
  const secChips = `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
    <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="checkbox" ${allChecked ? 'checked' : ''} onchange="BakerySection.togglePrintSecAll(this.checked)"> All</label>
    ${sorted.map(s => `<label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="checkbox" ${allChecked || _printSections.has(s) ? 'checked' : ''} onchange="BakerySection.togglePrintSec('${s}',this.checked)"> ${esc(s)}</label>`).join('')}
  </div>`;

  // Store select for slip
  let slipSelect = '';
  if (_printTab === 'slip') {
    if (!_slipStore && d.stores?.length) _slipStore = d.stores[0];
    slipSelect = `<div style="margin-bottom:8px"><select class="wf-select" style="max-width:300px" onchange="BakerySection.setSlipStore(this.value)">
      ${(d.stores || []).map(s => `<option value="${s}"${s === _slipStore ? ' selected' : ''}>${esc(BK.getStoreName(s))} (${s})</option>`).join('')}
    </select></div>`;
  }

  // Print area
  const printArea = _printTab === 'sheet' ? _renderProductionSheet(d) : _renderDeliverySlip(d);

  el.innerHTML = `${filterBar}${tabs}${secChips}${slipSelect}
    <div class="sec-title">Production Sheet</div>
    ${printArea}`;
}

function _renderProductionSheet(d) {
  let prods = d.products || [];
  if (_printSections.size > 0) prods = prods.filter(p => _printSections.has(p.section_id));
  if (!prods.length) return '<div class="empty"><div class="empty-icon">\uD83D\uDCE6</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23</div></div>';

  const stores = d.stores || [];
  const orderIds = (d.orders || []).map(o => o.order_id);
  const ROWS_PER_PAGE = 30;
  const totalPages = Math.ceil(prods.length / ROWS_PER_PAGE);
  const sectionLabel = _printSections.size === 0 ? 'ALL' : [..._printSections].join(', ').toUpperCase();
  const orderStr = orderIds.length > 3 ? orderIds.slice(0, 3).join(', ') + '...' : orderIds.join(', ');

  const thRow = `<tr><th>Product</th>${stores.map(s => '<th style="text-align:center">' + esc(s) + '</th>').join('')}<th style="text-align:center;font-weight:800">TOTAL</th></tr>`;

  function prodRow(p) {
    return `<tr>
      <td>${esc(p.product_name)}</td>
      ${stores.map(s => { const sv = p.stores[s]; if (!sv) return '<td style="text-align:center">\u2014</td>'; return '<td style="text-align:center">' + sv.qty + (sv.urgent ? '*' : '') + '</td>'; }).join('')}
      <td style="text-align:center;font-weight:800">${p.total}</td>
    </tr>`;
  }

  // Screen table
  let screen = '<div class="print-screen-only">';
  screen += `<table class="wf-table"><thead>${thRow}</thead><tbody>`;
  prods.forEach(p => { screen += prodRow(p); });
  screen += '</tbody></table>';
  screen += '<div style="font-size:10px;color:var(--t3);margin-top:4px">* = URGENT \u26A1 | Sorted A-Z by product name</div>';
  screen += '</div>';

  // Print pages
  function pageHeader() {
    return `<div class="print-page-header"><div class="print-page-title">PRODUCTION SHEET \u2014 ${sectionLabel}</div><div class="print-page-sub">Delivery: ${BK.fmtDateThai(_printDate)} | Orders: ${orderStr}</div></div>`;
  }

  let print = '';
  for (let page = 0; page < totalPages; page++) {
    const chunk = prods.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
    print += '<div class="print-page">';
    print += pageHeader();
    print += `<table class="wf-table"><thead>${thRow}</thead><tbody>`;
    chunk.forEach(p => { print += prodRow(p); });
    print += '</tbody></table>';
    if (page === totalPages - 1) {
      print += '<div class="print-legend">* = URGENT \u26A1 | Sorted A-Z by product name</div>';
    }
    print += '<div class="print-page-footer">\u0E2B\u0E19\u0E49\u0E32 ' + (page + 1) + ' \u0E08\u0E32\u0E01 ' + totalPages + '</div>';
    print += '</div>';
  }

  return screen + print;
}

function _renderDeliverySlip(d) {
  if (!_slipStore) return '<div class="empty"><div class="empty-icon">\uD83D\uDCE6</div><div class="empty-title">\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E23\u0E49\u0E32\u0E19</div></div>';

  let prods = (d.products || []).filter(p => p.stores[_slipStore]);
  if (_printSections.size > 0) prods = prods.filter(p => _printSections.has(p.section_id));
  if (!prods.length) return '<div class="empty"><div class="empty-icon">\uD83D\uDCE6</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E23\u0E49\u0E32\u0E19\u0E19\u0E35\u0E49</div></div>';

  // Group by section
  const sections = {};
  prods.forEach(p => {
    const sec = p.section_id || 'other';
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(p);
  });

  const storeOrders = (d.orders || []).filter(o => o.store_id === _slipStore);
  const orderStr = storeOrders.map(o => o.order_id).join(', ');
  const storeName = BK.getStoreName(_slipStore);
  const ROWS_PER_PAGE = 30;

  const lines = [];
  for (const sec of Object.keys(sections).sort()) {
    lines.push({ type: 'section', label: sec.toUpperCase() });
    sections[sec].forEach(p => {
      const sv = p.stores[_slipStore];
      lines.push({ type: 'item', name: p.product_name, qty: sv.qty, qty_sent: sv.qty_sent || 0, urgent: sv?.urgent });
    });
  }

  function renderLine(ln) {
    if (ln.type === 'section') {
      return '<div style="font-weight:700;margin:6px 0 2px;border-top:1px solid #eee;padding-top:4px">\u2550\u2550\u2550 ' + esc(ln.label) + ' \u2550\u2550\u2550</div>';
    }
    const star = ln.urgent ? '\u2B50 ' : '';
    const fill = ln.qty_sent > 0 ? '__' + ln.qty_sent + '__' : '____';
    return '<div style="display:flex;justify-content:space-between;padding:1px 0"><span>' + star + '<b>' + esc(ln.name) + '</b></span><span>' + ln.qty + ' \u2192 ' + fill + '</span></div>';
  }

  function slipHeader() {
    return '<div style="text-align:center;border-bottom:1px dashed #ccc;padding-bottom:6px;margin-bottom:6px"><div style="font-size:14px;font-weight:700">' + esc(storeName) + '</div><div>Delivery: ' + BK.fmtDateThai(_printDate) + '</div><div style="font-size:10px;color:#aaa">Orders: ' + esc(orderStr) + '</div></div>';
  }

  // Screen slip
  let screen = '<div class="print-screen-only">';
  screen += '<div style="border:1px solid #ccc;padding:12px;font-size:12px;max-width:300px;margin:8px auto;font-family:monospace;line-height:1.5">';
  screen += slipHeader();
  lines.forEach(ln => { screen += renderLine(ln); });
  screen += '<div style="border-top:1px dashed #ccc;margin-top:8px;padding-top:6px;font-size:10px">Packed by: ____________<br>Checked by: ___________</div>';
  screen += '</div>';
  screen += '<div style="text-align:center;margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">';
  screen += '<button class="wf-btn-gradient" style="padding:10px 24px" onclick="BakerySection.printThermalSlip()">\uD83D\uDDA8\uFE0F Print</button>';
  screen += '<button class="wf-btn" style="padding:10px 16px;font-size:11px;border:1px solid var(--bd);background:transparent" onclick="window.print()">\uD83D\uDDA8\uFE0F Print A4</button>';
  screen += '</div>';
  screen += '</div>';

  // Print pages
  const totalPages = Math.max(1, Math.ceil(lines.length / ROWS_PER_PAGE));
  let print = '';
  for (let page = 0; page < totalPages; page++) {
    const chunk = lines.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
    print += '<div class="print-page">';
    print += '<div style="border:1px solid #ccc;padding:12px;font-size:12px;max-width:300px;margin:0 auto;font-family:monospace;line-height:1.5">';
    print += slipHeader();
    chunk.forEach(ln => { print += renderLine(ln); });
    if (page === totalPages - 1) {
      print += '<div style="border-top:1px dashed #ccc;margin-top:8px;padding-top:6px;font-size:10px">Packed by: ____________<br>Checked by: ___________</div>';
    }
    print += '</div>';
    print += '<div style="text-align:center;font-size:10px;color:#999;margin-top:8px">Page ' + (page + 1) + ' of ' + totalPages + '</div>';
    print += '</div>';
  }

  return screen + print;
}

// Thermal Print (Epson TM-M30III via ePOS XML)
function _escXml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

async function printThermalSlip() {
  const ip = S.config?.thermal_printer_ip;
  if (!ip) {
    SPG.toast('\u0E01\u0E23\u0E38\u0E13\u0E32\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 Printer IP \u0E43\u0E19 Admin > System Config', 'warning');
    return;
  }

  const d = S.printData;
  if (!d || !_slipStore) { SPG.toast('\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E1E\u0E34\u0E21\u0E1E\u0E4C', 'warning'); return; }

  let prods = (d.products || []).filter(p => p.stores[_slipStore]);
  if (_printSections.size > 0) prods = prods.filter(p => _printSections.has(p.section_id));
  if (!prods.length) { SPG.toast('\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E2A\u0E33\u0E2B\u0E23\u0E31\u0E1A\u0E23\u0E49\u0E32\u0E19\u0E19\u0E35\u0E49', 'warning'); return; }

  const thermalSections = {};
  prods.forEach(p => {
    const sec = p.section_id || 'other';
    if (!thermalSections[sec]) thermalSections[sec] = [];
    thermalSections[sec].push(p);
  });

  const storeOrders = (d.orders || []).filter(o => o.store_id === _slipStore);
  const orderStr = storeOrders.map(o => o.order_id).join(', ');
  const storeName = BK.getStoreName(_slipStore);
  const W = 48;
  const line = (ch, len) => ch.repeat(len || W);
  const pad = (l, r, w) => { const sp = w - l.length - r.length; return l + (sp > 0 ? ' '.repeat(sp) : ' ') + r; };

  let cmds = '';
  cmds += '<text align="center" smooth="true"/>';
  cmds += '<text dw="true" dh="true"/>';
  cmds += '<text>SPG Bakery&#10;</text>';
  cmds += '<text dw="false" dh="false"/>';
  cmds += '<text>' + _escXml(line('=')) + '&#10;</text>';
  cmds += '<text align="left"/>';
  cmds += '<text>Store: ' + _escXml(storeName) + '&#10;</text>';
  cmds += '<text>Date:  ' + _escXml(BK.fmtDateThai(_printDate)) + '&#10;</text>';
  if (orderStr) cmds += '<text>Orders: ' + _escXml(orderStr) + '&#10;</text>';
  cmds += '<text>' + _escXml(line('-')) + '&#10;</text>';

  for (const sec of Object.keys(thermalSections).sort()) {
    cmds += '<text em="true"/>';
    cmds += '<text>=== ' + _escXml(sec.toUpperCase()) + ' ===&#10;</text>';
    cmds += '<text em="false"/>';
    thermalSections[sec].forEach(p => {
      const sv = p.stores[_slipStore];
      const star = sv.urgent ? '\u2B50 ' : '';
      const name = star + p.product_name;
      const qty = 'x ' + sv.qty;
      cmds += '<text>' + _escXml(pad(name, qty, W)) + '&#10;</text>';
    });
    cmds += '<text>&#10;</text>';
  }

  cmds += '<text>' + _escXml(line('-')) + '&#10;</text>';
  cmds += '<text>Packed by:  ____________&#10;</text>';
  cmds += '<text>Checked by: ____________&#10;</text>';
  cmds += '<text>' + _escXml(line('=')) + '&#10;</text>';
  cmds += '<feed line="3"/>';
  cmds += '<cut type="feed"/>';

  const xml = '<?xml version="1.0" encoding="utf-8"?>'
    + '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">'
    + '<s:Body>'
    + '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">'
    + cmds
    + '</epos-print>'
    + '</s:Body>'
    + '</s:Envelope>';

  SPG.toast('\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1E\u0E34\u0E21\u0E1E\u0E4C...', 'info');
  try {
    const url = 'https://' + ip + '/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000';
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8' },
      body: xml,
      mode: 'no-cors',
    });
    SPG.toast('\u2705 \u0E1E\u0E34\u0E21\u0E1E\u0E4C\u0E2A\u0E33\u0E40\u0E23\u0E47\u0E08', 'success');
  } catch (e) {
    console.error('Thermal print error:', e);
    SPG.toast('\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E40\u0E0A\u0E37\u0E48\u0E2D\u0E21\u0E15\u0E48\u0E2D Printer \u2014 \u0E40\u0E0A\u0E47\u0E04 IP \u0E41\u0E25\u0E30 WiFi', 'error');
  }
}

function setPrintTab(tab) { _printTab = tab; _fillPrint(); }
function togglePrintSec(sec, checked) {
  const d = S.printData;
  const allSecs = new Set();
  (d?.products || []).forEach(p => { if (p.section_id) allSecs.add(p.section_id); });

  if (_printSections.size === 0 && !checked) {
    _printSections = new Set(allSecs);
    _printSections.delete(sec);
  } else if (checked) {
    _printSections.add(sec);
    if (_printSections.size >= allSecs.size) _printSections = new Set();
  } else {
    _printSections.delete(sec);
    if (_printSections.size === 0) _printSections = new Set();
  }
  _fillPrint();
}
function togglePrintSecAll(checked) {
  _printSections = new Set();
  _fillPrint();
}
function setSlipStore(sid) { _slipStore = sid; _fillPrint(); }
function setPrintDate(val) { _printDate = val; BK.loadPrint({}); }


// ═══════════════════════════════════════
// 5. INCOMING RETURNS
// ═══════════════════════════════════════
let _bcRetDateFrom = '';
let _bcRetDateTo = '';
let _bcRetFilter = 'all';
let _bcRetShowCount = 20;

BK.renderBcReturns = function(p) {
  const y = BK.sydneyNow(); y.setDate(y.getDate() - 7);
  const t = BK.sydneyNow(); t.setDate(t.getDate() + 1);
  _bcRetDateFrom = BK.fmtDate(y);
  _bcRetDateTo = BK.fmtDate(t);
  _bcRetFilter = 'all';
  _bcRetShowCount = 20;
  return SPG.shell(SPG.toolbar('Incoming Returns') + `
    <div class="content">
      <div class="wf-filter-bar" style="margin-bottom:8px">
        <span style="font-size:12px;font-weight:600">\uD83D\uDCC5 Date:</span>
        <input class="wf-input" type="date" value="${_bcRetDateFrom}" style="width:140px" onchange="BakerySection.setBCRetDate('from',this.value)">
        <span style="color:var(--t4)">\u2192</span>
        <input class="wf-input" type="date" value="${_bcRetDateTo}" style="width:140px" onchange="BakerySection.setBCRetDate('to',this.value)">
      </div>
      <div id="bcRetContent"><div class="skel skel-card"></div></div>
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
  const el = document.getElementById('bcRetContent');
  if (!el) return;

  const all = S.returns || [];
  // Date filter
  let filtered = all;
  if (_bcRetDateFrom) filtered = filtered.filter(r => (r.created_at || '').substring(0, 10) >= _bcRetDateFrom);
  if (_bcRetDateTo) filtered = filtered.filter(r => (r.created_at || '').substring(0, 10) <= _bcRetDateTo);

  if (!filtered.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">\u21A9\uFE0F</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E21\u0E35 Return</div></div>';
    return;
  }

  // Build wireframe table
  const rows = filtered.slice(0, _bcRetShowCount).map(r => {
    const dateStr = BK.fmtDateAU((r.created_at || '').substring(0, 10));
    const store = r.store_id || '';
    const orderId = r.order_id || r.return_id || '';
    const isPending = r.status === 'Reported';
    const isReceived = r.status === 'Received';

    // Status badge
    let badgeStyle;
    if (isPending) badgeStyle = 'background:var(--orange-bg);color:var(--orange)';
    else if (isReceived) badgeStyle = 'background:var(--blue-bg);color:var(--blue)';
    else badgeStyle = 'background:var(--green-bg);color:var(--green)';
    const statusLabel = r.status === 'Reported' ? 'Pending' : r.status;

    // Action buttons
    let actionHtml = '';
    if (isPending) {
      actionHtml = `<button class="wf-btn wf-btn-success" style="padding:2px 8px;font-size:10px" onclick="BakerySection.doReceiveReturn('${r.return_id}')">\uD83D\uDCE5 Receive</button> <button class="wf-btn wf-btn-danger" style="padding:2px 8px;font-size:10px" onclick="BakerySection.showBCRetDetail('${r.return_id}')">Detail</button>`;
    } else if (isReceived) {
      actionHtml = `<button class="wf-btn wf-btn-success" style="padding:2px 8px;font-size:10px" onclick="BakerySection.doResolveReturn('${r.return_id}','rework')">\u267B Rework</button> <button class="wf-btn wf-btn-danger" style="padding:2px 8px;font-size:10px" onclick="BakerySection.doResolveReturn('${r.return_id}','waste')">\uD83D\uDDD1 Waste</button>`;
    }

    return `<tr>
      <td>${esc(dateStr)}</td>
      <td>${esc(store)}</td>
      <td style="color:var(--acc)">${esc(orderId)}</td>
      <td>${esc(r.product_name)}</td>
      <td>${r.quantity || 0}</td>
      <td>${esc(r.issue_type || '')}</td>
      <td><span class="wf-badge" style="${badgeStyle}">${esc(statusLabel)}</span></td>
      <td>${actionHtml}</td>
    </tr>`;
  }).join('');

  const hasMore = filtered.length > _bcRetShowCount;

  el.innerHTML = `<table class="wf-table">
    <thead><tr><th>Date</th><th>Store</th><th>Order ID</th><th>Product</th><th>Qty</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${hasMore ? `<div style="text-align:center;margin-top:8px"><button class="wf-btn" style="padding:6px 16px;font-size:12px;border:1px solid var(--bd);background:transparent" onclick="BakerySection.showMoreBCRet()">\u0E41\u0E2A\u0E14\u0E07\u0E40\u0E1E\u0E34\u0E48\u0E21 (${_bcRetShowCount}/${filtered.length})</button></div>` : ''}`;
}

let _doReceiveBusy = false;
async function doReceiveReturn(returnId) {
  if (_doReceiveBusy) return;
  _doReceiveBusy = true;
  try {
    const resp = await BK.api('receive_return', { return_id: returnId });
    if (resp.success) {
      SPG.toast(resp.message || '\u2705 Receive \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22', 'success');
      const r = (S.returns || []).find(x => x.return_id === returnId);
      if (r) r.status = 'Received';
      _fillBcReturns();
    } else {
      SPG.toast(resp.message || 'Error', 'error');
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
  } finally {
    _doReceiveBusy = false;
  }
}

let _doResolveBusy = false;
async function doResolveReturn(returnId, resolution) {
  if (_doResolveBusy) return;
  _doResolveBusy = true;
  try {
    const resp = await BK.api('resolve_return', { return_id: returnId, resolution });
    if (resp.success) {
      SPG.toast(resp.message || '\u2705 \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22', 'success');
      const r = (S.returns || []).find(x => x.return_id === returnId);
      if (r) r.status = resolution === 'rework' ? 'Reworked' : 'Wasted';
      if (resolution === 'waste') S._wasteLoaded = false;
      _fillBcReturns();
    } else {
      SPG.toast(resp.message || 'Error', 'error');
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
  } finally {
    _doResolveBusy = false;
  }
}

function showBCRetDetail(returnId) {
  const r = (S.returns || []).find(x => x.return_id === returnId);
  if (!r) return;

  const stsStyle = {
    Reported: 'background:#fffbeb;color:#92400e',
    Received: 'background:var(--blue-bg);color:#1e40af',
    Reworked: 'background:var(--green-bg);color:#065f46',
    Wasted:   'background:var(--red-bg);color:var(--red)',
  }[r.status] || '';

  // Timeline
  const reportDate = BK.fmtDateAU((r.created_at || '').substring(0, 10));
  let timeline = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
    <div style="width:8px;height:8px;border-radius:50%;background:var(--orange)"></div>
    <span style="font-size:12px"><b>Reported</b> \u2014 ${esc(r.reported_by_name)} \u00B7 ${reportDate}</span>
  </div>`;

  if (['Received', 'Reworked', 'Wasted'].includes(r.status)) {
    const recDate = r.received_at ? BK.fmtDateAU(r.received_at.substring(0, 10)) : '';
    timeline += `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
      <div style="width:8px;height:8px;border-radius:50%;background:var(--blue)"></div>
      <span style="font-size:12px"><b>Received</b> \u00B7 ${recDate}</span>
    </div>`;
  }
  if (['Reworked', 'Wasted'].includes(r.status)) {
    const resDate = r.resolved_at ? BK.fmtDateAU(r.resolved_at.substring(0, 10)) : '';
    const resColor = r.status === 'Reworked' ? 'var(--green)' : 'var(--red)';
    timeline += `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">
      <div style="width:8px;height:8px;border-radius:50%;background:${resColor}"></div>
      <span style="font-size:12px"><b>${r.status}</b> ${r.resolved_by_name ? '\u2014 ' + esc(r.resolved_by_name) : ''} \u00B7 ${resDate}</span>
    </div>`;
  }
  if (r.status === 'Reported') {
    timeline += `<div style="display:flex;gap:8px;align-items:center;color:var(--t4)">
      <div style="width:8px;height:8px;border-radius:50%;background:var(--bd);border:1px dashed var(--t4)"></div>
      <span style="font-size:12px">Waiting for BC...</span>
    </div>`;
  }
  if (r.status === 'Received') {
    timeline += `<div style="display:flex;gap:8px;align-items:center;color:var(--t4)">
      <div style="width:8px;height:8px;border-radius:50%;background:var(--bd);border:1px dashed var(--t4)"></div>
      <span style="font-size:12px">Waiting resolve...</span>
    </div>`;
  }

  let actionBtns = '';
  if (r.status === 'Reported') {
    actionBtns = `<button class="wf-btn wf-btn-success" style="flex:1" onclick="SPG.closeDialog();BakerySection.doReceiveReturn('${r.return_id}')">\uD83D\uDCE5 Receive</button>`;
  } else if (r.status === 'Received') {
    actionBtns = `<button class="wf-btn wf-btn-success" style="flex:1" onclick="SPG.closeDialog();BakerySection.doResolveReturn('${r.return_id}','rework')">\u267B\uFE0F Rework</button>
      <button class="wf-btn wf-btn-danger" style="flex:1" onclick="SPG.closeDialog();BakerySection.doResolveReturn('${r.return_id}','waste')">\uD83D\uDDD1\uFE0F Waste</button>`;
  }

  SPG.showDialog(`<div class="popup-sheet" style="width:420px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:15px;font-weight:700">\u21A9\uFE0F ${esc(r.return_id)}</div>
      <span class="wf-badge" style="${stsStyle}">${r.status}</span>
    </div>
    <div style="font-size:13px;font-weight:600;margin-bottom:4px">${esc(r.product_name)} \u00B7 ${r.quantity} ${esc(r.unit)}</div>
    <div style="font-size:12px;color:var(--t2);margin-bottom:12px;line-height:1.6">
      ${esc(r.issue_type)}${r.description ? ' \u00B7 ' + esc(r.description) : ''}<br>
      \uD83D\uDCE6 ${esc(r.action === 'return_to_bakery' ? 'Return to BC' : 'Discard at store')}<br>
      ${r.production_date ? 'Production: ' + BK.fmtDateThai(r.production_date) : ''}
    </div>
    <div style="font-size:12px;font-weight:600;margin-bottom:6px">\uD83D\uDCCA Timeline</div>
    <div style="margin-bottom:14px">${timeline}</div>
    <div style="display:flex;gap:8px">
      ${actionBtns}
      <button class="wf-btn" style="flex:1;border:1px solid var(--bd);background:transparent" onclick="SPG.closeDialog()">\u2190 Close</button>
    </div>
  </div>`);
}

function setBCRetDate(which, val) { if (which === 'from') _bcRetDateFrom = val; else _bcRetDateTo = val; _fillBcReturns(); }
function setBCRetPreset(p) {
  if (p === '3day') { const y = BK.sydneyNow(); y.setDate(y.getDate() - 3); _bcRetDateFrom = BK.fmtDate(y); const t = BK.sydneyNow(); t.setDate(t.getDate() + 1); _bcRetDateTo = BK.fmtDate(t); }
  else { _bcRetDateFrom = ''; _bcRetDateTo = ''; }
  _fillBcReturns();
}
function setBCRetFilter(f) { _bcRetFilter = f; _bcRetShowCount = 20; _fillBcReturns(); }
function showMoreBCRet() { _bcRetShowCount += 20; _fillBcReturns(); }


// ═══════════════════════════════════════
// 6. PRODUCT MANAGEMENT
// ═══════════════════════════════════════
let _prodTab = 'active';
let _prodSearch = '';
let _prodSectionFilter = 'all';

BK.renderProducts = function(p) {
  _prodTab = 'active'; _prodSearch = ''; _prodSectionFilter = 'all';
  return SPG.shell(SPG.toolbar('Manage Products') + `
    <div class="content">
      <div class="wf-filter-bar" id="prodFilterBar">
        <input class="wf-search" placeholder="Search products..." id="prodSearchInp" oninput="BakerySection.filterProds(this.value)">
        <button class="wf-btn-gradient" style="margin-left:auto;padding:6px 16px;font-size:12px" onclick="SPG.go('bakery/prod-edit',{id:'new'})">+ Add Product</button>
      </div>
      <div id="prodResults"><div class="skel skel-card"></div></div>
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
  const resEl = document.getElementById('prodResults');
  if (!resEl) return;
  const prods = S.adminProducts;
  if (!prods) { resEl.innerHTML = '<div class="empty"><div class="empty-icon">\uD83D\uDCE6</div><div class="empty-title">\u0E01\u0E33\u0E25\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14...</div></div>'; return; }

  let filtered = prods;
  if (_prodSearch) { const s = _prodSearch.toLowerCase(); filtered = filtered.filter(p => (p.product_name || '').toLowerCase().includes(s)); }

  if (!filtered.length) {
    resEl.innerHTML = '<div class="empty"><div class="empty-icon">\uD83D\uDD0D</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</div></div>';
    return;
  }

  const rows = filtered.map(p => {
    const catName = ((S.categories || []).find(c => c.cat_id === p.category_id) || {}).cat_name || p.category_id || '';
    const stsBadge = p.is_active
      ? '<span class="wf-badge" style="background:var(--green-bg);color:var(--green)">Active</span>'
      : '<span class="wf-badge" style="background:var(--bg3);color:var(--t3)">Disabled</span>';
    return `<tr>
      <td>${esc(p.product_name)}</td>
      <td>${esc(catName)}</td>
      <td>${p.min_order || 1}</td>
      <td>${esc(p.unit || 'pcs')}</td>
      <td>${stsBadge}</td>
      <td><span style="color:var(--acc);cursor:pointer;font-size:11px" onclick="SPG.go('bakery/prod-edit',{id:'${p.product_id}'})">Edit</span></td>
    </tr>`;
  }).join('');

  resEl.innerHTML = `<table class="wf-table">
    <thead><tr><th>Product</th><th>Category</th><th>Default Quota</th><th>Unit</th><th>Status</th><th>Action</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function setProdTab(tab) { _prodTab = tab; _prodSectionFilter = 'all'; _fillProducts(); }
function filterProds(val) {
  _prodSearch = val;
  _fillProducts();
}
function setProdSection(sec) { _prodSectionFilter = sec; _fillProducts(); }


// ═══════════════════════════════════════
// 7. PRODUCT EDIT
// ═══════════════════════════════════════
let _pendingImageUrl = '';

BK.renderProdEdit = function(p) {
  return SPG.shell(SPG.toolbar('Edit Product') + `
    <div class="content" style="max-width:500px" id="prodEditContent"><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.loadProdEdit = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  const productId = p?.id;
  const isNew = !productId || productId === 'new';

  let product = null;
  if (!isNew) {
    if (S.adminProducts) {
      product = S.adminProducts.find(pr => pr.product_id === productId);
    }
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
  const el = document.getElementById('prodEditContent');
  if (!el) return;

  const p = product || {};
  if (!isNew && !p.product_id) { el.innerHTML = '<div class="empty"><div class="empty-icon">\u274C</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</div></div>'; return; }

  _pendingImageUrl = p.image_url || '';

  const cats = S.categories || [];
  const catOpts = cats.map(c => `<option value="${c.cat_id}"${c.cat_id === (p.category_id || '') ? ' selected' : ''}>${esc(c.cat_name)}</option>`).join('');

  const secs = [...new Set(cats.map(c => c.section_id).filter(Boolean))].sort();
  const secOpts = secs.map(s => `<option value="${s}"${s === (p.section_id || '') ? ' selected' : ''}>${esc(s)}</option>`).join('');

  const channels = S.adminChannels || [];
  const vis = p.visibility || [];
  const visSet = new Set(vis.map(v => v.store_id + '|' + v.dept_id));

  const visRows = channels.map(ch => {
    const key = ch.store_id + '|' + ch.dept_id;
    const checked = visSet.has(key);
    return `<div style="display:flex;justify-content:space-between;padding:5px 8px;background:var(--bg);border:1px solid var(--bd2);border-radius:4px">
      <span style="font-size:10px;font-weight:600">${esc(BK.getStoreName(ch.store_id))} \u00B7 ${esc(ch.dept_id)}</span>
      <input type="checkbox" class="vis-cb" data-store="${ch.store_id}" data-dept="${ch.dept_id}"${checked ? ' checked' : ''}>
    </div>`;
  }).join('');

  const isActive = p.is_active !== false;

  const imgPreview = _pendingImageUrl
    ? `<img src="${esc(_pendingImageUrl)}" style="max-width:100%;max-height:120px;border-radius:var(--rd);object-fit:contain;margin-bottom:6px">`
    : '';

  el.innerHTML = `
    <div class="wf-card" style="margin-bottom:10px">
      <div style="font-size:15px;font-weight:700;margin-bottom:14px">${isNew ? '\u2795 Add Product' : '\u270F\uFE0F ' + esc(p.product_name)}</div>
      <div class="wf-form-group"><label class="wf-label">\u2776 Product Name *</label><input class="wf-input" id="peNameInput" value="${esc(p.product_name || '')}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="wf-form-group"><label class="wf-label">\u2777 Category *</label><select class="wf-input" id="peCatInput"><option value="">-- select --</option>${catOpts}</select></div>
        <div class="wf-form-group"><label class="wf-label">\u2778 Section *</label><select class="wf-input" id="peSecInput"><option value="">-- select --</option>${secOpts}</select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div class="wf-form-group"><label class="wf-label">\u2779 Unit</label><select class="wf-input" id="peUnitInput"><option value="pcs"${(p.unit || 'pcs') === 'pcs' ? ' selected' : ''}>pcs</option><option value="btl"${'btl' === p.unit ? ' selected' : ''}>btl</option><option value="pack"${'pack' === p.unit ? ' selected' : ''}>pack</option><option value="kg"${'kg' === p.unit ? ' selected' : ''}>kg</option><option value="box"${'box' === p.unit ? ' selected' : ''}>box</option></select></div>
        <div class="wf-form-group"><label class="wf-label">\u277A Min Order</label><input class="wf-input" type="number" id="peMinInput" value="${p.min_order || 1}" min="1"></div>
        <div class="wf-form-group"><label class="wf-label">\u277B Step</label><input class="wf-input" type="number" id="peStepInput" value="${p.order_step || 1}" min="1"></div>
      </div>
      <div class="wf-form-group"><label class="wf-label">\u277C Product Image</label>
        <div id="peImgPreview">${imgPreview}</div>
        <div class="img-drop-zone" id="peImgDrop" onclick="document.getElementById('peImgFile').click()" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="event.preventDefault();this.classList.remove('drag-over');BakerySection.handleImageDrop(event)">
          <div class="img-drop-icon">\uD83D\uDCF7</div>
          <div class="img-drop-text">Drop image here or click to upload</div>
          <div class="img-drop-hint">JPG, PNG, WebP — max 5MB</div>
        </div>
        <input type="file" id="peImgFile" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none" onchange="BakerySection.handleImageFile(this.files[0])">
        <div id="peImgStatus" style="font-size:10px;color:var(--t3);margin-top:4px"></div>
      </div>
      <div class="wf-form-group"><label class="wf-label">Status</label><div style="display:flex;gap:8px">
        <div class="wf-chip${isActive ? ' active' : ''}" id="peStsActive" onclick="document.getElementById('peStsActive').classList.add('active');document.getElementById('peStsHidden').classList.remove('active')">Active</div>
        <div class="wf-chip${!isActive ? ' active' : ''}" id="peStsHidden" onclick="document.getElementById('peStsHidden').classList.add('active');document.getElementById('peStsActive').classList.remove('active')">Hidden</div>
      </div></div>
    </div>
    <div class="wf-card" style="margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:6px">\uD83D\uDC41\uFE0F Store Visibility</div>
      <div style="font-size:10px;color:var(--t4);margin-bottom:6px">Select stores that can order this product</div>
      <div style="display:flex;flex-direction:column;gap:2px;margin-bottom:8px">${visRows}</div>
      <div style="display:flex;gap:8px;font-size:10px">
        <span style="color:var(--blue);cursor:pointer" onclick="document.querySelectorAll('.vis-cb').forEach(c=>c.checked=true)">\u2705 Select all</span>
        <span style="color:var(--red);cursor:pointer" onclick="document.querySelectorAll('.vis-cb').forEach(c=>c.checked=false)">\u274C Deselect all</span>
      </div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="wf-btn" style="flex:1;border:1px solid var(--bd);background:transparent" onclick="SPG.go('bakery/products')">Cancel</button>
      <button class="wf-btn-gradient" style="flex:1" id="peSaveBtn" onclick="BakerySection.doSaveProduct('${isNew ? '' : p.product_id}')">\uD83D\uDCBE Save</button>
    </div>`;
}

// Image Upload handlers
function handleImageDrop(e) {
  const file = e.dataTransfer?.files?.[0];
  if (file) handleImageFile(file);
}

async function handleImageFile(file) {
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { SPG.toast('\u0E44\u0E1F\u0E25\u0E4C\u0E43\u0E2B\u0E0D\u0E48\u0E40\u0E01\u0E34\u0E19 5MB', 'error'); return; }
  if (!file.type.startsWith('image/')) { SPG.toast('\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E44\u0E1F\u0E25\u0E4C\u0E23\u0E39\u0E1B\u0E20\u0E32\u0E1E', 'error'); return; }

  const statusEl = document.getElementById('peImgStatus');
  const previewEl = document.getElementById('peImgPreview');
  const dropEl = document.getElementById('peImgDrop');
  if (statusEl) statusEl.innerHTML = '<span style="color:var(--acc)">\u0E01\u0E33\u0E25\u0E31\u0E07\u0E2D\u0E31\u0E1B\u0E42\u0E2B\u0E25\u0E14...</span>';

  const reader = new FileReader();
  reader.onload = async () => {
    const base64 = reader.result.split(',')[1];
    const ext = file.type.split('/')[1] || 'jpg';
    try {
      const resp = await BK.api('upload_image', { data: base64, ext, content_type: file.type });
      if (resp.success && resp.data?.url) {
        _pendingImageUrl = resp.data.url;
        if (previewEl) previewEl.innerHTML = `<img src="${esc(resp.data.url)}" style="max-width:100%;max-height:120px;border-radius:var(--rd);object-fit:contain;margin-bottom:6px">`;
        if (dropEl) dropEl.style.display = 'none';
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--green)">\u2705 \u0E2D\u0E31\u0E1B\u0E42\u0E2B\u0E25\u0E14\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22</span> <span style="color:var(--blue);cursor:pointer" onclick="BakerySection.resetImage()">\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E23\u0E39\u0E1B</span>';
      } else {
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--red)">\u274C ' + esc(resp.message || 'Upload failed') + '</span>';
      }
    } catch (e) {
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--red)">\u274C Network error</span>';
    }
  };
  reader.readAsDataURL(file);
}

function resetImage() {
  _pendingImageUrl = '';
  const previewEl = document.getElementById('peImgPreview');
  const dropEl = document.getElementById('peImgDrop');
  const statusEl = document.getElementById('peImgStatus');
  if (previewEl) previewEl.innerHTML = '';
  if (dropEl) dropEl.style.display = '';
  if (statusEl) statusEl.innerHTML = '';
}

async function doSaveProduct(productId) {
  const btn = document.getElementById('peSaveBtn');
  if (!btn || btn.disabled) return;

  const name = document.getElementById('peNameInput')?.value?.trim();
  const catId = document.getElementById('peCatInput')?.value;
  const secId = document.getElementById('peSecInput')?.value;
  const unit = document.getElementById('peUnitInput')?.value || 'pcs';
  const minOrder = parseInt(document.getElementById('peMinInput')?.value) || 1;
  const step = parseInt(document.getElementById('peStepInput')?.value) || 1;
  const imgUrl = _pendingImageUrl || '';
  const isActive = document.getElementById('peStsActive')?.classList.contains('active');

  if (!name) { SPG.toast('\u0E01\u0E23\u0E38\u0E13\u0E32\u0E43\u0E2A\u0E48\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32', 'error'); return; }
  if (!catId) { SPG.toast('\u0E40\u0E25\u0E37\u0E2D\u0E01 Category', 'error'); return; }
  if (!secId) { SPG.toast('\u0E40\u0E25\u0E37\u0E2D\u0E01 Section', 'error'); return; }

  const visibility = [];
  document.querySelectorAll('.vis-cb:checked').forEach(cb => {
    visibility.push({ store_id: cb.dataset.store, dept_id: cb.dataset.dept });
  });

  btn.disabled = true; btn.textContent = '\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01...';
  try {
    const resp = await BK.api('save_product', {
      product_id: productId || undefined,
      product_name: name, category_id: catId, section_id: secId,
      unit, min_order: minOrder, order_step: step,
      image_url: imgUrl, is_active: isActive, visibility,
    });
    if (resp.success) {
      SPG.toast(resp.message || '\u2705 \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22', 'success');
      S.adminProducts = null;
      S._prodsLoaded = false;
      SPG.go('bakery/products');
    } else {
      SPG.toast(resp.message || 'Error', 'error');
      btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save';
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
    btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save';
  }
}


// ═══════════════════════════════════════
// ACTION HANDLERS (Accept/Reject)
// ═══════════════════════════════════════
async function doAcceptOrder(orderId) {
  const btn = document.getElementById('acceptBtn');
  if (btn) { if (btn.disabled) return; btn.disabled = true; btn.textContent = '\u0E01\u0E33\u0E25\u0E31\u0E07 Accept...'; }
  try {
    const resp = await BK.api('accept_order', { order_id: orderId });
    if (resp.success) {
      SPG.toast(resp.message || '\u2705 Accept \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22', 'success');
      if (S.currentOrder?.order) S.currentOrder.order.status = 'Ordered';
      const idx = (S.orders || []).findIndex(o => o.order_id === orderId);
      if (idx >= 0) S.orders[idx].status = 'Ordered';
      // Refresh list if on list view, otherwise go to orders
      if (document.getElementById('acceptChips')) _fillAcceptList();
      else SPG.go('bakery/orders');
    } else {
      SPG.toast(resp.message || 'Error', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '\u2713 Accept All'; }
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '\u2713 Accept All'; }
  }
}

function showRejectDialog(orderId) {
  SPG.showDialog(`<div class="popup-sheet" style="width:340px">
    <div class="popup-title" style="margin-bottom:12px">\u2717 Reject Order?</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:12px">${esc(orderId)}</div>
    <div class="wf-form-group"><label class="wf-label">\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25 *</label><input class="wf-input" id="rejectReason" placeholder="\u0E40\u0E0A\u0E48\u0E19 \u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A\u0E44\u0E21\u0E48\u0E1E\u0E2D..."></div>
    <div style="display:flex;gap:8px"><button class="wf-btn" style="flex:1;border:1px solid var(--bd);background:transparent" onclick="SPG.closeDialog()">\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48</button><button class="wf-btn wf-btn-danger" style="flex:1" id="rejectConfirmBtn" onclick="BakerySection.doRejectOrder('${orderId}')">Reject \u0E40\u0E25\u0E22</button></div>
  </div>`);
}

async function doRejectOrder(orderId) {
  const btn = document.getElementById('rejectConfirmBtn');
  if (!btn || btn.disabled) return;
  const reason = document.getElementById('rejectReason')?.value || '';
  if (!reason.trim()) { SPG.toast('\u0E01\u0E23\u0E38\u0E13\u0E32\u0E43\u0E2A\u0E48\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25', 'error'); return; }

  btn.disabled = true; btn.textContent = '\u0E01\u0E33\u0E25\u0E31\u0E07 Reject...';
  try {
    const resp = await BK.api('reject_order', { order_id: orderId, reason });
    if (resp.success) {
      SPG.closeDialog();
      SPG.toast(resp.message || '\u2705 Reject \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22', 'success');
      if (S.currentOrder?.order) S.currentOrder.order.status = 'Rejected';
      const idx = (S.orders || []).findIndex(o => o.order_id === orderId);
      if (idx >= 0) S.orders[idx].status = 'Rejected';
      if (document.getElementById('acceptChips')) _fillAcceptList();
      else SPG.go('bakery/orders');
    } else {
      SPG.toast(resp.message || 'Error', 'error');
      btn.disabled = false; btn.textContent = 'Reject \u0E40\u0E25\u0E22';
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
    btn.disabled = false; btn.textContent = 'Reject \u0E40\u0E25\u0E22';
  }
}


// ═══════════════════════════════════════
// EXTEND BakerySection (onclick handlers)
// ═══════════════════════════════════════
Object.assign(window.BakerySection, {
  // Accept Order
  doAcceptOrder,
  showRejectDialog,
  doRejectOrder,
  setAcceptTab,

  // Fulfilment
  fulfilFull,
  fulfilPartial,
  fulfilClear,
  setFulfilQty,
  setFulfilNote,
  saveFulfilment,
  doMarkDelivered,

  // Print
  setPrintTab,
  togglePrintSec,
  togglePrintSecAll,
  setSlipStore,
  setPrintDate,
  printThermalSlip,

  // Incoming Returns
  doReceiveReturn,
  doResolveReturn,
  showBCRetDetail,
  setBCRetDate,
  setBCRetPreset,
  setBCRetFilter,
  showMoreBCRet,

  // Products
  setProdTab,
  filterProds,
  setProdSection,
  doSaveProduct,
  handleImageDrop,
  handleImageFile,
  resetImage,
});

})();
