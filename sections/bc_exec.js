/**
 * SPG HUB v1.0.0 | 22 MAR 2026 | Siam Palette Group
 * sections/bc_exec.js — Executive Dashboard (6 pages, wireframe v5)
 * Command Centre, Product Efficiency, Store Performance,
 * Demand & Quota, Waste Intelligence, Quality & Returns
 *
 * Depends on: bc_core.js (BK global)
 * Design: Pink #db2777 accent, matches Home layout via SPG.shell/toolbar
 *
 * NOTE: Uses MOCK DATA for display where real exec endpoints don't exist yet.
 *       Replace with actual API calls when backend is ready.
 */

(() => {
const esc = SPG.esc;
const S = BK.S;

// ═══════════════════════════════════════
// SHARED EXEC STATE & HELPERS
// ═══════════════════════════════════════
if (!S.execPreset) S.execPreset = 'this_week';
if (!S.execCatFilter) S.execCatFilter = 'all';

/** Cross-module badge */
function cmBadge(mod, color) {
  color = color || '#db2777';
  const bg = mod === 'BC' ? '#fce7f3' : mod === 'Sales' ? '#dbeafe' : mod === 'HR' ? '#fef3c7' : '#f3e8ff';
  const fg = mod === 'BC' ? '#db2777' : mod === 'Sales' ? '#2563eb' : mod === 'HR' ? '#d97706' : '#7c3aed';
  return `<span style="font-size:9px;padding:1px 6px;border-radius:4px;background:${bg};color:${fg};font-weight:600">${esc(mod)}</span>`;
}

/** Grade badge */
function gradeBadge(grade) {
  const colors = { A: '#16a34a', B: '#ea580c', C: '#ea580c', D: '#dc2626', F: '#dc2626' };
  const bgs = { A: '#dcfce7', B: '#fff7ed', C: '#fff7ed', D: '#fef2f2', F: '#fef2f2' };
  return `<span style="font-size:10px;padding:2px 8px;border-radius:4px;background:${bgs[grade] || '#f3f4f6'};color:${colors[grade] || '#6b7280'};font-weight:700">${esc(grade)}</span>`;
}

/** Assessment badge */
function assessBadge(level) {
  const map = {
    'Good': { bg: '#dcfce7', fg: '#16a34a' },
    'Watch': { bg: '#fff7ed', fg: '#ea580c' },
    'Alert': { bg: '#fef2f2', fg: '#dc2626' },
    'Critical': { bg: '#fef2f2', fg: '#dc2626' },
  };
  const c = map[level] || { bg: '#f3f4f6', fg: '#6b7280' };
  return `<span style="font-size:10px;padding:2px 8px;border-radius:4px;background:${c.bg};color:${c.fg};font-weight:600">${esc(level)}</span>`;
}

/** Issue badge */
function issueBadge(issue) {
  const map = {
    'Damaged': { bg: '#fef2f2', fg: '#dc2626' },
    'Wrong Item': { bg: '#fff7ed', fg: '#ea580c' },
    'Expired': { bg: '#fef3c7', fg: '#d97706' },
    'Quality': { bg: '#fce7f3', fg: '#db2777' },
    'Short Count': { bg: '#dbeafe', fg: '#2563eb' },
  };
  const c = map[issue] || { bg: '#f3f4f6', fg: '#6b7280' };
  return `<span style="font-size:10px;padding:2px 8px;border-radius:4px;background:${c.bg};color:${c.fg};font-weight:600">${esc(issue)}</span>`;
}

/** Resolution badge */
function resBadge(res) {
  const map = {
    'Reworked': { bg: '#dcfce7', fg: '#16a34a' },
    'Wasted': { bg: '#fef2f2', fg: '#dc2626' },
    'Credited': { bg: '#dbeafe', fg: '#2563eb' },
    'Pending': { bg: '#f3f4f6', fg: '#6b7280' },
  };
  const c = map[res] || { bg: '#f3f4f6', fg: '#6b7280' };
  return `<span style="font-size:10px;padding:2px 8px;border-radius:4px;background:${c.bg};color:${c.fg};font-weight:600">${esc(res)}</span>`;
}

/** Metric card HTML */
function metricCard(label, value, sub, modules) {
  const modHtml = (modules || []).map(m => cmBadge(m)).join(' ');
  return `<div class="card" style="padding:14px;text-align:center">
    <div style="font-size:10px;color:var(--t3);margin-bottom:4px">${esc(label)} ${modHtml}</div>
    <div style="font-size:22px;font-weight:900;color:var(--theme, #db2777)">${value}</div>
    ${sub ? `<div style="font-size:10px;color:var(--t3);margin-top:2px">${sub}</div>` : ''}
  </div>`;
}

/** AI insight card wrapper */
function aiCard(title, content) {
  return `<div class="card" style="padding:0;overflow:hidden;border:1px solid rgba(219,39,119,.2)">
    <div style="background:linear-gradient(135deg,#fce7f3,#fdf2f8);padding:12px 14px;border-bottom:1px solid rgba(219,39,119,.1)">
      <div style="font-size:12px;font-weight:700;color:var(--theme, #db2777)">AI ${esc(title)}</div>
    </div>
    <div style="padding:14px">${content}</div>
  </div>`;
}

/** Single insight line */
function insightLine(icon, text) {
  return `<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:10px;font-size:12px;line-height:1.5">
    <span style="flex-shrink:0">${icon}</span>
    <span>${text}</span>
  </div>`;
}

/** Section title */
function secTitle(t) { return `<div class="sec-title">${esc(t)}</div>`; }

/** Heatmap cell color */
function heatColor(pct) {
  if (pct >= 70) return { bg: '#dcfce7', fg: '#16a34a' };
  if (pct >= 40) return { bg: '#fff7ed', fg: '#ea580c' };
  return { bg: '#fef2f2', fg: '#dc2626' };
}


// ═══════════════════════════════════════
// MOCK DATA — replace with real API when available
// ═══════════════════════════════════════
function getMockCommandData() {
  return {
    kpis: {
      orders: 142, fulfilment: 94.2, wasteRate: 3.8,
      sellThrough: 87.5, quotaUtil: 72.1, wasteCost: 1284,
    },
    insights: [
      { icon: '\u{1F6A8}', text: 'Croissant waste spiked 12% at Newtown store — check evening shelf life' },
      { icon: '\u{1F4CA}', text: 'Friday orders consistently 22% higher — consider pre-building Thursday PM' },
      { icon: '\u{1F464}', text: 'Staff member K. Patel logs 40% less waste than team avg — share best practice' },
      { icon: '\u2705', text: 'Overall fulfilment rate improved 2.1% vs last period' },
    ],
    storeScores: [
      { store: 'CBD Martin Place', fulfilPct: 96.5, wastePct: 2.1, score: 94, grade: 'A' },
      { store: 'Newtown', fulfilPct: 91.3, wastePct: 5.8, score: 78, grade: 'B' },
      { store: 'Parramatta', fulfilPct: 88.7, wastePct: 4.2, score: 82, grade: 'B' },
      { store: 'Bondi Junction', fulfilPct: 93.1, wastePct: 3.5, score: 86, grade: 'A' },
      { store: 'Chatswood', fulfilPct: 85.2, wastePct: 7.1, score: 68, grade: 'C' },
    ],
    problemProducts: [
      { name: 'Croissant Plain', wasteRate: 8.2, bc: 3.1, store: 5.1 },
      { name: 'Sourdough Loaf', wasteRate: 6.7, bc: 1.2, store: 5.5 },
      { name: 'Banana Bread', wasteRate: 5.9, bc: 2.8, store: 3.1 },
    ],
  };
}

function getMockProductData() {
  return {
    products: [
      { name: 'Croissant Plain', cat: 'Pastry', ordered: 320, fulfilled: 305, wasted: 26, efficiency: 91.9, sold: 279, revenue: 1395, cost: 640, wasteAmt: 130, netProfit: 625 },
      { name: 'Sourdough Loaf', cat: 'Bread', ordered: 180, fulfilled: 170, wasted: 12, efficiency: 93.3, sold: 158, revenue: 1264, cost: 540, wasteAmt: 96, netProfit: 628 },
      { name: 'Banana Bread', cat: 'Cake', ordered: 95, fulfilled: 90, wasted: 6, efficiency: 93.7, sold: 84, revenue: 588, cost: 285, wasteAmt: 42, netProfit: 261 },
      { name: 'Multigrain Roll', cat: 'Bread', ordered: 240, fulfilled: 232, wasted: 8, efficiency: 96.7, sold: 224, revenue: 896, cost: 480, wasteAmt: 32, netProfit: 384 },
      { name: 'Chocolate Muffin', cat: 'Pastry', ordered: 150, fulfilled: 142, wasted: 10, efficiency: 93.3, sold: 132, revenue: 660, cost: 300, wasteAmt: 50, netProfit: 310 },
    ],
    shelfLife: [
      { name: 'Croissant Plain', hours: 8 },
      { name: 'Sourdough Loaf', hours: 48 },
      { name: 'Banana Bread', hours: 24 },
    ],
    weather: {
      sunny: { sellThrough: 92, topProduct: 'Iced Coffee Bun' },
      rainy: { sellThrough: 78, topProduct: 'Sourdough Loaf' },
    },
    categories: ['All', 'Bread', 'Pastry', 'Cake'],
  };
}

function getMockStoreData() {
  return {
    stores: [
      { name: 'CBD Martin Place', fulfilled: 96.5, wasted: 2.1, returned: 1.4, score: 94, grade: 'A' },
      { name: 'Newtown', fulfilled: 91.3, wasted: 5.8, returned: 2.9, score: 78, grade: 'B' },
      { name: 'Parramatta', fulfilled: 88.7, wasted: 4.2, returned: 2.1, score: 82, grade: 'B' },
      { name: 'Bondi Junction', fulfilled: 93.1, wasted: 3.5, returned: 1.8, score: 86, grade: 'A' },
      { name: 'Chatswood', fulfilled: 85.2, wasted: 7.1, returned: 3.3, score: 68, grade: 'C' },
    ],
    deepDive: {
      store: 'Chatswood',
      bcWaste: 4.2, salesSellThrough: 81, hrShiftCoverage: 72, weatherImpact: -8,
    },
    shiftWaste: [
      { shift: 'Morning (6-14)', waste: 2.1, note: '' },
      { shift: 'Afternoon (14-22)', waste: 5.4, note: 'Peak waste window' },
      { shift: 'Night (22-6)', waste: 1.8, note: '' },
    ],
    aiNote: 'Afternoon shift at Chatswood accounts for 62% of total waste. Consider reducing late-day production by 15%.',
  };
}

function getMockDemandData() {
  const products = ['Croissant Plain', 'Sourdough Loaf', 'Banana Bread', 'Multigrain Roll', 'Choc Muffin'];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const heatmap = products.map(p => ({
    name: p,
    days: days.map(() => Math.floor(Math.random() * 60) + 30),
  }));
  return {
    heatmap,
    days,
    suggestions: [
      { product: 'Croissant Plain', current: 50, suggested: 42, dayAdj: 'Reduce Sun by 30%', weather: 'Auto-reduce 10% on rainy days' },
      { product: 'Banana Bread', current: 20, suggested: 16, dayAdj: 'Reduce Mon-Tue by 20%', weather: 'No adjustment' },
      { product: 'Sourdough Loaf', current: 30, suggested: 34, dayAdj: 'Increase Fri-Sat by 15%', weather: 'Auto-reduce 5% on hot days' },
    ],
  };
}

function getMockWasteData() {
  return {
    sources: [
      { name: 'Store Expired', pct: 42, cost: 540 },
      { name: 'Damaged', pct: 18, cost: 231 },
      { name: 'BC Prod Error', pct: 25, cost: 321 },
      { name: 'Return \u2192 Waste', pct: 15, cost: 192 },
    ],
    totalCost: 1284,
    staff: [
      { name: 'K. Patel', role: 'Baker', shifts: 12, wasteLogs: 3, wastePerShift: 0.25, overOrders: 0, assessment: 'Good' },
      { name: 'J. Smith', role: 'Store Staff', shifts: 10, wasteLogs: 8, wastePerShift: 0.80, overOrders: 4, assessment: 'Watch' },
      { name: 'A. Chen', role: 'Baker', shifts: 14, wasteLogs: 12, wastePerShift: 0.86, overOrders: 6, assessment: 'Alert' },
      { name: 'M. Lee', role: 'Store Staff', shifts: 8, wasteLogs: 2, wastePerShift: 0.25, overOrders: 1, assessment: 'Good' },
    ],
  };
}

function getMockQualityData() {
  return {
    kpis: { returns: 23, returnRate: 2.8, reworked: 61, wasted: 39 },
    returns: [
      { returnId: 'RT-001', orderId: 'BC-20260318-001', product: 'Croissant Plain', store: 'Newtown', issue: 'Damaged', staff: 'J. Smith', resolution: 'Wasted' },
      { returnId: 'RT-002', orderId: 'BC-20260319-003', product: 'Sourdough Loaf', store: 'CBD', issue: 'Wrong Item', staff: 'K. Patel', resolution: 'Reworked' },
      { returnId: 'RT-003', orderId: 'BC-20260319-007', product: 'Banana Bread', store: 'Parramatta', issue: 'Expired', staff: 'A. Chen', resolution: 'Wasted' },
      { returnId: 'RT-004', orderId: 'BC-20260320-002', product: 'Multigrain Roll', store: 'Bondi Junction', issue: 'Short Count', staff: 'M. Lee', resolution: 'Credited' },
      { returnId: 'RT-005', orderId: 'BC-20260321-005', product: 'Choc Muffin', store: 'Chatswood', issue: 'Quality', staff: 'J. Smith', resolution: 'Reworked' },
    ],
    aiInsight: 'Newtown and Chatswood account for 58% of returns. "Damaged" issues correlate with afternoon delivery window. Consider switching to morning-only delivery for fragile items.',
  };
}


// ═══════════════════════════════════════
// 1. COMMAND CENTRE
// ═══════════════════════════════════════
BK.renderExecCommand = function(p) {
  return SPG.shell(SPG.toolbar('Command Centre') + `
    <div class="content">
      <div id="exec-cmd-filters" style="margin-bottom:16px">
        ${BK.dateFilterChips(S.execPreset, 'BakerySection.setExecPreset')}
      </div>

      <div id="exec-cmd-kpis" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px">
        ${SPG.ui.skeleton(60, 6)}
      </div>

      <div id="exec-cmd-insights" style="margin-bottom:20px"></div>

      ${secTitle('Store Scorecard')}
      <div id="exec-cmd-stores" style="margin-bottom:20px">${SPG.ui.skeleton(40, 5)}</div>

      ${secTitle('Problem Products')}
      <div id="exec-cmd-problems" style="display:grid;grid-template-columns:1fr;gap:8px"></div>
    </div>`, 'Bakery');
};

BK.loadExecCommand = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  // TODO: Replace with real API call — e.g. api('get_exec_command', { preset: S.execPreset })
  const data = getMockCommandData();
  S.execDash = data;

  _fillExecCommand(data);
};

function _fillExecCommand(data) {
  const k = data.kpis;

  // KPI cards
  const kpiEl = document.getElementById('exec-cmd-kpis');
  if (kpiEl) {
    kpiEl.innerHTML =
      metricCard('Orders', k.orders, 'total', ['BC']) +
      metricCard('Fulfilment', k.fulfilment + '%', 'of orders', ['BC']) +
      metricCard('Waste Rate', k.wasteRate + '%', 'by volume', ['BC']) +
      metricCard('Sell-through', k.sellThrough + '%', 'sold vs delivered', ['Sales']) +
      metricCard('Quota Util', k.quotaUtil + '%', 'used vs set', ['BC']) +
      metricCard('Waste Cost', '$' + k.wasteCost.toLocaleString(), 'period total', ['BC', 'Sales']);
  }

  // AI Insights
  const insEl = document.getElementById('exec-cmd-insights');
  if (insEl) {
    const lines = data.insights.map(i => insightLine(i.icon, i.text)).join('');
    insEl.innerHTML = aiCard('Smart Insights', `
      ${lines}
      <div style="margin-top:12px;position:relative">
        <input type="text" class="inp" placeholder="Ask AI about your bakery data..." style="font-size:12px;padding-right:36px" disabled>
        <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:14px;color:var(--t3)">&#x2728;</span>
      </div>
    `);
  }

  // Store Scorecard
  const stEl = document.getElementById('exec-cmd-stores');
  if (stEl) {
    stEl.innerHTML = `<div class="card" style="overflow-x:auto;padding:0">
      <table id="exec-cmd-score-tbl" style="width:100%;font-size:11px;border-collapse:collapse">
        <thead><tr style="background:var(--bg2)">
          ${SPG.ui.sortTh('exec-cmd-score-tbl','store','Store')}
          ${SPG.ui.sortTh('exec-cmd-score-tbl','fulfilPct','Fulfil%',' style="text-align:right"')}
          ${SPG.ui.sortTh('exec-cmd-score-tbl','wastePct','Waste%',' style="text-align:right"')}
          ${SPG.ui.sortTh('exec-cmd-score-tbl','score','Score',' style="text-align:right"')}
          <th style="padding:8px 10px;text-align:center;font-weight:600">Grade</th>
        </tr></thead>
        <tbody>${data.storeScores.map(s => `<tr style="border-top:1px solid var(--border)">
          <td style="padding:8px 10px;font-weight:500">${esc(s.store)}</td>
          <td style="padding:8px 6px;text-align:right">${s.fulfilPct}%</td>
          <td style="padding:8px 6px;text-align:right;color:${s.wastePct > 5 ? '#dc2626' : 'inherit'}">${s.wastePct}%</td>
          <td style="padding:8px 6px;text-align:right;font-weight:700">${s.score}</td>
          <td style="padding:8px 10px;text-align:center">${gradeBadge(s.grade)}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  }

  // Problem Products
  const ppEl = document.getElementById('exec-cmd-problems');
  if (ppEl) {
    ppEl.innerHTML = data.problemProducts.map(pr => `
      <div class="card" style="padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:13px;font-weight:700">${esc(pr.name)}</div>
          <div style="font-size:18px;font-weight:900;color:#dc2626">${pr.wasteRate}%</div>
        </div>
        <div style="font-size:10px;color:var(--t3)">waste rate</div>
        <div style="display:flex;gap:8px;margin-top:8px;font-size:10px">
          <div>${cmBadge('BC')} ${pr.bc}%</div>
          <div>${cmBadge('Sales')} ${pr.store}%</div>
        </div>
      </div>`).join('');
  }
}


// ═══════════════════════════════════════
// 2. PRODUCT EFFICIENCY
// ═══════════════════════════════════════
BK.renderExecProduct = function(p) {
  return SPG.shell(SPG.toolbar('Product Efficiency') + `
    <div class="content">
      <div style="margin-bottom:12px">
        ${BK.dateFilterChips(S.execPreset, 'BakerySection.setExecPreset')}
      </div>
      <div id="exec-prod-cats" style="margin-bottom:16px"></div>

      ${secTitle('Product Efficiency')}
      <div id="exec-prod-flow" style="margin-bottom:20px">${SPG.ui.skeleton(50, 4)}</div>

      ${secTitle('Revenue & Profit')}
      <div id="exec-prod-revenue" style="margin-bottom:20px">${SPG.ui.skeleton(40, 4)}</div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div>
          ${secTitle('Shelf Life')}
          <div id="exec-prod-shelf"></div>
        </div>
        <div>
          ${secTitle('Weather Impact')}
          <div id="exec-prod-weather"></div>
        </div>
      </div>
    </div>`, 'Bakery');
};

BK.loadExecProduct = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  // TODO: Replace with real API call — e.g. api('get_exec_product', { preset: S.execPreset })
  const data = getMockProductData();
  _fillExecProduct(data);
};

