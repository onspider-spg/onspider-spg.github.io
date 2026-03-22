/**
 * SPG HUB v1.0.0 | 21 MAR 2026 | Siam Palette Group
 * sections/finance.js — Finance Module
 * Comprehensive accounting/finance system for restaurant chain
 * AUD currency, GST 10%, Sydney timezone
 *
 * ⚠️ REWORK NEEDED: This module needs migration to:
 *    - Use SPG.perm.canDo() for function-level permissions
 *    - Use fin_ prefix for all API actions
 *    - Remove admin/config/audit routes (moved to Home)
 *    - Apply Gen Z Design Guide (see MODULE-DEV-GUIDE.md)
 */

(() => {
const esc = SPG.esc;
const api = SPG.api;
const ui = SPG.ui;

// ═══ CONSTANTS ═══
const GST_RATE = 0.10;
const CURRENCY = 'AUD';
const TIMEZONE = 'Australia/Sydney';
const EP = 'finance';

const STATUS_FLOW = ['draft', 'submitted', 'approved', 'paid'];
const TX_TYPES = [
  { value: 'bill', label: 'Bill (AP)' },
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
];
const ACCOUNT_TYPES = [
  { value: 'asset', label: 'Assets' },
  { value: 'liability', label: 'Liabilities' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expense', label: 'Expenses' },
  { value: 'cogs', label: 'Cost of Goods Sold' },
];

// ═══ LOCAL STATE ═══
let _master = null;
let _masterLoading = false;
let _dashData = null;
let _txList = [];
let _payList = [];
let _contactList = [];
let _accountTree = [];
let _taxCodes = [];
let _bankRules = [];
let _employees = [];
let _payRuns = [];
let _reconcileData = null;
let _lineItems = [];
let _payRunWizard = { step: 1, period: '', selectedEmployees: [], calculations: [], payRunId: null };
let _reconcileSession = null;
let _auditLog = [];

// ═══ HELPERS ═══
function fmtAud(val) {
  const n = Number(val) || 0;
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('en-AU', { timeZone: TIMEZONE, day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function fmtDateTime(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleString('en-AU', { timeZone: TIMEZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

function sydneyToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

function calcGst(amount, inclusive) {
  const amt = Number(amount) || 0;
  if (inclusive) return amt - (amt / (1 + GST_RATE));
  return amt * GST_RATE;
}

function calcTotal(lines, inclusive) {
  let subtotal = 0, totalGst = 0;
  (lines || []).forEach(l => {
    const amt = Number(l.amount) || 0;
    const hasTax = l.tax_code && l.tax_code !== 'NONE' && l.tax_code !== 'BAS Excluded';
    if (hasTax) {
      if (inclusive) {
        const gst = amt - (amt / (1 + GST_RATE));
        totalGst += gst;
        subtotal += amt - gst;
      } else {
        totalGst += amt * GST_RATE;
        subtotal += amt;
      }
    } else {
      subtotal += amt;
    }
  });
  return { subtotal, gst: totalGst, total: subtotal + totalGst };
}

function tb(extra) { return api.tb(extra || {}); }
function post(action, data) { return api.post(EP, action, data); }

async function ensureMaster() {
  if (_master) return _master;
  if (_masterLoading) return null;
  _masterLoading = true;
  try {
    _master = await post('fin_init_master', tb());
    return _master;
  } catch (e) { SPG.toast('Failed to load master data: ' + e.message, 'error'); return null; }
  finally { _masterLoading = false; }
}

function checkPerm(level) {
  const s = api.getSession();
  if (!s) return false;
  // Finance permission from session or bundle
  const fp = SPG.state._finPerm || 'view_only';
  if (level === 'view_only') return true;
  if (level === 'edit') return fp === 'edit' || fp === 'admin';
  if (level === 'admin') return fp === 'admin';
  return false;
}

function navBack(route, label) {
  return `<button class="btn btn-outline btn-sm" onclick="SPG.go('finance/${route}')">\u2190 ${esc(label)}</button>`;
}

function kpiCard(label, value, sub, color) {
  return `<div class="card" style="flex:1;min-width:140px">
    <div style="font-size:11px;color:var(--t3);margin-bottom:4px">${esc(label)}</div>
    <div style="font-size:20px;font-weight:700;color:${color || 'var(--t1)'}">${value}</div>
    ${sub ? `<div style="font-size:10px;color:var(--t3);margin-top:2px">${sub}</div>` : ''}
  </div>`;
}

function tableWrap(headers, rows, tableId) {
  if (!rows || rows.length === 0) return ui.empty('', 'No data found');
  return `<div class="table-wrap"><table class="tbl" id="${tableId || ''}">
    <thead><tr>${headers}</tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function paginate(arr, page, perPage) {
  const total = arr.length;
  const pages = Math.ceil(total / perPage) || 1;
  const p = Math.max(1, Math.min(page, pages));
  const start = (p - 1) * perPage;
  return { items: arr.slice(start, start + perPage), page: p, pages, total };
}

function pagerHtml(page, pages, onClickFn) {
  if (pages <= 1) return '';
  let h = '<div style="display:flex;justify-content:center;gap:4px;margin-top:12px">';
  for (let i = 1; i <= pages; i++) {
    const cls = i === page ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
    h += `<button class="${cls}" onclick="${onClickFn}(${i})" style="min-width:32px">${i}</button>`;
  }
  return h + '</div>';
}


// ════════════════════════════════════════
// ROUTE 1: HOME — Finance Dashboard
// ════════════════════════════════════════
function renderHome() {
  return SPG.shell(`
    ${SPG.toolbar('Finance Dashboard', checkPerm('edit') ? `<button class="btn btn-primary btn-sm" onclick="SPG.go('finance/create-tx')">+ New Transaction</button>` : '')}
    <div class="content" id="fin-home">
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px" id="fin-kpis">${ui.skeleton(80, 4)}</div>
      <div class="sec-title">Pending Actions</div>
      <div id="fin-pending">${ui.skeleton(60, 3)}</div>
      <div class="sec-title" style="margin-top:16px">Recent Transactions</div>
      <div id="fin-recent">${ui.skeleton(40, 5)}</div>
    </div>`, 'Finance');
}

async function loadHome() {
  try {
    const data = await post('fin_get_dashboard', tb());
    _dashData = data;
    const kpiEl = document.getElementById('fin-kpis');
    if (kpiEl) {
      const d = data;
      kpiEl.innerHTML = [
        kpiCard('Total Payable', fmtAud(d.total_payable), 'Outstanding AP', 'var(--red)'),
        kpiCard('Total Receivable', fmtAud(d.total_receivable), 'Outstanding AR', 'var(--green)'),
        kpiCard('Cash Balance', fmtAud(d.cash_balance), 'All bank accounts', 'var(--blue)'),
        kpiCard('This Month P&L', fmtAud(d.month_pnl), d.month_pnl >= 0 ? 'Profit' : 'Loss', d.month_pnl >= 0 ? 'var(--green)' : 'var(--red)'),
      ].join('');
    }
    const pendEl = document.getElementById('fin-pending');
    if (pendEl) {
      const items = data.pending_items || [];
      if (items.length === 0) {
        pendEl.innerHTML = '<div style="font-size:12px;color:var(--t3);padding:8px 0">No pending items</div>';
      } else {
        pendEl.innerHTML = items.map(p => `<div class="card" style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;margin-bottom:6px;cursor:pointer" onclick="SPG.go('finance/tx-detail',{id:'${esc(p.tx_id)}'})">
          <div><div style="font-size:12px;font-weight:600">${esc(p.ref || p.tx_id)}</div><div style="font-size:10px;color:var(--t3)">${esc(p.contact_name || '')} · ${fmtDate(p.date)}</div></div>
          <div style="text-align:right"><div style="font-size:13px;font-weight:600">${fmtAud(p.total)}</div>${ui.badge(p.status)}</div>
        </div>`).join('');
      }
    }
    const recEl = document.getElementById('fin-recent');
    if (recEl) {
      const txs = data.recent_transactions || [];
      if (txs.length === 0) {
        recEl.innerHTML = '<div style="font-size:12px;color:var(--t3);padding:8px 0">No recent transactions</div>';
      } else {
        recEl.innerHTML = tableWrap(
          `<th>Date</th><th>Ref</th><th>Contact</th><th>Type</th><th style="text-align:right">Amount</th><th>Status</th>`,
          txs.map(t => `<tr style="cursor:pointer" onclick="SPG.go('finance/tx-detail',{id:'${esc(t.tx_id)}'})">
            <td>${fmtDate(t.date)}</td><td>${esc(t.ref || t.tx_id)}</td><td>${esc(t.contact_name || '-')}</td>
            <td>${esc(t.tx_type)}</td><td style="text-align:right">${fmtAud(t.total)}</td><td>${ui.badge(t.status)}</td>
          </tr>`).join(''),
          'fin-recent-tbl'
        );
      }
    }
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}


// ════════════════════════════════════════
// ROUTE 2: CREATE-TX — Create Transaction
// ════════════════════════════════════════
function renderCreateTx(p) {
  _lineItems = [{ account_id: '', description: '', amount: '', tax_code: 'GST', qty: 1 }];

  return SPG.shell(`
    ${SPG.toolbar('New Transaction', navBack('transactions', 'Transactions'))}
    <div class="content">
      <div class="card max-w-lg" id="fin-create-tx">
        <div style="display:flex;gap:10px;margin-bottom:12px">
          <div class="fg" style="flex:1"><label class="lb">Type *</label>
            <select class="inp" id="tx-type">${TX_TYPES.map(t => `<option value="${esc(t.value)}">${esc(t.label)}</option>`).join('')}</select>
          </div>
          <div class="fg" style="flex:1"><label class="lb">Date *</label>
            <input class="inp" type="date" id="tx-date" value="${sydneyToday()}">
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:12px">
          <div class="fg" style="flex:1"><label class="lb">Contact</label>
            <select class="inp" id="tx-contact"><option value="">-- Select --</option></select>
          </div>
          <div class="fg" style="flex:1"><label class="lb">Reference</label>
            <input class="inp" id="tx-ref" placeholder="e.g. INV-001">
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:12px">
          <div class="fg" style="flex:1"><label class="lb">Due Date</label>
            <input class="inp" type="date" id="tx-due">
          </div>
          <div class="fg" style="flex:1">
            <label class="lb">GST Treatment</label>
            <select class="inp" id="tx-gst-mode">
              <option value="exclusive">GST Exclusive</option>
              <option value="inclusive">GST Inclusive</option>
              <option value="none">No GST</option>
            </select>
          </div>
        </div>
        <div class="fg"><label class="lb">Description</label>
          <textarea class="inp" id="tx-desc" rows="2" style="width:100%;box-sizing:border-box" placeholder="Optional notes"></textarea>
        </div>
        <div class="fg" style="margin-top:10px">
          <label class="lb">HQ Bill Attachment</label>
          <div id="bhq-attached" style="margin-bottom:6px"></div>
          <button class="btn btn-outline btn-sm" type="button" onclick="FinanceSection.openBhqPicker()">📎 Attach HQ Bill</button>
        </div>
        <div class="sec-title" style="margin-top:14px">Line Items</div>
        <div id="tx-lines"></div>
        <button class="btn btn-outline btn-sm" style="margin-top:8px" onclick="FinanceSection.addLine()">+ Add Line</button>
        <div id="tx-totals" style="margin-top:14px;text-align:right"></div>
        <div class="error-msg" id="tx-error"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button class="btn btn-outline" onclick="SPG.go('finance/transactions')">Cancel</button>
          <button class="btn btn-primary" id="btn-save-tx" onclick="FinanceSection.saveTx('draft')">Save as Draft</button>
          <button class="btn btn-primary" style="background:var(--green)" onclick="FinanceSection.saveTx('submitted')">Submit</button>
        </div>
      </div>
    </div>`, 'Finance');
}

async function loadCreateTx() {
  const master = await ensureMaster();
  if (master) {
    const contactSel = document.getElementById('tx-contact');
    if (contactSel && master.contacts) {
      contactSel.innerHTML = '<option value="">-- Select Contact --</option>' +
        master.contacts.map(c => `<option value="${esc(c.contact_id)}">${esc(c.name)}</option>`).join('');
    }
  }
  renderLines();
}

function renderLines() {
  const el = document.getElementById('tx-lines');
  if (!el) return;
  const accounts = _master?.accounts || [];
  const taxes = _master?.tax_codes || [{ code: 'GST', label: 'GST 10%' }, { code: 'NONE', label: 'No Tax' }];

  el.innerHTML = _lineItems.map((l, i) => `<div class="card" style="padding:8px 10px;margin-bottom:6px;background:var(--bg2)">
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
      <div class="fg" style="flex:2;min-width:120px"><label class="lb" style="font-size:10px">Account</label>
        <select class="inp" style="font-size:11px" onchange="FinanceSection.updateLine(${i},'account_id',this.value)">
          <option value="">-- Account --</option>
          ${accounts.map(a => `<option value="${esc(a.account_id)}"${a.account_id === l.account_id ? ' selected' : ''}>${esc(a.code)} - ${esc(a.name)}</option>`).join('')}
        </select>
      </div>
      <div class="fg" style="flex:2;min-width:120px"><label class="lb" style="font-size:10px">Description</label>
        <input class="inp" style="font-size:11px" value="${esc(l.description)}" onchange="FinanceSection.updateLine(${i},'description',this.value)">
      </div>
      <div class="fg" style="flex:1;min-width:80px"><label class="lb" style="font-size:10px">Qty</label>
        <input class="inp" style="font-size:11px" type="number" min="1" value="${l.qty || 1}" onchange="FinanceSection.updateLine(${i},'qty',this.value)">
      </div>
      <div class="fg" style="flex:1;min-width:100px"><label class="lb" style="font-size:10px">Amount ($)</label>
        <input class="inp" style="font-size:11px" type="number" step="0.01" value="${l.amount}" onchange="FinanceSection.updateLine(${i},'amount',this.value)">
      </div>
      <div class="fg" style="flex:1;min-width:90px"><label class="lb" style="font-size:10px">Tax</label>
        <select class="inp" style="font-size:11px" onchange="FinanceSection.updateLine(${i},'tax_code',this.value)">
          ${taxes.map(t => `<option value="${esc(t.code)}"${t.code === l.tax_code ? ' selected' : ''}>${esc(t.label)}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red);height:30px" onclick="FinanceSection.removeLine(${i})" ${_lineItems.length <= 1 ? 'disabled' : ''}>x</button>
    </div>
  </div>`).join('');

  updateTotals();
}

function addLine() {
  _lineItems.push({ account_id: '', description: '', amount: '', tax_code: 'GST', qty: 1 });
  renderLines();
}

function removeLine(idx) {
  if (_lineItems.length <= 1) return;
  _lineItems.splice(idx, 1);
  renderLines();
}

function updateLine(idx, field, val) {
  if (_lineItems[idx]) {
    _lineItems[idx][field] = val;
    if (field === 'amount' || field === 'tax_code' || field === 'qty') updateTotals();
  }
}

function updateTotals() {
  const el = document.getElementById('tx-totals');
  if (!el) return;
  const gstMode = document.getElementById('tx-gst-mode')?.value || 'exclusive';
  const inclusive = gstMode === 'inclusive';
  const noGst = gstMode === 'none';

  const lines = _lineItems.map(l => ({
    amount: (Number(l.amount) || 0) * (Number(l.qty) || 1),
    tax_code: noGst ? 'NONE' : l.tax_code,
  }));
  const t = calcTotal(lines, inclusive);

  el.innerHTML = `
    <div style="font-size:12px;color:var(--t2)">Subtotal: <strong>${fmtAud(t.subtotal)}</strong></div>
    <div style="font-size:12px;color:var(--t2)">GST (10%): <strong>${fmtAud(t.gst)}</strong></div>
    <div style="font-size:16px;font-weight:700;margin-top:4px">Total: ${fmtAud(t.total)}</div>`;
}

async function saveTx(status) {
  const tx_type = document.getElementById('tx-type')?.value;
  const date = document.getElementById('tx-date')?.value;
  const contact_id = document.getElementById('tx-contact')?.value || null;
  const ref = document.getElementById('tx-ref')?.value.trim();
  const due_date = document.getElementById('tx-due')?.value || null;
  const gst_mode = document.getElementById('tx-gst-mode')?.value || 'exclusive';
  const description = document.getElementById('tx-desc')?.value.trim();

  if (!date) { SPG.showError('tx-error', 'Date is required'); return; }

  const validLines = _lineItems.filter(l => l.account_id && l.amount);
  if (validLines.length === 0) { SPG.showError('tx-error', 'At least one line item with account and amount is required'); return; }

  const btn = document.getElementById('btn-save-tx');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  SPG.showLoader();

  try {
    const result = await post('fin_create_bill', tb({
      tx_type, date, contact_id, ref, due_date, gst_mode, description, status,
      lines: validLines.map(l => ({
        account_id: l.account_id,
        description: l.description,
        qty: Number(l.qty) || 1,
        amount: Number(l.amount) || 0,
        tax_code: gst_mode === 'none' ? 'NONE' : (l.tax_code || 'NONE'),
      })),
    }));
    // Link attached HQ bills
    if (_bhqAttached.length > 0 && result.tx_id) {
      for (const billId of _bhqAttached) {
        try { await SPG.api.bhqLinkBill(billId, result.tx_id); } catch (_) {}
      }
      _bhqAttached = [];
    }
    SPG.toast('Transaction created', 'success');
    SPG.go('finance/tx-detail', { id: result.tx_id });
  } catch (e) {
    SPG.showError('tx-error', e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Save as Draft'; }
  } finally { SPG.hideLoader(); }
}


// ════════════════════════════════════════
// ROUTE 3: TRANSACTIONS — Transaction Log
// ════════════════════════════════════════
let _txPage = 1;
let _txFilters = { status: '', type: '', search: '', from: '', to: '' };

function renderTransactions() {
  return SPG.shell(`
    ${SPG.toolbar('Transactions', checkPerm('edit') ? `<button class="btn btn-primary btn-sm" onclick="SPG.go('finance/create-tx')">+ New</button>` : '')}
    <div class="content">
      <div id="fin-tx-filters"></div>
      <div id="fin-tx-list">${ui.skeleton(40, 8)}</div>
    </div>`, 'Finance');
}

async function loadTransactions() {
  const filterEl = document.getElementById('fin-tx-filters');
  if (filterEl) {
    filterEl.innerHTML = ui.filterBar([
      { id: 'fl-tx-search', label: 'Search', type: 'text', placeholder: 'Ref / contact...', value: _txFilters.search, onChange: "FinanceSection.filterTx()" },
      { id: 'fl-tx-status', label: 'Status', type: 'select', value: _txFilters.status, onChange: "FinanceSection.filterTx()",
        options: [{ value: '', label: 'All' }, { value: 'draft', label: 'Draft' }, { value: 'submitted', label: 'Submitted' }, { value: 'approved', label: 'Approved' }, { value: 'paid', label: 'Paid' }, { value: 'void', label: 'Void' }] },
      { id: 'fl-tx-type', label: 'Type', type: 'select', value: _txFilters.type, onChange: "FinanceSection.filterTx()",
        options: [{ value: '', label: 'All' }, ...TX_TYPES] },
      { id: 'fl-tx-from', label: 'From', type: 'date', value: _txFilters.from, onChange: "FinanceSection.filterTx()" },
      { id: 'fl-tx-to', label: 'To', type: 'date', value: _txFilters.to, onChange: "FinanceSection.filterTx()" },
    ]);
  }
  await fetchTransactions();
}

async function fetchTransactions() {
  try {
    const data = await post('fin_get_transactions', tb({
      status: _txFilters.status, tx_type: _txFilters.type,
      search: _txFilters.search, from: _txFilters.from, to: _txFilters.to,
    }));
    _txList = data.transactions || [];
    renderTxTable();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function filterTx() {
  _txFilters.search = document.getElementById('fl-tx-search')?.value || '';
  _txFilters.status = document.getElementById('fl-tx-status')?.value || '';
  _txFilters.type = document.getElementById('fl-tx-type')?.value || '';
  _txFilters.from = document.getElementById('fl-tx-from')?.value || '';
  _txFilters.to = document.getElementById('fl-tx-to')?.value || '';
  _txPage = 1;
  fetchTransactions();
}

function renderTxTable() {
  const el = document.getElementById('fin-tx-list');
  if (!el) return;

  const sorted = ui.getSortState('txTbl');
  let list = sorted ? ui.sortData(_txList, sorted.key, sorted.dir) : _txList;
  const pg = paginate(list, _txPage, 20);

  el.innerHTML = tableWrap(
    `${ui.sortTh('txTbl', 'date', 'Date')}${ui.sortTh('txTbl', 'ref', 'Ref')}
     ${ui.sortTh('txTbl', 'contact_name', 'Contact')}${ui.sortTh('txTbl', 'tx_type', 'Type')}
     <th style="text-align:right">Amount</th>${ui.sortTh('txTbl', 'status', 'Status')}`,
    pg.items.map(t => `<tr style="cursor:pointer" onclick="SPG.go('finance/tx-detail',{id:'${esc(t.tx_id)}'})">
      <td>${fmtDate(t.date)}</td><td>${esc(t.ref || t.tx_id)}</td>
      <td>${esc(t.contact_name || '-')}</td><td>${esc(t.tx_type)}</td>
      <td style="text-align:right">${fmtAud(t.total)}</td><td>${ui.badge(t.status)}</td>
    </tr>`).join(''),
    'txTbl'
  ) + pagerHtml(pg.page, pg.pages, 'FinanceSection.txPage');
}

function txPage(p) { _txPage = p; renderTxTable(); }


// ════════════════════════════════════════
// ROUTE 4: TX-DETAIL — Transaction Detail
// ════════════════════════════════════════
let _txDetail = null;

function renderTxDetail(p) {
  return SPG.shell(`
    ${SPG.toolbar('Transaction Detail', navBack('transactions', 'Transactions'))}
    <div class="content"><div id="fin-tx-detail">${ui.skeleton(300)}</div></div>`, 'Finance');
}

async function loadTxDetail(p) {
  const txId = p?.id || SPG.currentParams?.id;
  if (!txId) { SPG.go('finance/transactions'); return; }
  try {
    const data = await post('fin_get_tx_detail', tb({ tx_id: txId }));
    _txDetail = data;
    renderTxDetailCard(data);
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function renderTxDetailCard(d) {
  const el = document.getElementById('fin-tx-detail');
  if (!el) return;
  const lines = d.lines || [];
  const t = calcTotal(lines, d.gst_mode === 'inclusive');
  const canEdit = checkPerm('edit') && (d.status === 'draft' || d.status === 'submitted');
  const canApprove = checkPerm('admin') && d.status === 'submitted';
  const canVoid = checkPerm('admin') && d.status !== 'void' && d.status !== 'paid';
  const canPay = checkPerm('edit') && d.status === 'approved';

  el.innerHTML = `
    <div class="card max-w-lg">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:14px">
        <div>
          <div style="font-size:16px;font-weight:700">${esc(d.ref || d.tx_id)}</div>
          <div style="font-size:11px;color:var(--t3)">${esc(d.tx_type)} · Created ${fmtDateTime(d.created_at)}</div>
        </div>
        <div>${ui.badge(d.status)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div><div class="lb">Contact</div><div style="font-size:12px;font-weight:600">${esc(d.contact_name || '-')}</div></div>
        <div><div class="lb">Date</div><div style="font-size:12px">${fmtDate(d.date)}</div></div>
        <div><div class="lb">Due Date</div><div style="font-size:12px">${fmtDate(d.due_date)}</div></div>
        <div><div class="lb">GST Mode</div><div style="font-size:12px">${esc(d.gst_mode || 'exclusive')}</div></div>
      </div>
      ${d.description ? `<div style="font-size:12px;color:var(--t2);margin-bottom:14px;padding:8px;background:var(--bg2);border-radius:var(--rd)">${esc(d.description)}</div>` : ''}
      <div class="sec-title">Line Items</div>
      ${tableWrap(
        '<th>Account</th><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th><th>Tax</th><th style="text-align:right">Total</th>',
        lines.map(l => {
          const lineTotal = (Number(l.amount) || 0) * (Number(l.qty) || 1);
          return `<tr>
            <td>${esc(l.account_name || l.account_id)}</td><td>${esc(l.description || '-')}</td>
            <td style="text-align:center">${l.qty || 1}</td><td style="text-align:right">${fmtAud(l.amount)}</td>
            <td>${esc(l.tax_code || '-')}</td><td style="text-align:right">${fmtAud(lineTotal)}</td>
          </tr>`;
        }).join('')
      )}
      <div style="text-align:right;margin-top:10px">
        <div style="font-size:12px;color:var(--t2)">Subtotal: ${fmtAud(t.subtotal)}</div>
        <div style="font-size:12px;color:var(--t2)">GST: ${fmtAud(t.gst)}</div>
        <div style="font-size:18px;font-weight:700;margin-top:4px">Total: ${fmtAud(t.total)}</div>
      </div>
      ${d.payments && d.payments.length > 0 ? `
        <div class="sec-title" style="margin-top:14px">Payments</div>
        ${d.payments.map(py => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bd2);font-size:12px">
          <span>${fmtDate(py.date)} — ${esc(py.method || 'Payment')}</span>
          <span style="font-weight:600;color:var(--green)">${fmtAud(py.amount)}</span>
        </div>`).join('')}
      ` : ''}
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        ${canEdit ? `<button class="btn btn-outline btn-sm" onclick="FinanceSection.editTx('${esc(d.tx_id)}')">Edit</button>` : ''}
        ${canApprove ? `<button class="btn btn-primary btn-sm" style="background:var(--green)" onclick="FinanceSection.approveTx('${esc(d.tx_id)}')">Approve</button>` : ''}
        ${canPay ? `<button class="btn btn-primary btn-sm" onclick="FinanceSection.showPayTxDialog('${esc(d.tx_id)}')">Record Payment</button>` : ''}
        ${canVoid ? `<button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red)" onclick="FinanceSection.voidTx('${esc(d.tx_id)}')">Void</button>` : ''}
      </div>
    </div>`;
}

async function approveTx(txId) {
  if (!confirm('Approve this transaction?')) return;
  SPG.showLoader();
  try {
    await post('fin_update_bill', tb({ tx_id: txId, status: 'approved' }));
    SPG.toast('Transaction approved', 'success');
    loadTxDetail({ id: txId });
  } catch (e) { SPG.toast(e.message, 'error'); }
  finally { SPG.hideLoader(); }
}

async function voidTx(txId) {
  if (!confirm('Void this transaction? This cannot be undone.')) return;
  SPG.showLoader();
  try {
    await post('fin_void_bill', tb({ tx_id: txId }));
    SPG.toast('Transaction voided', 'success');
    loadTxDetail({ id: txId });
  } catch (e) { SPG.toast(e.message, 'error'); }
  finally { SPG.hideLoader(); }
}

function editTx(txId) {
  SPG.go('finance/create-tx', { id: txId, edit: true });
}

function showPayTxDialog(txId) {
  const d = _txDetail;
  if (!d) return;
  const paid = (d.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = (Number(d.total) || 0) - paid;

  SPG.showDialog(`<div class="popup-sheet" style="width:380px">
    <div class="popup-header"><div class="popup-title">Record Payment</div><button class="popup-close" onclick="SPG.closeDialog()">x</button></div>
    <div style="font-size:12px;margin-bottom:12px;color:var(--t2)">
      Total: ${fmtAud(d.total)} | Paid: ${fmtAud(paid)} | <strong>Remaining: ${fmtAud(remaining)}</strong>
    </div>
    <div class="fg"><label class="lb">Amount *</label><input class="inp" id="pay-amount" type="number" step="0.01" value="${remaining.toFixed(2)}"></div>
    <div class="fg"><label class="lb">Date *</label><input class="inp" type="date" id="pay-date" value="${sydneyToday()}"></div>
    <div class="fg"><label class="lb">Method</label>
      <select class="inp" id="pay-method">
        <option value="bank_transfer">Bank Transfer</option>
        <option value="cash">Cash</option>
        <option value="card">Card</option>
        <option value="cheque">Cheque</option>
      </select>
    </div>
    <div class="fg"><label class="lb">Reference</label><input class="inp" id="pay-ref" placeholder="Payment ref"></div>
    <div class="error-msg" id="pay-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="FinanceSection.submitPayTx('${esc(txId)}')">Record Payment</button>
    </div>
  </div>`);
}

async function submitPayTx(txId) {
  const amount = Number(document.getElementById('pay-amount')?.value);
  const date = document.getElementById('pay-date')?.value;
  const method = document.getElementById('pay-method')?.value;
  const ref = document.getElementById('pay-ref')?.value.trim();
  if (!amount || amount <= 0) { SPG.showError('pay-error', 'Valid amount required'); return; }
  if (!date) { SPG.showError('pay-error', 'Date required'); return; }
  SPG.showLoader();
  try {
    await post('fin_create_payment', tb({ tx_id: txId, amount, date, method, ref }));
    SPG.closeDialog();
    SPG.toast('Payment recorded', 'success');
    loadTxDetail({ id: txId });
  } catch (e) { SPG.showError('pay-error', e.message); }
  finally { SPG.hideLoader(); }
}


// ════════════════════════════════════════
// ROUTE 5: PAYMENTS — Payment Recording
// ════════════════════════════════════════
let _payPage = 1;

function renderPayments() {
  return SPG.shell(`
    ${SPG.toolbar('Payments', checkPerm('edit') ? `<button class="btn btn-primary btn-sm" onclick="FinanceSection.showNewPaymentDialog()">+ New Payment</button>` : '')}
    <div class="content">
      <div id="fin-pay-filters"></div>
      <div id="fin-pay-list">${ui.skeleton(40, 6)}</div>
    </div>`, 'Finance');
}

async function loadPayments() {
  const filterEl = document.getElementById('fin-pay-filters');
  if (filterEl) {
    filterEl.innerHTML = ui.filterBar([
      { id: 'fl-pay-search', label: 'Search', type: 'text', placeholder: 'Ref / contact...', onChange: "FinanceSection.fetchPayments()" },
      { id: 'fl-pay-from', label: 'From', type: 'date', onChange: "FinanceSection.fetchPayments()" },
      { id: 'fl-pay-to', label: 'To', type: 'date', onChange: "FinanceSection.fetchPayments()" },
    ]);
  }
  await fetchPayments();
}

async function fetchPayments() {
  try {
    const data = await post('fin_get_payments', tb({
      search: document.getElementById('fl-pay-search')?.value || '',
      from: document.getElementById('fl-pay-from')?.value || '',
      to: document.getElementById('fl-pay-to')?.value || '',
    }));
    _payList = data.payments || [];
    renderPayTable();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function renderPayTable() {
  const el = document.getElementById('fin-pay-list');
  if (!el) return;
  const pg = paginate(_payList, _payPage, 20);
  el.innerHTML = tableWrap(
    '<th>Date</th><th>Ref</th><th>Contact</th><th>Method</th><th style="text-align:right">Amount</th><th>TX Ref</th>',
    pg.items.map(p => `<tr style="cursor:pointer" onclick="SPG.go('finance/payment-detail',{id:'${esc(p.payment_id)}'})">
      <td>${fmtDate(p.date)}</td><td>${esc(p.ref || p.payment_id)}</td>
      <td>${esc(p.contact_name || '-')}</td><td>${esc(p.method || '-')}</td>
      <td style="text-align:right">${fmtAud(p.amount)}</td><td>${esc(p.tx_ref || '-')}</td>
    </tr>`).join('')
  ) + pagerHtml(pg.page, pg.pages, 'FinanceSection.payPage');
}

function payPage(p) { _payPage = p; renderPayTable(); }

function showNewPaymentDialog() {
  SPG.showDialog(`<div class="popup-sheet" style="width:400px">
    <div class="popup-header"><div class="popup-title">Record Payment</div><button class="popup-close" onclick="SPG.closeDialog()">x</button></div>
    <div class="fg"><label class="lb">Transaction Reference *</label><input class="inp" id="np-tx-ref" placeholder="Search tx ref or ID"></div>
    <div class="fg"><label class="lb">Amount *</label><input class="inp" id="np-amount" type="number" step="0.01"></div>
    <div class="fg"><label class="lb">Date *</label><input class="inp" type="date" id="np-date" value="${sydneyToday()}"></div>
    <div class="fg"><label class="lb">Method</label>
      <select class="inp" id="np-method">
        <option value="bank_transfer">Bank Transfer</option><option value="cash">Cash</option>
        <option value="card">Card</option><option value="cheque">Cheque</option>
      </select>
    </div>
    <div class="fg"><label class="lb">Reference</label><input class="inp" id="np-ref" placeholder="Payment ref"></div>
    <div class="error-msg" id="np-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="FinanceSection.submitNewPayment()">Record</button>
    </div>
  </div>`);
}

async function submitNewPayment() {
  const tx_ref = document.getElementById('np-tx-ref')?.value.trim();
  const amount = Number(document.getElementById('np-amount')?.value);
  const date = document.getElementById('np-date')?.value;
  const method = document.getElementById('np-method')?.value;
  const ref = document.getElementById('np-ref')?.value.trim();
  if (!tx_ref) { SPG.showError('np-error', 'Transaction reference required'); return; }
  if (!amount || amount <= 0) { SPG.showError('np-error', 'Valid amount required'); return; }
  if (!date) { SPG.showError('np-error', 'Date required'); return; }
  SPG.showLoader();
  try {
    await post('fin_create_payment', tb({ tx_ref, amount, date, method, ref }));
    SPG.closeDialog();
    SPG.toast('Payment recorded', 'success');
    fetchPayments();
  } catch (e) { SPG.showError('np-error', e.message); }
  finally { SPG.hideLoader(); }
}


// ════════════════════════════════════════
// ROUTE 6: PAYMENT-DETAIL
// ════════════════════════════════════════
let _payDetail = null;

function renderPaymentDetail(p) {
  return SPG.shell(`
    ${SPG.toolbar('Payment Detail', navBack('payments', 'Payments'))}
    <div class="content"><div id="fin-pay-detail">${ui.skeleton(200)}</div></div>`, 'Finance');
}

async function loadPaymentDetail(p) {
  const payId = p?.id || SPG.currentParams?.id;
  if (!payId) { SPG.go('finance/payments'); return; }
  try {
    const data = await post('fin_get_payment_detail', tb({ payment_id: payId }));
    _payDetail = data;
    const el = document.getElementById('fin-pay-detail');
    if (!el) return;
    el.innerHTML = `<div class="card max-w-lg">
      <div style="font-size:16px;font-weight:700;margin-bottom:4px">${esc(data.ref || data.payment_id)}</div>
      <div style="font-size:11px;color:var(--t3);margin-bottom:14px">Payment · ${fmtDateTime(data.created_at)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div><div class="lb">Amount</div><div style="font-size:18px;font-weight:700;color:var(--green)">${fmtAud(data.amount)}</div></div>
        <div><div class="lb">Date</div><div style="font-size:12px">${fmtDate(data.date)}</div></div>
        <div><div class="lb">Method</div><div style="font-size:12px">${esc(data.method || '-')}</div></div>
        <div><div class="lb">Contact</div><div style="font-size:12px">${esc(data.contact_name || '-')}</div></div>
      </div>
      ${data.tx_id ? `<div style="margin-top:10px">
        <div class="lb">Linked Transaction</div>
        <div style="font-size:12px;cursor:pointer;color:var(--acc)" onclick="SPG.go('finance/tx-detail',{id:'${esc(data.tx_id)}'})">${esc(data.tx_ref || data.tx_id)}</div>
      </div>` : ''}
    </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ════════════════════════════════════════
// ROUTE 7: CONTACTS — Vendor/Contact Management
// ════════════════════════════════════════
let _contactPage = 1;

function renderContacts() {
  return SPG.shell(`
    ${SPG.toolbar('Contacts', checkPerm('edit') ? `<button class="btn btn-primary btn-sm" onclick="FinanceSection.showContactDialog()">+ New Contact</button>` : '')}
    <div class="content">
      <div id="fin-con-filters"></div>
      <div id="fin-con-list">${ui.skeleton(40, 6)}</div>
    </div>`, 'Finance');
}

async function loadContacts() {
  const filterEl = document.getElementById('fin-con-filters');
  if (filterEl) {
    filterEl.innerHTML = ui.filterBar([
      { id: 'fl-con-search', label: 'Search', type: 'text', placeholder: 'Name, email...', onChange: "FinanceSection.fetchContacts()" },
      { id: 'fl-con-type', label: 'Type', type: 'select', onChange: "FinanceSection.fetchContacts()",
        options: [{ value: '', label: 'All' }, { value: 'vendor', label: 'Vendor' }, { value: 'customer', label: 'Customer' }, { value: 'employee', label: 'Employee' }] },
    ]);
  }
  await fetchContacts();
}

async function fetchContacts() {
  try {
    const data = await post('fin_get_contacts', tb({
      search: document.getElementById('fl-con-search')?.value || '',
      contact_type: document.getElementById('fl-con-type')?.value || '',
    }));
    _contactList = data.contacts || [];
    renderContactTable();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function renderContactTable() {
  const el = document.getElementById('fin-con-list');
  if (!el) return;
  const pg = paginate(_contactList, _contactPage, 20);
  el.innerHTML = tableWrap(
    `${ui.sortTh('conTbl', 'name', 'Name')}${ui.sortTh('conTbl', 'contact_type', 'Type')}
     <th>Email</th><th>Phone</th><th style="text-align:right">Balance</th>`,
    pg.items.map(c => `<tr style="cursor:pointer" onclick="SPG.go('finance/contact-detail',{id:'${esc(c.contact_id)}'})">
      <td style="font-weight:600">${esc(c.name)}</td><td>${esc(c.contact_type || '-')}</td>
      <td>${esc(c.email || '-')}</td><td>${esc(c.phone || '-')}</td>
      <td style="text-align:right">${fmtAud(c.balance)}</td>
    </tr>`).join(''),
    'conTbl'
  ) + pagerHtml(pg.page, pg.pages, 'FinanceSection.conPage');
}

function conPage(p) { _contactPage = p; renderContactTable(); }

function showContactDialog(contactData) {
  const d = contactData || {};
  const isEdit = !!d.contact_id;
  SPG.showDialog(`<div class="popup-sheet" style="width:400px">
    <div class="popup-header"><div class="popup-title">${isEdit ? 'Edit' : 'New'} Contact</div><button class="popup-close" onclick="SPG.closeDialog()">x</button></div>
    <div class="fg"><label class="lb">Name *</label><input class="inp" id="cd-name" value="${esc(d.name || '')}"></div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Type</label>
        <select class="inp" id="cd-type">
          <option value="vendor"${d.contact_type === 'vendor' ? ' selected' : ''}>Vendor</option>
          <option value="customer"${d.contact_type === 'customer' ? ' selected' : ''}>Customer</option>
          <option value="employee"${d.contact_type === 'employee' ? ' selected' : ''}>Employee</option>
        </select>
      </div>
      <div class="fg" style="flex:1"><label class="lb">ABN</label><input class="inp" id="cd-abn" value="${esc(d.abn || '')}"></div>
    </div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Email</label><input class="inp" id="cd-email" value="${esc(d.email || '')}"></div>
      <div class="fg" style="flex:1"><label class="lb">Phone</label><input class="inp" id="cd-phone" value="${esc(d.phone || '')}"></div>
    </div>
    <div class="fg"><label class="lb">Address</label><textarea class="inp" id="cd-address" rows="2" style="width:100%;box-sizing:border-box">${esc(d.address || '')}</textarea></div>
    <div class="fg"><label class="lb">Default Account</label><input class="inp" id="cd-account" value="${esc(d.default_account_id || '')}" placeholder="Account code"></div>
    <div class="fg"><label class="lb">Payment Terms (days)</label><input class="inp" id="cd-terms" type="number" value="${d.payment_terms || 30}"></div>
    <div class="error-msg" id="cd-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="FinanceSection.saveContact('${esc(d.contact_id || '')}')">${isEdit ? 'Update' : 'Create'}</button>
    </div>
  </div>`);
}

async function saveContact(contactId) {
  const name = document.getElementById('cd-name')?.value.trim();
  if (!name) { SPG.showError('cd-error', 'Name is required'); return; }
  const payload = {
    name,
    contact_type: document.getElementById('cd-type')?.value,
    abn: document.getElementById('cd-abn')?.value.trim(),
    email: document.getElementById('cd-email')?.value.trim(),
    phone: document.getElementById('cd-phone')?.value.trim(),
    address: document.getElementById('cd-address')?.value.trim(),
    default_account_id: document.getElementById('cd-account')?.value.trim(),
    payment_terms: Number(document.getElementById('cd-terms')?.value) || 30,
  };
  SPG.showLoader();
  try {
    if (contactId) {
      await post('fin_update_contact', tb({ contact_id: contactId, ...payload }));
      SPG.toast('Contact updated', 'success');
    } else {
      await post('fin_create_contact', tb(payload));
      SPG.toast('Contact created', 'success');
    }
    SPG.closeDialog();
    fetchContacts();
  } catch (e) { SPG.showError('cd-error', e.message); }
  finally { SPG.hideLoader(); }
}


// ════════════════════════════════════════
// ROUTE 8: CONTACT-DETAIL
// ════════════════════════════════════════
let _contactDetail = null;

function renderContactDetail(p) {
  return SPG.shell(`
    ${SPG.toolbar('Contact Detail', navBack('contacts', 'Contacts'))}
    <div class="content"><div id="fin-con-detail">${ui.skeleton(300)}</div></div>`, 'Finance');
}

async function loadContactDetail(p) {
  const cid = p?.id || SPG.currentParams?.id;
  if (!cid) { SPG.go('finance/contacts'); return; }
  try {
    const data = await post('fin_get_contact_detail', tb({ contact_id: cid }));
    _contactDetail = data;
    const el = document.getElementById('fin-con-detail');
    if (!el) return;
    const txs = data.transactions || [];
    el.innerHTML = `<div class="card max-w-lg">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:14px">
        <div>
          <div style="font-size:16px;font-weight:700">${esc(data.name)}</div>
          <div style="font-size:11px;color:var(--t3)">${esc(data.contact_type || '-')}${data.abn ? ' · ABN: ' + esc(data.abn) : ''}</div>
        </div>
        ${checkPerm('edit') ? `<button class="btn btn-outline btn-sm" onclick="FinanceSection.showContactDialog(FinanceSection._getContactDetail())">Edit</button>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div><div class="lb">Email</div><div style="font-size:12px">${esc(data.email || '-')}</div></div>
        <div><div class="lb">Phone</div><div style="font-size:12px">${esc(data.phone || '-')}</div></div>
        <div><div class="lb">Payment Terms</div><div style="font-size:12px">${data.payment_terms || 30} days</div></div>
        <div><div class="lb">Balance</div><div style="font-size:14px;font-weight:700">${fmtAud(data.balance)}</div></div>
      </div>
      ${data.address ? `<div><div class="lb">Address</div><div style="font-size:12px">${esc(data.address)}</div></div>` : ''}
      <div class="sec-title" style="margin-top:14px">Transactions</div>
      ${txs.length ? tableWrap(
        '<th>Date</th><th>Ref</th><th>Type</th><th style="text-align:right">Amount</th><th>Status</th>',
        txs.map(t => `<tr style="cursor:pointer" onclick="SPG.go('finance/tx-detail',{id:'${esc(t.tx_id)}'})">
          <td>${fmtDate(t.date)}</td><td>${esc(t.ref || t.tx_id)}</td><td>${esc(t.tx_type)}</td>
          <td style="text-align:right">${fmtAud(t.total)}</td><td>${ui.badge(t.status)}</td>
        </tr>`).join('')
      ) : ui.empty('', 'No transactions for this contact')}
    </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ════════════════════════════════════════
// ROUTE 9: REVIEW — Pending Items
// ════════════════════════════════════════
function renderReview() {
  return SPG.shell(`
    ${SPG.toolbar('Review & Approvals')}
    <div class="content">
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px" id="fin-review-kpis"></div>
      <div class="sec-title">Bills Due Soon</div>
      <div id="fin-review-due">${ui.skeleton(40, 4)}</div>
      <div class="sec-title" style="margin-top:16px">Pending Approvals</div>
      <div id="fin-review-approvals">${ui.skeleton(40, 4)}</div>
    </div>`, 'Finance');
}

async function loadReview() {
  try {
    const data = await post('fin_get_bills_pending', tb());
    const kpiEl = document.getElementById('fin-review-kpis');
    if (kpiEl) {
      kpiEl.innerHTML = [
        kpiCard('Bills Due (7 days)', String(data.due_7_days?.length || 0), '', 'var(--orange)'),
        kpiCard('Overdue', String(data.overdue?.length || 0), '', 'var(--red)'),
        kpiCard('Awaiting Approval', String(data.pending_approval?.length || 0), '', 'var(--blue)'),
      ].join('');
    }
    const dueEl = document.getElementById('fin-review-due');
    if (dueEl) {
      const dues = [...(data.overdue || []), ...(data.due_7_days || [])];
      dueEl.innerHTML = dues.length ? tableWrap(
        '<th>Due</th><th>Ref</th><th>Contact</th><th style="text-align:right">Amount</th><th>Status</th>',
        dues.map(t => `<tr style="cursor:pointer" onclick="SPG.go('finance/tx-detail',{id:'${esc(t.tx_id)}'})">
          <td style="color:${new Date(t.due_date) < new Date() ? 'var(--red)' : 'var(--orange)'}">${fmtDate(t.due_date)}</td>
          <td>${esc(t.ref || t.tx_id)}</td><td>${esc(t.contact_name || '-')}</td>
          <td style="text-align:right">${fmtAud(t.total)}</td><td>${ui.badge(t.status)}</td>
        </tr>`).join('')
      ) : ui.empty('', 'No bills due');
    }
    const apprEl = document.getElementById('fin-review-approvals');
    if (apprEl) {
      const pending = data.pending_approval || [];
      apprEl.innerHTML = pending.length ? tableWrap(
        '<th>Date</th><th>Ref</th><th>Contact</th><th>Type</th><th style="text-align:right">Amount</th><th></th>',
        pending.map(t => `<tr>
          <td>${fmtDate(t.date)}</td><td>${esc(t.ref || t.tx_id)}</td><td>${esc(t.contact_name || '-')}</td>
          <td>${esc(t.tx_type)}</td><td style="text-align:right">${fmtAud(t.total)}</td>
          <td><button class="btn btn-primary btn-sm" onclick="SPG.go('finance/tx-detail',{id:'${esc(t.tx_id)}'})">Review</button></td>
        </tr>`).join('')
      ) : ui.empty('', 'No pending approvals');
    }
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ════════════════════════════════════════
// ROUTE 10: ACCOUNTS — Chart of Accounts
// ════════════════════════════════════════
function renderAccounts() {
  return SPG.shell(`
    ${SPG.toolbar('Chart of Accounts', checkPerm('edit') ? `<button class="btn btn-primary btn-sm" onclick="FinanceSection.showAccountDialog()">+ New Account</button>` : '')}
    <div class="content">
      <div id="fin-acct-filters"></div>
      <div id="fin-acct-tree">${ui.skeleton(40, 10)}</div>
    </div>`, 'Finance');
}

async function loadAccounts() {
  const filterEl = document.getElementById('fin-acct-filters');
  if (filterEl) {
    filterEl.innerHTML = ui.filterBar([
      { id: 'fl-acct-search', label: 'Search', type: 'text', placeholder: 'Code or name...', onChange: "FinanceSection.renderAccountTree()" },
      { id: 'fl-acct-type', label: 'Type', type: 'select', onChange: "FinanceSection.renderAccountTree()",
        options: [{ value: '', label: 'All Types' }, ...ACCOUNT_TYPES] },
    ]);
  }
  try {
    const data = await post('fin_get_chart_of_accounts', tb());
    _accountTree = data.accounts || [];
    renderAccountTree();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function renderAccountTree() {
  const el = document.getElementById('fin-acct-tree');
  if (!el) return;
  const search = (document.getElementById('fl-acct-search')?.value || '').toLowerCase();
  const typeFilter = document.getElementById('fl-acct-type')?.value || '';

  let filtered = _accountTree;
  if (search) {
    filtered = filtered.filter(a =>
      (a.code || '').toLowerCase().includes(search) ||
      (a.name || '').toLowerCase().includes(search)
    );
  }
  if (typeFilter) {
    filtered = filtered.filter(a => a.account_type === typeFilter);
  }

  // Group by account_type then by parent
  const grouped = {};
  ACCOUNT_TYPES.forEach(at => { grouped[at.value] = { label: at.label, items: [] }; });

  filtered.forEach(a => {
    const type = a.account_type || 'expense';
    if (!grouped[type]) grouped[type] = { label: type, items: [] };
    grouped[type].items.push(a);
  });

  let html = '';
  Object.entries(grouped).forEach(([type, group]) => {
    if (group.items.length === 0) return;
    // Sort by code
    group.items.sort((a, b) => (a.code || '').localeCompare(b.code || ''));

    html += `<div style="margin-bottom:16px">
      <div style="font-weight:700;font-size:13px;color:var(--t1);margin-bottom:6px;padding:4px 8px;background:var(--bg2);border-radius:var(--rd)">${esc(group.label)}</div>`;

    // Build tree: top-level (no parent), then children indented
    const topLevel = group.items.filter(a => !a.parent_id);
    const children = group.items.filter(a => a.parent_id);
    const childMap = {};
    children.forEach(c => {
      if (!childMap[c.parent_id]) childMap[c.parent_id] = [];
      childMap[c.parent_id].push(c);
    });

    function renderNode(a, depth) {
      const indent = depth * 20;
      const prefix = depth > 0 ? '<span style="color:var(--t4);margin-right:4px">\u2514</span>' : '';
      let row = `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px 6px ${8 + indent}px;border-bottom:1px solid var(--bd2);cursor:pointer;font-size:12px" onclick="SPG.go('finance/account-detail',{id:'${esc(a.account_id)}'})">
        <div>${prefix}<span style="font-weight:600;color:var(--acc)">${esc(a.code)}</span> <span>${esc(a.name)}</span></div>
        <div style="color:var(--t3);font-size:11px">${a.is_system ? '<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:var(--bg3);color:var(--t3)">System</span>' : ''}</div>
      </div>`;
      const kids = childMap[a.account_id] || [];
      kids.forEach(k => { row += renderNode(k, depth + 1); });
      return row;
    }

    topLevel.forEach(a => { html += renderNode(a, 0); });
    // Any orphan children shown at root
    const topIds = new Set(topLevel.map(a => a.account_id));
    children.filter(c => !topIds.has(c.parent_id) && !topLevel.some(t => t.account_id === c.parent_id)).forEach(c => {
      html += renderNode(c, 0);
    });

    html += '</div>';
  });

  el.innerHTML = html || ui.empty('', 'No accounts found');
}

function showAccountDialog(acctData) {
  const d = acctData || {};
  const isEdit = !!d.account_id;
  SPG.showDialog(`<div class="popup-sheet" style="width:420px">
    <div class="popup-header"><div class="popup-title">${isEdit ? 'Edit' : 'New'} Account</div><button class="popup-close" onclick="SPG.closeDialog()">x</button></div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Code *</label><input class="inp" id="ac-code" value="${esc(d.code || '')}" ${isEdit && d.is_system ? 'readonly' : ''}></div>
      <div class="fg" style="flex:2"><label class="lb">Name *</label><input class="inp" id="ac-name" value="${esc(d.name || '')}"></div>
    </div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Type *</label>
        <select class="inp" id="ac-type">${ACCOUNT_TYPES.map(t => `<option value="${esc(t.value)}"${t.value === d.account_type ? ' selected' : ''}>${esc(t.label)}</option>`).join('')}</select>
      </div>
      <div class="fg" style="flex:1"><label class="lb">Parent Account</label>
        <select class="inp" id="ac-parent">
          <option value="">-- None (Top Level) --</option>
          ${_accountTree.map(a => `<option value="${esc(a.account_id)}"${a.account_id === d.parent_id ? ' selected' : ''}>${esc(a.code)} - ${esc(a.name)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="fg"><label class="lb">Description</label><textarea class="inp" id="ac-desc" rows="2" style="width:100%;box-sizing:border-box">${esc(d.description || '')}</textarea></div>
    <div class="fg"><label class="lb">Tax Code Default</label>
      <select class="inp" id="ac-tax">
        <option value="">-- None --</option>
        <option value="GST"${d.tax_code === 'GST' ? ' selected' : ''}>GST 10%</option>
        <option value="NONE"${d.tax_code === 'NONE' ? ' selected' : ''}>No Tax</option>
      </select>
    </div>
    <div class="error-msg" id="ac-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="FinanceSection.saveAccount('${esc(d.account_id || '')}')">${isEdit ? 'Update' : 'Create'}</button>
    </div>
  </div>`);
}

async function saveAccount(accountId) {
  const code = document.getElementById('ac-code')?.value.trim();
  const name = document.getElementById('ac-name')?.value.trim();
  if (!code || !name) { SPG.showError('ac-error', 'Code and name required'); return; }
  const payload = {
    code, name,
    account_type: document.getElementById('ac-type')?.value,
    parent_id: document.getElementById('ac-parent')?.value || null,
    description: document.getElementById('ac-desc')?.value.trim(),
    tax_code: document.getElementById('ac-tax')?.value || null,
  };
  SPG.showLoader();
  try {
    if (accountId) {
      await post('fin_update_account', tb({ account_id: accountId, ...payload }));
      SPG.toast('Account updated', 'success');
    } else {
      await post('fin_create_account', tb(payload));
      SPG.toast('Account created', 'success');
    }
    SPG.closeDialog();
    loadAccounts();
  } catch (e) { SPG.showError('ac-error', e.message); }
  finally { SPG.hideLoader(); }
}


// ════════════════════════════════════════
// ROUTE 11: ACCOUNT-DETAIL
// ════════════════════════════════════════
function renderAccountDetail(p) {
  return SPG.shell(`
    ${SPG.toolbar('Account Detail', navBack('accounts', 'Chart of Accounts'))}
    <div class="content"><div id="fin-acct-detail">${ui.skeleton(300)}</div></div>`, 'Finance');
}

async function loadAccountDetail(p) {
  const aid = p?.id || SPG.currentParams?.id;
  if (!aid) { SPG.go('finance/accounts'); return; }
  try {
    const data = await post('fin_get_account_detail', tb({ account_id: aid }));
    const el = document.getElementById('fin-acct-detail');
    if (!el) return;
    const txs = data.transactions || [];
    el.innerHTML = `<div class="card max-w-lg">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:14px">
        <div>
          <div style="font-size:16px;font-weight:700">${esc(data.code)} — ${esc(data.name)}</div>
          <div style="font-size:11px;color:var(--t3)">${esc(data.account_type)} · ${data.is_system ? 'System Account' : 'Custom'}</div>
        </div>
        ${checkPerm('edit') && !data.is_system ? `<button class="btn btn-outline btn-sm" onclick="FinanceSection.showAccountDialog(${esc(JSON.stringify({account_id:data.account_id,code:data.code,name:data.name,account_type:data.account_type,parent_id:data.parent_id,description:data.description,tax_code:data.tax_code,is_system:data.is_system}))})">Edit</button>` : ''}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div><div class="lb">Balance</div><div style="font-size:18px;font-weight:700">${fmtAud(data.balance)}</div></div>
        <div><div class="lb">Tax Code</div><div style="font-size:12px">${esc(data.tax_code || '-')}</div></div>
      </div>
      ${data.description ? `<div style="font-size:12px;color:var(--t2);padding:8px;background:var(--bg2);border-radius:var(--rd);margin-bottom:14px">${esc(data.description)}</div>` : ''}
      <div class="sec-title">Recent Transactions</div>
      ${txs.length ? tableWrap(
        '<th>Date</th><th>Ref</th><th>Description</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th>',
        txs.map(t => `<tr style="cursor:pointer" onclick="SPG.go('finance/tx-detail',{id:'${esc(t.tx_id)}'})">
          <td>${fmtDate(t.date)}</td><td>${esc(t.ref || t.tx_id)}</td><td>${esc(t.description || '-')}</td>
          <td style="text-align:right">${t.debit ? fmtAud(t.debit) : '-'}</td>
          <td style="text-align:right">${t.credit ? fmtAud(t.credit) : '-'}</td>
        </tr>`).join('')
      ) : ui.empty('', 'No transactions for this account')}
    </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ════════════════════════════════════════
// ROUTE 12: TAX-CODES
// ════════════════════════════════════════
function renderTaxCodes() {
  return SPG.shell(`
    ${SPG.toolbar('Tax Codes', checkPerm('edit') ? `<button class="btn btn-primary btn-sm" onclick="FinanceSection.showTaxCodeDialog()">+ New Tax Code</button>` : '')}
    <div class="content"><div id="fin-tax-list">${ui.skeleton(40, 6)}</div></div>`, 'Finance');
}

async function loadTaxCodes() {
  try {
    const data = await post('fin_get_tax_codes', tb());
    _taxCodes = data.tax_codes || [];
    const el = document.getElementById('fin-tax-list');
    if (!el) return;
    el.innerHTML = tableWrap(
      '<th>Code</th><th>Label</th><th style="text-align:right">Rate (%)</th><th>Type</th><th>Status</th><th></th>',
      _taxCodes.map(t => `<tr>
        <td style="font-weight:600">${esc(t.code)}</td><td>${esc(t.label)}</td>
        <td style="text-align:right">${(Number(t.rate) * 100).toFixed(1)}%</td>
        <td>${esc(t.tax_type || '-')}</td>
        <td>${ui.badge(t.is_active ? 'active' : 'inactive')}</td>
        <td>${checkPerm('edit') ? `<button class="btn btn-outline btn-sm" onclick="FinanceSection.showTaxCodeDialog(${esc(JSON.stringify(t))})">Edit</button>` : ''}</td>
      </tr>`).join('')
    );
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function showTaxCodeDialog(taxData) {
  const d = taxData || {};
  const isEdit = !!d.code;
  SPG.showDialog(`<div class="popup-sheet" style="width:380px">
    <div class="popup-header"><div class="popup-title">${isEdit ? 'Edit' : 'New'} Tax Code</div><button class="popup-close" onclick="SPG.closeDialog()">x</button></div>
    <div class="fg"><label class="lb">Code *</label><input class="inp" id="tc-code" value="${esc(d.code || '')}" ${isEdit ? 'readonly' : ''}></div>
    <div class="fg"><label class="lb">Label *</label><input class="inp" id="tc-label" value="${esc(d.label || '')}"></div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Rate (decimal) *</label><input class="inp" id="tc-rate" type="number" step="0.001" value="${d.rate ?? 0.10}"></div>
      <div class="fg" style="flex:1"><label class="lb">Type</label>
        <select class="inp" id="tc-type">
          <option value="output"${d.tax_type === 'output' ? ' selected' : ''}>Output (Sales)</option>
          <option value="input"${d.tax_type === 'input' ? ' selected' : ''}>Input (Purchase)</option>
        </select>
      </div>
    </div>
    <div class="error-msg" id="tc-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="FinanceSection.saveTaxCode('${esc(d.tax_code_id || '')}')">${isEdit ? 'Update' : 'Create'}</button>
    </div>
  </div>`);
}

async function saveTaxCode(taxId) {
  const code = document.getElementById('tc-code')?.value.trim();
  const label = document.getElementById('tc-label')?.value.trim();
  const rate = Number(document.getElementById('tc-rate')?.value);
  if (!code || !label) { SPG.showError('tc-error', 'Code and label required'); return; }
  SPG.showLoader();
  try {
    const action = taxId ? 'fin_update_tax_code' : 'fin_create_tax_code';
    await post(action, tb({ tax_code_id: taxId || undefined, code, label, rate, tax_type: document.getElementById('tc-type')?.value }));
    SPG.closeDialog();
    SPG.toast('Tax code saved', 'success');
    loadTaxCodes();
  } catch (e) { SPG.showError('tc-error', e.message); }
  finally { SPG.hideLoader(); }
}


// ════════════════════════════════════════
// ROUTE 13: BANK-RULES
// ════════════════════════════════════════
function renderBankRules() {
  return SPG.shell(`
    ${SPG.toolbar('Bank Rules', checkPerm('edit') ? `<button class="btn btn-primary btn-sm" onclick="FinanceSection.showBankRuleDialog()">+ New Rule</button>` : '')}
    <div class="content"><div id="fin-rules-list">${ui.skeleton(40, 6)}</div></div>`, 'Finance');
}

async function loadBankRules() {
  try {
    const data = await post('fin_get_bank_rules', tb());
    _bankRules = data.rules || [];
    const el = document.getElementById('fin-rules-list');
    if (!el) return;
    el.innerHTML = _bankRules.length ? tableWrap(
      '<th>Name</th><th>Pattern</th><th>Account</th><th>Contact</th><th>Status</th><th></th>',
      _bankRules.map(r => `<tr>
        <td style="font-weight:600">${esc(r.name)}</td>
        <td><code style="font-size:10px;background:var(--bg2);padding:2px 4px;border-radius:3px">${esc(r.pattern)}</code></td>
        <td>${esc(r.account_name || r.account_id || '-')}</td>
        <td>${esc(r.contact_name || '-')}</td>
        <td>${ui.badge(r.is_active ? 'active' : 'inactive')}</td>
        <td>${checkPerm('edit') ? `<button class="btn btn-outline btn-sm" onclick="FinanceSection.showBankRuleDialog(${esc(JSON.stringify(r))})">Edit</button>` : ''}</td>
      </tr>`).join('')
    ) : ui.empty('', 'No bank rules configured');
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function showBankRuleDialog(ruleData) {
  const d = ruleData || {};
  const isEdit = !!d.rule_id;
  SPG.showDialog(`<div class="popup-sheet" style="width:420px">
    <div class="popup-header"><div class="popup-title">${isEdit ? 'Edit' : 'New'} Bank Rule</div><button class="popup-close" onclick="SPG.closeDialog()">x</button></div>
    <div class="fg"><label class="lb">Rule Name *</label><input class="inp" id="br-name" value="${esc(d.name || '')}"></div>
    <div class="fg"><label class="lb">Match Pattern (regex) *</label><input class="inp" id="br-pattern" value="${esc(d.pattern || '')}" placeholder="e.g. UBER EATS|MENULOG"></div>
    <div class="fg"><label class="lb">Target Account</label><input class="inp" id="br-account" value="${esc(d.account_id || '')}" placeholder="Account code or ID"></div>
    <div class="fg"><label class="lb">Contact</label><input class="inp" id="br-contact" value="${esc(d.contact_id || '')}" placeholder="Contact ID"></div>
    <div class="fg"><label class="lb">Tax Code</label>
      <select class="inp" id="br-tax">
        <option value="GST"${d.tax_code === 'GST' ? ' selected' : ''}>GST 10%</option>
        <option value="NONE"${d.tax_code === 'NONE' || !d.tax_code ? ' selected' : ''}>No Tax</option>
      </select>
    </div>
    <div class="error-msg" id="br-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="FinanceSection.saveBankRule('${esc(d.rule_id || '')}')">${isEdit ? 'Update' : 'Create'}</button>
    </div>
  </div>`);
}

async function saveBankRule(ruleId) {
  const name = document.getElementById('br-name')?.value.trim();
  const pattern = document.getElementById('br-pattern')?.value.trim();
  if (!name || !pattern) { SPG.showError('br-error', 'Name and pattern required'); return; }
  SPG.showLoader();
  try {
    const action = ruleId ? 'fin_update_bank_rule' : 'fin_create_bank_rule';
    await post(action, tb({
      rule_id: ruleId || undefined, name, pattern,
      account_id: document.getElementById('br-account')?.value.trim() || null,
      contact_id: document.getElementById('br-contact')?.value.trim() || null,
      tax_code: document.getElementById('br-tax')?.value || 'NONE',
    }));
    SPG.closeDialog();
    SPG.toast('Bank rule saved', 'success');
    loadBankRules();
  } catch (e) { SPG.showError('br-error', e.message); }
  finally { SPG.hideLoader(); }
}


// ════════════════════════════════════════
// ROUTE 14: PAYROLL — Payroll Overview
// ════════════════════════════════════════
function renderPayroll() {
  return SPG.shell(`
    ${SPG.toolbar('Payroll', checkPerm('edit') ? `<button class="btn btn-primary btn-sm" onclick="SPG.go('finance/pay-run')">+ New Pay Run</button>` : '')}
    <div class="content">
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px" id="fin-payroll-kpis"></div>
      <div class="sec-title">Recent Pay Runs</div>
      <div id="fin-payroll-runs">${ui.skeleton(40, 5)}</div>
    </div>`, 'Finance');
}

async function loadPayroll() {
  try {
    const data = await post('fin_get_payroll_overview', tb());
    const kpiEl = document.getElementById('fin-payroll-kpis');
    if (kpiEl) {
      kpiEl.innerHTML = [
        kpiCard('Total Employees', String(data.total_employees || 0), '', 'var(--blue)'),
        kpiCard('This Period Gross', fmtAud(data.period_gross), '', 'var(--t1)'),
        kpiCard('This Period Net', fmtAud(data.period_net), '', 'var(--green)'),
        kpiCard('Total Super', fmtAud(data.total_super), 'Superannuation', 'var(--orange)'),
      ].join('');
    }
    _payRuns = data.pay_runs || [];
    const el = document.getElementById('fin-payroll-runs');
    if (el) {
      el.innerHTML = _payRuns.length ? tableWrap(
        '<th>Period</th><th>Employees</th><th style="text-align:right">Gross</th><th style="text-align:right">Net</th><th>Status</th>',
        _payRuns.map(r => `<tr style="cursor:pointer" onclick="SPG.go('finance/pay-run-detail',{id:'${esc(r.pay_run_id)}'})">
          <td>${esc(r.period_label || r.period)}</td><td>${r.employee_count || 0}</td>
          <td style="text-align:right">${fmtAud(r.gross)}</td><td style="text-align:right">${fmtAud(r.net)}</td>
          <td>${ui.badge(r.status)}</td>
        </tr>`).join('')
      ) : ui.empty('', 'No pay runs yet');
    }
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ════════════════════════════════════════
// ROUTE 15: PAY-RUN — 3-Step Wizard
// ════════════════════════════════════════
function renderPayRun() {
  _payRunWizard = { step: 1, period: '', selectedEmployees: [], calculations: [], payRunId: null };
  return SPG.shell(`
    ${SPG.toolbar('New Pay Run', navBack('payroll', 'Payroll'))}
    <div class="content"><div id="fin-pay-run-wizard">${ui.skeleton(300)}</div></div>`, 'Finance');
}

async function loadPayRun() {
  // Load employee list for step 1
  try {
    const data = await post('fin_get_employees', tb());
    _employees = data.employees || [];
    renderPayRunStep();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function renderPayRunStep() {
  const el = document.getElementById('fin-pay-run-wizard');
  if (!el) return;
  const w = _payRunWizard;

  // Progress bar
  const steps = ['Select Period & Employees', 'Review Calculations', 'Approve & Submit'];
  const progress = `<div style="display:flex;gap:4px;margin-bottom:20px">
    ${steps.map((s, i) => `<div style="flex:1;text-align:center;padding:8px 4px;font-size:11px;font-weight:${i + 1 === w.step ? '700' : '400'};color:${i + 1 <= w.step ? 'var(--acc)' : 'var(--t4)'};border-bottom:2px solid ${i + 1 <= w.step ? 'var(--acc)' : 'var(--bd2)'}">Step ${i + 1}: ${s}</div>`).join('')}
  </div>`;

  if (w.step === 1) {
    el.innerHTML = `<div class="card max-w-lg">${progress}
      <div class="fg"><label class="lb">Pay Period *</label>
        <select class="inp" id="pr-period">
          <option value="">-- Select Period --</option>
          <option value="weekly">Weekly</option>
          <option value="fortnightly">Fortnightly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <div style="display:flex;gap:8px">
        <div class="fg" style="flex:1"><label class="lb">Period Start *</label><input class="inp" type="date" id="pr-start"></div>
        <div class="fg" style="flex:1"><label class="lb">Period End *</label><input class="inp" type="date" id="pr-end"></div>
      </div>
      <div class="fg"><label class="lb">Payment Date *</label><input class="inp" type="date" id="pr-pay-date" value="${sydneyToday()}"></div>
      <div class="sec-title" style="margin-top:14px">Select Employees</div>
      <div style="margin-bottom:8px"><label style="font-size:11px;cursor:pointer"><input type="checkbox" id="pr-select-all" onchange="FinanceSection.toggleAllEmployees(this.checked)"> Select All</label></div>
      <div id="pr-emp-list">
        ${_employees.map(emp => `<label style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bd2);font-size:12px;cursor:pointer">
          <input type="checkbox" class="pr-emp-cb" value="${esc(emp.employee_id)}" ${w.selectedEmployees.includes(emp.employee_id) ? 'checked' : ''}>
          <span style="font-weight:600">${esc(emp.name)}</span>
          <span style="color:var(--t3);font-size:10px">${esc(emp.position || '')} · ${esc(emp.pay_type || 'salary')}</span>
        </label>`).join('')}
      </div>
      <div class="error-msg" id="pr-error"></div>
      <div style="text-align:right;margin-top:16px">
        <button class="btn btn-primary" onclick="FinanceSection.payRunNext()">Next: Review Calculations \u2192</button>
      </div>
    </div>`;
  } else if (w.step === 2) {
    const calcs = w.calculations;
    let totalGross = 0, totalTax = 0, totalSuper = 0, totalNet = 0;
    calcs.forEach(c => { totalGross += c.gross; totalTax += c.tax; totalSuper += c.super_amount; totalNet += c.net; });

    el.innerHTML = `<div class="card max-w-lg">${progress}
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
        ${kpiCard('Total Gross', fmtAud(totalGross), '', 'var(--t1)')}
        ${kpiCard('Total Tax (PAYG)', fmtAud(totalTax), '', 'var(--red)')}
        ${kpiCard('Total Super', fmtAud(totalSuper), '11.5%', 'var(--orange)')}
        ${kpiCard('Total Net', fmtAud(totalNet), '', 'var(--green)')}
      </div>
      <div class="sec-title">Employee Breakdown</div>
      ${tableWrap(
        '<th>Employee</th><th style="text-align:right">Hours</th><th style="text-align:right">Gross</th><th style="text-align:right">Tax</th><th style="text-align:right">Super</th><th style="text-align:right">Net</th>',
        calcs.map(c => `<tr>
          <td style="font-weight:600">${esc(c.name)}</td>
          <td style="text-align:right">${c.hours || '-'}</td>
          <td style="text-align:right">${fmtAud(c.gross)}</td>
          <td style="text-align:right;color:var(--red)">${fmtAud(c.tax)}</td>
          <td style="text-align:right;color:var(--orange)">${fmtAud(c.super_amount)}</td>
          <td style="text-align:right;font-weight:600;color:var(--green)">${fmtAud(c.net)}</td>
        </tr>`).join('')
      )}
      <div style="display:flex;justify-content:space-between;margin-top:16px">
        <button class="btn btn-outline" onclick="FinanceSection.payRunBack()">\u2190 Back</button>
        <button class="btn btn-primary" onclick="FinanceSection.payRunNext()">Next: Approve & Submit \u2192</button>
      </div>
    </div>`;
  } else if (w.step === 3) {
    el.innerHTML = `<div class="card max-w-lg">${progress}
      <div style="text-align:center;padding:30px">
        <div style="font-size:40px;margin-bottom:10px">&#10003;</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:8px">Ready to Submit</div>
        <div style="font-size:12px;color:var(--t2);margin-bottom:20px">
          ${w.selectedEmployees.length} employees · Period: ${esc(w.period)}<br>
          Payment Date: ${esc(w.payDate)}
        </div>
        <div class="error-msg" id="pr-error"></div>
        <div style="display:flex;gap:8px;justify-content:center">
          <button class="btn btn-outline" onclick="FinanceSection.payRunBack()">\u2190 Back</button>
          <button class="btn btn-primary" style="background:var(--green)" id="btn-submit-pr" onclick="FinanceSection.submitPayRun()">Approve & Submit Pay Run</button>
        </div>
      </div>
    </div>`;
  }
}

function toggleAllEmployees(checked) {
  document.querySelectorAll('.pr-emp-cb').forEach(cb => { cb.checked = checked; });
}

async function payRunNext() {
  const w = _payRunWizard;
  if (w.step === 1) {
    const period = document.getElementById('pr-period')?.value;
    const start = document.getElementById('pr-start')?.value;
    const end = document.getElementById('pr-end')?.value;
    const payDate = document.getElementById('pr-pay-date')?.value;
    const selected = [];
    document.querySelectorAll('.pr-emp-cb:checked').forEach(cb => selected.push(cb.value));
    if (!period || !start || !end) { SPG.showError('pr-error', 'Period and dates required'); return; }
    if (selected.length === 0) { SPG.showError('pr-error', 'Select at least one employee'); return; }
    w.period = period;
    w.start = start;
    w.end = end;
    w.payDate = payDate;
    w.selectedEmployees = selected;

    SPG.showLoader();
    try {
      const data = await post('fin_create_pay_run', tb({
        period, start_date: start, end_date: end, payment_date: payDate,
        employee_ids: selected, status: 'draft',
      }));
      w.payRunId = data.pay_run_id;
      w.calculations = data.calculations || [];
      w.step = 2;
      renderPayRunStep();
    } catch (e) { SPG.showError('pr-error', e.message); }
    finally { SPG.hideLoader(); }
  } else if (w.step === 2) {
    w.step = 3;
    renderPayRunStep();
  }
}

function payRunBack() {
  if (_payRunWizard.step > 1) {
    _payRunWizard.step--;
    renderPayRunStep();
  }
}

async function submitPayRun() {
  const w = _payRunWizard;
  if (!w.payRunId) { SPG.showError('pr-error', 'No pay run created'); return; }
  const btn = document.getElementById('btn-submit-pr');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting...'; }
  SPG.showLoader();
  try {
    await post('fin_approve_pay_run', tb({ pay_run_id: w.payRunId }));
    SPG.toast('Pay run approved and submitted', 'success');
    SPG.go('finance/pay-run-detail', { id: w.payRunId });
  } catch (e) {
    SPG.showError('pr-error', e.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Approve & Submit Pay Run'; }
  } finally { SPG.hideLoader(); }
}


// ════════════════════════════════════════
// ROUTE 16: PAY-RUN-DETAIL
// ════════════════════════════════════════
function renderPayRunDetail(p) {
  return SPG.shell(`
    ${SPG.toolbar('Pay Run Detail', navBack('payroll', 'Payroll'))}
    <div class="content"><div id="fin-pr-detail">${ui.skeleton(300)}</div></div>`, 'Finance');
}

async function loadPayRunDetail(p) {
  const prId = p?.id || SPG.currentParams?.id;
  if (!prId) { SPG.go('finance/payroll'); return; }
  try {
    const data = await post('fin_get_pay_run_detail', tb({ pay_run_id: prId }));
    const el = document.getElementById('fin-pr-detail');
    if (!el) return;
    const calcs = data.calculations || [];
    let totalGross = 0, totalTax = 0, totalSuper = 0, totalNet = 0;
    calcs.forEach(c => { totalGross += c.gross; totalTax += c.tax; totalSuper += c.super_amount; totalNet += c.net; });

    el.innerHTML = `<div class="card max-w-lg">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:14px">
        <div>
          <div style="font-size:16px;font-weight:700">Pay Run: ${esc(data.period_label || data.period)}</div>
          <div style="font-size:11px;color:var(--t3)">${fmtDate(data.start_date)} to ${fmtDate(data.end_date)} · Payment: ${fmtDate(data.payment_date)}</div>
        </div>
        ${ui.badge(data.status)}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
        ${kpiCard('Gross', fmtAud(totalGross), '', 'var(--t1)')}
        ${kpiCard('Tax (PAYG)', fmtAud(totalTax), '', 'var(--red)')}
        ${kpiCard('Super', fmtAud(totalSuper), '', 'var(--orange)')}
        ${kpiCard('Net Pay', fmtAud(totalNet), '', 'var(--green)')}
      </div>
      ${tableWrap(
        '<th>Employee</th><th style="text-align:right">Hours</th><th style="text-align:right">Gross</th><th style="text-align:right">Tax</th><th style="text-align:right">Super</th><th style="text-align:right">Net</th>',
        calcs.map(c => `<tr>
          <td><span style="font-weight:600;cursor:pointer;color:var(--acc)" onclick="SPG.go('finance/employee-detail',{id:'${esc(c.employee_id)}'})">${esc(c.name)}</span></td>
          <td style="text-align:right">${c.hours || '-'}</td>
          <td style="text-align:right">${fmtAud(c.gross)}</td>
          <td style="text-align:right">${fmtAud(c.tax)}</td>
          <td style="text-align:right">${fmtAud(c.super_amount)}</td>
          <td style="text-align:right;font-weight:600">${fmtAud(c.net)}</td>
        </tr>`).join('')
      )}
      ${data.status === 'draft' && checkPerm('admin') ? `<div style="text-align:right;margin-top:14px">
        <button class="btn btn-primary" style="background:var(--green)" onclick="FinanceSection.approvePayRun('${esc(data.pay_run_id)}')">Approve Pay Run</button>
      </div>` : ''}
    </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function approvePayRun(prId) {
  if (!confirm('Approve this pay run?')) return;
  SPG.showLoader();
  try {
    await post('fin_approve_pay_run', tb({ pay_run_id: prId }));
    SPG.toast('Pay run approved', 'success');
    loadPayRunDetail({ id: prId });
  } catch (e) { SPG.toast(e.message, 'error'); }
  finally { SPG.hideLoader(); }
}


// ════════════════════════════════════════
// ROUTE 17: EMPLOYEES
// ════════════════════════════════════════
let _empPage = 1;

function renderEmployees() {
  return SPG.shell(`
    ${SPG.toolbar('Employees', checkPerm('edit') ? `<button class="btn btn-primary btn-sm" onclick="FinanceSection.showEmployeeDialog()">+ New Employee</button>` : '')}
    <div class="content">
      <div id="fin-emp-filters"></div>
      <div id="fin-emp-list">${ui.skeleton(40, 6)}</div>
    </div>`, 'Finance');
}

async function loadEmployees() {
  const filterEl = document.getElementById('fin-emp-filters');
  if (filterEl) {
    filterEl.innerHTML = ui.filterBar([
      { id: 'fl-emp-search', label: 'Search', type: 'text', placeholder: 'Name...', onChange: "FinanceSection.fetchEmployees()" },
      { id: 'fl-emp-status', label: 'Status', type: 'select', onChange: "FinanceSection.fetchEmployees()",
        options: [{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
    ]);
  }
  await fetchEmployees();
}

async function fetchEmployees() {
  try {
    const data = await post('fin_get_employees', tb({
      search: document.getElementById('fl-emp-search')?.value || '',
      status: document.getElementById('fl-emp-status')?.value || '',
    }));
    _employees = data.employees || [];
    renderEmpTable();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function renderEmpTable() {
  const el = document.getElementById('fin-emp-list');
  if (!el) return;
  const pg = paginate(_employees, _empPage, 20);
  el.innerHTML = tableWrap(
    `${ui.sortTh('empTbl', 'name', 'Name')}<th>Position</th><th>Pay Type</th><th style="text-align:right">Rate</th><th>Status</th>`,
    pg.items.map(e => `<tr style="cursor:pointer" onclick="SPG.go('finance/employee-detail',{id:'${esc(e.employee_id)}'})">
      <td style="font-weight:600">${esc(e.name)}</td><td>${esc(e.position || '-')}</td>
      <td>${esc(e.pay_type || '-')}</td><td style="text-align:right">${fmtAud(e.rate)}</td>
      <td>${ui.badge(e.is_active ? 'active' : 'inactive')}</td>
    </tr>`).join(''),
    'empTbl'
  ) + pagerHtml(pg.page, pg.pages, 'FinanceSection.empPage');
}

function empPage(p) { _empPage = p; renderEmpTable(); }

function showEmployeeDialog(empData) {
  const d = empData || {};
  const isEdit = !!d.employee_id;
  SPG.showDialog(`<div class="popup-sheet" style="width:440px">
    <div class="popup-header"><div class="popup-title">${isEdit ? 'Edit' : 'New'} Employee</div><button class="popup-close" onclick="SPG.closeDialog()">x</button></div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Name *</label><input class="inp" id="em-name" value="${esc(d.name || '')}"></div>
      <div class="fg" style="flex:1"><label class="lb">Position</label><input class="inp" id="em-pos" value="${esc(d.position || '')}"></div>
    </div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Email</label><input class="inp" id="em-email" value="${esc(d.email || '')}"></div>
      <div class="fg" style="flex:1"><label class="lb">Phone</label><input class="inp" id="em-phone" value="${esc(d.phone || '')}"></div>
    </div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Pay Type *</label>
        <select class="inp" id="em-paytype">
          <option value="salary"${d.pay_type === 'salary' ? ' selected' : ''}>Salary</option>
          <option value="hourly"${d.pay_type === 'hourly' ? ' selected' : ''}>Hourly</option>
          <option value="casual"${d.pay_type === 'casual' ? ' selected' : ''}>Casual</option>
        </select>
      </div>
      <div class="fg" style="flex:1"><label class="lb">Rate ($) *</label><input class="inp" id="em-rate" type="number" step="0.01" value="${d.rate || ''}"></div>
    </div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">TFN</label><input class="inp" id="em-tfn" value="${esc(d.tfn || '')}" placeholder="Tax File Number"></div>
      <div class="fg" style="flex:1"><label class="lb">Super Fund</label><input class="inp" id="em-super" value="${esc(d.super_fund || '')}" placeholder="Super fund name"></div>
    </div>
    <div class="fg"><label class="lb">BSB / Account</label>
      <div style="display:flex;gap:8px">
        <input class="inp" id="em-bsb" value="${esc(d.bsb || '')}" placeholder="BSB" style="width:100px">
        <input class="inp" id="em-acctnum" value="${esc(d.account_number || '')}" placeholder="Account number" style="flex:1">
      </div>
    </div>
    <div class="fg"><label class="lb">Start Date</label><input class="inp" type="date" id="em-start" value="${d.start_date || ''}"></div>
    <div class="error-msg" id="em-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="FinanceSection.saveEmployee('${esc(d.employee_id || '')}')">${isEdit ? 'Update' : 'Create'}</button>
    </div>
  </div>`);
}

async function saveEmployee(empId) {
  const name = document.getElementById('em-name')?.value.trim();
  const rate = document.getElementById('em-rate')?.value;
  if (!name) { SPG.showError('em-error', 'Name required'); return; }
  if (!rate) { SPG.showError('em-error', 'Rate required'); return; }
  const payload = {
    name,
    position: document.getElementById('em-pos')?.value.trim(),
    email: document.getElementById('em-email')?.value.trim(),
    phone: document.getElementById('em-phone')?.value.trim(),
    pay_type: document.getElementById('em-paytype')?.value,
    rate: Number(rate),
    tfn: document.getElementById('em-tfn')?.value.trim(),
    super_fund: document.getElementById('em-super')?.value.trim(),
    bsb: document.getElementById('em-bsb')?.value.trim(),
    account_number: document.getElementById('em-acctnum')?.value.trim(),
    start_date: document.getElementById('em-start')?.value || null,
  };
  SPG.showLoader();
  try {
    if (empId) {
      await post('fin_update_employee', tb({ employee_id: empId, ...payload }));
      SPG.toast('Employee updated', 'success');
    } else {
      await post('fin_create_employee', tb(payload));
      SPG.toast('Employee created', 'success');
    }
    SPG.closeDialog();
    fetchEmployees();
  } catch (e) { SPG.showError('em-error', e.message); }
  finally { SPG.hideLoader(); }
}


// ════════════════════════════════════════
// ROUTE 18: EMPLOYEE-DETAIL
// ════════════════════════════════════════
function renderEmployeeDetail(p) {
  return SPG.shell(`
    ${SPG.toolbar('Employee Detail', navBack('employees', 'Employees'))}
    <div class="content"><div id="fin-emp-detail">${ui.skeleton(300)}</div></div>`, 'Finance');
}

async function loadEmployeeDetail(p) {
  const eid = p?.id || SPG.currentParams?.id;
  if (!eid) { SPG.go('finance/employees'); return; }
  try {
    const data = await post('fin_get_employee_detail', tb({ employee_id: eid }));
    const el = document.getElementById('fin-emp-detail');
    if (!el) return;
    const history = data.pay_history || [];
    el.innerHTML = `<div class="card max-w-lg">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:14px">
        <div>
          <div style="font-size:16px;font-weight:700">${esc(data.name)}</div>
          <div style="font-size:11px;color:var(--t3)">${esc(data.position || '-')} · ${esc(data.pay_type || '-')} · Started ${fmtDate(data.start_date)}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${ui.badge(data.is_active ? 'active' : 'inactive')}
          ${checkPerm('edit') ? `<button class="btn btn-outline btn-sm" onclick="FinanceSection.showEmployeeDialog(${esc(JSON.stringify(data))})">Edit</button>` : ''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
        <div><div class="lb">Rate</div><div style="font-size:14px;font-weight:700">${fmtAud(data.rate)}<span style="font-size:10px;color:var(--t3)">/${data.pay_type === 'salary' ? 'year' : 'hour'}</span></div></div>
        <div><div class="lb">Email</div><div style="font-size:12px">${esc(data.email || '-')}</div></div>
        <div><div class="lb">Phone</div><div style="font-size:12px">${esc(data.phone || '-')}</div></div>
        <div><div class="lb">TFN</div><div style="font-size:12px">${esc(data.tfn ? '***' + data.tfn.slice(-3) : '-')}</div></div>
        <div><div class="lb">Super Fund</div><div style="font-size:12px">${esc(data.super_fund || '-')}</div></div>
        <div><div class="lb">Bank</div><div style="font-size:12px">${data.bsb ? esc(data.bsb) + ' / ' + esc(data.account_number) : '-'}</div></div>
      </div>
      <div class="sec-title">Pay History</div>
      ${history.length ? tableWrap(
        '<th>Period</th><th style="text-align:right">Gross</th><th style="text-align:right">Tax</th><th style="text-align:right">Super</th><th style="text-align:right">Net</th>',
        history.map(h => `<tr style="cursor:pointer" onclick="SPG.go('finance/pay-run-detail',{id:'${esc(h.pay_run_id)}'})">
          <td>${esc(h.period_label || h.period)}</td>
          <td style="text-align:right">${fmtAud(h.gross)}</td><td style="text-align:right">${fmtAud(h.tax)}</td>
          <td style="text-align:right">${fmtAud(h.super_amount)}</td><td style="text-align:right;font-weight:600">${fmtAud(h.net)}</td>
        </tr>`).join('')
      ) : ui.empty('', 'No pay history')}
    </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ════════════════════════════════════════
// ROUTE 19: RECONCILE — Bank Reconciliation Dashboard
// ════════════════════════════════════════
function renderReconcile() {
  return SPG.shell(`
    ${SPG.toolbar('Bank Reconciliation', checkPerm('edit') ? `<div style="display:flex;gap:6px">
      <button class="btn btn-outline btn-sm" onclick="FinanceSection.showImportCsvDialog()">Import CSV</button>
      <button class="btn btn-primary btn-sm" onclick="FinanceSection.startReconcileSession()">Start Reconciling</button>
    </div>` : '')}
    <div class="content">
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px" id="fin-rec-kpis"></div>
      <div class="sec-title">Unreconciled Items</div>
      <div id="fin-rec-list">${ui.skeleton(40, 8)}</div>
    </div>`, 'Finance');
}

async function loadReconcile() {
  try {
    const data = await post('fin_get_reconcile_dashboard', tb());
    _reconcileData = data;
    const kpiEl = document.getElementById('fin-rec-kpis');
    if (kpiEl) {
      kpiEl.innerHTML = [
        kpiCard('Bank Balance', fmtAud(data.bank_balance), 'Per statement', 'var(--blue)'),
        kpiCard('Book Balance', fmtAud(data.book_balance), 'Per ledger', 'var(--t1)'),
        kpiCard('Difference', fmtAud(data.difference), data.difference === 0 ? 'Reconciled' : 'Unreconciled', data.difference === 0 ? 'var(--green)' : 'var(--red)'),
        kpiCard('Unmatched', String(data.unmatched_count || 0), 'Items', 'var(--orange)'),
      ].join('');
    }
    const el = document.getElementById('fin-rec-list');
    if (el) {
      const items = data.unmatched || [];
      el.innerHTML = items.length ? tableWrap(
        '<th>Date</th><th>Description</th><th>Source</th><th style="text-align:right">Amount</th>',
        items.map(it => `<tr>
          <td>${fmtDate(it.date)}</td><td>${esc(it.description)}</td>
          <td>${ui.badge(it.source === 'bank' ? 'active' : 'submitted', it.source === 'bank' ? 'Bank' : 'Book')}</td>
          <td style="text-align:right;font-weight:600;color:${Number(it.amount) >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtAud(it.amount)}</td>
        </tr>`).join('')
      ) : ui.empty('', 'All items reconciled');
    }
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function showImportCsvDialog() {
  SPG.showDialog(`<div class="popup-sheet" style="width:440px">
    <div class="popup-header"><div class="popup-title">Import Bank CSV</div><button class="popup-close" onclick="SPG.closeDialog()">x</button></div>
    <div style="font-size:12px;color:var(--t2);margin-bottom:12px">
      Supported formats: <strong>Westpac</strong>, <strong>Generic CSV</strong> (Date, Description, Amount)
    </div>
    <div class="fg"><label class="lb">Bank Account</label>
      <select class="inp" id="csv-bank">
        <option value="main">Main Operating Account</option>
        <option value="savings">Savings Account</option>
      </select>
    </div>
    <div class="fg"><label class="lb">CSV File *</label>
      <input type="file" id="csv-file" accept=".csv" class="inp" style="padding:6px">
    </div>
    <div class="fg"><label class="lb">Format</label>
      <select class="inp" id="csv-format">
        <option value="auto">Auto-detect</option>
        <option value="westpac">Westpac</option>
        <option value="generic">Generic (Date, Description, Amount)</option>
      </select>
    </div>
    <div class="error-msg" id="csv-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="FinanceSection.importCsv()">Import</button>
    </div>
  </div>`);
}

async function importCsv() {
  const fileInput = document.getElementById('csv-file');
  const file = fileInput?.files?.[0];
  if (!file) { SPG.showError('csv-error', 'Please select a CSV file'); return; }

  const bank_account = document.getElementById('csv-bank')?.value;
  const format = document.getElementById('csv-format')?.value;

  SPG.showLoader();
  try {
    const text = await file.text();
    // Parse CSV
    const rows = parseCsv(text, format);
    if (rows.length === 0) { SPG.showError('csv-error', 'No valid rows found in CSV'); SPG.hideLoader(); return; }

    await post('fin_import_bank_csv', tb({ bank_account, format, rows }));
    SPG.closeDialog();
    SPG.toast(`Imported ${rows.length} transactions`, 'success');
    loadReconcile();
  } catch (e) { SPG.showError('csv-error', e.message); }
  finally { SPG.hideLoader(); }
}

function parseCsv(text, format) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) return [];
  const rows = [];
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
    if (cols.length < 3) continue;

    // Westpac format: Date, Amount, blank, blank, Description, Balance
    // Generic: Date, Description, Amount
    let date, description, amount;
    if (format === 'westpac' || (format === 'auto' && cols.length >= 5)) {
      date = normalizeDate(cols[0]);
      amount = parseFloat(cols[1]);
      description = cols[4] || cols[2] || '';
    } else {
      date = normalizeDate(cols[0]);
      description = cols[1] || '';
      amount = parseFloat(cols[2]);
    }
    if (date && !isNaN(amount)) {
      rows.push({ date, description, amount });
    }
  }
  return rows;
}

function normalizeDate(str) {
  if (!str) return '';
  // Try DD/MM/YYYY
  const parts = str.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    const year = y.length === 2 ? '20' + y : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Try YYYY-MM-DD (already correct)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return str;
}


// ════════════════════════════════════════
// ROUTE 20: RECONCILE-SESSION — Active Match View
// ════════════════════════════════════════
function renderReconcileSession(p) {
  return SPG.shell(`
    ${SPG.toolbar('Reconcile Session', navBack('reconcile', 'Reconciliation'))}
    <div class="content"><div id="fin-rec-session">${ui.skeleton(400)}</div></div>`, 'Finance');
}

async function startReconcileSession() {
  SPG.go('finance/reconcile-session');
}

async function loadReconcileSession() {
  try {
    const data = await post('fin_get_reconcile_session', tb());
    _reconcileSession = data;
    renderReconcileMatchView(data);
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function renderReconcileMatchView(data) {
  const el = document.getElementById('fin-rec-session');
  if (!el) return;
  const bankItems = data.bank_items || [];
  const bookItems = data.book_items || [];

  el.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:300px">
        <div class="card">
          <div style="font-weight:700;font-size:13px;margin-bottom:10px;color:var(--blue)">Bank Statement</div>
          <div style="font-size:11px;color:var(--t3);margin-bottom:8px">${bankItems.length} unmatched items</div>
          ${bankItems.map((b, i) => `<div class="rec-item ${b._selected ? 'rec-selected' : ''}" id="bank-${i}" onclick="FinanceSection.toggleRecItem('bank',${i})" style="display:flex;justify-content:space-between;padding:8px;margin-bottom:4px;border:1px solid var(--bd2);border-radius:var(--rd);cursor:pointer;font-size:11px;${b._selected ? 'background:var(--blue-bg);border-color:var(--blue)' : ''}">
            <div><div>${fmtDate(b.date)}</div><div style="color:var(--t2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(b.description)}</div></div>
            <div style="font-weight:600;color:${Number(b.amount) >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtAud(b.amount)}</div>
          </div>`).join('')}
          ${bankItems.length === 0 ? '<div style="font-size:11px;color:var(--t4);padding:10px">No unmatched bank items</div>' : ''}
        </div>
      </div>
      <div style="flex:1;min-width:300px">
        <div class="card">
          <div style="font-weight:700;font-size:13px;margin-bottom:10px;color:var(--acc)">Book Entries</div>
          <div style="font-size:11px;color:var(--t3);margin-bottom:8px">${bookItems.length} unmatched items</div>
          ${bookItems.map((b, i) => `<div class="rec-item ${b._selected ? 'rec-selected' : ''}" id="book-${i}" onclick="FinanceSection.toggleRecItem('book',${i})" style="display:flex;justify-content:space-between;padding:8px;margin-bottom:4px;border:1px solid var(--bd2);border-radius:var(--rd);cursor:pointer;font-size:11px;${b._selected ? 'background:var(--acc2);border-color:var(--acc)' : ''}">
            <div><div>${fmtDate(b.date)}</div><div style="color:var(--t2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(b.description)}</div></div>
            <div style="font-weight:600;color:${Number(b.amount) >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtAud(b.amount)}</div>
          </div>`).join('')}
          ${bookItems.length === 0 ? '<div style="font-size:11px;color:var(--t4);padding:10px">No unmatched book items</div>' : ''}
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:14px">
      <button class="btn btn-primary btn-sm" onclick="FinanceSection.matchSelected()">Match Selected</button>
      <button class="btn btn-outline btn-sm" onclick="FinanceSection.showManualMatchDialog()">Create Manual Match</button>
    </div>`;
}

function toggleRecItem(side, idx) {
  if (!_reconcileSession) return;
  const items = side === 'bank' ? _reconcileSession.bank_items : _reconcileSession.book_items;
  if (items[idx]) {
    items[idx]._selected = !items[idx]._selected;
    renderReconcileMatchView(_reconcileSession);
  }
}

async function matchSelected() {
  if (!_reconcileSession) return;
  const bankSel = (_reconcileSession.bank_items || []).filter(b => b._selected).map(b => b.id);
  const bookSel = (_reconcileSession.book_items || []).filter(b => b._selected).map(b => b.id);
  if (bankSel.length === 0 && bookSel.length === 0) { SPG.toast('Select items to match', 'error'); return; }
  SPG.showLoader();
  try {
    await post('fin_match_transactions', tb({ bank_ids: bankSel, book_ids: bookSel }));
    SPG.toast('Items matched', 'success');
    loadReconcileSession();
  } catch (e) { SPG.toast(e.message, 'error'); }
  finally { SPG.hideLoader(); }
}

function showManualMatchDialog() {
  SPG.showDialog(`<div class="popup-sheet" style="width:400px">
    <div class="popup-header"><div class="popup-title">Manual Match</div><button class="popup-close" onclick="SPG.closeDialog()">x</button></div>
    <div class="fg"><label class="lb">Date *</label><input class="inp" type="date" id="mm-date" value="${sydneyToday()}"></div>
    <div class="fg"><label class="lb">Description *</label><input class="inp" id="mm-desc"></div>
    <div class="fg"><label class="lb">Amount *</label><input class="inp" id="mm-amount" type="number" step="0.01"></div>
    <div class="fg"><label class="lb">Account</label><input class="inp" id="mm-account" placeholder="Account code"></div>
    <div class="error-msg" id="mm-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="FinanceSection.submitManualMatch()">Create</button>
    </div>
  </div>`);
}

async function submitManualMatch() {
  const date = document.getElementById('mm-date')?.value;
  const description = document.getElementById('mm-desc')?.value.trim();
  const amount = Number(document.getElementById('mm-amount')?.value);
  if (!date || !description || !amount) { SPG.showError('mm-error', 'All fields required'); return; }
  SPG.showLoader();
  try {
    await post('fin_create_manual_match', tb({ date, description, amount, account_id: document.getElementById('mm-account')?.value.trim() || null }));
    SPG.closeDialog();
    SPG.toast('Manual match created', 'success');
    loadReconcileSession();
  } catch (e) { SPG.showError('mm-error', e.message); }
  finally { SPG.hideLoader(); }
}


// ════════════════════════════════════════
// ROUTE 21: REPORT-PNL — P&L Statement
// ════════════════════════════════════════
function renderReportPnl() {
  return SPG.shell(`
    ${SPG.toolbar('Profit & Loss', navBack('home', 'Dashboard'))}
    <div class="content">
      <div id="fin-pnl-filters"></div>
      <div id="fin-pnl-report">${ui.skeleton(300)}</div>
    </div>`, 'Finance');
}

async function loadReportPnl() {
  const filterEl = document.getElementById('fin-pnl-filters');
  if (filterEl) {
    filterEl.innerHTML = ui.filterBar([
      { id: 'fl-pnl-from', label: 'From', type: 'date', onChange: "FinanceSection.fetchPnl()" },
      { id: 'fl-pnl-to', label: 'To', type: 'date', onChange: "FinanceSection.fetchPnl()" },
      { id: 'fl-pnl-compare', label: 'Compare', type: 'select', onChange: "FinanceSection.fetchPnl()",
        options: [{ value: '', label: 'No Comparison' }, { value: 'prev_period', label: 'Previous Period' }, { value: 'prev_year', label: 'Previous Year' }] },
    ]);
  }
  await fetchPnl();
}

async function fetchPnl() {
  const el = document.getElementById('fin-pnl-report');
  if (!el) return;
  try {
    const data = await post('fin_get_pnl', tb({
      from: document.getElementById('fl-pnl-from')?.value || '',
      to: document.getElementById('fl-pnl-to')?.value || '',
      compare: document.getElementById('fl-pnl-compare')?.value || '',
    }));
    const hasCompare = !!data.compare;
    const hdr = hasCompare ? '<th></th><th style="text-align:right">Current</th><th style="text-align:right">Compare</th><th style="text-align:right">Variance</th>' : '<th></th><th style="text-align:right">Amount</th>';

    function sectionRows(title, items, isBold) {
      let html = `<tr style="background:var(--bg2)"><td colspan="${hasCompare ? 4 : 2}" style="font-weight:700;font-size:12px;padding:8px">${esc(title)}</td></tr>`;
      (items || []).forEach(it => {
        if (hasCompare) {
          const variance = (Number(it.current) || 0) - (Number(it.compare) || 0);
          html += `<tr${isBold ? ' style="font-weight:600"' : ''}>
            <td style="padding-left:20px">${esc(it.label)}</td>
            <td style="text-align:right">${fmtAud(it.current)}</td>
            <td style="text-align:right;color:var(--t3)">${fmtAud(it.compare)}</td>
            <td style="text-align:right;color:${variance >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtAud(variance)}</td>
          </tr>`;
        } else {
          html += `<tr${isBold ? ' style="font-weight:600"' : ''}>
            <td style="padding-left:20px">${esc(it.label)}</td>
            <td style="text-align:right">${fmtAud(it.amount)}</td>
          </tr>`;
        }
      });
      return html;
    }

    function totalRow(label, val, compareVal) {
      if (hasCompare) {
        const variance = (Number(val) || 0) - (Number(compareVal) || 0);
        return `<tr style="font-weight:700;border-top:2px solid var(--bd1)">
          <td>${esc(label)}</td>
          <td style="text-align:right">${fmtAud(val)}</td>
          <td style="text-align:right;color:var(--t3)">${fmtAud(compareVal)}</td>
          <td style="text-align:right;color:${variance >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtAud(variance)}</td>
        </tr>`;
      }
      return `<tr style="font-weight:700;border-top:2px solid var(--bd1)"><td>${esc(label)}</td><td style="text-align:right">${fmtAud(val)}</td></tr>`;
    }

    let rows = '';
    rows += sectionRows('Income', data.income);
    rows += totalRow('Total Income', data.total_income, data.compare?.total_income);
    rows += sectionRows('Cost of Goods Sold', data.cogs);
    rows += totalRow('Gross Profit', data.gross_profit, data.compare?.gross_profit);
    rows += sectionRows('Operating Expenses', data.expenses);
    rows += totalRow('Total Expenses', data.total_expenses, data.compare?.total_expenses);
    rows += totalRow('Net Profit', data.net_profit, data.compare?.net_profit);

    el.innerHTML = `<div class="card max-w-lg">
      <div style="font-size:14px;font-weight:700;margin-bottom:12px">Profit & Loss Statement</div>
      ${tableWrap(hdr, rows)}
    </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ════════════════════════════════════════
// ROUTE 22: REPORT-CASHFLOW
// ════════════════════════════════════════
function renderReportCashflow() {
  return SPG.shell(`
    ${SPG.toolbar('Cash Flow Statement', navBack('home', 'Dashboard'))}
    <div class="content">
      <div id="fin-cf-filters"></div>
      <div id="fin-cf-report">${ui.skeleton(300)}</div>
    </div>`, 'Finance');
}

async function loadReportCashflow() {
  const filterEl = document.getElementById('fin-cf-filters');
  if (filterEl) {
    filterEl.innerHTML = ui.filterBar([
      { id: 'fl-cf-from', label: 'From', type: 'date', onChange: "FinanceSection.fetchCashflow()" },
      { id: 'fl-cf-to', label: 'To', type: 'date', onChange: "FinanceSection.fetchCashflow()" },
    ]);
  }
  await fetchCashflow();
}

async function fetchCashflow() {
  const el = document.getElementById('fin-cf-report');
  if (!el) return;
  try {
    const data = await post('fin_get_cashflow', tb({
      from: document.getElementById('fl-cf-from')?.value || '',
      to: document.getElementById('fl-cf-to')?.value || '',
    }));

    function sectionBlock(title, items) {
      let html = `<tr style="background:var(--bg2)"><td colspan="2" style="font-weight:700;font-size:12px;padding:8px">${esc(title)}</td></tr>`;
      (items || []).forEach(it => {
        html += `<tr><td style="padding-left:20px">${esc(it.label)}</td><td style="text-align:right">${fmtAud(it.amount)}</td></tr>`;
      });
      return html;
    }

    let rows = '';
    rows += sectionBlock('Operating Activities', data.operating);
    rows += `<tr style="font-weight:700;border-top:1px solid var(--bd1)"><td>Net Cash from Operations</td><td style="text-align:right">${fmtAud(data.net_operating)}</td></tr>`;
    rows += sectionBlock('Investing Activities', data.investing);
    rows += `<tr style="font-weight:700;border-top:1px solid var(--bd1)"><td>Net Cash from Investing</td><td style="text-align:right">${fmtAud(data.net_investing)}</td></tr>`;
    rows += sectionBlock('Financing Activities', data.financing);
    rows += `<tr style="font-weight:700;border-top:1px solid var(--bd1)"><td>Net Cash from Financing</td><td style="text-align:right">${fmtAud(data.net_financing)}</td></tr>`;
    rows += `<tr style="font-weight:700;font-size:14px;border-top:2px solid var(--bd1)"><td>Net Change in Cash</td><td style="text-align:right;color:${Number(data.net_change) >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtAud(data.net_change)}</td></tr>`;
    rows += `<tr><td>Opening Balance</td><td style="text-align:right">${fmtAud(data.opening_balance)}</td></tr>`;
    rows += `<tr style="font-weight:700"><td>Closing Balance</td><td style="text-align:right">${fmtAud(data.closing_balance)}</td></tr>`;

    el.innerHTML = `<div class="card max-w-lg">
      <div style="font-size:14px;font-weight:700;margin-bottom:12px">Cash Flow Statement</div>
      ${tableWrap('<th></th><th style="text-align:right">Amount</th>', rows)}
    </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ════════════════════════════════════════
// ROUTE 23: REPORT-AGING — AP/AR Aging
// ════════════════════════════════════════
function renderReportAging() {
  return SPG.shell(`
    ${SPG.toolbar('AP/AR Aging Report', navBack('home', 'Dashboard'))}
    <div class="content">
      <div id="fin-aging-filters"></div>
      <div id="fin-aging-report">${ui.skeleton(300)}</div>
    </div>`, 'Finance');
}

async function loadReportAging() {
  const filterEl = document.getElementById('fin-aging-filters');
  if (filterEl) {
    filterEl.innerHTML = ui.filterBar([
      { id: 'fl-aging-type', label: 'Type', type: 'select', onChange: "FinanceSection.fetchAging()",
        options: [{ value: 'payable', label: 'Accounts Payable' }, { value: 'receivable', label: 'Accounts Receivable' }] },
      { id: 'fl-aging-date', label: 'As At', type: 'date', value: sydneyToday(), onChange: "FinanceSection.fetchAging()" },
    ]);
  }
  await fetchAging();
}

async function fetchAging() {
  const el = document.getElementById('fin-aging-report');
  if (!el) return;
  try {
    const data = await post('fin_get_aging', tb({
      type: document.getElementById('fl-aging-type')?.value || 'payable',
      as_at: document.getElementById('fl-aging-date')?.value || sydneyToday(),
    }));
    const contacts = data.contacts || [];
    el.innerHTML = `<div class="card">
      <div style="font-size:14px;font-weight:700;margin-bottom:12px">${data.type === 'receivable' ? 'Accounts Receivable' : 'Accounts Payable'} Aging</div>
      ${contacts.length ? tableWrap(
        `<th>Contact</th><th style="text-align:right">Current</th><th style="text-align:right">1-30</th><th style="text-align:right">31-60</th><th style="text-align:right">61-90</th><th style="text-align:right">90+</th><th style="text-align:right">Total</th>`,
        contacts.map(c => `<tr style="cursor:pointer" onclick="SPG.go('finance/contact-detail',{id:'${esc(c.contact_id)}'})">
          <td style="font-weight:600">${esc(c.name)}</td>
          <td style="text-align:right">${fmtAud(c.current)}</td>
          <td style="text-align:right">${fmtAud(c.d1_30)}</td>
          <td style="text-align:right">${fmtAud(c.d31_60)}</td>
          <td style="text-align:right">${fmtAud(c.d61_90)}</td>
          <td style="text-align:right;color:var(--red)">${fmtAud(c.d90_plus)}</td>
          <td style="text-align:right;font-weight:700">${fmtAud(c.total)}</td>
        </tr>`).join('') +
        `<tr style="font-weight:700;border-top:2px solid var(--bd1)">
          <td>Total</td>
          <td style="text-align:right">${fmtAud(data.totals?.current)}</td>
          <td style="text-align:right">${fmtAud(data.totals?.d1_30)}</td>
          <td style="text-align:right">${fmtAud(data.totals?.d31_60)}</td>
          <td style="text-align:right">${fmtAud(data.totals?.d61_90)}</td>
          <td style="text-align:right;color:var(--red)">${fmtAud(data.totals?.d90_plus)}</td>
          <td style="text-align:right;font-weight:700">${fmtAud(data.totals?.total)}</td>
        </tr>`
      ) : ui.empty('', 'No aging data')}
    </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ════════════════════════════════════════
// ROUTE 24: REPORT-ASSETS — Fixed Assets
// ════════════════════════════════════════
function renderReportAssets() {
  return SPG.shell(`
    ${SPG.toolbar('Fixed Assets', navBack('home', 'Dashboard'))}
    <div class="content"><div id="fin-assets-report">${ui.skeleton(300)}</div></div>`, 'Finance');
}

async function loadReportAssets() {
  try {
    const data = await post('fin_get_assets', tb());
    const el = document.getElementById('fin-assets-report');
    if (!el) return;
    const assets = data.assets || [];
    el.innerHTML = `<div class="card">
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        ${kpiCard('Total Cost', fmtAud(data.total_cost), '', 'var(--t1)')}
        ${kpiCard('Depreciation', fmtAud(data.total_depreciation), '', 'var(--orange)')}
        ${kpiCard('Book Value', fmtAud(data.total_book_value), '', 'var(--green)')}
      </div>
      ${assets.length ? tableWrap(
        '<th>Asset</th><th>Category</th><th>Purchase Date</th><th style="text-align:right">Cost</th><th style="text-align:right">Depreciation</th><th style="text-align:right">Book Value</th>',
        assets.map(a => `<tr>
          <td style="font-weight:600">${esc(a.name)}</td><td>${esc(a.category || '-')}</td>
          <td>${fmtDate(a.purchase_date)}</td>
          <td style="text-align:right">${fmtAud(a.cost)}</td>
          <td style="text-align:right">${fmtAud(a.depreciation)}</td>
          <td style="text-align:right;font-weight:600">${fmtAud(a.book_value)}</td>
        </tr>`).join('')
      ) : ui.empty('', 'No fixed assets')}
    </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ════════════════════════════════════════
// ROUTE 25: REPORT-SUPER — Superannuation Summary
// ════════════════════════════════════════
function renderReportSuper() {
  return SPG.shell(`
    ${SPG.toolbar('Superannuation Summary', navBack('home', 'Dashboard'))}
    <div class="content">
      <div id="fin-super-filters"></div>
      <div id="fin-super-report">${ui.skeleton(300)}</div>
    </div>`, 'Finance');
}

async function loadReportSuper() {
  const filterEl = document.getElementById('fin-super-filters');
  if (filterEl) {
    filterEl.innerHTML = ui.filterBar([
      { id: 'fl-super-from', label: 'From', type: 'date', onChange: "FinanceSection.fetchSuper()" },
      { id: 'fl-super-to', label: 'To', type: 'date', onChange: "FinanceSection.fetchSuper()" },
    ]);
  }
  await fetchSuper();
}

async function fetchSuper() {
  const el = document.getElementById('fin-super-report');
  if (!el) return;
  try {
    const data = await post('fin_get_super', tb({
      from: document.getElementById('fl-super-from')?.value || '',
      to: document.getElementById('fl-super-to')?.value || '',
    }));
    const employees = data.employees || [];
    el.innerHTML = `<div class="card">
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px">
        ${kpiCard('Total Super Payable', fmtAud(data.total_payable), '', 'var(--orange)')}
        ${kpiCard('Total Paid', fmtAud(data.total_paid), '', 'var(--green)')}
        ${kpiCard('Outstanding', fmtAud(data.outstanding), '', 'var(--red)')}
      </div>
      ${employees.length ? tableWrap(
        '<th>Employee</th><th>Super Fund</th><th style="text-align:right">Gross Pay</th><th style="text-align:right">Super (11.5%)</th><th>Status</th>',
        employees.map(e => `<tr>
          <td style="font-weight:600">${esc(e.name)}</td><td>${esc(e.super_fund || '-')}</td>
          <td style="text-align:right">${fmtAud(e.gross)}</td>
          <td style="text-align:right;font-weight:600">${fmtAud(e.super_amount)}</td>
          <td>${ui.badge(e.paid ? 'paid' : 'pending')}</td>
        </tr>`).join('')
      ) : ui.empty('', 'No superannuation data')}
    </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ════════════════════════════════════════
// ROUTE 26: REPORT-BRAND — Brand Comparison
// ════════════════════════════════════════
function renderReportBrand() {
  return SPG.shell(`
    ${SPG.toolbar('Brand Comparison', navBack('home', 'Dashboard'))}
    <div class="content">
      <div id="fin-brand-filters"></div>
      <div id="fin-brand-report">${ui.skeleton(300)}</div>
    </div>`, 'Finance');
}

async function loadReportBrand() {
  const filterEl = document.getElementById('fin-brand-filters');
  if (filterEl) {
    filterEl.innerHTML = ui.filterBar([
      { id: 'fl-brand-from', label: 'From', type: 'date', onChange: "FinanceSection.fetchBrand()" },
      { id: 'fl-brand-to', label: 'To', type: 'date', onChange: "FinanceSection.fetchBrand()" },
    ]);
  }
  await fetchBrand();
}

async function fetchBrand() {
  const el = document.getElementById('fin-brand-report');
  if (!el) return;
  try {
    const data = await post('fin_get_brand_comparison', tb({
      from: document.getElementById('fl-brand-from')?.value || '',
      to: document.getElementById('fl-brand-to')?.value || '',
    }));
    const brands = data.brands || [];
    el.innerHTML = `<div class="card">
      <div style="font-size:14px;font-weight:700;margin-bottom:12px">Brand / Store Comparison</div>
      ${brands.length ? tableWrap(
        '<th>Brand / Store</th><th style="text-align:right">Revenue</th><th style="text-align:right">COGS</th><th style="text-align:right">Gross Profit</th><th style="text-align:right">Expenses</th><th style="text-align:right">Net Profit</th><th style="text-align:right">Margin</th>',
        brands.map(b => {
          const margin = b.revenue ? ((b.net_profit / b.revenue) * 100).toFixed(1) : '0.0';
          return `<tr>
            <td style="font-weight:600">${esc(b.name)}</td>
            <td style="text-align:right">${fmtAud(b.revenue)}</td>
            <td style="text-align:right">${fmtAud(b.cogs)}</td>
            <td style="text-align:right">${fmtAud(b.gross_profit)}</td>
            <td style="text-align:right">${fmtAud(b.expenses)}</td>
            <td style="text-align:right;font-weight:600;color:${b.net_profit >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtAud(b.net_profit)}</td>
            <td style="text-align:right">${margin}%</td>
          </tr>`;
        }).join('') +
        (data.totals ? `<tr style="font-weight:700;border-top:2px solid var(--bd1)">
          <td>Total</td>
          <td style="text-align:right">${fmtAud(data.totals.revenue)}</td>
          <td style="text-align:right">${fmtAud(data.totals.cogs)}</td>
          <td style="text-align:right">${fmtAud(data.totals.gross_profit)}</td>
          <td style="text-align:right">${fmtAud(data.totals.expenses)}</td>
          <td style="text-align:right;color:${data.totals.net_profit >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtAud(data.totals.net_profit)}</td>
          <td style="text-align:right">${data.totals.revenue ? ((data.totals.net_profit / data.totals.revenue) * 100).toFixed(1) : '0.0'}%</td>
        </tr>` : '')
      ) : ui.empty('', 'No brand data')}
    </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}


// ════════════════════════════════════════
// ROUTE 27: SD-BRIDGE — Sale Daily Sync
// ════════════════════════════════════════
function renderSdBridge() {
  return SPG.shell(`
    ${SPG.toolbar('Sale Daily Bridge', checkPerm('edit') ? `<button class="btn btn-primary btn-sm" onclick="FinanceSection.syncSdData()">Sync Now</button>` : '')}
    <div class="content">
      <div id="fin-sd-kpis" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px"></div>
      <div id="fin-sd-list">${ui.skeleton(40, 8)}</div>
    </div>`, 'Finance');
}

async function loadSdBridge() {
  try {
    const data = await post('fin_get_sd_bridge', tb());
    const kpiEl = document.getElementById('fin-sd-kpis');
    if (kpiEl) {
      kpiEl.innerHTML = [
        kpiCard('Last Sync', fmtDateTime(data.last_sync), '', 'var(--t2)'),
        kpiCard('Synced Records', String(data.synced_count || 0), 'This month', 'var(--green)'),
        kpiCard('Pending', String(data.pending_count || 0), 'Awaiting sync', 'var(--orange)'),
      ].join('');
    }
    const el = document.getElementById('fin-sd-list');
    if (el) {
      const records = data.records || [];
      el.innerHTML = records.length ? tableWrap(
        '<th>Date</th><th>Store</th><th style="text-align:right">Sales</th><th style="text-align:right">COGS</th><th style="text-align:right">Gross Profit</th><th>Status</th>',
        records.map(r => `<tr>
          <td>${fmtDate(r.date)}</td><td>${esc(r.store_id)}</td>
          <td style="text-align:right">${fmtAud(r.sales)}</td>
          <td style="text-align:right">${fmtAud(r.cogs)}</td>
          <td style="text-align:right">${fmtAud(r.gross_profit)}</td>
          <td>${ui.badge(r.synced ? 'done' : 'pending', r.synced ? 'Synced' : 'Pending')}</td>
        </tr>`).join('')
      ) : ui.empty('', 'No Sale Daily records');
    }
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function syncSdData() {
  if (!confirm('Sync Sale Daily data into Finance? This may create new transactions.')) return;
  SPG.showLoader();
  try {
    const result = await post('fin_sync_sd_data', tb());
    SPG.toast(`Synced ${result.synced_count || 0} records`, 'success');
    loadSdBridge();
  } catch (e) { SPG.toast(e.message, 'error'); }
  finally { SPG.hideLoader(); }
}


// ════════════════════════════════════════
// ROUTE 28: SETTINGS
// ════════════════════════════════════════
function renderSettings() {
  return SPG.shell(`
    ${SPG.toolbar('Finance Settings', checkPerm('admin') ? `<button class="btn btn-primary btn-sm" id="btn-save-settings" onclick="FinanceSection.saveSettings()">Save Changes</button>` : '')}
    <div class="content"><div id="fin-settings">${ui.skeleton(300)}</div></div>`, 'Finance');
}

async function loadSettings() {
  try {
    const data = await post('fin_get_settings', tb());
    const el = document.getElementById('fin-settings');
    if (!el) return;
    const isAdmin = checkPerm('admin');
    el.innerHTML = `<div class="card max-w-lg">
      <div class="sec-title">General</div>
      <div class="fg"><label class="lb">Financial Year Start</label>
        <select class="inp" id="set-fy-start" ${!isAdmin ? 'disabled' : ''}>
          ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}"${m === (data.fy_start_month || 7) ? ' selected' : ''}>${new Date(2000, m - 1).toLocaleString('en-AU', { month: 'long' })}</option>`).join('')}
        </select>
      </div>
      <div class="fg"><label class="lb">Default GST Treatment</label>
        <select class="inp" id="set-gst-mode" ${!isAdmin ? 'disabled' : ''}>
          <option value="exclusive"${data.default_gst_mode === 'exclusive' ? ' selected' : ''}>GST Exclusive</option>
          <option value="inclusive"${data.default_gst_mode === 'inclusive' ? ' selected' : ''}>GST Inclusive</option>
        </select>
      </div>
      <div class="fg"><label class="lb">Default Payment Terms (days)</label>
        <input class="inp" type="number" id="set-terms" value="${data.default_payment_terms || 30}" ${!isAdmin ? 'disabled' : ''}>
      </div>
      <div class="sec-title" style="margin-top:16px">Payroll</div>
      <div class="fg"><label class="lb">Super Rate (%)</label>
        <input class="inp" type="number" step="0.1" id="set-super-rate" value="${data.super_rate || 11.5}" ${!isAdmin ? 'disabled' : ''}>
      </div>
      <div class="fg"><label class="lb">Default Pay Frequency</label>
        <select class="inp" id="set-pay-freq" ${!isAdmin ? 'disabled' : ''}>
          <option value="weekly"${data.pay_frequency === 'weekly' ? ' selected' : ''}>Weekly</option>
          <option value="fortnightly"${data.pay_frequency === 'fortnightly' ? ' selected' : ''}>Fortnightly</option>
          <option value="monthly"${data.pay_frequency === 'monthly' ? ' selected' : ''}>Monthly</option>
        </select>
      </div>
      <div class="sec-title" style="margin-top:16px">Integrations</div>
      <div class="fg"><label class="lb">SD Bridge Auto-Sync</label>
        <select class="inp" id="set-sd-auto" ${!isAdmin ? 'disabled' : ''}>
          <option value="off"${data.sd_auto_sync === 'off' ? ' selected' : ''}>Off</option>
          <option value="daily"${data.sd_auto_sync === 'daily' ? ' selected' : ''}>Daily</option>
          <option value="weekly"${data.sd_auto_sync === 'weekly' ? ' selected' : ''}>Weekly</option>
        </select>
      </div>
      <div class="sec-title" style="margin-top:16px">Permissions</div>
      <div style="font-size:12px;color:var(--t2);padding:8px;background:var(--bg2);border-radius:var(--rd)">
        Finance module permissions are managed through SPG HUB Admin &gt; Base Permissions.
        <br>Roles: <strong>view_only</strong> (read-only), <strong>edit</strong> (create/edit transactions), <strong>admin</strong> (full access + settings)
      </div>
    </div>`;
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function saveSettings() {
  SPG.showLoader();
  try {
    await post('fin_update_settings', tb({
      fy_start_month: Number(document.getElementById('set-fy-start')?.value) || 7,
      default_gst_mode: document.getElementById('set-gst-mode')?.value || 'exclusive',
      default_payment_terms: Number(document.getElementById('set-terms')?.value) || 30,
      super_rate: Number(document.getElementById('set-super-rate')?.value) || 11.5,
      pay_frequency: document.getElementById('set-pay-freq')?.value || 'fortnightly',
      sd_auto_sync: document.getElementById('set-sd-auto')?.value || 'off',
    }));
    SPG.toast('Settings saved', 'success');
  } catch (e) { SPG.toast(e.message, 'error'); }
  finally { SPG.hideLoader(); }
}


// ════════════════════════════════════════
// ROUTE 29: AUDIT — Audit Trail
// ════════════════════════════════════════
let _auditPage = 1;

function renderAudit() {
  return SPG.shell(`
    ${SPG.toolbar('Finance Audit Trail')}
    <div class="content">
      <div id="fin-audit-filters"></div>
      <div id="fin-audit-list">${ui.skeleton(40, 10)}</div>
    </div>`, 'Finance');
}

async function loadAudit() {
  const filterEl = document.getElementById('fin-audit-filters');
  if (filterEl) {
    filterEl.innerHTML = ui.filterBar([
      { id: 'fl-audit-search', label: 'Search', type: 'text', placeholder: 'Action, user, ref...', onChange: "FinanceSection.fetchAudit()" },
      { id: 'fl-audit-from', label: 'From', type: 'date', onChange: "FinanceSection.fetchAudit()" },
      { id: 'fl-audit-to', label: 'To', type: 'date', onChange: "FinanceSection.fetchAudit()" },
    ]);
  }
  await fetchAudit();
}

async function fetchAudit() {
  try {
    const data = await post('fin_get_audit_log', tb({
      search: document.getElementById('fl-audit-search')?.value || '',
      from: document.getElementById('fl-audit-from')?.value || '',
      to: document.getElementById('fl-audit-to')?.value || '',
    }));
    _auditLog = data.logs || [];
    renderAuditTable();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

function renderAuditTable() {
  const el = document.getElementById('fin-audit-list');
  if (!el) return;
  const pg = paginate(_auditLog, _auditPage, 30);
  el.innerHTML = tableWrap(
    '<th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th>',
    pg.items.map(l => `<tr>
      <td style="white-space:nowrap">${fmtDateTime(l.timestamp)}</td>
      <td>${esc(l.user_name || l.user_id)}</td>
      <td><span style="font-size:10px;padding:2px 6px;border-radius:3px;background:var(--bg3);font-weight:600">${esc(l.action)}</span></td>
      <td>${esc(l.entity_type || '-')} ${l.entity_id ? `<span style="font-size:10px;color:var(--t3)">${esc(l.entity_id)}</span>` : ''}</td>
      <td style="font-size:10px;color:var(--t3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(typeof l.details === 'object' ? JSON.stringify(l.details) : (l.details || ''))}</td>
    </tr>`).join('')
  ) + pagerHtml(pg.page, pg.pages, 'FinanceSection.auditPage');
}

function auditPage(p) { _auditPage = p; renderAuditTable(); }


// ════════════════════════════════════════
// SORT EVENT LISTENER
// ════════════════════════════════════════
document.addEventListener('spg-sort', (e) => {
  const tid = e.detail?.tableId;
  if (tid === 'txTbl') renderTxTable();
  else if (tid === 'conTbl') renderContactTable();
  else if (tid === 'empTbl') renderEmpTable();
});


// ════════════════════════════════════════
// SECTION REGISTRATION
// ════════════════════════════════════════
SPG.section('finance', {
  defaultRoute: 'home',
  routes: {
    // Core
    'home':               { render: renderHome,             onLoad: loadHome },
    'create-tx':          { render: renderCreateTx,         onLoad: loadCreateTx },
    'transactions':       { render: renderTransactions,     onLoad: loadTransactions },
    'tx-detail':          { render: renderTxDetail,         onLoad: loadTxDetail },
    // Payments
    'payments':           { render: renderPayments,         onLoad: loadPayments },
    'payment-detail':     { render: renderPaymentDetail,    onLoad: loadPaymentDetail },
    // Contacts
    'contacts':           { render: renderContacts,         onLoad: loadContacts },
    'contact-detail':     { render: renderContactDetail,    onLoad: loadContactDetail },
    // Review
    'review':             { render: renderReview,           onLoad: loadReview },
    // Chart of Accounts
    'accounts':           { render: renderAccounts,         onLoad: loadAccounts },
    'account-detail':     { render: renderAccountDetail,    onLoad: loadAccountDetail },
    'tax-codes':          { render: renderTaxCodes,         onLoad: loadTaxCodes },
    'bank-rules':         { render: renderBankRules,        onLoad: loadBankRules },
    // Payroll
    'payroll':            { render: renderPayroll,          onLoad: loadPayroll },
    'pay-run':            { render: renderPayRun,           onLoad: loadPayRun },
    'pay-run-detail':     { render: renderPayRunDetail,     onLoad: loadPayRunDetail },
    'employees':          { render: renderEmployees,        onLoad: loadEmployees },
    'employee-detail':    { render: renderEmployeeDetail,   onLoad: loadEmployeeDetail },
    // Reconciliation
    'reconcile':          { render: renderReconcile,        onLoad: loadReconcile },
    'reconcile-session':  { render: renderReconcileSession, onLoad: loadReconcileSession },
    // Reports
    'report-pnl':         { render: renderReportPnl,        onLoad: loadReportPnl },
    'report-cashflow':    { render: renderReportCashflow,    onLoad: loadReportCashflow },
    'report-aging':       { render: renderReportAging,       onLoad: loadReportAging },
    'report-assets':      { render: renderReportAssets,      onLoad: loadReportAssets },
    'report-super':       { render: renderReportSuper,       onLoad: loadReportSuper },
    'report-brand':       { render: renderReportBrand,       onLoad: loadReportBrand },
    // SD Bridge
    'sd-bridge':          { render: renderSdBridge,          onLoad: loadSdBridge },
    // Settings & Audit
    'settings':           { render: renderSettings,          onLoad: loadSettings,   minPerm: 'edit' },
    'audit':              { render: renderAudit,             onLoad: loadAudit,      minPerm: 'edit' },
  },
});


// ═══ Bill HQ Attachment Picker ═══
let _bhqAttached = []; // linked bill IDs for current tx

async function openBhqPicker() {
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.id = 'bhq-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9990;display:flex;align-items:flex-end;justify-content:center;';
  overlay.innerHTML = `<div style="background:#fff;border-radius:16px 16px 0 0;width:100%;max-width:480px;max-height:80vh;overflow:auto;padding:20px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
      <h3 style="font-size:16px;font-weight:600;">Attach HQ Bill</h3>
      <button style="background:none;border:none;font-size:20px;cursor:pointer;" onclick="document.getElementById('bhq-modal').remove()">✕</button>
    </div>
    <div id="bhq-picker-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">
      <div style="grid-column:1/-1;text-align:center;padding:24px;color:#999;">Loading bills...</div>
    </div>
  </div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);

  try {
    const res = await SPG.api.bhqGetBills({});
    const grid = document.getElementById('bhq-picker-grid');
    if (!res.bills || res.bills.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px;color:#999;">No unattached bills available</div>';
      return;
    }
    grid.innerHTML = res.bills.map(b => `
      <div style="cursor:pointer;border-radius:8px;overflow:hidden;border:2px solid ${_bhqAttached.includes(b.id) ? 'var(--acc)' : '#e5e7eb'};position:relative;" onclick="FinanceSection.selectBhqBill('${esc(b.id)}','${esc(b.photo_url)}','${esc(b.account_name)}')">
        <img src="${esc(b.photo_url)}" alt="Bill" style="width:100%;aspect-ratio:3/4;object-fit:cover;display:block;">
        <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,.6));color:#fff;padding:12px 6px 4px;font-size:10px;">
          <div>${esc(b.account_name)}</div>
          <div>${new Date(b.captured_at).toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'Australia/Sydney'})}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('bhq-picker-grid').innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:24px;color:#dc2626;">${e.message}</div>`;
  }
}

function selectBhqBill(billId, photoUrl, accountName) {
  if (!_bhqAttached.includes(billId)) {
    _bhqAttached.push(billId);
  }
  // Update attached display
  const el = document.getElementById('bhq-attached');
  if (el) {
    el.innerHTML = _bhqAttached.map((id, i) => `
      <div style="display:inline-flex;align-items:center;gap:6px;background:var(--acc2);padding:4px 10px;border-radius:20px;font-size:12px;margin:2px;">
        📎 Bill ${id}
        <button style="background:none;border:none;cursor:pointer;font-size:14px;color:#999;" onclick="FinanceSection.removeBhqBill(${i})">✕</button>
      </div>
    `).join('');
  }
  // Close modal
  const modal = document.getElementById('bhq-modal');
  if (modal) modal.remove();
  SPG.toast('Bill attached', 'success');
}

function removeBhqBill(index) {
  _bhqAttached.splice(index, 1);
  const el = document.getElementById('bhq-attached');
  if (el && _bhqAttached.length === 0) el.innerHTML = '';
  else selectBhqBill._refresh?.();
  // Re-render
  if (el) {
    el.innerHTML = _bhqAttached.map((id, i) => `
      <div style="display:inline-flex;align-items:center;gap:6px;background:var(--acc2);padding:4px 10px;border-radius:20px;font-size:12px;margin:2px;">
        📎 Bill ${id}
        <button style="background:none;border:none;cursor:pointer;font-size:14px;color:#999;" onclick="FinanceSection.removeBhqBill(${i})">✕</button>
      </div>
    `).join('');
  }
}

// ═══ PUBLIC API (for onclick handlers) ═══
window.FinanceSection = {
  // Create TX
  addLine, removeLine, updateLine, saveTx,
  // TX Detail
  approveTx, voidTx, editTx, showPayTxDialog, submitPayTx,
  // Transactions
  filterTx, txPage,
  // Payments
  fetchPayments, payPage, showNewPaymentDialog, submitNewPayment,
  // Contacts
  fetchContacts, conPage, showContactDialog, saveContact,
  _getContactDetail: () => _contactDetail,
  // Accounts
  renderAccountTree, showAccountDialog, saveAccount,
  // Tax Codes
  showTaxCodeDialog, saveTaxCode,
  // Bank Rules
  showBankRuleDialog, saveBankRule,
  // Payroll
  showEmployeeDialog, saveEmployee, fetchEmployees, empPage,
  toggleAllEmployees, payRunNext, payRunBack, submitPayRun,
  approvePayRun,
  // Reconcile
  startReconcileSession, toggleRecItem, matchSelected,
  showManualMatchDialog, submitManualMatch,
  showImportCsvDialog, importCsv,
  // Reports
  fetchPnl, fetchCashflow, fetchAging, fetchSuper, fetchBrand,
  // SD Bridge
  syncSdData,
  // Settings
  saveSettings,
  // Audit
  fetchAudit, auditPage,
  // Bill HQ
  openBhqPicker, selectBhqBill, removeBhqBill,
};

})();
