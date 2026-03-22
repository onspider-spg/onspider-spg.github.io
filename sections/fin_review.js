/**
 * SPG HUB v1.0.0 | 23 MAR 2026 | Siam Palette Group
 * sections/fin_review.js — Finance Module (Review Screens)
 * 3 routes: rv-pending, rv-recurring, rv-expected
 * Depends on: fin_core.js (FIN global)
 */

(() => {
const S = FIN.S;
const esc = FIN.esc;
const ui = SPG.ui;
const fm = FIN.fmtAud;
const fd = FIN.fmtDate;

const TW = 'max-width:1060px;margin:0 auto';

// ── Local state (not in S — screen-level only) ──
let _pendingFilter = 'all'; // all | overdue | due_soon
let _filterMonth = '';
let _filterBrand = '';

// ═══════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════

/** Short money format: 1.2M / 45K / 300 */
function _fmtShort(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return Math.round(n / 1000) + 'K';
  return String(n);
}

/** Days difference from dateStr to today (positive = past due) */
function _daysDiff(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr + 'T00:00:00');
  const now = FIN.sydneyNow();
  now.setHours(0, 0, 0, 0);
  return Math.round((now - d) / 86400000);
}

/** Ordinal suffix: 1st, 2nd, 3rd, 4th... */
function _ordSuffix(n) {
  if (n >= 11 && n <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st'; case 2: return 'nd'; case 3: return 'rd'; default: return 'th';
  }
}

/** Brand filter options */
function _brandFilterOpts() {
  return '<option value="">All Brands</option>' + FIN.brandOpts('');
}

// ═══════════════════════════════════════
// SHARED: KPI bar (4 cards)
// ═══════════════════════════════════════
function _kpiBar(active) {
  const kpi = S._rvKpi;
  const items = [
    { id: 'rv-pending',   val: kpi.missing   || 0, label: 'Missing Bills',     color: 'var(--red)',  bg: 'var(--red-bg)' },
    { id: 'rv-recurring', val: kpi.recurring  || 0, label: 'Recurring Rules',   color: 'var(--t1)',   bg: '#fff' },
    { id: 'rv-expected',  val: kpi.expected   || 0, label: 'Expected Invoices', color: 'var(--blue)', bg: '#fff' },
    { id: '_gap',         val: '$' + _fmtShort(kpi.pnlGap || 0), label: 'Est. P&L Gap', color: 'var(--red)', bg: 'var(--red-bg)' },
  ];
  return '<div style="display:flex;gap:0;border-radius:var(--rd);overflow:hidden;border:1px solid var(--bd)">'
    + items.map(k => {
      const isActive = k.id === active;
      const bgStyle = isActive ? 'background:' + (k.id === 'rv-recurring' ? 'var(--acc2)' : k.bg) : 'background:#fff';
      const valColor = isActive && k.id === 'rv-recurring' ? 'var(--acc)' : k.color;
      const lblColor = isActive && k.id === 'rv-recurring' ? 'var(--acc)' : (isActive ? k.color : 'var(--t3)');
      const clickable = k.id !== '_gap' ? ` cursor:pointer" onclick="SPG.go('finance/${k.id}')` : '"';
      return `<div style="flex:1;padding:10px 14px;text-align:center;${bgStyle};${clickable}>`
        + `<div style="font-size:var(--fs-kpi-md);font-weight:800;color:${valColor}">${typeof k.val === 'number' ? k.val : k.val}</div>`
        + `<div style="font-size:var(--fs-xs);color:${lblColor}">${k.label}</div>`
        + '</div>';
    }).join('')
    + '</div>';
}

// ═══════════════════════════════════════
// SHARED: Tabs (Pending / Recurring / Expected)
// ═══════════════════════════════════════
function _tabs(active) {
  const tabs = [
    { id: 'rv-pending',   label: 'Pending Tracker' },
    { id: 'rv-recurring', label: 'Recurring Setup' },
    { id: 'rv-expected',  label: 'Expected Invoices' },
  ];
  return '<div class="tabs">'
    + tabs.map(t =>
      `<div class="tab${t.id === active ? ' a' : ''}" onclick="SPG.go('finance/${t.id}')">${esc(t.label)}</div>`
    ).join('')
    + '</div>';
}

// ═══════════════════════════════════════
// SHARED: Toolbar actions per screen
// ═══════════════════════════════════════
function _toolbarActions(active) {
  const monthFilter = `<select class="fl" id="rv_month" onchange="FinanceSection.setRvMonth(this.value)"><option value="">All Months</option></select>`;
  const brandFilter = `<select class="fl" id="rv_brand" onchange="FinanceSection.setRvBrand(this.value)"><option value="">All Brands</option></select>`;

  let btns = '';
  if (active === 'rv-pending') {
    btns = `<button class="btn-outline" onclick="SPG.go('finance/rv-expected')">+ Expected Invoice</button><button class="btn-primary" onclick="SPG.go('finance/rv-recurring')">+ Recurring Rule</button>`;
  } else if (active === 'rv-recurring') {
    btns = `<button class="btn-primary" onclick="FinanceSection.createRecurring()">+ Create Recurring Rule</button>`;
  } else {
    btns = `<button class="btn-primary" onclick="FinanceSection.createExpected()">+ Add Expected Invoice</button>`;
  }

  return monthFilter + brandFilter + btns;
}


// ═══════════════════════════════════════
// 1. PENDING TRACKER (rv-pending)
// ═══════════════════════════════════════

function renderRvPending() {
  const actions = _toolbarActions('rv-pending');

  return SPG.shell(SPG.toolbar('Review Monitor', actions) + `<div class="content" id="fin-rv-pending"><div style="${TW}">
    ${_kpiBar('rv-pending')}
    ${_tabs('rv-pending')}
    <div style="display:flex;gap:4px;margin-bottom:8px">
      <button class="btn-outline rv-chip${_pendingFilter === 'all' ? ' rv-chip-a' : ''}" onclick="FinanceSection.filterPending('all')" id="rv_chip_all">All</button>
      <button class="btn-outline rv-chip${_pendingFilter === 'overdue' ? ' rv-chip-a' : ''}" onclick="FinanceSection.filterPending('overdue')" id="rv_chip_overdue">Overdue</button>
      <button class="btn-outline rv-chip${_pendingFilter === 'due_soon' ? ' rv-chip-a' : ''}" onclick="FinanceSection.filterPending('due_soon')" id="rv_chip_due_soon">Due soon</button>
    </div>
    <div class="card" style="padding:0;overflow:hidden;margin:0">
      <div class="tbl-wrap"><table class="tbl" id="rv_pend_tbl"><thead><tr>
        ${ui.sortTh('rv_pend_tbl', 'source', 'Source')}${ui.sortTh('rv_pend_tbl', 'vendor', 'Vendor')}${ui.sortTh('rv_pend_tbl', 'item', 'Expected Item')}${ui.sortTh('rv_pend_tbl', 'freq', 'Frequency')}
        ${ui.sortTh('rv_pend_tbl', 'est', 'Est. $', 'r')}${ui.sortTh('rv_pend_tbl', 'due', 'Due')}${ui.sortTh('rv_pend_tbl', 'status', 'Status')}<th>Action</th>
      </tr></thead>
      <tbody id="rv_pending_body">${ui.skeleton(60, 1)}</tbody>
      </table></div>
    </div>
  </div></div>`, 'Finance');
}

async function loadRvPending() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadReviewData('rv-pending');
    _renderPendingRows();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

function _renderPendingRows() {
  const tbody = document.getElementById('rv_pending_body');
  if (!tbody) return;

  // Filter
  let rows = S._pendingRows;
  if (_pendingFilter === 'overdue') rows = rows.filter(r => r.days_late > 0);
  else if (_pendingFilter === 'due_soon') rows = rows.filter(r => r.days_late <= 0 && r.days_until_due <= 7);

  // Update chip counts
  const allCount = S._pendingRows.length;
  const overdueCount = S._pendingRows.filter(r => r.days_late > 0).length;
  const dueSoonCount = S._pendingRows.filter(r => r.days_late <= 0 && r.days_until_due <= 7).length;
  const chipAll = document.getElementById('rv_chip_all');
  const chipOver = document.getElementById('rv_chip_overdue');
  const chipDue = document.getElementById('rv_chip_due_soon');
  if (chipAll) chipAll.textContent = `All (${allCount})`;
  if (chipOver) chipOver.textContent = `Overdue (${overdueCount})`;
  if (chipDue) chipDue.textContent = `Due soon (${dueSoonCount})`;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--t3)">No pending items</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const isOverdue = r.days_late > 0;
    const isDueSoon = !isOverdue && r.days_until_due <= 7 && r.days_until_due >= 0;
    const rowBg = isOverdue ? 'background:var(--red-bg)' : '';

    // Source badge
    const srcBadge = r.source === 'recurring'
      ? '<span class="sts-warn" style="font-size:var(--fs-xs);padding:1px 6px;border-radius:3px">Recurring</span>'
      : r.source === 'pattern'
        ? '<span style="font-size:var(--fs-xs);color:var(--blue);border:1px solid var(--blue);padding:1px 6px;border-radius:3px">Pattern</span>'
        : '<span style="font-size:var(--fs-xs);color:var(--t3);border:1px solid var(--bd);padding:1px 6px;border-radius:3px">Expected</span>';

    // Status badge
    let stsBadge;
    if (isOverdue) {
      stsBadge = `<span class="sts-err">${r.days_late} days late</span>`;
    } else if (isDueSoon) {
      stsBadge = `<span class="sts-warn">Due in ${r.days_until_due}d</span>`;
    } else {
      stsBadge = '<span class="sts-ok">On time</span>';
    }

    // Action
    let actionHtml = '';
    if (isOverdue && r.days_late > 3) {
      actionHtml = `<button class="btn-primary" style="padding:3px 8px;font-size:var(--fs-xs)" onclick="FinanceSection.createBillFrom('${r.rule_id || ''}','${r.expected_id || ''}')">Create Bill</button>`;
    } else if (isOverdue) {
      actionHtml = `<button class="btn-outline" style="padding:3px 8px;font-size:var(--fs-xs);color:var(--red);border-color:var(--red)">Chase</button>`;
    }

    return `<tr style="${rowBg}">
      <td>${srcBadge}</td>
      <td style="font-weight:600">${esc(r.vendor_name)}</td>
      <td>${esc(r.item_description)}</td>
      <td>${esc(r.frequency)}</td>
      <td style="text-align:right">~${fm(r.est_amount)}</td>
      <td style="color:${isOverdue ? 'var(--red)' : isDueSoon ? 'var(--orange)' : 'var(--t1)'}">${fd(r.due_date)}</td>
      <td>${stsBadge}</td>
      <td>${actionHtml}</td>
    </tr>`;
  }).join('');
}


