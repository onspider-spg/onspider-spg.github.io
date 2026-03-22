/**
 * SPG HUB v1.0.0 | 23 MAR 2026 | Siam Palette Group
 * sections/fin_payroll.js — Finance Module (Payroll Screens)
 * 10 routes: pr-runs, pr-create-s1, pr-create-s2, pr-create-s3, pr-detail,
 *            pr-emp, pr-emp-detail, pr-wage, pr-super, pr-payg
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

const TW = 'max-width:1100px;margin:0 auto';

// ── Local state (uses FIN.S where shared, local vars for screen-only) ──
let _filters = { status: 'All', brand: '', date_from: '', date_to: '' };

// Create wizard state
let _wizardPayRun = null;
let _wizardLines = [];
let _wizardSummary = {};

// Detail state
let _detailPayRun = null;
let _detailBrands = {};

// Employee state
let _employees = [];
let _empFilters = { brand: 'All', status: 'Active', search: '' };
let _empDetail = null;
let _empActiveTab = 'profile';

// Obligation state (wage/super/payg)
let _wageData = null;
let _superData = null;
let _paygData = null;

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function _fmtPeriod(start, end) {
  if (!start || !end) return '—';
  const s = start.split('-');
  const e = end.split('-');
  const months = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return parseInt(s[2]) + '-' + parseInt(e[2]) + ' ' + (months[parseInt(s[1])] || '');
}

function _fmtPayDate(d) {
  if (!d) return '—';
  const p = d.split('-');
  const months = ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return parseInt(p[2]) + ' ' + (months[parseInt(p[1])] || '');
}

function _statusBadge(status) {
  const map = {
    draft: 'sts-warn', approved: 'sts-err', paid: 'sts-ok',
    owing: 'sts-err',
  };
  const cls = map[(status || '').toLowerCase()] || 'sts-neutral';
  const label = (status || '').charAt(0).toUpperCase() + (status || '').slice(1);
  return `<span class="sts ${cls}">${esc(label)}</span>`;
}

/** Brand filter options with "All Brands" default */
function _brandFilterOpts() {
  return '<option value="">All Brands</option>' + FIN.brandOpts('');
}


// ═══════════════════════════════════════
// 1. PAY RUNS LIST (pr-runs)
// ═══════════════════════════════════════

function renderPrRuns() {
  const actions = `<button class="btn-primary" onclick="FinanceSection.goCreate()">+ Create Pay Run</button>`;

  return SPG.shell(SPG.toolbar('Pay Runs', actions) + `<div class="content" id="fin-pr-runs"><div style="${TW}">
    <div class="kpi-grid">
      <div class="kpi-card" style="border-top:3px solid var(--orange)"><div class="kpi-value" style="color:var(--orange)" id="pr_kpi_draft">0</div><div class="kpi-label">Draft</div></div>
      <div class="kpi-card" style="border-top:3px solid var(--red)"><div class="kpi-value" style="color:var(--red)" id="pr_kpi_approved">0</div><div class="kpi-label">Approved (unpaid)</div></div>
      <div class="kpi-card" style="border-top:3px solid var(--green)"><div class="kpi-value" style="color:var(--green)" id="pr_kpi_paid">0</div><div class="kpi-label">Paid (this month)</div></div>
      <div class="kpi-card" style="border-top:3px solid var(--blue)"><div class="kpi-value" id="pr_kpi_total">$0</div><div class="kpi-label">Latest Pay Run Total</div></div>
      <div class="kpi-card" style="border-top:3px solid var(--acc)"><div class="kpi-value" id="pr_kpi_brands">0</div><div class="kpi-label">Brands</div></div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:10px;align-items:flex-end">
      <div><div class="fl-label">Status</div><select class="fl" id="pr_fl_status" onchange="FinanceSection.applyPrFilter()"><option>All</option><option>Draft</option><option>Approved</option><option>Paid</option></select></div>
      <div><div class="fl-label">Brand</div><select class="fl" id="pr_fl_brand" onchange="FinanceSection.applyPrFilter()" style="width:140px">${_brandFilterOpts()}</select></div>
      <div><div class="fl-label">Date from</div><input class="fl" type="date" id="pr_fl_from" style="width:120px" onchange="FinanceSection.applyPrFilter()"></div>
      <div><div class="fl-label">Date to</div><input class="fl" type="date" id="pr_fl_to" style="width:120px" onchange="FinanceSection.applyPrFilter()"></div>
    </div>
    <div class="card" style="padding:0;overflow:hidden"><div class="tbl-wrap">
      <table class="tbl" id="pr_runs_tbl"><thead><tr>
        ${ui.sortTh('pr_runs_tbl','run','Pay Run')}${ui.sortTh('pr_runs_tbl','period','Work Period')}${ui.sortTh('pr_runs_tbl','paydate','Pay Date')}
        <th style="text-align:center">Brands</th><th style="text-align:center">Employees</th>
        ${ui.sortTh('pr_runs_tbl','payroll','Payroll $',' style="text-align:right"')}${ui.sortTh('pr_runs_tbl','tax','TAX',' style="text-align:right"')}
        ${ui.sortTh('pr_runs_tbl','super','SUPER',' style="text-align:right"')}${ui.sortTh('pr_runs_tbl','total','Total $',' style="text-align:right"')}
        ${ui.sortTh('pr_runs_tbl','alloc','Alloc?')}${ui.sortTh('pr_runs_tbl','status','Status')}
      </tr></thead><tbody id="pr_runs_body"><tr><td colspan="11" style="text-align:center;padding:20px;color:var(--t3)">Loading...</td></tr></tbody></table>
    </div></div>
  </div></div>`, 'Finance');
}

async function loadPrRuns() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadPayRuns();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

async function _loadPayRuns() {
  try {
    const data = await FIN.api('get_pay_runs', _filters);
    S._payRuns = data.rows || [];
    S._payRunKpi = data.kpi || S._payRunKpi;
    _renderPayRunKpi();
    _renderPayRunRows();
  } catch (e) {
    const body = document.getElementById('pr_runs_body');
    if (body) body.innerHTML = `<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--red)">${esc(e.message)}</td></tr>`;
  }
}

function _renderPayRunKpi() {
  const k = S._payRunKpi;
  const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  el('pr_kpi_draft', k.draft);
  el('pr_kpi_approved', k.approved);
  el('pr_kpi_paid', k.paid);
  el('pr_kpi_total', fm(k.latest_total));
  el('pr_kpi_brands', k.brand_count);
}

function _renderPayRunRows() {
  const body = document.getElementById('pr_runs_body');
  if (!body) return;

  if (S._payRuns.length === 0) {
    body.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:20px;color:var(--t3)">No pay runs found</td></tr>';
    return;
  }

  body.innerHTML = S._payRuns.map(r => {
    const isDraft = r.status === 'draft';
    const isApproved = r.status === 'approved';
    const rowBg = isDraft ? 'background:var(--orange-bg)' : (isApproved ? 'background:var(--red-bg)' : '');
    const click = isDraft
      ? `onclick="FinanceSection.goCreateEdit('${r.id}')"`
      : `onclick="FinanceSection.goDetail('${r.id}')" style="cursor:pointer;${rowBg}"`;

    return `<tr ${isDraft ? `style="${rowBg}"` : click}>
      <td><a class="lk" ${isDraft ? `onclick="FinanceSection.goCreateEdit('${r.id}')"` : ''}>${esc(r.pay_run_no)}</a></td>
      <td style="font-weight:600">${_fmtPeriod(r.period_start, r.period_end)}</td>
      <td${isDraft ? ' style="color:var(--t3)"' : ''}>${isDraft ? '~' + _fmtPayDate(r.pay_date) : _fmtPayDate(r.pay_date)}</td>
      <td style="text-align:center">${isDraft ? '—' : (r.brand_count || 0)}</td>
      <td style="text-align:center">${isDraft ? '—' : (r.employee_count || 0)}</td>
      <td style="text-align:right${isDraft ? ';color:var(--t4)' : ''}">${isDraft ? '—' : fm(r.total_payroll)}</td>
      <td style="text-align:right${isDraft ? ';color:var(--t4)' : (';color:var(--red)')}">${isDraft ? '—' : fm(r.total_tax)}</td>
      <td style="text-align:right${isDraft ? ';color:var(--t4)' : (';color:var(--orange)')}">${isDraft ? '—' : fm(r.total_super)}</td>
      <td style="text-align:right;font-weight:700${isDraft ? ';color:var(--t4)' : ''}">${isDraft ? '—' : fm(r.grand_total)}</td>
      <td>${isDraft ? '—' : (r.is_allocated ? '<span class="sts sts-warn">Yes</span>' : 'No')}</td>
      <td>${_statusBadge(r.status)}</td>
    </tr>`;
  }).join('');
}

function applyPrFilter() {
  _filters.status = document.getElementById('pr_fl_status')?.value || 'All';
  _filters.brand = document.getElementById('pr_fl_brand')?.value || '';
  _filters.date_from = document.getElementById('pr_fl_from')?.value || '';
  _filters.date_to = document.getElementById('pr_fl_to')?.value || '';
  _loadPayRuns();
}


// ═══════════════════════════════════════
// 2. CREATE PAY RUN — STEP 1: SETUP (pr-create-s1)
// ═══════════════════════════════════════

