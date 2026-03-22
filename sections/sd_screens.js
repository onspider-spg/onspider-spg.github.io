/**
 * SPG HUB v2.0.0 | 23 MAR 2026 | Siam Palette Group
 * sections/sd_screens.js — Dashboard (Store + Management view)
 * Layout: 100% match backup screens_sd.js (CSS classes: .kpi-row, .qb, .sl, .kpi-box)
 * API: One Union pattern (SD.api, SPG.go, SPG.shell)
 *
 * T1-T2 → redirect to Executive (no regular dashboard)
 * T3-T4 → Management Dashboard (KPI + admin widgets)
 * T5-T7 → Store Dashboard (KPI + quick buttons)
 *
 * Depends on: sd_core.js (SD global)
 */

(() => {
const S = SD.S;
const esc = SD.esc;
const fm = SD.fmtMoney;
const fms = SD.fmtMoneyShort;
const ui = SPG.ui;

let _dashLoading = false;
let _adminLoading = false;


// ═══════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════
function renderDashboard(p) {
  const s = SPG.api.getSession();
  if (!s) return SPG.shell('<div class="content">Loading...</div>', 'Sales Daily');

  // T1-T2 → Executive Dashboard
  if (SD.isOwner()) {
    setTimeout(() => SPG.go('sales/exec-cmd'), 0);
    return SPG.shell('<div class="content" style="display:flex;align-items:center;justify-content:center;color:var(--t3)">Redirecting...</div>', 'Sales Daily');
  }

  return SD.isMgmt() ? _renderMgmt(s) : _renderStore(s);
}


// ─── T1-T4 MANAGEMENT DASHBOARD ───
function _renderMgmt(s) {
  return SPG.shell(`<div class="toolbar"><div class="toolbar-title">Dashboard</div></div>
    <div class="content" id="dash-content">
      <div style="margin-bottom:14px"><div class="welcome-name">Welcome, ${esc(s.display_name || s.display_label)}</div><div class="welcome-meta">${esc(s.position_name || s.tier_id)} · Manager · ${esc(s.store_name || s.store_id)} · ${esc(s.dept_id)}</div></div>
      ${SD.renderStoreSelector()}
      <div id="dash-kpi" class="kpi-row kpi-4"><div class="skeleton sk-kpi"></div><div class="skeleton sk-kpi"></div><div class="skeleton sk-kpi"></div><div class="skeleton sk-kpi"></div></div>
      <div id="dash-chart" class="skeleton sk-card" style="height:160px"></div>
      <div id="dash-cash" class="skeleton sk-card" style="height:80px"></div>
      <div id="dash-anomaly"></div>
      <div id="dash-stores"></div>
      <div class="sl">📊 History</div>
      ${qb('📊', 'var(--gold-bg,rgba(212,150,10,.06))', 'var(--gold,#d4960a)', 'Sale History', 'ประวัติขาย', 'sale-history')}
      ${qb('📋', 'var(--rbg,#fef2f2)', 'var(--r,#dc2626)', 'Expense History', 'ประวัติจ่าย', 'expense-history')}
      <div class="sl">📝 Report</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        ${qb('📝', 'var(--obg,#fffbeb)', 'var(--o,#d97706)', 'Daily Report', '', 'daily-report')}
        ${qb('📊', 'var(--bbg,#dbeafe)', 'var(--b,#2563eb)', 'Daily Hub', 'สรุปรายวัน', 'daily-hub')}
        ${qb('📋', 'var(--acc2)', 'var(--acc)', 'Tasks', '', 'tasks')}
      </div>
      <div class="sl">⚙️ Admin</div>
      ${qb('📤', 'var(--gbg,#ecfdf5)', 'var(--g,#059669)', 'Account Review', 'Editable / Sync', 'acc-review')}
      ${qb('📡', 'var(--gold-bg,rgba(212,150,10,.06))', 'var(--gold,#d4960a)', 'Channels', 'ช่องทางขาย', 'channels')}
      ${qb('🏪', 'var(--bbg,#dbeafe)', 'var(--b,#2563eb)', 'Vendors', 'รายชื่อ vendor', 'vendors')}
    </div>`, 'Sales Daily');
}


// ─── T5-T7 STORE DASHBOARD ───
function _renderStore(s) {
  return SPG.shell(`<div class="toolbar"><div class="toolbar-title">Dashboard</div></div>
    <div class="content" id="dash-content">
      <div style="margin-bottom:14px"><div class="welcome-name">Welcome, ${esc(s.display_name || s.display_label)}</div><div class="welcome-meta">${esc(s.position_name || s.tier_id)} · Store Staff · ${esc(s.store_name || s.store_id)}</div></div>
      <div id="dash-kpi" class="kpi-row kpi-2"><div class="skeleton sk-kpi"></div><div class="skeleton sk-kpi"></div><div class="skeleton sk-kpi"></div><div class="skeleton sk-kpi"></div></div>
      <div class="sl">กรอกข้อมูล</div>
      ${qb('💰', 'var(--gold-bg,rgba(212,150,10,.06))', 'var(--gold,#d4960a)', 'กรอกยอดขาย', 'S1 Daily Sale', 'daily-sale', 'var(--gold,#d4960a)')}
      ${qb('🧾', 'var(--rbg,#fef2f2)', 'var(--r,#dc2626)', 'ค่าใช้จ่าย', 'S2 Expense', 'expense')}
      ${qb('📄', 'var(--bbg,#dbeafe)', 'var(--b,#2563eb)', 'Invoice', 'S3 Invoice', 'invoice')}
      ${qb('💵', 'var(--gbg,#ecfdf5)', 'var(--g,#059669)', 'เงินสดส่งมอบ', 'S4 Cash', 'cash')}
      <div class="sl">History & Report</div>
      ${qb('📊', 'var(--bg3)', 'var(--t2)', 'ประวัติขาย', '', 'sale-history')}
      ${qb('📋', 'var(--bg3)', 'var(--t2)', 'ประวัติจ่าย', '', 'expense-history')}
      ${qb('📝', 'var(--obg,#fffbeb)', 'var(--o,#d97706)', 'สรุปรายงาน', 'S8 Daily Report', 'daily-report')}
      ${qb('📋', 'var(--acc2)', 'var(--acc)', 'Follow-up Tasks', '', 'tasks')}
      ${qb('📊', 'var(--bbg,#dbeafe)', 'var(--b,#2563eb)', 'Daily Hub', 'สรุปรายวัน', 'daily-hub')}
    </div>`, 'Sales Daily');
}


// ─── LOAD DASHBOARD ───
async function loadDashboard(p) {
  await SD.initModule();
  if (!S.initLoaded) return;
  SD.buildSDSidebar();

  if (SD.isOwner()) return; // T1-T2 redirected

  const isMgmt = SD.isMgmt();

  // Use cached dashboard from init if available
  if (S.dashboard) {
    fillKPI(S.dashboard, isMgmt);
    if (isMgmt) loadAdminWidgets();
    return;
  }

  if (_dashLoading) return;
  _dashLoading = true;
  try {
    const data = await SD.api('get_dashboard', { store_id: SD.getStore() });
    S.dashboard = data;
    fillKPI(data, isMgmt);
    if (isMgmt) loadAdminWidgets();
  } catch (err) {
    SPG.toast('โหลด Dashboard ไม่ได้', 'error');
  } finally { _dashLoading = false; }
}


// ─── FILL KPI ───
function fillKPI(d, isMgmt) {
  const el = document.getElementById('dash-kpi');
  if (!el || !d) return;

  const today = d.today || {};
  const month = d.month || {};
  const yesterday = d.yesterday || {};
  const alerts = d.alerts || {};

  if (isMgmt) {
    el.className = 'kpi-row kpi-4';
    el.innerHTML = `
      ${kpiBox(fm(today.total_sales || 0), `<span style="color:var(--g,#059669)">●</span> Total Today`, today.is_recorded ? '⏳ Pending' : '❌ Missing', 'border-left:3px solid var(--gold,#d4960a)', 'color:var(--gold,#d4960a)')}
      ${kpiBox(fms(month.total || 0), 'เดือนนี้', (month.days_recorded || 0) + ' วัน')}
      ${kpiBox(fms(month.daily_average || 0), 'เฉลี่ย/วัน', '')}
      ${kpiBox(String(alerts.missing_days || 0), 'Pending Sync', 'days', '', alerts.missing_days > 0 ? 'color:var(--o,#d97706)' : '')}`;
  } else {
    el.className = 'kpi-row kpi-2';
    el.innerHTML = `
      ${kpiBox(fm(today.total_sales || 0), '📊 ยอดวันนี้', today.is_recorded ? '⏳ Pending' : '❌ Missing', 'border-left:3px solid var(--gold,#d4960a)', 'color:var(--gold,#d4960a)')}
      ${kpiBox(fms(month.total || 0), '📅 เดือนนี้', (month.days_recorded || 0) + ' วัน')}
      ${kpiBox(fms(month.daily_average || 0), '📈 เฉลี่ย', '')}
      ${kpiBox(fm(yesterday.total_sales || 0), '📉 เมื่อวาน', '')}`;
  }
}


// ─── ADMIN WIDGETS (T3-T4 management — parallel fetch) ───
async function loadAdminWidgets() {
  if (_adminLoading) return;
  _adminLoading = true;

  const sid = SD.getStore();
  const [chartData, cashData, anomalyData, storeData] = await Promise.all([
    SD.api('get_weekly_comparison', { store_id: sid }).catch(() => null),
    SD.api('get_cash_variance_history', { days: 7 }).catch(() => null),
    SD.api('get_anomalies', { store_id: sid }).catch(() => null),
    SD.api('get_store_status').catch(() => null),
  ]);

  // Chart
  const chartEl = document.getElementById('dash-chart');
  if (chartEl) {
    if (chartData) {
      chartEl.className = 'card';
      chartEl.style.height = 'auto';
      chartEl.innerHTML = `<div class="sl" style="margin-top:0">📈 This Week vs Last Week</div>
        ${renderLineChart(chartData)}
        <div style="display:flex;gap:12px;margin-top:6px;font-size:10px;flex-wrap:wrap">
          <span style="color:var(--g,#059669)">━ Revenue TW</span>
          <span style="color:var(--g,#059669);opacity:.4">┄ Revenue LW</span>
          <span style="color:var(--r,#dc2626)">━ Expense TW</span>
          <span style="color:var(--r,#dc2626);opacity:.4">┄ Expense LW</span>
        </div>`;
    } else { chartEl.innerHTML = ''; chartEl.className = ''; chartEl.style.height = '0'; }
  }

  // Cash variance
  const cashEl = document.getElementById('dash-cash');
  if (cashEl) {
    if (cashData?.days?.length) {
      const isAll = SD.getStore() === 'ALL';
      const filtered = isAll ? cashData.days.filter(d => !d.matched) : cashData.days;
      if (filtered.length) {
        cashEl.className = 'card';
        cashEl.style.height = 'auto';
        cashEl.innerHTML = `<div class="sl" style="margin-top:0">💰 Cash Variance${isAll ? ' (mismatch only)' : ' (7 วัน)'}</div>
          <div style="font-size:11px;line-height:2;color:var(--t2)">${filtered.map(d => {
            const label = isAll ? `${d.store_id} ${d.day_label || d.date}` : (d.day_label || d.date);
            if (d.matched) return `${label}: <span style="color:var(--g,#059669)">✓ Match</span>`;
            return `${label}: <span style="color:var(--r,#dc2626)">${fm(d.variance || 0)}</span>`;
          }).join(' · ')}</div>`;
      } else { cashEl.innerHTML = ''; cashEl.className = ''; cashEl.style.height = '0'; }
    } else { cashEl.innerHTML = ''; cashEl.className = ''; cashEl.style.height = '0'; }
  }

  // Anomalies
  const anomalyEl = document.getElementById('dash-anomaly');
  if (anomalyEl) {
    if (anomalyData?.alerts?.length) {
      anomalyEl.innerHTML = `<div class="card" style="margin-bottom:10px">
        <div class="sl" style="margin:0;color:var(--r,#dc2626)">🔍 ต้องตรวจสอบ</div>
        <div style="font-size:11px">${anomalyData.alerts.map(a =>
          `<div style="padding:3px 0;color:${a.severity === 'high' ? 'var(--r,#dc2626)' : 'var(--o,#d97706)'}">⚠ ${esc(a.message)}</div>`
        ).join('')}</div>
      </div>`;
    } else { anomalyEl.innerHTML = ''; }
  }

  // Store status
  const storesEl = document.getElementById('dash-stores');
  if (storesEl) {
    if (storeData?.stores?.length) {
      storesEl.innerHTML = `<div class="card" style="margin-bottom:10px">
        <div class="sl" style="margin-top:0">🏪 Store Status</div>
        <table class="tbl"><thead><tr><th>Store</th><th>Status</th><th>Total</th><th>Sync</th></tr></thead>
        <tbody>${storeData.stores.map(st => `<tr>
          <td>${esc(st.store_id)}</td>
          <td>${st.has_sale ? '<span class="sts sts-ok">✓</span>' : '<span class="sts sts-err">✗</span>'}</td>
          <td style="font-weight:600">${st.has_sale ? fm(st.total_sales) : '<span style="color:var(--t4)">—</span>'}</td>
          <td>${st.sync_status === 'synced' ? '<span class="sts sts-ok">Synced</span>' : '<span class="sts sts-pend">Pending</span>'}</td>
        </tr>`).join('')}</tbody></table>
      </div>`;
    } else { storesEl.innerHTML = ''; }
  }
  _adminLoading = false;
}


// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
function kpiBox(value, label, sub, boxStyle, valStyle) {
  return `<div class="kpi-box"${boxStyle ? ` style="${boxStyle}"` : ''}>
    <div class="kpi-label">${label}</div>
    <div class="kpi-val"${valStyle ? ` style="${valStyle}"` : ''}>${value}</div>
    ${sub ? `<div class="kpi-label">${sub}</div>` : ''}
  </div>`;
}

function qb(icon, bg, col, label, sub, route, borderCol) {
  const bc = borderCol ? `border-left-color:${borderCol}` : '';
  return `<div class="qb" style="${bc}" onclick="SPG.go('sales/${route}')">
    <div class="qb-icon" style="background:${bg};color:${col}">${icon}</div>
    <div style="flex:1;min-width:0"><div class="qb-label">${label}</div>${sub ? `<div class="qb-sub">${sub}</div>` : ''}</div>
    <div class="qb-arr">→</div>
  </div>`;
}

function renderLineChart(data) {
  const stw = data.sales_tw || [0,0,0,0,0,0,0];
  const slw = data.sales_lw || [0,0,0,0,0,0,0];
  const etw = data.exp_tw || [0,0,0,0,0,0,0];
  const elw = data.exp_lw || [0,0,0,0,0,0,0];
  const labels = data.labels || ['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'];
  const all = [...stw, ...slw, ...etw, ...elw];
  const max = Math.max(...all, 1);
  const W = 320, H = 100, PX = 30, PY = 10;
  const cw = W - PX * 2, ch = H - PY * 2;
  const x = (i) => PX + (i / 6) * cw;
  const y = (v) => PY + ch - (v / max) * ch;
  const line = (arr, color, dash) => {
    const pts = arr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" ${dash ? 'stroke-dasharray="4,3"' : ''} stroke-linecap="round" stroke-linejoin="round"/>`;
  };
  const dots = (arr, color) => arr.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.5" fill="${color}"/>`).join('');
  const grid = [0, 0.25, 0.5, 0.75, 1].map(p => {
    const yy = PY + ch - p * ch;
    const val = Math.round(max * p);
    return `<line x1="${PX}" y1="${yy}" x2="${W - PX}" y2="${yy}" stroke="#eee" stroke-width="0.5"/><text x="${PX - 4}" y="${yy + 3}" text-anchor="end" fill="#bbb" font-size="7">${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}</text>`;
  }).join('');
  const xLabels = labels.map((l, i) => `<text x="${x(i).toFixed(1)}" y="${H - 1}" text-anchor="middle" fill="#999" font-size="8">${l}</text>`).join('');

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;font-family:var(--font)">
    ${grid}${xLabels}
    ${line(slw, '#86efac', true)}${line(stw, '#059669', false)}
    ${line(elw, '#fca5a5', true)}${line(etw, '#dc2626', false)}
    ${dots(stw, '#059669')}${dots(etw, '#dc2626')}
  </svg>`;
}


// ═══════════════════════════════════════
// REGISTER TO PARENT
// ═══════════════════════════════════════
SD.renderDashboard = renderDashboard;
SD.loadDashboard = loadDashboard;

})();