// ═══════════════════════════════════════
// 2. RECURRING SETUP (rv-recurring)
// ═══════════════════════════════════════

function renderRvRecurring() {
  const actions = _toolbarActions('rv-recurring');

  return SPG.shell(SPG.toolbar('Review Monitor', actions) + `<div class="content" id="fin-rv-recurring"><div style="${TW}">
    ${_kpiBar('rv-recurring')}
    ${_tabs('rv-recurring')}
    <div class="card" style="padding:0;overflow:hidden;margin:0">
      <div class="tbl-wrap"><table class="tbl" id="rv_rec_tbl"><thead><tr>
        ${ui.sortTh('rv_rec_tbl', 'vendor', 'Vendor')}${ui.sortTh('rv_rec_tbl', 'item', 'Item')}${ui.sortTh('rv_rec_tbl', 'freq', 'Frequency')}
        ${ui.sortTh('rv_rec_tbl', 'est', 'Est. Amount', 'r')}${ui.sortTh('rv_rec_tbl', 'due', 'Next Due')}
        ${ui.sortTh('rv_rec_tbl', 'lastmatch', 'Last Matched Bill')}${ui.sortTh('rv_rec_tbl', 'status', 'Status')}<th></th>
      </tr></thead>
      <tbody id="rv_recurring_body">${ui.skeleton(60, 1)}</tbody>
      </table></div>
    </div>
    <div style="font-size:var(--fs-xs);color:var(--t3);margin-top:8px">"Last Matched Bill" = system auto-checks if a bill from this vendor arrived within the expected window. If not → MISSING.</div>
  </div></div>`, 'Finance');
}

