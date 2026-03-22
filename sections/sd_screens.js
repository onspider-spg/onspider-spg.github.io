/**
 * SPG HUB v1.0.0 | 22 MAR 2026 | Siam Palette Group
 * sections/sd_screens.js — Dashboard (Store + Management view)
 * T1-T2 → redirect to Executive (no regular dashboard)
 * T3-T4 → Management Dashboard (KPI + admin widgets)
 * T5-T7 → Store Dashboard (KPI + quick buttons)
 *
 * Depends on: sd_core.js (SD global)
 * Design: Blue #2563eb accent, matches Home layout via SPG.shell/toolbar
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


// ─── MANAGEMENT DASHBOARD (T3-T4) ───
function _renderMgmt(s) {
  return SPG.shell(SPG.toolbar('Dashboard') + `
    <div class="content" id="dash-content">
      <div style="margin-bottom:16px">
        <div style="font-size:16px;font-weight:900;letter-spacing:-.5px" class="grad-text">Welcome, ${esc(s.display_name || s.display_label)}</div>
        <div style="font-size:11px;color:var(--t3);margin-top:2px">${esc(s.position_name || s.tier_id)} · Manager · ${esc(s.store_name || s.store_id)} · ${esc(s.dept_id)}</div>
      </div>
      ${SD.renderStoreSelector()}
      <div id="dash-kpi" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">
        ${ui.skeleton(72, 4)}
      </div>
      <div id="dash-chart" style="margin-bottom:12px">${ui.skeleton(160)}</div>
      <div id="dash-cash" style="margin-bottom:12px">${ui.skeleton(80)}</div>
      <div id="dash-anomaly"></div>
      <div id="dash-stores"></div>
      <div class="sec-title">History</div>
      ${_qCard('📊', 'Sale History', 'ประวัติขาย', 'sale-history')}
      ${_qCard('📋', 'Expense History', 'ประวัติจ่าย', 'expense-history')}
      <div class="sec-title">Report</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${_qCard('📝', 'Daily Report', '', 'daily-report')}
        ${_qCard('📊', 'Daily Hub', 'สรุปรายวัน', 'daily-hub')}
        ${_qCard('📋', 'Tasks', '', 'tasks')}
      </div>
      <div class="sec-title">Admin</div>
      ${_qCard('📤', 'Account Review', 'Editable / Sync', 'acc-review')}
    </div>`, 'Sales Daily');
}


// ─── STORE DASHBOARD (T5-T7) ───
function _renderStore(s) {
  return SPG.shell(SPG.toolbar('Dashboard') + `
    <div class="content" id="dash-content">
      <div style="margin-bottom:16px">
        <div style="font-size:16px;font-weight:900;letter-spacing:-.5px" class="grad-text">Welcome, ${esc(s.display_name || s.display_label)}</div>
        <div style="font-size:11px;color:var(--t3);margin-top:2px">${esc(s.position_name || s.tier_id)} · Store Staff · ${esc(s.store_name || s.store_id)}</div>
      </div>
      <div id="dash-kpi" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        ${ui.skeleton(72, 4)}
      </div>
      <div class="sec-title">กรอกข้อมูล</div>
      ${_qCard('💰', 'กรอกยอดขาย', 'S1 Daily Sale', 'daily-sale')}
      ${_qCard('🧾', 'ค่าใช้จ่าย', 'S2 Expense', 'expense')}
      ${_qCard('📄', 'Invoice', 'S3 Invoice', 'invoice')}
      ${_qCard('💵', 'เงินสดส่งมอบ', 'S4 Cash', 'cash')}
      <div class="sec-title">History & Report</div>
      ${_qCard('📊', 'ประวัติขาย', '', 'sale-history')}
      ${_qCard('📋', 'ประวัติจ่าย', '', 'expense-history')}
      ${_qCard('📝', 'สรุปรายงาน', 'S8 Daily Report', 'daily-report')}
      ${_qCard('📋', 'Follow-up Tasks', '', 'tasks')}
      ${_qCard('📊', 'Daily Hub', 'สรุปรายวัน', 'daily-hub')}
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
    _fillKPI(S.dashboard, isMgmt);
    if (isMgmt) _loadAdminWidgets();
    return;
  }

  if (_dashLoading) return;
  _dashLoading = true;
  try {
    const data = await SD.api('get_dashboard', { store_id: SD.getStore() });
    S.dashboard = data;
    _fillKPI(data, isMgmt);
    if (isMgmt) _loadAdminWidgets();
  } catch (err) {
    SPG.toast('โหลด Dashboard ไม่ได้', 'error');
  } finally { _dashLoading = false; }
}


// ─── FILL KPI ───
function _fillKPI(d, isMgmt) {
  const el = document.getElementById('dash-kpi');
  if (!el || !d) return;

  const today = d.today || {};
  const month = d.month || {};
  const yesterday = d.yesterday || {};
  const alerts = d.alerts || {};

  if (isMgmt) {
    el.style.gridTemplateColumns = 'repeat(4,1fr)';
    el.innerHTML = `
      ${_kpi(fm(today.total_sales || 0), 'Total Today', today.is_recorded ? '⏳ Pending' : '❌ Missing', 'var(--theme)')}
      ${_kpi(fms(month.total || 0), 'เดือนนี้', (month.days_recorded || 0) + ' วัน')}
      ${_kpi(fms(month.daily_average || 0), 'เฉลี่ย/วัน', '')}
      ${_kpi(String(alerts.missing_days || 0), 'Pending Sync', 'days', alerts.missing_days > 0 ? 'var(--orange)' : '')}`;
  } else {
    el.style.gridTemplateColumns = '1fr 1fr';
    el.innerHTML = `
      ${_kpi(fm(today.total_sales || 0), '📊 ยอดวันนี้', today.is_recorded ? '⏳ Pending' : '❌ Missing', 'var(--theme)')}
      ${_kpi(fms(month.total || 0), '📅 เดือนนี้', (month.days_recorded || 0) + ' วัน')}
      ${_kpi(fms(month.daily_average || 0), '📈 เฉลี่ย', '')}
      ${_kpi(fm(yesterday.total_sales || 0), '📉 เมื่อวาน', '')}`;
  }
}


// ─── ADMIN WIDGETS (T3-T4 management — parallel fetch) ───
async function _loadAdminWidgets() {
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
      chartEl.innerHTML = `<div class="card">
        <div class="sec-title" style="margin-top:0">📈 This Week vs Last Week</div>
        ${_renderLineChart(chartData)}
        <div style="display:flex;gap:12px;margin-top:6px;font-size:10px;flex-wrap:wrap">
          <span style="color:var(--green)">━ Revenue TW</span>
          <span style="color:var(--green);opacity:.4">┄ Revenue LW</span>
          <span style="color:var(--red)">━ Expense TW</span>
          <span style="color:var(--red);opacity:.4">┄ Expense LW</span>
        </div>
      </div>`;
    } else { chartEl.innerHTML = ''; }
  }

  // Cash variance
  const cashEl = document.getElementById('dash-cash');
  if (cashEl) {
    if (cashData?.days?.length) {
      const isAll = SD.getStore() === 'ALL';
      const filtered = isAll ? cashData.days.filter(d => !d.matched) : cashData.days;
      if (filtered.length) {
        cashEl.innerHTML = `<div class="card">
          <div class="sec-title" style="margin-top:0">💰 Cash Variance${isAll ? ' (mismatch only)' : ' (7 วัน)'}</div>
          <div style="font-size:11px;line-height:2;color:var(--t2)">${filtered.map(d => {
            const label = isAll ? `${d.store_id} ${d.day_label || d.date}` : (d.day_label || d.date);
            return d.matched ? `${label}: <span style="color:var(--green)">✓ Match</span>` : `${label}: <span style="color:var(--red)">${fm(d.variance || 0)}</span>`;
          }).join(' · ')}</div>
        </div>`;
      } else { cashEl.innerHTML = ''; }
    } else { cashEl.innerHTML = ''; }
  }

  // Anomalies
  const anomalyEl = document.getElementById('dash-anomaly');
  if (anomalyEl) {
    if (anomalyData?.alerts?.length) {
      anomalyEl.innerHTML = `<div class="card" style="margin-bottom:12px">
        <div class="sec-title" style="margin-top:0;color:var(--red)">🔍 ต้องตรวจสอบ</div>
        <div style="font-size:11px">${anomalyData.alerts.map(a =>
          `<div style="padding:3px 0;color:${a.severity === 'high' ? 'var(--red)' : 'var(--orange)'}">⚠ ${esc(a.message)}</div>`
        ).join('')}</div>
      </div>`;
    } else { anomalyEl.innerHTML = ''; }
  }

  // Store status
  const storesEl = document.getElementById('dash-stores');
  if (storesEl) {
    if (storeData?.stores?.length) {
      storesEl.innerHTML = `<div class="card" style="margin-bottom:12px">
        <div class="sec-title" style="margin-top:0">🏪 Store Status</div>
        <div style="overflow-x:auto">
        <table class="tbl"><thead><tr><th>Store</th><th>Status</th><th>Total</th><th>Sync</th></tr></thead>
        <tbody>${storeData.stores.map(st => `<tr>
          <td>${esc(st.store_id)}</td>
          <td>${st.has_sale ? ui.badge('active') : ui.badge('rejected')}</td>
          <td style="font-weight:600">${st.has_sale ? fm(st.total_sales) : '<span style="color:var(--t4)">—</span>'}</td>
          <td>${st.sync_status === 'synced' ? ui.badge('approved') : ui.badge('pending')}</td>
        </tr>`).join('')}</tbody></table>
        </div>
      </div>`;
    } else { storesEl.innerHTML = ''; }
  }

  _adminLoading = false;
}


// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
function _kpi(value, label, sub, color) {
  return `<div class="card" style="text-align:center;padding:12px${color ? ';border-left:3px solid ' + color : ''}">
    <div style="font-size:10px;color:var(--t3)">${label}</div>
    <div style="font-size:18px;font-weight:800;letter-spacing:-.5px${color ? ';color:' + color : ''}">${value}</div>
    ${sub ? `<div style="font-size:10px;color:var(--t3)">${sub}</div>` : ''}
  </div>`;
}

function _qCard(icon, title, sub, route) {
  return `<div class="card" style="cursor:pointer;padding:12px;margin-bottom:6px" onclick="SPG.go('sales/${route}')">
    <div style="display:flex;align-items:center;gap:10px">
      <span style="font-size:16px">${icon}</span>
      <div style="flex:1"><div style="font-size:13px;font-weight:700">${title}</div>${sub ? `<div style="font-size:10px;color:var(--t3);margin-top:1px">${sub}</div>` : ''}</div>
      <span style="color:var(--t4);font-size:14px">›</span>
    </div>
  </div>`;
}

function _renderLineChart(data) {
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

  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto">
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