function _fillExecProduct(data) {
  // Category filter chips
  const catEl = document.getElementById('exec-prod-cats');
  if (catEl) {
    catEl.innerHTML = `<div class="fl-bar" style="gap:6px;flex-wrap:wrap">${data.categories.map(c =>
      `<button class="btn btn-sm${(S.execCatFilter === c.toLowerCase() || (c === 'All' && S.execCatFilter === 'all')) ? ' btn-primary' : ' btn-outline'}"
        onclick="BakerySection.setExecCat('${esc(c.toLowerCase())}')" style="font-size:11px;padding:5px 12px">${esc(c)}</button>`
    ).join('')}</div>`;
  }

  // Filter products by category
  let prods = data.products;
  if (S.execCatFilter && S.execCatFilter !== 'all') {
    prods = prods.filter(pr => pr.cat.toLowerCase() === S.execCatFilter);
  }

  // Product Efficiency flow
  const flowEl = document.getElementById('exec-prod-flow');
  if (flowEl) {
    flowEl.innerHTML = prods.map(pr => `
      <div class="card" style="padding:12px;margin-bottom:6px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap">
          <div style="font-size:12px;font-weight:600;min-width:120px">${esc(pr.name)}</div>
          <div style="display:flex;gap:12px;font-size:11px;color:var(--t3)">
            <span>Ordered <b style="color:var(--t1)">${pr.ordered}</b></span>
            <span>\u2192</span>
            <span>Fulfilled <b style="color:#16a34a">${pr.fulfilled}</b></span>
            <span>\u2192</span>
            <span>Wasted <b style="color:#dc2626">${pr.wasted}</b></span>
          </div>
          <div style="font-size:14px;font-weight:900;color:var(--theme, #db2777)">${pr.efficiency}%</div>
        </div>
      </div>`).join('');
  }

  // Revenue & Profit table
  const revEl = document.getElementById('exec-prod-revenue');
  if (revEl) {
    revEl.innerHTML = `<div class="card" style="overflow-x:auto;padding:0">
      <table style="width:100%;font-size:11px;border-collapse:collapse;white-space:nowrap">
        <thead><tr style="background:var(--bg2)">
          <th style="padding:8px 10px;text-align:left;font-weight:600">Product</th>
          <th style="padding:8px 6px;text-align:right;font-weight:600">Ordered</th>
          <th style="padding:8px 6px;text-align:right;font-weight:600">Sold</th>
          <th style="padding:8px 6px;text-align:right;font-weight:600">Sell%</th>
          <th style="padding:8px 6px;text-align:right;font-weight:600">Revenue</th>
          <th style="padding:8px 6px;text-align:right;font-weight:600">Cost</th>
          <th style="padding:8px 6px;text-align:right;font-weight:600">Waste$</th>
          <th style="padding:8px 10px;text-align:right;font-weight:600">Net Profit</th>
        </tr></thead>
        <tbody>${prods.map(pr => {
          const st = pr.ordered > 0 ? Math.round(pr.sold / pr.ordered * 100) : 0;
          return `<tr style="border-top:1px solid var(--border)">
            <td style="padding:8px 10px;font-weight:500">${esc(pr.name)}</td>
            <td style="padding:8px 6px;text-align:right">${pr.ordered}</td>
            <td style="padding:8px 6px;text-align:right">${pr.sold}</td>
            <td style="padding:8px 6px;text-align:right">${st}%</td>
            <td style="padding:8px 6px;text-align:right;color:#16a34a">$${pr.revenue}</td>
            <td style="padding:8px 6px;text-align:right">$${pr.cost}</td>
            <td style="padding:8px 6px;text-align:right;color:#dc2626">$${pr.wasteAmt}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:700;color:${pr.netProfit >= 0 ? '#16a34a' : '#dc2626'}">$${pr.netProfit}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;
  }

  // Shelf Life bars
  const shelfEl = document.getElementById('exec-prod-shelf');
  if (shelfEl) {
    shelfEl.innerHTML = data.shelfLife.map(s => {
      const pct = Math.min(s.hours / 48 * 100, 100);
      return `<div style="margin-bottom:8px">
        <div style="font-size:11px;font-weight:500;margin-bottom:3px">${esc(s.name)}</div>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:8px;background:var(--bg2);border-radius:4px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:var(--theme, #db2777);border-radius:4px"></div>
          </div>
          <span style="font-size:10px;color:var(--t3);min-width:30px">${s.hours}h</span>
        </div>
      </div>`;
    }).join('');
  }

  // Weather impact
  const wEl = document.getElementById('exec-prod-weather');
  if (wEl) {
    const w = data.weather;
    wEl.innerHTML = `
      <div class="card" style="padding:10px;margin-bottom:6px">
        <div style="font-size:16px;margin-bottom:4px">\u2600\uFE0F Sunny</div>
        <div style="font-size:20px;font-weight:900;color:#16a34a">${w.sunny.sellThrough}%</div>
        <div style="font-size:10px;color:var(--t3)">sell-through</div>
        <div style="font-size:10px;margin-top:4px">Top: ${esc(w.sunny.topProduct)}</div>
      </div>
      <div class="card" style="padding:10px">
        <div style="font-size:16px;margin-bottom:4px">\u{1F327}\uFE0F Rainy</div>
        <div style="font-size:20px;font-weight:900;color:#ea580c">${w.rainy.sellThrough}%</div>
        <div style="font-size:10px;color:var(--t3)">sell-through</div>
        <div style="font-size:10px;margin-top:4px">Top: ${esc(w.rainy.topProduct)}</div>
      </div>`;
  }
}


