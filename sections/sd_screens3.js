/**
 * SPG HUB v1.0.0 | 22 MAR 2026 | Siam Palette Group
 * sections/sd_screens3.js — History + Report + Tasks + Daily Hub
 * S5: Sale History | S6: Expense History | S8: Daily Report (3 tabs)
 * Tasks (standalone) | Daily Hub (7-day overview)
 *
 * Depends on: sd_core.js (SD global)
 */

(() => {
const S = SD.S;
const esc = SD.esc;
const fm = SD.fmtMoney;
const fms = SD.fmtMoneyShort;
const td = SD.todayStr;
const ui = SPG.ui;
const _busy = {};
const SECTION = 'Sales Daily';

// ═══ CONSTANTS ═══
const INCIDENT_CATS = [
  { key: 'food_quality', icon: '🍽️', name: 'Food Quality', desc: 'รสชาติเปลี่ยน, ไม่อร่อย' },
  { key: 'contamination', icon: '🦠', name: 'Contamination', desc: 'ผมในอาหาร, เศษวัตถุ' },
  { key: 'service_delay', icon: '⏱️', name: 'Service Delay', desc: 'ออเดอร์ช้า, คิวยาว' },
  { key: 'wrong_order', icon: '🔄', name: 'Wrong Order', desc: 'เสิร์ฟผิดเมนู' },
  { key: 'complaint', icon: '💢', name: 'Customer Complaint', desc: 'บ่น, ขอคืนเงิน' },
  { key: 'waste', icon: '🗑️', name: 'Waste / เหลือผิดปกติ', desc: 'เมนูเหลือเยอะ' },
  { key: 'staff', icon: '👤', name: 'Staff Issue', desc: 'ขาดคน, พฤติกรรม' },
];
const LEVEL_OPTS = [
  { key: 'little', label: '🟢 นิดหน่อย' },
  { key: 'half', label: '🟡 ครึ่งนึง' },
  { key: 'almost_full', label: '🔴 เกือบหมด' },
  { key: 'full', label: '⚫ ทั้งจาน' },
];

function backBtn() { return `<button class="toolbar-back" onclick="SPG.go('sales/dashboard')">←</button>`; }


// ═══════════════════════════════════════
// S5: SALE HISTORY
// ═══════════════════════════════════════
let s5 = { records: [], offset: 0, dateFrom: '', dateTo: '' };

function renderS5(p) {
  const now = td(); s5.dateTo = s5.dateTo || now; s5.dateFrom = s5.dateFrom || SD.addDays(now, -3);
  return SPG.shell(`<div class="toolbar">${backBtn()}<div class="toolbar-title">Sale History</div></div>
  <div class="content" id="s5-content">
    ${SD.renderStoreSelector()}
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;font-size:12px"><span>📅</span><input class="fi" type="date" style="flex:1;padding:6px 8px" id="s5-from" value="${s5.dateFrom}" onchange="SDSection.s5Reload()"><span style="color:var(--t3)">→</span><input class="fi" type="date" style="flex:1;padding:6px 8px" id="s5-to" value="${s5.dateTo}" onchange="SDSection.s5Reload()"></div>
    <div id="s5-kpi" class="kpi-row kpi-3" style="margin-bottom:12px">${ui.skeleton(72, 3)}</div>
    <div id="s5-list">${ui.skeleton(100)}</div>
    <div id="s5-more" style="display:none;text-align:center;padding:10px"><span style="font-size:11px;color:var(--acc);padding:5px 14px;border:1px solid var(--bd);border-radius:var(--rd);cursor:pointer" onclick="SDSection.s5LoadMore()">โหลดเพิ่ม →</span></div>
  </div>`, SECTION);
}

async function loadS5(reset) {
  await SD.initModule(); if (!S.initLoaded) return; SD.buildSDSidebar();
  if (reset) { s5.records = []; s5.offset = 0; }
  if (_busy.s5) return; _busy.s5 = true;
  try {
    const data = await SD.api('get_sale_history', { store_id: SD.getStore(), date_from: s5.dateFrom, date_to: s5.dateTo, limit: 10, offset: s5.offset });
    const nr = data.records || [];
    s5.records = s5.offset === 0 ? nr : [...s5.records, ...nr]; fillS5();
    document.getElementById('s5-more').style.display = nr.length >= 10 ? '' : 'none';
  } catch { SPG.toast('โหลดไม่สำเร็จ', 'error'); } finally { _busy.s5 = false; }
}

function fillS5() {
  const total = s5.records.reduce((s, r) => s + (r.total_sales || 0), 0);
  const cnt = s5.records.length; const avg = cnt > 0 ? Math.round(total / cnt) : 0;
  document.getElementById('s5-kpi').innerHTML = `
    <div class="kpi-box"><div class="kpi-label">Total</div><div class="kpi-val" style="color:var(--theme)">${fms(total)}</div></div>
    <div class="kpi-box"><div class="kpi-label">Recorded</div><div class="kpi-val">${cnt}</div></div>
    <div class="kpi-box"><div class="kpi-label">เฉลี่ย/วัน</div><div class="kpi-val">${fms(avg)}</div></div>`;
  const el = document.getElementById('s5-list'); if (!el) return;
  if (!s5.records.length) { el.innerHTML = ui.empty('', 'ยังไม่มีข้อมูล'); return; }
  el.innerHTML = s5.records.map(r => {
    const synced = r.sync_status === 'synced';
    const channels = r.sd_sale_channels || [];
    const chText = channels.map(c => `${c.channel_key}: ${fm(c.amount)}`).join(' · ');
    return `<div class="card" style="padding:10px;cursor:pointer;margin-bottom:6px;${synced ? 'opacity:.7' : ''}" onclick="SPG.go('sales/daily-hub')">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <div><div style="font-size:12px;font-weight:700">${SD.fmtDate(r.sale_date)}</div><div style="font-size:10px;color:var(--t3)">${esc(r.store_id)} · ${channels.length} ch</div></div>
        <div style="text-align:right"><div style="font-size:14px;font-weight:700;color:var(--theme)">${fm(r.total_sales)}</div>${synced ? '<span class="sts sts-ok">🔒 Synced</span>' : '<span class="sts sts-ok">✏️ Editable</span>'}</div>
      </div>
      ${channels.length ? `<details style="font-size:10px;color:var(--t3)"><summary>▸ Channel breakdown</summary><div style="padding:4px 0">${chText}</div></details>` : ''}
    </div>`;
  }).join('');
}

function s5Reload() { s5.dateFrom = document.getElementById('s5-from')?.value || s5.dateFrom; s5.dateTo = document.getElementById('s5-to')?.value || s5.dateTo; loadS5(true); }
function s5LoadMore() { s5.offset += 10; loadS5(false); }


// ═══════════════════════════════════════
// S6: EXPENSE HISTORY
// ═══════════════════════════════════════
let s6 = { expenses: [], invoices: [], filter: 'all', offset: 0, dateFrom: '', dateTo: '', _items: [] };

function renderS6(p) {
  const now = td(); s6.dateTo = s6.dateTo || now; s6.dateFrom = s6.dateFrom || SD.addDays(now, -3);
  return SPG.shell(`<div class="toolbar">${backBtn()}<div class="toolbar-title">Expense History</div></div>
  <div class="content" id="s6-content">
    ${SD.renderStoreSelector()}
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;font-size:12px"><span>📅</span><input class="fi" type="date" style="flex:1;padding:6px 8px" id="s6-from" value="${s6.dateFrom}" onchange="SDSection.s6Reload()"><span style="color:var(--t3)">→</span><input class="fi" type="date" style="flex:1;padding:6px 8px" id="s6-to" value="${s6.dateTo}" onchange="SDSection.s6Reload()"></div>
    <div style="display:flex;gap:4px;margin-bottom:10px">
      <div class="chip active" onclick="SDSection.s6SetFilter('all',this)">All</div>
      <div class="chip" onclick="SDSection.s6SetFilter('expense',this)">Expense</div>
      <div class="chip" onclick="SDSection.s6SetFilter('invoice',this)">Invoice</div>
    </div>
    <div id="s6-list">${ui.skeleton(100)}</div>
    <div id="s6-more" style="display:none;text-align:center;padding:10px"><span style="font-size:11px;color:var(--acc);padding:5px 14px;border:1px solid var(--bd);border-radius:var(--rd);cursor:pointer" onclick="SDSection.s6LoadMore()">โหลดเพิ่ม →</span></div>
  </div>`, SECTION);
}

async function loadS6(reset) {
  await SD.initModule(); if (!S.initLoaded) return; SD.buildSDSidebar();
  if (reset) { s6.expenses = []; s6.invoices = []; s6.offset = 0; }
  if (_busy.s6) return; _busy.s6 = true;
  try {
    const data = await SD.api('get_expense_history', { store_id: SD.getStore(), date_from: s6.dateFrom, date_to: s6.dateTo, limit: 10, offset: s6.offset, filter: s6.filter });
    if (s6.offset === 0) { s6.expenses = data.expenses || []; s6.invoices = data.invoices || []; }
    else { s6.expenses = [...s6.expenses, ...(data.expenses || [])]; s6.invoices = [...s6.invoices, ...(data.invoices || [])]; }
    fillS6();
  } catch { SPG.toast('โหลดไม่สำเร็จ', 'error'); } finally { _busy.s6 = false; }
}

function fillS6() {
  const el = document.getElementById('s6-list'); if (!el) return;
  let items = [];
  if (s6.filter !== 'invoice') items.push(...s6.expenses.map(x => ({ ...x, _type: 'expense', _date: x.expense_date, _synced: x.sync_status === 'synced' })));
  if (s6.filter !== 'expense') items.push(...s6.invoices.map(x => ({ ...x, _type: 'invoice', _date: x.invoice_date, _synced: x.sync_status === 'synced' })));
  items.sort((a, b) => b._date.localeCompare(a._date));
  s6._items = items;
  if (!items.length) { el.innerHTML = ui.empty('', 'ยังไม่มีข้อมูล'); return; }
  el.innerHTML = items.map((it, idx) => {
    const isInv = it._type === 'invoice';
    let html = `<div class="card" style="padding:10px;margin-bottom:6px;border-left:3px solid ${isInv ? 'var(--orange)' : 'var(--t4)'};${it._synced ? 'opacity:.7;' : ''}cursor:pointer" onclick="SDSection.showDetail(${idx})">
      <div style="display:flex;justify-content:space-between">
        <div><div style="font-size:12px;font-weight:700">${esc(it.description || it.invoice_no)}</div><div style="font-size:10px;color:var(--t3)">${esc(it.vendor_name)} · ${it._date} · ${isInv ? 'Invoice' : 'Bill'} ${it._synced ? '🔒' : ''}</div></div>
        <div style="text-align:right"><div style="font-size:13px;font-weight:700;color:var(--red)">-${fm(it.total_amount)}</div>${isInv ? ui.badge(it.payment_status === 'paid' ? 'approved' : 'rejected') : ''}</div>
      </div>
    </div>`;
    if (isInv && it.has_credit_note && it.credit_note_no) {
      html += `<div class="card" style="margin-top:-8px;margin-left:24px;padding:6px 10px;background:var(--green-bg);border-left:3px solid var(--green);cursor:pointer;margin-bottom:6px" onclick="SDSection.showDetail(${idx})"><div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:11px;color:var(--green);font-weight:600">↳ CN: ${esc(it.credit_note_no)}</div><div style="font-size:12px;font-weight:700;color:var(--green)">+${fm(parseFloat(it.credit_note_amount) || 0)}</div></div></div>`;
    }
    return html;
  }).join('');
  document.getElementById('s6-more').style.display = items.length >= 10 ? '' : 'none';
}

function showDetail(idx) {
  const it = s6._items?.[idx]; if (!it) return;
  const isInv = it._type === 'invoice';
  const rows = [['Type', isInv ? 'Invoice' : 'Expense'], ['Date', SD.fmtDate(it._date)], isInv ? ['Invoice No.', it.invoice_no] : ['Doc Number', it.doc_number], ['Vendor', it.vendor_name], ['Description', it.description], ['Amount (ex GST)', fm(it.amount_ex_gst)], ['GST', fm(it.gst)], ['Total', fm(it.total_amount)]];
  if (isInv) { rows.push(['Status', it.payment_status]); if (it.due_date) rows.push(['Due Date', SD.fmtDate(it.due_date)]); if (it.has_credit_note) { rows.push(['Credit Note', it.credit_note_no || '—']); rows.push(['CN Amount', fm(parseFloat(it.credit_note_amount) || 0)]); } }
  else { rows.push(['Payment', it.payment_method || '—']); }
  if (it._synced) rows.push(['Sync', '🔒 Synced']);
  const photoHtml = it.photo_url ? `<div style="margin-top:10px"><img src="${esc(it.photo_url)}" style="max-width:100%;border-radius:var(--rd);max-height:200px;object-fit:contain" onerror="this.style.display='none'"></div>` : '';
  SPG.showDialog(`<div class="popup-sheet" style="width:380px;max-height:80vh;overflow-y:auto">
    <div class="popup-header"><div class="popup-title">${isInv ? 'Invoice' : 'Expense'} Detail</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div style="background:var(--bg3);border-radius:var(--rd);padding:12px;font-size:12px">${rows.map(r => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--bd2)"><span style="color:var(--t3)">${r[0]}</span><span style="font-weight:600;text-align:right;max-width:60%;word-break:break-word">${esc(r[1])}</span></div>`).join('')}</div>
    ${photoHtml}
    <button class="btn btn-outline btn-full" style="margin-top:12px" onclick="SPG.closeDialog()">Close</button>
  </div>`);
}

function s6Reload() { s6.dateFrom = document.getElementById('s6-from')?.value || s6.dateFrom; s6.dateTo = document.getElementById('s6-to')?.value || s6.dateTo; loadS6(true); }
function s6SetFilter(f, el) { s6.filter = f; el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); el.classList.add('active'); loadS6(true); }
function s6LoadMore() { s6.offset += 10; loadS6(false); }


// ═══════════════════════════════════════
// S8: DAILY REPORT (3 tabs)
// ═══════════════════════════════════════
let s8 = { date: '', tab: 'overview', report: null, incidents: [], leftovers: [], tasks: [], summary: null };
let _s8Weather = null, _s8Traffic = null, _s8PosStatus = null, _s8Waste = null;

function renderS8(params) {
  if (params?.date) s8.date = params.date;
  s8.date = s8.date || td();
  return SPG.shell(`<div class="toolbar">${backBtn()}<div class="toolbar-title">Daily Report</div></div>
  <div class="content" id="s8-content">
    ${SD.renderStoreSelector({ noAll: true })}
    <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:4px 0 10px;font-size:13px;font-weight:600">
      <button class="btn btn-outline btn-sm" onclick="SDSection.s8Nav(-1)">‹</button>
      <span id="s8-date-label">📅 ${SD.fmtDate(s8.date)}</span>
      <button class="btn btn-outline btn-sm" onclick="SDSection.s8Nav(1)">›</button>
    </div>
    <div class="tab-row" id="s8-tabs">
      <div class="tab-pill on" style="flex:1" data-tab="overview" onclick="SDSection.s8SetTab('overview',this)">📊 ภาพรวม</div>
      <div class="tab-pill" style="flex:1" data-tab="incidents" onclick="SDSection.s8SetTab('incidents',this)">⚠️ เหตุการณ์</div>
      <div class="tab-pill" style="flex:1" data-tab="tasks" onclick="SDSection.s8SetTab('tasks',this)">📋 ติดตาม</div>
    </div>
    <div id="s8-tab-content">${ui.skeleton(200)}</div>
    <div style="display:flex;gap:8px;margin-top:8px;padding-bottom:8px">
      <button class="btn btn-primary" style="flex:1;padding:10px" id="s8-save" onclick="SDSection.s8Save()">💾 บันทึก</button>
      <button class="btn btn-outline" style="flex:1" onclick="SDSection.s8Copy()">📋 Copy</button>
    </div>
  </div>`, SECTION);
}

async function loadS8(params) {
  await SD.initModule(); if (!S.initLoaded) return; SD.buildSDSidebar();
  if (params?.date) s8.date = params.date;
  if (_busy.s8) return; _busy.s8 = true;
  try {
    const [repData, sumData] = await Promise.all([
      SD.api('get_daily_report', { store_id: SD.getStore(), report_date: s8.date }),
      SD.api('get_s8_summary', { store_id: SD.getStore(), detail_date: s8.date }),
    ]);
    s8.report = repData.report;
    s8.incidents = [];
    INCIDENT_CATS.forEach(c => {
      const raw = (repData.incidents || []).find(i => i.category === c.key);
      const count = raw?.count || 0;
      let notes = [];
      if (raw?.notes && Array.isArray(raw.notes)) notes = raw.notes;
      else if (raw?.note) { try { let p = JSON.parse(raw.note); if (typeof p === 'string') p = JSON.parse(p); if (Array.isArray(p)) notes = p; else notes = [String(p)]; } catch { notes = [raw.note]; } }
      while (notes.length < count) notes.push('');
      s8.incidents.push({ category: c.key, count, notes: notes.slice(0, Math.max(count, notes.length)) });
    });
    s8.leftovers = repData.leftovers || [];
    s8.tasks = repData.tasks || [];
    s8.summary = sumData;
    _s8Weather = null; _s8Traffic = null; _s8PosStatus = null; _s8Waste = null;
    fillS8Tab();
  } catch { SPG.toast('โหลดไม่สำเร็จ', 'error'); } finally { _busy.s8 = false; }
}

function s8Nav(delta) { s8.date = SD.addDays(s8.date, delta); document.getElementById('s8-date-label').textContent = '📅 ' + SD.fmtDate(s8.date); loadS8(); }

function collectS8Overview() {
  if (!s8.report) s8.report = {};
  const note = document.getElementById('s8-note'); if (note) s8.report.overview_note = note.value;
  ['morning', 'midday', 'afternoon', 'evening', 'night'].forEach(p => { const el = document.getElementById('s8-cust-' + p); if (el) s8.report['customer_' + p] = el.value; });
  if (_s8Weather) s8.report.weather = _s8Weather;
  if (_s8Traffic) s8.report.traffic = _s8Traffic;
  if (_s8PosStatus) s8.report.pos_status = _s8PosStatus;
  if (_s8Waste !== null && _s8Waste !== undefined) s8.report.has_waste = _s8Waste;
}

function s8SetTab(tab, el) {
  if (s8.tab === 'overview') collectS8Overview();
  s8.tab = tab;
  document.querySelectorAll('#s8-tabs .tab-pill').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
  fillS8Tab();
}

function fillS8Tab() {
  const el = document.getElementById('s8-tab-content'); if (!el) return;
  if (s8.tab === 'overview') fillS8Overview(el);
  else if (s8.tab === 'incidents') fillS8Incidents(el);
  else if (s8.tab === 'tasks') fillS8Tasks(el);
}

function fillS8Overview(el) {
  const r = s8.report || {};
  const sm = s8.summary || {};
  const channels = sm.channels || [];
  const expenses = sm.expenses || [];
  const cash = sm.cash;

  const chHtml = channels.length ? channels.map(c => `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px"><span>${esc(c.channel_key)}</span><span style="font-weight:600">${fm(c.amount)}</span></div>`).join('') + `<div style="border-top:1px solid var(--bd2);margin-top:4px;padding-top:4px;display:flex;justify-content:space-between;font-weight:700;font-size:12px"><span>Total</span><span style="color:var(--theme)">${fm(sm.total_sales || 0)}</span></div>` : '<div style="font-size:11px;color:var(--t3)">ไม่มีข้อมูล</div>';
  const expHtml = expenses.length ? expenses.map(x => `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px"><span>${esc(x.vendor_name)} · ${esc(x.description)}</span><span style="font-weight:600;color:var(--red)">-${fm(x.total_amount)}</span></div>`).join('') : '<div style="font-size:11px;color:var(--t3)">ไม่มี</div>';

  let cashHtml = '';
  if (cash) {
    const matched = cash.is_matched;
    const clr = matched ? 'var(--green)' : 'var(--red)';
    cashHtml = `<div class="card" style="padding:12px;border-left:3px solid ${clr}"><div class="sl" style="margin-top:0">💵 Cash on Hand</div>
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px"><span>Expected</span><span>${fm(cash.expected_cash || 0)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px"><span>Actual</span><span>${fm(cash.actual_cash || 0)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0 0;border-top:1px solid var(--bd2);margin-top:4px;font-weight:700;font-size:12px"><span>Diff</span><span style="color:${clr}">${fm(cash.difference || 0)}</span></div>
      <div style="margin-top:6px;padding:6px 10px;background:${matched ? 'var(--green-bg)' : 'var(--red-bg)'};border-radius:var(--rd);text-align:center;font-size:12px;font-weight:600;color:${clr}">${matched ? '✅ เงินตรง' : '🔴 เงินไม่ตรง!'}</div>
    </div>`;
  } else {
    cashHtml = `<div class="card" style="padding:12px"><div class="sl" style="margin-top:0">💵 Cash on Hand</div><div style="font-size:11px;color:var(--t3)">ยังไม่ได้นับเงิน</div></div>`;
  }

  const custPeriods = [
    { key: 'morning', label: '🌅 เช้า (open–11:00)', ph: 'เช่น คนทำงาน...' },
    { key: 'midday', label: '☀️ กลางวัน (11:00–14:00)', ph: 'เช่น กลุ่มออฟฟิศ...' },
    { key: 'afternoon', label: '🌤️ บ่าย (14:00–17:00)', ph: 'เช่น แม่ลูก...' },
    { key: 'evening', label: '🌆 เย็น (17:00–20:00)', ph: 'เช่น after work...' },
    { key: 'night', label: '🌙 ค่ำ–ปิด (20:00–close)', ph: 'เช่น Take away...' },
  ];

  el.innerHTML = `
    <div class="card" style="padding:12px"><div class="sl" style="margin-top:0">💰 ยอดขาย (auto จาก S1)</div>${chHtml}</div>
    <div class="card" style="padding:12px"><div class="sl" style="margin-top:0">🧾 ค่าใช้จ่าย (auto จาก S2)</div>${expHtml}</div>
    ${cashHtml}
    <div class="card" style="padding:12px">
      <div class="sl" style="margin-top:0">🌤️ สภาพร้านวันนี้</div>
      <div class="fg"><label class="fl">อากาศ</label><div style="display:flex;gap:4px;flex-wrap:wrap">${[{k:'sunny',l:'☀️ แดด'},{k:'cloudy',l:'☁️ ครึ้ม'},{k:'rain',l:'🌧️ ฝน'},{k:'heavy_rain',l:'⛈️ ฝนหนัก'}].map(w => `<div class="chip${r.weather === w.k ? ' active' : ''}" onclick="SDSection.s8Pick('weather','${w.k}',this)">${w.l}</div>`).join('')}</div></div>
      <div class="fg"><label class="fl">Traffic วันนี้</label><div style="display:flex;gap:4px;flex-wrap:wrap">${[{k:'above',l:'📈 ดีกว่าปกติ'},{k:'normal',l:'➡️ ปกติ'},{k:'below',l:'📉 ต่ำกว่าปกติ'}].map(t => `<div class="chip${r.traffic === t.k ? ' active' : ''}" onclick="SDSection.s8Pick('traffic','${t.k}',this)">${t.l}</div>`).join('')}</div></div>
      <div class="fg"><label class="fl">ระบบ POS</label><div style="display:flex;gap:4px">${[{k:'ok',l:'✅ ปกติ'},{k:'issue',l:'⚠️ มีปัญหา'}].map(p => `<div class="chip${r.pos_status === p.k ? ' active' : ''}" onclick="SDSection.s8Pick('pos_status','${p.k}',this)">${p.l}</div>`).join('')}</div></div>
    </div>
    <div class="card" style="padding:12px">
      <div class="sl" style="margin-top:0">🧑‍🤝‍🧑 กลุ่มลูกค้าตามช่วงเวลา</div>
      ${custPeriods.map(p => `<div class="fg" style="margin-bottom:6px"><label class="fl">${p.label}</label><textarea class="fi" style="padding:4px 6px;font-size:11px;min-height:28px;resize:vertical" id="s8-cust-${p.key}" placeholder="${p.ph}">${esc(r['customer_' + p.key] || '')}</textarea></div>`).join('')}
    </div>
    <div class="card" style="padding:12px"><div class="sl" style="margin-top:0">📝 Overview Note</div><textarea class="fi" id="s8-note" rows="2" placeholder="เช่น ฝนตกหนักช่วงเย็น...">${esc(r.overview_note || '')}</textarea></div>
    <div class="card" style="padding:12px">
      <div class="sl" style="margin-top:0">🍞 Waste List</div>
      <div style="display:flex;gap:4px"><div class="chip${r.has_waste === false ? ' active' : ''}" onclick="SDSection.s8Pick('waste','no',this)">❌ No</div><div class="chip${r.has_waste === true ? ' active' : ''}" onclick="SDSection.s8Pick('waste','yes',this)">✅ Yes</div></div>
      <div id="s8-waste-detail"></div>
    </div>`;
}

function fillS8Incidents(el) {
  let totalCount = 0;
  const catHtml = INCIDENT_CATS.map(c => {
    const inc = s8.incidents.find(i => i.category === c.key) || { category: c.key, count: 0, notes: [] };
    const count = inc.count || 0; totalCount += count;
    let notesHtml = '';
    if (count > 0) { for (let i = 0; i < count; i++) { notesHtml += `<input class="fi" style="font-size:11px;padding:4px 8px;margin-bottom:4px" placeholder="รายการที่ ${i + 1}" value="${esc((inc.notes && inc.notes[i]) || '')}" oninput="SDSection.s8IncNote('${c.key}',${i},this.value)">`; } }
    return `<div class="card" style="padding:10px;margin-bottom:6px;border-left:3px solid ${count > 0 ? 'var(--orange)' : 'transparent'}">
      <div style="display:flex;align-items:center;gap:8px"><span style="font-size:18px">${c.icon}</span><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600">${c.name}</div><div style="font-size:10px;color:var(--t3)">${c.desc}</div></div>
        <div style="display:flex;align-items:center;gap:6px"><button class="cnt-btn" onclick="SDSection.s8IncChange('${c.key}',-1)">−</button><span style="font-size:14px;font-weight:700;min-width:20px;text-align:center" id="s8-inc-${c.key}">${count}</span><button class="cnt-btn" onclick="SDSection.s8IncChange('${c.key}',1)">+</button></div>
      </div>
      <div style="margin-top:6px;${count > 0 ? '' : 'display:none'}" id="s8-inc-notes-${c.key}">${notesHtml}</div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="sl" style="margin-top:0">⚠️ เหตุการณ์ — กดจำนวน + ใส่ note</div>${catHtml}
    <div class="card" style="padding:10px"><div style="font-size:11px;font-weight:600;margin-bottom:4px">📊 สรุป</div><div style="font-size:10px;color:var(--t3)">รวม <b id="s8-inc-total">${totalCount}</b> เหตุการณ์</div></div>
    <div class="sl">🍚 อาหารเหลือ</div>
    <div id="s8-leftovers">${renderLeftovers()}</div>
    <div style="display:flex;align-items:center;gap:6px;padding:8px 0;cursor:pointer;color:var(--theme);font-size:12px;font-weight:600" onclick="SDSection.s8AddLeftover()">➕ เพิ่มรายการ</div>`;
}

function fillS8Tasks(el) {
  const pending = s8.tasks.filter(t => t.status === 'pending');
  el.innerHTML = `
    <div class="sl" style="margin-top:0">🔧 Equipment Repair Report</div>
    <div class="card" style="padding:12px;margin-bottom:10px">
      <div class="fg" style="margin-bottom:6px"><label class="fl">ชื่ออุปกรณ์</label><input class="fi" id="s8-eq-name" placeholder="เช่น เครื่องทำน้ำแข็ง"></div>
      <div class="fg" style="margin-bottom:6px"><label class="fl">อาการ</label><input class="fi" id="s8-eq-symptom" placeholder="เช่น ไม่ทำความเย็น"></div>
      <div class="fg" style="margin-bottom:8px"><label class="fl">ความเร่งด่วน</label><select class="fi" id="s8-eq-urgency"><option value="">— เลือก —</option><option value="critical">🔴 ต้องซ่อมทันที</option><option value="high">🟠 ควรซ่อมเร็ว</option><option value="low">🟡 ไม่รีบ</option><option value="dispose">⚫ ทิ้ง</option></select></div>
      <button class="btn btn-primary btn-full" onclick="SDSection.s8AddEquipment()">+ แจ้งซ่อม</button>
    </div>
    <div class="sl">📋 เพิ่มงานติดตาม</div>
    <div class="card" style="padding:12px;margin-bottom:10px">
      <input class="fi" id="s8-task-title" placeholder="เช่น โทรสั่ง stock เพิ่ม" style="margin-bottom:6px">
      <div style="display:flex;gap:8px;margin-bottom:8px"><input class="fi" id="s8-task-assign" placeholder="มอบหมายให้..." style="flex:1"><select class="fi" id="s8-task-pri" style="width:100px"><option value="normal">📋 ปกติ</option><option value="urgent">🚨 ด่วน</option></select></div>
      <button class="btn btn-primary btn-full" onclick="SDSection.s8AddTask('follow_up')">+ เพิ่มงาน</button>
    </div>
    <div class="sl">⏳ ค้าง (${pending.length})</div>
    <div id="s8-pending-list">${pending.length ? pending.map(t => {
      const icons = { equipment: '🔧', follow_up: '📋', suggestion: '💡', action: '🚨' };
      const bc = t.type === 'suggestion' ? 'var(--theme)' : t.type === 'equipment' ? 'var(--orange)' : (t.priority === 'urgent' ? 'var(--red)' : 'var(--orange)');
      return `<div class="card" style="padding:10px;margin-bottom:4px;border-left:3px solid ${bc}"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:14px">${icons[t.type] || '📋'}</span><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600">${esc(t.title)}</div>${t.note ? `<div style="font-size:10px;color:var(--t3);margin-top:2px">${esc(t.note)}</div>` : ''}${t.assigned_to ? `<div style="font-size:10px;color:var(--t3)">👤 ${esc(t.assigned_to)}</div>` : ''}</div><button class="btn btn-outline btn-sm" style="color:var(--green);border-color:var(--green)" onclick="SDSection.s8ToggleTask('${t.id}','done')">✓</button></div></div>`;
    }).join('') : ui.empty('', 'ไม่มีงานค้าง')}</div>`;
}

// S8 actions
function s8Pick(field, val, el) {
  if (field === 'weather') _s8Weather = val;
  else if (field === 'traffic') _s8Traffic = val;
  else if (field === 'pos_status') _s8PosStatus = val;
  else if (field === 'waste') _s8Waste = val === 'yes';
  el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); el.classList.add('active');
}

function s8IncChange(cat, delta) {
  let inc = s8.incidents.find(i => i.category === cat);
  if (!inc) { inc = { category: cat, count: 0, notes: [] }; s8.incidents.push(inc); }
  const noteWrap = document.getElementById('s8-inc-notes-' + cat);
  if (noteWrap) { noteWrap.querySelectorAll('input').forEach((inp, i) => { if (i < inc.notes.length) inc.notes[i] = inp.value; }); }
  const newCount = Math.max(0, inc.count + delta);
  while (inc.notes.length < newCount) inc.notes.push('');
  if (newCount < inc.notes.length) inc.notes.length = newCount;
  inc.count = newCount;
  const cntEl = document.getElementById('s8-inc-' + cat); if (cntEl) cntEl.textContent = inc.count;
  if (noteWrap) {
    noteWrap.style.display = inc.count > 0 ? '' : 'none';
    let html = ''; for (let i = 0; i < inc.count; i++) { html += `<input class="fi" style="font-size:11px;padding:4px 8px;margin-bottom:4px" placeholder="รายการที่ ${i + 1}" value="${esc(inc.notes[i] || '')}" oninput="SDSection.s8IncNote('${cat}',${i},this.value)">`; }
    noteWrap.innerHTML = html;
  }
  const totalEl = document.getElementById('s8-inc-total');
  if (totalEl) totalEl.textContent = s8.incidents.reduce((s, i) => s + i.count, 0);
}

function s8IncNote(cat, idx, val) { const inc = s8.incidents.find(i => i.category === cat); if (inc && inc.notes) inc.notes[idx] = val; }

function renderLeftovers() {
  if (!s8.leftovers.length) return '<div style="text-align:center;padding:10px;color:var(--t3);font-size:11px">ยังไม่มีรายการ — กด ➕ เพิ่ม</div>';
  return s8.leftovers.map((l, i) => `<div class="card" style="padding:10px;margin-bottom:6px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span>🍞</span><input class="fi" style="flex:1;font-size:12px;padding:4px 6px" value="${esc(l.item_name)}" placeholder="ชื่ออาหาร..." oninput="SDSection.s8LeftUpdate(${i},'item_name',this.value)">
      <input class="fi" type="number" style="width:44px;font-size:12px;padding:4px 6px;text-align:center" value="${l.quantity}" min="0" oninput="SDSection.s8LeftUpdate(${i},'quantity',this.value)">
      <button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red);width:28px;height:28px;padding:0" onclick="SDSection.s8LeftRemove(${i})">✕</button>
    </div>
    <div style="display:flex;gap:4px;flex-wrap:wrap">${LEVEL_OPTS.map(lv => `<div class="chip${l.level === lv.key ? ' active' : ''}" onclick="SDSection.s8LeftLevel(${i},'${lv.key}',this)">${lv.label}</div>`).join('')}</div>
    <input class="fi" style="font-size:11px;padding:4px 6px;margin-top:6px;width:100%" value="${esc(l.note || '')}" placeholder="หมายเหตุ..." oninput="SDSection.s8LeftUpdate(${i},'note',this.value)">
  </div>`).join('');
}

function s8LeftUpdate(idx, field, val) { if (s8.leftovers[idx]) s8.leftovers[idx][field] = field === 'quantity' ? parseInt(val) || 1 : val; }
function s8LeftRemove(idx) { s8.leftovers.splice(idx, 1); document.getElementById('s8-leftovers').innerHTML = renderLeftovers(); }
function s8AddLeftover() { s8.leftovers.push({ item_name: '', quantity: 1, level: 'half', note: '' }); document.getElementById('s8-leftovers').innerHTML = renderLeftovers(); }
function s8LeftLevel(idx, level, el) { if (s8.leftovers[idx]) s8.leftovers[idx].level = level; el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); el.classList.add('active'); }

async function s8ToggleTask(taskId, newStatus) {
  try { await SD.api('update_task', { task_id: taskId, status: newStatus }); const t = s8.tasks.find(x => x.id === taskId); if (t) { t.status = newStatus; t.completed_at = newStatus === 'done' ? new Date().toISOString() : null; } fillS8Tab(); SPG.toast(newStatus === 'done' ? '✅ เสร็จแล้ว' : '↩ เปิดใหม่', 'success'); }
  catch { SPG.toast('อัพเดทไม่สำเร็จ', 'error'); }
}

async function s8AddEquipment() {
  const name = document.getElementById('s8-eq-name')?.value?.trim();
  const symptom = document.getElementById('s8-eq-symptom')?.value?.trim();
  const urgency = document.getElementById('s8-eq-urgency')?.value;
  if (!name) return SPG.toast('กรุณาใส่ชื่ออุปกรณ์', 'error');
  if (!symptom) return SPG.toast('กรุณาใส่อาการ', 'error');
  if (!urgency) return SPG.toast('กรุณาเลือกความเร่งด่วน', 'error');
  try {
    const uMap = { critical: '🔴 ซ่อมทันที', high: '🟠 ควรซ่อมเร็ว', low: '🟡 ไม่รีบ', dispose: '⚫ ทิ้ง' };
    const data = await SD.api('create_task', { store_id: SD.getStore(), title: '🔧 ' + name, note: symptom + ' [' + (uMap[urgency] || urgency) + ']', type: 'equipment', priority: urgency === 'critical' ? 'urgent' : 'normal', report_date: s8.date });
    s8.tasks.push(data); SPG.toast('แจ้งซ่อมสำเร็จ', 'success');
    document.getElementById('s8-eq-name').value = ''; document.getElementById('s8-eq-symptom').value = ''; document.getElementById('s8-eq-urgency').value = '';
    fillS8Tab();
  } catch (err) { SPG.toast(err.message || 'แจ้งซ่อมไม่สำเร็จ', 'error'); }
}

async function s8AddTask(type) {
  const isTask = type === 'follow_up';
  const titleEl = document.getElementById(isTask ? 's8-task-title' : 's8-sug-title');
  const title = (titleEl?.value || '').trim();
  if (!title) return SPG.toast('กรุณากรอกหัวข้อ', 'error');
  try {
    const data = await SD.api('create_task', { store_id: SD.getStore(), title, type, assigned_to: isTask ? (document.getElementById('s8-task-assign')?.value || '') : '', priority: isTask ? (document.getElementById('s8-task-pri')?.value || 'normal') : 'normal', note: '', report_date: s8.date });
    s8.tasks.push(data); SPG.toast(isTask ? '📋 เพิ่มงานแล้ว' : '💡 เพิ่ม Suggestion แล้ว', 'success');
    if (titleEl) titleEl.value = ''; if (isTask) { const a = document.getElementById('s8-task-assign'); if (a) a.value = ''; }
    fillS8Tab();
  } catch (err) { SPG.toast(err.message || 'เพิ่มไม่สำเร็จ', 'error'); }
}

async function s8Save() {
  const btn = document.getElementById('s8-save'); if (btn) btn.disabled = true;
  try {
    collectS8Overview();
    s8.incidents.forEach(inc => { const noteWrap = document.getElementById('s8-inc-notes-' + inc.category); if (noteWrap && inc.count > 0) { const inputs = noteWrap.querySelectorAll('input'); const notes = []; inputs.forEach(inp => notes.push(inp.value)); inc.notes = notes; } });
    for (const c of INCIDENT_CATS) { const inc = s8.incidents.find(i => i.category === c.key); if (inc && inc.count > 0) { for (let i = 0; i < inc.count; i++) { if (!(inc.notes[i] || '').trim()) { SPG.toast(`⚠️ กรุณาใส่รายละเอียด "${c.name}" รายการที่ ${i + 1}`, 'error'); if (btn) btn.disabled = false; return; } } } }
    const incidents = s8.incidents.filter(i => i.count > 0).map(i => ({ category: i.category, count: i.count, note: (i.notes || []).filter(n => n).join(' | '), notes: i.notes || [] }));
    await SD.api('save_daily_report', { store_id: SD.getStore(), report_date: s8.date, weather: _s8Weather || s8.report?.weather, traffic: _s8Traffic || s8.report?.traffic, has_waste: _s8Waste ?? s8.report?.has_waste, pos_status: _s8PosStatus || s8.report?.pos_status || 'ok', overview_note: document.getElementById('s8-note')?.value ?? s8.report?.overview_note ?? '', customer_morning: document.getElementById('s8-cust-morning')?.value ?? s8.report?.customer_morning ?? null, customer_midday: document.getElementById('s8-cust-midday')?.value ?? s8.report?.customer_midday ?? null, customer_afternoon: document.getElementById('s8-cust-afternoon')?.value ?? s8.report?.customer_afternoon ?? null, customer_evening: document.getElementById('s8-cust-evening')?.value ?? s8.report?.customer_evening ?? null, customer_night: document.getElementById('s8-cust-night')?.value ?? s8.report?.customer_night ?? null, incidents, leftovers: s8.leftovers.filter(l => l.item_name), is_submitted: true });
    SPG.toast('บันทึกสำเร็จ', 'success');
  } catch (err) { SPG.toast(err.message || 'บันทึกไม่สำเร็จ', 'error'); }
  finally { if (btn) btn.disabled = false; }
}

async function s8Copy() {
  collectS8Overview();
  const r = s8.report || {}; const sm = s8.summary || {};
  const ses = SPG.api.getSession(); const storeName = ses?.store_name || SD.getStore(); const reporter = ses?.full_name || ses?.display_name || '';
  const channels = sm.channels || []; const expenses = sm.expenses || []; const cash = sm.cash;
  const wMap = { sunny: '☀️ แดด', cloudy: '☁️ ครึ้ม', rain: '🌧️ ฝน', heavy_rain: '⛈️ ฝนหนัก' };
  const tMap = { above: '📈 ดีกว่าปกติ', normal: '➡️ ปกติ', below: '📉 ต่ำกว่าปกติ' };
  let text = `📋 Daily Report — ${storeName}\n📅 ${SD.fmtDate(s8.date)}\n🧑 ผู้รายงาน: ${reporter}\n━━━━━━━━━━━━━━━\n\n💰 ยอดขาย\n`;
  if (channels.length) { channels.forEach(c => { text += `  ${c.channel_key}: ${fm(c.amount)}\n`; }); text += `  Total: ${fm(sm.total_sales || 0)}\n`; } else text += '  ยังไม่มีข้อมูล\n';
  text += '\n🧾 ค่าใช้จ่าย\n';
  if (expenses.length) { expenses.forEach(x => { text += `  ${x.vendor_name}: -${fm(x.total_amount)}\n`; }); } else text += '  ไม่มี\n';
  text += '\n💵 Cash on Hand\n';
  if (cash) { text += `  Expected: ${fm(cash.expected_cash || 0)}\n  Actual: ${fm(cash.actual_cash || 0)}\n  Diff: ${fm(cash.difference || 0)}\n`; text += cash.is_matched ? '  ✅ เงินตรง\n' : '  🔴 เงินไม่ตรง!\n'; } else text += '  ยังไม่ได้นับ\n';
  text += `\n🌤️ สภาพร้าน\n  อากาศ: ${wMap[_s8Weather || r.weather] || '—'}\n  Traffic: ${tMap[_s8Traffic || r.traffic] || '—'}\n`;
  try { if (navigator.clipboard) await navigator.clipboard.writeText(text); else { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); } } catch {}
  try { await s8Save(); SPG.toast('📋 Copy แล้ว! วางใน LINE ได้เลย', 'success'); } catch { SPG.toast('📋 Copy แล้ว แต่บันทึกไม่สำเร็จ', 'info'); }
}