async function loadRvRecurring() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await Promise.all([
      _loadReviewData('rv-recurring'),
      _loadRecurringList(),
    ]);
    _renderRecurringRows();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

function _renderRecurringRows() {
  const tbody = document.getElementById('rv_recurring_body');
  if (!tbody) return;

  if (S._recurringRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--t3)">No recurring rules yet. Click "+ Create Recurring Rule" to add one.</td></tr>`;
    return;
  }

  tbody.innerHTML = S._recurringRows.map(r => {
    const days = _daysDiff(r.next_due_date);
    const isLate = days > 0;
    const isMissing = isLate && !r.last_matched_recent;

    // Status
    let stsBadge;
    if (isMissing) stsBadge = '<span class="sts-err">MISSING</span>';
    else if (isLate) stsBadge = `<span class="sts-warn">${days} days late</span>`;
    else stsBadge = '<span class="sts-ok">On time</span>';

    // Last matched bill info
    const lastMatch = r.last_matched_ref
      ? `<span style="font-size:var(--fs-xs)">${esc(r.last_matched_ref)} · ${fd(r.last_matched_date)} · ${fm(r.last_matched_amount || 0)}</span>`
      : '<span style="font-size:var(--fs-xs);color:var(--t3)">—</span>';

    // Frequency display
    const freqDisplay = r.frequency === 'monthly' && r.day_of_month
      ? `Monthly (${r.day_of_month}${_ordSuffix(r.day_of_month)})`
      : r.frequency === 'weekly' && r.day_of_week != null
        ? `Weekly (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][r.day_of_week]})`
        : r.frequency.charAt(0).toUpperCase() + r.frequency.slice(1);

    return `<tr>
      <td style="font-weight:600">${esc(r.vendor_name)}</td>
      <td>${esc(r.item_description)}</td>
      <td>${esc(freqDisplay)}</td>
      <td style="text-align:right">${r.est_amount > 0 ? '~' + fm(r.est_amount) : '—'}</td>
      <td style="color:${isLate ? 'var(--red)' : 'var(--t1)'}">${fd(r.next_due_date)}</td>
      <td>${lastMatch}</td>
      <td>${stsBadge}</td>
      <td><a class="lk" style="font-size:var(--fs-xs)" onclick="FinanceSection.editRecurring('${r.id}')">Edit</a></td>
    </tr>`;
  }).join('');
}