// ═══════════════════════════════════════
// 3. STORE PERFORMANCE
// ═══════════════════════════════════════
BK.renderExecStore = function(p) {
  return SPG.shell(SPG.toolbar('Store Performance') + `
    <div class="content">
      <div style="margin-bottom:16px">
        ${BK.dateFilterChips(S.execPreset, 'BakerySection.setExecPreset')}
      </div>

      ${secTitle('Store Comparison')}
      <div id="exec-store-compare" style="margin-bottom:20px">${SPG.ui.skeleton(60, 5)}</div>

      <div id="exec-store-deep" style="margin-bottom:20px"></div>

      ${secTitle('Shift \u00d7 Waste Pattern')}
      <div id="exec-store-shift" style="margin-bottom:12px">${SPG.ui.skeleton(40, 3)}</div>
      <div id="exec-store-ainote"></div>
    </div>`, 'Bakery');
};

BK.loadExecStore = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  // TODO: Replace with real API call — e.g. api('get_exec_store', { preset: S.execPreset })
  const data = getMockStoreData();
  _fillExecStore(data);
};

function _fillExecStore(data) {
  // Store comparison with visual bars
  const cmpEl = document.getElementById('exec-store-compare');
  if (cmpEl) {
    cmpEl.innerHTML = data.stores.map(s => {
      const total = s.fulfilled + s.wasted + s.returned;
      const fW = total > 0 ? (s.fulfilled / total * 100) : 0;
      const wW = total > 0 ? (s.wasted / total * 100) : 0;
      const rW = total > 0 ? (s.returned / total * 100) : 0;
      return `<div class="card" style="padding:12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div style="font-size:12px;font-weight:600">${esc(s.name)}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="font-size:14px;font-weight:900">${s.score}</div>
            ${gradeBadge(s.grade)}
          </div>
        </div>
        <div style="display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--bg2)">
          <div style="width:${fW}%;background:#16a34a" title="Fulfilled ${s.fulfilled}%"></div>
          <div style="width:${wW}%;background:#dc2626" title="Wasted ${s.wasted}%"></div>
          <div style="width:${rW}%;background:#ea580c" title="Returned ${s.returned}%"></div>
        </div>
        <div style="display:flex;gap:12px;margin-top:6px;font-size:10px;color:var(--t3)">
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#16a34a;margin-right:3px"></span>Fulfilled ${s.fulfilled}%</span>
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#dc2626;margin-right:3px"></span>Wasted ${s.wasted}%</span>
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ea580c;margin-right:3px"></span>Returned ${s.returned}%</span>
        </div>
      </div>`;
    }).join('');
  }

  // Deep Dive for lowest scoring store
  const ddEl = document.getElementById('exec-store-deep');
  if (ddEl) {
    const dd = data.deepDive;
    ddEl.innerHTML = `<div class="card" style="padding:0;overflow:hidden;border:1px solid rgba(219,39,119,.2)">
      <div style="background:linear-gradient(135deg,#fce7f3,#fdf2f8);padding:12px 14px;border-bottom:1px solid rgba(219,39,119,.1)">
        <div style="font-size:12px;font-weight:700;color:var(--theme, #db2777)">Deep Dive: ${esc(dd.store)}</div>
        <div style="font-size:10px;color:var(--t3)">Lowest scoring store — cross-module analysis</div>
      </div>
      <div style="padding:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="card" style="padding:10px;text-align:center;margin:0">
          ${cmBadge('BC')}
          <div style="font-size:18px;font-weight:900;color:#dc2626;margin-top:4px">${dd.bcWaste}%</div>
          <div style="font-size:10px;color:var(--t3)">waste rate</div>
        </div>
        <div class="card" style="padding:10px;text-align:center;margin:0">
          ${cmBadge('Sales')}
          <div style="font-size:18px;font-weight:900;color:#ea580c;margin-top:4px">${dd.salesSellThrough}%</div>
          <div style="font-size:10px;color:var(--t3)">sell-through</div>
        </div>
        <div class="card" style="padding:10px;text-align:center;margin:0">
          ${cmBadge('HR')}
          <div style="font-size:18px;font-weight:900;color:#d97706;margin-top:4px">${dd.hrShiftCoverage}%</div>
          <div style="font-size:10px;color:var(--t3)">shift coverage</div>
        </div>
        <div class="card" style="padding:10px;text-align:center;margin:0">
          <span style="font-size:9px;padding:1px 6px;border-radius:4px;background:#e0e7ff;color:#4338ca;font-weight:600">Weather</span>
          <div style="font-size:18px;font-weight:900;color:#4338ca;margin-top:4px">${dd.weatherImpact}%</div>
          <div style="font-size:10px;color:var(--t3)">impact</div>
        </div>
      </div>
    </div>`;
  }

  // Shift x Waste table
  const shEl = document.getElementById('exec-store-shift');
  if (shEl) {
    shEl.innerHTML = `<div class="card" style="overflow-x:auto;padding:0">
      <table style="width:100%;font-size:11px;border-collapse:collapse">
        <thead><tr style="background:var(--bg2)">
          <th style="padding:8px 10px;text-align:left;font-weight:600">Shift</th>
          <th style="padding:8px 6px;text-align:right;font-weight:600">Waste%</th>
          <th style="padding:8px 10px;text-align:left;font-weight:600">Note</th>
        </tr></thead>
        <tbody>${data.shiftWaste.map(sw => `<tr style="border-top:1px solid var(--border)">
          <td style="padding:8px 10px;font-weight:500">${esc(sw.shift)}</td>
          <td style="padding:8px 6px;text-align:right;color:${sw.waste > 4 ? '#dc2626' : 'inherit'};font-weight:600">${sw.waste}%</td>
          <td style="padding:8px 10px;font-size:10px;color:var(--t3)">${esc(sw.note)}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  }

  // AI note
  const aiEl = document.getElementById('exec-store-ainote');
  if (aiEl) {
    aiEl.innerHTML = aiCard('Shift Analysis', insightLine('\u{1F4CA}', data.aiNote));
  }
}