// ═══════════════════════════════════════
// TASKS (standalone page)
// ═══════════════════════════════════════
let tk = { tasks: [], typeFilter: 'all', statusFilter: 'all' };

function renderTasks(p) {
  return SPG.shell(`<div class="toolbar">${backBtn()}<div class="toolbar-title">Tasks</div></div>
  <div class="content" id="tk-content">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="sl" style="margin:0" id="tk-count">📋 Tasks (0)</div>
      <button class="btn btn-primary btn-sm" onclick="SDSection.tkNewTask()">+ New Task</button>
    </div>
    <div style="font-size:9px;font-weight:600;color:var(--t4);text-transform:uppercase;margin-bottom:4px">Type</div>
    <div style="display:flex;gap:4px;margin-bottom:10px" id="tk-type"><div class="chip active" onclick="SDSection.tkFilter('type','all',this)">All</div><div class="chip" onclick="SDSection.tkFilter('type','equipment',this)">🔧 Equipment</div><div class="chip" onclick="SDSection.tkFilter('type','follow_up',this)">📋 Tasks</div><div class="chip" onclick="SDSection.tkFilter('type','action',this)">💡 Action</div></div>
    <div style="font-size:9px;font-weight:600;color:var(--t4);text-transform:uppercase;margin-bottom:4px">Status</div>
    <div style="display:flex;gap:4px;margin-bottom:10px" id="tk-status"><div class="chip active" onclick="SDSection.tkFilter('status','all',this)">All</div><div class="chip" onclick="SDSection.tkFilter('status','pending',this)">⏳ Open</div><div class="chip" onclick="SDSection.tkFilter('status','done',this)">✅ Done</div></div>
    <div id="tk-list">${ui.skeleton(100)}</div>
  </div>`, SECTION);
}

