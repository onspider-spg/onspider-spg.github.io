/**
 * SPG HUB v2.0.0 | 23 MAR 2026 | Siam Palette Group
 * sections/bc_admin.js — Admin + Reports Screens (8 pages)
 * Config, Dept Mapping, Visibility, Access Matrix, Waste Dashboard, Top Products, Cutoff Violations, Audit Trail
 *
 * Depends on: bc_core.js (BK global)
 * HTML: wireframe-bc-all-roles-v4.html (wf-* classes)
 */

(() => {
const esc = SPG.esc;
const S = BK.S;

// ─── CONFIG METADATA (display labels for known keys) ───
const CONFIG_META = {
  cutoff_time:         { label: 'Cutoff Time',         desc: 'Orders after this time → flag as cutoff violation' },
  delivery_days:       { label: 'Delivery Days',       desc: 'Available days for delivery orders' },
  order_id_prefix:     { label: 'Order ID Prefix',     desc: 'Prefix for new order IDs' },
  thermal_printer_ip:  { label: 'Thermal Printer IP',  desc: 'Epson TM-M30III IP address for thermal delivery slip printing (e.g. 192.168.1.100)' },
};

const ROLE_COLORS = {
  store: 'var(--blue)', bc_production: 'var(--green)', bc_management: 'var(--acc)', not_applicable: 'var(--t4)',
};

// ─── Shared: resolve date preset → { from, to } ───
function _datePreset(p) {
  if (p === 'today') return { from: BK.todaySydney(), to: BK.todaySydney() };
  if (p === '30d') { const d = new Date(BK.sydneyNow()); d.setDate(d.getDate() - 30); return { from: BK.fmtDate(d), to: BK.todaySydney() }; }
  return { from: '', to: '' }; // 'all'
}

// ─── makeBarRow helper (wireframe pattern) ───
function makeBarRow(label, pct, val) {
  return '<div class="wf-bar-row"><div class="wf-bar-label">' + label + '</div><div class="wf-bar-fill" style="width:' + pct + '%"></div><div class="wf-bar-val">' + val + '</div></div>';
}

function reasonColor(r) { return r === 'Expired' ? '#ef4444' : r === 'Damaged' ? '#f97316' : r === 'Production Error' ? 'var(--acc)' : 'var(--blue)'; }


// ═══════════════════════════════════════
// 1. CONFIG
// ═══════════════════════════════════════

BK.renderConfig = function(p) {
  return SPG.shell(SPG.toolbar('System Config') + `
    <div class="content" id="configContent"><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.fillConfig = function() {
  const el = document.getElementById('configContent');
  if (!el) return;
  const cfg = S.config || {};
  const keys = Object.keys(cfg);

  if (!keys.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">⚙</div><div class="empty-title">ไม่มีข้อมูล Config</div></div>';
    return;
  }

  const rows = keys.map(k => {
    const meta = CONFIG_META[k] || { label: k, desc: '' };
    return `<div class="wf-form-group">
      <label class="wf-label">${esc(meta.label)}</label>
      <input class="wf-input" id="cfg-${esc(k)}" value="${esc(cfg[k])}" onchange="BakerySection.markConfigDirty()">
    </div>`;
  }).join('');

  el.innerHTML = `<div style="max-width:600px">
    <div class="wf-card">${rows}</div>
    <div style="text-align:right"><button class="wf-btn-gradient" onclick="BakerySection.saveAllConfig()">Save Config</button></div>
  </div>`;
};

BK.loadConfig = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  BK.fillConfig();
};

function markConfigDirty() { /* visual hint could go here */ }

async function saveAllConfig() {
  const cfg = S.config || {};
  const keys = Object.keys(cfg);
  let changed = 0;
  for (const k of keys) {
    const inp = document.getElementById('cfg-' + k);
    if (!inp) continue;
    const newVal = inp.value;
    if (newVal === cfg[k]) continue;
    try {
      const resp = await BK.api('save_config', { config_key: k, config_value: newVal });
      if (resp.success) { S.config[k] = newVal; changed++; }
      else { SPG.toast(resp.message || 'Error saving ' + k, 'error'); }
    } catch (e) { SPG.toast('Network error', 'error'); }
  }
  if (changed) SPG.toast('บันทึก ' + changed + ' config เรียบร้อย', 'success');
  else SPG.toast('ไม่มีการเปลี่ยนแปลง', 'warning');
}


// ═══════════════════════════════════════
// 2. DEPT MAPPING
// ═══════════════════════════════════════

BK.renderDeptMapping = function(p) {
  return SPG.shell(SPG.toolbar('Dept Mapping') + `
    <div class="content" id="deptMapContent"><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.fillDeptMapping = function() {
  const el = document.getElementById('deptMapContent');
  if (!el) return;
  const data = S.deptMappings;
  if (!data) { el.innerHTML = '<div class="empty"><div class="empty-icon">🏢</div><div class="empty-title">กำลังโหลด...</div></div>'; return; }

  const roles = ['store', 'bc_production', 'bc_management', 'not_applicable'];

  const rows = data.map(d => {
    const isActive = d.is_active !== false;
    const roleOpts = roles.map(r => `<option value="${r}"${r === d.module_role ? ' selected' : ''}>${r}</option>`).join('');
    return `<tr>
      <td>${esc(d.dept_name || d.dept_id)}</td>
      <td><select class="wf-select" onchange="BakerySection.saveDeptField('${esc(d.dept_id)}','module_role',this.value)">${roleOpts}</select></td>
      <td>${esc(d.section_scope || '—')}</td>
      <td><div class="wf-toggle${isActive ? ' on' : ''}" onclick="BakerySection.toggleDeptActive('${esc(d.dept_id)}',this)"></div></td>
    </tr>`;
  }).join('');

  el.innerHTML = `<div style="max-width:900px">
    <table class="wf-table">
      <thead><tr><th>Department</th><th>Module Role</th><th>Section Scope</th><th>Active</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
};

BK.loadDeptMapping = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  try {
    const data = await BK.api('get_dept_mapping');
    S.deptMappings = data || [];
    BK.fillDeptMapping();
  } catch (e) {
    const el = document.getElementById('deptMapContent');
    if (el) el.innerHTML = '<div class="empty"><div class="empty-icon">🏢</div><div class="empty-title">โหลดข้อมูลไม่สำเร็จ</div></div>';
  }
};

async function saveDeptField(deptId, field, value) {
  const d = (S.deptMappings || []).find(x => x.dept_id === deptId);
  if (!d) return;

  const payload = {
    dept_id: deptId,
    module_role: d.module_role,
    section_scope: d.section_scope || '',
    is_active: d.is_active !== false,
  };
  payload[field] = value;

  try {
    const resp = await BK.api('save_dept_mapping', payload);
    if (resp.success) {
      d[field] = value;
      SPG.toast('บันทึกเรียบร้อย', 'success');
    } else {
      SPG.toast(resp.message || 'Error', 'error');
      BK.fillDeptMapping();
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
    BK.fillDeptMapping();
  }
}

async function toggleDeptActive(deptId, el) {
  const d = (S.deptMappings || []).find(x => x.dept_id === deptId);
  if (!d) return;
  const newActive = d.is_active === false;
  el.classList.toggle('on', newActive);
  await saveDeptField(deptId, 'is_active', newActive);
}


// ═══════════════════════════════════════
// 3. PRODUCT VISIBILITY MATRIX
// ═══════════════════════════════════════

let _visSection = 'all';
let _visSearch = '';

BK.renderVisibility = function(p) {
  _visSection = 'all';
  _visSearch = '';
  return SPG.shell(SPG.toolbar('Product Visibility') + `
    <div class="content" id="visContent"><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.fillVisibility = function() {
  const el = document.getElementById('visContent');
  if (!el) return;
  const prods = S.adminProducts;
  const channels = S.adminChannels;
  if (!prods || !channels) { el.innerHTML = '<div class="empty"><div class="empty-icon">👁️</div><div class="empty-title">กำลังโหลด...</div></div>'; return; }

  // Store list from channels
  const storeIds = [...new Set(channels.map(ch => ch.store_id))];

  // Section filter chips (wireframe .wf-chip)
  const sortedSecs = [...new Set(S.categories.map(c => c.section_id).filter(Boolean))].sort();
  const secChips = `<div style="margin-bottom:12px">
    <span class="wf-chip${_visSection === 'all' ? ' active' : ''}" onclick="BakerySection.setVisSection('all')">All Stores</span>
    ${storeIds.map(s => `<span class="wf-chip${_visSection === s ? ' active' : ''}" onclick="BakerySection.setVisSection('${esc(s)}')">${esc(s)}</span>`).join('')}
  </div>`;

  // Filter products
  let filtered = prods.filter(p => p.is_active);
  if (_visSearch) { const s = _visSearch.toLowerCase(); filtered = filtered.filter(p => (p.product_name || '').toLowerCase().includes(s)); }
  filtered.sort((a, b) => (a.product_name || '').localeCompare(b.product_name || ''));

  if (!filtered.length) {
    el.innerHTML = `<div style="max-width:900px">${secChips}<div class="empty"><div class="empty-icon">🔍</div><div class="empty-title">ไม่พบสินค้า</div></div></div>`;
    return;
  }

  // Build visibility Set for quick lookup
  const visSet = new Set();
  prods.forEach(p => {
    (p.visibility || []).forEach(v => {
      if (v.is_active !== false) visSet.add(p.product_id + '|' + v.store_id + '|' + (v.dept_id || ''));
    });
  });

  // Visible stores
  const visibleStores = _visSection === 'all' ? storeIds : [_visSection];

  // Table header
  let thCols = visibleStores.map(s => `<th style="text-align:center">${esc(s)}</th>`).join('');

  // Table rows
  let rows = filtered.map(p => {
    const cells = visibleStores.map(s => {
      // Check any dept for this store
      const matchingChannels = channels.filter(ch => ch.store_id === s);
      const isOn = matchingChannels.some(ch => visSet.has(p.product_id + '|' + ch.store_id + '|' + ch.dept_id));
      const firstCh = matchingChannels[0];
      const deptId = firstCh ? firstCh.dept_id : '';
      return `<td style="text-align:center"><div class="wf-toggle${isOn ? ' on' : ''}" onclick="BakerySection.toggleVis('${p.product_id}','${esc(s)}','${esc(deptId)}')"></div></td>`;
    }).join('');
    return `<tr><td style="font-weight:500">${esc(p.product_name)}</td>${cells}</tr>`;
  }).join('');

  el.innerHTML = `<div style="max-width:900px">${secChips}
    <table class="wf-table">
      <thead><tr><th>Product</th>${thCols}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
};

BK.loadVisibility = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  try {
    const data = await BK.api('get_all_products');
    S.adminProducts = data || [];
    BK.fillVisibility();
  } catch (e) {
    const el = document.getElementById('visContent');
    if (el) el.innerHTML = '<div class="empty"><div class="empty-icon">👁️</div><div class="empty-title">โหลดข้อมูลไม่สำเร็จ</div></div>';
  }
};

function setVisSection(sec) { _visSection = sec; BK.fillVisibility(); }

let _dfvTimer = null;
function dFilterVis(val) { _visSearch = val; clearTimeout(_dfvTimer); _dfvTimer = setTimeout(BK.fillVisibility, 250); }

// ─── Optimistic toggle — update UI first, sync DB, rollback on fail ───
async function toggleVis(productId, storeId, deptId) {
  const key = productId + '|' + storeId + '|' + deptId;
  const p = (S.adminProducts || []).find(x => x.product_id === productId);
  if (!p) return;

  const vis = p.visibility || [];
  const idx = vis.findIndex(v => v.store_id === storeId && v.dept_id === deptId);
  const wasOn = idx >= 0 && vis[idx].is_active !== false;
  const newOn = !wasOn;

  // Memory helper
  function setMem(on) {
    if (on) {
      const i = vis.findIndex(v => v.store_id === storeId && v.dept_id === deptId);
      if (i >= 0) { vis[i].is_active = true; }
      else { vis.push({ store_id: storeId, dept_id: deptId, is_active: true }); }
    } else {
      const i = vis.findIndex(v => v.store_id === storeId && v.dept_id === deptId);
      if (i >= 0) vis.splice(i, 1);
    }
  }

  setMem(newOn);
  BK.fillVisibility();

  try {
    const resp = await BK.api('toggle_visibility', { product_id: productId, store_id: storeId, dept_id: deptId, visible: newOn });
    if (!resp.success) {
      setMem(wasOn);
      BK.fillVisibility();
      SPG.toast(resp.message || 'Error', 'error');
    }
  } catch (e) {
    setMem(wasOn);
    BK.fillVisibility();
    SPG.toast('Network error', 'error');
  }
}


// ═══════════════════════════════════════
// 4. USER ACCESS MATRIX
// ═══════════════════════════════════════

let _accessData = null; // { functions: [], tiers: [], permissions: {} }
let _accessSearch = '';

BK.renderAccess = function(p) {
  _accessSearch = '';
  return SPG.shell(SPG.toolbar('User Access') + `
    <div class="content" id="accessContent"><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.fillAccess = function() {
  const el = document.getElementById('accessContent');
  if (!el) return;
  if (!_accessData) { el.innerHTML = '<div class="empty"><div class="empty-icon">🔐</div><div class="empty-title">กำลังโหลด...</div></div>'; return; }

  const { functions: fns, tiers, permissions: perms } = _accessData;
  if (!fns.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">🔐</div><div class="empty-title">ไม่มีข้อมูล Functions</div></div>'; return; }

  // Filter by search
  let filteredFns = fns;
  if (_accessSearch) {
    const s = _accessSearch.toLowerCase();
    filteredFns = fns.filter(f => (f.function_name || '').toLowerCase().includes(s) || (f.function_id || '').toLowerCase().includes(s));
  }

  // Search bar (wireframe .wf-filter-bar with .wf-search)
  const filterBar = `<div class="wf-filter-bar">
    <input class="wf-search" placeholder="Search user..." value="${esc(_accessSearch)}" oninput="BakerySection.setAccessSearch(this.value)">
  </div>`;

  // Table header — User, Role, then permission function columns
  const thFns = tiers.map(t => `<th style="text-align:center">${esc(t)}</th>`).join('');

  // Table rows grouped by section
  const sections = {};
  const secOrder = [];
  filteredFns.forEach(f => {
    if (!sections[f.section]) { sections[f.section] = []; secOrder.push(f.section); }
    sections[f.section].push(f);
  });

  let rows = '';
  secOrder.forEach(sec => {
    sections[sec].forEach(f => {
      const cells = tiers.map(t => {
        const key = f.function_id + '|' + t;
        const on = !!perms[key];
        return `<td style="text-align:center"><input type="checkbox"${on ? ' checked' : ''} onchange="BakerySection.togglePerm('${f.function_id}','${t}')"></td>`;
      }).join('');
      rows += `<tr><td>${esc(f.function_name)}</td><td>${esc(f.section || '')}</td>${cells}</tr>`;
    });
  });

  const thTierHeaders = tiers.map(t => `<th style="text-align:center">${esc(t)}</th>`).join('');

  el.innerHTML = `<div style="max-width:900px">
    ${filterBar}
    <div style="overflow-x:auto">
    <table class="wf-table" style="font-size:11px">
      <thead><tr><th>User</th><th>Role</th>${thTierHeaders}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </div>
  </div>`;
};

BK.loadAccess = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  try {
    const data = await BK.api('get_access_matrix');
    _accessData = data || { functions: [], tiers: [], permissions: {} };
    BK.fillAccess();
  } catch (e) {
    const el = document.getElementById('accessContent');
    if (el) el.innerHTML = '<div class="empty"><div class="empty-icon">🔐</div><div class="empty-title">โหลดข้อมูลไม่สำเร็จ</div></div>';
  }
};

function setAccessSearch(val) { _accessSearch = val; BK.fillAccess(); }

// ─── Optimistic toggle permission ───
async function togglePerm(functionId, tierId) {
  if (!_accessData) { SPG.toast('No access data loaded', 'error'); return; }
  const key = functionId + '|' + tierId;
  const wasOn = !!_accessData.permissions[key];
  const newOn = !wasOn;

  _accessData.permissions[key] = newOn;

  try {
    const resp = await BK.api('toggle_permission', { function_id: functionId, tier_id: tierId, allowed: newOn });
    if (resp.success) {
      SPG.toast('อัพเดท Permission', 'success');
    } else {
      _accessData.permissions[key] = wasOn;
      BK.fillAccess();
      SPG.toast(resp.message || 'Error', 'error');
    }
  } catch (e) {
    _accessData.permissions[key] = wasOn;
    BK.fillAccess();
    SPG.toast('Network error', 'error');
  }
}


// ═══════════════════════════════════════
// 5. WASTE DASHBOARD
// ═══════════════════════════════════════

let _wdDateFrom = '';
let _wdDateTo = '';

BK.renderWasteDashboard = function(p) {
  const d30 = new Date(BK.sydneyNow()); d30.setDate(d30.getDate() - 30);
  _wdDateFrom = BK.fmtDate(d30);
  _wdDateTo = BK.todaySydney();
  return SPG.shell(SPG.toolbar('Waste Dashboard') + `
    <div class="content" id="wdContent"><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.fillWasteDashboard = function() {
  const el = document.getElementById('wdContent');
  if (!el) return;
  const d = S.wasteDash;
  if (!d) { el.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><div class="empty-title">กำลังโหลด...</div></div>'; return; }

  // Filter bar (wireframe pattern)
  const filterBar = `<div class="wf-filter-bar">
    <input class="wf-input" type="date" value="${_wdDateFrom}" style="width:140px" onchange="BakerySection.setWDDate('from',this.value)">
    <span style="color:var(--t3)">to</span>
    <input class="wf-input" type="date" value="${_wdDateTo}" style="width:140px" onchange="BakerySection.setWDDate('to',this.value)">
  </div>`;

  // Stats row (wireframe .stats-row with .stat-card)
  const statsRow = `<div class="stats-row" style="grid-template-columns:repeat(4,1fr)">
    <div class="stat-card"><div class="stat-num" style="color:var(--red)">${d.today ?? 0}</div><div class="stat-label">Today</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--orange)">${d.week7 ?? 0}</div><div class="stat-label">7 Days</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--t1)">${d.total ?? 0}</div><div class="stat-label">Month Total</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--blue)">${d.avg_per_day ?? 0}</div><div class="stat-label">Avg/Day</div></div>
  </div>`;

  // By Reason
  const maxReason = Math.max(...(d.by_reason || []).map(r => r.qty), 1);
  const reasonBars = (d.by_reason || []).map(r =>
    makeBarRow(esc(r.reason), Math.round(r.qty / maxReason * 100), r.qty)
  ).join('');
  const reasonBlock = `<div class="wf-card">
    <div class="wf-section-title" style="margin-top:0">By Reason</div>
    ${reasonBars || '<div style="color:var(--t3);font-size:11px">No data</div>'}
  </div>`;

  // Top Waste Products
  const maxTop = Math.max(...(d.top_products || []).map(r => r.qty), 1);
  const topBars = (d.top_products || []).slice(0, 5).map(r =>
    makeBarRow(esc(r.product_name), Math.round(r.qty / maxTop * 100), r.qty)
  ).join('');
  const topBlock = `<div class="wf-card">
    <div class="wf-section-title" style="margin-top:0">Top Waste Products</div>
    ${topBars || '<div style="color:var(--t3);font-size:11px">No data</div>'}
  </div>`;

  el.innerHTML = `<div style="max-width:900px">
    ${filterBar}
    ${statsRow}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      ${reasonBlock}
      ${topBlock}
    </div>
  </div>`;
};

BK.loadWasteDashboard = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  await _loadWasteDash();
};

async function _loadWasteDash() {
  const el = document.getElementById('wdContent');
  if (!el) return;
  try {
    const resp = await BK.api('get_waste_dashboard', { date_from: _wdDateFrom, date_to: _wdDateTo });
    S.wasteDash = resp || {};
    BK.fillWasteDashboard();
  } catch (e) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><div class="empty-title">โหลดข้อมูลไม่สำเร็จ</div></div>';
  }
}

function setWDDate(which, val) { if (which === 'from') _wdDateFrom = val; else _wdDateTo = val; _loadWasteDash(); }
function setWDPreset(p) {
  const r = _datePreset(p); _wdDateFrom = r.from; _wdDateTo = r.to;
  _loadWasteDash();
}


// ═══════════════════════════════════════
// 6. TOP PRODUCTS
// ═══════════════════════════════════════

let _tpPeriod = 'week';
let _tpDateFrom = '';
let _tpDateTo = '';

BK.renderTopProducts = function(p) {
  const d30 = new Date(BK.sydneyNow()); d30.setDate(d30.getDate() - 30);
  _tpDateFrom = BK.fmtDate(d30);
  _tpDateTo = BK.todaySydney();
  _tpPeriod = 'week';
  return SPG.shell(SPG.toolbar('Top Products') + `
    <div class="content" id="tpContent"><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.fillTopProducts = function() {
  const el = document.getElementById('tpContent');
  if (!el) return;
  const d = S.topProds;
  if (!d) { el.innerHTML = '<div class="empty"><div class="empty-icon">🏆</div><div class="empty-title">กำลังโหลด...</div></div>'; return; }

  // Filter bar (wireframe pattern)
  const filterBar = `<div class="wf-filter-bar">
    <select class="wf-select" onchange="BakerySection.setTPPeriod(this.value)">
      <option value="week"${_tpPeriod === 'week' ? ' selected' : ''}>This Week</option>
      <option value="month"${_tpPeriod === 'month' ? ' selected' : ''}>This Month</option>
      <option value="last_month"${_tpPeriod === 'last_month' ? ' selected' : ''}>Last Month</option>
    </select>
  </div>`;

  // Most Ordered
  const maxOrd = Math.max(...(d.top_ordered || []).map(r => r.qty), 1);
  const orderedBars = (d.top_ordered || []).slice(0, 5).map((r, i) =>
    makeBarRow('#' + (i + 1) + ' ' + esc(r.product_name), Math.round(r.qty / maxOrd * 100), r.qty)
  ).join('');

  // By Store
  const maxStore = Math.max(...(d.by_store || []).map(r => r.qty), 1);
  const storeBars = (d.by_store || []).map(r =>
    makeBarRow(esc(BK.getStoreName(r.store_id) || r.store_id), Math.round(r.qty / maxStore * 100), r.qty)
  ).join('');

  // 2-column grid (wireframe pattern)
  const twoCol = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
    <div class="wf-card">
      <div class="wf-section-title" style="margin-top:0">Most Ordered</div>
      ${orderedBars || '<div style="color:var(--t3);font-size:11px">No data</div>'}
    </div>
    <div class="wf-card">
      <div class="wf-section-title" style="margin-top:0">By Store</div>
      ${storeBars || '<div style="color:var(--t3);font-size:11px">No data</div>'}
    </div>
  </div>`;

  // By Category (wireframe pattern: .sec-title + 4-col grid of .wf-card with emoji)
  const catIcons = { 'Bread': '&#127838;', 'Pastry': '&#129360;', 'Cake': '&#127856;', 'Savory': '&#129386;', 'Drink': '&#9749;' };
  const byCat = d.by_category || [];
  const totalCat = byCat.reduce((sum, c) => sum + (c.qty || 0), 0) || 1;
  const catCards = byCat.map(c => {
    const icon = catIcons[c.category_name] || catIcons[c.name] || '&#128230;';
    const pct = ((c.qty / totalCat) * 100).toFixed(0);
    const name = esc(c.category_name || c.name || '');
    return `<div class="wf-card" style="text-align:center"><div style="font-size:28px">${icon}</div><div style="font-size:13px;font-weight:700">${name}</div><div style="font-size:11px;color:var(--t3)">${c.qty} units | ${pct}%</div></div>`;
  }).join('');
  const catBlock = byCat.length ? `<div class="sec-title">By Category</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">${catCards}</div>` : '';

  if (!orderedBars && !storeBars && !byCat.length) {
    el.innerHTML = `<div style="max-width:900px">${filterBar}<div class="empty"><div class="empty-icon">📦</div><div class="empty-title">ไม่มีข้อมูลในช่วงนี้</div></div></div>`;
    return;
  }

  el.innerHTML = `<div style="max-width:900px">
    ${filterBar}
    ${twoCol}
    ${catBlock}
  </div>`;
};

BK.loadTopProducts = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  await _loadTopProds();
};

async function _loadTopProds() {
  const el = document.getElementById('tpContent');
  if (!el) return;
  try {
    const resp = await BK.api('get_top_products', { date_from: _tpDateFrom, date_to: _tpDateTo });
    S.topProds = resp || {};
    BK.fillTopProducts();
  } catch (e) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">🏆</div><div class="empty-title">โหลดข้อมูลไม่สำเร็จ</div></div>';
  }
}

function setTPDate(which, val) { if (which === 'from') _tpDateFrom = val; else _tpDateTo = val; _loadTopProds(); }
function setTPPreset(p) {
  const r = _datePreset(p); _tpDateFrom = r.from; _tpDateTo = r.to;
  _loadTopProds();
}
function setTPPeriod(val) {
  _tpPeriod = val;
  const now = new Date(BK.sydneyNow());
  if (val === 'week') {
    const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
    _tpDateFrom = BK.fmtDate(d7); _tpDateTo = BK.todaySydney();
  } else if (val === 'month') {
    _tpDateFrom = BK.todaySydney().substring(0, 7) + '-01'; _tpDateTo = BK.todaySydney();
  } else if (val === 'last_month') {
    const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    _tpDateFrom = BK.fmtDate(lm); _tpDateTo = BK.fmtDate(lmEnd);
  }
  _loadTopProds();
}


// ═══════════════════════════════════════
// 7. CUTOFF VIOLATIONS
// ═══════════════════════════════════════

let _coDateFrom = '';
let _coDateTo = '';
let _coPeriod = 'week';
let _coShowCount = 10;

BK.renderCutoff = function(p) {
  const d30 = new Date(BK.sydneyNow()); d30.setDate(d30.getDate() - 30);
  _coDateFrom = BK.fmtDate(d30);
  _coDateTo = BK.todaySydney();
  _coPeriod = 'week';
  _coShowCount = 10;
  return SPG.shell(SPG.toolbar('Cutoff Violations') + `
    <div class="content" id="coContent"><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.fillCutoff = function() {
  const el = document.getElementById('coContent');
  if (!el) return;
  const data = S.cutoffData;
  if (!data) { el.innerHTML = '<div class="empty"><div class="empty-icon">⏰</div><div class="empty-title">กำลังโหลด...</div></div>'; return; }

  const list = data || [];

  // Filter bar (wireframe pattern)
  const filterBar = `<div class="wf-filter-bar">
    <select class="wf-select" onchange="BakerySection.setCOPeriod(this.value)">
      <option value="week"${_coPeriod === 'week' ? ' selected' : ''}>This Week</option>
      <option value="last_week"${_coPeriod === 'last_week' ? ' selected' : ''}>Last Week</option>
      <option value="month"${_coPeriod === 'month' ? ' selected' : ''}>This Month</option>
    </select>
  </div>`;

  if (!list.length) {
    el.innerHTML = `<div style="max-width:900px">${filterBar}<div class="empty"><div class="empty-icon">✅</div><div class="empty-title">ไม่มี Cutoff Violation</div><div class="empty-desc">ในช่วงเวลาที่เลือก</div></div></div>`;
    return;
  }

  const visible = list.slice(0, _coShowCount);
  const hasMore = list.length > _coShowCount;

  const rows = visible.map(o => {
    const lateBy = o.late_by || '';
    const stsLabel = o.status || 'Violation';
    return `<tr style="border-left:4px solid var(--red)">
      <td style="color:var(--acc);font-weight:600">${esc(o.order_id)}</td>
      <td>${esc(BK.getStoreName(o.store_id) || o.store_id)}</td>
      <td>${esc(o.ordered_time || '')}</td>
      <td>${esc(o.cutoff_time || '')}</td>
      <td style="color:var(--red);font-weight:600">${esc(lateBy)}</td>
      <td><span class="wf-badge" style="background:var(--red-bg);color:var(--red)">${esc(stsLabel)}</span></td>
    </tr>`;
  }).join('');

  el.innerHTML = `<div style="max-width:900px">
    ${filterBar}
    <table class="wf-table">
      <thead><tr><th>Order ID</th><th>Store</th><th>Submitted</th><th>Cutoff</th><th>Late By</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${hasMore ? `<div class="load-more" onclick="BakerySection.showMoreCO()">แสดง ${_coShowCount} จาก ${list.length} · โหลดเพิ่ม 10 ↓</div>` : ''}
  </div>`;
};

BK.loadCutoff = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  await _loadCutoff();
};

async function _loadCutoff() {
  const el = document.getElementById('coContent');
  if (!el) return;
  try {
    const resp = await BK.api('get_cutoff_violations', { date_from: _coDateFrom, date_to: _coDateTo });
    S.cutoffData = resp || [];
    BK.fillCutoff();
  } catch (e) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">⏰</div><div class="empty-title">โหลดข้อมูลไม่สำเร็จ</div></div>';
  }
}

function setCODate(which, val) { if (which === 'from') _coDateFrom = val; else _coDateTo = val; _coShowCount = 10; _loadCutoff(); }
function setCOPreset(p) {
  const r = _datePreset(p); _coDateFrom = r.from; _coDateTo = r.to;
  _coShowCount = 10;
  _loadCutoff();
}
function setCOPeriod(val) {
  _coPeriod = val;
  const now = new Date(BK.sydneyNow());
  if (val === 'week') {
    const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
    _coDateFrom = BK.fmtDate(d7); _coDateTo = BK.todaySydney();
  } else if (val === 'last_week') {
    const d14 = new Date(now); d14.setDate(d14.getDate() - 14);
    const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
    _coDateFrom = BK.fmtDate(d14); _coDateTo = BK.fmtDate(d7);
  } else if (val === 'month') {
    _coDateFrom = BK.todaySydney().substring(0, 7) + '-01'; _coDateTo = BK.todaySydney();
  }
  _coShowCount = 10;
  _loadCutoff();
}
function showMoreCO() { _coShowCount += 10; BK.fillCutoff(); }


// ═══════════════════════════════════════
// 8. AUDIT TRAIL
// ═══════════════════════════════════════

let _auDateFrom = '';
let _auDateTo = '';
let _auFilter = 'all';
let _auShowCount = 15;

BK.renderAudit = function(p) {
  const d30 = new Date(BK.sydneyNow()); d30.setDate(d30.getDate() - 30);
  _auDateFrom = BK.fmtDate(d30);
  _auDateTo = BK.todaySydney();
  _auFilter = 'all';
  _auShowCount = 15;
  return SPG.shell(SPG.toolbar('Audit Trail') + `
    <div class="content" id="auContent"><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.fillAudit = function() {
  const el = document.getElementById('auContent');
  if (!el) return;
  const all = S.auditData || [];

  // Action type options for select
  const actionTypes = [...new Set(all.map(a => a.action_type).filter(Boolean))];

  // Filter bar (wireframe pattern: date + action type select)
  const filterBar = `<div class="wf-filter-bar">
    <input class="wf-input" type="date" value="${_auDateFrom}" style="width:140px" onchange="BakerySection.setAUDate('from',this.value)">
    <select class="wf-select" onchange="BakerySection.setAUFilter(this.value)">
      <option value="all"${_auFilter === 'all' ? ' selected' : ''}>All Actions</option>
      <option value="Create"${_auFilter === 'Create' ? ' selected' : ''}>Create</option>
      <option value="Update"${_auFilter === 'Update' ? ' selected' : ''}>Update</option>
      <option value="Delete"${_auFilter === 'Delete' ? ' selected' : ''}>Delete</option>
      <option value="Fulfil"${_auFilter === 'Fulfil' ? ' selected' : ''}>Fulfil</option>
      ${actionTypes.filter(t => !['Create','Update','Delete','Fulfil'].includes(t)).map(t =>
        `<option value="${esc(t)}"${_auFilter === t ? ' selected' : ''}>${esc(t)}</option>`
      ).join('')}
    </select>
  </div>`;

  // Filter
  let filtered = all;
  if (_auFilter !== 'all') filtered = all.filter(a => a.action_type === _auFilter);

  if (!filtered.length) {
    el.innerHTML = `<div style="max-width:900px">${filterBar}<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">ไม่มี Audit Log</div></div></div>`;
    return;
  }

  const visible = filtered.slice(0, _auShowCount);
  const hasMore = filtered.length > _auShowCount;

  const badgeColor = (type) => {
    const t = (type || '').toLowerCase();
    if (t === 'create') return 'background:var(--green-bg);color:var(--green)';
    if (t === 'fulfil' || t === 'fulfill') return 'background:var(--blue-bg);color:var(--blue)';
    if (t === 'update') return 'background:var(--orange-bg);color:var(--orange)';
    if (t === 'delete') return 'background:var(--red-bg);color:var(--red)';
    return 'background:var(--bg3);color:var(--t2)';
  };

  const rows = visible.map(a => {
    const time = a.changed_at ? new Date(a.changed_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
    const detail = a.detail || a.target || '';
    const userName = a.changed_by_name || a.changed_by || a.user || '';
    const actionLabel = a.action_type || '';
    return `<tr>
      <td style="font-size:11px;color:var(--t3)">${esc(time)}</td>
      <td>${esc(userName)}</td>
      <td><span class="wf-badge" style="${badgeColor(actionLabel)}">${esc(actionLabel)}</span></td>
      <td>${esc(detail)}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `<div style="max-width:900px">
    ${filterBar}
    <table class="wf-table">
      <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Detail</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${hasMore ? `<div class="load-more" onclick="BakerySection.showMoreAU()">แสดง ${_auShowCount} จาก ${filtered.length} · โหลดเพิ่ม 15 ↓</div>` : ''}
  </div>`;
};

BK.loadAudit = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  await _loadAudit();
};

async function _loadAudit() {
  const el = document.getElementById('auContent');
  if (!el) return;
  try {
    const resp = await BK.api('get_audit_trail', { date_from: _auDateFrom, date_to: _auDateTo });
    S.auditData = resp || [];
    BK.fillAudit();
  } catch (e) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">โหลดข้อมูลไม่สำเร็จ</div></div>';
  }
}

function setAUDate(which, val) { if (which === 'from') _auDateFrom = val; else _auDateTo = val; _auShowCount = 15; _loadAudit(); }
function setAUPreset(p) {
  const r = _datePreset(p); _auDateFrom = r.from; _auDateTo = r.to;
  _auShowCount = 15;
  _loadAudit();
}
function setAUFilter(f) { _auFilter = f; _auShowCount = 15; BK.fillAudit(); }
function showMoreAU() { _auShowCount += 15; BK.fillAudit(); }


// ═══════════════════════════════════════
// EXTEND BakerySection (onclick handlers)
// ═══════════════════════════════════════
Object.assign(window.BakerySection, {
  // Config
  markConfigDirty,
  saveAllConfig,

  // Dept Mapping
  saveDeptField,
  toggleDeptActive,

  // Visibility
  setVisSection,
  dFilterVis,
  toggleVis,

  // Access Matrix
  togglePerm,
  setAccessSearch,

  // Waste Dashboard
  setWDDate,
  setWDPreset,

  // Top Products
  setTPDate,
  setTPPreset,
  setTPPeriod,

  // Cutoff Violations
  setCODate,
  setCOPreset,
  setCOPeriod,
  showMoreCO,

  // Audit Trail
  setAUDate,
  setAUPreset,
  setAUFilter,
  showMoreAU,
});

})();
