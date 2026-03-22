/**
 * SPG HUB v1.0.0 | 22 MAR 2026 | Siam Palette Group
 * sections/bc_admin.js — Admin + Reports Screens (8 pages)
 * Config, Dept Mapping, Visibility, Access Matrix, Waste Dashboard, Top Products, Cutoff Violations, Audit Trail
 *
 * Depends on: bc_core.js (BK global)
 * Design: Pink #db2777 accent, matches Home layout via SPG.shell/toolbar
 */

(() => {
const esc = SPG.esc;
const S = BK.S;

// Date filter presets (per-page state)
let _wasteDashPreset = 'this_week';
let _topProdsPreset = 'this_week';
let _cutoffPreset = 'this_week';
let _auditPreset = 'this_week';
let _auditSearch = '';


// ═══════════════════════════════════════
// 1. CONFIG
// ═══════════════════════════════════════
BK.renderConfig = function(p) {
  return SPG.shell(SPG.toolbar('System Config') + `
    <div class="content">
      <div id="bk-config-body">${SPG.ui.skeleton(60, 4)}</div>
    </div>`, 'Bakery');
};

BK.loadConfig = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  const el = document.getElementById('bk-config-body');
  if (!el) return;

  const c = S.config || {};
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const deliveryDays = c.delivery_days || [];

  el.innerHTML = `
    <div class="sec-title">Order Settings</div>
    <div class="card" style="padding:16px;margin-bottom:12px">
      <div style="margin-bottom:14px">
        <label style="font-size:11px;font-weight:600;color:var(--t2);display:block;margin-bottom:4px">Cutoff Time</label>
        <input type="time" id="cfg-cutoff" class="inp" style="font-size:13px;padding:6px 10px;width:160px" value="${esc(c.cutoff_time || '')}">
        <div style="font-size:10px;color:var(--t3);margin-top:2px">Orders placed after this time go to next delivery cycle</div>
      </div>
      <div style="margin-bottom:14px">
        <label style="font-size:11px;font-weight:600;color:var(--t2);display:block;margin-bottom:6px">Delivery Days</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${days.map((d, i) => {
            const val = i + 1; // 1=Mon .. 7=Sun
            const checked = deliveryDays.includes(val) ? ' checked' : '';
            return `<label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer">
              <input type="checkbox" class="cfg-day" value="${val}"${checked}> ${d}
            </label>`;
          }).join('')}
        </div>
      </div>
    </div>

    <div class="sec-title">System</div>
    <div class="card" style="padding:16px;margin-bottom:12px">
      <div style="margin-bottom:14px">
        <label style="font-size:11px;font-weight:600;color:var(--t2);display:block;margin-bottom:4px">Order ID Prefix</label>
        <input type="text" id="cfg-prefix" class="inp" style="font-size:13px;padding:6px 10px;width:160px" value="${esc(c.order_prefix || '')}" placeholder="e.g. BC">
      </div>
      <div>
        <label style="font-size:11px;font-weight:600;color:var(--t2);display:block;margin-bottom:4px">Printer IP</label>
        <input type="text" id="cfg-printer" class="inp" style="font-size:13px;padding:6px 10px;width:220px" value="${esc(c.printer_ip || '')}" placeholder="e.g. 192.168.1.100">
      </div>
    </div>

    <button class="btn btn-primary" style="margin-top:8px" onclick="BakerySection.saveConfig()">Save Config</button>`;
};

async function saveConfig() {
  const cutoff = document.getElementById('cfg-cutoff')?.value || '';
  const prefix = document.getElementById('cfg-prefix')?.value || '';
  const printer = document.getElementById('cfg-printer')?.value || '';
  const dayEls = document.querySelectorAll('.cfg-day:checked');
  const delivery_days = Array.from(dayEls).map(el => parseInt(el.value));

  try {
    await BK.api('save_config', { cutoff_time: cutoff, delivery_days, order_prefix: prefix, printer_ip: printer });
    // Update local state
    S.config.cutoff_time = cutoff;
    S.config.delivery_days = delivery_days;
    S.config.order_prefix = prefix;
    S.config.printer_ip = printer;
    SPG.toast('Config saved', 'success');
  } catch (e) {
    SPG.toast(e.message || 'Save failed', 'error');
  }
}


// ═══════════════════════════════════════
// 2. DEPT MAPPING
// ═══════════════════════════════════════
BK.renderDeptMapping = function(p) {
  return SPG.shell(SPG.toolbar('Department Mapping') + `
    <div class="content">
      <div id="bk-dmap-body">${SPG.ui.skeleton(60, 5)}</div>
    </div>`, 'Bakery');
};

BK.loadDeptMapping = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  const el = document.getElementById('bk-dmap-body');
  if (!el) return;

  try {
    const data = await BK.api('get_dept_mapping');
    S.deptMappings = data || [];
    _renderDeptMapping(el);
  } catch (e) {
    el.innerHTML = SPG.ui.empty('⚙️', 'Failed to load mappings', e.message);
  }
};