// ═══════════════════════════════════════
// 4. DEMAND & QUOTA
// ═══════════════════════════════════════
BK.renderExecDemand = function(p) {
  return SPG.shell(SPG.toolbar('Demand & Quota') + `
    <div class="content">
      <div style="margin-bottom:16px">
        ${BK.dateFilterChips(S.execPreset, 'BakerySection.setExecPreset')}
      </div>

      ${secTitle('Quota Utilization Heatmap')}
      <div id="exec-demand-heat" style="margin-bottom:20px;overflow-x:auto">${SPG.ui.skeleton(80, 5)}</div>

      ${secTitle('AI Smart Quota Suggestions')}
      <div id="exec-demand-suggest"></div>
    </div>`, 'Bakery');
};

BK.loadExecDemand = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  // TODO: Replace with real API call — e.g. api('get_exec_demand', { preset: S.execPreset })
  const data = getMockDemandData();
  _fillExecDemand(data);
};

function _fillExecDemand(data) {
  // Heatmap grid
  const hEl = document.getElementById('exec-demand-heat');
  if (hEl) {
    const days = data.days;
    hEl.innerHTML = `<div class="card" style="padding:0;overflow-x:auto">
      <table style="width:100%;font-size:11px;border-collapse:collapse;min-width:400px">
        <thead><tr style="background:var(--bg2)">
          <th style="padding:8px 10px;text-align:left;font-weight:600">Product</th>
          ${days.map(d => `<th style="padding:8px 6px;text-align:center;font-weight:600">${esc(d)}</th>`).join('')}
        </tr></thead>
        <tbody>${data.heatmap.map(row => `<tr style="border-top:1px solid var(--border)">
          <td style="padding:8px 10px;font-weight:500;white-space:nowrap">${esc(row.name)}</td>
          ${row.days.map(pct => {
            const c = heatColor(pct);
            return `<td style="padding:6px;text-align:center">
              <div style="background:${c.bg};color:${c.fg};font-weight:700;font-size:11px;padding:4px 2px;border-radius:4px">${pct}%</div>
            </td>`;
          }).join('')}
        </tr>`).join('')}</tbody>
      </table>
    </div>
    <div style="display:flex;gap:12px;margin-top:8px;font-size:10px;color:var(--t3)">
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#dcfce7;margin-right:3px"></span>&gt;70% Good</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#fff7ed;margin-right:3px"></span>40-70% OK</span>
      <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#fef2f2;margin-right:3px"></span>&lt;40% Low</span>
    </div>`;
  }

  // AI Quota Suggestions
  const sgEl = document.getElementById('exec-demand-suggest');
  if (sgEl) {
    sgEl.innerHTML = data.suggestions.map(s => `
      <div class="card" style="padding:14px;margin-bottom:8px;border-left:3px solid var(--theme, #db2777)">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px">${esc(s.product)}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <div style="font-size:11px;color:var(--t3)">Current</div>
          <div style="font-size:16px;font-weight:700">${s.current}</div>
          <span style="font-size:14px;color:var(--t3)">\u2192</span>
          <div style="font-size:11px;color:var(--theme, #db2777)">Suggested</div>
          <div style="font-size:16px;font-weight:900;color:var(--theme, #db2777)">${s.suggested}</div>
        </div>
        <div style="font-size:10px;color:var(--t3);margin-bottom:4px">\u{1F4C5} ${esc(s.dayAdj)}</div>
        <div style="font-size:10px;color:var(--t3)">\u{1F327}\uFE0F ${esc(s.weather)}</div>
      </div>`).join('');
  }
}


