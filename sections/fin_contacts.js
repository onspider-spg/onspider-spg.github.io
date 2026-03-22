/**
 * SPG HUB v1.0.0 | 23 MAR 2026 | Siam Palette Group
 * sections/fin_contacts.js — Finance Module (Contact Screens)
 * 3 routes: contacts, ct-detail, ct-create
 * Depends on: fin_core.js (FIN global)
 */

(() => {
const S = FIN.S;
const esc = FIN.esc;
const ui = SPG.ui;
const fm = FIN.fmtAud;
const fd = FIN.fmtDate;

const TW = 'max-width:1000px;margin:0 auto';

// ── Local state ──
let _contacts = [];
let _typeFilter = 'All';
let _searchQ = '';
let _showInactive = false;
let _editing = null;
let _detailTab = 'info';
let _detailTxns = [];
let _detailBalance = null;
let _saving = false;

function _sectionHdr(label) {
  return `<div style="font-size:var(--fs-body);font-weight:700;color:var(--acc);margin:16px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--bd2)">${esc(label)}</div>`;
}

function _statusBadge(status) {
  const map = { paid: 'sts-ok', unpaid: 'sts-err', overdue: 'sts-err', partial: 'sts-warn', draft: 'sts-warn' };
  const cls = map[(status || '').toLowerCase()] || 'sts-neutral';
  const label = (status || '').charAt(0).toUpperCase() + (status || '').slice(1);
  return `<span class="sts ${cls}">${esc(label)}</span>`;
}

// ═══════════════════════════════════════
// 1. CONTACTS LIST
// ═══════════════════════════════════════

function renderContacts() {
  _typeFilter = 'All';
  _searchQ = '';
  _showInactive = false;

  const actions = `<button class="btn-primary" onclick="SPG.go('finance/ct-create')">Create contact</button>`;

  return SPG.shell(SPG.toolbar('Contacts', actions) + `<div class="content" id="fin-contacts"><div style="${TW}">
    <div class="card">
      <div style="display:flex;gap:8px;margin-bottom:10px;align-items:flex-end;flex-wrap:wrap">
        <div><div class="fl-label">Contact type</div><select class="fl" id="ct_type" onchange="FinanceSection.onTypeFilter(this.value)"><option value="All">All</option><option value="Supplier">Supplier</option><option value="Customer">Customer</option><option value="Personal">Personal</option></select></div>
        <div><div class="fl-label">Search</div><input class="fl" id="ct_search" placeholder="Search..." style="width:160px" oninput="FinanceSection.onSearch(this.value)"></div>
        <div style="flex:1"></div>
        <label style="font-size:var(--fs-xs);display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="ct_inactive" onchange="FinanceSection.toggleInactive(this.checked)"> Show inactive</label>
        <a class="lk" style="font-size:var(--fs-xs);cursor:pointer" onclick="FinanceSection.resetCtFilters()">Reset</a>
      </div>
      <div class="tbl-wrap">
        <table class="tbl" id="ct_tbl">
          <thead><tr>
            ${ui.sortTh('ct_tbl','name','Name')}${ui.sortTh('ct_tbl','cid','Contact ID')}${ui.sortTh('ct_tbl','type','Type')}${ui.sortTh('ct_tbl','desig','Designation')}
            ${ui.sortTh('ct_tbl','phone','Phone')}${ui.sortTh('ct_tbl','email','Email')}
            ${ui.sortTh('ct_tbl','balance','Balance due ($)',' style="text-align:right"')}
            ${ui.sortTh('ct_tbl','overdue','Overdue ($)',' style="text-align:right"')}
          </tr></thead>
          <tbody id="ct_tbody">${ui.skeleton(60, 1)}</tbody>
        </table>
      </div>
      <div id="ct_count" style="font-size:var(--fs-xs);color:var(--t3);margin-top:6px"></div>
    </div>
  </div></div>`, 'Finance');
}

async function loadContacts() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _fetchContacts();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

async function _fetchContacts() {
  try {
    const result = await FIN.api('get_contacts', {
      type_filter: _typeFilter,
      search: _searchQ,
      show_inactive: _showInactive,
    });
    _contacts = result.rows || result || [];
    _renderContactRows();
  } catch (e) {
    const tbody = document.getElementById('ct_tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--r)">Error: ${esc(e.message)}</td></tr>`;
  }
}

function _renderContactRows() {
  const tbody = document.getElementById('ct_tbody');
  const countEl = document.getElementById('ct_count');
  if (!tbody) return;

  if (_contacts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--t3)">No contacts found</td></tr>';
    if (countEl) countEl.textContent = '0 contacts';
    return;
  }

  tbody.innerHTML = _contacts.map(c => {
    const inactive = !c.is_active ? 'opacity:0.45' : '';
    const balStyle = (c.balance_due || 0) > 0 ? 'font-weight:600' : '';
    const overdueStyle = (c.overdue || 0) > 0 ? 'color:var(--r)' : '';
    return `<tr style="cursor:pointer;${inactive}" onclick="FinanceSection.goCtDetail('${c.id}')">
      <td><a class="lk">${esc(c.vendor_name || c.name)}</a></td>
      <td>${esc(c.contact_id || '')}</td>
      <td>${esc(c.vendor_type || 'Supplier')}</td>
      <td>${esc(c.designation || 'Company')}</td>
      <td style="white-space:nowrap">${esc(c.phone || '')}</td>
      <td style="font-size:var(--fs-xs)">${esc(c.email || '')}</td>
      <td style="text-align:right;${balStyle}">${(c.balance_due || 0).toFixed(2)}</td>
      <td style="text-align:right;${overdueStyle}">${(c.overdue || 0).toFixed(2)}</td>
    </tr>`;
  }).join('');

  if (countEl) countEl.textContent = `Showing ${_contacts.length} contacts`;
}

// ── List filters ──
function _onTypeFilter(val) {
  _typeFilter = val;
  _fetchContacts();
}

function _onSearch(val) {
  _searchQ = val;
  clearTimeout(_onSearch._t);
  _onSearch._t = setTimeout(() => _fetchContacts(), 300);
}

function _toggleInactive(checked) {
  _showInactive = checked;
  _fetchContacts();
}

function _resetCtFilters() {
  _typeFilter = 'All';
  _searchQ = '';
  _showInactive = false;
  const selType = document.getElementById('ct_type');
  const inputSearch = document.getElementById('ct_search');
  const chkInactive = document.getElementById('ct_inactive');
  if (selType) selType.value = 'All';
  if (inputSearch) inputSearch.value = '';
  if (chkInactive) chkInactive.checked = false;
  _fetchContacts();
}

function _goCtDetail(id) {
  _editing = _contacts.find(c => c.id === id) || null;
  _detailTab = 'info';
  SPG.go('finance/ct-detail');
}

// ═══════════════════════════════════════
// 2. CONTACT DETAIL — 3 tabs
// ═══════════════════════════════════════

function renderCtDetail() {
  if (!_editing) {
    const actions = `<button class="btn-outline" onclick="SPG.go('finance/contacts')">Back</button>`;
    return SPG.shell(SPG.toolbar('Contact Detail', actions) + `<div class="content" id="fin-ct-detail"><div class="empty" style="padding:40px">No contact selected</div></div>`, 'Finance');
  }
  const c = _editing;
  const actions = `<button class="btn-outline" onclick="SPG.go('finance/contacts')">Back</button><button class="btn-outline" style="color:var(--r);border-color:var(--r)" onclick="FinanceSection.deleteContact('${c.id}')">Delete</button><button class="btn-primary" id="ct_save_btn" onclick="FinanceSection.saveContact('${c.id}', this)">Save</button>`;

  return SPG.shell(SPG.toolbar('Contact Detail', actions) + `<div class="content" id="fin-ct-detail"><div style="max-width:800px;margin:0 auto">
    ${_renderDetailHeader(c)}
    <div style="background:var(--bg);border-left:1px solid var(--bd);border-right:1px solid var(--bd);padding:0 16px">
      <div class="tabs" style="margin:0" id="ct_tabs">
        <div class="tab${_detailTab === 'info' ? ' a' : ''}" onclick="FinanceSection.showCtTab('info')">Details</div>
        <div class="tab${_detailTab === 'txn' ? ' a' : ''}" onclick="FinanceSection.showCtTab('txn')">Transactions</div>
        <div class="tab${_detailTab === 'balance' ? ' a' : ''}" onclick="FinanceSection.showCtTab('balance')">Balance</div>
      </div>
    </div>
    <div id="ct_tab_content"></div>
  </div></div>`, 'Finance');
}

function _renderDetailHeader(c) {
  const statusCls = c.is_active !== false ? 'sts-ok' : 'sts-err';
  const statusTxt = c.is_active !== false ? 'Active' : 'Inactive';
  return `<div class="card" style="margin-bottom:0;border-bottom:none;border-radius:var(--rd-lg) var(--rd-lg) 0 0">
    <div style="display:flex;gap:14px;align-items:center">
      <div style="width:48px;height:48px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--t4);flex-shrink:0">&#127970;</div>
      <div style="flex:1">
        <div style="font-size:16px;font-weight:700">${esc(c.vendor_name || c.name)}</div>
        <div style="font-size:var(--fs-xs);color:var(--t3)">${esc(c.vendor_type || 'Supplier')} · ${esc(c.designation || 'Company')} · ${esc(c.contact_id || '\u2014')}</div>
      </div>
      <div style="text-align:right">
        <span class="sts ${statusCls}">${statusTxt}</span>
        ${c.abn ? `<div style="font-size:var(--fs-xxs);color:var(--t3);margin-top:4px">ABN: ${esc(c.abn)}</div>` : ''}
      </div>
    </div>
  </div>`;
}

async function loadCtDetail() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    if (!_editing) return;
    _showTabContent(_detailTab);
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

// ── Tab switching ──
function _showCtTab(tab) {
  _detailTab = tab;
  document.querySelectorAll('#ct_tabs .tab').forEach(el => el.classList.remove('a'));
  const tabs = document.querySelectorAll('#ct_tabs .tab');
  const idx = tab === 'info' ? 0 : tab === 'txn' ? 1 : 2;
  if (tabs[idx]) tabs[idx].classList.add('a');
  _showTabContent(tab);
}

async function _showTabContent(tab) {
  const el = document.getElementById('ct_tab_content');
  if (!el || !_editing) return;

  if (tab === 'info') {
    el.innerHTML = _renderInfoTab(_editing);
  } else if (tab === 'txn') {
    el.innerHTML = `<div class="card" style="border-radius:0 0 var(--rd-lg) var(--rd-lg);border-top:none"><div style="padding:20px;text-align:center;color:var(--t3)">Loading transactions...</div></div>`;
    await _loadDetailTxns();
  } else if (tab === 'balance') {
    el.innerHTML = `<div class="card" style="border-radius:0 0 var(--rd-lg) var(--rd-lg);border-top:none"><div style="padding:20px;text-align:center;color:var(--t3)">Loading balance...</div></div>`;
    await _loadDetailBalance();
  }
}

// ── Tab 1: Details (editable form) ──
function _renderInfoTab(c) {
  return `<div class="card" style="border-radius:0 0 var(--rd-lg) var(--rd-lg);border-top:none">
    ${_sectionHdr('Details')}
    <div class="fr">
      <div class="fg">
        <label class="lb">Contact Type *</label>
        <div style="display:flex;gap:8px;margin-top:4px">
          ${_radio('ct_vtype', 'Customer', c.vendor_type)}
          ${_radio('ct_vtype', 'Supplier', c.vendor_type)}
          ${_radio('ct_vtype', 'Personal', c.vendor_type)}
        </div>
      </div>
      <div class="fg">
        <label class="lb">Designation</label>
        <div style="display:flex;gap:8px;margin-top:4px">
          ${_radio('ct_desig', 'Company', c.designation)}
          ${_radio('ct_desig', 'Individual', c.designation)}
        </div>
      </div>
    </div>
    <div class="fr" style="margin-top:8px">
      <div class="fg"><label class="lb">Company Name *</label><input class="inp" id="ct_name" value="${esc(c.vendor_name || '')}"></div>
      <div class="fg"><label class="lb">ABN</label><div style="display:flex;gap:6px"><input class="inp" id="ct_abn" value="${esc(c.abn || '')}" style="flex:1"><a class="lk" style="white-space:nowrap;align-self:center;font-size:var(--fs-xs)" href="https://abr.business.gov.au/" target="_blank" rel="noopener">ABN lookup ↗</a></div></div>
    </div>
    <div class="fr" style="margin-top:8px">
      <div class="fg"><label class="lb">Contact ID</label><input class="inp" id="ct_cid" value="${esc(c.contact_id || '')}"></div>
      <div class="fg"><label class="lb">Status</label><div style="margin-top:6px"><label style="font-size:var(--fs-xs);display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="ct_is_inactive" ${c.is_active === false ? 'checked' : ''}> Inactive contact</label></div></div>
    </div>

    ${_sectionHdr('Default Category (for Bills)')}
    <div style="background:var(--bbg);border-radius:var(--rd);padding:6px 8px;font-size:var(--fs-xxs);color:var(--b);margin-bottom:8px">\u2139\uFE0F \u0E15\u0E31\u0E49\u0E07 category \u0E44\u0E27\u0E49\u0E17\u0E35\u0E48\u0E19\u0E35\u0E48 \u0E40\u0E27\u0E25\u0E32\u0E2A\u0E23\u0E49\u0E32\u0E07 Bill \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30 default \u0E43\u0E2B\u0E49\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34</div>
    <div class="fr">
      <div class="fg"><label class="lb">Main Category</label>${_categorySelect('ct_def_main', c.default_main_category)}</div>
      <div class="fg"><label class="lb">Sub Category</label>${_subCategorySelect('ct_def_sub', c.default_main_category, c.default_sub_category)}</div>
    </div>

    ${_sectionHdr('Billing Address')}
    <div class="fg"><label class="lb">Country</label><select class="inp" id="ct_country"><option ${(c.country || 'Australia') === 'Australia' ? 'selected' : ''}>Australia</option><option ${c.country === 'Thailand' ? 'selected' : ''}>Thailand</option></select></div>
    <div class="fg" style="margin-top:8px"><label class="lb">Address</label><input class="inp" id="ct_addr" value="${esc(c.address || '')}"></div>
    <div class="fr" style="margin-top:8px">
      <div class="fg"><label class="lb">Suburb / Town</label><input class="inp" id="ct_suburb" value="${esc(c.suburb || '')}"></div>
      <div class="fg"><label class="lb">State / Territory</label><select class="inp" id="ct_state"><option value="">\u2014</option>${['NSW','VIC','QLD','SA','WA','TAS','NT','ACT'].map(s => `<option ${c.state === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      <div class="fg" style="flex:0.5"><label class="lb">Postcode</label><input class="inp" id="ct_postcode" value="${esc(c.postcode || '')}"></div>
    </div>
    <div class="fr" style="margin-top:8px">
      <div class="fg"><label class="lb">Contact Person</label><input class="inp" id="ct_person" value="${esc(c.contact_person || '')}"></div>
      <div class="fg"><label class="lb">Email</label><input class="inp" id="ct_email" value="${esc(c.email || '')}"></div>
    </div>
    <div class="fr" style="margin-top:8px">
      <div class="fg"><label class="lb">Phone</label><input class="inp" id="ct_phone" value="${esc(c.phone || '')}"></div>
      <div class="fg"><label class="lb">Fax</label><input class="inp" id="ct_fax" value="${esc(c.fax || '')}"></div>
    </div>
    <div class="fg" style="margin-top:8px"><label class="lb">Website</label><input class="inp" id="ct_website" value="${esc(c.website || '')}"></div>

    ${_sectionHdr('Bank Details')}
    <div class="fr">
      <div class="fg"><label class="lb">BSB Number</label><input class="inp" id="ct_bsb" value="${esc(c.bsb || '')}"></div>
      <div class="fg"><label class="lb">Bank Account Number</label><input class="inp" id="ct_banknum" value="${esc(c.bank_account_number || '')}"></div>
      <div class="fg"><label class="lb">Bank Account Name</label><input class="inp" id="ct_bankname" value="${esc(c.bank_account_name || '')}"></div>
    </div>
    <div class="fr" style="margin-top:8px">
      <div class="fg"><label class="lb">Statement Text</label><input class="inp" id="ct_stmttxt" value="${esc(c.statement_text || '')}"></div>
      <div class="fg"><label class="lb">Remittance Advice Email</label><input class="inp" id="ct_remit" value="${esc(c.remittance_email || '')}"></div>
    </div>

    ${_sectionHdr('More Information')}
    <div class="fg"><label class="lb">Notes</label><textarea class="inp" id="ct_notes" style="min-height:60px;resize:vertical">${esc(c.notes || '')}</textarea></div>
  </div>`;
}

// ── Tab 2: Transactions ──
async function _loadDetailTxns() {
  const el = document.getElementById('ct_tab_content');
  if (!el || !_editing) return;

  try {
    const result = await FIN.api('get_contact_detail', {
      vendor_id: _editing.id,
      section: 'transactions',
    });
    _detailTxns = result.transactions || result.rows || [];
    const totals = result.totals || {};

    let html = `<div class="card" style="border-radius:0 0 var(--rd-lg) var(--rd-lg);border-top:none">
      <div class="tbl-wrap"><table class="tbl" id="ct_txn_tbl">
        <thead><tr>${ui.sortTh('ct_txn_tbl','date','Date')}${ui.sortTh('ct_txn_tbl','bill','Bill No')}${ui.sortTh('ct_txn_tbl','inv','Invoice No')}${ui.sortTh('ct_txn_tbl','desc','Description')}${ui.sortTh('ct_txn_tbl','amount','Amount',' style="text-align:right"')}${ui.sortTh('ct_txn_tbl','balance','Balance',' style="text-align:right"')}${ui.sortTh('ct_txn_tbl','status','Status')}</tr></thead>
        <tbody>`;

    if (_detailTxns.length === 0) {
      html += '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--t3)">No transactions found</td></tr>';
    } else {
      html += _detailTxns.map(t => {
        const balColor = (t.balance || 0) > 0 ? 'color:var(--r);font-weight:600' : 'color:var(--g)';
        const rowBg = t.status === 'Overdue' || (t.balance || 0) > 0 ? 'background:var(--rbg)' : '';
        return `<tr style="${rowBg}">
          <td>${fd(t.date || t.issue_date)}</td>
          <td><a class="lk" onclick="SPG.go('finance/tx-bill-detail');return false">${esc(t.bill_no || '')}</a></td>
          <td>${esc(t.inv_no || t.supplier_inv_no || '')}</td>
          <td>${esc(t.description || t.notes || '')}</td>
          <td style="text-align:right">${fm(t.amount || t.total_amount)}</td>
          <td style="text-align:right;${balColor}">${fm(t.balance || t.balance_due || 0)}</td>
          <td>${_statusBadge(t.status)}</td>
        </tr>`;
      }).join('');

      // Totals row
      if (totals.total_amount !== undefined) {
        html += `<tr style="border-top:2px solid var(--bd);font-weight:700">
          <td colspan="4">Total</td>
          <td style="text-align:right">${fm(totals.total_amount)}</td>
          <td style="text-align:right;color:var(--r)">${fm(totals.total_balance)}</td>
          <td></td>
        </tr>`;
      }
    }

    html += '</tbody></table></div></div>';
    el.innerHTML = html;
  } catch (e) {
    el.innerHTML = `<div class="card" style="border-radius:0 0 var(--rd-lg) var(--rd-lg);border-top:none"><div style="padding:20px;color:var(--r)">${esc(e.message)}</div></div>`;
  }
}

// ── Tab 3: Balance ──
async function _loadDetailBalance() {
  const el = document.getElementById('ct_tab_content');
  if (!el || !_editing) return;

  try {
    const result = await FIN.api('get_contact_detail', {
      vendor_id: _editing.id,
      section: 'balance',
    });
    _detailBalance = result;

    const bal = result.balance_due || 0;
    const overdue = result.overdue || 0;
    const paid = result.total_paid || 0;
    const aging = result.aging || {};

    el.innerHTML = `<div class="card" style="border-radius:0 0 var(--rd-lg) var(--rd-lg);border-top:none">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
        <div class="card" style="margin:0;border-top:3px solid var(--r);text-align:center">
          <div style="font-size:var(--fs-xs);color:var(--t3)">Balance Due</div>
          <div style="font-size:24px;font-weight:800;color:var(--r)">${fm(bal)}</div>
        </div>
        <div class="card" style="margin:0;border-top:3px solid ${overdue > 0 ? 'var(--r)' : 'var(--g)'};text-align:center">
          <div style="font-size:var(--fs-xs);color:var(--t3)">Overdue</div>
          <div style="font-size:24px;font-weight:800;color:${overdue > 0 ? 'var(--r)' : 'var(--t1)'}">${fm(overdue)}</div>
          ${result.overdue_count ? `<div style="font-size:var(--fs-xxs);color:var(--t3)">${result.overdue_count} bill${result.overdue_count > 1 ? 's' : ''}</div>` : ''}
        </div>
        <div class="card" style="margin:0;border-top:3px solid var(--g);text-align:center">
          <div style="font-size:var(--fs-xs);color:var(--t3)">Total Paid (YTD)</div>
          <div style="font-size:24px;font-weight:800">${fm(paid)}</div>
        </div>
      </div>

      <div style="font-size:var(--fs-body);font-weight:700;margin-bottom:6px">Aging Summary</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <div style="flex:1;padding:8px;background:var(--gbg);border-radius:var(--rd);text-align:center">
          <div style="font-size:14px;font-weight:700">${fm(aging.current || 0)}</div>
          <div style="font-size:var(--fs-xxs);color:var(--g)">Current</div>
        </div>
        <div style="flex:1;padding:8px;background:var(--obg);border-radius:var(--rd);text-align:center">
          <div style="font-size:14px;font-weight:700">${fm(aging.d31_60 || 0)}</div>
          <div style="font-size:var(--fs-xxs);color:var(--o)">31-60d</div>
        </div>
        <div style="flex:1;padding:8px;background:var(--rbg);border-radius:var(--rd);text-align:center">
          <div style="font-size:14px;font-weight:700;color:var(--r)">${fm(aging.d60_plus || 0)}</div>
          <div style="font-size:var(--fs-xxs);color:var(--r)">60+ Overdue</div>
        </div>
      </div>

      <div style="font-size:var(--fs-xxs);color:var(--t3)">
        Default payment terms: ${esc(result.payment_terms || 'N/A')}
        ${result.avg_days_to_pay ? ` \u00B7 Average days to pay: ${result.avg_days_to_pay} days` : ''}
      </div>
    </div>`;
  } catch (e) {
    el.innerHTML = `<div class="card" style="border-radius:0 0 var(--rd-lg) var(--rd-lg);border-top:none"><div style="padding:20px;color:var(--r)">${esc(e.message)}</div></div>`;
  }
}

// ═══════════════════════════════════════
// 3. CREATE CONTACT
// ═══════════════════════════════════════

function renderCtCreate() {
  const actions = `<button class="btn-outline" onclick="SPG.go('finance/contacts')">Back</button>`;

  return SPG.shell(SPG.toolbar('Create Contact', actions) + `<div class="content" id="fin-ct-create"><div style="max-width:700px;margin:0 auto"><div class="card">
    ${_sectionHdr('Details')}
    <div class="fr">
      <div class="fg">
        <label class="lb">Contact Type *</label>
        <div style="display:flex;gap:8px;margin-top:4px">
          ${_radio('nc_vtype', 'Customer', 'Supplier')}
          ${_radio('nc_vtype', 'Supplier', 'Supplier')}
          ${_radio('nc_vtype', 'Personal', 'Supplier')}
        </div>
      </div>
      <div class="fg">
        <label class="lb">Designation</label>
        <div style="display:flex;gap:8px;margin-top:4px">
          ${_radio('nc_desig', 'Company', 'Company')}
          ${_radio('nc_desig', 'Individual', 'Company')}
        </div>
      </div>
    </div>
    <div class="fr" style="margin-top:8px">
      <div class="fg"><label class="lb">Company Name / First Name *</label><input class="inp" id="nc_name" placeholder="Company name or first name"></div>
      <div class="fg"><label class="lb">ABN</label><div style="display:flex;gap:6px"><input class="inp" id="nc_abn" placeholder="" style="flex:1"><a class="lk" style="white-space:nowrap;align-self:center;font-size:var(--fs-xs)" href="https://abr.business.gov.au/" target="_blank" rel="noopener">ABN lookup ↗</a></div></div>
    </div>
    <div class="fr" style="margin-top:8px">
      <div class="fg"><label class="lb">Contact ID</label><input class="inp" id="nc_cid" placeholder="Auto-generated or enter"></div>
      <div class="fg"><label class="lb">Status</label><div style="margin-top:6px"><label style="font-size:var(--fs-xs);display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="nc_is_inactive"> Inactive contact</label></div></div>
    </div>

    ${_sectionHdr('Default Category (for Bills)')}
    <div style="background:var(--bbg);border-radius:var(--rd);padding:6px 8px;font-size:var(--fs-xxs);color:var(--b);margin-bottom:8px">\u2139\uFE0F \u0E15\u0E31\u0E49\u0E07 category \u0E44\u0E27\u0E49\u0E17\u0E35\u0E48\u0E19\u0E35\u0E48 \u0E40\u0E27\u0E25\u0E32\u0E2A\u0E23\u0E49\u0E32\u0E07 Bill \u0E23\u0E30\u0E1A\u0E1A\u0E08\u0E30 default \u0E43\u0E2B\u0E49\u0E2D\u0E31\u0E15\u0E42\u0E19\u0E21\u0E31\u0E15\u0E34</div>
    <div class="fr">
      <div class="fg"><label class="lb">Main Category</label>${_categorySelect('nc_def_main', '')}</div>
      <div class="fg"><label class="lb">Sub Category</label>${_subCategorySelect('nc_def_sub', '', '')}</div>
    </div>

    ${_sectionHdr('Billing Address')}
    <div class="fg"><label class="lb">Country</label><select class="inp" id="nc_country"><option selected>Australia</option><option>Thailand</option></select></div>
    <div class="fg" style="margin-top:8px"><label class="lb">Address</label><input class="inp" id="nc_addr" placeholder=""></div>
    <div class="fr" style="margin-top:8px">
      <div class="fg"><label class="lb">Suburb / Town</label><input class="inp" id="nc_suburb"></div>
      <div class="fg"><label class="lb">State / Territory</label><select class="inp" id="nc_state"><option value="">\u2014</option>${['NSW','VIC','QLD','SA','WA','TAS','NT','ACT'].map(s => `<option>${s}</option>`).join('')}</select></div>
      <div class="fg" style="flex:0.5"><label class="lb">Postcode</label><input class="inp" id="nc_postcode"></div>
    </div>
    <div class="fr" style="margin-top:8px">
      <div class="fg"><label class="lb">Contact Person</label><input class="inp" id="nc_person"></div>
      <div class="fg"><label class="lb">Email</label><input class="inp" id="nc_email" placeholder=""></div>
    </div>
    <div class="fr" style="margin-top:8px">
      <div class="fg"><label class="lb">Phone</label><input class="inp" id="nc_phone"></div>
      <div class="fg"><label class="lb">Fax</label><input class="inp" id="nc_fax"></div>
    </div>
    <div class="fg" style="margin-top:8px"><label class="lb">Website</label><input class="inp" id="nc_website"></div>

    ${_sectionHdr('Bank Details')}
    <div class="fr">
      <div class="fg"><label class="lb">BSB Number</label><input class="inp" id="nc_bsb"></div>
      <div class="fg"><label class="lb">Bank Account Number</label><input class="inp" id="nc_banknum"></div>
    </div>
    <div class="fr" style="margin-top:8px">
      <div class="fg"><label class="lb">Bank Account Name</label><input class="inp" id="nc_bankname"></div>
      <div class="fg"><label class="lb">Statement Text</label><input class="inp" id="nc_stmttxt"></div>
    </div>
    <div class="fg" style="margin-top:8px"><label class="lb">Remittance Advice Email</label><input class="inp" id="nc_remit"></div>

    ${_sectionHdr('More Information')}
    <div class="fg"><label class="lb">Notes</label><textarea class="inp" id="nc_notes" style="min-height:60px;resize:vertical" placeholder=""></textarea></div>

    <div style="display:flex;gap:6px;margin-top:14px;justify-content:flex-end;padding-top:10px;border-top:1px solid var(--bd2)">
      <button class="btn-outline" onclick="SPG.go('finance/contacts')">Cancel</button>
      <button class="btn-primary" id="nc_save_btn" onclick="FinanceSection.createContact(this)">Save</button>
    </div>
  </div></div></div>`, 'Finance');
}

async function loadCtCreate() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

// ═══════════════════════════════════════
// SAVE: Create Contact
// ═══════════════════════════════════════

async function _createContact(btnEl) {
  if (_saving || !btnEl || btnEl.disabled) return;
  const name = document.getElementById('nc_name')?.value?.trim();
  if (!name) { SPG.toast('Company Name is required', 'error'); return; }

  _saving = true;
  const origText = btnEl.textContent;
  btnEl.disabled = true;
  btnEl.textContent = 'Saving...';

  try {
    const data = _collectFormData('nc_');
    const result = await FIN.api('create_contact', data);
    SPG.toast('Contact created');
    _editing = result;
    _detailTab = 'info';
    SPG.go('finance/ct-detail');
  } catch (e) {
    SPG.toast(e.message || 'Create failed', 'error');
  } finally {
    _saving = false;
    btnEl.disabled = false;
    btnEl.textContent = origText;
  }
}

// ═══════════════════════════════════════
// SAVE: Update Contact (stale check)
// ═══════════════════════════════════════

async function _saveContact(id, btnEl) {
  if (_saving || !btnEl || btnEl.disabled) return;
  const name = document.getElementById('ct_name')?.value?.trim();
  if (!name) { SPG.toast('Company Name is required', 'error'); return; }

  _saving = true;
  const origText = btnEl.textContent;
  btnEl.disabled = true;
  btnEl.textContent = 'Saving...';

  try {
    const data = _collectFormData('ct_');
    data.id = id;
    if (_editing && _editing.updated_at) {
      data.expected_updated_at = _editing.updated_at;
    }
    const result = await FIN.api('update_contact', data);
    SPG.toast('Contact saved');
    _editing = Object.assign({}, _editing, result || data);
    if (result && result.updated_at) _editing.updated_at = result.updated_at;
  } catch (e) {
    SPG.toast(e.message || 'Save failed', 'error');
  } finally {
    _saving = false;
    btnEl.disabled = false;
    btnEl.textContent = origText;
  }
}

// ═══════════════════════════════════════
// DELETE Contact
// ═══════════════════════════════════════

function _deleteContact(id) {
  SPG.showDialog(`<div class="popup-sheet" style="width:380px">
    <div class="popup-header"><div class="popup-title">Delete Contact</div><button class="popup-close" onclick="SPG.closeDialog()">\u2715</button></div>
    <div style="padding:16px;font-size:var(--fs-sm);color:var(--t2)">Mark this contact as inactive? (Bills and transactions will remain.)</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;padding:0 16px 16px">
      <button class="btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn-danger" onclick="FinanceSection.confirmDeleteContact('${esc(id)}')">Delete</button>
    </div>
  </div>`);
}

async function _confirmDeleteContact(id) {
  SPG.closeDialog();
  try {
    await FIN.api('delete_contact', { id });
    SPG.toast('Contact deleted');
    SPG.go('finance/contacts');
  } catch (e) {
    SPG.toast(e.message || 'Delete failed', 'error');
  }
}

// ═══════════════════════════════════════
// HELPERS — form data collection, radio, dropdown
// ═══════════════════════════════════════

/** Collect form data from prefix (nc_ for create, ct_ for edit) */
function _collectFormData(prefix) {
  const v = (id) => document.getElementById(prefix + id)?.value?.trim() || '';
  const checked = (id) => document.getElementById(prefix + id)?.checked || false;
  const radio = (name) => {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : '';
  };

  return {
    vendor_name: v('name'),
    vendor_type: radio(prefix + 'vtype') || 'Supplier',
    designation: radio(prefix + 'desig') || 'Company',
    contact_id: v('cid') || null,
    abn: v('abn') || null,
    is_active: !checked('is_inactive'),
    // Default category
    default_main_category: v('def_main') || null,
    default_sub_category: v('def_sub') || null,
    // Address
    country: v('country') || 'Australia',
    address: v('addr') || null,
    suburb: v('suburb') || null,
    state: v('state') || null,
    postcode: v('postcode') || null,
    contact_person: v('person') || null,
    email: v('email') || null,
    phone: v('phone') || null,
    fax: v('fax') || null,
    website: v('website') || null,
    // Bank
    bsb: v('bsb') || null,
    bank_account_number: v('banknum') || null,
    bank_account_name: v('bankname') || null,
    statement_text: v('stmttxt') || null,
    remittance_email: v('remit') || null,
    // Notes
    notes: v('notes') || null,
  };
}

/** Radio button helper */
function _radio(name, value, current) {
  const id = name + '_' + value.toLowerCase();
  const chk = value === (current || 'Supplier') ? 'checked' : '';
  return `<label style="display:flex;align-items:center;gap:3px;font-size:var(--fs-xs);cursor:pointer"><input type="radio" name="${name}" id="${id}" value="${esc(value)}" ${chk}> ${esc(value)}</label>`;
}

/** Main category select — uses S.categories from initMaster */
function _categorySelect(id, selected) {
  const cats = S.categories || [];
  const mainSet = new Set();
  cats.forEach(c => {
    if (c.main_category && (c.transaction_type === 'Expense' || c.transaction_type === 'Asset Purchase' || c.transaction_type === 'Income')) {
      mainSet.add(c.main_category);
    }
  });
  const mains = [...mainSet].sort();
  let opts = '<option value="">\u2014 Select \u2014</option>';
  mains.forEach(m => {
    opts += `<option value="${esc(m)}" ${m === selected ? 'selected' : ''}>${esc(m)}</option>`;
  });
  return `<select class="inp" id="${id}" onchange="FinanceSection.onMainCatChange('${id}')">${opts}</select>`;
}

/** Sub category select — filtered by main_category */
function _subCategorySelect(id, mainCat, selected) {
  const cats = S.categories || [];
  const subs = cats.filter(c => c.main_category === mainCat).map(c => c.sub_category).filter(Boolean);
  let opts = '<option value="">\u2014 Select main first \u2014</option>';
  subs.forEach(s => {
    opts += `<option value="${esc(s)}" ${s === selected ? 'selected' : ''}>${esc(s)}</option>`;
  });
  return `<select class="inp" id="${id}">${opts}</select>`;
}

/** When main category changes -> update sub category dropdown */
function _onMainCatChange(mainId) {
  const subId = mainId.replace('_main', '_sub');
  const mainVal = document.getElementById(mainId)?.value || '';
  const subEl = document.getElementById(subId);
  if (!subEl) return;
  const cats = S.categories || [];
  const subs = cats.filter(c => c.main_category === mainVal).map(c => c.sub_category).filter(Boolean);
  let opts = '<option value="">\u2014 Select \u2014</option>';
  subs.forEach(s => { opts += `<option value="${esc(s)}">${esc(s)}</option>`; });
  subEl.innerHTML = opts;
}

// ═══════════════════════════════════════
// EXPOSE — FIN render/load + FinanceSection onclick
// ═══════════════════════════════════════
FIN.renderContacts = renderContacts;   FIN.loadContacts = loadContacts;
FIN.renderCtDetail = renderCtDetail;   FIN.loadCtDetail = loadCtDetail;
FIN.renderCtCreate = renderCtCreate;   FIN.loadCtCreate = loadCtCreate;

Object.assign(window.FinanceSection, {
  // List filters
  onTypeFilter: _onTypeFilter,
  onSearch: _onSearch,
  toggleInactive: _toggleInactive,
  resetCtFilters: _resetCtFilters,
  goCtDetail: _goCtDetail,
  // Detail tabs
  showCtTab: _showCtTab,
  saveContact: _saveContact,
  deleteContact: _deleteContact,
  confirmDeleteContact: _confirmDeleteContact,
  // Create
  createContact: _createContact,
  // Category helper
  onMainCatChange: _onMainCatChange,
});

})();
