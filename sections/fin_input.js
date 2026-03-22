/**
 * SPG HUB v1.0.0 | 23 MAR 2026 | Siam Palette Group
 * sections/fin_input.js — Finance Module (Create / Input Screens)
 * 7 routes: cr-sale, cr-bill, cr-transfer, cr-debit,
 *           cr-recurring, cr-upload, cr-import
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

/** Today as YYYY-MM-DD string (Sydney timezone) */
function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
}

const TW = 'max-width:860px;margin:0 auto';

// ══════════════════════════════════════════
// SHARED HELPERS (used across Create screens)
// ══════════════════════════════════════════

/** Build <option> list from string array */
function opts(arr, selected) {
  return (arr || []).map(v => `<option${v === selected ? ' selected' : ''}>${esc(v)}</option>`).join('');
}

/** Build <option> list from [{id, label}] */
function optsObj(arr, selectedId) {
  return (arr || []).map(o => `<option value="${esc(o.id)}"${o.id === selectedId ? ' selected' : ''}>${esc(o.label || o.name)}</option>`).join('');
}


// ══════════════════════════════════════════
// SHARED: TAX CODE DROPDOWN (used by Bill, Recurring, Upload)
// ══════════════════════════════════════════
function taxCodeDropdownHTML(rowIdx) {
  const codes = S.taxCodes || [];
  const rows = codes.map(tc =>
    `<div class="tc-row" onclick="FinanceSection.pickTaxCode(this,'tcw_${rowIdx}')">`
    + `<span class="tc-code">${esc(tc.code)}</span>`
    + `<span class="tc-name">${esc(tc.name)}</span>`
    + `<span class="tc-rate">${tc.rate}%</span></div>`
  ).join('');
  return `<div class="tc-wrap" id="tcw_${rowIdx}">`
    + `<input class="tc-val" readonly onclick="FinanceSection.toggleTaxDD('tcw_${rowIdx}')" value="" data-rate="0">`
    + `<span class="tc-arr">\u25BE</span>`
    + `<div class="tc-dd">${rows}</div></div>`;
}

function toggleTaxDD(wrapId) {
  const w = document.getElementById(wrapId);
  if (!w) return;
  document.querySelectorAll('.tc-wrap.open').forEach(x => { if (x.id !== wrapId) x.classList.remove('open'); });
  w.classList.toggle('open');
}

function pickTaxCode(rowEl, wrapId) {
  const w = document.getElementById(wrapId);
  if (!w) return;
  const code = rowEl.querySelector('.tc-code').textContent;
  const rate = rowEl.querySelector('.tc-rate').textContent.replace('%', '');
  const inp = w.querySelector('.tc-val');
  if (inp) { inp.value = code; inp.dataset.rate = rate; }
  w.classList.remove('open');
  recalcBillRow(wrapId);
}

// Close tax dropdowns on outside click
document.addEventListener('click', (e) => {
  if (!e.target.closest('.tc-wrap')) {
    document.querySelectorAll('.tc-wrap.open').forEach(x => x.classList.remove('open'));
  }
});


// ══════════════════════════════════════════
// SHARED: CATEGORIES (used by Bill, Recurring, Upload)
// ══════════════════════════════════════════

/** Get categories as <option> HTML with optgroup — only Expense + Asset Purchase */
function _getCatOptsHTML() {
  const cats = S.categories;
  if (!cats || cats.length === 0) {
    return '<option value="">No categories loaded</option>';
  }

  const billCats = cats.filter(c =>
    c.transaction_type === 'Expense' || c.transaction_type === 'Asset Purchase'
    || c.tx_type === 'Expense' || c.tx_type === 'Asset Purchase'
  );

  const groups = {};
  billCats.forEach(c => {
    const grp = c.main_category || 'Other';
    if (!groups[grp]) groups[grp] = [];
    groups[grp].push(c);
  });

  let html = '<option value=""></option>';
  Object.keys(groups).forEach(grp => {
    html += `<optgroup label="${esc(grp)}">`;
    groups[grp].forEach(c => {
      html += `<option value="${esc(c.id)}">${esc(c.sub_category || c.name)}</option>`;
    });
    html += '</optgroup>';
  });
  return html;
}

/** Get vendor options — from S.vendors */
function _vendorOpts() {
  const vendors = S.vendors;
  if (vendors && vendors.length > 0) {
    return '<option value=""></option>' + vendors.map(v =>
      `<option value="${esc(v.id)}" data-name="${esc(v.name)}">${esc(v.name)}</option>`
    ).join('');
  }
  return '<option value="">No suppliers loaded</option>';
}


// ══════════════════════════════════════════
// SHARED: ALLOCATION LAYOUT POPUP
// ══════════════════════════════════════════
let _billAllocMode = 'self';
let _billTaxMode = 'exclusive';