async function loadTasks(p) {
  await SD.initModule(); if (!S.initLoaded) return; SD.buildSDSidebar();
  if (_busy.tk) return; _busy.tk = true;
  try { const data = await SD.api('get_tasks', { store_id: SD.getStore() }); tk.tasks = data.tasks || []; fillTasks(); }
  catch { SPG.toast('โหลดไม่สำเร็จ', 'error'); } finally { _busy.tk = false; }
}

function fillTasks() {
  let list = tk.tasks;
  if (tk.typeFilter !== 'all') list = list.filter(t => t.type === tk.typeFilter);
  if (tk.statusFilter !== 'all') list = list.filter(t => t.status === tk.statusFilter);
  document.getElementById('tk-count').textContent = `📋 Tasks (${list.length})`;
  const el = document.getElementById('tk-list'); if (!el) return;
  if (!list.length) { el.innerHTML = ui.empty('', 'ไม่มี Task'); return; }
  el.innerHTML = list.map(t => {
    const isDone = t.status === 'done';
    const icons = { equipment: '🔧', follow_up: '📋', suggestion: '💡', action: '🚨' };
    const bc = isDone ? 'var(--green)' : (t.priority === 'urgent' ? 'var(--red)' : 'var(--orange)');
    return `<div class="card" style="padding:10px;border-left:3px solid ${bc};${isDone ? 'opacity:.6' : ''};margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:8px"><span>${icons[t.type] || '📋'}</span><div style="flex:1"><div style="font-size:12px;font-weight:700;${isDone ? 'text-decoration:line-through;color:var(--t3)' : ''}">${esc(t.title)}</div><div style="font-size:10px;color:var(--t3)">${esc(t.type)}${t.due_date ? ' · Due: ' + SD.fmtDateShort(t.due_date) : ''}${t.assigned_to ? ' · 👤 ' + esc(t.assigned_to) : ''}</div></div>
        ${isDone ? `<button class="btn btn-outline btn-sm" style="color:var(--orange);border-color:var(--orange)" onclick="SDSection.tkToggle('${t.id}','pending')">↩</button>` : `<button class="btn btn-outline btn-sm" style="color:var(--green);border-color:var(--green)" onclick="SDSection.tkToggle('${t.id}','done')">✓</button>`}
      </div>
    </div>`;
  }).join('');
}