// ═══════════════════════════════════════
// 5. WASTE INTELLIGENCE
// ═══════════════════════════════════════
BK.renderExecWaste = function(p) {
  return SPG.shell(SPG.toolbar('Waste Intelligence') + `
    <div class="content">
      <div style="margin-bottom:16px">
        ${BK.dateFilterChips(S.execPreset, 'BakerySection.setExecPreset')}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
        <div>
          ${secTitle('Waste Sources')}
          <div id="exec-waste-sources"></div>
        </div>
        <div>
          ${secTitle('Total Waste Cost')}
          <div id="exec-waste-cost"></div>
        </div>
      </div>

      ${secTitle('Who Created Waste')}
      <div id="exec-waste-staff">${SPG.ui.skeleton(40, 4)}</div>
    </div>`, 'Bakery');
};

BK.loadExecWaste = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  // TODO: Replace with real API call — e.g. api('get_exec_waste', { preset: S.execPreset })
  const data = getMockWasteData();
  _fillExecWaste(data);
};

function _fillExecWaste(data) {
  // Waste source bars
  const srcEl = document.getElementById('exec-waste-sources');
  if (srcEl) {
    const maxPct = Math.max(...data.sources.map(s => s.pct));
    srcEl.innerHTML = data.sources.map(s => {
      const barW = maxPct > 0 ? (s.pct / maxPct * 100) : 0;
      return `<div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
          <span style="font-weight:500">${esc(s.name)}</span>
          <span style="color:var(--t3)">${s.pct}% · $${s.cost}</span>
        </div>
        <div style="height:8px;background:var(--bg2);border-radius:4px;overflow:hidden">
          <div style="width:${barW}%;height:100%;background:${s.pct >= 30 ? '#dc2626' : s.pct >= 20 ? '#ea580c' : 'var(--theme, #db2777)'};border-radius:4px"></div>
        </div>
      </div>`;
    }).join('');
  }

  // Total waste cost big number
  const costEl = document.getElementById('exec-waste-cost');
  if (costEl) {
    costEl.innerHTML = `<div class="card" style="padding:24px;text-align:center">
      <div style="font-size:36px;font-weight:900;color:#dc2626">$${data.totalCost.toLocaleString()}</div>
      <div style="font-size:11px;color:var(--t3);margin-top:4px">period total waste cost</div>
      <div style="margin-top:12px;display:flex;justify-content:center;gap:6px">
        ${cmBadge('BC')} ${cmBadge('Sales')}
      </div>
    </div>`;
  }

  // Who Created Waste table
  const staffEl = document.getElementById('exec-waste-staff');
  if (staffEl) {
    staffEl.innerHTML = `<div class="card" style="overflow-x:auto;padding:0">
      <table id="exec-waste-staff-tbl" style="width:100%;font-size:11px;border-collapse:collapse;white-space:nowrap">
        <thead><tr style="background:var(--bg2)">
          ${SPG.ui.sortTh('exec-waste-staff-tbl','name','Staff')}
          <th style="padding:8px 6px;text-align:left;font-weight:600">Role</th>
          ${SPG.ui.sortTh('exec-waste-staff-tbl','shifts','Shifts',' style="text-align:right"')}
          ${SPG.ui.sortTh('exec-waste-staff-tbl','wasteLogs','Waste Logs',' style="text-align:right"')}
          ${SPG.ui.sortTh('exec-waste-staff-tbl','wastePerShift','Waste/Shift',' style="text-align:right"')}
          <th style="padding:8px 6px;text-align:right;font-weight:600">Over-orders</th>
          <th style="padding:8px 10px;text-align:center;font-weight:600">Assessment</th>
        </tr></thead>
        <tbody>${data.staff.map(st => `<tr style="border-top:1px solid var(--border)">
          <td style="padding:8px 10px;font-weight:500">${esc(st.name)}</td>
          <td style="padding:8px 6px">${esc(st.role)}</td>
          <td style="padding:8px 6px;text-align:right">${st.shifts}</td>
          <td style="padding:8px 6px;text-align:right">${st.wasteLogs}</td>
          <td style="padding:8px 6px;text-align:right;font-weight:600;color:${st.wastePerShift > 0.5 ? '#dc2626' : '#16a34a'}">${st.wastePerShift.toFixed(2)}</td>
          <td style="padding:8px 6px;text-align:right;color:${st.overOrders > 3 ? '#dc2626' : 'inherit'}">${st.overOrders}</td>
          <td style="padding:8px 10px;text-align:center">${assessBadge(st.assessment)}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  }
}


