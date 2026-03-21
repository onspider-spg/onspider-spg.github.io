/**
 * SPG HUB v2.0.0 | 21 MAR 2026 | Siam Palette Group
 * sections/home_employee_form.js — Multi-step Employee Form
 * Steps: Profile → Bank → Super → Fair Work → LINE → Submit
 */
(() => {
const esc = SPG.esc;
const api = SPG.api;

let _tab = 0;
let _data = {};
let _lineStatus = null;
let _isForced = false; // true = new user flow (can't skip)

const TABS = ['Profile', 'Bank', 'Super', 'Fair Work', 'LINE'];

function render(params) {
  _isForced = params?.forced === true || !SPG.state.profileComplete;
  const backBtn = _isForced ? '' : '<button class="btn btn-outline btn-sm" onclick="SPG.go(\'profile\')">← Back to Profile</button>';
  return SPG.shell(`
    ${SPG.toolbar('Employee Details', backBtn)}
    <div class="content">
      <div class="card max-w-md" id="emp-form-card">
        <div class="emp-tabs" id="emp-tabs"></div>
        <div id="emp-form-content" style="padding:16px 0">${SPG.ui.skeleton(200)}</div>
        <div id="emp-form-actions" style="display:flex;gap:8px;justify-content:flex-end;padding-top:12px;border-top:1px solid var(--bd2)"></div>
      </div>
    </div>
  `);
}

async function onLoad() {
  _tab = 0;
  SPG.showLoader();
  try {
    const [empRes, lineRes] = await Promise.all([api.getEmployeeDetail(), api.getLineStatus()]);
    _data = empRes.employee || {};
    _lineStatus = lineRes;
    SPG.hideLoader();
    renderTabs();
    renderTab();
  } catch (e) {
    SPG.hideLoader();
    SPG.toast(e.message || 'Failed to load', 'error');
  }
}

function renderTabs() {
  const el = document.getElementById('emp-tabs');
  if (!el) return;
  el.innerHTML = TABS.map((t, i) => {
    const cls = i === _tab ? 'emp-tab active' : (i < _tab ? 'emp-tab done' : 'emp-tab');
    return `<div class="${cls}" onclick="EmpForm.goTab(${i})">${i < _tab ? '✓' : i + 1}. ${t}</div>`;
  }).join('');
}

function goTab(i) { _tab = i; renderTabs(); renderTab(); }

function renderTab() {
  const ct = document.getElementById('emp-form-content');
  const acts = document.getElementById('emp-form-actions');
  if (!ct || !acts) return;

  switch (_tab) {
    case 0: ct.innerHTML = renderProfile(); break;
    case 1: ct.innerHTML = renderBank(); break;
    case 2: ct.innerHTML = renderSuper(); break;
    case 3: ct.innerHTML = renderFairWork(); break;
    case 4: ct.innerHTML = renderLINE(); break;
  }

  const prevBtn = _tab > 0 ? '<button class="btn btn-outline btn-sm" onclick="EmpForm.prev()">← Previous</button>' : '';
  const nextBtn = _tab < 4 ? '<button class="btn btn-primary btn-sm" onclick="EmpForm.saveAndNext()">Save & Next →</button>' : '';
  const submitBtn = _tab === 4 ? '<button class="btn btn-primary btn-sm" onclick="EmpForm.submitAll()">Submit for Approval</button>' : '';
  acts.innerHTML = prevBtn + '<div style="flex:1"></div>' + nextBtn + submitBtn;
}

function prev() { if (_tab > 0) { _tab--; renderTabs(); renderTab(); } }

async function saveAndNext() {
  if (!collectCurrentTab()) return;
  SPG.showLoader();
  try {
    await api.saveEmployeeDetail(_data);
    _tab++;
    SPG.hideLoader();
    renderTabs();
    renderTab();
    SPG.toast('Saved', 'success');
  } catch (e) {
    SPG.hideLoader();
    SPG.toast(e.message || 'Save failed', 'error');
  }
}

async function submitAll() {
  SPG.showLoader();
  try {
    _data.profile_complete = true;
    await api.saveEmployeeDetail(_data);
    // Submit for approval if account is incomplete
    try { await api.submitForApproval({}); } catch { /* may not be incomplete status */ }
    SPG.hideLoader();
    SPG.toast('Employee details submitted!', 'success');
    if (_isForced) {
      SPG.go('pending-approval');
    } else {
      SPG.go('profile');
    }
  } catch (e) {
    SPG.hideLoader();
    SPG.toast(e.message || 'Submit failed', 'error');
  }
}

function collectCurrentTab() {
  const get = (id) => document.getElementById(id)?.value?.trim() || '';
  switch (_tab) {
    case 0:
      _data.full_name_en = get('emp-name-en');
      _data.full_name_th = get('emp-name-th');
      _data.id_type = get('emp-id-type');
      _data.id_number = get('emp-id-number');
      _data.date_of_birth = get('emp-dob');
      _data.phone = get('emp-phone');
      _data.address = get('emp-address');
      _data.city = get('emp-city');
      _data.postcode = get('emp-postcode');
      _data.emergency_contact_name = get('emp-emg-name');
      _data.emergency_contact_phone = get('emp-emg-phone');
      if (!_data.full_name_en) { SPG.toast('Full Name (EN) is required', 'error'); return false; }
      break;
    case 1:
      _data.bank_name = get('emp-bank-name');
      _data.bank_bsb = get('emp-bank-bsb');
      _data.bank_account_number = get('emp-bank-acct');
      _data.bank_account_name = get('emp-bank-acct-name');
      break;
    case 2:
      _data.super_fund_name = get('emp-super-name');
      _data.super_fund_number = get('emp-super-number');
      _data.super_member_number = get('emp-super-member');
      break;
    case 3:
      _data.tfn = get('emp-tfn');
      _data.visa_type = get('emp-visa-type');
      _data.visa_expiry = get('emp-visa-expiry');
      _data.start_date = get('emp-start-date');
      break;
  }
  return true;
}

// ═══ TAB RENDERERS ═══
function renderProfile() {
  const d = _data;
  return `
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Full Name (EN) *</label><input class="inp" id="emp-name-en" value="${esc(d.full_name_en || '')}"></div>
    <div class="fg" style="flex:1"><label class="lb">Full Name (TH)</label><input class="inp" id="emp-name-th" value="${esc(d.full_name_th || '')}"></div></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">ID Type</label><select class="inp" id="emp-id-type"><option value="citizen" ${d.id_type === 'citizen' ? 'selected' : ''}>National ID</option><option value="passport" ${d.id_type === 'passport' ? 'selected' : ''}>Passport</option></select></div>
    <div class="fg" style="flex:1"><label class="lb">ID Number</label><input class="inp" id="emp-id-number" value="${esc(d.id_number || '')}"></div></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Date of Birth</label><input class="inp" id="emp-dob" type="date" value="${esc(d.date_of_birth || '')}"></div>
    <div class="fg" style="flex:1"><label class="lb">Phone</label><input class="inp" id="emp-phone" type="tel" value="${esc(d.phone || '')}"></div></div>
    <div class="fg"><label class="lb">Address</label><input class="inp" id="emp-address" value="${esc(d.address || '')}" placeholder="Street address"></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">City / Suburb</label><input class="inp" id="emp-city" value="${esc(d.city || '')}"></div>
    <div class="fg" style="flex:1"><label class="lb">Postcode</label><input class="inp" id="emp-postcode" value="${esc(d.postcode || '')}"></div></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Emergency Contact</label><input class="inp" id="emp-emg-name" value="${esc(d.emergency_contact_name || '')}" placeholder="Name"></div>
    <div class="fg" style="flex:1"><label class="lb">Emergency Phone</label><input class="inp" id="emp-emg-phone" type="tel" value="${esc(d.emergency_contact_phone || '')}"></div></div>`;
}

function renderBank() {
  const d = _data;
  return `
    <div style="padding:10px 14px;background:var(--blue-bg);border-radius:var(--rd);font-size:12px;color:var(--blue);margin-bottom:14px">Bank details are used for salary payments (ABA file export)</div>
    <div class="fg"><label class="lb">Bank Name</label><input class="inp" id="emp-bank-name" value="${esc(d.bank_name || '')}" placeholder="e.g. Westpac, CBA, NAB, ANZ"></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">BSB</label><input class="inp" id="emp-bank-bsb" value="${esc(d.bank_bsb || '')}" placeholder="e.g. 032-xxx" maxlength="7"></div>
    <div class="fg" style="flex:1"><label class="lb">Account Number</label><input class="inp" id="emp-bank-acct" value="${esc(d.bank_account_number || '')}"></div></div>
    <div class="fg"><label class="lb">Account Name</label><input class="inp" id="emp-bank-acct-name" value="${esc(d.bank_account_name || '')}" placeholder="Name on bank account"></div>`;
}

function renderSuper() {
  const d = _data;
  return `
    <div style="padding:10px 14px;background:var(--green-bg);border-radius:var(--rd);font-size:12px;color:var(--green);margin-bottom:14px">Superannuation details for employer contributions</div>
    <div class="fg"><label class="lb">Super Fund Name</label><input class="inp" id="emp-super-name" value="${esc(d.super_fund_name || '')}" placeholder="e.g. AustralianSuper, REST, Hostplus"></div>
    <div class="fg"><label class="lb">Fund Number (USI/ABN)</label><input class="inp" id="emp-super-number" value="${esc(d.super_fund_number || '')}"></div>
    <div class="fg"><label class="lb">Member Number</label><input class="inp" id="emp-super-member" value="${esc(d.super_member_number || '')}"></div>`;
}

function renderFairWork() {
  const d = _data;
  return `
    <div class="fg"><label class="lb">TFN (Tax File Number)</label><input class="inp" id="emp-tfn" value="${esc(d.tfn || '')}" placeholder="9 digits"></div>
    <div class="fg"><label class="lb">Start Date</label><input class="inp" id="emp-start-date" type="date" value="${esc(d.start_date || '')}"></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Visa Type</label><select class="inp" id="emp-visa-type">
      <option value="" ${!d.visa_type ? 'selected' : ''}>N/A (Citizen/PR)</option>
      <option value="student" ${d.visa_type === 'student' ? 'selected' : ''}>Student (500)</option>
      <option value="whm" ${d.visa_type === 'whm' ? 'selected' : ''}>WHM (417/462)</option>
      <option value="graduate" ${d.visa_type === 'graduate' ? 'selected' : ''}>Graduate (485)</option>
      <option value="partner" ${d.visa_type === 'partner' ? 'selected' : ''}>Partner (820/801)</option>
      <option value="bridging" ${d.visa_type === 'bridging' ? 'selected' : ''}>Bridging</option>
      <option value="other" ${d.visa_type === 'other' ? 'selected' : ''}>Other</option>
    </select></div>
    <div class="fg" style="flex:1"><label class="lb">Visa Expiry</label><input class="inp" id="emp-visa-expiry" type="date" value="${esc(d.visa_expiry || '')}"></div></div>
    <div class="inp-hint" style="margin-top:4px">Document uploads (ID photo, Visa) will be available in a future update.</div>`;
}

function renderLINE() {
  const connected = _lineStatus?.connected;
  const line = _lineStatus?.line;
  if (connected && line) {
    return `<div style="text-align:center;padding:20px">
      <div style="font-size:40px;margin-bottom:8px">✅</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:4px">LINE Connected</div>
      <div style="font-size:13px;color:var(--t3);margin-bottom:8px">${esc(line.line_display_name || line.line_user_id)}</div>
      <div style="font-size:11px;color:var(--t3)">Connected: ${line.connected_at ? new Date(line.connected_at).toLocaleDateString() : '-'}</div>
      <div style="margin-top:16px"><button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red)" onclick="EmpForm.disconnectLine()">Disconnect</button></div>
    </div>`;
  }
  return `<div style="text-align:center;padding:20px">
    <div style="font-size:40px;margin-bottom:8px">💬</div>
    <div style="font-size:16px;font-weight:700;margin-bottom:4px">Connect LINE</div>
    <div style="color:var(--t3);font-size:13px;margin-bottom:20px;max-width:300px;margin-left:auto;margin-right:auto;line-height:1.5">
      Connect your LINE account to receive push notifications from SPG HUB.
    </div>
    <button class="btn btn-primary" style="background:#06C755;border-color:#06C755" onclick="EmpForm.connectLine()">Connect with LINE</button>
    ${!_isForced ? '<div style="margin-top:12px"><a class="lk" style="font-size:11px;color:var(--t3);cursor:pointer" onclick="EmpForm.skipLine()">Skip for now</a></div>' : ''}
  </div>`;
}

function connectLine() {
  // LINE Login OAuth redirect
  const channelId = '2007321330';
  const redirectUri = encodeURIComponent(location.origin + '/line-callback.html');
  const state = api.getToken();
  window.location.href = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${channelId}&redirect_uri=${redirectUri}&state=${state}&scope=profile%20openid`;
}

async function disconnectLine() {
  SPG.showLoader();
  try {
    await api.lineDisconnect();
    _lineStatus = { connected: false, line: null };
    SPG.hideLoader();
    renderTab();
    SPG.toast('LINE disconnected', 'info');
  } catch (e) { SPG.hideLoader(); SPG.toast(e.message, 'error'); }
}

function skipLine() { SPG.toast('You can connect LINE later from Profile', 'info'); }

// Called from LINE callback page
async function handleLineCallback(code) {
  SPG.showLoader();
  try {
    await api.lineConnect({ code, redirect_uri: location.origin + '/line-callback.html' });
    const status = await api.getLineStatus();
    _lineStatus = status;
    SPG.hideLoader();
    renderTab();
    SPG.toast('LINE connected!', 'success');
  } catch (e) {
    SPG.hideLoader();
    SPG.toast(e.message || 'LINE connect failed', 'error');
  }
}

window.EmpForm = {
  render, onLoad, goTab, prev, saveAndNext, submitAll,
  connectLine, disconnectLine, skipLine, handleLineCallback,
};
})();