// ═══════════════════════════════════════
// 3. EXPECTED INVOICES (rv-expected)
// ═══════════════════════════════════════

function renderRvExpected() {
  const actions = _toolbarActions('rv-expected');

  return SPG.shell(SPG.toolbar('Review Monitor', actions) + `<div class="content" id="fin-rv-expected"><div style="${TW}">
    ${_kpiBar('rv-expected')}
    ${_tabs('rv-expected')}
    <div class="card" style="padding:0;overflow:hidden;margin:0">
      <div class="tbl-wrap"><table class="tbl" id="rv_exp_tbl"><thead><tr>
        ${ui.sortTh('rv_exp_tbl', 'created', 'Created')}${ui.sortTh('rv_exp_tbl', 'by', 'By')}${ui.sortTh('rv_exp_tbl', 'vendor', 'Vendor')}${ui.sortTh('rv_exp_tbl', 'desc', 'Description')}
        ${ui.sortTh('rv_exp_tbl', 'est', 'Est. $', 'r')}${ui.sortTh('rv_exp_tbl', 'expdate', 'Expected Date')}
        ${ui.sortTh('rv_exp_tbl', 'days', 'Days Waiting')}${ui.sortTh('rv_exp_tbl', 'resp', 'Responsible')}${ui.sortTh('rv_exp_tbl', 'status', 'Status')}<th>Action</th>
      </tr></thead>
      <tbody id="rv_expected_body">${ui.skeleton(60, 1)}</tbody>
      </table></div>
    </div>
    <div style="font-size:var(--fs-xs);color:var(--t3);margin-top:8px">Staff creates expected invoices when work is done but invoice not yet received. System alerts when overdue.</div>
  </div></div>`, 'Finance');
}

