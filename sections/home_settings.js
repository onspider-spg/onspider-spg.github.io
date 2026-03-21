/**
 * SPG HUB v2.0.0 | 21 MAR 2026 | Siam Palette Group
 * sections/home_settings.js — System Settings
 * Tabs: General, Notifications
 */
(() => {
const esc = SPG.esc;
const api = SPG.api;

let _settings = {};
let _tab = 'general';

function render(params) {
  _tab = params?.tab || 'general';
  return SPG.shell(`
    ${SPG.toolbar('Settings')}
    <div class="content">
      <div class="settings-tabs" style="display:flex;gap:4px;margin-bottom:16px">
        <button class="btn btn-sm ${_tab === 'general' ? 'btn-primary' : 'btn-outline'}" onclick="Settings.switchTab('general')">General</button>
        <button class="btn btn-sm ${_tab === 'notifications' ? 'btn-primary' : 'btn-outline'}" onclick="Settings.switchTab('notifications')">Notifications</button>
      </div>
      <div class="card max-w-md" id="settings-content">${SPG.ui.skeleton(200)}</div>
    </div>
  `);
}

async function onLoad() {
  SPG.showLoader();
  try {
    const data = await api.adminGetSettings();
    _settings = {};
    (data.settings || []).forEach(s => { _settings[s.setting_key] = s; });
    SPG.hideLoader();
    renderTab();
  } catch (e) {
    SPG.hideLoader();
    SPG.toast(e.message || 'Failed to load settings', 'error');
  }
}

function switchTab(tab) {
  _tab = tab;
  SPG.updateHash('settings', { tab });
  document.querySelectorAll('.settings-tabs .btn').forEach(b => {
    b.className = b.textContent.toLowerCase().trim() === tab ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline';
  });
  renderTab();
}

function renderTab() {
  const ct = document.getElementById('settings-content');
  if (!ct) return;
  switch (_tab) {
    case 'general': ct.innerHTML = renderGeneral(); break;
    case 'notifications': ct.innerHTML = renderNotifications(); break;
    default: ct.innerHTML = renderGeneral();
  }
}

function getVal(key) { return _settings[key]?.setting_value || ''; }

function renderGeneral() {
  return `
    <div style="font-size:15px;font-weight:700;margin-bottom:14px">General Settings</div>
    <div class="fg"><label class="lb">System Name</label>
      <input class="inp" id="set-name" value="${esc(getVal('system_name'))}" placeholder="SPG HUB"></div>
    <div class="fg"><label class="lb">Timezone</label>
      <select class="inp" id="set-tz">
        <option value="Australia/Sydney" ${getVal('timezone') === 'Australia/Sydney' ? 'selected' : ''}>Australia/Sydney</option>
        <option value="Australia/Melbourne" ${getVal('timezone') === 'Australia/Melbourne' ? 'selected' : ''}>Australia/Melbourne</option>
        <option value="Australia/Brisbane" ${getVal('timezone') === 'Australia/Brisbane' ? 'selected' : ''}>Australia/Brisbane</option>
        <option value="Asia/Bangkok" ${getVal('timezone') === 'Asia/Bangkok' ? 'selected' : ''}>Asia/Bangkok</option>
      </select></div>
    <div class="fg"><label class="lb">Session Duration (hours)</label>
      <input class="inp" id="set-session" type="number" min="1" max="24" value="${esc(getVal('session_duration_hours') || '8')}"></div>
    <div class="fg" style="margin-top:12px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
        <input type="checkbox" id="set-maintenance" ${getVal('maintenance_mode') === 'true' ? 'checked' : ''}> Maintenance Mode
      </label>
      <div class="inp-hint">When enabled, only admins can access the system</div>
    </div>
    <div style="border-top:1px solid var(--bd2);margin-top:16px;padding-top:16px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">Integration Status</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <div style="padding:8px 14px;border-radius:var(--rd);background:${getVal('otp_enabled') === 'true' ? 'var(--green-bg)' : 'var(--bg3)'};font-size:12px;color:${getVal('otp_enabled') === 'true' ? 'var(--green)' : 'var(--t3)'}">
          Email OTP: ${getVal('otp_enabled') === 'true' ? '✅ Enabled' : '⏸ Disabled'}
        </div>
        <div style="padding:8px 14px;border-radius:var(--rd);background:${getVal('line_enabled') === 'true' ? '#06C75520' : 'var(--bg3)'};font-size:12px;color:${getVal('line_enabled') === 'true' ? '#06C755' : 'var(--t3)'}">
          LINE: ${getVal('line_enabled') === 'true' ? '✅ Enabled' : '⏸ Disabled'}
        </div>
      </div>
    </div>
    <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-primary btn-sm" onclick="Settings.saveGeneral()">Save Changes</button>
    </div>`;
}

async function saveGeneral() {
  const updates = [
    ['system_name', document.getElementById('set-name')?.value.trim()],
    ['timezone', document.getElementById('set-tz')?.value],
    ['session_duration_hours', document.getElementById('set-session')?.value],
    ['maintenance_mode', document.getElementById('set-maintenance')?.checked ? 'true' : 'false'],
  ];
  SPG.showLoader();
  try {
    for (const [k, v] of updates) {
      if (v !== undefined && v !== getVal(k)) {
        await api.adminUpdateSetting(k, v);
        _settings[k] = { ..._settings[k], setting_value: v };
      }
    }
    SPG.hideLoader();
    SPG.toast('Settings saved', 'success');
  } catch (e) { SPG.hideLoader(); SPG.toast(e.message || 'Save failed', 'error'); }
}

function renderNotifications() {
  return `
    <div style="font-size:15px;font-weight:700;margin-bottom:14px">Notification Settings</div>
    <div class="fg">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
        <input type="checkbox" id="set-otp" ${getVal('otp_enabled') === 'true' ? 'checked' : ''}> Enable Email OTP Verification
      </label>
      <div class="inp-hint">When enabled, new registrations require email OTP verification</div>
    </div>
    <div class="fg" style="margin-top:12px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
        <input type="checkbox" id="set-line" ${getVal('line_enabled') === 'true' ? 'checked' : ''}> Enable LINE Integration
      </label>
      <div class="inp-hint">When enabled, new users must connect LINE before submitting for approval</div>
    </div>
    <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">
      <button class="btn btn-primary btn-sm" onclick="Settings.saveNotifications()">Save Changes</button>
    </div>`;
}

async function saveNotifications() {
  const updates = [
    ['otp_enabled', document.getElementById('set-otp')?.checked ? 'true' : 'false'],
    ['line_enabled', document.getElementById('set-line')?.checked ? 'true' : 'false'],
  ];
  SPG.showLoader();
  try {
    for (const [k, v] of updates) {
      if (v !== getVal(k)) {
        await api.adminUpdateSetting(k, v);
        _settings[k] = { ..._settings[k], setting_value: v };
      }
    }
    SPG.hideLoader();
    SPG.toast('Settings saved', 'success');
  } catch (e) { SPG.hideLoader(); SPG.toast(e.message || 'Save failed', 'error'); }
}

window.Settings = { render, onLoad, switchTab, saveGeneral, saveNotifications };
})();
