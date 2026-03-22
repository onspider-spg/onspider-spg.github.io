/**
 * SPG HUB v1.1.0 | 23 MAR 2026 | Siam Palette Group
 * sections/bc_store.js — Store Screens (10 pages)
 * Dashboard, Browse, Cart, Orders, Order Detail, Quota, Stock Entry, Stock History, Waste, Returns
 *
 * Ported from legacy screens_bcorder.js with EXACT layout/HTML
 * Depends on: bc_core.js (BK global)
 */

(() => {
const esc = SPG.esc;
const S = BK.S;

// ─── SORT UTILITY (shared across all lists) ───
function sortArr(arr, key, dir) {
  return [...arr].sort((a, b) => {
    let va = a[key] ?? '', vb = b[key] ?? '';
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
    return String(va).localeCompare(String(vb)) * dir;
  });
}
function sortIco(activeKey, key, dir) {
  if (activeKey !== key) return '<span class="sort-ico">\u21C5</span>';
  return '<span class="sort-ico sort-on">' + (dir > 0 ? '\u25B2' : '\u25BC') + '</span>';
}

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
    <div class="content" id="mainContent">
      <div style="margin-bottom:16px"><div style="font-size:14px;font-weight:700;margin-bottom:2px">Welcome, ${esc(s.display_name || s.display_label)}</div><div style="font-size:11px;color:var(--t3)">${esc(s.position_id ? s.position_name : s.tier_id)} \u00B7 ${esc(S.deptMapping?.module_role || S.role)} \u00B7 ${esc(BK.getStoreName(s.store_id))} \u00B7 ${esc(s.dept_id || '')}</div></div>
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--t3);margin-bottom:6px">Orders</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px">
        ${S.cart.length > 0
          ? dCard('\uD83D\uDCDD', 'Continue Order (' + S.cart.length + ')', "BakerySection.goToBrowse()", true)
          : dCard('\uD83D\uDCDD', 'Create Order', "BakerySection.goToBrowse()", true)}
        ${dCard('\uD83D\uDCCB', 'View Orders', "SPG.go('bakery/orders')")}
        ${dCard('\uD83D\uDCCA', 'Set Quota', "SPG.go('bakery/quota')")}
        ${dCard('\uD83D\uDCC8', 'Stock History', "SPG.go('bakery/stock-history')")}
      </div>
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--t3);margin-bottom:6px">Records</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        ${dCard('\uD83D\uDDD1\uFE0F', 'Record Waste', "SPG.go('bakery/waste')")}
        ${dCard('\u21A9\uFE0F', 'Returns', "SPG.go('bakery/returns')")}
      </div>
      <div id="dashStats" style="margin-top:20px"></div>
    </div>`, 'Bakery');
};

function dCard(icon, label, onclick, accent) {
  return `<div class="card${accent ? ' card-accent' : ''}" onclick="${onclick}"><div class="card-row"><span>${icon}</span><div class="card-label">${label}</div><span class="card-arrow">\u203A</span></div></div>`;
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
    fillDashboard();
    return;
  }
  try {
    const data = await BK.api('get_dashboard');
    S.dashboard = data;
    fillDashboard();
  } catch (e) { console.error('Dashboard load:', e); }
};

function fillDashboard() {
  const el = document.getElementById('dashStats'); if (!el) return;
  const d = S.dashboard; if (!d?.by_status) { el.innerHTML = ''; return; }
  const bs = d.by_status;
  el.innerHTML = `<div style="font-size:11px;font-weight:600;text-transform:uppercase;color:var(--t3);margin-bottom:6px">Today</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
      ${sCard('Pending', bs.Pending || 0, 'var(--orange)')}${sCard('Ordered', bs.Ordered || 0, 'var(--blue)')}${sCard('Fulfilled', bs.Fulfilled || 0, 'var(--green)')}
    </div>`;
}

function sCard(label, count, color) {
  return `<div style="background:var(--bg);border:1px solid var(--bd2);border-radius:var(--rd);padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:${color}">${count}</div><div style="font-size:10px;color:var(--t3)">${label}</div></div>`;
}


// ═══════════════════════════════════════
// 2. BROWSE PRODUCTS
// ═══════════════════════════════════════
BK.renderBrowse = function(p) {
  const today = BK.todaySydney();
  const tmr = BK.tomorrowSydney();
  const dd = S.deliveryDate || tmr;
  const isToday = dd === today;
  const isTmr = dd === tmr;
  const isCustom = !isToday && !isTmr;
  const hasData = S.cart.length > 0 || Object.keys(S.stockInputs).length > 0;

  const isEditMode = !!S.editingOrderId;
  const editBanner = isEditMode ? `<div style="background:var(--orange-bg,#fff3cd);padding:8px 14px;display:flex;justify-content:space-between;align-items:center;border-radius:var(--rd);margin-bottom:8px">
    <div><div style="font-size:12px;font-weight:700;color:var(--orange)">\u270F\uFE0F \u0E01\u0E33\u0E25\u0E31\u0E07\u0E41\u0E01\u0E49\u0E44\u0E02 ${esc(S.editingOrderId)}</div><div style="font-size:10px;color:var(--orange)">\u0E41\u0E01\u0E49\u0E44\u0E02\u0E40\u0E2A\u0E23\u0E47\u0E08\u0E01\u0E14\u0E2A\u0E48\u0E07 \u00B7 \u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E43\u0E2B\u0E21\u0E48\u0E44\u0E14\u0E49</div></div>
    <button class="btn btn-outline" style="padding:3px 10px;font-size:11px;color:var(--orange);border-color:var(--orange)" onclick="BakerySection.cancelEditMode()">\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01</button>
  </div>` : '';

  const resumeBar = !isEditMode && hasData ? `<div class="browse-resume">
    <span class="browse-resume-text">\uD83D\uDCDD \u0E01\u0E33\u0E25\u0E31\u0E07\u0E2A\u0E31\u0E48\u0E07${S.cart.length ? ' (' + S.cart.length + ' \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23)' : ' (\u0E21\u0E35\u0E2A\u0E15\u0E47\u0E2D\u0E01\u0E04\u0E49\u0E32\u0E07)'}</span>
    <button class="btn btn-outline" style="padding:3px 10px;font-size:11px" onclick="BakerySection.startOrder()">\uD83D\uDDD1\uFE0F \u0E25\u0E49\u0E32\u0E07\u0E43\u0E2B\u0E21\u0E48</button>
  </div>` : '';

  return SPG.shell(SPG.toolbar(isEditMode ? 'Edit Order' : 'Create Order') + `
    <div class="browse-header">
      ${editBanner}${resumeBar}
      <div class="date-pills">
        <span class="date-label">\u0E2A\u0E48\u0E07\u0E27\u0E31\u0E19</span>
        <div class="chip${isToday ? ' active' : ''}" onclick="BakerySection.setDate('today')">\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49</div>
        <div class="chip${isTmr ? ' active' : ''}" onclick="BakerySection.setDate('tomorrow')">\u0E1E\u0E23\u0E38\u0E48\u0E07\u0E19\u0E35\u0E49</div>
        <div class="chip${isCustom ? ' active' : ''}" onclick="document.getElementById('customDate').showPicker?.();document.getElementById('customDate').focus()">\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E27\u0E31\u0E19</div>
        <input type="date" id="customDate" value="${dd}" min="${today}" style="position:absolute;opacity:0;pointer-events:none" onchange="BakerySection.setDate(this.value)">
        <span class="date-display">${BK.fmtDateThai(dd)}</span>
      </div>
      <div class="search-bar">
        <input class="search-input" placeholder="\uD83D\uDD0D \u0E04\u0E49\u0E19\u0E2B\u0E32\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32..." value="${esc(S.productSearch)}" oninput="S.productSearch=this.value;BakerySection.dFilterProducts()">
      </div>
      <div class="cat-chips" id="catChips"></div>
    </div>
    <div class="content" id="productList">
      <div class="skel skel-card"></div><div class="skel skel-card"></div><div class="skel skel-card"></div>
    </div>
    <div class="cart-footer" id="cartFooter" style="display:none" onclick="SPG.go('bakery/cart')">\uD83D\uDED2 \u0E14\u0E39\u0E15\u0E30\u0E01\u0E23\u0E49\u0E32 (<span id="cartCount">0</span>) \u2192</div>`, 'Bakery');
};

BK.loadBrowse = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  if (!S.deliveryDate) S.deliveryDate = BK.tomorrowSydney();
  const d = new Date(S.deliveryDate + 'T00:00:00');
  const dow = d.getDay();

  // Products + Quotas
  if (S._prodsLoaded && S._quotasDay === dow) {
    fillBrowse();
    return;
  }

  if (S._prodsLoaded && S._quotasDay !== dow) {
    try {
      const qd = await BK.api('get_quotas', { day: String(dow) });
      const flat = {};
      for (const pid in qd) {
        const val = qd[pid];
        flat[pid] = (typeof val === 'object' && val !== null) ? (val[dow] ?? 0) : (val ?? 0);
      }
      S.quotas = flat;
      S._quotasDay = dow;
    } catch (e) { console.error('Quota load:', e); }
    fillBrowse();
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
  fillBrowse();
};

function fillBrowse() {
  // Category chips
  const chipEl = document.getElementById('catChips');
  if (chipEl) {
    const cats = S.categories;
    const f = S.productFilter;
    chipEl.innerHTML = `<div class="chip${f === 'all' ? ' active' : ''}" onclick="BakerySection.setProductFilter('all')">\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14</div>` +
      cats.map(c => `<div class="chip${f === c.cat_id ? ' active' : ''}" onclick="BakerySection.setProductFilter('${c.cat_id}')">${esc(c.cat_name)}</div>`).join('');
  }
  filterProducts();
}

function filterProducts() {
  const el = document.getElementById('productList');
  if (!el) return;
  const prods = S.products;
  if (!prods.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">\uD83D\uDCE6</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</div></div>'; return; }

  const search = (S.productSearch || '').toLowerCase();
  const catFilter = S.productFilter;
  let filtered = prods;
  if (catFilter !== 'all') filtered = filtered.filter(p => p.cat_id === catFilter);
  if (search) filtered = filtered.filter(p => (p.product_name || '').toLowerCase().includes(search));

  if (!filtered.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">\uD83D\uDD0D</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</div><div class="empty-desc">\u0E25\u0E2D\u0E07\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E04\u0E33\u0E04\u0E49\u0E19\u0E2B\u0E32</div></div>'; return; }

  const sp = BK.getStockPoints();
  const quotas = S.quotas || {};
  el.innerHTML = '<div class="product-grid">' + filtered.map(p => renderProductCard(p, sp, quotas[p.product_id])).join('') + '</div>';
  updateCartFooter();
}

// ─── Debounced version for search input (250ms) ───
let _dfpTimer = null;
function dFilterProducts() { clearTimeout(_dfpTimer); _dfpTimer = setTimeout(filterProducts, 250); }

function renderProductCard(p, stockPoints, quotaVal) {
  const cart = BK.getCartItem(p.product_id);
  const qty = cart ? cart.qty : 0;
  const isInCart = qty > 0;
  const isUrg = cart?.is_urgent || false;
  const pid = p.product_id;
  const qDisplay = quotaVal != null ? quotaVal : '\u2014';
  const maxLabel = p.max_order ? ' \u00B7 Max ' + p.max_order : '';
  const saved = S.stockInputs[pid];

  let stockHtml;
  if (stockPoints === 2) {
    const v1 = saved?.s1 ?? '';
    const v2 = saved?.s2 ?? '';
    const sum = (v1 !== '' || v2 !== '') ? (parseFloat(v1) || 0) + (parseFloat(v2) || 0) : '\u2014';
    stockHtml = `<div class="pcard-stock2">
      <div class="pcard-stock2-col"><div class="pcard-col-sub">\u0E08\u0E38\u0E14 1</div><input type="number" step="any" id="stk1-${pid}" class="stock-inp-sm" placeholder="\u2014" value="${v1}" oninput="BakerySection.onStock2(this,'${pid}')"></div>
      <div class="pcard-stock2-col"><div class="pcard-col-sub">\u0E08\u0E38\u0E14 2</div><input type="number" step="any" id="stk2-${pid}" class="stock-inp-sm" placeholder="\u2014" value="${v2}" oninput="BakerySection.onStock2(this,'${pid}')"></div>
    </div>
    <div class="pcard-stock-sum">\u0E23\u0E27\u0E21 <span id="stkSum-${pid}">${sum}</span></div>`;
  } else {
    const v = saved ?? '';
    stockHtml = `<input type="number" step="any" id="stk-${pid}" class="stock-inp" placeholder="\u0E01\u0E23\u0E2D\u0E01" value="${v}" oninput="BakerySection.onStock1(this,'${pid}')">`;
  }

  return `<div class="pcard${isInCart ? ' pcard-active' : ''}" id="pc-${pid}">
    <div class="pcard-hd">
      <div class="pcard-info"><div class="pcard-name">${esc(p.product_name)}</div><div class="pcard-meta">Min ${p.min_order || 1} \u00B7 Step ${p.order_step || 1}${maxLabel} \u00B7 ${esc(p.unit || '')}</div></div>
      <div class="pcard-urg${isUrg ? ' on' : ''}" id="urg-${pid}" onclick="BakerySection.toggleUrg('${pid}')" title="Urgent">\u26A1</div>
    </div>
    <div class="pcard-labels"><div>\u0E42\u0E04\u0E27\u0E15\u0E32</div><div>\u0E2A\u0E15\u0E47\u0E2D\u0E01</div><div>\u0E2A\u0E31\u0E48\u0E07</div></div>
    <div class="pcard-row">
      <div class="pcard-quota"><div class="pcard-quota-val">${qDisplay}</div></div>
      <div class="pcard-stock">${stockHtml}</div>
      <div class="pcard-order">
        <div class="stepper">
          <div class="stp-btn${isInCart ? ' stp-active' : ''}" onclick="BakerySection.step('${pid}',-1)">\u2212</div>
          <div class="stp-val${isInCart ? ' stp-has' : ''}" id="qty-${pid}">${qty}</div>
          <div class="stp-btn${isInCart ? ' stp-active' : ''}" onclick="BakerySection.step('${pid}',1)">+</div>
        </div>
      </div>
    </div>
  </div>`;
}

// ─── STEPPER: Targeted update + max_order cap ───
function step(pid, dir) {
  const p = S.products.find(pr => pr.product_id === pid);
  if (!p) return;
  const minOrd = p.min_order || 1;
  const stepVal = p.order_step || 1;
  const maxOrd = p.max_order || 9999;
  const cart = BK.getCartItem(pid);
  let qty = cart ? cart.qty : 0;

  if (dir > 0) {
    qty = qty === 0 ? minOrd : qty + stepVal;
    if (qty > maxOrd) { SPG.toast(p.product_name + ': \u0E2A\u0E39\u0E07\u0E2A\u0E38\u0E14 ' + maxOrd, 'warning'); qty = maxOrd; }
  } else {
    qty = qty - stepVal;
    if (qty < minOrd) qty = 0;
  }

  BK.setCartQty(pid, qty);
  const sc = BK.getCartItem(pid);
  if (sc) sc._auto = false;

  // Read stock value from memory (not DOM) and save to cart
  if (qty > 0) {
    const sv = readStockValue(pid);
    BK.setCartStock(pid, sv);
  }

  // Targeted DOM update (not full re-render)
  const qtyEl = document.getElementById('qty-' + pid);
  if (qtyEl) { qtyEl.textContent = qty; qtyEl.className = 'stp-val' + (qty > 0 ? ' stp-has' : ''); }
  const card = document.getElementById('pc-' + pid);
  if (card) card.className = 'pcard' + (qty > 0 ? ' pcard-active' : '');
  const urgEl = document.getElementById('urg-' + pid);
  if (urgEl && qty === 0) urgEl.className = 'pcard-urg';
  card?.querySelectorAll('.stp-btn').forEach(b => b.className = 'stp-btn' + (qty > 0 ? ' stp-active' : ''));
  updateCartFooter();
}

function toggleUrg(pid) {
  const cart = BK.getCartItem(pid);
  if (!cart) return;
  BK.toggleCartUrgent(pid);
  const el = document.getElementById('urg-' + pid);
  if (el) el.className = 'pcard-urg' + (cart.is_urgent ? ' on' : '');
}

function readStockValue(pid) {
  const saved = S.stockInputs[pid];
  const sp = BK.getStockPoints();
  if (sp === 2) {
    const v1 = parseFloat(saved?.s1) || 0;
    const v2 = parseFloat(saved?.s2) || 0;
    return (v1 || v2) ? v1 + v2 : null;
  }
  return saved != null && saved !== '' ? parseFloat(saved) : null;
}

// ─── Stock input handlers: save to S.stockInputs + auto-suggest ───
function onStock1(el, pid) {
  S.stockInputs[pid] = el.value;
  const numVal = el.value !== '' ? parseFloat(el.value) : null;
  const stockVal = (numVal !== null && !isNaN(numVal)) ? numVal : null;
  const cart = BK.getCartItem(pid);
  if (cart) BK.setCartStock(pid, stockVal);
  autoSuggest(pid, parseFloat(el.value));
}

function onStock2(el, pid) {
  const v1 = document.getElementById('stk1-' + pid)?.value || '';
  const v2 = document.getElementById('stk2-' + pid)?.value || '';
  S.stockInputs[pid] = { s1: v1, s2: v2 };
  const n1 = parseFloat(v1) || 0;
  const n2 = parseFloat(v2) || 0;
  const sum = n1 + n2;
  const sumEl = document.getElementById('stkSum-' + pid);
  const hasValue = v1 !== '' || v2 !== '';
  if (sumEl) sumEl.textContent = hasValue ? sum : '\u2014';
  const cart = BK.getCartItem(pid);
  if (cart) BK.setCartStock(pid, hasValue ? sum : null);
  if (hasValue) autoSuggest(pid, sum);
}

// ─── Auto-suggest: quota - stock -> fill stepper ───
function autoSuggest(pid, stockVal) {
  if (stockVal == null || isNaN(stockVal)) return;
  const cart = BK.getCartItem(pid);
  if (cart && cart.qty > 0 && !cart._auto) return;

  const p = S.products.find(pr => pr.product_id === pid);
  if (!p) return;
  const quota = S.quotas[pid];
  if (quota == null || quota <= 0) return;

  const minOrd = p.min_order || 1;
  const stepVal = p.order_step || 1;
  const maxOrd = p.max_order || 9999;

  let suggest = Math.max(quota - stockVal, 0);
  if (suggest <= 0) {
    if (cart && cart._auto) {
      BK.setCartQty(pid, 0);
      const qtyEl = document.getElementById('qty-' + pid);
      if (qtyEl) { qtyEl.textContent = 0; qtyEl.className = 'stp-val'; }
      const card = document.getElementById('pc-' + pid);
      if (card) card.className = 'pcard';
      card?.querySelectorAll('.stp-btn').forEach(b => b.className = 'stp-btn');
      const urgEl = document.getElementById('urg-' + pid);
      if (urgEl) urgEl.className = 'pcard-urg';
      updateCartFooter();
    }
    return;
  }

  if (suggest < minOrd) suggest = minOrd;
  if (stepVal > 1) suggest = Math.ceil(suggest / stepVal) * stepVal;
  if (suggest > maxOrd) suggest = maxOrd;

  BK.setCartQty(pid, suggest);
  BK.setCartStock(pid, stockVal);
  const ac = BK.getCartItem(pid);
  if (ac) ac._auto = true;

  const qtyEl = document.getElementById('qty-' + pid);
  if (qtyEl) { qtyEl.textContent = suggest; qtyEl.className = 'stp-val stp-has'; }
  const card = document.getElementById('pc-' + pid);
  if (card) card.className = 'pcard pcard-active';
  card?.querySelectorAll('.stp-btn').forEach(b => b.className = 'stp-btn stp-active');
  updateCartFooter();
}

function updateCartFooter() {
  const count = S.cart.length;
  const footer = document.getElementById('cartFooter');
  const countEl = document.getElementById('cartCount');
  if (footer) footer.style.display = count > 0 ? '' : 'none';
  if (countEl) countEl.textContent = count;
}

function setDate(val) {
  if (val === 'today') S.deliveryDate = BK.todaySydney();
  else if (val === 'tomorrow') S.deliveryDate = BK.tomorrowSydney();
  else {
    if (val < BK.todaySydney()) { SPG.toast('\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E1C\u0E48\u0E32\u0E19\u0E21\u0E32\u0E41\u0E25\u0E49\u0E27', 'error'); return; }
    S.deliveryDate = val;
  }
  updateDatePills();
  BK.loadQuotas().then(() => { fillBrowse(); });
}

function updateDatePills() {
  const today = BK.todaySydney();
  const tmr = BK.tomorrowSydney();
  const dd = S.deliveryDate || tmr;
  const isToday = dd === today;
  const isTmr = dd === tmr;
  const isCustom = !isToday && !isTmr;
  const pills = document.querySelectorAll('.date-pills .chip');
  if (pills.length >= 3) {
    pills[0].className = 'chip' + (isToday ? ' active' : '');
    pills[1].className = 'chip' + (isTmr ? ' active' : '');
    pills[2].className = 'chip' + (isCustom ? ' active' : '');
  }
  const display = document.querySelector('.date-display');
  if (display) display.textContent = BK.fmtDateThai(dd);
  const inp = document.getElementById('customDate');
  if (inp) inp.value = dd;
}

function setProductFilter(catId) {
  S.productFilter = catId;
  filterProducts();
}


// ═══════════════════════════════════════
// 3. CART
// ═══════════════════════════════════════
BK.renderCart = function(p) {
  const items = S.cart;
  if (items.length === 0) {
    return SPG.shell(`<div class="toolbar"><button class="toolbar-back" onclick="SPG.go('bakery/browse')">\u2190</button><div class="toolbar-title">\u0E15\u0E30\u0E01\u0E23\u0E49\u0E32</div></div>
      <div class="content"><div class="empty"><div class="empty-icon">\uD83D\uDED2</div><div class="empty-title">\u0E15\u0E30\u0E01\u0E23\u0E49\u0E32\u0E27\u0E48\u0E32\u0E07</div><div class="empty-desc">\u0E01\u0E25\u0E31\u0E1A\u0E44\u0E1B\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</div></div></div>`, 'Bakery');
  }

  const dd = S.deliveryDate;
  const cartHtml = items.map((c, i) => `<div class="cart-item">
    <div class="cart-item-hd">
      <div class="cart-item-name">${esc(c.product_name)}</div>
      <div class="cart-item-qty">${c.qty} ${esc(c.unit)}</div>
    </div>
    <div class="cart-item-meta">
      ${c.is_urgent ? '<span class="cart-urg">\u26A1 URGENT</span>' : ''}
      ${c.stock_on_hand != null ? '<span class="cart-stock">\u0E2A\u0E15\u0E47\u0E2D\u0E01: ' + c.stock_on_hand + '</span>' : ''}
    </div>
    <div class="cart-item-note">
      <input class="inp" placeholder="Note..." value="${esc(c.note || '')}" oninput="BK.setCartNote('${c.product_id}',this.value)">
    </div>
    <div class="cart-item-actions">
      <span class="cart-edit" onclick="SPG.go('bakery/browse')">\u2190 \u0E41\u0E01\u0E49\u0E44\u0E02</span>
      <span class="cart-remove" onclick="BakerySection.removeCartItem('${c.product_id}')">\uD83D\uDDD1\uFE0F \u0E25\u0E1A</span>
    </div>
  </div>`).join('');

  const isEditMode = !!S.editingOrderId;
  const editBar = isEditMode ? `<div style="background:var(--orange-bg,#fff3cd);padding:8px 14px;font-size:12px;font-weight:700;color:var(--orange)">\u270F\uFE0F \u0E01\u0E33\u0E25\u0E31\u0E07\u0E41\u0E01\u0E49\u0E44\u0E02 ${esc(S.editingOrderId)}</div>` : '';
  const submitLabel = isEditMode
    ? '\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49\u0E44\u0E02 (' + items.length + ' \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23)'
    : '\uD83D\uDCE4 \u0E2A\u0E48\u0E07 Order (' + items.length + ' \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23)';
  const submitClass = isEditMode ? 'btn btn-primary btn-full cart-submit' : 'btn btn-green btn-full cart-submit';

  return SPG.shell(`<div class="toolbar"><button class="toolbar-back" onclick="SPG.go('bakery/browse')">\u2190</button><div class="toolbar-title">\u0E15\u0E30\u0E01\u0E23\u0E49\u0E32 (${items.length})</div><div class="toolbar-sub">\u0E2A\u0E48\u0E07 ${BK.fmtDateThai(dd)}</div></div>
    <div class="content" id="cartContent">
      ${editBar}
      ${cartHtml}
      <div class="cart-note-section">
        <div class="lb">\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38 (\u0E17\u0E31\u0E49\u0E07 Order)</div>
        <textarea class="inp" rows="2" placeholder="\u0E40\u0E0A\u0E48\u0E19 \u0E2A\u0E48\u0E07\u0E01\u0E48\u0E2D\u0E19 8 \u0E42\u0E21\u0E07..." oninput="BK.S.headerNote=this.value">${esc(S.headerNote)}</textarea>
      </div>
      <button class="${submitClass}" id="submitBtn" onclick="BakerySection.submitOrder()">${submitLabel}</button>
    </div>`, 'Bakery');
};

BK.loadCart = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
};

function removeCartItem(pid) {
  BK.setCartQty(pid, 0);
  SPG.go('bakery/cart'); // re-render cart
}

// ─── Stock validation: ALL products must have stock filled before submit ───
function validateStockBeforeSubmit() {
  const missing = [];
  const sp = BK.getStockPoints();
  const allProds = S.products || [];
  allProds.forEach(p => {
    const si = S.stockInputs[p.product_id];
    if (si === undefined || si === null) {
      missing.push(p.product_name);
      return;
    }
    if (sp === 2 && typeof si === 'object') {
      if (si.s1 === '' && si.s2 === '') missing.push(p.product_name);
    } else {
      if (String(si) === '') missing.push(p.product_name);
    }
  });
  return { valid: missing.length === 0, missing };
}

async function submitOrder() {
  const btn = document.getElementById('submitBtn');
  if (!btn || btn.disabled) return;

  if (!S.cart || S.cart.length === 0) {
    SPG.toast('\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E19\u0E15\u0E30\u0E01\u0E23\u0E49\u0E32', 'error');
    return;
  }

  const stockCheck = validateStockBeforeSubmit();
  if (!stockCheck.valid) {
    const n = stockCheck.missing.length;
    const preview = stockCheck.missing.slice(0, 3).join(', ') + (n > 3 ? ' +' + (n - 3) + ' \u0E2D\u0E37\u0E48\u0E19' : '');
    SPG.toast('\u0E01\u0E23\u0E38\u0E13\u0E32\u0E01\u0E23\u0E2D\u0E01\u0E2A\u0E15\u0E47\u0E2D\u0E01\u0E01\u0E48\u0E2D\u0E19\u0E2A\u0E48\u0E07 (' + n + ' \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23) \u2014 ' + preview, 'error');
    return;
  }

  btn.disabled = true;
  btn.textContent = '\u0E01\u0E33\u0E25\u0E31\u0E07\u0E2A\u0E48\u0E07...';

  function resolveStock(pid, sp) {
    const si = S.stockInputs[pid];
    if (si === undefined || si === null || si === '') return null;
    if (sp === 2 && typeof si === 'object') return (parseFloat(si.s1) || 0) + (parseFloat(si.s2) || 0);
    return parseFloat(si) || 0;
  }

  const sp = BK.getStockPoints();
  const items = S.cart.map(c => ({
    product_id: c.product_id,
    qty: c.qty,
    is_urgent: c.is_urgent,
    note: c.note || '',
    stock_on_hand: resolveStock(c.product_id, sp) ?? c.stock_on_hand,
  }));

  const allStock = S.products.map(p => {
    const stockVal = resolveStock(p.product_id, sp);
    const cart = BK.getCartItem(p.product_id);
    return {
      product_id: p.product_id,
      stock_on_hand: stockVal != null ? stockVal : 0,
      quota_qty: S.quotas[p.product_id] || 0,
      order_qty: cart?.qty || 0,
    };
  }).filter(s => S.stockInputs[s.product_id] !== undefined);

  try {
    const isEditMode = !!S.editingOrderId;
    let resp;

    if (isEditMode) {
      resp = await BK.api('edit_order', {
        order_id: S.editingOrderId,
        delivery_date: S.deliveryDate,
        header_note: S.headerNote,
        items,
        all_stock: allStock,
        full_replace: true,
      });
    } else {
      resp = await BK.api('create_order', {
        delivery_date: S.deliveryDate,
        header_note: S.headerNote,
        items,
        all_stock: allStock,
      });
    }

    if (resp.success) {
      SPG.toast(resp.message || (isEditMode ? '\u2705 \u0E41\u0E01\u0E49\u0E44\u0E02\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22!' : '\u2705 \u0E2A\u0E31\u0E48\u0E07\u0E40\u0E23\u0E35\u0E22\u0E1A\u0E23\u0E49\u0E2D\u0E22!'), 'success');
      const newOrderId = resp.data?.order_id || (isEditMode ? S.editingOrderId : null);
      S.cart = [];
      S.stockInputs = {};
      S.editingOrderId = null;
      S._ordersLoaded = false;
      if (newOrderId) { SPG.go('bakery/order-detail', { id: newOrderId }); }
      else { SPG.go('bakery/dashboard'); }
    } else {
      SPG.toast(resp.message || resp.error || '\u0E40\u0E01\u0E34\u0E14\u0E02\u0E49\u0E2D\u0E1C\u0E34\u0E14\u0E1E\u0E25\u0E32\u0E14', 'error');
      btn.disabled = false;
      btn.textContent = isEditMode
        ? '\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49\u0E44\u0E02 (' + S.cart.length + ' \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23)'
        : '\uD83D\uDCE4 \u0E2A\u0E48\u0E07 Order (' + S.cart.length + ' \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23)';
    }
  } catch (e) {
    SPG.toast('Network error: ' + e.message, 'error');
    const isEdit = !!S.editingOrderId;
    btn.disabled = false;
    btn.textContent = isEdit
      ? '\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E01\u0E32\u0E23\u0E41\u0E01\u0E49\u0E44\u0E02 (' + S.cart.length + ' \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23)'
      : '\uD83D\uDCE4 \u0E2A\u0E48\u0E07 Order (' + S.cart.length + ' \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23)';
  }
}


// ═══════════════════════════════════════
// 4. VIEW ORDERS
// ═══════════════════════════════════════
let _orderFilter = 'all';
let _orderSectionFilter = 'all';
let _orderDateFrom = '';
let _orderDateTo = '';
let _orderShowCount = 5;
let _orderSortKey = 'delivery_date';
let _orderSortDir = -1;

BK.renderOrders = function(p) {
  const y = BK.sydneyNow(); y.setDate(y.getDate() - 1);
  const t = BK.sydneyNow(); t.setDate(t.getDate() + 1);
  _orderDateFrom = _orderDateFrom || BK.fmtDate(y);
  _orderDateTo = _orderDateTo || BK.fmtDate(t);
  _orderFilter = 'all';
  _orderSectionFilter = 'all';
  _orderShowCount = 5;

  const isBC = S.role === 'bc';
  return SPG.shell(`<div class="toolbar"><button class="toolbar-back" onclick="SPG.go('bakery/dashboard')">\u2190</button><div class="toolbar-title">View Orders</div></div>
    <div class="order-date-bar">
      <span class="date-label">\uD83D\uDCC5 \u0E2A\u0E48\u0E07:</span>
      <input type="date" class="date-inp" value="${_orderDateFrom}" onchange="BakerySection.setOrderDate('from',this.value)">
      <span style="color:var(--t4)">\u2192</span>
      <input type="date" class="date-inp" value="${_orderDateTo}" onchange="BakerySection.setOrderDate('to',this.value)">
      <span class="date-link" onclick="BakerySection.setOrderDatePreset('today')">\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49</span>
      <span class="date-link" onclick="BakerySection.setOrderDatePreset('3day')">3 \u0E27\u0E31\u0E19</span>
      <span class="date-link" onclick="BakerySection.setOrderDatePreset('all')">\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14</span>
    </div>
    ${isBC ? '<div class="order-chips" id="sectionChips"></div>' : ''}
    <div class="order-chips" id="orderChips"></div>
    <div class="content" id="ordersContent"><div class="skel skel-card"></div><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.loadOrders = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  try {
    const data = await BK.api('get_orders', { date_from: _orderDateFrom, date_to: _orderDateTo, limit: '200' });
    S.orders = Array.isArray(data) ? data : (data?.orders || []);
    S._ordersLoaded = true;
  } catch (e) { SPG.toast(e.message || 'Failed to load orders', 'error'); }
  fillOrders();
};

