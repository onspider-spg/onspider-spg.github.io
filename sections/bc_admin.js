/**
 * SPG HUB v1.1.0 | 23 MAR 2026 | Siam Palette Group
 * sections/bc_admin.js — Admin + Reports Screens (8 pages)
 * Config, Dept Mapping, Visibility, Access Matrix, Waste Dashboard, Top Products, Cutoff Violations, Audit Trail
 *
 * Depends on: bc_core.js (BK global)
 * Ported from: spg-bakeryorder/js/screens3_bcorder.js (legacy layout)
 */

(() => {
const esc = SPG.esc;
const S = BK.S;

// ─── CONFIG METADATA (display labels for known keys) ───
const CONFIG_META = {
  cutoff_time:         { label: '⏰ Cutoff Time',         desc: 'Orders after this time → flag as cutoff violation' },
  delivery_days:       { label: '📅 Delivery Days',       desc: 'Available days for delivery orders' },
  order_id_prefix:     { label: '🏷️ Order ID Prefix',     desc: 'Prefix for new order IDs' },
  thermal_printer_ip:  { label: '🖨️ Thermal Printer IP',  desc: 'Epson TM-M30III IP address for thermal delivery slip printing (e.g. 192.168.1.100)' },
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

// ─── Shared: horizontal bar + KPI card ───
function hBar(pct, color) {
  return `<div class="rpt-bar"><div class="rpt-bar-fill" style="width:${Math.min(pct, 100)}%;background:${color}"></div></div>`;
}
function rptKpi(val, label, color) {
  return `<div class="rpt-kpi" style="border-left:3px solid ${color}"><div class="rpt-kpi-val" style="color:${color}">${val ?? 0}</div><div class="rpt-kpi-label">${label}</div></div>`;
}

function reasonColor(r) { return r === 'Expired' ? '#ef4444' : r === 'Damaged' ? '#f97316' : r === 'Production Error' ? 'var(--acc)' : 'var(--blue)'; }


// ═══════════════════════════════════════
// 1. CONFIG
// ═══════════════════════════════════════

BK.renderConfig = function(p) {
  return SPG.shell(SPG.toolbar('System Config') + `
    <div class="content" id="configContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
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
    return `<div class="adm-row" onclick="BakerySection.editConfig('${esc(k)}')">
      <div class="adm-row-info">
        <div class="adm-row-label">${meta.label}</div>
        <div class="adm-row-desc">${esc(meta.desc)}</div>
        <div class="adm-row-key">${esc(k)}</div>
      </div>
      <div class="adm-row-val">${esc(cfg[k])}</div>
      <span class="adm-row-edit">✏️</span>
    </div>`;
  }).join('');

  el.innerHTML = `<div style="max-width:700px;margin:0 auto">
    <div style="font-size:10px;color:var(--t4);margin-bottom:8px">${keys.length} config keys — click to edit</div>
    <div class="adm-list">${rows}</div>
  </div>`;
};

BK.loadConfig = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();
  BK.fillConfig();
};

function editConfig(key) {
  const val = S.config[key] || '';
  const meta = CONFIG_META[key] || { label: key, desc: '' };

  SPG.showDialog(`<div class="popup-sheet" style="width:380px">
    <div class="popup-header"><div class="popup-title">⚙ Edit Config</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div style="padding:10px 14px;background:var(--bg3);border-radius:var(--rd);margin-bottom:12px">
      <div style="font-size:12px;font-weight:700">${meta.label}</div>
      <div style="font-size:10px;color:var(--t3);margin-top:2px">${esc(meta.desc)}</div>
      <div style="font-size:9px;color:var(--t4);margin-top:2px">key: ${esc(key)}</div>
    </div>
    <div class="fg"><label class="lb">Value</label><input class="inp" id="cfgValInput" value="${esc(val)}" style="font-size:16px;font-weight:700"></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-outline" style="flex:1" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" style="flex:1" id="cfgSaveBtn" onclick="BakerySection.saveConfig('${esc(key)}')">💾 Save</button>
    </div>
  </div>`);
}

async function saveConfig(key) {
  const btn = document.getElementById('cfgSaveBtn');
  if (!btn || btn.disabled) return;
  const newVal = document.getElementById('cfgValInput')?.value ?? '';
  const oldVal = S.config[key] || '';
  if (newVal === oldVal) { SPG.toast('ไม่มีการเปลี่ยนแปลง', 'warning'); return; }

  btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
  try {
    const resp = await BK.api('save_config', { config_key: key, config_value: newVal });
    if (resp.success) {
      SPG.closeDialog();
      SPG.toast('✅ บันทึกเรียบร้อย', 'success');
      S.config[key] = newVal;
      BK.fillConfig();
    } else {
      SPG.toast(resp.message || 'Error', 'error');
      btn.disabled = false; btn.textContent = '💾 Save';
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
    btn.disabled = false; btn.textContent = '💾 Save';
  }
}


// ═══════════════════════════════════════
// 2. DEPT MAPPING
// ═══════════════════════════════════════

BK.renderDeptMapping = function(p) {
  return SPG.shell(SPG.toolbar('Dept Mapping') + `
    <div class="content" id="deptMapContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.fillDeptMapping = function() {
  const el = document.getElementById('deptMapContent');
  if (!el) return;
  const data = S.deptMappings;
  if (!data) { el.innerHTML = '<div class="empty"><div class="empty-icon">🏢</div><div class="empty-title">กำลังโหลด...</div></div>'; return; }

  const rows = data.map(d => {
    const rc = ROLE_COLORS[d.module_role] || 'var(--t4)';
    const isActive = d.is_active !== false;
    return `<div class="adm-row${isActive ? '' : ' adm-row-off'}" onclick="BakerySection.editDeptMapping('${esc(d.dept_id)}')">
      <div class="adm-row-info" style="flex:1">
        <div style="font-size:12px;font-weight:700">${esc(d.dept_name || d.dept_id)}</div>
        <div style="font-size:10px;color:var(--t3);margin-top:2px">${esc(d.dept_id)}</div>
      </div>
      <div style="flex:1">
        <span class="adm-role-badge" style="background:${rc}20;color:${rc}">${esc(d.module_role)}</span>
      </div>
      <div style="flex:1;font-size:10px;color:var(--t2)">${esc(d.section_scope || '—')}</div>
      <div style="width:40px;text-align:center;color:${isActive ? 'var(--green)' : 'var(--red)'};font-size:11px;font-weight:600">${isActive ? 'ON' : 'OFF'}</div>
      <span class="adm-row-edit">✏️</span>
    </div>`;
  }).join('');

  el.innerHTML = `<div style="max-width:900px;margin:0 auto">
    <div style="font-size:10px;color:var(--t4);margin-bottom:8px">${data.length} departments — click ✏️ to edit</div>
    <div class="adm-list">${rows}</div>
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

function editDeptMapping(deptId) {
  const d = (S.deptMappings || []).find(x => x.dept_id === deptId);
  if (!d) return;

  const roles = ['store', 'bc_production', 'bc_management', 'not_applicable'];
  const roleOpts = roles.map(r => `<option value="${r}"${r === d.module_role ? ' selected' : ''}>${r}</option>`).join('');
  const isActive = d.is_active !== false;

  SPG.showDialog(`<div class="popup-sheet" style="width:420px">
    <div class="popup-header"><div class="popup-title">✏️ ${esc(d.dept_name || d.dept_id)}</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div style="padding:8px 12px;background:var(--bg3);border-radius:var(--rd);margin-bottom:12px;font-size:11px">
      <div style="display:flex;justify-content:space-between"><span style="color:var(--t3)">Dept ID</span><span style="font-weight:700">${esc(d.dept_id)}</span></div>
    </div>
    <div class="fg"><label class="lb">Module Role *</label><select class="sel" id="dmRoleInput">${roleOpts}</select></div>
    <div class="fg"><label class="lb">Section Scope</label><input class="inp" id="dmScopeInput" value="${esc(d.section_scope || '')}" placeholder="e.g. cake, sauce (comma separated)"><div style="font-size:9px;color:var(--t4);margin-top:2px">ว่าง = ไม่จำกัด scope</div></div>
    <div class="fg"><label class="lb">Status</label><div style="display:flex;gap:8px">
      <div class="chip${isActive ? ' active' : ''}" id="dmActive" onclick="document.getElementById('dmActive').classList.add('active');document.getElementById('dmInactive').classList.remove('active')">Active</div>
      <div class="chip${!isActive ? ' active' : ''}" id="dmInactive" onclick="document.getElementById('dmInactive').classList.add('active');document.getElementById('dmActive').classList.remove('active')">Inactive</div>
    </div></div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-outline" style="flex:1" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" style="flex:1" id="dmSaveBtn" onclick="BakerySection.saveDeptMapping('${esc(d.dept_id)}')">💾 Save</button>
    </div>
  </div>`);
}

async function saveDeptMapping(deptId) {
  const btn = document.getElementById('dmSaveBtn');
  if (!btn || btn.disabled) return;

  const moduleRole = document.getElementById('dmRoleInput')?.value;
  const sectionScope = document.getElementById('dmScopeInput')?.value?.trim() || '';
  const isActive = document.getElementById('dmActive')?.classList.contains('active');

  if (!moduleRole) { SPG.toast('เลือก Module Role', 'error'); return; }

  btn.disabled = true; btn.textContent = 'กำลังบันทึก...';
  try {
    const resp = await BK.api('save_dept_mapping', {
      dept_id: deptId,
      module_role: moduleRole,
      section_scope: sectionScope,
      is_active: isActive,
    });
    if (resp.success) {
      SPG.closeDialog();
      SPG.toast('✅ บันทึกเรียบร้อย', 'success');
      const d = S.deptMappings.find(x => x.dept_id === deptId);
      if (d) { d.module_role = moduleRole; d.section_scope = sectionScope; d.is_active = isActive; }
      BK.fillDeptMapping();
    } else {
      SPG.toast(resp.message || 'Error', 'error');
      btn.disabled = false; btn.textContent = '💾 Save';
    }
  } catch (e) {
    SPG.toast('Network error', 'error');
    btn.disabled = false; btn.textContent = '💾 Save';
  }
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
    <div class="content" id="visContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.fillVisibility = function() {
  const el = document.getElementById('visContent');
  if (!el) return;
  const prods = S.adminProducts;
  const channels = S.adminChannels;
  if (!prods || !channels) { el.innerHTML = '<div class="empty"><div class="empty-icon">👁️</div><div class="empty-title">กำลังโหลด...</div></div>'; return; }

  // Section filter (from categories master list — ensures all sections always visible)
  const sortedSecs = [...new Set(S.categories.map(c => c.section_id).filter(Boolean))].sort();

  const secChips = `<div style="display:flex;gap:5px;margin-bottom:6px;flex-wrap:wrap">
    <div class="chip${_visSection === 'all' ? ' active' : ''}" onclick="BakerySection.setVisSection('all')">All</div>
    ${sortedSecs.map(s => `<div class="chip${_visSection === s ? ' active' : ''}" onclick="BakerySection.setVisSection('${esc(s)}')">${esc(s)}</div>`).join('')}
  </div>`;

  const search = `<input class="search-input" style="max-width:300px;margin-bottom:8px" placeholder="🔍 Search products..." value="${esc(_visSearch)}" oninput="BakerySection.dFilterVis(this.value)">`;

  // Filter products
  let filtered = prods.filter(p => p.is_active);
  if (_visSection !== 'all') filtered = filtered.filter(p => p.section_id === _visSection);
  if (_visSearch) { const s = _visSearch.toLowerCase(); filtered = filtered.filter(p => (p.product_name || '').toLowerCase().includes(s)); }
  filtered.sort((a, b) => (a.product_name || '').localeCompare(b.product_name || ''));

  if (!filtered.length) {
    el.innerHTML = `<div style="max-width:1100px;margin:0 auto">${secChips}${search}<div class="empty"><div class="empty-icon">🔍</div><div class="empty-title">ไม่พบสินค้า</div></div></div>`;
    return;
  }

  // Build visibility Set for quick lookup
  const visSet = new Set();
  prods.forEach(p => {
    (p.visibility || []).forEach(v => {
      if (v.is_active !== false) visSet.add(p.product_id + '|' + v.store_id + '|' + v.dept_id);
    });
  });

  // Table header
  let thCols = channels.map(ch => `<th class="vis-th-ch">${esc(ch.store_id)}<br><span style="font-size:8px;color:var(--t4)">${esc(ch.dept_id)}</span></th>`).join('');

  // Table rows
  let rows = filtered.map(p => {
    const cells = channels.map(ch => {
      const key = p.product_id + '|' + ch.store_id + '|' + ch.dept_id;
      const on = visSet.has(key);
      return `<td class="vis-cell" id="vc-${p.product_id}-${ch.store_id}-${ch.dept_id}" onclick="BakerySection.toggleVis('${p.product_id}','${ch.store_id}','${ch.dept_id}')">
        <span style="color:${on ? 'var(--green)' : 'var(--t4)'};font-size:14px;cursor:pointer">${on ? '☑' : '☐'}</span>
      </td>`;
    }).join('');
    return `<tr><td class="vis-prod-name">${esc(p.product_name)}</td>${cells}</tr>`;
  }).join('');

  const counter = `<div style="font-size:9px;color:var(--t3);margin-bottom:6px">Tap to toggle — ${filtered.length} products × ${channels.length} channels</div>`;

  el.innerHTML = `<div style="max-width:1100px;margin:0 auto">${secChips}${search}${counter}
    <div style="background:var(--bg);border:1px solid var(--bd);border-radius:var(--rd);overflow-x:auto">
      <table class="vis-tbl"><thead><tr><th style="text-align:left;min-width:140px">Product</th>${thCols}</tr></thead><tbody>${rows}</tbody></table>
    </div>
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

  // Find current state
  const vis = p.visibility || [];
  const idx = vis.findIndex(v => v.store_id === storeId && v.dept_id === deptId);
  const wasOn = idx >= 0 && vis[idx].is_active !== false;
  const newOn = !wasOn;

  // UI helper
  const cellId = 'vc-' + productId + '-' + storeId + '-' + deptId;
  const cell = document.getElementById(cellId);
  function setUI(on) {
    if (cell) cell.innerHTML = `<span style="color:${on ? 'var(--green)' : 'var(--t4)'};font-size:14px;cursor:pointer">${on ? '☑' : '☐'}</span>`;
  }

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

  // Optimistic: update UI + memory
  setUI(newOn);
  setMem(newOn);

  // Sync DB — rollback on fail
  try {
    const resp = await BK.api('toggle_visibility', { product_id: productId, store_id: storeId, dept_id: deptId, visible: newOn });
    if (!resp.success) {
      setMem(wasOn); setUI(wasOn);
      SPG.toast(resp.message || 'Error', 'error');
    }
  } catch (e) {
    setMem(wasOn); setUI(wasOn);
    SPG.toast('Network error', 'error');
  }
}


// ═══════════════════════════════════════
// 4. USER ACCESS MATRIX
// ═══════════════════════════════════════

let _accessData = null; // { functions: [], tiers: [], permissions: {} }

BK.renderAccess = function(p) {
  return SPG.shell(SPG.toolbar('User Access') + `
    <div class="content" id="accessContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.fillAccess = function() {
  const el = document.getElementById('accessContent');
  if (!el) return;
  if (!_accessData) { el.innerHTML = '<div class="empty"><div class="empty-icon">🔐</div><div class="empty-title">กำลังโหลด...</div></div>'; return; }

  const { functions: fns, tiers, permissions: perms } = _accessData;
  if (!fns.length) { el.innerHTML = '<div class="empty"><div class="empty-icon">🔐</div><div class="empty-title">ไม่มีข้อมูล Functions</div></div>'; return; }

  // Group by section
  const sections = {};
  const secOrder = [];
  fns.forEach(f => {
    if (!sections[f.section]) { sections[f.section] = []; secOrder.push(f.section); }
    sections[f.section].push(f);
  });

  // Table header
  const thTiers = tiers.map(t => `<th class="acc-th-tier">${t}</th>`).join('');

  // Table rows
  let rows = '';
  secOrder.forEach(sec => {
    rows += `<tr><td colspan="${tiers.length + 1}" class="acc-sec-hd">${esc(sec)} (${sections[sec].length})</td></tr>`;
    sections[sec].forEach(f => {
      const cells = tiers.map(t => {
        const key = f.function_id + '|' + t;
        const on = !!perms[key];
        return `<td class="acc-cell" id="ac-${f.function_id}-${t}" onclick="BakerySection.togglePerm('${f.function_id}','${t}')">
          <div class="acc-toggle${on ? ' acc-on' : ''}">${on ? '✅' : '—'}</div>
        </td>`;
      }).join('');
      rows += `<tr><td class="acc-fn-name"><span class="acc-fn-label">${esc(f.function_name)}</span><span class="acc-fn-id">${esc(f.function_id)}</span></td>${cells}</tr>`;
    });
  });

  const counter = `<div style="font-size:9px;color:var(--t3);margin-bottom:6px">${fns.length} functions × ${tiers.length} tiers — Tap to toggle (T1/T2 only)</div>`;

  el.innerHTML = `<div style="max-width:1100px;margin:0 auto">${counter}
    <div style="background:var(--bg);border:1px solid var(--bd);border-radius:var(--rd);overflow-x:auto">
      <table class="acc-tbl"><thead><tr><th style="min-width:180px;text-align:left">Function</th>${thTiers}</tr></thead><tbody>${rows}</tbody></table>
    </div>
    <div style="display:flex;justify-content:center;margin:16px 0">
      <button class="btn btn-primary" style="padding:10px 40px" onclick="SPG.go('bakery/home')">✓ Done</button>
    </div>
    <div style="font-size:9px;color:var(--t4);text-align:center">ทุกการเปลี่ยนแปลงจะบันทึกทันทีที่กด toggle</div>
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

// ─── Optimistic toggle permission ───
async function togglePerm(functionId, tierId) {
  if (!_accessData) { SPG.toast('No access data loaded', 'error'); return; }
  const key = functionId + '|' + tierId;
  const wasOn = !!_accessData.permissions[key];
  const newOn = !wasOn;

  // Optimistic UI
  _accessData.permissions[key] = newOn;
  const cell = document.getElementById('ac-' + functionId + '-' + tierId);
  function setUI(on) {
    if (!cell) return;
    const inner = cell.querySelector('.acc-toggle');
    if (inner) { inner.className = 'acc-toggle' + (on ? ' acc-on' : ''); inner.textContent = on ? '✅' : '—'; }
  }
  setUI(newOn);

  // Sync DB
  try {
    const resp = await BK.api('toggle_permission', { function_id: functionId, tier_id: tierId, allowed: newOn });
    if (resp.success) {
      SPG.toast('✅ อัพเดท Permission', 'success');
    } else {
      _accessData.permissions[key] = wasOn;
      setUI(wasOn);
      SPG.toast(resp.message || 'Error', 'error');
    }
  } catch (e) {
    _accessData.permissions[key] = wasOn;
    setUI(wasOn);
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
    <div class="order-date-bar">
      <span class="date-label">📅</span>
      <input type="date" class="date-inp" value="${_wdDateFrom}" onchange="BakerySection.setWDDate('from',this.value)">
      <span style="color:var(--t4)">→</span>
      <input type="date" class="date-inp" value="${_wdDateTo}" onchange="BakerySection.setWDDate('to',this.value)">
      <span class="date-link" onclick="BakerySection.setWDPreset('30d')">30d</span>
      <span class="date-link" onclick="BakerySection.setWDPreset('all')">ทั้งหมด</span>
    </div>
    <div class="content" id="wdContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.fillWasteDashboard = function() {
  const el = document.getElementById('wdContent');
  if (!el) return;
  const d = S.wasteDash;
  if (!d) { el.innerHTML = '<div class="empty"><div class="empty-icon">📊</div><div class="empty-title">กำลังโหลด...</div></div>'; return; }

  // KPI cards
  const kpis = `<div class="rpt-kpis">
    ${rptKpi(d.today, 'Today', 'var(--red)')}
    ${rptKpi(d.week7, '7 days', 'var(--orange)')}
    ${rptKpi(d.total, 'Total', 'var(--blue)')}
    ${rptKpi(d.avg_per_day, 'Avg/day', 'var(--acc)')}
  </div>`;

  // By Reason
  const maxReason = Math.max(...(d.by_reason || []).map(r => r.qty), 1);
  const reasons = (d.by_reason || []).map(r =>
    `<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span style="font-weight:600">${esc(r.reason)}</span><span>${r.qty} pcs</span></div>${hBar(r.qty / maxReason * 100, reasonColor(r.reason))}</div>`
  ).join('');
  const reasonBlock = reasons ? `<div class="rpt-section"><div class="rpt-section-title">By Reason</div>${reasons}</div>` : '';

  // Top Waste
  const medals = ['🥇', '🥈', '🥉'];
  const maxTop = Math.max(...(d.top_products || []).map(r => r.qty), 1);
  const tops = (d.top_products || []).slice(0, 5).map((r, i) =>
    `<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span>${medals[i] || '#' + (i + 1)} <b>${esc(r.product_name)}</b></span><span style="color:var(--red)">${r.qty}</span></div>${hBar(r.qty / maxTop * 100, 'var(--red)')}</div>`
  ).join('');
  const topBlock = tops ? `<div class="rpt-section"><div class="rpt-section-title">🏆 Top Waste</div>${tops}</div>` : '';

  el.innerHTML = `<div style="max-width:900px;margin:0 auto">${kpis}
    <div class="rpt-grid">${reasonBlock}${topBlock}</div>
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

let _tpDateFrom = '';
let _tpDateTo = '';

BK.renderTopProducts = function(p) {
  const d30 = new Date(BK.sydneyNow()); d30.setDate(d30.getDate() - 30);
  _tpDateFrom = BK.fmtDate(d30);
  _tpDateTo = BK.todaySydney();
  return SPG.shell(SPG.toolbar('Top Products') + `
    <div class="order-date-bar">
      <span class="date-label">📅</span>
      <input type="date" class="date-inp" value="${_tpDateFrom}" onchange="BakerySection.setTPDate('from',this.value)">
      <span style="color:var(--t4)">→</span>
      <input type="date" class="date-inp" value="${_tpDateTo}" onchange="BakerySection.setTPDate('to',this.value)">
      <span class="date-link" onclick="BakerySection.setTPPreset('30d')">30d</span>
      <span class="date-link" onclick="BakerySection.setTPPreset('all')">ทั้งหมด</span>
    </div>
    <div class="content" id="tpContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.fillTopProducts = function() {
  const el = document.getElementById('tpContent');
  if (!el) return;
  const d = S.topProds;
  if (!d) { el.innerHTML = '<div class="empty"><div class="empty-icon">🏆</div><div class="empty-title">กำลังโหลด...</div></div>'; return; }

  // Most Ordered
  const medals = ['🥇', '🥈', '🥉'];
  const topColors = ['var(--acc)', 'var(--acc)', 'var(--acc)', 'var(--blue)', 'var(--blue)'];
  const maxOrd = Math.max(...(d.top_ordered || []).map(r => r.qty), 1);
  const orderedBars = (d.top_ordered || []).slice(0, 5).map((r, i) =>
    `<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span>${medals[i] || '#' + (i + 1)} <b>${esc(r.product_name)}</b></span><span style="font-weight:700">${r.qty}</span></div>${hBar(r.qty / maxOrd * 100, topColors[i] || 'var(--blue)')}</div>`
  ).join('');
  const orderedBlock = orderedBars ? `<div class="rpt-section"><div class="rpt-section-title">🏆 Most Ordered</div>${orderedBars}</div>` : '';

  // By Store
  const storeColors = ['var(--green)', 'var(--blue)', 'var(--orange)', 'var(--acc)', 'var(--red)'];
  const maxStore = Math.max(...(d.by_store || []).map(r => r.qty), 1);
  const storeBars = (d.by_store || []).map((r, i) =>
    `<div style="margin-bottom:6px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px"><span style="font-weight:600">${esc(BK.getStoreName(r.store_id) || r.store_id)}</span><span>${r.qty}</span></div>${hBar(r.qty / maxStore * 100, storeColors[i % storeColors.length])}</div>`
  ).join('');
  const storeBlock = storeBars ? `<div class="rpt-section"><div class="rpt-section-title">🏪 By Store</div>${storeBars}</div>` : '';

  // By Category
  const catIcons = { 'Bread': '🍞', 'Pastry': '🥐', 'Cake': '🎂', 'Savory': '🥪', 'Drink': '🥤' };
  const byCat = d.by_category || [];
  const totalCat = byCat.reduce((sum, c) => sum + (c.qty || 0), 0) || 1;
  const catCards = byCat.map(c => {
    const icon = catIcons[c.category_name] || catIcons[c.name] || '📦';
    const pct = ((c.qty / totalCat) * 100).toFixed(1);
    return `<div style="background:var(--bg2);border-radius:var(--rd);padding:10px;text-align:center">
      <div style="font-size:18px">${icon}</div>
      <div style="font-weight:700;color:var(--acc)">${c.qty}</div>
      <div style="font-size:9px;color:var(--t3)">${esc(c.category_name || c.name)} · ${pct}%</div>
    </div>`;
  }).join('');
  const catBlock = byCat.length ? `<div class="rpt-section" style="margin-top:14px"><div class="rpt-section-title">📦 By Category</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:8px">${catCards}</div></div>` : '';

  if (!orderedBars && !storeBars && !byCat.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📦</div><div class="empty-title">ไม่มีข้อมูลในช่วงนี้</div></div>';
    return;
  }

  el.innerHTML = `<div style="max-width:800px;margin:0 auto">${orderedBlock}${storeBlock}${catBlock}</div>`;
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


// ═══════════════════════════════════════
// 7. CUTOFF VIOLATIONS
// ═══════════════════════════════════════

let _coDateFrom = '';
let _coDateTo = '';
let _coShowCount = 10;

BK.renderCutoff = function(p) {
  const d30 = new Date(BK.sydneyNow()); d30.setDate(d30.getDate() - 30);
  _coDateFrom = BK.fmtDate(d30);
  _coDateTo = BK.todaySydney();
  _coShowCount = 10;
  return SPG.shell(SPG.toolbar('Cutoff Violations') + `
    <div class="order-date-bar">
      <span class="date-label">📅</span>
      <input type="date" class="date-inp" value="${_coDateFrom}" onchange="BakerySection.setCODate('from',this.value)">
      <span style="color:var(--t4)">→</span>
      <input type="date" class="date-inp" value="${_coDateTo}" onchange="BakerySection.setCODate('to',this.value)">
      <span class="date-link" onclick="BakerySection.setCOPreset('today')">Today</span>
      <span class="date-link" onclick="BakerySection.setCOPreset('30d')">30d</span>
    </div>
    <div class="content" id="coContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.fillCutoff = function() {
  const el = document.getElementById('coContent');
  if (!el) return;
  const data = S.cutoffData;
  if (!data) { el.innerHTML = '<div class="empty"><div class="empty-icon">⏰</div><div class="empty-title">กำลังโหลด...</div></div>'; return; }

  const list = data || [];
  if (!list.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">✅</div><div class="empty-title">ไม่มี Cutoff Violation</div><div class="empty-desc">ในช่วงเวลาที่เลือก</div></div>';
    return;
  }

  const visible = list.slice(0, _coShowCount);
  const hasMore = list.length > _coShowCount;

  const stsStyle = (s) => {
    if (s === 'Pending') return 'background:var(--red-bg);color:var(--red)';
    if (s === 'Ordered') return 'background:var(--blue-bg);color:#1e40af';
    if (s === 'Fulfilled' || s === 'Delivered') return 'background:var(--green-bg);color:#065f46';
    return 'background:var(--bg3);color:var(--t3)';
  };

  const rows = visible.map(o => `<tr style="border-left:3px solid ${o.status === 'Pending' ? 'var(--red)' : 'var(--bd)'}">
    <td style="font-weight:700;color:var(--acc)">${esc(o.order_id)}</td>
    <td>${esc(BK.getStoreName(o.store_id) || o.store_id)}</td>
    <td style="font-size:10px">${esc(o.ordered_time || '')}</td>
    <td>${BK.fmtDateAU(o.delivery_date)}</td>
    <td><span class="sts" style="${stsStyle(o.status)}">${esc(o.status)}</span></td>
  </tr>`).join('');

  el.innerHTML = `<div style="max-width:900px;margin:0 auto">
    <div style="font-size:10px;color:var(--t3);margin-bottom:6px">⏰ ${list.length} violations</div>
    <div style="background:var(--bg);border:1px solid var(--bd);border-radius:var(--rd);overflow-x:auto">
      <table class="adm-tbl"><thead><tr><th>Order</th><th>Store</th><th>Ordered At</th><th>Delivery</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
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
    <div class="order-date-bar">
      <span class="date-label">📅</span>
      <input type="date" class="date-inp" value="${_auDateFrom}" onchange="BakerySection.setAUDate('from',this.value)">
      <span style="color:var(--t4)">→</span>
      <input type="date" class="date-inp" value="${_auDateTo}" onchange="BakerySection.setAUDate('to',this.value)">
      <span class="date-link" onclick="BakerySection.setAUPreset('30d')">30d</span>
      <span class="date-link" onclick="BakerySection.setAUPreset('all')">ทั้งหมด</span>
    </div>
    <div class="order-chips" id="auChips"></div>
    <div class="content" id="auContent"><div class="skel skel-card"></div><div class="skel skel-card"></div></div>`, 'Bakery');
};

BK.fillAudit = function() {
  const el = document.getElementById('auContent');
  const chipEl = document.getElementById('auChips');
  if (!el) return;
  const all = S.auditData || [];

  // Count by type
  const counts = { all: all.length };
  all.forEach(a => { counts[a.action_type] = (counts[a.action_type] || 0) + 1; });

  // Chips
  const typeLabels = { permission: '🔐 Perm', dept_mapping: '🏢 Dept', config: '⚙ Config', product: '📦 Product', visibility: '👁️ Vis' };
  if (chipEl) {
    let chips = `<div class="chip${_auFilter === 'all' ? ' active' : ''}" onclick="BakerySection.setAUFilter('all')">All (${all.length})</div>`;
    for (const [type, label] of Object.entries(typeLabels)) {
      if (counts[type]) chips += `<div class="chip${_auFilter === type ? ' active' : ''}" onclick="BakerySection.setAUFilter('${type}')">${label} (${counts[type]})</div>`;
    }
    chipEl.innerHTML = chips;
  }

  // Filter
  let filtered = all;
  if (_auFilter !== 'all') filtered = all.filter(a => a.action_type === _auFilter);

  if (!filtered.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">ไม่มี Audit Log</div></div>';
    return;
  }

  const visible = filtered.slice(0, _auShowCount);
  const hasMore = filtered.length > _auShowCount;

  const badgeStyle = (type) => {
    const map = { permission: 'background:var(--acc2);color:var(--acc)', dept_mapping: 'background:var(--blue-bg);color:var(--blue)', config: 'background:#fffbeb;color:#92400e', product: 'background:var(--green-bg);color:var(--green)', visibility: 'background:var(--bg3);color:var(--t2)' };
    return map[type] || 'background:var(--bg3);color:var(--t2)';
  };

  const rows = visible.map(a => {
    const time = a.changed_at ? new Date(a.changed_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
    return `<tr>
      <td style="font-size:9px;white-space:nowrap">${esc(time)}</td>
      <td><span style="${badgeStyle(a.action_type)};padding:1px 4px;border-radius:3px;font-size:9px;font-weight:600">${esc(a.action_type)}</span></td>
      <td style="font-size:10px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(a.target)}">${esc(a.target)}</td>
      <td style="color:var(--red);font-size:10px">${esc(a.old_value || '—')}</td>
      <td style="color:var(--green);font-size:10px">${esc(a.new_value || '—')}</td>
      <td style="font-size:10px">${esc(a.changed_by_name || a.changed_by || '')}</td>
    </tr>`;
  }).join('');

  el.innerHTML = `<div style="max-width:1100px;margin:0 auto">
    <div style="background:var(--bg);border:1px solid var(--bd);border-radius:var(--rd);overflow-x:auto">
      <table class="adm-tbl"><thead><tr><th>Time</th><th>Action</th><th>Target</th><th>From</th><th>To</th><th>By</th></tr></thead><tbody>${rows}</tbody></table>
    </div>
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
  editConfig,
  saveConfig,

  // Dept Mapping
  editDeptMapping,
  saveDeptMapping,

  // Visibility
  setVisSection,
  dFilterVis,
  toggleVis,

  // Access Matrix
  togglePerm,

  // Waste Dashboard
  setWDDate,
  setWDPreset,

  // Top Products
  setTPDate,
  setTPPreset,

  // Cutoff Violations
  setCODate,
  setCOPreset,
  showMoreCO,

  // Audit Trail
  setAUDate,
  setAUPreset,
  setAUFilter,
  showMoreAU,
});

})();