function tkFilter(dimension, val, el) {
  if (dimension === 'type') tk.typeFilter = val; else tk.statusFilter = val;
  el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); el.classList.add('active'); fillTasks();
}

async function tkToggle(taskId, newStatus) {
  try { await SD.api('update_task', { task_id: taskId, status: newStatus }); const t = tk.tasks.find(x => x.id === taskId); if (t) { t.status = newStatus; } fillTasks(); SPG.toast(newStatus === 'done' ? '✅ เสร็จ' : '↩ เปิดใหม่', 'success'); }
  catch { SPG.toast('อัพเดทไม่สำเร็จ', 'error'); }
}

function tkNewTask() {
  SPG.showDialog(`<div class="popup-sheet" style="width:360px">
    <div class="popup-header"><div class="popup-title">+ New Task</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="fl">Type</label><select class="fi" id="tknew-type"><option value="follow_up">📋 Follow-up</option><option value="equipment">🔧 Equipment</option><option value="suggestion">💡 Suggestion</option><option value="action">🚨 Action</option></select></div>
    <div class="fg"><label class="fl">Title <span style="color:var(--red)">*</span></label><input class="fi" id="tknew-title"></div>
    <div class="fg"><label class="fl">Priority</label><select class="fi" id="tknew-pri"><option value="normal">Normal</option><option value="urgent">Urgent</option><option value="critical">Critical</option></select></div>
    <div class="fg"><label class="fl">Due Date</label><input class="fi" type="date" id="tknew-due"></div>
    <div class="fg"><label class="fl">Note</label><textarea class="fi" id="tknew-note" rows="2"></textarea></div>
    <button class="btn btn-primary btn-full" id="tknew-save" onclick="SDSection.tkSaveNew()">💾 Save</button>
  </div>`);
}