function renderPrCreateS1() {
  const pr = _wizardPayRun;
  const pStart = pr?.period_start || '';
  const pEnd = pr?.period_end || '';
  const pDate = pr?.pay_date || '';
  const prNo = pr?.pay_run_no || '—';

  const actions = `<button class="btn-outline" onclick="SPG.go('finance/pr-runs')">← Pay Runs</button>`;

  return SPG.shell(SPG.toolbar('Create Pay Run — Step 1: Setup', actions) + `<div class="content" id="fin-pr-create-s1"><div style="${TW}">
    <div class="tabs"><div class="tab a">① Setup</div><div class="tab">② Import Excel</div><div class="tab">③ Review & Approve</div></div>
    <div class="card" style="max-width:600px;margin:0 auto">
      <div style="font-size:13px;font-weight:700;margin-bottom:10px">Pay Run Setup</div>
      <div class="fr">
        <div class="fg" style="flex:1"><label class="lb">Pay Cycle</label><select class="inp" id="pr_s1_cycle"><option>Weekly</option><option>Fortnightly</option><option>Monthly</option></select></div>
        <div class="fg" style="flex:1"><label class="lb">Work Period Start *</label><input class="inp" type="date" id="pr_s1_start" value="${esc(pStart)}"></div>
        <div class="fg" style="flex:1"><label class="lb">Work Period End *</label><input class="inp" type="date" id="pr_s1_end" value="${esc(pEnd)}"></div>
      </div>
      <div class="fr" style="margin-top:10px">
        <div class="fg" style="flex:1"><label class="lb">Pay Date *</label><input class="inp" type="date" id="pr_s1_paydate" value="${esc(pDate)}"></div>
        <div class="fg" style="flex:1"><label class="lb">Pay Run ID</label><input class="inp" id="pr_s1_no" value="${esc(prNo)}" readonly style="background:var(--bg3);color:var(--t3)"></div>
      </div>
      <div style="background:var(--blue-bg);border-radius:var(--rd);padding:8px;font-size:10px;color:var(--blue);margin:10px 0">ℹ️ ระบบจะ import ข้อมูลจาก Excel ทุก brand ในขั้นตอนถัดไป</div>
      <div style="display:flex;justify-content:flex-end">
        <button class="btn-primary" id="pr_s1_btn" onclick="FinanceSection.saveStep1()">Next: Import Excel →</button>
      </div>
    </div>
  </div></div>`, 'Finance');
}

async function loadPrCreateS1() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    // If no existing wizard, fetch next PR number
    if (!_wizardPayRun) {
      try {
        const data = await FIN.api('get_next_pay_run_no', {});
        const el = document.getElementById('pr_s1_no');
        if (el) el.value = data.pay_run_no || 'PR-???';
      } catch (e) { /* ignore */ }
    }
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

async function saveStep1() {
  const cycle = document.getElementById('pr_s1_cycle')?.value || 'Weekly';
  const start = document.getElementById('pr_s1_start')?.value || '';
  const end = document.getElementById('pr_s1_end')?.value || '';
  const payDate = document.getElementById('pr_s1_paydate')?.value || '';

  if (!start || !end || !payDate) {
    SPG.toast('Please fill all required fields', 'error');
    return;
  }

  const btn = document.getElementById('pr_s1_btn');
  if (btn) btn.disabled = true;

  try {
    if (_wizardPayRun?.id) {
      SPG.go('finance/pr-create-s2');
      return;
    }

    SPG.showLoader();
    const data = await FIN.api('create_pay_run', {
      pay_cycle: cycle.toLowerCase(),
      period_start: start,
      period_end: end,
      pay_date: payDate,
    });
    _wizardPayRun = data;
    SPG.toast('Pay run created', 'success');
    SPG.go('finance/pr-create-s2');
  } catch (e) {
    SPG.toast(e.message || 'Failed to create pay run', 'error');
  } finally {
    SPG.hideLoader();
    if (btn) btn.disabled = false;
  }
}


// ═══════════════════════════════════════
// 3. CREATE PAY RUN — STEP 2: IMPORT EXCEL (pr-create-s2)
// ═══════════════════════════════════════

function renderPrCreateS2() {
  const pr = _wizardPayRun || {};
  const period = _fmtPeriod(pr.period_start, pr.period_end);

  const actions = `<button class="btn-outline" onclick="SPG.go('finance/pr-create-s1')">← Setup</button><span style="font-size:11px;color:var(--t3)">Week ${esc(period)}</span>`;

  return SPG.shell(SPG.toolbar('Import Payroll Data — ' + esc(pr.pay_run_no || ''), actions) + `<div class="content" id="fin-pr-create-s2"><div style="${TW}">
    <div class="tabs"><div class="tab" onclick="SPG.go('finance/pr-create-s1')">① Setup</div><div class="tab a">② Import Excel</div><div class="tab">③ Review & Approve</div></div>

    <div class="card" style="border-top:3px solid var(--acc)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
        <span style="font-size:14px">📊</span>
        <div><div style="font-size:12px;font-weight:700">1. Payroll File</div><div style="font-size:10px;color:var(--t3)">Hours, rates, pay per employee per brand</div></div>
      </div>
      <div style="border:2px dashed var(--bd);border-radius:10px;padding:16px;text-align:center;cursor:pointer" onclick="document.getElementById('pr_s2_file1').click()">
        <input type="file" id="pr_s2_file1" accept=".xlsx,.xls,.csv" style="display:none" onchange="FinanceSection.onFilePayroll(event)">
        <div style="font-size:18px;color:var(--t4)">📄</div>
        <div style="font-size:11px;color:var(--t3)">Drop Excel here, or <a style="color:var(--acc);font-weight:600">browse</a></div>
      </div>
      <div id="pr_s2_file1_status" style="margin-top:6px;font-size:11px"></div>
    </div>

    <div class="card" style="border-top:3px solid var(--acc)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
        <span style="font-size:14px">🔀</span>
        <div><div style="font-size:12px;font-weight:700">2. Allocation File</div><div style="font-size:10px;color:var(--t3)">ย้ายต้นทุนระหว่าง brand เพื่อ % Payroll/Sales</div></div>
      </div>
      <div style="border:2px dashed var(--bd);border-radius:10px;padding:16px;text-align:center;cursor:pointer" onclick="document.getElementById('pr_s2_file2').click()">
        <input type="file" id="pr_s2_file2" accept=".xlsx,.xls,.csv" style="display:none" onchange="FinanceSection.onFileAllocation(event)">
        <div style="font-size:18px;color:var(--t4)">📄</div>
        <div style="font-size:11px;color:var(--t3)">Drop Excel here, or <a style="color:var(--acc);font-weight:600">browse</a></div>
      </div>
      <div id="pr_s2_file2_status" style="margin-top:6px;font-size:11px"></div>
    </div>

    <div id="pr_s2_preview" style="display:none">
      <div class="card" style="border:1.5px solid var(--acc)">
        <div style="font-size:12px;font-weight:700;margin-bottom:8px">Import Preview</div>
        <table class="tbl"><thead><tr>
          <th>Brand</th><th style="text-align:center">Employees</th>
          <th style="text-align:right">Payroll $</th><th style="text-align:right">Cash $</th>
          <th style="text-align:right">TAX</th><th style="text-align:right">SUPER</th>
          <th style="text-align:right;font-weight:700">Total</th>
          <th style="text-align:center">Allocation</th><th>Status</th>
        </tr></thead><tbody id="pr_s2_preview_body"></tbody>
        <tfoot id="pr_s2_preview_foot"></tfoot></table>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;margin-top:8px">
      <button class="btn-outline" onclick="SPG.go('finance/pr-create-s1')">← Setup</button>
      <button class="btn-primary" id="pr_s2_btn" onclick="FinanceSection.importAndNext()" disabled>Confirm Import & Review →</button>
    </div>
  </div></div>`, 'Finance');
}

async function loadPrCreateS2() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

function onFilePayroll(evt) {
  const file = evt?.target?.files?.[0];
  if (!file) return;
  const statusEl = document.getElementById('pr_s2_file1_status');
  if (statusEl) statusEl.innerHTML = `<span style="color:var(--green)">✔ <b>${esc(file.name)}</b></span>`;

  // TODO: Parse Excel with SheetJS → build _wizardLines
  _wizardLines = _buildMockLines();
  _renderImportPreview();

  const btn = document.getElementById('pr_s2_btn');
  if (btn) btn.disabled = false;
}

function onFileAllocation(evt) {
  const file = evt?.target?.files?.[0];
  if (!file) return;
  const statusEl = document.getElementById('pr_s2_file2_status');
  if (statusEl) statusEl.innerHTML = `<span style="color:var(--green)">✔ <b>${esc(file.name)}</b></span>`;
}

function _buildMockLines() {
  return [];
}

function _renderImportPreview() {
  const previewEl = document.getElementById('pr_s2_preview');
  if (!previewEl) return;

  if (_wizardLines.length === 0) {
    previewEl.style.display = 'block';
    const body = document.getElementById('pr_s2_preview_body');
    if (body) body.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:16px;color:var(--t3)">Excel parsed — data will appear here. Click "Confirm Import" to proceed.</td></tr>';
    return;
  }

  previewEl.style.display = 'block';
  const byBrand = {};
  _wizardLines.forEach(l => {
    if (!byBrand[l.brand_id]) byBrand[l.brand_id] = { emps: 0, payroll: 0, cash: 0, tax: 0, super_: 0, total: 0, alloc: 0 };
    const b = byBrand[l.brand_id];
    b.emps++;
    b.payroll += l.transfer_pay;
    b.cash += l.cash_pay;
    b.tax += l.tax_withheld;
    b.super_ += l.super_amount;
    b.total += l.total_amount;
    if (l.allocated_from_brand) b.alloc += l.total_amount;
  });

  const body = document.getElementById('pr_s2_preview_body');
  const foot = document.getElementById('pr_s2_preview_foot');
  if (!body || !foot) return;

  let totalEmps = 0, totalPayroll = 0, totalCash = 0, totalTax = 0, totalSuper = 0, totalTotal = 0;

  body.innerHTML = Object.entries(byBrand).map(([brand, b]) => {
    totalEmps += b.emps; totalPayroll += b.payroll; totalCash += b.cash;
    totalTax += b.tax; totalSuper += b.super_; totalTotal += b.total;
    return `<tr>
      <td style="font-weight:600">${esc(brand)}</td>
      <td style="text-align:center">${b.emps}</td>
      <td style="text-align:right">${fm(b.payroll)}</td>
      <td style="text-align:right">${fm(b.cash)}</td>
      <td style="text-align:right">${fm(b.tax)}</td>
      <td style="text-align:right">${fm(b.super_)}</td>
      <td style="text-align:right;font-weight:700">${fm(b.total)}</td>
      <td style="text-align:center">${b.alloc > 0 ? '<span class="sts sts-warn">+' + fm(b.alloc) + '</span>' : '—'}</td>
      <td><span class="sts sts-ok">✔ Mapped</span></td>
    </tr>`;
  }).join('');

  foot.innerHTML = `<tr style="border-top:2px solid var(--bd);font-weight:700;background:var(--bg2)">
    <td>TOTAL</td><td style="text-align:center">${totalEmps}</td>
    <td style="text-align:right">${fm(totalPayroll)}</td><td style="text-align:right">${fm(totalCash)}</td>
    <td style="text-align:right">${fm(totalTax)}</td><td style="text-align:right">${fm(totalSuper)}</td>
    <td style="text-align:right;font-size:14px">${fm(totalTotal)}</td>
    <td style="text-align:center;color:var(--green)">Net $0 ✔</td><td></td>
  </tr>`;
}