// ═══════════════════════════════════════
// 6. QUALITY & RETURNS
// ═══════════════════════════════════════
BK.renderExecQuality = function(p) {
  return SPG.shell(SPG.toolbar('Quality & Returns') + `
    <div class="content">
      <div style="margin-bottom:16px">
        ${BK.dateFilterChips(S.execPreset, 'BakerySection.setExecPreset')}
      </div>

      <div id="exec-qual-kpis" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px">
        ${SPG.ui.skeleton(60, 4)}
      </div>

      ${secTitle('Return Tracing')}
      <div id="exec-qual-returns" style="margin-bottom:20px">${SPG.ui.skeleton(40, 5)}</div>

      <div id="exec-qual-ai"></div>
    </div>`, 'Bakery');
};

BK.loadExecQuality = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  // TODO: Replace with real API call — e.g. api('get_exec_quality', { preset: S.execPreset })
  const data = getMockQualityData();
  _fillExecQuality(data);
};

function _fillExecQuality(data) {
  const k = data.kpis;

  // KPI cards
  const kpiEl = document.getElementById('exec-qual-kpis');
  if (kpiEl) {
    kpiEl.innerHTML =
      metricCard('Returns', k.returns, 'count', ['BC']) +
      metricCard('Return Rate', k.returnRate + '%', 'of orders', ['BC', 'Sales']) +
      metricCard('Reworked', k.reworked + '%', 'of returns', ['BC']) +
      metricCard('Wasted', k.wasted + '%', 'of returns', ['BC']);
  }

  // Return Tracing table
  const rtEl = document.getElementById('exec-qual-returns');
  if (rtEl) {
    rtEl.innerHTML = `<div class="card" style="overflow-x:auto;padding:0">
      <table id="exec-qual-return-tbl" style="width:100%;font-size:11px;border-collapse:collapse;white-space:nowrap">
        <thead><tr style="background:var(--bg2)">
          ${SPG.ui.sortTh('exec-qual-return-tbl','returnId','Return ID')}
          <th style="padding:8px 6px;text-align:left;font-weight:600">Order ID</th>
          ${SPG.ui.sortTh('exec-qual-return-tbl','product','Product')}
          ${SPG.ui.sortTh('exec-qual-return-tbl','store','Store')}
          <th style="padding:8px 6px;text-align:center;font-weight:600">Issue</th>
          <th style="padding:8px 6px;text-align:left;font-weight:600">Shift Staff</th>
          <th style="padding:8px 10px;text-align:center;font-weight:600">Resolution</th>
        </tr></thead>
        <tbody>${data.returns.map(r => `<tr style="border-top:1px solid var(--border)">
          <td style="padding:8px 10px;font-weight:500;color:var(--theme, #db2777)">${esc(r.returnId)}</td>
          <td style="padding:8px 6px;font-size:10px">${esc(r.orderId)}</td>
          <td style="padding:8px 6px">${esc(r.product)}</td>
          <td style="padding:8px 6px">${esc(r.store)}</td>
          <td style="padding:8px 6px;text-align:center">${issueBadge(r.issue)}</td>
          <td style="padding:8px 6px">${esc(r.staff)}</td>
          <td style="padding:8px 10px;text-align:center">${resBadge(r.resolution)}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
  }

  // AI Quality Insight
  const aiEl = document.getElementById('exec-qual-ai');
  if (aiEl) {
    aiEl.innerHTML = aiCard('Quality Insight', insightLine('\u{1F6A8}', data.aiInsight));
  }
}


// ═══════════════════════════════════════
// ONCLICK HANDLERS — extend BakerySection
// ═══════════════════════════════════════
Object.assign(window.BakerySection, {
  setExecPreset(preset) {
    S.execPreset = preset;
    // Re-render current exec page
    const route = SPG.currentRoute;
    if (route) SPG.go('bakery/' + route);
  },

  setExecCat(cat) {
    S.execCatFilter = cat;
    SPG.go('bakery/exec-product');
  },
});


// ═══════════════════════════════════════
// SORT EVENT — re-render on column sort
// ═══════════════════════════════════════
document.addEventListener('spg-sort', (e) => {
  const id = e.detail.tableId;
  if (id === 'exec-cmd-score-tbl' && S.execDash) {
    _fillExecCommand(S.execDash);
  } else if (id === 'exec-waste-staff-tbl') {
    _fillExecWaste(getMockWasteData());
  } else if (id === 'exec-qual-return-tbl') {
    _fillExecQuality(getMockQualityData());
  }
});

})();
