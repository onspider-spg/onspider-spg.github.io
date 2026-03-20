/**
 * Version 1.3.1 | 17 MAR 2026 | Siam Palette Group
 * ═══════════════════════════════════════════
 * SPG App — Home Module
 * master_home.js — Master Data (Modules, Stores, Departments)
 * v1.3.1: Fix replace global for status options
 * v1.3: Read-only mode for non-super_admin (modules/stores/depts)
 * ═══════════════════════════════════════════
 */

(() => {
const esc = App.esc;

const M = {
  modules: null, _modLoaded: false, _modLoading: false, modDirty: {},
  stores: null, _stoLoaded: false, _stoLoading: false,
  depts: null, _depLoaded: false, _depLoading: false,
};

// ════════════════════════════════
// MODULES — inline edit + batch save
// ════════════════════════════════
async function loadModules() {
  if (M._modLoading) return;
  M._modLoading = true; M.modDirty = {};
  const ct = document.getElementById('master-content');
  if (!ct) { M._modLoading = false; return; }
  try {
    const data = await API.adminGetAllModules();
    M.modules = data.modules;
    M._modLoaded = true;
    renderModulesTable(ct);
  } catch (e) { App.toast(e.message, 'error'); }
  finally { M._modLoading = false; }
}

function renderModulesTable(ct) {
  const mods = App.sortData(M.modules || [], 'module_id', 'asc');
  const isSA = App.hasHomePerm('super_admin');
  const dis = isSA ? '' : ' disabled';
  const statusOpts = ['active', 'coming_soon', 'disabled'].map(s => `<option value="${s}">${s.replace(/_/g, ' ')}</option>`).join('');
  let rows = mods.map(m => {
    const selHtml = statusOpts.replace(`value="${m.status}"`, `value="${m.status}" selected`);
    return `<tr>
      <td style="font-weight:600;font-size:11px">${esc(m.module_id)}</td>
      <td><input class="fl" style="width:120px" value="${esc(m.module_name || '')}" onchange="Master.markModDirty('${esc(m.module_id)}','module_name',this.value)"${dis}></td>
      <td><input class="fl" style="width:120px" value="${esc(m.module_name_en || '')}" onchange="Master.markModDirty('${esc(m.module_id)}','module_name_en',this.value)"${dis}></td>
      <td><select class="fl" style="width:100px;font-size:10px" onchange="Master.markModDirty('${esc(m.module_id)}','status',this.value)"${dis}>${selHtml}</select></td>
      <td class="hide-m"><input class="fl" style="width:180px;font-size:10px" value="${esc(m.app_url || '')}" onchange="Master.markModDirty('${esc(m.module_id)}','app_url',this.value)"${dis}></td>
    </tr>`;
  }).join('');

  const hint = isSA ? 'Edit fields inline. Click Save when done.' : 'View only — requires Super Admin to edit.';
  ct.innerHTML = `
    <div style="font-size:11px;color:var(--t3);margin-bottom:10px">${hint}</div>
    <div class="card" style="padding:0;overflow-x:auto">
      <table class="tbl"><thead><tr><th>Module ID</th><th>Name TH</th><th>Name EN</th><th>Status</th><th class="hide-m">URL</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>
    <div id="mod-dirty-msg" style="font-size:11px;color:var(--orange);margin-top:8px;display:none">Unsaved changes</div>`;
}

function markModDirty(moduleId, field, value) {
  if (!M.modDirty[moduleId]) M.modDirty[moduleId] = {};
  M.modDirty[moduleId][field] = value;
  const msg = document.getElementById('mod-dirty-msg');
  if (msg) msg.style.display = 'block';
}

async function saveModules() {
  const keys = Object.keys(M.modDirty);
  if (keys.length === 0) { App.toast('No changes to save', 'info'); return; }
  App.showLoader();
  try {
    for (const module_id of keys) {
      await API.adminUpdateModule({ module_id, ...M.modDirty[module_id] });
    }
    // C4: merge dirty into cache → re-render (no re-fetch)
    if (M.modules) {
      for (const module_id of keys) {
        const mod = M.modules.find(m => m.module_id === module_id);
        if (mod) Object.assign(mod, M.modDirty[module_id]);
      }
    }
    M.modDirty = {};
    App.toast(`Saved ${keys.length} module(s)`, 'success');
    const ct = document.getElementById('master-content');
    if (ct) renderModulesTable(ct);
  } catch (e) { App.toast(e.message, 'error'); }
  finally { App.hideLoader(); }
}

// ════════════════════════════════
// STORES — table + popup create/edit
// ════════════════════════════════
async function loadStores() {
  if (M._stoLoading) return;
  M._stoLoading = true;
  const ct = document.getElementById('master-content');
  if (!ct) { M._stoLoading = false; return; }
  try {
    const data = await API.adminGetAllStores();
    M.stores = data.stores;
    M._stoLoaded = true;
    renderStoresTable(ct);
  } catch (e) { App.toast(e.message, 'error'); }
  finally { M._stoLoading = false; }
}

function renderStoresTable(ct) {
  const ST = App.getSortState('stores');
  const sorted = App.sortData(M.stores || [], ST ? ST.key : 'store_id', ST ? ST.dir : 'asc');
  const isSA = App.hasHomePerm('super_admin');
  let rows = '';
  if (sorted.length === 0) {
    rows = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--t3)">No stores</td></tr>';
  } else {
    rows = sorted.map(s => `<tr>
      <td style="font-weight:600;font-size:11px">${esc(s.store_id)}</td>
      <td>${esc(s.store_name)}</td>
      <td class="hide-m">${esc(s.store_name_th || '-')}</td>
      <td><span class="sts ${s.is_active ? 'sts-ok' : 'sts-err'}">${s.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>${isSA ? `<a class="lk" onclick="Master.showEditStore('${esc(s.store_id)}')">Edit</a>` : ''}</td>
    </tr>`).join('');
  }
  ct.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden">
      <table class="tbl"><thead><tr>${App.sortTh('stores','store_id','Store ID')}${App.sortTh('stores','store_name','Name')}${App.sortTh('stores','store_name_th','Name TH',' class="hide-m"')}${App.sortTh('stores','is_active','Status')}<th></th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
}

function showCreateStore() {
  App.showDialog(`<div class="popup-sheet">
    <div class="popup-header"><div class="popup-title">Add Store</div><button class="popup-close" onclick="App.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Store ID *</label><input class="inp" id="sto-id" placeholder="e.g. MC-MAC"></div>
    <div class="fg"><label class="lb">Store Name (EN) *</label><input class="inp" id="sto-name" placeholder="e.g. Mango Coco Macquarie"></div>
    <div class="fg"><label class="lb">Store Name (TH)</label><input class="inp" id="sto-name-th" placeholder="e.g. แมงโก้โคโค่ แม็คควอรี่"></div>
    <div class="fg"><label class="lb">Brand</label><input class="inp" id="sto-brand" placeholder="e.g. Mango Coco"></div>
    <div class="fg"><label class="lb">Location</label><input class="inp" id="sto-loc" placeholder="e.g. Macquarie Centre"></div>
    <div class="error-msg" id="sto-error"></div>
    <div class="popup-actions"><button class="btn btn-outline" onclick="App.closeDialog()">Cancel</button><button class="btn btn-primary" id="btn-sto-save" onclick="Master.doCreateStore()">Create</button></div>
  </div>`);
}

async function doCreateStore() {
  const store_id = document.getElementById('sto-id')?.value.trim();
  const store_name = document.getElementById('sto-name')?.value.trim();
  if (!store_id || !store_name) { App.showError('sto-error', 'Store ID and Name required'); return; }
  const btn = document.getElementById('btn-sto-save');
  btn.disabled = true; btn.textContent = 'Creating...';
  const newStore = { store_id, store_name, store_name_th: document.getElementById('sto-name-th')?.value.trim() || '', brand: document.getElementById('sto-brand')?.value.trim() || '', location: document.getElementById('sto-loc')?.value.trim() || '', is_active: true };
  try {
    await API.adminCreateStore(newStore);
    App.closeDialog();
    App.toast('Store created', 'success');
    // C3: push into cache → re-render (no re-fetch)
    if (M.stores) M.stores.push(newStore);
    App.clearStoresCache();
    const ct = document.getElementById('master-content');
    if (ct) renderStoresTable(ct);
  } catch (e) { App.showError('sto-error', e.message); btn.disabled = false; btn.textContent = 'Create'; }
}

function showEditStore(storeId) {
  const s = (M.stores || []).find(x => x.store_id === storeId);
  if (!s) return;
  App.showDialog(`<div class="popup-sheet">
    <div class="popup-header"><div class="popup-title">Edit Store: ${esc(s.store_id)}</div><button class="popup-close" onclick="App.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Store Name (EN)</label><input class="inp" id="sto-e-name" value="${esc(s.store_name || '')}"></div>
    <div class="fg"><label class="lb">Store Name (TH)</label><input class="inp" id="sto-e-name-th" value="${esc(s.store_name_th || '')}"></div>
    <div class="fg"><label class="lb">Brand</label><input class="inp" id="sto-e-brand" value="${esc(s.brand || '')}"></div>
    <div class="fg"><label class="lb">Location</label><input class="inp" id="sto-e-loc" value="${esc(s.location || '')}"></div>
    <div class="fg"><label class="lb">Status</label><select class="inp" id="sto-e-active"><option value="true"${s.is_active ? ' selected' : ''}>Active</option><option value="false"${!s.is_active ? ' selected' : ''}>Inactive</option></select></div>
    <div class="error-msg" id="sto-e-error"></div>
    <div class="popup-actions"><button class="btn btn-outline" onclick="App.closeDialog()">Cancel</button><button class="btn btn-primary" id="btn-sto-e-save" onclick="Master.doUpdateStore('${esc(s.store_id)}')">Save</button></div>
  </div>`);
}

async function doUpdateStore(storeId) {
  const btn = document.getElementById('btn-sto-e-save');
  btn.disabled = true; btn.textContent = 'Saving...';
  const updates = { store_id: storeId, store_name: document.getElementById('sto-e-name')?.value.trim(), store_name_th: document.getElementById('sto-e-name-th')?.value.trim(), brand: document.getElementById('sto-e-brand')?.value.trim(), location: document.getElementById('sto-e-loc')?.value.trim(), is_active: document.getElementById('sto-e-active')?.value === 'true' };
  try {
    await API.adminUpdateStore(updates);
    App.closeDialog();
    App.toast('Store updated', 'success');
    // C3: update cache → re-render (no re-fetch)
    const s = (M.stores || []).find(x => x.store_id === storeId);
    if (s) Object.assign(s, updates);
    App.clearStoresCache();
    const ct = document.getElementById('master-content');
    if (ct) renderStoresTable(ct);
  } catch (e) { App.showError('sto-e-error', e.message); btn.disabled = false; btn.textContent = 'Save'; }
}

// ════════════════════════════════
// DEPARTMENTS — table + popup create/edit
// ════════════════════════════════
async function loadDepts() {
  if (M._depLoading) return;
  M._depLoading = true;
  const ct = document.getElementById('master-content');
  if (!ct) { M._depLoading = false; return; }
  try {
    const data = await API.adminGetAllDepts();
    M.depts = data.departments;
    M._depLoaded = true;
    renderDeptsTable(ct);
  } catch (e) { App.toast(e.message, 'error'); }
  finally { M._depLoading = false; }
}

function renderDeptsTable(ct) {
  const ST = App.getSortState('depts');
  const sorted = App.sortData(M.depts || [], ST ? ST.key : 'dept_id', ST ? ST.dir : 'asc');
  const isSA = App.hasHomePerm('super_admin');
  let rows = '';
  if (sorted.length === 0) {
    rows = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--t3)">No departments</td></tr>';
  } else {
    rows = sorted.map(d => `<tr>
      <td style="font-weight:600;font-size:11px">${esc(d.dept_id)}</td>
      <td>${esc(d.dept_name)}</td>
      <td class="hide-m">${esc(d.dept_name_th || '-')}</td>
      <td><span class="sts ${d.is_active ? 'sts-ok' : 'sts-err'}">${d.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>${isSA ? `<a class="lk" onclick="Master.showEditDept('${esc(d.dept_id)}')">Edit</a>` : ''}</td>
    </tr>`).join('');
  }
  ct.innerHTML = `
    <div class="card" style="padding:0;overflow:hidden">
      <table class="tbl"><thead><tr>${App.sortTh('depts','dept_id','Dept ID')}${App.sortTh('depts','dept_name','Name (EN)')}${App.sortTh('depts','dept_name_th','Name (TH)',' class="hide-m"')}${App.sortTh('depts','is_active','Status')}<th></th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
}

function showCreateDept() {
  App.showDialog(`<div class="popup-sheet">
    <div class="popup-header"><div class="popup-title">Add Department</div><button class="popup-close" onclick="App.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Dept ID *</label><input class="inp" id="dep-id" placeholder="e.g. KITCHEN"></div>
    <div class="fg"><label class="lb">Dept Name (EN) *</label><input class="inp" id="dep-name" placeholder="e.g. Kitchen"></div>
    <div class="fg"><label class="lb">Dept Name (TH)</label><input class="inp" id="dep-name-th" placeholder="e.g. ครัว"></div>
    <div class="error-msg" id="dep-error"></div>
    <div class="popup-actions"><button class="btn btn-outline" onclick="App.closeDialog()">Cancel</button><button class="btn btn-primary" id="btn-dep-save" onclick="Master.doCreateDept()">Create</button></div>
  </div>`);
}

async function doCreateDept() {
  const dept_id = document.getElementById('dep-id')?.value.trim();
  const dept_name = document.getElementById('dep-name')?.value.trim();
  if (!dept_id || !dept_name) { App.showError('dep-error', 'Dept ID and Name required'); return; }
  const btn = document.getElementById('btn-dep-save');
  btn.disabled = true; btn.textContent = 'Creating...';
  const newDept = { dept_id, dept_name, dept_name_th: document.getElementById('dep-name-th')?.value.trim() || '', is_active: true };
  try {
    await API.adminCreateDept(newDept);
    App.closeDialog();
    App.toast('Department created', 'success');
    // C3: push into cache → re-render (no re-fetch)
    if (M.depts) M.depts.push(newDept);
    App.clearDeptsCache();
    const ct = document.getElementById('master-content');
    if (ct) renderDeptsTable(ct);
  } catch (e) { App.showError('dep-error', e.message); btn.disabled = false; btn.textContent = 'Create'; }
}

function showEditDept(deptId) {
  const d = (M.depts || []).find(x => x.dept_id === deptId);
  if (!d) return;
  App.showDialog(`<div class="popup-sheet">
    <div class="popup-header"><div class="popup-title">Edit Dept: ${esc(d.dept_id)}</div><button class="popup-close" onclick="App.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Dept Name (EN)</label><input class="inp" id="dep-e-name" value="${esc(d.dept_name || '')}"></div>
    <div class="fg"><label class="lb">Dept Name (TH)</label><input class="inp" id="dep-e-name-th" value="${esc(d.dept_name_th || '')}"></div>
    <div class="fg"><label class="lb">Status</label><select class="inp" id="dep-e-active"><option value="true"${d.is_active ? ' selected' : ''}>Active</option><option value="false"${!d.is_active ? ' selected' : ''}>Inactive</option></select></div>
    <div class="error-msg" id="dep-e-error"></div>
    <div class="popup-actions"><button class="btn btn-outline" onclick="App.closeDialog()">Cancel</button><button class="btn btn-primary" id="btn-dep-e-save" onclick="Master.doUpdateDept('${esc(d.dept_id)}')">Save</button></div>
  </div>`);
}

async function doUpdateDept(deptId) {
  const btn = document.getElementById('btn-dep-e-save');
  btn.disabled = true; btn.textContent = 'Saving...';
  const updates = { dept_id: deptId, dept_name: document.getElementById('dep-e-name')?.value.trim(), dept_name_th: document.getElementById('dep-e-name-th')?.value.trim(), is_active: document.getElementById('dep-e-active')?.value === 'true' };
  try {
    await API.adminUpdateDept(updates);
    App.closeDialog();
    App.toast('Department updated', 'success');
    // C3: update cache → re-render (no re-fetch)
    const d = (M.depts || []).find(x => x.dept_id === deptId);
    if (d) Object.assign(d, updates);
    App.clearDeptsCache();
    const ct = document.getElementById('master-content');
    if (ct) renderDeptsTable(ct);
  } catch (e) { App.showError('dep-e-error', e.message); btn.disabled = false; btn.textContent = 'Save'; }
}

// ═══ TAB LOADER ═══
function loadMasterTab(tab) {
  switch (tab) {
    case 'modules': loadModules(); break;
    case 'stores': loadStores(); break;
    case 'depts': loadDepts(); break;
  }
}
function saveMasterTab(tab) { if (tab === 'modules') saveModules(); }
function addMasterItem(tab) {
  if (tab === 'stores') showCreateStore();
  if (tab === 'depts') showCreateDept();
}

// ═══ D1: SORT EVENT LISTENER ═══
document.addEventListener('spg-sort', (e) => {
  const ct = document.getElementById('master-content');
  if (!ct) return;
  if (e.detail.tableId === 'stores' && M._stoLoaded) renderStoresTable(ct);
  if (e.detail.tableId === 'depts' && M._depLoaded) renderDeptsTable(ct);
});

// ═══ GLOBAL EXPORT ═══
window.Master = {
  loadMasterTab, saveMasterTab, addMasterItem,
  markModDirty, saveModules,
  showCreateStore, doCreateStore, showEditStore, doUpdateStore,
  showCreateDept, doCreateDept, showEditDept, doUpdateDept,
};

})();
