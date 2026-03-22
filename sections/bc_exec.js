/**
 * SPG HUB v1.0.0 | 23 MAR 2026 | Siam Palette Group
 * sections/bc_exec.js — Executive Dashboard (6 pages, wireframe v5)
 * Uses real API: getExecDashboard, getAlertConfig, saveAlertConfig
 * Depends on: bc_core.js (BK global)
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

/** Score to letter grade */
function scoreGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

/** Safely format number with fallback */
function n(val, dec) {
  if (val == null || isNaN(val)) return '0';
  return dec != null ? Number(val).toFixed(dec) : Number(val).toLocaleString();
}


// ═══════════════════════════════════════
// DATA LOADER — single API call, store in BK.S.execDash
// ═══════════════════════════════════════
async function loadExecData(force) {
  if (S.execDash && !force) return S.execDash;
  const range = BK.getDateRange(S.execPreset);
  try {
    const data = await BK.api('getExecDashboard', { date_from: range.from, date_to: range.to });
    S.execDash = data;
    return data;
  } catch (e) {
    console.error('loadExecData error:', e);
    SPG.toast('Failed to load executive data', 'error');
    return null;
  }
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

      <div id="exec-cmd-alerts" style="margin-bottom:20px"></div>

      <div id="exec-cmd-insights" style="margin-bottom:20px"></div>

      ${secTitle('Store Scorecard')}
      <div id="exec-cmd-stores" style="margin-bottom:20px">${SPG.ui.skeleton(40, 5)}</div>

      ${secTitle('Cutoff Violations')}
      <div id="exec-cmd-cutoff" style="margin-bottom:20px"></div>

      ${secTitle('Alert Setup')}
      <div id="exec-cmd-alert-setup" style="margin-bottom:20px"></div>
    </div>`, 'Bakery');
};

BK.loadExecCommand = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  const data = await loadExecData(true);
  if (!data) return;
  _fillExecCommand(data);

  // Load alert config for setup section
  try {
    S.alertConfig = await BK.api('getAlertConfig');
  } catch (e) { S.alertConfig = {}; }
  _fillAlertSetup(S.alertConfig || {});
};

function _fillExecCommand(data) {
  const k = data.kpis || {};

  // KPI cards
  const kpiEl = document.getElementById('exec-cmd-kpis');
  if (kpiEl) {
    kpiEl.innerHTML =
      metricCard('Orders', n(k.total_orders), 'total', ['BC']) +
      metricCard('Fulfilment', n(k.fulfilment_rate, 1) + '%', 'of orders', ['BC']) +
      metricCard('Waste', n(k.total_waste), 'items', ['BC']) +
      metricCard('Cutoff Violations', n(k.cutoff_violations), 'late orders', ['BC']) +
      metricCard('Returns', n(k.returns), 'count', ['BC']) +
      metricCard('Health Score', n(k.health_score, 0), 'overall', ['BC']);
  }

  // Live Alerts
  const alertEl = document.getElementById('exec-cmd-alerts');
  if (alertEl) {
    const alerts = data.alerts || [];
    if (alerts.length > 0) {
      alertEl.innerHTML = `<div class="sec-title">Live Alerts</div>` + alerts.map(a => {
        const typeColor = a.type === 'critical' ? '#dc2626' : a.type === 'warning' ? '#ea580c' : '#d97706';
        const typeBg = a.type === 'critical' ? '#fef2f2' : a.type === 'warning' ? '#fff7ed' : '#fef3c7';
        return `<div class="card" style="padding:12px;margin-bottom:6px;border-left:3px solid ${typeColor};background:${typeBg}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:12px;font-weight:700;color:${typeColor}">${esc(a.title || '')}</div>
              <div style="font-size:11px;color:var(--t3);margin-top:2px">${esc(a.detail || '')}</div>
            </div>
            <div style="font-size:10px;color:var(--t3);white-space:nowrap">${esc(a.ago || '')}</div>
          </div>
        </div>`;
      }).join('');
    } else {
      alertEl.innerHTML = '';
    }
  }

  // AI Insights — cosmetic section referencing real data
  const insEl = document.getElementById('exec-cmd-insights');
  if (insEl) {
    const ws = data.waste_snapshot || {};
    const lines = [];
    if (k.fulfilment_rate != null) {
      lines.push(insightLine('\u2705', `Overall fulfilment rate is ${n(k.fulfilment_rate, 1)}% for this period`));
    }
    if (ws.today != null && ws.avg_day != null && ws.today > ws.avg_day) {
      lines.push(insightLine('\u{1F6A8}', `Today's waste (${n(ws.today)}) is above the daily average (${n(ws.avg_day)}) — review production levels`));
    }
    if (k.cutoff_violations > 0) {
      lines.push(insightLine('\u23F0', `${n(k.cutoff_violations)} cutoff violation(s) detected — check late-ordering stores`));
    }
    if (k.returns > 0) {
      lines.push(insightLine('\u{1F4E6}', `${n(k.returns)} return(s) recorded — see Quality & Returns for detail`));
    }
    if (lines.length === 0) {
      lines.push(insightLine('\u2705', 'All metrics within normal range'));
    }
    insEl.innerHTML = aiCard('Smart Insights', `
      ${lines.join('')}
      <div style="margin-top:12px;position:relative">
        <input type="text" class="inp" placeholder="Ask AI about your bakery data..." style="font-size:12px;padding-right:36px" disabled>
        <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:14px;color:var(--t3)">&#x2728;</span>
      </div>
    `);
  }

  // Store Scorecard
  const stEl = document.getElementById('exec-cmd-stores');
  if (stEl) {
    const stores = data.store_health || [];
    if (stores.length === 0) {
      stEl.innerHTML = `<div class="card" style="padding:20px;text-align:center;color:var(--t3);font-size:12px">No store data for this period</div>`;
    } else {
      stEl.innerHTML = `<div class="card" style="overflow-x:auto;padding:0">
        <table id="exec-cmd-score-tbl" style="width:100%;font-size:11px;border-collapse:collapse">
          <thead><tr style="background:var(--bg2)">
            ${SPG.ui.sortTh('exec-cmd-score-tbl','store_name','Store')}
            ${SPG.ui.sortTh('exec-cmd-score-tbl','orders','Orders',' style="text-align:right"')}
            ${SPG.ui.sortTh('exec-cmd-score-tbl','fulfilment','Fulfil%',' style="text-align:right"')}
            ${SPG.ui.sortTh('exec-cmd-score-tbl','waste','Waste',' style="text-align:right"')}
            ${SPG.ui.sortTh('exec-cmd-score-tbl','returns','Returns',' style="text-align:right"')}
            ${SPG.ui.sortTh('exec-cmd-score-tbl','cutoff_violations','Cutoff',' style="text-align:right"')}
            ${SPG.ui.sortTh('exec-cmd-score-tbl','score','Score',' style="text-align:right"')}
            <th style="padding:8px 10px;text-align:center;font-weight:600">Grade</th>
          </tr></thead>
          <tbody>${stores.map(s => {
            const grade = scoreGrade(s.score || 0);
            return `<tr style="border-top:1px solid var(--border)">
              <td style="padding:8px 10px;font-weight:500">${esc(s.store_name || '')}</td>
              <td style="padding:8px 6px;text-align:right">${n(s.orders)}</td>
              <td style="padding:8px 6px;text-align:right">${n(s.fulfilment, 1)}%</td>
              <td style="padding:8px 6px;text-align:right;color:${(s.waste || 0) > 5 ? '#dc2626' : 'inherit'}">${n(s.waste)}</td>
              <td style="padding:8px 6px;text-align:right">${n(s.returns)}</td>
              <td style="padding:8px 6px;text-align:right;color:${(s.cutoff_violations || 0) > 0 ? '#dc2626' : 'inherit'}">${n(s.cutoff_violations)}</td>
              <td style="padding:8px 6px;text-align:right;font-weight:700">${n(s.score, 0)}</td>
              <td style="padding:8px 10px;text-align:center">${gradeBadge(grade)}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`;
    }
  }

  // Cutoff Violations detail
  const cutEl = document.getElementById('exec-cmd-cutoff');
  if (cutEl) {
    const violations = data.cutoff_violations_detail || [];
    if (violations.length === 0) {
      cutEl.innerHTML = `<div class="card" style="padding:16px;text-align:center;color:var(--t3);font-size:12px">No cutoff violations</div>`;
    } else {
      cutEl.innerHTML = `<div class="card" style="overflow-x:auto;padding:0">
        <table style="width:100%;font-size:11px;border-collapse:collapse;white-space:nowrap">
          <thead><tr style="background:var(--bg2)">
            <th style="padding:8px 10px;text-align:left;font-weight:600">Order ID</th>
            <th style="padding:8px 6px;text-align:left;font-weight:600">Store</th>
            <th style="padding:8px 6px;text-align:left;font-weight:600">Status</th>
            <th style="padding:8px 10px;text-align:left;font-weight:600">Time</th>
          </tr></thead>
          <tbody>${violations.map(v => `<tr style="border-top:1px solid var(--border)">
            <td style="padding:8px 10px;font-weight:500;color:var(--theme, #db2777)">${esc(v.order_id || '')}</td>
            <td style="padding:8px 6px">${esc(v.store_name || v.store_id || '')}</td>
            <td style="padding:8px 6px">${esc(v.status || '')}</td>
            <td style="padding:8px 10px;font-size:10px;color:var(--t3)">${esc(v.time || '')}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
    }
  }
}

/** Render alert setup form */
function _fillAlertSetup(cfg) {
  const el = document.getElementById('exec-cmd-alert-setup');
  if (!el) return;

  function chk(key) { return cfg[key] ? 'checked' : ''; }
  function val(key, def) { return cfg[key] != null ? cfg[key] : (def || ''); }

  el.innerHTML = `<div class="card" style="padding:16px">
    <div style="font-size:12px;font-weight:700;margin-bottom:12px;color:var(--theme, #db2777)">Alert Thresholds</div>

    <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;margin-bottom:16px">
      <label style="font-size:11px">Daily waste threshold (items)</label>
      <div style="display:flex;gap:6px;align-items:center">
        <input type="number" id="alert-waste-daily" class="inp" style="width:70px;font-size:11px" value="${val('waste_daily_threshold', 10)}">
        <label style="font-size:10px"><input type="checkbox" id="alert-waste-daily-en" ${chk('waste_daily_enabled')}> On</label>
      </div>

      <label style="font-size:11px">Waste spike % (vs avg)</label>
      <div style="display:flex;gap:6px;align-items:center">
        <input type="number" id="alert-waste-spike" class="inp" style="width:70px;font-size:11px" value="${val('waste_spike_pct', 50)}">
        <label style="font-size:10px"><input type="checkbox" id="alert-waste-spike-en" ${chk('waste_spike_enabled')}> On</label>
      </div>

      <label style="font-size:11px">Cutoff violations alert</label>
      <div>
        <label style="font-size:10px"><input type="checkbox" id="alert-cutoff-en" ${chk('cutoff_enabled')}> On</label>
      </div>

      <label style="font-size:11px">Low fulfilment threshold (%)</label>
      <div style="display:flex;gap:6px;align-items:center">
        <input type="number" id="alert-low-ful" class="inp" style="width:70px;font-size:11px" value="${val('low_fulfilment_threshold', 85)}">
        <label style="font-size:10px"><input type="checkbox" id="alert-low-ful-en" ${chk('low_fulfilment_enabled')}> On</label>
      </div>

      <label style="font-size:11px">High returns threshold (count)</label>
      <div style="display:flex;gap:6px;align-items:center">
        <input type="number" id="alert-high-ret" class="inp" style="width:70px;font-size:11px" value="${val('high_returns_threshold', 5)}">
        <label style="font-size:10px"><input type="checkbox" id="alert-high-ret-en" ${chk('high_returns_enabled')}> On</label>
      </div>
    </div>

    <div style="font-size:12px;font-weight:700;margin-bottom:8px;color:var(--theme, #db2777)">Notification Channels</div>
    <div style="display:flex;gap:16px;margin-bottom:16px;font-size:11px">
      <label><input type="checkbox" id="alert-ch-inapp" ${chk('channel_inapp')}> In-App</label>
      <label><input type="checkbox" id="alert-ch-email" ${chk('channel_email')}> Email</label>
      <label><input type="checkbox" id="alert-ch-line" ${chk('channel_line')}> LINE</label>
    </div>

    <button class="btn btn-primary" onclick="BakerySection.saveAlertConfig()" style="font-size:12px">Save Alert Config</button>
  </div>`;
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

      ${secTitle('Top Ordered Products')}
      <div id="exec-prod-top" style="margin-bottom:20px">${SPG.ui.skeleton(50, 4)}</div>

      ${secTitle('Orders by Category')}
      <div id="exec-prod-cats-chart" style="margin-bottom:20px">${SPG.ui.skeleton(40, 3)}</div>

      ${secTitle('Revenue & Profit')}
      <div id="exec-prod-revenue" style="margin-bottom:20px"></div>
    </div>`, 'Bakery');
};

BK.loadExecProduct = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  const data = await loadExecData();
  if (!data) return;
  _fillExecProduct(data);
};

function _fillExecProduct(data) {
  const topOrdered = data.top_ordered || [];
  const byCategory = data.by_category || [];

  // Build category filter from by_category data
  const catEl = document.getElementById('exec-prod-cats');
  if (catEl) {
    const cats = ['All', ...byCategory.map(c => c.category_name)];
    catEl.innerHTML = `<div class="fl-bar" style="gap:6px;flex-wrap:wrap">${cats.map(c =>
      `<button class="btn btn-sm${(S.execCatFilter === c.toLowerCase() || (c === 'All' && S.execCatFilter === 'all')) ? ' btn-primary' : ' btn-outline'}"
        onclick="BakerySection.setExecCat('${esc(c.toLowerCase())}')" style="font-size:11px;padding:5px 12px">${esc(c)}</button>`
    ).join('')}</div>`;
  }

  // Top ordered products — bar chart style
  const topEl = document.getElementById('exec-prod-top');
  if (topEl) {
    if (topOrdered.length === 0) {
      topEl.innerHTML = `<div class="card" style="padding:20px;text-align:center;color:var(--t3);font-size:12px">No product data for this period</div>`;
    } else {
      const maxCount = Math.max(...topOrdered.map(p => p.count || 0));
      topEl.innerHTML = topOrdered.map(pr => {
        const barW = maxCount > 0 ? ((pr.count || 0) / maxCount * 100) : 0;
        return `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
            <span style="font-weight:500">${esc(pr.product_name || '')}</span>
            <span style="font-weight:700;color:var(--theme, #db2777)">${n(pr.count)}</span>
          </div>
          <div style="height:8px;background:var(--bg2);border-radius:4px;overflow:hidden">
            <div style="width:${barW}%;height:100%;background:var(--theme, #db2777);border-radius:4px"></div>
          </div>
        </div>`;
      }).join('');
    }
  }

  // Orders by category
  const catChart = document.getElementById('exec-prod-cats-chart');
  if (catChart) {
    if (byCategory.length === 0) {
      catChart.innerHTML = `<div class="card" style="padding:20px;text-align:center;color:var(--t3);font-size:12px">No category data</div>`;
    } else {
      const maxQty = Math.max(...byCategory.map(c => c.qty || 0));
      const catColors = ['#db2777', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#ea580c', '#0891b2'];
      catChart.innerHTML = `<div class="card" style="padding:14px">` + byCategory.map((c, i) => {
        const barW = maxQty > 0 ? ((c.qty || 0) / maxQty * 100) : 0;
        const color = catColors[i % catColors.length];
        return `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
            <span style="font-weight:500">${esc(c.category_name || '')}</span>
            <span style="color:var(--t3)">${n(c.qty)} items</span>
          </div>
          <div style="height:8px;background:var(--bg2);border-radius:4px;overflow:hidden">
            <div style="width:${barW}%;height:100%;background:${color};border-radius:4px"></div>
          </div>
        </div>`;
      }).join('') + `</div>`;
    }
  }

  // Revenue & Profit — cross-module placeholder
  const revEl = document.getElementById('exec-prod-revenue');
  if (revEl) {
    revEl.innerHTML = `<div class="card" style="padding:24px;text-align:center">
      <div style="display:flex;justify-content:center;gap:6px;margin-bottom:8px">
        ${cmBadge('Sales')} ${cmBadge('BC')}
      </div>
      <div style="font-size:13px;font-weight:600;color:var(--t3);margin-bottom:4px">Revenue & Profit Analysis</div>
      <div style="font-size:11px;color:var(--t3)">Data from Sales module coming soon</div>
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
    </div>`, 'Bakery');
};

BK.loadExecStore = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  const data = await loadExecData();
  if (!data) return;
  _fillExecStore(data);
};

function _fillExecStore(data) {
  const stores = data.store_health || [];

  // Store comparison with visual bars
  const cmpEl = document.getElementById('exec-store-compare');
  if (cmpEl) {
    if (stores.length === 0) {
      cmpEl.innerHTML = `<div class="card" style="padding:20px;text-align:center;color:var(--t3);font-size:12px">No store data for this period</div>`;
    } else {
      cmpEl.innerHTML = stores.map(s => {
        const ful = s.fulfilment || 0;
        const was = s.waste || 0;
        const ret = s.returns || 0;
        const total = ful + was + ret;
        const fW = total > 0 ? (ful / total * 100) : 0;
        const wW = total > 0 ? (was / total * 100) : 0;
        const rW = total > 0 ? (ret / total * 100) : 0;
        const grade = scoreGrade(s.score || 0);
        return `<div class="card" style="padding:12px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-size:12px;font-weight:600">${esc(s.store_name || '')}</div>
            <div style="display:flex;align-items:center;gap:8px">
              <div style="font-size:14px;font-weight:900">${n(s.score, 0)}</div>
              ${gradeBadge(grade)}
            </div>
          </div>
          <div style="display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--bg2)">
            <div style="width:${fW}%;background:#16a34a" title="Fulfilment ${n(ful, 1)}%"></div>
            <div style="width:${wW}%;background:#dc2626" title="Waste ${n(was)}"></div>
            <div style="width:${rW}%;background:#ea580c" title="Returns ${n(ret)}"></div>
          </div>
          <div style="display:flex;gap:12px;margin-top:6px;font-size:10px;color:var(--t3)">
            <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#16a34a;margin-right:3px"></span>Fulfil ${n(ful, 1)}%</span>
            <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#dc2626;margin-right:3px"></span>Waste ${n(was)}</span>
            <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ea580c;margin-right:3px"></span>Returns ${n(ret)}</span>
          </div>
          <div style="display:flex;gap:12px;margin-top:4px;font-size:10px;color:var(--t3)">
            <span>Orders: ${n(s.orders)}</span>
            ${(s.cutoff_violations || 0) > 0 ? `<span style="color:#dc2626">Cutoff violations: ${n(s.cutoff_violations)}</span>` : ''}
          </div>
        </div>`;
      }).join('');
    }
  }

  // Deep Dive for lowest scoring store
  const ddEl = document.getElementById('exec-store-deep');
  if (ddEl && stores.length > 0) {
    const sorted = [...stores].sort((a, b) => (a.score || 0) - (b.score || 0));
    const worst = sorted[0];
    const grade = scoreGrade(worst.score || 0);
    ddEl.innerHTML = `<div class="card" style="padding:0;overflow:hidden;border:1px solid rgba(219,39,119,.2)">
      <div style="background:linear-gradient(135deg,#fce7f3,#fdf2f8);padding:12px 14px;border-bottom:1px solid rgba(219,39,119,.1)">
        <div style="font-size:12px;font-weight:700;color:var(--theme, #db2777)">Deep Dive: ${esc(worst.store_name || '')}</div>
        <div style="font-size:10px;color:var(--t3)">Lowest scoring store — score ${n(worst.score, 0)} ${gradeBadge(grade)}</div>
      </div>
      <div style="padding:14px;display:grid;grid-template-columns:repeat(2,1fr);gap:10px">
        <div class="card" style="padding:10px;text-align:center;margin:0">
          ${cmBadge('BC')}
          <div style="font-size:18px;font-weight:900;color:#dc2626;margin-top:4px">${n(worst.waste)}</div>
          <div style="font-size:10px;color:var(--t3)">waste items</div>
        </div>
        <div class="card" style="padding:10px;text-align:center;margin:0">
          ${cmBadge('BC')}
          <div style="font-size:18px;font-weight:900;color:${(worst.fulfilment || 0) < 85 ? '#dc2626' : '#16a34a'};margin-top:4px">${n(worst.fulfilment, 1)}%</div>
          <div style="font-size:10px;color:var(--t3)">fulfilment rate</div>
        </div>
        <div class="card" style="padding:10px;text-align:center;margin:0">
          ${cmBadge('BC')}
          <div style="font-size:18px;font-weight:900;color:#ea580c;margin-top:4px">${n(worst.returns)}</div>
          <div style="font-size:10px;color:var(--t3)">returns</div>
        </div>
        <div class="card" style="padding:10px;text-align:center;margin:0">
          ${cmBadge('BC')}
          <div style="font-size:18px;font-weight:900;color:${(worst.cutoff_violations || 0) > 0 ? '#dc2626' : '#16a34a'};margin-top:4px">${n(worst.cutoff_violations)}</div>
          <div style="font-size:10px;color:var(--t3)">cutoff violations</div>
        </div>
      </div>
    </div>`;
  } else if (ddEl) {
    ddEl.innerHTML = '';
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

      ${secTitle('Orders by Category')}
      <div id="exec-demand-cats" style="margin-bottom:20px">${SPG.ui.skeleton(40, 3)}</div>

      ${secTitle('Top Ordered Products')}
      <div id="exec-demand-top" style="margin-bottom:20px">${SPG.ui.skeleton(50, 5)}</div>

      ${secTitle('Quota Utilization Heatmap')}
      <div id="exec-demand-heat" style="margin-bottom:20px"></div>
    </div>`, 'Bakery');
};

BK.loadExecDemand = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  const data = await loadExecData();
  if (!data) return;
  _fillExecDemand(data);
};

function _fillExecDemand(data) {
  const topOrdered = data.top_ordered || [];
  const byCategory = data.by_category || [];

  // Category summary cards
  const catEl = document.getElementById('exec-demand-cats');
  if (catEl) {
    if (byCategory.length === 0) {
      catEl.innerHTML = `<div class="card" style="padding:20px;text-align:center;color:var(--t3);font-size:12px">No category data</div>`;
    } else {
      catEl.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">` +
        byCategory.map(c => metricCard(c.category_name || '', n(c.qty), 'items ordered', ['BC'])).join('') +
        `</div>`;
    }
  }

  // Top ordered list
  const topEl = document.getElementById('exec-demand-top');
  if (topEl) {
    if (topOrdered.length === 0) {
      topEl.innerHTML = `<div class="card" style="padding:20px;text-align:center;color:var(--t3);font-size:12px">No product data</div>`;
    } else {
      topEl.innerHTML = `<div class="card" style="overflow-x:auto;padding:0">
        <table id="exec-demand-top-tbl" style="width:100%;font-size:11px;border-collapse:collapse">
          <thead><tr style="background:var(--bg2)">
            <th style="padding:8px 10px;text-align:center;font-weight:600">#</th>
            ${SPG.ui.sortTh('exec-demand-top-tbl','product_name','Product')}
            ${SPG.ui.sortTh('exec-demand-top-tbl','count','Qty Ordered',' style="text-align:right"')}
          </tr></thead>
          <tbody>${topOrdered.map((pr, i) => `<tr style="border-top:1px solid var(--border)">
            <td style="padding:8px 10px;text-align:center;color:var(--t3)">${i + 1}</td>
            <td style="padding:8px 10px;font-weight:500">${esc(pr.product_name || '')}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:700;color:var(--theme, #db2777)">${n(pr.count)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
    }
  }

  // Quota Heatmap — coming soon placeholder (no specific endpoint)
  const hEl = document.getElementById('exec-demand-heat');
  if (hEl) {
    hEl.innerHTML = `<div class="card" style="padding:24px;text-align:center">
      <div style="font-size:13px;font-weight:600;color:var(--t3);margin-bottom:4px">Detailed Quota Utilization Heatmap</div>
      <div style="font-size:11px;color:var(--t3)">Coming soon — requires per-product daily quota data</div>
    </div>`;
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
          ${secTitle('Waste Snapshot')}
          <div id="exec-waste-snapshot"></div>
        </div>
        <div>
          ${secTitle('Waste by Reason')}
          <div id="exec-waste-sources"></div>
        </div>
      </div>

      ${secTitle('Who Created Waste')}
      <div id="exec-waste-staff">${SPG.ui.skeleton(40, 4)}</div>
    </div>`, 'Bakery');
};

BK.loadExecWaste = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  const data = await loadExecData();
  if (!data) return;
  _fillExecWaste(data);
};

function _fillExecWaste(data) {
  const ws = data.waste_snapshot || {};
  const byReason = (ws.by_reason || []);

  // Waste Snapshot summary
  const snapEl = document.getElementById('exec-waste-snapshot');
  if (snapEl) {
    snapEl.innerHTML = `<div class="card" style="padding:16px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--t3)">Today</div>
          <div style="font-size:24px;font-weight:900;color:#dc2626">${n(ws.today)}</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--t3)">This Week</div>
          <div style="font-size:24px;font-weight:900;color:#ea580c">${n(ws.week)}</div>
        </div>
      </div>
      <div style="text-align:center;padding-top:10px;border-top:1px solid var(--border)">
        <div style="font-size:10px;color:var(--t3)">Avg per Day</div>
        <div style="font-size:20px;font-weight:900;color:var(--theme, #db2777)">${n(ws.avg_day, 1)}</div>
      </div>
      <div style="margin-top:12px;display:flex;justify-content:center;gap:6px">
        ${cmBadge('BC')}
      </div>
    </div>`;
  }

  // Waste by reason bars
  const srcEl = document.getElementById('exec-waste-sources');
  if (srcEl) {
    if (byReason.length === 0) {
      srcEl.innerHTML = `<div class="card" style="padding:16px;text-align:center;color:var(--t3);font-size:12px">No waste reason data</div>`;
    } else {
      const maxCount = Math.max(...byReason.map(r => r.count || 0));
      srcEl.innerHTML = `<div class="card" style="padding:14px">` + byReason.map(r => {
        const barW = maxCount > 0 ? ((r.count || 0) / maxCount * 100) : 0;
        return `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
            <span style="font-weight:500">${esc(r.reason || '')}</span>
            <span style="color:var(--t3)">${n(r.count)}</span>
          </div>
          <div style="height:8px;background:var(--bg2);border-radius:4px;overflow:hidden">
            <div style="width:${barW}%;height:100%;background:${(r.count || 0) >= (maxCount * 0.7) ? '#dc2626' : 'var(--theme, #db2777)'};border-radius:4px"></div>
          </div>
        </div>`;
      }).join('') + `</div>`;
    }
  }

  // Staff waste — not in API, show coming soon
  const staffEl = document.getElementById('exec-waste-staff');
  if (staffEl) {
    staffEl.innerHTML = `<div class="card" style="padding:24px;text-align:center">
      <div style="display:flex;justify-content:center;gap:6px;margin-bottom:8px">
        ${cmBadge('BC')} ${cmBadge('HR')}
      </div>
      <div style="font-size:13px;font-weight:600;color:var(--t3);margin-bottom:4px">Staff Waste Accountability</div>
      <div style="font-size:11px;color:var(--t3)">Coming soon — requires staff-level waste tracking data</div>
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

      <div id="exec-qual-kpis" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px">
        ${SPG.ui.skeleton(60, 3)}
      </div>

      ${secTitle('Returns by Reason')}
      <div id="exec-qual-reasons" style="margin-bottom:20px">${SPG.ui.skeleton(40, 4)}</div>

      <div id="exec-qual-ai"></div>
    </div>`, 'Bakery');
};

BK.loadExecQuality = async function(p) {
  await BK.initBakery();
  BK.buildBakerySidebar();

  const data = await loadExecData();
  if (!data) return;
  _fillExecQuality(data);
};

function _fillExecQuality(data) {
  const k = data.kpis || {};
  const returnsByReason = data.returns_by_reason || [];

  // KPI cards
  const kpiEl = document.getElementById('exec-qual-kpis');
  if (kpiEl) {
    const totalOrders = k.total_orders || 0;
    const returnRate = totalOrders > 0 ? ((k.returns || 0) / totalOrders * 100) : 0;
    kpiEl.innerHTML =
      metricCard('Returns', n(k.returns), 'count', ['BC']) +
      metricCard('Return Rate', n(returnRate, 1) + '%', 'of orders', ['BC']) +
      metricCard('Total Orders', n(k.total_orders), 'period total', ['BC']);
  }

  // Returns by Reason
  const rEl = document.getElementById('exec-qual-reasons');
  if (rEl) {
    if (returnsByReason.length === 0) {
      rEl.innerHTML = `<div class="card" style="padding:20px;text-align:center;color:var(--t3);font-size:12px">No return data for this period</div>`;
    } else {
      const maxCount = Math.max(...returnsByReason.map(r => r.count || 0));
      rEl.innerHTML = `<div class="card" style="padding:14px">` + returnsByReason.map(r => {
        const barW = maxCount > 0 ? ((r.count || 0) / maxCount * 100) : 0;
        return `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
            <span style="font-weight:500">${esc(r.reason || '')}</span>
            <span style="font-weight:700;color:var(--theme, #db2777)">${n(r.count)}</span>
          </div>
          <div style="height:8px;background:var(--bg2);border-radius:4px;overflow:hidden">
            <div style="width:${barW}%;height:100%;background:var(--theme, #db2777);border-radius:4px"></div>
          </div>
        </div>`;
      }).join('') + `</div>`;

      // Add table view
      rEl.innerHTML += `<div class="card" style="overflow-x:auto;padding:0;margin-top:8px">
        <table id="exec-qual-reason-tbl" style="width:100%;font-size:11px;border-collapse:collapse">
          <thead><tr style="background:var(--bg2)">
            ${SPG.ui.sortTh('exec-qual-reason-tbl','reason','Reason')}
            ${SPG.ui.sortTh('exec-qual-reason-tbl','count','Count',' style="text-align:right"')}
          </tr></thead>
          <tbody>${returnsByReason.map(r => `<tr style="border-top:1px solid var(--border)">
            <td style="padding:8px 10px;font-weight:500">${esc(r.reason || '')}</td>
            <td style="padding:8px 10px;text-align:right;font-weight:700;color:var(--theme, #db2777)">${n(r.count)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
    }
  }

  // AI Quality Insight — cosmetic, references real data
  const aiEl = document.getElementById('exec-qual-ai');
  if (aiEl) {
    const lines = [];
    if (returnsByReason.length > 0) {
      const topReason = [...returnsByReason].sort((a, b) => (b.count || 0) - (a.count || 0))[0];
      lines.push(insightLine('\u{1F6A8}', `"${esc(topReason.reason || '')}" is the top return reason with ${n(topReason.count)} case(s) — investigate root cause`));
    }
    if ((k.returns || 0) > 0 && (k.total_orders || 0) > 0) {
      const rate = ((k.returns || 0) / (k.total_orders || 1) * 100);
      if (rate > 5) {
        lines.push(insightLine('\u26A0\uFE0F', `Return rate is ${n(rate, 1)}% — above 5% threshold, consider quality review`));
      } else {
        lines.push(insightLine('\u2705', `Return rate is ${n(rate, 1)}% — within acceptable range`));
      }
    }
    if (lines.length === 0) {
      lines.push(insightLine('\u2705', 'Quality metrics look good for this period'));
    }
    aiEl.innerHTML = aiCard('Quality Insight', lines.join(''));
  }
}


// ═══════════════════════════════════════
// ONCLICK HANDLERS — extend BakerySection
// ═══════════════════════════════════════
Object.assign(window.BakerySection, {
  setExecPreset(preset) {
    S.execPreset = preset;
    S.execDash = null; // force reload with new date range
    const route = SPG.currentRoute;
    if (route) SPG.go('bakery/' + route);
  },

  setExecCat(cat) {
    S.execCatFilter = cat;
    SPG.go('bakery/exec-product');
  },

  async saveAlertConfig() {
    const formData = {
      waste_daily_threshold: Number(document.getElementById('alert-waste-daily')?.value || 10),
      waste_daily_enabled: document.getElementById('alert-waste-daily-en')?.checked || false,
      waste_spike_pct: Number(document.getElementById('alert-waste-spike')?.value || 50),
      waste_spike_enabled: document.getElementById('alert-waste-spike-en')?.checked || false,
      cutoff_enabled: document.getElementById('alert-cutoff-en')?.checked || false,
      low_fulfilment_threshold: Number(document.getElementById('alert-low-ful')?.value || 85),
      low_fulfilment_enabled: document.getElementById('alert-low-ful-en')?.checked || false,
      high_returns_threshold: Number(document.getElementById('alert-high-ret')?.value || 5),
      high_returns_enabled: document.getElementById('alert-high-ret-en')?.checked || false,
      channel_inapp: document.getElementById('alert-ch-inapp')?.checked || false,
      channel_email: document.getElementById('alert-ch-email')?.checked || false,
      channel_line: document.getElementById('alert-ch-line')?.checked || false,
    };
    try {
      await BK.api('saveAlertConfig', formData);
      S.alertConfig = formData;
      SPG.toast('Alert config saved', 'ok');
    } catch (e) {
      console.error('saveAlertConfig error:', e);
      SPG.toast('Failed to save alert config', 'error');
    }
  },
});


// ═══════════════════════════════════════
// SORT EVENT — re-render on column sort
// ═══════════════════════════════════════
document.addEventListener('spg-sort', (e) => {
  const id = e.detail.tableId;
  if (!S.execDash) return;
  if (id === 'exec-cmd-score-tbl') {
    _fillExecCommand(S.execDash);
  } else if (id === 'exec-demand-top-tbl') {
    _fillExecDemand(S.execDash);
  } else if (id === 'exec-qual-reason-tbl') {
    _fillExecQuality(S.execDash);
  }
});

})();