async function importAndNext() {
  if (!_wizardPayRun?.id) {
    SPG.toast('Please complete Step 1 first', 'error');
    return;
  }

  const btn = document.getElementById('pr_s2_btn');
  if (btn) btn.disabled = true;

  try {
    if (_wizardLines.length > 0) {
      SPG.showLoader();
      await FIN.api('import_pay_run', {
        pay_run_id: _wizardPayRun.id,
        lines: _wizardLines,
      });
      SPG.toast('Import successful', 'success');
    }
    SPG.go('finance/pr-create-s3');
  } catch (e) {
    SPG.toast(e.message || 'Import failed', 'error');
  } finally {
    SPG.hideLoader();
    if (btn) btn.disabled = false;
  }
}


// ═══════════════════════════════════════
// 4. CREATE PAY RUN — STEP 3: REVIEW & APPROVE (pr-create-s3)
// ═══════════════════════════════════════

function renderPrCreateS3() {
  const pr = _wizardPayRun || {};
  const period = _fmtPeriod(pr.period_start, pr.period_end);

  const actions = `<button class="btn-outline" onclick="SPG.go('finance/pr-create-s2')">← Import</button><span style="font-size:11px;color:var(--t3)">Week ${esc(period)}</span>`;

  return SPG.shell(SPG.toolbar('Review & Approve — ' + esc(pr.pay_run_no || ''), actions) + `<div class="content" id="fin-pr-create-s3"><div style="${TW}">
    <div class="tabs"><div class="tab" onclick="SPG.go('finance/pr-create-s1')">① Setup</div><div class="tab" onclick="SPG.go('finance/pr-create-s2')">② Import Excel</div><div class="tab a">③ Review & Approve</div></div>

    <div class="kpi-grid">
      <div class="kpi-card" style="border-top:3px solid var(--blue)"><div class="kpi-value" id="pr_s3_total">${fm(pr.grand_total)}</div><div class="kpi-label">Grand Total</div></div>
      <div class="kpi-card" style="border-top:3px solid var(--t1)"><div class="kpi-value" id="pr_s3_payroll">${fm(pr.total_payroll)}</div><div class="kpi-label">Payroll</div></div>
      <div class="kpi-card" style="border-top:3px solid var(--red)"><div class="kpi-value" style="color:var(--red)" id="pr_s3_tax">${fm(pr.total_tax)}</div><div class="kpi-label">TAX</div></div>
      <div class="kpi-card" style="border-top:3px solid var(--orange)"><div class="kpi-value" style="color:var(--orange)" id="pr_s3_super">${fm(pr.total_super)}</div><div class="kpi-label">SUPER</div></div>
      <div class="kpi-card" style="border-top:3px solid var(--acc)"><div class="kpi-value" id="pr_s3_emps">${pr.employee_count || 0}</div><div class="kpi-label">Employees</div></div>
    </div>

    <div id="pr_s3_summary">
      <div style="font-size:12px;font-weight:700;margin-bottom:6px">Brand Summary</div>
      <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px" id="pr_s3_brand_table">
        <div style="text-align:center;padding:20px;color:var(--t3)">Loading brand details...</div>
      </div>
    </div>

    <div style="background:var(--blue-bg);border-radius:var(--rd);padding:10px;font-size:11px;color:var(--blue);margin-bottom:14px">
      <b>After approval:</b><br>
      → Wages → Wage Payments (Owing per brand, after allocation)<br>
      → Super → accrued per employee<br>
      → PAYG → withheld per employee<br>
      → Pay via MYOB → Mark as Paid here
    </div>

    <div style="display:flex;gap:6px;justify-content:center">
      <button class="btn-outline" onclick="SPG.go('finance/pr-create-s2')">← Edit Import</button>
      <button class="btn-primary" style="font-size:14px;padding:12px 30px" id="pr_s3_approve_btn" onclick="FinanceSection.approvePayRun()">✔ Approve Pay Run</button>
    </div>
  </div></div>`, 'Finance');
}

async function loadPrCreateS3() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadCreateS3();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

async function _loadCreateS3() {
  if (!_wizardPayRun?.id) return;

  try {
    const data = await FIN.api('get_pay_run_detail', { pay_run_id: _wizardPayRun.id });
    _wizardPayRun = data.pay_run || _wizardPayRun;
    const brands = data.brands || {};

    const pr = _wizardPayRun;
    const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    el('pr_s3_total', fm(pr.grand_total));
    el('pr_s3_payroll', fm(pr.total_payroll));
    el('pr_s3_tax', fm(pr.total_tax));
    el('pr_s3_super', fm(pr.total_super));
    el('pr_s3_emps', pr.employee_count || 0);

    const tableEl = document.getElementById('pr_s3_brand_table');
    if (tableEl) {
      const brandKeys = Object.keys(brands);
      if (brandKeys.length === 0) {
        tableEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--t3)">No data — please import Excel in Step 2</div>';
        return;
      }

      let rows = '';
      brandKeys.forEach(brand => {
        const lines = brands[brand];
        const emps = lines.length;
        const payroll = lines.reduce((s, l) => s + Number(l.cash_pay || 0) + Number(l.transfer_pay || 0), 0);
        const tax = lines.reduce((s, l) => s + Number(l.tax_withheld || 0), 0);
        const sup = lines.reduce((s, l) => s + Number(l.super_amount || 0), 0);
        const total = lines.reduce((s, l) => s + Number(l.total_amount || 0), 0);
        rows += `<tr>
          <td style="font-weight:600">${esc(brand)}</td>
          <td style="text-align:center">${emps}</td>
          <td style="text-align:right">${fm(payroll)}</td>
          <td style="text-align:right;color:var(--red)">${fm(tax)}</td>
          <td style="text-align:right;color:var(--orange)">${fm(sup)}</td>
          <td style="text-align:right;font-weight:700">${fm(total)}</td>
        </tr>`;
      });

      tableEl.innerHTML = `<table class="tbl"><thead><tr>
        <th>Brand</th><th style="text-align:center">Employees</th>
        <th style="text-align:right">Payroll $</th><th style="text-align:right;color:var(--red)">TAX</th>
        <th style="text-align:right;color:var(--orange)">SUPER</th><th style="text-align:right;font-weight:700">Total</th>
      </tr></thead><tbody>${rows}</tbody></table>`;
    }
  } catch (e) {
    SPG.toast(e.message || 'Failed to load review data', 'error');
  }
}

function approvePayRun() {
  if (!_wizardPayRun?.id) return;

  const btn = document.getElementById('pr_s3_approve_btn');
  if (btn) btn.disabled = true;

  SPG.showDialog(`<div class="popup-sheet"><div class="popup-sheet-header"><div class="popup-sheet-title">Approve Pay Run</div></div><div class="popup-sheet-body"><p>Approve <b>${esc(_wizardPayRun.pay_run_no)}</b>?<br>This will lock the pay run for payment.</p></div><div class="popup-sheet-footer"><button class="btn-outline" onclick="SPG.closeDialog();document.getElementById('pr_s3_approve_btn').disabled=false">Cancel</button><button class="btn-primary" onclick="FinanceSection.confirmApprove()">Approve</button></div></div>`);
}

async function confirmApprove() {
  SPG.closeDialog();
  try {
    SPG.showLoader();
    await FIN.api('approve_pay_run', { pay_run_id: _wizardPayRun.id });
    SPG.toast('Pay run approved ✔', 'success');
    _wizardPayRun = null;
    _wizardLines = [];
    SPG.go('finance/pr-runs');
  } catch (e) {
    SPG.toast(e.message || 'Approve failed', 'error');
    const btn = document.getElementById('pr_s3_approve_btn');
    if (btn) btn.disabled = false;
  } finally {
    SPG.hideLoader();
  }
}


// ═══════════════════════════════════════
// 5. PAY RUN DETAIL (pr-detail)
// ═══════════════════════════════════════

function renderPrDetail() {
  const actions = `<button class="btn-outline" onclick="SPG.go('finance/pr-runs')">← Pay Runs</button><span class="sts sts-neutral" id="pr_det_sts" style="font-size:11px"></span><button class="btn-outline" style="font-size:10px" id="pr_det_export" onclick="FinanceSection.exportCsv()">Export CSV</button><button class="btn-primary" id="pr_det_paid_btn" onclick="FinanceSection.markPaid()" style="display:none">Mark as Paid</button>`;

  return SPG.shell(SPG.toolbar('<span id="pr_det_title">Pay Run Detail</span>', actions) + `<div class="content" id="fin-pr-detail"><div style="${TW}" id="pr_det_content"><div style="text-align:center;padding:40px;color:var(--t3)">Loading...</div></div></div>`, 'Finance');
}

async function loadPrDetail() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadDetail();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