async function tkSaveNew() {
  const title = document.getElementById('tknew-title')?.value?.trim();
  if (!title) return SPG.toast('กรุณาใส่ Title', 'error');
  const btn = document.getElementById('tknew-save'); if (btn) btn.disabled = true;
  try {
    const data = await SD.api('create_task', { store_id: SD.getStore(), title, type: document.getElementById('tknew-type')?.value || 'follow_up', priority: document.getElementById('tknew-pri')?.value || 'normal', due_date: document.getElementById('tknew-due')?.value || null, note: document.getElementById('tknew-note')?.value || null });
    tk.tasks.unshift(data); SPG.closeDialog(); fillTasks(); SPG.toast('สร้าง Task สำเร็จ', 'success');
  } catch (err) { SPG.toast(err.message || 'สร้างไม่สำเร็จ', 'error'); }
  finally { if (btn) btn.disabled = false; }
}


// ═══════════════════════════════════════
// DAILY HUB — 7-day overview + detail
// ═══════════════════════════════════════
let dh = { days: [], pendingTasks: 0, totalIncidents: 0, selectedDate: null, detail: null };

function renderDH(p) {
  return SPG.shell(`<div class="toolbar">${backBtn()}<div class="toolbar-title">Daily Hub</div></div>
  <div class="content" id="dh-content">
    ${SD.renderStoreSelector({ noAll: true })}
    <div id="dh-kpi" class="kpi-row kpi-4" style="margin-bottom:12px">${ui.skeleton(72, 4)}</div>
    <div class="sl">📋 รายวัน — กดเลือกดู detail</div>
    <div style="font-size:10px;color:var(--t3);margin-bottom:6px">แสดงย้อนหลัง 7 วัน</div>
    <div id="dh-days">${ui.skeleton(100)}</div>
    <div id="dh-detail" style="margin-top:12px"></div>
  </div>`, SECTION);
}

