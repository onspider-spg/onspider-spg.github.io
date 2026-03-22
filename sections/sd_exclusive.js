/**
 * SPG HUB v1.0.0 | 22 MAR 2026 | Siam Palette Group
 * sections/sd_exclusive.js — Executive Dashboard (T1-T2 Only)
 * 6 Pages: Command Centre, P&L Deep Dive, Revenue Intelligence,
 *          Report Intelligence, Store Performance, Staff × Money
 *
 * Depends on: sd_core.js (SD global)
 * Design: Blue theme, wireframe-sd-executive-v3 reference
 */

(() => {
const S = SD.S;
const esc = SD.esc;
const fm = SD.fmtMoney;
const fms = SD.fmtMoneyShort;
const ui = SPG.ui;
const SECTION = 'Sales Daily';
let _busy = {};
let execData = null;

// Current month
const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth()] + ' ' + now.getFullYear();

function backBtn() { return `<button style="border:none;background:none;font-size:16px;cursor:pointer;color:var(--t2)" onclick="SPG.go('sales/exec-cmd')">←</button>`; }


// ═══════════════════════════════════════
// SHARED: Load exec data (reuse across pages)
// ═══════════════════════════════════════
async function ensureExecData() {
  if (execData) return execData;
  if (_busy.exec) return null;
  _busy.exec = true;
  try {
    const [accData, storeStatus] = await Promise.all([
      SD.api('get_acc_review', { month: curMonth }),
      SD.api('get_store_status'),
    ]);
    // Build store map from acc review
    const storeMap = {};
    (accData?.days || []).forEach(r => {
      const sn = r.store_name || r.store_id;
      if (!storeMap[sn]) storeMap[sn] = { id: r.store_id, name: sn, dates: {}, monthRev: 0, monthExp: 0 };
      storeMap[sn].dates[r.sale_date] = { rev: parseFloat(r.total_sales) || 0, exp: parseFloat(r.total_expense) || 0 };
      storeMap[sn].monthRev += (parseFloat(r.total_sales) || 0);
      storeMap[sn].monthExp += (parseFloat(r.total_expense) || 0);
    });

    const today = SD.todayStr();
    const yest = SD.addDays(today, -1);
    // Monday of this week
    const dow = now.getDay();
    const mondayOff = dow === 0 ? -6 : 1 - dow;
    const mondayStr = SD.addDays(today, mondayOff);

    const stores = Object.values(storeMap).map(s => {
      s.today = s.dates[today] || { rev: 0, exp: 0 };
      s.yest = s.dates[yest] || { rev: 0, exp: 0 };
      s.week = [];
      for (let i = 0; i < 7; i++) {
        const wd = SD.addDays(mondayStr, i);
        s.week.push(s.dates[wd] || { rev: 0, exp: 0 });
      }
      return s;
    });

    execData = { stores, storeStatus: storeStatus?.stores || [] };
    return execData;
  } catch (e) {
    console.error('[SD Exec] Data fetch failed:', e);
    return null;
  } finally { _busy.exec = false; }
}


// ═══════════════════════════════════════
// RENDER/LOAD pattern for all 6 pages
// ═══════════════════════════════════════
function renderPage(pageId, title, contentFn) {
  return function(p) {
    const isCmd = pageId === 'cmd';
    return SPG.shell(`<div class="toolbar">${isCmd ? '' : backBtn()}<div class="toolbar-title">${title}</div><div style="margin-left:auto"><span style="font-size:9px;color:var(--theme);background:var(--theme-bg);padding:2px 8px;border-radius:10px;font-weight:700">T1-T2 Only</span></div></div>
    <div class="content" id="exec-${pageId}-content">
      ${SD.renderStoreSelector()}
      ${ui.skeleton(200)}
    </div>`, SECTION);
  };
}

function loadPage(pageId, fillFn) {
  return async function(p) {
    await SD.initModule();
    if (!S.initLoaded) return;
    SD.buildSDSidebar();
    const el = document.getElementById(`exec-${pageId}-content`);
    if (!el) return;
    el.innerHTML = SD.renderStoreSelector() + ui.skeleton(200);
    const data = await ensureExecData();
    if (!data) { el.innerHTML = SD.renderStoreSelector() + ui.empty('', 'โหลดข้อมูลไม่ได้'); return; }
    fillFn(el, data);
  };
}


// ═══════════════════════════════════════
// 1. COMMAND CENTRE
// ═══════════════════════════════════════
function fillCmd(el, data) {
  const { stores } = data;
  const totalRev = stores.reduce((s, x) => s + x.monthRev, 0);
  const totalExp = stores.reduce((s, x) => s + x.monthExp, 0);
  const net = totalRev - totalExp;
  const netPct = totalRev ? ((net / totalRev) * 100).toFixed(1) : '0';

  let tT = { rev: 0, exp: 0 }, tY = { rev: 0, exp: 0 };
  stores.forEach(s => { tT.rev += s.today.rev; tT.exp += s.today.exp; tY.rev += s.yest.rev; tY.exp += s.yest.exp; });

  el.innerHTML = `${SD.renderStoreSelector()}
    <div class="card" style="padding:14px;margin-bottom:12px">
      <div class="sec-title" style="margin-top:0">💰 P&L Snapshot — ${monthLabel}</div>
      <div style="display:flex;gap:6px;font-size:12px;flex-wrap:wrap;align-items:center">
        <span style="padding:8px 14px;background:var(--green-bg);border-radius:6px;font-weight:700;color:var(--green)">Revenue ${fms(totalRev)}</span>
        <span style="color:var(--t4)">−</span>
        <span style="padding:8px 14px;background:var(--red-bg);border-radius:6px;font-weight:700;color:var(--red)">Expense ${fms(totalExp)}</span>
        <span style="color:var(--t4)">=</span>
        <span style="padding:8px 14px;background:var(--theme-bg);border-radius:6px;font-weight:800;color:var(--theme)">Net ${fms(net)}</span>
      </div>
      <div style="margin-top:8px;font-size:12px;color:var(--t2)">Net Margin <b style="color:${net >= 0 ? 'var(--green)' : 'var(--red)'}">${netPct}%</b></div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
      <div class="card" style="text-align:center;padding:12px;border-left:3px solid var(--theme)"><div style="font-size:18px;font-weight:800;color:var(--theme)">${fms(totalRev)}</div><div style="font-size:10px;color:var(--t3)">Revenue</div></div>
      <div class="card" style="text-align:center;padding:12px;border-left:3px solid var(--green)"><div style="font-size:18px;font-weight:800;color:var(--green)">${fms(net)}</div><div style="font-size:10px;color:var(--t3)">Net Profit</div></div>
      <div class="card" style="text-align:center;padding:12px;border-left:3px solid var(--red)"><div style="font-size:18px;font-weight:800;color:var(--red)">${fms(totalExp)}</div><div style="font-size:10px;color:var(--t3)">Expense</div></div>
      <div class="card" style="text-align:center;padding:12px;border-left:3px solid var(--orange)"><div style="font-size:18px;font-weight:800">${stores.length}</div><div style="font-size:10px;color:var(--t3)">Active Stores</div></div>
    </div>

    <div class="card" style="padding:14px;margin-bottom:12px">
      <div class="sec-title" style="margin-top:0">★ Daily Sales — Today vs Yesterday</div>
      <div style="overflow-x:auto"><table class="tbl">
        <thead><tr><th>Store</th><th style="text-align:right">Today Rev</th><th style="text-align:right">Today Exp</th><th style="text-align:right">Yest Rev</th><th style="text-align:right">Change</th></tr></thead>
        <tbody>${stores.map(s => {
          const chg = s.yest.rev ? ((s.today.rev - s.yest.rev) / s.yest.rev * 100).toFixed(0) : 0;
          const arrow = chg >= 0 ? '▲' : '▼';
          const clr = chg >= 0 ? 'var(--green)' : 'var(--red)';
          return `<tr><td style="font-weight:600">${esc(s.name)}</td><td style="text-align:right;font-weight:700;color:var(--theme)">${fms(s.today.rev)}</td><td style="text-align:right;color:var(--red)">${fms(s.today.exp)}</td><td style="text-align:right">${fms(s.yest.rev)}</td><td style="text-align:right;color:${clr};font-size:10px;font-weight:700">${s.yest.rev ? arrow + ' ' + Math.abs(chg) + '%' : '—'}</td></tr>`;
        }).join('')}</tbody>
        <tfoot><tr style="background:var(--bg3);font-weight:700"><td>Total</td><td style="text-align:right;color:var(--theme)">${fms(tT.rev)}</td><td style="text-align:right;color:var(--red)">${fms(tT.exp)}</td><td style="text-align:right">${fms(tY.rev)}</td><td style="text-align:right;color:${(tT.rev - tY.rev) >= 0 ? 'var(--green)' : 'var(--red)'}">—</td></tr></tfoot>
      </table></div>
    </div>

    <div class="card" style="padding:14px">
      <div class="sec-title" style="margin-top:0">🏪 Store P&L Scorecard — ${monthLabel}</div>
      <div style="overflow-x:auto"><table class="tbl">
        <thead><tr><th>Store</th><th style="text-align:right">Revenue</th><th style="text-align:right">Expense</th><th style="text-align:right">Net Profit</th><th style="text-align:right">Net %</th></tr></thead>
        <tbody>${stores.map(s => {
          const sNet = s.monthRev - s.monthExp;
          const sNetPct = s.monthRev ? ((sNet / s.monthRev) * 100).toFixed(0) : '0';
          return `<tr><td style="font-weight:600">${esc(s.name)}</td><td style="text-align:right;color:var(--theme)">${fms(s.monthRev)}</td><td style="text-align:right;color:var(--red)">${fms(s.monthExp)}</td><td style="text-align:right;font-weight:700;color:${sNet >= 0 ? 'var(--green)' : 'var(--red)'}">${fms(sNet)}</td><td style="text-align:right">${ui.badge(parseInt(sNetPct) >= 20 ? 'active' : parseInt(sNetPct) >= 10 ? 'pending' : 'rejected')} ${sNetPct}%</td></tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`;
}


// ═══════════════════════════════════════
// 2. P&L DEEP DIVE
// ═══════════════════════════════════════
function fillPnl(el, data) {
  const { stores } = data;
  const totalRev = stores.reduce((s, x) => s + x.monthRev, 0);
  const totalExp = stores.reduce((s, x) => s + x.monthExp, 0);

  el.innerHTML = `${SD.renderStoreSelector()}
    <div class="card" style="padding:14px;margin-bottom:12px">
      <div class="sec-title" style="margin-top:0">📈 P&L Breakdown — ${monthLabel}</div>
      <div style="font-size:12px;line-height:2.2">
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--bd2)"><span style="color:var(--t2)">Revenue</span><span style="color:var(--theme);font-weight:700">${fms(totalRev)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--bd2)"><span style="color:var(--t2)">− Expense</span><span style="color:var(--red)">-${fms(totalExp)}</span></div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid var(--t1);font-weight:800"><span>Net Profit</span><span style="color:${(totalRev - totalExp) >= 0 ? 'var(--green)' : 'var(--red)'}">${fms(totalRev - totalExp)}</span></div>
      </div>
    </div>

    <div class="card" style="padding:14px">
      <div class="sec-title" style="margin-top:0">🏪 Store Revenue vs Expense</div>
      <div style="overflow-x:auto"><table class="tbl">
        <thead><tr><th>Store</th><th style="text-align:right">Revenue</th><th style="text-align:right">Expense</th><th style="text-align:right">Net</th><th style="text-align:right">Margin</th></tr></thead>
        <tbody>${stores.map(s => {
          const n = s.monthRev - s.monthExp;
          const m = s.monthRev ? ((n / s.monthRev) * 100).toFixed(1) : '0';
          return `<tr><td style="font-weight:600">${esc(s.name)}</td><td style="text-align:right;color:var(--theme)">${fms(s.monthRev)}</td><td style="text-align:right;color:var(--red)">${fms(s.monthExp)}</td><td style="text-align:right;font-weight:700;color:${n >= 0 ? 'var(--green)' : 'var(--red)'}">${fms(n)}</td><td style="text-align:right">${m}%</td></tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`;
}


// ═══════════════════════════════════════
// 3. REVENUE INTELLIGENCE
// ═══════════════════════════════════════
function fillRevenue(el, data) {
  const { stores } = data;
  const dayLabels = ['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'];

  el.innerHTML = `${SD.renderStoreSelector()}
    <div class="card" style="padding:14px;margin-bottom:12px">
      <div class="sec-title" style="margin-top:0">📅 Day-of-Week Revenue — This Week</div>
      <div style="overflow-x:auto"><table class="tbl">
        <thead><tr><th>Store</th>${dayLabels.map(d => `<th style="text-align:center">${d}</th>`).join('')}<th style="text-align:right">Total</th></tr></thead>
        <tbody>${stores.map(s => {
          const weekTotal = s.week.reduce((sum, w) => sum + w.rev, 0);
          const nonZero = s.week.filter(w => w.rev > 0);
          const avg = nonZero.length ? nonZero.reduce((a, w) => a + w.rev, 0) / nonZero.length : 0;
          return `<tr><td style="font-weight:600">${esc(s.name)}</td>
            ${s.week.map(w => {
              if (w.rev === 0) return '<td style="text-align:center;color:var(--t4)">—</td>';
              const bg = w.rev >= avg * 1.1 ? 'var(--green-bg)' : w.rev <= avg * 0.85 ? 'var(--red-bg)' : '';
              const clr = w.rev >= avg * 1.1 ? 'var(--green)' : w.rev <= avg * 0.85 ? 'var(--red)' : '';
              return `<td style="text-align:center;${bg ? 'background:' + bg + ';' : ''}${clr ? 'color:' + clr + ';' : ''}font-weight:600;font-size:10px">${fms(w.rev)}</td>`;
            }).join('')}
            <td style="text-align:right;font-weight:700">${fms(weekTotal)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
      <div style="display:flex;gap:12px;margin-top:8px;font-size:9px;color:var(--t3)">
        <span><span style="display:inline-block;width:10px;height:10px;background:var(--green-bg);border-radius:2px;vertical-align:middle"></span> Above avg</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:var(--red-bg);border-radius:2px;vertical-align:middle"></span> Below avg</span>
      </div>
    </div>`;
}


// ═══════════════════════════════════════
// 4. REPORT INTELLIGENCE
// ═══════════════════════════════════════
function fillReport(el, data) {
  const { stores } = data;

  el.innerHTML = `${SD.renderStoreSelector()}
    <div class="card" style="padding:14px;margin-bottom:12px">
      <div class="sec-title" style="margin-top:0">📋 Daily Report × Revenue Cross-Analysis</div>
      <div style="font-size:12px;color:var(--t2);line-height:1.8">
        <div style="padding:8px 10px;background:var(--theme-bg);border-left:2px solid var(--theme);border-radius:6px;margin-bottom:6px">📊 Revenue data is cross-referenced with daily reports to identify patterns and anomalies.</div>
        <div style="padding:8px 10px;background:var(--orange-bg);border-left:2px solid var(--orange);border-radius:6px;margin-bottom:6px">⚠️ Incident data requires daily report submission — encourage all stores to submit reports daily.</div>
      </div>
    </div>

    <div class="card" style="padding:14px">
      <div class="sec-title" style="margin-top:0">🏪 Store Revenue Summary — ${monthLabel}</div>
      <div style="overflow-x:auto"><table class="tbl">
        <thead><tr><th>Store</th><th style="text-align:right">Revenue</th><th style="text-align:right">Expense</th><th style="text-align:right">Net</th></tr></thead>
        <tbody>${stores.map(s => `<tr><td style="font-weight:600">${esc(s.name)}</td><td style="text-align:right;color:var(--theme)">${fms(s.monthRev)}</td><td style="text-align:right;color:var(--red)">${fms(s.monthExp)}</td><td style="text-align:right;font-weight:700;color:${(s.monthRev - s.monthExp) >= 0 ? 'var(--green)' : 'var(--red)'}">${fms(s.monthRev - s.monthExp)}</td></tr>`).join('')}</tbody>
      </table></div>
    </div>`;
}


// ═══════════════════════════════════════
// 5. STORE PERFORMANCE
// ═══════════════════════════════════════
function fillStore(el, data) {
  const { stores } = data;
  const totalRev = stores.reduce((s, x) => s + x.monthRev, 0);

  el.innerHTML = `${SD.renderStoreSelector()}
    <div class="card" style="padding:14px">
      <div class="sec-title" style="margin-top:0">📊 Financial Benchmark — ${monthLabel}</div>
      <div style="overflow-x:auto"><table class="tbl">
        <thead><tr><th>Metric</th>${stores.map(s => `<th style="text-align:center">${esc(s.id || s.name)}</th>`).join('')}</tr></thead>
        <tbody>
          <tr><td style="font-weight:600">Revenue</td>${stores.map(s => `<td style="text-align:center;color:var(--theme);font-weight:600">${fms(s.monthRev)}</td>`).join('')}</tr>
          <tr><td style="font-weight:600">Expense</td>${stores.map(s => `<td style="text-align:center;color:var(--red)">${fms(s.monthExp)}</td>`).join('')}</tr>
          <tr><td style="font-weight:600">Net Profit</td>${stores.map(s => { const n = s.monthRev - s.monthExp; return `<td style="text-align:center;font-weight:700;color:${n >= 0 ? 'var(--green)' : 'var(--red)'}">${fms(n)}</td>`; }).join('')}</tr>
          <tr><td style="font-weight:600">Net Margin</td>${stores.map(s => { const m = s.monthRev ? (((s.monthRev - s.monthExp) / s.monthRev) * 100).toFixed(0) : '0'; return `<td style="text-align:center;font-weight:700;color:${parseInt(m) >= 20 ? 'var(--green)' : parseInt(m) >= 10 ? '' : 'var(--red)'}">${m}%</td>`; }).join('')}</tr>
          <tr><td style="font-weight:600">Revenue Share</td>${stores.map(s => { const pct = totalRev ? ((s.monthRev / totalRev) * 100).toFixed(0) : '0'; return `<td style="text-align:center">${pct}%</td>`; }).join('')}</tr>
        </tbody>
      </table></div>
    </div>`;
}


// ═══════════════════════════════════════
// 6. STAFF × MONEY
// ═══════════════════════════════════════
function fillStaff(el, data) {
  el.innerHTML = `${SD.renderStoreSelector()}
    <div class="card" style="padding:14px;margin-bottom:12px">
      <div class="sec-title" style="margin-top:0">👤 Staff Financial Impact</div>
      <div style="font-size:12px;color:var(--t2);line-height:1.8">
        <div style="padding:8px 10px;background:var(--theme-bg);border-left:2px solid var(--theme);border-radius:6px;margin-bottom:6px">📊 Staff performance data requires HR Module integration. Currently showing revenue data only.</div>
      </div>
    </div>

    <div class="card" style="padding:14px">
      <div class="sec-title" style="margin-top:0">🏪 Revenue per Store — ${monthLabel}</div>
      <div style="overflow-x:auto"><table class="tbl">
        <thead><tr><th>Store</th><th style="text-align:right">Revenue</th><th style="text-align:right">Expense</th><th style="text-align:right">Net Value</th></tr></thead>
        <tbody>${data.stores.map(s => {
          const n = s.monthRev - s.monthExp;
          return `<tr><td style="font-weight:600">${esc(s.name)}</td><td style="text-align:right;color:var(--theme)">${fms(s.monthRev)}</td><td style="text-align:right;color:var(--red)">${fms(s.monthExp)}</td><td style="text-align:right;font-weight:700;color:${n >= 0 ? 'var(--green)' : 'var(--red)'}">${fms(n)}</td></tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`;
}


// ═══════════════════════════════════════
// REGISTER RENDER/LOAD TO PARENT
// ═══════════════════════════════════════
SD.renderExecCmd = renderPage('cmd', 'Command Centre', fillCmd);
SD.loadExecCmd = loadPage('cmd', fillCmd);

SD.renderExecPnl = renderPage('pnl', 'P&L Deep Dive', fillPnl);
SD.loadExecPnl = loadPage('pnl', fillPnl);

SD.renderExecRevenue = renderPage('revenue', 'Revenue Intelligence', fillRevenue);
SD.loadExecRevenue = loadPage('revenue', fillRevenue);

SD.renderExecReport = renderPage('report', 'Report Intelligence', fillReport);
SD.loadExecReport = loadPage('report', fillReport);

SD.renderExecStore = renderPage('store', 'Store Performance', fillStore);
SD.loadExecStore = loadPage('store', fillStore);

SD.renderExecStaff = renderPage('staff', 'Staff × Money', fillStaff);
SD.loadExecStaff = loadPage('staff', fillStaff);

})();