async function _loadDetail() {
  const prId = _detailPayRun?.id;
  if (!prId) {
    const ct = document.getElementById('pr_det_content');
    if (ct) ct.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red)">No pay run selected</div>';
    return;
  }

  try {
    const data = await FIN.api('get_pay_run_detail', { pay_run_id: prId });
    _detailPayRun = data.pay_run;
    _detailBrands = data.brands || {};

    const pr = _detailPayRun;
    const titleEl = document.getElementById('pr_det_title');
    if (titleEl) titleEl.textContent = `${pr.pay_run_no} — ${_fmtPeriod(pr.period_start, pr.period_end)} ${(pr.period_start || '').substring(0, 4)}`;

    const stsEl = document.getElementById('pr_det_sts');
    if (stsEl) {
      const isApproved = pr.status === 'approved';
      const isPaid = pr.status === 'paid';
      stsEl.className = 'sts ' + (isPaid ? 'sts-ok' : (isApproved ? 'sts-err' : 'sts-warn'));
      stsEl.textContent = (isPaid ? 'Paid' : (isApproved ? 'Approved · Unpaid' : 'Draft'));
    }

    const paidBtn = document.getElementById('pr_det_paid_btn');
    if (paidBtn) paidBtn.style.display = pr.status === 'approved' ? '' : 'none';

    const ct = document.getElementById('pr_det_content');
    if (!ct) return;

    const brandKeys = Object.keys(_detailBrands);
    if (brandKeys.length === 0) {
      ct.innerHTML = '<div style="text-align:center;padding:40px;color:var(--t3)">No payroll lines</div>';
      return;
    }

    ct.innerHTML = brandKeys.map(brand => {
      const lines = _detailBrands[brand];
      const emps = lines.length;
      const totals = lines.reduce((acc, l) => ({
        payroll_hrs: acc.payroll_hrs + Number(l.payroll_hrs || 0),
        cash_hrs: acc.cash_hrs + Number(l.cash_hrs || 0),
        cash_pay: acc.cash_pay + Number(l.cash_pay || 0),
        transfer_pay: acc.transfer_pay + Number(l.transfer_pay || 0),
        tax: acc.tax + Number(l.tax_withheld || 0),
        super_: acc.super_ + Number(l.super_amount || 0),
        total: acc.total + Number(l.total_amount || 0),
      }), { payroll_hrs: 0, cash_hrs: 0, cash_pay: 0, transfer_pay: 0, tax: 0, super_: 0, total: 0 });

      const rows = lines.map(l => {
        const name = (l.employee_name || '') + (l.employee_nickname ? ' (' + l.employee_nickname + ')' : '');
        const isCash = l.pay_type === 'cash';
        const rowBg = l.allocated_from_brand ? 'background:var(--acc2)' : (isCash ? 'background:var(--acc2)' : '');
        return `<tr style="${rowBg}">
          <td><a class="lk" onclick="FinanceSection.goEmpDetail('${l.employee_id}')" style="font-weight:600">${esc(name)}</a></td>
          <td style="font-size:10px">${esc(l.employee_code)}</td>
          <td style="font-size:10px">${esc(l.pay_type || '')}</td>
          <td style="text-align:right">${isCash ? '—' : Number(l.payroll_hrs || 0).toFixed(1)}</td>
          <td style="text-align:right">${Number(l.cash_hrs || 0).toFixed(2)}</td>
          <td style="text-align:right">${fm(l.cash_pay, 0)}</td>
          <td style="text-align:right">${isCash ? '—' : fm(l.transfer_pay, 0)}</td>
          <td style="text-align:right;color:var(--red)">${isCash ? '—' : fm(l.tax_withheld, 0)}</td>
          <td style="text-align:right;color:var(--orange)">${isCash ? '—' : fm(l.super_amount, 0)}</td>
          <td style="text-align:right;font-weight:700">${fm(l.total_amount, 0)}</td>
          <td>${l.allocated_from_brand ? '<span style="font-size:9px;padding:1px 6px;border-radius:8px;background:var(--green-bg);color:var(--green)">← ' + esc(l.allocated_from_brand) + '</span>' : '—'}</td>
          <td>${_statusBadge(l.payment_status)}</td>
        </tr>`;
      }).join('');

      return `<div style="font-size:11px;font-weight:700;margin-bottom:4px">${esc(brand)} <span style="font-weight:400;color:var(--t3)">(${emps} employees)</span></div>
      <div class="card" style="padding:0;overflow-x:auto;margin-bottom:14px"><div class="tbl-wrap"><table class="tbl"><thead><tr>
        <th style="min-width:130px">Employee</th><th>Code</th><th>Pay Type</th>
        <th style="text-align:right">Payroll Hrs</th><th style="text-align:right">Cash Hrs</th>
        <th style="text-align:right">Cash Pay</th><th style="text-align:right">Transfer</th>
        <th style="text-align:right;color:var(--red)">TAX</th><th style="text-align:right;color:var(--orange)">SUPER</th>
        <th style="text-align:right;font-weight:700">Total</th><th>Alloc</th><th>Status</th>
      </tr></thead><tbody>${rows}</tbody>
      <tfoot><tr style="border-top:2px solid var(--bd);font-weight:700;background:var(--bg2)">
        <td colspan="3">${esc(brand)} Total (${emps})</td>
        <td style="text-align:right">${totals.payroll_hrs.toFixed(2)}</td>
        <td style="text-align:right">${totals.cash_hrs.toFixed(2)}</td>
        <td style="text-align:right">${fm(totals.cash_pay, 0)}</td>
        <td style="text-align:right">${fm(totals.transfer_pay, 0)}</td>
        <td style="text-align:right;color:var(--red)">${fm(totals.tax, 0)}</td>
        <td style="text-align:right;color:var(--orange)">${fm(totals.super_, 0)}</td>
        <td style="text-align:right;font-size:14px">${fm(totals.total, 0)}</td>
        <td></td><td></td>
      </tr></tfoot></table></div></div>`;
    }).join('');

  } catch (e) {
    const ct = document.getElementById('pr_det_content');
    if (ct) ct.innerHTML = `<div style="text-align:center;padding:40px;color:var(--red)">${esc(e.message)}</div>`;
  }
}

function markPaid() {
  if (!_detailPayRun?.id) return;

  const btn = document.getElementById('pr_det_paid_btn');
  if (btn) btn.disabled = true;

  SPG.showDialog(`<div class="popup-sheet"><div class="popup-sheet-header"><div class="popup-sheet-title">Mark as Paid</div></div><div class="popup-sheet-body"><p>Mark <b>${esc(_detailPayRun.pay_run_no)}</b> as Paid?<br>This confirms wages have been paid via MYOB.</p></div><div class="popup-sheet-footer"><button class="btn-outline" onclick="SPG.closeDialog();document.getElementById('pr_det_paid_btn').disabled=false">Cancel</button><button class="btn-primary" onclick="FinanceSection.confirmMarkPaid()">Mark as Paid</button></div></div>`);
}

async function confirmMarkPaid() {
  SPG.closeDialog();
  try {
    SPG.showLoader();
    await FIN.api('mark_pay_run_paid', { pay_run_id: _detailPayRun.id });
    SPG.toast('Pay run marked as Paid ✔', 'success');
    SPG.go('finance/pr-runs');
  } catch (e) {
    SPG.toast(e.message || 'Failed', 'error');
    const btn = document.getElementById('pr_det_paid_btn');
    if (btn) btn.disabled = false;
  } finally {
    SPG.hideLoader();
  }
}

function exportCsv() {
  SPG.toast('Export CSV — coming soon', 'info');
}


// ═══════════════════════════════════════
// 6. EMPLOYEE LIST (pr-emp)
// ═══════════════════════════════════════

function renderPrEmp() {
  const brandOpts = FIN.brandOpts('');
  const actions = `<button class="btn-primary" onclick="FinanceSection.addEmployee()">+ Add Employee</button>`;

  return SPG.shell(SPG.toolbar('Employees', actions) + `<div class="content" id="fin-pr-emp"><div class="card" style="max-width:1000px;margin:0 auto">
    <div style="display:flex;gap:8px;margin-bottom:10px">
      <div><div class="fl-label">Brand</div><select class="fl" id="pr_emp_fl_brand" onchange="FinanceSection.applyEmpFilter()"><option>All</option>${brandOpts}</select></div>
      <div><div class="fl-label">Status</div><select class="fl" id="pr_emp_fl_status" onchange="FinanceSection.applyEmpFilter()"><option>Active</option><option>Casual</option><option>Inactive</option><option>All</option></select></div>
      <div><div class="fl-label">Search</div><input class="fl" id="pr_emp_fl_search" placeholder="Name..." style="width:140px" oninput="FinanceSection.applyEmpFilter()"></div>
    </div>
    <div class="tbl-wrap"><table class="tbl" id="pr_emp_tbl"><thead><tr>
      ${ui.sortTh('pr_emp_tbl','name','Name')}${ui.sortTh('pr_emp_tbl','nick','Nickname')}${ui.sortTh('pr_emp_tbl','dept','Department')}${ui.sortTh('pr_emp_tbl','brand','Brand')}
      ${ui.sortTh('pr_emp_tbl','hourly','Hourly Rate',' style="text-align:right"')}${ui.sortTh('pr_emp_tbl','cash','Cash Rate',' style="text-align:right"')}${ui.sortTh('pr_emp_tbl','status','Status')}
    </tr></thead><tbody id="pr_emp_body"><tr><td colspan="7" style="text-align:center;padding:20px;color:var(--t3)">Loading...</td></tr></tbody></table></div>
  </div></div>`, 'Finance');
}

async function loadPrEmp() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadEmployees();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

async function _loadEmployees() {
  try {
    const data = await FIN.api('get_employees', _empFilters);
    _employees = data.rows || [];
    _renderEmpRows();
  } catch (e) {
    const body = document.getElementById('pr_emp_body');
    if (body) body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--red)">${esc(e.message)}</td></tr>`;
  }
}

function _renderEmpRows() {
  const body = document.getElementById('pr_emp_body');
  if (!body) return;

  if (_employees.length === 0) {
    body.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--t3)">No employees found</td></tr>';
    return;
  }

  body.innerHTML = _employees.map(e => {
    const stsMap = { active: 'sts-ok', casual: 'sts-neutral', inactive: 'sts-warn' };
    const stsCls = stsMap[(e.status || '').toLowerCase()] || 'sts-neutral';
    const label = (e.status || 'active').charAt(0).toUpperCase() + (e.status || 'active').slice(1);
    return `<tr style="cursor:pointer" onclick="FinanceSection.goEmpDetail('${e.id}')">
      <td><a class="lk">${esc(e.full_name)}</a></td>
      <td>${esc(e.nickname || '')}</td>
      <td>${esc(e.department || '—')}</td>
      <td>${esc(e.primary_brand_id || '—')}</td>
      <td style="text-align:right">${fm(e.payroll_rate)}</td>
      <td style="text-align:right">${fm(e.cash_rate)}</td>
      <td><span class="sts ${stsCls}">${esc(label)}</span></td>
    </tr>`;
  }).join('');
}

function applyEmpFilter() {
  _empFilters.brand = document.getElementById('pr_emp_fl_brand')?.value || 'All';
  _empFilters.status = document.getElementById('pr_emp_fl_status')?.value || 'Active';
  _empFilters.search = document.getElementById('pr_emp_fl_search')?.value || '';
  _loadEmployees();
}

