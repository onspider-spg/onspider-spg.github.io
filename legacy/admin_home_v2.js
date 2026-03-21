/**
 * Version 2.0 | 20 MAR 2026 | Siam Palette Group
 * ═══════════════════════════════════════════
 * SPG App — Home Module
 * admin_home_v2.js — Layered Permission Admin UI
 * Tab: Base Permissions, Dept Overrides, Staff Assignments, Individual Overrides
 * ═══════════════════════════════════════════
 */

(() => {
const esc = App.esc;

// ═══ STATE ═══
const V2 = {
  basePerm: null, _baseLoaded: false,
  deptOv: null, _deptLoaded: false,
  assignments: null, _assignLoaded: false,
  positions: null,
  baseDirty: {},
  deptDirty: {},
};

// ════════════════════════════════
// TAB 1: BASE PERMISSIONS (position x module matrix)
// ════════════════════════════════
async function loadBasePermissions() {
  const ct = document.getElementById('admin-content');
  if (!ct) return;
  try {
    const data = await API.adminGetBasePermissions();
    V2.basePerm = data;
    V2.positions = data.positions;
    V2._baseLoaded = true;
    V2.baseDirty = {};
    renderBasePermGrid(ct, data);
  } catch (e) { App.toast(e.message, 'error'); }
}

function renderBasePermGrid(ct, data) {
  const matrix = data.matrix || [];
  const positions = data.positions || [];
  const levels = ['no_access', 'view_only', 'edit', 'admin', 'super_admin'];
  const isSA = App.hasHomePerm('super_admin');
  const dis = isSA ? '' : ' disabled';

  let header = '<th style="min-width:120px">Module</th>';
  positions.forEach(p => { header += `<th style="min-width:90px;font-size:10px">${esc(p.position_name)}</th>`; });

  let rows = '';
  matrix.forEach(m => {
    let cells = `<td style="font-weight:600;font-size:11px">${esc(m.module_name_en || m.module_id)}</td>`;
    positions.forEach(p => {
      const val = m[p.position_id] || 'no_access';
      if (p.position_level === 1) {
        cells += `<td style="text-align:center;color:var(--t3);font-size:10px">super_admin</td>`;
      } else {
        const key = `${p.position_id}_${m.module_id}`;
        const opts = levels.map(l => `<option value="${l}"${val === l ? ' selected' : ''}>${l.replace(/_/g, ' ')}</option>`).join('');
        cells += `<td><select class="fl" style="width:100px;font-size:9px;padding:2px 4px" onchange="AdminV2.markBaseDirty('${esc(key)}',this.value)"${dis}>${opts}</select></td>`;
      }
    });
    rows += `<tr>${cells}</tr>`;
  });

  const hint = isSA ? 'Position x Module matrix. Owner is always super_admin. Click Save when done.' : 'View only — requires Super Admin to edit.';
  ct.innerHTML = `
    <div style="font-size:11px;color:var(--t3);margin-bottom:10px">${hint}</div>
    <div class="card" style="padding:0;overflow-x:auto">
      <table class="tbl"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>
    </div>
    <div id="base-dirty-msg" style="font-size:11px;color:var(--orange);margin-top:8px;display:none">Unsaved changes</div>`;
}

function markBaseDirty(key, value) {
  V2.baseDirty[key] = value;
  const msg = document.getElementById('base-dirty-msg');
  if (msg) msg.style.display = Object.keys(V2.baseDirty).length > 0 ? 'block' : 'none';
}

async function saveBasePermissions() {
  const keys = Object.keys(V2.baseDirty);
  if (keys.length === 0) { App.toast('No changes to save', 'info'); return; }
  App.showLoader();
  try {
    for (const key of keys) {
      // key format: "POS-XX_module_id" — position_id is always 6 chars (POS-XX)
      const position_id = key.substring(0, 6);
      const module_id = key.substring(7);
      await API.adminUpdateBasePermission(position_id, module_id, V2.baseDirty[key]);
    }
    V2.baseDirty = {};
    V2._baseLoaded = false;
    App.toast(`Saved ${keys.length} permission(s)`, 'success');
    loadBasePermissions();
  } catch (e) { App.toast(e.message, 'error'); }
  finally { App.hideLoader(); }
}

// ════════════════════════════════
// TAB 2: DEPARTMENT OVERRIDES
// ════════════════════════════════
async function loadDeptOverrides() {
  const ct = document.getElementById('admin-content');
  if (!ct) return;
  try {
    const [ovData, depts, positions, modules] = await Promise.all([
      API.adminGetDeptOverrides(),
      App.getDeptsCache(),
      V2.positions ? Promise.resolve(V2.positions) : API.adminGetPositions().then(d => { V2.positions = d.positions; return d.positions; }),
      API.adminGetAllModules().then(d => d.modules || [])
    ]);
    V2.deptOv = { overrides: ovData.overrides, depts, positions: V2.positions, modules };
    V2._deptLoaded = true;
    V2.deptDirty = {};
    renderDeptOverrides(ct);
  } catch (e) { App.toast(e.message, 'error'); }
}

function renderDeptOverrides(ct) {
  const { overrides, depts, positions, modules } = V2.deptOv;
  const isSA = App.hasHomePerm('super_admin');
  const levels = ['', 'no_access', 'view_only', 'edit', 'admin', 'super_admin'];

  // Group by dept
  const byDept = {};
  (overrides || []).forEach(o => {
    if (!byDept[o.dept_id]) byDept[o.dept_id] = [];
    byDept[o.dept_id].push(o);
  });

  let deptTabs = (depts || []).map(d => {
    const count = (byDept[d.dept_id] || []).length;
    return `<button class="btn btn-sm ${count > 0 ? 'btn-primary' : 'btn-outline'}" style="font-size:10px" onclick="AdminV2.showDeptDetail('${esc(d.dept_id)}')">${esc(d.dept_name_th || d.dept_name)}${count > 0 ? ` (${count})` : ''}</button>`;
  }).join(' ');

  ct.innerHTML = `
    <div style="font-size:11px;color:var(--t3);margin-bottom:10px">Department-specific overrides. Select a department to view/edit exceptions.</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">${deptTabs}</div>
    <div id="dept-detail"></div>`;
}

function showDeptDetail(deptId) {
  const el = document.getElementById('dept-detail');
  if (!el) return;
  const { overrides, positions, modules } = V2.deptOv;
  const isSA = App.hasHomePerm('super_admin');
  const dis = isSA ? '' : ' disabled';
  const levels = ['', 'no_access', 'view_only', 'edit', 'admin', 'super_admin'];

  const deptOvs = (overrides || []).filter(o => o.dept_id === deptId);
  const ovMap = {};
  deptOvs.forEach(o => { ovMap[`${o.position_id}_${o.module_id}`] = o.access_level; });

  let header = `<th>Module</th>`;
  (positions || []).filter(p => p.position_level > 1).forEach(p => {
    header += `<th style="font-size:10px">${esc(p.position_name)}</th>`;
  });

  let rows = '';
  (modules || []).filter(m => m.status !== 'disabled' && m.module_id !== 'home').forEach(m => {
    let cells = `<td style="font-weight:600;font-size:11px">${esc(m.module_name_en || m.module_name || m.module_id)}</td>`;
    (positions || []).filter(p => p.position_level > 1).forEach(p => {
      const key = `${deptId}|${p.position_id}|${m.module_id}`;
      const curVal = V2.deptDirty[key] !== undefined ? V2.deptDirty[key] : (ovMap[`${p.position_id}_${m.module_id}`] || '');
      const opts = levels.map(l => `<option value="${l}"${curVal === l ? ' selected' : ''}>${l ? l.replace(/_/g, ' ') : '— (use base)'}</option>`).join('');
      const style = curVal ? 'color:var(--orange);font-weight:600;border-color:var(--orange)' : 'color:var(--t4)';
      cells += `<td><select class="fl" style="width:90px;font-size:9px;padding:2px 4px;${style}" onchange="AdminV2.markDeptDirty('${esc(key)}',this.value)"${dis}>${opts}</select></td>`;
    });
    rows += `<tr>${cells}</tr>`;
  });

  el.innerHTML = `
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">Department: ${esc(deptId)}</div>
    <div class="card" style="padding:0;overflow-x:auto">
      <table class="tbl"><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>
    </div>
    <div id="dept-dirty-msg" style="font-size:11px;color:var(--orange);margin-top:8px;display:none">Unsaved changes</div>
    ${isSA ? '<button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="AdminV2.saveDeptOverrides()">Save Dept Overrides</button>' : ''}`;
}

function markDeptDirty(key, value) {
  V2.deptDirty[key] = value;
  const msg = document.getElementById('dept-dirty-msg');
  if (msg) msg.style.display = Object.keys(V2.deptDirty).length > 0 ? 'block' : 'none';
}

async function saveDeptOverrides() {
  const keys = Object.keys(V2.deptDirty);
  if (keys.length === 0) { App.toast('No changes', 'info'); return; }
  App.showLoader();
  try {
    for (const key of keys) {
      const [dept_id, position_id, module_id] = key.split('|');
      const access_level = V2.deptDirty[key] || 'remove';
      await API.adminUpdateDeptOverride({ dept_id, position_id, module_id, access_level });
    }
    V2.deptDirty = {};
    V2._deptLoaded = false;
    App.toast(`Saved ${keys.length} override(s)`, 'success');
    loadDeptOverrides();
  } catch (e) { App.toast(e.message, 'error'); }
  finally { App.hideLoader(); }
}

// ════════════════════════════════
// TAB 3: STAFF ASSIGNMENTS
// ════════════════════════════════
async function loadStaffAssignments() {
  const ct = document.getElementById('admin-content');
  if (!ct) return;
  try {
    const [assignData, stores, depts] = await Promise.all([
      API.adminGetStoreAssignments(),
      App.getStoresCache(),
      App.getDeptsCache()
    ]);
    if (!V2.positions) {
      const p = await API.adminGetPositions();
      V2.positions = p.positions;
    }
    V2.assignments = { list: assignData.assignments, stores, depts };
    V2._assignLoaded = true;
    renderStaffAssignments(ct);
  } catch (e) { App.toast(e.message, 'error'); }
}

function renderStaffAssignments(ct) {
  const { list, stores, depts } = V2.assignments;
  const isSA = App.hasHomePerm('super_admin');
  const searchTerm = (V2._saSearch || '').toLowerCase();

  // Group by account
  const byAcc = {};
  (list || []).forEach(a => {
    if (!byAcc[a.account_id]) byAcc[a.account_id] = { name: a.display_name || a.account_id, items: [] };
    byAcc[a.account_id].items.push(a);
    if (a.display_name) byAcc[a.account_id].name = a.display_name;
  });

  // Filter by search
  const entries = Object.entries(byAcc).filter(([accId, data]) => {
    if (!searchTerm) return true;
    return accId.toLowerCase().includes(searchTerm) ||
      data.name.toLowerCase().includes(searchTerm) ||
      data.items.some(a => (a.store_id || '').toLowerCase().includes(searchTerm) || (a.dept_id || '').toLowerCase().includes(searchTerm));
  });

  // Build table rows
  let rows = '';
  if (entries.length === 0) {
    rows = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--t3)">${searchTerm ? 'No results found' : 'No assignments found'}</td></tr>`;
  } else {
    entries.forEach(([accId, data]) => {
      data.items.forEach((a, i) => {
        const storeName = (stores || []).find(s => s.store_id === a.store_id)?.store_name || a.store_id;
        const deptName = (depts || []).find(d => d.dept_id === a.dept_id)?.dept_name || a.dept_id || '-';
        const primary = a.is_primary ? '<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:var(--acc2);color:var(--acc)">Primary</span>' : '';
        const nameCell = i === 0 ? `<td rowspan="${data.items.length}" style="font-weight:600;vertical-align:top;border-right:1px solid var(--bd2)">
          <div>${esc(data.name)}</div>
          <div style="font-size:10px;color:var(--t3);font-weight:400">${esc(accId)}</div>
          ${isSA ? `<button class="btn btn-outline btn-sm" style="font-size:9px;margin-top:6px" onclick="AdminV2.showAddAssignment('${esc(accId)}')">+ Add</button>` : ''}
        </td>` : '';
        rows += `<tr style="border-top:${i === 0 ? '2px solid var(--bd2)' : 'none'}">
          ${nameCell}
          <td>${esc(storeName)}</td>
          <td>${esc(deptName)}</td>
          <td><span style="color:var(--acc);font-size:11px">${esc(a.position_name || '-')}</span></td>
          <td>${primary}</td>
          <td>${isSA ? `<a class="lk" style="color:var(--red);font-size:10px;cursor:pointer" onclick="AdminV2.removeAssignment('${esc(a.account_id)}','${esc(a.store_id)}','${esc(a.dept_id || '')}')">Remove</a>` : ''}</td>
        </tr>`;
      });
    });
  }

  ct.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:11px;color:var(--t3)">${(list || []).length} assignments across ${entries.length} staff</div>
      <input class="inp" style="width:220px;font-size:12px" placeholder="Search name, store, dept..." value="${esc(V2._saSearch || '')}" oninput="AdminV2._saSearch(this.value)">
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <table class="tbl"><thead><tr>
        <th style="min-width:140px">Staff</th><th>Store</th><th>Dept</th><th>Position</th><th></th><th></th>
      </tr></thead><tbody>${rows}</tbody></table>
    </div>`;
}
function _saSearch(val) {
  V2._saSearch = val;
  const ct = document.getElementById('admin-content');
  if (ct) renderStaffAssignments(ct);
}

function showAddAssignment(accountId) {
  const stores = V2.assignments?.stores || [];
  const depts = V2.assignments?.depts || [];
  const positions = V2.positions || [];
  const storeOpts = stores.filter(s => s.store_id !== 'ALL').map(s => `<option value="${esc(s.store_id)}">${esc(s.store_name_th || s.store_name)}</option>`).join('');
  const deptOpts = '<option value="">— No Dept —</option>' + depts.map(d => `<option value="${esc(d.dept_id)}">${esc(d.dept_name_th || d.dept_name)}</option>`).join('');
  const posOpts = positions.filter(p => p.position_level > 1).map(p => `<option value="${esc(p.position_id)}">${esc(p.position_name)}</option>`).join('');

  App.showDialog(`<div class="popup-sheet" style="width:340px">
    <div class="popup-header"><div class="popup-title">Add Assignment</div><button class="popup-close" onclick="App.closeDialog()">✕</button></div>
    <div style="font-size:11px;color:var(--t3);margin-bottom:10px">Account: <strong>${esc(accountId)}</strong></div>
    <div class="fg"><label class="lb">Store *</label><select class="inp" id="sa-store">${storeOpts}</select></div>
    <div class="fg"><label class="lb">Department</label><select class="inp" id="sa-dept">${deptOpts}</select></div>
    <div class="fg"><label class="lb">Position *</label><select class="inp" id="sa-pos">${posOpts}</select></div>
    <div class="fg"><label class="lb"><input type="checkbox" id="sa-primary"> Primary store</label></div>
    <div class="error-msg" id="sa-error"></div>
    <div class="popup-actions"><button class="btn btn-outline" onclick="App.closeDialog()">Cancel</button><button class="btn btn-primary" onclick="AdminV2.submitAddAssignment('${esc(accountId)}')">Save</button></div>
  </div>`);
}

async function submitAddAssignment(accountId) {
  const store_id = document.getElementById('sa-store')?.value;
  const dept_id = document.getElementById('sa-dept')?.value || '';
  const position_id = document.getElementById('sa-pos')?.value;
  const is_primary = document.getElementById('sa-primary')?.checked || false;
  if (!store_id || !position_id) { App.showError('sa-error', 'Store + Position required'); return; }
  App.showLoader();
  try {
    await API.adminSetStoreAssignment({ account_id: accountId, store_id, dept_id, position_id, is_primary });
    App.closeDialog();
    App.toast('Assignment saved', 'success');
    V2._assignLoaded = false;
    loadStaffAssignments();
  } catch (e) { App.showError('sa-error', e.message); }
  finally { App.hideLoader(); }
}

async function removeAssignment(accountId, storeId, deptId) {
  if (!confirm(`Remove ${accountId} from ${storeId}?`)) return;
  App.showLoader();
  try {
    await API.adminRemoveStoreAssignment({ account_id: accountId, store_id: storeId, dept_id: deptId });
    App.toast('Removed', 'success');
    V2._assignLoaded = false;
    loadStaffAssignments();
  } catch (e) { App.toast(e.message, 'error'); }
  finally { App.hideLoader(); }
}

// ════════════════════════════════
// TAB 4: INDIVIDUAL OVERRIDES (account_module_overrides)
// ════════════════════════════════
async function loadIndividualOverrides() {
  const ct = document.getElementById('admin-content');
  if (!ct) return;
  ct.innerHTML = `<div style="font-size:11px;color:var(--t3);margin-bottom:10px">Individual account-level permission overrides. Use the existing Tier Access tab or Account Detail to manage per-account overrides.</div>
    <button class="btn btn-outline btn-sm" onclick="App.go('admin',{tab:'tieraccess'})">Go to Tier Access Overrides</button>`;
}

// ════════════════════════════════
// TAB ROUTER — extends Admin.loadAdminTab
// ════════════════════════════════
const _origLoadTab = Admin.loadAdminTab;
const _origSaveTab = Admin.saveAdminTab;

Admin.loadAdminTab = function(tab) {
  switch (tab) {
    case 'base-permissions': loadBasePermissions(); break;
    case 'dept-overrides': loadDeptOverrides(); break;
    case 'staff-assignments': loadStaffAssignments(); break;
    case 'individual-overrides': loadIndividualOverrides(); break;
    default: _origLoadTab(tab); break;
  }
};

Admin.saveAdminTab = function(tab) {
  switch (tab) {
    case 'base-permissions': saveBasePermissions(); break;
    default: _origSaveTab(tab); break;
  }
};

// ═══ GLOBAL EXPORT ═══
window.AdminV2 = {
  loadBasePermissions, markBaseDirty, saveBasePermissions,
  loadDeptOverrides, showDeptDetail, markDeptDirty, saveDeptOverrides,
  loadStaffAssignments, showAddAssignment, submitAddAssignment, removeAssignment,
  loadIndividualOverrides, _saSearch,
};

})();
