/**
 * SPG HUB v1.0.0 | 23 MAR 2026 | Siam Palette Group
 * sections/fin_reconcile.js — Finance Module (Reconciliation Screens)
 * 3 routes: rc-stmt, rc-cash, rc-bank
 * Depends on: fin_core.js (FIN global)
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

/** Today as YYYY-MM-DD string (Sydney timezone) */
function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
}

/** Format date with dash fallback */
function fmtD(d) { return fd(d) || '\u2014'; }

const TW = 'max-width:860px;margin:0 auto';

/** Bank account <option> list from S.bankAccounts */
function bankOptions(selected) {
  return (S.bankAccounts || []).map(b =>
    `<option value="${esc(b.id)}"${b.id === selected ? ' selected' : ''}>${esc(b.name)} #${esc(b.account_number || '')}</option>`
  ).join('');
}

/** Brand filter options with "All Brands" default */
function brandFilterOpts() {
  return '<option value="">All Brands</option>' + FIN.brandOpts('');
}


// ═══════════════════════════════════════
// 1. STATEMENT UPLOAD (rc-stmt)
// ═══════════════════════════════════════

let _stmtUploading = false;
let _stmtFormat = 'generic';
let _stmtAccounts = [];
let _stmtAccountFilter = '';

function renderRcStmt() {
  const actions = '';
  return SPG.shell(SPG.toolbar('Statement Upload', actions) + `<div class="content" id="fin-rc-stmt"><div style="${TW}">
    <div class="card">
      <div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:8px">Upload bank statement to reconcile. Stays on this page after upload.</div>
      <div style="background:var(--blue-bg);border-radius:var(--rd);padding:8px 12px;font-size:var(--fs-xxs);color:var(--blue);margin-bottom:10px;line-height:1.6">
        <b>Supported formats:</b> CSV (Westpac, Generic), OFX<br>
        <b>Westpac CSV:</b> Bank Account, Date, Narrative, Debit, Credit, Balance, Categories, Serial<br>
        <b>Generic CSV:</b> Date, Description, Debit, Credit, Balance<br>
        <b>Date format:</b> DD/MM/YYYY or YYYY-MM-DD &nbsp;|&nbsp; <b>Auto-detect:</b> Westpac format detected by 12-digit account number<br>
        <select id="st_template_fmt" style="font-size:var(--fs-xxs);padding:1px 4px;border:1px solid var(--blue);border-radius:4px">
          <option value="westpac">Westpac template</option><option value="generic">Generic template</option>
        </select>
        <a class="lk" style="font-size:var(--fs-xxs);margin-left:4px" href="#" onclick="FinanceSection.downloadTemplate();return false">Download</a>
      </div>
      <div class="fg">
        <label class="lb">Bank Account *</label>
        <select class="inp" id="st_bank" style="max-width:350px">${bankOptions('')}</select>
      </div>
      <div class="fg">
        <label class="lb">File Type</label>
        <select class="inp" id="st_filetype" style="max-width:200px">
          <option value="csv">Bank Statement (CSV)</option>
          <option value="ofx">Bank Statement (OFX)</option>
        </select>
      </div>
      <div id="st_dropzone" style="border:2px dashed var(--bd);border-radius:10px;padding:20px;text-align:center;margin:10px 0;cursor:pointer" onclick="document.getElementById('st_file_input').click()">
        <div style="font-size:20px;color:var(--t4)">\ud83d\udcc4</div>
        <div style="font-size:var(--fs-xs);color:var(--t3)">Drop CSV/OFX here, or <a style="color:var(--acc);font-weight:600">browse</a></div>
        <div id="st_filename" style="font-size:var(--fs-sm);font-weight:600;color:var(--acc);margin-top:4px;display:none"></div>
      </div>
      <input type="file" id="st_file_input" accept=".csv,.ofx" style="display:none" onchange="FinanceSection.onFileSelect(event)">

      <!-- Preview table (hidden until file selected) -->
      <div id="st_preview" style="display:none;margin:10px 0">
        <div style="font-size:var(--fs-sm);font-weight:600;margin-bottom:6px">Preview (<span id="st_row_count">0</span> rows)</div>
        <div style="max-height:300px;overflow:auto;border:1px solid var(--bd);border-radius:var(--rd)">
          <table class="tbl"><thead><tr>
            <th>Date</th><th>Description</th><th style="text-align:right">Debit</th>
            <th style="text-align:right">Credit</th><th style="text-align:right">Balance</th>
          </tr></thead>
          <tbody id="st_preview_body"></tbody>
          </table>
        </div>
      </div>

      <!-- Success message (hidden until upload done) -->
      <div id="st_success" style="background:var(--green-bg);border-radius:var(--rd);padding:10px;font-size:var(--fs-xs);color:var(--green);margin:10px 0;display:none">
        <span id="st_success_msg"></span> <a class="lk" onclick="SPG.go('finance/rc-bank')">Go to Bank Reconcile \u2192</a>
      </div>

      <button class="btn-primary" id="st_upload_btn" style="margin-top:10px" onclick="FinanceSection.uploadStatement()">Upload & Process</button>
    </div>
  </div></div>`, 'Finance');
}

async function loadRcStmt() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

function onFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  S._stmtFile = file;

  // Show filename
  const fnEl = document.getElementById('st_filename');
  if (fnEl) { fnEl.textContent = file.name; fnEl.style.display = ''; }

  // Parse CSV client-side for preview
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result;
    if (typeof text === 'string') {
      S._stmtParsed = parseCsv(text);
      renderPreview();
    }
  };
  reader.readAsText(file);
}

function parseCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  // Try to detect header row
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('date') || header.includes('description') || header.includes('amount') || header.includes('narrative');
  const startIdx = hasHeader ? 1 : 0;

  // Detect Westpac format: first data row col[0] is a 12-digit bank account number
  const firstDataCols = splitCsvLine(lines[startIdx]);
  const isWestpac = firstDataCols.length >= 6 && /^\d{12}$/.test(firstDataCols[0].trim());
  _stmtFormat = isWestpac ? 'westpac' : 'generic';

  const acctSet = new Set();
  const rows = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 3) continue;

    let date = '', desc = '', debit = 0, credit = 0, balance = 0;
    let bank_account = '', bank_category = '';

    if (isWestpac) {
      // Westpac 8-col: Bank Account, Date, Narrative, Debit Amount, Credit Amount, Balance, Categories, Serial
      bank_account = cols[0].trim();
      date = cols[1].trim();
      desc = cols[2].trim();
      debit = Math.abs(parseFloat(cols[3].replace(/[,$"]/g, '')) || 0);
      credit = Math.abs(parseFloat(cols[4].replace(/[,$"]/g, '')) || 0);
      balance = parseFloat(cols[5].replace(/[,$"]/g, '')) || 0;
      bank_category = (cols[6] || '').trim();
      acctSet.add(bank_account);
    } else if (cols.length >= 5) {
      // Format A: Date, Description, Debit, Credit, Balance
      date = cols[0].trim();
      desc = cols[1].trim();
      debit = Math.abs(parseFloat(cols[2].replace(/[,$"]/g, '')) || 0);
      credit = Math.abs(parseFloat(cols[3].replace(/[,$"]/g, '')) || 0);
      balance = parseFloat(cols[4].replace(/[,$"]/g, '')) || 0;
    } else if (cols.length >= 4) {
      // Format B: Date, Desc, Amount, Balance
      date = cols[0].trim();
      desc = cols[1].trim();
      const amt = parseFloat(cols[2].replace(/[,$"]/g, '')) || 0;
      if (amt < 0) debit = Math.abs(amt);
      else credit = amt;
      balance = parseFloat(cols[3].replace(/[,$"]/g, '')) || 0;
    } else {
      // Format C: Date, Amount, Description
      date = cols[0].trim();
      const amt = parseFloat(cols[1].replace(/[,$"]/g, '')) || 0;
      desc = cols[2]?.trim() || '';
      if (amt < 0) debit = Math.abs(amt);
      else credit = amt;
    }

    // Normalize date (try DD/MM/YYYY or YYYY-MM-DD)
    date = normalizeDate(date);
    if (!date) continue;

    const row = { date, description: desc, debit, credit, balance };
    if (isWestpac) {
      row.bank_account = bank_account;
      row.bank_category = bank_category;
    }
    rows.push(row);
  }

  _stmtAccounts = [...acctSet];
  return rows;
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { result.push(current); current = ''; continue; }
    current += ch;
  }
  result.push(current);
  return result;
}

function normalizeDate(str) {
  if (!str) return '';
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // DD/MM/YYYY
  const m1 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
  // DD/MM/YY
  const m2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m2) return `20${m2[3]}-${m2[2].padStart(2, '0')}-${m2[1].padStart(2, '0')}`;
  return '';
}

function renderPreview() {
  const tbody = document.getElementById('st_preview_body');
  const countEl = document.getElementById('st_row_count');
  const previewDiv = document.getElementById('st_preview');
  if (!tbody || !previewDiv) return;

  previewDiv.style.display = '';
  if (countEl) countEl.textContent = S._stmtParsed.length;

  const isW = _stmtFormat === 'westpac';
  const colSpan = isW ? 7 : 5;

  // Update table header based on format
  const thead = previewDiv.querySelector('thead tr');
  if (thead) {
    thead.innerHTML = isW
      ? '<th>Account</th><th>Date</th><th>Narrative</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th><th>Category</th>'
      : '<th>Date</th><th>Description</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th>';
  }

  // Show account filter if multiple accounts detected
  let acctNotice = '';
  if (isW && _stmtAccounts.length > 1) {
    acctNotice = `<tr><td colspan="${colSpan}" style="background:var(--orange-bg);color:var(--orange);font-size:var(--fs-xxs);padding:6px 10px">
      Detected ${_stmtAccounts.length} accounts in file: ${_stmtAccounts.map(a => '<b>#' + esc(a) + '</b>').join(', ')}
      \u2014 filter: <select id="st_acct_filter" onchange="FinanceSection.filterByAccount(this.value)" style="font-size:var(--fs-xxs);padding:1px 4px;border:1px solid var(--orange);border-radius:4px">
        <option value="">All accounts (${S._stmtParsed.length} rows)</option>
        ${_stmtAccounts.map(a => {
          const cnt = S._stmtParsed.filter(r => r.bank_account === a).length;
          return '<option value="' + esc(a) + '">#' + esc(a) + ' (' + cnt + ' rows)</option>';
        }).join('')}
      </select>
    </td></tr>`;
  } else if (isW && _stmtAccounts.length === 1) {
    acctNotice = `<tr><td colspan="${colSpan}" style="background:var(--green-bg);color:var(--green);font-size:var(--fs-xxs);padding:6px 10px">
      Westpac format detected \u2014 Account <b>#${esc(_stmtAccounts[0])}</b> \u2014 ${S._stmtParsed.length} rows
    </td></tr>`;
  }

  // Show first 20 rows
  const rows = S._stmtParsed.slice(0, 20);
  tbody.innerHTML = acctNotice + rows.map(r => isW
    ? `<tr>
        <td style="font-size:var(--fs-xxs);color:var(--t3);font-family:monospace">${esc(r.bank_account || '')}</td>
        <td style="white-space:nowrap">${fmtD(r.date)}</td>
        <td style="font-size:var(--fs-xxs);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.description)}">${esc(r.description)}</td>
        <td style="text-align:right${r.debit > 0 ? ';color:var(--red)' : ''}">${r.debit > 0 ? fm(r.debit) : ''}</td>
        <td style="text-align:right${r.credit > 0 ? ';color:var(--green)' : ''}">${r.credit > 0 ? fm(r.credit) : ''}</td>
        <td style="text-align:right;font-weight:600">${fm(r.balance)}</td>
        <td><span style="font-size:var(--fs-xxs);padding:1px 6px;border-radius:8px;background:var(--bg2);color:var(--t3)">${esc(r.bank_category || '')}</span></td>
      </tr>`
    : `<tr>
        <td style="white-space:nowrap">${fmtD(r.date)}</td>
        <td>${esc(r.description)}</td>
        <td style="text-align:right${r.debit > 0 ? ';color:var(--red)' : ''}">${r.debit > 0 ? fm(r.debit) : ''}</td>
        <td style="text-align:right${r.credit > 0 ? ';color:var(--green)' : ''}">${r.credit > 0 ? fm(r.credit) : ''}</td>
        <td style="text-align:right;font-weight:600">${fm(r.balance)}</td>
      </tr>`
  ).join('');

  if (S._stmtParsed.length > 20) {
    tbody.innerHTML += `<tr><td colspan="${colSpan}" style="text-align:center;color:var(--t3);font-size:var(--fs-xs)">... and ${S._stmtParsed.length - 20} more rows</td></tr>`;
  }
}

// Filter preview by account (Westpac multi-account)
function filterByAccount(acct) {
  _stmtAccountFilter = acct;
  const tbody = document.getElementById('st_preview_body');
  const countEl = document.getElementById('st_row_count');
  if (!tbody) return;

  const filtered = acct ? S._stmtParsed.filter(r => r.bank_account === acct) : S._stmtParsed;
  if (countEl) countEl.textContent = filtered.length;

  const rows = filtered.slice(0, 20);
  // Keep the account notice row
  const noticeRow = tbody.querySelector('tr:first-child td[colspan]');
  const noticeHtml = noticeRow ? noticeRow.parentElement.outerHTML : '';

  const isW = _stmtFormat === 'westpac';
  const colSpan = isW ? 7 : 5;
  tbody.innerHTML = noticeHtml + rows.map(r => isW ? `<tr>
    <td style="font-size:var(--fs-xxs);color:var(--t3);font-family:monospace">${esc(r.bank_account || '')}</td>
    <td style="white-space:nowrap">${fmtD(r.date)}</td>
    <td style="font-size:var(--fs-xxs);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.description)}">${esc(r.description)}</td>
    <td style="text-align:right${r.debit > 0 ? ';color:var(--red)' : ''}">${r.debit > 0 ? fm(r.debit) : ''}</td>
    <td style="text-align:right${r.credit > 0 ? ';color:var(--green)' : ''}">${r.credit > 0 ? fm(r.credit) : ''}</td>
    <td style="text-align:right;font-weight:600">${fm(r.balance)}</td>
    <td><span style="font-size:var(--fs-xxs);padding:1px 6px;border-radius:8px;background:var(--bg2);color:var(--t3)">${esc(r.bank_category || '')}</span></td>
  </tr>` : `<tr>
    <td style="white-space:nowrap">${fmtD(r.date)}</td>
    <td style="font-size:var(--fs-xxs);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.description)}">${esc(r.description)}</td>
    <td style="text-align:right${r.debit > 0 ? ';color:var(--red)' : ''}">${r.debit > 0 ? fm(r.debit) : ''}</td>
    <td style="text-align:right${r.credit > 0 ? ';color:var(--green)' : ''}">${r.credit > 0 ? fm(r.credit) : ''}</td>
    <td style="text-align:right;font-weight:600">${fm(r.balance)}</td>
  </tr>`).join('');

  if (filtered.length > 20) {
    tbody.innerHTML += `<tr><td colspan="${colSpan}" style="text-align:center;color:var(--t3);font-size:var(--fs-xs)">... and ${filtered.length - 20} more rows</td></tr>`;
  }

  // Restore filter selection
  const sel = document.getElementById('st_acct_filter');
  if (sel) sel.value = acct;
}

async function uploadStatement() {
  if (_stmtUploading) return;
  if (S._stmtParsed.length === 0) return SPG.toast('Please select a CSV file first', 'error');

  const bankId = document.getElementById('st_bank')?.value;
  if (!bankId) return SPG.toast('Please select a bank account', 'error');

  // Filter by selected account if Westpac multi-account
  let rowsToUpload = S._stmtParsed;
  if (_stmtFormat === 'westpac' && _stmtAccountFilter) {
    rowsToUpload = S._stmtParsed.filter(r => r.bank_account === _stmtAccountFilter);
  }
  if (rowsToUpload.length === 0) return SPG.toast('No rows to upload for selected account', 'error');

  _stmtUploading = true;
  const btn = document.getElementById('st_upload_btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }

  try {
    SPG.showLoader();
    const result = await FIN.api('fin_upload_statement', {
      bank_account_id: bankId,
      source_file: S._stmtFile?.name || 'upload.csv',
      rows: rowsToUpload,
      format: _stmtFormat,
    });

    // Show success
    const successEl = document.getElementById('st_success');
    const msgEl = document.getElementById('st_success_msg');
    if (successEl) successEl.style.display = '';
    if (msgEl) msgEl.textContent = `\u2713 Upload successful \u2014 ${result.imported || S._stmtParsed.length} transactions imported.`;

    SPG.toast('Statement uploaded');
  } catch (e) {
    SPG.toast('Error: ' + e.message, 'error');
  } finally {
    _stmtUploading = false;
    SPG.hideLoader();
    if (btn) { btn.disabled = false; btn.textContent = 'Upload & Process'; }
  }
}

function downloadTemplate() {
  const fmt = document.getElementById('st_template_fmt')?.value || 'generic';
  let csv, filename;
  if (fmt === 'westpac') {
    csv = 'Bank Account,Date,Narrative,Debit Amount,Credit Amount,Balance,Categories,Serial\n'
      + '032135835976,19/03/2026,"MERCHANT SETTLEMENT 0970001 ISSHO CAFE PTY LTD  0001  HAYMARKET",,8286.65,47109.45,DEP,\n'
      + '032135835976,18/03/2026,"WITHDRAWAL ONLINE MULTI 1548656 PYMT EP000236 P PAYMENT",10793.20,,36106.92,PAYMENT,\n'
      + '032135835941,18/03/2026,"DEBIT CARD PURCHASE COLES 0710 SYDNEY       AUS Card No. ~007002",90.00,,3984.20,PAYMENT,\n'
      + '032135835976,18/03/2026,"DEPOSIT UBER B.V.        STORE ID 241220ISS",,361.24,53424.91,DEP,';
    filename = 'westpac_statement_template.csv';
  } else {
    csv = 'Date,Description,Debit,Credit,Balance\n17/03/2026,Example transaction,100.00,,5000.00\n18/03/2026,Another transaction,,50.00,5050.00';
    filename = 'bank_statement_template.csv';
  }
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}


// ═══════════════════════════════════════
// 2. CASH COLLECTION (rc-cash)
// ═══════════════════════════════════════

let _cashTab = 'stmt'; // stmt | collect | history

function renderRcCash() {
  const actions = `
    <select class="fl" id="cr_account" onchange="FinanceSection.switchCashAccount(this.value)" style="min-width:200px">${bankOptions('')}</select>
    <select class="fl" id="cr_brand" style="width:140px">${brandFilterOpts()}</select>
    <button class="btn-outline" onclick="FinanceSection.showJournalEntry()">+ Journal Entry</button>
    <button class="btn-primary" onclick="FinanceSection.switchCashTab('collect')">Record Collection</button>`;

  return SPG.shell(SPG.toolbar('Cash Reconcile', actions) + `<div class="content" id="fin-rc-cash"><div style="max-width:1000px;margin:0 auto">
    <!-- Balance banner -->
    <div id="cr_banner" class="card" style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:var(--fs-xs);color:var(--t3)">Confirmed Cash Balance</div>
        <div style="font-size:var(--fs-kpi-xl);font-weight:800" id="cr_balance">\u2014</div>
        <div style="font-size:var(--fs-xs);color:var(--t3)" id="cr_account_label">\u2014</div>
      </div>
      <div style="text-align:right">
        <div style="display:flex;gap:16px;font-size:var(--fs-xs)">
          <div><span style="color:var(--green)">\u25b2 In</span><div style="font-size:var(--fs-kpi-md);font-weight:700;color:var(--green)" id="cr_in">\u2014</div></div>
          <div><span style="color:var(--red)">\u25bc Out</span><div style="font-size:var(--fs-kpi-md);font-weight:700;color:var(--red)" id="cr_out">\u2014</div></div>
        </div>
        <div style="font-size:var(--fs-xxs);color:var(--orange);margin-top:4px" id="cr_last_collect">\u2014</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs" id="cr_tabs">
      <div class="tab${_cashTab === 'stmt' ? ' a' : ''}" onclick="FinanceSection.switchCashTab('stmt')">Statement</div>
      <div class="tab${_cashTab === 'collect' ? ' a' : ''}" onclick="FinanceSection.switchCashTab('collect')">Collect</div>
      <div class="tab${_cashTab === 'history' ? ' a' : ''}" onclick="FinanceSection.switchCashTab('history')">History</div>
    </div>

    <!-- Statement tab -->
    <div id="cr_stmt_tab">
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">
        <input class="fl" type="date" id="cr_from" style="width:120px">
        <span style="font-size:var(--fs-xs);color:var(--t3)">to</span>
        <input class="fl" type="date" id="cr_to" value="${today()}" style="width:120px">
      </div>
      <div class="card" style="padding:0;overflow:hidden;margin:0">
        <div class="tbl-wrap"><table class="tbl" id="cr_stmt_tbl"><thead><tr>
          ${ui.sortTh('cr_stmt_tbl','date','Date')}${ui.sortTh('cr_stmt_tbl','type','Type')}${ui.sortTh('cr_stmt_tbl','desc','Description')}${ui.sortTh('cr_stmt_tbl','ref','Ref')}
          ${ui.sortTh('cr_stmt_tbl','in','In ($)')}${ui.sortTh('cr_stmt_tbl','out','Out ($)')}
          ${ui.sortTh('cr_stmt_tbl','balance','Balance ($)')}
        </tr></thead>
        <tbody id="cr_stmt_body">${ui.skeleton(60, 7)}</tbody>
        </table></div>
      </div>
    </div>

    <!-- Collect tab -->
    <div id="cr_collect_tab" style="display:none">
      <div class="card" style="border:2px solid var(--acc);max-width:600px;margin:0 auto">
        <div style="font-size:var(--fs-body);font-weight:700;color:var(--acc);margin-bottom:10px">Record Collection</div>
        <div style="text-align:center;margin-bottom:12px">
          <div style="font-size:var(--fs-xs);color:var(--t3)">System expects</div>
          <div style="font-size:var(--fs-kpi-xl);font-weight:800" id="cr_expected">\u2014</div>
          <div style="font-size:var(--fs-xs);color:var(--t3)">in the cash drawer right now</div>
        </div>
        <div class="fr">
          <div class="fg">
            <label class="lb">Collection Date</label>
            <input class="inp" type="date" id="cr_collect_date" value="${today()}">
          </div>
          <div class="fg">
            <label class="lb">Cash Counted *</label>
            <input class="inp" id="cr_counted" type="number" step="0.01" min="0" style="font-weight:700;font-size:var(--fs-kpi-md);text-align:right" oninput="FinanceSection.updateVariance()">
          </div>
        </div>
        <div class="fg">
          <label class="lb">Destination</label>
          <select class="inp" id="cr_destination">
            <option value="deposit">Deposit to Bank</option>
            <option value="keep">Keep as Cash on Hand</option>
          </select>
        </div>
        <div id="cr_variance_box" style="background:var(--bg3);border-radius:var(--rd);padding:10px;margin-top:8px;display:none">
          <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);padding:2px 0"><span>Expected</span><b id="cr_var_expected">\u2014</b></div>
          <div style="display:flex;justify-content:space-between;font-size:var(--fs-sm);padding:2px 0"><span>Counted</span><b id="cr_var_counted">\u2014</b></div>
          <div id="cr_var_diff_row" style="display:flex;justify-content:space-between;font-size:var(--fs-h1);font-weight:700;padding:4px 0;border-top:2px solid var(--bd);margin-top:4px">
            <span id="cr_var_label">Difference</span><span id="cr_var_diff">\u2014</span>
          </div>
        </div>
        <div style="display:flex;gap:6px;margin-top:12px">
          <button class="btn-primary" style="flex:1;padding:10px" id="cr_collect_btn" onclick="FinanceSection.confirmCollection()">Confirm & Deposit</button>
          <button class="btn-outline" onclick="FinanceSection.switchCashTab('stmt')">Cancel</button>
        </div>
      </div>
    </div>

    <!-- History tab -->
    <div id="cr_history_tab" style="display:none">
      <div class="card" style="padding:0;overflow:hidden;margin:0">
        <div class="tbl-wrap"><table class="tbl" id="cr_hist_tbl"><thead><tr>
          ${ui.sortTh('cr_hist_tbl','date','Date')}${ui.sortTh('cr_hist_tbl','expected','Expected')}
          ${ui.sortTh('cr_hist_tbl','counted','Counted')}${ui.sortTh('cr_hist_tbl','variance','Variance')}
          ${ui.sortTh('cr_hist_tbl','dest','Destination')}${ui.sortTh('cr_hist_tbl','journal','Journal')}${ui.sortTh('cr_hist_tbl','status','Status')}
        </tr></thead>
        <tbody id="cr_history_body">${ui.skeleton(60, 7)}</tbody>
        </table></div>
      </div>
    </div>
  </div></div>`, 'Finance');
}

async function loadRcCash() {
  _cashTab = 'stmt';
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    SPG.showLoader();
    const bankId = document.getElementById('cr_account')?.value || '';
    if (!bankId) { SPG.hideLoader(); return; }
    const data = await FIN.api('fin_get_cash_recon', { bank_account_id: bankId });
    S._cashData = data;
    renderCashBanner();
    renderCashStatement();
    renderCashHistory();
  } catch (e) {
    SPG.toast(e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}

function renderCashBanner() {
  const d = S._cashData;
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText('cr_balance', fm(d.balance || 0));
  setText('cr_account_label', d.account_label || '\u2014');
  setText('cr_in', fm(d.total_in || 0));
  setText('cr_out', fm(d.total_out || 0));
  setText('cr_last_collect', d.days_since_collect ? d.days_since_collect + ' days since last collection' : '\u2014');
  setText('cr_expected', fm(d.balance || 0));
  const varExp = document.getElementById('cr_var_expected');
  if (varExp) varExp.textContent = fm(d.balance || 0);
}

function renderCashStatement() {
  const tbody = document.getElementById('cr_stmt_body');
  if (!tbody) return;
  const rows = S._cashData.statement || [];
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--t3)">No transactions found</td></tr>`;
    return;
  }
  let runBal = 0;
  tbody.innerHTML = rows.map(r => {
    const isIn = (r.credit || 0) > 0;
    const typeBadge = isIn
      ? '<span class="sts-ok" style="font-size:var(--fs-xxs);padding:1px 6px;border-radius:4px">Sale</span>'
      : '<span class="sts-err" style="font-size:var(--fs-xxs);padding:1px 6px;border-radius:4px">Expense</span>';
    runBal = r.balance || runBal;
    return `<tr>
      <td>${fmtD(r.date || r.statement_date)}</td>
      <td>${typeBadge}</td>
      <td>${esc(r.description || '')}</td>
      <td style="font-size:var(--fs-xs);color:var(--acc)">${esc(r.reference || r.ref || '')}</td>
      <td style="text-align:right;color:var(--green);font-weight:600">${r.credit > 0 ? '+' + fm(r.credit) : ''}</td>
      <td style="text-align:right;color:var(--red)">${r.debit > 0 ? '-' + fm(r.debit) : ''}</td>
      <td style="text-align:right;font-weight:600">${fm(runBal)}</td>
    </tr>`;
  }).join('');
}

function renderCashHistory() {
  const tbody = document.getElementById('cr_history_body');
  if (!tbody) return;
  const rows = S._cashData.collections || [];
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--t3)">No collection history</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const variance = (r.counted || 0) - (r.expected || 0);
    const varColor = variance === 0 ? 'var(--green)' : 'var(--red)';
    return `<tr>
      <td>${fmtD(r.date)}</td>
      <td style="text-align:right">${fm(r.expected || 0)}</td>
      <td style="text-align:right">${fm(r.counted || 0)}</td>
      <td style="text-align:right;color:${varColor};font-weight:600">${variance === 0 ? '$0' : (variance > 0 ? '+' : '') + fm(variance)}</td>
      <td>${esc(r.destination || '\u2014')}</td>
      <td>${r.journal_ref ? '<a class="lk">' + esc(r.journal_ref) + '</a>' : '<span style="color:var(--t4)">\u2014</span>'}</td>
      <td><span class="sts-ok" style="font-size:var(--fs-xxs);padding:1px 6px;border-radius:4px">Confirmed</span></td>
    </tr>`;
  }).join('');
}

function switchCashTab(tab) {
  _cashTab = tab;
  ['stmt', 'collect', 'history'].forEach(t => {
    const el = document.getElementById('cr_' + t + '_tab');
    if (el) el.style.display = t === tab ? '' : 'none';
  });
  // Update tab active state
  const tabs = document.getElementById('cr_tabs');
  if (tabs) {
    tabs.querySelectorAll('.tab').forEach((el, i) => {
      const tabIds = ['stmt', 'collect', 'history'];
      el.className = 'tab' + (tabIds[i] === tab ? ' a' : '');
    });
  }
}

function switchCashAccount(val) {
  loadRcCashData(val);
}

async function loadRcCashData(bankId) {
  try {
    SPG.showLoader();
    if (!bankId) { SPG.hideLoader(); return; }
    const data = await FIN.api('fin_get_cash_recon', { bank_account_id: bankId });
    S._cashData = data;
    renderCashBanner();
    renderCashStatement();
    renderCashHistory();
  } catch (e) {
    SPG.toast(e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}

function updateVariance() {
  const counted = parseFloat(document.getElementById('cr_counted')?.value) || 0;
  const expected = S._cashData.balance || 0;
  const diff = counted - expected;

  const box = document.getElementById('cr_variance_box');
  if (box) box.style.display = counted > 0 ? '' : 'none';

  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setText('cr_var_counted', fm(counted));
  setText('cr_var_expected', fm(expected));

  const diffEl = document.getElementById('cr_var_diff');
  const labelEl = document.getElementById('cr_var_label');
  const diffRow = document.getElementById('cr_var_diff_row');
  if (diffEl) diffEl.textContent = (diff >= 0 ? '+' : '') + fm(diff);
  if (labelEl) labelEl.textContent = diff === 0 ? 'Exact' : diff > 0 ? 'Over' : 'Short';
  if (diffRow) diffRow.style.color = diff === 0 ? 'var(--green)' : 'var(--red)';
}

async function confirmCollection() {
  const counted = parseFloat(document.getElementById('cr_counted')?.value);
  if (isNaN(counted) || counted < 0) return SPG.toast('Please enter cash counted amount', 'error');

  const bankId = document.getElementById('cr_account')?.value;
  const collectDate = document.getElementById('cr_collect_date')?.value || today();
  const destination = document.getElementById('cr_destination')?.value || 'deposit';

  const btn = document.getElementById('cr_collect_btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing...'; }

  try {
    SPG.showLoader();
    await FIN.api('fin_record_cash_collection', {
      bank_account_id: bankId,
      collection_date: collectDate,
      counted_amount: counted,
      expected_amount: S._cashData.balance || 0,
      destination,
    });
    SPG.toast('Collection recorded');
    switchCashTab('history');
    await loadRcCashData(bankId);
  } catch (e) {
    SPG.toast('Error: ' + e.message, 'error');
  } finally {
    SPG.hideLoader();
    if (btn) { btn.disabled = false; btn.textContent = 'Confirm & Deposit'; }
  }
}

function showJournalEntry() {
  SPG.go('finance/ac-journal');
}


// ═══════════════════════════════════════
// 3. BANK RECONCILIATION (rc-bank)
// ═══════════════════════════════════════

function renderRcBank() {
  const actions = `
    <select class="fl" id="rc_bank" onchange="FinanceSection.switchRcBank(this.value)" style="min-width:200px">${bankOptions('')}</select>
    <select class="fl" id="rc_brand" style="width:140px">${brandFilterOpts()}</select>
    <button class="btn-outline" onclick="SPG.go('finance/rc-stmt')">Upload Statement</button>
    <button class="btn-primary" id="rc_automatch_btn" onclick="FinanceSection.runAutoMatch()">Auto-Match</button>`;

  return SPG.shell(SPG.toolbar('Bank Reconciliation', actions) + `<div class="content" id="fin-rc-bank"><div style="max-width:1060px;margin:0 auto">
    <!-- Filter bar -->
    <div style="display:flex;gap:4px;margin-bottom:8px;align-items:center;flex-wrap:wrap">
      <input class="fl" type="date" id="rc_from" style="width:120px">
      <span style="font-size:var(--fs-xs);color:var(--t3)">to</span>
      <input class="fl" type="date" id="rc_to" value="${today()}" style="width:120px">
      <div style="display:flex;gap:3px;margin-left:12px">
        <button class="btn-outline rc-flt${S._rcFilter === 'all' ? ' rc-flt-a' : ''}" onclick="FinanceSection.setRcFilter('all')" id="rc_f_all">All</button>
        <button class="btn-outline rc-flt${S._rcFilter === 'unmatched' ? ' rc-flt-a' : ''}" onclick="FinanceSection.setRcFilter('unmatched')" id="rc_f_unmatched">Unmatched</button>
        <button class="btn-outline rc-flt${S._rcFilter === 'matched' ? ' rc-flt-a' : ''}" onclick="FinanceSection.setRcFilter('matched')" id="rc_f_matched">Matched</button>
      </div>
      <span style="margin-left:auto;font-size:var(--fs-xs);color:var(--t2)" id="rc_summary">\u2014</span>
    </div>

    <!-- Column headers -->
    <div style="display:grid;grid-template-columns:1fr 36px 1fr;margin-bottom:4px;font-size:var(--fs-xs);font-weight:600;color:var(--t3)">
      <div style="padding:0 10px">BANK STATEMENT</div>
      <div></div>
      <div style="padding:0 10px">SYSTEM MATCH</div>
    </div>

    <!-- Rows container -->
    <div id="rc_rows">
      <div style="text-align:center;padding:40px;color:var(--t3)">Loading...</div>
    </div>
  </div></div>`, 'Finance');
}

async function loadRcBank() {
  S._rcFilter = 'all';
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    SPG.showLoader();
    const bankId = document.getElementById('rc_bank')?.value || '';
    const data = await FIN.api('fin_get_bank_recon', {
      bank_account_id: bankId,
      date_from: document.getElementById('rc_from')?.value || undefined,
      date_to: document.getElementById('rc_to')?.value || undefined,
    });
    S._rcStmtLines = data.lines || [];
    S._rcMatches = data.matches || [];
    S._rcSummary = data.summary || {};
    renderRcSummary();
    renderRcRows();
  } catch (e) {
    SPG.toast(e.message, 'error');
    const el = document.getElementById('rc_rows');
    if (el) el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--t3)">No statement data. <a class="lk" onclick="SPG.go('finance/rc-stmt')">Upload a statement first \u2192</a></div>`;
  } finally {
    SPG.hideLoader();
  }
}

function renderRcSummary() {
  const s = S._rcSummary;
  const el = document.getElementById('rc_summary');
  if (el) {
    el.innerHTML = `Bank <b>${fm(s.bank_total || 0)}</b> \u00b7 System <b>${fm(s.system_total || 0)}</b> \u00b7 <b style="color:var(--red)">Diff ${fm(Math.abs((s.bank_total || 0) - (s.system_total || 0)))}</b>`;
  }
  // Update filter counts
  const all = S._rcStmtLines.length;
  const matched = S._rcStmtLines.filter(l => l.is_matched).length;
  const unmatched = all - matched;
  const setText = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  setText('rc_f_all', `All (${all})`);
  setText('rc_f_unmatched', `Unmatched (${unmatched})`);
  setText('rc_f_matched', `Matched (${matched})`);
}

function renderRcRows() {
  const container = document.getElementById('rc_rows');
  if (!container) return;

  let lines = S._rcStmtLines;
  if (S._rcFilter === 'matched') lines = lines.filter(l => l.is_matched);
  else if (S._rcFilter === 'unmatched') lines = lines.filter(l => !l.is_matched);

  if (lines.length === 0) {
    container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--t3)">${S._rcFilter === 'unmatched' ? 'All matched!' : 'No statement lines found.'} <a class="lk" onclick="SPG.go('finance/rc-stmt')">Upload statement \u2192</a></div>`;
    return;
  }

  container.innerHTML = lines.map(line => {
    const isMatched = line.is_matched;
    const match = S._rcMatches.find(m => m.statement_line_id === line.id);
    const borderColor = isMatched ? 'var(--green)' : 'var(--orange)';
    const bgColor = isMatched ? 'rgba(5,150,105,.03)' : 'rgba(217,119,6,.04)';
    const amount = (line.credit || 0) > 0 ? (line.credit) : -(line.debit || 0);
    const amtColor = amount >= 0 ? 'var(--green)' : 'var(--red)';

    // Left side - Bank statement
    const leftHtml = `<div style="border:1.5px solid ${borderColor};background:${bgColor};border-radius:var(--rd);padding:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:2px">
        <span style="font-size:var(--fs-xs);color:var(--t3)">${fmtD(line.statement_date)}</span>
        <span style="font-weight:700${amtColor ? ';color:' + amtColor : ''}">${amount >= 0 ? '+' : ''}${fm(Math.abs(amount))}</span>
      </div>
      <div style="font-weight:600;font-size:var(--fs-xs)">${esc(line.description || '')}</div>
    </div>`;

    // Middle - match indicator
    const midHtml = isMatched
      ? `<span style="background:var(--green);color:#fff;font-size:var(--fs-xxs);font-weight:700;padding:3px 8px;border-radius:4px">OK</span>`
      : `<span style="font-size:var(--fs-h1);color:var(--orange)">\u2192</span>`;

    // Right side - System match or actions
    let rightHtml;
    if (isMatched && match) {
      const statusBadge = match.match_status === 'confirmed'
        ? '<span style="font-size:var(--fs-xxs);color:var(--green);border:1px solid var(--green);padding:1px 6px;border-radius:3px">Confirmed</span>'
        : '<span style="font-size:var(--fs-xxs);color:var(--t3);border:1px solid var(--bd);padding:1px 6px;border-radius:3px">Pending confirm</span>';
      const typeBadge = match.match_type === 'auto'
        ? '<span style="font-size:var(--fs-xxs);color:#fff;background:var(--blue);padding:1px 6px;border-radius:3px">Auto-matched</span>'
        : match.match_type === 'group'
          ? '<span style="font-size:var(--fs-xxs);color:#fff;background:var(--acc);padding:1px 6px;border-radius:3px">Group Match</span>'
          : '<span style="font-size:var(--fs-xxs);color:#fff;background:var(--t3);padding:1px 6px;border-radius:3px">Manual</span>';

      const confirmBtn = match.match_status !== 'confirmed'
        ? ` <button class="btn-primary" style="padding:3px 10px;font-size:var(--fs-xxs)" onclick="FinanceSection.confirmMatch('${esc(match.id)}')">Confirm</button>`
        : '';

      rightHtml = `<div style="border:1.5px solid ${borderColor};background:${bgColor};border-radius:var(--rd);padding:10px">
        <div style="display:flex;gap:4px;margin-bottom:2px">${typeBadge} ${statusBadge}</div>
        <div style="font-size:var(--fs-xs)">${esc(match.tx_ref || '')} \u00b7 ${esc(match.tx_payee || '')}</div>
        <div style="font-size:var(--fs-xxs);color:var(--t3)">${esc(match.tx_category || '')}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span style="font-weight:700">${fm(match.matched_amount || 0)}</span>${confirmBtn}
        </div>
      </div>`;
    } else {
      // Unmatched - show action buttons
      rightHtml = `<div style="border:1.5px solid var(--orange);background:rgba(217,119,6,.04);border-radius:var(--rd);padding:10px">
        <div style="display:flex;gap:4px;margin-bottom:6px">
          <span style="font-size:var(--fs-xxs);color:var(--t3);border:1px solid var(--bd);padding:1px 8px;border-radius:4px;cursor:pointer" onclick="FinanceSection.manualMatch('${line.id}')">Match</span>
          <span style="font-size:var(--fs-xxs);color:var(--orange);font-weight:600;border:1px solid var(--orange);padding:1px 8px;border-radius:4px;background:var(--orange-bg);cursor:pointer" onclick="FinanceSection.createAndMatch('${line.id}')">Create</span>
          <span style="font-size:var(--fs-xxs);color:var(--t3);border:1px solid var(--bd);padding:1px 8px;border-radius:4px;cursor:pointer">Transfer</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:var(--fs-xs);color:var(--t3)">${fm(Math.abs(amount))}</span>
          <button class="btn-primary" style="padding:4px 12px;font-size:var(--fs-xs)" onclick="FinanceSection.createAndMatch('${line.id}')">Create & Match</button>
        </div>
      </div>`;
    }

    return `<div style="display:grid;grid-template-columns:1fr 36px 1fr;margin-bottom:6px;align-items:stretch">
      ${leftHtml}
      <div style="display:flex;align-items:center;justify-content:center">${midHtml}</div>
      ${rightHtml}
    </div>`;
  }).join('');
}

function setRcFilter(f) {
  S._rcFilter = f;
  document.querySelectorAll('.rc-flt').forEach(el => el.classList.remove('rc-flt-a'));
  const active = document.getElementById('rc_f_' + f);
  if (active) active.classList.add('rc-flt-a');
  renderRcRows();
}

function switchRcBank(val) {
  S._rcBankId = val;
  loadRcBankData();
}

async function loadRcBankData() {
  try {
    SPG.showLoader();
    const bankId = document.getElementById('rc_bank')?.value || '';
    const data = await FIN.api('fin_get_bank_recon', {
      bank_account_id: bankId,
      date_from: document.getElementById('rc_from')?.value || undefined,
      date_to: document.getElementById('rc_to')?.value || undefined,
    });
    S._rcStmtLines = data.lines || [];
    S._rcMatches = data.matches || [];
    S._rcSummary = data.summary || {};
    renderRcSummary();
    renderRcRows();
  } catch (e) {
    SPG.toast(e.message, 'error');
    const el = document.getElementById('rc_rows');
    if (el) el.innerHTML = `<div style="text-align:center;padding:40px;color:var(--t3)">No statement data. <a class="lk" onclick="SPG.go('finance/rc-stmt')">Upload a statement first \u2192</a></div>`;
  } finally {
    SPG.hideLoader();
  }
}

async function runAutoMatch() {
  const bankId = document.getElementById('rc_bank')?.value;
  if (!bankId) return SPG.toast('Select a bank account first', 'error');

  const btn = document.getElementById('rc_automatch_btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Matching...'; }

  try {
    SPG.showLoader();
    const result = await FIN.api('fin_auto_match', { bank_account_id: bankId });
    SPG.toast(`Auto-matched ${result.matched || 0} transactions`);
    await loadRcBankData();
  } catch (e) {
    SPG.toast('Error: ' + e.message, 'error');
  } finally {
    SPG.hideLoader();
    if (btn) { btn.disabled = false; btn.textContent = 'Auto-Match'; }
  }
}

async function confirmMatch(matchId) {
  try {
    SPG.showLoader();
    await FIN.api('fin_confirm_match', { match_id: matchId });
    // Update memory
    const m = S._rcMatches.find(x => x.id === matchId);
    if (m) m.match_status = 'confirmed';
    renderRcRows();
    SPG.toast('Match confirmed');
  } catch (e) {
    SPG.toast('Error: ' + e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}

let _mmLineId = null;
let _mmResults = [];

function manualMatch(lineId) {
  _mmLineId = lineId;
  _mmResults = [];
  const line = S._rcStmtLines.find(l => l.id === lineId);
  if (!line) return;
  const amount = (line.debit || 0) > 0 ? line.debit : (line.credit || 0);

  // Build dialog
  const html = `<div class="popup-sheet" style="width:600px;max-width:95vw">
    <div class="popup-sheet-header">
      <div class="popup-sheet-title">Manual Match</div>
    </div>
    <div style="padding:12px 16px;background:var(--blue-bg);border-bottom:1px solid var(--bd);font-size:var(--fs-xs)">
      <b>Statement:</b> ${fmtD(line.statement_date)} \u00b7 ${esc((line.description || '').substring(0, 60))} \u00b7 <b>${fm(amount)}</b>
    </div>
    <div class="popup-sheet-body">
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <input class="inp" id="mm_search" placeholder="Search bill #, vendor name..." style="flex:1;font-size:var(--fs-sm)" onkeydown="if(event.key==='Enter')FinanceSection.mmSearch()">
        <button class="btn-primary" style="padding:6px 14px;font-size:var(--fs-sm)" onclick="FinanceSection.mmSearch()">Search</button>
      </div>
      <div id="mm_results" style="font-size:var(--fs-sm);color:var(--t3);text-align:center;padding:20px;max-height:400px;overflow:auto">
        Search or <a class="lk" onclick="FinanceSection.mmSearch()">show all transactions</a>
      </div>
    </div>
    <div class="popup-sheet-footer">
      <button class="btn-outline" onclick="SPG.closeDialog()">Cancel</button>
    </div>
  </div>`;

  SPG.showDialog(html);

  // Auto-search with amount
  setTimeout(() => {
    const inp = document.getElementById('mm_search');
    if (inp) inp.focus();
    mmDoSearch('', amount);
  }, 100);
}

async function mmSearch() {
  const query = document.getElementById('mm_search')?.value || '';
  const line = S._rcStmtLines.find(l => l.id === _mmLineId);
  const amount = line ? ((line.debit || 0) > 0 ? line.debit : (line.credit || 0)) : 0;
  await mmDoSearch(query, amount);
}

async function mmDoSearch(query, amount) {
  const el = document.getElementById('mm_results');
  if (!el) return;
  el.innerHTML = '<div style="padding:12px;color:var(--t3)">Searching...</div>';

  try {
    const data = await FIN.api('fin_search_tx_for_match', { query, amount, limit: 30 });
    _mmResults = data.transactions || [];
    if (_mmResults.length === 0) {
      el.innerHTML = '<div style="padding:20px;color:var(--t3)">No transactions found</div>';
      return;
    }
    el.innerHTML = `<div class="tbl-wrap"><table class="tbl" style="font-size:var(--fs-xs)"><thead><tr>
      <th>Bill #</th><th>Vendor</th><th>Date</th><th style="text-align:right">Amount</th><th style="text-align:right">Balance</th><th>Status</th><th></th>
    </tr></thead><tbody>${_mmResults.map(t => {
      const amtDiff = Math.abs((t.total_amount || 0) - amount);
      const exactMatch = amtDiff < 0.01;
      return `<tr${exactMatch ? ' style="background:var(--green-bg)"' : ''}>
        <td style="font-weight:600">${esc(t.bill_no || '')}</td>
        <td>${esc(t.vendor_name || '')}</td>
        <td>${fmtD(t.issue_date)}</td>
        <td style="text-align:right">${fm(t.total_amount || 0)}</td>
        <td style="text-align:right;font-weight:600">${fm(t.balance_due || 0)}</td>
        <td><span class="${t.status === 'Open' ? 'sts-warn' : t.status === 'Closed' ? 'sts-ok' : 'sts-err'}" style="font-size:var(--fs-xxs);padding:1px 6px;border-radius:4px">${esc(t.status || '')}</span></td>
        <td><button class="btn-primary" style="padding:3px 10px;font-size:var(--fs-xxs)" onclick="FinanceSection.mmSelect('${t.id}')">Match</button></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
  } catch (e) {
    el.innerHTML = `<div style="padding:20px;color:var(--red)">Error: ${esc(e.message)}</div>`;
  }
}

async function mmSelect(txId) {
  if (!_mmLineId || !txId) return;
  try {
    SPG.showLoader();
    await FIN.api('fin_manual_match', { statement_line_id: _mmLineId, transaction_id: txId });
    // Close dialog
    SPG.closeDialog();
    // Refresh recon data
    await loadRcBankData();
    SPG.toast('Matched successfully');
  } catch (e) {
    SPG.toast('Error: ' + e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}

function createAndMatch(lineId) {
  const line = S._rcStmtLines.find(l => l.id === lineId);
  if (line) {
    SPG.go('finance/cr-bill', { prefill_stmt: lineId, prefill_vendor: line.description, prefill_amount: line.debit || line.credit || 0 });
  }
}


// ═══════════════════════════════════════
// EXPOSE ON FIN + FinanceSection
// ═══════════════════════════════════════

FIN.renderRcStmt = renderRcStmt; FIN.loadRcStmt = loadRcStmt;
FIN.renderRcCash = renderRcCash; FIN.loadRcCash = loadRcCash;
FIN.renderRcBank = renderRcBank; FIN.loadRcBank = loadRcBank;

Object.assign(window.FinanceSection, {
  // Statement Upload
  onFileSelect,
  uploadStatement,
  downloadTemplate,
  filterByAccount,
  // Cash Reconcile
  switchCashTab,
  switchCashAccount,
  updateVariance,
  confirmCollection,
  showJournalEntry,
  // Bank Reconciliation
  setRcFilter,
  switchRcBank,
  runAutoMatch,
  confirmMatch,
  manualMatch,
  mmSearch,
  mmSelect,
  createAndMatch,
});

})();