async function loadRvExpected() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await Promise.all([
      _loadReviewData('rv-expected'),
      _loadExpectedList(),
    ]);
    _renderExpectedRows();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

function _renderExpectedRows() {
  const tbody = document.getElementById('rv_expected_body');
  if (!tbody) return;

  const active = S._expectedRows.filter(r => r.status !== 'received' && r.status !== 'cancelled');

  if (active.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--t3)">No expected invoices. Click "+ Add Expected Invoice" to add one.</td></tr>`;
    return;
  }

  tbody.innerHTML = active.map(r => {
    const days = _daysDiff(r.expected_date);
    const isOverdue = days > 0;

    // Status
    let stsBadge;
    if (r.status === 'overdue' || isOverdue) stsBadge = '<span class="sts-err">Overdue</span>';
    else stsBadge = '<span class="sts-warn">Waiting</span>';

    // Action
    const actionHtml = isOverdue
      ? `<button class="btn-outline" style="padding:3px 8px;font-size:var(--fs-xs);color:var(--red);border-color:var(--red)" onclick="FinanceSection.chaseExpected('${r.id}')">Chase</button>`
      : '';

    return `<tr>
      <td style="font-size:var(--fs-xs)">${fd(r.created_at ? r.created_at.substring(0, 10) : '')}</td>
      <td>${esc(r.created_by_name || r.created_by || '—')}</td>
      <td style="font-weight:600">${esc(r.vendor_name)}</td>
      <td>${esc(r.description)}</td>
      <td style="text-align:right;font-weight:700">~${fm(r.est_amount)}</td>
      <td>${fd(r.expected_date)}</td>
      <td style="color:${isOverdue ? 'var(--red)' : 'var(--t3)'};font-weight:${isOverdue ? '700' : '400'}">${isOverdue ? days + ' days' : '—'}</td>
      <td>${esc(r.responsible || '—')}</td>
      <td>${stsBadge}</td>
      <td>${actionHtml}</td>
    </tr>`;
  }).join('');
}


// ═══════════════════════════════════════
// DATA LOADING — shared across all 3 screens
// ═══════════════════════════════════════

async function _loadReviewData(activeRoute) {
  try {
    SPG.showLoader();

    const data = await FIN.api('fin_get_review_dashboard', {
      month: _filterMonth || undefined,
      brand: _filterBrand || undefined,
    });

    // Update KPIs in shared state
    S._rvKpi.missing = data.missing_count || 0;
    S._rvKpi.recurring = data.recurring_count || 0;
    S._rvKpi.expected = data.expected_count || 0;
    S._rvKpi.pnlGap = data.pnl_gap || 0;

    // Refresh KPI bar in DOM
    const kpiContainer = document.querySelector('#fin-rv-pending, #fin-rv-recurring, #fin-rv-expected');
    if (kpiContainer) {
      const kpiEl = kpiContainer.querySelector('[style*="border-radius:var(--rd);overflow:hidden;border:1px solid var(--bd)"]');
      if (kpiEl) kpiEl.outerHTML = _kpiBar(activeRoute);
    }

    // Store pending rows
    S._pendingRows = data.pending_items || [];

    // Populate filters
    _populateMonthFilter();
    _populateBrandFilter();

  } catch (e) {
    console.warn('Review dashboard API failed:', e.message);
  } finally {
    SPG.hideLoader();
  }
}

async function _loadRecurringList() {
  try {
    const data = await FIN.api('fin_get_recurring_rules', {
      brand: _filterBrand || undefined,
    });
    S._recurringRows = data.rules || [];
  } catch (e) {
    console.warn('Get recurring rules failed:', e.message);
    S._recurringRows = [];
  }
}

async function _loadExpectedList() {
  try {
    const data = await FIN.api('fin_get_expected_invoices', {
      brand: _filterBrand || undefined,
    });
    S._expectedRows = data.invoices || [];
  } catch (e) {
    console.warn('Get expected invoices failed:', e.message);
    S._expectedRows = [];
  }
}


