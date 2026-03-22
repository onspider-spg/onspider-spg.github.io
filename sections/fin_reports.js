/**
 * SPG HUB v1.0.0 | 23 MAR 2026 | Siam Palette Group
 * sections/fin_reports.js — Finance Module (Reports + Dashboard)
 * 16 routes: dashboard, rp-pnl, rp-pnl-brand, rp-pnl-flow, rp-pnl-full,
 *            rp-bs, rp-cf, rp-apar, rp-asset, rp-bank, rp-cash, rp-loan,
 *            fp-brand, fp-budget, fp-rev, fp-exp
 * Depends on: fin_core.js (FIN global)
 */

(() => {
const S = FIN.S;
const esc = FIN.esc;
const ui = SPG.ui;
const fm = FIN.fmtAud;
const fd = FIN.fmtDate;

const TW = 'max-width:1060px;margin:0 auto';
const TW2 = 'max-width:1000px;margin:0 auto';
const TW3 = 'max-width:1100px;margin:0 auto';

// ── Local state ──
let _pnlData = null;
let _pnlBrandData = null;
let _flowData = null;
let _fullData = null;
let _filters = { month: '', brand: 'All' };
let _fullFilters = { period: 'Monthly', from: '', to: '', brand: 'All', compare: 'None' };
let _bsData = null;
let _cfData = null;
let _aparData = null;
let _aparTab = 'ap';
let _assetData = null;
let _bankData = null;
let _cashData = null;
let _loanData = null;
let _loanTab = 'interco';
let _fpBrandData = null;
let _fpBudgetData = null;
let _fpRevData = null;
let _fpExpData = null;
let _dashData = null;

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

/** Get current month as YYYY-MM */
function _curMonth() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }).substring(0, 7);
}

/** Get month options (last 12 months) */
function _monthOpts(selected) {
  const now = new Date();
  let html = '';
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = d.toLocaleDateString('en-CA').substring(0, 7);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    html += `<option value="${val}"${val === selected ? ' selected' : ''}>${esc(label)}</option>`;
  }
  return html;
}

/** Brand dropdown options */
function _brandOpts(selected) {
  let html = `<option value="All"${selected === 'All' ? ' selected' : ''}>All Brands</option>`;
  (S.brands || []).forEach(b => {
    html += `<option value="${esc(b)}"${b === selected ? ' selected' : ''}>${esc(b)}</option>`;
  });
  return html;
}

/** Format number as compact K */
function _fmK(n) {
  if (n == null || isNaN(n)) return '$0';
  const abs = Math.abs(Number(n));
  const neg = Number(n) < 0;
  if (abs >= 1000) return (neg ? '-$' : '$') + (abs / 1000).toFixed(0) + 'K';
  return fm(n, 0);
}

/** Format number for tables (no $ sign, with commas, parens for negative) */
function _fmTbl(n) {
  if (n == null || isNaN(n)) return '0';
  const num = Number(n);
  const abs = Math.abs(num).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return num < 0 ? `(${abs})` : abs;
}

/** Percentage badge */
function _pctBadge(pct) {
  if (pct == null || isNaN(pct)) return '\u2014';
  const val = Number(pct);
  if (val === 0) return '\u2014';
  const cls = val > 0 ? 'rp-chg-up' : 'rp-chg-dn';
  const arrow = val > 0 ? '\u25b2' : '\u25bc';
  return `<span class="rp-chg ${cls}">${arrow}${Math.abs(val).toFixed(1)}%</span>`;
}

/** Percentage of revenue */
function _pctRev(amount, revenue) {
  if (!revenue) return '0%';
  return ((Math.abs(amount) / Math.abs(revenue)) * 100).toFixed(1) + '%';
}

/** Month label from YYYY-MM */
function _monthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ═══════════════════════════════════════
// SHARED: P&L sub-nav pill tabs
// ═══════════════════════════════════════
function _pnlTabs(active) {
  const tabs = [
    { id: 'rp-pnl', label: 'P&L Dashboard' },
    { id: 'rp-pnl-brand', label: 'Brand Comparison' },
    { id: 'rp-pnl-flow', label: 'Profit Flow' },
    { id: 'rp-pnl-full', label: 'Full P&L Statement' },
  ];
  return '<div class="rp-pills">' +
    tabs.map(t =>
      `<button class="rp-pill${t.id === active ? ' a' : ''}" onclick="SPG.go('finance/${t.id}')">${esc(t.label)}</button>`
    ).join('') + '</div>';
}

// ═══════════════════════════════════════
// CHART HELPERS
// ═══════════════════════════════════════

function _renderBarChart(months, maxRev) {
  if (!months || months.length === 0) {
    return '<div style="text-align:center;padding:20px;color:var(--t3);font-size:11px">No monthly data</div>';
  }
  const max = Math.max(...months.map(m => Math.max(m.revenue || 0, m.expenses || 0)), 1);
  let html = '<div class="rp-bars">';
  months.forEach((m, i) => {
    const rH = ((m.revenue || 0) / max * 100).toFixed(0);
    const eH = ((m.expenses || 0) / max * 100).toFixed(0);
    const bold = i === months.length - 1;
    html += `<div class="rp-bar-group"><div class="rp-bar-pair">
      <div class="rp-bar" style="height:${rH}%;background:var(--green-bg);border:1px solid var(--green)"></div>
      <div class="rp-bar" style="height:${eH}%;background:var(--red-bg);border:1px solid var(--red)"></div>
    </div><div class="rp-bar-lbl">${bold ? '<b>' : ''}${esc(m.label || '')}${bold ? '</b>' : ''}<br>${bold ? '<b>' : ''}${_fmK(m.revenue)} / ${_fmK(m.expenses)}${bold ? '</b>' : ''}</div></div>`;
  });
  html += '</div>';
  html += '<div class="rp-legend"><span><span class="rp-legend-dot" style="background:var(--green-bg);border:1px solid var(--green)"></span>Revenue</span>';
  html += '<span><span class="rp-legend-dot" style="background:var(--red-bg);border:1px solid var(--red)"></span>Total Expenses</span></div>';
  return html;
}

