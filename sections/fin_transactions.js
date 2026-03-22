/**
 * SPG HUB v1.0.0 | 22 MAR 2026 | Siam Palette Group
 * sections/fin_transactions.js — Finance Module (Transaction Screens)
 * 8 routes: tx-log, tx-sale, tx-bill, tx-return,
 *           tx-bill-detail, tx-sale-detail, tx-sd, tx-find
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

// ═══════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════
function dateRange() {
  const todayStr = FIN.sydneyToday();
  const f = new Date(todayStr + 'T00:00:00');
  f.setDate(f.getDate() - 30);
  const fromStr = f.getFullYear() + '-' + String(f.getMonth() + 1).padStart(2, '0') + '-' + String(f.getDate()).padStart(2, '0');
  return { from: fromStr, to: todayStr };
}

function reconBadge(v) {
  if (!v) return '';
  const c = { 'Match': 'var(--green)', 'Group Match': 'var(--blue)', 'Unmatch': 'var(--red)' };
  return `<span style="font-size:var(--fs-xs);color:${c[v] || 'var(--t3)'};font-weight:600">${esc(v)}</span>`;
}

const TW = 'max-width:1000px;margin:0 auto';

/** Supplier filter <option> list - from S.vendors */
function _supplierFilterOpts() {
  const vendors = S.vendors || [];
  return '<option value="">All Suppliers</option>' + vendors.map(v => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join('');
}

/** Channel filter <option> list - from S.channels */
function _channelFilterOpts() {
  const channels = S.channels || [];
  return '<option value="">All Channels</option>' + channels.map(c => `<option>${esc(c)}</option>`).join('');
}

/** Brand filter options with "All Brands" default */
function _brandFilterOpts() {
  return '<option value="">All Brands</option>' + FIN.brandOpts('');
}


// ═══════════════════════════════════════
// 1. TRANSACTION LOG
// ═══════════════════════════════════════

/** Render log table rows from data array */
function _logRows(rows) {
  if (!rows || rows.length === 0) {
    return '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--t3)">No transactions found</td></tr>';
  }
  return rows.map(r => `<tr><td>${fd(r.date)}</td><td><a class="lk" onclick="FinanceSection.goBillDetail('${esc(r.bill_id || r.id || '')}')">${esc(r.ref)}</a></td><td>${esc(r.type)}</td><td>${esc(r.desc)}</td><td>${esc(r.brand)}</td><td>${esc(r.contact)}</td><td style="text-align:right">${fm(r.amount)}</td><td>${reconBadge(r.recon)}</td></tr>`).join('');
}

function renderTxLog() {
  const dr = dateRange();
  const mem = S._tx_log;
  const hasMem = mem && mem.length > 0;
  const rows = hasMem ? _logRows(mem) : ui.skeleton(60, 1);

  const actions = `<button class="btn-primary" onclick="SPG.go('finance/rc-bank')">Reconcile</button>`;

  return SPG.shell(SPG.toolbar('Transaction Log', actions) + `<div class="content" id="fin-tx-log"><div style="${TW}"><div class="card"><div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:6px"><div><div class="fl-label">Type</div><select class="fl" id="log_type" onchange="FinanceSection.filterLog()" style="width:100px"><option value="">All</option><option value="Income">Income</option><option value="Expense">Expense</option><option value="Transfer">Transfer</option></select></div><div><div class="fl-label">Brand</div><select class="fl" id="log_brand" onchange="FinanceSection.filterLog()" style="width:120px">${_brandFilterOpts()}</select></div><div><div class="fl-label">Status</div><select class="fl" id="log_status" onchange="FinanceSection.filterLog()" style="width:80px"><option value="">All</option><option value="Paid">Paid</option><option value="Unpaid">Unpaid</option></select></div><div><div class="fl-label">Date from</div><input class="fl" id="log_from" type="date" value="${dr.from}" onchange="FinanceSection.filterLog()" style="width:130px"></div><div><div class="fl-label">Date to</div><input class="fl" id="log_to" type="date" value="${dr.to}" onchange="FinanceSection.filterLog()" style="width:130px"></div><div><div class="fl-label">Search</div><input class="fl" id="log_search" placeholder="" oninput="FinanceSection.filterLog()" style="width:100px"></div><div style="flex:1"></div><button class="btn-outline" style="color:var(--acc)" onclick="FinanceSection.resetLog()">Reset</button></div></div><div class="card" style="padding:0"><div class="tbl-wrap"><table class="tbl" id="tbl_log"><thead><tr>${ui.sortTh('tbl_log', 'date', 'Date')}${ui.sortTh('tbl_log', 'ref', 'Ref no')}${ui.sortTh('tbl_log', 'type', 'Type')}${ui.sortTh('tbl_log', 'desc', 'Description')}${ui.sortTh('tbl_log', 'brand', 'Brand')}${ui.sortTh('tbl_log', 'contact', 'Contact')}${ui.sortTh('tbl_log', 'amount', 'Amount ($)')}${ui.sortTh('tbl_log', 'recon', 'Reconcile')}</tr></thead><tbody id="log_tbody">${rows}</tbody></table></div></div><div id="txlog_lm" style="text-align:center;padding:10px;display:none"><button class="btn-outline" style="font-size:var(--fs-sm)" onclick="FinanceSection.loadMoreLog()">Load more</button></div></div></div>`, 'Finance');
}

async function loadTxLog() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadLog();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

let _logPage = 1;
async function _loadLog(filters) {
  const f = filters || { type: 'all', page: 1 };
  if (!f.type) f.type = 'all';
  if (!f.page) f.page = 1;
  _logPage = f.page;
  try {
    const result = await FIN.api('get_transactions', f);
    const tbody = document.getElementById('log_tbody');
    const lmEl = document.getElementById('txlog_lm');
    if (tbody) tbody.innerHTML = _logRows(result.rows);
    if (lmEl) lmEl.style.display = result.hasMore ? 'block' : 'none';
  } catch (e) {
    const tbody = document.getElementById('log_tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--red)">Error: ${esc(e.message)}</td></tr>`;
  }
}

async function _loadMoreLog() {
  _logPage++;
  const f = { type: 'all', page: _logPage };
  const type = document.getElementById('log_type')?.value;
  const brand = document.getElementById('log_brand')?.value;
  const from = document.getElementById('log_from')?.value;
  const to = document.getElementById('log_to')?.value;
  const search = document.getElementById('log_search')?.value?.trim();
  if (type) f.sub_type = type;
  if (brand) f.brand = brand;
  if (from) f.date_from = from;
  if (to) f.date_to = to;
  if (search) f.search = search;
  try {
    const result = await FIN.api('get_transactions', f);
    const tbody = document.getElementById('log_tbody');
    const lmEl = document.getElementById('txlog_lm');
    if (tbody) tbody.innerHTML += _logRows(result.rows);
    if (lmEl && !result.hasMore) lmEl.style.display = 'none';
  } catch (e) {
    SPG.toast('Load more failed: ' + e.message, 'error');
  }
}

function _filterLog() {
  const f = { type: 'all', page: 1 };
  const type = document.getElementById('log_type')?.value;
  const brand = document.getElementById('log_brand')?.value;
  const status = document.getElementById('log_status')?.value;
  const from = document.getElementById('log_from')?.value;
  const to = document.getElementById('log_to')?.value;
  const search = document.getElementById('log_search')?.value?.trim();
  if (type) f.sub_type = type;
  if (brand) f.brand = brand;
  if (status) f.status = status;
  if (from) f.date_from = from;
  if (to) f.date_to = to;
  if (search) f.search = search;
  _loadLog(f);
}

function _resetLog() {
  const dr = dateRange();
  const el = (id) => document.getElementById(id);
  if (el('log_type')) el('log_type').value = '';
  if (el('log_brand')) el('log_brand').value = '';
  if (el('log_status')) el('log_status').value = '';
  if (el('log_from')) el('log_from').value = dr.from;
  if (el('log_to')) el('log_to').value = dr.to;
  if (el('log_search')) el('log_search').value = '';
  _loadLog();
}


// ═══════════════════════════════════════
// 2. SALES
// ═══════════════════════════════════════

function _saleRows(rows) {
  if (!rows || rows.length === 0) {
    return '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--t3)">No sales found</td></tr>';
  }
  return rows.map(r => {
    const saleId = r.id || '';
    return `<tr onclick="FinanceSection.openSaleDetail('${esc(saleId)}')" style="cursor:pointer"><td>${fd(r.date)}</td><td>${esc(r.brand)}</td><td>${esc(r.channel || r.desc || '')}</td><td style="text-align:right;color:var(--green)">+${fm(r.amount)}</td><td style="text-align:right">${fm(r.gst || 0)}</td><td>${ui.badge(r.status)}</td></tr>`;
  }).join('');
}

function renderTxSale() {
  const dr = dateRange();
  const mem = S._tx_sale;
  const hasMem = mem && mem.length > 0;
  const rows = hasMem ? _saleRows(mem) : ui.skeleton(60, 1);
  const total = hasMem ? mem.reduce((s, r) => s + (Number(r.amount) || 0), 0) : 0;

  const actions = `<button class="btn-primary" onclick="SPG.go('finance/cr-sale')">+ Record Sale</button>`;

  return SPG.shell(SPG.toolbar('Sales', actions) + `<div class="content" id="fin-tx-sale"><div style="${TW}"><div class="card"><div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:6px"><div><div class="fl-label">Brand</div><select class="fl" id="sale_brand" onchange="FinanceSection.filterSales()" style="width:120px">${_brandFilterOpts()}</select></div><div><div class="fl-label">Channel</div><select class="fl" id="sale_channel" onchange="FinanceSection.filterSales()" style="width:100px">${_channelFilterOpts()}</select></div><div><div class="fl-label">Date from</div><input class="fl" id="sale_from" type="date" value="${dr.from}" onchange="FinanceSection.filterSales()" style="width:130px"></div><div><div class="fl-label">Date to</div><input class="fl" id="sale_to" type="date" value="${dr.to}" onchange="FinanceSection.filterSales()" style="width:130px"></div><div style="flex:1"></div><button class="btn-outline" style="color:var(--acc)" onclick="FinanceSection.resetSales()">Reset</button></div><div id="sale_total" style="text-align:right;font-size:var(--fs-sm);color:var(--t2)">Total Revenue <b style="color:var(--green)">${fm(total)}</b></div></div><div class="card" style="padding:0"><div class="tbl-wrap"><table class="tbl" id="tbl_sale"><thead><tr>${ui.sortTh('tbl_sale', 'date', 'Date')}${ui.sortTh('tbl_sale', 'brand', 'Brand')}${ui.sortTh('tbl_sale', 'channel', 'Channel')}${ui.sortTh('tbl_sale', 'amount', 'Amount ($)')}${ui.sortTh('tbl_sale', 'gst', 'GST')}${ui.sortTh('tbl_sale', 'status', 'Status')}</tr></thead><tbody id="sale_tbody">${rows}</tbody></table></div></div><div id="txsale_lm" style="text-align:center;padding:10px;display:none"><button class="btn-outline" style="font-size:var(--fs-sm)" onclick="FinanceSection.loadMoreSales()">Load more</button></div></div></div>`, 'Finance');
}

async function loadTxSale() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadSales();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

let _salePage = 1;
async function _loadSales(filters) {
  const f = filters || { type: 'sale', page: 1 };
  if (!f.type) f.type = 'sale';
  if (!f.page) f.page = 1;
  _salePage = f.page;
  try {
    const result = await FIN.api('get_transactions', f);
    const tbody = document.getElementById('sale_tbody');
    const totalEl = document.getElementById('sale_total');
    const lmEl = document.getElementById('txsale_lm');
    if (tbody) tbody.innerHTML = _saleRows(result.rows);
    if (totalEl && result.rows) {
      const total = result.rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      totalEl.innerHTML = `Total Revenue <b style="color:var(--green)">${fm(total)}</b>`;
    }
    if (lmEl) lmEl.style.display = result.hasMore ? 'block' : 'none';
  } catch (e) {
    const tbody = document.getElementById('sale_tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--red)">Error: ${esc(e.message)}</td></tr>`;
  }
}

async function _loadMoreSales() {
  _salePage++;
  const f = { type: 'sale', page: _salePage };
  const brand = document.getElementById('sale_brand')?.value;
  const channel = document.getElementById('sale_channel')?.value;
  const from = document.getElementById('sale_from')?.value;
  const to = document.getElementById('sale_to')?.value;
  if (brand) f.brand = brand;
  if (channel) f.channel = channel;
  if (from) f.date_from = from;
  if (to) f.date_to = to;
  try {
    const result = await FIN.api('get_transactions', f);
    const tbody = document.getElementById('sale_tbody');
    const lmEl = document.getElementById('txsale_lm');
    if (tbody) tbody.innerHTML += _saleRows(result.rows);
    if (lmEl && !result.hasMore) lmEl.style.display = 'none';
  } catch (e) {
    SPG.toast('Load more failed: ' + e.message, 'error');
  }
}

function _filterSales() {
  const f = { type: 'sale', page: 1 };
  const brand = document.getElementById('sale_brand')?.value;
  const channel = document.getElementById('sale_channel')?.value;
  const from = document.getElementById('sale_from')?.value;
  const to = document.getElementById('sale_to')?.value;
  if (brand) f.brand = brand;
  if (channel) f.channel = channel;
  if (from) f.date_from = from;
  if (to) f.date_to = to;
  _loadSales(f);
}

function _resetSales() {
  const dr = dateRange();
  const el = (id) => document.getElementById(id);
  if (el('sale_brand')) el('sale_brand').value = '';
  if (el('sale_channel')) el('sale_channel').value = '';
  if (el('sale_from')) el('sale_from').value = dr.from;
  if (el('sale_to')) el('sale_to').value = dr.to;
  _loadSales();
}


// ═══════════════════════════════════════
// 3. BILLS
// ═══════════════════════════════════════

/** Render bill table rows from data array */
function _billRows(bills) {
  if (!bills || bills.length === 0) {
    return '<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--t3)">No bills found</td></tr>';
  }
  return bills.map(r => {
    const dC = r.status === 'Debit' ? 'color:var(--blue)' : '';
    const duC = r.status === 'Overdue' ? 'color:var(--red)' : '';
    const billId = r.id || '';
    return `<tr onclick="FinanceSection.openBillDetail('${esc(billId)}')" style="cursor:pointer"><td>${fd(r.date)}</td><td style="${dC}"><a class="lk">${esc(r.bill_no)}</a></td><td style="${dC}">${esc(r.supplier_name)}</td><td style="${dC}">${esc(r.inv_no)}</td><td style="text-align:right;${dC}">${fm(r.amount)}</td><td style="text-align:right;${dC}">${fm(r.balance)}</td><td style="${duC}">${fd(r.due_date)}</td><td>${r.has_file ? '📄' : ''}</td><td>${ui.badge(r.status)}</td></tr>`;
  }).join('');
}

/** Render bill summary line */
function _billSummaryHTML(summary) {
  if (!summary) return '';
  return `<div style="text-align:right;font-size:var(--fs-sm);color:var(--t2)">Total <b>${fm(summary.totalAmount)}</b> · Balance due <b>${fm(summary.balanceDue)}</b> · <span style="color:var(--red);font-weight:600">Overdue ${fm(summary.overdueAmount)}</span></div>`;
}

function renderTxBill() {
  const dr = dateRange();
  const mem = S._bills;
  const hasMem = mem && mem.length > 0;
  const rows = hasMem ? _billRows(mem) : ui.skeleton(60, 1);
  const summary = hasMem ? _billSummaryHTML(S._billSummary) : '';

  const actions = `<button class="btn-outline">+ Record supplier payment</button><button class="btn-outline" onclick="SPG.go('finance/cr-upload')">Import</button><button class="btn-primary" onclick="SPG.go('finance/cr-bill')">Create bill</button>`;

  return SPG.shell(SPG.toolbar('Bills', actions) + `<div class="content" id="fin-tx-bill"><div style="${TW}"><div class="card"><div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:6px"><div><div class="fl-label">Status</div><select class="fl" id="bill_status" onchange="FinanceSection.filterBills()" style="width:75px"><option value="">All</option><option value="Open">Open</option><option value="Overdue">Overdue</option><option value="Closed">Closed</option><option value="Debit">Debit</option></select></div><div><div class="fl-label">Supplier</div><select class="fl" id="bill_supplier" onchange="FinanceSection.filterBills()" style="width:140px">${_supplierFilterOpts()}</select></div><div><div class="fl-label">Brand</div><select class="fl" id="bill_brand" onchange="FinanceSection.filterBills()" style="width:110px">${_brandFilterOpts()}</select></div><div><div class="fl-label">Issue from</div><input class="fl" id="bill_from" type="date" value="${dr.from}" onchange="FinanceSection.filterBills()" style="width:130px"></div><div><div class="fl-label">Issue to</div><input class="fl" id="bill_to" type="date" value="${dr.to}" onchange="FinanceSection.filterBills()" style="width:130px"></div><div><div class="fl-label">Search</div><input class="fl" id="bill_search" placeholder="" oninput="FinanceSection.filterBills()" style="width:100px"></div><div style="flex:1"></div><button class="btn-outline" style="color:var(--acc)" onclick="FinanceSection.resetBills()">Reset</button></div><div id="bill_summary">${summary}</div></div><div class="card" style="padding:0"><div class="tbl-wrap"><table class="tbl" id="tbl_bill"><thead><tr>${ui.sortTh('tbl_bill', 'date', 'Issue date')}${ui.sortTh('tbl_bill', 'bill', 'Bill no')}${ui.sortTh('tbl_bill', 'supplier', 'Supplier')}${ui.sortTh('tbl_bill', 'inv', 'Inv no')}${ui.sortTh('tbl_bill', 'amount', 'Amount ($)')}${ui.sortTh('tbl_bill', 'balance', 'Balance due')}${ui.sortTh('tbl_bill', 'due', 'Due date')}${ui.sortTh('tbl_bill', 'file', 'File')}${ui.sortTh('tbl_bill', 'status', 'Status')}</tr></thead><tbody id="bill_tbody">${rows}</tbody></table></div></div><div id="txbill_lm" style="text-align:center;padding:10px;display:none"><button class="btn-outline" style="font-size:var(--fs-sm)" onclick="FinanceSection.loadMoreBills()">Load more</button></div></div></div>`, 'Finance');
}

async function loadTxBill() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadBills();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

let _billPage = 1;
async function _loadBills(filters) {
  const f = filters || { page: 1 };
  if (!f.page) f.page = 1;
  try {
    const result = await FIN.api('get_bills', f);
    const tbody = document.getElementById('bill_tbody');
    const summaryEl = document.getElementById('bill_summary');
    const lmEl = document.getElementById('txbill_lm');
    if (tbody) tbody.innerHTML = _billRows(result.rows);
    if (summaryEl) summaryEl.innerHTML = _billSummaryHTML(result.summary);
    if (lmEl) lmEl.style.display = result.hasMore ? 'block' : 'none';
    S._billSummary = result.summary;
    _billPage = 1;
  } catch (e) {
    const tbody = document.getElementById('bill_tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--red)">Error: ${esc(e.message)}</td></tr>`;
  }
}

function _filterBills() {
  const f = { page: 1 };
  const status = document.getElementById('bill_status')?.value;
  const supplier = document.getElementById('bill_supplier')?.value;
  const brand = document.getElementById('bill_brand')?.value;
  const from = document.getElementById('bill_from')?.value;
  const to = document.getElementById('bill_to')?.value;
  const search = document.getElementById('bill_search')?.value?.trim();
  if (status) f.status = status;
  if (supplier) f.supplier_id = supplier;
  if (brand) f.brand = brand;
  if (from) f.date_from = from;
  if (to) f.date_to = to;
  if (search) f.search = search;
  _loadBills(f);
}

function _resetBills() {
  const dr = dateRange();
  const el = (id) => document.getElementById(id);
  if (el('bill_status')) el('bill_status').value = '';
  if (el('bill_supplier')) el('bill_supplier').value = '';
  if (el('bill_brand')) el('bill_brand').value = '';
  if (el('bill_from')) el('bill_from').value = dr.from;
  if (el('bill_to')) el('bill_to').value = dr.to;
  if (el('bill_search')) el('bill_search').value = '';
  _loadBills();
}

async function _loadMoreBills() {
  _billPage++;
  try {
    const result = await FIN.api('get_bills', { page: _billPage });
    const tbody = document.getElementById('bill_tbody');
    const lmEl = document.getElementById('txbill_lm');
    if (tbody) tbody.innerHTML += _billRows(result.rows);
    if (lmEl && !result.hasMore) lmEl.style.display = 'none';
  } catch (e) {
    SPG.toast('Load more failed: ' + e.message, 'error');
  }
}


// ═══════════════════════════════════════
// 4. RETURN AND DEBIT
// ═══════════════════════════════════════

function _returnRows(rows) {
  if (!rows || rows.length === 0) {
    return '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--t3)">No debit notes found</td></tr>';
  }
  return rows.map(r => {
    const billNo = r.ref || r.bill_no || '';
    return `<tr style="cursor:pointer" onclick="FinanceSection.showDebitDetail('${esc(r.id || billNo)}')"><td>${fd(r.date)}</td><td style="color:var(--blue)"><a class="lk">${esc(billNo)}</a></td><td style="color:var(--blue)">${esc(r.contact || r.supplier_name || '')}</td><td style="color:var(--blue)">${esc(r.inv_no || '')}</td><td>${esc(r.desc || '')}</td><td style="text-align:right;color:var(--blue)">${fm(r.amount)}</td><td style="text-align:right;color:var(--blue)">${fm(r.balance || r.amount)}</td><td>${ui.badge(r.status === 'Debit' ? 'pending' : 'closed')}</td><td><a class="lk" style="font-size:var(--fs-xs)">Record</a></td><td><a class="lk" style="font-size:var(--fs-xs)">Apply</a></td></tr>`;
  }).join('');
}

function renderTxReturn() {
  const mem = S._tx_return;
  const hasMem = mem && mem.length > 0;
  const rows = hasMem ? _returnRows(mem) : ui.skeleton(60, 1);
  const tA = hasMem ? mem.reduce((s, r) => s + (Number(r.amount) || 0), 0) : 0;

  const actions = `<button class="btn-primary" onclick="SPG.go('finance/cr-debit')">Create debit note</button>`;

  return SPG.shell(SPG.toolbar('Purchase Returns and Debits', actions) + `<div class="content" id="fin-tx-return"><div style="${TW}"><div class="card"><div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:6px"><div><div class="fl-label">Supplier</div><select class="fl" id="ret_supplier" onchange="FinanceSection.filterReturns()" style="width:160px">${_supplierFilterOpts()}</select></div><div><div class="fl-label">Brand</div><select class="fl" id="ret_brand" onchange="FinanceSection.filterReturns()" style="width:140px">${_brandFilterOpts()}</select></div><div><div class="fl-label">Search</div><input class="fl" id="ret_search" placeholder="Search..." oninput="FinanceSection.filterReturns()" style="width:140px"></div><div style="flex:1"></div><button class="btn-outline" style="color:var(--acc)" onclick="FinanceSection.resetReturns()">Reset</button></div><div id="ret_total" style="text-align:right;font-size:var(--fs-sm);color:var(--t2)">Total debit: <b>${fm(tA)}</b></div></div><div class="card" style="padding:0"><div class="tbl-wrap"><table class="tbl" id="tbl_ret"><thead><tr>${ui.sortTh('tbl_ret', 'date', 'Date')}${ui.sortTh('tbl_ret', 'bill', 'Bill no')}${ui.sortTh('tbl_ret', 'supplier', 'Supplier')}${ui.sortTh('tbl_ret', 'inv', 'Inv no')}${ui.sortTh('tbl_ret', 'notes', 'Notes')}${ui.sortTh('tbl_ret', 'amount', 'Amount ($)')}${ui.sortTh('tbl_ret', 'balance', 'Balance')}${ui.sortTh('tbl_ret', 'status', 'Status')}${ui.sortTh('tbl_ret', 'refund', 'Refund')}${ui.sortTh('tbl_ret', 'apply', 'Apply')}</tr></thead><tbody id="ret_tbody">${rows}</tbody></table></div></div><div id="txret_lm" style="text-align:center;padding:10px;display:none"><button class="btn-outline" style="font-size:var(--fs-sm)" onclick="FinanceSection.loadMoreReturns()">Load more</button></div><div id="debit_detail" style="display:none"></div></div></div>`, 'Finance');
}

async function loadTxReturn() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadReturns();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

let _retPage = 1;
async function _loadReturns(filters) {
  const f = filters || { type: 'return', page: 1 };
  if (!f.type) f.type = 'return';
  if (!f.page) f.page = 1;
  _retPage = f.page;
  try {
    const result = await FIN.api('get_transactions', f);
    const tbody = document.getElementById('ret_tbody');
    const totalEl = document.getElementById('ret_total');
    const lmEl = document.getElementById('txret_lm');
    if (tbody) tbody.innerHTML = _returnRows(result.rows);
    if (totalEl && result.rows) {
      const tA = result.rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      totalEl.innerHTML = `Total debit: <b>${fm(tA)}</b>`;
    }
    if (lmEl) lmEl.style.display = result.hasMore ? 'block' : 'none';
  } catch (e) {
    const tbody = document.getElementById('ret_tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--red)">Error: ${esc(e.message)}</td></tr>`;
  }
}

async function _loadMoreReturns() {
  _retPage++;
  const f = { type: 'return', page: _retPage };
  const supplier = document.getElementById('ret_supplier')?.value;
  const brand = document.getElementById('ret_brand')?.value;
  const search = document.getElementById('ret_search')?.value?.trim();
  if (supplier) f.supplier_id = supplier;
  if (brand) f.brand = brand;
  if (search) f.search = search;
  try {
    const result = await FIN.api('get_transactions', f);
    const tbody = document.getElementById('ret_tbody');
    const lmEl = document.getElementById('txret_lm');
    if (tbody) tbody.innerHTML += _returnRows(result.rows);
    if (lmEl && !result.hasMore) lmEl.style.display = 'none';
  } catch (e) {
    SPG.toast('Load more failed: ' + e.message, 'error');
  }
}

function _filterReturns() {
  const f = { type: 'return', page: 1 };
  const supplier = document.getElementById('ret_supplier')?.value;
  const brand = document.getElementById('ret_brand')?.value;
  const search = document.getElementById('ret_search')?.value?.trim();
  if (supplier) f.supplier_id = supplier;
  if (brand) f.brand = brand;
  if (search) f.search = search;
  _loadReturns(f);
}

function _resetReturns() {
  const el = (id) => document.getElementById(id);
  if (el('ret_supplier')) el('ret_supplier').value = '';
  if (el('ret_brand')) el('ret_brand').value = '';
  if (el('ret_search')) el('ret_search').value = '';
  _loadReturns();
}

function _showDebitDetail(idOrBill) {
  const mem = S._tx_return;
  const r = mem ? mem.find(x => x.id === idOrBill || x.ref === idOrBill || x.bill_no === idOrBill) : null;
  if (!r) return;
  const el = document.getElementById('debit_detail');
  if (!el) return;
  el.style.display = 'block';
  el.innerHTML = `<div class="card" style="margin-top:10px;border-left:3px solid var(--blue)"><div style="display:flex;justify-content:space-between;margin-bottom:8px"><div style="font-weight:700;color:var(--blue)">Debit Note — ${esc(r.ref || r.bill_no || '')}</div><button class="btn-outline" onclick="document.getElementById('debit_detail').style.display='none'">✕</button></div><div class="fr"><div class="fg"><label class="lb">Supplier</label><div style="font-weight:600">${esc(r.contact || r.supplier_name || '')}</div></div><div class="fg"><label class="lb">Date</label><div>${fd(r.date)}</div></div></div><div class="fr"><div class="fg"><label class="lb">Inv No</label><div style="color:var(--blue)">${esc(r.inv_no || '')}</div></div><div class="fg"><label class="lb">Amount</label><div style="font-weight:700;color:var(--blue)">${fm(r.amount)}</div></div></div><div class="fr"><div class="fg"><label class="lb">Notes</label><div>${esc(r.desc || '')}</div></div><div class="fg"><label class="lb">Status</label><div>${ui.badge(r.status === 'Debit' ? 'pending' : 'closed')}</div></div></div></div>`;
  el.scrollIntoView({ behavior: 'smooth' });
}


// ═══════════════════════════════════════
// 5. BILL DETAIL
// ═══════════════════════════════════════
let _bdView = 'self';

function renderTxBillDetail(p) {
  _bdView = 'self';
  const detail = S._billDetail;

  if (!detail || !detail.bill) {
    const backActions = `<button class="btn-outline" onclick="SPG.go('finance/tx-bill')">← Bills</button>`;
    return SPG.shell(SPG.toolbar('Bill Detail', backActions) + `<div class="content" id="fin-tx-bill-detail"><div style="padding:40px;text-align:center;color:var(--t3)">${ui.skeleton(40, 1)}<div>Loading bill detail...</div></div></div>`, 'Finance');
  }

  const b = detail.bill;
  const li = detail.lineItems || [];
  const alloc = detail.allocation || 'self';
  const FB = 'background:#f3f0ff;border-color:#d8d0f0;color:var(--t1);-webkit-text-fill-color:var(--t1);opacity:1';
  const DS = `disabled style="${FB}"`;

  const subtotal = li.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const tax = li.reduce((s, l) => s + (Number(l.gst) || 0), 0);
  const total = subtotal + tax;
  const paid = total - (Number(b.balance) || 0);

  const isOB = alloc === 'ob' || alloc === 'on_behalf';

  // Line items rows
  const LIS = 'width:100%;padding:8px 10px;border:none;font-size:var(--fs-body)';
  const liRows = li.length > 0 ? li.map((l, idx) => {
    const ownerCol = isOB ? `<td style="padding:0;border:1px solid #e5e7eb"><input style="${LIS}" value="${esc(l.cost_owner || '')}" data-li="${idx}" data-field="cost_owner"></td>` : '';
    return `<tr>`
      + ownerCol
      + `<td style="padding:0;border:1px solid #e5e7eb"><input style="${LIS}" value="${esc(l.desc || l.description || '')}" data-li="${idx}" data-field="desc"></td>`
      + `<td style="padding:0;border:1px solid #e5e7eb"><input style="${LIS}" value="${esc(l.category || l.category_display || '')}" data-li="${idx}" data-field="category"></td>`
      + `<td style="padding:0;border:1px solid #e5e7eb"><input style="${LIS};text-align:right;font-weight:500" value="${fm(l.amount)}" data-li="${idx}" data-field="amount"></td>`
      + `<td style="padding:0;border:1px solid #e5e7eb"><input style="${LIS};text-align:right;color:var(--t3)" value="${fm(l.gst)}" data-li="${idx}" data-field="gst"></td>`
      + `<td style="padding:0;border:1px solid #e5e7eb"><input style="${LIS}" value="${esc(l.tax_code || 'FRE')}" data-li="${idx}" data-field="tax_code"></td>`
      + `</tr>`;
  }).join('') : `<tr><td colspan="${isOB ? 6 : 5}" style="text-align:center;color:var(--t3);padding:16px">No line items</td></tr>`;

  // Column headers
  const ownerTh = isOB ? '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:14%">Cost Owner</th>' : '';

  // Attachment helpers
  const atts = detail.attachments || [];
  const hasAtt = atts.length > 0;
  const firstImg = hasAtt ? (typeof atts[0] === 'string' ? atts[0] : atts[0].file_url || atts[0].url || '') : '';
  const isImg = (u) => /\.(jpg|jpeg|png|gif|webp)$/i.test(u);

  // Activity history
  const payments = detail.payments || [];
  const createdDate = b.created_at ? new Date(b.created_at).toLocaleDateString('en-AU') : (b.date ? new Date(b.date + 'T00:00:00').toLocaleDateString('en-AU') : '');
  const activityRows = [
    ...payments.map(pp => `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid #f0f0f0">
      <span style="color:var(--green);font-size:16px">$</span>
      <div style="flex:1">
        <div style="font-size:var(--fs-sm);color:var(--green);font-weight:600">Bill payment recorded</div>
        <div style="font-size:var(--fs-xs);color:var(--t3);margin-top:2px">${esc(pp.reference || '')} &middot; Payment recorded &middot; ${fm(pp.amount)}</div>
      </div>
      <div style="font-size:var(--fs-xs);color:var(--t3)">${pp.payment_date ? new Date(pp.payment_date + 'T00:00:00').toLocaleDateString('en-AU') : ''}</div>
    </div>`),
    `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0">
      <span style="font-size:14px">📄</span>
      <div style="flex:1;font-size:var(--fs-sm);color:var(--t2)">Bill created</div>
      <div style="font-size:var(--fs-xs);color:var(--t3)">${createdDate}</div>
    </div>`,
  ].join('');

  const tbActions = `<button class="btn-outline" onclick="SPG.go('finance/tx-bill')">← Bills</button><div style="flex:1"></div>${ui.badge(b.status)}`;

  return SPG.shell(SPG.toolbar('Bill ' + esc(b.bill_no), tbActions) + `<div class="content" id="fin-tx-bill-detail"><div style="max-width:1100px;margin:0 auto">
      <!-- Quick links -->
      <div style="display:flex;gap:12px;margin-bottom:10px;font-size:var(--fs-sm)">
        ${hasAtt ? '<a class="lk" onclick="document.getElementById(\'bd_att\').scrollIntoView({behavior:\'smooth\'})">📎 Attachments (' + atts.length + ')</a>' : ''}
        <a class="lk" onclick="document.getElementById('bd_activity').scrollIntoView({behavior:'smooth'})">🕐 Activity history</a>
        <a class="lk" style="color:var(--green)" onclick="document.getElementById('bd_actions').scrollIntoView({behavior:'smooth'})">$ Record payment</a>
      </div>

      <!-- SPLIT VIEW: Source doc (left) + Form (right) -->
      <div style="display:flex;gap:16px;align-items:flex-start">

        <!-- LEFT: Source document -->
        <div style="width:420px;flex-shrink:0">
          <div class="card" style="padding:0;overflow:hidden">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid #eee">
              <span style="font-size:var(--fs-sm);font-weight:600">Source document uploaded</span>
              <div style="display:flex;gap:4px">
                ${firstImg ? `<button class="btn-outline" style="font-size:12px;padding:2px 6px" title="Open full size" onclick="window.open('${esc(firstImg)}','_blank')">🔍</button>` : ''}
                ${firstImg ? `<a href="${esc(firstImg)}" download class="btn-outline" style="font-size:12px;padding:2px 6px;text-decoration:none" title="Download">⬇</a>` : ''}
              </div>
            </div>
            ${firstImg && isImg(firstImg)
              ? `<div style="padding:8px;background:#fafafa"><img src="${esc(firstImg)}" style="width:100%;border-radius:6px;cursor:pointer" onclick="window.open('${esc(firstImg)}','_blank')" alt="Invoice"></div>`
              : firstImg
                ? `<div style="padding:20px;text-align:center"><a href="${esc(firstImg)}" target="_blank" class="lk" style="font-size:var(--fs-sm)">📄 Open document</a></div>`
                : '<div style="padding:40px;text-align:center;color:var(--t4);font-size:var(--fs-sm)">No source document</div>'
            }
            ${atts.length > 1 ? `<div style="padding:8px;border-top:1px solid #eee;font-size:var(--fs-xs);color:var(--t3)">+${atts.length - 1} more attachment${atts.length > 2 ? 's' : ''}</div>` : ''}
          </div>
        </div>

        <!-- RIGHT: Form fields -->
        <div style="flex:1;min-width:0">
          <div class="card" style="padding:14px 16px">
            <div class="fg" style="margin-bottom:8px">
              <label class="lb">Transaction Type</label>
              <input class="inp" ${DS} value="Expense / Bill">
            </div>
            <div class="fg" style="margin-bottom:8px">
              <label class="lb">Supplier *</label>
              <input class="inp" ${DS} value="${esc(b.supplier_name || '—')}">
            </div>
            <div class="fg" style="margin-bottom:8px">
              <label class="lb">Bill Number</label>
              <input class="inp" ${DS} value="${esc(b.bill_no)}" style="font-weight:600">
            </div>
            <div class="fg" style="margin-bottom:8px">
              <label class="lb">Supplier Invoice Number</label>
              <input class="inp" id="bd_inv_no" value="${esc(b.inv_no || '')}">
            </div>
            <div style="display:flex;gap:10px;margin-bottom:8px">
              <div class="fg" style="flex:1"><label class="lb">Issue Date *</label><input class="inp" id="bd_issue_date" type="date" value="${b.date || ''}"></div>
              <div class="fg" style="flex:1"><label class="lb">Due Date *</label><input class="inp" id="bd_due_date" type="date" value="${b.due_date || ''}"></div>
            </div>
            <div style="display:flex;gap:10px;margin-bottom:8px">
              <div class="fg" style="flex:1"><label class="lb">Brand *</label><select class="inp" id="bd_brand">${FIN.brandOpts(b.paying_entity || b.brand || '')}</select></div>
              <div class="fg" style="flex:1"><label class="lb">Accrual Month</label><input class="inp" id="bd_accrual" type="month" value="${b.date ? b.date.substring(0, 7) : ''}"></div>
            </div>

            <!-- Tax mode -->
            <div style="display:flex;gap:12px;margin:6px 0;font-size:var(--fs-sm);align-items:center">
              <span style="color:var(--t3)">Amounts are</span>
              <label style="cursor:pointer"><input type="radio" name="bd_taxmode" value="exclusive" ${b.tax_inclusive ? '' : 'checked'} style="accent-color:var(--acc)"> Tax exclusive</label>
              <label style="cursor:pointer"><input type="radio" name="bd_taxmode" value="inclusive" ${b.tax_inclusive ? 'checked' : ''} style="accent-color:var(--acc)"> Tax inclusive</label>
            </div>

            <!-- Allocation Layout -->
            <div style="display:flex;align-items:center;gap:0;margin:8px 0 0">
              <hr style="border:none;border-top:1px solid #eee;flex:1;margin:0">
              <div style="padding:0 8px;display:flex;align-items:center;gap:4px">
                <span style="font-size:var(--fs-xs);color:var(--t4)">Allocation Layout</span>
                <span style="font-size:var(--fs-xs);padding:2px 8px;border-radius:4px;background:var(--acc2);color:var(--acc);font-weight:600">${isOB ? 'On Behalf / Split' : 'Self'}</span>
              </div>
            </div>

            <!-- Line Items Table -->
            <table style="width:100%;border-collapse:collapse;font-size:var(--fs-body);margin-top:8px">
              <thead><tr>
                ${ownerTh}
                <th style="text-align:left;padding:6px;font-weight:600;font-size:var(--fs-xs)">Description</th>
                <th style="text-align:left;padding:6px;font-weight:600;font-size:var(--fs-xs)">Category *</th>
                <th style="text-align:right;padding:6px;font-weight:600;font-size:var(--fs-xs)">Amount ($)</th>
                <th style="text-align:right;padding:6px;font-weight:600;font-size:var(--fs-xs)">GST</th>
                <th style="text-align:left;padding:6px;font-weight:600;font-size:var(--fs-xs)">Tax code</th>
              </tr></thead>
              <tbody>${liRows}</tbody>
            </table>

            <!-- Notes -->
            <div style="margin-top:8px">
              <div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:2px">Notes</div>
              <textarea class="inp" id="bd_notes" style="width:100%;min-height:50px;resize:vertical;border:1px solid #d8d0f0;border-radius:var(--rd);padding:6px 8px;font-family:inherit;font-size:var(--fs-sm)">${esc(b.notes || '')}</textarea>
            </div>

            <!-- Totals -->
            <div style="text-align:right;font-size:var(--fs-body);margin-top:8px;padding-top:8px;border-top:1px solid #eee">
              <div style="display:flex;justify-content:flex-end;gap:16px;padding:3px 0"><span>Subtotal</span><b>${fm(subtotal)}</b></div>
              <div style="display:flex;justify-content:flex-end;gap:16px;padding:3px 0;color:var(--t3)"><span>Tax</span><span>${fm(tax)}</span></div>
              <div style="display:flex;justify-content:flex-end;gap:16px;padding:3px 0"><b>Total</b><b>${fm(total)}</b></div>
              <div style="display:flex;justify-content:flex-end;gap:16px;padding:3px 0;color:var(--t3)"><span>Amount paid</span><span>${fm(paid)}</span></div>
              <div style="display:flex;justify-content:flex-end;gap:16px;padding:5px 0;font-weight:700;font-size:var(--fs-body);color:${b.status === 'Closed' ? 'var(--green)' : 'var(--red)'}"><span>Balance due</span><span>${b.status === 'Closed' ? fm(0) : fm(b.balance)}</span></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div id="bd_actions" style="display:flex;align-items:center;gap:6px;padding:10px 0;flex-wrap:wrap">
        ${b.status !== 'Closed' && b.status !== 'Cancelled' ? `<button class="btn-danger" onclick="FinanceSection.deleteBill('${esc(b.id || '')}')">Delete</button>` : ''}
        ${b.status !== 'Closed' && b.status !== 'Cancelled' ? `<button class="btn-outline" style="color:var(--green);border-color:var(--green)" onclick="FinanceSection.recordPaymentFromBill('${esc(b.id || '')}')">Record Payment</button>` : ''}
        ${firstImg ? `<button class="btn-outline" onclick="window.open('${esc(firstImg)}','_blank')">View PDF</button>` : ''}
        <button class="btn-outline" onclick="FinanceSection.saveAsRecurring('${esc(b.id || '')}')">Save as Recurring</button>
        <div style="flex:1"></div>
        <button class="btn-outline" onclick="SPG.go('finance/tx-bill')">Cancel</button>
        <div style="position:relative;display:inline-block">
          <button class="btn-outline" onclick="FinanceSection.toggleSaveMenu()">Save and... ▾</button>
          <div id="bd_save_menu" style="display:none;position:absolute;bottom:100%;right:0;background:#fff;border:1px solid var(--bd);border-radius:var(--rd);box-shadow:0 2px 8px rgba(0,0,0,.1);min-width:160px;z-index:10">
            <button class="btn-outline" style="width:100%;text-align:left;padding:8px 12px;font-size:var(--fs-sm);border:none" onclick="FinanceSection.saveBill('new')">Save & Create New</button>
            <button class="btn-outline" style="width:100%;text-align:left;padding:8px 12px;font-size:var(--fs-sm);border:none" onclick="FinanceSection.saveBill('duplicate')">Save & Duplicate</button>
          </div>
        </div>
        <button class="btn-primary" onclick="FinanceSection.saveBill()">Save</button>
      </div>

      <!-- More information section -->
      <div style="margin-top:6px">
        <!-- Activity History -->
        <div id="bd_activity" style="margin-bottom:10px">
          <div style="background:#333;color:#fff;padding:8px 12px;border-radius:8px 8px 0 0;font-size:var(--fs-sm);font-weight:600;display:flex;align-items:center;gap:8px;cursor:pointer" onclick="const c=this.nextElementSibling;c.style.display=c.style.display==='none'?'block':'none'">
            Activity history
            ${payments.length > 0 ? `<span style="font-size:var(--fs-xxs);padding:1px 8px;border-radius:8px;background:var(--green-bg);color:var(--green)">Bill payment recorded</span>` : ''}
            <span style="margin-left:auto;font-size:12px">▾</span>
          </div>
          <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;padding:8px 12px">
            ${activityRows}
          </div>
        </div>

        <!-- Attachments -->
        <div id="bd_att">
          <div style="background:#333;color:#fff;padding:8px 12px;border-radius:8px 8px 0 0;font-size:var(--fs-sm);font-weight:600;display:flex;align-items:center;gap:8px;cursor:pointer" onclick="const c=this.nextElementSibling;c.style.display=c.style.display==='none'?'block':'none'">
            Attachments ${hasAtt ? `<span style="background:var(--acc2);color:var(--acc);font-size:var(--fs-xxs);padding:1px 6px;border-radius:8px">${atts.length}</span>` : ''}
            <span style="margin-left:auto;font-size:12px">▾</span>
          </div>
          <div style="border:1.5px dashed #ddd;border-top:none;border-radius:0 0 8px 8px;padding:12px;text-align:center">
            ${hasAtt
              ? atts.map(a => {
                  const url = typeof a === 'string' ? a : a.file_url || a.url || '';
                  const name = typeof a === 'string' ? a.split('/').pop() : a.file_name || a.name || 'file';
                  const size = a.file_size ? (a.file_size / 1024 / 1024).toFixed(2) + ' MB' : '';
                  return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;padding:6px 10px;background:var(--bg3);border-radius:6px;font-size:var(--fs-sm);text-align:left">
                    <span>📄</span>
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(name)}</span>
                    ${size ? `<span style="font-size:var(--fs-xs);color:var(--t3)">${size}</span>` : ''}
                    <a href="${esc(url)}" target="_blank" class="lk" style="font-size:var(--fs-xs)">⬇</a>
                  </div>`;
                }).join('')
              : '<div style="padding:8px"><div style="font-size:24px;color:var(--t4);margin-bottom:4px">☁</div>Drag files here to upload, or <a class="lk" style="font-weight:600">browse for files</a><div style="font-size:var(--fs-xs);color:var(--t4);margin-top:4px">PDF, TIFF, JPEG or PNG and below 10MB</div></div>'
            }
          </div>
        </div>
      </div>
    </div></div>`, 'Finance');
}

async function loadTxBillDetail(p) {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    // If route param has bill ID, fetch it
    if (p && p.id) {
      await _openBillDetail(p.id);
    }
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

/** Open bill detail - fetch from API if not the last created bill */
async function _openBillDetail(billId) {
  if (!billId) { SPG.go('finance/tx-bill-detail'); return; }

  // Check if already in memory (e.g. just created)
  const mem = S._billDetail;
  if (mem && mem.bill && mem.bill.id === billId) {
    SPG.go('finance/tx-bill-detail/' + billId);
    return;
  }

  // Fetch from API - show loading first
  SPG.go('finance/tx-bill-detail/' + billId);

  try {
    const detail = await FIN.api('get_bill_detail', { bill_id: billId });
    S._billDetail = detail;
    // Re-render if still on this route
    const ct = document.getElementById('fin-tx-bill-detail');
    if (ct) {
      const result = renderTxBillDetail();
      const shell = document.getElementById('shell-content');
      if (shell) shell.innerHTML = result;
    }
  } catch (e) {
    SPG.toast('Error loading bill: ' + e.message, 'error');
  }
}

// Bill Detail helpers
function _bdPay(s) {
  const p = s === 'paid';
  return `<div style="margin-top:10px;border:1px solid var(--bd);border-radius:var(--rd);overflow:hidden"><div style="background:#333;color:#fff;padding:6px 10px;font-size:var(--fs-sm);font-weight:600;display:flex;justify-content:space-between">Payment <span style="font-size:9px;padding:1px 8px;border-radius:8px;background:${p ? 'var(--green-bg)' : 'var(--orange-bg)'};color:${p ? 'var(--green)' : 'var(--orange)'}">${p ? 'Paid' : 'Unpaid'}</span></div><div style="padding:8px;font-size:var(--fs-sm);text-align:center;color:var(--t3)">${p ? 'Paid in full' : 'No payment · <a class="lk">Record Payment →</a>'}</div></div>`;
}

function _bdAtt(f) {
  const l = f.map(x => `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;padding:4px 8px;background:var(--bg3);border-radius:4px;font-size:var(--fs-sm)"><span>📄</span><span style="flex:1">${esc(x)}</span><a class="lk" style="font-size:var(--fs-xs)">View</a><a class="lk" style="font-size:var(--fs-xs);color:var(--red)">Remove</a></div>`).join('');
  return `<div style="margin-top:8px;border:1.5px dashed #ddd;border-radius:8px;padding:10px"><div style="background:#333;color:#fff;padding:5px 10px;border-radius:5px 5px 0 0;font-size:var(--fs-sm);font-weight:600">Attachments (${f.length})</div><div style="border:1.5px dashed #ddd;border-top:none;border-radius:0 0 5px 5px;padding:10px">${l}<div style="text-align:center;font-size:var(--fs-sm);color:var(--t3)">Drag files here, or <a style="color:var(--acc);font-weight:600;cursor:pointer">browse</a></div></div></div>`;
}

// Backward compat stubs
function _switchBdView() {}
function _bdDoc() { return ''; }
function _bdSelfView() { return ''; }
function _bdObView() { return ''; }
function _bdSplitView() { return ''; }

/** Navigate to bill detail by bill ID */
let _currentBillId = null;
function _goBillDetail(billId) {
  if (!billId) return;
  _currentBillId = billId;
  _openBillDetail(billId);
}

/** Delete a bill */
function _deleteBill(billId) {
  SPG.showDialog(`<div class="popup-sheet" style="width:380px">
    <div class="popup-header"><div class="popup-title">Delete Bill</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div style="padding:16px;font-size:var(--fs-sm);color:var(--t2)">This will permanently delete this bill and create a reversal entry. This cannot be undone.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;padding:0 16px 16px">
      <button class="btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn-danger" onclick="FinanceSection._confirmDeleteBill('${esc(billId)}')">Delete Bill</button>
    </div>
  </div>`);
}

async function _confirmDeleteBill(billId) {
  SPG.closeDialog();
  try {
    await FIN.api('delete_bill', { bill_id: billId });
    SPG.toast('Bill deleted', 'ok');
    S._bills = null;
    SPG.go('finance/tx-bill');
  } catch (e) {
    SPG.toast(e.message || 'Delete failed', 'error');
  }
}

/** Save bill - collect form values and update via API */
async function _saveBill(after) {
  const detail = S._billDetail;
  if (!detail || !detail.bill) return SPG.toast('No bill loaded', 'error');
  const b = detail.bill;
  const el = (id) => document.getElementById(id);

  const data = {
    bill_id: b.id,
    inv_no: el('bd_inv_no')?.value || '',
    issue_date: el('bd_issue_date')?.value || '',
    due_date: el('bd_due_date')?.value || '',
    brand: el('bd_brand')?.value || '',
    accrual_month: el('bd_accrual')?.value || '',
    tax_inclusive: document.querySelector('input[name="bd_taxmode"][value="inclusive"]')?.checked || false,
    notes: el('bd_notes')?.value || '',
  };

  // Collect line items
  const liInputs = document.querySelectorAll('[data-li][data-field]');
  const lineItems = {};
  liInputs.forEach(inp => {
    const idx = inp.dataset.li;
    const field = inp.dataset.field;
    if (!lineItems[idx]) lineItems[idx] = {};
    let val = inp.value.trim();
    if (field === 'amount' || field === 'gst') {
      val = val.replace(/[$,]/g, '');
    }
    lineItems[idx][field] = val;
  });
  data.line_items = Object.values(lineItems);

  try {
    SPG.showLoader();
    await FIN.api('update_bill', data);
    SPG.toast('Bill saved', 'ok');
    S._bills = null;
    S._billDetail = null;

    if (after === 'new') {
      SPG.go('finance/cr-bill');
    } else if (after === 'duplicate') {
      S._duplicateBill = data;
      SPG.go('finance/cr-bill');
    } else {
      _openBillDetail(b.id);
    }
  } catch (e) {
    SPG.toast('Save failed: ' + (e.message || 'Unknown error'), 'error');
  } finally {
    SPG.hideLoader();
  }
}

/** Toggle save dropdown menu */
function _toggleSaveMenu() {
  const menu = document.getElementById('bd_save_menu');
  if (!menu) return;
  const show = menu.style.display === 'none';
  menu.style.display = show ? 'block' : 'none';
  if (show) {
    const close = (e) => {
      if (!menu.contains(e.target) && !e.target.closest('#bd_save_more')) {
        menu.style.display = 'none';
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  }
}

/** Save as recurring */
function _saveAsRecurring(billId) {
  const detail = S._billDetail;
  if (!detail || !detail.bill) return SPG.toast('No bill loaded', 'error');
  S._recurringFromBill = detail;
  SPG.go('finance/cr-recurring');
}

/** Legacy - kept for backward compat */
function _voidBill(billId) {
  _deleteBill(billId);
}

/** Record Payment from Bill Detail */
function _recordPaymentFromBill(billId) {
  const detail = S._billDetail;
  if (!detail || !detail.bill) return SPG.toast('Bill data not loaded', 'error');
  const b = detail.bill;
  S._prefillPayment = {
    bill_id: b.id,
    bill_no: b.bill_no,
    vendor_name: b.supplier_name || b.vendor_name || '',
    amount: b.balance || 0,
    brand: b.paying_entity || b.brand || '',
  };
  SPG.go('finance/py-record');
}


// ═══════════════════════════════════════
// 5b. SALE DETAIL
// ═══════════════════════════════════════

function renderTxSaleDetail(p) {
  const detail = S._saleDetail;

  if (!detail) {
    const backActions = `<button class="btn-outline" onclick="SPG.go('finance/tx-sale')">← Sales</button>`;
    return SPG.shell(SPG.toolbar('Sale Detail', backActions) + `<div class="content" id="fin-tx-sale-detail"><div style="padding:40px;text-align:center;color:var(--t3)">${ui.skeleton(40, 1)}<div>Loading sale detail...</div></div></div>`, 'Finance');
  }

  const r = detail;
  const refNo = r.ref || r.id || '';
  const FB = 'background:#f3f0ff;border-color:#d8d0f0;color:var(--t1);-webkit-text-fill-color:var(--t1);opacity:1';
  const DS = `disabled style="${FB}"`;

  const tbActions = `<button class="btn-outline" onclick="SPG.go('finance/tx-sale')">← Sales</button><div style="flex:1"></div>${ui.badge(r.status)}`;

  return SPG.shell(SPG.toolbar('Sale ' + esc(refNo), tbActions) + `<div class="content" id="fin-tx-sale-detail"><div style="max-width:800px;margin:0 auto">
      <div class="card" style="padding:14px 16px">
        <div class="fg" style="margin-bottom:8px">
          <label class="lb">Transaction Type</label>
          <input class="inp" ${DS} value="Income / Sale">
        </div>
        <div class="fg" style="margin-bottom:8px">
          <label class="lb">Reference Number</label>
          <input class="inp" ${DS} value="${esc(refNo)}">
        </div>
        <div style="display:flex;gap:10px;margin-bottom:8px">
          <div class="fg" style="flex:1"><label class="lb">Sale Date *</label><input class="inp" id="sd_date" type="date" value="${r.date || ''}"></div>
          <div class="fg" style="flex:1"><label class="lb">Brand *</label><select class="inp" id="sd_brand_f">${FIN.brandOpts(r.brand || '')}</select></div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:8px">
          <div class="fg" style="flex:1"><label class="lb">Channel</label><input class="inp" id="sd_channel" value="${esc(r.channel || r.desc || '')}"></div>
          <div class="fg" style="flex:1"><label class="lb">Status</label><input class="inp" ${DS} value="${esc(r.status || 'Open')}"></div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:8px">
          <div class="fg" style="flex:1"><label class="lb">Amount ($) *</label><input class="inp" id="sd_amount" type="number" step="0.01" value="${r.amount || 0}"></div>
          <div class="fg" style="flex:1"><label class="lb">GST ($)</label><input class="inp" id="sd_gst" type="number" step="0.01" value="${r.gst || 0}"></div>
        </div>
        <div class="fg" style="margin-bottom:8px">
          <label class="lb">Notes</label>
          <textarea class="inp" id="sd_notes" style="width:100%;min-height:50px;resize:vertical;border:1px solid #d8d0f0;border-radius:var(--rd);padding:6px 8px;font-family:inherit;font-size:var(--fs-sm)">${esc(r.notes || '')}</textarea>
        </div>

        <!-- Totals -->
        <div style="text-align:right;font-size:var(--fs-body);margin-top:8px;padding-top:8px;border-top:1px solid #eee">
          <div style="display:flex;justify-content:flex-end;gap:16px;padding:3px 0"><span>Amount</span><b style="color:var(--green)">${fm(r.amount)}</b></div>
          <div style="display:flex;justify-content:flex-end;gap:16px;padding:3px 0;color:var(--t3)"><span>GST</span><span>${fm(r.gst || 0)}</span></div>
          <div style="display:flex;justify-content:flex-end;gap:16px;padding:3px 0"><b>Total</b><b style="color:var(--green)">${fm((Number(r.amount) || 0) + (Number(r.gst) || 0))}</b></div>
        </div>
      </div>

      <!-- Action buttons -->
      <div style="display:flex;align-items:center;gap:6px;padding:10px 0;flex-wrap:wrap">
        <button class="btn-danger" onclick="FinanceSection.deleteSale('${esc(r.id || '')}')">Delete</button>
        <div style="flex:1"></div>
        <button class="btn-outline" onclick="SPG.go('finance/tx-sale')">Cancel</button>
        <button class="btn-primary" onclick="FinanceSection.saveSale()">Save</button>
      </div>
    </div></div>`, 'Finance');
}

async function loadTxSaleDetail(p) {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    if (p && p.id) {
      await _openSaleDetail(p.id);
    }
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

/** Open sale detail - find in memory or fetch */
async function _openSaleDetail(saleId) {
  if (!saleId) return;

  // Try to find in memory
  const mem = S._tx_sale || S._tx_log;
  const found = mem ? mem.find(x => x.id === saleId) : null;

  S._saleDetail = found || null;
  SPG.go('finance/tx-sale-detail/' + saleId);

  // If not found in memory, fetch from API
  if (!found) {
    try {
      const data = await FIN.api('get_sale_detail', { sale_id: saleId });
      S._saleDetail = data;
      // Re-render if still on this route
      const ct = document.getElementById('fin-tx-sale-detail');
      if (ct) {
        const result = renderTxSaleDetail();
        const shell = document.getElementById('shell-content');
        if (shell) shell.innerHTML = result;
      }
    } catch (e) {
      SPG.toast('Error loading sale: ' + e.message, 'error');
    }
  }
}

function _goSaleDetail(saleId) {
  if (!saleId) return;
  _openSaleDetail(saleId);
}

/** Save sale - collect form values and update via API */
async function _saveSale() {
  const detail = S._saleDetail;
  if (!detail) return SPG.toast('No sale loaded', 'error');
  const el = (id) => document.getElementById(id);

  const data = {
    sale_id: detail.id,
    date: el('sd_date')?.value || '',
    brand: el('sd_brand_f')?.value || '',
    channel: el('sd_channel')?.value || '',
    amount: parseFloat(el('sd_amount')?.value) || 0,
    gst: parseFloat(el('sd_gst')?.value) || 0,
    notes: el('sd_notes')?.value || '',
  };

  try {
    SPG.showLoader();
    await FIN.api('update_sale', data);
    SPG.toast('Sale saved', 'ok');
    S._tx_sale = null;
    _openSaleDetail(detail.id);
  } catch (e) {
    SPG.toast('Save failed: ' + (e.message || 'Unknown error'), 'error');
  } finally {
    SPG.hideLoader();
  }
}

/** Delete sale */
function _deleteSale(saleId) {
  SPG.showDialog(`<div class="popup-sheet" style="width:380px">
    <div class="popup-header"><div class="popup-title">Delete Sale</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div style="padding:16px;font-size:var(--fs-sm);color:var(--t2)">This will permanently delete this sale record. This cannot be undone.</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;padding:0 16px 16px">
      <button class="btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn-danger" onclick="FinanceSection._confirmDeleteSale('${esc(saleId)}')">Delete Sale</button>
    </div>
  </div>`);
}

async function _confirmDeleteSale(saleId) {
  SPG.closeDialog();
  try {
    await FIN.api('delete_sale', { sale_id: saleId });
    SPG.toast('Sale deleted', 'ok');
    S._tx_sale = null;
    SPG.go('finance/tx-sale');
  } catch (e) {
    SPG.toast(e.message || 'Delete failed', 'error');
  }
}


// ═══════════════════════════════════════
// 6. SD BRIDGE
// ═══════════════════════════════════════
let _sdFilter = 'all';
let _sdMonth = FIN.sydneyToday().substring(0, 7);
let _sdChecked = new Set();
let _sdBrandFilter = '';
let _sdRows = [];

function renderTxSd() {
  _sdChecked = new Set();

  const monthOpts = (() => {
    let o = '', d = FIN.sydneyNow();
    for (let i = 0; i < 6; i++) {
      let m = new Date(d.getFullYear(), d.getMonth() - i, 1), v = m.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }).substring(0, 7);
      o += `<option value="${v}"${v === _sdMonth ? ' selected' : ''}>${v}</option>`;
    }
    return o;
  })();

  const actions = `<span style="font-size:var(--fs-xs);color:var(--t3)">Sale Daily → Finance sync</span><div style="flex:1"></div><select class="fl" style="width:150px" id="sd_month" onchange="FinanceSection.sdChangeMonth()">${monthOpts}</select><button class="btn-outline" onclick="SPG.go('finance/settings')">Settings</button>`;

  return SPG.shell(SPG.toolbar('SD Bridge', actions) + `<div class="content" id="fin-tx-sd"><div style="max-width:1100px;margin:0 auto">
      <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:12px;flex-wrap:wrap">
        <div style="display:flex;gap:3px" id="sd_filter_btns">
          <button class="btn-outline" style="padding:6px 16px;font-size:12px;font-weight:600;background:var(--t1);color:#fff;border-color:var(--t1)" onclick="FinanceSection.sdSetFilter('all',this)">All</button>
          <button class="btn-outline" style="padding:6px 16px;font-size:12px" onclick="FinanceSection.sdSetFilter('pending',this)">Pending</button>
          <button class="btn-outline" style="padding:6px 16px;font-size:12px" onclick="FinanceSection.sdSetFilter('synced',this)">Done</button>
        </div>
        <div><div class="fl-label">Brand</div><select class="fl" id="sd_brand" onchange="FinanceSection.sdSetBrandFilter()" style="width:140px"><option value="">All Brands</option></select></div>
        <div style="flex:1"></div>
      </div>
      <div class="kpi-grid" id="sd_kpi">
        <div class="kpi-card" style="background:#fff"><div class="kpi-value" style="color:var(--t4)">—</div><div class="kpi-label">Total Revenue</div></div>
        <div class="kpi-card" style="background:#fff"><div class="kpi-value" style="color:var(--t4)">—</div><div class="kpi-label">Total Expenses</div></div>
        <div class="kpi-card" style="background:#fff"><div class="kpi-value" style="color:var(--t4)">—</div><div class="kpi-label">Pending items</div></div>
      </div>
      <div id="sd_cards"><div style="text-align:center;padding:30px;color:var(--t3)">${ui.skeleton(40, 1)}<div>Loading SD Bridge...</div></div></div>
      <div id="sd_actions" style="display:none;align-items:center;padding:10px 0;gap:8px">
        <button class="btn-outline" style="padding:5px 12px;font-size:11px" onclick="FinanceSection.sdSelectAll()">Select All Pending</button>
        <button class="btn-outline" style="font-size:11px" onclick="FinanceSection.sdDeselectAll()">Deselect All</button>
        <div style="flex:1;font-size:var(--fs-xs);color:var(--t3)" id="sd_sel_count">0 selected</div>
        <button class="btn-primary" style="padding:6px 16px;font-size:12px" onclick="FinanceSection.sdSyncSelected()">Sync selected</button>
      </div>
    </div></div>`, 'Finance');
}

async function loadTxSd() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadSdBridge();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

async function _loadSdBridge() {
  try {
    const result = await FIN.api('get_sd_pending', { month: _sdMonth });
    const rows = result.rows || [];
    _sdRows = rows;
    const kpi = result.kpi || {};

    // Build brand dropdown from actual bridge data
    const brandSet = new Set();
    rows.forEach(r => { const b = r.paying_entity || r.store || ''; if (b) brandSet.add(b); });
    const brandSel = document.getElementById('sd_brand');
    if (brandSel) {
      const prev = brandSel.value;
      brandSel.innerHTML = '<option value="">All Brands</option>' +
        [...brandSet].sort().map(b => `<option${b === prev ? ' selected' : ''}>${esc(b)}</option>`).join('');
    }

    // Render KPI
    const kpiEl = document.getElementById('sd_kpi');
    if (kpiEl) {
      kpiEl.innerHTML = `
        <div class="kpi-card" style="background:#fff"><div class="kpi-value" style="color:var(--green)">${fm(kpi.revenue || 0)}</div><div class="kpi-label">Total Revenue</div></div>
        <div class="kpi-card" style="background:#fff"><div class="kpi-value" style="color:var(--red)">${fm(kpi.expenses || 0)}</div><div class="kpi-label">Total Expenses</div></div>
        <div class="kpi-card" style="background:#fff"><div class="kpi-value">${kpi.pendingCount || 0}</div><div class="kpi-label">Pending items</div></div>
        <div class="kpi-card" style="background:#fff"><div class="kpi-value" style="color:var(--green)">${kpi.syncedCount || 0}</div><div class="kpi-label">Synced</div></div>`;
    }

    // Update filter button counts
    const allCount = rows.length;
    const pendingCount = rows.filter(r => r.status === 'pending').length;
    const syncedCount2 = rows.filter(r => r.status === 'synced').length;
    const btns = document.getElementById('sd_filter_btns');
    if (btns) {
      const btnEls = btns.querySelectorAll('button');
      if (btnEls[0]) btnEls[0].textContent = 'All (' + allCount + ')';
      if (btnEls[1]) btnEls[1].textContent = 'Pending (' + pendingCount + ')';
      if (btnEls[2]) btnEls[2].textContent = 'Done (' + syncedCount2 + ')';
    }

    // Filter rows
    let filtered = rows;
    if (_sdFilter === 'pending') filtered = rows.filter(r => r.status === 'pending');
    else if (_sdFilter === 'synced') filtered = rows.filter(r => r.status === 'synced');

    // Brand filter
    if (_sdBrandFilter) {
      filtered = filtered.filter(r => (r.paying_entity || r.store || '') === _sdBrandFilter);
    }

    // Group by date + store
    const groups = {};
    filtered.forEach(r => {
      const key = (r.date || 'unknown') + '|' + (r.store || 'unknown');
      if (!groups[key]) groups[key] = { date: r.date, store: r.store, items: [] };
      groups[key].items.push(r);
    });

    const cardsEl = document.getElementById('sd_cards');
    if (!cardsEl) return;

    if (filtered.length === 0) {
      cardsEl.innerHTML = '<div style="text-align:center;padding:30px;color:var(--t3)">No records for this period</div>';
      return;
    }

    // Sort groups by date desc
    const sortedGroups = Object.values(groups).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    let html = '';
    sortedGroups.forEach((g, gi) => {
      const pendingItems = g.items.filter(r => r.status === 'pending');
      const syncedItems = g.items.filter(r => r.status === 'synced');
      const totalItems = g.items.length;
      const syncPct = totalItems > 0 ? Math.round(syncedItems.length / totalItems * 100) : 0;
      const allSynced = pendingItems.length === 0;
      const borderColor = allSynced ? 'var(--green)' : 'var(--orange)';
      const barColor = allSynced ? 'var(--green)' : 'var(--orange)';

      const rev = g.items.filter(r => r.type === 'revenue').reduce((s, r) => s + (r.amount || 0), 0);
      const exp = g.items.filter(r => r.type === 'expense').reduce((s, r) => s + (r.amount || 0), 0);

      const fmtDate = fd(g.date);

      html += `<div style="border:1px solid var(--bd);border-radius:10px;margin-bottom:12px;overflow:hidden;border-left:3px solid ${borderColor}">`;
      // Group header
      html += `<div style="display:flex;align-items:center;padding:12px 16px;gap:10px;cursor:pointer;background:#fff" onclick="FinanceSection.sdToggleGroup(${gi})">`;
      html += `<span style="font-size:12px;color:var(--t3)" id="sd_arr_${gi}">▸</span>`;
      html += `<div style="font-size:13px;font-weight:700">${esc(fmtDate)}</div>`;
      html += `<div style="font-size:11px;color:var(--t2);font-weight:600;background:var(--bg3);padding:2px 8px;border-radius:4px">${esc(g.store || '')}</div>`;
      html += `<div style="display:flex;align-items:center;gap:6px;margin-left:12px"><div style="width:80px;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden"><div style="width:${syncPct}%;height:100%;background:${barColor};border-radius:3px"></div></div><span style="font-size:10px;color:${barColor};font-weight:600">${syncedItems.length}/${totalItems}${allSynced ? ' ✓' : ''}</span></div>`;
      html += `<div style="display:flex;gap:8px;margin-left:auto">`;
      if (rev > 0) html += `<span style="font-size:10px;padding:2px 8px;border-radius:4px;background:var(--green-bg);color:var(--green)">💰 ${fm(rev)}</span>`;
      if (exp > 0) html += `<span style="font-size:10px;padding:2px 8px;border-radius:4px;background:var(--red-bg);color:var(--red)">📦 ${fm(exp)}</span>`;
      if (allSynced) html += `<span class="sts-ok" style="font-size:10px">All synced</span>`;
      html += `</div></div>`;

      // Group items (collapsed by default)
      html += `<div id="sd_grp_${gi}" style="display:none;border-top:1px solid var(--bd2)">`;
      g.items.forEach(r => {
        const isPending = r.status === 'pending';
        const isRev = r.type === 'revenue';
        const icon = isRev ? '💰' : (r.doc_type === 'Invoice' ? '📄' : '📦');
        const amtColor = isRev ? 'var(--green)' : 'var(--red)';
        const amtSign = isRev ? '+' : '-';
        const rowBg = isPending ? 'rgba(217,119,6,.03)' : '';
        const rowOpacity = isPending ? '' : 'opacity:.7';

        // Doc type badge
        const docBadge = r.doc_type === 'Invoice' ? '<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:var(--orange-bg);color:var(--orange)">Invoice</span>'
          : r.doc_type === 'Bill' ? '<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:var(--red-bg);color:var(--red)">Bill</span>'
          : r.doc_type === 'None' ? '<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:var(--green-bg);color:var(--green)">Revenue</span>'
          : '';

        // Payment status badge
        const payBadge = r.payment_status === 'Paid' ? '<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:var(--green-bg);color:var(--green)">Paid</span>'
          : r.payment_status === 'Unpaid' ? '<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:var(--red-bg);color:var(--red)">Unpaid</span>'
          : r.payment_status === 'Pending' ? '<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:var(--orange-bg);color:var(--orange)">Pending</span>'
          : '';

        // Display name
        const displayName = isRev ? (r.description || 'Revenue') : (r.vendor_name || r.description || '—');
        const subInfo = r.doc_number ? r.doc_number : '';

        html += `<div style="display:flex;align-items:center;padding:8px 16px;gap:10px;border-bottom:1px solid var(--bd2);font-size:12px;background:${rowBg};${rowOpacity}">`;
        if (isPending) {
          html += `<input type="checkbox" style="accent-color:var(--acc)" data-sdid="${esc(r.id)}" onchange="FinanceSection.sdCheckToggle(this)">`;
        } else {
          html += `<input type="checkbox" disabled checked style="accent-color:var(--acc)">`;
        }
        html += `<span style="font-size:15px;width:22px;text-align:center">${icon}</span>`;
        html += `<div style="flex:1;min-width:0"><div style="font-weight:500">${esc(displayName)}</div><div style="font-size:10px;color:var(--t3);display:flex;gap:6px;align-items:center;margin-top:1px">${docBadge}${subInfo ? '<span>' + esc(subInfo) + '</span>' : ''}${r.description && !isRev && r.vendor_name ? '<span>' + esc(r.description) + '</span>' : ''}</div></div>`;
        html += `<div style="font-weight:700;min-width:80px;text-align:right;color:${amtColor}">${amtSign}${fm(Math.abs(r.amount || 0))}</div>`;
        html += `<div style="min-width:60px;text-align:center">${payBadge}</div>`;
        html += `<div style="min-width:60px;text-align:center">${isPending ? '<span class="sts-warn">Pending</span>' : '<span class="sts-ok">✓ Synced</span>'}</div>`;
        html += `</div>`;
      });

      // Group footer - sync buttons (only if has pending)
      if (pendingItems.length > 0) {
        html += `<div style="display:flex;align-items:center;padding:10px 16px;background:var(--bg2);border-top:1px solid var(--bd2);gap:8px">`;
        html += `<label style="font-size:10px;display:flex;align-items:center;gap:4px;cursor:pointer;color:var(--acc);font-weight:600"><input type="checkbox" style="accent-color:var(--acc)" onchange="FinanceSection.sdSelectGroup(this,${gi})"> Select all (${pendingItems.length})</label>`;
        html += `<div style="flex:1;font-size:10px;color:var(--t3)">${syncedItems.length} of ${totalItems} synced</div>`;
        html += `<button class="btn-primary" style="padding:6px 16px;font-size:12px" onclick="FinanceSection.sdSyncSelected()">Sync selected</button>`;
        html += `</div>`;
      }
      html += `</div></div>`;
    });

    cardsEl.innerHTML = html;

    // Show/hide bottom actions
    _sdUpdateSelCount();

  } catch (e) {
    const cardsEl = document.getElementById('sd_cards');
    if (cardsEl) cardsEl.innerHTML = `<div style="text-align:center;padding:30px;color:var(--red)">Error: ${esc(e.message)}</div>`;
  }
}

function _sdToggleGroup(idx) {
  const el = document.getElementById('sd_grp_' + idx);
  const arr = document.getElementById('sd_arr_' + idx);
  if (!el) return;
  const show = el.style.display === 'none';
  el.style.display = show ? 'block' : 'none';
  if (arr) arr.textContent = show ? '▾' : '▸';
}

function _sdSetFilter(f, btn) {
  _sdFilter = f;
  if (btn) {
    btn.parentElement.querySelectorAll('button').forEach(b => {
      b.style.background = '#fff'; b.style.color = 'var(--t2)'; b.style.borderColor = 'var(--bd)';
    });
    btn.style.background = 'var(--t1)'; btn.style.color = '#fff'; btn.style.borderColor = 'var(--t1)';
  }
  _loadSdBridge();
}

function _sdSetBrandFilter() {
  _sdBrandFilter = document.getElementById('sd_brand')?.value || '';
  _loadSdBridge();
}

function _sdChangeMonth() {
  const el = document.getElementById('sd_month');
  if (el) _sdMonth = el.value;
  _sdChecked = new Set();
  _loadSdBridge();
}

function _sdCheckToggle(cb) {
  const id = cb.dataset.sdid;
  if (cb.checked) _sdChecked.add(id);
  else _sdChecked.delete(id);
  _sdUpdateSelCount();
}

function _sdUpdateSelCount() {
  const el = document.getElementById('sd_sel_count');
  const actEl = document.getElementById('sd_actions');
  if (el) el.textContent = _sdChecked.size + ' selected';
  const hasPending = document.querySelectorAll('[data-sdid]').length > 0;
  if (actEl) actEl.style.display = hasPending ? 'flex' : 'none';
}

/** Select all pending items across all groups */
function _sdSelectAll() {
  document.querySelectorAll('[data-sdid]').forEach(cb => {
    if (!cb.disabled) {
      cb.checked = true;
      _sdChecked.add(cb.dataset.sdid);
    }
  });
  document.querySelectorAll('#sd_cards input[type="checkbox"][onchange*="sdSelectGroup"]').forEach(cb => { cb.checked = true; });
  _sdUpdateSelCount();
}

/** Deselect all */
function _sdDeselectAll() {
  _sdChecked = new Set();
  document.querySelectorAll('[data-sdid]').forEach(cb => { cb.checked = false; });
  document.querySelectorAll('#sd_cards input[type="checkbox"][onchange*="sdSelectGroup"]').forEach(cb => { cb.checked = false; });
  _sdUpdateSelCount();
}

/** Select/deselect all pending items in a specific group */
function _sdSelectGroup(masterCb, groupIdx) {
  const grp = document.getElementById('sd_grp_' + groupIdx);
  if (!grp) return;
  const checkboxes = grp.querySelectorAll('[data-sdid]');
  checkboxes.forEach(cb => {
    if (!cb.disabled) {
      cb.checked = masterCb.checked;
      if (masterCb.checked) _sdChecked.add(cb.dataset.sdid);
      else _sdChecked.delete(cb.dataset.sdid);
    }
  });
  _sdUpdateSelCount();
}

async function _sdSyncSelected() {
  if (_sdChecked.size === 0) { SPG.toast('Please select records to sync', 'error'); return; }
  const ids = Array.from(_sdChecked);

  // Disable buttons during sync
  const btns = document.querySelectorAll('#sd_cards .btn-primary, #sd_actions .btn-primary');
  btns.forEach(b => { b.disabled = true; b.textContent = 'Syncing...'; });

  try {
    const result = await FIN.api('sync_sd', { ids });
    const count = result.synced || ids.length;
    const billNos = (result.created || []).map(c => c.bill_no).filter(Boolean);
    const msg = billNos.length > 0
      ? `Synced ${count} → ${billNos.join(', ')}`
      : `Synced ${count} records`;
    SPG.toast(msg, 'ok');
    _sdChecked = new Set();
    await _loadSdBridge();
  } catch (e) {
    SPG.toast('Sync failed: ' + e.message, 'error');
  } finally {
    btns.forEach(b => { b.disabled = false; b.textContent = 'Sync selected'; });
  }
}


// ═══════════════════════════════════════
// 7. FIND TRANSACTIONS
// ═══════════════════════════════════════
let _findTab = 'dc';

function renderTxFind() {
  _findTab = 'dc';
  const dr = dateRange();

  return SPG.shell(SPG.toolbar('Find Transactions') + `<div class="content" id="fin-tx-find"><div class="card" style="max-width:1000px;margin:0 auto"><div class="tabs" id="find_tabs"><div class="tab a" onclick="FinanceSection.switchFindTab('dc')">Debit and Credit</div><div class="tab" onclick="FinanceSection.switchFindTab('ft')">Find Transaction</div></div><div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px"><div><div class="fl-label">Period</div><select class="fl"><option>This month</option><option>Last month</option></select></div><div><div class="fl-label">Date from</div><input class="fl" type="date" value="${dr.from}" style="width:130px"></div><div><div class="fl-label">Date to</div><input class="fl" type="date" value="${dr.to}" style="width:130px"></div><div><div class="fl-label">Contact</div><select class="fl" style="width:100px"><option>All</option></select></div><div><div class="fl-label">Brand</div><select class="fl" id="find_brand" style="width:140px">${_brandFilterOpts()}</select></div><div><div class="fl-label">Search</div><input class="fl" placeholder="" style="width:100px"></div><div style="flex:1"></div><button class="btn-outline" style="color:var(--acc)">Reset</button></div><div id="find_ct">${ui.skeleton(60, 1)}</div></div></div>`, 'Finance');
}

async function loadTxFind() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadFind();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

async function _loadFind() {
  const el = document.getElementById('find_ct');
  if (el) el.innerHTML = _findTab === 'dc' ? await _findDC() : await _findFT();
}

function _switchFindTab(t) {
  _findTab = t;
  document.querySelectorAll('#find_tabs .tab').forEach(x => x.classList.remove('a'));
  document.querySelectorAll('#find_tabs .tab')[t === 'dc' ? 0 : 1]?.classList.add('a');
  _loadFind();
}

async function _findDC() {
  try {
    const data = await FIN.api('get_debit_credits', {});
    if (!data || data.length === 0) {
      return '<div style="text-align:center;padding:20px;color:var(--t3)">No debit/credit records found</div>';
    }
    const rows = data.map(r => `<tr><td>${fd(r.date)}</td><td style="color:var(--blue)"><a class="lk">${esc(r.debitRef)}</a></td><td><a class="lk">${esc(r.creditRef)}</a></td><td>${esc(r.supplier)}</td><td style="text-align:right;color:var(--blue)">${fm(r.debitAmt)}</td><td style="text-align:right">${fm(r.creditAmt)}</td><td>${ui.badge(r.status === 'Linked' ? 'closed' : 'pending')}</td></tr>`).join('');
    return `<div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:8px">Debit notes paired with linked invoices</div><div class="tbl-wrap"><table class="tbl" id="tbl_find_dc"><thead><tr>${ui.sortTh('tbl_find_dc', 'date', 'Date')}${ui.sortTh('tbl_find_dc', 'debit', 'Debit Note')}${ui.sortTh('tbl_find_dc', 'credit', 'Linked Invoice')}${ui.sortTh('tbl_find_dc', 'supplier', 'Supplier')}${ui.sortTh('tbl_find_dc', 'debitAmt', 'Debit ($)')}${ui.sortTh('tbl_find_dc', 'creditAmt', 'Invoice ($)')}${ui.sortTh('tbl_find_dc', 'status', 'Status')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  } catch (e) {
    return `<div style="text-align:center;padding:20px;color:var(--red)">Error: ${esc(e.message)}</div>`;
  }
}

async function _findFT() {
  try {
    const result = await FIN.api('get_transactions', { type: 'all', page: 1 });
    const data = result.rows || [];
    if (data.length === 0) {
      return '<div style="text-align:center;padding:20px;color:var(--t3)">No transactions found</div>';
    }
    const rows = data.map(r => `<tr><td>${fd(r.date)}</td><td><a class="lk">${esc(r.ref)}</a></td><td>${esc(r.type)}</td><td>${esc(r.desc)}</td><td>${esc(r.contact)}</td><td style="text-align:right">${fm(r.amount)}</td><td>${ui.badge(r.status)}</td></tr>`).join('');
    return `<div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:8px">All transactions</div><div class="tbl-wrap"><table class="tbl" id="tbl_find_ft"><thead><tr>${ui.sortTh('tbl_find_ft', 'date', 'Date')}${ui.sortTh('tbl_find_ft', 'ref', 'Reference')}${ui.sortTh('tbl_find_ft', 'type', 'Type')}${ui.sortTh('tbl_find_ft', 'desc', 'Description')}${ui.sortTh('tbl_find_ft', 'contact', 'Contact')}${ui.sortTh('tbl_find_ft', 'amount', 'Amount ($)')}${ui.sortTh('tbl_find_ft', 'status', 'Status')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  } catch (e) {
    return `<div style="text-align:center;padding:20px;color:var(--red)">Error: ${esc(e.message)}</div>`;
  }
}


// ═══════════════════════════════════════
// REGISTER RENDER/LOAD TO FIN
// ═══════════════════════════════════════
FIN.renderTxLog = renderTxLog;
FIN.loadTxLog = loadTxLog;
FIN.renderTxSale = renderTxSale;
FIN.loadTxSale = loadTxSale;
FIN.renderTxBill = renderTxBill;
FIN.loadTxBill = loadTxBill;
FIN.renderTxReturn = renderTxReturn;
FIN.loadTxReturn = loadTxReturn;
FIN.renderTxBillDetail = renderTxBillDetail;
FIN.loadTxBillDetail = loadTxBillDetail;
FIN.renderTxSaleDetail = renderTxSaleDetail;
FIN.loadTxSaleDetail = loadTxSaleDetail;
FIN.renderTxSd = renderTxSd;
FIN.loadTxSd = loadTxSd;
FIN.renderTxFind = renderTxFind;
FIN.loadTxFind = loadTxFind;


// ═══════════════════════════════════════
// ONCLICK HANDLERS
// ═══════════════════════════════════════
Object.assign(window.FinanceSection, {
  // Log
  filterLog: _filterLog,
  resetLog: _resetLog,
  loadMoreLog: _loadMoreLog,
  // Sales
  filterSales: _filterSales,
  resetSales: _resetSales,
  loadMoreSales: _loadMoreSales,
  openSaleDetail: _openSaleDetail,
  goSaleDetail: _goSaleDetail,
  // Bills
  filterBills: _filterBills,
  resetBills: _resetBills,
  loadMoreBills: _loadMoreBills,
  openBillDetail: _openBillDetail,
  goBillDetail: _goBillDetail,
  // Bill Detail
  switchBdView: _switchBdView,
  deleteBill: _deleteBill,
  _confirmDeleteBill,
  saveBill: _saveBill,
  toggleSaveMenu: _toggleSaveMenu,
  saveAsRecurring: _saveAsRecurring,
  voidBill: _voidBill,
  recordPaymentFromBill: _recordPaymentFromBill,
  // Sale Detail
  saveSale: _saveSale,
  deleteSale: _deleteSale,
  _confirmDeleteSale,
  // Returns
  filterReturns: _filterReturns,
  resetReturns: _resetReturns,
  loadMoreReturns: _loadMoreReturns,
  showDebitDetail: _showDebitDetail,
  // SD Bridge
  sdToggleGroup: _sdToggleGroup,
  sdSetFilter: _sdSetFilter,
  sdSetBrandFilter: _sdSetBrandFilter,
  sdChangeMonth: _sdChangeMonth,
  sdCheckToggle: _sdCheckToggle,
  sdSyncSelected: _sdSyncSelected,
  sdSelectAll: _sdSelectAll,
  sdDeselectAll: _sdDeselectAll,
  sdSelectGroup: _sdSelectGroup,
  // Find
  switchFindTab: _switchFindTab,
});


// ═══════════════════════════════════════
// SORT LISTENER
// ═══════════════════════════════════════
document.addEventListener('spg-sort', (e) => {
  const { tableId, key, dir } = e.detail || {};
  if (!tableId) return;

  // Determine which dataset to sort based on table ID
  let rows, tbody, renderFn;
  if (tableId === 'tbl_log') {
    rows = S._tx_log; tbody = 'log_tbody'; renderFn = _logRows;
  } else if (tableId === 'tbl_sale') {
    rows = S._tx_sale; tbody = 'sale_tbody'; renderFn = _saleRows;
  } else if (tableId === 'tbl_bill') {
    rows = S._bills; tbody = 'bill_tbody'; renderFn = _billRows;
  } else if (tableId === 'tbl_ret') {
    rows = S._tx_return; tbody = 'ret_tbody'; renderFn = _returnRows;
  } else {
    return;
  }

  if (!rows || !rows.length) return;

  const sorted = [...rows].sort((a, b) => {
    let va = a[key], vb = b[key];
    if (typeof va === 'number' && typeof vb === 'number') return dir === 'asc' ? va - vb : vb - va;
    va = String(va || '').toLowerCase();
    vb = String(vb || '').toLowerCase();
    return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const el = document.getElementById(tbody);
  if (el) el.innerHTML = renderFn(sorted);
});

})();