function _renderDeptMapping(el) {
  const mappings = S.deptMappings || [];
  const stores = S.stores || [];
  const depts = S.departments || [];

  if (!stores.length || !depts.length) {
    el.innerHTML = SPG.ui.empty('⚙️', 'No stores or departments configured');
    return;
  }

  // Build lookup: { `${store_id}::${dept_id}` : mapping }
  const map = {};
  mappings.forEach(m => { map[`${m.store_id}::${m.dept_id}`] = m; });

  let html = `<div style="overflow-x:auto">
    <table class="tbl" style="font-size:11px;min-width:400px">
      <thead><tr>
        <th style="text-align:left;padding:8px 6px">Department</th>
        ${stores.map(s => `<th style="text-align:center;padding:8px 6px;white-space:nowrap">${esc(s.store_name || s.store_id)}</th>`).join('')}
      </tr></thead>
      <tbody>`;

  depts.forEach(d => {
    html += `<tr><td style="padding:6px;font-weight:600">${esc(d.dept_name || d.dept_id)}</td>`;
    stores.forEach(s => {
      const key = `${s.store_id}::${d.dept_id}`;
      const m = map[key];
      const role = m?.module_role || 'not_applicable';
      const color = role === 'not_applicable' ? 'var(--t4)' : 'var(--theme, #db2777)';
      const icon = role === 'not_applicable' ? '—' : '✓';
      html += `<td style="text-align:center;padding:6px;color:${color};cursor:pointer" onclick="BakerySection.cycleDeptMap('${esc(s.store_id)}','${esc(d.dept_id)}')" title="${esc(role)}">${icon}<div style="font-size:9px;color:var(--t3)">${esc(role.replace('_', ' '))}</div></td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  html += `<button class="btn btn-primary" style="margin-top:12px" onclick="BakerySection.saveDeptMapping()">Save Mappings</button>`;
  el.innerHTML = html;
}

const DEPT_ROLES = ['not_applicable', 'store_ordering', 'bc_production', 'bc_management'];

function cycleDeptMap(storeId, deptId) {
  const mappings = S.deptMappings || [];
  const idx = mappings.findIndex(m => m.store_id === storeId && m.dept_id === deptId);
  if (idx >= 0) {
    const cur = mappings[idx].module_role || 'not_applicable';
    const next = DEPT_ROLES[(DEPT_ROLES.indexOf(cur) + 1) % DEPT_ROLES.length];
    mappings[idx].module_role = next;
  } else {
    mappings.push({ store_id: storeId, dept_id: deptId, module_role: 'store_ordering' });
  }
  const el = document.getElementById('bk-dmap-body');
  if (el) _renderDeptMapping(el);
}

async function saveDeptMapping() {
  try {
    await BK.api('save_dept_mapping', { mappings: S.deptMappings || [] });
    SPG.toast('Mappings saved', 'success');
  } catch (e) {
    SPG.toast(e.message || 'Save failed', 'error');
  }
}


// ═══════════════════════════════════════
// 3. VISIBILITY
// ═══════════════════════════════════════
BK.renderVisibility = function(p) {
  return SPG.shell(SPG.toolbar('Product Visibility') + `
    <div class="content">
      <div id="bk-vis-body">${SPG.ui.skeleton(50, 6)}</div>
    </div>`, 'Bakery');
};

BK.loadVisibility = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  const el = document.getElementById('bk-vis-body');
  if (!el) return;

  try {
    const data = await BK.api('get_all_products');
    S.adminProducts = data || [];
    _renderVisibility(el);
  } catch (e) {
    el.innerHTML = SPG.ui.empty('👁️', 'Failed to load products', e.message);
  }
};

function _renderVisibility(el) {
  const products = S.adminProducts || [];
  const stores = S.stores || [];

  if (!products.length) {
    el.innerHTML = SPG.ui.empty('📦', 'No products found');
    return;
  }

  let html = `<div style="font-size:10px;color:var(--t3);margin-bottom:8px">${products.length} products · Tap to toggle visibility per store</div>`;
  html += `<div style="overflow-x:auto">
    <table class="tbl" style="font-size:11px;min-width:400px">
      <thead><tr>
        <th style="text-align:left;padding:8px 6px">Product</th>
        ${stores.map(s => `<th style="text-align:center;padding:8px 6px;white-space:nowrap;font-size:10px">${esc(s.store_name || s.store_id)}</th>`).join('')}
      </tr></thead>
      <tbody>`;

  products.forEach(p => {
    const vis = p.visibility || {};
    html += `<tr><td style="padding:6px;font-weight:500">${esc(p.product_name)}</td>`;
    stores.forEach(s => {
      const isVisible = vis[s.store_id] !== false;
      const color = isVisible ? 'var(--green)' : 'var(--t4)';
      const icon = isVisible ? '●' : '○';
      html += `<td style="text-align:center;padding:6px;color:${color};cursor:pointer;font-size:14px" onclick="BakerySection.toggleVisibility('${esc(p.product_id)}','${esc(s.store_id)}',${!isVisible})">${icon}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}

async function toggleVisibility(productId, storeId, visible) {
  try {
    await BK.api('toggle_visibility', { product_id: productId, store_id: storeId, visible });
    // Update local state
    const prod = (S.adminProducts || []).find(p => p.product_id === productId);
    if (prod) {
      if (!prod.visibility) prod.visibility = {};
      prod.visibility[storeId] = visible;
    }
    const el = document.getElementById('bk-vis-body');
    if (el) _renderVisibility(el);
  } catch (e) {
    SPG.toast(e.message || 'Toggle failed', 'error');
  }
}


// ═══════════════════════════════════════
// 4. ACCESS MATRIX
// ═══════════════════════════════════════
BK.renderAccess = function(p) {
  return SPG.shell(SPG.toolbar('User Access Matrix') + `
    <div class="content">
      <div id="bk-access-body">${SPG.ui.skeleton(50, 6)}</div>
    </div>`, 'Bakery');
};

BK.loadAccess = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  const el = document.getElementById('bk-access-body');
  if (!el) return;

  try {
    const data = await BK.api('get_access_matrix');
    S._accessMatrix = data || {};
    _renderAccess(el);
  } catch (e) {
    el.innerHTML = SPG.ui.empty('🔐', 'Failed to load access matrix', e.message);
  }
};

function _renderAccess(el) {
  const matrix = S._accessMatrix || {};
  const users = matrix.users || [];
  const permissions = matrix.permissions || [];

  if (!users.length) {
    el.innerHTML = SPG.ui.empty('👤', 'No users found');
    return;
  }

  if (!permissions.length) {
    el.innerHTML = SPG.ui.empty('🔑', 'No permissions defined');
    return;
  }

  let html = `<div style="font-size:10px;color:var(--t3);margin-bottom:8px">${users.length} users · ${permissions.length} permissions</div>`;
  html += `<div style="overflow-x:auto">
    <table class="tbl" style="font-size:11px;min-width:500px">
      <thead><tr>
        <th style="text-align:left;padding:8px 6px">User</th>
        ${permissions.map(pm => `<th style="text-align:center;padding:8px 4px;font-size:9px;white-space:nowrap;max-width:60px;overflow:hidden;text-overflow:ellipsis" title="${esc(pm.label || pm.key)}">${esc(pm.label || pm.key)}</th>`).join('')}
      </tr></thead>
      <tbody>`;

  users.forEach(u => {
    const userPerms = u.permissions || [];
    html += `<tr>
      <td style="padding:6px">
        <div style="font-weight:600;font-size:12px">${esc(u.display_name || u.user_id)}</div>
        <div style="font-size:9px;color:var(--t3)">${esc(u.position_name || u.tier_id || '')}</div>
      </td>`;
    permissions.forEach(pm => {
      const enabled = userPerms.includes(pm.key);
      const color = enabled ? 'var(--theme, #db2777)' : 'var(--t4)';
      const icon = enabled ? '✓' : '—';
      html += `<td style="text-align:center;padding:6px;color:${color};cursor:pointer;font-weight:700" onclick="BakerySection.togglePermission('${esc(u.user_id)}','${esc(pm.key)}',${!enabled})">${icon}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}

async function togglePermission(userId, permKey, enabled) {
  try {
    await BK.api('toggle_permission', { user_id: userId, permission_key: permKey, enabled });
    // Update local state
    const u = (S._accessMatrix?.users || []).find(u => u.user_id === userId);
    if (u) {
      if (!u.permissions) u.permissions = [];
      if (enabled && !u.permissions.includes(permKey)) u.permissions.push(permKey);
      if (!enabled) u.permissions = u.permissions.filter(k => k !== permKey);
    }
    const el = document.getElementById('bk-access-body');
    if (el) _renderAccess(el);
  } catch (e) {
    SPG.toast(e.message || 'Toggle failed', 'error');
  }
}


// ═══════════════════════════════════════
// 5. WASTE DASHBOARD
// ═══════════════════════════════════════
BK.renderWasteDashboard = function(p) {
  return SPG.shell(SPG.toolbar('Waste Dashboard') + `
    <div class="content">
      ${BK.dateFilterChips(_wasteDashPreset, 'BakerySection.setWasteDashPreset')}
      <div id="bk-waste-dash" style="margin-top:12px">${SPG.ui.skeleton(80, 4)}</div>
    </div>`, 'Bakery');
};

BK.loadWasteDashboard = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  await _loadWasteDash();
};

async function _loadWasteDash() {
  const el = document.getElementById('bk-waste-dash');
  if (!el) return;

  const range = BK.getDateRange(_wasteDashPreset);
  try {
    const data = await BK.api('get_waste_dashboard', { date_from: range.from, date_to: range.to });
    S.wasteDash = data || {};
    _renderWasteDash(el);
  } catch (e) {
    el.innerHTML = SPG.ui.empty('🗑️', 'Failed to load waste data', e.message);
  }
}

function _renderWasteDash(el) {
  const d = S.wasteDash || {};
  const totalWaste = d.total_waste || 0;
  const byReason = d.by_reason || [];
  const byStore = d.by_store || [];

  if (!totalWaste && !byReason.length && !byStore.length) {
    el.innerHTML = SPG.ui.empty('✨', 'No waste recorded', 'Great work! No waste in this period');
    return;
  }

  let html = '';

  // KPI card
  html += `<div class="card" style="padding:16px;margin-bottom:12px;text-align:center">
    <div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.5px">Total Waste</div>
    <div style="font-size:28px;font-weight:900;color:var(--red);margin-top:4px">${totalWaste}</div>
    <div style="font-size:10px;color:var(--t3)">items</div>
  </div>`;

  // By Reason
  if (byReason.length) {
    const maxR = Math.max(...byReason.map(r => r.count || 0), 1);
    html += `<div class="sec-title" style="margin-top:16px">By Reason</div>`;
    byReason.forEach(r => {
      const pct = Math.round(((r.count || 0) / maxR) * 100);
      html += `<div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px">
          <span>${esc(r.reason || 'Unknown')}</span><span style="font-weight:700">${r.count || 0}</span>
        </div>
        <div style="height:6px;background:var(--bd);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:var(--red);border-radius:3px"></div>
        </div>
      </div>`;
    });
  }

  // By Store
  if (byStore.length) {
    const maxS = Math.max(...byStore.map(s => s.count || 0), 1);
    html += `<div class="sec-title" style="margin-top:16px">By Store</div>`;
    byStore.forEach(s => {
      const pct = Math.round(((s.count || 0) / maxS) * 100);
      html += `<div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px">
          <span>${esc(BK.getStoreName(s.store_id) || s.store_id)}</span><span style="font-weight:700">${s.count || 0}</span>
        </div>
        <div style="height:6px;background:var(--bd);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:var(--theme, #db2777);border-radius:3px"></div>
        </div>
      </div>`;
    });
  }

  // Trend
  if (d.trend && d.trend.length) {
    html += `<div class="sec-title" style="margin-top:16px">Daily Trend</div>`;
    html += `<div class="card" style="padding:12px;overflow-x:auto">
      <div style="display:flex;align-items:flex-end;gap:4px;height:80px;min-width:${d.trend.length * 28}px">`;
    const maxT = Math.max(...d.trend.map(t => t.count || 0), 1);
    d.trend.forEach(t => {
      const h = Math.max(Math.round(((t.count || 0) / maxT) * 70), 2);
      html += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="font-size:9px;font-weight:700">${t.count || 0}</div>
        <div style="width:100%;max-width:20px;height:${h}px;background:var(--red);border-radius:2px"></div>
        <div style="font-size:8px;color:var(--t3)">${esc(BK.fmtDateAU(t.date))}</div>
      </div>`;
    });
    html += '</div></div>';
  }

  el.innerHTML = html;
}

function setWasteDashPreset(preset) {
  _wasteDashPreset = preset;
  SPG.go('bakery/waste-dashboard');
}


// ═══════════════════════════════════════
// 6. TOP PRODUCTS
// ═══════════════════════════════════════
BK.renderTopProducts = function(p) {
  return SPG.shell(SPG.toolbar('Top Products') + `
    <div class="content">
      ${BK.dateFilterChips(_topProdsPreset, 'BakerySection.setTopProdsPreset')}
      <div id="bk-top-prods" style="margin-top:12px">${SPG.ui.skeleton(50, 6)}</div>
    </div>`, 'Bakery');
};

BK.loadTopProducts = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  await _loadTopProds();
};

async function _loadTopProds() {
  const el = document.getElementById('bk-top-prods');
  if (!el) return;

  const range = BK.getDateRange(_topProdsPreset);
  try {
    const data = await BK.api('get_top_products', { date_from: range.from, date_to: range.to });
    S.topProds = data || [];
    _renderTopProds(el);
  } catch (e) {
    el.innerHTML = SPG.ui.empty('📊', 'Failed to load data', e.message);
  }
}

function _renderTopProds(el) {
  const items = Array.isArray(S.topProds) ? S.topProds : [];

  if (!items.length) {
    el.innerHTML = SPG.ui.empty('📊', 'No order data', 'Try a different date range');
    return;
  }

  const st = SPG.ui.getSortState('bk-top-prods');
  const sorted = st ? SPG.ui.sortData(items, st.key, st.dir) : items;

  let html = `<div style="display:flex;gap:8px;margin-bottom:8px">
    ${SPG.ui.sortTh('bk-top-prods', 'product_name', 'Product')}
    ${SPG.ui.sortTh('bk-top-prods', 'total_qty', 'Qty')}
  </div>`;
  sorted.forEach((item, i) => {
    const rank = i + 1;
    const medal = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `<span style="font-size:11px;color:var(--t3);font-weight:700">#${rank}</span>`;
    html += `<div class="card" style="padding:12px;margin-bottom:6px;display:flex;align-items:center;gap:12px">
      <div style="width:28px;text-align:center;font-size:16px">${medal}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(item.product_name)}</div>
        <div style="font-size:10px;color:var(--t3)">${esc(item.category || '')}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:16px;font-weight:900;color:var(--theme, #db2777)">${item.total_qty || 0}</div>
        <div style="font-size:9px;color:var(--t3)">ordered</div>
      </div>
    </div>`;
  });

  el.innerHTML = html;
}

function setTopProdsPreset(preset) {
  _topProdsPreset = preset;
  SPG.go('bakery/top-products');
}


// ═══════════════════════════════════════
// 7. CUTOFF VIOLATIONS
// ═══════════════════════════════════════
BK.renderCutoff = function(p) {
  return SPG.shell(SPG.toolbar('Cutoff Violations') + `
    <div class="content">
      ${BK.dateFilterChips(_cutoffPreset, 'BakerySection.setCutoffPreset')}
      <div id="bk-cutoff-body" style="margin-top:12px">${SPG.ui.skeleton(50, 5)}</div>
    </div>`, 'Bakery');
};

BK.loadCutoff = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  await _loadCutoff();
};

async function _loadCutoff() {
  const el = document.getElementById('bk-cutoff-body');
  if (!el) return;

  const range = BK.getDateRange(_cutoffPreset);
  try {
    const data = await BK.api('get_cutoff_violations', { date_from: range.from, date_to: range.to });
    S.cutoffData = data || [];
    _renderCutoff(el);
  } catch (e) {
    el.innerHTML = SPG.ui.empty('⏰', 'Failed to load violations', e.message);
  }
}

function _renderCutoff(el) {
  const items = Array.isArray(S.cutoffData) ? S.cutoffData : [];

  if (!items.length) {
    el.innerHTML = SPG.ui.empty('✅', 'No violations', 'All orders were placed before cutoff');
    return;
  }

  const st = SPG.ui.getSortState('bk-cutoff');
  const sorted = st ? SPG.ui.sortData(items, st.key, st.dir) : items;

  let html = `<div style="font-size:10px;color:var(--t3);margin-bottom:8px">${items.length} violation${items.length > 1 ? 's' : ''} found</div>`;
  html += `<div style="overflow-x:auto">
    <table class="tbl" style="font-size:11px;min-width:400px">
      <thead><tr>
        ${SPG.ui.sortTh('bk-cutoff', 'store_id', 'Store')}
        ${SPG.ui.sortTh('bk-cutoff', 'order_id', 'Order')}
        ${SPG.ui.sortTh('bk-cutoff', 'created_at', 'Created')}
        <th style="text-align:center;padding:8px 6px">Cutoff</th>
      </tr></thead>
      <tbody>`;

  sorted.forEach(v => {
    html += `<tr>
      <td style="padding:6px">${esc(BK.getStoreName(v.store_id) || v.store_id)}</td>
      <td style="padding:6px;font-weight:600;color:var(--theme, #db2777)">${esc(v.order_id)}</td>
      <td style="padding:6px;text-align:center;color:var(--red);font-weight:600">${esc(BK.sydneyDateTime(v.created_at))}</td>
      <td style="padding:6px;text-align:center;color:var(--t3)">${esc(v.cutoff_time || '')}</td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function setCutoffPreset(preset) {
  _cutoffPreset = preset;
  SPG.go('bakery/cutoff');
}


// ═══════════════════════════════════════
// 8. AUDIT TRAIL
// ═══════════════════════════════════════
BK.renderAudit = function(p) {
  return SPG.shell(SPG.toolbar('Audit Trail') + `
    <div class="content">
      ${BK.dateFilterChips(_auditPreset, 'BakerySection.setAuditPreset')}
      <div style="margin-top:8px">
        <input type="text" id="bk-audit-search" class="inp" style="font-size:12px;padding:6px 10px;width:100%" placeholder="Search user or action..." value="${esc(_auditSearch)}" oninput="BakerySection.onAuditSearch(this.value)">
      </div>
      <div id="bk-audit-body" style="margin-top:12px">${SPG.ui.skeleton(40, 6)}</div>
    </div>`, 'Bakery');
};

BK.loadAudit = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  await _loadAudit();
};

async function _loadAudit() {
  const el = document.getElementById('bk-audit-body');
  if (!el) return;

  const range = BK.getDateRange(_auditPreset);
  try {
    const data = await BK.api('get_audit_trail', { date_from: range.from, date_to: range.to });
    S.auditData = data || [];
    _renderAudit(el);
  } catch (e) {
    el.innerHTML = SPG.ui.empty('📜', 'Failed to load audit trail', e.message);
  }
}

function _renderAudit(el) {
  let items = Array.isArray(S.auditData) ? S.auditData : [];

  // Client-side search filter
  if (_auditSearch) {
    const q = _auditSearch.toLowerCase();
    items = items.filter(a =>
      (a.user_name || '').toLowerCase().includes(q) ||
      (a.action || '').toLowerCase().includes(q) ||
      (a.detail || '').toLowerCase().includes(q)
    );
  }

  if (!items.length) {
    el.innerHTML = SPG.ui.empty('📜', 'No audit events', _auditSearch ? 'Try a different search' : 'No events in this period');
    return;
  }

  const st = SPG.ui.getSortState('bk-audit');
  const sorted = st ? SPG.ui.sortData(items, st.key, st.dir) : items;

  let html = `<div style="font-size:10px;color:var(--t3);margin-bottom:8px">${items.length} event${items.length > 1 ? 's' : ''}</div>`;
  html += `<div style="overflow-x:auto">
    <table class="tbl" style="font-size:11px;min-width:450px">
      <thead><tr>
        ${SPG.ui.sortTh('bk-audit', 'timestamp', 'Time')}
        ${SPG.ui.sortTh('bk-audit', 'user_name', 'User')}
        ${SPG.ui.sortTh('bk-audit', 'action', 'Action')}
        <th style="text-align:left;padding:8px 6px">Detail</th>
      </tr></thead>
      <tbody>`;

  sorted.forEach(a => {
    html += `<tr>
      <td style="padding:6px;white-space:nowrap;color:var(--t3);font-size:10px">${esc(BK.sydneyDateTime(a.timestamp || a.created_at))}</td>
      <td style="padding:6px;font-weight:600">${esc(a.user_name || a.user_id || '')}</td>
      <td style="padding:6px"><span style="background:var(--bg2);padding:2px 6px;border-radius:4px;font-size:10px;font-weight:600">${esc(a.action || '')}</span></td>
      <td style="padding:6px;color:var(--t2);font-size:10px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(a.detail || '')}">${esc(a.detail || '')}</td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function setAuditPreset(preset) {
  _auditPreset = preset;
  SPG.go('bakery/audit');
}

const _onAuditSearchDebounced = BK.debounce(function(val) {
  _auditSearch = val;
  const el = document.getElementById('bk-audit-body');
  if (el) _renderAudit(el);
}, 300);

function onAuditSearch(val) {
  _onAuditSearchDebounced(val);
}


// ═══════════════════════════════════════
// EXTEND BakerySection (onclick handlers)
// ═══════════════════════════════════════
Object.assign(window.BakerySection, {
  // Config
  saveConfig,

  // Dept Mapping
  cycleDeptMap,
  saveDeptMapping,

  // Visibility
  toggleVisibility,

  // Access Matrix
  togglePermission,

  // Waste Dashboard
  setWasteDashPreset,

  // Top Products
  setTopProdsPreset,

  // Cutoff Violations
  setCutoffPreset,

  // Audit Trail
  setAuditPreset,
  onAuditSearch,
});

// Sort event listener
document.addEventListener('spg-sort', (e) => {
  const id = e.detail.tableId;
  if (id === 'bk-top-prods') {
    const el = document.getElementById('bk-top-prods');
    if (el) _renderTopProds(el);
  }
  if (id === 'bk-cutoff') {
    const el = document.getElementById('bk-cutoff-body');
    if (el) _renderCutoff(el);
  }
  if (id === 'bk-audit') {
    const el = document.getElementById('bk-audit-body');
    if (el) _renderAudit(el);
  }
});

})();
