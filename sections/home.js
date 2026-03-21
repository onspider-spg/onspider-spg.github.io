/**
 * SPG HUB v1.0.0 | 20 MAR 2026 | Siam Palette Group
 * sections/home.js — Home Section
 * Login, Register, Staff Select, Dashboard, Profile, Admin shells
 */

(() => {
const esc = SPG.esc;
const api = SPG.api;

// ═══ LAYOUT HELPERS ═══
function shellLogin(inner) {
  return `<div class="shell-login fade-in">${inner}</div>`;
}


// ════════════════════════════════
// LOGIN
// ════════════════════════════════
function renderLogin() {
  return shellLogin(`<div class="login-shell">
    <div class="login-logo">🎨</div>
    <div class="login-title">SPG HUB</div>
    <div class="login-brand">SIAM PALETTE GROUP</div>
    <div class="login-sub">One Union Management System</div>
    <div class="login-form">
      <input class="login-inp" id="inp-user" placeholder="Email / Username" autocomplete="username" autofocus>
      <input class="login-inp" id="inp-pass" type="password" placeholder="••••••••" autocomplete="current-password">
      <div class="error-msg" id="login-error"></div>
      <button class="login-btn" id="btn-login" onclick="HomeSection.doLogin()">Sign In</button>
      <div style="text-align:center;margin-top:14px;font-size:13px;color:var(--t3)">
        Don't have an account? <a class="lk" style="color:var(--acc);cursor:pointer;font-weight:600" onclick="SPG.go('register')">Register</a>
      </div>
    </div>
  </div>`);
}

async function doLogin() {
  const user = document.getElementById('inp-user')?.value.trim();
  const pass = document.getElementById('inp-pass')?.value;
  if (!user || !pass) { SPG.showError('login-error', 'Please enter email and password'); return; }

  const btn = document.getElementById('btn-login');
  btn.disabled = true; btn.textContent = 'Signing in...';
  SPG.hideError('login-error');
  SPG.showLoader();

  try {
    const data = await api.login(user, pass);
    if (data.store_selection_required) {
      api.saveAccountTemp({ ...data, _storeSelect: true });
      SPG.go('store-select');
    } else if (data.account_type === 'individual') {
      api.saveSession(data);
      SPG.go('dashboard');
    } else {
      api.saveAccountTemp(data);
      SPG.go('staff-select');
    }
  } catch (e) {
    SPG.showError('login-error', e.message || 'Sign in failed');
    btn.disabled = false; btn.textContent = 'Sign In';
  } finally {
    SPG.hideLoader();
  }
}


// ════════════════════════════════
// REGISTER
// ════════════════════════════════
function renderRegister() {
  return shellLogin(`
    <div class="login-header">
      <button class="login-back" onclick="SPG.go('login')">←</button>
      <div class="login-header-title">Register</div>
    </div>
    <div style="padding:20px;flex:1;overflow-y:auto">
      <div class="fg"><label class="lb">Email / Username *</label><input class="inp" id="inp-reg-email" placeholder="email@example.com" autocomplete="email"></div>
      <div class="fg"><label class="lb">Password * (6–12 characters)</label><input class="inp" id="inp-reg-pass" type="password" placeholder="6–12 characters" maxlength="12" autocomplete="new-password"></div>
      <div style="display:flex;gap:8px">
        <div class="fg" style="flex:1"><label class="lb">Full Name *</label><input class="inp" id="inp-reg-full" placeholder="First Last"></div>
        <div class="fg" style="flex:1"><label class="lb">Display Name *</label><input class="inp" id="inp-reg-nick" placeholder="e.g. Mint"></div>
      </div>
      <div style="display:flex;gap:8px">
        <div class="fg" style="flex:1"><label class="lb">Store *</label><select class="inp" id="inp-reg-store"><option value="">-- Select Store --</option></select></div>
        <div class="fg" style="flex:1"><label class="lb">Department *</label><select class="inp" id="inp-reg-dept"><option value="">-- Select Dept --</option></select></div>
      </div>
      <div class="inp-hint" style="margin-top:4px;margin-bottom:8px;color:var(--t3)">You can complete your employee details after signing in.</div>
      <div class="error-msg" id="reg-error"></div>
      <button class="login-btn" style="margin-top:12px" onclick="HomeSection.doRegister()">Submit Registration</button>
    </div>`);
}

async function loadRegisterDropdowns() {
  try {
    const [stores, depts] = await Promise.all([SPG.perm.getStoresCache(), SPG.perm.getDeptsCache()]);
    const storeEl = document.getElementById('inp-reg-store');
    const deptEl = document.getElementById('inp-reg-dept');
    if (storeEl) storeEl.innerHTML = '<option value="">-- Select Store --</option>' +
      stores.filter(s => s.store_id !== 'ALL').map(s => `<option value="${esc(s.store_id)}">${esc(s.store_name_th || s.store_name)}</option>`).join('');
    if (deptEl) deptEl.innerHTML = '<option value="">-- Select Dept --</option>' +
      depts.map(d => `<option value="${esc(d.dept_id)}">${esc(d.dept_name_th || d.dept_name)}</option>`).join('');
  } catch (e) { SPG.toast('Failed to load dropdowns', 'error'); }
}

async function doRegister() {
  const email = document.getElementById('inp-reg-email')?.value.trim();
  const password = document.getElementById('inp-reg-pass')?.value;
  const full_name = document.getElementById('inp-reg-full')?.value.trim();
  const display_name = document.getElementById('inp-reg-nick')?.value.trim();
  const requested_store_id = document.getElementById('inp-reg-store')?.value || '';
  const requested_dept_id = document.getElementById('inp-reg-dept')?.value || '';
  if (!email || !password || !full_name || !display_name) {
    SPG.showError('reg-error', 'Please fill in all required fields'); return;
  }
  if (password.length < 6) { SPG.showError('reg-error', 'Password must be at least 6 characters'); return; }
  if (password.length > 12) { SPG.showError('reg-error', 'Password must not exceed 12 characters'); return; }
  if (!requested_store_id) { SPG.showError('reg-error', 'Please select a store'); return; }
  if (!requested_dept_id) { SPG.showError('reg-error', 'Please select a department'); return; }
  SPG.showLoader();
  try {
    await api.register({ username: email, email, password, full_name, display_name, requested_store_id, requested_dept_id });
    SPG.toast('Registration submitted! Awaiting approval.', 'success');
    SPG.go('login');
  } catch (e) { SPG.showError('reg-error', e.message); }
  finally { SPG.hideLoader(); }
}


// ════════════════════════════════
// STAFF SELECT (group login flow)
// ════════════════════════════════
function renderStaffSelect() {
  const acc = api.getAccountTemp();
  if (!acc) return renderLogin();
  return shellLogin(`
    <div class="login-header">
      <button class="login-back" onclick="SPG.api.clearSession();SPG.go('login')">←</button>
      <div class="login-header-title">Who is using this device?</div>
    </div>
    <div style="padding:20px;flex:1">
      <div style="font-size:11px;color:var(--t3);margin-bottom:12px">${esc(acc.display_label)}</div>
      <div id="staff-grid"><div style="text-align:center;padding:20px;color:var(--t3)">กำลังโหลด...</div></div>
      <div style="text-align:center;margin-top:16px">
        <a class="lk" style="color:var(--gold)" onclick="SPG.go('new-staff')">+ Add new staff</a>
      </div>
    </div>`);
}

async function loadStaffList() {
  const acc = api.getAccountTemp();
  if (!acc) return;
  try {
    const data = await api.getUsers(acc.account_id);
    const grid = document.getElementById('staff-grid');
    if (!grid) return;
    grid.innerHTML = (data.users || []).map(u => {
      const initial = (u.display_name || '?').charAt(0).toUpperCase();
      return `<div class="staff-card" onclick="HomeSection.selectStaff('${esc(u.user_id)}')">
        <div class="staff-avatar">${esc(initial)}</div>
        <div><div class="staff-name">${esc(u.display_name)}</div><div class="staff-hint">Enter PIN to continue</div></div>
      </div>`;
    }).join('');
  } catch (e) { SPG.toast(e.message, 'error'); }
}

async function selectStaff(userId) {
  const acc = api.getAccountTemp();
  if (!acc) return;
  SPG.showLoader();
  try {
    const data = await api.switchUser(acc.account_id, userId);
    api.saveSession(data);
    SPG.hideLoader();
    SPG.go('dashboard');
  } catch (e) {
    SPG.hideLoader();
    if (e.key === 'SET_PIN_REQUIRED') {
      showSetPinPopup(userId);
    } else if (e.message && e.message.toLowerCase().includes('pin')) {
      showPinPopup(userId);
    } else {
      SPG.toast(e.message, 'error');
    }
  }
}

function showPinPopup(userId) {
  SPG.showDialog(`<div class="popup-sheet">
    <div class="popup-header"><div class="popup-title">Enter PIN</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">6-digit PIN</label>
      <input class="inp" id="inp-pin" type="password" maxlength="6" inputmode="numeric" placeholder="••••••" autofocus>
    </div>
    <div class="error-msg" id="pin-error"></div>
    <div class="popup-actions"><button class="btn btn-primary" onclick="HomeSection.submitPin('${userId}')">ยืนยัน</button></div>
  </div>`);
  setTimeout(() => document.getElementById('inp-pin')?.focus(), 100);
}

async function submitPin(userId) {
  const pin = document.getElementById('inp-pin')?.value.trim();
  if (!pin || pin.length !== 6) { SPG.showError('pin-error', 'PIN ต้อง 6 หลัก'); return; }
  const acc = api.getAccountTemp();
  if (!acc) return;
  SPG.showLoader();
  try {
    const data = await api.switchUser(acc.account_id, userId, pin);
    SPG.closeDialog();
    api.saveSession(data);
    SPG.hideLoader();
    SPG.go('dashboard');
  } catch (e) {
    SPG.hideLoader();
    SPG.showError('pin-error', e.message || 'Incorrect PIN');
  }
}

function showSetPinPopup(userId) {
  SPG.showDialog(`<div class="popup-sheet">
    <div class="popup-header"><div class="popup-title">ตั้ง PIN ใหม่</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div style="font-size:13px;color:var(--t3);margin-bottom:12px">คุณยังไม่มี PIN กรุณาตั้ง PIN ก่อนเข้าใช้งาน</div>
    <div class="fg"><label class="lb">PIN (6 หลัก)</label><input class="inp" id="inp-set-pin" type="password" maxlength="6" inputmode="numeric" placeholder="••••••" autofocus></div>
    <div class="fg"><label class="lb">ยืนยัน PIN</label><input class="inp" id="inp-set-pin2" type="password" maxlength="6" inputmode="numeric" placeholder="••••••"></div>
    <div class="error-msg" id="setpin-error"></div>
    <div class="popup-actions"><button class="btn btn-primary" onclick="HomeSection.submitSetPin('${userId}')">ตั้ง PIN</button></div>
  </div>`);
  setTimeout(() => document.getElementById('inp-set-pin')?.focus(), 100);
}

async function submitSetPin(userId) {
  const p1 = document.getElementById('inp-set-pin')?.value.trim();
  const p2 = document.getElementById('inp-set-pin2')?.value.trim();
  if (!p1 || p1.length !== 6 || !/^\d{6}$/.test(p1)) { SPG.showError('setpin-error', 'PIN ต้องเป็นตัวเลข 6 หลัก'); return; }
  if (p1 !== p2) { SPG.showError('setpin-error', 'PIN ไม่ตรงกัน'); return; }
  const acc = api.getAccountTemp();
  if (!acc) return;
  SPG.showLoader();
  try {
    await api.setUserPin(acc.account_id, userId, p1);
    SPG.toast('ตั้ง PIN สำเร็จ', 'success');
    const data = await api.switchUser(acc.account_id, userId, p1);
    SPG.closeDialog();
    api.saveSession(data);
    SPG.hideLoader();
    SPG.go('dashboard');
  } catch (e) {
    SPG.hideLoader();
    SPG.showError('setpin-error', e.message || 'ตั้ง PIN ไม่สำเร็จ');
  }
}


// ════════════════════════════════
// NEW STAFF
// ════════════════════════════════
function renderNewStaff() {
  const acc = api.getAccountTemp();
  if (!acc) return renderLogin();
  return shellLogin(`
    <div class="login-header">
      <button class="login-back" onclick="SPG.go('staff-select')">←</button>
      <div class="login-header-title">เพิ่มบัญชีใหม่</div>
    </div>
    <div style="padding:20px;flex:1;overflow-y:auto">
      <div style="padding:10px 14px;background:var(--blue-bg);border-radius:var(--rd);font-size:12px;color:var(--blue);margin-bottom:14px">สร้าง account ใหม่ภายใต้: <strong>${esc(acc.display_label)}</strong></div>
      <div class="fg"><label class="lb">Display Name *</label><input class="inp" id="inp-staff-nick" placeholder="e.g. Junnie-GB"></div>
      <div class="fg"><label class="lb">Full Name *</label><input class="inp" id="inp-staff-full" placeholder="First Last"></div>
      <div class="fg"><label class="lb">Phone</label><input class="inp" id="inp-staff-phone" placeholder="0812345678"></div>
      <div class="fg"><label class="lb">PIN (6 digits) *</label><input class="inp" id="inp-staff-pin" type="password" maxlength="6" inputmode="numeric" placeholder="เช่น 123456"></div>
      <div class="error-msg" id="staff-error"></div>
      <button class="login-btn" style="margin-top:12px" onclick="HomeSection.doCreateStaff()">สร้างบัญชี</button>
    </div>`);
}

async function doCreateStaff() {
  const acc = api.getAccountTemp();
  if (!acc) return;
  const display_name = document.getElementById('inp-staff-nick')?.value.trim();
  const full_name = document.getElementById('inp-staff-full')?.value.trim();
  const pin = document.getElementById('inp-staff-pin')?.value.trim();
  const phone = document.getElementById('inp-staff-phone')?.value.trim();
  if (!display_name || !full_name) { SPG.showError('staff-error', 'Please fill in all fields'); return; }
  if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) { SPG.showError('staff-error', 'PIN must be 6 digits'); return; }
  SPG.showLoader();
  try {
    const data = await api.createUser({ account_id: acc.account_id, display_name, full_name, pin, phone });
    SPG.toast(`เพิ่ม "${display_name}" สำเร็จ`, 'success');
    await selectStaff(data.user_id);
  } catch (e) {
    SPG.showError('staff-error', e.message);
    SPG.hideLoader();
  }
}


// ════════════════════════════════
// STORE SELECT (multi-store login)
// ════════════════════════════════
function renderStoreSelect() {
  const acc = api.getAccountTemp();
  if (!acc || !acc._storeSelect) return renderLogin();
  const assignments = acc.assignments || [];
  const cards = assignments.map(a => {
    return `<div class="staff-card" onclick="HomeSection.doSelectStore('${esc(a.store_id)}')" style="cursor:pointer">
      <div class="staff-avatar" style="background:var(--acc2);color:var(--acc);font-size:14px">${esc((a.store_id || '?').substring(0, 2))}</div>
      <div>
        <div class="staff-name">${esc(a.store_id)}</div>
        <div class="staff-hint">${esc(a.position_name || '')}${a.dept_id ? ' · ' + esc(a.dept_id) : ''}</div>
      </div>
    </div>`;
  }).join('');

  return shellLogin(`
    <div class="login-header">
      <button class="login-back" onclick="SPG.api.clearSession();SPG.go('login')">←</button>
      <div class="login-header-title">Select Store</div>
    </div>
    <div style="padding:20px;flex:1">
      <div style="font-size:11px;color:var(--t3);margin-bottom:12px">${esc(acc.display_name || acc.display_label || '')} — Please select a store</div>
      <div id="store-grid">${cards}</div>
    </div>`);
}

async function doSelectStore(storeId) {
  const acc = api.getAccountTemp();
  if (!acc || !acc.temp_token) { SPG.toast('Session expired, please login again', 'error'); SPG.go('login'); return; }
  SPG.showLoader();
  try {
    const data = await api.selectStore(acc.temp_token, storeId);
    api.saveSession(data);
    SPG.hideLoader();
    SPG.go('dashboard');
  } catch (e) {
    SPG.hideLoader();
    SPG.toast(e.message || 'Failed to select store', 'error');
    if (e.key === 'INVALID_TEMP_TOKEN') SPG.go('login');
  }
}


// ════════════════════════════════
// DASHBOARD
// ════════════════════════════════
function renderDashboard() {
  const s = api.getSession();
  if (!s) return renderLogin();

  return SPG.shell(`
    ${SPG.toolbar('Dashboard')}
    <div class="content">
      <div style="margin-bottom:20px">
        <div style="font-size:var(--fs-body);font-weight:700;margin-bottom:var(--sp-xs)" id="dash-greeting">Welcome, ${esc(s.display_name || s.display_label)}</div>
        <div style="font-size:11px;color:var(--t3)" id="dash-meta">${esc(s.position_id ? s.position_name : s.tier_id)} · ${esc(s.store_id || 'HQ')}</div>
      </div>
      <div class="sec-title">Sections</div>
      <div class="sec-grid" id="sec-grid">
        ${SPG.ui.skeleton(60, 4)}
      </div>
    </div>`);
}

async function loadDashboard() {
  const st = await SPG.loadBundle();
  if (!st) return;
  fillDashboard(st.session, st.modules);
  SPG.buildSidebar();

  // Profile completion alert
  if (!st.profileComplete) {
    setTimeout(() => {
      SPG.showDialog(`<div class="popup-sheet" style="width:360px">
        <div class="popup-header"><div class="popup-title">⚠️ Employee Form Incomplete</div></div>
        <div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6">
          กรุณากรอกข้อมูลพนักงานให้ครบถ้วนก่อนเริ่มใช้งาน<br>
          <span style="color:var(--t3);font-size:11px">Please complete your employee details before using the system.</span>
        </div>
        <div class="popup-actions">
          <button class="btn btn-primary" onclick="SPG.closeDialog();SPG.go('profile')">Go to Profile</button>
        </div>
      </div>`);
    }, 500);
  }
}

function fillDashboard(session, modules) {
  if (!session || !modules) return;

  const greet = document.getElementById('dash-greeting');
  const meta = document.getElementById('dash-meta');
  if (greet) greet.textContent = `Welcome, ${session.display_name || ''}`;
  if (meta) meta.textContent = `${session.position_id ? session.position_name : session.tier_id} · ${session.store_id || 'HQ'}`;

  const grid = document.getElementById('sec-grid');
  if (!grid) return;

  // Section definitions with visual config
  const SECTION_COLORS = {
    'saledaily_report': { bg: '#dbeafe',          color: '#2563eb',       abbr: 'SD', name: 'Sales Daily',   desc: 'Daily sales & reports' },
    'purchase':         { bg: '#fef3c7',           color: '#d97706',       abbr: 'PO', name: 'Purchase',      desc: 'Orders & receiving' },
    'bakery_order':     { bg: '#fce7f3',           color: '#db2777',       abbr: 'BC', name: 'Bakery Order',  desc: 'Center to branch orders' },
    'finance':          { bg: '#ede9fe',           color: '#7c3aed',       abbr: 'FN', name: 'Finance',       desc: 'Transactions & payments' },
    'operations':       { bg: '#ccfbf1',           color: '#0d9488',       abbr: 'OP', name: 'Operations',    desc: 'Daily ops & checklists' },
    'hr':               { bg: '#e0e7ff',           color: '#4f46e5',       abbr: 'HR', name: 'HR',            desc: 'People & access' },
    'foodhub':          { bg: '#dcfce7',           color: '#16a34a',       abbr: 'FH', name: 'Food Hub',      desc: 'Recipes & SOP' },
    'marketing':        { bg: '#ffe4e6',           color: '#e11d48',       abbr: 'MK', name: 'Marketing',     desc: 'Sales analysis & NPD' },
    'equipment':        { bg: '#f1f5f9',           color: '#475569',       abbr: 'EQ', name: 'Equipment',     desc: 'Asset & repair tracking' },
    'bi':               { bg: '#cffafe',           color: '#0891b2',       abbr: 'BI', name: 'BI Dashboard',  desc: 'Cross-module insights' },
    'crm':              { bg: '#ede9fe',           color: '#8b5cf6',       abbr: 'CR', name: 'CRM',           desc: 'Customer experience' },
  };

  // Module-to-section mapping
  const moduleToSection = {
    'bakery_order': 'bakery', 'saledaily_report': 'sales', 'finance': 'finance',
    'purchase': 'purchase', 'hr': 'hr', 'operations': 'operations',
    'foodhub': 'foodhub', 'marketing': 'marketing',
    'equipment': 'equipment', 'bi': 'bi', 'crm': 'crm',
  };

  grid.innerHTML = modules.filter(m => m.is_accessible).map(m => {
    const sc = SECTION_COLORS[m.module_id] || { bg: 'var(--bg3)', color: 'var(--t2)', abbr: (m.module_id || '??').substring(0, 2).toUpperCase(), icon: '📋', name: m.module_name, desc: '' };
    const sectionId = moduleToSection[m.module_id];

    // Navigate internally if section is registered, otherwise launch external
    let onClick = '';
    if (m.status === 'active' && m.app_url) {
      onClick = `HomeSection.launchSection('${esc(sectionId || '')}', '${esc(m.app_url)}')`;
    }

    return SPG.ui.sectionCard({
      id: m.module_id,
      name: sc.name || m.module_name,
      desc: sc.desc || m.module_name_en || '',
      icon: sc.icon,
      bg: sc.bg,
      color: sc.color,
      abbr: sc.abbr,
      status: m.status,
      onClick,
    });
  }).join('') || SPG.ui.empty('📋', 'No sections available');
}

// Navigate to section — internal (migrated) or external (legacy)
function launchSection(sectionId, externalUrl) {
  const s = api.getSession();
  if (!s) return;

  // Migrated sections → navigate internally via SPG.go()
  const migratedSections = {
    'sales': 'sales/dashboard',
    'purchase': 'purchase/home',
    'bakery': 'bakery/home',
    'finance': 'finance/home',
    'hr': 'hr/home',
    'operations': 'operations/home',
    'foodhub': 'foodhub/home',
    'marketing': 'marketing/home',
    'equipment': 'equipment/home',
    'bi': 'bi/home',
    'crm': 'crm/home',
  };

  if (sectionId && migratedSections[sectionId]) {
    SPG.go(migratedSections[sectionId]);
    return;
  }

  // Not yet migrated → launch external URL with token
  const sep = externalUrl.includes('?') ? '&' : '?';
  location.href = `${externalUrl}${sep}token=${s.token}&store_id=${encodeURIComponent(s.store_id || '')}`;
}


// ════════════════════════════════
// PROFILE
// ════════════════════════════════
let _profileLoading = false;

function renderProfile() {
  const s = api.getSession();
  if (!s) return renderLogin();

  return SPG.shell(`
    ${SPG.toolbar('Profile')}
    <div class="content">
      <div class="card max-w-sm" id="profile-card">
        <div style="text-align:center;padding:20px;color:var(--t3)">Loading...</div>
      </div>
    </div>`);
}

async function loadProfile() {
  if (SPG.state._profileLoaded && SPG.state.profile) {
    renderProfileCard(SPG.state.profile);
    return;
  }
  if (_profileLoading) return;
  _profileLoading = true;
  try {
    const data = await api.getProfile();
    SPG.state.profile = data;
    SPG.state._profileLoaded = true;
    renderProfileCard(data);
  } catch (e) { SPG.toast(e.message, 'error'); }
  finally { _profileLoading = false; }
}

function renderProfileCard(d) {
  const card = document.getElementById('profile-card');
  if (!card) return;
  const initial = (d.display_name || d.full_name || '?').charAt(0).toUpperCase();
  const isGroup = d.account_type === 'group';
  const avatarBg = isGroup ? 'var(--orange-bg)' : 'var(--acc2)';
  const avatarColor = isGroup ? 'var(--orange)' : 'var(--acc)';
  const badgeBg = isGroup ? 'var(--orange-bg)' : 'var(--acc2)';
  const badgeColor = isGroup ? 'var(--orange)' : 'var(--acc)';
  const badgeText = isGroup ? 'Group User' : 'Individual';

  card.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar" style="background:${avatarBg};color:${avatarColor}">${esc(initial)}</div>
      <div><div class="profile-name">${esc(d.display_name || d.full_name)}</div><div class="profile-meta">${esc(d.position_id ? d.position_name : d.tier_id)} · ${esc(d.store_id || 'HQ')}</div></div>
      <div class="profile-badge" style="background:${badgeBg};color:${badgeColor}">${badgeText}</div>
    </div>
    ${isGroup ? `<div style="padding:8px 12px;background:var(--bg3);border-radius:var(--rd);font-size:11px;color:var(--t2);margin-bottom:14px">Account: <strong>${esc(d.display_label)}</strong></div>` : ''}
    <div class="fg"><label class="lb">Display Name</label><div class="profile-field-value">${esc(d.display_name)}</div></div>
    <div class="fg"><label class="lb">Full Name</label><div class="profile-field-value">${esc(d.full_name)}</div></div>
    <div class="fg"><label class="lb">Phone</label><div class="profile-field-value">${esc(d.phone || '-')}</div></div>
    ${!isGroup && d.email ? `<div class="fg"><label class="lb">Email / Username</label><div class="profile-field-readonly">${esc(d.email || d.username)}</div></div>` : ''}
    <div class="profile-grid">
      <div><div class="lb">Store</div><div class="profile-field-readonly">${esc(d.store_name_th || d.store_id || '-')}</div></div>
      <div><div class="lb">Position</div><div class="profile-field-readonly">${esc(d.position_id ? d.position_name : (d.tier_id + ' · ' + (d.tier_name || '')))}</div></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:var(--sp-md)">
      <button class="btn btn-primary btn-sm" onclick="HomeSection.showEditProfile()">Edit Profile</button>
      ${isGroup
        ? '<button class="btn btn-outline btn-sm" onclick="HomeSection.showChangePinPopup()">Change PIN</button>'
        : '<button class="btn btn-outline btn-sm" onclick="HomeSection.showChangePasswordPopup()">Change Password</button>'
      }
    </div>
    ${isGroup ? '<div class="inp-hint" style="margin-top:8px">Group users cannot change password. Contact admin if needed.</div>' : ''}
    <div style="margin-top:16px;border-top:1px solid var(--bd2);padding-top:14px">
      <div style="font-weight:700;font-size:12px;margin-bottom:8px">Store Assignments</div>
      <div id="profile-stores" style="margin-bottom:10px"></div>
      <button class="btn btn-outline btn-sm" onclick="HomeSection.showRequestStore()">+ Request Additional Store</button>
    </div>`;

  setTimeout(() => {
    const el = document.getElementById('profile-stores');
    if (!el) return;
    const s = api.getSession();
    const assignments = s?.store_assignments || [];
    if (assignments.length === 0) {
      el.innerHTML = `<div style="font-size:11px;color:var(--t3)">Store: ${esc(d.store_id || '-')}</div>`;
    } else {
      el.innerHTML = assignments.map(a => `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11px">
        <span style="font-weight:600">${esc(a.store_id)}</span>
        <span style="color:var(--t3)">${esc(a.dept_id || '-')}</span>
        <span style="color:var(--acc)">${esc(a.position_name || '')}</span>
        ${a.is_primary ? '<span style="font-size:9px;padding:1px 4px;border-radius:3px;background:var(--acc2);color:var(--acc)">Primary</span>' : ''}
      </div>`).join('');
    }
  }, 50);
}

// Profile edit popup
function showEditProfile() {
  const d = SPG.state.profile;
  if (!d) return;
  SPG.showDialog(`<div class="popup-sheet">
    <div class="popup-header"><div class="popup-title">Edit Profile</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Display Name *</label><input class="inp" id="pf-nick" value="${esc(d.display_name || '')}"></div>
    <div class="fg"><label class="lb">Full Name *</label><input class="inp" value="${esc(d.full_name || '')}" readonly class="inp-readonly"></div>
    <div class="fg"><label class="lb">Phone</label><input class="inp" id="pf-phone" value="${esc(d.phone || '')}"></div>
    <div class="inp-hint">Email, Store, Tier cannot be changed here.</div>
    <div class="error-msg" id="pf-edit-error"></div>
    <div class="popup-actions"><button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button><button class="btn btn-primary" id="btn-pf-save" onclick="HomeSection.doSaveProfile()">Save</button></div>
  </div>`);
}

async function doSaveProfile() {
  const display_name = document.getElementById('pf-nick')?.value.trim();
  const phone = document.getElementById('pf-phone')?.value.trim();
  if (!display_name) { SPG.showError('pf-edit-error', 'Display name is required'); return; }
  const btn = document.getElementById('btn-pf-save');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    await api.updateProfile({ display_name, phone });
    SPG.closeDialog();
    SPG.toast('Profile updated', 'success');
    SPG.state.profile.display_name = display_name;
    SPG.state.profile.phone = phone;
    renderProfileCard(SPG.state.profile);
    const s = api.getSession();
    if (s) { s.display_name = display_name; localStorage.setItem('spg_session', JSON.stringify(s)); }
    if (SPG.state.session) SPG.state.session.display_name = display_name;
    const tbName = document.querySelector('.topbar-user .hide-m');
    if (tbName) tbName.textContent = display_name;
    const tbAvatar = document.querySelector('.topbar-avatar');
    if (tbAvatar) tbAvatar.textContent = (display_name || '?').charAt(0).toUpperCase();
    SPG.buildSidebar();
  } catch (e) {
    SPG.showError('pf-edit-error', e.message || 'Update failed');
    btn.disabled = false; btn.textContent = 'Save';
  }
}

function showChangePasswordPopup() {
  SPG.showDialog(`<div class="popup-sheet">
    <div class="popup-header"><div class="popup-title">Change Password</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Current Password *</label><input class="inp" id="pw-current" type="password" placeholder="••••••••"></div>
    <div class="fg"><label class="lb">New Password * (6–12 characters)</label><input class="inp" id="pw-new" type="password" placeholder="6–12 characters" maxlength="12"></div>
    <div class="fg"><label class="lb">Confirm New Password *</label><input class="inp" id="pw-confirm" type="password" placeholder="••••••••"></div>
    <div class="error-msg" id="pw-error"></div>
    <div class="popup-actions"><button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button><button class="btn btn-primary" id="btn-pw-save" onclick="HomeSection.doChangePassword()">Change Password</button></div>
  </div>`);
}

async function doChangePassword() {
  const current_password = document.getElementById('pw-current')?.value;
  const new_password = document.getElementById('pw-new')?.value;
  const confirm_password = document.getElementById('pw-confirm')?.value;
  if (!current_password) { SPG.showError('pw-error', 'กรุณากรอกรหัสผ่านปัจจุบัน'); return; }
  if (!new_password || new_password.length < 6) { SPG.showError('pw-error', 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัว'); return; }
  if (new_password.length > 12) { SPG.showError('pw-error', 'รหัสผ่านใหม่ต้องไม่เกิน 12 ตัว'); return; }
  if (new_password !== confirm_password) { SPG.showError('pw-error', 'Passwords do not match'); return; }
  const btn = document.getElementById('btn-pw-save');
  btn.disabled = true; btn.textContent = 'Changing...';
  try {
    await api.changePassword({ current_password, new_password });
    SPG.closeDialog();
    SPG.toast('Password changed', 'success');
  } catch (e) {
    SPG.showError('pw-error', e.message || 'Failed to change password');
    btn.disabled = false; btn.textContent = 'Change Password';
  }
}

function showChangePinPopup() {
  SPG.showDialog(`<div class="popup-sheet">
    <div class="popup-header"><div class="popup-title">Change PIN</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">New PIN (6 digits) *</label><input class="inp" id="pin-new" type="password" placeholder="••••••" maxlength="6" inputmode="numeric"></div>
    <div class="fg"><label class="lb">Confirm New PIN *</label><input class="inp" id="pin-confirm" type="password" placeholder="••••••" maxlength="6" inputmode="numeric"></div>
    <div class="error-msg" id="pin-chg-error"></div>
    <div class="popup-actions"><button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button><button class="btn btn-primary" id="btn-pin-save" onclick="HomeSection.doChangePin()">Change PIN</button></div>
  </div>`);
}

async function doChangePin() {
  const new_pin = document.getElementById('pin-new')?.value.trim();
  const confirm_pin = document.getElementById('pin-confirm')?.value.trim();
  if (!new_pin || new_pin.length !== 6 || !/^\d{6}$/.test(new_pin)) { SPG.showError('pin-chg-error', 'PIN ต้องเป็นตัวเลข 6 หลัก'); return; }
  if (new_pin !== confirm_pin) { SPG.showError('pin-chg-error', 'PIN ไม่ตรงกัน'); return; }
  const btn = document.getElementById('btn-pin-save');
  btn.disabled = true; btn.textContent = 'Changing...';
  try {
    await api.changePin({ new_pin });
    SPG.closeDialog();
    SPG.toast('PIN changed', 'success');
  } catch (e) {
    SPG.showError('pin-chg-error', e.message || 'Failed to change PIN');
    btn.disabled = false; btn.textContent = 'Change PIN';
  }
}

// Request additional store
async function showRequestStore() {
  let storeOpts = '', deptOpts = '';
  try {
    const [stores, depts] = await Promise.all([SPG.perm.getStoresCache(), SPG.perm.getDeptsCache()]);
    storeOpts = stores.filter(s => s.store_id !== 'ALL').map(s => `<option value="${esc(s.store_id)}">${esc(s.store_name_th || s.store_name)}</option>`).join('');
    deptOpts = '<option value="">— ไม่ระบุ —</option>' + depts.map(d => `<option value="${esc(d.dept_id)}">${esc(d.dept_name_th || d.dept_name)}</option>`).join('');
  } catch { SPG.toast('Failed to load data', 'error'); return; }

  SPG.showDialog(`<div class="popup-sheet" style="width:340px">
    <div class="popup-header"><div class="popup-title">Request Additional Store</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div style="font-size:11px;color:var(--t3);margin-bottom:12px">ส่งคำขอเพิ่มสาขา — Admin จะเป็นผู้อนุมัติ</div>
    <div class="fg"><label class="lb">Store *</label><select class="inp" id="rs-store">${storeOpts}</select></div>
    <div class="fg"><label class="lb">Department</label><select class="inp" id="rs-dept">${deptOpts}</select></div>
    <div class="fg"><label class="lb">Note</label><textarea class="inp" id="rs-note" rows="2" placeholder="เหตุผล เช่น ย้ายสาขา, ช่วยงาน" style="width:100%;box-sizing:border-box"></textarea></div>
    <div class="error-msg" id="rs-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="HomeSection.submitRequestStore()">Submit Request</button>
    </div>
  </div>`);
}

async function submitRequestStore() {
  const requested_store_id = document.getElementById('rs-store')?.value;
  const requested_dept_id = document.getElementById('rs-dept')?.value || '';
  const note = document.getElementById('rs-note')?.value.trim() || '';
  if (!requested_store_id) { SPG.showError('rs-error', 'กรุณาเลือกสาขา'); return; }
  SPG.showLoader();
  try {
    await api.requestStore({ requested_store_id, requested_dept_id, note });
    SPG.closeDialog();
    SPG.toast('ส่งคำขอเพิ่มสาขาแล้ว รอ Admin อนุมัติ', 'success');
  } catch (e) { SPG.showError('rs-error', e.message); }
  finally { SPG.hideLoader(); }
}


// ════════════════════════════════
// ADMIN / MASTER / AUDIT (shells — load external scripts)
// ════════════════════════════════
function renderAdmin(p) {
  const tab = p?.tab || 'accounts';
  const titles = { accounts: 'Accounts', permissions: 'Permissions (Legacy)', tieraccess: 'Tier Access (Legacy)', requests: 'Registration Requests', 'store-requests': 'Store Requests', 'home-settings': 'Home Settings', 'base-permissions': 'Base Permissions', 'dept-overrides': 'Dept Overrides', 'staff-assignments': 'Staff Assignments' };
  const title = titles[tab] || 'Admin';
  const isSA = SPG.perm.hasHome('super_admin');

  let actions = '';
  if (tab === 'accounts') actions = `<button class="btn btn-primary btn-sm" onclick="SPG.go('acct-create')">+ Create Account</button>`;
  else if (['permissions', 'tieraccess', 'home-settings', 'base-permissions'].includes(tab) && isSA) {
    actions = `<button class="btn btn-primary btn-sm" onclick="Admin.saveAdminTab('${tab}')">Save Changes</button>`;
  }

  const r = SPG.shell(`${SPG.toolbar(title, actions)}<div class="content"><div id="admin-content">${SPG.ui.skeleton(200)}</div></div>`);
  setTimeout(() => {
    if (typeof Admin !== 'undefined') Admin.loadAdminTab(tab);
    else SPG.toast('Admin module not loaded', 'error');
  }, 30);
  return r;
}

function renderMaster(p) {
  const tab = p?.tab || 'modules';
  const titles = { modules: 'Modules', stores: 'Stores', depts: 'Departments' };
  const title = titles[tab] || 'Master Data';
  const isSA = SPG.perm.hasHome('super_admin');

  let actions = '';
  if (isSA) {
    actions = tab === 'modules'
      ? `<button class="btn btn-primary btn-sm" onclick="Master.saveMasterTab('${tab}')">Save Changes</button>`
      : `<button class="btn btn-primary btn-sm" onclick="Master.addMasterItem('${tab}')">+ Add ${title.slice(0, -1)}</button>`;
  }

  const r = SPG.shell(`${SPG.toolbar(title, actions)}<div class="content"><div id="master-content">${SPG.ui.skeleton(200)}</div></div>`);
  setTimeout(() => {
    if (typeof Master !== 'undefined') Master.loadMasterTab(tab);
    else SPG.toast('Master module not loaded', 'error');
  }, 30);
  return r;
}

function renderAccountDetail(p) {
  const r = SPG.shell(`
    ${SPG.toolbar('Account Detail', `<button class="btn btn-outline btn-sm" onclick="SPG.go('admin',{tab:'accounts'})">← Accounts</button>`)}
    <div class="content"><div id="acct-detail-content">${SPG.ui.skeleton(300)}</div></div>`);
  setTimeout(() => {
    if (typeof Screens3 !== 'undefined') Screens3.loadAccountDetail(p?.account_id);
  }, 30);
  return r;
}

function renderAcctCreate() {
  const r = SPG.shell(`
    ${SPG.toolbar('Create Account', `<button class="btn btn-outline btn-sm" onclick="SPG.go('admin',{tab:'accounts'})">← Accounts</button>`)}
    <div class="content"><div id="acct-create-content">${SPG.ui.skeleton(300)}</div></div>`);
  setTimeout(() => {
    if (typeof Screens3 !== 'undefined') Screens3.renderCreateAccountForm();
  }, 30);
  return r;
}

function renderAudit() {
  const r = SPG.shell(`
    ${SPG.toolbar('Audit Trail')}
    <div class="content"><div id="audit-content"></div></div>`);
  setTimeout(() => {
    if (typeof Screens3 !== 'undefined') Screens3.renderAuditUI();
  }, 30);
  return r;
}


// ════════════════════════════════
// REGISTER SECTION
// ════════════════════════════════
SPG.section('home', {
  defaultRoute: 'dashboard',
  routes: {
    // Auth flow (no shell)
    'login':          { render: renderLogin,        shell: false, public: true },
    'register':       { render: renderRegister,     shell: false, public: true, onLoad: loadRegisterDropdowns },
    'staff-select':   { render: renderStaffSelect,  shell: false, onLoad: loadStaffList },
    'store-select':   { render: renderStoreSelect,  shell: false },
    'new-staff':      { render: renderNewStaff,     shell: false },

    // Main screens
    'dashboard':      { render: renderDashboard,    onLoad: loadDashboard },
    'profile':        { render: renderProfile,      onLoad: loadProfile },

    // Admin shells
    'admin':          { render: renderAdmin,        minPerm: 'admin' },
    'master':         { render: renderMaster,       minPerm: 'admin' },
    'account-detail': { render: renderAccountDetail, minPerm: 'admin' },
    'acct-create':    { render: renderAcctCreate,   minPerm: 'admin' },
    'audit':          { render: renderAudit,        minPerm: 'edit' },
  },
});


// ═══ PUBLIC API (for onclick handlers) ═══
window.HomeSection = {
  doLogin, doRegister,
  selectStaff, submitPin, submitSetPin,
  doCreateStaff, doSelectStore,
  launchSection,
  showEditProfile, doSaveProfile,
  showChangePasswordPopup, doChangePassword,
  showChangePinPopup, doChangePin,
  showRequestStore, submitRequestStore,
};

})();