function _renderDonut(total, cogs, wages, rent, other, cogsPct, wagesPct, rentPct, otherPct) {
  const c1 = Number(cogsPct);
  const c2 = c1 + Number(wagesPct);
  const c3 = c2 + Number(rentPct);
  return `<div style="display:flex;gap:12px;align-items:center">
    <div class="rp-donut" style="background:conic-gradient(var(--red) 0% ${c1}%, var(--orange) ${c1}% ${c2}%, var(--blue) ${c2}% ${c3}%, var(--t4) ${c3}% 100%)">
      <div class="rp-donut-inner"><div style="font-size:13px;font-weight:700">${_fmK(total)}</div><div style="font-size:8px;color:var(--t3)">total</div></div>
    </div>
    <div style="font-size:11px;line-height:2.2">
      <div><span class="rp-legend-dot" style="background:var(--red)"></span>COGs \u2014 ${fm(cogs, 0)} (${cogsPct}%)</div>
      <div><span class="rp-legend-dot" style="background:var(--orange)"></span>Wages \u2014 ${fm(wages, 0)} (${wagesPct}%)</div>
      <div><span class="rp-legend-dot" style="background:var(--blue)"></span>Rent & Utilities \u2014 ${fm(rent, 0)} (${rentPct}%)</div>
      <div><span class="rp-legend-dot" style="background:var(--t4)"></span>Other \u2014 ${fm(other, 0)} (${otherPct}%)</div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════
// STUBS
// ═══════════════════════════════════════
function _exportPdf() { SPG.toast('Export PDF \u2014 coming soon'); }
function _exportCsv() { SPG.toast('Export CSV \u2014 coming soon'); }


// ══════════════════════════════════════════
// 1. rp-pnl: P&L DASHBOARD
// ══════════════════════════════════════════

function renderRpPnl() {
  if (!_filters.month) _filters.month = _curMonth();
  const actions = `<button class="btn-outline" onclick="FinanceSection.exportPdf()">Export PDF</button>` +
                  `<button class="btn-outline" onclick="FinanceSection.exportCsv()">Export CSV</button>`;
  return SPG.shell(SPG.toolbar('Profit & Loss Summary', actions) + `<div class="content" id="fin-rp-pnl"><div style="${TW}">
    ${_pnlTabs('rp-pnl')}
    <div class="rp-filters">
      <div class="rp-fl-group"><div class="rp-fl-label">Month</div>
        <select class="fl" id="rp_month" onchange="FinanceSection.onFilter()" style="width:110px">${_monthOpts(_filters.month)}</select>
      </div>
      <div class="rp-fl-group"><div class="rp-fl-label">Brand</div>
        <select class="fl" id="rp_brand" onchange="FinanceSection.onFilter()" style="width:140px">${_brandOpts(_filters.brand)}</select>
      </div>
    </div>
    <div id="rp_pnl_content"><div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading P&L data...</div></div>
  </div></div>`, 'Finance');
}

async function loadRpPnl() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadPnlDashboard();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function _loadPnlDashboard() {
  const el = document.getElementById('rp_pnl_content');
  if (!el) return;

  try {
    _pnlData = await FIN.api('get_pnl_summary', {
      month: _filters.month,
      brand: _filters.brand === 'All' ? null : _filters.brand,
    });
  } catch (e) {
    console.warn('getPnlSummary failed:', e.message);
    if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--red)">Failed to load P&L data. Please try again.</div>';
    return;
  }

  const d = _pnlData;
  const rev = d.revenue || 0;
  const cogs = d.cogs || 0;
  const gp = rev - cogs;
  const opex = d.opex || 0;
  const wages = d.wages || 0;
  const rent = d.rent || 0;
  const ebitda = gp - opex;
  const dep = d.depreciation || 0;
  const interest = d.interest || 0;
  const net = ebitda - dep - interest;
  const gpPct = rev ? ((gp / rev) * 100).toFixed(1) : '0.0';
  const ebitdaPct = rev ? ((ebitda / rev) * 100).toFixed(1) : '0.0';
  const netPct = rev ? ((net / rev) * 100).toFixed(1) : '0.0';
  const colPct = rev ? ((cogs / rev) * 100).toFixed(1) : '0.0';

  const prevRev = d.prev_revenue || 0;
  const prevNet = d.prev_net || 0;
  const revChg = prevRev ? (((rev - prevRev) / prevRev) * 100) : 0;
  const netChg = prevNet ? (((net - prevNet) / Math.abs(prevNet)) * 100) : 0;

  const totalExp = cogs + opex;
  const cogsPct = totalExp ? ((cogs / totalExp) * 100).toFixed(0) : 0;
  const wagesPct = totalExp ? ((wages / totalExp) * 100).toFixed(0) : 0;
  const rentPct = totalExp ? ((rent / totalExp) * 100).toFixed(0) : 0;
  const otherExp = opex - wages - rent;
  const otherPct = totalExp ? ((otherExp / totalExp) * 100).toFixed(0) : 0;

  const months = d.months || [];

  el.innerHTML = `
    <div class="kpi-grid" style="flex-wrap:nowrap;margin-bottom:14px">
      <div class="kpi-card" style="border-top:3px solid var(--green);background:#fff"><div class="kpi-label" title="Total income from all sales channels">Revenue</div>
        <div class="kpi-value">${fm(rev, 0)}</div>
        <div style="font-size:9px;color:var(--green)">${_pctBadge(revChg)} vs prev</div></div>
      <div class="kpi-card" style="border-top:3px solid var(--orange)"><div class="kpi-label" title="Revenue minus Cost of Goods Sold (COGS)">Gross Profit</div>
        <div class="kpi-value">${fm(gp, 0)}</div>
        <div style="font-size:9px">GP margin: ${gpPct}%</div></div>
      <div class="kpi-card" style="border-top:3px solid var(--blue);background:#fff"><div class="kpi-label" title="Earnings Before Interest, Tax, Depreciation &amp; Amortisation">EBITDA</div>
        <div class="kpi-value">${fm(ebitda, 0)}</div>
        <div style="font-size:9px">EBITDA margin: ${ebitdaPct}%</div></div>
      <div class="kpi-card" style="border-top:3px solid var(--acc);background:#fff"><div class="kpi-label" title="Final profit after all expenses, depreciation, and interest">Net Profit</div>
        <div class="kpi-value" style="color:${net >= 0 ? 'var(--green)' : 'var(--red)'}">${fm(net, 0)}</div>
        <div style="font-size:9px">${_pctBadge(netChg)} vs prev</div></div>
      <div class="kpi-card" style="background:#fff"><div class="kpi-label" title="Cost of Living (COGS) as a percentage of Revenue">COL / Revenue</div>
        <div class="kpi-value" style="color:${Number(colPct) > 30 ? 'var(--red)' : 'var(--orange)'}">${colPct}%</div>
        <div style="font-size:9px">Target &lt;30% ${Number(colPct) <= 30 ? '<span style="color:var(--green)">OK</span>' : '<span style="color:var(--red)">Over</span>'}</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      <div class="card" style="margin:0"><div style="font-size:10px;font-weight:700;margin-bottom:8px">Revenue vs Expenses (3 months)</div>
        ${_renderBarChart(months, rev)}</div>
      <div class="card" style="margin:0"><div style="font-size:10px;font-weight:700;margin-bottom:8px">Expense Breakdown \u2014 ${_monthLabel(_filters.month)}</div>
        ${_renderDonut(totalExp, cogs, wages, rent, otherExp, cogsPct, wagesPct, rentPct, otherPct)}</div>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <table class="tbl">
        <thead><tr>
          <th>${_monthLabel(_filters.month)} \u2014 Summary</th>
          <th style="text-align:right">Amount</th>
          <th style="text-align:right">% Rev</th>
          <th style="text-align:right">vs Prev</th>
        </tr></thead>
        <tbody>
          <tr style="background:var(--bg2)"><td style="font-weight:600">Revenue</td>
            <td style="text-align:right;color:var(--green);font-weight:600">${_fmTbl(rev)}</td>
            <td style="text-align:right">100%</td>
            <td style="text-align:right">${_pctBadge(revChg)}</td></tr>
          <tr><td style="padding-left:28px">COGs</td>
            <td style="text-align:right;color:var(--red)">(${_fmTbl(cogs)})</td>
            <td style="text-align:right">${_pctRev(cogs, rev)}</td>
            <td style="text-align:right">${_pctBadge(d.cogs_chg)}</td></tr>
          <tr style="background:var(--green-bg)"><td style="font-weight:700">Gross Profit</td>
            <td style="text-align:right;color:var(--green);font-weight:700">${_fmTbl(gp)}</td>
            <td style="text-align:right;font-weight:700">${gpPct}%</td>
            <td style="text-align:right">${_pctBadge(d.gp_chg)}</td></tr>
          <tr><td style="padding-left:28px">Operating Expenses</td>
            <td style="text-align:right;color:var(--red)">(${_fmTbl(opex)})</td>
            <td style="text-align:right">${_pctRev(opex, rev)}</td>
            <td style="text-align:right">${_pctBadge(d.opex_chg)}</td></tr>
          <tr><td style="padding-left:28px">Wages & Salaries</td>
            <td style="text-align:right;color:var(--red)">(${_fmTbl(wages)})</td>
            <td style="text-align:right">${_pctRev(wages, rev)}</td>
            <td style="text-align:right">${_pctBadge(d.wages_chg)}</td></tr>
          <tr><td style="padding-left:28px">Rent & Occupancy</td>
            <td style="text-align:right;color:var(--red)">(${_fmTbl(rent)})</td>
            <td style="text-align:right">${_pctRev(rent, rev)}</td>
            <td style="text-align:right">\u2014</td></tr>
          <tr style="background:var(--blue-bg)"><td style="font-weight:700">EBITDA</td>
            <td style="text-align:right;font-weight:700">${_fmTbl(ebitda)}</td>
            <td style="text-align:right;font-weight:700">${ebitdaPct}%</td>
            <td style="text-align:right">${_pctBadge(d.ebitda_chg)}</td></tr>
          <tr><td style="padding-left:28px">Depreciation</td>
            <td style="text-align:right;color:var(--red)">(${_fmTbl(dep)})</td>
            <td style="text-align:right">${_pctRev(dep, rev)}</td>
            <td style="text-align:right">\u2014</td></tr>
          <tr><td style="padding-left:28px">Interest</td>
            <td style="text-align:right;color:var(--red)">(${_fmTbl(interest)})</td>
            <td style="text-align:right">${_pctRev(interest, rev)}</td>
            <td style="text-align:right">\u2014</td></tr>
          <tr style="border-top:2px solid var(--t1);border-bottom:2px solid var(--t1)">
            <td style="font-weight:700;font-size:13px">Net Profit</td>
            <td style="text-align:right;color:${net >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:700;font-size:13px">${net >= 0 ? _fmTbl(net) : '(' + _fmTbl(Math.abs(net)) + ')'}</td>
            <td style="text-align:right;font-weight:700">${netPct}%</td>
            <td style="text-align:right">${_pctBadge(netChg)}</td></tr>
        </tbody>
      </table>
    </div>`;
}


// ══════════════════════════════════════════
// 2. rp-pnl-brand: BRAND COMPARISON
// ══════════════════════════════════════════

function renderRpPnlBrand() {
  if (!_filters.month) _filters.month = _curMonth();
  const actions = `<button class="btn-outline" onclick="FinanceSection.exportPdf()">Export PDF</button>` +
                  `<button class="btn-outline" onclick="FinanceSection.exportCsv()">Export CSV</button>`;
  return SPG.shell(SPG.toolbar('Brand Comparison', actions) + `<div class="content" id="fin-rp-pnl-brand"><div style="${TW}">
    ${_pnlTabs('rp-pnl-brand')}
    <div class="rp-filters">
      <div class="rp-fl-group"><div class="rp-fl-label">Month</div>
        <select class="fl" id="rp_month" onchange="FinanceSection.onBrandFilter()" style="width:110px">${_monthOpts(_filters.month)}</select>
      </div>
    </div>
    <div id="rp_brand_content"><div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading brand data...</div></div>
  </div></div>`, 'Finance');
}

async function loadRpPnlBrand() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadPnlBrand();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function _loadPnlBrand() {
  const el = document.getElementById('rp_brand_content');
  if (!el) return;

  try {
    _pnlBrandData = await FIN.api('get_pnl_brand_compare', { month: _filters.month });
  } catch (e) {
    console.warn('getPnlBrandCompare failed:', e.message);
    if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--red)">Failed to load brand comparison data. Please try again.</div>';
    return;
  }

  const d = _pnlBrandData;
  const brands = d.brands || [];
  const totals = d.totals || {};

  let cardsHtml = '<div style="display:grid;grid-template-columns:repeat(' + Math.min(brands.length + 1, 5) + ',1fr);gap:10px;margin-bottom:14px">';
  cardsHtml += `<div class="card" style="margin:0;text-align:center;border-top:3px solid var(--t1)">
    <div style="font-size:11px;font-weight:600;margin-bottom:6px">All Brands</div>
    <div style="font-size:20px;font-weight:700;color:${(totals.net || 0) >= 0 ? 'var(--green)' : 'var(--red)'}">${fm(totals.net || 0, 0)}</div>
    <div style="font-size:10px;color:var(--t3)">Net \u00b7 ${totals.revenue ? ((totals.net / totals.revenue) * 100).toFixed(1) : '0'}%</div>
  </div>`;

  const brandColors = ['#f59e0b', '#ec4899', '#0ea5e9', '#10b981', '#8b5cf6'];
  brands.forEach((b, i) => {
    const color = brandColors[i % brandColors.length];
    const netPct = b.revenue ? ((b.net / b.revenue) * 100).toFixed(1) : '0';
    const barW = totals.revenue ? ((b.revenue / totals.revenue) * 100).toFixed(0) : 0;
    cardsHtml += `<div class="card" style="margin:0;text-align:center;border-top:3px solid ${color}">
      <div style="font-size:11px;font-weight:600;margin-bottom:6px">${esc(b.name)}</div>
      <div style="font-size:20px;font-weight:700;color:${b.net >= 0 ? 'var(--green)' : 'var(--red)'}">${fm(b.net, 0)}</div>
      <div style="font-size:10px;color:var(--t3)">Net \u00b7 ${netPct}%</div>
      <div style="height:4px;background:var(--bg3);border-radius:2px;margin-top:6px;overflow:hidden">
        <div style="height:100%;width:${barW}%;background:${color};border-radius:2px"></div></div>
    </div>`;
  });
  cardsHtml += '</div>';

  let tblHtml = '<div class="card" style="padding:0;overflow:hidden"><table class="tbl"><thead><tr>';
  tblHtml += `<th style="width:25%">${_monthLabel(_filters.month)}</th>`;
  brands.forEach(b => { tblHtml += `<th style="text-align:right;width:${Math.floor(55 / brands.length)}%">${esc(b.name)}</th>`; });
  tblHtml += '<th style="text-align:right;width:20%">Total</th></tr></thead><tbody>';

  const rows = [
    { label: 'Revenue', key: 'revenue', bold: true, bg: 'var(--bg2)', color: '' },
    { label: 'COGs', key: 'cogs', indent: true, neg: true },
    { label: 'Gross Profit', key: 'gp', bold: true, bg: 'var(--green-bg)', color: 'var(--green)', showPct: true },
    { label: 'Wages', key: 'wages', indent: true, neg: true },
    { label: 'Rent', key: 'rent', indent: true, neg: true },
    { label: 'Other OpEx', key: 'other_opex', indent: true, neg: true },
    { label: 'EBITDA', key: 'ebitda', bold: true, bg: 'var(--blue-bg)', showPct: true },
    { label: 'Net Profit', key: 'net', bold: true, border: true, color: 'auto', showPct: true, big: true },
  ];

  rows.forEach(r => {
    let style = '';
    if (r.bg) style += `background:${r.bg};`;
    if (r.border) style += 'border-top:2px solid var(--t1);';
    tblHtml += `<tr style="${style}">`;
    tblHtml += `<td style="${r.indent ? 'padding-left:24px' : ''}${r.bold ? ';font-weight:700' : ''}${r.big ? ';font-size:13px' : ''}">${esc(r.label)}</td>`;

    brands.forEach(b => {
      const val = b[r.key] || 0;
      let tdColor = '';
      if (r.color === 'auto') tdColor = val >= 0 ? 'color:var(--green)' : 'color:var(--red)';
      else if (r.color) tdColor = `color:${r.color}`;
      else if (r.neg) tdColor = 'color:var(--red)';
      const pctStr = r.showPct && b.revenue ? ` <span style="font-size:9px;color:var(--t3)">${((Math.abs(val) / b.revenue) * 100).toFixed(1)}%</span>` : '';
      const display = r.neg ? `(${_fmTbl(Math.abs(val))})` : _fmTbl(val);
      tblHtml += `<td style="text-align:right;${tdColor}${r.bold ? ';font-weight:' + (r.big ? '700' : '600') : ''}">${display}${pctStr}</td>`;
    });

    const tVal = totals[r.key] || 0;
    let tColor = '';
    if (r.color === 'auto') tColor = tVal >= 0 ? 'color:var(--green)' : 'color:var(--red)';
    else if (r.color) tColor = `color:${r.color}`;
    else if (r.neg) tColor = 'color:var(--red)';
    const tPct = r.showPct && totals.revenue ? ` <span style="font-size:9px;color:var(--t3)">${((Math.abs(tVal) / totals.revenue) * 100).toFixed(1)}%</span>` : '';
    const tDisplay = r.neg ? `(${_fmTbl(Math.abs(tVal))})` : _fmTbl(tVal);
    tblHtml += `<td style="text-align:right;font-weight:700;${tColor}${r.big ? ';font-size:13px' : ''}">${tDisplay}${tPct}</td>`;
    tblHtml += '</tr>';
  });

  tblHtml += '</tbody></table></div>';

  let bestGP = brands.reduce((best, b) => (b.gp_pct || 0) > (best.gp_pct || 0) ? b : best, { gp_pct: 0 });
  let bestNet = brands.reduce((best, b) => (b.net_pct || 0) > (best.net_pct || 0) ? b : best, { net_pct: 0 });
  let worst = brands.reduce((w, b) => (b.ebitda_pct || 100) < (w.ebitda_pct || 100) ? b : w, { ebitda_pct: 100 });
  let footHtml = `<div style="font-size:10px;color:var(--t3);margin-top:10px">`;
  if (bestGP.name) footHtml += `Best GP%: <b style="color:var(--green)">${esc(bestGP.name)} ${(bestGP.gp_pct || 0).toFixed(1)}%</b> \u00b7 `;
  if (bestNet.name) footHtml += `Highest Net margin: <b style="color:var(--green)">${esc(bestNet.name)} ${(bestNet.net_pct || 0).toFixed(1)}%</b> \u00b7 `;
  if (worst.name) footHtml += `Watch: <b style="color:var(--orange)">${esc(worst.name)} EBITDA ${(worst.ebitda_pct || 0).toFixed(1)}%</b>`;
  footHtml += '</div>';

  el.innerHTML = cardsHtml + tblHtml + footHtml;
}


// ══════════════════════════════════════════
// 3. rp-pnl-flow: PROFIT FLOW (Waterfall)
// ══════════════════════════════════════════

function renderRpPnlFlow() {
  if (!_filters.month) _filters.month = _curMonth();
  const actions = `<button class="btn-outline" onclick="FinanceSection.exportPdf()">Export PDF</button>` +
                  `<button class="btn-outline" onclick="FinanceSection.exportCsv()">Export CSV</button>`;
  return SPG.shell(SPG.toolbar('Profit Flow', actions) + `<div class="content" id="fin-rp-pnl-flow"><div style="${TW2}">
    ${_pnlTabs('rp-pnl-flow')}
    <div class="rp-filters">
      <div class="rp-fl-group"><div class="rp-fl-label">Month</div>
        <select class="fl" id="rp_month" onchange="FinanceSection.onFlowFilter()" style="width:110px">${_monthOpts(_filters.month)}</select>
      </div>
      <div class="rp-fl-group"><div class="rp-fl-label">Brand</div>
        <select class="fl" id="rp_brand" onchange="FinanceSection.onFlowFilter()" style="width:140px">${_brandOpts(_filters.brand)}</select>
      </div>
    </div>
    <div id="rp_flow_content"><div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
  </div></div>`, 'Finance');
}

async function loadRpPnlFlow() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadPnlFlow();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function _loadPnlFlow() {
  const el = document.getElementById('rp_flow_content');
  if (!el) return;

  try {
    _flowData = await FIN.api('get_profit_flow', {
      month: _filters.month,
      brand: _filters.brand === 'All' ? null : _filters.brand,
    });
  } catch (e) {
    console.warn('getProfitFlow failed:', e.message);
    if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--red)">Failed to load profit flow data. Please try again.</div>';
    return;
  }

  const d = _flowData;
  const rev = d.revenue || 0;
  const net = d.net || 0;
  const netPct = rev ? ((net / rev) * 100).toFixed(1) : '0';

  let html = `<div class="kpi-grid" style="flex-wrap:nowrap;margin-bottom:14px">
    <div class="kpi-card" style="border-top:3px solid var(--green);background:#fff"><div class="kpi-label">Revenue</div><div class="kpi-value">${_fmK(rev)}</div></div>
    <div class="kpi-card" style="border-top:3px solid var(--red);background:#fff"><div class="kpi-label">Total Costs</div><div class="kpi-value" style="color:var(--red)">(${_fmK(d.total_costs || 0)})</div></div>
    <div class="kpi-card" style="border-top:3px solid var(--acc);background:#fff"><div class="kpi-label">Net Profit</div><div class="kpi-value" style="color:${net >= 0 ? 'var(--green)' : 'var(--red)'}">${fm(net, 0)}</div><div style="font-size:9px;color:var(--t3)">${netPct}% net margin</div></div>
  </div>`;

  html += `<div class="card"><div style="font-size:12px;font-weight:700;margin-bottom:14px">Revenue \u2192 Net Profit Flow \u2014 ${_monthLabel(_filters.month)}</div>`;

  const items = d.waterfall || [];
  items.forEach(w => {
    const pct = rev ? ((Math.abs(w.amount) / rev) * 100) : 0;
    const color = w.color || 'var(--t3)';
    const isSub = w.is_subtotal || false;
    html += `<div class="wf-row${isSub ? ' sub' : ''}">
      <div class="wf-lbl" style="color:${color}">${esc(w.label)}</div>
      <div class="wf-bar"><div class="wf-bar-fill" style="width:${pct.toFixed(1)}%;background:${color};opacity:${isSub ? 1 : 0.6}"></div></div>
      <div class="wf-val" style="color:${color}">${esc(w.display)}</div>
    </div>`;
  });

  html += '</div>';

  const drivers = d.cost_drivers || [];
  if (drivers.length) {
    html += `<div style="font-size:10px;color:var(--t3);margin-top:10px">Biggest cost drivers: ${drivers.map(d => esc(d)).join(' \u00b7 ')}</div>`;
  }

  el.innerHTML = html;
}


// ══════════════════════════════════════════
// 4. rp-pnl-full: FULL P&L STATEMENT
// ══════════════════════════════════════════

function renderRpPnlFull() {
  const now = _curMonth();
  const yr = now.substring(0, 4);
  if (!_fullFilters.from) _fullFilters.from = yr + '-01';
  if (!_fullFilters.to) _fullFilters.to = now;
  const actions = `<button class="btn-outline" onclick="FinanceSection.exportPdf()">Export PDF</button>` +
                  `<button class="btn-outline" onclick="FinanceSection.exportCsv()">Export CSV</button>`;
  return SPG.shell(SPG.toolbar('Full P&L Statement', actions) + `<div class="content" id="fin-rp-pnl-full"><div style="${TW}">
    ${_pnlTabs('rp-pnl-full')}
    <div class="rp-filters">
      <div class="rp-fl-group"><div class="rp-fl-label">Period</div>
        <select class="fl" id="rp_period" style="width:100px"><option>Monthly</option><option>Quarterly</option><option>Yearly</option></select></div>
      <div class="rp-fl-group"><div class="rp-fl-label">From</div>
        <input class="fl" type="month" id="rp_from" value="${_fullFilters.from}" style="width:120px"></div>
      <div class="rp-fl-group"><div class="rp-fl-label">To</div>
        <input class="fl" type="month" id="rp_to" value="${_fullFilters.to}" style="width:120px"></div>
      <div class="rp-fl-group"><div class="rp-fl-label">Brand</div>
        <select class="fl" id="rp_full_brand" style="width:140px">${_brandOpts(_fullFilters.brand)}</select></div>
      <div class="rp-fl-group"><div class="rp-fl-label">Compare</div>
        <select class="fl" id="rp_compare" style="width:120px"><option>None</option><option>vs Last Year</option><option>vs Budget</option></select></div>
      <button class="btn-primary" onclick="FinanceSection.applyPnlFull()" style="align-self:flex-end">Apply</button>
    </div>
    <div id="rp_full_content"><div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
  </div></div>`, 'Finance');
}

async function loadRpPnlFull() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadPnlFull();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function _loadPnlFull() {
  const el = document.getElementById('rp_full_content');
  if (!el) return;

  const from = document.getElementById('rp_from')?.value || _fullFilters.from;
  const to = document.getElementById('rp_to')?.value || _fullFilters.to;
  const brand = document.getElementById('rp_full_brand')?.value || 'All';
  _fullFilters.from = from;
  _fullFilters.to = to;
  _fullFilters.brand = brand;

  el.innerHTML = '<div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div>';

  try {
    _fullData = await FIN.api('get_pnl_full', {
      from, to,
      brand: brand === 'All' ? null : brand,
    });
  } catch (e) {
    console.warn('getPnlFull failed:', e.message);
    if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--red)">Failed to load Full P&L data. Please try again.</div>';
    return;
  }

  const d = _fullData;
  const cols = d.columns || [];
  const groups = d.groups || [];

  const allZero = groups.every(grp => {
    const itemsZero = (grp.items || []).every(item => (item.values || []).every(v => !v || v === 0));
    const totalsZero = (grp.totals || []).every(v => !v || v === 0);
    const subtotalZero = !grp.subtotal || (grp.subtotal.values || []).every(v => !v || v === 0);
    return itemsZero && totalsZero && subtotalZero;
  });
  if (allZero) {
    el.innerHTML = '<div class="empty" style="padding:40px;color:var(--t3);text-align:center"><div style="font-size:24px;margin-bottom:8px">\ud83d\udcca</div>No financial data recorded for this period</div>';
    return;
  }

  const SR = 'style="text-align:right"';
  const NR = 'style="text-align:right;color:var(--red)"';
  const GR = 'style="text-align:right;color:var(--green)"';

  let html = '<div class="card" style="padding:0;overflow:hidden"><table class="tbl" style="font-size:12px"><thead><tr>';
  html += `<th style="width:30%">Account</th>`;
  cols.forEach(c => { html += `<th ${SR} style="width:${Math.floor(70 / cols.length)}%">${esc(c)}</th>`; });
  html += '</tr></thead><tbody>';

  groups.forEach(grp => {
    html += `<tr style="background:var(--bg2)"><td colspan="${cols.length + 1}" style="font-weight:700;font-size:11px;padding-top:10px">${esc(grp.label)}</td></tr>`;

    (grp.items || []).forEach(item => {
      html += '<tr>';
      html += `<td style="padding-left:28px">${esc(item.label)}</td>`;
      (item.values || []).forEach((v, ci) => {
        const isLast = ci === item.values.length - 1;
        const style = grp.is_negative ? NR : SR;
        html += `<td ${style}${isLast ? ';font-weight:600' : ''}>${grp.is_negative ? '(' + _fmTbl(Math.abs(v)) + ')' : _fmTbl(v)}</td>`;
      });
      html += '</tr>';
    });

    if (grp.totals) {
      html += `<tr style="background:var(--bg2)"><td style="font-weight:600">${esc(grp.total_label || 'Total ' + grp.label)}</td>`;
      grp.totals.forEach((v, ci) => {
        const isLast = ci === grp.totals.length - 1;
        const style = grp.is_negative ? NR : SR;
        html += `<td ${style}${isLast ? ';font-weight:600' : ''}>${grp.is_negative ? '(' + _fmTbl(Math.abs(v)) + ')' : _fmTbl(v)}</td>`;
      });
      html += '</tr>';
    }

    if (grp.subtotal) {
      const st = grp.subtotal;
      const bgMap = { 'Gross Profit': 'var(--green-bg)', 'EBITDA': 'var(--blue-bg)', 'Net Profit': '' };
      const bg = bgMap[st.label] || '';
      const isFinal = st.label === 'Net Profit';
      html += `<tr style="${bg ? 'background:' + bg : ''}${isFinal ? ';border-top:2px solid var(--t1);border-bottom:2px solid var(--t1)' : ''}">`;
      html += `<td style="font-weight:700${isFinal ? ';font-size:13px' : ''}">${esc(st.label)}</td>`;
      (st.values || []).forEach((v, ci) => {
        const isLast = ci === st.values.length - 1;
        const pctStr = st.pcts ? ` <span style="font-size:9px;color:var(--t3)">${st.pcts[ci]}%</span>` : '';
        html += `<td ${GR} style="font-weight:700${isFinal ? ';font-size:' + (isLast ? '14px' : '13px') : ''}">${_fmTbl(v)}${pctStr}</td>`;
      });
      html += '</tr>';
    }
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}


// ══════════════════════════════════════════
// FILTER HANDLERS
// ══════════════════════════════════════════

function _onFilter() {
  _filters.month = document.getElementById('rp_month')?.value || _filters.month;
  _filters.brand = document.getElementById('rp_brand')?.value || 'All';
  _pnlData = null;
  _loadPnlDashboard();
}

function _onBrandFilter() {
  _filters.month = document.getElementById('rp_month')?.value || _filters.month;
  _pnlBrandData = null;
  _loadPnlBrand();
}

function _onFlowFilter() {
  _filters.month = document.getElementById('rp_month')?.value || _filters.month;
  _filters.brand = document.getElementById('rp_brand')?.value || 'All';
  _flowData = null;
  _loadPnlFlow();
}


// ══════════════════════════════════════════
// 5. rp-bs: BALANCE SHEET
// ══════════════════════════════════════════

function renderRpBs() {
  if (!_filters.month) _filters.month = _curMonth();
  const actions = `<select class="fl" id="rp_bs_brand" onchange="FinanceSection.onBsFilter()" style="width:140px">${_brandOpts(_filters.brand)}</select>` +
                  `<select class="fl" id="rp_bs_month" onchange="FinanceSection.onBsFilter()" style="width:110px">${_monthOpts(_filters.month)}</select>`;
  return SPG.shell(SPG.toolbar('Balance Sheet', actions) + `<div class="content" id="fin-rp-bs"><div style="${TW2}">
    <div id="rp_bs_content"><div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading Balance Sheet...</div></div>
  </div></div>`, 'Finance');
}

async function loadRpBs() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadBalanceSheet();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function _loadBalanceSheet() {
  const el = document.getElementById('rp_bs_content');
  if (!el) return;

  try {
    _bsData = await FIN.api('get_balance_sheet', {
      month: _filters.month,
      brand: _filters.brand === 'All' ? null : _filters.brand,
    });
  } catch (e) {
    console.warn('getBalanceSheet failed:', e.message);
    if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--red)">Failed to load Balance Sheet data. Please try again.</div>';
    return;
  }

  const d = _bsData;
  const totalAssets = d.total_assets || 0;
  const totalLiabilities = d.total_liabilities || 0;
  const equity = d.equity || 0;
  const balanced = Math.abs(totalAssets - (totalLiabilities + equity)) < 1;

  let html = `<div class="kpi-grid" style="flex-wrap:nowrap">
    <div class="kpi-card"><div class="kpi-label">Total Assets</div><div class="kpi-value">${fm(totalAssets, 0)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Total Liabilities</div><div class="kpi-value" style="color:var(--red)">${fm(totalLiabilities, 0)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Equity</div><div class="kpi-value" style="color:${equity >= 0 ? 'var(--green)' : 'var(--red)'}">${fm(equity, 0)}</div></div>
  </div>`;

  const cols = d.columns || [_monthLabel(_filters.month)];
  const prevCol = d.prev_column || null;
  const gridCols = prevCol ? '1fr 100px 100px' : '1fr 100px';

  html += '<div class="pl">';
  html += `<div class="pl-hd" style="grid-template-columns:${gridCols}"><div>Account</div>`;
  cols.forEach(c => { html += `<div style="text-align:right">${esc(c)}</div>`; });
  if (prevCol) html += `<div style="text-align:right">${esc(prevCol)}</div>`;
  html += '</div>';

  (d.sections || []).forEach(sec => {
    html += `<div class="pl-r cat" style="grid-template-columns:${gridCols}"><div>${esc(sec.label)}</div></div>`;
    (sec.items || []).forEach(item => {
      html += `<div class="pl-r sub" style="grid-template-columns:${gridCols}"><div>${esc(item.label)}</div>`;
      html += `<div class="pl-v">${_fmTbl(item.current)}</div>`;
      if (prevCol) html += `<div class="pl-v" style="color:var(--t3)">${_fmTbl(item.previous)}</div>`;
      html += '</div>';
    });
    html += `<div class="pl-r total" style="grid-template-columns:${gridCols}"><div>${esc(sec.total_label || 'Total ' + sec.label)}</div>`;
    html += `<div class="pl-v"${sec.total_color ? ' style="color:' + sec.total_color + '"' : ''}>${_fmTbl(sec.total_current)}</div>`;
    if (prevCol) html += `<div class="pl-v" style="color:var(--t3)">${_fmTbl(sec.total_previous)}</div>`;
    html += '</div>';
  });

  if (d.le_total) {
    html += `<div class="pl-r grand" style="grid-template-columns:${gridCols}"><div>L + E</div>`;
    html += `<div class="pl-v">${_fmTbl(d.le_total.current)}</div>`;
    if (prevCol) html += `<div class="pl-v" style="color:var(--t3)">${_fmTbl(d.le_total.previous)}</div>`;
    html += '</div>';
  }

  html += '</div>';

  html += `<div style="margin-top:6px;padding:8px;background:${balanced ? 'var(--green-bg)' : 'var(--red-bg)'};border-radius:var(--rd);text-align:center">
    <span style="font-size:11px;font-weight:700;color:${balanced ? 'var(--green)' : 'var(--red)'}">${balanced ? '\u2713 Balanced' : '\u2717 Not Balanced'}</span>
    <span style="font-size:10px;color:var(--t3)">Assets ${fm(totalAssets, 0)} ${balanced ? '=' : '\u2260'} L + E ${fm(totalLiabilities + equity, 0)}</span>
  </div>`;

  el.innerHTML = html;
}

function _onBsFilter() {
  _filters.month = document.getElementById('rp_bs_month')?.value || _filters.month;
  _filters.brand = document.getElementById('rp_bs_brand')?.value || 'All';
  _bsData = null;
  _loadBalanceSheet();
}


// ══════════════════════════════════════════
// 6. rp-cf: CASH FLOW STATEMENT
// ══════════════════════════════════════════

function renderRpCf() {
  if (!_filters.month) _filters.month = _curMonth();
  const actions = `<select class="fl" id="rp_cf_month" onchange="FinanceSection.onCfFilter()" style="width:110px">${_monthOpts(_filters.month)}</select>` +
                  `<select class="fl" id="rp_cf_brand" onchange="FinanceSection.onCfFilter()" style="width:140px">${_brandOpts(_filters.brand)}</select>`;
  return SPG.shell(SPG.toolbar('Cash Flow Statement', actions) + `<div class="content" id="fin-rp-cf"><div style="${TW2}">
    <div id="rp_cf_content"><div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading Cash Flow...</div></div>
  </div></div>`, 'Finance');
}

async function loadRpCf() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadCashFlow();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function _loadCashFlow() {
  const el = document.getElementById('rp_cf_content');
  if (!el) return;

  try {
    _cfData = await FIN.api('get_cash_flow', {
      month: _filters.month,
      brand: _filters.brand === 'All' ? null : _filters.brand,
    });
  } catch (e) {
    console.warn('getCashFlow failed:', e.message);
    if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--red)">Failed to load Cash Flow data. Please try again.</div>';
    return;
  }

  const d = _cfData;

  let html = `<div class="kpi-grid" style="flex-wrap:nowrap">
    <div class="kpi-card"><div class="kpi-label">Operating</div><div class="kpi-value" style="color:${(d.operating || 0) >= 0 ? 'var(--green)' : 'var(--red)'}">${_fmK(d.operating)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Investing</div><div class="kpi-value" style="color:${(d.investing || 0) >= 0 ? 'var(--green)' : 'var(--red)'}">${_fmK(d.investing)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Financing</div><div class="kpi-value" style="color:${(d.financing || 0) >= 0 ? 'var(--green)' : 'var(--red)'}">${_fmK(d.financing)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Net Cash</div><div class="kpi-value" style="color:${(d.net_cash || 0) >= 0 ? 'var(--green)' : 'var(--red)'}">${_fmK(d.net_cash)}</div></div>
  </div>`;

  const gridCols = '1fr 100px 100px';
  html += '<div class="pl">';
  html += `<div class="pl-hd" style="grid-template-columns:${gridCols}"><div>Item</div><div style="text-align:right">This Month</div><div style="text-align:right">YTD</div></div>`;

  (d.sections || []).forEach(sec => {
    html += `<div class="pl-r cat" style="grid-template-columns:${gridCols}"><div>${esc(sec.label)}</div></div>`;
    (sec.items || []).forEach(item => {
      html += `<div class="pl-r sub" style="grid-template-columns:${gridCols}"><div>${esc(item.label)}</div>`;
      const mColor = item.month >= 0 ? 'var(--green)' : 'var(--red)';
      html += `<div class="pl-v" style="color:${mColor}">${item.month >= 0 ? _fmTbl(item.month) : '(' + _fmTbl(Math.abs(item.month)) + ')'}</div>`;
      html += `<div class="pl-v" style="color:var(--t3)">${item.ytd >= 0 ? _fmTbl(item.ytd) : '(' + _fmTbl(Math.abs(item.ytd)) + ')'}</div>`;
      html += '</div>';
    });
    if (sec.total_label) {
      const tColor = (sec.total_month || 0) >= 0 ? 'var(--green)' : 'var(--red)';
      html += `<div class="pl-r total" style="grid-template-columns:${gridCols}"><div>${esc(sec.total_label)}</div>`;
      html += `<div class="pl-v" style="color:${tColor}">${_fmTbl(sec.total_month)}</div>`;
      html += `<div class="pl-v" style="color:var(--t3)">${_fmTbl(sec.total_ytd)}</div>`;
      html += '</div>';
    }
  });

  const netColor = (d.net_cash || 0) >= 0 ? 'var(--green)' : 'var(--red)';
  html += `<div class="pl-r grand" style="grid-template-columns:${gridCols}"><div>Net Cash Change</div>`;
  html += `<div class="pl-v" style="color:${netColor}">${_fmTbl(d.net_cash)}</div>`;
  html += `<div class="pl-v" style="color:var(--t3)">${_fmTbl(d.net_cash_ytd)}</div>`;
  html += '</div></div>';

  el.innerHTML = html;
}

function _onCfFilter() {
  _filters.month = document.getElementById('rp_cf_month')?.value || _filters.month;
  _filters.brand = document.getElementById('rp_cf_brand')?.value || 'All';
  _cfData = null;
  _loadCashFlow();
}


// ══════════════════════════════════════════
// 7. rp-apar: AP/AR TRACKER
// ══════════════════════════════════════════

function renderRpApar() {
  const actions = `<select class="fl" id="rp_apar_brand" onchange="FinanceSection.onAparFilter()" style="width:140px">${_brandOpts(_filters.brand)}</select>`;
  return SPG.shell(SPG.toolbar('AP/AR Tracker', actions) + `<div class="content" id="fin-rp-apar"><div style="${TW2}">
    <div id="rp_apar_kpi"></div>
    <div class="tabs" id="rp_apar_tabs">
      <div class="tab a" onclick="FinanceSection.aparTab('ap')">Accounts Payable</div>
      <div class="tab" onclick="FinanceSection.aparTab('ar')">Accounts Receivable</div>
      <div class="tab" onclick="FinanceSection.aparTab('aging')">Aging Summary</div>
    </div>
    <div id="rp_apar_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
  </div></div>`, 'Finance');
}

async function loadRpApar() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadApar();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function _loadApar() {
  try {
    _aparData = await FIN.api('get_ap_ar_tracker', { brand: _filters.brand === 'All' ? null : _filters.brand });
  } catch (e) {
    console.warn('getApArTracker failed:', e.message);
    const el = document.getElementById('rp_apar_content');
    if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--red)">Failed to load AP/AR data. Please try again.</div>';
    return;
  }
  _renderAparKpi();
  _renderAparTable();
}

function _renderAparKpi() {
  const el = document.getElementById('rp_apar_kpi');
  if (!el || !_aparData) return;
  const d = _aparData;
  el.innerHTML = `<div class="kpi-grid" style="flex-wrap:nowrap">
    <div class="kpi-card"><div class="kpi-label">Total AP</div><div class="kpi-value" style="color:var(--red)">${_fmK(d.total_ap)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Overdue AP</div><div class="kpi-value" style="color:var(--red)">${_fmK(d.overdue_ap)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Total AR</div><div class="kpi-value" style="color:var(--green)">${_fmK(d.total_ar)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Overdue AR</div><div class="kpi-value" style="color:var(--green)">${_fmK(d.overdue_ar)}</div></div>
  </div>`;
}

function _renderAparTable() {
  const el = document.getElementById('rp_apar_content');
  if (!el || !_aparData) return;
  document.querySelectorAll('#rp_apar_tabs .tab').forEach(t => t.classList.remove('a'));
  const tabMap = { ap: 0, ar: 1, aging: 2 };
  const tabs = document.querySelectorAll('#rp_apar_tabs .tab');
  if (tabs[tabMap[_aparTab]]) tabs[tabMap[_aparTab]].classList.add('a');

  const rows = _aparTab === 'ar' ? (_aparData.ar_rows || []) : (_aparData.ap_rows || []);
  if (_aparTab === 'aging') {
    const aging = _aparData.aging || {};
    el.innerHTML = `<div class="card" style="padding:16px"><div style="font-size:11px;font-weight:700;margin-bottom:10px">AP Aging Summary</div>
      <div style="display:flex;gap:10px;margin-bottom:10px">
        <div style="flex:1;padding:10px;background:var(--green-bg);border-radius:var(--rd);text-align:center"><div style="font-size:10px;color:var(--t3)">Current</div><div style="font-size:16px;font-weight:700">${fm(aging.current || 0, 0)}</div></div>
        <div style="flex:1;padding:10px;background:var(--orange-bg);border-radius:var(--rd);text-align:center"><div style="font-size:10px;color:var(--t3)">1-30 days</div><div style="font-size:16px;font-weight:700">${fm(aging.d30 || 0, 0)}</div></div>
        <div style="flex:1;padding:10px;background:var(--red-bg);border-radius:var(--rd);text-align:center"><div style="font-size:10px;color:var(--t3)">31-60 days</div><div style="font-size:16px;font-weight:700">${fm(aging.d60 || 0, 0)}</div></div>
        <div style="flex:1;padding:10px;background:var(--red-bg);border-radius:var(--rd);text-align:center"><div style="font-size:10px;color:var(--t3)">60+ days</div><div style="font-size:16px;font-weight:700;color:var(--red)">${fm(aging.d90 || 0, 0)}</div></div>
      </div></div>`;
    return;
  }
  let html = '<table class="tbl" id="rp_aging_tbl"><thead><tr>' +
    ui.sortTh('rp_aging_tbl','supplier','Supplier') +
    ui.sortTh('rp_aging_tbl','current','Current',' style="text-align:right"') +
    ui.sortTh('rp_aging_tbl','d30','1-30 days',' style="text-align:right"') +
    ui.sortTh('rp_aging_tbl','d60','31-60 days',' style="text-align:right"') +
    ui.sortTh('rp_aging_tbl','d60p','60+ days',' style="text-align:right"') +
    ui.sortTh('rp_aging_tbl','total','Total',' style="text-align:right"') +
    '</tr></thead><tbody>';
  if (rows.length === 0) {
    html += `<tr><td colspan="6" style="text-align:center;color:var(--t3);padding:20px">No ${_aparTab === 'ar' ? 'receivables' : 'payables'} found</td></tr>`;
  }
  rows.forEach(r => {
    const hasOverdue = (r.d30 || 0) + (r.d60 || 0) + (r.d90 || 0) > 0;
    html += `<tr><td>${esc(r.name)}</td>
      <td style="text-align:right">${_fmTbl(r.current)}</td>
      <td style="text-align:right">${_fmTbl(r.d30)}</td>
      <td style="text-align:right">${_fmTbl(r.d60)}</td>
      <td style="text-align:right">${_fmTbl(r.d90)}</td>
      <td style="text-align:right;font-weight:600${hasOverdue ? ';color:var(--red)' : ''}">${_fmTbl(r.total)}</td></tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

function _aparTabSwitch(tab) { _aparTab = tab; _renderAparTable(); }
function _onAparFilter() {
  _filters.brand = document.getElementById('rp_apar_brand')?.value || 'All';
  _aparData = null; _loadApar();
}


// ══════════════════════════════════════════
// 8. rp-asset: FIXED ASSET MANAGEMENT
// ══════════════════════════════════════════

function renderRpAsset() {
  const actions = `<button class="btn-primary" onclick="FinanceSection.addAsset()">+ Register Asset</button>`;
  return SPG.shell(SPG.toolbar('Fixed Asset Management', actions) + `<div class="content" id="fin-rp-asset"><div style="${TW2}">
    <div id="rp_asset_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
  </div></div>`, 'Finance');
}

async function loadRpAsset() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadAsset();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function _loadAsset() {
  const el = document.getElementById('rp_asset_content');
  if (!el) return;
  try {
    _assetData = await FIN.api('get_asset_summary', {});
  } catch (e) {
    console.warn('getAssetSummary failed:', e.message);
    if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--red)">Failed to load asset data. Please try again.</div>';
    return;
  }
  const d = _assetData;
  let html = `<div class="kpi-grid" style="flex-wrap:nowrap">
    <div class="kpi-card"><div class="kpi-label">Total Assets</div><div class="kpi-value">${d.count || 0}</div></div>
    <div class="kpi-card"><div class="kpi-label">Original Cost</div><div class="kpi-value">${fm(d.total_cost || 0, 0)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Accumulated Dep.</div><div class="kpi-value" style="color:var(--red)">${fm(d.total_dep || 0, 0)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Net Book Value</div><div class="kpi-value" style="color:var(--green)">${fm(d.total_nbv || 0, 0)}</div></div>
  </div>`;
  html += '<table class="tbl" id="rp_asset_tbl"><thead><tr>' +
    ui.sortTh('rp_asset_tbl','id','Asset ID') +
    ui.sortTh('rp_asset_tbl','name','Name') +
    ui.sortTh('rp_asset_tbl','cat','Category') +
    ui.sortTh('rp_asset_tbl','brand','Brand') +
    ui.sortTh('rp_asset_tbl','date','Purchase Date') +
    ui.sortTh('rp_asset_tbl','cost','Cost',' style="text-align:right"') +
    ui.sortTh('rp_asset_tbl','nbv','NBV',' style="text-align:right"') +
    ui.sortTh('rp_asset_tbl','status','Status') +
    '</tr></thead><tbody>';
  (d.rows || []).forEach(r => {
    html += `<tr><td><a class="lk">${esc(r.asset_id)}</a></td><td>${esc(r.name)}</td><td>${esc(r.category)}</td><td>${esc(r.brand)}</td><td>${esc(r.purchase_date)}</td>
      <td style="text-align:right">${fm(r.cost)}</td><td style="text-align:right">${fm(r.nbv)}</td>
      <td>${r.nbv <= 0 ? '<span class="sts-warn">Fully Dep.</span>' : '<span class="sts-ok">Active</span>'}</td></tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

function _addAsset() { SPG.toast('Register Asset \u2014 coming soon'); }


// ══════════════════════════════════════════
// 9. rp-bank: BANK ACCOUNT SUMMARY
// ══════════════════════════════════════════

function renderRpBank() {
  const actions = `<select class="fl" id="rp_bank_brand" onchange="FinanceSection.onBankFilter()" style="width:140px">${_brandOpts(_filters.brand)}</select>`;
  return SPG.shell(SPG.toolbar('Bank Account Summary', actions) + `<div class="content" id="fin-rp-bank"><div style="${TW2}">
    <div style="font-size:11px;color:var(--t3);margin-bottom:8px">Book balance (SPG) vs Bank statement balance \u2014 shows reconciliation status</div>
    <div id="rp_bank_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
  </div></div>`, 'Finance');
}

async function loadRpBank() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadBank();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function _loadBank() {
  const el = document.getElementById('rp_bank_content');
  if (!el) return;
  try {
    _bankData = await FIN.api('get_bank_summary', { brand: _filters.brand === 'All' ? null : _filters.brand });
  } catch (e) {
    console.warn('getBankSummary failed:', e.message);
    if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--red)">Failed to load bank summary data. Please try again.</div>';
    return;
  }
  const d = _bankData;
  let html = '<table class="tbl" id="rp_bank_tbl"><thead><tr>' +
    ui.sortTh('rp_bank_tbl','acct','Account') +
    ui.sortTh('rp_bank_tbl','brand','Brand') +
    ui.sortTh('rp_bank_tbl','spg','SPG Balance',' style="text-align:right"') +
    ui.sortTh('rp_bank_tbl','bank','Bank Balance',' style="text-align:right"') +
    ui.sortTh('rp_bank_tbl','diff','Difference',' style="text-align:right"') +
    ui.sortTh('rp_bank_tbl','recon','Reconciled?') +
    ui.sortTh('rp_bank_tbl','last','Last reconciled') +
    '</tr></thead><tbody>';
  (d.rows || []).forEach(r => {
    const diff = (r.spg_balance || 0) - (r.bank_balance || 0);
    const diffColor = Math.abs(diff) < 0.01 ? 'var(--green)' : (Math.abs(diff) > 500 ? 'var(--red)' : 'var(--orange)');
    const reconBadge = Math.abs(diff) < 0.01 ? '<span class="sts-ok">Yes</span>' : (Math.abs(diff) > 500 ? '<span class="sts-err">No</span>' : '<span class="sts-warn">Partial</span>');
    html += `<tr><td style="font-weight:600">${esc(r.account)}</td><td>${esc(r.brand)}</td>
      <td style="text-align:right">${fm(r.spg_balance)}</td>
      <td style="text-align:right">${fm(r.bank_balance)}</td>
      <td style="text-align:right;color:${diffColor};font-weight:600">${fm(diff)}</td>
      <td>${reconBadge}</td><td>${esc(r.last_reconciled || '')}</td></tr>`;
  });
  html += '</tbody></table>';
  const totalSpg = (d.rows || []).reduce((s, r) => s + (r.spg_balance || 0), 0);
  html += `<div style="text-align:right;font-size:12px;margin-top:8px"><b>Total SPG Balance: ${fm(totalSpg)}</b></div>`;
  el.innerHTML = html;
}

function _onBankFilter() {
  _filters.brand = document.getElementById('rp_bank_brand')?.value || 'All';
  _bankData = null; _loadBank();
}


// ══════════════════════════════════════════
// 10. rp-cash: CASH ACCOUNT SUMMARY
// ══════════════════════════════════════════

function renderRpCash() {
  const actions = `<select class="fl" id="rp_cash_brand" onchange="FinanceSection.onCashFilter()" style="width:140px">${_brandOpts(_filters.brand)}</select>`;
  return SPG.shell(SPG.toolbar('Cash Account Summary', actions) + `<div class="content" id="fin-rp-cash"><div style="${TW2}">
    <div style="font-size:11px;color:var(--t3);margin-bottom:8px">Cash-in-hand accounts \u2014 must match physical cash count</div>
    <div id="rp_cash_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
  </div></div>`, 'Finance');
}

async function loadRpCash() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadCash();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function _loadCash() {
  const el = document.getElementById('rp_cash_content');
  if (!el) return;
  try {
    _cashData = await FIN.api('get_cash_summary', { brand: _filters.brand === 'All' ? null : _filters.brand });
  } catch (e) {
    console.warn('getCashSummary failed:', e.message);
    if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--red)">Failed to load cash summary data. Please try again.</div>';
    return;
  }
  let html = '<table class="tbl" id="rp_cash_tbl"><thead><tr>' +
    ui.sortTh('rp_cash_tbl','acct','Account') +
    ui.sortTh('rp_cash_tbl','brand','Brand') +
    ui.sortTh('rp_cash_tbl','sys','System Balance',' style="text-align:right"') +
    ui.sortTh('rp_cash_tbl','count','Last Count',' style="text-align:right"') +
    ui.sortTh('rp_cash_tbl','diff','Difference',' style="text-align:right"') +
    ui.sortTh('rp_cash_tbl','last','Last counted') +
    ui.sortTh('rp_cash_tbl','status','Status') +
    '</tr></thead><tbody>';
  (_cashData.rows || []).forEach(r => {
    const diff = (r.system || 0) - (r.count || 0);
    const diffColor = Math.abs(diff) < 0.01 ? 'var(--green)' : 'var(--red)';
    const badge = Math.abs(diff) < 0.01 ? '<span class="sts-ok">Matched</span>' : '<span class="sts-err">Short</span>';
    html += `<tr><td style="font-weight:600">${esc(r.account)}</td><td>${esc(r.brand)}</td>
      <td style="text-align:right">${fm(r.system)}</td><td style="text-align:right">${fm(r.count)}</td>
      <td style="text-align:right;color:${diffColor};font-weight:600">${diff >= 0 ? fm(diff) : '-' + fm(Math.abs(diff))}</td>
      <td>${esc(r.last_counted || '')}</td><td>${badge}</td></tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

function _onCashFilter() {
  _filters.brand = document.getElementById('rp_cash_brand')?.value || 'All';
  _cashData = null; _loadCash();
}


// ══════════════════════════════════════════
// 11. rp-loan: LOAN & EQUITY REPORT
// ══════════════════════════════════════════

function renderRpLoan() {
  const actions = `<select class="fl" id="rp_loan_brand" style="width:140px">${_brandOpts('All')}</select>`;
  return SPG.shell(SPG.toolbar('Loan & Equity Report', actions) + `<div class="content" id="fin-rp-loan"><div style="${TW2}">
    <div class="tabs" id="rp_loan_tabs">
      <div class="tab a" onclick="FinanceSection.loanTab('interco')">Intercompany Matrix</div>
      <div class="tab" onclick="FinanceSection.loanTab('director')">Director Loans</div>
      <div class="tab" onclick="FinanceSection.loanTab('capital')">Capital Structure</div>
    </div>
    <div id="rp_loan_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
  </div></div>`, 'Finance');
}

async function loadRpLoan() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadLoan();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function _loadLoan() {
  try {
    _loanData = await FIN.api('get_loan_report', {});
  } catch (e) {
    console.warn('getLoanReport failed:', e.message);
    const el = document.getElementById('rp_loan_content');
    if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--red)">Failed to load loan data. Please try again.</div>';
    return;
  }
  _renderLoanTab();
}

function _renderLoanTab() {
  const el = document.getElementById('rp_loan_content');
  if (!el || !_loanData) return;
  document.querySelectorAll('#rp_loan_tabs .tab').forEach(t => t.classList.remove('a'));
  const tabMap = { interco: 0, director: 1, capital: 2 };
  const tabs = document.querySelectorAll('#rp_loan_tabs .tab');
  if (tabs[tabMap[_loanTab]]) tabs[tabMap[_loanTab]].classList.add('a');

  const d = _loanData;
  let html = '';

  if (_loanTab === 'interco') {
    const brands = d.brand_names || [];
    html += '<div class="card" style="margin:0 0 10px"><div style="font-size:11px;font-weight:700;margin-bottom:6px">Intercompany Loan Matrix</div>';
    html += '<table class="tbl"><thead><tr><th>From \\ To</th>';
    brands.forEach(b => { html += `<th style="text-align:right">${esc(b.substring(0, 8))}</th>`; });
    html += '</tr></thead><tbody>';
    (d.intercompany_rows || []).forEach(row => {
      html += `<tr><td style="font-weight:600">${esc(row.from)}</td>`;
      (row.amounts || []).forEach(a => {
        const color = a > 100000 ? ';color:var(--red);font-weight:700' : (a > 10000 ? ';color:var(--green)' : '');
        html += `<td style="text-align:right${color}">${a === null ? '\u2014' : _fmTbl(a)}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    if (d.interco_note) html += `<div style="font-size:10px;color:var(--t3);margin-top:6px">${esc(d.interco_note)}</div>`;
    html += '</div>';
  } else if (_loanTab === 'director') {
    html += '<div class="card" style="margin:0 0 10px"><div style="font-size:11px;font-weight:700;margin-bottom:6px">Director Loans Summary</div>';
    html += '<table class="tbl" id="rp_dir_tbl"><thead><tr>' +
      ui.sortTh('rp_dir_tbl','director','Director') +
      ui.sortTh('rp_dir_tbl','entity','Entity') +
      ui.sortTh('rp_dir_tbl','lent','Lent',' style="text-align:right"') +
      ui.sortTh('rp_dir_tbl','repaid','Repaid',' style="text-align:right"') +
      ui.sortTh('rp_dir_tbl','outstanding','Outstanding',' style="text-align:right"') +
      ui.sortTh('rp_dir_tbl','capital','Is Capital?') +
      '</tr></thead><tbody>';
    (d.director_loans || []).forEach(r => {
      html += `<tr><td>${esc(r.director)}</td><td>${esc(r.entity)}</td>
        <td style="text-align:right">${fm(r.lent)}</td><td style="text-align:right">${fm(r.repaid)}</td>
        <td style="text-align:right;font-weight:600">${fm(r.outstanding)}</td><td>${esc(r.is_capital)}</td></tr>`;
    });
    html += '</tbody></table></div>';
  } else {
    html += '<div class="card" style="margin:0 0 10px"><div style="font-size:11px;font-weight:700;margin-bottom:6px">Capital Structure</div>';
    html += '<table class="tbl" id="rp_equity_tbl"><thead><tr>' +
      ui.sortTh('rp_equity_tbl','entity','Entity') +
      ui.sortTh('rp_equity_tbl','share','Share Capital',' style="text-align:right"') +
      ui.sortTh('rp_equity_tbl','loans','Director Loans',' style="text-align:right"') +
      ui.sortTh('rp_equity_tbl','retained','Retained Earnings',' style="text-align:right"') +
      ui.sortTh('rp_equity_tbl','total','Total Equity',' style="text-align:right"') +
      '</tr></thead><tbody>';
    (d.capital_structure || []).forEach(r => {
      html += `<tr><td style="font-weight:600">${esc(r.entity)}</td>
        <td style="text-align:right">${fm(r.share_capital)}</td><td style="text-align:right">${fm(r.director_loans)}</td>
        <td style="text-align:right">${fm(r.retained)}</td><td style="text-align:right;font-weight:700">${fm(r.total_equity)}</td></tr>`;
    });
    html += '</tbody></table></div>';
  }
  el.innerHTML = html;
}

function _loanTabSwitch(tab) { _loanTab = tab; _renderLoanTab(); }


// ══════════════════════════════════════════
// 12. fp-brand: BRAND COMPARISON (Performance)
// ══════════════════════════════════════════

function renderFpBrand() {
  if (!_filters.month) _filters.month = _curMonth();
  const actions = `<select class="fl" id="fp_month" onchange="FinanceSection.onFpBrandFilter()" style="width:110px">${_monthOpts(_filters.month)}</select>`;
  return SPG.shell(SPG.toolbar('Brand Comparison', actions) + `<div class="content" id="fin-fp-brand"><div style="${TW2}">
    <div id="fp_brand_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
  </div></div>`, 'Finance');
}

async function loadFpBrand() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadFpBrand();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function _loadFpBrand() {
  const el = document.getElementById('fp_brand_content');
  if (!el) return;
  try {
    _fpBrandData = await FIN.api('get_brand_comparison', { month: _filters.month });
  } catch (e) {
    console.warn('getBrandComparison failed:', e.message);
    if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--red)">Failed to load brand comparison data. Please try again.</div>';
    return;
  }
  const d = _fpBrandData;
  const brands = d.brands || [];
  const bestRev = brands.reduce((b, c) => (c.revenue || 0) > (b.revenue || 0) ? c : b, { revenue: 0 });
  const bestGP = brands.reduce((b, c) => (c.gp_pct || 0) > (b.gp_pct || 0) ? c : b, { gp_pct: 0 });
  const worstRev = brands.reduce((b, c) => (c.rev_chg || 0) < (b.rev_chg || 0) ? c : b, { rev_chg: 0 });

  let html = `<div class="kpi-grid" style="flex-wrap:nowrap">
    <div class="kpi-card"><div class="kpi-value" style="color:var(--green)">${esc(bestRev.name || '')}</div><div class="kpi-label">Best Revenue ${_fmK(bestRev.revenue)}</div></div>
    <div class="kpi-card"><div class="kpi-value" style="color:var(--green)">${esc(bestGP.name || '')}</div><div class="kpi-label">Best GP ${(bestGP.gp_pct || 0).toFixed(0)}%</div></div>
    <div class="kpi-card"><div class="kpi-value" style="color:var(--orange)">${esc(worstRev.name || '')}</div><div class="kpi-label">Revenue ${(worstRev.rev_chg || 0) >= 0 ? '+' : ''}${(worstRev.rev_chg || 0).toFixed(0)}%</div></div>
  </div>`;

  html += '<table class="tbl"><thead><tr><th></th>';
  brands.forEach(b => { html += `<th style="text-align:right">${esc(b.name)}</th>`; });
  html += '<th style="text-align:right;font-weight:700">Total</th></tr></thead><tbody>';

  const totals = d.totals || {};
  const metrics = [
    { label: 'Revenue', key: 'revenue', fmt: (v) => _fmK(v) },
    { label: 'GP%', key: 'gp_pct', fmt: (v) => (v || 0).toFixed(0) + '%', colorHigh: true },
    { label: 'COL%', key: 'col_pct', fmt: (v) => (v || 0).toFixed(0) + '%', colorOver30: true },
    { label: 'Net Profit', key: 'net', fmt: (v) => (v >= 0 ? '+' : '') + _fmK(v), colorSign: true },
  ];

  metrics.forEach(m => {
    html += `<tr><td style="font-weight:600">${esc(m.label)}</td>`;
    brands.forEach(b => {
      const v = b[m.key] || 0;
      let style = 'text-align:right';
      if (m.colorSign) style += v >= 0 ? ';color:var(--green)' : ';color:var(--red)';
      if (m.colorHigh && v > 70) style += ';color:var(--green)';
      if (m.colorOver30 && v > 30) style += ';color:var(--red)';
      html += `<td style="${style}">${m.fmt(v)}</td>`;
    });
    const tv = totals[m.key] || 0;
    let tStyle = 'text-align:right;font-weight:700';
    if (m.colorSign) tStyle += tv >= 0 ? ';color:var(--green)' : ';color:var(--red)';
    html += `<td style="${tStyle}">${m.fmt(tv)}</td></tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

function _onFpBrandFilter() {
  _filters.month = document.getElementById('fp_month')?.value || _filters.month;
  _fpBrandData = null; _loadFpBrand();
}


// ══════════════════════════════════════════
// 13. fp-budget: BUDGET vs ACTUAL
// ══════════════════════════════════════════

function renderFpBudget() {
  if (!_filters.month) _filters.month = _curMonth();
  const actions = `<select class="fl" id="fp_bud_month" onchange="FinanceSection.onFpBudgetFilter()" style="width:110px">${_monthOpts(_filters.month)}</select>` +
                  `<select class="fl" id="fp_bud_brand" onchange="FinanceSection.onFpBudgetFilter()" style="width:140px">${_brandOpts(_filters.brand)}</select>`;
  return SPG.shell(SPG.toolbar('Budget vs Actual', actions) + `<div class="content" id="fin-fp-budget"><div style="${TW2}">
    <div id="fp_budget_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
  </div></div>`, 'Finance');
}

async function loadFpBudget() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadFpBudget();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function _loadFpBudget() {
  const el = document.getElementById('fp_budget_content');
  if (!el) return;
  try {
    _fpBudgetData = await FIN.api('get_budget_vs_actual', { month: _filters.month, brand: _filters.brand === 'All' ? null : _filters.brand });
  } catch (e) {
    console.warn('getBudgetVsActual failed:', e.message);
    if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--red)">Failed to load budget data. Please try again.</div>';
    return;
  }
  const d = _fpBudgetData;
  const achievement = d.budget_rev ? ((d.actual_rev / d.budget_rev) * 100).toFixed(0) : '0';

  let html = `<div class="kpi-grid" style="flex-wrap:nowrap">
    <div class="kpi-card"><div class="kpi-label">Actual Revenue</div><div class="kpi-value" style="color:var(--green)">${_fmK(d.actual_rev)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Budget Revenue</div><div class="kpi-value" style="color:var(--t3)">${_fmK(d.budget_rev)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Achievement</div><div class="kpi-value" style="color:${Number(achievement) >= 100 ? 'var(--green)' : 'var(--red)'}">${achievement}%</div></div>
  </div>`;
  html += '<table class="tbl" id="rp_budget_tbl"><thead><tr>' +
    ui.sortTh('rp_budget_tbl','cat','Category') +
    ui.sortTh('rp_budget_tbl','budget','Budget',' style="text-align:right"') +
    ui.sortTh('rp_budget_tbl','actual','Actual',' style="text-align:right"') +
    ui.sortTh('rp_budget_tbl','variance','Variance',' style="text-align:right"') +
    ui.sortTh('rp_budget_tbl','pct','%',' style="text-align:right"') +
    '</tr></thead><tbody>';
  (d.rows || []).forEach(r => {
    const variance = (r.actual || 0) - (r.budget || 0);
    const isExpense = r.category !== 'Revenue';
    const isGood = isExpense ? variance <= 0 : variance >= 0;
    const vColor = isGood ? 'var(--green)' : 'var(--red)';
    const pct = r.budget ? ((variance / r.budget) * 100).toFixed(1) : '0';
    html += `<tr><td>${esc(r.category)}</td>
      <td style="text-align:right">${_fmTbl(r.budget)}</td>
      <td style="text-align:right${!isGood ? ';color:var(--red)' : ''}">${_fmTbl(r.actual)}</td>
      <td style="text-align:right;color:${vColor}">${variance >= 0 ? '+' : ''}${_fmTbl(variance)}</td>
      <td style="text-align:right;color:${vColor}">${variance >= 0 ? '+' : ''}${pct}%</td></tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

function _onFpBudgetFilter() {
  _filters.month = document.getElementById('fp_bud_month')?.value || _filters.month;
  _filters.brand = document.getElementById('fp_bud_brand')?.value || 'All';
  _fpBudgetData = null; _loadFpBudget();
}


// ══════════════════════════════════════════
// 14. fp-rev: REVENUE ANALYSIS
// ══════════════════════════════════════════

function renderFpRev() {
  if (!_filters.month) _filters.month = _curMonth();
  const actions = `<select class="fl" id="fp_rev_month" onchange="FinanceSection.onFpRevFilter()" style="width:110px">${_monthOpts(_filters.month)}</select>` +
                  `<select class="fl" id="fp_rev_brand" onchange="FinanceSection.onFpRevFilter()" style="width:140px">${_brandOpts(_filters.brand)}</select>`;
  return SPG.shell(SPG.toolbar('Revenue Analysis', actions) + `<div class="content" id="fin-fp-rev"><div style="${TW2}">
    <div id="fp_rev_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
  </div></div>`, 'Finance');
}

async function loadFpRev() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadFpRev();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function _loadFpRev() {
  const el = document.getElementById('fp_rev_content');
  if (!el) return;
  try {
    _fpRevData = await FIN.api('get_revenue_analysis', { month: _filters.month, brand: _filters.brand === 'All' ? null : _filters.brand });
  } catch (e) {
    console.warn('getRevenueAnalysis failed:', e.message);
    if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--red)">Failed to load revenue analysis data. Please try again.</div>';
    return;
  }
  const d = _fpRevData;
  let html = `<div class="kpi-grid" style="flex-wrap:nowrap">
    <div class="kpi-card"><div class="kpi-label">Total Revenue</div><div class="kpi-value" style="color:var(--green)">${_fmK(d.total)}</div></div>
    <div class="kpi-card"><div class="kpi-label">In-store</div><div class="kpi-value" style="color:var(--blue)">${_fmK(d.instore)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Delivery</div><div class="kpi-value" style="color:var(--orange)">${_fmK(d.delivery)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Other</div><div class="kpi-value" style="color:var(--acc)">${_fmK(d.other)}</div></div>
  </div>`;
  html += '<table class="tbl" id="rp_rev_tbl"><thead><tr>' +
    ui.sortTh('rp_rev_tbl','channel','Channel') +
    ui.sortTh('rp_rev_tbl','this','This Month',' style="text-align:right"') +
    ui.sortTh('rp_rev_tbl','last','Last Month',' style="text-align:right"') +
    ui.sortTh('rp_rev_tbl','change','Change',' style="text-align:right"') +
    ui.sortTh('rp_rev_tbl','pct','% of Total',' style="text-align:right"') +
    '</tr></thead><tbody>';
  (d.rows || []).forEach(r => {
    const chg = r.prev ? (((r.amount - r.prev) / r.prev) * 100) : 0;
    const pctTotal = d.total ? ((r.amount / d.total) * 100).toFixed(1) : '0';
    const chgColor = chg >= 0 ? 'var(--green)' : 'var(--red)';
    html += `<tr><td>${esc(r.channel)}</td>
      <td style="text-align:right">${_fmTbl(r.amount)}</td>
      <td style="text-align:right">${_fmTbl(r.prev)}</td>
      <td style="text-align:right;color:${chgColor}${Math.abs(chg) > 20 ? ';font-weight:700' : ''}">${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%</td>
      <td style="text-align:right">${pctTotal}%</td></tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

function _onFpRevFilter() {
  _filters.month = document.getElementById('fp_rev_month')?.value || _filters.month;
  _filters.brand = document.getElementById('fp_rev_brand')?.value || 'All';
  _fpRevData = null; _loadFpRev();
}


// ══════════════════════════════════════════
// 15. fp-exp: EXPENSE TREND
// ══════════════════════════════════════════

function renderFpExp() {
  if (!_filters.month) _filters.month = _curMonth();
  const actions = `<select class="fl" id="fp_exp_month" onchange="FinanceSection.onFpExpFilter()" style="width:110px">${_monthOpts(_filters.month)}</select>` +
                  `<select class="fl" id="fp_exp_brand" onchange="FinanceSection.onFpExpFilter()" style="width:140px">${_brandOpts(_filters.brand)}</select>`;
  return SPG.shell(SPG.toolbar('Expense Trend', actions) + `<div class="content" id="fin-fp-exp"><div style="${TW2}">
    <div id="fp_exp_content"><div class="empty" style="padding:30px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...</div></div>
  </div></div>`, 'Finance');
}

async function loadFpExp() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadFpExp();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function _loadFpExp() {
  const el = document.getElementById('fp_exp_content');
  if (!el) return;
  try {
    _fpExpData = await FIN.api('get_expense_trend', { month: _filters.month, brand: _filters.brand === 'All' ? null : _filters.brand });
  } catch (e) {
    console.warn('getExpenseTrend failed:', e.message);
    if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--red)">Failed to load expense trend data. Please try again.</div>';
    return;
  }
  const d = _fpExpData;
  const momChg = d.prev_total ? (((d.total - d.prev_total) / d.prev_total) * 100).toFixed(0) : '0';
  const largest = (d.rows || []).reduce((b, c) => (c.amount || 0) > (b.amount || 0) ? c : b, { amount: 0 });

  let html = `<div class="kpi-grid" style="flex-wrap:nowrap">
    <div class="kpi-card"><div class="kpi-label">Total Overheads</div><div class="kpi-value" style="color:var(--red)">${_fmK(d.total)}</div></div>
    <div class="kpi-card"><div class="kpi-label">MoM Change</div><div class="kpi-value" style="color:var(--orange)">${Number(momChg) >= 0 ? '+' : ''}${momChg}%</div></div>
    <div class="kpi-card"><div class="kpi-label">Largest: ${esc(largest.category || '')}</div><div class="kpi-value">${_fmK(largest.amount)}</div></div>
  </div>`;
  html += '<table class="tbl" id="rp_exp_tbl"><thead><tr>' +
    ui.sortTh('rp_exp_tbl','cat','Category') +
    ui.sortTh('rp_exp_tbl','this','This Month',' style="text-align:right"') +
    ui.sortTh('rp_exp_tbl','last','Last Month',' style="text-align:right"') +
    ui.sortTh('rp_exp_tbl','change','Change',' style="text-align:right"') +
    ui.sortTh('rp_exp_tbl','pct','% of Revenue',' style="text-align:right"') +
    '</tr></thead><tbody>';
  (d.rows || []).forEach(r => {
    const chg = r.prev ? (((r.amount - r.prev) / r.prev) * 100) : 0;
    const revPct = d.revenue ? ((r.amount / d.revenue) * 100).toFixed(1) : '0';
    const chgColor = Math.abs(chg) > 5 ? (chg > 0 ? 'var(--red)' : 'var(--green)') : '';
    html += `<tr><td>${esc(r.category)}</td>
      <td style="text-align:right">${_fmTbl(r.amount)}</td>
      <td style="text-align:right">${_fmTbl(r.prev)}</td>
      <td style="text-align:right${chgColor ? ';color:' + chgColor : ''}">${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%</td>
      <td style="text-align:right${Number(revPct) > 30 ? ';color:var(--red)' : ''}">${revPct}%</td></tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = html;
}

function _onFpExpFilter() {
  _filters.month = document.getElementById('fp_exp_month')?.value || _filters.month;
  _filters.brand = document.getElementById('fp_exp_brand')?.value || 'All';
  _fpExpData = null; _loadFpExp();
}


// ══════════════════════════════════════════
// 16. dashboard: CFO BRIEF
// ══════════════════════════════════════════

function renderDashboard() {
  if (!_filters.month) _filters.month = _curMonth();
  const actions = `<select class="fl" id="dash_month" onchange="FinanceSection.onDashFilter()" style="width:110px">${_monthOpts(_filters.month)}</select>` +
                  `<select class="fl" id="dash_brand" onchange="FinanceSection.onDashFilter()" style="width:140px">${_brandOpts(_filters.brand)}</select>`;
  return SPG.shell(SPG.toolbar('Financial Dashboard', actions) + `<div class="content" id="fin-dashboard"><div style="${TW3}">
    <div id="dash_content"><div class="empty" style="padding:40px"><div class="fin-spinner" style="margin:0 auto 8px"></div>Loading CFO Brief...</div></div>
  </div></div>`, 'Finance');
}

async function loadDashboard() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    await _loadDashboard();
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function _loadDashboard() {
  const el = document.getElementById('dash_content');
  if (!el) return;

  try {
    _dashData = await FIN.api('get_cfo_dashboard', {
      month: _filters.month,
      brand: _filters.brand === 'All' ? null : _filters.brand,
    });
  } catch (e) {
    console.warn('getCfoDashboard failed:', e.message);
    if (el) el.innerHTML = '<div class="empty" style="padding:40px;color:var(--red)">Failed to load dashboard data. Please try again.</div>';
    return;
  }

  const d = _dashData;
  let h = '';

  // Brand Scoreboard
  h += '<div style="display:flex;gap:8px;margin-bottom:14px">';
  (d.brands || []).forEach(b => {
    const dotColor = b.net >= 0 ? 'var(--green)' : 'var(--red)';
    const borderColor = b.net >= 0 ? 'var(--green)' : (b.rev_chg < -5 ? 'var(--red)' : 'var(--orange)');
    h += `<div class="card" style="flex:1;margin:0;border-top:3px solid ${borderColor};padding:10px 12px;cursor:pointer" onclick="SPG.go('finance/tx-log')">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:11px;font-weight:700">${esc(b.name)}</span><span style="width:8px;height:8px;border-radius:50%;background:${dotColor}"></span></div>
      <div style="font-size:16px;font-weight:800">${_fmK(b.revenue)}</div>
      <div style="font-size:9px;color:var(--t3)">Revenue \u00b7 ${b.rev_chg >= 0 ? '\u25b2' : '\u25bc'} ${Math.abs(b.rev_chg || 0).toFixed(1)}%</div>
      <div style="font-size:11px;font-weight:600;color:${b.net >= 0 ? 'var(--green)' : 'var(--red)'};margin-top:4px">Net ${b.net >= 0 ? '+' : ''}${fm(b.net, 0)} (${(b.net_pct || 0).toFixed(1)}%)</div>
    </div>`;
  });
  h += '</div>';

  // Mini Indicator Badges
  h += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;flex-wrap:wrap">';
  (d.indicators || []).forEach(ind => {
    const color = ind.color || 'var(--t3)';
    const bg = ind.bg || 'transparent';
    h += `<div style="display:flex;align-items:center;gap:5px;padding:5px 12px;border-radius:20px;font-size:10px;font-weight:500;border:1px solid ${color};background:${bg}"><span style="width:6px;height:6px;border-radius:50%;background:${color}"></span><span style="color:${color}">${esc(ind.label)}</span></div>`;
  });
  h += '</div>';

  // Grid Row 1: Cash / P&L / AP
  h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">';

  const cp = d.cash_position || {};
  const cpTotal = cp.total || 0;
  const pnlRev = (d.pnl_snapshot || {}).revenue || 0;
  const cashWarning = (cpTotal === 0 && pnlRev > 0) ? '<div style="font-size:var(--fs-xxs);color:var(--orange);margin-top:4px">\u26a0\ufe0f Cash position may not reflect all transactions. <a class="lk" style="font-size:var(--fs-xxs)" onclick="SPG.go(\'finance/rc-bank\')">Reconcile \u2192</a></div>' : '';
  h += `<div class="card" style="margin:0"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:11px;font-weight:700">Cash Position</span><a class="lk" onclick="SPG.go('finance/rc-bank')">Bank Reconcile \u2192</a></div>
    <div style="font-size:24px;font-weight:800;margin-bottom:6px">${fm(cpTotal, 0)}</div>
    <div style="font-size:10px;color:var(--t2)">${esc(cp.breakdown || '')}</div>${cashWarning}</div>`;

  const pnl = d.pnl_snapshot || {};
  h += `<div class="card" style="margin:0"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:11px;font-weight:700">P&L Snapshot</span><a class="lk" onclick="SPG.go('finance/rp-pnl')">Full P&L \u2192</a></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">
      <div><div style="color:var(--t3);font-size:9px">Revenue</div><div style="font-weight:600">${_fmK(pnl.revenue)} ${pnl.rev_chg ? '<span style="color:var(--green);font-size:9px">\u25b2' + pnl.rev_chg + '%</span>' : ''}</div></div>
      <div><div style="color:var(--t3);font-size:9px">GP%</div><div style="font-weight:600;color:var(--green)">${(pnl.gp_pct || 0).toFixed(1)}%</div></div>
      <div><div style="color:var(--t3);font-size:9px">EBITDA</div><div style="font-weight:600">${_fmK(pnl.ebitda)}</div></div>
      <div><div style="color:var(--t3);font-size:9px">Net Profit</div><div style="font-weight:600;color:${(pnl.net || 0) >= 0 ? 'var(--green)' : 'var(--red)'}">${fm(pnl.net || 0, 0)}</div></div>
    </div></div>`;

  const ap = d.ap || {};
  h += `<div class="card" style="margin:0"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:11px;font-weight:700">Accounts Payable</span><a class="lk" onclick="SPG.go('finance/rp-apar')">AP/AR \u2192</a></div>
    <div style="display:flex;gap:8px;margin-bottom:6px"><div><div style="font-size:16px;font-weight:700;color:var(--red)">${fm(ap.total || 0, 0)}</div><div style="font-size:9px;color:var(--t3)">total payable</div></div>
    <div><div style="font-size:16px;font-weight:700;color:var(--red)">${fm(ap.overdue || 0, 0)}</div><div style="font-size:9px;color:var(--t3)">overdue</div></div></div>
    ${ap.note ? '<div style="font-size:10px;color:var(--red)">' + esc(ap.note) + '</div>' : ''}</div>`;

  h += '</div>';

  // Grid Row 2: Recon / Loans / Tax
  h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px">';

  const rc = d.reconciliation || {};
  h += `<div class="card" style="margin:0"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:11px;font-weight:700">Reconciliation</span><a class="lk" onclick="SPG.go('finance/rc-bank')">Reconcile \u2192</a></div>
    <div style="display:flex;gap:8px;margin-bottom:6px"><div><div style="font-size:16px;font-weight:700;color:var(--green)">${esc(rc.days_done || '0/0')}</div><div style="font-size:9px;color:var(--t3)">days done</div></div>
    <div><div style="font-size:16px;font-weight:700;color:var(--orange)">${fm(rc.unmatched || 0, 0)}</div><div style="font-size:9px;color:var(--t3)">unmatched</div></div></div>
    ${rc.note ? '<div style="font-size:10px;color:var(--orange)">' + esc(rc.note) + '</div>' : ''}</div>`;

  const ln = d.loans || {};
  h += `<div class="card" style="margin:0"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:11px;font-weight:700">Loans & Intercompany</span><a class="lk" onclick="SPG.go('finance/ac-loan')">Loans \u2192</a></div>
    <div style="font-size:11px;line-height:1.8">
      <div style="display:flex;justify-content:space-between"><span>Loans outstanding</span><span style="font-weight:600;color:var(--red)">${_fmK(ln.outstanding)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Intercompany owing</span><span style="font-weight:600;color:var(--orange)">${_fmK(ln.interco)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Next repayment</span><span style="font-weight:600">${esc(ln.next_repayment || 'N/A')}</span></div>
    </div></div>`;

  const tx = d.tax || {};
  h += `<div class="card" style="margin:0"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span style="font-size:11px;font-weight:700">Tax & Obligations</span><a class="lk" onclick="SPG.go('finance/pr-super')">Obligations \u2192</a></div>
    <div style="font-size:11px;line-height:1.8">
      <div style="display:flex;justify-content:space-between"><span>GST refund</span><span style="font-weight:600;color:var(--green)">${fm(tx.gst || 0, 0)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Super payable</span><span style="font-weight:600">${fm(tx.super || 0, 0)}</span></div>
      <div style="display:flex;justify-content:space-between"><span>PAYG</span><span style="font-weight:600">${fm(tx.payg || 0, 0)}</span></div>
    </div></div>`;

  h += '</div>';

  // Action Items
  const actions = d.actions || [];
  if (actions.length > 0) {
    h += `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><span style="font-size:11px;font-weight:700">Action Items</span><span style="font-size:10px;color:var(--t3)">${actions.length} items</span></div>`;
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">';
    actions.forEach(a => {
      const bgMap = { High: 'var(--red-bg)', Med: 'var(--orange-bg)', Low: 'var(--bg3)' };
      const colorMap = { High: 'var(--red)', Med: 'var(--orange)', Low: 'var(--t3)' };
      h += `<div style="padding:5px 10px;border-radius:var(--rd);font-size:11px;display:flex;align-items:center;gap:6px;background:${bgMap[a.priority] || 'var(--bg3)'}">
        <span style="color:${colorMap[a.priority] || 'var(--t3)'};font-weight:600;min-width:36px">${esc(a.priority)}</span> ${esc(a.text)}</div>`;
    });
    h += '</div></div>';
  }

  el.innerHTML = h;
}

function _onDashFilter() {
  _filters.month = document.getElementById('dash_month')?.value || _filters.month;
  _filters.brand = document.getElementById('dash_brand')?.value || 'All';
  _dashData = null;
  _loadDashboard();
}


// ══════════════════════════════════════════
// REGISTER on FIN + FinanceSection
// ══════════════════════════════════════════

FIN.renderDashboard = renderDashboard;   FIN.loadDashboard = loadDashboard;
FIN.renderRpPnl = renderRpPnl;           FIN.loadRpPnl = loadRpPnl;
FIN.renderRpPnlBrand = renderRpPnlBrand; FIN.loadRpPnlBrand = loadRpPnlBrand;
FIN.renderRpPnlFlow = renderRpPnlFlow;   FIN.loadRpPnlFlow = loadRpPnlFlow;
FIN.renderRpPnlFull = renderRpPnlFull;   FIN.loadRpPnlFull = loadRpPnlFull;
FIN.renderRpBs = renderRpBs;             FIN.loadRpBs = loadRpBs;
FIN.renderRpCf = renderRpCf;             FIN.loadRpCf = loadRpCf;
FIN.renderRpApar = renderRpApar;         FIN.loadRpApar = loadRpApar;
FIN.renderRpAsset = renderRpAsset;       FIN.loadRpAsset = loadRpAsset;
FIN.renderRpBank = renderRpBank;         FIN.loadRpBank = loadRpBank;
FIN.renderRpCash = renderRpCash;         FIN.loadRpCash = loadRpCash;
FIN.renderRpLoan = renderRpLoan;         FIN.loadRpLoan = loadRpLoan;
FIN.renderFpBrand = renderFpBrand;       FIN.loadFpBrand = loadFpBrand;
FIN.renderFpBudget = renderFpBudget;     FIN.loadFpBudget = loadFpBudget;
FIN.renderFpRev = renderFpRev;           FIN.loadFpRev = loadFpRev;
FIN.renderFpExp = renderFpExp;           FIN.loadFpExp = loadFpExp;

Object.assign(window.FinanceSection, {
  // Filter handlers (called from onclick)
  onFilter: _onFilter,
  onBrandFilter: _onBrandFilter,
  onFlowFilter: _onFlowFilter,
  applyPnlFull: _loadPnlFull,
  onBsFilter: _onBsFilter,
  onCfFilter: _onCfFilter,
  aparTab: _aparTabSwitch,
  onAparFilter: _onAparFilter,
  addAsset: _addAsset,
  onBankFilter: _onBankFilter,
  onCashFilter: _onCashFilter,
  loanTab: _loanTabSwitch,
  onFpBrandFilter: _onFpBrandFilter,
  onFpBudgetFilter: _onFpBudgetFilter,
  onFpRevFilter: _onFpRevFilter,
  onFpExpFilter: _onFpExpFilter,
  onDashFilter: _onDashFilter,
  exportPdf: _exportPdf,
  exportCsv: _exportCsv,
});

})();