function addEmployee() {
  _empDetail = null;
  _empActiveTab = 'profile';
  SPG.go('finance/pr-emp-detail');
}


// ═══════════════════════════════════════
// 7. EMPLOYEE DETAIL — 3 tabs (pr-emp-detail)
// ═══════════════════════════════════════

function renderPrEmpDetail() {
  const emp = _empDetail?.employee;
  const isNew = !emp?.id;
  const name = emp ? `${emp.full_name || 'New'}${emp.nickname ? ' (' + emp.nickname + ')' : ''}` : 'New Employee';
  const subtitle = emp ? `${emp.employee_code || ''} · ${emp.department || ''} · ${emp.primary_brand_id || ''}` : '';
  const stsMap = { active: 'sts-ok', casual: 'sts-neutral', inactive: 'sts-warn' };
  const stsCls = stsMap[(emp?.status || 'active').toLowerCase()] || 'sts-ok';
  const stsLabel = (emp?.status || 'active').charAt(0).toUpperCase() + (emp?.status || 'active').slice(1);

  const brandOpts = FIN.brandOpts(emp?.primary_brand_id || '');
  const payTypeVal = emp?.pay_type || 'cash_payroll';

  const actions = `<button class="btn-outline" onclick="SPG.go('finance/pr-emp')">← Employees</button>${isNew ? '' : '<button class="btn-outline" onclick="FinanceSection.deleteEmployee()">Delete</button>'}<button class="btn-primary" id="pr_emp_save_btn" onclick="FinanceSection.saveEmployee()">Save</button>`;

  return SPG.shell(SPG.toolbar('Employee Detail', actions) + `<div class="content" id="fin-pr-emp-detail"><div style="max-width:900px;margin:0 auto">
    <div class="card" style="margin-bottom:0;border-bottom:none;border-radius:10px 10px 0 0">
      <div style="display:flex;gap:14px;align-items:center">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--t4);flex-shrink:0">👤</div>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:700" id="pr_emp_header_name">${esc(name)}</div>
          <div style="font-size:11px;color:var(--t3)" id="pr_emp_header_sub">${esc(subtitle)}</div>
        </div>
        <div style="text-align:right"><span class="sts ${stsCls}">${esc(stsLabel)}</span></div>
      </div>
    </div>

    <div style="background:#fff;border-left:1px solid var(--bd);border-right:1px solid var(--bd);padding:0 16px">
      <div class="tabs" style="margin:0">
        <div class="tab${_empActiveTab === 'profile' ? ' a' : ''}" onclick="FinanceSection.switchEmpTab('profile')">Profile</div>
        <div class="tab${_empActiveTab === 'balance' ? ' a' : ''}" onclick="FinanceSection.switchEmpTab('balance')">Balances</div>
        <div class="tab${_empActiveTab === 'history' ? ' a' : ''}" onclick="FinanceSection.switchEmpTab('history')">Pay Run History</div>
      </div>
    </div>

    <div id="pr_edt_profile" style="${_empActiveTab !== 'profile' ? 'display:none' : ''}">
      <div class="card" style="border-radius:0 0 10px 10px;border-top:none">
        <div class="fr">
          <div class="fg" style="flex:1"><label class="lb">Employee Code</label><input class="inp" id="pr_emp_code" value="${esc(emp?.employee_code || '')}" ${isNew ? '' : 'readonly style="background:var(--bg3);color:var(--t3)"'}></div>
          <div class="fg" style="flex:1"><label class="lb">Name *</label><input class="inp" id="pr_emp_name" value="${esc(emp?.full_name || '')}"></div>
          <div class="fg" style="flex:1"><label class="lb">Nickname</label><input class="inp" id="pr_emp_nick" value="${esc(emp?.nickname || '')}"></div>
        </div>
        <div class="fr" style="margin-top:8px">
          <div class="fg" style="flex:1"><label class="lb">Primary Brand</label><select class="inp" id="pr_emp_brand"><option value="">— Select —</option>${brandOpts}</select></div>
          <div class="fg" style="flex:1"><label class="lb">Department</label><select class="inp" id="pr_emp_dept"><option${emp?.department === 'Kitchen' ? ' selected' : ''}>Kitchen</option><option${emp?.department === 'Floor' ? ' selected' : ''}>Floor</option><option${emp?.department === 'Office' ? ' selected' : ''}>Office</option></select></div>
          <div class="fg" style="flex:1"><label class="lb">Status</label><select class="inp" id="pr_emp_status"><option${emp?.status === 'active' ? ' selected' : ''} value="active">Active</option><option${emp?.status === 'casual' ? ' selected' : ''} value="casual">Casual</option><option${emp?.status === 'inactive' ? ' selected' : ''} value="inactive">Inactive</option></select></div>
        </div>

        <div style="font-size:12px;font-weight:700;color:var(--acc);margin:14px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--bd2)">Payroll Settings</div>
        <div class="fr">
          <div class="fg" style="flex:1"><label class="lb">Pay Type</label><select class="inp" id="pr_emp_paytype"><option value="cash_payroll"${payTypeVal === 'cash_payroll' ? ' selected' : ''}>Cash + Payroll</option><option value="cash_only"${payTypeVal === 'cash_only' ? ' selected' : ''}>Cash only</option><option value="payroll"${payTypeVal === 'payroll' ? ' selected' : ''}>Payroll only</option></select></div>
          <div class="fg" style="flex:1"><label class="lb">Payroll Rate ($/hr)</label><input class="inp" id="pr_emp_payrate" type="number" step="0.01" value="${emp?.payroll_rate || 0}"></div>
          <div class="fg" style="flex:1"><label class="lb">Cash Rate ($/hr)</label><input class="inp" id="pr_emp_cashrate" type="number" step="0.01" value="${emp?.cash_rate || 0}"></div>
        </div>
        <div class="fr" style="margin-top:8px">
          <div class="fg" style="flex:1"><label class="lb">Super Rate (%)</label><input class="inp" id="pr_emp_superrate" type="number" step="0.01" value="${emp?.super_rate || 12}"></div>
          <div class="fg" style="flex:1"><label class="lb">Tax Table</label><select class="inp" id="pr_emp_taxtable"><option value="resident_no_help"${emp?.tax_table === 'resident_no_help' ? ' selected' : ''}>Resident — No HELP</option><option value="resident_help"${emp?.tax_table === 'resident_help' ? ' selected' : ''}>Resident — HELP</option><option value="foreign"${emp?.tax_table === 'foreign' ? ' selected' : ''}>Foreign Resident</option></select></div>
          <div class="fg" style="flex:1"><label class="lb">Max Payroll Hrs/week</label><input class="inp" id="pr_emp_maxhrs" type="number" step="0.5" value="${emp?.max_payroll_hrs || 24}"></div>
        </div>

        <div style="font-size:12px;font-weight:700;color:var(--acc);margin:14px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--bd2)">Bank Details</div>
        <div class="fr">
          <div class="fg" style="flex:1"><label class="lb">BSB</label><input class="inp" id="pr_emp_bsb" value="${esc(emp?.bank_bsb || '')}"></div>
          <div class="fg" style="flex:1"><label class="lb">Account Number</label><input class="inp" id="pr_emp_accno" value="${esc(emp?.bank_account_no || '')}"></div>
          <div class="fg" style="flex:1"><label class="lb">Account Name</label><input class="inp" id="pr_emp_accname" value="${esc(emp?.bank_account_name || '')}"></div>
        </div>

        <div style="font-size:12px;font-weight:700;color:var(--acc);margin:14px 0 8px;padding-bottom:4px;border-bottom:1px solid var(--bd2)">Tax Information</div>
        <div class="fr">
          <div class="fg" style="flex:1"><label class="lb">TFN</label><input class="inp" id="pr_emp_tfn" value="${esc(emp?.tfn || '')}"></div>
          <div class="fg" style="flex:1"><label class="lb">Super Fund</label><input class="inp" id="pr_emp_superfund" value="${esc(emp?.super_fund || '')}"></div>
          <div class="fg" style="flex:1"><label class="lb">Member No</label><input class="inp" id="pr_emp_memberno" value="${esc(emp?.super_member_no || '')}"></div>
        </div>

        <div style="display:flex;gap:6px;margin-top:12px;justify-content:flex-end;padding-top:10px;border-top:1px solid var(--bd2)">
          <button class="btn-outline" onclick="SPG.go('finance/pr-emp')">Cancel</button>
          <button class="btn-primary" onclick="FinanceSection.saveEmployee()">Save</button>
        </div>
      </div>
    </div>

    <div id="pr_edt_balance" style="${_empActiveTab !== 'balance' ? 'display:none' : ''}">
      <div class="card" style="border-radius:0 0 10px 10px;border-top:none" id="pr_emp_bal_content">
        <div style="text-align:center;padding:20px;color:var(--t3)">Loading balances...</div>
      </div>
    </div>

    <div id="pr_edt_history" style="${_empActiveTab !== 'history' ? 'display:none' : ''}">
      <div class="card" style="border-radius:0 0 10px 10px;border-top:none" id="pr_emp_hist_content">
        <div style="text-align:center;padding:20px;color:var(--t3)">Loading history...</div>
      </div>
    </div>
  </div></div>`, 'Finance');
}

async function loadPrEmpDetail() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    if (!_empDetail?.employee?.id) return; // new employee — nothing to load
    const data = await FIN.api('get_employee_detail', { employee_id: _empDetail.employee.id });
    _empDetail = data;
    _renderEmpBalances();
    _renderEmpHistory();
  } catch (e) {
    SPG.toast(e.message || 'Failed to load employee', 'error');
  }
}

