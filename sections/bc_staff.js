/**
 * SPG HUB v1.0.0 | 23 MAR 2026 | Siam Palette Group
 * sections/bc_staff.js — BC Staff Screens (7 pages)
 * BC Dashboard, Accept Order, Fulfilment, Print Centre, Incoming Returns,
 * Product Management, Product Edit
 * (Stock History already implemented in bc_store.js)
 *
 * Depends on: bc_core.js (BK global)
 * Design: Pink #db2777 accent, matches Home layout via SPG.shell/toolbar
 * Ported from legacy screens2_bcorder.js — layout preserved exactly
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
    <div class="content" id="mainContent">
      <div style="margin-bottom:16px"><div style="font-size:14px;font-weight:700;margin-bottom:2px">Welcome, ${esc(s.display_name)}</div><div style="font-size:11px;color:var(--t3)">${esc(s.position_id ? s.position_name : s.tier_id)} \u00B7 BC Staff \u00B7 ${esc(s.dept_id)}</div></div>
      <div class="bc-kpis" id="bcKpis"></div>
      <div class="bc-progress" id="bcProgress"></div>
      <div id="bcAlerts"></div>
      <div class="bc-section-title">Orders</div>
      <div class="bc-menu-grid">
        ${_menuCard('\uD83D\uDCCB', 'View Orders', "SPG.go('bakery/orders')")}
        ${_menuCard('\uD83D\uDDA8\uFE0F', 'Print Centre', "SPG.go('bakery/print')")}
      </div>
      <div class="bc-section-title">Records</div>
      <div class="bc-menu-grid">
        ${_menuCard('\uD83D\uDDD1\uFE0F', 'Record Waste', "SPG.go('bakery/waste')")}
        ${_menuCard('\u21A9\uFE0F', 'Incoming Returns', "SPG.go('bakery/bc-returns')")}
      </div>
      ${BK.hasPerm('fn_manage_products') ? `<div class="bc-section-title">Admin</div>
      <div class="bc-menu-grid">
        ${_menuCard('\uD83D\uDCE6', 'Manage Products', "SPG.go('bakery/products')")}
      </div>` : ''}
    </div>`, 'Bakery');
};

function _menuCard(icon, label, onclick) {
  return `<div class="card" onclick="${onclick}"><div class="card-row"><span>${icon}</span><div class="card-label">${label}</div><span class="card-arrow">\u203A</span></div></div>`;
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
  const d = S.dashboard;
  if (!d?.by_status) return;
  const bs = d.by_status;
  const done = (bs.Fulfilled || 0) + (bs.Delivered || 0);
  const total = d.today_total || 0;
  const pct = total > 0 ? Math.round(done / total * 100) : 0;

  const kpiEl = document.getElementById('bcKpis');
  if (kpiEl) {
    kpiEl.innerHTML = _kpi('Pending', bs.Pending || 0, 'var(--red-bg)', 'var(--red)')
      + _kpi('Ordered', bs.Ordered || 0, 'var(--blue-bg)', 'var(--blue)')
      + _kpi('In Prog', bs.InProgress || 0, 'var(--orange-bg)', 'var(--orange)')
      + _kpi('Done', done, 'var(--green-bg)', 'var(--green)');
  }

  const progEl = document.getElementById('bcProgress');
  if (progEl) {
    progEl.innerHTML = `<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:600;margin-bottom:2px"><span>Today</span><span style="color:var(--green)">${done}/${total}</span></div>
      <div class="bc-progress-bar"><div class="bc-progress-fill" style="width:${pct}%"></div></div>`;
  }

  const alertEl = document.getElementById('bcAlerts');
  if (alertEl) {
    let html = '';
    if (bs.Pending > 0) html += `<div class="bc-alert" style="background:var(--red-bg);color:var(--red)">\uD83D\uDEA8 ${bs.Pending} orders pending accept</div>`;
    if (d.urgent_items > 0) html += `<div class="bc-alert" style="background:#fef3c7;color:#92400e">\u26A1 ${d.urgent_items} urgent items</div>`;
    if (d.pending_returns > 0) html += `<div class="bc-alert" style="background:var(--blue-bg);color:var(--blue)">\u21A9\uFE0F ${d.pending_returns} returns pending</div>`;
    if (html) html += '<div style="height:8px"></div>';
    alertEl.innerHTML = html;
  }
}

function _kpi(label, val, bg, color) {
  return `<div class="bc-kpi" style="background:${bg}"><div class="bc-kpi-label" style="color:${color}">${label}</div><div class="bc-kpi-val" style="color:${color}">${val}</div></div>`;
}


// ═══════════════════════════════════════
// 2. ACCEPT ORDER
// ═══════════════════════════════════════
BK.renderAccept = function(p) {
  return SPG.shell(SPG.toolbar('Accept Order') + `
    <div class="content" id="acceptContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
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
  const el = document.getElementById('acceptContent');
  if (!el) return;
  const data = S.currentOrder;
  if (!data) { el.innerHTML = '<div class="empty"><div class="empty-icon">\u274C</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25</div></div>'; return; }

  const o = data.order;
  const items = data.items || [];
  if (o.status !== 'Pending') {
    el.innerHTML = `<div class="empty"><div class="empty-icon">\u2139\uFE0F</div><div class="empty-title">\u0E2A\u0E16\u0E32\u0E19\u0E30 ${esc(o.status)}</div><div class="empty-desc">Accept \u0E44\u0E14\u0E49\u0E40\u0E09\u0E1E\u0E32\u0E30 Pending \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19</div><button class="btn btn-outline" style="margin-top:12px" onclick="SPG.go('bakery/order-detail',{id:'${o.order_id}'})">\u0E14\u0E39\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14 \u2192</button></div>`;
    return;
  }

  const cutoffBadge = o.is_cutoff_violation ? '<span class="sts sts-pending" style="margin-left:6px">cutoff</span>' : '';

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
    <div style="display:flex;flex-direction:column;gap:5px">
      <button class="btn btn-green btn-full" id="acceptBtn" onclick="BakerySection.doAcceptOrder('${o.order_id}')">\u2713 Accept All</button>
      <button class="btn btn-danger btn-full" id="rejectBtn" onclick="BakerySection.showRejectDialog('${o.order_id}')">\u2717 Reject</button>
      <button class="btn btn-outline btn-full" style="color:var(--red);border-color:var(--red)" onclick="BakerySection.confirmCancel('${o.order_id}')">\uD83D\uDEAB Cancel Order</button>
    </div>`;
}


// ═══════════════════════════════════════
// 3. FULFILMENT
// ═══════════════════════════════════════
let _fulfilState = {}; // { item_id: { status, qty_sent, note } }

BK.renderFulfil = function(p) {
  _fulfilState = {};
  return SPG.shell(SPG.toolbar('Fulfilment') + `
    <div class="content" id="fulfilContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
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
  if (!el) return;
  const data = S.currentOrder;
  if (!data) { el.innerHTML = '<div class="empty"><div class="empty-icon">\u274C</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25</div></div>'; return; }

  const o = data.order;
  const items = data.items || [];
  if (!['Ordered', 'InProgress'].includes(o.status)) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">\u2139\uFE0F</div><div class="empty-title">\u0E2A\u0E16\u0E32\u0E19\u0E30 ${esc(o.status)}</div><div class="empty-desc">Fulfilment \u0E44\u0E14\u0E49\u0E40\u0E09\u0E1E\u0E32\u0E30 Ordered/InProgress</div><button class="btn btn-outline" style="margin-top:12px" onclick="SPG.go('bakery/order-detail',{id:'${o.order_id}'})">\u0E14\u0E39\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14 \u2192</button></div>`;
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
  const doneCount = items.filter(i => _fulfilState[i.item_id]?.status).length;
  const total = items.length;
  const pct = total > 0 ? Math.round(doneCount / total * 100) : 0;
  const stsClass = { Ordered: 'sts-ordered', InProgress: 'sts-ordered' }[o.status] || '';

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:13px;font-weight:700;color:var(--acc)">${esc(o.order_id)}</span>
      <span class="sts ${stsClass}" style="margin-left:auto">${o.status}</span>
    </div>
    <div style="font-size:12px;color:var(--t3);margin-bottom:6px">${esc(BK.getStoreName(o.store_id))}${o.dept_id ? ' \u00B7 ' + esc(o.dept_id) : ''} \u00B7 ${esc(o.display_name || '')} \u00B7 \u0E2A\u0E48\u0E07 ${BK.fmtDateThai(o.delivery_date)}</div>

    <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:3px"><span>${doneCount} / ${total} items</span><span style="color:var(--green)">${pct}%</span></div>
    <div class="bc-progress-bar" style="margin-bottom:12px"><div class="bc-progress-fill" style="width:${pct}%"></div></div>

    <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:14px">
      ${items.map(i => _renderFulfilItem(i)).join('')}
    </div>

    <div style="display:flex;flex-direction:column;gap:5px">
      <button class="btn" style="background:var(--blue);color:#fff;width:100%" id="fulfilSaveBtn" onclick="BakerySection.saveFulfilment('${o.order_id}')">\uD83D\uDCBE Save In-Progress</button>
      <button class="btn btn-outline btn-full" style="color:var(--acc);border-color:var(--acc)" id="deliverBtn" onclick="BakerySection.doMarkDelivered('${o.order_id}')">\uD83D\uDE9A Mark as Delivered</button>
      <button class="btn btn-outline btn-full" style="color:var(--red);border-color:var(--red)" onclick="BakerySection.confirmCancel('${o.order_id}')">\uD83D\uDEAB Cancel Order</button>
    </div>`;
}

function _renderFulfilItem(i) {
  const fs = _fulfilState[i.item_id] || {};
  const st = fs.status;
  const isFull = st === 'full';
  const isPartial = st === 'partial';

  const borderColor = isFull ? 'var(--green)' : isPartial ? 'var(--orange)' : 'var(--bd)';
  const bg = isFull ? 'var(--green-bg)' : '';
  const urgLabel = i.is_urgent ? ' \u26A1' : '';

  let actionHtml;
  if (isFull) {
    actionHtml = `<div style="padding:6px 12px;border-radius:var(--rd);font-size:14px;font-weight:700;background:var(--green);color:#fff;min-width:38px;text-align:center;cursor:pointer" onclick="BakerySection.fulfilClear('${i.item_id}')">\u2713</div>`;
  } else if (isPartial) {
    actionHtml = `<div style="padding:6px 12px;border-radius:var(--rd);font-size:14px;font-weight:700;background:var(--orange);color:#fff;min-width:38px;text-align:center;cursor:pointer" onclick="BakerySection.fulfilClear('${i.item_id}')">\u2717</div>`;
  } else {
    actionHtml = `<div style="display:flex;gap:3px">
      <div style="padding:6px 12px;border-radius:var(--rd);font-size:14px;font-weight:700;background:var(--green);color:#fff;cursor:pointer;min-width:38px;text-align:center" onclick="BakerySection.fulfilFull('${i.item_id}')">\u2713</div>
      <div style="padding:6px 12px;border-radius:var(--rd);font-size:14px;font-weight:700;background:var(--orange);color:#fff;cursor:pointer;min-width:38px;text-align:center" onclick="BakerySection.fulfilPartial('${i.item_id}')">\u2717</div>
    </div>`;
  }

  let partialInput = '';
  if (isPartial) {
    partialInput = `<div style="padding:8px 12px;background:var(--orange-bg);border-radius:var(--rd);margin-top:4px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
        <span style="font-size:12px;font-weight:600;color:var(--orange)">Actual qty:</span>
        <input type="number" min="0" value="${fs.qty_sent}" style="width:60px;padding:4px 6px;border:1px solid var(--orange);border-radius:var(--rd);font-size:14px;font-weight:700;text-align:center;font-family:inherit" oninput="BakerySection.setFulfilQty('${i.item_id}',this.value)">
        <span style="font-size:11px;color:var(--t3)">/ ${i.qty_ordered} ${esc(i.unit)}</span>
      </div>
      <input style="width:100%;padding:6px 8px;border:1px solid var(--orange);border-radius:var(--rd);font-size:12px;font-family:inherit" placeholder="Reason..." value="${esc(fs.note)}" oninput="BakerySection.setFulfilNote('${i.item_id}',this.value)">
    </div>`;
  }

  const qtyDisplay = isPartial ? fs.qty_sent : i.qty_ordered;
  const qtyColor = isFull ? 'var(--green)' : isPartial ? 'var(--orange)' : 'var(--t1)';
  const subQty = isPartial ? `<div style="font-size:10px;color:var(--orange)">/ ${i.qty_ordered} ${esc(i.unit)}</div>` : `<div style="font-size:10px;color:var(--t3)">${esc(i.unit)}</div>`;

  return `<div id="fi-${i.item_id}" style="display:flex;align-items:center;gap:8px;padding:12px 14px;border:1px solid var(--bd2);border-left:4px solid ${borderColor};border-radius:0 var(--rd) var(--rd) 0;background:${bg || 'var(--bg)'}">
    <div style="flex:1"><div style="font-size:13px;font-weight:700">${esc(i.product_name)}${urgLabel}</div></div>
    <div style="text-align:center"><div style="font-size:18px;font-weight:800;color:${qtyColor}">${qtyDisplay}</div>${subQty}</div>
    ${actionHtml}
  </div>${partialInput}`;
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
    btn.disabled = false; btn.textContent = '\uD83D\uDCBE Save In-Progress';
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

  // Tab chips
  const tabs = `<div style="display:flex;gap:5px;margin-bottom:8px">
    <div class="chip${_printTab === 'sheet' ? ' active' : ''}" onclick="BakerySection.setPrintTab('sheet')">\uD83D\uDCC4 Production Sheet</div>
    <div class="chip${_printTab === 'slip' ? ' active' : ''}" onclick="BakerySection.setPrintTab('slip')">\uD83E\uDDFE Delivery Slip</div>
  </div>`;

  // Date picker
  const datePicker = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <span style="font-size:12px;font-weight:600">\uD83D\uDCC5 Delivery:</span>
    <input class="inp" type="date" value="${_printDate}" style="width:auto;font-size:12px;padding:6px 10px" onchange="BakerySection.setPrintDate(this.value)">
  </div>`;

  // Section checkboxes (from categories master list)
  const sorted = [...new Set((S.categories || []).map(c => c.section_id).filter(Boolean))].sort();
  const allChecked = _printSections.size === 0;
  const secChips = `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="checkbox" ${allChecked ? 'checked' : ''} onchange="BakerySection.togglePrintSecAll(this.checked)"> All</label>
    ${sorted.map(s => `<label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer"><input type="checkbox" ${allChecked || _printSections.has(s) ? 'checked' : ''} onchange="BakerySection.togglePrintSec('${s}',this.checked)"> ${esc(s)}</label>`).join('')}
  </div>`;

  // Controls card (white background section — hidden on print)
  let controlsCard = `<div class="section-card print-controls" style="margin-bottom:10px">${tabs}${datePicker}${secChips}`;
  if (_printTab === 'slip') {
    if (!_slipStore && d.stores?.length) _slipStore = d.stores[0];
    controlsCard += `<div style="margin-top:8px"><select class="sel" style="max-width:300px" onchange="BakerySection.setSlipStore(this.value)">
      ${(d.stores || []).map(s => `<option value="${s}"${s === _slipStore ? ' selected' : ''}>${esc(BK.getStoreName(s))} (${s})</option>`).join('')}
    </select></div>`;
  }
  controlsCard += '</div>';

  // Print area card (white background section)
  const printArea = _printTab === 'sheet' ? _renderProductionSheet(d) : _renderDeliverySlip(d);
  const printCard = `<div class="section-card">${printArea}</div>`;

  el.innerHTML = `<div style="max-width:900px;margin:0 auto">${controlsCard}${printCard}</div>`;
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

  // Helper: build table header row
  const thRow = `<tr><th class="ptbl-name" style="text-align:left">Product</th><th>Total</th>${stores.map(s => '<th>' + esc(s) + '</th>').join('')}</tr>`;

  // Helper: build one product row
  function prodRow(p) {
    return `<tr>
      <td class="ptbl-name"><b>${esc(p.product_name)}</b></td>
      <td><b>${p.total}</b></td>
      ${stores.map(s => { const sv = p.stores[s]; if (!sv) return '<td>\u2014</td>'; return '<td>' + sv.qty + (sv.urgent ? '*' : '') + '</td>'; }).join('')}
    </tr>`;
  }

  // Helper: page header HTML
  function pageHeader() {
    return `<div class="print-page-header"><div class="print-page-title">PRODUCTION SHEET \u2014 ${sectionLabel}</div><div class="print-page-sub">Delivery: ${BK.fmtDateThai(_printDate)} | Orders: ${orderStr}</div></div>`;
  }

  // SCREEN: One long scrolling table
  let screen = '<div class="print-screen-only">';
  screen += `<div style="text-align:center;margin-bottom:8px"><div style="font-size:14px;font-weight:700">PRODUCTION SHEET \u2014 ${sectionLabel}</div><div style="font-size:11px;color:var(--t3)">Delivery: ${BK.fmtDateThai(_printDate)} | Orders: ${orderStr}</div></div>`;
  screen += '<table class="ptbl"><thead>' + thRow + '</thead><tbody>';
  prods.forEach(p => { screen += prodRow(p); });
  screen += '</tbody></table>';
  screen += '<div style="font-size:10px;color:var(--t3);margin-top:4px">* = URGENT \u26A1 | Sorted A-Z by product name</div>';
  screen += '<div style="text-align:center;margin-top:12px"><button class="btn btn-primary" style="padding:10px 24px" onclick="window.print()">\uD83D\uDDA8\uFE0F Print Production Sheet</button></div>';
  screen += '</div>';

  // PRINT: Paginated pages (30 rows each)
  let print = '';
  for (let page = 0; page < totalPages; page++) {
    const chunk = prods.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);
    print += '<div class="print-page">';
    print += pageHeader();
    print += '<table class="ptbl"><thead>' + thRow + '</thead><tbody>';
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

  // Collect order IDs for this store
  const storeOrders = (d.orders || []).filter(o => o.store_id === _slipStore);
  const orderStr = storeOrders.map(o => o.order_id).join(', ');
  const storeName = BK.getStoreName(_slipStore);
  const ROWS_PER_PAGE = 30;

  // Build flat list of lines (section headers + items)
  const lines = [];
  for (const sec of Object.keys(sections).sort()) {
    lines.push({ type: 'section', label: sec.toUpperCase() });
    sections[sec].forEach(p => {
      const sv = p.stores[_slipStore];
      lines.push({ type: 'item', name: p.product_name, qty: sv.qty, qty_sent: sv.qty_sent || 0, urgent: sv?.urgent });
    });
  }

  // Helper: render one line
  function renderLine(ln) {
    if (ln.type === 'section') {
      return '<div style="font-weight:700;margin:6px 0 2px;border-top:1px solid #eee;padding-top:4px">\u2550\u2550\u2550 ' + esc(ln.label) + ' \u2550\u2550\u2550</div>';
    }
    const star = ln.urgent ? '\u2B50 ' : '';
    const fill = ln.qty_sent > 0 ? '__' + ln.qty_sent + '__' : '____';
    return '<div style="display:flex;justify-content:space-between;padding:1px 0"><span>' + star + '<b>' + esc(ln.name) + '</b></span><span>' + ln.qty + ' \u2192 ' + fill + '</span></div>';
  }

  // Helper: slip header
  function slipHeader() {
    return '<div style="text-align:center;border-bottom:1px dashed #ccc;padding-bottom:6px;margin-bottom:6px"><div style="font-size:14px;font-weight:700">' + esc(storeName) + '</div><div>Delivery: ' + BK.fmtDateThai(_printDate) + '</div><div style="font-size:10px;color:#aaa">Orders: ' + esc(orderStr) + '</div></div>';
  }

  // SCREEN: One long scrolling slip
  let screen = '<div class="print-screen-only">';
  screen += '<div style="border:1px solid #ccc;padding:12px;font-size:12px;max-width:300px;margin:8px auto;font-family:monospace;line-height:1.5">';
  screen += slipHeader();
  lines.forEach(ln => { screen += renderLine(ln); });
  screen += '<div style="border-top:1px dashed #ccc;margin-top:8px;padding-top:6px;font-size:10px">Packed by: ____________<br>Checked by: ___________</div>';
  screen += '</div>';
  screen += '<div style="text-align:center;margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">';
  screen += '<button class="btn btn-primary" style="padding:10px 24px" onclick="BakerySection.printThermalSlip()">\uD83D\uDDA8\uFE0F Print</button>';
  screen += '<button class="btn btn-outline" style="padding:10px 16px;font-size:11px" onclick="window.print()">\uD83D\uDDA8\uFE0F Print A4</button>';
  screen += '</div>';
  screen += '</div>';

  // PRINT: Paginated pages
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

  // Build line data (same logic as _renderDeliverySlip)
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
  const W = 48; // 80mm = 48 chars (Font A)
  const line = (ch, len) => ch.repeat(len || W);
  const pad = (l, r, w) => { const sp = w - l.length - r.length; return l + (sp > 0 ? ' '.repeat(sp) : ' ') + r; };

  // Build ePOS XML commands
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
  _printSections = new Set(); // empty = all
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
let _bcRetShowCount = 5;

BK.renderBcReturns = function(p) {
  const y = BK.sydneyNow(); y.setDate(y.getDate() - 3);
  const t = BK.sydneyNow(); t.setDate(t.getDate() + 1);
  _bcRetDateFrom = BK.fmtDate(y);
  _bcRetDateTo = BK.fmtDate(t);
  _bcRetFilter = 'all';
  _bcRetShowCount = 5;
  return SPG.shell(SPG.toolbar('Incoming Returns') + `
    <div class="order-date-bar">
      <span class="date-label">\uD83D\uDCC5 Date:</span>
      <input type="date" class="date-inp" value="${_bcRetDateFrom}" onchange="BakerySection.setBCRetDate('from',this.value)">
      <span style="color:var(--t4)">\u2192</span>
      <input type="date" class="date-inp" value="${_bcRetDateTo}" onchange="BakerySection.setBCRetDate('to',this.value)">
      <span class="date-link" onclick="BakerySection.setBCRetPreset('3day')">3 \u0E27\u0E31\u0E19</span>
      <span class="date-link" onclick="BakerySection.setBCRetPreset('all')">\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14</span>
    </div>
    <div class="order-chips" id="bcRetChips"></div>
    <div class="content" id="bcRetContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
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
  const chipEl = document.getElementById('bcRetChips');
  if (!el) return;

  const all = S.returns || [];
  // Date filter
  let filtered = all;
  if (_bcRetDateFrom) filtered = filtered.filter(r => (r.created_at || '').substring(0, 10) >= _bcRetDateFrom);
  if (_bcRetDateTo) filtered = filtered.filter(r => (r.created_at || '').substring(0, 10) <= _bcRetDateTo);

  // Count by status
  const counts = { all: filtered.length, Reported: 0, Received: 0, Done: 0 };
  filtered.forEach(r => {
    if (r.status === 'Reported') counts.Reported++;
    else if (r.status === 'Received') counts.Received++;
    else counts.Done++;
  });

  // Chips
  if (chipEl) {
    chipEl.innerHTML = [
      { k: 'all', l: '\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14', c: counts.all },
      { k: 'Reported', l: 'Reported', c: counts.Reported },
      { k: 'Received', l: 'Received', c: counts.Received },
      { k: 'Done', l: 'Done', c: counts.Done },
    ].map(f => `<div class="chip${_bcRetFilter === f.k ? ' active' : ''}" onclick="BakerySection.setBCRetFilter('${f.k}')">${f.l}${f.c ? ' (' + f.c + ')' : ''}</div>`).join('');
  }

  // Apply filter
  let shown = filtered;
  if (_bcRetFilter === 'Reported') shown = filtered.filter(r => r.status === 'Reported');
  else if (_bcRetFilter === 'Received') shown = filtered.filter(r => r.status === 'Received');
  else if (_bcRetFilter === 'Done') shown = filtered.filter(r => !['Reported', 'Received'].includes(r.status));

  if (!shown.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">\u21A9\uFE0F</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E21\u0E35 Return</div></div>';
    return;
  }

  const visible = shown.slice(0, _bcRetShowCount);
  const hasMore = shown.length > _bcRetShowCount;

  el.innerHTML = `<div style="font-size:11px;color:var(--t3);margin-bottom:8px">${shown.length} records</div>
    <div style="display:flex;flex-direction:column;gap:6px">${visible.map(r => _renderBCRetCard(r)).join('')}</div>
    ${hasMore ? `<div class="load-more" onclick="BakerySection.showMoreBCRet()">\u0E41\u0E2A\u0E14\u0E07 ${_bcRetShowCount} \u0E08\u0E32\u0E01 ${shown.length} \u00B7 \u0E42\u0E2B\u0E25\u0E14\u0E40\u0E1E\u0E34\u0E48\u0E21 5 \u2193</div>` : ''}`;
}

function _renderBCRetCard(r) {
  const borderColor = { Reported: 'var(--orange)', Received: 'var(--blue)', Reworked: 'var(--green)', Wasted: 'var(--red)' }[r.status] || 'var(--bd)';
  const stsStyle = {
    Reported: 'background:#fffbeb;color:#92400e',
    Received: 'background:var(--blue-bg);color:#1e40af',
    Reworked: 'background:var(--green-bg);color:#065f46',
    Wasted:   'background:var(--red-bg);color:var(--red)',
  }[r.status] || '';
  const isDone = !['Reported', 'Received'].includes(r.status);
  const store = (BK.getStoreName(r.store_id) || r.store_id) + (r.dept_id ? ' \u00B7 ' + r.dept_id : '');
  const dateStr = BK.fmtDateAU((r.created_at || '').substring(0, 10));

  let actions = '';
  if (r.status === 'Reported') {
    actions = `<div style="display:flex;gap:4px;margin-top:6px">
      <button class="btn" style="background:var(--blue);color:#fff;padding:4px 12px;font-size:11px" onclick="BakerySection.doReceiveReturn('${r.return_id}')">\uD83D\uDCE5 Receive</button>
      <button class="btn btn-outline" style="padding:4px 12px;font-size:11px" onclick="BakerySection.showBCRetDetail('${r.return_id}')">\uD83D\uDC41\uFE0F Detail</button>
    </div>`;
  } else if (r.status === 'Received') {
    actions = `<div style="display:flex;gap:4px;margin-top:6px">
      <button class="btn btn-green" style="padding:4px 12px;font-size:11px" onclick="BakerySection.doResolveReturn('${r.return_id}','rework')">\u267B\uFE0F Rework</button>
      <button class="btn btn-danger" style="padding:4px 12px;font-size:11px" onclick="BakerySection.doResolveReturn('${r.return_id}','waste')">\uD83D\uDDD1\uFE0F Waste</button>
      <button class="btn btn-outline" style="padding:4px 12px;font-size:11px" onclick="BakerySection.showBCRetDetail('${r.return_id}')">\uD83D\uDC41\uFE0F</button>
    </div>`;
  }

  return `<div style="padding:10px 12px;border:1px solid var(--bd2);border-left:3px solid ${borderColor};border-radius:0 var(--rd) var(--rd) 0;background:var(--bg)${isDone ? ';opacity:.6' : ''}">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <span style="font-size:12px;font-weight:700;color:${isDone ? 'var(--t3)' : 'var(--acc)'}">${esc(r.return_id)}</span>
      <span class="sts" style="${stsStyle}">${r.status}</span>
    </div>
    <div style="font-size:12px;font-weight:600">${esc(r.product_name)} \u00D7${r.quantity} ${esc(r.unit)}</div>
    <div style="font-size:10px;color:var(--t3);margin-top:2px">${esc(store)} \u00B7 ${esc(r.issue_type)} \u00B7 ${dateStr}</div>
    ${isDone ? '<div style="font-size:10px;color:var(--t3);margin-top:2px">\u2705 done</div>' : ''}
    ${actions}
  </div>`;
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

  // Action buttons
  let actionBtns = '';
  if (r.status === 'Reported') {
    actionBtns = `<button class="btn" style="background:var(--blue);color:#fff;flex:1" onclick="SPG.closeDialog();BakerySection.doReceiveReturn('${r.return_id}')">\uD83D\uDCE5 Receive</button>`;
  } else if (r.status === 'Received') {
    actionBtns = `<button class="btn btn-green" style="flex:1" onclick="SPG.closeDialog();BakerySection.doResolveReturn('${r.return_id}','rework')">\u267B\uFE0F Rework</button>
      <button class="btn btn-danger" style="flex:1" onclick="SPG.closeDialog();BakerySection.doResolveReturn('${r.return_id}','waste')">\uD83D\uDDD1\uFE0F Waste</button>`;
  }

  SPG.showDialog(`<div class="popup-sheet" style="width:420px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:15px;font-weight:700">\u21A9\uFE0F ${esc(r.return_id)}</div>
      <span class="sts" style="${stsStyle}">${r.status}</span>
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
      <button class="btn btn-outline" style="flex:1" onclick="SPG.closeDialog()">\u2190 Close</button>
    </div>
  </div>`);
}

function setBCRetDate(which, val) { if (which === 'from') _bcRetDateFrom = val; else _bcRetDateTo = val; _fillBcReturns(); }
function setBCRetPreset(p) {
  if (p === '3day') { const y = BK.sydneyNow(); y.setDate(y.getDate() - 3); _bcRetDateFrom = BK.fmtDate(y); const t = BK.sydneyNow(); t.setDate(t.getDate() + 1); _bcRetDateTo = BK.fmtDate(t); }
  else { _bcRetDateFrom = ''; _bcRetDateTo = ''; }
  _fillBcReturns();
}
function setBCRetFilter(f) { _bcRetFilter = f; _bcRetShowCount = 5; _fillBcReturns(); }
function showMoreBCRet() { _bcRetShowCount += 5; _fillBcReturns(); }


// ═══════════════════════════════════════
// 6. PRODUCT MANAGEMENT
// ═══════════════════════════════════════
let _prodTab = 'active'; // 'active' | 'inactive'
let _prodSearch = '';
let _prodSectionFilter = 'all';

BK.renderProducts = function(p) {
  _prodTab = 'active'; _prodSearch = ''; _prodSectionFilter = 'all';
  return SPG.shell(SPG.toolbar('Manage Products') + `
    <div class="content" id="prodListContent">
      <div class="section-card" style="margin-bottom:10px">
        <div id="prodTabs"></div>
        <input class="search-input" style="max-width:400px;margin-bottom:8px" placeholder="\uD83D\uDD0D Search products..." id="prodSearchInp" oninput="BakerySection.filterProds(this.value)">
        <div id="prodSecChips"></div>
        <div id="prodSortNote"></div>
      </div>
      <div class="section-card" id="prodResults"><div class="skel skel-card"></div></div>
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
  const tabsEl = document.getElementById('prodTabs');
  const chipsEl = document.getElementById('prodSecChips');
  const noteEl = document.getElementById('prodSortNote');
  const resEl = document.getElementById('prodResults');
  if (!resEl) return;
  const prods = S.adminProducts;
  if (!prods) { resEl.innerHTML = '<div class="empty"><div class="empty-icon">\uD83D\uDCE6</div><div class="empty-title">\u0E01\u0E33\u0E25\u0E31\u0E07\u0E42\u0E2B\u0E25\u0E14...</div></div>'; return; }

  const active = prods.filter(p => p.is_active);
  const inactive = prods.filter(p => !p.is_active);
  const list = _prodTab === 'active' ? active : inactive;

  // Sections from categories master list
  const sortedSecs = [...new Set((S.categories || []).map(c => c.section_id).filter(Boolean))].sort();

  // Filter
  let filtered = list;
  if (_prodSectionFilter !== 'all') filtered = filtered.filter(p => p.section_id === _prodSectionFilter);
  if (_prodSearch) { const s = _prodSearch.toLowerCase(); filtered = filtered.filter(p => (p.product_name || '').toLowerCase().includes(s)); }

  // Update tabs
  if (tabsEl) {
    tabsEl.innerHTML = `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <div class="chip${_prodTab === 'active' ? ' active' : ''}" onclick="BakerySection.setProdTab('active')">Active (${active.length})</div>
      <div class="chip${_prodTab === 'inactive' ? ' active' : ''}" onclick="BakerySection.setProdTab('inactive')">Inactive (${inactive.length})</div>
      <div style="flex:1"></div>
      <button class="btn btn-primary" style="padding:6px 16px;font-size:12px" onclick="SPG.go('bakery/prod-edit',{id:'new'})">+ Add</button>
    </div>`;
  }

  // Update section chips
  if (chipsEl) {
    chipsEl.innerHTML = `<div style="display:flex;gap:5px;margin-bottom:6px;flex-wrap:wrap">
      <div class="chip${_prodSectionFilter === 'all' ? ' active' : ''}" onclick="BakerySection.setProdSection('all')">All</div>
      ${sortedSecs.map(s => `<div class="chip${_prodSectionFilter === s ? ' active' : ''}" onclick="BakerySection.setProdSection('${s}')">${esc(s)}</div>`).join('')}
    </div>`;
  }

  // Sort note
  if (noteEl) noteEl.innerHTML = `<div style="font-size:10px;color:var(--t4);margin-bottom:2px">Sort: A-Z by product name \u00B7 ${filtered.length} items</div>`;

  // Product list
  let cards = '';
  if (!filtered.length) {
    cards = '<div class="empty"><div class="empty-icon">\uD83D\uDD0D</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</div></div>';
  } else {
    cards = '<div style="display:flex;flex-direction:column;gap:4px">' + filtered.map(_prodCardHtml).join('') + '</div>';
  }
  resEl.innerHTML = cards;
}

function _prodCardHtml(p) {
  const catName = ((S.categories || []).find(c => c.cat_id === p.category_id) || {}).cat_name || p.category_id;
  const stsBg = p.is_active ? 'background:var(--green-bg);color:var(--green)' : 'background:var(--bg3);color:var(--t3)';
  return `<div style="padding:12px;border:1px solid var(--bd2);border-radius:var(--rd);background:var(--bg);display:flex;align-items:center;gap:10px;cursor:pointer" onclick="SPG.go('bakery/prod-edit',{id:'${p.product_id}'})">
    <div style="flex:1"><div style="font-size:12px;font-weight:600">${esc(p.product_name)}</div><div style="font-size:10px;color:var(--t3)">${esc(catName)} \u00B7 ${esc(p.section_id)} \u00B7 ${esc(p.unit)} \u00B7 Min ${p.min_order || 1}</div></div>
    <span class="sts" style="${stsBg}">${p.is_active ? 'Active' : 'Hidden'}</span>
    <span>\u270F\uFE0F</span>
  </div>`;
}

function setProdTab(tab) { _prodTab = tab; _prodSectionFilter = 'all'; _fillProducts(); }
function filterProds(val) {
  _prodSearch = val;
  const resEl = document.getElementById('prodResults');
  const noteEl = document.getElementById('prodSortNote');
  if (!resEl || !S.adminProducts) return;

  const list = _prodTab === 'active' ? S.adminProducts.filter(p => p.is_active) : S.adminProducts.filter(p => !p.is_active);
  let filtered = list;
  if (_prodSectionFilter !== 'all') filtered = filtered.filter(p => p.section_id === _prodSectionFilter);
  if (_prodSearch) { const s = _prodSearch.toLowerCase(); filtered = filtered.filter(p => (p.product_name || '').toLowerCase().includes(s)); }

  if (noteEl) noteEl.innerHTML = `<div style="font-size:10px;color:var(--t4);margin-bottom:2px">Sort: A-Z by product name \u00B7 ${filtered.length} items</div>`;

  if (!filtered.length) {
    resEl.innerHTML = '<div class="empty"><div class="empty-icon">\uD83D\uDD0D</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</div></div>';
  } else {
    resEl.innerHTML = '<div style="display:flex;flex-direction:column;gap:4px">' + filtered.map(_prodCardHtml).join('') + '</div>';
  }
}
function setProdSection(sec) { _prodSectionFilter = sec; _fillProducts(); }


// ═══════════════════════════════════════
// 7. PRODUCT EDIT
// ═══════════════════════════════════════
let _pendingImageUrl = ''; // holds uploaded image URL until save

BK.renderProdEdit = function(p) {
  return SPG.shell(SPG.toolbar('Edit Product') + `
    <div class="content" id="prodEditContent"><div class="skel skel-card"></div></div>`, 'Bakery');
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

  // Image preview
  const imgPreview = _pendingImageUrl
    ? `<img src="${esc(_pendingImageUrl)}" style="max-width:100%;max-height:120px;border-radius:var(--rd);object-fit:contain;margin-bottom:6px">`
    : '';

  el.innerHTML = `<div style="max-width:500px;margin:0 auto">
    <div class="section-card" style="margin-bottom:10px">
      <div style="font-size:15px;font-weight:700;margin-bottom:14px">${isNew ? '\u2795 Add Product' : '\u270F\uFE0F ' + esc(p.product_name)}</div>
      <div class="fg"><label class="lb">\u2776 Product Name *</label><input class="inp" id="peNameInput" value="${esc(p.product_name || '')}"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="fg"><label class="lb">\u2777 Category *</label><select class="sel" id="peCatInput"><option value="">-- select --</option>${catOpts}</select></div>
        <div class="fg"><label class="lb">\u2778 Section *</label><select class="sel" id="peSecInput"><option value="">-- select --</option>${secOpts}</select></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div class="fg"><label class="lb">\u2779 Unit</label><select class="sel" id="peUnitInput"><option value="pcs"${(p.unit || 'pcs') === 'pcs' ? ' selected' : ''}>pcs</option><option value="btl"${'btl' === p.unit ? ' selected' : ''}>btl</option><option value="pack"${'pack' === p.unit ? ' selected' : ''}>pack</option><option value="kg"${'kg' === p.unit ? ' selected' : ''}>kg</option><option value="box"${'box' === p.unit ? ' selected' : ''}>box</option></select></div>
        <div class="fg"><label class="lb">\u277A Min Order</label><input class="inp" type="number" id="peMinInput" value="${p.min_order || 1}" min="1"></div>
        <div class="fg"><label class="lb">\u277B Step</label><input class="inp" type="number" id="peStepInput" value="${p.order_step || 1}" min="1"></div>
      </div>
      <div class="fg"><label class="lb">\u277C Product Image</label>
        <div id="peImgPreview">${imgPreview}</div>
        <div class="img-drop-zone" id="peImgDrop" onclick="document.getElementById('peImgFile').click()" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="event.preventDefault();this.classList.remove('drag-over');BakerySection.handleImageDrop(event)">
          <div class="img-drop-icon">\uD83D\uDCF7</div>
          <div class="img-drop-text">Drop image here or click to upload</div>
          <div class="img-drop-hint">JPG, PNG, WebP — max 5MB</div>
        </div>
        <input type="file" id="peImgFile" accept="image/jpeg,image/png,image/webp,image/gif" style="display:none" onchange="BakerySection.handleImageFile(this.files[0])">
        <div id="peImgStatus" style="font-size:10px;color:var(--t3);margin-top:4px"></div>
      </div>
      <div class="fg"><label class="lb">Status</label><div style="display:flex;gap:8px">
        <div class="chip${isActive ? ' active' : ''}" id="peStsActive" onclick="document.getElementById('peStsActive').classList.add('active');document.getElementById('peStsHidden').classList.remove('active')">Active</div>
        <div class="chip${!isActive ? ' active' : ''}" id="peStsHidden" onclick="document.getElementById('peStsHidden').classList.add('active');document.getElementById('peStsActive').classList.remove('active')">Hidden</div>
      </div></div>
    </div>
    <div class="section-card" style="margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:6px">\uD83D\uDC41\uFE0F Store Visibility</div>
      <div style="font-size:10px;color:var(--t4);margin-bottom:6px">Select stores that can order this product</div>
      <div style="display:flex;flex-direction:column;gap:2px;margin-bottom:8px">${visRows}</div>
      <div style="display:flex;gap:8px;font-size:10px">
        <span style="color:var(--blue);cursor:pointer" onclick="document.querySelectorAll('.vis-cb').forEach(c=>c.checked=true)">\u2705 Select all</span>
        <span style="color:var(--red);cursor:pointer" onclick="document.querySelectorAll('.vis-cb').forEach(c=>c.checked=false)">\u274C Deselect all</span>
      </div>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-outline" style="flex:1" onclick="SPG.go('bakery/products')">Cancel</button>
      <button class="btn btn-primary" style="flex:1" id="peSaveBtn" onclick="BakerySection.doSaveProduct('${isNew ? '' : p.product_id}')">\uD83D\uDCBE Save</button>
    </div>
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

  // Read as base64
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

  // Collect visibility
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
  if (!btn || btn.disabled) return;
  btn.disabled = true; btn.textContent = '\u0E01\u0E33\u0E25\u0E31\u0E07 Accept...';
  try {
    const resp = await BK.api('accept_order', { order_id: orderId });
    if (resp.success) {
      SPG.toast(resp.message || '\u2705 Accept \u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22', 'success');
      if (S.currentOrder?.order) S.currentOrder.order.status = 'Ordered';
      const idx = (S.orders || []).findIndex(o => o.order_id === orderId);
      if (idx >= 0) S.orders[idx].status = 'Ordered';
      SPG.go('bakery/orders');
    } else {
      SPG.toast(resp.message || 'Error', 'error');
      btn.disabled = false; btn.textContent = '\u2713 Accept All';
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
    btn.disabled = false; btn.textContent = '\u2713 Accept All';
  }
}

function showRejectDialog(orderId) {
  SPG.showDialog(`<div class="popup-sheet" style="width:340px">
    <div class="popup-title" style="margin-bottom:12px">\u2717 Reject Order?</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:12px">${esc(orderId)}</div>
    <div class="fg"><label class="lb">\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25 *</label><input class="inp" id="rejectReason" placeholder="\u0E40\u0E0A\u0E48\u0E19 \u0E27\u0E31\u0E15\u0E16\u0E38\u0E14\u0E34\u0E1A\u0E44\u0E21\u0E48\u0E1E\u0E2D..."></div>
    <div style="display:flex;gap:8px"><button class="btn btn-outline" style="flex:1" onclick="SPG.closeDialog()">\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48</button><button class="btn btn-danger" style="flex:1" id="rejectConfirmBtn" onclick="BakerySection.doRejectOrder('${orderId}')">Reject \u0E40\u0E25\u0E22</button></div>
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
      SPG.go('bakery/orders');
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