// ═══════════════════════════════════════
// FILTER ACTIONS
// ═══════════════════════════════════════

function _filterPending(filter) {
  _pendingFilter = filter;
  document.querySelectorAll('.rv-chip').forEach(el => el.classList.remove('rv-chip-a'));
  const el = document.getElementById('rv_chip_' + filter);
  if (el) el.classList.add('rv-chip-a');
  _renderPendingRows();
}

function _setMonth(val) {
  _filterMonth = val;
  _reloadCurrentScreen();
}

function _setBrand(val) {
  _filterBrand = val;
  _reloadCurrentScreen();
}

function _reloadCurrentScreen() {
  const hash = location.hash || '';
  if (hash.includes('rv-pending')) loadRvPending();
  else if (hash.includes('rv-recurring')) loadRvRecurring();
  else if (hash.includes('rv-expected')) loadRvExpected();
}

function _populateMonthFilter() {
  const sel = document.getElementById('rv_month');
  if (!sel) return;
  const now = FIN.sydneyNow();
  let opts = '<option value="">All Months</option>';
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }).substring(0, 7);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'Australia/Sydney' });
    opts += `<option value="${val}"${val === _filterMonth ? ' selected' : ''}>${label}</option>`;
  }
  sel.innerHTML = opts;
}

function _populateBrandFilter() {
  const sel = document.getElementById('rv_brand');
  if (!sel) return;
  sel.innerHTML = '<option value="">All Brands</option>' + FIN.brandOpts(_filterBrand);
}


// ═══════════════════════════════════════
// CRUD ACTIONS
// ═══════════════════════════════════════

// ── Create Recurring Rule (modal) ──
function _createRecurring() {
  _showRecurringModal(null);
}

function _editRecurring(id) {
  const rule = S._recurringRows.find(r => r.id === id);
  if (rule) _showRecurringModal(rule);
}