function _renderEmpBalances() {
  const el = document.getElementById('pr_emp_bal_content');
  if (!el || !_empDetail) return;

  const b = _empDetail.balances || {};

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">
      <div class="card" style="margin:0;border-top:3px solid var(--red);text-align:center">
        <div style="font-size:10px;color:var(--t3)">PAYG Withheld (owing ATO)</div>
        <div style="font-size:24px;font-weight:800;color:var(--red)">${fm(b.payg_owing)}</div>
        <div style="font-size:10px;color:var(--t3)">Total withheld: ${fm(b.payg_total)}</div>
      </div>
      <div class="card" style="margin:0;border-top:3px solid var(--orange);text-align:center">
        <div style="font-size:10px;color:var(--t3)">Super Payable (owing fund)</div>
        <div style="font-size:24px;font-weight:800;color:var(--orange)">${fm(b.super_owing)}</div>
        <div style="font-size:10px;color:var(--t3)">Total accrued: ${fm(b.super_total)}</div>
      </div>
      <div class="card" style="margin:0;border-top:3px solid var(--green);text-align:center">
        <div style="font-size:10px;color:var(--t3)">Total Gross Paid (YTD)</div>
        <div style="font-size:24px;font-weight:800">${fm(b.gross_ytd)}</div>
        <div style="font-size:10px;color:var(--t3)">Jul 2025 — present</div>
      </div>
    </div>
    <div style="font-size:12px;font-weight:700;margin-bottom:6px">PAYG + Super Breakdown</div>
    <div class="tbl-wrap"><table class="tbl" id="pr_empbal_tbl"><thead><tr>
      ${ui.sortTh('pr_empbal_tbl','run','Pay Run')}${ui.sortTh('pr_empbal_tbl','period','Work Period')}${ui.sortTh('pr_empbal_tbl','gross','Gross',' style="text-align:right"')}
      ${ui.sortTh('pr_empbal_tbl','payg','PAYG',' style="text-align:right"')}${ui.sortTh('pr_empbal_tbl','super','Super',' style="text-align:right"')}
      ${ui.sortTh('pr_empbal_tbl','paygsts','PAYG Status')}${ui.sortTh('pr_empbal_tbl','supersts','Super Status')}
    </tr></thead><tbody>${_empBalanceRows()}</tbody>
    <tfoot><tr style="border-top:2px solid var(--bd);font-weight:700">
      <td colspan="2">Total</td>
      <td style="text-align:right">${fm(b.gross_ytd)}</td>
      <td style="text-align:right;color:var(--red)">${fm(b.payg_total)}</td>
      <td style="text-align:right;color:var(--orange)">${fm(b.super_total)}</td>
      <td></td><td></td>
    </tr></tfoot></table></div>`;
}

function _empBalanceRows() {
  const history = _empDetail?.history || [];
  if (history.length === 0) return '<tr><td colspan="7" style="text-align:center;color:var(--t3)">No data</td></tr>';

  return history.slice(0, 20).map(h => {
    const gross = Number(h.cash_pay || 0) + Number(h.transfer_pay || 0);
    const paygSts = h.payment_status === 'paid' ? '<span class="sts sts-ok">Paid</span>' : '<span class="sts sts-err">Owing ATO</span>';
    const superSts = h.payment_status === 'paid' ? '<span class="sts sts-ok">Paid</span>' : '<span class="sts sts-err">Owing Fund</span>';
    return `<tr>
      <td><a class="lk">${esc(h.pay_run_no)}</a></td>
      <td>${_fmtPeriod(h.period_start, h.period_end)}</td>
      <td style="text-align:right">${fm(gross)}</td>
      <td style="text-align:right;color:var(--red)">${fm(h.tax_withheld)}</td>
      <td style="text-align:right;color:var(--orange)">${fm(h.super_amount)}</td>
      <td>${paygSts}</td>
      <td>${superSts}</td>
    </tr>`;
  }).join('');
}

function _renderEmpHistory() {
  const el = document.getElementById('pr_emp_hist_content');
  if (!el || !_empDetail) return;

  const history = _empDetail.history || [];
  if (history.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--t3)">No pay run history</div>';
    return;
  }

  el.innerHTML = `<div class="tbl-wrap"><table class="tbl" id="pr_emphist_tbl"><thead><tr>
    ${ui.sortTh('pr_emphist_tbl','run','Pay Run')}${ui.sortTh('pr_emphist_tbl','period','Work Period')}${ui.sortTh('pr_emphist_tbl','brand','Brand')}
    ${ui.sortTh('pr_emphist_tbl','phrs','Payroll Hrs',' style="text-align:right"')}${ui.sortTh('pr_emphist_tbl','chrs','Cash Hrs',' style="text-align:right"')}
    ${ui.sortTh('pr_emphist_tbl','cpay','Cash Pay',' style="text-align:right"')}${ui.sortTh('pr_emphist_tbl','xfer','Transfer',' style="text-align:right"')}
    ${ui.sortTh('pr_emphist_tbl','tax','TAX',' style="text-align:right"')}${ui.sortTh('pr_emphist_tbl','super','SUPER',' style="text-align:right"')}
    ${ui.sortTh('pr_emphist_tbl','total','Total',' style="text-align:right"')}${ui.sortTh('pr_emphist_tbl','status','Status')}
  </tr></thead><tbody>${history.slice(0, 50).map(h => `<tr>
    <td><a class="lk">${esc(h.pay_run_no)}</a></td>
    <td>${_fmtPeriod(h.period_start, h.period_end)}</td>
    <td>${esc(h.brand_id || '')}</td>
    <td style="text-align:right">${Number(h.payroll_hrs || 0).toFixed(1)}</td>
    <td style="text-align:right">${Number(h.cash_hrs || 0).toFixed(2)}</td>
    <td style="text-align:right">${fm(h.cash_pay, 0)}</td>
    <td style="text-align:right">${fm(h.transfer_pay, 0)}</td>
    <td style="text-align:right;color:var(--red)">${fm(h.tax_withheld, 0)}</td>
    <td style="text-align:right;color:var(--orange)">${fm(h.super_amount, 0)}</td>
    <td style="text-align:right;font-weight:700">${fm(h.total_amount, 0)}</td>
    <td>${_statusBadge(h.payment_status)}</td>
  </tr>`).join('')}</tbody></table></div>`;
}

function switchEmpTab(tab) {
  _empActiveTab = tab;
  ['profile', 'balance', 'history'].forEach(t => {
    const el = document.getElementById('pr_edt_' + t);
    if (el) el.style.display = t === tab ? '' : 'none';
  });
  const tabs = document.querySelectorAll('.tabs .tab');
  const tabMap = ['profile', 'balance', 'history'];
  tabs.forEach((el, i) => {
    if (tabMap[i]) el.className = 'tab' + (tabMap[i] === tab ? ' a' : '');
  });
}

async function saveEmployee() {
  const btn = document.getElementById('pr_emp_save_btn');
  if (btn) btn.disabled = true;

  const data = {
    employee_id: _empDetail?.employee?.id || null,
    employee_code: document.getElementById('pr_emp_code')?.value?.trim() || '',
    full_name: document.getElementById('pr_emp_name')?.value?.trim() || '',
    nickname: document.getElementById('pr_emp_nick')?.value?.trim() || '',
    primary_brand_id: document.getElementById('pr_emp_brand')?.value || '',
    department: document.getElementById('pr_emp_dept')?.value || '',
    status: document.getElementById('pr_emp_status')?.value || 'active',
    pay_type: document.getElementById('pr_emp_paytype')?.value || 'cash_payroll',
    payroll_rate: document.getElementById('pr_emp_payrate')?.value || 0,
    cash_rate: document.getElementById('pr_emp_cashrate')?.value || 0,
    super_rate: document.getElementById('pr_emp_superrate')?.value || 12,
    tax_table: document.getElementById('pr_emp_taxtable')?.value || 'resident_no_help',
    max_payroll_hrs: document.getElementById('pr_emp_maxhrs')?.value || 24,
    bank_bsb: document.getElementById('pr_emp_bsb')?.value?.trim() || '',
    bank_account_no: document.getElementById('pr_emp_accno')?.value?.trim() || '',
    bank_account_name: document.getElementById('pr_emp_accname')?.value?.trim() || '',
    tfn: document.getElementById('pr_emp_tfn')?.value?.trim() || '',
    super_fund: document.getElementById('pr_emp_superfund')?.value?.trim() || '',
    super_member_no: document.getElementById('pr_emp_memberno')?.value?.trim() || '',
  };

  if (!data.employee_code || !data.full_name) {
    SPG.toast('Employee code and name are required', 'error');
    if (btn) btn.disabled = false;
    return;
  }

  try {
    SPG.showLoader();
    await FIN.api('save_employee', data);
    SPG.toast(data.employee_id ? 'Employee updated ✔' : 'Employee created ✔', 'success');
    SPG.go('finance/pr-emp');
  } catch (e) {
    SPG.toast(e.message || 'Save failed', 'error');
  } finally {
    SPG.hideLoader();
    if (btn) btn.disabled = false;
  }
}

function deleteEmployee() {
  if (!_empDetail?.employee?.id) return;

  SPG.showDialog(`<div class="popup-sheet"><div class="popup-sheet-header"><div class="popup-sheet-title">Deactivate Employee</div></div><div class="popup-sheet-body"><p>Set <b>${esc(_empDetail.employee.full_name)}</b> as Inactive?</p></div><div class="popup-sheet-footer"><button class="btn-outline" onclick="SPG.closeDialog()">Cancel</button><button class="btn-danger" onclick="FinanceSection.confirmDeleteEmployee()">Deactivate</button></div></div>`);
}

async function confirmDeleteEmployee() {
  SPG.closeDialog();
  try {
    SPG.showLoader();
    await FIN.api('delete_employee', { employee_id: _empDetail.employee.id });
    SPG.toast('Employee deactivated', 'success');
    SPG.go('finance/pr-emp');
  } catch (e) {
    SPG.toast(e.message || 'Delete failed', 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ═══════════════════════════════════════
// 8. WAGE PAYMENTS — Weekly View (pr-wage)
// ═══════════════════════════════════════

function renderPrWage() {
  const brandOpts = FIN.brandOpts('');
  const actions = `<button class="btn-primary" onclick="SPG.go('finance/py-record')">Record Wage Payment</button>`;

  return SPG.shell(SPG.toolbar('Wage Payments', actions) + `<div class="content" id="fin-pr-wage"><div style="max-width:1060px;margin:0 auto">
    <div style="display:flex;gap:8px;align-items:flex-end;margin-bottom:10px;flex-wrap:wrap">
      <div><div class="fl-label">Brand</div><select class="fl" id="pr_wg_brand"><option>All Brands</option>${brandOpts}</select></div>
      <div><div class="fl-label">Status</div><select class="fl" id="pr_wg_status"><option>All</option><option>Outstanding</option><option>Paid</option></select></div>
      <div style="flex:1"></div>
      <button class="btn-outline" style="color:var(--acc)" onclick="FinanceSection.refreshWage()">Refresh</button>
    </div>
    <div class="kpi-grid">
      <div class="kpi-card" style="border-top:3px solid var(--red)"><div class="kpi-value" style="color:var(--red)" id="pr_wg_outstanding">$0</div><div class="kpi-label">Outstanding</div></div>
      <div class="kpi-card" style="border-top:3px solid var(--green)"><div class="kpi-value" style="color:var(--green)" id="pr_wg_paid">$0</div><div class="kpi-label">Paid</div></div>
      <div class="kpi-card" style="border-top:3px solid var(--blue)"><div class="kpi-value" id="pr_wg_total">$0</div><div class="kpi-label">Total Wages</div></div>
      <div class="kpi-card"><div class="kpi-value" id="pr_wg_periods">0</div><div class="kpi-label">Pay Periods</div></div>
      <div class="kpi-card"><div class="kpi-value" id="pr_wg_emps">0</div><div class="kpi-label">Employees</div></div>
    </div>
    <div id="pr_wg_cards"><div style="text-align:center;padding:30px;color:var(--t3)">Loading...</div></div>
    <div style="font-size:10px;color:var(--t3);margin-top:8px">Tax rate = หัก PAYG + Super · Cash rate = จ่ายสด · Record Wage Payment → หน้า Record Payment</div>
  </div></div>`, 'Finance');
}

async function loadPrWage() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadWage();
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

async function _loadWage() {
  try {
    const data = await FIN.api('get_wage_payments', {
      brand: document.getElementById('pr_wg_brand')?.value || 'All Brands',
      status: document.getElementById('pr_wg_status')?.value || 'All',
    });
    _wageData = data;
    _renderWageKpi();
    _renderWageCards();
  } catch (e) {
    const el = document.getElementById('pr_wg_cards');
    if (el) el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--red)">${esc(e.message)}</div>`;
  }
}