function fillOrders() {
  const el = document.getElementById('ordersContent');
  const chipEl = document.getElementById('orderChips');
  const secEl = document.getElementById('sectionChips');
  if (!el) return;
  const isBC = S.role === 'bc';

  const all = S.orders || [];
  // Filter by date range
  let filtered = all;
  if (_orderDateFrom) filtered = filtered.filter(o => (o.delivery_date || '') >= _orderDateFrom);
  if (_orderDateTo) filtered = filtered.filter(o => (o.delivery_date || '') <= _orderDateTo);

  // BC: Section filter
  if (isBC && _orderSectionFilter !== 'all') {
    filtered = filtered.filter(o => (o.items || []).some(i => i.section_id === _orderSectionFilter));
  }

  // BC: Populate section chips
  if (secEl && isBC) {
    const sorted = [...new Set(S.categories.map(c => c.section_id).filter(Boolean))].sort();
    secEl.innerHTML = `<div class="chip${_orderSectionFilter === 'all' ? ' active' : ''}" onclick="BakerySection.setOrderSection('all')">All</div>` +
      sorted.map(s => `<div class="chip${_orderSectionFilter === s ? ' active' : ''}" onclick="BakerySection.setOrderSection('${s}')">${esc(s)}</div>`).join('');
  }

  // Count by status
  const counts = { all: filtered.length, Pending: 0, Ordered: 0, Done: 0, Cancelled: 0 };
  filtered.forEach(o => {
    if (o.status === 'Pending') counts.Pending++;
    else if (o.status === 'Ordered') counts.Ordered++;
    else if (['Fulfilled', 'Delivered', 'InProgress'].includes(o.status)) counts.Done++;
    else if (['Cancelled', 'Rejected'].includes(o.status)) counts.Cancelled++;
  });

  // Status chips
  if (chipEl) {
    const chips = [
      { k: 'all', l: '\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14', c: counts.all },
      { k: 'Pending', l: 'Pending', c: counts.Pending },
      { k: 'Ordered', l: 'Ordered', c: counts.Ordered },
      { k: 'Done', l: 'Done', c: counts.Done },
      { k: 'Cancelled', l: 'Cancel', c: counts.Cancelled },
    ];
    chipEl.innerHTML = chips.map(f => `<div class="chip${_orderFilter === f.k ? ' active' : ''}" onclick="BakerySection.setOrderFilter('${f.k}')">${f.l}${f.c ? ' (' + f.c + ')' : ''}</div>`).join('');
  }

  // Apply status filter
  let shown = filtered;
  if (_orderFilter === 'Pending') shown = filtered.filter(o => o.status === 'Pending');
  else if (_orderFilter === 'Ordered') shown = filtered.filter(o => o.status === 'Ordered');
  else if (_orderFilter === 'Done') shown = filtered.filter(o => ['Fulfilled', 'Delivered', 'InProgress'].includes(o.status));
  else if (_orderFilter === 'Cancelled') shown = filtered.filter(o => ['Cancelled', 'Rejected'].includes(o.status));

  if (shown.length === 0) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">\uD83D\uDCCB</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E1E\u0E1A Order</div><div class="empty-desc">\u0E25\u0E2D\u0E07\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E27\u0E31\u0E19</div></div>';
    return;
  }

  // Sort
  shown = sortArr(shown, _orderSortKey, _orderSortDir);

  const visible = shown.slice(0, _orderShowCount);
  const hasMore = shown.length > _orderShowCount;

  const sb = (k, lbl) => `<span class="sort-btn${_orderSortKey === k ? ' sort-active' : ''}" onclick="BakerySection.sortOrders('${k}')">${lbl} ${sortIco(_orderSortKey, k, _orderSortDir)}</span>`;

  el.innerHTML = `<div class="list-header"><div style="font-size:11px;color:var(--t3)">${shown.length} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23</div>
      <div class="sort-bar">Sort: ${sb('delivery_date','\u0E27\u0E31\u0E19\u0E2A\u0E48\u0E07')} ${sb('order_id','ID')} ${sb('status','Status')}</div>
    </div>
    <div class="order-list">${visible.map(o => renderOrderCard(o)).join('')}</div>
    ${hasMore ? `<div class="load-more" onclick="BakerySection.showMoreOrders()">\u0E41\u0E2A\u0E14\u0E07 ${_orderShowCount} \u0E08\u0E32\u0E01 ${shown.length} \u00B7 \u0E42\u0E2B\u0E25\u0E14\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2D\u0E35\u0E01 5 \u2193</div>` : ''}`;
}

