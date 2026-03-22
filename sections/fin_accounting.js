/**
 * SPG HUB v1.0.0 | 23 MAR 2026 | Siam Palette Group
 * sections/fin_accounting.js — Finance Module (Accounting Screens)
 * 10 routes: ac-coa, ac-coa-create, ac-coa-edit, ac-tax, ac-rules,
 *            ac-hub, ac-map, ac-linked, ac-loan, ac-journal
 *
 * Depends on: fin_core.js (FIN global)
 * Design: Purple #7c3aed accent, matches Home layout via SPG.shell/toolbar
 */

(() => {
const S = FIN.S;
const esc = FIN.esc;
const ui = SPG.ui;
const fm = FIN.fmtAud;
const fd = FIN.fmtDate;

const TW = 'max-width:1060px;margin:0 auto';

function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
}

// ── Local state ──
let _coaRows = [];
let _coaFilter = 'All';
let _coaSearch = '';
let _coaShowInactive = false;
let _editingCat = null;
let _taxRows = [];

// Tab filter options
const COA_TABS = ['All', 'Income', 'Expense', 'Asset Purchase', 'Transfer', 'Loan'];


// ══════════════════════════════════════════
// 1. COA LIST
// ══════════════════════════════════════════

function renderAcCoa() {
  _coaFilter = 'All';
  _coaSearch = '';
  _coaShowInactive = false;

  const actions = `<button class="btn-outline" onclick="SPG.go('finance/ac-linked')">Edit linked</button><button class="btn-primary" onclick="SPG.go('finance/ac-coa-create')">Create category</button>`;

  return SPG.shell(SPG.toolbar('Categories (Chart of Accounts)', actions) + `<div class="content" id="fin-ac-coa"><div style="${TW}">
    <div id="coa_tabs" style="display:flex;gap:8px;margin-bottom:10px;border-bottom:2px solid var(--bd2);padding-bottom:0;flex-wrap:wrap"></div>
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
      <input class="fl" id="coa_search" placeholder="Search..." style="width:180px;padding:6px 10px" oninput="FinanceSection.onCoaSearch(this.value)">
      <label style="font-size:var(--fs-xs);color:var(--t3);display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="coa_inactive" onchange="FinanceSection.toggleCoaInactive(this.checked)"> Show inactive</label>
      <div style="flex:1"></div>
      <a class="lk" style="font-size:var(--fs-xs);cursor:pointer" onclick="FinanceSection.resetCoaFilters()">Reset</a>
    </div>
    <div class="card" style="padding:0;overflow:hidden;margin:0">
      <div class="tbl-wrap"><table class="tbl" id="coa_tbl">
        <thead><tr>
          <th style="width:28px"><input type="checkbox" style="accent-color:var(--acc)" onclick="FinanceSection.toggleAllCoa(this.checked)"></th>
          ${ui.sortTh('coa_tbl', 'code', 'Code')}${ui.sortTh('coa_tbl', 'name', 'Name')}${ui.sortTh('coa_tbl', 'type', 'Type')}${ui.sortTh('coa_tbl', 'tax', 'Tax')}${ui.sortTh('coa_tbl', 'linked', 'Linked')}${ui.sortTh('coa_tbl', 'level', 'Level')}${ui.sortTh('coa_tbl', 'balance', 'Balance ($)')}
        </tr></thead>
        <tbody id="coa_tbody">${ui.skeleton(60, 8)}</tbody>
      </table></div>
    </div>
    <div id="coa_count" style="font-size:var(--fs-xs);color:var(--t3);margin-top:6px"></div>
  </div></div>`, 'Finance');
}

async function loadAcCoa() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    _buildCoaTabs();
    const result = await FIN.api('get_coa', {
      type_filter: _coaFilter,
      search: _coaSearch,
      show_inactive: _coaShowInactive,
    });
    _coaRows = result.rows || [];
    _renderCoaRows();
  } catch (e) {
    SPG.toast(e.message, 'error');
    const tbody = document.getElementById('coa_tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--red)">Error: ${esc(e.message)}</td></tr>`;
  }
}

function _buildCoaTabs() {
  const el = document.getElementById('coa_tabs');
  if (!el) return;
  el.innerHTML = COA_TABS.map(t =>
    `<div style="padding:6px 2px;font-size:var(--fs-sm);cursor:pointer;margin-bottom:-2px;${t === _coaFilter ? 'font-weight:600;color:var(--acc);border-bottom:2px solid var(--acc)' : 'color:var(--t3)'};margin-left:${t === 'All' ? '0' : '8px'}" onclick="FinanceSection.setCoaTab('${t}')">${esc(t === 'All' ? 'All categories' : t)}</div>`
  ).join('');
}

function _renderCoaRows() {
  const tbody = document.getElementById('coa_tbody');
  const countEl = document.getElementById('coa_count');
  if (!tbody) return;

  if (_coaRows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--t3)">No categories found</td></tr>';
    if (countEl) countEl.textContent = '0 categories';
    return;
  }

  let lastMain = '';
  let html = '';

  _coaRows.forEach(r => {
    const mainCat = r.main_category || r.transaction_type || 'Other';

    if (mainCat !== lastMain) {
      lastMain = mainCat;
      const groupTotal = _coaRows
        .filter(x => (x.main_category || x.transaction_type) === mainCat)
        .reduce((s, x) => s + (x.current_balance || 0), 0);
      html += `<tr class="sort-skip" style="background:var(--bg2)">
        <td></td>
        <td></td>
        <td style="font-weight:700;color:var(--acc);font-size:var(--fs-body)">${esc(mainCat)}</td>
        <td style="font-size:var(--fs-xs);color:var(--t3)">${esc(r.transaction_type)}</td>
        <td></td><td></td><td></td>
        <td style="text-align:right;font-weight:700">${fm(groupTotal)}</td>
      </tr>`;
    }

    const balColor = r.current_balance < 0 ? 'color:var(--red)' : '';
    const inactive = !r.is_active ? 'opacity:0.45' : '';
    const linked = r.is_linked ? `<span class="sts-warn" style="font-size:9px;padding:2px 6px;border-radius:4px">Linked</span>` : '';

    html += `<tr style="cursor:pointer;${inactive}" onclick="FinanceSection.editCategory('${r.id}')">
      <td onclick="event.stopPropagation()"><input type="checkbox" data-coa-id="${r.id}" style="accent-color:var(--acc)"></td>
      <td>${esc(r.account_code || '')}</td>
      <td style="padding-left:24px"><a class="lk">${esc(r.sub_category)}</a></td>
      <td style="font-size:var(--fs-xs)">${esc(r.transaction_type)}</td>
      <td>${esc(r.tax_code || '')}</td>
      <td>${linked}</td>
      <td style="font-size:var(--fs-xxs);color:var(--t3)">Level ${r.level || 2}</td>
      <td style="text-align:right;${balColor}">${fm(r.current_balance || 0)}</td>
    </tr>`;
  });

  tbody.innerHTML = html;
  if (countEl) countEl.textContent = `Showing ${_coaRows.length} categories`;
}

function setCoaTab(t) {
  _coaFilter = t;
  _reloadCoa();
}

function onCoaSearch(v) {
  _coaSearch = v;
  clearTimeout(onCoaSearch._t);
  onCoaSearch._t = setTimeout(() => _reloadCoa(), 300);
}

function toggleCoaInactive(checked) {
  _coaShowInactive = checked;
  _reloadCoa();
}

function resetCoaFilters() {
  _coaFilter = 'All';
  _coaSearch = '';
  _coaShowInactive = false;
  const se = document.getElementById('coa_search');
  const ie = document.getElementById('coa_inactive');
  if (se) se.value = '';
  if (ie) ie.checked = false;
  _reloadCoa();
}

async function _reloadCoa() {
  _buildCoaTabs();
  try {
    const result = await FIN.api('get_coa', {
      type_filter: _coaFilter,
      search: _coaSearch,
      show_inactive: _coaShowInactive,
    });
    _coaRows = result.rows || [];
    _renderCoaRows();
  } catch (e) {
    const tbody = document.getElementById('coa_tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--red)">Error: ${esc(e.message)}</td></tr>`;
  }
}

function toggleAllCoa(checked) {
  document.querySelectorAll('[data-coa-id]').forEach(cb => { cb.checked = checked; });
}

function editCategory(id) {
  _editingCat = _coaRows.find(r => r.id === id) || null;
  if (_editingCat) SPG.go('finance/ac-coa-edit');
}

function goLinked() {
  SPG.go('finance/ac-linked');
}


// ══════════════════════════════════════════
// 2. CREATE CATEGORY
// ══════════════════════════════════════════

function renderAcCoaCreate() {
  const actions = `<button class="btn-outline" onclick="SPG.go('finance/ac-coa')">← Categories</button>`;
  return SPG.shell(SPG.toolbar('Create category', actions) + `<div class="content" id="fin-ac-coa-create">${_categoryForm(null)}</div>`, 'Finance');
}

async function loadAcCoaCreate() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    _onCatFormLoad();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}


// ══════════════════════════════════════════
// 3. EDIT CATEGORY
// ══════════════════════════════════════════

function renderAcCoaEdit() {
  const cat = _editingCat;
  const actions = `<button class="btn-outline" onclick="SPG.go('finance/ac-coa')">← Categories</button>`;

  if (!cat) {
    return SPG.shell(SPG.toolbar('Edit category', actions) + `<div class="content" id="fin-ac-coa-edit"><div style="padding:40px;text-align:center;color:var(--t3)">No category selected. <a class="lk" onclick="SPG.go('finance/ac-coa')">Go back</a></div></div>`, 'Finance');
  }
  return SPG.shell(SPG.toolbar('Edit category', actions) + `<div class="content" id="fin-ac-coa-edit">${_categoryForm(cat)}</div>`, 'Finance');
}

async function loadAcCoaEdit() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    _onCatFormLoad();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

// ── Shared form for Create + Edit ──
function _categoryForm(cat) {
  const isEdit = !!cat;
  const c = cat || {};

  const TX_TYPES = ['Income', 'Expense', 'Asset Purchase', 'Transfer', 'Loan'];
  const txTypeOpts = TX_TYPES.map(t =>
    `<option value="${t}"${t === c.transaction_type ? ' selected' : ''}>${t}</option>`
  ).join('');

  const taxCodes = S.taxCodes || [];
  const tcOpts = taxCodes.map(t =>
    `<option value="${t.code}"${t.code === (c.tax_code || '') ? ' selected' : ''}>${t.code}</option>`
  ).join('');

  const infoBar = isEdit ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg3);border-radius:var(--rd);margin-bottom:14px"><div><div style="font-size:var(--fs-xs);font-weight:600">Main Category</div><div style="font-size:var(--fs-xs);color:var(--t3)">${esc(c.main_category || '—')}</div></div><div style="text-align:right"><div style="font-size:var(--fs-xs);font-weight:600">Current balance</div><div style="font-size:var(--fs-h1);font-weight:700">${fm(c.current_balance || 0)}</div></div></div>` : '';

  const frow = (label, req, content) =>
    `<div style="display:flex;align-items:center;margin-bottom:10px"><div style="width:150px;text-align:right;padding-right:14px;font-size:var(--fs-sm);color:var(--t2)">${label}${req ? ' <span style="color:var(--acc)">*</span>' : ''}</div><div style="max-width:340px;flex:1">${content}</div></div>`;

  let html = `<div class="card" style="max-width:660px;margin:0 auto">
    ${infoBar}
    <div style="font-size:var(--fs-body);font-weight:700;margin-bottom:2px">Category details</div>
    <div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:14px">Transaction Type → Main Category → Account Name (Sub Category)</div>

    ${frow('Transaction Type', true, `<select class="inp" id="cat_txtype" onchange="FinanceSection.onTxTypeChange(this.value)"><option value="">Select an option</option>${txTypeOpts}</select>`)}
    ${frow('Main Category', true, `<select class="inp" id="cat_main"><option value="">Select an option</option></select>`)}
    ${frow('Account Name', true, `<input class="inp" id="cat_name" value="${esc(c.sub_category || '')}" placeholder="e.g. Packaging, Rent, Electricity">`)}
    ${frow('Account Code', false, `<input class="inp" id="cat_code" value="${esc(c.account_code || '')}" placeholder="e.g. 27010 (optional)" style="max-width:140px">`)}
    ${frow('Tax code', true, `<select class="inp" id="cat_tax" style="max-width:100px"><option value=""></option>${tcOpts}</select>`)}
    ${frow('Opening balance ($)', false, `<input class="inp" id="cat_balance" value="${(c.current_balance || 0).toFixed(2)}" style="text-align:right">`)}

    <div style="display:flex;align-items:flex-start;margin-bottom:10px">
      <div style="width:150px;text-align:right;padding-right:14px;font-size:var(--fs-sm);color:var(--t2);padding-top:6px">Notes</div>
      <div style="max-width:340px;flex:1"><textarea class="inp" id="cat_notes" style="min-height:50px;resize:vertical">${esc(c.notes || '')}</textarea></div>
    </div>`;

  if (isEdit) {
    html += `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:10px;border-top:1px solid var(--bd2)">
      <button class="btn-danger" onclick="FinanceSection.deleteCat('${c.id}')">Delete</button>
      <div style="display:flex;gap:6px">
        <button class="btn-outline" onclick="SPG.go('finance/ac-coa')">Cancel</button>
        <button class="btn-outline" onclick="FinanceSection.toggleActive('${c.id}', ${!c.is_active})">${c.is_active ? 'Mark as inactive' : 'Mark as active'}</button>
        <button class="btn-primary" id="cat_save_btn" onclick="FinanceSection.saveCat('${c.id}', this)">Save</button>
      </div>
    </div>`;
  } else {
    html += `<div style="display:flex;justify-content:flex-end;gap:6px;margin-top:14px;padding-top:10px;border-top:1px solid var(--bd2)">
      <button class="btn-outline" onclick="SPG.go('finance/ac-coa')">Cancel</button>
      <button class="btn-primary" id="cat_save_btn" onclick="FinanceSection.saveCat(null, this)">Save</button>
    </div>`;
  }

  html += '</div>';
  return html;
}

