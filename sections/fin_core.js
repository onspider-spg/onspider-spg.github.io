/**
 * SPG HUB v1.0.0 | 22 MAR 2026 | Siam Palette Group
 * sections/fin_core.js — Finance Module (Core)
 * State, API wrapper, init, sidebar, permission, route registration
 *
 * Sub-files (loaded in order via defer):
 *   fin_transactions.js — Transaction screens (8 routes)
 *   fin_input.js        — Create screens (7 routes)
 *   fin_payment.js      — Payment screens (3 routes)
 *   fin_payroll.js      — Payroll screens (6 routes)
 *   fin_accounting.js   — Accounting screens (8 routes)
 *   fin_reconcile.js    — Reconciliation screens (3 routes)
 *   fin_review.js       — Review screens (3 routes)
 *   fin_reports.js      — Reports + Dashboard (9 routes)
 *   fin_contacts.js     — Contact screens (3 routes)
 *   fin_settings.js     — Settings screens (1 route)
 *
 * Architecture:
 *   - Uses SPG.section('finance', {...}) for route registration
 *   - Uses SPG.shell() + SPG.toolbar() for layout (matches Home exactly)
 *   - Uses SPG.api.post('finance', 'fin_action', ...) for API calls
 *   - Sidebar: text-only accordion, Modules group, matches Home design language
 *   - Accent: Purple #7c3aed (via THEME_COLORS in app.js)
 */

