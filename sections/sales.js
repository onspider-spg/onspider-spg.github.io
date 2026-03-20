/**
 * SPG HUB v1.0.0 | 21 MAR 2026 | Siam Palette Group
 * sections/sales.js — Sale Daily Report Section
 * Daily sales reporting for Australian restaurant/bakery chain
 * Timezone: Australia/Sydney | Currency: AUD ($)
 */

(() => {
const esc = SPG.esc;
const api = SPG.api;
const ui = SPG.ui;

// ═══ MODULE STATE ═══
const S = {
  // Cache
  dashboard: null,
  channels: null,
  vendors: null,
  settings: null,
  permissions: null,
  storeList: null,
  // Store selector
  selectedStore: null,
  // Daily sale
  dailySale: null,
  // Expense
  expenses: [],
  // Invoice
  invoices: [],
  // Cash
  cashData: null,
  // History
  saleHistory: [],
  expenseHistory: [],
  // Report
  dailyReport: null,
  // Tasks
  tasks: [],
  // Hub
  hubData: null,
  // Audit
  auditLog: [],
  // Loading flags
  _loading: {},
};

// ═══ HELPERS ═══
const SECTION_LABEL = 'Sales Daily';

function sPost(action, data = {}) {
  return api.post('sales', action, api.tb(data));
}

function sydneyToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
}

function sydneyNow() {
  return new Date().toLocaleString('en-AU', { timeZone: 'Australia/Sydney', hour12: false });
}

function fmtAUD(val) {
  const n = parseFloat(val) || 0;
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function fmtDateTime(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return d; }
}

function isAdmin() {
  const s = api.getSession();
  return s && (s.position_level <= 2);
}

function isHQ() {
  const s = api.getSession();
  return s && (!s.store_id || s.store_id === 'HQ' || s.position_level <= 2);
}

function getStoreId() {
  if (isHQ() && S.selectedStore) return S.selectedStore;
  const s = api.getSession();
  return s?.store_id || '';
}

function navBtn(route, label) {
  return `<button class="btn btn-outline btn-sm" onclick="SPG.go('sales/${route}')">${esc(label)}</button>`;
}

function backBtn(route, label) {
  return `<button class="btn btn-outline btn-sm" onclick="SPG.go('sales/${route}')">← ${esc(label || 'Back')}</button>`;
}

function storeSelector() {
  if (!isHQ()) return '';
  const stores = S.storeList || [];
  const cur = S.selectedStore || '';
  if (!stores.length) return '';
  const pills = stores.map(st => {
    const active = st.store_id === cur ? ' style="background:var(--acc);color:#fff"' : '';
    return `<span class="pill"${active} onclick="SalesSection.selectStore('${esc(st.store_id)}')">${esc(st.store_id)}</span>`;
  }).join('');
  return `<div class="store-selector" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">${pills}</div>`;
}

function kpiBox(label, value, sub, color) {
  const cs = color ? ` style="color:${color}"` : '';
  return `<div class="kpi-box">
    <div class="kpi-val"${cs}>${value}</div>
    <div class="kpi-label">${esc(label)}</div>
    ${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ''}
  </div>`;
}

function quickBtn(icon, label, route) {
  return `<div class="quick-btn" onclick="SPG.go('sales/${route}')">
    <div class="quick-icon">${icon}</div>
    <div class="quick-label">${esc(label)}</div>
  </div>`;
}

function sectionLabel(text) {
  return `<div class="sl">${esc(text)}</div>`;
}

function dateInput(id, value, onChange) {
  return `<input class="fl" type="date" id="${esc(id)}" value="${esc(value || '')}" onchange="${onChange || ''}">`;
}


// ════════════════════════════════════════
// ROUTE 1: DASHBOARD
// ════════════════════════════════════════
function renderDashboard() {
  const s = api.getSession();
  if (!s) return '';
  return SPG.shell(`
    ${SPG.toolbar('Dashboard', `<button class="btn btn-primary btn-sm" onclick="SalesSection.refreshDashboard()">Refresh</button>`)}
    <div class="content" id="sd-dash">
      ${storeSelector()}
      <div id="sd-kpi">${ui.skeleton(80, 4)}</div>
      <div style="height:16px"></div>
      <div class="sl">Quick Actions</div>
      <div id="sd-quick" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;margin-bottom:20px">
        ${quickBtn('$', 'Daily Sale', 'daily-sale')}
        ${quickBtn('📋', 'Expense', 'expense')}
        ${quickBtn('📄', 'Invoice', 'invoice')}
        ${quickBtn('💵', 'Cash Count', 'cash')}
        ${quickBtn('📊', 'Report', 'daily-report')}
        ${quickBtn('📅', 'Sale History', 'sale-history')}
        ${quickBtn('📁', 'Expense History', 'expense-history')}
        ${quickBtn('📝', 'Tasks', 'tasks')}
        ${isHQ() ? quickBtn('🏢', 'Daily Hub', 'daily-hub') : ''}
        ${isAdmin() ? quickBtn('⚙', 'Admin', 'channels') : ''}
      </div>
      <div class="sl">Today's Overview</div>
      <div id="sd-overview">${ui.skeleton(120)}</div>
      <div style="height:16px"></div>
      <div class="sl">Weekly Comparison</div>
      <div id="sd-weekly">${ui.skeleton(100)}</div>
      <div style="height:16px"></div>
      <div class="sl">Anomalies</div>
      <div id="sd-anomalies">${ui.skeleton(60)}</div>
    </div>`, SECTION_LABEL);
}

async function loadDashboard() {
  if (S._loading.dashboard) return;
  S._loading.dashboard = true;
  try {
    // Load store list for HQ
    if (isHQ() && !S.storeList) {
      try {
        const stores = await SPG.perm.getStoresCache();
        S.storeList = stores.filter(st => st.store_id !== 'ALL' && st.store_id !== 'HQ');
        if (!S.selectedStore && S.storeList.length) S.selectedStore = S.storeList[0].store_id;
        // Re-render store selector
        const dash = document.getElementById('sd-dash');
        if (dash) {
          const existing = dash.querySelector('.store-selector');
          if (existing) existing.outerHTML = storeSelector();
          else dash.insertAdjacentHTML('afterbegin', storeSelector());
        }
      } catch { /* ignore */ }
    }

    const storeId = getStoreId();
    const [dashData, weeklyData, anomalies] = await Promise.all([
      sPost('sd_get_dashboard', { store_id: storeId, date: sydneyToday() }),
      sPost('sd_get_weekly_comparison', { store_id: storeId }).catch(() => null),
      sPost('sd_get_anomalies', { store_id: storeId }).catch(() => null),
    ]);
    S.dashboard = dashData;
    fillDashboard(dashData, weeklyData, anomalies);
  } catch (e) {
    SPG.toast(e.message || 'Failed to load dashboard', 'error');
  } finally {
    S._loading.dashboard = false;
  }
}

function fillDashboard(d, weekly, anomalies) {
  // KPIs
  const kpiEl = document.getElementById('sd-kpi');
  if (kpiEl && d) {
    kpiEl.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">
      ${kpiBox('Today Sales', fmtAUD(d.total_sales || 0), '', 'var(--blue)')}
      ${kpiBox('Expenses', fmtAUD(d.total_expenses || 0), '', 'var(--orange)')}
      ${kpiBox('Net', fmtAUD((d.total_sales || 0) - (d.total_expenses || 0)), '', 'var(--green)')}
      ${kpiBox('Cash on Hand', fmtAUD(d.cash_on_hand || 0), d.cash_variance != null ? 'Var: ' + fmtAUD(d.cash_variance) : '')}
    </div>`;
  }

  // Overview
  const ovEl = document.getElementById('sd-overview');
  if (ovEl && d) {
    const channels = d.channel_breakdown || [];
    ovEl.innerHTML = channels.length
      ? `<table class="tbl"><thead><tr><th>Channel</th><th style="text-align:right">Amount</th><th>Status</th></tr></thead><tbody>
        ${channels.map(c => `<tr><td>${esc(c.channel_name)}</td><td style="text-align:right">${fmtAUD(c.amount)}</td><td>${ui.badge(c.status || 'pending')}</td></tr>`).join('')}
        </tbody></table>`
      : ui.empty('📊', 'No sales data for today', 'Enter daily sales to get started');
  }

  // Weekly
  const wkEl = document.getElementById('sd-weekly');
  if (wkEl) {
    if (weekly && weekly.days && weekly.days.length) {
      wkEl.innerHTML = `<table class="tbl"><thead><tr><th>Date</th><th style="text-align:right">Sales</th><th style="text-align:right">Expenses</th><th style="text-align:right">Net</th></tr></thead><tbody>
        ${weekly.days.map(d => `<tr><td>${fmtDate(d.date)}</td><td style="text-align:right">${fmtAUD(d.sales)}</td><td style="text-align:right">${fmtAUD(d.expenses)}</td><td style="text-align:right">${fmtAUD(d.net)}</td></tr>`).join('')}
        </tbody></table>`;
    } else {
      wkEl.innerHTML = ui.empty('📅', 'No weekly data yet');
    }
  }

  // Anomalies
  const anEl = document.getElementById('sd-anomalies');
  if (anEl) {
    if (anomalies && anomalies.items && anomalies.items.length) {
      anEl.innerHTML = anomalies.items.map(a => `<div class="card" style="margin-bottom:8px;padding:10px 14px">
        <div style="font-size:12px;font-weight:600;color:var(--red)">${esc(a.title || 'Anomaly')}</div>
        <div style="font-size:11px;color:var(--t3)">${esc(a.description || '')}</div>
      </div>`).join('');
    } else {
      anEl.innerHTML = `<div style="font-size:11px;color:var(--t3);padding:8px 0">No anomalies detected</div>`;
    }
  }
}

function refreshDashboard() {
  S.dashboard = null;
  const kpiEl = document.getElementById('sd-kpi');
  if (kpiEl) kpiEl.innerHTML = ui.skeleton(80, 4);
  loadDashboard();
}

function selectStore(storeId) {
  S.selectedStore = storeId;
  S.dashboard = null;
  // Refresh the whole page
  SPG.go('sales/dashboard');
}


// ════════════════════════════════════════
// ROUTE 2: DAILY SALE (S1)
// ════════════════════════════════════════
function renderDailySale() {
  const today = sydneyToday();
  return SPG.shell(`
    ${SPG.toolbar('Daily Sale', backBtn('dashboard', 'Dashboard'))}
    <div class="content">
      ${storeSelector()}
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <label class="lb" style="margin:0">Date</label>
        <input class="fl" type="date" id="ds-date" value="${esc(today)}" onchange="SalesSection.loadDailySale()" style="max-width:180px">
        <button class="btn btn-primary btn-sm" id="btn-ds-save" onclick="SalesSection.saveDailySale()">Save</button>
      </div>
      <div id="ds-sync" style="margin-bottom:12px"></div>
      <div id="ds-channels">${ui.skeleton(200)}</div>
      <div id="ds-total" style="margin-top:16px"></div>
    </div>`, SECTION_LABEL);
}

async function loadDailySale() {
  const date = document.getElementById('ds-date')?.value || sydneyToday();
  const storeId = getStoreId();
  const chEl = document.getElementById('ds-channels');
  if (chEl) chEl.innerHTML = ui.skeleton(200);
  try {
    const [data, syncData] = await Promise.all([
      sPost('sd_get_daily_sale', { store_id: storeId, date }),
      sPost('sd_check_sync', { store_id: storeId, date }).catch(() => null),
    ]);
    S.dailySale = data;
    fillDailySaleForm(data);
    fillSyncStatus(syncData);
  } catch (e) {
    if (chEl) chEl.innerHTML = ui.empty('❌', 'Failed to load', e.message);
  }
}

function fillDailySaleForm(data) {
  const chEl = document.getElementById('ds-channels');
  if (!chEl) return;
  const channels = data?.channels || [];
  if (!channels.length) {
    chEl.innerHTML = ui.empty('📊', 'No channels configured', 'Admin needs to set up sale channels first');
    return;
  }
  chEl.innerHTML = `<table class="tbl">
    <thead><tr><th>Channel</th><th style="width:140px;text-align:right">Amount ($)</th></tr></thead>
    <tbody>
      ${channels.map((c, i) => `<tr>
        <td>${esc(c.channel_name)}</td>
        <td><input class="inp" type="number" step="0.01" min="0" id="ds-ch-${i}" value="${c.amount != null ? c.amount : ''}" data-channel-id="${esc(c.channel_id)}" style="text-align:right;width:100%" oninput="SalesSection.calcDailySaleTotal()"></td>
      </tr>`).join('')}
    </tbody>
  </table>`;
  calcDailySaleTotal();
}

function calcDailySaleTotal() {
  let total = 0;
  document.querySelectorAll('[id^="ds-ch-"]').forEach(inp => {
    total += parseFloat(inp.value) || 0;
  });
  const el = document.getElementById('ds-total');
  if (el) el.innerHTML = `<div style="font-size:16px;font-weight:700;text-align:right">Total: ${fmtAUD(total)}</div>`;
}

function fillSyncStatus(syncData) {
  const el = document.getElementById('ds-sync');
  if (!el) return;
  if (!syncData) { el.innerHTML = ''; return; }
  const st = syncData.synced ? 'synced' : (syncData.submitted ? 'submitted' : 'pending');
  el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;font-size:11px">
    <span>Sync status:</span> ${ui.badge(st)}
    ${syncData.synced_at ? `<span style="color:var(--t3)">at ${fmtDateTime(syncData.synced_at)}</span>` : ''}
  </div>`;
}

async function saveDailySale() {
  const date = document.getElementById('ds-date')?.value || sydneyToday();
  const storeId = getStoreId();
  const channels = [];
  document.querySelectorAll('[id^="ds-ch-"]').forEach(inp => {
    channels.push({ channel_id: inp.dataset.channelId, amount: parseFloat(inp.value) || 0 });
  });
  const btn = document.getElementById('btn-ds-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  try {
    await sPost('sd_save_daily_sale', { store_id: storeId, date, channels });
    SPG.toast('Daily sale saved', 'success');
  } catch (e) {
    SPG.toast(e.message || 'Save failed', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
  }
}


// ════════════════════════════════════════
// ROUTE 3: EXPENSE (S2)
// ════════════════════════════════════════
function renderExpense() {
  const today = sydneyToday();
  return SPG.shell(`
    ${SPG.toolbar('Daily Expenses', `${backBtn('dashboard', 'Dashboard')} <button class="btn btn-primary btn-sm" onclick="SalesSection.showExpenseForm()">+ Add</button>`)}
    <div class="content">
      ${storeSelector()}
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <label class="lb" style="margin:0">Date</label>
        <input class="fl" type="date" id="exp-date" value="${esc(today)}" onchange="SalesSection.loadExpenses()" style="max-width:180px">
      </div>
      <div id="exp-list">${ui.skeleton(200)}</div>
      <div id="exp-total" style="margin-top:12px"></div>
    </div>`, SECTION_LABEL);
}

async function loadExpenses() {
  const date = document.getElementById('exp-date')?.value || sydneyToday();
  const storeId = getStoreId();
  const el = document.getElementById('exp-list');
  if (el) el.innerHTML = ui.skeleton(200);
  try {
    const data = await sPost('sd_get_expenses', { store_id: storeId, date });
    S.expenses = data?.expenses || [];
    fillExpenseList();
  } catch (e) {
    if (el) el.innerHTML = ui.empty('❌', 'Failed to load', e.message);
  }
}

function fillExpenseList() {
  const el = document.getElementById('exp-list');
  if (!el) return;
  if (!S.expenses.length) {
    el.innerHTML = ui.empty('📋', 'No expenses today', 'Tap + Add to record an expense');
    document.getElementById('exp-total').innerHTML = '';
    return;
  }
  let total = 0;
  el.innerHTML = `<table class="tbl">
    <thead><tr><th>Category</th><th>Description</th><th style="text-align:right">Amount</th><th style="width:60px"></th></tr></thead>
    <tbody>
    ${S.expenses.map(e => {
      total += parseFloat(e.amount) || 0;
      return `<tr>
        <td>${esc(e.category || '-')}</td>
        <td>${esc(e.description || '-')}</td>
        <td style="text-align:right">${fmtAUD(e.amount)}</td>
        <td style="text-align:center">
          <span style="cursor:pointer;color:var(--blue);font-size:11px" onclick="SalesSection.showExpenseForm('${esc(e.expense_id)}')">Edit</span>
          <span style="cursor:pointer;color:var(--red);font-size:11px;margin-left:6px" onclick="SalesSection.deleteExpense('${esc(e.expense_id)}')">Del</span>
        </td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
  const totEl = document.getElementById('exp-total');
  if (totEl) totEl.innerHTML = `<div style="font-size:16px;font-weight:700;text-align:right">Total: ${fmtAUD(total)}</div>`;
}

function showExpenseForm(expId) {
  const existing = expId ? S.expenses.find(e => e.expense_id === expId) : null;
  const date = document.getElementById('exp-date')?.value || sydneyToday();
  SPG.showDialog(`<div class="popup-sheet" style="width:380px">
    <div class="popup-header"><div class="popup-title">${existing ? 'Edit' : 'Add'} Expense</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Category *</label>
      <select class="inp" id="exp-cat">
        <option value="">-- Select --</option>
        <option value="Food & Supplies"${existing?.category === 'Food & Supplies' ? ' selected' : ''}>Food & Supplies</option>
        <option value="Utilities"${existing?.category === 'Utilities' ? ' selected' : ''}>Utilities</option>
        <option value="Cleaning"${existing?.category === 'Cleaning' ? ' selected' : ''}>Cleaning</option>
        <option value="Equipment"${existing?.category === 'Equipment' ? ' selected' : ''}>Equipment</option>
        <option value="Marketing"${existing?.category === 'Marketing' ? ' selected' : ''}>Marketing</option>
        <option value="Transport"${existing?.category === 'Transport' ? ' selected' : ''}>Transport</option>
        <option value="Staff"${existing?.category === 'Staff' ? ' selected' : ''}>Staff</option>
        <option value="Other"${existing?.category === 'Other' ? ' selected' : ''}>Other</option>
      </select>
    </div>
    <div class="fg"><label class="lb">Description</label><input class="inp" id="exp-desc" value="${esc(existing?.description || '')}" placeholder="Brief description"></div>
    <div class="fg"><label class="lb">Amount ($) *</label><input class="inp" id="exp-amt" type="number" step="0.01" min="0" value="${existing?.amount || ''}" placeholder="0.00"></div>
    <div class="fg"><label class="lb">Vendor / Supplier</label><input class="inp" id="exp-vendor" value="${esc(existing?.vendor_name || '')}" placeholder="Optional"></div>
    <div class="fg"><label class="lb">Receipt Photo</label><input type="file" id="exp-photo" accept="image/*" class="inp"></div>
    <div class="error-msg" id="exp-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" id="btn-exp-save" onclick="SalesSection.saveExpense('${esc(expId || '')}')">${existing ? 'Update' : 'Save'}</button>
    </div>
  </div>`);
}

async function saveExpense(expId) {
  const category = document.getElementById('exp-cat')?.value;
  const description = document.getElementById('exp-desc')?.value.trim();
  const amount = parseFloat(document.getElementById('exp-amt')?.value);
  const vendor_name = document.getElementById('exp-vendor')?.value.trim();
  const date = document.getElementById('exp-date')?.value || sydneyToday();
  const storeId = getStoreId();

  if (!category) { SPG.showError('exp-error', 'Please select a category'); return; }
  if (!amount || amount <= 0) { SPG.showError('exp-error', 'Please enter a valid amount'); return; }

  const btn = document.getElementById('btn-exp-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    // Upload photo if present
    const photoFile = document.getElementById('exp-photo')?.files?.[0];
    let photo_url = null;
    if (photoFile) {
      const fd = new FormData();
      fd.append('file', photoFile);
      fd.append('token', api.getToken());
      fd.append('store_id', storeId);
      fd.append('type', 'expense_receipt');
      try {
        const uploadResp = await fetch(
          `https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/saledaily-report?action=sd_upload_photo`,
          { method: 'POST', body: fd }
        );
        const uploadJson = await uploadResp.json();
        if (uploadJson.success) photo_url = uploadJson.data?.url;
      } catch { /* photo upload optional */ }
    }

    const payload = { store_id: storeId, date, category, description, amount, vendor_name };
    if (expId) payload.expense_id = expId;
    if (photo_url) payload.photo_url = photo_url;

    await sPost('sd_save_expense', payload);
    SPG.closeDialog();
    SPG.toast(expId ? 'Expense updated' : 'Expense added', 'success');
    loadExpenses();
  } catch (e) {
    SPG.showError('exp-error', e.message || 'Save failed');
    if (btn) { btn.disabled = false; btn.textContent = expId ? 'Update' : 'Save'; }
  }
}

async function deleteExpense(expId) {
  if (!confirm('Delete this expense?')) return;
  SPG.showLoader();
  try {
    await sPost('sd_delete_expense', { expense_id: expId, store_id: getStoreId() });
    SPG.toast('Expense deleted', 'success');
    loadExpenses();
  } catch (e) {
    SPG.toast(e.message || 'Delete failed', 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ════════════════════════════════════════
// ROUTE 4: INVOICE (S3)
// ════════════════════════════════════════
function renderInvoice() {
  return SPG.shell(`
    ${SPG.toolbar('Invoices', `${backBtn('dashboard', 'Dashboard')} <button class="btn btn-primary btn-sm" onclick="SalesSection.showInvoiceForm()">+ Add</button>`)}
    <div class="content">
      ${storeSelector()}
      ${ui.filterBar([
        { id: 'inv-status', label: 'Status', type: 'select', options: [
          { value: '', label: 'All' }, { value: 'pending', label: 'Pending' }, { value: 'paid', label: 'Paid' }, { value: 'overdue', label: 'Overdue' }
        ], value: '', onChange: 'SalesSection.loadInvoices()' },
        { id: 'inv-from', label: 'From', type: 'date', value: '', onChange: 'SalesSection.loadInvoices()' },
        { id: 'inv-to', label: 'To', type: 'date', value: '', onChange: 'SalesSection.loadInvoices()' },
      ])}
      <div id="inv-list">${ui.skeleton(200)}</div>
    </div>`, SECTION_LABEL);
}

async function loadInvoices() {
  const storeId = getStoreId();
  const status = document.getElementById('inv-status')?.value || '';
  const from = document.getElementById('inv-from')?.value || '';
  const to = document.getElementById('inv-to')?.value || '';
  const el = document.getElementById('inv-list');
  if (el) el.innerHTML = ui.skeleton(200);
  try {
    const data = await sPost('sd_get_invoices', { store_id: storeId, status, date_from: from, date_to: to });
    S.invoices = data?.invoices || [];
    fillInvoiceList();
  } catch (e) {
    if (el) el.innerHTML = ui.empty('❌', 'Failed to load', e.message);
  }
}

function fillInvoiceList() {
  const el = document.getElementById('inv-list');
  if (!el) return;
  if (!S.invoices.length) {
    el.innerHTML = ui.empty('📄', 'No invoices found');
    return;
  }
  el.innerHTML = `<table class="tbl">
    <thead><tr>
      ${ui.sortTh('inv', 'invoice_no', 'Invoice #')}
      ${ui.sortTh('inv', 'vendor_name', 'Vendor')}
      ${ui.sortTh('inv', 'amount', 'Amount', ' style="text-align:right"')}
      ${ui.sortTh('inv', 'due_date', 'Due Date')}
      <th>Status</th>
      <th style="width:60px"></th>
    </tr></thead>
    <tbody>
    ${getSortedInvoices().map(inv => `<tr>
      <td style="font-weight:600">${esc(inv.invoice_no || '-')}</td>
      <td>${esc(inv.vendor_name || '-')}</td>
      <td style="text-align:right">${fmtAUD(inv.amount)}</td>
      <td>${fmtDate(inv.due_date)}</td>
      <td>${ui.badge(inv.status || 'pending')}</td>
      <td>
        <span style="cursor:pointer;color:var(--blue);font-size:11px" onclick="SalesSection.showInvoiceForm('${esc(inv.invoice_id)}')">Edit</span>
        <span style="cursor:pointer;color:var(--red);font-size:11px;margin-left:4px" onclick="SalesSection.deleteInvoice('${esc(inv.invoice_id)}')">Del</span>
      </td>
    </tr>`).join('')}
    </tbody>
  </table>`;
}

function getSortedInvoices() {
  const st = ui.getSortState('inv');
  return st ? ui.sortData(S.invoices, st.key, st.dir) : S.invoices;
}

function showInvoiceForm(invId) {
  const existing = invId ? S.invoices.find(i => i.invoice_id === invId) : null;
  SPG.showDialog(`<div class="popup-sheet" style="width:420px">
    <div class="popup-header"><div class="popup-title">${existing ? 'Edit' : 'Add'} Invoice</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Invoice # *</label><input class="inp" id="inv-no" value="${esc(existing?.invoice_no || '')}" placeholder="INV-001"></div>
    <div class="fg"><label class="lb">Vendor / Supplier *</label><input class="inp" id="inv-vendor" value="${esc(existing?.vendor_name || '')}" placeholder="Supplier name"></div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Amount ($) *</label><input class="inp" id="inv-amt" type="number" step="0.01" min="0" value="${existing?.amount || ''}" placeholder="0.00"></div>
      <div class="fg" style="flex:1"><label class="lb">GST ($)</label><input class="inp" id="inv-gst" type="number" step="0.01" min="0" value="${existing?.gst_amount || ''}" placeholder="0.00"></div>
    </div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Invoice Date *</label><input class="inp" type="date" id="inv-date" value="${esc(existing?.invoice_date || sydneyToday())}"></div>
      <div class="fg" style="flex:1"><label class="lb">Due Date</label><input class="inp" type="date" id="inv-due" value="${esc(existing?.due_date || '')}"></div>
    </div>
    <div class="fg"><label class="lb">Status</label>
      <select class="inp" id="inv-status-sel">
        <option value="pending"${existing?.status === 'pending' ? ' selected' : ''}>Pending</option>
        <option value="paid"${existing?.status === 'paid' ? ' selected' : ''}>Paid</option>
        <option value="overdue"${existing?.status === 'overdue' ? ' selected' : ''}>Overdue</option>
        <option value="cancelled"${existing?.status === 'cancelled' ? ' selected' : ''}>Cancelled</option>
      </select>
    </div>
    <div class="fg"><label class="lb">Notes</label><textarea class="inp" id="inv-notes" rows="2" style="width:100%;box-sizing:border-box">${esc(existing?.notes || '')}</textarea></div>
    <div class="fg"><label class="lb">Attachment</label><input type="file" id="inv-file" accept="image/*,.pdf" class="inp"></div>
    <div class="error-msg" id="inv-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" id="btn-inv-save" onclick="SalesSection.saveInvoice('${esc(invId || '')}')">${existing ? 'Update' : 'Save'}</button>
    </div>
  </div>`);
}

async function saveInvoice(invId) {
  const invoice_no = document.getElementById('inv-no')?.value.trim();
  const vendor_name = document.getElementById('inv-vendor')?.value.trim();
  const amount = parseFloat(document.getElementById('inv-amt')?.value);
  const gst_amount = parseFloat(document.getElementById('inv-gst')?.value) || 0;
  const invoice_date = document.getElementById('inv-date')?.value;
  const due_date = document.getElementById('inv-due')?.value || null;
  const status = document.getElementById('inv-status-sel')?.value || 'pending';
  const notes = document.getElementById('inv-notes')?.value.trim();
  const storeId = getStoreId();

  if (!invoice_no) { SPG.showError('inv-error', 'Invoice # is required'); return; }
  if (!vendor_name) { SPG.showError('inv-error', 'Vendor is required'); return; }
  if (!amount || amount <= 0) { SPG.showError('inv-error', 'Valid amount required'); return; }
  if (!invoice_date) { SPG.showError('inv-error', 'Invoice date is required'); return; }

  const btn = document.getElementById('btn-inv-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  try {
    const payload = { store_id: storeId, invoice_no, vendor_name, amount, gst_amount, invoice_date, due_date, status, notes };
    if (invId) payload.invoice_id = invId;
    await sPost('sd_save_invoice', payload);
    SPG.closeDialog();
    SPG.toast(invId ? 'Invoice updated' : 'Invoice added', 'success');
    loadInvoices();
  } catch (e) {
    SPG.showError('inv-error', e.message || 'Save failed');
    if (btn) { btn.disabled = false; btn.textContent = invId ? 'Update' : 'Save'; }
  }
}

async function deleteInvoice(invId) {
  if (!confirm('Delete this invoice?')) return;
  SPG.showLoader();
  try {
    await sPost('sd_delete_invoice', { invoice_id: invId, store_id: getStoreId() });
    SPG.toast('Invoice deleted', 'success');
    loadInvoices();
  } catch (e) {
    SPG.toast(e.message || 'Delete failed', 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ════════════════════════════════════════
// ROUTE 5: CASH ON HAND (S4)
// ════════════════════════════════════════
function renderCash() {
  const today = sydneyToday();
  return SPG.shell(`
    ${SPG.toolbar('Cash on Hand', backBtn('dashboard', 'Dashboard'))}
    <div class="content">
      ${storeSelector()}
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <label class="lb" style="margin:0">Date</label>
        <input class="fl" type="date" id="cash-date" value="${esc(today)}" onchange="SalesSection.loadCash()" style="max-width:180px">
      </div>
      <div id="cash-content">${ui.skeleton(300)}</div>
    </div>`, SECTION_LABEL);
}

async function loadCash() {
  const date = document.getElementById('cash-date')?.value || sydneyToday();
  const storeId = getStoreId();
  const el = document.getElementById('cash-content');
  if (el) el.innerHTML = ui.skeleton(300);
  try {
    const data = await sPost('sd_get_cash', { store_id: storeId, date });
    S.cashData = data;
    fillCashForm(data);
  } catch (e) {
    if (el) el.innerHTML = ui.empty('❌', 'Failed to load', e.message);
  }
}

function fillCashForm(data) {
  const el = document.getElementById('cash-content');
  if (!el) return;
  const denoms = data?.denominations || [
    { label: '$100', value: 100 }, { label: '$50', value: 50 }, { label: '$20', value: 20 },
    { label: '$10', value: 10 }, { label: '$5', value: 5 }, { label: '$2', value: 2 },
    { label: '$1', value: 1 }, { label: '50c', value: 0.5 }, { label: '20c', value: 0.2 },
    { label: '10c', value: 0.1 }, { label: '5c', value: 0.05 },
  ];
  const counts = data?.counts || {};
  const expected = data?.expected_cash || 0;
  const lastSubmit = data?.last_submitted;

  el.innerHTML = `
    ${lastSubmit ? `<div style="font-size:11px;color:var(--t3);margin-bottom:12px">Last submitted: ${fmtDateTime(lastSubmit.submitted_at)} by ${esc(lastSubmit.submitted_by || '-')}</div>` : ''}
    <div class="card" style="margin-bottom:16px">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px">Count Cash</div>
      <table class="tbl">
        <thead><tr><th>Denomination</th><th style="width:80px;text-align:center">Qty</th><th style="text-align:right">Subtotal</th></tr></thead>
        <tbody>
        ${denoms.map((d, i) => `<tr>
          <td style="font-weight:600">${esc(d.label)}</td>
          <td><input class="inp" type="number" min="0" id="cash-d-${i}" value="${counts[d.value] || 0}" data-denom="${d.value}" style="text-align:center;width:100%" oninput="SalesSection.calcCashTotal()"></td>
          <td style="text-align:right" id="cash-sub-${i}">${fmtAUD((counts[d.value] || 0) * d.value)}</td>
        </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:13px;font-weight:600">Expected Cash:</span>
      <span style="font-size:14px;font-weight:700">${fmtAUD(expected)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:13px;font-weight:600">Counted Total:</span>
      <span style="font-size:16px;font-weight:700" id="cash-total">$0.00</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <span style="font-size:13px;font-weight:600">Variance:</span>
      <span style="font-size:14px;font-weight:700" id="cash-variance">$0.00</span>
    </div>
    <div class="fg"><label class="lb">Notes</label><textarea class="inp" id="cash-notes" rows="2" style="width:100%;box-sizing:border-box" placeholder="Any notes about the cash count">${esc(data?.notes || '')}</textarea></div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-primary" id="btn-cash-submit" onclick="SalesSection.submitCashCount()">Submit Cash Count</button>
      ${data?.can_handover ? `<button class="btn btn-outline" onclick="SalesSection.confirmHandover()">Confirm Handover</button>` : ''}
    </div>`;
  calcCashTotal();
}

function calcCashTotal() {
  let total = 0;
  const denoms = S.cashData?.denominations || [
    { value: 100 }, { value: 50 }, { value: 20 }, { value: 10 }, { value: 5 },
    { value: 2 }, { value: 1 }, { value: 0.5 }, { value: 0.2 }, { value: 0.1 }, { value: 0.05 },
  ];
  denoms.forEach((d, i) => {
    const qty = parseInt(document.getElementById(`cash-d-${i}`)?.value) || 0;
    const sub = qty * d.value;
    total += sub;
    const subEl = document.getElementById(`cash-sub-${i}`);
    if (subEl) subEl.textContent = fmtAUD(sub);
  });
  const totEl = document.getElementById('cash-total');
  if (totEl) totEl.textContent = fmtAUD(total);
  const expected = S.cashData?.expected_cash || 0;
  const variance = total - expected;
  const varEl = document.getElementById('cash-variance');
  if (varEl) {
    varEl.textContent = fmtAUD(variance);
    varEl.style.color = Math.abs(variance) < 1 ? 'var(--green)' : 'var(--red)';
  }
}

async function submitCashCount() {
  const date = document.getElementById('cash-date')?.value || sydneyToday();
  const storeId = getStoreId();
  const notes = document.getElementById('cash-notes')?.value.trim();
  const counts = {};
  const denoms = S.cashData?.denominations || [
    { value: 100 }, { value: 50 }, { value: 20 }, { value: 10 }, { value: 5 },
    { value: 2 }, { value: 1 }, { value: 0.5 }, { value: 0.2 }, { value: 0.1 }, { value: 0.05 },
  ];
  denoms.forEach((d, i) => {
    counts[d.value] = parseInt(document.getElementById(`cash-d-${i}`)?.value) || 0;
  });
  const btn = document.getElementById('btn-cash-submit');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
  try {
    await sPost('sd_submit_cash_count', { store_id: storeId, date, counts, notes });
    SPG.toast('Cash count submitted', 'success');
    loadCash();
  } catch (e) {
    SPG.toast(e.message || 'Submit failed', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Cash Count'; }
  }
}

async function confirmHandover() {
  if (!confirm('Confirm cash handover? This will lock the cash count for today.')) return;
  const date = document.getElementById('cash-date')?.value || sydneyToday();
  SPG.showLoader();
  try {
    await sPost('sd_confirm_handover', { store_id: getStoreId(), date });
    SPG.toast('Handover confirmed', 'success');
    loadCash();
  } catch (e) {
    SPG.toast(e.message || 'Handover failed', 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ════════════════════════════════════════
// ROUTE 6: SALE HISTORY (S5)
// ════════════════════════════════════════
function renderSaleHistory() {
  const today = sydneyToday();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  return SPG.shell(`
    ${SPG.toolbar('Sale History', backBtn('dashboard', 'Dashboard'))}
    <div class="content">
      ${storeSelector()}
      ${ui.filterBar([
        { id: 'sh-from', label: 'From', type: 'date', value: weekAgo, onChange: 'SalesSection.loadSaleHistory()' },
        { id: 'sh-to', label: 'To', type: 'date', value: today, onChange: 'SalesSection.loadSaleHistory()' },
        { id: 'sh-channel', label: 'Channel', type: 'select', options: [{ value: '', label: 'All Channels' }], value: '', onChange: 'SalesSection.loadSaleHistory()' },
      ])}
      <div id="sh-list">${ui.skeleton(200)}</div>
      <div id="sh-summary" style="margin-top:12px"></div>
    </div>`, SECTION_LABEL);
}

async function loadSaleHistory() {
  const storeId = getStoreId();
  const from = document.getElementById('sh-from')?.value || '';
  const to = document.getElementById('sh-to')?.value || '';
  const channel = document.getElementById('sh-channel')?.value || '';
  const el = document.getElementById('sh-list');
  if (el) el.innerHTML = ui.skeleton(200);
  try {
    const data = await sPost('sd_get_sale_history', { store_id: storeId, date_from: from, date_to: to, channel_id: channel });
    S.saleHistory = data?.records || [];
    fillSaleHistory();
    // Populate channel filter
    if (data?.channels) {
      const sel = document.getElementById('sh-channel');
      if (sel && sel.options.length <= 1) {
        data.channels.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.channel_id;
          opt.textContent = c.channel_name;
          sel.appendChild(opt);
        });
      }
    }
  } catch (e) {
    if (el) el.innerHTML = ui.empty('❌', 'Failed to load', e.message);
  }
}

function fillSaleHistory() {
  const el = document.getElementById('sh-list');
  if (!el) return;
  if (!S.saleHistory.length) {
    el.innerHTML = ui.empty('📅', 'No sale records found');
    document.getElementById('sh-summary').innerHTML = '';
    return;
  }
  let grandTotal = 0;
  el.innerHTML = `<table class="tbl">
    <thead><tr>
      ${ui.sortTh('sh', 'date', 'Date')}
      <th>Channel</th>
      ${ui.sortTh('sh', 'amount', 'Amount', ' style="text-align:right"')}
      <th>Status</th>
    </tr></thead>
    <tbody>
    ${getSortedSaleHistory().map(r => {
      grandTotal += parseFloat(r.amount) || 0;
      return `<tr>
        <td>${fmtDate(r.date)}</td>
        <td>${esc(r.channel_name || '-')}</td>
        <td style="text-align:right">${fmtAUD(r.amount)}</td>
        <td>${ui.badge(r.status || 'pending')}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
  const sumEl = document.getElementById('sh-summary');
  if (sumEl) sumEl.innerHTML = `<div style="text-align:right;font-size:15px;font-weight:700">Grand Total: ${fmtAUD(grandTotal)}</div>`;
}

function getSortedSaleHistory() {
  const st = ui.getSortState('sh');
  return st ? ui.sortData(S.saleHistory, st.key, st.dir) : S.saleHistory;
}


// ════════════════════════════════════════
// ROUTE 7: EXPENSE HISTORY (S6)
// ════════════════════════════════════════
function renderExpenseHistory() {
  const today = sydneyToday();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  return SPG.shell(`
    ${SPG.toolbar('Expense History', backBtn('dashboard', 'Dashboard'))}
    <div class="content">
      ${storeSelector()}
      ${ui.filterBar([
        { id: 'eh-from', label: 'From', type: 'date', value: weekAgo, onChange: 'SalesSection.loadExpenseHistory()' },
        { id: 'eh-to', label: 'To', type: 'date', value: today, onChange: 'SalesSection.loadExpenseHistory()' },
        { id: 'eh-cat', label: 'Category', type: 'select', options: [
          { value: '', label: 'All' }, { value: 'Food & Supplies', label: 'Food & Supplies' },
          { value: 'Utilities', label: 'Utilities' }, { value: 'Cleaning', label: 'Cleaning' },
          { value: 'Equipment', label: 'Equipment' }, { value: 'Transport', label: 'Transport' },
          { value: 'Staff', label: 'Staff' }, { value: 'Other', label: 'Other' },
        ], value: '', onChange: 'SalesSection.loadExpenseHistory()' },
      ])}
      <div id="eh-list">${ui.skeleton(200)}</div>
      <div id="eh-summary" style="margin-top:12px"></div>
    </div>`, SECTION_LABEL);
}

async function loadExpenseHistory() {
  const storeId = getStoreId();
  const from = document.getElementById('eh-from')?.value || '';
  const to = document.getElementById('eh-to')?.value || '';
  const category = document.getElementById('eh-cat')?.value || '';
  const el = document.getElementById('eh-list');
  if (el) el.innerHTML = ui.skeleton(200);
  try {
    const data = await sPost('sd_get_expense_history', { store_id: storeId, date_from: from, date_to: to, category });
    S.expenseHistory = data?.records || [];
    fillExpenseHistory();
  } catch (e) {
    if (el) el.innerHTML = ui.empty('❌', 'Failed to load', e.message);
  }
}

function fillExpenseHistory() {
  const el = document.getElementById('eh-list');
  if (!el) return;
  if (!S.expenseHistory.length) {
    el.innerHTML = ui.empty('📁', 'No expense records found');
    document.getElementById('eh-summary').innerHTML = '';
    return;
  }
  let grandTotal = 0;
  el.innerHTML = `<table class="tbl">
    <thead><tr>
      ${ui.sortTh('eh', 'date', 'Date')}
      ${ui.sortTh('eh', 'category', 'Category')}
      <th>Description</th>
      ${ui.sortTh('eh', 'amount', 'Amount', ' style="text-align:right"')}
      <th>Vendor</th>
    </tr></thead>
    <tbody>
    ${getSortedExpenseHistory().map(r => {
      grandTotal += parseFloat(r.amount) || 0;
      return `<tr>
        <td>${fmtDate(r.date)}</td>
        <td>${esc(r.category || '-')}</td>
        <td>${esc(r.description || '-')}</td>
        <td style="text-align:right">${fmtAUD(r.amount)}</td>
        <td>${esc(r.vendor_name || '-')}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>`;
  const sumEl = document.getElementById('eh-summary');
  if (sumEl) sumEl.innerHTML = `<div style="text-align:right;font-size:15px;font-weight:700">Grand Total: ${fmtAUD(grandTotal)}</div>`;
}

function getSortedExpenseHistory() {
  const st = ui.getSortState('eh');
  return st ? ui.sortData(S.expenseHistory, st.key, st.dir) : S.expenseHistory;
}


// ════════════════════════════════════════
// ROUTE 8: DAILY REPORT (S8)
// ════════════════════════════════════════
function renderDailyReport() {
  const today = sydneyToday();
  return SPG.shell(`
    ${SPG.toolbar('Daily Report', `${backBtn('dashboard', 'Dashboard')} <button class="btn btn-primary btn-sm" onclick="SalesSection.saveDailyReport()">Save & Submit</button>`)}
    <div class="content">
      ${storeSelector()}
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <label class="lb" style="margin:0">Date</label>
        <input class="fl" type="date" id="dr-date" value="${esc(today)}" onchange="SalesSection.loadDailyReport()" style="max-width:180px">
      </div>
      <div id="dr-content">${ui.skeleton(400)}</div>
    </div>`, SECTION_LABEL);
}

async function loadDailyReport() {
  const date = document.getElementById('dr-date')?.value || sydneyToday();
  const storeId = getStoreId();
  const el = document.getElementById('dr-content');
  if (el) el.innerHTML = ui.skeleton(400);
  try {
    const [report, summary] = await Promise.all([
      sPost('sd_get_daily_report', { store_id: storeId, date }),
      sPost('sd_get_s8_summary', { store_id: storeId, date }).catch(() => null),
    ]);
    S.dailyReport = report;
    fillDailyReport(report, summary);
  } catch (e) {
    if (el) el.innerHTML = ui.empty('❌', 'Failed to load', e.message);
  }
}

function fillDailyReport(report, summary) {
  const el = document.getElementById('dr-content');
  if (!el) return;

  const sales = summary?.total_sales || report?.total_sales || 0;
  const expenses = summary?.total_expenses || report?.total_expenses || 0;
  const cashOnHand = summary?.cash_on_hand || report?.cash_on_hand || 0;
  const cashVariance = summary?.cash_variance || report?.cash_variance || 0;

  el.innerHTML = `
    <div class="sl">Summary</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin-bottom:20px">
      ${kpiBox('Total Sales', fmtAUD(sales), '', 'var(--blue)')}
      ${kpiBox('Total Expenses', fmtAUD(expenses), '', 'var(--orange)')}
      ${kpiBox('Net Income', fmtAUD(sales - expenses), '', sales - expenses >= 0 ? 'var(--green)' : 'var(--red)')}
      ${kpiBox('Cash on Hand', fmtAUD(cashOnHand), cashVariance ? 'Var: ' + fmtAUD(cashVariance) : '')}
    </div>

    <div class="sl">Channel Breakdown</div>
    <div id="dr-channels" style="margin-bottom:20px">
      ${(summary?.channel_breakdown || report?.channel_breakdown || []).length
        ? `<table class="tbl"><thead><tr><th>Channel</th><th style="text-align:right">Amount</th></tr></thead><tbody>
          ${(summary?.channel_breakdown || report?.channel_breakdown || []).map(c =>
            `<tr><td>${esc(c.channel_name)}</td><td style="text-align:right">${fmtAUD(c.amount)}</td></tr>`
          ).join('')}</tbody></table>`
        : `<div style="font-size:11px;color:var(--t3)">No channel data</div>`
      }
    </div>

    <div class="sl">Expense Breakdown</div>
    <div id="dr-expenses" style="margin-bottom:20px">
      ${(summary?.expense_breakdown || report?.expense_breakdown || []).length
        ? `<table class="tbl"><thead><tr><th>Category</th><th style="text-align:right">Amount</th><th>Count</th></tr></thead><tbody>
          ${(summary?.expense_breakdown || report?.expense_breakdown || []).map(c =>
            `<tr><td>${esc(c.category)}</td><td style="text-align:right">${fmtAUD(c.amount)}</td><td>${c.count || '-'}</td></tr>`
          ).join('')}</tbody></table>`
        : `<div style="font-size:11px;color:var(--t3)">No expense data</div>`
      }
    </div>

    <div class="sl">Manager Notes</div>
    <div class="fg"><textarea class="inp" id="dr-notes" rows="4" style="width:100%;box-sizing:border-box" placeholder="Notes, observations, issues...">${esc(report?.manager_notes || '')}</textarea></div>

    <div class="sl">Daily Tasks / Follow-ups</div>
    <div class="fg"><textarea class="inp" id="dr-tasks" rows="3" style="width:100%;box-sizing:border-box" placeholder="Tasks completed, pending items...">${esc(report?.task_notes || '')}</textarea></div>

    <div style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:11px;color:var(--t3)">
      ${report?.status ? `Status: ${ui.badge(report.status)}` : ''}
      ${report?.submitted_at ? `| Submitted: ${fmtDateTime(report.submitted_at)}` : ''}
      ${report?.submitted_by_name ? `by ${esc(report.submitted_by_name)}` : ''}
    </div>`;
}

async function saveDailyReport() {
  const date = document.getElementById('dr-date')?.value || sydneyToday();
  const storeId = getStoreId();
  const manager_notes = document.getElementById('dr-notes')?.value.trim();
  const task_notes = document.getElementById('dr-tasks')?.value.trim();

  SPG.showLoader();
  try {
    await sPost('sd_save_daily_report', { store_id: storeId, date, manager_notes, task_notes });
    SPG.toast('Daily report saved', 'success');
    loadDailyReport();
  } catch (e) {
    SPG.toast(e.message || 'Save failed', 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ════════════════════════════════════════
// ROUTE 9: TASKS
// ════════════════════════════════════════
function renderTasks() {
  return SPG.shell(`
    ${SPG.toolbar('Tasks', `${backBtn('dashboard', 'Dashboard')} <button class="btn btn-primary btn-sm" onclick="SalesSection.showTaskForm()">+ New Task</button>`)}
    <div class="content">
      ${storeSelector()}
      ${ui.filterBar([
        { id: 'task-status', label: 'Status', type: 'select', options: [
          { value: '', label: 'All' }, { value: 'open', label: 'Open' },
          { value: 'in_progress', label: 'In Progress' }, { value: 'done', label: 'Done' },
        ], value: '', onChange: 'SalesSection.loadTasks()' },
      ])}
      <div id="task-list">${ui.skeleton(200)}</div>
    </div>`, SECTION_LABEL);
}

async function loadTasks() {
  const storeId = getStoreId();
  const status = document.getElementById('task-status')?.value || '';
  const el = document.getElementById('task-list');
  if (el) el.innerHTML = ui.skeleton(200);
  try {
    const data = await sPost('sd_get_tasks', { store_id: storeId, status });
    S.tasks = data?.tasks || [];
    fillTasks();
  } catch (e) {
    if (el) el.innerHTML = ui.empty('❌', 'Failed to load', e.message);
  }
}

function fillTasks() {
  const el = document.getElementById('task-list');
  if (!el) return;
  if (!S.tasks.length) {
    el.innerHTML = ui.empty('📝', 'No tasks', 'Create a task to track follow-ups');
    return;
  }
  el.innerHTML = S.tasks.map(t => `<div class="card" style="margin-bottom:8px;padding:12px 14px;cursor:pointer" onclick="SalesSection.showTaskDetail('${esc(t.task_id)}')">
    <div style="display:flex;justify-content:space-between;align-items:start">
      <div>
        <div style="font-size:13px;font-weight:600">${esc(t.title)}</div>
        <div style="font-size:11px;color:var(--t3);margin-top:2px">${esc(t.description || '').substring(0, 80)}${(t.description || '').length > 80 ? '...' : ''}</div>
        <div style="font-size:10px;color:var(--t4);margin-top:4px">
          ${t.assigned_to_name ? 'Assigned: ' + esc(t.assigned_to_name) : ''}
          ${t.due_date ? ' | Due: ' + fmtDate(t.due_date) : ''}
        </div>
      </div>
      <div>${ui.badge(t.status || 'open')}</div>
    </div>
  </div>`).join('');
}

function showTaskForm(taskId) {
  const existing = taskId ? S.tasks.find(t => t.task_id === taskId) : null;
  SPG.showDialog(`<div class="popup-sheet" style="width:400px">
    <div class="popup-header"><div class="popup-title">${existing ? 'Edit' : 'New'} Task</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Title *</label><input class="inp" id="task-title" value="${esc(existing?.title || '')}" placeholder="Task title"></div>
    <div class="fg"><label class="lb">Description</label><textarea class="inp" id="task-desc" rows="3" style="width:100%;box-sizing:border-box" placeholder="Details...">${esc(existing?.description || '')}</textarea></div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Priority</label>
        <select class="inp" id="task-priority">
          <option value="low"${existing?.priority === 'low' ? ' selected' : ''}>Low</option>
          <option value="medium"${(!existing || existing?.priority === 'medium') ? ' selected' : ''}>Medium</option>
          <option value="high"${existing?.priority === 'high' ? ' selected' : ''}>High</option>
        </select>
      </div>
      <div class="fg" style="flex:1"><label class="lb">Due Date</label><input class="inp" type="date" id="task-due" value="${esc(existing?.due_date || '')}"></div>
    </div>
    <div class="fg"><label class="lb">Status</label>
      <select class="inp" id="task-st">
        <option value="open"${(!existing || existing?.status === 'open') ? ' selected' : ''}>Open</option>
        <option value="in_progress"${existing?.status === 'in_progress' ? ' selected' : ''}>In Progress</option>
        <option value="done"${existing?.status === 'done' ? ' selected' : ''}>Done</option>
      </select>
    </div>
    <div class="error-msg" id="task-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" id="btn-task-save" onclick="SalesSection.saveTask('${esc(taskId || '')}')">${existing ? 'Update' : 'Create'}</button>
    </div>
  </div>`);
}

function showTaskDetail(taskId) {
  // Open edit form for now
  showTaskForm(taskId);
}

async function saveTask(taskId) {
  const title = document.getElementById('task-title')?.value.trim();
  const description = document.getElementById('task-desc')?.value.trim();
  const priority = document.getElementById('task-priority')?.value;
  const due_date = document.getElementById('task-due')?.value || null;
  const status = document.getElementById('task-st')?.value;
  const storeId = getStoreId();

  if (!title) { SPG.showError('task-error', 'Title is required'); return; }
  const btn = document.getElementById('btn-task-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  try {
    const action = taskId ? 'sd_update_task' : 'sd_create_task';
    const payload = { store_id: storeId, title, description, priority, due_date, status };
    if (taskId) payload.task_id = taskId;
    await sPost(action, payload);
    SPG.closeDialog();
    SPG.toast(taskId ? 'Task updated' : 'Task created', 'success');
    loadTasks();
  } catch (e) {
    SPG.showError('task-error', e.message || 'Save failed');
    if (btn) { btn.disabled = false; btn.textContent = taskId ? 'Update' : 'Create'; }
  }
}


// ════════════════════════════════════════
// ROUTE 10: DAILY HUB (all stores overview)
// ════════════════════════════════════════
function renderDailyHub() {
  const today = sydneyToday();
  return SPG.shell(`
    ${SPG.toolbar('Daily Hub', backBtn('dashboard', 'Dashboard'))}
    <div class="content">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
        <label class="lb" style="margin:0">Date</label>
        <input class="fl" type="date" id="hub-date" value="${esc(today)}" onchange="SalesSection.loadDailyHub()" style="max-width:180px">
        <button class="btn btn-outline btn-sm" onclick="SalesSection.loadDailyHub()">Refresh</button>
      </div>
      <div id="hub-kpi" style="margin-bottom:20px">${ui.skeleton(80, 3)}</div>
      <div id="hub-stores">${ui.skeleton(300)}</div>
    </div>`, SECTION_LABEL);
}

async function loadDailyHub() {
  const date = document.getElementById('hub-date')?.value || sydneyToday();
  const el = document.getElementById('hub-stores');
  const kEl = document.getElementById('hub-kpi');
  if (el) el.innerHTML = ui.skeleton(300);
  if (kEl) kEl.innerHTML = ui.skeleton(80, 3);
  try {
    const data = await sPost('sd_get_daily_hub', { date });
    S.hubData = data;
    fillDailyHub(data);
  } catch (e) {
    if (el) el.innerHTML = ui.empty('❌', 'Failed to load', e.message);
  }
}

function fillDailyHub(data) {
  // KPIs
  const kEl = document.getElementById('hub-kpi');
  if (kEl && data) {
    kEl.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px">
      ${kpiBox('Total Sales (All)', fmtAUD(data.grand_total_sales || 0), '', 'var(--blue)')}
      ${kpiBox('Total Expenses', fmtAUD(data.grand_total_expenses || 0), '', 'var(--orange)')}
      ${kpiBox('Stores Reported', (data.reported_count || 0) + '/' + (data.total_stores || 0), '', 'var(--green)')}
    </div>`;
  }

  // Stores table
  const el = document.getElementById('hub-stores');
  if (!el) return;
  const stores = data?.stores || [];
  if (!stores.length) {
    el.innerHTML = ui.empty('🏢', 'No store data');
    return;
  }
  el.innerHTML = `<table class="tbl">
    <thead><tr>
      ${ui.sortTh('hub', 'store_id', 'Store')}
      ${ui.sortTh('hub', 'total_sales', 'Sales', ' style="text-align:right"')}
      ${ui.sortTh('hub', 'total_expenses', 'Expenses', ' style="text-align:right"')}
      <th style="text-align:right">Net</th>
      <th>Status</th>
      <th style="width:60px"></th>
    </tr></thead>
    <tbody>
    ${getHubSorted(stores).map(s => `<tr>
      <td style="font-weight:600">${esc(s.store_id)}</td>
      <td style="text-align:right">${fmtAUD(s.total_sales)}</td>
      <td style="text-align:right">${fmtAUD(s.total_expenses)}</td>
      <td style="text-align:right">${fmtAUD((s.total_sales || 0) - (s.total_expenses || 0))}</td>
      <td>${ui.badge(s.status || 'pending')}</td>
      <td><span style="cursor:pointer;color:var(--blue);font-size:11px" onclick="SalesSection.viewStoreDetail('${esc(s.store_id)}')">View</span></td>
    </tr>`).join('')}
    </tbody>
  </table>`;
}

function getHubSorted(stores) {
  const st = ui.getSortState('hub');
  return st ? ui.sortData(stores, st.key, st.dir) : stores;
}

async function viewStoreDetail(storeId) {
  const date = document.getElementById('hub-date')?.value || sydneyToday();
  SPG.showLoader();
  try {
    const data = await sPost('sd_get_daily_detail', { store_id: storeId, date });
    SPG.hideLoader();
    SPG.showDialog(`<div class="popup-sheet" style="width:500px;max-height:80vh;overflow-y:auto">
      <div class="popup-header"><div class="popup-title">${esc(storeId)} — ${fmtDate(date)}</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        ${kpiBox('Sales', fmtAUD(data?.total_sales || 0), '', 'var(--blue)')}
        ${kpiBox('Expenses', fmtAUD(data?.total_expenses || 0), '', 'var(--orange)')}
      </div>
      <div class="sl">Channels</div>
      ${(data?.channels || []).length
        ? `<table class="tbl"><thead><tr><th>Channel</th><th style="text-align:right">Amount</th></tr></thead><tbody>
          ${(data.channels || []).map(c => `<tr><td>${esc(c.channel_name)}</td><td style="text-align:right">${fmtAUD(c.amount)}</td></tr>`).join('')}
          </tbody></table>`
        : '<div style="font-size:11px;color:var(--t3);margin-bottom:12px">No channel data</div>'
      }
      <div class="sl" style="margin-top:12px">Expenses</div>
      ${(data?.expenses || []).length
        ? `<table class="tbl"><thead><tr><th>Category</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>
          ${(data.expenses || []).map(e => `<tr><td>${esc(e.category)}</td><td>${esc(e.description || '-')}</td><td style="text-align:right">${fmtAUD(e.amount)}</td></tr>`).join('')}
          </tbody></table>`
        : '<div style="font-size:11px;color:var(--t3);margin-bottom:12px">No expense data</div>'
      }
      <div class="sl" style="margin-top:12px">Cash</div>
      <div style="font-size:12px;margin-bottom:8px">
        Cash on hand: <strong>${fmtAUD(data?.cash_on_hand || 0)}</strong> |
        Variance: <strong style="color:${Math.abs(data?.cash_variance || 0) < 1 ? 'var(--green)' : 'var(--red)'}">${fmtAUD(data?.cash_variance || 0)}</strong>
      </div>
      ${data?.manager_notes ? `<div class="sl" style="margin-top:12px">Manager Notes</div><div style="font-size:12px;color:var(--t2)">${esc(data.manager_notes)}</div>` : ''}
      <div class="popup-actions" style="margin-top:16px">
        <button class="btn btn-outline" onclick="SPG.closeDialog()">Close</button>
      </div>
    </div>`);
  } catch (e) {
    SPG.hideLoader();
    SPG.toast(e.message || 'Failed to load detail', 'error');
  }
}


// ════════════════════════════════════════
// ROUTE 11: ACC REVIEW (Admin)
// ════════════════════════════════════════
function renderAccReview() {
  return SPG.shell(`
    ${SPG.toolbar('Account / Sync Review', backBtn('dashboard', 'Dashboard'))}
    <div class="content">
      ${ui.filterBar([
        { id: 'ar-from', label: 'From', type: 'date', value: sydneyToday(), onChange: 'SalesSection.loadAccReview()' },
        { id: 'ar-to', label: 'To', type: 'date', value: sydneyToday(), onChange: 'SalesSection.loadAccReview()' },
        { id: 'ar-store', label: 'Store', type: 'select', options: [{ value: '', label: 'All Stores' }], value: '', onChange: 'SalesSection.loadAccReview()' },
      ])}
      <div id="ar-content">${ui.skeleton(300)}</div>
    </div>`, SECTION_LABEL);
}

async function loadAccReview() {
  const from = document.getElementById('ar-from')?.value || '';
  const to = document.getElementById('ar-to')?.value || '';
  const storeId = document.getElementById('ar-store')?.value || '';
  const el = document.getElementById('ar-content');
  if (el) el.innerHTML = ui.skeleton(300);

  // Populate store filter if needed
  if (!S.storeList) {
    try {
      const stores = await SPG.perm.getStoresCache();
      S.storeList = stores.filter(s => s.store_id !== 'ALL' && s.store_id !== 'HQ');
      const sel = document.getElementById('ar-store');
      if (sel && sel.options.length <= 1) {
        S.storeList.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.store_id;
          opt.textContent = s.store_id;
          sel.appendChild(opt);
        });
      }
    } catch { /* ignore */ }
  }

  try {
    const data = await sPost('sd_get_acc_review', { date_from: from, date_to: to, store_id: storeId });
    fillAccReview(data);
  } catch (e) {
    if (el) el.innerHTML = ui.empty('❌', 'Failed to load', e.message);
  }
}

function fillAccReview(data) {
  const el = document.getElementById('ar-content');
  if (!el) return;
  const records = data?.records || [];
  if (!records.length) {
    el.innerHTML = ui.empty('🔍', 'No records found');
    return;
  }
  el.innerHTML = `<table class="tbl">
    <thead><tr>
      <th>Date</th><th>Store</th><th style="text-align:right">Sales</th><th style="text-align:right">Expenses</th>
      <th style="text-align:right">Cash</th><th>Sync</th><th style="width:100px"></th>
    </tr></thead>
    <tbody>
    ${records.map(r => `<tr>
      <td>${fmtDate(r.date)}</td>
      <td>${esc(r.store_id)}</td>
      <td style="text-align:right">${fmtAUD(r.total_sales)}</td>
      <td style="text-align:right">${fmtAUD(r.total_expenses)}</td>
      <td style="text-align:right">${fmtAUD(r.cash_on_hand)}</td>
      <td>${ui.badge(r.sync_status || 'pending')}</td>
      <td>
        ${r.sync_status !== 'synced' ? `<span style="cursor:pointer;color:var(--blue);font-size:11px" onclick="SalesSection.syncDay('${esc(r.store_id)}','${esc(r.date)}')">Sync</span>` : ''}
        <span style="cursor:pointer;color:var(--orange);font-size:11px;margin-left:4px" onclick="SalesSection.unlockDay('${esc(r.store_id)}','${esc(r.date)}')">Unlock</span>
      </td>
    </tr>`).join('')}
    </tbody>
  </table>`;
}

async function syncDay(storeId, date) {
  if (!confirm(`Sync ${storeId} data for ${date}?`)) return;
  SPG.showLoader();
  try {
    await sPost('sd_sync_day', { store_id: storeId, date });
    SPG.toast('Day synced successfully', 'success');
    loadAccReview();
  } catch (e) {
    SPG.toast(e.message || 'Sync failed', 'error');
  } finally {
    SPG.hideLoader();
  }
}

async function unlockDay(storeId, date) {
  if (!confirm(`Unlock ${storeId} for ${date}? This will allow re-editing.`)) return;
  SPG.showLoader();
  try {
    await sPost('sd_unlock_day', { store_id: storeId, date });
    SPG.toast('Day unlocked', 'success');
    loadAccReview();
  } catch (e) {
    SPG.toast(e.message || 'Unlock failed', 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ════════════════════════════════════════
// ROUTE 12: ADMIN REPORT
// ════════════════════════════════════════
function renderAdminReport() {
  return SPG.shell(`
    ${SPG.toolbar('Report Dashboard', backBtn('dashboard', 'Dashboard'))}
    <div class="content">
      ${ui.filterBar([
        { id: 'rpt-period', label: 'Period', type: 'select', options: [
          { value: 'today', label: 'Today' }, { value: 'week', label: 'This Week' },
          { value: 'month', label: 'This Month' }, { value: 'custom', label: 'Custom' },
        ], value: 'week', onChange: 'SalesSection.loadAdminReport()' },
        { id: 'rpt-from', label: 'From', type: 'date', value: '', onChange: 'SalesSection.loadAdminReport()' },
        { id: 'rpt-to', label: 'To', type: 'date', value: '', onChange: 'SalesSection.loadAdminReport()' },
      ])}
      <div id="rpt-content">${ui.skeleton(400)}</div>
    </div>`, SECTION_LABEL);
}

async function loadAdminReport() {
  const period = document.getElementById('rpt-period')?.value || 'week';
  const from = document.getElementById('rpt-from')?.value || '';
  const to = document.getElementById('rpt-to')?.value || '';
  const el = document.getElementById('rpt-content');
  if (el) el.innerHTML = ui.skeleton(400);
  try {
    const data = await sPost('sd_get_report_dashboard', { period, date_from: from, date_to: to });
    fillAdminReport(data);
  } catch (e) {
    if (el) el.innerHTML = ui.empty('❌', 'Failed to load', e.message);
  }
}

function fillAdminReport(data) {
  const el = document.getElementById('rpt-content');
  if (!el) return;

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:20px">
      ${kpiBox('Total Sales', fmtAUD(data?.total_sales || 0), '', 'var(--blue)')}
      ${kpiBox('Total Expenses', fmtAUD(data?.total_expenses || 0), '', 'var(--orange)')}
      ${kpiBox('Net Income', fmtAUD((data?.total_sales || 0) - (data?.total_expenses || 0)), '', 'var(--green)')}
      ${kpiBox('Avg Daily Sales', fmtAUD(data?.avg_daily_sales || 0))}
    </div>

    <div class="sl">Sales by Store</div>
    ${(data?.by_store || []).length
      ? `<table class="tbl"><thead><tr><th>Store</th><th style="text-align:right">Sales</th><th style="text-align:right">Expenses</th><th style="text-align:right">Net</th><th style="text-align:right">Avg/Day</th></tr></thead><tbody>
        ${(data.by_store || []).map(s => `<tr>
          <td style="font-weight:600">${esc(s.store_id)}</td>
          <td style="text-align:right">${fmtAUD(s.total_sales)}</td>
          <td style="text-align:right">${fmtAUD(s.total_expenses)}</td>
          <td style="text-align:right">${fmtAUD((s.total_sales || 0) - (s.total_expenses || 0))}</td>
          <td style="text-align:right">${fmtAUD(s.avg_daily_sales || 0)}</td>
        </tr>`).join('')}
        </tbody></table>`
      : `<div style="font-size:11px;color:var(--t3);margin-bottom:16px">No store data</div>`
    }

    <div class="sl" style="margin-top:16px">Top Expense Categories</div>
    ${(data?.top_categories || []).length
      ? `<table class="tbl"><thead><tr><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:right">%</th></tr></thead><tbody>
        ${(data.top_categories || []).map(c => `<tr>
          <td>${esc(c.category)}</td>
          <td style="text-align:right">${fmtAUD(c.amount)}</td>
          <td style="text-align:right">${(c.percentage || 0).toFixed(1)}%</td>
        </tr>`).join('')}
        </tbody></table>`
      : `<div style="font-size:11px;color:var(--t3)">No category data</div>`
    }

    <div class="sl" style="margin-top:16px">Daily Trend</div>
    ${(data?.daily_trend || []).length
      ? `<table class="tbl"><thead><tr><th>Date</th><th style="text-align:right">Sales</th><th style="text-align:right">Expenses</th><th style="text-align:right">Net</th></tr></thead><tbody>
        ${(data.daily_trend || []).map(d => `<tr>
          <td>${fmtDate(d.date)}</td>
          <td style="text-align:right">${fmtAUD(d.sales)}</td>
          <td style="text-align:right">${fmtAUD(d.expenses)}</td>
          <td style="text-align:right;color:${(d.sales - d.expenses) >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtAUD(d.sales - d.expenses)}</td>
        </tr>`).join('')}
        </tbody></table>`
      : `<div style="font-size:11px;color:var(--t3)">No trend data</div>`
    }`;
}


// ════════════════════════════════════════
// ROUTE 13: CHANNELS (Admin)
// ════════════════════════════════════════
function renderChannels() {
  return SPG.shell(`
    ${SPG.toolbar('Manage Channels', `${backBtn('dashboard', 'Dashboard')} <button class="btn btn-primary btn-sm" onclick="SalesSection.showChannelForm()">+ Add Channel</button>`)}
    <div class="content">
      <div id="ch-list">${ui.skeleton(200)}</div>
    </div>`, SECTION_LABEL);
}

async function loadChannels() {
  const el = document.getElementById('ch-list');
  if (el) el.innerHTML = ui.skeleton(200);
  try {
    const data = await sPost('sd_admin_get_channels', {});
    S.channels = data?.channels || [];
    fillChannels();
  } catch (e) {
    if (el) el.innerHTML = ui.empty('❌', 'Failed to load', e.message);
  }
}

function fillChannels() {
  const el = document.getElementById('ch-list');
  if (!el) return;
  if (!S.channels.length) {
    el.innerHTML = ui.empty('📊', 'No channels configured', 'Add your first sale channel');
    return;
  }
  el.innerHTML = `<table class="tbl">
    <thead><tr><th style="width:40px">#</th><th>Channel Name</th><th>Type</th><th>Status</th><th style="width:120px"></th></tr></thead>
    <tbody>
    ${S.channels.map((c, i) => `<tr data-id="${esc(c.channel_id)}">
      <td style="text-align:center;color:var(--t3)">${i + 1}</td>
      <td style="font-weight:600">${esc(c.channel_name)}</td>
      <td>${esc(c.channel_type || '-')}</td>
      <td>${ui.badge(c.is_active ? 'active' : 'inactive')}</td>
      <td>
        <span style="cursor:pointer;color:var(--blue);font-size:11px" onclick="SalesSection.showChannelForm('${esc(c.channel_id)}')">Edit</span>
        ${i > 0 ? `<span style="cursor:pointer;color:var(--t3);font-size:11px;margin-left:6px" onclick="SalesSection.reorderChannel('${esc(c.channel_id)}','up')">↑</span>` : ''}
        ${i < S.channels.length - 1 ? `<span style="cursor:pointer;color:var(--t3);font-size:11px;margin-left:4px" onclick="SalesSection.reorderChannel('${esc(c.channel_id)}','down')">↓</span>` : ''}
      </td>
    </tr>`).join('')}
    </tbody>
  </table>`;
}

function showChannelForm(chId) {
  const existing = chId ? S.channels.find(c => c.channel_id === chId) : null;
  SPG.showDialog(`<div class="popup-sheet" style="width:380px">
    <div class="popup-header"><div class="popup-title">${existing ? 'Edit' : 'Add'} Channel</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Channel Name *</label><input class="inp" id="ch-name" value="${esc(existing?.channel_name || '')}" placeholder="e.g. Dine-in, Uber Eats"></div>
    <div class="fg"><label class="lb">Type</label>
      <select class="inp" id="ch-type">
        <option value="dine_in"${existing?.channel_type === 'dine_in' ? ' selected' : ''}>Dine-in</option>
        <option value="takeaway"${existing?.channel_type === 'takeaway' ? ' selected' : ''}>Takeaway</option>
        <option value="delivery"${existing?.channel_type === 'delivery' ? ' selected' : ''}>Delivery</option>
        <option value="online"${existing?.channel_type === 'online' ? ' selected' : ''}>Online</option>
        <option value="catering"${existing?.channel_type === 'catering' ? ' selected' : ''}>Catering</option>
        <option value="other"${existing?.channel_type === 'other' ? ' selected' : ''}>Other</option>
      </select>
    </div>
    <div class="fg"><label class="lb">Active</label>
      <select class="inp" id="ch-active">
        <option value="1"${!existing || existing?.is_active ? ' selected' : ''}>Yes</option>
        <option value="0"${existing && !existing.is_active ? ' selected' : ''}>No</option>
      </select>
    </div>
    <div class="error-msg" id="ch-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" id="btn-ch-save" onclick="SalesSection.saveChannel('${esc(chId || '')}')">${existing ? 'Update' : 'Create'}</button>
    </div>
  </div>`);
}

async function saveChannel(chId) {
  const channel_name = document.getElementById('ch-name')?.value.trim();
  const channel_type = document.getElementById('ch-type')?.value;
  const is_active = document.getElementById('ch-active')?.value === '1';
  if (!channel_name) { SPG.showError('ch-error', 'Channel name is required'); return; }
  const btn = document.getElementById('btn-ch-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  try {
    const action = chId ? 'sd_admin_update_channel' : 'sd_admin_create_channel';
    const payload = { channel_name, channel_type, is_active };
    if (chId) payload.channel_id = chId;
    await sPost(action, payload);
    SPG.closeDialog();
    SPG.toast(chId ? 'Channel updated' : 'Channel created', 'success');
    loadChannels();
  } catch (e) {
    SPG.showError('ch-error', e.message || 'Save failed');
    if (btn) { btn.disabled = false; btn.textContent = chId ? 'Update' : 'Create'; }
  }
}

async function reorderChannel(chId, direction) {
  try {
    await sPost('sd_reorder_channel', { channel_id: chId, direction });
    loadChannels();
  } catch (e) {
    SPG.toast(e.message || 'Reorder failed', 'error');
  }
}


// ════════════════════════════════════════
// ROUTE 14: VENDORS (Admin)
// ════════════════════════════════════════
function renderVendors() {
  return SPG.shell(`
    ${SPG.toolbar('Vendors / Suppliers', `${backBtn('dashboard', 'Dashboard')} <button class="btn btn-primary btn-sm" onclick="SalesSection.showVendorForm()">+ Add Vendor</button>`)}
    <div class="content">
      ${ui.filterBar([
        { id: 'ven-search', label: 'Search', type: 'text', placeholder: 'Name, contact...', onChange: 'SalesSection.filterVendors()' },
      ])}
      <div id="ven-list">${ui.skeleton(200)}</div>
    </div>`, SECTION_LABEL);
}

async function loadVendors() {
  const el = document.getElementById('ven-list');
  if (el) el.innerHTML = ui.skeleton(200);
  try {
    const data = await sPost('sd_admin_get_suppliers', {});
    S.vendors = data?.suppliers || [];
    fillVendors();
  } catch (e) {
    if (el) el.innerHTML = ui.empty('❌', 'Failed to load', e.message);
  }
}

function fillVendors(filter) {
  const el = document.getElementById('ven-list');
  if (!el) return;
  let list = S.vendors || [];
  if (filter) {
    const q = filter.toLowerCase();
    list = list.filter(v => (v.supplier_name || '').toLowerCase().includes(q) || (v.contact_name || '').toLowerCase().includes(q));
  }
  if (!list.length) {
    el.innerHTML = ui.empty('🏪', filter ? 'No matching vendors' : 'No vendors configured');
    return;
  }
  el.innerHTML = `<table class="tbl">
    <thead><tr>
      ${ui.sortTh('ven', 'supplier_name', 'Name')}
      <th>Contact</th><th>Phone</th><th>Email</th><th>Status</th><th style="width:50px"></th>
    </tr></thead>
    <tbody>
    ${getVendorsSorted(list).map(v => `<tr>
      <td style="font-weight:600">${esc(v.supplier_name)}</td>
      <td>${esc(v.contact_name || '-')}</td>
      <td>${esc(v.phone || '-')}</td>
      <td>${esc(v.email || '-')}</td>
      <td>${ui.badge(v.is_active ? 'active' : 'inactive')}</td>
      <td><span style="cursor:pointer;color:var(--blue);font-size:11px" onclick="SalesSection.showVendorForm('${esc(v.supplier_id)}')">Edit</span></td>
    </tr>`).join('')}
    </tbody>
  </table>`;
}

function getVendorsSorted(list) {
  const st = ui.getSortState('ven');
  return st ? ui.sortData(list, st.key, st.dir) : list;
}

function filterVendors() {
  const q = document.getElementById('ven-search')?.value.trim() || '';
  fillVendors(q || null);
}

function showVendorForm(venId) {
  const existing = venId ? S.vendors.find(v => v.supplier_id === venId) : null;
  SPG.showDialog(`<div class="popup-sheet" style="width:420px">
    <div class="popup-header"><div class="popup-title">${existing ? 'Edit' : 'Add'} Vendor</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Vendor Name *</label><input class="inp" id="ven-name" value="${esc(existing?.supplier_name || '')}" placeholder="Business name"></div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Contact Person</label><input class="inp" id="ven-contact" value="${esc(existing?.contact_name || '')}"></div>
      <div class="fg" style="flex:1"><label class="lb">Phone</label><input class="inp" id="ven-phone" value="${esc(existing?.phone || '')}"></div>
    </div>
    <div class="fg"><label class="lb">Email</label><input class="inp" id="ven-email" value="${esc(existing?.email || '')}" placeholder="vendor@example.com"></div>
    <div class="fg"><label class="lb">ABN</label><input class="inp" id="ven-abn" value="${esc(existing?.abn || '')}" placeholder="Australian Business Number"></div>
    <div class="fg"><label class="lb">Address</label><textarea class="inp" id="ven-addr" rows="2" style="width:100%;box-sizing:border-box">${esc(existing?.address || '')}</textarea></div>
    <div class="fg"><label class="lb">Active</label>
      <select class="inp" id="ven-active">
        <option value="1"${!existing || existing?.is_active ? ' selected' : ''}>Yes</option>
        <option value="0"${existing && !existing.is_active ? ' selected' : ''}>No</option>
      </select>
    </div>
    <div class="fg"><label class="lb">Notes</label><textarea class="inp" id="ven-notes" rows="2" style="width:100%;box-sizing:border-box">${esc(existing?.notes || '')}</textarea></div>
    <div class="error-msg" id="ven-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" id="btn-ven-save" onclick="SalesSection.saveVendor('${esc(venId || '')}')">${existing ? 'Update' : 'Create'}</button>
    </div>
  </div>`);
}

async function saveVendor(venId) {
  const supplier_name = document.getElementById('ven-name')?.value.trim();
  const contact_name = document.getElementById('ven-contact')?.value.trim();
  const phone = document.getElementById('ven-phone')?.value.trim();
  const email = document.getElementById('ven-email')?.value.trim();
  const abn = document.getElementById('ven-abn')?.value.trim();
  const address = document.getElementById('ven-addr')?.value.trim();
  const is_active = document.getElementById('ven-active')?.value === '1';
  const notes = document.getElementById('ven-notes')?.value.trim();

  if (!supplier_name) { SPG.showError('ven-error', 'Vendor name is required'); return; }
  const btn = document.getElementById('btn-ven-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  try {
    const action = venId ? 'sd_admin_update_supplier' : 'sd_create_vendor';
    const payload = { supplier_name, contact_name, phone, email, abn, address, is_active, notes };
    if (venId) payload.supplier_id = venId;
    await sPost(action, payload);
    SPG.closeDialog();
    SPG.toast(venId ? 'Vendor updated' : 'Vendor created', 'success');
    loadVendors();
  } catch (e) {
    SPG.showError('ven-error', e.message || 'Save failed');
    if (btn) { btn.disabled = false; btn.textContent = venId ? 'Update' : 'Create'; }
  }
}


// ════════════════════════════════════════
// ROUTE 15: CONFIG (Admin)
// ════════════════════════════════════════
function renderConfig() {
  return SPG.shell(`
    ${SPG.toolbar('System Config', `${backBtn('dashboard', 'Dashboard')} <button class="btn btn-primary btn-sm" id="btn-cfg-save" onclick="SalesSection.saveConfig()">Save</button>`)}
    <div class="content">
      <div id="cfg-content">${ui.skeleton(300)}</div>
    </div>`, SECTION_LABEL);
}

async function loadConfig() {
  const el = document.getElementById('cfg-content');
  if (el) el.innerHTML = ui.skeleton(300);
  try {
    const data = await sPost('sd_admin_get_settings', {});
    S.settings = data?.settings || {};
    fillConfig(S.settings);
  } catch (e) {
    if (el) el.innerHTML = ui.empty('❌', 'Failed to load', e.message);
  }
}

function fillConfig(settings) {
  const el = document.getElementById('cfg-content');
  if (!el) return;
  el.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px">General Settings</div>
      <div class="fg"><label class="lb">Timezone</label><input class="inp" id="cfg-tz" value="${esc(settings.timezone || 'Australia/Sydney')}" readonly class="inp-readonly"></div>
      <div class="fg"><label class="lb">Currency</label><input class="inp" id="cfg-currency" value="${esc(settings.currency || 'AUD')}" readonly class="inp-readonly"></div>
      <div class="fg"><label class="lb">Daily Cutoff Time (24h)</label>
        <input class="inp" id="cfg-cutoff" type="time" value="${esc(settings.daily_cutoff || '23:59')}">
      </div>
      <div class="fg"><label class="lb">Week Start</label>
        <select class="inp" id="cfg-weekstart">
          <option value="monday"${settings.week_start === 'monday' ? ' selected' : ''}>Monday</option>
          <option value="sunday"${settings.week_start === 'sunday' ? ' selected' : ''}>Sunday</option>
        </select>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px">Notifications</div>
      <div class="fg"><label class="lb">Enable Daily Reminder</label>
        <select class="inp" id="cfg-reminder">
          <option value="1"${settings.daily_reminder !== false ? ' selected' : ''}>Yes</option>
          <option value="0"${settings.daily_reminder === false ? ' selected' : ''}>No</option>
        </select>
      </div>
      <div class="fg"><label class="lb">Reminder Time</label>
        <input class="inp" id="cfg-reminder-time" type="time" value="${esc(settings.reminder_time || '20:00')}">
      </div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px">Cash Management</div>
      <div class="fg"><label class="lb">Cash Variance Alert Threshold ($)</label>
        <input class="inp" id="cfg-variance" type="number" step="0.01" value="${settings.cash_variance_threshold || 5}" min="0">
      </div>
      <div class="fg"><label class="lb">Require Cash Count Before Report</label>
        <select class="inp" id="cfg-cashreq">
          <option value="1"${settings.require_cash_count !== false ? ' selected' : ''}>Yes</option>
          <option value="0"${settings.require_cash_count === false ? ' selected' : ''}>No</option>
        </select>
      </div>
    </div>
    <div class="card">
      <div style="font-weight:700;font-size:13px;margin-bottom:12px">Report Settings</div>
      <div class="fg"><label class="lb">Auto-lock Reports After (days)</label>
        <input class="inp" id="cfg-autolock" type="number" value="${settings.auto_lock_days || 3}" min="0">
      </div>
      <div class="fg"><label class="lb">Allow Past Date Editing</label>
        <select class="inp" id="cfg-pastedit">
          <option value="1"${settings.allow_past_edit ? ' selected' : ''}>Yes</option>
          <option value="0"${!settings.allow_past_edit ? ' selected' : ''}>No</option>
        </select>
      </div>
    </div>`;
}

async function saveConfig() {
  const settings = {
    daily_cutoff: document.getElementById('cfg-cutoff')?.value || '23:59',
    week_start: document.getElementById('cfg-weekstart')?.value || 'monday',
    daily_reminder: document.getElementById('cfg-reminder')?.value === '1',
    reminder_time: document.getElementById('cfg-reminder-time')?.value || '20:00',
    cash_variance_threshold: parseFloat(document.getElementById('cfg-variance')?.value) || 5,
    require_cash_count: document.getElementById('cfg-cashreq')?.value === '1',
    auto_lock_days: parseInt(document.getElementById('cfg-autolock')?.value) || 3,
    allow_past_edit: document.getElementById('cfg-pastedit')?.value === '1',
  };
  const btn = document.getElementById('btn-cfg-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  try {
    await sPost('sd_admin_update_settings', { settings });
    S.settings = settings;
    SPG.toast('Settings saved', 'success');
  } catch (e) {
    SPG.toast(e.message || 'Save failed', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
  }
}


// ════════════════════════════════════════
// ROUTE 16: ACCESS (Admin permissions)
// ════════════════════════════════════════
function renderAccess() {
  return SPG.shell(`
    ${SPG.toolbar('User Permissions', `${backBtn('dashboard', 'Dashboard')} <button class="btn btn-primary btn-sm" id="btn-perm-save" onclick="SalesSection.savePermissions()">Save Changes</button>`)}
    <div class="content">
      <div style="font-size:11px;color:var(--t3);margin-bottom:12px">Set which users can access sales module features. Changes apply immediately after saving.</div>
      <div id="perm-content">${ui.skeleton(300)}</div>
    </div>`, SECTION_LABEL);
}

async function loadAccess() {
  const el = document.getElementById('perm-content');
  if (el) el.innerHTML = ui.skeleton(300);
  try {
    const data = await sPost('sd_admin_get_permissions', {});
    S.permissions = data?.permissions || [];
    fillAccess(data);
  } catch (e) {
    if (el) el.innerHTML = ui.empty('❌', 'Failed to load', e.message);
  }
}

function fillAccess(data) {
  const el = document.getElementById('perm-content');
  if (!el) return;
  const perms = data?.permissions || [];
  const positions = data?.positions || [];
  const features = data?.features || [
    { id: 'daily_sale', label: 'Daily Sale Entry' },
    { id: 'expense', label: 'Expense Entry' },
    { id: 'invoice', label: 'Invoice Management' },
    { id: 'cash', label: 'Cash Count' },
    { id: 'report', label: 'Daily Report' },
    { id: 'history', label: 'View History' },
    { id: 'daily_hub', label: 'Daily Hub (All Stores)' },
    { id: 'admin', label: 'Admin Access' },
  ];

  if (!positions.length) {
    el.innerHTML = ui.empty('👥', 'No positions configured');
    return;
  }

  el.innerHTML = `<div style="overflow-x:auto"><table class="tbl">
    <thead><tr>
      <th>Position</th>
      ${features.map(f => `<th style="text-align:center;font-size:10px;min-width:70px">${esc(f.label)}</th>`).join('')}
    </tr></thead>
    <tbody>
    ${positions.map(p => {
      return `<tr>
        <td style="font-weight:600;white-space:nowrap">${esc(p.position_name || p.position_id)}</td>
        ${features.map(f => {
          const perm = perms.find(pm => pm.position_id === p.position_id && pm.feature_id === f.id);
          const checked = perm ? perm.allowed : (p.position_level <= 2);
          return `<td style="text-align:center"><input type="checkbox" data-pos="${esc(p.position_id)}" data-feat="${esc(f.id)}"${checked ? ' checked' : ''}></td>`;
        }).join('')}
      </tr>`;
    }).join('')}
    </tbody>
  </table></div>`;
}

async function savePermissions() {
  const updates = [];
  document.querySelectorAll('#perm-content input[type="checkbox"]').forEach(cb => {
    updates.push({
      position_id: cb.dataset.pos,
      feature_id: cb.dataset.feat,
      allowed: cb.checked,
    });
  });
  const btn = document.getElementById('btn-perm-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  try {
    await sPost('sd_admin_batch_update_permissions', { permissions: updates });
    SPG.toast('Permissions saved', 'success');
  } catch (e) {
    SPG.toast(e.message || 'Save failed', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
  }
}


// ════════════════════════════════════════
// ROUTE 17: AUDIT TRAIL (Admin)
// ════════════════════════════════════════
function renderAudit() {
  return SPG.shell(`
    ${SPG.toolbar('Audit Trail', backBtn('dashboard', 'Dashboard'))}
    <div class="content">
      ${ui.filterBar([
        { id: 'aud-from', label: 'From', type: 'date', value: sydneyToday(), onChange: 'SalesSection.loadAudit()' },
        { id: 'aud-to', label: 'To', type: 'date', value: sydneyToday(), onChange: 'SalesSection.loadAudit()' },
        { id: 'aud-action', label: 'Action', type: 'select', options: [
          { value: '', label: 'All Actions' },
          { value: 'save_daily_sale', label: 'Save Daily Sale' },
          { value: 'save_expense', label: 'Save Expense' },
          { value: 'delete_expense', label: 'Delete Expense' },
          { value: 'save_invoice', label: 'Save Invoice' },
          { value: 'submit_cash', label: 'Submit Cash' },
          { value: 'save_report', label: 'Save Report' },
          { value: 'sync_day', label: 'Sync Day' },
          { value: 'unlock_day', label: 'Unlock Day' },
          { value: 'update_settings', label: 'Update Settings' },
        ], value: '', onChange: 'SalesSection.loadAudit()' },
        { id: 'aud-store', label: 'Store', type: 'select', options: [{ value: '', label: 'All Stores' }], value: '', onChange: 'SalesSection.loadAudit()' },
      ])}
      <div id="aud-list">${ui.skeleton(200)}</div>
      <div id="aud-paging" style="margin-top:12px;text-align:center"></div>
    </div>`, SECTION_LABEL);
}

async function loadAudit() {
  const from = document.getElementById('aud-from')?.value || '';
  const to = document.getElementById('aud-to')?.value || '';
  const action = document.getElementById('aud-action')?.value || '';
  const storeId = document.getElementById('aud-store')?.value || '';
  const el = document.getElementById('aud-list');
  if (el) el.innerHTML = ui.skeleton(200);

  // Populate store filter
  if (!S.storeList) {
    try {
      const stores = await SPG.perm.getStoresCache();
      S.storeList = stores.filter(s => s.store_id !== 'ALL' && s.store_id !== 'HQ');
      const sel = document.getElementById('aud-store');
      if (sel && sel.options.length <= 1) {
        S.storeList.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.store_id;
          opt.textContent = s.store_id;
          sel.appendChild(opt);
        });
      }
    } catch { /* ignore */ }
  }

  try {
    const data = await sPost('sd_admin_get_audit_log', { date_from: from, date_to: to, action_filter: action, store_id: storeId, limit: 100 });
    S.auditLog = data?.logs || [];
    fillAudit();
  } catch (e) {
    if (el) el.innerHTML = ui.empty('❌', 'Failed to load', e.message);
  }
}

function fillAudit() {
  const el = document.getElementById('aud-list');
  if (!el) return;
  if (!S.auditLog.length) {
    el.innerHTML = ui.empty('🔍', 'No audit records found');
    return;
  }
  el.innerHTML = `<table class="tbl">
    <thead><tr>
      ${ui.sortTh('aud', 'created_at', 'Time')}
      <th>User</th>
      <th>Store</th>
      ${ui.sortTh('aud', 'action', 'Action')}
      <th>Details</th>
    </tr></thead>
    <tbody>
    ${getAuditSorted().map(l => `<tr>
      <td style="white-space:nowrap">${fmtDateTime(l.created_at)}</td>
      <td>${esc(l.user_name || l.user_id || '-')}</td>
      <td>${esc(l.store_id || '-')}</td>
      <td><span style="font-size:10px;padding:2px 6px;border-radius:4px;background:var(--bg3)">${esc(l.action)}</span></td>
      <td style="font-size:11px;color:var(--t3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(JSON.stringify(l.details || ''))}">${esc(summarizeAuditDetail(l))}</td>
    </tr>`).join('')}
    </tbody>
  </table>`;
}

function getAuditSorted() {
  const st = ui.getSortState('aud');
  return st ? ui.sortData(S.auditLog, st.key, st.dir) : S.auditLog;
}

function summarizeAuditDetail(log) {
  const d = log.details;
  if (!d) return '-';
  if (typeof d === 'string') return d;
  if (d.date) return `Date: ${d.date}`;
  if (d.amount) return `Amount: ${fmtAUD(d.amount)}`;
  if (d.channel_name) return d.channel_name;
  return JSON.stringify(d).substring(0, 60);
}


// ════════════════════════════════════════
// SORT EVENT LISTENERS
// ════════════════════════════════════════
document.addEventListener('spg-sort', (e) => {
  const tid = e.detail?.tableId;
  if (tid === 'inv') fillInvoiceList();
  else if (tid === 'sh') fillSaleHistory();
  else if (tid === 'eh') fillExpenseHistory();
  else if (tid === 'hub' && S.hubData) fillDailyHub(S.hubData);
  else if (tid === 'ven') fillVendors();
  else if (tid === 'aud') fillAudit();
});


// ════════════════════════════════════════
// SECTION REGISTRATION
// ════════════════════════════════════════
SPG.section('sales', {
  defaultRoute: 'dashboard',
  routes: {
    'dashboard':       { render: renderDashboard,      onLoad: loadDashboard },
    'daily-sale':      { render: renderDailySale,       onLoad: loadDailySale },
    'expense':         { render: renderExpense,         onLoad: loadExpenses },
    'invoice':         { render: renderInvoice,         onLoad: loadInvoices },
    'cash':            { render: renderCash,            onLoad: loadCash },
    'sale-history':    { render: renderSaleHistory,     onLoad: loadSaleHistory },
    'expense-history': { render: renderExpenseHistory,  onLoad: loadExpenseHistory },
    'daily-report':    { render: renderDailyReport,     onLoad: loadDailyReport },
    'tasks':           { render: renderTasks,           onLoad: loadTasks },
    'daily-hub':       { render: renderDailyHub,        onLoad: loadDailyHub },
    'acc-review':      { render: renderAccReview,       onLoad: loadAccReview,      minPerm: 'admin' },
    'admin-report':    { render: renderAdminReport,     onLoad: loadAdminReport,    minPerm: 'admin' },
    'channels':        { render: renderChannels,        onLoad: loadChannels,       minPerm: 'admin' },
    'vendors':         { render: renderVendors,         onLoad: loadVendors,        minPerm: 'admin' },
    'config':          { render: renderConfig,          onLoad: loadConfig,          minPerm: 'admin' },
    'access':          { render: renderAccess,          onLoad: loadAccess,          minPerm: 'admin' },
    'audit':           { render: renderAudit,           onLoad: loadAudit,           minPerm: 'admin' },
  },
});


// ═══ PUBLIC API (onclick handlers) ═══
window.SalesSection = {
  // Dashboard
  refreshDashboard, selectStore,
  // Daily Sale
  loadDailySale, saveDailySale, calcDailySaleTotal,
  // Expense
  loadExpenses, showExpenseForm, saveExpense, deleteExpense,
  // Invoice
  loadInvoices, showInvoiceForm, saveInvoice, deleteInvoice,
  // Cash
  loadCash, calcCashTotal, submitCashCount, confirmHandover,
  // Sale History
  loadSaleHistory,
  // Expense History
  loadExpenseHistory,
  // Daily Report
  loadDailyReport, saveDailyReport,
  // Tasks
  loadTasks, showTaskForm, showTaskDetail, saveTask,
  // Daily Hub
  loadDailyHub, viewStoreDetail,
  // Acc Review
  loadAccReview, syncDay, unlockDay,
  // Admin Report
  loadAdminReport,
  // Channels
  loadChannels, showChannelForm, saveChannel, reorderChannel,
  // Vendors
  loadVendors, showVendorForm, saveVendor, filterVendors,
  // Config
  loadConfig, saveConfig,
  // Access
  loadAccess, savePermissions,
  // Audit
  loadAudit,
};

})();