function _onCatFormLoad() {
  if (_coaRows.length === 0) {
    FIN.api('get_coa', { show_inactive: false }).then(res => {
      _coaRows = res.rows || [];
      _populateMainCategories();
    });
  } else {
    _populateMainCategories();
  }
}

function onTxTypeChange(val) {
  _populateMainCategories();
}

function _populateMainCategories() {
  const sel = document.getElementById('cat_main');
  if (!sel) return;
  const txTypeEl = document.getElementById('cat_txtype');
  const selectedTxType = txTypeEl ? txTypeEl.value : '';

  const seen = new Set();
  const mains = [];
  _coaRows.forEach(r => {
    if (selectedTxType && r.transaction_type !== selectedTxType) return;
    if (r.main_category && !seen.has(r.main_category)) {
      seen.add(r.main_category);
      mains.push(r.main_category);
    }
  });

  const editMain = _editingCat ? _editingCat.main_category : '';
  let opts = '<option value="">Select or type new...</option>';
  mains.forEach(m => {
    const selected = m === editMain ? ' selected' : '';
    opts += `<option value="${esc(m)}"${selected}>${esc(m)}</option>`;
  });
  if (editMain && !seen.has(editMain)) {
    opts += `<option value="${esc(editMain)}" selected>${esc(editMain)}</option>`;
  }

  sel.innerHTML = opts;
}

async function saveCat(id, btnEl) {
  if (!btnEl || btnEl.disabled) return;
  const origText = btnEl.textContent;
  btnEl.disabled = true;
  btnEl.textContent = 'Saving...';

  try {
    const transaction_type = document.getElementById('cat_txtype')?.value || '';
    const main_category = document.getElementById('cat_main')?.value || '';
    const sub_category = document.getElementById('cat_name')?.value?.trim() || '';
    const account_code = document.getElementById('cat_code')?.value?.trim() || '';
    const tax_code = document.getElementById('cat_tax')?.value || 'FRE';
    const current_balance = parseFloat(document.getElementById('cat_balance')?.value) || 0;

    if (!transaction_type) { SPG.toast('Transaction Type is required', 'error'); return; }
    if (!main_category) { SPG.toast('Main Category is required', 'error'); return; }
    if (!sub_category) { SPG.toast('Account Name is required', 'error'); return; }

    const data = {
      transaction_type,
      main_category,
      sub_category,
      account_code: account_code || null,
      tax_code,
      current_balance,
    };

    if (id) {
      data.id = id;
      if (_editingCat) data.expected_updated_at = _editingCat.updated_at;
      await FIN.api('update_category', data);
      SPG.toast('Category updated', 'success');
    } else {
      await FIN.api('create_category', data);
      SPG.toast('Category created', 'success');
    }
    SPG.go('finance/ac-coa');
  } catch (e) {
    SPG.toast(e.message || 'Save failed', 'error');
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = origText;
  }
}

async function toggleActive(id, newActive) {
  try {
    await FIN.api('update_category', { id, is_active: newActive });
    SPG.toast(newActive ? 'Category activated' : 'Category deactivated', 'success');
    SPG.go('finance/ac-coa');
  } catch (e) {
    SPG.toast(e.message || 'Update failed', 'error');
  }
}

function deleteCat(id) {
  SPG.showDialog(`<div class="popup-sheet"><div class="popup-sheet-header"><div class="popup-sheet-title">Delete Category</div></div><div class="popup-sheet-body"><p>Delete this category permanently? If it's used in transactions, it will be marked as inactive instead.</p></div><div class="popup-sheet-footer"><button class="btn-outline" onclick="SPG.closeDialog()">Cancel</button><button class="btn-danger" onclick="FinanceSection.confirmDeleteCat('${id}')">Delete</button></div></div>`);
}

async function confirmDeleteCat(id) {
  SPG.closeDialog();
  try {
    await FIN.api('delete_category', { id, hard: true });
    SPG.toast('Category deleted', 'success');
    SPG.go('finance/ac-coa');
  } catch (e) {
    if (e.message && e.message.includes('IN_USE')) {
      try {
        await FIN.api('delete_category', { id, hard: false });
        SPG.toast('Category marked as inactive (in use)', 'success');
        SPG.go('finance/ac-coa');
      } catch (e2) {
        SPG.toast(e2.message || 'Delete failed', 'error');
      }
    } else {
      SPG.toast(e.message || 'Delete failed', 'error');
    }
  }
}


// ══════════════════════════════════════════
// 4. TAX CODES
// ══════════════════════════════════════════

function renderAcTax() {
  return SPG.shell(SPG.toolbar('Tax Codes', '') + `<div class="content" id="fin-ac-tax"><div class="card" style="max-width:700px;margin:0 auto">
    <div class="tbl-wrap"><table class="tbl" id="tax_tbl">
      <thead><tr>${ui.sortTh('tax_tbl', 'code', 'Code')}${ui.sortTh('tax_tbl', 'name', 'Name')}${ui.sortTh('tax_tbl', 'rate', 'Rate')}${ui.sortTh('tax_tbl', 'desc', 'Description')}${ui.sortTh('tax_tbl', 'status', 'Status')}<th style="width:60px"></th></tr></thead>
      <tbody id="tax_tbody">${ui.skeleton(60, 6)}</tbody>
    </table></div>
  </div></div>`, 'Finance');
}

async function loadAcTax() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    _taxRows = await FIN.api('get_tax_codes', {});
    _renderTaxRows();
  } catch (e) {
    SPG.toast(e.message, 'error');
    const tbody = document.getElementById('tax_tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--red)">Error: ${esc(e.message)}</td></tr>`;
  }
}

function _renderTaxRows() {
  const tbody = document.getElementById('tax_tbody');
  if (!tbody) return;

  if (!_taxRows || _taxRows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--t3)">No tax codes found</td></tr>';
    return;
  }

  tbody.innerHTML = _taxRows.map(r => `<tr>
    <td style="font-weight:700">${esc(r.code)}</td>
    <td>${esc(r.name)}</td>
    <td style="text-align:right">${Number(r.rate)}%</td>
    <td style="font-size:var(--fs-xxs);color:var(--t3)">${esc(r.description || '')}</td>
    <td>${ui.badge(r.is_active !== false ? 'Active' : 'Inactive')}</td>
    <td><button class="btn-outline" style="color:var(--acc);font-size:var(--fs-xs);padding:4px 8px" onclick="FinanceSection.editTax('${r.id || r.code}')">Edit</button></td>
  </tr>`).join('');
}

function editTax(idOrCode) {
  const row = _taxRows.find(r => r.id === idOrCode || r.code === idOrCode);
  if (!row) return;

  SPG.showDialog(`<div class="popup-sheet" style="width:420px"><div class="popup-sheet-header"><div class="popup-sheet-title">Edit Tax Code: ${esc(row.code || '')}</div></div><div class="popup-sheet-body">
    <div class="fg"><label class="lb">Name</label><input class="inp" id="dlg_tax_name" value="${esc(row.name || '')}"></div>
    <div class="fg"><label class="lb">Rate (%)</label><input class="inp" id="dlg_tax_rate" type="number" step="0.1" value="${row.rate || 0}" style="max-width:100px"></div>
    <div class="fg"><label class="lb">Description</label><input class="inp" id="dlg_tax_desc" value="${esc(row.description || '')}"></div>
  </div><div class="popup-sheet-footer"><button class="btn-outline" onclick="SPG.closeDialog()">Cancel</button><button class="btn-primary" onclick="FinanceSection.saveTax('${esc(row.id)}','${esc(row.code)}')">Save</button></div></div>`);
}

async function saveTax(id, code) {
  const name = document.getElementById('dlg_tax_name')?.value?.trim();
  const rate = parseFloat(document.getElementById('dlg_tax_rate')?.value) || 0;
  const description = document.getElementById('dlg_tax_desc')?.value?.trim() || '';
  SPG.closeDialog();
  try {
    await FIN.api('update_tax_code', { id, code, name, rate, description });
    SPG.toast('Tax code updated', 'success');
    _taxRows = await FIN.api('get_tax_codes', {});
    _renderTaxRows();
  } catch (e) {
    SPG.toast(e.message || 'Update failed', 'error');
  }
}


// ══════════════════════════════════════════
// 5. BANK RULES (ac-rules)
// ══════════════════════════════════════════

let _brRows = [];
let _brStats = {};
let _brTypeFilter = 'all';
let _brBankFilter = '';
let _brSearch = '';
let _brShowInactive = false;
let _brEditing = null;
let _brSaving = false;

function renderAcRules() {
  _brTypeFilter = 'all';
  _brBankFilter = '';
  _brSearch = '';
  _brShowInactive = false;

  const actions = `<div style="position:relative;display:inline-block" id="br_cr_wrap"><button class="btn-primary" onclick="FinanceSection.brToggleMenu()" style="display:flex;align-items:center;gap:4px">+ Create Rule <span style="font-size:10px">▾</span></button><div class="br-cr-menu" id="br_cr_menu"><div class="br-cr-item" onclick="FinanceSection.brOpenModal('receive')"><span class="br-tt br-tt-recv">IN</span> Receive money</div><div class="br-cr-item" onclick="FinanceSection.brOpenModal('spend')"><span class="br-tt br-tt-spend">OUT</span> Spend money</div><div class="br-cr-item" onclick="FinanceSection.brOpenModal('bill')"><span class="br-tt br-tt-bill">BILL</span> Bill / Invoice</div></div></div>`;

  return SPG.shell(SPG.toolbar('Bank Rules', actions) + `<div class="content" id="fin-ac-rules"><div style="max-width:1100px;margin:0 auto">
    <div class="br-info" style="font-size:var(--fs-xs);color:var(--t2);padding:10px 14px;background:var(--bg2);border-radius:var(--rd);margin-bottom:12px">💡 <b>Bank Rules</b> — When bank statement comes in, its description may not match vendor names. Bank Rules tell the system: "if you see this keyword → match to this contact + category" for automatic reconciliation.</div>
    <div class="br-stats" id="br_stats" style="display:flex;gap:16px;margin-bottom:12px;font-size:var(--fs-xs)"></div>
    <div class="fl-bar" style="margin-bottom:10px">
      <div class="fg"><div class="fl-label">Transaction Type</div><select class="fl" style="width:140px" id="br_ftype" onchange="FinanceSection.brSetFilter('type',this.value)"><option value="all">All</option><option value="receive">Receive money</option><option value="spend">Spend money</option><option value="bill">Bill</option></select></div>
      <div class="fg"><div class="fl-label">Bank Account</div><select class="fl" style="width:180px" id="br_fbank" onchange="FinanceSection.brSetFilter('bank',this.value)"><option value="">All accounts</option></select></div>
      <div class="fg"><div class="fl-label">Search</div><input class="fl" placeholder="Search rule name..." style="width:160px" id="br_search" oninput="FinanceSection.brSetFilter('search',this.value)"></div>
      <div class="fg" style="align-self:flex-end"><label style="font-size:var(--fs-xxs);color:var(--t3);display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="br_inactive" onchange="FinanceSection.brSetFilter('inactive',this.checked)"> Show inactive</label></div>
      <div style="flex:1"></div>
      <button class="btn-outline" style="color:var(--acc)" onclick="FinanceSection.brResetFilters()">Reset</button>
    </div>
    <div class="card" style="padding:0;overflow:hidden"><div class="tbl-wrap"><table class="tbl" id="br_tbl"><thead><tr>${ui.sortTh('br_tbl', 'rule', 'Rule Name')}${ui.sortTh('br_tbl', 'bank', 'Bank Account')}${ui.sortTh('br_tbl', 'type', 'Type')}${ui.sortTh('br_tbl', 'contact', 'Contact')}${ui.sortTh('br_tbl', 'main', 'Main Category')}${ui.sortTh('br_tbl', 'sub', 'Sub Category')}<th style="width:8%">Active</th><th style="width:5%"></th></tr></thead><tbody id="br_tbody">${ui.skeleton(60, 8)}</tbody></table></div></div>
    <div id="br_count" style="font-size:var(--fs-xxs);color:var(--t3);display:flex;gap:12px;align-items:center;margin-top:8px"></div>
  </div></div>`, 'Finance');
}