function _renderWageKpi() {
  const k = _wageData?.kpi || {};
  const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  el('pr_wg_outstanding', fm(k.outstanding || 0));
  el('pr_wg_paid', fm(k.paid || 0));
  el('pr_wg_total', fm(k.total || 0));
  el('pr_wg_periods', k.periods || 0);
  el('pr_wg_emps', k.employees || 0);
}

function _renderWageCards() {
  const container = document.getElementById('pr_wg_cards');
  if (!container) return;
  const weeks = _wageData?.weeks || [];
  if (weeks.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--t3)">No wage data</div>';
    return;
  }

  container.innerHTML = weeks.map((w, i) => {
    const isOwing = w.status === 'owing' || w.status === 'approved';
    const borderColor = isOwing ? 'var(--red)' : 'var(--green)';
    const stsLabel = isOwing ? 'Owing' : 'Paid';
    const stsBg = isOwing ? 'var(--red-bg)' : 'var(--green-bg)';
    const stsColor = isOwing ? 'var(--red)' : 'var(--green)';
    const wId = 'prwg_' + i;
    const period = _fmtPeriod(w.period_start, w.period_end);
    const lines = w.lines || [];

    const empRows = lines.map(l => {
      const isCash = l.pay_type === 'cash' || l.pay_type === 'cash_only';
      const hrs = Number(l.payroll_hrs || 0) + Number(l.cash_hrs || 0);
      const gross = Number(l.cash_pay || 0) + Number(l.transfer_pay || 0);
      const net = gross - Number(l.tax_withheld || 0);
      const rowBg = isCash ? 'background:var(--bg3)' : '';
      const typeLabel = isCash ? 'Cash' : 'Tax';
      const typeBg = isCash ? 'background:var(--acc2);color:var(--acc)' : 'background:var(--blue-bg);color:var(--blue)';
      return `<tr style="${rowBg}">
        <td style="font-weight:600">${esc(l.employee_name || '')}${l.employee_nickname ? ' (' + esc(l.employee_nickname) + ')' : ''}</td>
        <td>${esc(l.brand_id || '')}</td>
        <td style="text-align:right">${hrs.toFixed(0)}</td>
        <td style="text-align:right">${fm(gross, 0)}</td>
        <td style="text-align:right;color:var(--t3)">${isCash ? '—' : fm(l.tax_withheld, 0)}</td>
        <td style="text-align:right;color:var(--t3)">${isCash ? '—' : fm(l.super_amount, 0)}</td>
        <td style="text-align:right;font-weight:700">${fm(net, 0)}</td>
        <td><span style="font-size:9px;padding:2px 8px;border-radius:16px;${typeBg}">${typeLabel}</span></td>
        <td><span style="font-size:9px;padding:2px 8px;border-radius:16px;background:${stsBg};color:${stsColor}">${stsLabel}</span></td>
      </tr>`;
    }).join('');

    const totalGross = lines.reduce((s, l) => s + Number(l.cash_pay || 0) + Number(l.transfer_pay || 0), 0);

    return `<div class="card" style="border-left:4px solid ${borderColor};padding:12px 16px;margin-bottom:8px${!isOwing && i > 1 ? ';opacity:.6' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="var b=document.getElementById('${wId}');b.style.display=b.style.display==='none'?'block':'none'">
        <div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:13px;font-weight:700">${esc(period)} ${(w.period_start || '').substring(0, 4)}</span>
            ${w.pay_run_no ? '<span style="font-size:11px;color:var(--t3)">Pay Run <a class="lk">' + esc(w.pay_run_no) + '</a></span>' : ''}
            <span style="font-size:9px;padding:2px 8px;border-radius:16px;background:${stsBg};color:${stsColor}">${stsLabel}</span>
          </div>
          ${w.pay_date ? '<div style="font-size:10px;color:' + stsColor + ';font-weight:600;margin-top:2px">' + (isOwing ? 'Due: ' : 'Paid: ') + _fmtPayDate(w.pay_date) + '</div>' : ''}
        </div>
        <div style="display:flex;gap:14px;text-align:right">
          <div><div style="font-size:9px;color:var(--t3)">Gross</div><div style="font-size:14px;font-weight:700">${fm(totalGross, 0)}</div></div>
          <div style="color:var(--acc);font-size:14px;display:flex;align-items:center">▼</div>
        </div>
      </div>
      <div id="${wId}" style="display:${i === 0 && isOwing ? 'block' : 'none'};margin-top:10px">
        ${lines.length > 0 ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Employee</th><th>Brand</th><th style="text-align:right">Hours</th><th style="text-align:right">Gross</th><th style="text-align:right">PAYG</th><th style="text-align:right">Super</th><th style="text-align:right">Net Pay</th><th>Pay Type</th><th>Status</th></tr></thead><tbody>' + empRows + '</tbody></table></div>' : '<div style="padding:12px;text-align:center;font-size:11px;color:var(--t3)">No detail</div>'}
        ${isOwing ? '<div style="display:flex;justify-content:flex-end;padding-top:8px;margin-top:4px"><button class="btn-primary" style="font-size:11px;padding:5px 14px" onclick="SPG.go(\'finance/py-record\')">Record Wage Payment →</button></div>' : ''}
      </div>
    </div>`;
  }).join('');
}


// ═══════════════════════════════════════
// 9. SUPERANNUATION — Quarter Cards (pr-super)
// ═══════════════════════════════════════

function renderPrSuper() {
  const brandOpts = FIN.brandOpts('');
  const actions = `<select class="fl" id="pr_sp_brand" style="width:140px"><option value="">All Brands</option>${brandOpts}</select><button class="btn-primary" onclick="SPG.go('finance/py-record')">Record Super Payment</button>`;

  return SPG.shell(SPG.toolbar('Superannuation', actions) + `<div class="content" id="fin-pr-super"><div style="max-width:1060px;margin:0 auto">
    <div class="kpi-grid">
      <div class="kpi-card" style="border-top:3px solid var(--red)"><div class="kpi-value" style="color:var(--red)" id="pr_sp_outstanding">$0</div><div class="kpi-label">Outstanding</div></div>
      <div class="kpi-card" style="border-top:3px solid var(--green)"><div class="kpi-value" style="color:var(--green)" id="pr_sp_paid">$0</div><div class="kpi-label">Paid</div></div>
      <div class="kpi-card" style="border-top:3px solid var(--blue)"><div class="kpi-value" id="pr_sp_accrued">$0</div><div class="kpi-label">Accrued</div></div>
      <div class="kpi-card"><div class="kpi-value" id="pr_sp_rate">12%</div><div class="kpi-label">Rate</div></div>
      <div class="kpi-card"><div class="kpi-value" id="pr_sp_emps">0</div><div class="kpi-label">Employees</div></div>
    </div>
    <div id="pr_sp_cards"><div style="text-align:center;padding:30px;color:var(--t3)">Loading...</div></div>
    <div style="font-size:10px;color:var(--t3);margin-top:8px">Super rate 12% · Accrued from Pay Run (weekly) · กด ▶ ที่ชื่อ → weekly detail</div>
  </div></div>`, 'Finance');
}

async function loadPrSuper() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    _superData = await FIN.api('get_super_obligations', {});
    _renderObligationKpi('sp', _superData);
    _renderQuarterCards('pr_sp_cards', _superData, 'super');
  } catch (e) {
    SPG.toast(e.message, 'error');
    const el = document.getElementById('pr_sp_cards');
    if (el) el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--red)">${esc(e.message)}</div>`;
  }
}


// ═══════════════════════════════════════
// 10. PAYG WITHHOLDING TAX — Quarter Cards (pr-payg)
// ═══════════════════════════════════════

