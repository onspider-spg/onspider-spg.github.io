/**
 * SPG HUB v2.0.0 | 22 MAR 2026 | Siam Palette Group
 * sections/home_employee_form.js — Multi-step Employee Form
 * Tabs: 1.Profile → 2.Bank → 3.Super → 4.Fair Work → 5.LINE
 */
(() => {
const esc = SPG.esc;
const api = SPG.api;

let _tab = 0;
let _data = {};
let _lineStatus = null;
let _isForced = false;
let _fwisRead = false;

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
  _fwisRead = false;
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
  if (!_lineStatus?.connected) {
    SPG.toast('Please connect LINE before submitting', 'error');
    return;
  }
  SPG.showLoader();
  try {
    _data.profile_complete = true;
    await api.saveEmployeeDetail(_data);
    try { await api.submitForApproval({}); } catch { /* may not be incomplete */ }
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
      if (!_data.id_type || !_data.id_number) { SPG.toast('ID Type and ID Number are required', 'error'); return false; }
      if (!_data.date_of_birth) { SPG.toast('Date of Birth is required', 'error'); return false; }
      if (!_data.phone) { SPG.toast('Phone is required', 'error'); return false; }
      if (!_data.address) { SPG.toast('Address is required', 'error'); return false; }
      if (!_data.city) { SPG.toast('City / Suburb is required', 'error'); return false; }
      if (!_data.postcode) { SPG.toast('Postcode is required', 'error'); return false; }
      break;
    case 1:
      _data.bank_name = get('emp-bank-name');
      _data.bank_bsb = get('emp-bank-bsb');
      _data.bank_account_number = get('emp-bank-acct');
      _data.bank_account_name = get('emp-bank-acct-name');
      if (!_data.bank_name) { SPG.toast('Bank Name is required', 'error'); return false; }
      if (!_data.bank_bsb) { SPG.toast('BSB is required', 'error'); return false; }
      if (!_data.bank_account_number) { SPG.toast('Account Number is required', 'error'); return false; }
      if (!_data.bank_account_name) { SPG.toast('Account Name is required', 'error'); return false; }
      if (_data.full_name_en && _data.bank_account_name.toLowerCase() !== _data.full_name_en.toLowerCase()) {
        SPG.toast('Account Name must match your Full Name (EN): ' + _data.full_name_en, 'error'); return false;
      }
      break;
    case 2:
      _data.super_fund_name = get('emp-super-name');
      _data.super_fund_number = get('emp-super-number');
      _data.super_member_number = get('emp-super-member');
      if (!_data.super_fund_name) { SPG.toast('Super Fund Name is required', 'error'); return false; }
      if (!_data.super_fund_number) { SPG.toast('Fund Number is required', 'error'); return false; }
      if (!_data.super_member_number) { SPG.toast('Member Number is required', 'error'); return false; }
      break;
    case 3:
      _data.tfn = get('emp-tfn');
      _data.visa_type = get('emp-visa-type');
      _data.visa_expiry = get('emp-visa-expiry');
      _data.start_date = get('emp-start-date');
      if (!_data.tfn) { SPG.toast('TFN is required', 'error'); return false; }
      if (!_data.start_date) { SPG.toast('Start Date is required', 'error'); return false; }
      if (!_fwisRead) { SPG.toast('Please read the Fair Work Information Statement first', 'error'); return false; }
      break;
  }
  return true;
}

// ═══ TAB 1: PROFILE ═══
function renderProfile() {
  const d = _data;
  return `
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Full Name (EN) *</label><input class="inp" id="emp-name-en" value="${esc(d.full_name_en || '')}"></div>
    <div class="fg" style="flex:1"><label class="lb">Full Name (TH)</label><input class="inp" id="emp-name-th" value="${esc(d.full_name_th || '')}"></div></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">ID Type *</label><select class="inp" id="emp-id-type"><option value="citizen" ${d.id_type === 'citizen' ? 'selected' : ''}>National ID</option><option value="passport" ${d.id_type === 'passport' ? 'selected' : ''}>Passport</option></select></div>
    <div class="fg" style="flex:1"><label class="lb">ID Number *</label><input class="inp" id="emp-id-number" value="${esc(d.id_number || '')}"></div></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Date of Birth *</label><input class="inp" id="emp-dob" type="date" value="${esc(d.date_of_birth || '')}"></div>
    <div class="fg" style="flex:1"><label class="lb">Phone *</label><input class="inp" id="emp-phone" type="tel" value="${esc(d.phone || '')}"></div></div>
    <div class="fg"><label class="lb">Address *</label><input class="inp" id="emp-address" value="${esc(d.address || '')}" placeholder="Street address"></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">City / Suburb *</label><input class="inp" id="emp-city" value="${esc(d.city || '')}"></div>
    <div class="fg" style="flex:1"><label class="lb">Postcode *</label><input class="inp" id="emp-postcode" value="${esc(d.postcode || '')}"></div></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Emergency Contact *</label><input class="inp" id="emp-emg-name" value="${esc(d.emergency_contact_name || '')}" placeholder="Name"></div>
    <div class="fg" style="flex:1"><label class="lb">Emergency Phone *</label><input class="inp" id="emp-emg-phone" type="tel" value="${esc(d.emergency_contact_phone || '')}"></div></div>`;
}

// ═══ TAB 2: BANK ═══
function renderBank() {
  const d = _data;
  return `
    <div style="padding:10px 14px;background:var(--blue-bg);border-radius:var(--rd);font-size:12px;color:var(--blue);margin-bottom:14px">Bank details are used for salary payments (ABA file export)</div>
    <div class="fg"><label class="lb">Bank Name *</label><input class="inp" id="emp-bank-name" value="${esc(d.bank_name || '')}" placeholder="e.g. Westpac, CBA, NAB, ANZ"></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">BSB *</label><input class="inp" id="emp-bank-bsb" value="${esc(d.bank_bsb || '')}" placeholder="e.g. 032-xxx" maxlength="7"></div>
    <div class="fg" style="flex:1"><label class="lb">Account Number *</label><input class="inp" id="emp-bank-acct" value="${esc(d.bank_account_number || '')}"></div></div>
    <div class="fg"><label class="lb">Account Name * (Must match Full Name)</label><input class="inp" id="emp-bank-acct-name" value="${esc(d.bank_account_name || '')}" placeholder="Must match your full name"></div>`;
}

// ═══ TAB 3: SUPER ═══
function renderSuper() {
  const d = _data;
  return `
    <div style="padding:10px 14px;background:var(--green-bg);border-radius:var(--rd);font-size:12px;color:var(--green);margin-bottom:14px">Superannuation details for employer contributions</div>
    <div class="fg"><label class="lb">Super Fund Name *</label><input class="inp" id="emp-super-name" value="${esc(d.super_fund_name || '')}" placeholder="e.g. AustralianSuper, REST, Hostplus"></div>
    <div class="fg"><label class="lb">Fund Number (USI/ABN) *</label><input class="inp" id="emp-super-number" value="${esc(d.super_fund_number || '')}"></div>
    <div class="fg"><label class="lb">Member Number *</label><input class="inp" id="emp-super-member" value="${esc(d.super_member_number || '')}"></div>`;
}

// ═══ TAB 4: FAIR WORK ═══
function renderFairWork() {
  const d = _data;
  return `
    <div class="fg"><label class="lb">TFN (Tax File Number) *</label><input class="inp" id="emp-tfn" value="${esc(d.tfn || '')}" placeholder="9 digits"></div>
    <div class="fg"><label class="lb">Start Date *</label><input class="inp" id="emp-start-date" type="date" value="${esc(d.start_date || '')}"></div>
    <div style="display:flex;gap:8px"><div class="fg" style="flex:1"><label class="lb">Visa Type *</label><select class="inp" id="emp-visa-type">
      <option value="citizen" ${(!d.visa_type || d.visa_type === 'citizen') ? 'selected' : ''}>Citizen / PR</option>
      <option value="student" ${d.visa_type === 'student' ? 'selected' : ''}>Student (500)</option>
      <option value="whm" ${d.visa_type === 'whm' ? 'selected' : ''}>WHM (417/462)</option>
      <option value="graduate" ${d.visa_type === 'graduate' ? 'selected' : ''}>Graduate (485)</option>
      <option value="partner" ${d.visa_type === 'partner' ? 'selected' : ''}>Partner (820/801)</option>
      <option value="bridging" ${d.visa_type === 'bridging' ? 'selected' : ''}>Bridging</option>
      <option value="other" ${d.visa_type === 'other' ? 'selected' : ''}>Other</option>
    </select></div>
    <div class="fg" style="flex:1"><label class="lb">Visa Expiry</label><input class="inp" id="emp-visa-expiry" type="date" value="${esc(d.visa_expiry || '')}"></div></div>

    <div style="margin-top:16px;border-top:1px solid var(--bd2);padding-top:14px">
      <div style="font-size:13px;font-weight:700;margin-bottom:8px">Fair Work Information Statement</div>
      <div style="font-size:12px;color:var(--t3);margin-bottom:10px;line-height:1.5">
        As required by the Fair Work Act 2009, you must read the Fair Work Information Statement before commencing employment.
      </div>
      <a href="https://www.fairwork.gov.au/sites/default/files/migration/724/Fair-Work-Information-Statement.pdf"
        target="_blank" rel="noopener"
        onclick="EmpForm.markFwisRead()"
        class="btn btn-outline btn-sm" style="display:inline-flex;align-items:center;gap:6px">
        📄 Read Fair Work Information Statement
      </a>
      <div id="fwis-status" style="margin-top:8px;font-size:11px;color:${_fwisRead ? 'var(--green)' : 'var(--orange)'}">
        ${_fwisRead ? '✅ Read — you may continue' : '⚠️ You must read this document before continuing'}
      </div>
    </div>`;
}

function markFwisRead() {
  _fwisRead = true;
  const el = document.getElementById('fwis-status');
  if (el) { el.style.color = 'var(--green)'; el.innerHTML = '✅ Read — you may continue'; }
}

// ═══ TAB 5: LINE ═══
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
    <div style="color:var(--t3);font-size:13px;margin-bottom:8px;max-width:300px;margin-left:auto;margin-right:auto;line-height:1.5">
      Connect your LINE account to receive notifications from SPG HUB.
    </div>
    <div style="padding:8px 14px;background:var(--orange-bg);border-radius:var(--rd);font-size:11px;color:var(--orange);margin-bottom:16px">
      ⚠️ LINE connection is required before submitting
    </div>
    <button class="btn btn-primary" style="background:#06C755;border-color:#06C755" onclick="EmpForm.connectLine()">Connect with LINE</button>
  </div>`;
}

function connectLine() {
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
  connectLine, disconnectLine, handleLineCallback,
  markFwisRead,
};
})();