async function loadAcRules() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _brLoad();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

async function _brLoad() {
  const bankSel = document.getElementById('br_fbank');
  if (bankSel && S.bankAccounts) {
    let opts = '<option value="">All accounts</option>';
    S.bankAccounts.forEach(b => { opts += `<option value="${b.id}">${esc(b.label)}</option>`; });
    bankSel.innerHTML = opts;
  }

  try {
    const result = await FIN.api('get_bank_rules', {
      type_filter: _brTypeFilter,
      bank_account_id: _brBankFilter || null,
      search: _brSearch,
      show_inactive: _brShowInactive,
    });
    _brRows = result.rows || [];
    _brStats = result.stats || {};
    _brRenderStats();
    _brRenderRows();
  } catch (e) {
    const tbody = document.getElementById('br_tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--red)">Error: ${esc(e.message)}</td></tr>`;
  }
}

function _brRenderStats() {
  const el = document.getElementById('br_stats');
  if (!el) return;
  const s = _brStats;
  el.innerHTML = `<div><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--green);margin-right:4px"></span> <b>${s.active_count || 0}</b> active rules</div><div><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--blue);margin-right:4px"></span> <b>${s.receive_count || 0}</b> receive money</div><div><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--red);margin-right:4px"></span> <b>${s.spend_count || 0}</b> spend money</div><div><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--orange);margin-right:4px"></span> <b>${s.bill_count || 0}</b> bill</div><div style="color:var(--t4)"><b>${s.inactive_count || 0}</b> inactive</div>`;
}

function _brRenderRows() {
  const tbody = document.getElementById('br_tbody');
  const countEl = document.getElementById('br_count');
  if (!tbody) return;

  if (_brRows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--t3)">No rules found. Create your first rule above.</td></tr>';
    if (countEl) countEl.textContent = '';
    return;
  }

  const bankMap = {};
  (S.bankAccounts || []).forEach(b => { bankMap[b.id] = b.label; });

  tbody.innerHTML = _brRows.map(r => {
    const typeCls = r.transaction_type === 'receive' ? 'br-tt-recv' : r.transaction_type === 'spend' ? 'br-tt-spend' : 'br-tt-bill';
    const typeLabel = r.transaction_type === 'receive' ? 'Receive money' : r.transaction_type === 'spend' ? 'Spend money' : 'Bill';
    const bankLabel = r.bank_account_id ? (bankMap[r.bank_account_id] || '—') : 'All accounts';
    const inactive = !r.is_active ? ' br-inactive' : '';
    const kws = (r.keywords || []).map(k => `<span class="br-kw" style="display:inline-block;padding:1px 6px;font-size:var(--fs-xxs);background:var(--bg3);border-radius:3px;margin:1px 2px">${esc(k)}</span>`).join('');
    return `<tr class="${inactive}" onclick="FinanceSection.brOpenModal('${r.transaction_type}','edit','${r.id}')">
      <td><div style="font-weight:600">${esc(r.rule_name)}</div><div style="margin-top:2px">${kws}</div></td>
      <td style="font-size:var(--fs-xs)">${esc(bankLabel)}</td>
      <td><span class="br-tt ${typeCls}" style="font-size:9px;font-weight:600;padding:2px 8px;border-radius:3px">${typeLabel}</span></td>
      <td style="font-size:var(--fs-xs);font-weight:${r.vendor_name ? '500' : '400'}">${esc(r.vendor_name || '—')}</td>
      <td style="font-size:var(--fs-xxs);color:var(--t2)">${esc(r.main_category || '')}</td>
      <td style="font-size:var(--fs-xxs);color:var(--t2)">${esc(r.sub_category || '')}</td>
      <td onclick="event.stopPropagation()"><label class="br-tgl"><input type="checkbox" ${r.is_active ? 'checked' : ''} onchange="FinanceSection.brToggleActive('${r.id}',this.checked)"><span class="br-sl"></span></label></td>
      <td><button class="btn-outline" style="font-size:14px;padding:2px 6px" title="Edit">✎</button></td>
    </tr>`;
  }).join('');

  if (countEl) countEl.innerHTML = `<span>Showing ${_brRows.length} rules</span>`;
}

function brSetFilter(key, val) {
  if (key === 'type') _brTypeFilter = val;
  else if (key === 'bank') _brBankFilter = val;
  else if (key === 'search') { _brSearch = val; clearTimeout(brSetFilter._t); brSetFilter._t = setTimeout(() => _brLoad(), 300); return; }
  else if (key === 'inactive') _brShowInactive = val;
  _brLoad();
}

function brResetFilters() {
  _brTypeFilter = 'all'; _brBankFilter = ''; _brSearch = ''; _brShowInactive = false;
  const ft = document.getElementById('br_ftype'); if (ft) ft.value = 'all';
  const fb = document.getElementById('br_fbank'); if (fb) fb.value = '';
  const fs = document.getElementById('br_search'); if (fs) fs.value = '';
  const fi = document.getElementById('br_inactive'); if (fi) fi.checked = false;
  _brLoad();
}

async function brToggleActive(id, checked) {
  try {
    await FIN.api('update_bank_rule', { id, is_active: checked });
  } catch (e) {
    SPG.toast(e.message || 'Update failed', 'error');
    _brLoad();
  }
}

function brToggleMenu() {
  const m = document.getElementById('br_cr_menu');
  if (m) m.classList.toggle('open');
}

function brOpenModal(type, mode, ruleId) {
  const menu = document.getElementById('br_cr_menu');
  if (menu) menu.classList.remove('open');

  _brEditing = null;
  if (mode === 'edit' && ruleId) {
    _brEditing = _brRows.find(r => r.id === ruleId) || null;
  }

  let ov = document.getElementById('br_modal_ov');
  if (ov) ov.remove();

  const isEdit = !!_brEditing;
  const r = _brEditing || {};
  const editType = isEdit ? r.transaction_type : type;
  const title = isEdit ? 'Edit Bank Rule' : ('Create Bank Rule — ' + (type === 'receive' ? 'Receive Money' : type === 'spend' ? 'Spend Money' : 'Bill'));

  let bankOpts = '<option value="">All bank accounts</option>';
  (S.bankAccounts || []).forEach(b => {
    bankOpts += `<option value="${b.id}" ${b.id === r.bank_account_id ? 'selected' : ''}>${esc(b.label)}</option>`;
  });

  let vendorOpts = '<option value="">— Select —</option>';
  (S.vendors || []).forEach(v => {
    vendorOpts += `<option value="${v.id}" ${v.id === r.vendor_id ? 'selected' : ''}>${esc(v.name)}</option>`;
  });

  const mainSet = new Set();
  (S.categories || []).forEach(c => { if (c.main_category) mainSet.add(c.main_category); });
  let mainOpts = '<option value="">— Select —</option>';
  [...mainSet].sort().forEach(m => {
    mainOpts += `<option value="${esc(m)}" ${m === r.main_category ? 'selected' : ''}>${esc(m)}</option>`;
  });

  const kwStr = (r.keywords || []).join(', ');

  ov = document.createElement('div');
  ov.className = 'br-modal-ov open';
  ov.id = 'br_modal_ov';
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `<div class="br-modal">
    <div class="br-mh"><div class="br-mt">${esc(title)}</div><button class="br-mx" onclick="document.getElementById('br_modal_ov').remove()">✕</button></div>
    <div class="br-mb">
      <div class="br-fs"><div class="br-fst">Rule Details</div>
        <div class="br-fr"><div class="fg" style="flex:1"><label>Transaction Type *</label><select class="fl" id="brm_type" style="width:100%"><option value="receive" ${editType==='receive'?'selected':''}>Receive money</option><option value="spend" ${editType==='spend'?'selected':''}>Spend money</option><option value="bill" ${editType==='bill'?'selected':''}>Bill</option></select></div><div class="fg" style="flex:2"><label>Rule Name *</label><input class="fl" id="brm_name" value="${esc(r.rule_name || '')}" placeholder="e.g. PRO BROS, UBER EATS" style="width:100%"></div></div>
        <div class="br-fr"><div class="fg"><label>Applies to</label><select class="fl" id="brm_bank" style="width:100%">${bankOpts}</select></div></div>
      </div>
      <div class="br-fs"><div class="br-fst">Keywords (comma-separated)</div>
        <input class="fl" id="brm_keywords" value="${esc(kwStr)}" placeholder="e.g. PRO BROS, PRO BRO" style="width:100%">
        <div style="font-size:var(--fs-xxs);color:var(--t3);margin-top:4px">Keywords that appear in bank statement description, separated by comma (match = at least 1 keyword)</div>
      </div>
      <div class="br-fs"><div class="br-fst">Then auto-fill with</div>
        <div class="br-fr"><div class="fg"><label>Contact / Supplier</label><select class="fl" id="brm_vendor" style="width:100%" onchange="FinanceSection.brOnVendorChange()">${vendorOpts}</select></div><div class="fg"><label>Main Category</label><select class="fl" id="brm_main" style="width:100%" onchange="FinanceSection.brUpdateSubCats()">${mainOpts}</select></div><div class="fg"><label>Sub Category</label><select class="fl" id="brm_sub" style="width:100%"><option value="">— Select main first —</option></select></div></div>
      </div>
    </div>
    <div class="br-mf">
      <button class="btn-outline" onclick="document.getElementById('br_modal_ov').remove()">Cancel</button>
      ${isEdit ? `<button class="btn-danger" onclick="FinanceSection.brDelete('${r.id}')">Delete Rule</button>` : ''}
      <button class="btn-primary" id="brm_save" onclick="FinanceSection.brSave()">${isEdit ? 'Save Changes' : 'Create Rule'}</button>
    </div>
  </div>`;

  document.body.appendChild(ov);

  if (r.main_category) {
    requestAnimationFrame(() => brUpdateSubCats(r.sub_category));
  }

  if (!S._masterReady) {
    FIN.waitMaster().then(() => {
      const vSel = document.getElementById('brm_vendor');
      if (vSel && S.vendors) {
        let opts2 = '<option value="">— Select —</option>';
        S.vendors.forEach(v => { opts2 += `<option value="${v.id}" ${v.id === r.vendor_id ? 'selected' : ''}>${esc(v.name)}</option>`; });
        vSel.innerHTML = opts2;
      }
    });
  }
}

function brOnVendorChange() {
  // No auto-fill needed — vendor name stored separately
}

function brUpdateSubCats(preselect) {
  const mainSel = document.getElementById('brm_main');
  const subSel = document.getElementById('brm_sub');
  if (!mainSel || !subSel) return;
  const mainVal = mainSel.value;
  const subs = (S.categories || []).filter(c => c.main_category === mainVal).map(c => c.sub_category).filter(Boolean);
  const unique = [...new Set(subs)];
  let opts = '<option value="">— Select —</option>';
  unique.forEach(s => { opts += `<option value="${esc(s)}" ${s === preselect ? 'selected' : ''}>${esc(s)}</option>`; });
  subSel.innerHTML = opts;
}

async function brSave() {
  if (_brSaving) return;
  const btn = document.getElementById('brm_save');
  const name = document.getElementById('brm_name')?.value?.trim();
  const kwRaw = document.getElementById('brm_keywords')?.value?.trim();

  if (!name) { SPG.toast('Rule Name is required', 'error'); return; }
  if (!kwRaw) { SPG.toast('At least 1 keyword is required', 'error'); return; }

  const keywords = kwRaw.split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
  if (keywords.length === 0) { SPG.toast('At least 1 keyword is required', 'error'); return; }

  _brSaving = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    const vendorSel = document.getElementById('brm_vendor');
    const vendorId = vendorSel?.value || null;
    const vendorName = vendorId ? vendorSel.options[vendorSel.selectedIndex]?.text : null;

    const data = {
      rule_name: name,
      keywords,
      transaction_type: document.getElementById('brm_type')?.value || 'spend',
      bank_account_id: document.getElementById('brm_bank')?.value || null,
      vendor_id: vendorId,
      vendor_name: vendorName,
      main_category: document.getElementById('brm_main')?.value || null,
      sub_category: document.getElementById('brm_sub')?.value || null,
    };

    if (_brEditing) {
      data.id = _brEditing.id;
      await FIN.api('update_bank_rule', data);
      SPG.toast('Rule updated', 'success');
    } else {
      await FIN.api('create_bank_rule', data);
      SPG.toast('Rule created', 'success');
    }

    document.getElementById('br_modal_ov')?.remove();
    _brLoad();
  } catch (e) {
    SPG.toast(e.message || 'Save failed', 'error');
  } finally {
    _brSaving = false;
    if (btn) { btn.disabled = false; btn.textContent = _brEditing ? 'Save Changes' : 'Create Rule'; }
  }
}