function renderPrPayg() {
  const brandOpts = FIN.brandOpts('');
  const actions = `<select class="fl" id="pr_pg_brand" style="width:140px"><option value="">All Brands</option>${brandOpts}</select><button class="btn-primary" onclick="SPG.go('finance/py-record')">Record PAYG Payment</button>`;

  return SPG.shell(SPG.toolbar('Withholding Tax (PAYG)', actions) + `<div class="content" id="fin-pr-payg"><div style="max-width:1060px;margin:0 auto">
    <div class="kpi-grid">
      <div class="kpi-card" style="border-top:3px solid var(--red)"><div class="kpi-value" style="color:var(--red)" id="pr_pg_outstanding">$0</div><div class="kpi-label">Outstanding</div></div>
      <div class="kpi-card" style="border-top:3px solid var(--green)"><div class="kpi-value" style="color:var(--green)" id="pr_pg_paid">$0</div><div class="kpi-label">Submitted</div></div>
      <div class="kpi-card" style="border-top:3px solid var(--blue)"><div class="kpi-value" id="pr_pg_accrued">$0</div><div class="kpi-label">Total Withheld</div></div>
      <div class="kpi-card"><div class="kpi-value" id="pr_pg_emps">0</div><div class="kpi-label">Employees</div></div>
    </div>
    <div id="pr_pg_cards"><div style="text-align:center;padding:30px;color:var(--t3)">Loading...</div></div>
    <div style="font-size:10px;color:var(--t3);margin-top:8px">PAYG withheld from wages · Accrued from Pay Run (weekly) · Work Period = ฐาน</div>
  </div></div>`, 'Finance');
}

async function loadPrPayg() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    _paygData = await FIN.api('get_payg_obligations', {});
    _renderObligationKpi('pg', _paygData);
    _renderQuarterCards('pr_pg_cards', _paygData, 'payg');
  } catch (e) {
    SPG.toast(e.message, 'error');
    const el = document.getElementById('pr_pg_cards');
    if (el) el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--red)">${esc(e.message)}</div>`;
  }
}


// ═══════════════════════════════════════
// SHARED: Quarter Card Renderer (Super + PAYG)
// ═══════════════════════════════════════

function _renderObligationKpi(prefix, data) {
  const k = data?.kpi || {};
  const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  el('pr_' + prefix + '_outstanding', fm(k.outstanding || 0));
  el('pr_' + prefix + '_paid', fm(k.paid || 0));
  el('pr_' + prefix + '_accrued', fm(k.accrued || 0));
  if (prefix === 'sp') el('pr_sp_rate', (k.rate || 12) + '%');
  el('pr_' + prefix + '_emps', k.employees || 0);
}

function _renderQuarterCards(containerId, data, type) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const quarters = data?.quarters || [];
  if (quarters.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--t3)">No data</div>';
    return;
  }

  const amtField = type === 'super' ? 'super_amount' : 'tax_withheld';
  const amtLabel = type === 'super' ? 'Super' : 'Withheld';
  const paidLabel = type === 'super' ? 'Paid' : 'Submitted';
  const btnLabel = type === 'super' ? 'Record Super Payment →' : 'Record PAYG Payment →';

  container.innerHTML = quarters.map((q, qi) => {
    const isOwing = q.outstanding > 0;
    const borderColor = isOwing ? 'var(--red)' : 'var(--green)';
    const qId = 'prq_' + type + '_' + qi;
    const employees = q.employees || [];

    const empHtml = employees.map((emp, ei) => {
      const eId = qId + '_e' + ei;
      const empOwing = Number(emp.accrued || 0) - Number(emp.paid || 0);
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bd2);cursor:pointer" onclick="var r=document.getElementById('${eId}');r.style.display=r.style.display==='none'?'block':'none'">
        <span style="color:var(--acc);font-size:12px">▶</span>
        <span style="font-weight:600;font-size:12px">${esc(emp.full_name || '')}</span>
        <span style="font-size:10px;color:var(--t3)">(${esc(emp.nickname || '')}) · ${esc(emp.brand || '')}${emp.fund ? ' · ' + esc(emp.fund) : ''}</span>
        <span style="margin-left:auto;font-size:11px">Accrued <b>${fm(emp.accrued)}</b> · ${paidLabel} <b style="color:var(--green)">${fm(emp.paid)}</b> · <b style="color:${empOwing > 0 ? 'var(--red)' : 'var(--green)'}">Owing ${fm(empOwing)}</b></span>
      </div>
      <div id="${eId}" style="display:${ei === 0 && qi === 0 && isOwing ? 'block' : 'none'}">
        ${emp.weeks && emp.weeks.length > 0 ? _buildWeekTable(emp.weeks, amtField, amtLabel) : '<div style="padding:8px;font-size:11px;color:var(--t3)">No weekly detail</div>'}
      </div>`;
    }).join('');

    return `<div class="card" style="border-left:4px solid ${borderColor};padding:12px 16px;margin-bottom:8px${!isOwing && qi > 0 ? ';opacity:.6' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="var b=document.getElementById('${qId}');b.style.display=b.style.display==='none'?'block':'none'">
        <div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:14px;font-weight:700">${esc(q.label || '')}</span>
            <span style="font-size:11px;color:var(--t3)">${esc(q.range || '')}</span>
            <span class="sts ${isOwing ? 'sts-err' : 'sts-ok'}" style="font-size:9px">${isOwing ? 'Owing' : (type === 'super' ? 'Fully Paid' : 'Submitted')}</span>
          </div>
          <div style="font-size:10px;color:${isOwing ? 'var(--red)' : 'var(--green)'};font-weight:600;margin-top:2px">${esc(q.due_text || '')}</div>
        </div>
        <div style="display:flex;gap:14px;text-align:right">
          <div><div style="font-size:9px;color:var(--t3)">Accrued</div><div style="font-size:14px;font-weight:700">${fm(q.accrued)}</div></div>
          <div><div style="font-size:9px;color:var(--t3)">${paidLabel}</div><div style="font-size:14px;font-weight:700;color:var(--green)">${fm(q.paid)}</div></div>
          <div><div style="font-size:9px;color:var(--t3)">Outstanding</div><div style="font-size:14px;font-weight:800;color:${isOwing ? 'var(--red)' : 'var(--green)'}">${fm(q.outstanding)}</div></div>
          <div style="color:var(--acc);font-size:14px;display:flex;align-items:center">▼</div>
        </div>
      </div>
      <div id="${qId}" style="display:${qi === 0 && isOwing ? 'block' : 'none'};margin-top:10px">
        ${empHtml}
        ${isOwing ? '<div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid var(--bd2);margin-top:6px"><span style="font-size:11px;color:var(--t3)">Select weeks → Record Payment</span><button class="btn-primary" style="font-size:11px;padding:5px 14px" onclick="SPG.go(\'finance/py-record\')">' + btnLabel + '</button></div>' : ''}
      </div>
    </div>`;
  }).join('');
}

function _buildWeekTable(weeks, amtField, amtLabel) {
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr>
    <th>Work Period</th><th>Pay Date</th><th style="text-align:right">Gross</th>
    <th style="text-align:right">${esc(amtLabel)}</th><th>${amtField === 'super_amount' ? 'Paid' : 'Submitted'}</th><th>Status</th>
  </tr></thead><tbody>${weeks.map(w => {
    const isPaid = w.status === 'paid' || w.status === 'submitted';
    const rowBg = isPaid ? 'background:var(--green-bg)' : '';
    const color = isPaid ? 'color:var(--green)' : '';
    return `<tr style="${rowBg}">
      <td ${color ? 'style="' + color + '"' : ''}>${_fmtPeriod(w.period_start, w.period_end)}</td>
      <td ${color ? 'style="' + color + '"' : ''}>${fd(w.pay_date)}</td>
      <td style="text-align:right;${color}">${fm(w.gross, 0)}</td>
      <td style="text-align:right;font-weight:600;${color}">${fm(w.amount)}</td>
      <td ${color ? 'style="' + color + '"' : ''}>${isPaid ? fd(w.paid_date || w.pay_date) : '<span style="color:var(--t4)">—</span>'}</td>
      <td><span class="sts ${isPaid ? 'sts-ok' : 'sts-err'}">${isPaid ? (amtField === 'super_amount' ? 'Paid' : 'Submitted') : 'Owing'}</span></td>
    </tr>`;
  }).join('')}</tbody></table></div>`;
}


// ═══════════════════════════════════════
// NAVIGATION HELPERS
// ═══════════════════════════════════════

function goCreate() {
  _wizardPayRun = null;
  _wizardLines = [];
  SPG.go('finance/pr-create-s1');
}

function goCreateEdit(payRunId) {
  _wizardPayRun = S._payRuns.find(r => r.id === payRunId) || null;
  _wizardLines = [];
  SPG.go('finance/pr-create-s1');
}

function goDetail(payRunId) {
  _detailPayRun = S._payRuns.find(r => r.id === payRunId) || { id: payRunId };
  SPG.go('finance/pr-detail');
}

function goEmpDetail(empId) {
  _empDetail = { employee: _employees.find(e => e.id === empId) || { id: empId } };
  _empActiveTab = 'profile';
  SPG.go('finance/pr-emp-detail');
}


// ═══════════════════════════════════════
// REGISTER TO PARENT (FIN)
// ═══════════════════════════════════════

FIN.renderPrRuns = renderPrRuns;
FIN.loadPrRuns = loadPrRuns;
FIN.renderPrCreateS1 = renderPrCreateS1;
FIN.loadPrCreateS1 = loadPrCreateS1;
FIN.renderPrCreateS2 = renderPrCreateS2;
FIN.loadPrCreateS2 = loadPrCreateS2;
FIN.renderPrCreateS3 = renderPrCreateS3;
FIN.loadPrCreateS3 = loadPrCreateS3;
FIN.renderPrDetail = renderPrDetail;
FIN.loadPrDetail = loadPrDetail;
FIN.renderPrEmp = renderPrEmp;
FIN.loadPrEmp = loadPrEmp;
FIN.renderPrEmpDetail = renderPrEmpDetail;
FIN.loadPrEmpDetail = loadPrEmpDetail;
FIN.renderPrWage = renderPrWage;
FIN.loadPrWage = loadPrWage;
FIN.renderPrSuper = renderPrSuper;
FIN.loadPrSuper = loadPrSuper;
FIN.renderPrPayg = renderPrPayg;
FIN.loadPrPayg = loadPrPayg;

Object.assign(window.FinanceSection, {
  // Pay Runs
  goCreate,
  goCreateEdit,
  goDetail,
  applyPrFilter,
  // Create wizard
  saveStep1,
  onFilePayroll,
  onFileAllocation,
  importAndNext,
  approvePayRun,
  confirmApprove,
  // Detail
  markPaid,
  confirmMarkPaid,
  exportCsv,
  // Employees
  goEmpDetail,
  applyEmpFilter,
  addEmployee,
  switchEmpTab,
  saveEmployee,
  deleteEmployee,
  confirmDeleteEmployee,
  // Wage
  refreshWage: _loadWage,
});

})();
