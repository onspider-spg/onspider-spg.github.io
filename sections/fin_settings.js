/**
 * SPG HUB v1.0.0 | 23 MAR 2026 | Siam Palette Group
 * sections/fin_settings.js — Finance Module (Settings Screens)
 * 4 sub-tabs: st-alert, st-perm, st-audit, st-bridge
 * Main route: settings (registered in fin_core.js)
 * Depends on: fin_core.js (FIN global)
 */

(() => {
const S = FIN.S;
const esc = FIN.esc;
const ui = SPG.ui;
const fm = FIN.fmtAud;
const fd = FIN.fmtDate;

// Current active sub-tab
let _activeTab = 'st-alert';
let _bridgeSettings = [];
let _bridgeSaving = false;

// ═══════════════════════════════════════
// SHARED: Settings sub-nav tabs
// ═══════════════════════════════════════
function settingsTabs(active) {
  const tabs = [
    { id: 'st-alert', label: 'Alert Rules' },
    { id: 'st-perm',  label: 'Permissions' },
    { id: 'st-audit', label: 'Audit Log' },
    { id: 'st-bridge', label: 'SD Bridge' },
  ];
  return '<div style="display:flex;gap:0;border-bottom:1px solid var(--bd2);margin-bottom:12px">'
    + tabs.map(t =>
      `<div class="tab${t.id === active ? ' a' : ''}" onclick="FinanceSection.switchSettingsTab('${t.id}')" style="padding:8px 16px;cursor:pointer;font-size:var(--fs-sm);font-weight:${t.id === active ? '600' : '400'};color:${t.id === active ? 'var(--acc)' : 'var(--t3)'};border-bottom:2px solid ${t.id === active ? 'var(--acc)' : 'transparent'}">${esc(t.label)}</div>`
    ).join('')
    + '</div>';
}

const STATIC_BANNER = '<div style="background:var(--obg);border-radius:var(--rd);padding:6px 10px;font-size:var(--fs-xxs);color:var(--o);margin-bottom:10px">\u26a0\ufe0f Settings data is currently static. Dynamic configuration will be available in the next release.</div>';


// ═══════════════════════════════════════
// S52. ALERT RULES
// ═══════════════════════════════════════
function _alertContent() {
  return `${settingsTabs('st-alert')}${STATIC_BANNER}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:var(--fs-xs);color:var(--t3)">Configure alert thresholds for CFO Brief</div>
      <button class="btn-outline" onclick="FinanceSection.addAlert()">+ Add New</button>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <table class="tbl" id="st_alert_tbl" style="margin:0">
        <thead><tr>
          ${ui.sortTh('st_alert_tbl','rule','Rule Name')}${ui.sortTh('st_alert_tbl','metric','Metric')}${ui.sortTh('st_alert_tbl','threshold','Threshold')}
          ${ui.sortTh('st_alert_tbl','severity','Severity')}${ui.sortTh('st_alert_tbl','action','Action')}${ui.sortTh('st_alert_tbl','status','Status')}
        </tr></thead>
        <tbody id="st_alert_body">
          <tr>
            <td style="font-weight:500">COL Over Budget</td>
            <td>COL % of Revenue</td>
            <td>&gt;30%</td>
            <td><span class="sts-err">Critical</span></td>
            <td>Flag in CFO Brief</td>
            <td><span class="sts-ok">Active</span></td>
          </tr>
          <tr>
            <td style="font-weight:500">Overdue AP</td>
            <td>Days past due</td>
            <td>&gt;7 days</td>
            <td><span class="sts-warn">Warning</span></td>
            <td>Email + Dashboard</td>
            <td><span class="sts-ok">Active</span></td>
          </tr>
          <tr>
            <td style="font-weight:500">Cash Low</td>
            <td>Bank balance</td>
            <td>&lt;$5,000</td>
            <td><span class="sts-err">Critical</span></td>
            <td>SMS + Email</td>
            <td><span class="sts-ok">Active</span></td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

function addAlert() {
  SPG.toast('Add Alert — coming soon');
}


// ═══════════════════════════════════════
// S53. PERMISSIONS
// ═══════════════════════════════════════
function _permContent() {
  return `${settingsTabs('st-perm')}${STATIC_BANNER}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div style="font-size:var(--fs-xs);color:var(--t3)">Manage user access to Finance module</div>
      <button class="btn-outline" onclick="FinanceSection.addUser()">+ Add User</button>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <table class="tbl" id="st_perm_tbl" style="margin:0">
        <thead><tr>
          ${ui.sortTh('st_perm_tbl','user','User')}${ui.sortTh('st_perm_tbl','email','Email')}${ui.sortTh('st_perm_tbl','role','Role')}
          ${ui.sortTh('st_perm_tbl','access','Access Level')}${ui.sortTh('st_perm_tbl','login','Last Login')}${ui.sortTh('st_perm_tbl','status','Status')}
        </tr></thead>
        <tbody id="st_perm_body">
          <tr>
            <td style="font-weight:600">Khun Or</td>
            <td>or@siampalette.com</td>
            <td>Admin</td>
            <td>T1 — Full Access</td>
            <td>12/03/2026</td>
            <td><span class="sts-ok">Active</span></td>
          </tr>
          <tr>
            <td>Finance Staff</td>
            <td>finance@siampalette.com</td>
            <td>Finance Manager</td>
            <td>T2 — All Brands Read/Write</td>
            <td>11/03/2026</td>
            <td><span class="sts-ok">Active</span></td>
          </tr>
          <tr>
            <td>Store Manager MC</td>
            <td>mc@siampalette.com</td>
            <td>Brand Manager</td>
            <td>T3 — Mango Coco only</td>
            <td>10/03/2026</td>
            <td><span class="sts-ok">Active</span></td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

function addUser() {
  SPG.toast('Add User — coming soon');
}


// ═══════════════════════════════════════
// S54. AUDIT LOG
// ═══════════════════════════════════════
function _auditContent() {
  return `${settingsTabs('st-audit')}${STATIC_BANNER}
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <select class="fl" id="st_audit_user"><option value="">All Users</option></select>
      <select class="fl" id="st_audit_action">
        <option value="">All Actions</option>
        <option>Created bill</option>
        <option>Recorded payment</option>
        <option>Uploaded document</option>
        <option>Imported CSV</option>
        <option>Auto-match</option>
      </select>
      <input class="inp" id="st_audit_search" placeholder="Search..." style="flex:1;max-width:200px">
      <button class="btn-outline" onclick="FinanceSection.exportAudit()">Export</button>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <table class="tbl" id="st_audit_tbl" style="margin:0">
        <thead><tr>
          ${ui.sortTh('st_audit_tbl','time','Timestamp')}${ui.sortTh('st_audit_tbl','user','User')}${ui.sortTh('st_audit_tbl','action','Action')}${ui.sortTh('st_audit_tbl','details','Details')}
        </tr></thead>
        <tbody id="st_audit_body">
          <tr>
            <td style="white-space:nowrap">12/03 14:23</td>
            <td>Khun Or</td>
            <td>Created bill</td>
            <td>FIN-0051 Pro Bros $303.20</td>
          </tr>
          <tr>
            <td style="white-space:nowrap">12/03 14:20</td>
            <td>Khun Or</td>
            <td>Uploaded document</td>
            <td>INV1052323.pdf</td>
          </tr>
          <tr>
            <td style="white-space:nowrap">11/03 16:45</td>
            <td>System</td>
            <td>Auto-match recurring</td>
            <td>Pro Bros weekly → FIN-0049</td>
          </tr>
          <tr>
            <td style="white-space:nowrap">11/03 14:00</td>
            <td>Khun Or</td>
            <td>Recorded payment</td>
            <td>PAY-1284 Mind.RBuakl $582.82</td>
          </tr>
          <tr>
            <td style="white-space:nowrap">11/03 13:30</td>
            <td>Finance Staff</td>
            <td>Imported CSV</td>
            <td>45 transactions from invoices_mar.csv</td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

function exportAudit() {
  SPG.toast('Export Audit Log — coming soon');
}


// ═══════════════════════════════════════
// S55. SD BRIDGE SETTINGS
// ═══════════════════════════════════════
function _bridgeContent() {
  return `${settingsTabs('st-bridge')}
    <div id="st_bridge_content">
      <div style="text-align:center;padding:40px;color:var(--t3)">
        <div class="fin-spinner" style="margin:0 auto 8px"></div>Loading...
      </div>
    </div>`;
}

function _renderBridgeRows(el) {
  const settingLabels = {
    revenue_cash:     { title: 'In-store Cash',        desc: 'Auto-create sale transaction when SD records cash revenue' },
    revenue_card:     { title: 'Card channels',         desc: 'Eftpos, Prepaid, Union Pay' },
    revenue_platform: { title: 'Platform payouts',      desc: 'UberEats, Easi, Hungry Panda, DoorDash' },
    expense_cash:     { title: 'Expenses (Cash paid)',   desc: 'Auto-create bill when SD records a cash expense' },
    invoice_paid:     { title: 'Invoices (Paid)',        desc: 'Auto-create bill for paid invoices from SD' },
    invoice_unpaid:   { title: 'Invoices (Unpaid)',      desc: 'Create as Awaiting Payment in Finance' },
  };

  const rev = _bridgeSettings.filter(s => s.data_type && s.data_type.startsWith('revenue'));
  const exp = _bridgeSettings.filter(s => s.data_type && !s.data_type.startsWith('revenue'));

  function settingRow(s) {
    const info = settingLabels[s.data_type] || { title: s.data_type, desc: '' };
    const checked = s.is_enabled ? 'checked' : '';
    return `<div style="display:flex;align-items:center;padding:12px 16px;border-bottom:1px solid var(--bd2);gap:12px">
      <div style="flex:1"><div style="font-size:var(--fs-sm);font-weight:600">${esc(info.title)}</div><div style="font-size:var(--fs-xxs);color:var(--t3)">${esc(info.desc)}</div></div>
      <label class="br-tgl"><input type="checkbox" ${checked} data-bridge-id="${s.bridge_id}" onchange="FinanceSection.bridgeMarkDirty()"><span class="br-sl"></span></label>
    </div>`;
  }

  let html = '<div style="font-size:var(--fs-xs);color:var(--t3);margin-bottom:14px">Control which data types sync automatically from Sale Daily to Finance.</div>';
  if (rev.length > 0) {
    html += `<div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:8px">Revenue Auto-sync</div><div style="border:1px solid var(--bd);border-radius:8px;margin-bottom:16px;background:#fff">${rev.map(settingRow).join('')}</div>`;
  }
  if (exp.length > 0) {
    html += `<div style="font-size:var(--fs-sm);font-weight:700;margin-bottom:8px">Expense Auto-sync</div><div style="border:1px solid var(--bd);border-radius:8px;margin-bottom:16px;background:#fff">${exp.map(settingRow).join('')}</div>`;
  }
  html += '<div style="font-size:var(--fs-xxs);color:var(--t3);padding:8px 12px;background:var(--bg2);border-radius:8px">Expense auto-sync is currently off. It is recommended that ACC reviews expenses before syncing.</div>';
  el.innerHTML = html;
}

function bridgeMarkDirty() {
  const btn = document.getElementById('st_bridge_save');
  if (btn) { btn.style.background = 'var(--acc)'; btn.textContent = 'Save Changes \u25cf'; }
}

async function saveBridge() {
  if (_bridgeSaving) return;
  const btn = document.getElementById('st_bridge_save');
  _bridgeSaving = true;
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  try {
    const toggles = [];
    document.querySelectorAll('[data-bridge-id]').forEach(input => {
      toggles.push({ bridge_id: input.dataset.bridgeId, is_enabled: input.checked });
    });
    await FIN.api('fin_save_bridge_settings', { settings: toggles });
    SPG.toast('Saved');
    if (btn) { btn.style.background = ''; btn.textContent = 'Save Changes'; }
  } catch (e) {
    SPG.toast(e.message || 'Save failed', 'error');
  } finally {
    _bridgeSaving = false;
    if (btn) { btn.disabled = false; }
  }
}

async function _loadBridgeData() {
  const el = document.getElementById('st_bridge_content');
  if (!el) return;
  try {
    const result = await FIN.api('fin_get_bridge_settings', {});
    _bridgeSettings = result.settings || [];
    _renderBridgeRows(el);
  } catch (e) {
    el.innerHTML = `<div style="padding:20px;color:var(--r)">Error: ${esc(e.message)}</div>`;
  }
}


// ═══════════════════════════════════════
// MAIN RENDER / LOAD (single route: settings)
// ═══════════════════════════════════════

/** Get inner content based on active sub-tab */
function _tabContent(tab) {
  switch (tab) {
    case 'st-alert':  return _alertContent();
    case 'st-perm':   return _permContent();
    case 'st-audit':  return _auditContent();
    case 'st-bridge': return _bridgeContent();
    default:          return _alertContent();
  }
}

/** Get toolbar actions for Bridge tab */
function _toolbarActions(tab) {
  if (tab === 'st-bridge') {
    return '<button class="btn-primary" id="st_bridge_save" onclick="FinanceSection.saveBridge()">Save Changes</button>';
  }
  return '';
}

function renderSettings() {
  return SPG.shell(
    SPG.toolbar('Settings', _toolbarActions(_activeTab))
    + `<div class="content" id="fin-settings"><div style="max-width:${_activeTab === 'st-audit' ? '1000' : '900'}px;margin:0 auto">${_tabContent(_activeTab)}</div></div>`,
    'Finance'
  );
}

async function loadSettings() {
  try {
    await FIN.initModule();
    FIN.buildSidebar();
    if (_activeTab === 'st-bridge') {
      await _loadBridgeData();
    }
  } catch (e) {
    SPG.toast(e.message, 'error');
  }
}

/** Switch between sub-tabs without full route change */
function switchSettingsTab(tabId) {
  _activeTab = tabId;
  // Re-render the settings content in place
  const container = document.getElementById('fin-settings');
  if (container) {
    const maxW = tabId === 'st-audit' ? '1000' : '900';
    container.innerHTML = `<div style="max-width:${maxW}px;margin:0 auto">${_tabContent(tabId)}</div>`;

    // Update toolbar actions (for bridge save button)
    const tbActions = document.querySelector('.tb-actions');
    if (tbActions) {
      tbActions.innerHTML = _toolbarActions(tabId);
    }

    // Load bridge data if switching to that tab
    if (tabId === 'st-bridge') {
      _loadBridgeData();
    }
  }
}


// ═══════════════════════════════════════
// EXPOSE TO FIN + FinanceSection
// ═══════════════════════════════════════
FIN.renderSettings = renderSettings;
FIN.loadSettings   = loadSettings;

Object.assign(window.FinanceSection, {
  switchSettingsTab,
  addAlert,
  addUser,
  exportAudit,
  saveBridge,
  bridgeMarkDirty,
});

})();