async function loadDH(p) {
  await SD.initModule(); if (!S.initLoaded) return; SD.buildSDSidebar();
  if (_busy.dh) return; _busy.dh = true;
  try {
    const data = await SD.api('get_daily_hub', { store_id: SD.getStore() });
    dh.days = data.days || []; dh.pendingTasks = data.pending_tasks || 0; dh.totalIncidents = data.total_incidents || 0;
    fillDH();
    if (dh.days.length) dhSelect(dh.days[0].date);
  } catch { SPG.toast('โหลดไม่สำเร็จ', 'error'); } finally { _busy.dh = false; }
}

function fillDH() {
  const reported = dh.days.filter(d => d.has_report).length; const total = dh.days.length;
  const pct = total > 0 ? Math.round(reported / total * 100) : 0;
  document.getElementById('dh-kpi').innerHTML = `
    <div class="kpi-box"><div class="kpi-label">📝 รายงาน</div><div class="kpi-val">${reported}/${total}</div></div>
    <div class="kpi-box"><div class="kpi-label">⚠️ เหตุการณ์</div><div class="kpi-val" style="color:var(--red)">${dh.totalIncidents}</div></div>
    <div class="kpi-box"><div class="kpi-label">📋 Tasks ค้าง</div><div class="kpi-val" style="color:var(--theme)">${dh.pendingTasks}</div></div>
    <div class="kpi-box"><div class="kpi-label">✅ Completion</div><div class="kpi-val" style="color:var(--green)">${pct}%</div></div>`;
  const el = document.getElementById('dh-days'); if (!el) return;
  el.innerHTML = dh.days.map(d => {
    const sel = d.date === dh.selectedDate; const synced = d.sync_status === 'synced'; const isToday = d.date === td();
    return `<div class="card" style="padding:8px 10px;cursor:pointer;border-left:3px solid ${sel ? 'var(--theme)' : 'transparent'};${sel ? 'background:var(--theme-bg)' : synced ? 'opacity:.7' : ''};margin-bottom:4px" onclick="SDSection.dhSelect('${d.date}')">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:12px"><b>${SD.fmtDate(d.date).substring(0, 10)}</b>${isToday ? ' <span style="color:var(--t3)">วันนี้</span>' : ''}</div>
        <div style="display:flex;gap:4px;align-items:center">${synced ? ui.badge('approved') : ui.badge('pending')}${d.report_submitted ? ui.badge('active') : d.has_report ? ui.badge('draft') : ''}</div>
      </div>
    </div>`;
  }).join('');
}