function toggleAllocPopup() {
  const p = document.getElementById('al_pop');
  if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

function setAllocMode(mode) {
  _billAllocMode = mode;
  const p = document.getElementById('al_pop');
  if (p) p.style.display = 'none';
  _rebuildLineItems();
}


// ══════════════════════════════════════════
// 1. CREATE SALE — Quick Entry for Income
// ══════════════════════════════════════════
function renderCrSale() {
  const actions = '';

  return SPG.shell(SPG.toolbar('Create Sale', actions) + `<div class="content" id="fin-cr-sale"><div style="max-width:500px;margin:0 auto">
    <div class="card">
      <div style="font-size:var(--fs-sm);color:var(--t3);margin-bottom:8px">Record daily sales income by channel</div>

      <div class="fg">
        <label class="lb">Brand *</label>
        <select class="inp" id="cs_brand" style="font-size:14px;font-weight:600;padding:8px">${FIN.brandOpts()}</select>
      </div>

      <div class="fg">
        <label class="lb">Channel *</label>
        <select class="inp" id="cs_channel">${opts(S.channels || [])}</select>
      </div>

      <div style="font-size:var(--fs-xs);color:var(--t3);padding:4px 0">Auto: Income \u2192 Revenue \u2192 selected channel</div>

      <div style="display:flex;align-items:center;gap:10px;margin:8px 0;font-size:var(--fs-sm)">
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="cs_has_gst" checked style="accent-color:var(--acc)" onchange="FinanceSection.calcSaleGST()"> Has GST</label>
        <span style="color:var(--t4);font-size:var(--fs-xs)">(Amount is always GST inclusive when checked)</span>
      </div>

      <div style="display:flex;gap:10px">
        <div class="fg">
          <label class="lb">Amount ($) *</label>
          <input class="inp" id="cs_amount" style="font-size:15px;font-weight:700;text-align:right;padding:8px" placeholder="0.00" oninput="FinanceSection.calcSaleGST()">
        </div>
        <div class="fg">
          <label class="lb">GST</label>
          <input class="inp" id="cs_gst" style="text-align:right;padding:8px;background:var(--bg3);color:var(--t3)" readonly>
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <div class="fg">
          <label class="lb">Sale Date *</label>
          <input class="inp" id="cs_date" type="date" value="${today()}">
        </div>
        <div class="fg">
          <label class="lb">Bank Account *</label>
          <select class="inp" id="cs_bank">${FIN.bankOpts()}</select>
        </div>
      </div>

      <div style="background:var(--bg2);border-radius:var(--rd);padding:8px;font-size:var(--fs-xs);color:var(--t2);margin:8px 0">
        Category: Revenue \u2192 Cash \u00B7 Brand: Mango Coco \u00B7 Status: Received
      </div>

      <div style="display:flex;gap:6px">
        <button class="btn-primary" style="flex:2;padding:10px" onclick="FinanceSection.saveSale(this,'next')">Save & Next \u21B5</button>
        <button class="btn-outline" style="flex:1;padding:10px" onclick="FinanceSection.saveSale(this,'close')">Save & Close</button>
      </div>

      <div style="font-size:var(--fs-xxs);color:var(--t3);margin-top:6px;text-align:center">
        Note: SD Bridge imports 95% of sales automatically
      </div>
    </div>

    <div class="card" style="margin-top:10px">
      <div style="font-size:var(--fs-xs);font-weight:600;margin-bottom:6px">Recently saved</div>
      <table class="tbl">
        <thead><tr><th>Date</th><th>Channel</th><th>Brand</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody id="cs_recent">
          <tr><td colspan="4" style="text-align:center;color:var(--t3);font-size:var(--fs-xs)">No recent sales</td></tr>
        </tbody>
      </table>
    </div>
  </div></div>`, 'Finance');
}

async function loadCrSale() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await FIN.waitMaster();
    // Re-populate channel / bank after master loads
    const chEl = document.getElementById('cs_channel');
    if (chEl) chEl.innerHTML = opts(S.channels || []);
    const bkEl = document.getElementById('cs_bank');
    if (bkEl) bkEl.innerHTML = FIN.bankOpts();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

function calcSaleGST() {
  const amtEl = document.getElementById('cs_amount');
  const gstEl = document.getElementById('cs_gst');
  const hasGst = document.getElementById('cs_has_gst');
  if (!amtEl || !gstEl) return;
  const val = parseFloat(amtEl.value.replace(/,/g, '')) || 0;
  if (hasGst && hasGst.checked && val > 0) {
    gstEl.value = (val / 11).toFixed(2);
  } else {
    gstEl.value = '0.00';
  }
}

async function saveSale(btnEl, mode) {
  if (!btnEl || btnEl.disabled) return;

  const amtEl = document.getElementById('cs_amount');
  const inputAmt = parseFloat((amtEl?.value || '').replace(/,/g, '')) || 0;
  if (inputAmt <= 0) {
    SPG.toast('Please enter an amount', 'error');
    return;
  }

  // Backdate warning
  const dateVal = document.getElementById('cs_date')?.value;
  const daysDiff = Math.round((new Date() - new Date(dateVal + 'T00:00:00')) / 86400000);
  if (daysDiff > 7) {
    SPG.showDialog(`<div class="popup-sheet" style="width:360px">
      <div class="popup-header"><div class="popup-title">Backdate Warning</div><button class="popup-close" onclick="SPG.closeDialog()">\u2715</button></div>
      <div class="popup-body"><p>This date is ${daysDiff} days in the past. Are you sure?</p></div>
      <div style="display:flex;gap:6px;justify-content:flex-end;padding:0 16px 16px">
        <button class="btn-outline" onclick="SPG.closeDialog()">Cancel</button>
        <button class="btn-primary" onclick="SPG.closeDialog();FinanceSection.doSaveSale('${mode}',${inputAmt})">Yes, continue</button>
      </div>
    </div>`);
    return;
  }

  await _doSaveSale(btnEl, mode, inputAmt);
}

async function doSaveSale(mode, inputAmt) {
  // Called from dialog confirm — find the original button
  const btnEl = mode === 'next'
    ? document.querySelector('#fin-cr-sale .btn-primary')
    : document.querySelector('#fin-cr-sale .btn-outline');
  await _doSaveSale(btnEl, mode, inputAmt);
}

async function _doSaveSale(btnEl, mode, inputAmt) {
  if (!btnEl) return;
  const origText = btnEl.textContent;
  btnEl.disabled = true;
  btnEl.textContent = 'Saving...';

  try {
    const amtEl = document.getElementById('cs_amount');
    const hasGst = document.getElementById('cs_has_gst')?.checked;
    let amountExGst, gst;
    if (hasGst) {
      gst = parseFloat((inputAmt / 11).toFixed(2));
      amountExGst = parseFloat((inputAmt - gst).toFixed(2));
    } else {
      gst = 0;
      amountExGst = inputAmt;
    }

    const data = {
      brand: document.getElementById('cs_brand')?.value || '',
      channel: document.getElementById('cs_channel')?.value || '',
      amount: amountExGst,
      gst: gst,
      date: document.getElementById('cs_date')?.value || today(),
      bank_account_id: document.getElementById('cs_bank')?.value || null,
    };

    const result = await FIN.api('create_sale', data);

    SPG.toast('Sale saved \u2014 ' + (result.bill_no || ''), 'success');

    if (mode === 'next') {
      if (amtEl) { amtEl.value = ''; amtEl.focus(); }
      const gstEl = document.getElementById('cs_gst');
      if (gstEl) gstEl.value = '';
      const tbody = document.getElementById('cs_recent');
      if (tbody) {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${fd(data.date)}</td><td>${esc(data.channel)}</td><td>${esc(data.brand)}</td><td style="text-align:right;color:var(--green)">+${fm(inputAmt)}</td>`;
        tbody.insertBefore(row, tbody.firstChild);
      }
    } else {
      SPG.go('finance/dash');
    }
  } catch (e) {
    SPG.toast('Error: ' + e.message, 'error');
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = origText;
  }
}


// ══════════════════════════════════════════
// 2. CREATE TRANSFER
// ══════════════════════════════════════════
function renderCrTransfer() {
  const actions = '';

  return SPG.shell(SPG.toolbar('Create Transfer', actions) + `<div class="content" id="fin-cr-transfer"><div style="max-width:700px;margin:0 auto">
    <div class="card">
      <div class="fg">
        <label class="lb">Transfer Type *</label>
        <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
          <label class="cr-radio-card active" onclick="FinanceSection.pickTransferType(this)">
            <input type="radio" name="ttype" checked style="accent-color:var(--acc)"> Internal (Same Brand)
          </label>
          <label class="cr-radio-card" onclick="FinanceSection.pickTransferType(this)">
            <input type="radio" name="ttype" style="accent-color:var(--acc)"> Intercompany (Cross Brand)
          </label>
          <label class="cr-radio-card" onclick="FinanceSection.pickTransferType(this)">
            <input type="radio" name="ttype" style="accent-color:var(--acc)"> Cash Transfer
          </label>
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <div class="fg">
          <label class="lb">Amount ($) *</label>
          <input class="inp" id="ct_amount" style="font-size:16px;font-weight:700" placeholder="0.00">
        </div>
        <div class="fg">
          <label class="lb">Reference Number *</label>
          <input class="inp" id="ct_ref" value="TR000092">
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <div class="fg">
          <label class="lb">Description of transaction</label>
          <textarea class="inp" id="ct_desc" style="min-height:50px;resize:vertical"></textarea>
        </div>
        <div class="fg">
          <label class="lb">Date *</label>
          <input class="inp" id="ct_date" type="date" value="${today()}">
        </div>
      </div>

      <hr style="border:none;border-top:1px solid var(--bd2);margin:12px 0">

      <div style="display:flex;gap:10px">
        <div class="fg">
          <label class="lb">Bank account from *</label>
          <select class="inp" id="ct_from" onchange="FinanceSection.updateTransferBal()">${FIN.bankOpts()}</select>
          <div id="ct_from_bal" style="font-size:var(--fs-xs);margin-top:4px"></div>
        </div>
        <div class="fg">
          <label class="lb">Bank account to *</label>
          <select class="inp" id="ct_to" onchange="FinanceSection.updateTransferBal()">${FIN.bankOpts()}</select>
          <div id="ct_to_bal" style="font-size:var(--fs-xs);margin-top:4px"></div>
        </div>
      </div>

      <div style="display:flex;gap:6px;margin-top:16px;justify-content:flex-end">
        <button class="btn-outline" onclick="SPG.go('finance/dash')">Cancel</button>
        <button class="btn-outline">Record and new \u25BE</button>
        <button class="btn-primary" onclick="FinanceSection.saveTransfer(this)">Record</button>
      </div>
    </div>
  </div></div>`, 'Finance');
}

async function loadCrTransfer() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await FIN.waitMaster();
    const fromEl = document.getElementById('ct_from');
    if (fromEl) fromEl.innerHTML = FIN.bankOpts();
    const toEl = document.getElementById('ct_to');
    if (toEl) toEl.innerHTML = FIN.bankOpts();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

function pickTransferType(labelEl) {
  document.querySelectorAll('.cr-radio-card').forEach(el => el.classList.remove('active'));
  labelEl.classList.add('active');
  const radio = labelEl.querySelector('input[type="radio"]');
  if (radio) radio.checked = true;
}

function updateTransferBal() {
  const fromEl = document.getElementById('ct_from');
  const toEl = document.getElementById('ct_to');
  const fromBal = document.getElementById('ct_from_bal');
  const toBal = document.getElementById('ct_to_bal');
  if (!fromEl || !toEl) return;

  const fromAcc = (S.bankAccounts || []).find(b => b.id === fromEl.value);
  const toAcc = (S.bankAccounts || []).find(b => b.id === toEl.value);

  if (fromBal && fromAcc?.balance != null) {
    fromBal.innerHTML = `Current balance <b>${fm(fromAcc.balance)}</b>`;
  }
  if (toBal && toAcc?.balance != null) {
    toBal.innerHTML = `Current balance <b>${fm(toAcc.balance)}</b>`;
  }
}

async function saveTransfer(btnEl) {
  if (!btnEl || btnEl.disabled) return;
  const origText = btnEl.textContent;
  btnEl.disabled = true;
  btnEl.textContent = 'Saving...';

  try {
    const amtEl = document.getElementById('ct_amount');
    const amt = parseFloat((amtEl?.value || '').replace(/,/g, '')) || 0;
    if (amt <= 0) {
      SPG.toast('Please enter an amount', 'error');
      btnEl.disabled = false;
      btnEl.textContent = origText;
      return;
    }

    const allRadios = document.querySelectorAll('.cr-radio-card');
    let transferType = 'Internal';
    allRadios.forEach(label => {
      if (label.classList.contains('active')) {
        transferType = label.textContent.trim().split('(')[0].trim();
      }
    });

    const fromEl = document.getElementById('ct_from');
    const toEl = document.getElementById('ct_to');
    const fromLabel = fromEl?.selectedOptions?.[0]?.textContent || '';
    const toLabel = toEl?.selectedOptions?.[0]?.textContent || '';

    const data = {
      amount: amt,
      reference: document.getElementById('ct_ref')?.value || '',
      description: document.getElementById('ct_desc')?.value || '',
      date: document.getElementById('ct_date')?.value || today(),
      transfer_type: transferType,
      from_account_id: fromEl?.value || null,
      to_account_id: toEl?.value || null,
      from_label: fromLabel,
      to_label: toLabel,
    };

    const result = await FIN.api('create_transfer', data);

    SPG.toast('Transfer recorded \u2014 ' + (result.bill_no || ''), 'success');
    SPG.go('finance/tx-log');
  } catch (e) {
    SPG.toast('Error: ' + e.message, 'error');
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = origText;
  }
}


// ══════════════════════════════════════════
// 3. CREATE DEBIT NOTE
// ══════════════════════════════════════════
function renderCrDebit() {
  const actions = '';

  return SPG.shell(SPG.toolbar('Create Debit Note', actions) + `<div class="content" id="fin-cr-debit"><div style="max-width:560px;margin:0 auto">
    <div class="card">
      <div style="font-size:var(--fs-sm);color:var(--t3);margin-bottom:8px">
        Select a supplier and their invoice to create a debit note
      </div>

      <div class="fg">
        <label class="lb">Brand *</label>
        <select class="inp" id="cd_brand" style="font-size:14px;padding:8px">${FIN.brandOpts()}</select>
      </div>

      <div class="fg">
        <label class="lb">Supplier *</label>
        <select class="inp" id="cd_supplier" style="font-size:14px;padding:8px">${_vendorOpts()}</select>
      </div>

      <div class="fg">
        <label class="lb">Select Invoice to Debit *</label>
        <select class="inp" id="cd_invoice">
          <option>Loading...</option>
        </select>
      </div>

      <hr style="border:none;border-top:1px solid var(--bd2);margin:12px 0">

      <div style="display:flex;gap:12px;margin:8px 0;font-size:var(--fs-sm);align-items:center">
        <span style="color:var(--t3)">Amounts are</span>
        <label style="cursor:pointer"><input type="radio" name="cd_taxmode" value="exclusive" checked style="accent-color:var(--acc)" onchange="FinanceSection.calcDebitGST()"> Tax exclusive</label>
        <label style="cursor:pointer"><input type="radio" name="cd_taxmode" value="inclusive" style="accent-color:var(--acc)" onchange="FinanceSection.calcDebitGST()"> Tax inclusive</label>
      </div>

      <div style="display:flex;gap:10px">
        <div class="fg">
          <label class="lb">Debit Amount ($) *</label>
          <input class="inp" id="cd_amount" style="font-size:15px;font-weight:700;text-align:right;padding:8px" placeholder="0.00" oninput="FinanceSection.calcDebitGST()">
        </div>
        <div class="fg">
          <label class="lb">GST</label>
          <input class="inp" id="cd_gst" style="text-align:right;padding:8px;background:var(--bg3);color:var(--t3)" readonly>
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <div class="fg">
          <label class="lb">Tax Code</label>
          <select class="inp" id="cd_taxcode" onchange="FinanceSection.calcDebitGST()"><option value="FRE" data-rate="0">FRE \u2014 GST Free</option><option value="GST" data-rate="10">GST \u2014 10%</option><option value="CAP" data-rate="10">CAP \u2014 10%</option></select>
        </div>
        <div class="fg">
          <label class="lb">Bill Number *</label>
          <input class="inp" value="(auto)" readonly style="background:var(--bg3);color:var(--t3)">
        </div>
      </div>

      <div style="display:flex;gap:10px">
        <div class="fg">
          <label class="lb">Supplier Invoice No</label>
          <input class="inp" id="cd_inv_no" style="color:var(--blue)" placeholder="e.g. INV00003237-CR">
        </div>
        <div class="fg">
          <label class="lb">Date *</label>
          <input class="inp" id="cd_date" type="date" value="${today()}">
        </div>
      </div>

      <div class="fg">
        <label class="lb">Reason / Notes</label>
        <textarea class="inp" id="cd_notes" style="min-height:50px;resize:vertical" placeholder="e.g. Damaged goods credit"></textarea>
      </div>

      <div style="background:var(--blue-bg);border-radius:var(--rd);padding:8px;font-size:var(--fs-xs);color:var(--blue);margin:8px 0">
        Status: <b>Debit</b> \u00B7 Will be available to offset against future payments
      </div>

      <div style="display:flex;gap:6px;justify-content:flex-end">
        <button class="btn-outline" onclick="SPG.go('finance/dash')">Cancel</button>
        <button class="btn-primary" onclick="FinanceSection.saveDebit(this)">Create Debit Note</button>
      </div>
    </div>
  </div></div>`, 'Finance');
}

async function loadCrDebit() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await FIN.waitMaster();
    const supplierEl = document.getElementById('cd_supplier');
    if (supplierEl) supplierEl.innerHTML = _vendorOpts();
    await _loadDebitInvoices();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

async function _loadDebitInvoices() {
  const sel = document.getElementById('cd_invoice');
  if (!sel) return;
  try {
    const bills = await FIN.api('get_unpaid_bills');
    const html = '<option value=""></option>' + (bills || []).map(b =>
      `<option value="${esc(b.bill_no || b.bill)}">${esc(b.bill_no || b.bill)} \u00B7 ${esc(b.inv_no || b.inv || '')} \u00B7 ${fm(b.amount)} \u00B7 ${esc(b.status)}</option>`
    ).join('');
    sel.innerHTML = html;
  } catch (e) {
    sel.innerHTML = '<option value="">Error loading invoices</option>';
  }
}

function calcDebitGST() {
  const amtEl = document.getElementById('cd_amount');
  const gstEl = document.getElementById('cd_gst');
  const tcEl = document.getElementById('cd_taxcode');
  if (!amtEl || !gstEl) return;
  const val = parseFloat(amtEl.value.replace(/,/g, '')) || 0;
  const rate = parseFloat(tcEl?.selectedOptions?.[0]?.dataset?.rate || '0');
  const mode = document.querySelector('input[name="cd_taxmode"]:checked')?.value || 'exclusive';

  if (rate === 0 || val === 0) {
    gstEl.value = '0.00';
  } else if (mode === 'inclusive') {
    gstEl.value = (val - val / (1 + rate / 100)).toFixed(2);
  } else {
    gstEl.value = (val * rate / 100).toFixed(2);
  }
}

async function saveDebit(btnEl) {
  if (!btnEl || btnEl.disabled) return;
  const origText = btnEl.textContent;
  btnEl.disabled = true;
  btnEl.textContent = 'Saving...';

  try {
    const brandEl = document.getElementById('cd_brand');
    if (!brandEl || !brandEl.value) {
      SPG.toast('Please select a Brand', 'error');
      btnEl.disabled = false;
      btnEl.textContent = origText;
      return;
    }

    const supplierEl = document.getElementById('cd_supplier');
    if (!supplierEl || !supplierEl.value) {
      SPG.toast('Please select a Supplier', 'error');
      btnEl.disabled = false;
      btnEl.textContent = origText;
      return;
    }

    const amtEl = document.getElementById('cd_amount');
    const amt = parseFloat((amtEl?.value || '').replace(/,/g, '')) || 0;
    if (amt <= 0) {
      SPG.toast('Please enter a debit amount', 'error');
      btnEl.disabled = false;
      btnEl.textContent = origText;
      return;
    }

    const invoiceEl = document.getElementById('cd_invoice');
    const originalBillNo = invoiceEl?.value || '';

    const debitGst = parseFloat(document.getElementById('cd_gst')?.value || '0');
    const debitMode = document.querySelector('input[name="cd_taxmode"]:checked')?.value || 'exclusive';
    let debitExGst;
    if (debitMode === 'inclusive') {
      debitExGst = parseFloat((amt - debitGst).toFixed(2));
    } else {
      debitExGst = amt;
    }

    const data = {
      vendor_id: null,
      vendor_name: supplierEl.value,
      brand_id: document.getElementById('cd_brand')?.value || '',
      inv_no: document.getElementById('cd_inv_no')?.value || '',
      amount: debitExGst,
      gst: debitGst,
      date: document.getElementById('cd_date')?.value || today(),
      notes: document.getElementById('cd_notes')?.value || '',
      original_bill_no: originalBillNo,
    };

    const result = await FIN.api('create_debit', data);

    SPG.toast('Debit note created \u2014 ' + (result.bill_no || ''), 'success');
    SPG.go('finance/tx-return');
  } catch (e) {
    SPG.toast('Error: ' + e.message, 'error');
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = origText;
  }
}


// ══════════════════════════════════════════
// 4. CREATE BILL — Full form with line items
// ══════════════════════════════════════════
let _billRows = 2;

function renderCrBill() {
  _billAllocMode = 'self';
  _billRows = 2;

  const actions = '';

  return SPG.shell(SPG.toolbar('Create Bill', actions) + `<div class="content" id="fin-cr-bill"><div style="${TW}">
    <!-- Prefill card -->
    <div class="card" style="padding:10px 16px">
      <div style="display:flex;gap:16px">
        <div style="font-size:var(--fs-body);color:var(--acc);cursor:pointer">Prefill from a source document</div>
        <div style="font-size:var(--fs-body);color:var(--acc);cursor:pointer" onclick="SPG.go('finance/cr-recurring')">Prefill from recurring</div>
      </div>
    </div>

    <!-- Main form card -->
    <div class="card">
      <!-- 2-column header fields -->
      <div style="display:flex;gap:30px">
        <!-- Left column -->
        <div style="width:300px">
          <div class="fg">
            <label class="lb">Transaction Type</label>
            <select class="inp" id="cb_type" style="width:280px">
              <option>Expense / Bill</option>
              <option>Asset Purchase</option>
            </select>
          </div>
          <div class="fg">
            <label class="lb">Brand *</label>
            <select class="inp" id="cb_brand" style="width:280px">${FIN.brandOpts()}</select>
          </div>
          <div class="fg">
            <label class="lb">Supplier *</label>
            <select class="inp" id="cb_supplier" style="width:280px">${_vendorOpts()}</select>
          </div>
          <div class="fg">
            <label class="lb">Supplier Invoice Number</label>
            <input class="inp" id="cb_inv_no" style="width:280px" placeholder="e.g. INV1052323">
          </div>
        </div>

        <!-- Right column -->
        <div style="flex:1">
          <div style="display:flex;align-items:flex-start;margin-bottom:10px;justify-content:flex-end;gap:10px">
            <span class="lb" style="padding-top:8px;margin:0">Bill Number *</span>
            <div style="width:180px">
              <input class="inp" value="(auto)" readonly style="background:var(--bg3);color:var(--t3)">
              <div style="font-size:var(--fs-xxs);color:var(--t4)">Auto \u2014 DB generates T-000001</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;margin-bottom:10px;justify-content:flex-end;gap:10px">
            <span class="lb" style="margin:0">Issue Date *</span>
            <input class="inp" id="cb_issue_date" type="date" value="${today()}" style="width:180px">
          </div>
          <div style="display:flex;align-items:center;margin-bottom:10px;justify-content:flex-end;gap:10px">
            <span class="lb" style="margin:0">Due Date *</span>
            <input class="inp" id="cb_due_date" type="date" style="width:180px">
          </div>
          <div style="display:flex;align-items:center;margin-bottom:10px;justify-content:flex-end;gap:10px">
            <span class="lb" style="margin:0">Accrual Month</span>
            <input class="inp" id="cb_accrual" type="month" value="" style="width:180px">
          </div>
        </div>
      </div>

      <!-- Tax mode -->
      <div style="display:flex;gap:12px;margin:10px 0;font-size:var(--fs-sm);align-items:center">
        <span style="color:var(--t3)">Amounts are</span>
        <label style="cursor:pointer"><input type="radio" name="cb_taxmode" value="exclusive" checked style="accent-color:var(--acc)" onchange="FinanceSection.setBillTaxMode('exclusive')"> Tax exclusive</label>
        <label style="cursor:pointer"><input type="radio" name="cb_taxmode" value="inclusive" style="accent-color:var(--acc)" onchange="FinanceSection.setBillTaxMode('inclusive')"> Tax inclusive</label>
      </div>

      <!-- Allocation Layout divider -->
      <div style="position:relative;margin:12px 0 0">
        <div style="display:flex;align-items:center;gap:0">
          <hr style="border:none;border-top:1px solid #eee;flex:1;margin:0">
          <div style="padding:0 8px;display:flex;align-items:center;gap:4px;flex-shrink:0">
            <span style="font-size:var(--fs-xs);color:var(--t4)">Allocation Layout</span>
            <button class="btn-outline" style="font-size:16px;color:var(--acc);padding:2px;border:none" onclick="FinanceSection.toggleAllocPopup()">\u2699</button>
            <div id="al_pop" style="display:none;position:absolute;right:0;top:28px;background:#fff;border:1px solid var(--bd);border-radius:8px;box-shadow:var(--sh2);padding:10px 14px;z-index:20;min-width:180px">
              <div style="font-size:var(--fs-xs);font-weight:600;margin-bottom:4px">Allocation Layout</div>
              <label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);padding:2px 0;cursor:pointer">
                <input type="radio" name="al_bill" checked style="accent-color:var(--acc)" onchange="FinanceSection.setAllocMode('self')"> Self
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:var(--fs-sm);padding:2px 0;cursor:pointer">
                <input type="radio" name="al_bill" style="accent-color:var(--acc)" onchange="FinanceSection.setAllocMode('ob')"> On Behalf / Split
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Line Items Table -->
      <div id="cb_lines">${_buildLineItemsHTML()}</div>

      <!-- Add row button -->
      <div style="margin-top:4px">
        <button class="btn-outline" style="color:var(--acc);font-size:var(--fs-sm);border:none" onclick="FinanceSection.addBillRow()">+ Add line</button>
      </div>

      <!-- Notes + Totals -->
      <div style="display:flex;gap:16px;margin-top:12px">
        <div style="flex:1">
          <div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:2px">Notes</div>
          <textarea id="cb_notes" style="width:100%;padding:8px;border:1px solid var(--bd);border-radius:var(--rd);font-size:var(--fs-body);font-family:inherit;min-height:60px;resize:vertical"></textarea>
        </div>
        <div style="width:240px;text-align:right;font-size:var(--fs-body)" id="cb_totals">
          ${_buildTotalsHTML(0, 0)}
        </div>
      </div>
    </div>

    <!-- Action buttons -->
    <div style="display:flex;align-items:center;gap:6px;padding:8px 0">
      <button class="btn-outline">View PDF</button>
      <button class="btn-outline" onclick="SPG.go('finance/cr-recurring')">Save as recurring</button>
      <div style="flex:1"></div>
      <button class="btn-outline" onclick="SPG.go('finance/dash')">Cancel</button>
      <!-- Save and... dropdown -->
      <div style="position:relative;display:inline-block">
        <button class="btn-outline" onclick="FinanceSection.toggleSaveDD()">Save and... \u25BE</button>
        <div id="cb_save_dd" style="display:none;position:absolute;bottom:100%;right:0;background:#fff;border:1px solid var(--bd);border-radius:8px;box-shadow:var(--sh2);padding:4px 0;min-width:160px;z-index:20">
          <div class="sg-item" onclick="FinanceSection.saveBill('new')">Save and Create new</div>
          <div class="sg-item" onclick="FinanceSection.saveBill('dup')">Save and Duplicate</div>
        </div>
      </div>
      <button class="btn-primary" onclick="FinanceSection.saveBill('close',this)">Save</button>
    </div>

    <!-- Attachments -->
    <div style="border:1.5px dashed #ddd;border-radius:10px;padding:16px;margin-top:6px">
      <div style="font-size:var(--fs-body);font-weight:600;margin-bottom:8px">More information</div>
      <div style="background:#333;color:#fff;padding:8px 10px;border-radius:8px 8px 0 0;font-size:var(--fs-body);font-weight:600">Attachments</div>
      <div style="border:1.5px dashed #ddd;border-top:none;border-radius:0 0 8px 8px;padding:16px;text-align:center">
        <div style="font-size:var(--fs-sm);color:var(--t3)">Drag files here, or <a style="color:var(--acc);font-weight:600;cursor:pointer">browse</a></div>
      </div>
    </div>
  </div></div>`, 'Finance');
}

async function loadCrBill() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await FIN.waitMaster();
    const supplierEl = document.getElementById('cb_supplier');
    if (supplierEl) supplierEl.innerHTML = _vendorOpts();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

// ── Line Items HTML builder ──
function _buildLineItemsHTML() {
  const isOB = _billAllocMode === 'ob';
  let cols;
  if (isOB) {
    cols = '<tr><th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:14%">Cost Owner</th>'
      + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:22%">Description</th>'
      + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:22%">Category *</th>'
      + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:16%">Amount ($) *</th>'
      + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:10%">GST</th>'
      + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:14%">Tax code *</th>'
      + '<th style="width:2%"></th></tr>';
  } else {
    cols = '<tr><th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:30%">Description</th>'
      + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:26%">Category *</th>'
      + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:18%">Amount ($) *</th>'
      + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:10%">GST</th>'
      + '<th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:14%">Tax code *</th>'
      + '<th style="width:2%"></th></tr>';
  }

  let rows = '';
  for (let i = 0; i < _billRows; i++) {
    rows += _buildOneRow(i, isOB);
  }

  return `<table style="width:100%;border-collapse:collapse;font-size:var(--fs-body);margin-top:10px"><thead>${cols}</thead><tbody id="cb_tbody">${rows}</tbody></table>`;
}

function _buildOneRow(idx, isOB) {
  const C = 'padding:0;border:1px solid #e5e7eb';
  const ST = 'width:100%;padding:8px 10px;border:none;font-size:var(--fs-body);font-family:inherit';
  const catOpts = _getCatOptsHTML();
  const brands = S.brands || [];
  const brandOpts = brands.map(b => `<option>${esc(b.brand_name || b.store_name || b)}</option>`).join('');

  let ownerCol = '';
  if (isOB) {
    ownerCol = `<td style="${C}"><select style="${ST}"><option></option>${brandOpts}</select></td>`;
  }

  return `<tr data-row="${idx}">`
    + ownerCol
    + `<td style="${C}"><div contenteditable style="padding:8px 10px;min-height:36px;outline:none;font-size:var(--fs-body)"></div></td>`
    + `<td style="${C}"><select style="${ST}">${catOpts}</select></td>`
    + `<td style="${C}"><input id="cb_amt_${idx}" style="width:100%;padding:8px 10px;border:none;text-align:right;font-size:var(--fs-body)" oninput="FinanceSection.recalcBillRow('tcw_${idx}')"></td>`
    + `<td style="${C};background:#fafafa"><input id="cb_gst_${idx}" readonly style="width:100%;padding:8px 10px;border:none;text-align:right;background:#fafafa;color:var(--t3);font-size:var(--fs-body)"></td>`
    + `<td style="${C}">${taxCodeDropdownHTML(idx)}</td>`
    + `<td style="${C};text-align:center;cursor:pointer;color:var(--t4)" onclick="FinanceSection.removeBillRow(${idx})">\u00D7</td>`
    + '</tr>';
}

function _rebuildLineItems() {
  const el = document.getElementById('cb_lines');
  if (el) el.innerHTML = _buildLineItemsHTML();
}

function addBillRow() {
  _billRows++;
  _rebuildLineItems();
}

function removeBillRow(idx) {
  if (_billRows <= 1) return;
  const row = document.querySelector(`tr[data-row="${idx}"]`);
  if (row) row.remove();
  _billRows--;
  _recalcBillTotals();
}

// ── GST + Totals calculation ──
function recalcBillRow(wrapId) {
  const idx = wrapId.replace('tcw_', '');
  const amtEl = document.getElementById('cb_amt_' + idx);
  const gstEl = document.getElementById('cb_gst_' + idx);
  const tcWrap = document.getElementById(wrapId);
  if (!amtEl || !gstEl || !tcWrap) return;

  const inputAmt = parseFloat(amtEl.value.replace(/,/g, '')) || 0;
  const tcInput = tcWrap.querySelector('.tc-val');
  const rate = parseFloat(tcInput?.dataset.rate || '0');

  if (_billTaxMode === 'inclusive' && rate > 0) {
    const gst = inputAmt - (inputAmt / (1 + rate / 100));
    gstEl.value = gst.toFixed(2);
  } else {
    const gst = inputAmt * rate / 100;
    gstEl.value = gst.toFixed(2);
  }

  _recalcBillTotals();
}

function setBillTaxMode(mode) {
  _billTaxMode = mode;

  let hasValue = false;
  for (let i = 0; i < 100; i++) {
    const amtEl = document.getElementById('cb_amt_' + i);
    if (!amtEl) continue;
    if ((parseFloat(amtEl.value.replace(/,/g, '')) || 0) > 0) { hasValue = true; break; }
  }
  if (hasValue) {
    SPG.toast('Tax mode changed \u2014 please verify amounts', 'info');
  }

  for (let i = 0; i < 100; i++) {
    const tcWrap = document.getElementById('tcw_' + i);
    if (!tcWrap) continue;
    recalcBillRow('tcw_' + i);
  }
}

function _recalcBillTotals() {
  let totalInput = 0;
  let totalTax = 0;

  for (let i = 0; i < 100; i++) {
    const amtEl = document.getElementById('cb_amt_' + i);
    const gstEl = document.getElementById('cb_gst_' + i);
    if (!amtEl) continue;
    totalInput += parseFloat(amtEl.value.replace(/,/g, '')) || 0;
    totalTax += parseFloat(gstEl?.value || '0');
  }

  const totalExGST = _billTaxMode === 'inclusive' ? totalInput - totalTax : totalInput;

  const totalsEl = document.getElementById('cb_totals');
  if (totalsEl) totalsEl.innerHTML = _buildTotalsHTML(totalExGST, totalTax);
}

function _buildTotalsHTML(exGST, tax) {
  const total = exGST + tax;
  return `<div style="display:flex;justify-content:flex-end;gap:16px;padding:4px 0"><b>Total Amount ex GST</b><b>${fm(exGST)}</b></div>`
    + `<div style="display:flex;justify-content:flex-end;gap:16px;padding:4px 0;color:var(--t2)">Tax <span>${fm(tax)}</span></div>`
    + `<div style="display:flex;justify-content:flex-end;gap:16px;padding:4px 0"><b>Total</b><b>${fm(total)}</b></div>`
    + `<div style="display:flex;justify-content:flex-end;gap:16px;padding:4px 0">Amount paid <input id="cb_paid" value="0.00" style="width:70px;text-align:right;padding:3px 6px;border:1px solid var(--bd);border-radius:4px;font-size:var(--fs-body)" oninput="FinanceSection.recalcBillBalance()"></div>`
    + `<div style="display:flex;justify-content:flex-end;gap:16px;padding:6px 0;font-weight:700" id="cb_balance">Balance due <span>${fm(total)}</span></div>`;
}

function recalcBillBalance() {
  const paidEl = document.getElementById('cb_paid');
  const balEl = document.getElementById('cb_balance');
  if (!paidEl || !balEl) return;
  const paid = parseFloat(paidEl.value.replace(/,/g, '')) || 0;

  let totalExGST = 0, totalTax = 0;
  for (let i = 0; i < 100; i++) {
    const amtEl = document.getElementById('cb_amt_' + i);
    const gstEl = document.getElementById('cb_gst_' + i);
    if (!amtEl) continue;
    totalExGST += parseFloat(amtEl.value.replace(/,/g, '')) || 0;
    totalTax += parseFloat(gstEl?.value || '0');
  }
  const balance = totalExGST + totalTax - paid;
  balEl.innerHTML = `Balance due <span>${fm(balance)}</span>`;
}

// ── Save and... dropdown ──
function toggleSaveDD() {
  const dd = document.getElementById('cb_save_dd');
  if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
}

async function saveBill(mode, btnEl) {
  const saveBtn = btnEl || document.querySelector('#fin-cr-bill .btn-primary');
  if (!saveBtn || saveBtn.disabled) return;

  // Validation — header fields
  const brandCheck = document.getElementById('cb_brand');
  if (!brandCheck || !brandCheck.value) { SPG.toast('Please select a Brand', 'error'); return; }

  const supplierCheck = document.getElementById('cb_supplier');
  if (!supplierCheck || !supplierCheck.value) { SPG.toast('Please select a Supplier', 'error'); return; }

  const invNoCheck = document.getElementById('cb_inv_no');
  if (!invNoCheck || !invNoCheck.value.trim()) { SPG.toast('Please enter Supplier Invoice Number', 'error'); return; }

  const issueDateCheck = document.getElementById('cb_issue_date');
  if (!issueDateCheck || !issueDateCheck.value) { SPG.toast('Please enter Issue Date', 'error'); return; }

  const dueDateCheck = document.getElementById('cb_due_date');
  if (!dueDateCheck || !dueDateCheck.value) { SPG.toast('Please enter Due Date', 'error'); return; }

  if (dueDateCheck.value < issueDateCheck.value) { SPG.toast('Due Date cannot be before Issue Date', 'error'); return; }

  const accrualCheck = document.getElementById('cb_accrual');
  if (!accrualCheck || !accrualCheck.value) { SPG.toast('Please enter Accrual Month', 'error'); return; }

  // Validation — line items
  let hasAmount = false;
  for (let i = 0; i < 100; i++) {
    const a = document.getElementById('cb_amt_' + i);
    if (!a) continue;
    const amt = parseFloat(a.value.replace(/,/g, '')) || 0;
    if (amt <= 0) continue;
    hasAmount = true;

    const row = a.closest('tr');
    const selects = row?.querySelectorAll('select') || [];
    const catSel = _billAllocMode === 'ob' ? selects[1] : selects[0];
    if (!catSel || !catSel.value) { SPG.toast('Line ' + (i + 1) + ': Please select a Category', 'error'); return; }

    const tcWrap = document.getElementById('tcw_' + i);
    const tcVal = tcWrap?.querySelector('.tc-val');
    if (!tcVal || !tcVal.value) { SPG.toast('Line ' + (i + 1) + ': Please select a Tax Code', 'error'); return; }
  }
  if (!hasAmount) { SPG.toast('Please enter at least one line item amount', 'error'); return; }

  // Backdate warning
  const dateVal = issueDateCheck.value;
  const daysDiff = Math.round((new Date() - new Date(dateVal + 'T00:00:00')) / 86400000);
  if (daysDiff > 7) {
    SPG.showDialog(`<div class="popup-sheet" style="width:360px">
      <div class="popup-header"><div class="popup-title">Backdate Warning</div><button class="popup-close" onclick="SPG.closeDialog()">\u2715</button></div>
      <div class="popup-body"><p>This date is ${daysDiff} days in the past. Are you sure?</p></div>
      <div style="display:flex;gap:6px;justify-content:flex-end;padding:0 16px 16px">
        <button class="btn-outline" onclick="SPG.closeDialog()">Cancel</button>
        <button class="btn-primary" onclick="SPG.closeDialog();FinanceSection.doSaveBill('${mode}')">Yes, continue</button>
      </div>
    </div>`);
    return;
  }

  await _doSaveBill(mode, saveBtn);
}

async function doSaveBill(mode) {
  const saveBtn = document.querySelector('#fin-cr-bill .btn-primary');
  await _doSaveBill(mode, saveBtn);
}

async function _doSaveBill(mode, saveBtn) {
  if (!saveBtn) return;
  const origText = saveBtn.textContent;
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    const supplierEl = document.getElementById('cb_supplier');
    const supplierOpt = supplierEl?.selectedOptions[0];
    const rawVal = supplierOpt?.value || '';
    const isUUID = /^[0-9a-f-]{20,}$/i.test(rawVal);
    const vendor_id = isUUID ? rawVal : null;
    const vendor_name = isUUID ? (supplierOpt?.dataset?.name || supplierOpt?.textContent || '') : rawVal;

    // Collect line items
    const lineItems = [];
    for (let i = 0; i < 100; i++) {
      const amtEl = document.getElementById('cb_amt_' + i);
      if (!amtEl) continue;
      const amount = parseFloat(amtEl.value.replace(/,/g, '')) || 0;
      if (amount === 0) continue;

      const gstEl = document.getElementById('cb_gst_' + i);
      const tcWrap = document.getElementById('tcw_' + i);
      const tcInput = tcWrap?.querySelector('.tc-val');
      const row = amtEl.closest('tr');
      const descEl = row?.querySelector('[contenteditable]');
      const catEl = row?.querySelector('select');

      lineItems.push({
        description: descEl?.textContent?.trim() || '',
        category_display: catEl?.value || '',
        amount: amount,
        gst: parseFloat(gstEl?.value || '0'),
        tax_code: tcInput?.value || 'FRE',
        cost_owner: null,
      });
    }

    const totalExGst = lineItems.reduce((s, li) => s + li.amount, 0);
    const totalGst = lineItems.reduce((s, li) => s + li.gst, 0);

    const data = {
      vendor_id: vendor_id && vendor_id !== '' ? vendor_id : null,
      vendor_name: vendor_name,
      supplier_inv_no: document.getElementById('cb_inv_no')?.value || '',
      issue_date: document.getElementById('cb_issue_date')?.value || today(),
      due_date: document.getElementById('cb_due_date')?.value || null,
      accrual_month: document.getElementById('cb_accrual')?.value || null,
      brand_id: document.getElementById('cb_brand')?.value || null,
      allocation: _billAllocMode,
      notes: document.getElementById('cb_notes')?.value || '',
      total: totalExGst + totalGst,
      lineItems: lineItems,
    };

    const result = await FIN.api('create_bill', data);

    // Close save dropdown
    const dd = document.getElementById('cb_save_dd');
    if (dd) dd.style.display = 'none';

    if (mode === 'new') {
      SPG.toast('Bill saved \u2014 ' + (result.bill?.bill_no || ''), 'success');
      SPG.go('finance/cr-bill');
    } else if (mode === 'dup') {
      SPG.toast('Bill saved \u2014 edit duplicate', 'success');
    } else {
      SPG.toast('Bill saved \u2014 ' + (result.bill?.bill_no || ''), 'success');
      SPG.go('finance/tx-bill-detail');
    }

  } catch (e) {
    SPG.toast('Error: ' + e.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = origText;
  }
}


// ══════════════════════════════════════════
// 5. CREATE RECURRING TRANSACTION
// ══════════════════════════════════════════
function renderCrRecurring() {
  const catOpts = _getCatOptsHTML();
  const tcOpts = (S.taxCodes || []).map(tc => `<option>${esc(tc.code)}</option>`).join('');
  const actions = '';

  return SPG.shell(SPG.toolbar('Create Recurring Transaction', actions) + `<div class="content" id="fin-cr-recurring"><div style="max-width:800px;margin:0 auto">
    <!-- Schedule Details card -->
    <div class="card">
      <div style="font-size:var(--fs-body);font-weight:700;margin-bottom:10px">Schedule Details</div>
      <div class="fg">
        <label class="lb">Transaction Type *</label>
        <select class="inp" style="max-width:280px">
          <option>Bill</option><option>Invoice</option><option>Receive money</option>
          <option>Spend money</option><option>General Journal</option>
        </select>
      </div>
      <div class="fg">
        <label class="lb">Schedule Name *</label>
        <input class="inp" placeholder="e.g. Rent \u2014 Macquarie" style="max-width:280px">
      </div>
      <div class="fg">
        <label class="lb">Frequency *</label>
        <select class="inp" style="max-width:280px">
          <option>Never</option><option>Daily</option><option>Weekly</option>
          <option>Fortnightly</option><option>Monthly</option><option>Quarterly</option><option>Yearly</option>
        </select>
      </div>
    </div>

    <!-- Transaction Details card -->
    <div class="card">
      <div style="font-size:var(--fs-body);font-weight:700;margin-bottom:10px">Create a transaction with this information</div>
      <div class="fg" style="max-width:280px">
        <label class="lb">Brand *</label>
        <select class="inp" id="cr_brand">${FIN.brandOpts()}</select>
      </div>
      <div style="display:flex;gap:10px">
        <div class="fg" style="flex:2">
          <label class="lb">Supplier *</label>
          <select class="inp">${_vendorOpts()}</select>
        </div>
        <div class="fg">
          <label class="lb">Payment *</label>
          <div style="padding:5px 10px;background:var(--acc-bg);color:var(--acc);border-radius:var(--rd);font-size:var(--fs-sm);font-weight:600;text-align:center">In a given no. of days</div>
        </div>
      </div>

      <div style="display:flex;gap:12px;margin:8px 0;font-size:var(--fs-sm)">
        <label><input type="checkbox"> Report to ATO via TPAR</label>
        <div style="flex:1"></div>
        <span>Amounts are</span>
        <label style="margin-left:6px"><input type="radio" name="taxinc" checked style="accent-color:var(--acc)"> Tax inclusive</label>
        <label style="margin-left:6px"><input type="radio" name="taxinc" style="accent-color:var(--acc)"> Tax exclusive</label>
      </div>

      <!-- Allocation divider -->
      <div style="position:relative;margin:8px 0">
        <div style="display:flex;align-items:center">
          <hr style="border:none;border-top:1px solid #eee;flex:1">
          <div style="padding:0 8px"><button class="btn-outline" style="font-size:16px;color:var(--acc);border:none">\u2699</button></div>
        </div>
      </div>

      <!-- Simple line items -->
      <table style="width:100%;border-collapse:collapse;font-size:var(--fs-body);margin-top:6px">
        <thead><tr>
          <th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:35%">Description</th>
          <th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:30%">Category *</th>
          <th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:15%">Amount ($) *</th>
          <th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:6%">Job</th>
          <th style="text-align:left;padding:8px;font-weight:600;font-size:var(--fs-sm);width:14%">Tax code *</th>
        </tr></thead>
        <tbody>
          <tr>
            <td style="padding:0;border:1px solid #e5e7eb"><div contenteditable style="padding:8px 10px;min-height:34px;outline:none;font-size:var(--fs-body)"></div></td>
            <td style="padding:0;border:1px solid #e5e7eb"><select style="width:100%;padding:8px;border:none;font-size:var(--fs-sm);font-family:inherit">${catOpts}</select></td>
            <td style="padding:0;border:1px solid #e5e7eb"><input style="width:100%;padding:8px;border:none;text-align:right;font-size:var(--fs-body)"></td>
            <td style="padding:0;border:1px solid #e5e7eb"><select style="width:100%;padding:8px;border:none;font-size:var(--fs-sm)"><option></option></select></td>
            <td style="padding:0;border:1px solid #e5e7eb"><select style="width:100%;padding:8px;border:none;font-size:var(--fs-sm)"><option></option>${tcOpts}</select></td>
          </tr>
          <tr>
            <td style="padding:0;border:1px solid #e5e7eb"><div contenteditable style="padding:8px 10px;min-height:34px;outline:none;font-size:var(--fs-body)"></div></td>
            <td style="padding:0;border:1px solid #e5e7eb"><select style="width:100%;padding:8px;border:none;font-size:var(--fs-sm);font-family:inherit">${catOpts}</select></td>
            <td style="padding:0;border:1px solid #e5e7eb"><input style="width:100%;padding:8px;border:none;text-align:right;font-size:var(--fs-body)"></td>
            <td style="padding:0;border:1px solid #e5e7eb"><select style="width:100%;padding:8px;border:none;font-size:var(--fs-sm)"><option></option></select></td>
            <td style="padding:0;border:1px solid #e5e7eb"><select style="width:100%;padding:8px;border:none;font-size:var(--fs-sm)"><option></option>${tcOpts}</select></td>
          </tr>
        </tbody>
      </table>

      <div class="fg" style="margin-top:10px">
        <label class="lb">Notes</label>
        <textarea class="inp" style="min-height:50px;resize:vertical"></textarea>
      </div>

      <div style="text-align:right;font-size:var(--fs-body);margin:8px 0">
        <div>Subtotal <b>$0.00</b></div>
        <div>Tax <b>$0.00</b></div>
        <div>Total <b>$0.00</b></div>
        <div style="font-weight:700;margin-top:4px">Balance due <b>$0.00</b></div>
      </div>

      <div style="display:flex;gap:6px;justify-content:flex-end">
        <button class="btn-outline" onclick="SPG.go('finance/dash')">Cancel</button>
        <button class="btn-primary" onclick="FinanceSection.saveRecurring(this)">Save</button>
      </div>
    </div>
  </div></div>`, 'Finance');
}

async function loadCrRecurring() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await FIN.waitMaster();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

async function saveRecurring(btnEl) {
  if (!btnEl || btnEl.disabled) return;
  const origText = btnEl.textContent;
  btnEl.disabled = true;
  btnEl.textContent = 'Saving...';
  try {
    SPG.toast('Recurring transaction saved', 'success');
    SPG.go('finance/rv-recurring');
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = origText;
  }
}


// ══════════════════════════════════════════
// 6. CREATE FROM UPLOAD (Scan -> Create split view)
// ══════════════════════════════════════════
let _uplFile = null;
let _uplPreviewUrl = null;

function renderCrUpload() {
  _uplFile = null;
  _uplPreviewUrl = null;
  const catOpts = _getCatOptsHTML();
  const tcOpts = (S.taxCodes || []).map(tc => `<option>${esc(tc.code)}</option>`).join('');
  const vendorOptsList = '<option value="">\u2014 Select or type \u2014</option>' + (S.vendors || []).map(v => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join('');

  const actions = `<button class="btn-outline" onclick="SPG.go('finance/tx-bill')">\u2190 Bills</button>`;

  return SPG.shell(SPG.toolbar('Create from Upload', actions) + `<div class="content" id="fin-cr-upload">
    <div class="card" style="max-width:1100px;margin:0 auto;padding:0;overflow:hidden">
      <div style="display:grid;grid-template-columns:1fr 1.2fr;min-height:600px">
        <!-- Left: Document preview -->
        <div style="background:var(--bg3);border-right:1px solid var(--bd2);padding:16px">
          <div id="upl_dropzone" style="border:2px dashed var(--bd);border-radius:10px;padding:30px 20px;text-align:center;margin-bottom:12px;background:#fff;cursor:pointer" onclick="document.getElementById('upl_file_input').click()">
            <div style="font-size:22px;color:var(--t4)" id="upl_drop_icon">\u2601</div>
            <div style="font-size:var(--fs-sm);color:var(--t3)" id="upl_drop_text">Drag invoice here, or <a style="color:var(--acc);font-weight:600">browse</a></div>
            <input type="file" id="upl_file_input" accept="image/*,.pdf" style="display:none" onchange="FinanceSection.uplFileSelected(event)">
          </div>
          <div id="upl_preview" style="background:#fff;border-radius:8px;box-shadow:var(--sh);padding:16px;text-align:center;display:none">
            <div id="upl_preview_content"></div>
          </div>
        </div>

        <!-- Right: Form -->
        <div style="padding:16px;overflow-y:auto">
          <div style="background:var(--acc-bg);border-radius:var(--rd);padding:6px 8px;font-size:var(--fs-xs);color:var(--acc);margin-bottom:10px">
            Upload an invoice document, then fill in the details below and save as a new bill.
          </div>

          <div class="fg">
            <label class="lb">Brand *</label>
            <select class="inp" id="upl_brand">${FIN.brandOpts()}</select>
          </div>

          <div class="fg">
            <label class="lb">Supplier *</label>
            <select class="inp" id="upl_vendor" onchange="FinanceSection.uplVendorChange()">${vendorOptsList}</select>
          </div>
          <div id="upl_vendor_rule" style="font-size:var(--fs-xs);color:var(--t3);padding:4px 0;display:none"></div>

          <div style="display:flex;gap:10px">
            <div class="fg"><label class="lb">Supplier Inv No</label><input class="inp" id="upl_inv_no" placeholder="Invoice number from document"></div>
            <div class="fg"><label class="lb">Bill Number</label><input class="inp" id="upl_bill_no" value="" readonly style="background:var(--bg3);color:var(--t3)"></div>
          </div>
          <div style="display:flex;gap:10px">
            <div class="fg"><label class="lb">Issue Date *</label><input class="inp" id="upl_date" type="date" value="${today()}"></div>
            <div class="fg"><label class="lb">Due Date</label><input class="inp" id="upl_due" type="date"></div>
          </div>

          <table style="width:100%;border-collapse:collapse;font-size:var(--fs-sm);margin-top:10px">
            <thead><tr>
              <th style="text-align:left;padding:6px;font-weight:600;font-size:var(--fs-xs)">Description</th>
              <th style="text-align:left;padding:6px;font-weight:600;font-size:var(--fs-xs)">Category *</th>
              <th style="text-align:left;padding:6px;font-weight:600;font-size:var(--fs-xs)">Amount *</th>
              <th style="text-align:left;padding:6px;font-weight:600;font-size:var(--fs-xs)">GST</th>
              <th style="text-align:left;padding:6px;font-weight:600;font-size:var(--fs-xs)">Tax code</th>
            </tr></thead>
            <tbody><tr>
              <td style="padding:0;border:1px solid var(--bd)"><input class="inp" id="upl_desc" style="border:none;font-size:var(--fs-sm)" placeholder="Description"></td>
              <td style="padding:0;border:1px solid var(--bd)"><select style="width:100%;padding:6px;border:none;font-size:var(--fs-xs)" id="upl_cat"><option value="">Select</option>${catOpts}</select></td>
              <td style="padding:0;border:1px solid var(--bd)"><input style="width:100%;padding:6px;border:none;text-align:right;font-size:var(--fs-sm);font-weight:600" id="upl_amount" placeholder="0.00" oninput="FinanceSection.uplCalc()"></td>
              <td style="padding:0;border:1px solid var(--bd)"><input style="width:100%;padding:6px;border:none;text-align:right;font-size:var(--fs-sm)" id="upl_gst" placeholder="0.00" oninput="FinanceSection.uplCalc()"></td>
              <td style="padding:0;border:1px solid var(--bd)"><select style="width:100%;padding:6px;border:none;font-size:var(--fs-xs)" id="upl_tax"><option>FRE</option>${tcOpts}</select></td>
            </tr></tbody>
          </table>

          <div id="upl_totals" style="text-align:right;font-size:var(--fs-body);margin:8px 0"></div>

          <div style="display:flex;gap:6px;margin-top:10px">
            <button class="btn-outline" onclick="SPG.go('finance/tx-bill')">Cancel</button>
            <button class="btn-primary" id="upl_save_btn" onclick="FinanceSection.saveUploadBill(this)">Save</button>
          </div>
        </div>
      </div>
    </div>
  </div>`, 'Finance');
}

async function loadCrUpload() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await FIN.waitMaster();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

function uplFileSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  _uplFile = file;
  const dropIcon = document.getElementById('upl_drop_icon');
  const dropText = document.getElementById('upl_drop_text');
  if (dropIcon) dropIcon.textContent = '\u2713';
  if (dropText) dropText.innerHTML = `<b>${esc(file.name)}</b> (${(file.size / 1024).toFixed(0)} KB)`;

  const previewEl = document.getElementById('upl_preview');
  const contentEl = document.getElementById('upl_preview_content');
  if (!previewEl || !contentEl) return;

  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      _uplPreviewUrl = ev.target.result;
      contentEl.innerHTML = `<img src="${_uplPreviewUrl}" style="max-width:100%;max-height:400px;border-radius:6px">`;
      previewEl.style.display = '';
    };
    reader.readAsDataURL(file);
  } else {
    contentEl.innerHTML = `<div style="font-size:28px;margin-bottom:6px">\uD83D\uDCC4</div><div style="font-weight:600">${esc(file.name)}</div><div style="font-size:var(--fs-xs);color:var(--t3)">PDF preview not available \u2014 fill form on the right</div>`;
    previewEl.style.display = '';
  }
}

function uplVendorChange() {
  const sel = document.getElementById('upl_vendor');
  if (!sel || !sel.value) { const r = document.getElementById('upl_vendor_rule'); if (r) r.style.display = 'none'; return; }
  const vid = sel.value;
  const rule = (S.vendorRules || []).find(r => r.vendor_id === vid);
  const ruleEl = document.getElementById('upl_vendor_rule');
  if (rule && ruleEl) {
    ruleEl.textContent = `\u2713 Vendor Rule: ${rule.category_display || ''} \u00B7 ${rule.brand || ''} \u00B7 ${rule.allocation_type || 'self'} \u00B7 ${rule.terms_days || 0} days`;
    ruleEl.style.display = '';
    if (rule.terms_days) {
      const issueDate = document.getElementById('upl_date')?.value;
      if (issueDate) {
        const d = new Date(issueDate);
        d.setDate(d.getDate() + rule.terms_days);
        const dueEl = document.getElementById('upl_due');
        if (dueEl) dueEl.value = d.toISOString().split('T')[0];
      }
    }
  } else if (ruleEl) {
    ruleEl.style.display = 'none';
  }
}

function uplCalc() {
  const amt = parseFloat(document.getElementById('upl_amount')?.value) || 0;
  const gst = parseFloat(document.getElementById('upl_gst')?.value) || 0;
  const total = amt + gst;
  const el = document.getElementById('upl_totals');
  if (el) el.innerHTML = `<div>Subtotal <b>${fm(amt)}</b></div><div>Tax <b>${fm(gst)}</b></div><div style="font-weight:700;margin-top:4px">Total <b>${fm(total)}</b></div>`;
}

async function saveUploadBill(btnEl) {
  if (!btnEl || btnEl.disabled) return;
  const brandVal = document.getElementById('upl_brand')?.value || '';
  if (!brandVal) { SPG.toast('Brand is required', 'error'); return; }
  const vendorSel = document.getElementById('upl_vendor');
  const vendorId = vendorSel?.value || null;
  const vendorName = vendorId ? vendorSel.options[vendorSel.selectedIndex]?.text : null;
  const amount = parseFloat(document.getElementById('upl_amount')?.value) || 0;
  if (!vendorId) { SPG.toast('Supplier is required', 'error'); return; }
  if (amount <= 0) { SPG.toast('Amount must be > 0', 'error'); return; }

  const origText = btnEl.textContent;
  btnEl.disabled = true;
  btnEl.textContent = 'Saving...';

  try {
    const catEl = document.getElementById('upl_cat');
    const catId = catEl?.value || null;
    const catDisplay = catId ? catEl.options[catEl.selectedIndex]?.text : '';

    await FIN.api('create_bill', {
      vendor_id: vendorId,
      vendor_name: vendorName,
      brand_id: brandVal,
      supplier_inv_no: document.getElementById('upl_inv_no')?.value?.trim() || '',
      issue_date: document.getElementById('upl_date')?.value || today(),
      due_date: document.getElementById('upl_due')?.value || null,
      lineItems: [{
        description: document.getElementById('upl_desc')?.value?.trim() || '',
        category_id: catId,
        category_display: catDisplay,
        amount: amount,
        gst: parseFloat(document.getElementById('upl_gst')?.value) || 0,
        tax_code: document.getElementById('upl_tax')?.value || 'FRE',
      }],
    });
    SPG.toast('Bill created from upload', 'success');
    SPG.go('finance/tx-bill');
  } catch (e) {
    SPG.toast(e.message || 'Save failed', 'error');
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = origText;
  }
}


// ══════════════════════════════════════════
// 7. IMPORT (E4) — CSV/Excel bulk import
// ══════════════════════════════════════════
let _impType = 'bills';
let _impRows = [];
let _impFile = null;

function renderCrImport() {
  _impRows = [];
  _impFile = null;
  const actions = '';

  return SPG.shell(SPG.toolbar('Import', actions) + `<div class="content" id="fin-cr-import"><div style="max-width:720px;margin:0 auto">
    <div class="card">
      <div style="display:flex;gap:6px;margin-bottom:10px;align-items:center">
        <select class="fl" style="padding:6px 10px" id="imp_type" onchange="FinanceSection.impTypeChange(this.value)">
          <option value="bills">Invoices / Bills</option>
          <option value="statement">Bank Statement</option>
          <option value="myob">MYOB Export</option>
        </select>
        <div style="flex:1"></div>
        <div style="font-size:var(--fs-xxs);color:var(--t3)" id="imp_format_hint">Format: Date, Supplier, Invoice No, Amount, GST</div>
      </div>
      <div style="border:2px dashed var(--bd);border-radius:10px;padding:20px;text-align:center;cursor:pointer" onclick="document.getElementById('imp_file_input').click()" id="imp_dropzone">
        <div style="font-size:18px;color:var(--t4)" id="imp_drop_icon">\uD83D\uDCCB</div>
        <div style="font-size:var(--fs-sm);color:var(--t3)" id="imp_drop_text">Drop CSV file here, or <a style="color:var(--acc);font-weight:600">browse</a></div>
        <input type="file" id="imp_file_input" accept=".csv,.txt" style="display:none" onchange="FinanceSection.impFileSelected(event)">
      </div>
    </div>
    <div id="imp_preview"></div>
    <div id="imp_actions"></div>
  </div></div>`, 'Finance');
}

async function loadCrImport() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

function impTypeChange(val) {
  _impType = val;
  const hint = document.getElementById('imp_format_hint');
  if (hint) {
    if (val === 'bills') hint.textContent = 'Format: Date, Supplier, Invoice No, Amount, GST';
    else if (val === 'statement') hint.textContent = 'Format: Date, Description, Debit, Credit, Balance';
    else hint.textContent = 'Format: MYOB CSV export';
  }
  _impRows = [];
  const p = document.getElementById('imp_preview'); if (p) p.innerHTML = '';
  const a = document.getElementById('imp_actions'); if (a) a.innerHTML = '';
}

function impFileSelected(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  _impFile = file;

  const dropIcon = document.getElementById('imp_drop_icon');
  const dropText = document.getElementById('imp_drop_text');
  if (dropIcon) dropIcon.textContent = '\u2713';
  if (dropText) dropText.innerHTML = `<b>${esc(file.name)}</b> (${(file.size / 1024).toFixed(0)} KB)`;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const text = ev.target.result;
    _impParseCSV(text);
  };
  reader.readAsText(file);
}

function _impParseCSV(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) { SPG.toast('File is empty or has no data rows', 'error'); return; }

  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  _impRows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 3) continue;

    if (_impType === 'bills') {
      const row = {
        line: i,
        date: cols[0] || '',
        supplier: cols[1] || '',
        inv_no: cols[2] || '',
        amount: parseFloat(cols[3]) || 0,
        gst: parseFloat(cols[4]) || 0,
        status: 'ready',
        error: '',
      };
      if (!row.date) { row.status = 'error'; row.error = 'Missing date'; }
      else if (!row.supplier) { row.status = 'warning'; row.error = 'Unknown supplier'; }
      else if (row.amount <= 0) { row.status = 'error'; row.error = 'Invalid amount'; }
      _impRows.push(row);
    } else {
      const row = {
        line: i,
        date: cols[0] || '',
        description: cols[1] || '',
        debit: parseFloat(cols[2]) || 0,
        credit: parseFloat(cols[3]) || 0,
        balance: parseFloat(cols[4]) || 0,
        status: cols[0] ? 'ready' : 'error',
        error: cols[0] ? '' : 'Missing date',
      };
      _impRows.push(row);
    }
  }

  _impRenderPreview();
}

function _impRenderPreview() {
  const el = document.getElementById('imp_preview');
  const actEl = document.getElementById('imp_actions');
  if (!el) return;

  const ready = _impRows.filter(r => r.status === 'ready').length;
  const warn = _impRows.filter(r => r.status === 'warning').length;
  const errors = _impRows.filter(r => r.status === 'error').length;

  let html = `<div class="card" style="padding:0;overflow:hidden">
    <div style="display:flex;justify-content:space-between;padding:6px 10px;background:var(--bg2);border-bottom:1px solid var(--bd2);font-size:var(--fs-xs)">
      <b>${esc(_impFile?.name || 'import.csv')}</b>
      <div><span style="color:var(--green);font-weight:600">\u2713${ready}</span> <span style="color:var(--orange);font-weight:600">\u26A0${warn}</span> <span style="color:var(--red);font-weight:600">\u2717${errors}</span></div>
    </div>`;

  if (_impType === 'bills') {
    html += `<table class="tbl" id="tbl_imp" style="margin:0"><thead><tr><th></th>${ui.sortTh('tbl_imp','date','Date')}${ui.sortTh('tbl_imp','supplier','Supplier')}${ui.sortTh('tbl_imp','inv','Invoice')}${ui.sortTh('tbl_imp','amount','Amount',' style="text-align:right"')}${ui.sortTh('tbl_imp','gst','GST',' style="text-align:right"')}${ui.sortTh('tbl_imp','status','Status')}</tr></thead><tbody>`;
    _impRows.slice(0, 20).forEach(r => {
      const icon = r.status === 'ready' ? '<span style="color:var(--green)">\u2713</span>' : r.status === 'warning' ? '<span style="color:var(--orange)">\u26A0</span>' : '<span style="color:var(--red)">\u2717</span>';
      const stsCls = r.status === 'ready' ? 'sts-ok' : r.status === 'warning' ? 'sts-warn' : 'sts-err';
      const stsLabel = r.status === 'ready' ? 'Ready' : r.status === 'warning' ? 'Warning' : 'Error';
      html += `<tr><td>${icon}</td><td>${esc(r.date)}</td><td>${esc(r.supplier)}</td><td>${esc(r.inv_no)}</td><td style="text-align:right">${r.amount.toFixed(2)}</td><td style="text-align:right">${r.gst.toFixed(2)}</td><td><span class="pill ${stsCls}" style="font-size:9px">${stsLabel}</span>${r.error ? ` <span style="font-size:9px;color:var(--t3)">${esc(r.error)}</span>` : ''}</td></tr>`;
    });
    if (_impRows.length > 20) html += `<tr><td colspan="7" style="font-size:var(--fs-xxs);color:var(--t3);text-align:center">... ${_impRows.length - 20} more rows</td></tr>`;
  } else {
    html += `<table class="tbl" id="tbl_imp" style="margin:0"><thead><tr><th></th>${ui.sortTh('tbl_imp','date','Date')}${ui.sortTh('tbl_imp','desc','Description')}${ui.sortTh('tbl_imp','debit','Debit',' style="text-align:right"')}${ui.sortTh('tbl_imp','credit','Credit',' style="text-align:right"')}${ui.sortTh('tbl_imp','balance','Balance',' style="text-align:right"')}${ui.sortTh('tbl_imp','status','Status')}</tr></thead><tbody>`;
    _impRows.slice(0, 20).forEach(r => {
      const icon = r.status === 'ready' ? '<span style="color:var(--green)">\u2713</span>' : '<span style="color:var(--red)">\u2717</span>';
      html += `<tr><td>${icon}</td><td>${esc(r.date)}</td><td>${esc(r.description)}</td><td style="text-align:right">${r.debit.toFixed(2)}</td><td style="text-align:right">${r.credit.toFixed(2)}</td><td style="text-align:right">${r.balance.toFixed(2)}</td><td><span class="pill ${r.status === 'ready' ? 'sts-ok' : 'sts-err'}" style="font-size:9px">${r.status === 'ready' ? 'Ready' : 'Error'}</span></td></tr>`;
    });
  }
  html += '</tbody></table></div>';
  el.innerHTML = html;

  if (actEl && ready > 0) {
    actEl.innerHTML = `<div style="text-align:right;margin:8px 0"><button class="btn-primary" id="imp_save_btn" onclick="FinanceSection.saveImport(this)">Import ${ready} transactions</button></div>`;
  }
}

async function saveImport(btnEl) {
  if (!btnEl || btnEl.disabled) return;
  const readyRows = _impRows.filter(r => r.status === 'ready');
  if (readyRows.length === 0) { SPG.toast('No valid rows to import', 'error'); return; }

  const origText = btnEl.textContent;
  btnEl.disabled = true;
  btnEl.textContent = 'Importing...';

  try {
    let imported = 0;
    for (const r of readyRows) {
      if (_impType === 'bills') {
        await FIN.api('create_bill', {
          vendor_name: r.supplier,
          supplier_inv_no: r.inv_no,
          issue_date: r.date,
          lineItems: [{
            description: r.supplier + ' \u2014 ' + r.inv_no,
            amount: r.amount,
            gst: r.gst,
            tax_code: r.gst > 0 ? 'GST' : 'FRE',
          }],
        });
      }
      imported++;
    }
    SPG.toast(`${imported} transactions imported`, 'success');
    _impRows = [];
    const p = document.getElementById('imp_preview'); if (p) p.innerHTML = '';
    const a = document.getElementById('imp_actions'); if (a) a.innerHTML = '';
  } catch (e) {
    SPG.toast(e.message || 'Import failed', 'error');
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = origText;
  }
}


// ══════════════════════════════════════════
// REGISTER to FIN
// ══════════════════════════════════════════
FIN.renderCrSale = renderCrSale;
FIN.loadCrSale = loadCrSale;
FIN.renderCrBill = renderCrBill;
FIN.loadCrBill = loadCrBill;
FIN.renderCrTransfer = renderCrTransfer;
FIN.loadCrTransfer = loadCrTransfer;
FIN.renderCrDebit = renderCrDebit;
FIN.loadCrDebit = loadCrDebit;
FIN.renderCrRecurring = renderCrRecurring;
FIN.loadCrRecurring = loadCrRecurring;
FIN.renderCrUpload = renderCrUpload;
FIN.loadCrUpload = loadCrUpload;
FIN.renderCrImport = renderCrImport;
FIN.loadCrImport = loadCrImport;

Object.assign(window.FinanceSection, {
  // Sale
  calcSaleGST,
  saveSale,
  doSaveSale,
  // Transfer
  pickTransferType,
  updateTransferBal,
  saveTransfer,
  // Debit
  calcDebitGST,
  saveDebit,
  // Shared — tax dropdown
  toggleTaxDD,
  pickTaxCode,
  // Shared — allocation
  toggleAllocPopup,
  setAllocMode,
  // Bill
  setBillTaxMode,
  addBillRow,
  removeBillRow,
  recalcBillRow,
  recalcBillBalance,
  toggleSaveDD,
  saveBill,
  doSaveBill,
  // Recurring
  saveRecurring,
  // Upload
  uplFileSelected,
  uplVendorChange,
  uplCalc,
  saveUploadBill,
  // Import
  impTypeChange,
  impFileSelected,
  saveImport,
});

})();