function renderOrderCard(o) {
  const items = (o.items || []);
  const summary = items.slice(0, 3).map(i => {
    const rawName = i.product_name || '';
    const name = rawName.length > 20 ? rawName.substring(0, 18) + '\u2026' : rawName;
    return name + ' \u00D7' + i.qty_ordered + (i.is_urgent ? '\u26A1' : '');
  }).join(', ');
  const isDone = ['Fulfilled', 'Delivered'].includes(o.status);
  const stsClass = { Pending: 'sts-pending', Ordered: 'sts-ordered', InProgress: 'sts-ordered', Fulfilled: 'sts-fulfilled', Delivered: 'sts-fulfilled', Cancelled: 'sts-cancelled', Rejected: 'sts-cancelled' }[o.status] || '';
  const borderColor = { Pending: 'var(--red)', Ordered: 'var(--blue)', InProgress: 'var(--orange)', Fulfilled: 'var(--green)', Delivered: 'var(--green)' }[o.status] || 'var(--bd)';

  let onclick;
  if (S.role === 'bc') {
    if (o.status === 'Pending') onclick = `SPG.go('bakery/accept',{id:'${o.order_id}'})`;
    else if (o.status === 'Ordered' || o.status === 'InProgress') onclick = `SPG.go('bakery/fulfil',{id:'${o.order_id}'})`;
    else onclick = `SPG.go('bakery/order-detail',{id:'${o.order_id}'})`;
  } else {
    onclick = `SPG.go('bakery/order-detail',{id:'${o.order_id}'})`;
  }

  return `<div class="ocard${isDone ? ' ocard-done' : ''}" style="border-left-color:${borderColor}" onclick="${onclick}">
    <div class="ocard-hd"><span class="ocard-id">${esc(o.order_id)}</span><span class="sts ${stsClass}">${o.status}</span></div>
    <div class="ocard-sub">\u0E2A\u0E48\u0E07 ${BK.fmtDateThai(o.delivery_date)} \u00B7 ${esc(BK.getStoreName(o.store_id))}${o.dept_id ? ' \u00B7 ' + esc(o.dept_id) : ''}</div>
    <div class="ocard-items">${esc(summary)}</div>
  </div>`;
}

function setOrderSection(sec) { _orderSectionFilter = sec; _orderShowCount = 5; fillOrders(); }
function setOrderFilter(f) { _orderFilter = f; _orderShowCount = 5; fillOrders(); }
function sortOrders(key) { if (_orderSortKey === key) _orderSortDir *= -1; else { _orderSortKey = key; _orderSortDir = key === 'delivery_date' ? -1 : 1; } fillOrders(); }
function setOrderDate(which, val) { if (which === 'from') _orderDateFrom = val; else _orderDateTo = val; fillOrders(); }
function setOrderDatePreset(p) {
  const today = BK.todaySydney();
  if (p === 'today') { _orderDateFrom = today; _orderDateTo = today; }
  else if (p === '3day') { const y = BK.sydneyNow(); y.setDate(y.getDate() - 1); const t = BK.sydneyNow(); t.setDate(t.getDate() + 1); _orderDateFrom = BK.fmtDate(y); _orderDateTo = BK.fmtDate(t); }
  else { _orderDateFrom = ''; _orderDateTo = ''; }
  fillOrders();
}
function showMoreOrders() { _orderShowCount += 5; fillOrders(); }