function brDelete(id) {
  SPG.showDialog(`<div class="popup-sheet"><div class="popup-sheet-header"><div class="popup-sheet-title">Delete Bank Rule</div></div><div class="popup-sheet-body"><p>Delete this rule permanently? This will not affect past reconciled transactions.</p></div><div class="popup-sheet-footer"><button class="btn-outline" onclick="SPG.closeDialog()">Cancel</button><button class="btn-danger" onclick="FinanceSection.confirmBrDelete('${id}')">Delete</button></div></div>`);
}

async function confirmBrDelete(id) {
  SPG.closeDialog();
  try {
    await FIN.api('delete_bank_rule', { id });
    SPG.toast('Rule deleted', 'success');
    document.getElementById('br_modal_ov')?.remove();
    _brLoad();
  } catch (e) {
    SPG.toast(e.message || 'Delete failed', 'error');
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('#br_cr_wrap')) {
    const m = document.getElementById('br_cr_menu');
    if (m) m.classList.remove('open');
  }
});


// ══════════════════════════════════════════
// 6. BANKING HUB (ac-hub)
// ══════════════════════════════════════════

let _hubAccounts = [];
let _hubBrandFilter = '';

function _hubBrandOpts() {
  const brands = S.brands || [];
  return '<option value="">All Brands</option>' + brands.map(b => `<option>${esc(b)}</option>`).join('');
}

function renderAcHub() {
  _hubBrandFilter = '';

  const actions = `<select class="fl" id="hub_brand" onchange="FinanceSection.hubSetBrand()" style="width:140px">${_hubBrandOpts()}</select><button class="btn-primary" onclick="SPG.go('finance/ac-coa-create')">+ Add Bank Account</button>`;

  return SPG.shell(SPG.toolbar('Banking Hub', actions) + `<div class="content" id="fin-ac-hub"><div style="max-width:1000px;margin:0 auto" id="hub_content"><div style="text-align:center;padding:40px;color:var(--t3)">${ui.skeleton(60, 1)}</div></div></div>`, 'Finance');
}

async function loadAcHub() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _hubLoad();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

function hubSetBrand() {
  _hubBrandFilter = document.getElementById('hub_brand')?.value || '';
  const el = document.getElementById('hub_content');
  if (el) _hubRender(el);
}

async function _hubLoad() {
  const el = document.getElementById('hub_content');
  if (!el) return;

  try {
    const result = await FIN.api('get_banking_hub', {});
    _hubAccounts = result.accounts || [];
    _hubRender(el);
  } catch (e) {
    el.innerHTML = `<div style="padding:20px;color:var(--red)">Error: ${esc(e.message)}</div>`;
  }
}

function _hubRender(el) {
  let accounts = _hubAccounts;
  if (_hubBrandFilter) {
    accounts = accounts.filter(a => (a.entity_name || '') === _hubBrandFilter);
  }

  if (accounts.length === 0) {
    el.innerHTML = _hubBrandFilter
      ? '<div style="padding:40px;text-align:center;color:var(--t3)">No bank accounts for this brand.</div>'
      : '<div style="padding:40px;text-align:center;color:var(--t3)">No bank accounts found. Add one in Categories (COA).</div>';
    return;
  }

  const active = accounts.filter(a => a.is_active !== false);
  const inactive = accounts.filter(a => a.is_active === false);

  let html = '';
  if (active.length > 0) {
    html += `<div style="font-size:var(--fs-sm);font-weight:600;margin-bottom:8px">Accounts${active.length > 0 ? ` (${active.length})` : ''}</div>`;
    html += active.map(a => _hubCard(a)).join('');
  }
  if (inactive.length > 0) {
    html += `<div style="font-size:var(--fs-sm);font-weight:600;margin:16px 0 8px">Inactive accounts</div>`;
    html += inactive.map(a => _hubCard(a, true)).join('');
  }

  el.innerHTML = html;
}

function _hubCard(a, dimmed) {
  const style = dimmed ? 'opacity:.6' : '';
  const diff = a.bank_balance != null ? (a.spg_balance - a.bank_balance) : null;
  const diffHtml = diff != null
    ? `<span style="color:${diff === 0 ? 'var(--green)' : 'var(--red)'};font-size:var(--fs-xs)">(${fm(diff)})</span>`
    : '';
  const bankBalHtml = a.bank_balance != null
    ? `<div style="font-size:var(--fs-kpi-md);font-weight:800">${fm(a.bank_balance)} ${diffHtml}</div><div style="font-size:var(--fs-xxs);color:var(--t3)">Bank updated ${a.bank_balance_date || '—'}</div>`
    : `<div style="font-size:var(--fs-kpi-md);font-weight:800;color:var(--t3)">N/A</div><div style="font-size:var(--fs-xxs);color:var(--t3)">No bank connection</div>`;

  return `<div class="card" style="display:flex;justify-content:space-between;align-items:center;${style}">
    <div>
      <div style="font-size:var(--fs-body);font-weight:700">${esc(a.label)}${!a.is_active ? ' <span class="sts-warn" style="font-size:9px;padding:2px 6px;border-radius:4px">Inactive</span>' : ''}</div>
      <div style="font-size:var(--fs-xxs);color:var(--t3)">${a.bsb ? 'BSB ' + esc(a.bsb) + ' · ' : ''}${a.account_number ? 'ACC ' + esc(a.account_number) : ''}</div>
      <div style="display:flex;gap:20px;margin-top:6px">
        <div><div style="font-size:var(--fs-kpi-md);font-weight:800">${fm(a.spg_balance)}</div><div style="font-size:var(--fs-xxs);color:var(--t3)">SPG balance</div></div>
        <div>${bankBalHtml}</div>
      </div>
    </div>
  </div>`;
}


// ══════════════════════════════════════════
// 7. BANK MAP (ac-map) — 2 Tabs
// ══════════════════════════════════════════

let _bmTab = 'mapping';
let _bmData = null;
let _bmBridgeSettings = [];
let _bmSaving = false;
let _bmBrandFilter = '';

function _bmTabs(active) {
  const tabs = [
    { id: 'mapping', label: 'Bank Mapping' },
    { id: 'channels', label: 'Bank Channel' },
  ];
  return '<div style="display:flex;gap:0;border-bottom:1px solid var(--bd);margin-bottom:16px">'
    + tabs.map(t => `<div class="pill${t.id === active ? ' active' : ''}" onclick="FinanceSection.bmSetTab('${t.id}')">${esc(t.label)}</div>`).join('')
    + '</div>';
}

function renderAcMap() {
  _bmTab = 'mapping';
  _bmBrandFilter = '';

  const actions = `<select class="fl" id="bm_brand" onchange="FinanceSection.bmSetBrand()" style="width:140px">${_hubBrandOpts()}</select><button class="btn-primary" id="bm_save_btn" onclick="FinanceSection.bmSave()">Save Changes</button>`;

  return SPG.shell(SPG.toolbar('Bank Mapping', actions) + `<div class="content" id="fin-ac-map"><div style="max-width:1100px;margin:0 auto" id="bm_wrap"><div id="bm_tabs">${_bmTabs('mapping')}</div><div id="bm_content"><div style="text-align:center;padding:40px;color:var(--t3)">${ui.skeleton(60, 1)}</div></div></div></div>`, 'Finance');
}

async function loadAcMap() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _bmLoad();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

function bmSetBrand() {
  _bmBrandFilter = document.getElementById('bm_brand')?.value || '';
  _bmLoad();
}

async function _bmLoad() {
  const tabsEl = document.getElementById('bm_tabs');
  if (tabsEl) tabsEl.innerHTML = _bmTabs(_bmTab);
  await _bmLoadMapping();
}

async function _bmLoadMapping() {
  const el = document.getElementById('bm_content');
  if (!el) return;
  try {
    _bmData = await FIN.api('get_bank_mapping', {});
    if (_bmTab === 'channels') _bmRenderChannels(el);
    else _bmRenderMapping(el);
  } catch (e) {
    el.innerHTML = `<div style="padding:20px;color:var(--red)">Error: ${esc(e.message)}</div>`;
  }
}

function _bmRenderMapping(el) {
  const d = _bmData;
  if (!d) return;
  const stores = d.stores || {};
  const storeBanks = d.storeBanks || {};
  const storeNames = d.storeNames || {};
  const stats = d.stats || {};

  let html = `<div style="display:flex;gap:24px;margin-bottom:16px;font-size:var(--fs-sm);color:var(--t2);align-items:center">
    <div><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--green);margin-right:4px"></span><span style="font-weight:700;font-size:14px">${stats.mapped || 0}</span> mapped</div>
    <div><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--orange);margin-right:4px"></span><span style="font-weight:700;font-size:14px;color:var(--orange)">${stats.unmapped || 0}</span> unmapped</div>
  </div>`;

  const storeIds = Object.keys(stores);
  if (storeIds.length === 0) {
    html += '<div style="padding:40px;text-align:center;color:var(--t3)">No channel mappings found. Channels are populated from Sale Daily module.</div>';
    el.innerHTML = html;
    return;
  }

  storeIds.forEach((sid, idx) => {
    const channels = stores[sid] || [];
    const myBanks = storeBanks[sid] || [];
    const storeName = storeNames[sid] || sid;
    const mappedCount = channels.filter(c => c.is_mapped).length;
    const allMapped = mappedCount === channels.length;
    const statusBadge = allMapped ? `${ui.badge('All mapped')}` : `${ui.badge(channels.length - mappedCount + ' unmapped')}`;
    const open = idx === 0 ? '' : ' style="display:none"';

    html += `<div style="border:1px solid var(--bd);border-radius:8px;margin-bottom:12px;overflow:hidden;background:#fff">
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--bg2);cursor:pointer" onclick="var b=document.getElementById('bm_s_${idx}');b.style.display=b.style.display==='none'?'':'none'">
        <span style="font-size:var(--fs-xs);color:var(--t3)">▾</span>
        <span style="font-size:var(--fs-body);font-weight:600">${esc(storeName)}</span>
        <span style="font-size:var(--fs-xxs);color:var(--t3);background:var(--bg3);padding:2px 8px;border-radius:3px">${esc(sid)}</span>
        <span style="flex:1"></span>
        <span style="font-size:var(--fs-xs);color:var(--t3)">${channels.length} mappings</span>
        ${statusBadge}
      </div>
      <div id="bm_s_${idx}"${open}>
        ${myBanks.length > 0 ? `<div style="padding:8px 16px;font-size:var(--fs-xxs);color:var(--t3);background:#fafafa;border-bottom:1px solid var(--bd2)">Bank accounts: ${myBanks.map(b => '<b>' + esc(b.account_label) + '</b>').join(', ')}</div>` : `<div style="padding:8px 16px;font-size:var(--fs-xxs);color:var(--orange);background:var(--orange-bg);border-bottom:1px solid var(--bd2)">No bank accounts found for this store</div>`}
        <table class="tbl" style="font-size:var(--fs-sm)"><thead><tr><th style="width:4%">#</th><th style="width:22%">Channel</th><th style="width:9%">Type</th><th style="width:8%">Dir</th><th style="width:30%">Bank Account</th><th style="width:18%">Category</th><th style="width:6%"></th></tr></thead><tbody>`;

    channels.forEach((c, ci) => {
      const typeCls = c.channel_type === 'revenue' ? 'background:var(--green-bg);color:var(--green)' : c.channel_type === 'expense' ? 'background:var(--red-bg);color:var(--red)' : 'background:var(--blue-bg);color:var(--blue)';
      const dirCls = c.direction === 'in' ? 'color:var(--green)' : c.direction === 'out' ? 'color:var(--red)' : 'color:var(--blue)';
      const warn = c.is_mapped ? '' : 'style="background:rgba(217,119,6,.04)"';
      const dot = c.is_mapped ? 'background:var(--green)' : 'background:var(--orange)';

      let selectHtml = '<option value="">— Select —</option>';
      myBanks.forEach(b => { selectHtml += `<option value="${b.id}" ${b.id === c.bank_account_id ? 'selected' : ''}>${esc(b.account_label)}</option>`; });

      html += `<tr ${warn}>
        <td style="color:var(--t4)">${ci + 1}</td>
        <td style="font-weight:500">${esc(c.channel_label)}${!c.is_mapped ? '<span style="font-size:9px;color:var(--orange);font-weight:600;margin-left:4px">NEW</span>' : ''}</td>
        <td><span style="font-size:9px;font-weight:600;padding:2px 8px;border-radius:3px;${typeCls}">${esc(c.channel_type)}</span></td>
        <td><span style="font-size:var(--fs-xxs);font-weight:500;${dirCls}">${esc(c.direction.toUpperCase())}</span></td>
        <td><select class="fl" style="width:100%;font-size:var(--fs-xs);padding:5px 8px" data-map-id="${c.id}" onchange="FinanceSection.bmMarkDirty()">${selectHtml}</select></td>
        <td style="font-size:var(--fs-xxs);color:var(--t2)">${esc(c.auto_category || '')}</td>
        <td><span style="display:inline-block;width:7px;height:7px;border-radius:50%;${dot}"></span></td>
      </tr>`;
    });

    html += '</tbody></table></div></div>';
  });

  html += `<div style="font-size:var(--fs-xxs);color:var(--t3);padding:8px 12px;background:var(--bg2);border-radius:8px;margin-top:8px">Bank accounts come from Chart of Accounts. To add a new bank account, go to Accounting → Categories (COA).</div>`;
  el.innerHTML = html;
}