function _showRecurringModal(existing) {
  const isEdit = !!existing;
  const title = isEdit ? 'Edit Recurring Rule' : 'Create Recurring Rule';
  const vendors = S.vendors || [];
  const categories = S.categories || [];

  SPG.showDialog(`<div class="popup-sheet" style="width:480px">
    <div class="popup-sheet-header"><div class="popup-sheet-title">${title}</div></div>
    <div class="popup-sheet-body">
      <div class="fg">
        <label class="lb">Vendor *</label>
        <select class="inp" id="rr_vendor">
          <option value="">— Select vendor —</option>
          ${vendors.map(v => `<option value="${esc(v.id)}" data-name="${esc(v.name)}"${existing && existing.vendor_id === v.id ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <label class="lb">Item Description *</label>
        <input class="inp" id="rr_item" value="${esc(existing?.item_description || '')}" placeholder="e.g. Weekly food delivery">
      </div>
      <div style="display:flex;gap:12px">
        <div class="fg" style="flex:1">
          <label class="lb">Frequency *</label>
          <select class="inp" id="rr_freq" onchange="FinanceSection.onRvFreqChange()">
            <option value="daily"${existing?.frequency === 'daily' ? ' selected' : ''}>Daily</option>
            <option value="weekly"${existing?.frequency === 'weekly' ? ' selected' : ''}>Weekly</option>
            <option value="fortnightly"${existing?.frequency === 'fortnightly' ? ' selected' : ''}>Fortnightly</option>
            <option value="monthly"${!existing || existing?.frequency === 'monthly' ? ' selected' : ''}>Monthly</option>
            <option value="quarterly"${existing?.frequency === 'quarterly' ? ' selected' : ''}>Quarterly</option>
            <option value="yearly"${existing?.frequency === 'yearly' ? ' selected' : ''}>Yearly</option>
          </select>
        </div>
        <div class="fg" style="flex:1" id="rr_dom_wrap" style="${existing?.frequency === 'weekly' ? 'display:none' : ''}">
          <label class="lb">Day of Month</label>
          <input class="inp" id="rr_dom" type="number" min="1" max="31" value="${existing?.day_of_month || 1}">
        </div>
        <div class="fg" style="flex:1" id="rr_dow_wrap" style="${existing?.frequency === 'weekly' || existing?.frequency === 'fortnightly' ? '' : 'display:none'}">
          <label class="lb">Day of Week</label>
          <select class="inp" id="rr_dow">
            ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d, i) => `<option value="${i}"${existing?.day_of_week === i ? ' selected' : ''}>${d}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:12px">
        <div class="fg" style="flex:1">
          <label class="lb">Est. Amount ($)</label>
          <input class="inp" id="rr_amount" type="number" step="0.01" min="0" value="${existing?.est_amount || ''}">
        </div>
        <div class="fg" style="flex:1">
          <label class="lb">Category</label>
          <select class="inp" id="rr_cat">
            <option value="">— Optional —</option>
            ${categories.map(c => `<option value="${esc(c.id)}"${existing?.category_id === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="fg">
        <label class="lb">Brand</label>
        <select class="inp" id="rr_brand_modal">
          <option value="">— All —</option>
          ${FIN.brandOpts(existing?.brand_id || '')}
        </select>
      </div>
    </div>
    <div class="popup-sheet-footer">
      <button class="btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn-primary" onclick="FinanceSection.saveRecurring('${existing?.id || ''}')">${isEdit ? 'Save Changes' : 'Create Rule'}</button>
    </div>
  </div>`);
}

function _onFreqChange() {
  const freq = document.getElementById('rr_freq')?.value;
  const domWrap = document.getElementById('rr_dom_wrap');
  const dowWrap = document.getElementById('rr_dow_wrap');
  if (domWrap) domWrap.style.display = (freq === 'weekly' || freq === 'fortnightly' || freq === 'daily') ? 'none' : '';
  if (dowWrap) dowWrap.style.display = (freq === 'weekly' || freq === 'fortnightly') ? '' : 'none';
}

async function _saveRecurring(existingId) {
  const vendorEl = document.getElementById('rr_vendor');
  const vendor_id = vendorEl?.value;
  const vendor_name = vendorEl?.selectedOptions[0]?.dataset.name || '';
  const item_description = document.getElementById('rr_item')?.value.trim();
  const frequency = document.getElementById('rr_freq')?.value;
  const day_of_month = parseInt(document.getElementById('rr_dom')?.value) || null;
  const day_of_week = parseInt(document.getElementById('rr_dow')?.value);
  const est_amount = parseFloat(document.getElementById('rr_amount')?.value) || 0;
  const category_id = document.getElementById('rr_cat')?.value || null;
  const brand_id = document.getElementById('rr_brand_modal')?.value || null;

  if (!item_description) return SPG.toast('Item description is required', 'error');

  try {
    SPG.showLoader();
    if (existingId) {
      await FIN.api('fin_update_recurring_rule', {
        id: existingId, vendor_id, vendor_name, item_description,
        frequency, day_of_month, day_of_week, est_amount, category_id, brand_id,
      });
      // Update memory
      const idx = S._recurringRows.findIndex(r => r.id === existingId);
      if (idx >= 0) Object.assign(S._recurringRows[idx], { vendor_id, vendor_name, item_description, frequency, day_of_month, day_of_week, est_amount, category_id, brand_id });
      SPG.toast('Rule updated');
    } else {
      const result = await FIN.api('fin_create_recurring_rule', {
        vendor_id, vendor_name, item_description,
        frequency, day_of_month, day_of_week, est_amount, category_id, brand_id,
      });
      if (result.rule) S._recurringRows.push(result.rule);
      SPG.toast('Rule created');
    }
    SPG.closeDialog();
    _renderRecurringRows();
  } catch (e) {
    SPG.toast('Error: ' + e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}

// ── Create Expected Invoice (modal) ──
function _createExpected() {
  const vendors = S.vendors || [];

  SPG.showDialog(`<div class="popup-sheet" style="width:480px">
    <div class="popup-sheet-header"><div class="popup-sheet-title">Add Expected Invoice</div></div>
    <div class="popup-sheet-body">
      <div class="fg">
        <label class="lb">Vendor *</label>
        <select class="inp" id="ei_vendor">
          <option value="">— Select or type —</option>
          ${vendors.map(v => `<option value="${esc(v.id)}" data-name="${esc(v.name)}">${esc(v.name)}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <label class="lb">Description *</label>
        <input class="inp" id="ei_desc" placeholder="e.g. Kitchen pipe repair — Mango Coco">
      </div>
      <div style="display:flex;gap:12px">
        <div class="fg" style="flex:1">
          <label class="lb">Est. Amount ($) *</label>
          <input class="inp" id="ei_amount" type="number" step="0.01" min="0">
        </div>
        <div class="fg" style="flex:1">
          <label class="lb">Expected Date *</label>
          <input class="inp" id="ei_date" type="date">
        </div>
      </div>
      <div style="display:flex;gap:12px">
        <div class="fg" style="flex:1">
          <label class="lb">Responsible</label>
          <input class="inp" id="ei_resp" placeholder="Who should chase this?">
        </div>
        <div class="fg" style="flex:1">
          <label class="lb">Brand</label>
          <select class="inp" id="ei_brand">
            <option value="">— All —</option>
            ${FIN.brandOpts('')}
          </select>
        </div>
      </div>
    </div>
    <div class="popup-sheet-footer">
      <button class="btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn-primary" onclick="FinanceSection.saveExpected()">Add Expected</button>
    </div>
  </div>`);
}

async function _saveExpected() {
  const vendorEl = document.getElementById('ei_vendor');
  const vendor_id = vendorEl?.value || null;
  const vendor_name = vendorEl?.selectedOptions[0]?.dataset.name || '';
  const description = document.getElementById('ei_desc')?.value.trim();
  const est_amount = parseFloat(document.getElementById('ei_amount')?.value) || 0;
  const expected_date = document.getElementById('ei_date')?.value;
  const responsible = document.getElementById('ei_resp')?.value.trim();
  const brand_id = document.getElementById('ei_brand')?.value || null;

  if (!description) return SPG.toast('Description is required', 'error');
  if (!expected_date) return SPG.toast('Expected date is required', 'error');
  if (est_amount <= 0) return SPG.toast('Amount must be > 0', 'error');

  try {
    SPG.showLoader();
    const result = await FIN.api('fin_create_expected_invoice', {
      vendor_id, vendor_name, description, est_amount, expected_date, responsible, brand_id,
    });
    if (result.invoice) S._expectedRows.push(result.invoice);
    S._rvKpi.expected = (S._rvKpi.expected || 0) + 1;
    SPG.toast('Expected invoice added');
    SPG.closeDialog();
    _renderExpectedRows();
  } catch (e) {
    SPG.toast('Error: ' + e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}

// ── Chase expected invoice ──
function _chaseExpected(id) {
  SPG.toast('Chase notification — coming soon');
}

// ── Create bill from pending item ──
function _createBillFrom(ruleId, expectedId) {
  const params = {};
  if (ruleId) params.prefill_rule = ruleId;
  if (expectedId) params.prefill_expected = expectedId;
  SPG.go('finance/cr-bill', params);
}


// ═══════════════════════════════════════
// EXPOSE render/load to FIN
// ═══════════════════════════════════════
FIN.renderRvPending = renderRvPending;
FIN.loadRvPending = loadRvPending;
FIN.renderRvRecurring = renderRvRecurring;
FIN.loadRvRecurring = loadRvRecurring;
FIN.renderRvExpected = renderRvExpected;
FIN.loadRvExpected = loadRvExpected;

// ═══════════════════════════════════════
// ONCLICK HANDLERS
// ═══════════════════════════════════════
Object.assign(window.FinanceSection, {
  filterPending: _filterPending,
  setRvMonth: _setMonth,
  setRvBrand: _setBrand,
  createRecurring: _createRecurring,
  editRecurring: _editRecurring,
  onRvFreqChange: _onFreqChange,
  saveRecurring: _saveRecurring,
  createExpected: _createExpected,
  saveExpected: _saveExpected,
  chaseExpected: _chaseExpected,
  createBillFrom: _createBillFrom,
});

})();
