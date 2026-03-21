/**
 * SPG HUB v2.0.0 | 21 MAR 2026 | Siam Palette Group
 * sections/home_register_v2.js — Multi-step Register with OTP
 * Flow: Email/Password → OTP Verify → Basic Info → Store Select → Success
 */
(() => {
const esc = SPG.esc;
const api = SPG.api;

let _step = 1;
let _email = '';
let _password = '';
let _fullName = '';
let _displayName = '';
let _phone = '';
let _resendTimer = 0;
let _resendInterval = null;

// ═══ STEP 1: Email + Password ═══
function renderStep1() {
  return `<div class="reg-step">
    <div class="reg-step-title">Step 1 of 4 — Account</div>
    <div class="fg"><label class="lb">Email *</label>
      <input class="inp" id="reg-email" type="email" placeholder="your.email@example.com" autocomplete="email" autofocus>
    </div>
    <div class="fg"><label class="lb">Password * (6-12 characters)</label>
      <input class="inp" id="reg-pass" type="password" placeholder="6-12 characters" maxlength="12" autocomplete="new-password">
    </div>
    <div class="fg"><label class="lb">Confirm Password *</label>
      <input class="inp" id="reg-pass2" type="password" placeholder="Confirm password" maxlength="12">
    </div>
    <div class="error-msg" id="reg-error"></div>
    <button class="login-btn" onclick="RegV2.nextStep1()">Continue</button>
  </div>`;
}

async function nextStep1() {
  const email = document.getElementById('reg-email')?.value.trim();
  const pass = document.getElementById('reg-pass')?.value;
  const pass2 = document.getElementById('reg-pass2')?.value;
  if (!email || !pass) { SPG.showError('reg-error', 'Please fill in all fields'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { SPG.showError('reg-error', 'Invalid email format'); return; }
  if (pass.length < 6) { SPG.showError('reg-error', 'Password must be at least 6 characters'); return; }
  if (pass.length > 12) { SPG.showError('reg-error', 'Password must not exceed 12 characters'); return; }
  if (pass !== pass2) { SPG.showError('reg-error', 'Passwords do not match'); return; }

  SPG.showLoader();
  try {
    // Check email availability
    const check = await api.checkEmail(email);
    if (!check.available) { SPG.showError('reg-error', check.reason || 'Email already in use'); SPG.hideLoader(); return; }
    // Send OTP
    await api.sendOtp(email);
    _email = email;
    _password = pass;
    _step = 2;
    SPG.hideLoader();
    renderCurrentStep();
    startResendTimer();
  } catch (e) {
    SPG.hideLoader();
    SPG.showError('reg-error', e.message || 'Failed to send verification code');
  }
}

// ═══ STEP 2: OTP Verify ═══
function renderStep2() {
  return `<div class="reg-step">
    <div class="reg-step-title">Step 2 of 4 — Verify Email</div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:16px">
      We sent a 6-digit code to<br><strong>${esc(_email)}</strong>
    </div>
    <div class="fg">
      <input class="inp" id="reg-otp" type="text" maxlength="6" inputmode="numeric" placeholder="000000"
        style="text-align:center;font-size:24px;letter-spacing:8px;font-weight:700" autofocus>
    </div>
    <div class="error-msg" id="reg-error"></div>
    <button class="login-btn" onclick="RegV2.verifyOtp()">Verify</button>
    <div style="text-align:center;margin-top:12px">
      <span id="resend-timer" style="font-size:12px;color:var(--t3)"></span>
      <a id="resend-btn" class="lk" style="font-size:12px;color:var(--acc);cursor:pointer;display:none" onclick="RegV2.resendOtp()">Resend Code</a>
    </div>
    <div style="text-align:center;margin-top:8px">
      <a class="lk" style="font-size:11px;color:var(--t3);cursor:pointer" onclick="RegV2.backToStep1()">← Change email</a>
    </div>
  </div>`;
}

function startResendTimer() {
  _resendTimer = 60;
  clearInterval(_resendInterval);
  updateResendUI();
  _resendInterval = setInterval(() => {
    _resendTimer--;
    updateResendUI();
    if (_resendTimer <= 0) clearInterval(_resendInterval);
  }, 1000);
}

function updateResendUI() {
  const timer = document.getElementById('resend-timer');
  const btn = document.getElementById('resend-btn');
  if (!timer || !btn) return;
  if (_resendTimer > 0) {
    timer.textContent = `Resend in ${_resendTimer}s`;
    timer.style.display = 'inline';
    btn.style.display = 'none';
  } else {
    timer.style.display = 'none';
    btn.style.display = 'inline';
  }
}

async function resendOtp() {
  SPG.showLoader();
  try {
    await api.sendOtp(_email);
    SPG.toast('Verification code resent', 'success');
    startResendTimer();
  } catch (e) { SPG.toast(e.message || 'Failed to resend', 'error'); }
  SPG.hideLoader();
}

async function verifyOtp() {
  const code = document.getElementById('reg-otp')?.value.trim();
  if (!code || code.length !== 6) { SPG.showError('reg-error', 'Please enter 6-digit code'); return; }
  SPG.showLoader();
  try {
    await api.verifyOtp(_email, code);
    _step = 3;
    SPG.hideLoader();
    renderCurrentStep();
  } catch (e) {
    SPG.hideLoader();
    SPG.showError('reg-error', e.message || 'Invalid code');
  }
}

function backToStep1() {
  _step = 1;
  clearInterval(_resendInterval);
  renderCurrentStep();
}

// ═══ STEP 3: Basic Info ═══
function renderStep3() {
  return `<div class="reg-step">
    <div class="reg-step-title">Step 3 of 4 — Your Info</div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Full Name (EN) *</label><input class="inp" id="reg-fullname" placeholder="First Last"></div>
      <div class="fg" style="flex:1"><label class="lb">Display Name *</label><input class="inp" id="reg-nickname" placeholder="e.g. Mint"></div>
    </div>
    <div class="fg"><label class="lb">Phone</label><input class="inp" id="reg-phone" type="tel" placeholder="04xx xxx xxx"></div>
    <div class="error-msg" id="reg-error"></div>
    <button class="login-btn" onclick="RegV2.nextStep3()">Continue</button>
  </div>`;
}

function nextStep3() {
  _fullName = document.getElementById('reg-fullname')?.value.trim();
  _displayName = document.getElementById('reg-nickname')?.value.trim();
  _phone = document.getElementById('reg-phone')?.value.trim();
  if (!_fullName || !_displayName) { SPG.showError('reg-error', 'Please fill in name fields'); return; }
  _step = 4;
  renderCurrentStep();
}

// ═══ STEP 4: Store Select ═══
function renderStep4() {
  return `<div class="reg-step">
    <div class="reg-step-title">Step 4 of 4 — Select Store</div>
    <div class="fg"><label class="lb">Store *</label><select class="inp" id="reg-store"><option value="">-- Select Store --</option></select></div>
    <div class="fg"><label class="lb">Department *</label><select class="inp" id="reg-dept"><option value="">-- Select Dept --</option></select></div>
    <div class="error-msg" id="reg-error"></div>
    <button class="login-btn" onclick="RegV2.submitRegister()">Create Account</button>
  </div>`;
}

async function loadStep4Dropdowns() {
  try {
    const [stores, depts] = await Promise.all([SPG.perm.getStoresCache(), SPG.perm.getDeptsCache()]);
    const storeEl = document.getElementById('reg-store');
    const deptEl = document.getElementById('reg-dept');
    if (storeEl) storeEl.innerHTML = '<option value="">-- Select Store --</option>' +
      stores.filter(s => s.store_id !== 'ALL').map(s => `<option value="${esc(s.store_id)}">${esc(s.store_name_th || s.store_name)}</option>`).join('');
    if (deptEl) deptEl.innerHTML = '<option value="">-- Select Dept --</option>' +
      depts.map(d => `<option value="${esc(d.dept_id)}">${esc(d.dept_name_th || d.dept_name)}</option>`).join('');
  } catch { SPG.toast('Failed to load dropdowns', 'error'); }
}

async function submitRegister() {
  const store = document.getElementById('reg-store')?.value;
  const dept = document.getElementById('reg-dept')?.value;
  if (!store) { SPG.showError('reg-error', 'Please select a store'); return; }
  if (!dept) { SPG.showError('reg-error', 'Please select a department'); return; }

  SPG.showLoader();
  try {
    await api.registerV2({
      email: _email, password: _password,
      full_name: _fullName, display_name: _displayName, phone: _phone || '',
      requested_store_id: store, requested_dept_id: dept,
    });
    _step = 5;
    SPG.hideLoader();
    renderCurrentStep();
  } catch (e) {
    SPG.hideLoader();
    SPG.showError('reg-error', e.message || 'Registration failed');
  }
}

// ═══ STEP 5: Success ═══
function renderStep5() {
  return `<div class="reg-step" style="text-align:center;padding:40px 20px">
    <div style="font-size:48px;margin-bottom:12px">✅</div>
    <div style="font-size:18px;font-weight:700;margin-bottom:8px">Account Created!</div>
    <div style="color:var(--t3);font-size:13px;margin-bottom:24px;line-height:1.6">
      Please sign in to complete your<br>employee details and LINE connection.
    </div>
    <button class="login-btn" onclick="SPG.go('login')">Sign In</button>
  </div>`;
}

// ═══ RENDER ═══
function renderCurrentStep() {
  const ct = document.getElementById('reg-content');
  if (!ct) return;
  switch (_step) {
    case 1: ct.innerHTML = renderStep1(); break;
    case 2: ct.innerHTML = renderStep2(); break;
    case 3: ct.innerHTML = renderStep3(); break;
    case 4: ct.innerHTML = renderStep4(); setTimeout(loadStep4Dropdowns, 50); break;
    case 5: ct.innerHTML = renderStep5(); break;
  }
}

function render() {
  _step = 1; _email = ''; _password = ''; _fullName = ''; _displayName = ''; _phone = '';
  return `<div class="shell-login fade-in">
    <div class="login-header">
      <button class="login-back" onclick="SPG.go('login')">←</button>
      <div class="login-header-title">Create Account</div>
    </div>
    <div style="padding:20px;flex:1;overflow-y:auto">
      <div class="reg-progress">
        <div class="reg-dot active">1</div><div class="reg-line"></div>
        <div class="reg-dot">2</div><div class="reg-line"></div>
        <div class="reg-dot">3</div><div class="reg-line"></div>
        <div class="reg-dot">4</div>
      </div>
      <div id="reg-content">${renderStep1()}</div>
    </div>
  </div>`;
}

function onLoad() {
  // Update progress dots
  document.querySelectorAll('.reg-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i < _step);
    dot.classList.toggle('current', i + 1 === _step);
  });
}

window.RegV2 = {
  render, onLoad, renderCurrentStep,
  nextStep1, verifyOtp, resendOtp, backToStep1,
  nextStep3, submitRegister,
};
})();