function _bmRenderChannels(el) {
  const d = _bmData;
  if (!d) return;
  const stores = d.stores || {};
  const storeBanks = d.storeBanks || {};
  const storeNames = d.storeNames || {};

  const bankCount = {};
  Object.entries(stores).forEach(([sid, channels]) => {
    (channels).forEach(c => {
      if (c.bank_account_id) {
        if (!bankCount[c.bank_account_id]) bankCount[c.bank_account_id] = 0;
        bankCount[c.bank_account_id]++;
      }
    });
  });

  let html = `<div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:14px">Overview of bank accounts per brand/store, and how many channels are mapped to each.</div>`;

  const storeIds = Object.keys(storeBanks).filter(sid => (storeBanks[sid] || []).length > 0);
  if (storeIds.length === 0) {
    html += '<div style="padding:40px;text-align:center;color:var(--t3)">No bank accounts found.</div>';
    el.innerHTML = html;
    return;
  }

  storeIds.forEach(sid => {
    const myBanks = storeBanks[sid] || [];
    const storeName = storeNames[sid] || sid;

    html += `<div style="border:1px solid var(--bd);border-radius:8px;margin-bottom:12px;overflow:hidden;background:#fff">
      <div style="padding:10px 16px;background:var(--bg2);font-weight:600;font-size:var(--fs-sm);display:flex;align-items:center;gap:8px">
        ${esc(storeName)}
        <span style="font-size:var(--fs-xxs);color:var(--t3);background:var(--bg3);padding:2px 8px;border-radius:3px">${esc(sid)}</span>
      </div>
      <table class="tbl" style="font-size:var(--fs-sm);margin:0"><thead><tr><th>Account Name</th><th>Bank</th><th>Type</th><th style="text-align:right">Channels</th></tr></thead><tbody>`;

    myBanks.forEach(b => {
      const cnt = bankCount[b.id] || 0;
      const cntColor = cnt > 0 ? 'color:var(--green);font-weight:600' : 'color:var(--orange)';
      html += `<tr style="background:#fff"><td style="font-weight:600">${esc(b.account_label)}</td><td>${esc(b.bank_name || '—')}</td><td>${esc(b.account_type || 'Bank')}</td><td style="text-align:right;${cntColor}">${cnt}</td></tr>`;
    });

    html += '</tbody></table></div>';
  });

  html += '<div style="font-size:var(--fs-xxs);color:var(--t3);margin-top:12px">To add or edit bank accounts, go to Accounting → Categories (COA).</div>';
  el.innerHTML = html;
}

function bmSetTab(tab) {
  _bmTab = tab;
  _bmLoad();
}

function bmMarkDirty() {
  const btn = document.getElementById('bm_save_btn');
  if (btn) { btn.style.background = 'var(--acc)'; btn.textContent = 'Save Changes ●'; }
}

async function bmSave() {
  if (_bmSaving) return;
  const btn = document.getElementById('bm_save_btn');
  _bmSaving = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    const mappings = [];
    document.querySelectorAll('[data-map-id]').forEach(sel => {
      mappings.push({ id: sel.dataset.mapId, bank_account_id: sel.value || null });
    });
    if (mappings.length > 0) await FIN.api('save_bank_mapping', { mappings });
    SPG.toast('Saved', 'success');
    if (btn) { btn.style.background = ''; btn.textContent = 'Save Changes'; }
    _bmLoad();
  } catch (e) {
    SPG.toast(e.message || 'Save failed', 'error');
  } finally {
    _bmSaving = false;
    if (btn) { btn.disabled = false; }
  }
}


// ══════════════════════════════════════════
// 8. LINKED CATEGORIES (ac-linked)
// ══════════════════════════════════════════

let _lcRows = [];

function renderAcLinked() {
  const actions = `<button class="btn-primary" onclick="FinanceSection.lcAdd()">+ Add Link</button>`;

  return SPG.shell(SPG.toolbar('Linked Categories', actions) + `<div class="content" id="fin-ac-linked"><div class="card" style="max-width:900px;margin:0 auto">
    <div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:8px">Link related categories so transactions auto-update paired accounts (e.g. Super expense → Super payable on Balance Sheet)</div>
    <div class="tbl-wrap"><table class="tbl" id="lc_tbl">
      <thead><tr>${ui.sortTh('lc_tbl', 'src', 'Source Category')}<th style="width:30px">→</th>${ui.sortTh('lc_tbl', 'lnk', 'Linked Account')}${ui.sortTh('lc_tbl', 'effect', 'Effect')}${ui.sortTh('lc_tbl', 'status', 'Status')}<th style="width:40px"></th></tr></thead>
      <tbody id="lc_tbody">${ui.skeleton(60, 6)}</tbody>
    </table></div>
  </div></div>`, 'Finance');
}

async function loadAcLinked() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _lcLoad();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

async function _lcLoad() {
  try {
    const result = await FIN.api('get_linked_cats', {});
    _lcRows = result.rows || [];
    _lcRender();
  } catch (e) {
    const tbody = document.getElementById('lc_tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--red)">Error: ${esc(e.message)}</td></tr>`;
  }
}

function _lcRender() {
  const tbody = document.getElementById('lc_tbody');
  if (!tbody) return;
  if (_lcRows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--t3)">No linked categories</td></tr>';
    return;
  }
  tbody.innerHTML = _lcRows.map(r => `<tr>
    <td>${esc(r.source_label)}</td>
    <td style="font-size:16px;color:var(--acc)">→</td>
    <td>${esc(r.linked_label)}</td>
    <td style="font-size:var(--fs-xxs);color:var(--t3)">${esc(r.effect || '')}</td>
    <td>${ui.badge(r.is_active ? 'Active' : 'Inactive')}</td>
    <td><button class="btn-outline" style="color:var(--acc);font-size:var(--fs-xs);padding:4px 8px" onclick="FinanceSection.lcEdit('${r.id}')">Edit</button></td>
  </tr>`).join('');
}

function lcAdd() {
  _lcShowDialog(null);
}

function lcEdit(id) {
  const row = _lcRows.find(r => r.id === id);
  if (row) _lcShowDialog(row);
}

function _lcShowDialog(row) {
  const isEdit = !!row;
  const r = row || {};
  const title = isEdit ? 'Edit Linked Category' : 'Add Linked Category';

  SPG.showDialog(`<div class="popup-sheet" style="width:420px"><div class="popup-sheet-header"><div class="popup-sheet-title">${esc(title)}</div></div><div class="popup-sheet-body">
    <div class="fg"><label class="lb">Source Category *</label><input class="inp" id="dlg_lc_src" value="${esc(r.source_label || '')}" placeholder="e.g. Expense: Payroll → Superannuation"></div>
    <div class="fg"><label class="lb">Linked Account *</label><input class="inp" id="dlg_lc_lnk" value="${esc(r.linked_label || '')}" placeholder="e.g. Liability: Super Payable"></div>
    <div class="fg"><label class="lb">Effect</label><input class="inp" id="dlg_lc_eff" value="${esc(r.effect || '')}" placeholder="Describe what happens"></div>
  </div><div class="popup-sheet-footer"><button class="btn-outline" onclick="SPG.closeDialog()">Cancel</button><button class="btn-primary" onclick="FinanceSection.saveLc('${isEdit ? r.id : ''}')">${isEdit ? 'Save' : 'Add'}</button></div></div>`);
}

async function saveLc(id) {
  const src = document.getElementById('dlg_lc_src')?.value?.trim();
  const lnk = document.getElementById('dlg_lc_lnk')?.value?.trim();
  const eff = document.getElementById('dlg_lc_eff')?.value?.trim();
  if (!src || !lnk) { SPG.toast('Source and Linked are required', 'error'); return; }
  SPG.closeDialog();
  try {
    await FIN.api('save_linked_cat', {
      id: id || undefined,
      source_label: src, linked_label: lnk, effect: eff,
    });
    SPG.toast(id ? 'Updated' : 'Added', 'success');
    _lcLoad();
  } catch (e) {
    SPG.toast(e.message || 'Save failed', 'error');
  }
}


// ══════════════════════════════════════════
// 9. LOANS & FINANCE (ac-loan) — 4 tabs
// ══════════════════════════════════════════

let _lnData = null;
let _lnTab = 'external';
let _lnSaving = false;

function _lnTabs(active) {
  const tabs = [
    { id: 'external', label: 'External Loans' },
    { id: 'interco', label: 'Intercompany' },
    { id: 'capital', label: 'Investment & Capital' },
    { id: 'dividend', label: 'Dividends' },
  ];
  return '<div style="display:flex;gap:0;border-bottom:1px solid var(--bd);margin-bottom:12px">'
    + tabs.map(t => `<div class="pill${t.id === active ? ' active' : ''}" onclick="FinanceSection.lnSetTab('${t.id}')">${esc(t.label)}</div>`).join('')
    + '</div>';
}

function renderAcLoan() {
  _lnTab = 'external';

  const actions = `<button class="btn-outline" onclick="FinanceSection.lnRepayModal()">+ Record Repayment</button><button class="btn-outline" onclick="FinanceSection.lnEquityModal('capital_in')">+ Equity Transaction</button><button class="btn-primary" onclick="FinanceSection.lnNewLoanModal()">+ Record New Loan</button>`;

  return SPG.shell(SPG.toolbar('Loans and Finance', actions) + `<div class="content" id="fin-ac-loan"><div style="max-width:1100px;margin:0 auto"><div id="ln_kpis"></div><div id="ln_tabs_wrap">${_lnTabs('external')}</div><div id="ln_content"><div style="text-align:center;padding:40px;color:var(--t3)">${ui.skeleton(60, 1)}</div></div></div></div>`, 'Finance');
}

async function loadAcLoan() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _lnLoad();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

async function _lnLoad() {
  try {
    _lnData = await FIN.api('get_loans_dashboard', {});
    _lnRenderKpis();
    const tabsEl = document.getElementById('ln_tabs_wrap');
    if (tabsEl) tabsEl.innerHTML = _lnTabs(_lnTab);
    _lnRenderTab();
  } catch (e) {
    const el = document.getElementById('ln_content');
    if (el) el.innerHTML = `<div style="padding:20px;color:var(--red)">Error: ${esc(e.message)}</div>`;
  }
}

function _lnRenderKpis() {
  const el = document.getElementById('ln_kpis');
  if (!el || !_lnData) return;
  const k = _lnData.kpis || {};
  el.innerHTML = `<div class="kpi-grid" style="margin-bottom:14px">
    <div class="kpi-card" style="border-top:3px solid var(--red)"><div class="kpi-value" style="color:var(--red)">${fm(k.loans_outstanding)}</div><div class="kpi-label">Loans Outstanding</div></div>
    <div class="kpi-card" style="border-top:3px solid var(--orange)"><div class="kpi-value" style="color:var(--orange)">${fm(k.interco_owing)}</div><div class="kpi-label">Intercompany Owing</div></div>
    <div class="kpi-card" style="border-top:3px solid var(--acc)"><div class="kpi-value" style="color:var(--acc)">${fm(k.capital_invested)}</div><div class="kpi-label">Total Capital Invested</div></div>
    <div class="kpi-card" style="border-top:3px solid var(--blue)"><div class="kpi-value" style="color:var(--blue)">${fm(k.dividends_paid_ytd)}</div><div class="kpi-label">Dividends Paid (YTD)</div></div>
    <div class="kpi-card" style="border-top:3px solid var(--green)"><div class="kpi-value" style="color:var(--green)">${fm(k.retained_earnings)}</div><div class="kpi-label">Retained Earnings</div></div>
  </div>`;
}