(() => {
const esc = SPG.esc;

// ═══════════════════════════════════════
// STATE (shared across all fin sub-files via window.FIN)
// ═══════════════════════════════════════
const S = {
  // Init
  initLoaded: false,
  _initLoading: false,
  _masterReady: false,
  _masterLoading: false,

  // Session context
  storeId: null,
  deptId: null,

  // Config from init_bundle
  session: null,
  brands: [],
  channels: [],
  bankAccounts: [],
  taxCodes: [],
  accountTypes: [],
  permissions: [],

  // Master data (phase 2 — background load)
  vendors: [],
  categories: [],
  vendorRules: [],

  // Transactions
  _bills: [],
  _billSummary: {},
  _billDetail: null,
  _tx_log: [],
  _tx_sale: [],
  _tx_return: [],
  _saleDetail: null,
  _sdPending: [],

  // Payment
  _pyBills: [],
  _pySelected: new Set(),
  _pyBankId: null,
  _pySaving: false,
  _pyDupConfirmed: false,
  _pyType: 'bills',
  _phRows: [],
  _phKpi: {},
  _remitRows: [],

  // Payroll
  _payRuns: [],
  _payRunKpi: {},
  _wizardPayRun: null,
  _wizardLines: [],
  _wizardSummary: {},
  _detailPayRun: null,
  _detailBrands: {},
  _employees: [],
  _empDetail: null,

  // Reconcile
  _stmtFile: null,
  _stmtParsed: [],
  _rcBankId: null,
  _rcFilter: 'all',
  _rcStmtLines: [],
  _rcMatches: [],
  _rcSummary: {},
  _cashData: {},

  // Accounting
  _coaRows: [],
  _coaFilter: 'all',
  _taxRows: [],
  _brRows: [],
  _hubAccounts: [],
  _loanData: null,
  _journalEntries: [],

  // Review
  _rvKpi: {},
  _pendingRows: [],
  _recurringRows: [],
  _expectedRows: [],

  // Reports
  _dashData: null,
  _pnlData: null,
  _bsData: null,
  _cfData: null,
  _aparData: null,
  _assetData: null,
  _brandData: null,
  _budgetData: null,

  // Contacts
  _contacts: [],
  _contactDetail: null,

  // Settings
  _bridgeSettings: [],

  // Prefill / carry-over state
  _prefillPayment: null,
  _recurringFromBill: null,
  _duplicateBill: null,

  // Sort states for tables (SPG.ui.sortTh)
  sortStates: {},

  // Filters (per-screen)
  filters: {},
};


// ═══════════════════════════════════════
// API WRAPPER
// ═══════════════════════════════════════
function api(action, data = {}) {
  const act = action.startsWith('fin_') ? action : 'fin_' + action;
  return SPG.api.post('finance', act, SPG.api.tb(data));
}

/** Raw API call (for actions not following fin_ prefix) */
function apiCall(action, data = {}) {
  return SPG.api.post('finance', action, SPG.api.tb(data));
}


// ═══════════════════════════════════════
// TIMEZONE HELPERS (Australia/Sydney)
// ═══════════════════════════════════════
const TZ = 'Australia/Sydney';

function sydneyNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
}

function sydneyToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

function fmtAud(val) {
  const n = Number(val) || 0;
  return '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtAudK(val) {
  const n = Number(val) || 0;
  if (Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(1) + 'k';
  return fmtAud(n);
}

function fmtDate(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('en-AU', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return d; }
}

function fmtDateShort(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('en-AU', { timeZone: TZ, day: '2-digit', month: 'short' });
  } catch { return d; }
}

function fmtDateTime(d) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleString('en-AU', { timeZone: TZ, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
}

function calcGst(amount, inclusive) {
  const amt = Number(amount) || 0;
  if (inclusive) return amt - (amt / 1.10);
  return amt * 0.10;
}

function calcTotal(lines, inclusive) {
  let subtotal = 0, totalGst = 0;
  (lines || []).forEach(l => {
    const amt = Number(l.amount) || 0;
    const hasTax = l.tax_code && l.tax_code !== 'NONE' && l.tax_code !== 'BAS Excluded';
    if (hasTax) {
      if (inclusive) {
        const gst = amt - (amt / 1.10);
        totalGst += gst;
        subtotal += amt - gst;
      } else {
        totalGst += amt * 0.10;
        subtotal += amt;
      }
    } else {
      subtotal += amt;
    }
  });
  return { subtotal, gst: totalGst, total: subtotal + totalGst };
}


// ═══════════════════════════════════════
// INIT (2-phase like api_fin.js)
// ═══════════════════════════════════════
async function initModule() {
  if (S.initLoaded) return;
  if (S._initLoading) return;
  S._initLoading = true;

  try {
    // Phase 1: Quick init — session + small data
    const data = await api('init_bundle');

    S.session = data.session;
    S.brands = data.brands || [];
    S.channels = data.channels || [];
    S.bankAccounts = data.bankAccounts || [];
    S.taxCodes = data.taxCodes || [];
    S.accountTypes = data.accountTypes || [];
    S.permissions = data.permissions || [];

    // Session context
    const ses = SPG.api.getSession();
    S.storeId = ses?.store_id;
    S.deptId = ses?.dept_id;

    S.initLoaded = true;

    // Phase 2: Background — vendors, categories (no await)
    loadMaster();
  } catch (e) {
    SPG.toast(e.message || 'โหลดข้อมูล Finance ไม่สำเร็จ', 'error');
  } finally {
    S._initLoading = false;
  }
}

async function loadMaster() {
  if (S._masterReady || S._masterLoading) return;
  S._masterLoading = true;
  try {
    const data = await api('init_master');
    S.vendors = data.vendors || [];
    S.categories = data.categories || [];
    S.vendorRules = data.vendorRules || [];
    S._masterReady = true;
  } catch (e) {
    console.warn('FIN loadMaster failed:', e.message);
  } finally {
    S._masterLoading = false;
  }
}

async function waitMaster() {
  if (S._masterReady) return;
  return new Promise(resolve => {
    let tries = 0;
    const check = () => {
      if (S._masterReady || tries > 100) { resolve(); return; }
      tries++;
      setTimeout(check, 50);
    };
    check();
  });
}


// ═══════════════════════════════════════
// PERMISSION HELPERS
// ═══════════════════════════════════════
function hasPerm(fnId) {
  const s = SPG.api.getSession();
  if (!s) return false;
  const pl = s.position_id ? (s.position_level || 99) : parseInt((s.tier_id || 'T9').replace('T', ''));
  if (pl <= 2) return true; // Owner/GM = super_admin
  return S.permissions.includes(fnId);
}


// ═══════════════════════════════════════
// LOOKUP HELPERS
// ═══════════════════════════════════════
function getBrandName(id) {
  if (!id) return '';
  const b = S.brands.find(b => b.brand_id === id || b.store_id === id);
  return b ? (b.brand_name || b.store_name || id) : id;
}

function getVendorName(id) {
  if (!id) return '';
  const v = S.vendors.find(v => v.id === id);
  return v ? (v.name || id) : id;
}

function getBankName(id) {
  if (!id) return '';
  const b = S.bankAccounts.find(b => b.id === id);
  return b ? (b.name || id) : id;
}

function brandOpts(selected) {
  return S.brands.map(b =>
    `<option value="${esc(b.brand_id || b.store_id)}"${(b.brand_id || b.store_id) === selected ? ' selected' : ''}>${esc(b.brand_name || b.store_name)}</option>`
  ).join('');
}

function bankOpts(selected) {
  return S.bankAccounts.map(b =>
    `<option value="${esc(b.id)}"${b.id === selected ? ' selected' : ''}>${esc(b.name)}</option>`
  ).join('');
}

function vendorOpts(selected) {
  return S.vendors.map(v =>
    `<option value="${esc(v.id)}"${v.id === selected ? ' selected' : ''}>${esc(v.name)}</option>`
  ).join('');
}

function categoryOpts(selected, txType) {
  const filtered = txType ? S.categories.filter(c => c.tx_type === txType || !c.tx_type) : S.categories;
  const groups = {};
  filtered.forEach(c => {
    const g = c.main_category || 'Other';
    if (!groups[g]) groups[g] = [];
    groups[g].push(c);
  });
  let html = '<option value="">Select category...</option>';
  Object.keys(groups).sort().forEach(g => {
    html += `<optgroup label="${esc(g)}">`;
    groups[g].forEach(c => {
      html += `<option value="${esc(c.id)}"${c.id === selected ? ' selected' : ''}>${esc(c.name)}</option>`;
    });
    html += '</optgroup>';
  });
  return html;
}

function taxCodeOpts(selected) {
  return S.taxCodes.map(t =>
    `<option value="${esc(t.code)}"${t.code === selected ? ' selected' : ''}>${esc(t.code)} (${t.rate}%)</option>`
  ).join('');
}


// ═══════════════════════════════════════
// SIDEBAR (matches Home/Bakery exactly — text-only, accordion)
// ═══════════════════════════════════════
function buildFinanceSidebar() {
  const sd = document.querySelector('.sidebar');
  if (!sd) return;

  const s = SPG.api.getSession();
  if (!s) return;

  const cur = SPG.currentRoute;
  let html = '';

  // ── Dashboard ──
  html += sdItem('dashboard', 'Dashboard', cur);
  html += '<div class="sd-divider"></div>';

  // ── Create ──
  if (hasPerm('fin.tx.create')) {
    let items = '';
    items += sdSub('cr-sale', 'Sale Entry', cur);
    items += sdSub('cr-bill', 'Bill / Expense', cur);
    items += sdSub('cr-transfer', 'Transfer', cur);
    items += sdSub('cr-debit', 'Debit Note', cur);
    if (hasPerm('fin.recurring.manage')) items += sdSub('cr-recurring', 'Recurring Rule', cur);
    items += sdSub('cr-upload', 'Upload Bill', cur);
    html += sdAccordion('create', 'Create', items);
  }

  // ── Transactions ──
  {
    let items = '';
    items += sdSub('tx-log', 'Transaction Log', cur);
    items += sdSub('tx-bill', 'Bills', cur);
    items += sdSub('tx-sale', 'Sales', cur);
    if (hasPerm('fin.bridge.sd')) items += sdSub('tx-sd', 'SD Bridge', cur);
    items += sdSub('tx-return', 'Returns / Debit', cur);
    items += sdSub('tx-find', 'Find', cur);
    html += sdAccordion('tx', 'Transactions', items);
  }

  // ── Reconciliation ──
  if (hasPerm('fin.recon.view')) {
    let items = '';
    items += sdSub('rc-bank', 'Bank Reconcile', cur);
    items += sdSub('rc-cash', 'Cash Collection', cur);
    if (hasPerm('fin.recon.match')) items += sdSub('rc-stmt', 'Upload Statement', cur);
    html += sdAccordion('rc', 'Reconciliation', items);
  }

  // ── Payment ──
  {
    let items = '';
    if (hasPerm('fin.pay.record')) items += sdSub('py-record', 'Record Payment', cur);
    items += sdSub('py-history', 'Payment History', cur);
    if (hasPerm('fin.pay.remittance')) items += sdSub('py-remit', 'Remittance', cur);
    if (items) html += sdAccordion('py', 'Payment', items);
  }

  // ── Payroll ──
  if (hasPerm('fin.payroll.view')) {
    let items = '';
    items += sdSub('pr-runs', 'Pay Runs', cur);
    if (hasPerm('fin.payroll.employees')) items += sdSub('pr-emp', 'Employees', cur);
    items += sdSub('pr-super', 'Superannuation', cur);
    html += sdAccordion('pr', 'Payroll', items);
  }

  // ── Accounting ──
  {
    let items = '';
    items += sdSub('ac-coa', 'Chart of Accounts', cur);
    if (hasPerm('fin.tax.manage')) items += sdSub('ac-tax', 'Tax Codes', cur);
    if (hasPerm('fin.bankrule.manage')) items += sdSub('ac-rules', 'Bank Rules', cur);
    if (hasPerm('fin.recon.view')) items += sdSub('ac-hub', 'Banking Hub', cur);
    if (hasPerm('fin.loan.manage')) items += sdSub('ac-loan', 'Loans & Equity', cur);
    if (hasPerm('fin.journal.create')) items += sdSub('ac-journal', 'General Journal', cur);
    html += sdAccordion('ac', 'Accounting', items);
  }

  // ── Review Monitor ──
  if (hasPerm('fin.tx.approve')) {
    let items = '';
    items += sdSub('rv-pending', 'Pending Tracker', cur);
    if (hasPerm('fin.recurring.manage')) items += sdSub('rv-recurring', 'Recurring Setup', cur);
    items += sdSub('rv-expected', 'Expected Invoices', cur);
    html += sdAccordion('rv', 'Review Monitor', items);
  }

  // ── Reports ──
  {
    let items = '';
    if (hasPerm('fin.report.pnl')) items += sdSub('rp-pnl', 'Profit & Loss', cur);
    if (hasPerm('fin.report.pnl')) items += sdSub('rp-bs', 'Balance Sheet', cur);
    if (hasPerm('fin.report.cashflow')) items += sdSub('rp-cf', 'Cash Flow', cur);
    items += sdSub('rp-apar', 'AP / AR Aging', cur);
    if (hasPerm('fin.report.assets')) items += sdSub('rp-asset', 'Fixed Assets', cur);
    if (hasPerm('fin.report.brand')) items += sdSub('rp-brand', 'Brand Compare', cur);
    if (hasPerm('fin.budget.view')) items += sdSub('rp-budget', 'Budget vs Actual', cur);
    if (items) html += sdAccordion('rp', 'Reports', items);
  }

  // ── Contacts ──
  html += '<div class="sd-divider"></div>';
  html += sdItem('contacts', 'Contacts', cur);

  // ── Settings ──
  if (hasPerm('fin.settings')) {
    html += sdItem('settings', 'Settings', cur);
  }

  // ── Other Modules (NOT Finance) ──
  html += '<div class="sd-divider"></div>';
  const modules = SPG.state.modules;
  if (modules) {
    let modItems = '';
    const MODULE_DEFS = [
      { id: 'sales', label: 'Sales Daily', key: 'saledaily_report' },
      { id: 'bakery', label: 'Bakery', key: 'bakery_order' },
      { id: 'hr', label: 'HR', key: 'hr' },
      { id: 'purchase', label: 'Purchase', key: 'purchase' },
    ];
    const MODULE_MAP = { 'saledaily_report': 'sales', 'bakery_order': 'bakery', 'hr': 'hr', 'purchase': 'purchase' };

    MODULE_DEFS.forEach(def => {
      const mod = modules.find(m => MODULE_MAP[m.module_id] === def.id);
      if (mod && !mod.is_accessible) return;
      const isActive = mod && mod.status === 'active';
      if (isActive) {
        modItems += `<div class="sd-sub-item" onclick="SPG.go('${def.id}/dashboard')">${def.label}</div>`;
      } else if (mod) {
        modItems += `<div class="sd-sub-item" style="opacity:.35;cursor:default">${def.label}</div>`;
      }
    });
    if (modItems) html += sdAccordion('modules', 'Modules', modItems);
  }

  // ── Footer ──
  html += `<div class="sd-footer">
    <div class="sd-version">FIN v1.0</div>
    <a href="#" onclick="SPG.go('dashboard');return false">← Home</a>
    <a href="#" class="danger" onclick="SPG.doLogout();return false">Log out</a>
  </div>`;

  sd.innerHTML = html;
  if (SPG.state.sidebarCollapsed) sd.classList.add('closed');

  // Auto-expand current accordion
  sd.querySelectorAll('.sd-group').forEach(sg => {
    if (sg.querySelector('.sd-sub-item.active')) sg.classList.add('open');
  });
}

// Sidebar helpers (same pattern as bc_core.js)
function sdItem(route, label, cur) {
  const active = cur === route ? ' active' : '';
  return `<div class="sd-item${active}" onclick="SPG.go('finance/${route}')">${esc(label)}</div>`;
}

function sdAccordion(id, label, items) {
  return `<div class="sd-group" data-group="${id}">
    <div class="sd-group-head" onclick="this.parentElement.classList.toggle('open')">${esc(label)}<span class="sd-group-arr">›</span></div>
    <div class="sd-sub">${items}</div>
  </div>`;
}

function sdSub(route, label, cur) {
  const active = cur === route ? ' active' : '';
  return `<div class="sd-sub-item${active}" onclick="SPG.go('finance/${route}')">${esc(label)}</div>`;
}


// ═══════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}


// ═══════════════════════════════════════
// ROUTE REGISTRATION
// ═══════════════════════════════════════
SPG.section('finance', {
  defaultRoute: 'dashboard',
  buildSidebar: buildFinanceSidebar,
  routes: {
    // ── Dashboard (fin_reports.js) ──
    'dashboard':      { render: (p) => FIN.renderDashboard(p),      onLoad: (p) => FIN.loadDashboard(p) },

    // ── Transactions (fin_transactions.js) ──
    'tx-log':         { render: (p) => FIN.renderTxLog(p),          onLoad: (p) => FIN.loadTxLog(p) },
    'tx-bill':        { render: (p) => FIN.renderTxBill(p),         onLoad: (p) => FIN.loadTxBill(p) },
    'tx-bill-detail': { render: (p) => FIN.renderTxBillDetail(p),   onLoad: (p) => FIN.loadTxBillDetail(p) },
    'tx-sale':        { render: (p) => FIN.renderTxSale(p),         onLoad: (p) => FIN.loadTxSale(p) },
    'tx-sale-detail': { render: (p) => FIN.renderTxSaleDetail(p),   onLoad: (p) => FIN.loadTxSaleDetail(p) },
    'tx-sd':          { render: (p) => FIN.renderTxSd(p),           onLoad: (p) => FIN.loadTxSd(p) },
    'tx-return':      { render: (p) => FIN.renderTxReturn(p),       onLoad: (p) => FIN.loadTxReturn(p) },
    'tx-find':        { render: (p) => FIN.renderTxFind(p),         onLoad: (p) => FIN.loadTxFind(p) },

    // ── Create (fin_input.js) ──
    'cr-sale':        { render: (p) => FIN.renderCrSale(p),         onLoad: (p) => FIN.loadCrSale(p) },
    'cr-bill':        { render: (p) => FIN.renderCrBill(p),         onLoad: (p) => FIN.loadCrBill(p) },
    'cr-transfer':    { render: (p) => FIN.renderCrTransfer(p),     onLoad: (p) => FIN.loadCrTransfer(p) },
    'cr-debit':       { render: (p) => FIN.renderCrDebit(p),        onLoad: (p) => FIN.loadCrDebit(p) },
    'cr-recurring':   { render: (p) => FIN.renderCrRecurring(p),    onLoad: (p) => FIN.loadCrRecurring(p) },
    'cr-upload':      { render: (p) => FIN.renderCrUpload(p),       onLoad: (p) => FIN.loadCrUpload(p) },

    // ── Payment (fin_payment.js) ──
    'py-record':      { render: (p) => FIN.renderPyRecord(p),       onLoad: (p) => FIN.loadPyRecord(p) },
    'py-history':     { render: (p) => FIN.renderPyHistory(p),      onLoad: (p) => FIN.loadPyHistory(p) },
    'py-remit':       { render: (p) => FIN.renderPyRemit(p),        onLoad: (p) => FIN.loadPyRemit(p) },

    // ── Payroll (fin_payroll.js) ──
    'pr-runs':        { render: (p) => FIN.renderPrRuns(p),         onLoad: (p) => FIN.loadPrRuns(p) },
    'pr-create':      { render: (p) => FIN.renderPrCreate(p),       onLoad: (p) => FIN.loadPrCreate(p) },
    'pr-detail':      { render: (p) => FIN.renderPrDetail(p),       onLoad: (p) => FIN.loadPrDetail(p) },
    'pr-emp':         { render: (p) => FIN.renderPrEmp(p),          onLoad: (p) => FIN.loadPrEmp(p) },
    'pr-emp-detail':  { render: (p) => FIN.renderPrEmpDetail(p),    onLoad: (p) => FIN.loadPrEmpDetail(p) },
    'pr-super':       { render: (p) => FIN.renderPrSuper(p),        onLoad: (p) => FIN.loadPrSuper(p) },

    // ── Accounting (fin_accounting.js) ──
    'ac-coa':         { render: (p) => FIN.renderAcCoa(p),          onLoad: (p) => FIN.loadAcCoa(p) },
    'ac-coa-edit':    { render: (p) => FIN.renderAcCoaEdit(p),      onLoad: (p) => FIN.loadAcCoaEdit(p) },
    'ac-tax':         { render: (p) => FIN.renderAcTax(p),          onLoad: (p) => FIN.loadAcTax(p) },
    'ac-rules':       { render: (p) => FIN.renderAcRules(p),        onLoad: (p) => FIN.loadAcRules(p) },
    'ac-hub':         { render: (p) => FIN.renderAcHub(p),          onLoad: (p) => FIN.loadAcHub(p) },
    'ac-map':         { render: (p) => FIN.renderAcMap(p),          onLoad: (p) => FIN.loadAcMap(p) },
    'ac-loan':        { render: (p) => FIN.renderAcLoan(p),         onLoad: (p) => FIN.loadAcLoan(p) },
    'ac-journal':     { render: (p) => FIN.renderAcJournal(p),      onLoad: (p) => FIN.loadAcJournal(p) },

    // ── Reconcile (fin_reconcile.js) ──
    'rc-bank':        { render: (p) => FIN.renderRcBank(p),         onLoad: (p) => FIN.loadRcBank(p) },
    'rc-cash':        { render: (p) => FIN.renderRcCash(p),         onLoad: (p) => FIN.loadRcCash(p) },
    'rc-stmt':        { render: (p) => FIN.renderRcStmt(p),         onLoad: (p) => FIN.loadRcStmt(p) },

    // ── Review (fin_review.js) ──
    'rv-pending':     { render: (p) => FIN.renderRvPending(p),      onLoad: (p) => FIN.loadRvPending(p) },
    'rv-recurring':   { render: (p) => FIN.renderRvRecurring(p),    onLoad: (p) => FIN.loadRvRecurring(p) },
    'rv-expected':    { render: (p) => FIN.renderRvExpected(p),     onLoad: (p) => FIN.loadRvExpected(p) },

    // ── Reports (fin_reports.js) ──
    'rp-pnl':         { render: (p) => FIN.renderRpPnl(p),          onLoad: (p) => FIN.loadRpPnl(p) },
    'rp-bs':          { render: (p) => FIN.renderRpBs(p),           onLoad: (p) => FIN.loadRpBs(p) },
    'rp-cf':          { render: (p) => FIN.renderRpCf(p),           onLoad: (p) => FIN.loadRpCf(p) },
    'rp-apar':        { render: (p) => FIN.renderRpApar(p),         onLoad: (p) => FIN.loadRpApar(p) },
    'rp-asset':       { render: (p) => FIN.renderRpAsset(p),        onLoad: (p) => FIN.loadRpAsset(p) },
    'rp-brand':       { render: (p) => FIN.renderRpBrand(p),        onLoad: (p) => FIN.loadRpBrand(p) },
    'rp-budget':      { render: (p) => FIN.renderRpBudget(p),       onLoad: (p) => FIN.loadRpBudget(p) },

    // ── Contacts (fin_contacts.js) ──
    'contacts':       { render: (p) => FIN.renderContacts(p),       onLoad: (p) => FIN.loadContacts(p) },
    'ct-detail':      { render: (p) => FIN.renderCtDetail(p),       onLoad: (p) => FIN.loadCtDetail(p) },
    'ct-create':      { render: (p) => FIN.renderCtCreate(p),       onLoad: (p) => FIN.loadCtCreate(p) },

    // ── Settings (fin_settings.js) ──
    'settings':       { render: (p) => FIN.renderSettings(p),       onLoad: (p) => FIN.loadSettings(p) },
  },
});


// ═══════════════════════════════════════
// PUBLIC API (shared with sub-files via window.FIN)
// ═══════════════════════════════════════
window.FIN = {
  // State
  S,

  // API
  api,
  apiCall,

  // Init
  initModule,
  loadMaster,
  waitMaster,
  buildSidebar: buildFinanceSidebar,

  // Permissions
  hasPerm,

  // Timezone & Formatting
  sydneyNow, sydneyToday,
  fmtAud, fmtAudK, fmtDate, fmtDateShort, fmtDateTime,
  calcGst, calcTotal,

  // Lookups
  getBrandName, getVendorName, getBankName,
  brandOpts, bankOpts, vendorOpts, categoryOpts, taxCodeOpts,

  // Utils
  esc, debounce,

  // Route render/load placeholders — filled by sub-files
  // (fin_transactions.js, fin_input.js, fin_payment.js, etc.)
};


// ═══════════════════════════════════════
// ONCLICK HANDLERS (filled by sub-files)
// ═══════════════════════════════════════
window.FinanceSection = {
  // Will be extended by Object.assign() in each sub-file
};

})();