async function dhSelect(date) {
  dh.selectedDate = date; fillDH();
  const detailEl = document.getElementById('dh-detail'); if (!detailEl) return;
  if (_busy.dhDetail) return; _busy.dhDetail = true;
  detailEl.innerHTML = ui.skeleton(200);
  try {
    const data = await SD.api('get_daily_detail', { store_id: SD.getStore(), detail_date: date });
    const isEditable = data.sync_status !== 'synced';
    const channels = data.channels || []; const expenses = data.expenses || []; const cash = data.cash;
    const chRows = channels.map(c => `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px"><span>${esc(c.channel_key)}</span><span style="font-weight:600">${fm(c.amount)}</span></div>`).join('') || '<div style="font-size:11px;color:var(--t3)">ไม่มีข้อมูล</div>';
    const expRows = expenses.map(x => `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:11px"><span>${esc(x.vendor_name)}</span><span style="font-weight:600;color:var(--red)">-${fm(x.total_amount)}</span></div>`).join('') || '<div style="font-size:11px;color:var(--t3)">ไม่มี</div>';
    const totalSales = data.sale?.total_sales || 0; const totalExp = expenses.reduce((s, x) => s + (x.total_amount || 0), 0);
    const cashColor = cash?.is_matched === true ? 'var(--green)' : cash?.is_matched === false ? 'var(--red)' : 'var(--t3)';

    detailEl.innerHTML = `<div class="card" style="border-top:3px solid var(--theme)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:14px;font-weight:700">📅 ${SD.fmtDate(date)}</div>
        <div>${isEditable ? ui.badge('pending') : ui.badge('approved')}</div>
      </div>
      <div class="sl" style="margin-top:0">💰 ยอดขาย</div><div class="card" style="padding:8px">${chRows}<div style="border-top:1px solid var(--bd2);margin-top:4px;padding-top:4px;display:flex;justify-content:space-between;font-weight:700;font-size:12px"><span>Total</span><span style="color:var(--theme)">${fm(totalSales)}</span></div></div>
      <div class="sl">🧾 ค่าใช้จ่าย</div><div class="card" style="padding:8px">${expRows}<div style="border-top:1px solid var(--bd2);margin-top:4px;padding-top:4px;display:flex;justify-content:space-between;font-weight:700;font-size:12px"><span>Total</span><span style="color:var(--red)">-${fm(totalExp)}</span></div></div>
      ${cash ? `<div class="sl">💵 Cash</div><div class="card" style="padding:8px;border-left:3px solid ${cashColor}"><div style="display:flex;justify-content:space-between;font-size:11px"><span>Expected</span><span>${fm(cash.expected_cash || 0)}</span></div><div style="display:flex;justify-content:space-between;font-size:11px"><span>Variance</span><span style="color:${cashColor};font-weight:600">${fm(cash.difference || 0)}</span></div></div>` : ''}
      ${isEditable ? `<div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn btn-primary btn-sm" style="flex:1" onclick="SPG.go('sales/daily-sale-edit',{date:'${date}'})">✏️ แก้ยอดขาย</button>
        <button class="btn btn-outline btn-sm" style="flex:1" onclick="SPG.go('sales/expense',{date:'${date}'})">✏️ แก้ค่าใช้จ่าย</button>
        <button class="btn btn-outline btn-sm" style="flex:1" onclick="SPG.go('sales/daily-report',{date:'${date}'})">📝 ดูรายงาน</button>
      </div>` : ''}
    </div>`;
  } catch { detailEl.innerHTML = ui.empty('', 'โหลดข้อมูลไม่ได้'); }
  finally { _busy.dhDetail = false; }
}


// ═══════════════════════════════════════
// REGISTER TO PARENT
// ═══════════════════════════════════════
SD.renderS5 = renderS5; SD.loadS5 = loadS5;
SD.renderS6 = renderS6; SD.loadS6 = loadS6;
SD.renderS8 = renderS8; SD.loadS8 = loadS8;
SD.renderTasks = renderTasks; SD.loadTasks = loadTasks;
SD.renderDH = renderDH; SD.loadDH = loadDH;

Object.assign(window.SDSection, {
  s5Reload, s5LoadMore,
  s6Reload, s6SetFilter, s6LoadMore, showDetail,
  s8Nav, s8SetTab, s8Pick, s8IncChange, s8IncNote,
  s8LeftUpdate, s8LeftRemove, s8AddLeftover, s8LeftLevel,
  s8ToggleTask, s8AddEquipment, s8AddTask, s8Save, s8Copy,
  tkFilter, tkNewTask, tkSaveNew, tkToggle,
  dhSelect,
});

})();