function lnSetTab(tab) {
  _lnTab = tab;
  const tabsEl = document.getElementById('ln_tabs_wrap');
  if (tabsEl) tabsEl.innerHTML = _lnTabs(tab);
  _lnRenderTab();
}

function _lnRenderTab() {
  const el = document.getElementById('ln_content');
  if (!el || !_lnData) return;
  if (_lnTab === 'external') _lnRenderExternal(el);
  else if (_lnTab === 'interco') _lnRenderInterco(el);
  else if (_lnTab === 'capital') _lnRenderCapital(el);
  else if (_lnTab === 'dividend') _lnRenderDividend(el);
}

// ── Tab 1: External Loans ──
function _lnRenderExternal(el) {
  const loans = _lnData.loans || [];
  if (loans.length === 0) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--t3)">No loans recorded yet. Click "+ Record New Loan" to add one.</div>';
    return;
  }
  el.innerHTML = loans.map((l, idx) => {
    const repaid = Number(l.original_amount) - Number(l.outstanding_amount);
    const pct = l.original_amount > 0 ? Math.round((repaid / l.original_amount) * 100) : 0;
    const borderColor = l.loan_type === 'bank_loan' ? 'var(--orange)' : l.loan_type === 'director_loan' ? 'var(--acc)' : 'var(--blue)';
    const typeLabel = l.loan_type === 'bank_loan' ? 'Bank Loan' : l.loan_type === 'director_loan' ? 'Director Loan' : 'Equipment';
    const dim = l.status === 'paid_off' ? 'opacity:.7' : '';

    const reps = l.repayments || [];
    const repHtml = reps.length > 0 ? `<div style="font-size:var(--fs-sm);font-weight:700;margin:12px 0 6px">Repayment History</div>
      <table class="tbl" id="ln_rep_${idx}"><thead><tr>${ui.sortTh('ln_rep_'+idx, 'date', 'Date')}${ui.sortTh('ln_rep_'+idx, 'ref', 'Reference')}${ui.sortTh('ln_rep_'+idx, 'principal', 'Principal')}${ui.sortTh('ln_rep_'+idx, 'interest', 'Interest')}${ui.sortTh('ln_rep_'+idx, 'total', 'Total')}</tr></thead><tbody>
      ${reps.slice(0, 5).map(r => `<tr><td>${fd(r.payment_date)}</td><td>${esc(r.reference || '—')}</td><td style="text-align:right">${fm(r.principal_amount)}</td><td style="text-align:right;color:var(--t3)">${fm(r.interest_amount)}</td><td style="text-align:right;font-weight:600">${fm(r.total_amount)}</td></tr>`).join('')}
      ${reps.length > 5 ? `<tr><td colspan="5" style="font-size:var(--fs-xxs);color:var(--t3)">... ${reps.length - 5} earlier payments</td></tr>` : ''}
      </tbody></table>
      <div style="display:flex;gap:6px;margin-top:10px;justify-content:flex-end"><button class="btn-outline" onclick="FinanceSection.lnEditLoan('${l.id}')">Edit Loan</button><button class="btn-primary" onclick="FinanceSection.lnRepayModal('${l.id}')">Record Repayment</button></div>` : '';

    return `<div class="card" style="border-left:4px solid ${borderColor};${dim};cursor:pointer" onclick="var d=document.getElementById('lnd_${idx}');if(d)d.style.display=d.style.display==='none'?'block':'none'">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:14px;font-weight:700">${esc(l.loan_name)}</span>${ui.badge(l.status === 'active' ? 'Active' : 'Paid off')}<span style="font-size:var(--fs-xxs);padding:2px 6px;border-radius:4px;background:var(--bg3);color:var(--t2)">${typeLabel}</span></div>
          <div style="font-size:var(--fs-xs);color:var(--t3)">Lender: ${esc(l.lender)} · ${l.account_number ? 'Account: ' + esc(l.account_number) + ' · ' : ''}${l.brand_id ? 'Brand: ' + esc(l.brand_id) : ''}</div>
          ${l.purpose ? `<div style="font-size:var(--fs-xs);color:var(--t3);margin-top:2px">Purpose: ${esc(l.purpose)} · Start: ${fd(l.start_date)}${l.term_months ? ' · Term: ' + Math.floor(l.term_months / 12) + ' yrs' : ''}</div>` : ''}
        </div>
        <div style="text-align:right"><div style="font-size:22px;font-weight:800;color:${l.status === 'paid_off' ? 'var(--green)' : 'var(--red)'}">${fm(l.outstanding_amount)}</div><div style="font-size:var(--fs-xxs);color:var(--t3)">outstanding of ${fm(l.original_amount)}</div></div>
      </div>
      <div style="margin-top:8px"><div style="display:flex;justify-content:space-between;font-size:var(--fs-xxs);color:var(--t3);margin-bottom:3px"><span>Repaid ${pct}%</span><span>${fm(repaid)} of ${fm(l.original_amount)}</span></div><div style="height:6px;background:var(--bd2);border-radius:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--green);border-radius:3px"></div></div></div>
      <div style="display:flex;gap:16px;margin-top:10px;font-size:var(--fs-xs)">
        ${l.interest_rate ? `<div><span style="color:var(--t3)">Interest:</span> <b>${l.interest_rate}% p.a.</b></div>` : ''}
        ${l.monthly_repayment ? `<div><span style="color:var(--t3)">Monthly:</span> <b>${fm(l.monthly_repayment)}</b></div>` : ''}
        ${l.next_due_date ? `<div><span style="color:var(--t3)">Next due:</span> <b style="color:var(--orange)">${fd(l.next_due_date)}</b></div>` : ''}
      </div>
    </div>
    <div id="lnd_${idx}" style="display:none"><div class="card" style="border:1.5px solid var(--acc);margin-top:-10px;border-radius:0 0 10px 10px">${repHtml || '<div style="font-size:var(--fs-xs);color:var(--t3);padding:8px">No repayments recorded yet</div>'}</div></div>`;
  }).join('');
}

// ── Tab 2: Intercompany ──
function _lnRenderInterco(el) {
  const rows = (_lnData.intercompany || []).filter(i => !i.is_settled);
  const settled = (_lnData.intercompany || []).filter(i => i.is_settled);

  const entities = new Set();
  rows.forEach(r => { entities.add(r.debtor_entity); entities.add(r.creditor_entity); });
  settled.forEach(r => { entities.add(r.debtor_entity); entities.add(r.creditor_entity); });
  const brands = [...entities].sort();

  const matrix = {};
  brands.forEach(b => { matrix[b] = {}; brands.forEach(b2 => { matrix[b][b2] = 0; }); });
  rows.forEach(r => { matrix[r.debtor_entity][r.creditor_entity] += Number(r.amount); });

  if (brands.length === 0) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--t3)">No intercompany transactions yet. These are auto-generated from On Behalf / Split bills.</div>';
    return;
  }

  let html = `<div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:10px">Auto-generated from On Behalf / Split bills · Rows owe columns</div>
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px"><div class="tbl-wrap"><table class="tbl" style="text-align:center"><thead><tr><th style="text-align:left">Owes →</th>${brands.map(b => `<th>${esc(b)}</th>`).join('')}<th style="background:var(--red-bg);color:var(--red)">Total Owing</th></tr></thead><tbody>`;

  brands.forEach(debtor => {
    const totalOwing = brands.reduce((s, creditor) => s + (debtor !== creditor ? matrix[debtor][creditor] : 0), 0);
    html += `<tr><td style="text-align:left;font-weight:700">${esc(debtor)}</td>`;
    brands.forEach(creditor => {
      if (debtor === creditor) html += `<td style="background:var(--bg3);color:var(--t4)">—</td>`;
      else { const v = matrix[debtor][creditor]; html += `<td style="${v > 0 ? 'font-weight:700;color:var(--red)' : 'color:var(--t4)'}">${v > 0 ? fm(v) : '$0'}</td>`; }
    });
    html += `<td style="font-weight:700;color:${totalOwing > 0 ? 'var(--red)' : 'var(--green)'}">${fm(totalOwing)}</td></tr>`;
  });
  html += '</tbody></table></div></div>';

  if (rows.length > 0) {
    html += `<div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:6px">Unsettled Transactions (${rows.length})</div>
      <div class="card" style="padding:0;overflow:hidden"><div class="tbl-wrap"><table class="tbl" id="ln_ic_tbl"><thead><tr>${ui.sortTh('ln_ic_tbl', 'date', 'Date')}${ui.sortTh('ln_ic_tbl', 'debtor', 'Debtor')}${ui.sortTh('ln_ic_tbl', 'creditor', 'Creditor')}${ui.sortTh('ln_ic_tbl', 'source', 'Source')}${ui.sortTh('ln_ic_tbl', 'desc', 'Description')}${ui.sortTh('ln_ic_tbl', 'amount', 'Amount')}</tr></thead><tbody>
      ${rows.map(r => {
        return `<tr><td>${fd(r.created_at?.substring(0,10))}</td><td style="font-weight:600;color:var(--red)">${esc(r.debtor_entity)}</td><td style="font-weight:600;color:var(--green)">${esc(r.creditor_entity)}</td><td>${ui.badge(r.source_type)}</td><td style="font-size:var(--fs-xs)">${esc(r.description || '')}</td><td style="text-align:right;font-weight:600">${fm(r.amount)}</td></tr>`;
      }).join('')}
      </tbody></table></div></div>`;
  }

  el.innerHTML = html;
}

// ── Tab 3: Investment & Capital ──
function _lnRenderCapital(el) {
  const equity = _lnData.equity || [];
  const capital = equity.filter(e => e.equity_type === 'capital_in' || e.equity_type === 'capital_out');
  const totalInvested = capital.filter(e => e.equity_type === 'capital_in').reduce((s, e) => s + Number(e.amount), 0);

  let html = '';
  if (capital.length === 0) {
    html = '<div style="padding:40px;text-align:center;color:var(--t3)">No capital transactions yet. Click "+ Equity Transaction" to record one.</div>';
  } else {
    html += `<div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:6px">Capital Transaction History</div>
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px"><div class="tbl-wrap"><table class="tbl" id="ln_cap_tbl"><thead><tr>${ui.sortTh('ln_cap_tbl', 'date', 'Date')}${ui.sortTh('ln_cap_tbl', 'type', 'Type')}${ui.sortTh('ln_cap_tbl', 'investor', 'Investor')}${ui.sortTh('ln_cap_tbl', 'brand', 'Brand')}${ui.sortTh('ln_cap_tbl', 'desc', 'Description')}${ui.sortTh('ln_cap_tbl', 'amount', 'Amount')}${ui.sortTh('ln_cap_tbl', 'ref', 'Ref')}</tr></thead><tbody>
      ${capital.map(e => `<tr><td>${fd(e.transaction_date)}</td><td>${ui.badge(e.equity_type === 'capital_in' ? 'Capital In' : 'Capital Out')}</td><td style="font-weight:600">${esc(e.person_name)}</td><td>${esc(e.entity_id || '—')}</td><td style="font-size:var(--fs-xs)">${esc(e.description || '')}</td><td style="text-align:right;font-weight:600;color:${e.equity_type === 'capital_in' ? 'var(--green)' : 'var(--red)'}">${e.equity_type === 'capital_in' ? '+' : '-'}${fm(e.amount)}</td><td style="font-size:var(--fs-xs)">${esc(e.reference || '—')}</td></tr>`).join('')}
      </tbody><tfoot><tr style="border-top:2px solid var(--bd);font-weight:700"><td colspan="5">Total Capital Invested</td><td style="text-align:right;color:var(--green)">${fm(totalInvested)}</td><td></td></tr></tfoot></table></div></div>`;
  }
  html += `<div style="display:flex;gap:6px;justify-content:flex-end"><button class="btn-primary" onclick="FinanceSection.lnEquityModal('capital_in')">+ Record Capital Injection</button></div>`;
  el.innerHTML = html;
}

