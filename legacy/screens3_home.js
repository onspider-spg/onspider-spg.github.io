/**
 * Version 1.2.1 | 17 MAR 2026 | Siam Palette Group
 * ═══════════════════════════════════════════
 * SPG App — Home Module
 * screens3_home.js — Account Detail, Create Account, Audit Trail
 * v1.2.1: Fix admin Edit User PIN validation to 6 digits
 * v1.2: D1 sortable users + audit tables
 * ═══════════════════════════════════════════
 */

(() => {
const esc = App.esc;

// ════════════════════════════════
// ACCOUNT DETAIL — view + edit + users
// ════════════════════════════════
let _accDetail = null;
let _accUsers = null;

async function loadAccountDetail(accountId) {
  if (!accountId) return;
  const ct = document.getElementById('acct-detail-content');
  if (!ct) return;
  try {
    const [accData, userData] = await Promise.all([
      API.adminGetAccounts({ search: accountId, page_size: 1 }),
      API.adminGetUsers(accountId),
    ]);
    _accDetail = (accData.accounts || [])[0];
    _accUsers = userData.users || [];
    if (!_accDetail) { ct.innerHTML = '<div class="empty-state"><div class="empty-text">Account not found</div></div>'; return; }
    renderDetail(ct);
  } catch (e) { App.toast(e.message, 'error'); }
}

function renderDetail(ct) {
  const a = _accDetail;
  const isSuspended = a.status === 'suspended';
  const stsCls = a.status === 'approved' ? 'sts-ok' : a.status === 'suspended' ? 'sts-err' : 'sts-warn';

  let usersHtml = '';
  if (_accUsers.length === 0) {
    usersHtml = '<div style="color:var(--t3);font-size:12px;padding:12px">No users</div>';
  } else {
    const ST = App.getSortState('users');
    const sorted = App.sortData(_accUsers, ST ? ST.key : 'display_name', ST ? ST.dir : 'asc');
    usersHtml = `<table class="tbl"><thead><tr>${App.sortTh('users','display_name','Display Name')}${App.sortTh('users','full_name','Full Name')}${App.sortTh('users','phone','Phone',' class="hide-m"')}<th>PIN</th>${App.sortTh('users','is_active','Status')}<th></th></tr></thead><tbody>` +
      sorted.map(u => `<tr>
        <td style="font-weight:600">${esc(u.display_name)}</td>
        <td>${esc(u.full_name || '-')}</td>
        <td class="hide-m">${esc(u.phone || '-')}</td>
        <td>${u.has_pin ? '<span class="sts sts-ok">Set</span>' : '<span class="sts sts-warn">None</span>'}</td>
        <td><span class="sts ${u.is_active ? 'sts-ok' : 'sts-err'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
        <td><a class="lk" onclick="Screens3.showEditUser('${esc(u.user_id)}')">Edit</a></td>
      </tr>`).join('') + '</tbody></table>';
  }

  ct.innerHTML = `
    <div class="card" style="max-width:800px">
      <div class="profile-header">
        <div class="profile-avatar" style="background:var(--acc2);color:var(--acc)">${esc((a.display_label || '?').charAt(0).toUpperCase())}</div>
        <div><div class="profile-name">${esc(a.display_label)}</div><div class="profile-meta">${esc(a.account_id)} · ${esc(a.account_type)} · ${esc(a.tier_id)}</div></div>
        <span class="sts ${stsCls}" style="margin-left:auto">${esc(a.status)}</span>
      </div>
      <div class="profile-grid" style="margin-top:12px">
        <div><div class="lb">Username</div><div class="profile-field-readonly">${esc(a.username)}</div></div>
        <div><div class="lb">Email</div><div class="profile-field-readonly">${esc(a.email || '-')}</div></div>
        <div><div class="lb">Store</div><div class="profile-field-readonly">${esc(a.store_id || '-')}</div></div>
        <div><div class="lb">Department</div><div class="profile-field-readonly">${esc(a.dept_id || '-')}</div></div>
        <div><div class="lb">Linked Users</div><div class="profile-field-readonly">${a.user_count || _accUsers.length || 0}</div></div>
        <div><div class="lb">Last Login</div><div class="profile-field-readonly">${a.last_login ? new Date(a.last_login).toLocaleString('en-GB') : 'Never'}</div></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="Screens3.showEditAccount()">Edit Account</button>
        ${isSuspended
          ? `<button class="btn btn-outline btn-sm" style="color:var(--green);border-color:var(--green)" onclick="Screens3.doAccountAction('reactivate')">Reactivate</button>`
          : `<button class="btn btn-danger btn-sm" onclick="Screens3.doAccountAction('suspend')">Suspend</button>`
        }
      </div>
    </div>
    <div class="sec-title" style="margin-top:20px">Users (${_accUsers.length})</div>
    <div class="card" style="max-width:800px;padding:0;overflow:hidden">${usersHtml}</div>`;
}

function showEditAccount() {
  const a = _accDetail;
  if (!a) return;
  const tiers = ['T1','T2','T3','T4','T5','T6','T7'];
  const tierOpts = tiers.map(t => `<option value="${t}"${a.tier_id === t ? ' selected' : ''}>${t}</option>`).join('');
  App.showDialog(`<div class="popup-sheet">
    <div class="popup-header"><div class="popup-title">Edit Account: ${esc(a.display_label)}</div><button class="popup-close" onclick="App.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Display Label</label><input class="inp" id="ea-label" value="${esc(a.display_label || '')}"></div>
    <div class="fg"><label class="lb">Tier</label><select class="inp" id="ea-tier">${tierOpts}</select></div>
    <div class="fg"><label class="lb">Store ID</label><input class="inp" id="ea-store" value="${esc(a.store_id || '')}"></div>
    <div class="fg"><label class="lb">Dept ID</label><input class="inp" id="ea-dept" value="${esc(a.dept_id || '')}"></div>
    <div class="error-msg" id="ea-error"></div>
    <div class="popup-actions"><button class="btn btn-outline" onclick="App.closeDialog()">Cancel</button><button class="btn btn-primary" id="btn-ea-save" onclick="Screens3.doSaveAccount()">Save</button></div>
  </div>`);
}

async function doSaveAccount() {
  const a = _accDetail; if (!a) return;
  const btn = document.getElementById('btn-ea-save');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const updates = {
      account_id: a.account_id,
      display_label: document.getElementById('ea-label')?.value.trim(),
      tier_id: document.getElementById('ea-tier')?.value,
      store_id: document.getElementById('ea-store')?.value.trim(),
      dept_id: document.getElementById('ea-dept')?.value.trim(),
    };
    await API.adminUpdateAccount(updates);
    App.closeDialog();
    App.toast('Account updated', 'success');
    // B2: update memory directly → re-render (no re-fetch)
    Object.assign(_accDetail, updates);
    const ct = document.getElementById('acct-detail-content');
    if (ct) renderDetail(ct);
  } catch (e) { App.showError('ea-error', e.message); btn.disabled = false; btn.textContent = 'Save'; }
}

async function doAccountAction(action) {
  const a = _accDetail; if (!a) return;
  const label = action === 'suspend' ? 'Suspend this account? All sessions will be killed.' : 'Reactivate this account?';
  App.showDialog(`<div class="popup-sheet">
    <div class="popup-header"><div class="popup-title">${action === 'suspend' ? 'Suspend' : 'Reactivate'} Account</div><button class="popup-close" onclick="App.closeDialog()">✕</button></div>
    <div style="font-size:13px;margin-bottom:16px">${label}<br><strong>${esc(a.display_label)}</strong></div>
    <div class="popup-actions"><button class="btn btn-outline" onclick="App.closeDialog()">Cancel</button><button class="btn ${action === 'suspend' ? 'btn-danger' : 'btn-primary'}" onclick="Screens3.confirmAccountAction('${action}')">Confirm</button></div>
  </div>`);
}

async function confirmAccountAction(action) {
  App.closeDialog(); App.showLoader();
  try {
    await API.adminUpdateAccount({ account_id: _accDetail.account_id, action });
    App.toast(`Account ${action}d`, 'success');
    // B2: update memory directly → re-render (no re-fetch)
    _accDetail.status = action === 'suspend' ? 'suspended' : 'approved';
    const ct = document.getElementById('acct-detail-content');
    if (ct) renderDetail(ct);
  } catch (e) { App.toast(e.message, 'error'); }
  finally { App.hideLoader(); }
}

function showEditUser(userId) {
  const u = (_accUsers || []).find(x => x.user_id === userId);
  if (!u) return;
  App.showDialog(`<div class="popup-sheet">
    <div class="popup-header"><div class="popup-title">Edit User: ${esc(u.display_name)}</div><button class="popup-close" onclick="App.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Display Name</label><input class="inp" id="eu-nick" value="${esc(u.display_name || '')}"></div>
    <div class="fg"><label class="lb">Full Name</label><input class="inp" id="eu-full" value="${esc(u.full_name || '')}"></div>
    <div class="fg"><label class="lb">Phone</label><input class="inp" id="eu-phone" value="${esc(u.phone || '')}"></div>
    <div class="fg"><label class="lb">Status</label><select class="inp" id="eu-active"><option value="true"${u.is_active ? ' selected' : ''}>Active</option><option value="false"${!u.is_active ? ' selected' : ''}>Inactive</option></select></div>
    <div class="fg"><label class="lb">Reset PIN (leave blank to keep)</label><input class="inp" id="eu-pin" type="password" maxlength="6" placeholder="New 6-digit PIN" inputmode="numeric"></div>
    <div class="error-msg" id="eu-error"></div>
    <div class="popup-actions"><button class="btn btn-outline" onclick="App.closeDialog()">Cancel</button><button class="btn btn-primary" id="btn-eu-save" onclick="Screens3.doSaveUser('${esc(userId)}')">Save</button></div>
  </div>`);
}

async function doSaveUser(userId) {
  const btn = document.getElementById('btn-eu-save');
  btn.disabled = true; btn.textContent = 'Saving...';
  const data = { user_id: userId, display_name: document.getElementById('eu-nick')?.value.trim(), full_name: document.getElementById('eu-full')?.value.trim(), phone: document.getElementById('eu-phone')?.value.trim(), is_active: document.getElementById('eu-active')?.value === 'true' };
  const pin = document.getElementById('eu-pin')?.value.trim();
  if (pin) { if (!/^\d{6}$/.test(pin)) { App.showError('eu-error', 'PIN ต้องเป็นตัวเลข 6 หลัก'); btn.disabled = false; btn.textContent = 'Save'; return; } data.new_pin = pin; }
  try {
    await API.adminUpdateUser(data);
    App.closeDialog();
    App.toast('User updated', 'success');
    // B2: update memory directly → re-render (no re-fetch)
    const u = (_accUsers || []).find(x => x.user_id === userId);
    if (u) { u.display_name = data.display_name; u.full_name = data.full_name; u.phone = data.phone; u.is_active = data.is_active; if (pin) u.has_pin = true; }
    const ct = document.getElementById('acct-detail-content');
    if (ct) renderDetail(ct);
  } catch (e) { App.showError('eu-error', e.message); btn.disabled = false; btn.textContent = 'Save'; }
}

// ════════════════════════════════
// CREATE ACCOUNT — form with store/dept dropdowns
// ════════════════════════════════
async function renderCreateAccountForm() {
  const ct = document.getElementById('acct-create-content');
  if (!ct) return;
  let storeOpts = '<option value="">-- ไม่ระบุ --</option>';
  let deptOpts = '<option value="">-- ไม่ระบุ --</option>';
  try {
    const [stores, depts] = await Promise.all([App.getStoresCache(), App.getDeptsCache()]);
    storeOpts += stores.filter(s => s.store_id !== 'ALL').map(s => `<option value="${esc(s.store_id)}">${esc(s.store_name)}</option>`).join('');
    deptOpts += depts.map(d => `<option value="${esc(d.dept_id)}">${esc(d.dept_name)}</option>`).join('');
  } catch { /* use defaults */ }

  ct.innerHTML = `
    <div class="card" style="max-width:500px">
      <div class="fg"><label class="lb">Username / Email *</label><input class="inp" id="ca-user" placeholder="username or email"></div>
      <div class="fg"><label class="lb">Password * (min 8)</label><input class="inp" id="ca-pass" type="password" placeholder="••••••••"></div>
      <div class="fg"><label class="lb">Display Label *</label><input class="inp" id="ca-label" placeholder="e.g. Mango Coco Mac"></div>
      <div class="fg"><label class="lb">Account Type *</label><select class="inp" id="ca-type"><option value="individual">Individual</option><option value="group">Group</option></select></div>
      <div class="fg"><label class="lb">Tier *</label><select class="inp" id="ca-tier"><option>T1</option><option>T2</option><option>T3</option><option>T4</option><option selected>T5</option><option>T6</option><option>T7</option></select></div>
      <div style="display:flex;gap:8px">
        <div class="fg" style="flex:1"><label class="lb">Store</label><select class="inp" id="ca-store">${storeOpts}</select></div>
        <div class="fg" style="flex:1"><label class="lb">Department</label><select class="inp" id="ca-dept">${deptOpts}</select></div>
      </div>
      <div class="error-msg" id="ca-error"></div>
      <div style="display:flex;gap:8px;margin-top:var(--sp-md)">
        <button class="btn btn-outline" onclick="App.go('admin',{tab:'accounts'})">Cancel</button>
        <button class="btn btn-primary" id="btn-ca-save" onclick="Screens3.doCreateAccount()">Create Account</button>
      </div>
    </div>`;
}

async function doCreateAccount() {
  const username = document.getElementById('ca-user')?.value.trim();
  const password = document.getElementById('ca-pass')?.value;
  const display_label = document.getElementById('ca-label')?.value.trim();
  if (!username || !password || !display_label) { App.showError('ca-error', 'Please fill required fields'); return; }
  if (password.length < 8) { App.showError('ca-error', 'Password must be at least 8 characters'); return; }
  const btn = document.getElementById('btn-ca-save');
  btn.disabled = true; btn.textContent = 'Creating...';
  try {
    const data = await API.adminCreateAccount({
      username, password, display_label,
      account_type: document.getElementById('ca-type')?.value || 'individual',
      tier_id: document.getElementById('ca-tier')?.value || 'T5',
      store_id: document.getElementById('ca-store')?.value || '',
      dept_id: document.getElementById('ca-dept')?.value || '',
    });
    App.toast(`Account ${data.account_id} created`, 'success');
    App.go('account-detail', { account_id: data.account_id });
  } catch (e) { App.showError('ca-error', e.message); btn.disabled = false; btn.textContent = 'Create Account'; }
}

// ════════════════════════════════
// AUDIT TRAIL — on-demand filter + load + pagination
// ════════════════════════════════
let _auditEntries = [];
let _auditPage = 1;
let _auditTotal = 0;
let _auditData = null;

function renderAuditUI() {
  const ct = document.getElementById('audit-content');
  if (!ct) return;
  const today = new Date().toISOString().split('T')[0];
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  _auditEntries = []; _auditPage = 1; _auditTotal = 0;

  ct.innerHTML = `
    <div class="card" style="max-width:900px">
      <div style="font-size:11px;color:var(--t3);margin-bottom:12px">Select a date range and click Load to view audit records.</div>
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
        <div><div class="fl-label">Date from</div><input class="fl" id="aud-from" type="date" value="${weekAgo}" style="width:140px"></div>
        <div><div class="fl-label">Date to</div><input class="fl" id="aud-to" type="date" value="${today}" style="width:140px"></div>
        <div><div class="fl-label">Event Type</div><select class="fl" id="aud-type" style="width:130px"><option value="">All Types</option><option value="login">Login</option><option value="account_change">Account Change</option><option value="permission_change">Permission</option><option value="config_change">Config</option><option value="registration">Registration</option></select></div>
        <button class="btn btn-primary btn-sm" onclick="Screens3.loadAudit(1)">Load</button>
      </div>
    </div>
    <div id="audit-results">
      <div class="empty-state"><div class="empty-icon">☰</div><div class="empty-text">Select date range and click Load</div></div>
    </div>`;
}

async function loadAudit(page) {
  _auditPage = page || 1;
  const results = document.getElementById('audit-results');
  if (!results) return;
  results.innerHTML = '<div style="text-align:center;padding:20px;color:var(--t3)">Loading...</div>';
  try {
    const filters = {
      date_from: document.getElementById('aud-from')?.value || '',
      date_to: document.getElementById('aud-to')?.value || '',
      event_type: document.getElementById('aud-type')?.value || '',
      page: _auditPage, page_size: 20,
    };
    const data = await API.adminGetAuditLog(filters);
    _auditEntries = data.entries || [];
    _auditTotal = data.total || 0;
    _auditData = data;
    renderAuditTable(results, data);
  } catch (e) { results.innerHTML = `<div class="empty-state"><div class="empty-text" style="color:var(--red)">${esc(e.message)}</div></div>`; }
}

function renderAuditTable(ct, data) {
  const entries = data.entries || [];
  if (entries.length === 0) {
    ct.innerHTML = '<div class="empty-state"><div class="empty-icon">☰</div><div class="empty-text">No records found</div></div>';
    return;
  }
  const ST = App.getSortState('audit');
  const sorted = ST ? App.sortData(entries, ST.key, ST.dir) : entries;
  let rows = sorted.map(e => {
    const dt = e.created_at ? new Date(e.created_at).toLocaleString('en-GB', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '-';
    return `<tr>
      <td style="font-size:10px;white-space:nowrap">${dt}</td>
      <td><span class="sts sts-warn" style="font-size:9px">${esc(e.event_type)}</span></td>
      <td>${esc(e.event_action)}</td>
      <td class="hide-m" style="font-size:11px">${esc(e.account_id)}</td>
      <td style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.detail || '-')}</td>
    </tr>`;
  }).join('');

  const totalPages = data.pages || 1;
  let pager = '';
  if (totalPages > 1) {
    pager = `<div style="display:flex;gap:8px;justify-content:center;margin-top:12px">`;
    if (_auditPage > 1) pager += `<a class="lk" onclick="Screens3.loadAudit(${_auditPage - 1})">← Prev</a>`;
    pager += `<span style="font-size:11px;color:var(--t3)">Page ${_auditPage} / ${totalPages} (${_auditTotal} records)</span>`;
    if (_auditPage < totalPages) pager += `<a class="lk" onclick="Screens3.loadAudit(${_auditPage + 1})">Next →</a>`;
    pager += `</div>`;
  }

  ct.innerHTML = `
    <div class="card" style="max-width:900px;padding:0;overflow-x:auto;margin-top:8px">
      <table class="tbl"><thead><tr>${App.sortTh('audit','created_at','Time')}${App.sortTh('audit','event_type','Type')}${App.sortTh('audit','event_action','Action')}${App.sortTh('audit','account_id','Account',' class="hide-m"')}<th>Detail</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>
    <div style="font-size:11px;color:var(--t3);margin-top:8px">${_auditTotal} records total</div>
    ${pager}`;
}

// ═══ D1: SORT EVENT LISTENER ═══
document.addEventListener('spg-sort', (e) => {
  if (e.detail.tableId === 'users' && _accDetail) {
    const ct = document.getElementById('acct-detail-content');
    if (ct) renderDetail(ct);
  }
  if (e.detail.tableId === 'audit' && _auditData) {
    const results = document.getElementById('audit-results');
    if (results) renderAuditTable(results, _auditData);
  }
});

// ═══ GLOBAL EXPORT ═══
window.Screens3 = {
  loadAccountDetail, showEditAccount, doSaveAccount,
  doAccountAction, confirmAccountAction,
  showEditUser, doSaveUser,
  renderCreateAccountForm, doCreateAccount,
  renderAuditUI, loadAudit,
};

})();