// ═══════════════════════════════════════
// 5. ORDER DETAIL
// ═══════════════════════════════════════
BK.renderOrderDetail = function(params) {
  return SPG.shell(`<div class="toolbar"><button class="toolbar-back" onclick="SPG.go('bakery/orders')">\u2190</button><div class="toolbar-title">Order Detail</div></div>
    <div class="content" id="detailContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.loadOrderDetail = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  const orderId = p?.id;
  if (!orderId) return;
  try {
    const data = await BK.api('get_order_detail', { order_id: orderId });
    S.currentOrder = data;
    fillOrderDetail();
  } catch (e) { SPG.toast(e.message || 'Order not found', 'error'); }
};

function fillOrderDetail() {
  const el = document.getElementById('detailContent');
  if (!el) return;
  const data = S.currentOrder;
  if (!data) { el.innerHTML = '<div class="empty"><div class="empty-icon">\u274C</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25</div></div>'; return; }

  const o = data.order;
  const items = data.items || [];
  const canEdit = ['Pending', 'Ordered'].includes(o.status);
  const stsClass = { Pending: 'sts-pending', Ordered: 'sts-ordered', InProgress: 'sts-ordered', Fulfilled: 'sts-fulfilled', Delivered: 'sts-fulfilled', Cancelled: 'sts-cancelled', Rejected: 'sts-cancelled' }[o.status] || '';

  el.innerHTML = `
    <div class="detail-info">
      <div class="detail-hd"><span class="detail-id">${esc(o.order_id)}</span><span class="sts ${stsClass}">${o.status}</span></div>
      <div class="detail-grid">
        <div><div class="detail-label">\u0E27\u0E31\u0E19\u0E2A\u0E31\u0E48\u0E07</div><div class="detail-val">${BK.fmtDateThai(o.order_date)}</div></div>
        <div><div class="detail-label">\u0E27\u0E31\u0E19\u0E2A\u0E48\u0E07</div><div class="detail-val">${BK.fmtDateThai(o.delivery_date)}${canEdit ? ' <span style="font-size:10px;color:var(--blue);cursor:pointer;text-decoration:underline" onclick="BakerySection.showChangeDate(\'' + o.order_id + '\',\'' + o.delivery_date + '\')">\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19</span>' : ''}</div></div>
        <div><div class="detail-label">\u0E42\u0E14\u0E22</div><div class="detail-val">${esc(o.display_name)}</div></div>
        <div><div class="detail-label">\u0E23\u0E49\u0E32\u0E19</div><div class="detail-val">${esc(BK.getStoreName(o.store_id))}${o.dept_id ? ' \u00B7 ' + esc(o.dept_id) : ''}</div></div>
      </div>
      ${o.header_note ? '<div class="detail-note">\uD83D\uDCDD ' + esc(o.header_note) + '</div>' : ''}
    </div>

    <div class="detail-section-title">\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23 (${items.length})</div>
    <div class="detail-items">${items.map(i => renderDetailItem(i, canEdit)).join('')}</div>

    ${canEdit && S.role === 'store' ? '<div style="margin-top:14px"><button class="btn btn-primary btn-full" onclick="BakerySection.enterEditMode(\'' + o.order_id + '\')">\u270F\uFE0F Add More</button></div>' : ''}
    ${canEdit ? '<div style="margin-top:8px"><button class="btn btn-danger btn-full" onclick="BakerySection.confirmCancel(\'' + o.order_id + '\')">\uD83D\uDEAB \u0E22\u0E01\u0E40\u0E25\u0E34\u0E01 Order</button></div>' : ''}
    ${o.status === 'Cancelled' ? '<div style="margin-top:8px;font-size:12px;color:var(--red)">\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E40\u0E21\u0E37\u0E48\u0E2D ' + BK.fmtDateThai(o.cancelled_at?.substring(0, 10)) + (o.cancel_reason ? ' \u2014 ' + esc(o.cancel_reason) : '') + '</div>' : ''}`;
}

function renderDetailItem(i, canEdit) {
  const isFulfilled = !!i.fulfilment_status;
  return `<div class="ditem${isFulfilled ? ' ditem-done' : ''}" onclick="${canEdit && !isFulfilled ? "BakerySection.showEditItem('" + i.item_id + "')" : ''}">
    <div class="ditem-hd">
      <div><div class="ditem-name">${esc(i.product_name)}</div>
      <div class="ditem-meta">${i.qty_ordered} ${esc(i.unit)}${i.is_urgent ? ' \u00B7 <span style="color:var(--orange)">\u26A1 URGENT</span>' : ''}</div>
      ${i.stock_on_hand != null ? '<div class="ditem-stock">\u0E2A\u0E15\u0E47\u0E2D\u0E01: ' + i.stock_on_hand + ' \u2192 \u0E2A\u0E31\u0E48\u0E07: ' + i.qty_ordered + '</div>' : ''}
      ${i.item_note ? '<div class="ditem-note">\uD83D\uDCDD ' + esc(i.item_note) + '</div>' : ''}
      </div>
      ${isFulfilled ? '<span class="ditem-ful">\u2713 ' + (i.fulfilment_status === 'full' ? 'full (' + i.qty_sent + ')' : i.fulfilment_status + ' (' + i.qty_sent + ')') + '</span>' : (canEdit ? '<span class="ditem-edit">\u0E41\u0E01\u0E49\u0E44\u0E02 \u203A</span>' : '')}
    </div>
  </div>`;
}

// ─── Edit Item Popup ───
function showEditItem(itemId) {
  const data = S.currentOrder;
  if (!data) return;
  const item = data.items.find(i => i.item_id === itemId);
  if (!item) return;

  SPG.showDialog(`<div class="popup-sheet" style="width:380px">
    <div class="popup-header"><div class="popup-title">\u0E41\u0E01\u0E49\u0E44\u0E02 \u2014 ${esc(item.product_name)}</div><button class="popup-close" onclick="SPG.closeDialog()">\u2715</button></div>
    <div style="padding:10px 14px;background:var(--bg3);border-radius:var(--rd);margin-bottom:12px;font-size:12px">
      <div style="display:flex;justify-content:space-between"><span style="color:var(--t3)">\u0E40\u0E14\u0E34\u0E21</span><span style="font-weight:700">${item.qty_ordered} ${esc(item.unit)}</span></div>
    </div>
    <div class="fg"><label class="lb">\u0E2A\u0E15\u0E47\u0E2D\u0E01</label><input class="inp" type="number" id="editStock" value="${item.stock_on_hand != null ? item.stock_on_hand : ''}" min="0" step="0.1" style="width:120px;font-size:16px;font-weight:700;text-align:center" placeholder="\u2014"></div>
    <div class="fg"><label class="lb">\u0E08\u0E33\u0E19\u0E27\u0E19\u0E43\u0E2B\u0E21\u0E48 *</label><input class="inp" type="number" id="editQty" value="${item.qty_ordered}" min="0" style="width:120px;font-size:16px;font-weight:700;text-align:center"><div style="font-size:10px;color:var(--t4);margin-top:4px">\u0E43\u0E2A\u0E48 0 = \u0E25\u0E1A\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23</div></div>
    <div class="fg"><label class="lb">Urgent</label><div style="display:flex;gap:8px"><div class="chip${item.is_urgent ? ' active' : ''}" id="editUrg1" onclick="document.getElementById('editUrg1').classList.add('active');document.getElementById('editUrg0').classList.remove('active')">\u26A1</div><div class="chip${!item.is_urgent ? ' active' : ''}" id="editUrg0" onclick="document.getElementById('editUrg0').classList.add('active');document.getElementById('editUrg1').classList.remove('active')">\u0E1B\u0E01\u0E15\u0E34</div></div></div>
    <div class="fg"><label class="lb">Note</label><input class="inp" id="editNote" value="${esc(item.item_note || '')}"></div>
    <div style="display:flex;gap:8px"><button class="btn btn-outline" style="flex:1" onclick="SPG.closeDialog()">\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01</button><button class="btn btn-primary" style="flex:1" id="editSaveBtn" onclick="BakerySection.saveEditItem('${item.item_id}','${data.order.order_id}')">\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01</button></div>
  </div>`);
}

async function saveEditItem(itemId, orderId) {
  const btn = document.getElementById('editSaveBtn');
  if (!btn || btn.disabled) return;
  btn.disabled = true; btn.textContent = '\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01...';

  const qty = parseInt(document.getElementById('editQty')?.value) || 0;
  const isUrg = document.getElementById('editUrg1')?.classList.contains('active') || false;
  const note = document.getElementById('editNote')?.value || '';
  const stockRaw = document.getElementById('editStock')?.value;
  const stockVal = stockRaw !== '' ? parseFloat(stockRaw) : null;

  try {
    const resp = await BK.api('edit_order', {
      order_id: orderId,
      items: [{ item_id: itemId, qty, is_urgent: isUrg, note, stock_on_hand: stockVal }],
    });
    if (resp.success) {
      SPG.closeDialog();
      SPG.toast(resp.message || '\u2705 \u0E41\u0E01\u0E49\u0E44\u0E02\u0E41\u0E25\u0E49\u0E27', 'success');
      if (qty === 0) {
        const idx = S.currentOrder?.items?.findIndex(i => i.item_id === itemId);
        if (idx > -1) S.currentOrder.items.splice(idx, 1);
      } else {
        const item = S.currentOrder?.items?.find(i => i.item_id === itemId);
        if (item) { item.qty_ordered = qty; item.is_urgent = isUrg; item.item_note = note; item.stock_on_hand = stockVal; }
      }
      S._ordersLoaded = false;
      fillOrderDetail();
    } else {
      SPG.toast(resp.message || 'Error', 'error');
      btn.disabled = false; btn.textContent = '\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01';
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
    btn.disabled = false; btn.textContent = '\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01';
  }
}

// ─── Change Delivery Date ───
function showChangeDate(orderId, currentDate) {
  const minDate = BK.todaySydney();
  SPG.showDialog(`<div class="popup-sheet" style="width:340px">
    <div class="popup-title" style="margin-bottom:12px">\uD83D\uDCC5 \u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E27\u0E31\u0E19\u0E2A\u0E48\u0E07</div>
    <div style="font-size:12px;color:var(--t2);margin-bottom:12px">${esc(orderId)}</div>
    <div class="fg"><label class="lb">\u0E27\u0E31\u0E19\u0E2A\u0E48\u0E07\u0E43\u0E2B\u0E21\u0E48</label><input type="date" class="inp" id="newDeliveryDate" value="${currentDate}" min="${minDate}"></div>
    <div style="display:flex;gap:8px;margin-top:12px"><button class="btn btn-outline" style="flex:1" onclick="SPG.closeDialog()">\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01</button><button class="btn btn-primary" style="flex:1" id="changeDateBtn" onclick="BakerySection.doChangeDate('${orderId}')">\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01</button></div>
  </div>`);
}

async function doChangeDate(orderId) {
  const btn = document.getElementById('changeDateBtn');
  if (!btn || btn.disabled) return;
  const newDate = document.getElementById('newDeliveryDate')?.value;
  if (!newDate) { SPG.toast('\u0E01\u0E23\u0E38\u0E13\u0E32\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E27\u0E31\u0E19\u0E2A\u0E48\u0E07', 'error'); return; }
  if (newDate < BK.todaySydney()) { SPG.toast('\u0E44\u0E21\u0E48\u0E2A\u0E32\u0E21\u0E32\u0E23\u0E16\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48\u0E1C\u0E48\u0E32\u0E19\u0E21\u0E32\u0E41\u0E25\u0E49\u0E27', 'error'); return; }
  btn.disabled = true; btn.textContent = '\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01...';
  try {
    const resp = await BK.api('change_delivery_date', { order_id: orderId, delivery_date: newDate });
    if (resp.success) {
      SPG.closeDialog();
      SPG.toast(resp.message || '\u2705 \u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E27\u0E31\u0E19\u0E2A\u0E48\u0E07\u0E41\u0E25\u0E49\u0E27', 'success');
      S._ordersLoaded = false;
      const detailResp = await BK.api('get_order_detail', { order_id: orderId });
      if (detailResp) { S.currentOrder = detailResp; fillOrderDetail(); }
    } else {
      SPG.toast(resp.message || 'Error', 'error');
      btn.disabled = false; btn.textContent = '\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01';
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
    btn.disabled = false; btn.textContent = '\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01';
  }
}

// ─── Cancel Order ───
function confirmCancel(orderId) {
  SPG.showDialog(`<div class="popup-sheet" style="width:340px">
    <div class="popup-title" style="margin-bottom:12px">\uD83D\uDEAB \u0E22\u0E01\u0E40\u0E25\u0E34\u0E01 Order?</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:12px">${esc(orderId)}</div>
    <div class="fg"><label class="lb">\u0E40\u0E2B\u0E15\u0E38\u0E1C\u0E25 (\u0E16\u0E49\u0E32\u0E21\u0E35)</label><input class="inp" id="cancelReason" placeholder="\u0E40\u0E0A\u0E48\u0E19 \u0E2A\u0E31\u0E48\u0E07\u0E1C\u0E34\u0E14..."></div>
    <div style="display:flex;gap:8px"><button class="btn btn-outline" style="flex:1" onclick="SPG.closeDialog()">\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48</button><button class="btn btn-danger" style="flex:1" id="cancelBtn" onclick="BakerySection.doCancel('${orderId}')">\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E40\u0E25\u0E22</button></div>
  </div>`);
}

async function doCancel(orderId) {
  const btn = document.getElementById('cancelBtn');
  if (!btn || btn.disabled) return;
  btn.disabled = true; btn.textContent = '\u0E01\u0E33\u0E25\u0E31\u0E07\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01...';

  const reason = document.getElementById('cancelReason')?.value || '';
  try {
    const resp = await BK.api('cancel_order', { order_id: orderId, reason });
    if (resp.success) {
      SPG.closeDialog();
      SPG.toast(resp.message || '\u2705 \u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E41\u0E25\u0E49\u0E27', 'success');
      if (S.currentOrder?.order) S.currentOrder.order.status = 'Cancelled';
      const idx = S.orders.findIndex(o => o.order_id === orderId);
      if (idx >= 0) S.orders[idx].status = 'Cancelled';
      fillOrderDetail();
    } else {
      SPG.toast(resp.message || 'Error', 'error');
      btn.disabled = false; btn.textContent = '\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E40\u0E25\u0E22';
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
    btn.disabled = false; btn.textContent = '\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01\u0E40\u0E25\u0E22';
  }
}


// ═══════════════════════════════════════
// 6. STOCK HISTORY
// ═══════════════════════════════════════
let _shDateFrom = '';
let _shDateTo = '';
let _shShowCount = 10;

BK.renderStockHistory = function(p) {
  const y = BK.sydneyNow(); y.setDate(y.getDate() - 1);
  const t = BK.sydneyNow(); t.setDate(t.getDate() + 1);
  _shDateFrom = S.stockHistDateFrom || BK.fmtDate(y);
  _shDateTo = S.stockHistDateTo || BK.fmtDate(t);
  S.stockHistDateFrom = _shDateFrom;
  S.stockHistDateTo = _shDateTo;
  _shShowCount = 10;

  return SPG.shell(`<div class="toolbar"><button class="toolbar-back" onclick="SPG.go('bakery/dashboard')">\u2190</button><div class="toolbar-title">Stock History</div></div>
    <div class="order-date-bar">
      <span class="date-label">\uD83D\uDCC5 Delivery:</span>
      <input type="date" class="date-inp" value="${_shDateFrom}" onchange="BakerySection.setShDate('from',this.value)">
      <span style="color:var(--t4)">\u2192</span>
      <input type="date" class="date-inp" value="${_shDateTo}" onchange="BakerySection.setShDate('to',this.value)">
      <span class="date-link" onclick="BakerySection.setShDatePreset('3day')">3 \u0E27\u0E31\u0E19</span>
      <span class="date-link" onclick="BakerySection.setShDatePreset('7day')">7 \u0E27\u0E31\u0E19</span>
    </div>
    <div class="content" id="shContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
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
  fillStockHistory();
};

function fillStockHistory() {
  const el = document.getElementById('shContent');
  if (!el) return;
  const all = S.stockHistory || [];

  if (!all.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">\uD83D\uDCC8</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25</div><div class="empty-desc">\u0E25\u0E2D\u0E07\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E0A\u0E48\u0E27\u0E07\u0E27\u0E31\u0E19</div></div>';
    return;
  }

  // Group by order_id
  const orderGroups = [];
  const orderMap = {};
  all.forEach(h => {
    if (!orderMap[h.order_id]) {
      orderMap[h.order_id] = { order_id: h.order_id, delivery_date: h.delivery_date, created_at: h.created_at, items: [] };
      orderGroups.push(orderMap[h.order_id]);
    }
    orderMap[h.order_id].items.push(h);
  });

  let html = '<div style="font-size:11px;color:var(--t3);margin-bottom:8px">' + orderGroups.length + ' orders \u00B7 ' + all.length + ' records</div>';

  const visible = orderGroups.slice(0, _shShowCount);
  const hasMore = orderGroups.length > _shShowCount;

  visible.forEach((grp, idx) => {
    grp.items.sort((a, b) => (a.product_name || '').localeCompare(b.product_name || ''));
    const orderDate = grp.created_at ? grp.created_at.substring(11, 16) : '';
    const itemCount = grp.items.length;
    const orderedCount = grp.items.filter(h => h.order_qty > 0).length;

    html += `<div class="section-card" style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;padding:2px 0" onclick="BakerySection.toggleShGroup('shGrp-${idx}')">
        <div>
          <span style="font-size:13px;font-weight:700;color:var(--acc)">${esc(grp.order_id)}</span>
          <span style="font-size:11px;color:var(--t3);margin-left:8px">${itemCount} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23 \u00B7 \u0E2A\u0E31\u0E48\u0E07 ${orderedCount}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;color:var(--t3)">\u0E2A\u0E48\u0E07 ${BK.fmtDateThai(grp.delivery_date)}${orderDate ? ' \u00B7 ' + orderDate : ''}</span>
          <span id="shArr-${idx}" style="font-size:12px;color:var(--t4)">\u25B8</span>
        </div>
      </div>
      <div id="shGrp-${idx}" style="display:none;margin-top:8px">
        <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="border-bottom:1.5px solid var(--bd)">
            <th style="text-align:left;padding:5px 8px;font-weight:600;font-size:11px">Product</th>
            <th style="text-align:center;padding:5px 4px;font-weight:600;font-size:11px">Quota</th>
            <th style="text-align:center;padding:5px 4px;font-weight:600;font-size:11px">Stock</th>
            <th style="text-align:center;padding:5px 4px;font-weight:600;font-size:11px">Order</th>
          </tr></thead><tbody>`;

    grp.items.forEach(h => {
      const isZeroBoth = h.stock_on_hand === 0 && h.order_qty === 0;
      const bg = isZeroBoth ? ' style="background:var(--red-bg)"' : '';
      const sColor = h.stock_on_hand === 0 ? 'color:var(--red);font-weight:600' : '';
      const oWeight = h.order_qty > 0 ? 'font-weight:600' : 'color:var(--t4)';
      html += `<tr${bg}>
        <td style="padding:4px 8px;text-align:left;border-bottom:0.5px solid var(--bd2)">${esc(h.product_name)}</td>
        <td style="padding:4px;text-align:center;border-bottom:0.5px solid var(--bd2);color:var(--t3)">${h.quota_qty}</td>
        <td style="padding:4px;text-align:center;border-bottom:0.5px solid var(--bd2);${sColor}">${h.stock_on_hand}</td>
        <td style="padding:4px;text-align:center;border-bottom:0.5px solid var(--bd2);${oWeight}">${h.order_qty}</td>
      </tr>`;
    });

    html += '</tbody></table></div>';
    html += `<div style="text-align:right;margin-top:6px"><span style="font-size:11px;color:var(--acc);cursor:pointer;text-decoration:underline" onclick="event.stopPropagation();SPG.go('bakery/order-detail',{id:'${esc(grp.order_id)}'})">\u0E14\u0E39 Order \u2192</span></div>`;
    html += '</div></div>';
  });

  if (hasMore) {
    html += '<div class="load-more" onclick="BakerySection.showMoreSh()">\u0E41\u0E2A\u0E14\u0E07 ' + _shShowCount + ' \u0E08\u0E32\u0E01 ' + orderGroups.length + ' orders \u00B7 \u0E42\u0E2B\u0E25\u0E14\u0E40\u0E1E\u0E34\u0E48\u0E21 \u2193</div>';
  }

  el.innerHTML = html;
}

function toggleShGroup(id) {
  const body = document.getElementById(id);
  if (!body) return;
  const idx = id.replace('shGrp-', '');
  const arr = document.getElementById('shArr-' + idx);
  if (body.style.display === 'none') {
    body.style.display = 'block';
    if (arr) arr.textContent = '\u25BE';
  } else {
    body.style.display = 'none';
    if (arr) arr.textContent = '\u25B8';
  }
}

function setShDate(which, val) {
  if (which === 'from') { _shDateFrom = val; S.stockHistDateFrom = val; }
  else { _shDateTo = val; S.stockHistDateTo = val; }
  BK.loadStockHistory();
}

function setShDatePreset(p) {
  const today = BK.todaySydney();
  if (p === '3day') {
    const d = BK.sydneyNow(); d.setDate(d.getDate() - 2);
    _shDateFrom = BK.fmtDate(d);
  } else if (p === '7day') {
    const d = BK.sydneyNow(); d.setDate(d.getDate() - 6);
    _shDateFrom = BK.fmtDate(d);
  }
  _shDateTo = today;
  S.stockHistDateFrom = _shDateFrom;
  S.stockHistDateTo = _shDateTo;
  BK.loadStockHistory();
}

function showMoreSh() { _shShowCount += 10; fillStockHistory(); }


// ═══════════════════════════════════════
// 7. SET QUOTA
// ═══════════════════════════════════════
const DAYS = ['\u0E08','\u0E2D','\u0E1E','\u0E1E\u0E24','\u0E28','\u0E2A','\u0E2D\u0E32'];
const DAY_MAP = [1,2,3,4,5,6,0];
let _quotaSearch = '';
let _quotaCatFilter = 'all';
let _quotaSnapshot = {};

BK.renderQuota = function(p) {
  _quotaSearch = '';
  _quotaCatFilter = 'all';
  _quotaSnapshot = {};
  return SPG.shell(`<div class="toolbar"><button class="toolbar-back" onclick="SPG.go('bakery/dashboard')">\u2190</button><div class="toolbar-title">Set Quota</div></div>
    <div class="content" id="quotaContent"><div class="skel skel-card"></div><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.loadQuota = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  await BK.ensureProducts();
  try {
    const data = await BK.api('get_quotas', {});
    S.quotaMap = data || {};
  } catch (e) { SPG.toast('Failed to load quotas', 'error'); }
  fillQuota();
};

function fillQuota() {
  const el = document.getElementById('quotaContent');
  if (!el) return;
  const prods = S.products;
  if (!prods.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">\uD83D\uDCCA</div><div class="empty-title">\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</div></div>'; return; }

  const cats = S.categories || [];
  const catChips = `<div class="chip${_quotaCatFilter === 'all' ? ' active' : ''}" onclick="BakerySection.setQuotaCat('all')">\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14</div>` +
    cats.map(c => `<div class="chip${_quotaCatFilter === c.cat_id ? ' active' : ''}" onclick="BakerySection.setQuotaCat('${c.cat_id}')">${esc(c.cat_name)}</div>`).join('');

  const saveBtn = '<div style="display:flex;justify-content:center;margin-bottom:12px"><button class="btn btn-primary" style="padding:10px 40px" id="quotaSaveBtnTop" onclick="BakerySection.saveQuota()">\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01</button></div>';

  el.innerHTML = `<div class="q-wrap">
    <div style="font-size:11px;color:var(--t3);margin-bottom:8px">\u0E42\u0E04\u0E27\u0E15\u0E32\u0E15\u0E48\u0E2D\u0E27\u0E31\u0E19 \u00B7 ${prods.length} \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</div>
    <input class="search-input" placeholder="\uD83D\uDD0D \u0E04\u0E49\u0E19\u0E2B\u0E32..." value="${esc(_quotaSearch)}" oninput="BakerySection.filterQuota(this.value)" style="max-width:400px;margin-bottom:8px">
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px">${catChips}</div>
    ${saveBtn}
    <div id="quotaDesk" class="q-desk-only"></div>
    <div id="quotaMob" class="q-mob-only"></div>
    <div style="display:flex;justify-content:center;margin:14px 0">
      <button class="btn btn-primary" style="padding:10px 40px" id="quotaSaveBtn" onclick="BakerySection.saveQuota()">\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01</button>
    </div>
  </div>`;
  renderQuotaTable();
  renderQuotaMobile();

  _quotaSnapshot = {};
  prods.forEach(p => {
    const pq = (S.quotaMap || {})[p.product_id] || {};
    DAY_MAP.forEach(dow => {
      _quotaSnapshot[p.product_id + '-' + dow] = pq[dow] || 0;
    });
  });
}

function getFilteredProducts() {
  let prods = S.products;
  if (_quotaCatFilter !== 'all') prods = prods.filter(p => p.cat_id === _quotaCatFilter || p.category_id === _quotaCatFilter);
  if (_quotaSearch) {
    const s = _quotaSearch.toLowerCase();
    prods = prods.filter(p => (p.product_name || '').toLowerCase().includes(s));
  }
  return prods;
}

function filterQuota(val) {
  _quotaSearch = val;
  renderQuotaTable();
  renderQuotaMobile();
}

function setQuotaCat(catId) {
  _quotaCatFilter = catId;
  fillQuota();
}

// ─── Desktop: Table ───
function renderQuotaTable() {
  const el = document.getElementById('quotaDesk');
  if (!el) return;
  const prods = getFilteredProducts();
  const qm = S.quotaMap || {};

  let rows = prods.map(p => {
    const pq = qm[p.product_id] || {};
    const cells = DAY_MAP.map(dow =>
      `<td><input type="number" min="0" class="q-inp" id="qi-${p.product_id}-${dow}" value="${pq[dow] || 0}"></td>`
    ).join('');
    return `<tr><td class="q-name">${esc(p.product_name)}</td>${cells}</tr>`;
  }).join('');

  el.innerHTML = `<div class="q-card"><table class="q-tbl">
    <thead><tr><th>\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32</th>${DAYS.map(d => '<th>' + d + '</th>').join('')}</tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

// ─── Mobile: Accordion ───
function renderQuotaMobile() {
  const el = document.getElementById('quotaMob');
  if (!el) return;
  const prods = getFilteredProducts();
  const qm = S.quotaMap || {};

  el.innerHTML = prods.map(p => {
    const pq = qm[p.product_id] || {};
    const summary = DAY_MAP.map(dow => pq[dow] || 0).join('\u00B7');
    return `<div class="qacc" id="qacc-${p.product_id}">
      <div class="qacc-hd" onclick="BakerySection.toggleQuotaAcc('${p.product_id}')">
        <div class="qacc-name">${esc(p.product_name)}</div>
        <span class="qacc-sum">${summary}</span>
        <span class="qacc-arr">\u25B8</span>
      </div>
    </div>`;
  }).join('');
}

function toggleQuotaAcc(pid) {
  const card = document.getElementById('qacc-' + pid);
  if (!card) return;
  const existing = card.querySelector('.qacc-body');
  const arr = card.querySelector('.qacc-arr');

  if (existing) {
    existing.remove();
    card.classList.remove('qacc-open');
    if (arr) arr.textContent = '\u25B8';
    return;
  }

  card.classList.add('qacc-open');
  if (arr) arr.textContent = '\u25BE';
  const qm = S.quotaMap || {};
  const pq = qm[pid] || {};

  const body = document.createElement('div');
  body.className = 'qacc-body';
  body.innerHTML = `<div class="qacc-grid">${DAY_MAP.map((dow, i) =>
    `<div><div class="qacc-day">${DAYS[i]}</div><input type="number" min="0" class="qacc-inp" id="qi-${pid}-${dow}" value="${pq[dow] || 0}"></div>`
  ).join('')}</div>`;
  card.appendChild(body);
}

async function saveQuota() {
  const btn = document.getElementById('quotaSaveBtn');
  const btnTop = document.getElementById('quotaSaveBtnTop');
  if (btn?.disabled || btnTop?.disabled) return;

  const changed = [];
  S.products.forEach(p => {
    DAY_MAP.forEach(dow => {
      const inp = document.getElementById('qi-' + p.product_id + '-' + dow);
      if (!inp) return;
      const newVal = parseInt(inp.value) || 0;
      const oldVal = _quotaSnapshot[p.product_id + '-' + dow] || 0;
      if (newVal !== oldVal) {
        changed.push({ product_id: p.product_id, day_of_week: dow, quota_qty: newVal });
      }
    });
  });

  if (!changed.length) { SPG.toast('\u0E44\u0E21\u0E48\u0E21\u0E35\u0E01\u0E32\u0E23\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E41\u0E1B\u0E25\u0E07', 'warning'); return; }

  if (btn) { btn.disabled = true; btn.textContent = '\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01...'; }
  if (btnTop) { btnTop.disabled = true; btnTop.textContent = '\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01...'; }

  try {
    const s = SPG.api.getSession();
    const resp = await BK.api('save_quotas', {
      store_id: s.store_id,
      dept_id: s.dept_id,
      quotas: changed,
    });
    if (resp.success) {
      SPG.toast(`\u2705 \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01 ${changed.length} \u0E23\u0E32\u0E22\u0E01\u0E32\u0E23`, 'success');
      changed.forEach(q => {
        if (!S.quotaMap[q.product_id]) S.quotaMap[q.product_id] = {};
        S.quotaMap[q.product_id][q.day_of_week] = q.quota_qty;
        _quotaSnapshot[q.product_id + '-' + q.day_of_week] = q.quota_qty;
      });
      S._quotasDay = -1;
    } else {
      SPG.toast(resp.message || 'Error', 'error');
    }
  } catch (e) {
    SPG.toast('Network error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01'; }
    if (btnTop) { btnTop.disabled = false; btnTop.textContent = '\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01'; }
  }
}


// ═══════════════════════════════════════
// 8. WASTE LOG
// ═══════════════════════════════════════
let _wasteDateFrom = '';
let _wasteDateTo = '';
let _wasteShowCount = 5;
let _wasteSortKey = 'waste_date';
let _wasteSortDir = -1;

BK.renderWaste = function(p) {
  const y = BK.sydneyNow(); y.setDate(y.getDate() - 1);
  const t = BK.sydneyNow(); t.setDate(t.getDate() + 1);
  _wasteDateFrom = _wasteDateFrom || BK.fmtDate(y);
  _wasteDateTo = _wasteDateTo || BK.fmtDate(t);
  _wasteShowCount = 5;

  return SPG.shell(`<div class="toolbar"><button class="toolbar-back" onclick="SPG.go('bakery/dashboard')">\u2190</button><div class="toolbar-title">Waste Log</div></div>
    <div class="order-date-bar">
      <span class="date-label">\uD83D\uDCC5 \u0E27\u0E31\u0E19\u0E17\u0E35\u0E48:</span>
      <input type="date" class="date-inp" value="${_wasteDateFrom}" onchange="BakerySection.setWasteDate('from',this.value)">
      <span style="color:var(--t4)">\u2192</span>
      <input type="date" class="date-inp" value="${_wasteDateTo}" onchange="BakerySection.setWasteDate('to',this.value)">
      <span class="date-link" onclick="BakerySection.setWasteDatePreset('3day')">3 \u0E27\u0E31\u0E19</span>
      <span class="date-link" onclick="BakerySection.setWasteDatePreset('all')">\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14</span>
    </div>
    <div class="content" id="wasteContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.loadWaste = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  await BK.ensureProducts();

  if (S._wasteLoaded) { fillWaste(); return; }
  S._wasteLoading = true;
  try {
    const d = BK.sydneyNow(); d.setDate(d.getDate() - 14);
    const data = await BK.api('get_waste_log', { date_from: BK.fmtDate(d) });
    S.wasteLog = Array.isArray(data) ? data : (data?.waste_log || []);
    S._wasteLoaded = true;
  } finally { S._wasteLoading = false; }
  fillWaste();
};

function fillWaste() {
  const el = document.getElementById('wasteContent');
  if (!el) return;
  const all = S.wasteLog || [];

  let filtered = all;
  if (_wasteDateFrom) filtered = filtered.filter(w => (w.waste_date || '') >= _wasteDateFrom);
  if (_wasteDateTo) filtered = filtered.filter(w => (w.waste_date || '') <= _wasteDateTo);

  if (!filtered.length) {
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div></div><button class="btn btn-primary" onclick="BakerySection.showWasteForm()">+ \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E43\u0E2B\u0E21\u0E48</button></div>
      <div class="empty"><div class="empty-icon">\u2705</div><div class="empty-title">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23 Waste</div></div>`;
    return;
  }

  filtered = sortArr(filtered, _wasteSortKey, _wasteSortDir);

  const visible = filtered.slice(0, _wasteShowCount);
  const hasMore = filtered.length > _wasteShowCount;
  const reasonColor = (r) => r === 'Expired' ? 'var(--red)' : r === 'Damaged' ? 'var(--orange)' : 'var(--t2)';
  const wsb = (k, lbl) => `<span class="sort-btn${_wasteSortKey === k ? ' sort-active' : ''}" onclick="BakerySection.sortWaste('${k}')">${lbl} ${sortIco(_wasteSortKey, k, _wasteSortDir)}</span>`;

  el.innerHTML = `<div class="list-header">
      <div class="sort-bar">Sort: ${wsb('waste_date','\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48')} ${wsb('product_name','\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32')} ${wsb('quantity','\u0E08\u0E33\u0E19\u0E27\u0E19')} ${wsb('reason','\u0E2A\u0E32\u0E40\u0E2B\u0E15\u0E38')}</div>
      <button class="btn btn-primary" onclick="BakerySection.showWasteForm()">+ \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E43\u0E2B\u0E21\u0E48</button>
    </div>
    <div class="waste-list">${visible.map(w => `<div class="wcard" style="border-left-color:${reasonColor(w.reason)}">
      <div class="wcard-hd"><span class="wcard-name">${esc(w.product_name)}</span><span class="wcard-qty">\u2212${w.quantity} ${esc(w.unit)}</span></div>
      <div class="wcard-meta">${BK.fmtDateAU(w.waste_date)} \u00B7 ${esc(w.reason)} \u00B7 \u0E42\u0E14\u0E22 ${esc(w.recorded_by_name)}</div>
      <div class="wcard-actions">
        <span class="wcard-edit" onclick="BakerySection.showWasteEdit('${w.waste_id}')">\u270F\uFE0F \u0E41\u0E01\u0E49\u0E44\u0E02</span>
        <span class="wcard-del" onclick="BakerySection.confirmDeleteWaste('${w.waste_id}')">\uD83D\uDDD1\uFE0F \u0E25\u0E1A</span>
      </div>
    </div>`).join('')}</div>
    ${hasMore ? `<div class="load-more" onclick="BakerySection.showMoreWaste()">\u0E41\u0E2A\u0E14\u0E07 ${_wasteShowCount} \u0E08\u0E32\u0E01 ${filtered.length} \u00B7 \u0E42\u0E2B\u0E25\u0E14\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2D\u0E35\u0E01 5 \u2193</div>` : ''}`;
}

function setWasteDate(which, val) { if (which === 'from') _wasteDateFrom = val; else _wasteDateTo = val; fillWaste(); }
function sortWaste(key) { if (_wasteSortKey === key) _wasteSortDir *= -1; else { _wasteSortKey = key; _wasteSortDir = key === 'waste_date' ? -1 : 1; } fillWaste(); }
function setWasteDatePreset(p) {
  if (p === '3day') { const y = BK.sydneyNow(); y.setDate(y.getDate() - 1); const t = BK.sydneyNow(); t.setDate(t.getDate() + 1); _wasteDateFrom = BK.fmtDate(y); _wasteDateTo = BK.fmtDate(t); }
  else { _wasteDateFrom = ''; _wasteDateTo = ''; }
  fillWaste();
}
function showMoreWaste() { _wasteShowCount += 5; fillWaste(); }

// ─── Waste Form Popup (Create) ───
function showWasteForm() {
  const prods = S.products || [];
  const opts = prods.map(p => `<option value="${p.product_id}">${esc(p.product_name)} (${esc(p.unit)})</option>`).join('');
  const s = SPG.api.getSession() || {};

  SPG.showDialog(`<div class="popup-sheet">
    <div class="popup-header"><div class="popup-title">\uD83D\uDDD1\uFE0F \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E02\u0E2D\u0E07\u0E40\u0E2A\u0E35\u0E22</div><button class="popup-close" onclick="SPG.closeDialog()">\u2715</button></div>
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd2);margin-bottom:6px;font-size:11px"><span style="color:var(--t3)">\u0E1C\u0E39\u0E49\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01</span><span style="font-weight:600;color:var(--acc)">${esc(s.display_name)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd2);margin-bottom:12px;font-size:11px"><span style="color:var(--t3)">\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48</span><span style="font-weight:600;color:var(--acc)">${BK.fmtDateThai(BK.todaySydney())} (auto)</span></div>
    <div class="fg"><label class="lb">\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 *</label><select class="sel" id="wfProduct"><option value="">\uD83D\uDD0D \u0E40\u0E25\u0E37\u0E2D\u0E01...</option>${opts}</select></div>
    <div class="fg"><label class="lb">\u0E08\u0E33\u0E19\u0E27\u0E19 *</label><input class="inp" type="number" id="wfQty" placeholder="0" min="1" style="font-size:16px;font-weight:700"></div>
    <div class="fg"><label class="lb">\u0E27\u0E31\u0E19\u0E1C\u0E25\u0E34\u0E15</label><input class="inp" type="date" id="wfProdDate"></div>
    <div class="fg"><label class="lb">\u0E2A\u0E32\u0E40\u0E2B\u0E15\u0E38 *</label><select class="sel" id="wfReason"><option value="Expired">Expired</option><option value="Damaged">Damaged</option></select></div>
    <div class="fg"><label class="lb">\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38</label><input class="inp" id="wfNote" placeholder="\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21 (\u0E16\u0E49\u0E32\u0E21\u0E35)"></div>
    <div style="display:flex;gap:8px"><button class="btn btn-outline" style="flex:1" onclick="SPG.closeDialog()">\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01</button><button class="btn btn-primary" style="flex:1" id="wfSaveBtn" onclick="BakerySection.saveWaste()">\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01</button></div>
  </div>`);
}

async function saveWaste() {
  const btn = document.getElementById('wfSaveBtn');
  if (!btn || btn.disabled) return;

  const productId = document.getElementById('wfProduct')?.value;
  const qty = parseInt(document.getElementById('wfQty')?.value) || 0;
  const reason = document.getElementById('wfReason')?.value;
  const prodDate = document.getElementById('wfProdDate')?.value || '';
  const note = document.getElementById('wfNote')?.value || '';

  if (!productId) { SPG.toast('\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32', 'error'); return; }
  if (!qty || qty <= 0) { SPG.toast('\u0E43\u0E2A\u0E48\u0E08\u0E33\u0E19\u0E27\u0E19', 'error'); return; }

  btn.disabled = true; btn.textContent = '\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01...';
  try {
    const resp = await BK.api('create_waste', { product_id: productId, quantity: qty, reason, production_date: prodDate, note });
    if (resp.success) {
      SPG.closeDialog();
      SPG.toast(resp.message || '\u2705 \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01\u0E41\u0E25\u0E49\u0E27', 'success');
      const prod = S.products.find(p => p.product_id === productId);
      S.wasteLog.unshift({
        waste_id: resp.data.waste_id, product_id: productId, quantity: qty,
        waste_date: BK.todaySydney(), production_date: prodDate, reason,
        product_name: prod?.product_name || productId, unit: prod?.unit || '',
        recorded_by_name: SPG.api.getSession()?.display_name || '',
      });
      fillWaste();
    } else {
      SPG.toast(resp.message || 'Error', 'error');
      btn.disabled = false; btn.textContent = '\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01';
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
    btn.disabled = false; btn.textContent = '\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01';
  }
}

// ─── Waste Edit Popup ───
function showWasteEdit(wasteId) {
  const w = S.wasteLog.find(x => x.waste_id === wasteId);
  if (!w) return;

  SPG.showDialog(`<div class="popup-sheet" style="width:380px">
    <div class="popup-header"><div class="popup-title">\u270F\uFE0F \u0E41\u0E01\u0E49\u0E44\u0E02 \u2014 ${esc(w.product_name)}</div><button class="popup-close" onclick="SPG.closeDialog()">\u2715</button></div>
    <div class="fg"><label class="lb">\u0E08\u0E33\u0E19\u0E27\u0E19 *</label><input class="inp" type="number" id="weQty" value="${w.quantity}" min="1" style="font-size:16px;font-weight:700"></div>
    <div class="fg"><label class="lb">\u0E27\u0E31\u0E19\u0E1C\u0E25\u0E34\u0E15</label><input class="inp" type="date" id="weProdDate" value="${w.production_date || ''}"></div>
    <div class="fg"><label class="lb">\u0E2A\u0E32\u0E40\u0E2B\u0E15\u0E38</label><select class="sel" id="weReason">
      <option value="Expired"${w.reason === 'Expired' ? ' selected' : ''}>Expired</option>
      <option value="Damaged"${w.reason === 'Damaged' ? ' selected' : ''}>Damaged</option>
    </select></div>
    <div class="fg"><label class="lb">\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38</label><input class="inp" id="weNote" value="${esc(w.note || '')}" placeholder="\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E40\u0E15\u0E34\u0E21 (\u0E16\u0E49\u0E32\u0E21\u0E35)"></div>
    <div style="display:flex;gap:8px"><button class="btn btn-outline" style="flex:1" onclick="SPG.closeDialog()">\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01</button><button class="btn btn-primary" style="flex:1" id="weSaveBtn" onclick="BakerySection.saveWasteEdit('${wasteId}')">\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01</button></div>
  </div>`);
}

async function saveWasteEdit(wasteId) {
  const btn = document.getElementById('weSaveBtn');
  if (!btn || btn.disabled) return;
  btn.disabled = true; btn.textContent = '\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01...';

  const qty = parseInt(document.getElementById('weQty')?.value) || 0;
  const reason = document.getElementById('weReason')?.value;
  const prodDate = document.getElementById('weProdDate')?.value || '';
  const note = document.getElementById('weNote')?.value || '';

  try {
    const resp = await BK.api('edit_waste', { waste_id: wasteId, quantity: qty, reason, production_date: prodDate, note });
    if (resp.success) {
      SPG.closeDialog();
      SPG.toast('\u2705 \u0E41\u0E01\u0E49\u0E44\u0E02\u0E41\u0E25\u0E49\u0E27', 'success');
      const w = S.wasteLog.find(x => x.waste_id === wasteId);
      if (w) { w.quantity = qty; w.reason = reason; w.production_date = prodDate; w.note = note; }
      fillWaste();
    } else {
      SPG.toast(resp.message || 'Error', 'error');
      btn.disabled = false; btn.textContent = '\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01';
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
    btn.disabled = false; btn.textContent = '\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01';
  }
}

// ─── Waste Delete ───
function confirmDeleteWaste(wasteId) {
  SPG.showDialog(`<div class="popup-sheet" style="width:320px">
    <div class="popup-title" style="margin-bottom:12px">\uD83D\uDDD1\uFE0F \u0E25\u0E1A\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E19\u0E35\u0E49?</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:16px">${esc(wasteId)}</div>
    <div style="display:flex;gap:8px"><button class="btn btn-outline" style="flex:1" onclick="SPG.closeDialog()">\u0E44\u0E21\u0E48\u0E43\u0E0A\u0E48</button><button class="btn btn-danger" style="flex:1" id="wDelBtn" onclick="BakerySection.doDeleteWaste('${wasteId}')">\u0E25\u0E1A\u0E40\u0E25\u0E22</button></div>
  </div>`);
}

async function doDeleteWaste(wasteId) {
  const btn = document.getElementById('wDelBtn');
  if (!btn || btn.disabled) return;
  btn.disabled = true; btn.textContent = '\u0E01\u0E33\u0E25\u0E31\u0E07\u0E25\u0E1A...';

  try {
    const resp = await BK.api('delete_waste', { waste_id: wasteId });
    if (resp.success) {
      SPG.closeDialog();
      SPG.toast('\u2705 \u0E25\u0E1A\u0E41\u0E25\u0E49\u0E27', 'success');
      S.wasteLog = S.wasteLog.filter(w => w.waste_id !== wasteId);
      fillWaste();
    } else {
      SPG.toast(resp.message || 'Error', 'error');
      btn.disabled = false; btn.textContent = '\u0E25\u0E1A\u0E40\u0E25\u0E22';
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
    btn.disabled = false; btn.textContent = '\u0E25\u0E1A\u0E40\u0E25\u0E22';
  }
}


// ═══════════════════════════════════════
// 9. RETURNS
// ═══════════════════════════════════════
let _retDateFrom = '';
let _retDateTo = '';
let _retShowCount = 5;
let _retSortKey = 'created_at';
let _retSortDir = -1;

BK.renderReturns = function(p) {
  const y = BK.sydneyNow(); y.setDate(y.getDate() - 1);
  const t = BK.sydneyNow(); t.setDate(t.getDate() + 1);
  _retDateFrom = _retDateFrom || BK.fmtDate(y);
  _retDateTo = _retDateTo || BK.fmtDate(t);
  _retShowCount = 5;

  return SPG.shell(`<div class="toolbar"><button class="toolbar-back" onclick="SPG.go('bakery/dashboard')">\u2190</button><div class="toolbar-title">Returns</div></div>
    <div class="order-date-bar">
      <span class="date-label">\uD83D\uDCC5 \u0E27\u0E31\u0E19\u0E17\u0E35\u0E48:</span>
      <input type="date" class="date-inp" value="${_retDateFrom}" onchange="BakerySection.setRetDate('from',this.value)">
      <span style="color:var(--t4)">\u2192</span>
      <input type="date" class="date-inp" value="${_retDateTo}" onchange="BakerySection.setRetDate('to',this.value)">
      <span class="date-link" onclick="BakerySection.setRetDatePreset('3day')">3 \u0E27\u0E31\u0E19</span>
      <span class="date-link" onclick="BakerySection.setRetDatePreset('all')">\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14</span>
    </div>
    <div class="content" id="returnsContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.loadReturns = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  await BK.ensureProducts();

  if (S._retsLoaded) { fillReturns(); return; }
  S._retsLoading = true;
  try {
    const data = await BK.api('get_returns');
    S.returns = Array.isArray(data) ? data : (data?.returns || []);
    S._retsLoaded = true;
  } finally { S._retsLoading = false; }
  fillReturns();
};

function fillReturns() {
  const el = document.getElementById('returnsContent');
  if (!el) return;
  const all = S.returns || [];

  let filtered = all;
  if (_retDateFrom) filtered = filtered.filter(r => (r.created_at || '').substring(0, 10) >= _retDateFrom);
  if (_retDateTo) filtered = filtered.filter(r => (r.created_at || '').substring(0, 10) <= _retDateTo);

  if (!filtered.length) {
    el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div></div><button class="btn btn-primary" onclick="BakerySection.showReturnForm()">\u2795 \u0E41\u0E08\u0E49\u0E07 Return</button></div>
      <div class="empty"><div class="empty-icon">\u2705</div><div class="empty-title">\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35 Return</div></div>`;
    return;
  }

  filtered = sortArr(filtered, _retSortKey, _retSortDir);

  const visible = filtered.slice(0, _retShowCount);
  const hasMore = filtered.length > _retShowCount;
  const rsb = (k, lbl) => `<span class="sort-btn${_retSortKey === k ? ' sort-active' : ''}" onclick="BakerySection.sortReturns('${k}')">${lbl} ${sortIco(_retSortKey, k, _retSortDir)}</span>`;

  el.innerHTML = `<div class="list-header">
      <div class="sort-bar">Sort: ${rsb('created_at','\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48')} ${rsb('product_name','\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32')} ${rsb('status','Status')}</div>
      <button class="btn btn-primary" onclick="BakerySection.showReturnForm()">\u2795 \u0E41\u0E08\u0E49\u0E07 Return</button>
    </div>
    <div class="ret-list">${visible.map(r => renderReturnCard(r)).join('')}</div>
    ${hasMore ? `<div class="load-more" onclick="BakerySection.showMoreReturns()">\u0E41\u0E2A\u0E14\u0E07 ${_retShowCount} \u0E08\u0E32\u0E01 ${filtered.length} \u00B7 \u0E42\u0E2B\u0E25\u0E14\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E2D\u0E35\u0E01 5 \u2193</div>` : ''}`;
}

function renderReturnCard(r) {
  const resolved = ['Reworked', 'Wasted'].includes(r.status);
  const stsStyle = {
    Reported: 'background:#fffbeb;color:#92400e',
    Received: 'background:#dbeafe;color:#1e40af',
    Wasted: 'background:#fef2f2;color:#991b1b',
    Reworked: 'background:#d1fae5;color:#065f46',
  }[r.status] || 'background:var(--bg3);color:var(--t2)';
  const borderColor = { Reported: 'var(--orange)', Received: 'var(--blue)', Wasted: 'var(--red)', Reworked: 'var(--green)' }[r.status] || 'var(--bd)';
  const canEdit = r.status === 'Reported';

  return `<div class="rcard${resolved ? ' rcard-done' : ''}" style="border-left-color:${borderColor}">
    <div class="rcard-hd"><span class="rcard-id">${esc(r.return_id)}</span><span class="sts" style="${stsStyle}">${r.status}</span></div>
    <div class="rcard-prod">${esc(r.product_name)} \u00D7${r.quantity}</div>
    <div class="rcard-meta">${esc(r.issue_type)} \u00B7 ${esc(r.action === 'return_to_bakery' ? '\u0E2A\u0E48\u0E07\u0E04\u0E37\u0E19 BC' : '\u0E17\u0E34\u0E49\u0E07\u0E17\u0E35\u0E48\u0E23\u0E49\u0E32\u0E19')}</div>
    <div class="rcard-actions">
      <button class="btn btn-outline" style="padding:3px 10px;font-size:11px" onclick="BakerySection.showReturnDetail('${r.return_id}')">\uD83D\uDC41\uFE0F Detail</button>
      ${canEdit ? `<button class="btn btn-outline" style="padding:3px 10px;font-size:11px;color:var(--acc);border-color:var(--acc)" onclick="BakerySection.showReturnEdit('${r.return_id}')">\u270F\uFE0F \u0E41\u0E01\u0E49\u0E44\u0E02</button>` : resolved ? '<span style="font-size:10px;color:var(--t4);padding:4px 0">\u2705 BC \u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23\u0E41\u0E25\u0E49\u0E27</span>' : '<span style="font-size:10px;color:var(--t4);padding:4px 0">\uD83D\uDD12 BC \u0E23\u0E31\u0E1A\u0E41\u0E25\u0E49\u0E27</span>'}
    </div>
  </div>`;
}

function setRetDate(which, val) { if (which === 'from') _retDateFrom = val; else _retDateTo = val; fillReturns(); }
function sortReturns(key) { if (_retSortKey === key) _retSortDir *= -1; else { _retSortKey = key; _retSortDir = key === 'created_at' ? -1 : 1; } fillReturns(); }
function setRetDatePreset(p) {
  if (p === '3day') { const y = BK.sydneyNow(); y.setDate(y.getDate() - 1); const t = BK.sydneyNow(); t.setDate(t.getDate() + 1); _retDateFrom = BK.fmtDate(y); _retDateTo = BK.fmtDate(t); }
  else { _retDateFrom = ''; _retDateTo = ''; }
  fillReturns();
}
function showMoreReturns() { _retShowCount += 5; fillReturns(); }

// ─── Return Detail Popup (Timeline) ───
function showReturnDetail(returnId) {
  const r = S.returns.find(x => x.return_id === returnId);
  if (!r) return;
  const actionLabel = r.action === 'return_to_bakery' ? '\uD83D\uDCE6 \u0E2A\u0E48\u0E07\u0E04\u0E37\u0E19 BC' : '\uD83D\uDDD1\uFE0F \u0E17\u0E34\u0E49\u0E07\u0E17\u0E35\u0E48\u0E23\u0E49\u0E32\u0E19';
  const stsStyle = { Reported: 'background:#fffbeb;color:#92400e', Received: 'background:#dbeafe;color:#1e40af', Wasted: 'background:#fef2f2;color:#991b1b', Reworked: 'background:#d1fae5;color:#065f46' }[r.status] || '';

  let timeline = `<div class="ret-tl-item"><div class="ret-tl-dot" style="background:var(--orange)"></div><span><b>Reported</b> \u2014 ${esc(r.reported_by_name)} \u00B7 ${BK.fmtDateThai(r.created_at?.substring(0, 10))}</span></div>`;
  if (r.status === 'Received') {
    timeline += `<div class="ret-tl-item"><div class="ret-tl-dot" style="background:var(--blue)"></div><span><b>Received</b> \u2014 BC \u0E23\u0E31\u0E1A\u0E41\u0E25\u0E49\u0E27</span></div>`;
    timeline += `<div class="ret-tl-item ret-tl-pending"><div class="ret-tl-dot ret-tl-dot-pending"></div><span>\u0E23\u0E2D\u0E14\u0E33\u0E40\u0E19\u0E34\u0E19\u0E01\u0E32\u0E23...</span></div>`;
  } else if (['Reworked', 'Wasted'].includes(r.status)) {
    timeline += `<div class="ret-tl-item"><div class="ret-tl-dot" style="background:var(--blue)"></div><span><b>Received</b></span></div>`;
    timeline += `<div class="ret-tl-item"><div class="ret-tl-dot" style="background:var(--green)"></div><span><b>${r.status}</b>${r.resolved_by_name ? ' \u2014 ' + esc(r.resolved_by_name) : ''}</span></div>`;
  } else {
    timeline += `<div class="ret-tl-item ret-tl-pending"><div class="ret-tl-dot ret-tl-dot-pending"></div><span>\u0E23\u0E2D BC \u0E23\u0E31\u0E1A...</span></div>`;
  }

  const canEdit = r.status === 'Reported';
  SPG.showDialog(`<div class="popup-sheet" style="width:400px">
    <div class="popup-header"><div class="popup-title">\u21A9\uFE0F ${esc(r.return_id)}</div><span class="sts" style="${stsStyle}">${r.status}</span></div>
    <div style="font-size:13px;font-weight:600;margin-bottom:4px">${esc(r.product_name)}</div>
    <div style="font-size:12px;color:var(--t2);margin-bottom:12px;line-height:1.6">${r.quantity} ${esc(r.unit)} \u00B7 ${esc(r.issue_type)}<br>${r.description ? esc(r.description) + '<br>' : ''}${actionLabel}</div>
    <div style="font-size:12px;font-weight:600;margin-bottom:6px">\uD83D\uDCCA Timeline</div>
    <div class="ret-timeline">${timeline}</div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-outline" style="flex:1" onclick="SPG.closeDialog()">\u2190 \u0E1B\u0E34\u0E14</button>
      ${canEdit ? `<button class="btn btn-primary" style="flex:1" onclick="SPG.closeDialog();BakerySection.showReturnEdit('${r.return_id}')">\u270F\uFE0F \u0E41\u0E01\u0E49\u0E44\u0E02</button>` : ''}
    </div>
  </div>`);
}

// ─── Return Form Popup (Create) ───
function showReturnForm() {
  const prods = S.products || [];
  const opts = prods.map(p => `<option value="${p.product_id}">${esc(p.product_name)} (${esc(p.unit)})</option>`).join('');

  SPG.showDialog(`<div class="popup-sheet">
    <div class="popup-header"><div class="popup-title">\u21A9\uFE0F \u0E41\u0E08\u0E49\u0E07 Return</div><button class="popup-close" onclick="SPG.closeDialog()">\u2715</button></div>
    <div class="fg"><label class="lb">\u2776 \u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32 *</label><select class="sel" id="rfProduct"><option value="">-- \u0E40\u0E25\u0E37\u0E2D\u0E01 --</option>${opts}</select></div>
    <div class="fg"><label class="lb">\u2777 \u0E08\u0E33\u0E19\u0E27\u0E19 *</label><input class="inp" type="number" id="rfQty" min="1" style="font-size:16px;font-weight:700"></div>
    <div class="fg"><label class="lb">\u2778 \u0E1B\u0E31\u0E0D\u0E2B\u0E32 *</label><select class="sel" id="rfIssue"><option value="Quality">Quality</option><option value="Wrong Qty">Wrong Qty</option><option value="Wrong Product">Wrong Product</option><option value="Product Error">Product Error</option></select></div>
    <div class="fg"><label class="lb">\u2779 \u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14</label><textarea class="inp" id="rfDesc" style="height:60px;resize:none" placeholder="\u0E2D\u0E18\u0E34\u0E1A\u0E32\u0E22..."></textarea></div>
    <div class="fg"><label class="lb">\u277A \u0E27\u0E31\u0E19\u0E1C\u0E25\u0E34\u0E15</label><input class="inp" type="date" id="rfProdDate"></div>
    <div class="fg"><label class="lb">\u277B \u0E01\u0E32\u0E23\u0E08\u0E31\u0E14\u0E01\u0E32\u0E23 *</label><select class="sel" id="rfAction"><option value="return_to_bakery">\u0E2A\u0E48\u0E07\u0E04\u0E37\u0E19 BC</option><option value="discard_at_store">\u0E17\u0E34\u0E49\u0E07\u0E17\u0E35\u0E48\u0E23\u0E49\u0E32\u0E19</option></select></div>
    <div style="display:flex;gap:8px"><button class="btn btn-outline" style="flex:1" onclick="SPG.closeDialog()">\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01</button><button class="btn btn-primary" style="flex:1" id="rfSaveBtn" onclick="BakerySection.saveReturn()">\uD83D\uDCE4 \u0E2A\u0E48\u0E07</button></div>
  </div>`);
}

async function saveReturn() {
  const btn = document.getElementById('rfSaveBtn');
  if (!btn || btn.disabled) return;

  const productId = document.getElementById('rfProduct')?.value;
  const qty = parseInt(document.getElementById('rfQty')?.value) || 0;
  const issueType = document.getElementById('rfIssue')?.value;
  const desc = document.getElementById('rfDesc')?.value || '';
  const prodDate = document.getElementById('rfProdDate')?.value || '';
  const action = document.getElementById('rfAction')?.value;

  if (!productId) { SPG.toast('\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32', 'error'); return; }
  if (!qty) { SPG.toast('\u0E43\u0E2A\u0E48\u0E08\u0E33\u0E19\u0E27\u0E19', 'error'); return; }

  btn.disabled = true; btn.textContent = '\u0E01\u0E33\u0E25\u0E31\u0E07\u0E2A\u0E48\u0E07...';
  try {
    const resp = await BK.api('report_return', { product_id: productId, quantity: qty, issue_type: issueType, description: desc, production_date: prodDate, action });
    if (resp.success) {
      SPG.closeDialog();
      SPG.toast(resp.message || '\u2705 \u0E41\u0E08\u0E49\u0E07\u0E41\u0E25\u0E49\u0E27', 'success');
      const prod = S.products.find(p => p.product_id === productId);
      S.returns.unshift({
        return_id: resp.data.return_id, product_id: productId, quantity: qty,
        issue_type: issueType, description: desc, action,
        status: action === 'discard_at_store' ? 'Wasted' : 'Reported',
        product_name: prod?.product_name || productId, unit: prod?.unit || '',
        reported_by_name: SPG.api.getSession()?.display_name || '',
        resolved_by_name: '', created_at: new Date().toISOString(),
      });
      if (action === 'discard_at_store') S._wasteLoaded = false;
      fillReturns();
    } else {
      SPG.toast(resp.message || 'Error', 'error');
      btn.disabled = false; btn.textContent = '\uD83D\uDCE4 \u0E2A\u0E48\u0E07';
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
    btn.disabled = false; btn.textContent = '\uD83D\uDCE4 \u0E2A\u0E48\u0E07';
  }
}

// ─── Return Edit Popup (only Reported status) ───
function showReturnEdit(returnId) {
  const r = S.returns.find(x => x.return_id === returnId);
  if (!r || r.status !== 'Reported') { SPG.toast('\u0E41\u0E01\u0E49\u0E44\u0E02\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49 \u2014 \u0E2A\u0E16\u0E32\u0E19\u0E30 ' + (r?.status || '?'), 'error'); return; }

  SPG.showDialog(`<div class="popup-sheet" style="width:380px">
    <div class="popup-header"><div class="popup-title">\u270F\uFE0F \u0E41\u0E01\u0E49\u0E44\u0E02 \u2014 ${esc(r.product_name)}</div><button class="popup-close" onclick="SPG.closeDialog()">\u2715</button></div>
    <div style="padding:10px 14px;background:var(--bg3);border-radius:var(--rd);margin-bottom:12px;font-size:12px">
      <div style="display:flex;justify-content:space-between"><span style="color:var(--t3)">\u0E40\u0E14\u0E34\u0E21</span><span style="font-weight:700">${r.quantity} ${esc(r.unit)}</span></div>
    </div>
    <div class="fg"><label class="lb">\u0E08\u0E33\u0E19\u0E27\u0E19\u0E43\u0E2B\u0E21\u0E48</label><input class="inp" type="number" id="reQty" value="${r.quantity}" min="1" style="font-size:16px;font-weight:700;width:120px;text-align:center"></div>
    <div class="fg"><label class="lb">\u0E1B\u0E31\u0E0D\u0E2B\u0E32</label><select class="sel" id="reIssue">
      <option value="Quality"${r.issue_type === 'Quality' ? ' selected' : ''}>Quality</option>
      <option value="Wrong Qty"${r.issue_type === 'Wrong Qty' ? ' selected' : ''}>Wrong Qty</option>
      <option value="Wrong Product"${r.issue_type === 'Wrong Product' ? ' selected' : ''}>Wrong Product</option>
      <option value="Product Error"${r.issue_type === 'Product Error' ? ' selected' : ''}>Product Error</option>
    </select></div>
    <div class="fg"><label class="lb">\u0E23\u0E32\u0E22\u0E25\u0E30\u0E40\u0E2D\u0E35\u0E22\u0E14</label><textarea class="inp" id="reDesc" style="height:50px;resize:none">${esc(r.description || '')}</textarea></div>
    <div style="display:flex;gap:8px"><button class="btn btn-outline" style="flex:1" onclick="SPG.closeDialog()">\u0E22\u0E01\u0E40\u0E25\u0E34\u0E01</button><button class="btn btn-primary" style="flex:1" id="reSaveBtn" onclick="BakerySection.saveReturnEdit('${r.return_id}')">\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01</button></div>
  </div>`);
}

async function saveReturnEdit(returnId) {
  const btn = document.getElementById('reSaveBtn');
  if (!btn || btn.disabled) return;
  btn.disabled = true; btn.textContent = '\u0E01\u0E33\u0E25\u0E31\u0E07\u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01...';

  const qty = parseInt(document.getElementById('reQty')?.value) || 0;
  const issueType = document.getElementById('reIssue')?.value;
  const desc = document.getElementById('reDesc')?.value || '';

  try {
    const resp = await BK.api('edit_return', { return_id: returnId, quantity: qty, issue_type: issueType, description: desc });
    if (resp.success) {
      SPG.closeDialog();
      SPG.toast('\u2705 \u0E41\u0E01\u0E49\u0E44\u0E02\u0E41\u0E25\u0E49\u0E27', 'success');
      const r = S.returns.find(x => x.return_id === returnId);
      if (r) { r.quantity = qty; r.issue_type = issueType; r.description = desc; }
      fillReturns();
    } else {
      SPG.toast(resp.message || 'Error', 'error');
      btn.disabled = false; btn.textContent = '\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01';
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
    btn.disabled = false; btn.textContent = '\uD83D\uDCBE \u0E1A\u0E31\u0E19\u0E17\u0E36\u0E01';
  }
}


// ═══════════════════════════════════════
// 10. STOCK ENTRY (new, no legacy equivalent)
// ═══════════════════════════════════════
BK.renderStock = function(p) {
  const sp = BK.getStockPoints();
  return SPG.shell(SPG.toolbar('Stock Entry') + `
    <div class="content">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div>
          <div style="font-size:13px;font-weight:700">Current Stock Levels</div>
          <div style="font-size:10px;color:var(--t3)">${sp === 2 ? '2-point entry (Point 1 + Point 2)' : 'Single point entry'}</div>
        </div>
        <button class="btn btn-sm btn-primary" id="bk-stock-save" onclick="BakerySection.saveStockEntry()">Save All</button>
      </div>
      <div style="margin-bottom:10px">
        <input class="inp" placeholder="Search products..." id="bk-stock-search" oninput="BakerySection.filterStockList()" style="font-size:12px;padding:8px 12px">
      </div>
      <div id="bk-stock-body">${SPG.ui.skeleton(60, 5)}</div>
    </div>`, 'Bakery');
};

BK.loadStock = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  await BK.ensureProducts();

  try {
    const data = await BK.api('get_stock');
    S._stockData = Array.isArray(data) ? data : (data?.stock || []);
  } catch (e) {
    S._stockData = [];
    console.error('Stock load:', e);
  }
  _fillStock();
};

function _fillStock() {
  const el = document.getElementById('bk-stock-body');
  if (!el) return;

  const prods = S.products;
  if (!prods.length) { el.innerHTML = SPG.ui.empty('\uD83D\uDCE6', 'No products found'); return; }

  const search = (document.getElementById('bk-stock-search')?.value || '').toLowerCase();
  let filtered = prods;
  if (search) filtered = filtered.filter(p => (p.product_name || '').toLowerCase().includes(search));
  if (!filtered.length) { el.innerHTML = SPG.ui.empty('\uD83D\uDD0D', 'No products match'); return; }

  const sp = BK.getStockPoints();
  const stockData = S._stockData || [];

  const stockMap = {};
  stockData.forEach(s => { stockMap[s.product_id] = s.stock_on_hand; });

  el.innerHTML = filtered.map(p => {
    const pid = p.product_id;
    const existing = stockMap[pid];
    const edited = S.stockInputs[pid];

    let inputHtml;
    if (sp === 2) {
      const v1 = edited?.s1 ?? (existing != null ? String(existing) : '');
      const v2 = edited?.s2 ?? '';
      const sum = (v1 !== '' || v2 !== '') ? (parseFloat(v1) || 0) + (parseFloat(v2) || 0) : '\u2014';
      inputHtml = `<div style="display:flex;gap:6px;align-items:center">
        <div style="text-align:center"><div style="font-size:9px;color:var(--t3)">Pt 1</div><input type="number" step="any" class="inp" style="width:60px;padding:4px;font-size:12px;text-align:center" value="${v1}" oninput="BakerySection.onStockEntry('${pid}',1,this.value)"></div>
        <div style="text-align:center"><div style="font-size:9px;color:var(--t3)">Pt 2</div><input type="number" step="any" class="inp" style="width:60px;padding:4px;font-size:12px;text-align:center" value="${v2}" oninput="BakerySection.onStockEntry('${pid}',2,this.value)"></div>
        <div style="font-size:11px;color:var(--t3);min-width:40px;text-align:center">= <strong>${sum}</strong></div>
      </div>`;
    } else {
      const v = (typeof edited === 'string') ? edited : (existing != null ? String(existing) : '');
      inputHtml = `<input type="number" step="any" class="inp" style="width:80px;padding:6px;font-size:12px;text-align:center" value="${v}" placeholder="\u2014" oninput="BakerySection.onStockEntry('${pid}',0,this.value)">`;
    }

    return `<div class="card" style="padding:10px 14px;margin-bottom:4px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="flex:1"><div style="font-size:12px;font-weight:600">${esc(p.product_name)}</div><div style="font-size:10px;color:var(--t3)">${esc(p.unit || '')}${existing != null ? ' \u00B7 Last: ' + existing : ''}</div></div>
        ${inputHtml}
      </div>
    </div>`;
  }).join('');
}

function _onStockEntry(pid, pt, val) {
  const sp = BK.getStockPoints();
  if (sp === 2) {
    if (!S.stockInputs[pid] || typeof S.stockInputs[pid] !== 'object') {
      S.stockInputs[pid] = { s1: '', s2: '' };
    }
    S.stockInputs[pid][pt === 1 ? 's1' : 's2'] = val;
  } else {
    S.stockInputs[pid] = val;
  }
}

async function _saveStockEntry() {
  const entries = [];
  const sp = BK.getStockPoints();

  for (const [pid, val] of Object.entries(S.stockInputs)) {
    let soh = null;
    if (sp === 2 && typeof val === 'object') {
      const v1 = parseFloat(val.s1) || 0;
      const v2 = parseFloat(val.s2) || 0;
      if (val.s1 !== '' || val.s2 !== '') soh = v1 + v2;
    } else if (typeof val === 'string' && val !== '') {
      soh = parseFloat(val) || 0;
    }
    if (soh !== null) entries.push({ product_id: pid, stock_on_hand: soh });
  }

  if (!entries.length) { SPG.toast('No stock data to save', 'error'); return; }

  SPG.showLoader();
  try {
    await BK.api('save_stock', { entries, date: BK.todaySydney() });
    SPG.toast('Stock saved! (' + entries.length + ' items)', 'success');
  } catch (e) {
    SPG.toast(e.message || 'Save failed', 'error');
  } finally {
    SPG.hideLoader();
  }
}

function _filterStockList() {
  _fillStock();
}


// ═══════════════════════════════════════
// ACTION HANDLERS (exposed via BakerySection)
// ═══════════════════════════════════════
Object.assign(window.BakerySection, {
  // Browse
  step,
  toggleUrg,
  onStock1,
  onStock2,
  setDate,
  setProductFilter,
  dFilterProducts,

  // Cart
  removeCartItem,
  submitOrder,

  // Orders
  setOrderFilter,
  setOrderSection,
  sortOrders,
  setOrderDate,
  setOrderDatePreset,
  showMoreOrders,

  // Order Detail
  showEditItem,
  saveEditItem,
  showChangeDate,
  doChangeDate,
  confirmCancel,
  doCancel,
  enterEditMode: BK.enterEditMode,

  // Quota
  filterQuota,
  setQuotaCat,
  toggleQuotaAcc,
  saveQuota,

  // Waste
  setWasteDate,
  sortWaste,
  setWasteDatePreset,
  showMoreWaste,
  showWasteForm,
  saveWaste,
  showWasteEdit,
  saveWasteEdit,
  confirmDeleteWaste,
  doDeleteWaste,

  // Returns
  setRetDate,
  sortReturns,
  setRetDatePreset,
  showMoreReturns,
  showReturnDetail,
  showReturnForm,
  saveReturn,
  showReturnEdit,
  saveReturnEdit,

  // Stock History
  setShDate,
  setShDatePreset,
  showMoreSh,
  toggleShGroup,

  // Stock Entry
  onStockEntry: _onStockEntry,
  saveStockEntry: _saveStockEntry,
  filterStockList: _filterStockList,
});

// Sort event listener
document.addEventListener('spg-sort', (e) => {
  const id = e.detail.tableId;
  if (id === 'bk-order-items') fillOrderDetail();
  if (id === 'bk-sh-tbl') fillStockHistory();
});

})();