// ── Tab 4: Dividends ──
function _lnRenderDividend(el) {
  const equity = _lnData.equity || [];
  const k = _lnData.kpis || {};
  const paid = equity.filter(e => e.equity_type === 'dividend_paid');
  const planned = equity.filter(e => e.equity_type === 'dividend_planned');

  let html = `<div style="display:flex;gap:8px;margin-bottom:12px">
    <div class="kpi-card" style="flex:1;margin:0;text-align:center;border-top:3px solid var(--blue)"><div style="font-size:var(--fs-xxs);color:var(--t3)">Dividends Paid (YTD)</div><div style="font-size:20px;font-weight:700;color:var(--blue)">${fm(k.dividends_paid_ytd)}</div></div>
    <div class="kpi-card" style="flex:1;margin:0;text-align:center;border-top:3px solid var(--green)"><div style="font-size:var(--fs-xxs);color:var(--t3)">Retained Earnings</div><div style="font-size:20px;font-weight:700;color:var(--green)">${fm(k.retained_earnings)}</div></div>
    <div class="kpi-card" style="flex:1;margin:0;text-align:center;border-top:3px solid var(--orange)"><div style="font-size:var(--fs-xxs);color:var(--t3)">Planned (not yet paid)</div><div style="font-size:20px;font-weight:700;color:var(--orange)">${fm(k.dividends_planned)}</div></div>
  </div>`;

  if (planned.length > 0) {
    html += `<div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:6px;color:var(--orange)">Planned Distributions</div>`;
    planned.forEach(e => {
      html += `<div class="card" style="border-left:4px solid var(--orange);margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:var(--fs-body);font-weight:700">${esc(e.description || e.period || 'Dividend')} — ${esc(e.person_name)}</div><div style="font-size:var(--fs-xs);color:var(--t3)">Planned: ${fd(e.transaction_date)}</div></div><div style="font-size:18px;font-weight:800;color:var(--orange)">${fm(e.amount)}</div></div></div>`;
    });
  }

  if (paid.length > 0) {
    html += `<div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:6px">Dividend History</div>
      <div class="card" style="padding:0;overflow:hidden"><div class="tbl-wrap"><table class="tbl" id="ln_div_tbl"><thead><tr>${ui.sortTh('ln_div_tbl', 'date', 'Date')}${ui.sortTh('ln_div_tbl', 'recipient', 'Recipient')}${ui.sortTh('ln_div_tbl', 'desc', 'Description')}${ui.sortTh('ln_div_tbl', 'period', 'Period')}${ui.sortTh('ln_div_tbl', 'amount', 'Amount')}${ui.sortTh('ln_div_tbl', 'ref', 'Ref')}${ui.sortTh('ln_div_tbl', 'status', 'Status')}</tr></thead><tbody>
      ${paid.map(e => `<tr><td>${fd(e.transaction_date)}</td><td style="font-weight:600">${esc(e.person_name)}</td><td>${esc(e.description || '')}</td><td>${esc(e.period || '')}</td><td style="text-align:right;font-weight:600">${fm(e.amount)}</td><td style="font-size:var(--fs-xs)">${esc(e.reference || '—')}</td><td>${ui.badge('Paid')}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  }

  html += `<div style="display:flex;gap:6px;margin-top:10px;justify-content:flex-end"><button class="btn-primary" onclick="FinanceSection.lnEquityModal('dividend_paid')">+ Record Dividend</button></div>`;
  el.innerHTML = html;
}

// ── Loan Modals ──
function lnNewLoanModal() {
  let bankOpts = '<option value="">— Select —</option>';
  (S.bankAccounts || []).forEach(b => { bankOpts += `<option value="${b.id}">${esc(b.label)}</option>`; });

  SPG.showDialog(`<div class="popup-sheet" style="width:520px"><div class="popup-sheet-header"><div class="popup-sheet-title">Record New Loan</div></div><div class="popup-sheet-body">
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Loan Name *</label><input class="inp" id="dlg_ln_name" placeholder="e.g. ANZ Business Loan"></div><div class="fg" style="flex:1"><label class="lb">Lender *</label><input class="inp" id="dlg_ln_lender" placeholder="e.g. ANZ"></div></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Type</label><select class="inp" id="dlg_ln_type"><option value="bank_loan">Bank Loan</option><option value="director_loan">Director Loan</option><option value="equipment_finance">Equipment Finance</option></select></div><div class="fg" style="flex:1"><label class="lb">Amount *</label><input class="inp" id="dlg_ln_amt" type="number" step="0.01" placeholder="100000"></div></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Interest Rate (%)</label><input class="inp" id="dlg_ln_rate" type="number" step="0.1" value="0"></div><div class="fg" style="flex:1"><label class="lb">Monthly Repayment</label><input class="inp" id="dlg_ln_monthly" type="number" step="0.01"></div></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Start Date *</label><input class="inp" id="dlg_ln_start" type="date" value="${today()}"></div><div class="fg" style="flex:1"><label class="lb">Term (months)</label><input class="inp" id="dlg_ln_term" type="number" placeholder="60"></div></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Brand</label><input class="inp" id="dlg_ln_brand" placeholder="e.g. Mango Coco"></div><div class="fg" style="flex:1"><label class="lb">Purpose</label><input class="inp" id="dlg_ln_purpose" placeholder="e.g. Fit-out"></div></div>
    <div class="fg"><label class="lb">Bank Account</label><select class="inp" id="dlg_ln_bank">${bankOpts}</select></div>
  </div><div class="popup-sheet-footer"><button class="btn-outline" onclick="SPG.closeDialog()">Cancel</button><button class="btn-primary" onclick="FinanceSection.confirmNewLoan()">Create Loan</button></div></div>`);
}

async function confirmNewLoan() {
  SPG.closeDialog();
  try {
    await FIN.api('create_loan', {
      loan_name: document.getElementById('dlg_ln_name')?.value?.trim(),
      lender: document.getElementById('dlg_ln_lender')?.value?.trim(),
      loan_type: document.getElementById('dlg_ln_type')?.value,
      original_amount: parseFloat(document.getElementById('dlg_ln_amt')?.value) || 0,
      interest_rate: parseFloat(document.getElementById('dlg_ln_rate')?.value) || 0,
      monthly_repayment: parseFloat(document.getElementById('dlg_ln_monthly')?.value) || 0,
      start_date: document.getElementById('dlg_ln_start')?.value,
      term_months: parseInt(document.getElementById('dlg_ln_term')?.value) || null,
      brand_id: document.getElementById('dlg_ln_brand')?.value?.trim() || null,
      purpose: document.getElementById('dlg_ln_purpose')?.value?.trim() || null,
      bank_account_id: document.getElementById('dlg_ln_bank')?.value || null,
    });
    SPG.toast('Loan created', 'success');
    _lnLoad();
  } catch (e) { SPG.toast(e.message || 'Create failed', 'error'); }
}

function lnEditLoan(id) {
  const loan = (_lnData.loans || []).find(l => l.id === id);
  if (!loan) return;

  SPG.showDialog(`<div class="popup-sheet" style="width:420px"><div class="popup-sheet-header"><div class="popup-sheet-title">Edit Loan: ${esc(loan.loan_name || '')}</div></div><div class="popup-sheet-body">
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Next Due Date</label><input class="inp" id="dlg_le_due" type="date" value="${loan.next_due_date || ''}"></div><div class="fg" style="flex:1"><label class="lb">Monthly Repayment</label><input class="inp" id="dlg_le_monthly" type="number" step="0.01" value="${loan.monthly_repayment || 0}"></div></div>
    <div class="fg"><label class="lb">Notes</label><input class="inp" id="dlg_le_notes" value="${esc(loan.notes || '')}"></div>
    <div class="fg"><label class="lb">Status</label><select class="inp" id="dlg_le_status"><option value="active" ${loan.status==='active'?'selected':''}>Active</option><option value="paid_off" ${loan.status==='paid_off'?'selected':''}>Paid off</option></select></div>
  </div><div class="popup-sheet-footer"><button class="btn-outline" onclick="SPG.closeDialog()">Cancel</button><button class="btn-primary" onclick="FinanceSection.confirmEditLoan('${id}')">Save</button></div></div>`);
}

async function confirmEditLoan(id) {
  SPG.closeDialog();
  try {
    await FIN.api('update_loan', {
      id,
      next_due_date: document.getElementById('dlg_le_due')?.value || null,
      monthly_repayment: parseFloat(document.getElementById('dlg_le_monthly')?.value) || 0,
      notes: document.getElementById('dlg_le_notes')?.value || null,
      status: document.getElementById('dlg_le_status')?.value || 'active',
    });
    SPG.toast('Loan updated', 'success');
    _lnLoad();
  } catch (e) { SPG.toast(e.message || 'Update failed', 'error'); }
}

function lnRepayModal(loanId) {
  const loans = (_lnData?.loans || []).filter(l => l.status === 'active');
  let loanOpts = '<option value="">— Select —</option>';
  loans.forEach(l => { loanOpts += `<option value="${l.id}" ${l.id === loanId ? 'selected' : ''}>${esc(l.loan_name)} (${fm(l.outstanding_amount)})</option>`; });

  SPG.showDialog(`<div class="popup-sheet" style="width:420px"><div class="popup-sheet-header"><div class="popup-sheet-title">Record Repayment</div></div><div class="popup-sheet-body">
    <div class="fg"><label class="lb">Loan *</label><select class="inp" id="dlg_rp_loan">${loanOpts}</select></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Principal *</label><input class="inp" id="dlg_rp_prin" type="number" step="0.01" placeholder="0.00"></div><div class="fg" style="flex:1"><label class="lb">Interest</label><input class="inp" id="dlg_rp_int" type="number" step="0.01" placeholder="0.00"></div></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Date</label><input class="inp" id="dlg_rp_date" type="date" value="${today()}"></div><div class="fg" style="flex:1"><label class="lb">Reference</label><input class="inp" id="dlg_rp_ref" placeholder="e.g. PAY-1290"></div></div>
  </div><div class="popup-sheet-footer"><button class="btn-outline" onclick="SPG.closeDialog()">Cancel</button><button class="btn-primary" onclick="FinanceSection.confirmRepay()">Record Payment</button></div></div>`);
}

async function confirmRepay() {
  SPG.closeDialog();
  try {
    await FIN.api('record_repayment', {
      loan_id: document.getElementById('dlg_rp_loan')?.value,
      principal_amount: parseFloat(document.getElementById('dlg_rp_prin')?.value) || 0,
      interest_amount: parseFloat(document.getElementById('dlg_rp_int')?.value) || 0,
      payment_date: document.getElementById('dlg_rp_date')?.value,
      reference: document.getElementById('dlg_rp_ref')?.value?.trim() || null,
    });
    SPG.toast('Repayment recorded', 'success');
    _lnLoad();
  } catch (e) { SPG.toast(e.message || 'Failed', 'error'); }
}

function lnEquityModal(type) {
  const title = type === 'capital_in' ? 'Record Capital Injection' : type === 'capital_out' ? 'Record Capital Withdrawal' : 'Record Dividend';

  SPG.showDialog(`<div class="popup-sheet" style="width:480px"><div class="popup-sheet-header"><div class="popup-sheet-title">${esc(title)}</div></div><div class="popup-sheet-body">
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Person / Investor *</label><input class="inp" id="dlg_eq_person" placeholder="e.g. Khun Or"></div><div class="fg" style="flex:1"><label class="lb">Amount *</label><input class="inp" id="dlg_eq_amt" type="number" step="0.01"></div></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Brand / Entity</label><input class="inp" id="dlg_eq_brand" placeholder="e.g. SPG Group"></div><div class="fg" style="flex:1"><label class="lb">Date</label><input class="inp" id="dlg_eq_date" type="date" value="${today()}"></div></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Description</label><input class="inp" id="dlg_eq_desc" placeholder=""></div><div class="fg" style="flex:1"><label class="lb">Reference</label><input class="inp" id="dlg_eq_ref" placeholder="e.g. EQ-005"></div></div>
    ${type.startsWith('dividend') ? '<div class="fg"><label class="lb">Period</label><input class="inp" id="dlg_eq_period" placeholder="e.g. Q1 2026"></div>' : '<div class="fg"><label class="lb">Purpose</label><input class="inp" id="dlg_eq_purpose" placeholder="e.g. Store fit-out"></div>'}
  </div><div class="popup-sheet-footer"><button class="btn-outline" onclick="SPG.closeDialog()">Cancel</button><button class="btn-primary" onclick="FinanceSection.confirmEquity('${type}')">${esc(title.replace('Record ', ''))}</button></div></div>`);
}

async function confirmEquity(type) {
  SPG.closeDialog();
  try {
    await FIN.api('create_equity', {
      equity_type: type,
      person_name: document.getElementById('dlg_eq_person')?.value?.trim(),
      amount: parseFloat(document.getElementById('dlg_eq_amt')?.value) || 0,
      entity_id: document.getElementById('dlg_eq_brand')?.value?.trim() || null,
      transaction_date: document.getElementById('dlg_eq_date')?.value,
      description: document.getElementById('dlg_eq_desc')?.value?.trim() || null,
      reference: document.getElementById('dlg_eq_ref')?.value?.trim() || null,
      purpose: document.getElementById('dlg_eq_purpose')?.value?.trim() || null,
      period: document.getElementById('dlg_eq_period')?.value?.trim() || null,
      status: type === 'dividend_planned' ? 'pending' : 'completed',
    });
    SPG.toast('Recorded', 'success');
    _lnLoad();
  } catch (e) { SPG.toast(e.message || 'Failed', 'error'); }
}


// ══════════════════════════════════════════
// 10. GENERAL JOURNAL (ac-journal)
// ══════════════════════════════════════════

let _jnEntries = [];
let _jnView = 'list';
let _jnLines = [{ category_display: '', debit: '', credit: '', tax_code: 'FRE' }, { category_display: '', debit: '', credit: '', tax_code: 'FRE' }];
let _jnSaving = false;
let _jnCatOpts = '';
let _jnTaxOpts = '';

function renderAcJournal() {
  _jnView = 'list';

  const actions = `<button class="btn-primary" onclick="FinanceSection.jnNewEntry()">+ New Journal Entry</button>`;

  return SPG.shell(SPG.toolbar('General Journal', actions) + `<div class="content" id="fin-ac-journal"><div style="max-width:900px;margin:0 auto" id="jn_wrap"></div></div>`, 'Finance');
}

async function loadAcJournal() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _jnLoad();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

async function _jnLoad() {
  const el = document.getElementById('jn_wrap');
  if (!el) return;
  if (_jnView === 'create') { _jnRenderCreate(el); return; }

  try {
    const result = await FIN.api('get_journals', {});
    _jnEntries = result.rows || [];
    _jnRenderList(el);
  } catch (e) {
    el.innerHTML = `<div style="padding:20px;color:var(--red)">Error: ${esc(e.message)}</div>`;
  }
}

function _jnRenderList(el) {
  if (_jnEntries.length === 0) {
    el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--t3)">No journal entries yet. Click "+ New Journal Entry" to create one.</div>';
    return;
  }
  el.innerHTML = `<div class="card" style="padding:0;overflow:hidden"><div class="tbl-wrap"><table class="tbl" id="jn_tbl"><thead><tr>${ui.sortTh('jn_tbl', 'jno', 'Journal No')}${ui.sortTh('jn_tbl', 'date', 'Date')}${ui.sortTh('jn_tbl', 'desc', 'Description')}${ui.sortTh('jn_tbl', 'debit', 'Debit')}${ui.sortTh('jn_tbl', 'credit', 'Credit')}${ui.sortTh('jn_tbl', 'status', 'Status')}</tr></thead><tbody>
    ${_jnEntries.map(e => `<tr>
      <td style="font-weight:600;color:var(--acc)">${esc(e.journal_no)}</td>
      <td>${fd(e.entry_date)}</td>
      <td>${esc(e.description || '—')}</td>
      <td style="text-align:right">${fm(e.total_debit)}</td>
      <td style="text-align:right">${fm(e.total_credit)}</td>
      <td>${ui.badge(e.status)}</td>
    </tr>`).join('')}
  </tbody></table></div></div>
  <div style="font-size:var(--fs-xxs);color:var(--t3);margin-top:6px">${_jnEntries.length} entries</div>`;
}

function jnNewEntry() {
  _jnView = 'create';
  _jnLines = [
    { category_display: '', debit: '', credit: '', tax_code: 'FRE' },
    { category_display: '', debit: '', credit: '', tax_code: 'FRE' },
  ];
  _jnLoad();
}

async function _jnRenderCreate(el) {
  let jnNo = 'GJ-0001';
  try {
    const r = await FIN.api('get_next_journal_no', {});
    jnNo = r.journal_no || jnNo;
  } catch (e) { /* use default */ }

  let catOpts = '<option value="">— Select account —</option>';
  (S.categories || []).forEach(c => {
    catOpts += `<option value="${esc((c.account_code || '') + ' ' + c.sub_category)}">${esc((c.account_code ? c.account_code + ' ' : '') + c.sub_category)}</option>`;
  });

  let taxOpts = '';
  (S.taxCodes || []).forEach(t => {
    taxOpts += `<option value="${esc(t.code)}">${esc(t.code)}</option>`;
  });

  el.innerHTML = `<div class="card">
    <div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:8px">Manual journal entries for adjustments</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <div class="fg"><label class="lb">Journal Number *</label><input class="inp" id="jn_no" value="${esc(jnNo)}" readonly style="background:var(--bg3);color:var(--t3)"></div>
      <div class="fg"><label class="lb">Date *</label><input class="inp" id="jn_date" type="date" value="${today()}"></div>
      <div class="fg" style="flex:1"><label class="lb">Description</label><input class="inp" id="jn_desc" placeholder="e.g. Monthly accrual adjustment"></div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:var(--fs-sm);margin-top:10px">
      <thead><tr>
        <th style="text-align:left;padding:8px;font-weight:700;width:38%">Account</th>
        <th style="text-align:left;padding:8px;font-weight:700;width:20%">Debit ($)</th>
        <th style="text-align:left;padding:8px;font-weight:700;width:20%">Credit ($)</th>
        <th style="text-align:left;padding:8px;font-weight:700;width:14%">Tax code</th>
        <th style="width:8%"></th>
      </tr></thead>
      <tbody id="jn_lines"></tbody>
    </table>
    <div style="margin-top:6px"><a class="lk" style="font-size:var(--fs-xs);cursor:pointer" onclick="FinanceSection.jnAddLine()">+ Add line</a></div>
    <div id="jn_totals" style="text-align:right;margin-top:10px;font-size:var(--fs-sm)"></div>
    <div style="display:flex;gap:6px;margin-top:14px;justify-content:flex-end;padding-top:10px;border-top:1px solid var(--bd2)">
      <button class="btn-outline" onclick="FinanceSection.jnBackToList()">Cancel</button>
      <button class="btn-primary" id="jn_save_btn" onclick="FinanceSection.jnSave()">Save Journal</button>
    </div>
  </div>`;

  _jnCatOpts = catOpts;
  _jnTaxOpts = taxOpts;
  _jnRenderLines();
}

function _jnRenderLines() {
  const tbody = document.getElementById('jn_lines');
  if (!tbody) return;
  tbody.innerHTML = _jnLines.map((l, i) => `<tr>
    <td style="padding:0;border:1px solid var(--bd)"><select style="width:100%;padding:8px;border:none;font-size:var(--fs-sm);font-family:inherit" data-jn-line="${i}" data-jn-field="category_display" onchange="FinanceSection.jnLineChange(${i},'category_display',this.value)">${_jnCatOpts.replace(`value="${esc(l.category_display)}"`, `value="${esc(l.category_display)}" selected`)}</select></td>
    <td style="padding:0;border:1px solid var(--bd)"><input style="width:100%;padding:8px;border:none;text-align:right;font-size:var(--fs-sm)" value="${l.debit}" placeholder="0.00" oninput="FinanceSection.jnLineChange(${i},'debit',this.value)"></td>
    <td style="padding:0;border:1px solid var(--bd)"><input style="width:100%;padding:8px;border:none;text-align:right;font-size:var(--fs-sm)" value="${l.credit}" placeholder="0.00" oninput="FinanceSection.jnLineChange(${i},'credit',this.value)"></td>
    <td style="padding:0;border:1px solid var(--bd)"><select style="width:100%;padding:8px;border:none;font-size:var(--fs-sm)" onchange="FinanceSection.jnLineChange(${i},'tax_code',this.value)">${_jnTaxOpts.replace(`value="${esc(l.tax_code)}"`, `value="${esc(l.tax_code)}" selected`)}</select></td>
    <td style="text-align:center">${_jnLines.length > 2 ? `<button class="btn-outline" style="color:var(--red);font-size:14px;padding:2px 6px" onclick="FinanceSection.jnRemoveLine(${i})">✕</button>` : ''}</td>
  </tr>`).join('');
  _jnCalcTotals();
}

function jnLineChange(idx, field, val) {
  if (_jnLines[idx]) _jnLines[idx][field] = val;
  _jnCalcTotals();
}

function jnAddLine() {
  _jnLines.push({ category_display: '', debit: '', credit: '', tax_code: 'FRE' });
  _jnRenderLines();
}

function jnRemoveLine(idx) {
  if (_jnLines.length <= 2) return;
  _jnLines.splice(idx, 1);
  _jnRenderLines();
}

function _jnCalcTotals() {
  const el = document.getElementById('jn_totals');
  if (!el) return;
  let totalD = 0, totalC = 0;
  _jnLines.forEach(l => { totalD += parseFloat(l.debit) || 0; totalC += parseFloat(l.credit) || 0; });
  const balanced = Math.abs(totalD - totalC) < 0.01;
  el.innerHTML = `<span style="margin-right:20px">Total Debit: <b>${fm(totalD)}</b></span><span>Total Credit: <b>${fm(totalC)}</b></span> <span style="color:${balanced ? 'var(--green)' : 'var(--red)'};margin-left:8px">${balanced ? '✓ Balanced' : '✗ Not balanced'}</span>`;
}

function jnBackToList() {
  _jnView = 'list';
  _jnLoad();
}

async function jnSave() {
  if (_jnSaving) return;
  const date = document.getElementById('jn_date')?.value;
  if (!date) { SPG.toast('Date is required', 'error'); return; }

  let totalD = 0, totalC = 0;
  _jnLines.forEach(l => { totalD += parseFloat(l.debit) || 0; totalC += parseFloat(l.credit) || 0; });
  if (Math.abs(totalD - totalC) > 0.01) { SPG.toast('Debit and Credit must be balanced', 'error'); return; }
  if (totalD === 0) { SPG.toast('Enter at least one debit/credit amount', 'error'); return; }

  const validLines = _jnLines.filter(l => l.category_display && ((parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0));
  if (validLines.length < 2) { SPG.toast('At least 2 lines with accounts required', 'error'); return; }

  _jnSaving = true;
  const btn = document.getElementById('jn_save_btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    await FIN.api('create_journal', {
      entry_date: date,
      description: document.getElementById('jn_desc')?.value?.trim() || null,
      lines: validLines.map(l => ({
        category_display: l.category_display,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        tax_code: l.tax_code || 'FRE',
      })),
    });
    SPG.toast('Journal entry created', 'success');
    _jnView = 'list';
    _jnLoad();
  } catch (e) {
    SPG.toast(e.message || 'Save failed', 'error');
  } finally {
    _jnSaving = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Save Journal'; }
  }
}


// ══════════════════════════════════════════
// REGISTER TO FIN
// ══════════════════════════════════════════
FIN.renderAcCoa = renderAcCoa;
FIN.loadAcCoa = loadAcCoa;
FIN.renderAcCoaCreate = renderAcCoaCreate;
FIN.loadAcCoaCreate = loadAcCoaCreate;
FIN.renderAcCoaEdit = renderAcCoaEdit;
FIN.loadAcCoaEdit = loadAcCoaEdit;
FIN.renderAcTax = renderAcTax;
FIN.loadAcTax = loadAcTax;
FIN.renderAcRules = renderAcRules;
FIN.loadAcRules = loadAcRules;
FIN.renderAcHub = renderAcHub;
FIN.loadAcHub = loadAcHub;
FIN.renderAcMap = renderAcMap;
FIN.loadAcMap = loadAcMap;
FIN.renderAcLinked = renderAcLinked;
FIN.loadAcLinked = loadAcLinked;
FIN.renderAcLoan = renderAcLoan;
FIN.loadAcLoan = loadAcLoan;
FIN.renderAcJournal = renderAcJournal;
FIN.loadAcJournal = loadAcJournal;

Object.assign(window.FinanceSection, {
  // COA
  setCoaTab, onCoaSearch, toggleCoaInactive, resetCoaFilters,
  toggleAllCoa, editCategory, goLinked, onTxTypeChange,
  saveCat, toggleActive, deleteCat, confirmDeleteCat,
  // Tax
  editTax, saveTax,
  // Bank Rules
  brToggleMenu, brOpenModal, brSetFilter, brResetFilters,
  brToggleActive, brSave, brDelete, confirmBrDelete,
  brOnVendorChange, brUpdateSubCats,
  // Hub
  hubSetBrand,
  // Bank Map
  bmSetTab, bmMarkDirty, bmSave, bmSetBrand,
  // Linked
  lcAdd, lcEdit, saveLc,
  // Loans
  lnSetTab, lnNewLoanModal, confirmNewLoan,
  lnEditLoan, confirmEditLoan,
  lnRepayModal, confirmRepay,
  lnEquityModal, confirmEquity,
  // Journal
  jnNewEntry, jnAddLine, jnRemoveLine, jnLineChange, jnBackToList, jnSave,
});

})();
