/**
 * SPG HUB v1.0.0 | 21 MAR 2026 | Siam Palette Group
 * sections/hr.js — HR & Roster Module
 * Employees, Attendance, Roster, Pay Runs, Reports, Settings
 *
 * ⚠️ REWORK NEEDED: This module needs migration to:
 *    - Use SPG.perm.canDo() for function-level permissions
 *    - Use hr_ prefix for all API actions
 *    - Remove admin/config/audit routes (moved to Home)
 *    - Apply Gen Z Design Guide (see MODULE-DEV-GUIDE.md)
 */

(() => {
const esc = SPG.esc;
const api = SPG.api;
const ui = SPG.ui;

// Register endpoint
api.registerEndpoint('hr', 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/hr');

// ═══ LOCAL STATE ═══
const _hr = {
  bundle: null,        // hr_init_bundle cache
  bundleLoading: false,
  dashboard: null,
  employees: [],
  employeeDetail: null,
  scanLogs: [],
  templates: [],
  templateDetail: null,
  weeklyRoster: null,
  attendanceReview: null,
  attendanceDetail: null,
  payRuns: [],
  payRunDetail: null,
  reports: null,
  settings: null,
  // filters
  empSearch: '',
  empStore: '',
  empStatus: '',
  scanDate: '',
  scanStore: '',
  rosterWeek: '',
  reviewPeriod: '',
  reviewStore: '',
};

// ═══ API HELPERS ═══
function hrPost(action, data = {}) {
  return api.post('hr', action, api.tb(data));
}

// ═══ TIMEZONE ═══
function sydneyNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' }));
}

function sydneyDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' });
}

function sydneyDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleString('en-AU', { timeZone: 'Australia/Sydney', hour12: false });
}

function toDateInput(d) {
  if (!d) {
    const now = sydneyNow();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  }
  const dt = new Date(d);
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

function mondayOfWeek(dateStr) {
  const d = dateStr ? new Date(dateStr) : sydneyNow();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d);
  mon.setDate(diff);
  return toDateInput(mon);
}

function weekDates(mondayStr) {
  const mon = new Date(mondayStr);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    days.push(toDateInput(d));
  }
  return days;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES_SHORT = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ═══ ROLE HELPERS ═══
function getRole() {
  const s = api.getSession();
  if (!s) return 'staff';
  const tier = (s.tier_id || '').toLowerCase();
  if (tier === 'super_admin' || tier === 'admin') return 'admin';
  if (tier === 'manager' || (s.position_level && s.position_level <= 3)) return 'manager';
  return 'staff';
}

function isAdmin() { return getRole() === 'admin'; }
function isManager() { return getRole() === 'manager' || getRole() === 'admin'; }

// ═══ INIT BUNDLE ═══
async function loadHRBundle() {
  if (_hr.bundle) return _hr.bundle;
  if (_hr.bundleLoading) return null;
  _hr.bundleLoading = true;
  try {
    const data = await hrPost('hr_init_bundle');
    _hr.bundle = data;
    return data;
  } catch (e) {
    SPG.toast(e.message || 'Failed to load HR data', 'error');
    return null;
  } finally {
    _hr.bundleLoading = false;
  }
}

// ═══ ATTENDANCE CALC HELPERS ═══
function calcHours(timeIn, timeOut) {
  if (!timeIn || !timeOut) return 0;
  const a = new Date(timeIn);
  const b = new Date(timeOut);
  const diff = (b - a) / (1000 * 60 * 60);
  return Math.max(0, Math.round(diff * 100) / 100);
}

function scanStatus(scheduledStart, actualIn) {
  if (!actualIn) return 'absent';
  if (!scheduledStart) return 'on-time';
  const sched = new Date(scheduledStart);
  const actual = new Date(actualIn);
  const diff = (actual - sched) / (1000 * 60);
  if (diff <= 5) return 'on-time';
  if (diff <= 15) return 'late';
  return 'late';
}

function scanStatusBadge(status) {
  const map = {
    'on-time': '<span class="sts sts-ok">On Time</span>',
    'late': '<span class="sts sts-warn">Late</span>',
    'absent': '<span class="sts sts-err">Absent</span>',
    'leave': '<span class="sts sts-info">Leave</span>',
  };
  return map[status] || ui.badge(status);
}

function formatHours(h) {
  if (h == null) return '-';
  return h.toFixed(1) + 'h';
}

function formatMoney(n) {
  if (n == null) return '-';
  return '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ═══ SHARED SUB-COMPONENTS ═══
function employeeAvatar(emp) {
  const initial = ((emp.display_name || emp.full_name || '?').charAt(0)).toUpperCase();
  const bg = emp.avatar_color || 'var(--acc2)';
  const color = emp.avatar_text_color || 'var(--acc)';
  return `<div class="hr-avatar" style="background:${bg};color:${color}">${esc(initial)}</div>`;
}

function employeeCard(emp, onClick) {
  const statusBadge = ui.badge(emp.status || 'active');
  return `<div class="hr-emp-card" onclick="${onClick || ''}">
    ${employeeAvatar(emp)}
    <div class="hr-emp-info">
      <div class="hr-emp-name">${esc(emp.display_name || emp.full_name)}</div>
      <div class="hr-emp-meta">${esc(emp.position_name || emp.position_id || '')}${emp.store_id ? ' &middot; ' + esc(emp.store_id) : ''}</div>
    </div>
    <div class="hr-emp-badge">${statusBadge}</div>
  </div>`;
}

function kpiCard(label, value, sub, color) {
  return `<div class="hr-kpi">
    <div class="hr-kpi-value" style="${color ? 'color:' + color : ''}">${esc(String(value))}</div>
    <div class="hr-kpi-label">${esc(label)}</div>
    ${sub ? `<div class="hr-kpi-sub">${esc(sub)}</div>` : ''}
  </div>`;
}

function backBtn(route, label) {
  return `<button class="btn btn-outline btn-sm" onclick="SPG.go('hr/${route}')">← ${esc(label || 'Back')}</button>`;
}

function storeFilterOptions() {
  const bundle = _hr.bundle;
  if (!bundle || !bundle.stores) return '<option value="">All Stores</option>';
  return '<option value="">All Stores</option>' + (bundle.stores || []).map(s =>
    `<option value="${esc(s.store_id)}">${esc(s.store_name_th || s.store_name || s.store_id)}</option>`
  ).join('');
}


// ════════════════════════════════════════════════════════════
// 1. HOME — HR Dashboard
// ════════════════════════════════════════════════════════════
function renderHome() {
  return SPG.shell(`
    ${SPG.toolbar('HR Dashboard')}
    <div class="content">
      <div id="hr-dash-kpis" class="hr-kpi-grid">${ui.skeleton(80, 4)}</div>
      <div class="hr-dash-sections" id="hr-dash-sections">${ui.skeleton(120, 3)}</div>
    </div>`, 'HR');
}

async function loadHome() {
  await loadHRBundle();
  try {
    const data = await hrPost('hr_get_dashboard');
    _hr.dashboard = data;
    renderDashContent(data);
  } catch (e) {
    const el = document.getElementById('hr-dash-kpis');
    if (el) el.innerHTML = ui.empty('👥', 'Failed to load dashboard', e.message);
  }
}

function renderDashContent(d) {
  const kpis = document.getElementById('hr-dash-kpis');
  if (kpis) {
    kpis.innerHTML =
      kpiCard('Total Staff', d.total_employees || 0, 'Active employees', 'var(--acc)') +
      kpiCard('On Duty Today', d.on_duty_today || 0, 'Clocked in') +
      kpiCard('Late Today', d.late_today || 0, '', 'var(--orange)') +
      kpiCard('Absent Today', d.absent_today || 0, '', 'var(--red)');
  }

  const sections = document.getElementById('hr-dash-sections');
  if (!sections) return;

  const role = getRole();
  let html = '<div class="hr-quick-grid">';

  const items = [
    { icon: '👥', label: 'Employees', desc: 'Manage staff profiles', route: 'employees', roles: ['admin', 'manager'] },
    { icon: '📋', label: 'Scan Logs', desc: 'View attendance logs', route: 'scan-logs', roles: ['admin', 'manager'] },
    { icon: '📅', label: 'Roster Templates', desc: 'Manage shift templates', route: 'roster-templates', roles: ['admin', 'manager'] },
    { icon: '🗓', label: 'Weekly Roster', desc: 'This week\'s schedule', route: 'weekly-roster', roles: ['admin', 'manager', 'staff'] },
    { icon: '✅', label: 'Attendance Review', desc: 'Approve attendance', route: 'attendance-review', roles: ['admin', 'manager'] },
    { icon: '💵', label: 'Pay Runs', desc: 'Payroll management', route: 'pay-runs', roles: ['admin'] },
    { icon: '📊', label: 'Reports', desc: 'HR analytics', route: 'reports', roles: ['admin', 'manager'] },
    { icon: '⚙', label: 'Settings', desc: 'HR configuration', route: 'settings', roles: ['admin'] },
  ];

  items.forEach(item => {
    if (!item.roles.includes(role)) return;
    html += `<div class="hr-quick-card" onclick="SPG.go('hr/${item.route}')">
      <div class="hr-quick-icon">${item.icon}</div>
      <div class="hr-quick-label">${esc(item.label)}</div>
      <div class="hr-quick-desc">${esc(item.desc)}</div>
    </div>`;
  });
  html += '</div>';

  // Recent activity
  if (d.recent_activity && d.recent_activity.length) {
    html += '<div class="sec-title" style="margin-top:20px">Recent Activity</div>';
    html += '<div class="card">';
    d.recent_activity.slice(0, 10).forEach(a => {
      html += `<div class="hr-activity-row">
        <div class="hr-activity-time">${esc(sydneyDateTime(a.created_at))}</div>
        <div class="hr-activity-text">${esc(a.description || a.action)}</div>
      </div>`;
    });
    html += '</div>';
  }

  sections.innerHTML = html;
}


// ════════════════════════════════════════════════════════════
// 2. EMPLOYEES — List
// ════════════════════════════════════════════════════════════
function renderEmployees() {
  const actions = isAdmin()
    ? `<button class="btn btn-primary btn-sm" onclick="SPG.go('hr/add-employee')">+ Add Employee</button>`
    : '';

  return SPG.shell(`
    ${SPG.toolbar('Employees', actions)}
    <div class="content">
      <div id="hr-emp-filters"></div>
      <div id="hr-emp-list">${ui.skeleton(60, 6)}</div>
    </div>`, 'HR');
}

async function loadEmployees() {
  await loadHRBundle();
  renderEmpFilters();
  await fetchEmployees();
}

function renderEmpFilters() {
  const el = document.getElementById('hr-emp-filters');
  if (!el) return;
  el.innerHTML = ui.filterBar([
    { id: 'hr-emp-search', label: 'Search', type: 'text', placeholder: 'Name, ID...', value: _hr.empSearch, onChange: "HRSection.onEmpFilter()" },
    { id: 'hr-emp-store', label: 'Store', type: 'select', options: parseStoreOptions(), value: _hr.empStore, onChange: "HRSection.onEmpFilter()" },
    { id: 'hr-emp-status', label: 'Status', type: 'select', options: [
      { value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' },
      { value: 'probation', label: 'Probation' }, { value: 'terminated', label: 'Terminated' },
    ], value: _hr.empStatus, onChange: "HRSection.onEmpFilter()" },
  ]);
}

function parseStoreOptions() {
  const stores = _hr.bundle?.stores || [];
  return [{ value: '', label: 'All Stores' }].concat(
    stores.map(s => ({ value: s.store_id, label: s.store_name_th || s.store_name || s.store_id }))
  );
}

async function fetchEmployees() {
  try {
    SPG.showLoader();
    const data = await hrPost('hr_get_employees', {
      search: _hr.empSearch,
      store_id: _hr.empStore,
      status: _hr.empStatus,
    });
    _hr.employees = data.employees || data || [];
    renderEmpList();
  } catch (e) {
    document.getElementById('hr-emp-list').innerHTML = ui.empty('👥', 'Failed to load employees', e.message);
  } finally {
    SPG.hideLoader();
  }
}

function onEmpFilter() {
  _hr.empSearch = document.getElementById('hr-emp-search')?.value || '';
  _hr.empStore = document.getElementById('hr-emp-store')?.value || '';
  _hr.empStatus = document.getElementById('hr-emp-status')?.value || '';
  fetchEmployees();
}

function renderEmpList() {
  const el = document.getElementById('hr-emp-list');
  if (!el) return;
  const emps = _hr.employees;
  if (!emps.length) { el.innerHTML = ui.empty('👥', 'No employees found'); return; }

  // Sort support
  const sort = ui.getSortState('hr-emp');
  const sorted = sort ? ui.sortData(emps, sort.key, sort.dir) : emps;

  let html = `<div class="tbl-wrap"><table class="tbl">
    <thead><tr>
      ${ui.sortTh('hr-emp', 'display_name', 'Name')}
      ${ui.sortTh('hr-emp', 'position_name', 'Position')}
      ${ui.sortTh('hr-emp', 'store_id', 'Store')}
      <th>Phone</th>
      ${ui.sortTh('hr-emp', 'status', 'Status')}
    </tr></thead><tbody>`;

  sorted.forEach(emp => {
    html += `<tr class="clickable" onclick="SPG.go('hr/employee-detail',{id:'${esc(emp.employee_id || emp.user_id)}'})">
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          ${employeeAvatar(emp)}
          <div><div style="font-weight:600">${esc(emp.display_name || emp.full_name)}</div>
          <div style="font-size:10px;color:var(--t3)">${esc(emp.employee_id || '')}</div></div>
        </div>
      </td>
      <td>${esc(emp.position_name || emp.position_id || '-')}</td>
      <td>${esc(emp.store_id || '-')}</td>
      <td>${esc(emp.phone || '-')}</td>
      <td>${ui.badge(emp.status || 'active')}</td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  html += `<div style="font-size:11px;color:var(--t3);margin-top:8px">${sorted.length} employee(s)</div>`;
  el.innerHTML = html;
}

// Listen for sort events
document.addEventListener('spg-sort', (e) => {
  if (e.detail.tableId === 'hr-emp') renderEmpList();
  if (e.detail.tableId === 'hr-scan') renderScanTable();
  if (e.detail.tableId === 'hr-payrun') renderPayRunList();
});


// ════════════════════════════════════════════════════════════
// 3. EMPLOYEE DETAIL
// ════════════════════════════════════════════════════════════
function renderEmployeeDetail(p) {
  return SPG.shell(`
    ${SPG.toolbar('Employee Detail', backBtn('employees', 'Employees'))}
    <div class="content">
      <div id="hr-emp-detail">${ui.skeleton(300)}</div>
    </div>`, 'HR');
}

async function loadEmployeeDetail(p) {
  const empId = p?.id;
  if (!empId) { SPG.go('hr/employees'); return; }
  try {
    SPG.showLoader();
    const data = await hrPost('hr_get_employee_detail', { employee_id: empId });
    _hr.employeeDetail = data;
    renderEmpDetail(data);
  } catch (e) {
    document.getElementById('hr-emp-detail').innerHTML = ui.empty('👥', 'Failed to load', e.message);
  } finally {
    SPG.hideLoader();
  }
}

function renderEmpDetail(d) {
  const el = document.getElementById('hr-emp-detail');
  if (!el) return;
  const emp = d.employee || d;
  const canEdit = isAdmin();

  let html = `<div class="card max-w-md">
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
      ${employeeAvatar(emp)}
      <div>
        <div style="font-size:16px;font-weight:700">${esc(emp.display_name || emp.full_name)}</div>
        <div style="font-size:12px;color:var(--t3)">${esc(emp.employee_id || '')} &middot; ${esc(emp.position_name || emp.position_id || '')}</div>
      </div>
      <div style="margin-left:auto">${ui.badge(emp.status || 'active')}</div>
    </div>
    <div class="hr-detail-grid">
      <div class="hr-detail-item"><div class="lb">Full Name</div><div>${esc(emp.full_name || '-')}</div></div>
      <div class="hr-detail-item"><div class="lb">Display Name</div><div>${esc(emp.display_name || '-')}</div></div>
      <div class="hr-detail-item"><div class="lb">Phone</div><div>${esc(emp.phone || '-')}</div></div>
      <div class="hr-detail-item"><div class="lb">Email</div><div>${esc(emp.email || '-')}</div></div>
      <div class="hr-detail-item"><div class="lb">Store</div><div>${esc(emp.store_id || '-')}</div></div>
      <div class="hr-detail-item"><div class="lb">Department</div><div>${esc(emp.dept_id || '-')}</div></div>
      <div class="hr-detail-item"><div class="lb">Position</div><div>${esc(emp.position_name || emp.position_id || '-')}</div></div>
      <div class="hr-detail-item"><div class="lb">Start Date</div><div>${esc(emp.start_date ? sydneyDate(emp.start_date) : '-')}</div></div>
      <div class="hr-detail-item"><div class="lb">Employment Type</div><div>${esc(emp.employment_type || '-')}</div></div>
      <div class="hr-detail-item"><div class="lb">Hourly Rate</div><div>${emp.hourly_rate != null ? formatMoney(emp.hourly_rate) + '/hr' : '-'}</div></div>
      <div class="hr-detail-item"><div class="lb">Bank Account</div><div>${esc(emp.bank_account || '-')}</div></div>
      <div class="hr-detail-item"><div class="lb">Tax File No.</div><div>${esc(emp.tax_file_number || '-')}</div></div>
    </div>`;

  if (canEdit) {
    html += `<div style="margin-top:14px;display:flex;gap:8px">
      <button class="btn btn-primary btn-sm" onclick="HRSection.showEditEmployee()">Edit Details</button>
      ${emp.status === 'active' ? `<button class="btn btn-outline btn-sm" style="color:var(--red)" onclick="HRSection.deactivateEmployee('${esc(emp.employee_id || emp.user_id)}')">Deactivate</button>` : ''}
    </div>`;
  }
  html += '</div>';

  // Attendance summary
  if (d.attendance_summary) {
    const att = d.attendance_summary;
    html += `<div class="sec-title" style="margin-top:20px">Attendance Summary (This Month)</div>
    <div class="hr-kpi-grid">
      ${kpiCard('Days Worked', att.days_worked || 0)}
      ${kpiCard('Total Hours', formatHours(att.total_hours || 0))}
      ${kpiCard('Late', att.late_count || 0, '', 'var(--orange)')}
      ${kpiCard('Absent', att.absent_count || 0, '', 'var(--red)')}
    </div>`;
  }

  // Recent attendance
  if (d.recent_attendance && d.recent_attendance.length) {
    html += '<div class="sec-title" style="margin-top:20px">Recent Attendance</div>';
    html += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th></tr></thead><tbody>';
    d.recent_attendance.forEach(a => {
      html += `<tr>
        <td>${esc(sydneyDate(a.date))}</td>
        <td>${esc(a.time_in ? sydneyDateTime(a.time_in).split(', ')[1] || a.time_in : '-')}</td>
        <td>${esc(a.time_out ? sydneyDateTime(a.time_out).split(', ')[1] || a.time_out : '-')}</td>
        <td>${formatHours(a.total_hours || calcHours(a.time_in, a.time_out))}</td>
        <td>${scanStatusBadge(a.status || scanStatus(a.scheduled_start, a.time_in))}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  }

  // Pay history
  if (d.pay_history && d.pay_history.length) {
    html += '<div class="sec-title" style="margin-top:20px">Pay History</div>';
    html += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Period</th><th>Hours</th><th>Gross</th><th>Deductions</th><th>Net</th></tr></thead><tbody>';
    d.pay_history.forEach(p => {
      html += `<tr>
        <td>${esc(p.period_label || (sydneyDate(p.period_start) + ' - ' + sydneyDate(p.period_end)))}</td>
        <td>${formatHours(p.total_hours)}</td>
        <td>${formatMoney(p.gross_pay)}</td>
        <td>${formatMoney(p.deductions)}</td>
        <td style="font-weight:600">${formatMoney(p.net_pay)}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  }

  el.innerHTML = html;
}

function showEditEmployee() {
  const emp = _hr.employeeDetail?.employee || _hr.employeeDetail;
  if (!emp) return;
  const stores = _hr.bundle?.stores || [];
  const positions = _hr.bundle?.positions || [];

  const storeOpts = stores.map(s =>
    `<option value="${esc(s.store_id)}"${s.store_id === emp.store_id ? ' selected' : ''}>${esc(s.store_name_th || s.store_name || s.store_id)}</option>`
  ).join('');

  const posOpts = positions.map(p =>
    `<option value="${esc(p.position_id)}"${p.position_id === emp.position_id ? ' selected' : ''}>${esc(p.position_name || p.position_id)}</option>`
  ).join('');

  SPG.showDialog(`<div class="popup-sheet" style="width:420px;max-height:85vh;overflow-y:auto">
    <div class="popup-header"><div class="popup-title">Edit Employee</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Display Name *</label><input class="inp" id="hr-edit-display" value="${esc(emp.display_name || '')}"></div>
    <div class="fg"><label class="lb">Full Name *</label><input class="inp" id="hr-edit-full" value="${esc(emp.full_name || '')}"></div>
    <div class="fg"><label class="lb">Phone</label><input class="inp" id="hr-edit-phone" value="${esc(emp.phone || '')}"></div>
    <div class="fg"><label class="lb">Email</label><input class="inp" id="hr-edit-email" value="${esc(emp.email || '')}"></div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Store</label><select class="inp" id="hr-edit-store">${storeOpts}</select></div>
      <div class="fg" style="flex:1"><label class="lb">Position</label><select class="inp" id="hr-edit-position">${posOpts}</select></div>
    </div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Employment Type</label>
        <select class="inp" id="hr-edit-emptype">
          <option value="full-time"${emp.employment_type === 'full-time' ? ' selected' : ''}>Full-time</option>
          <option value="part-time"${emp.employment_type === 'part-time' ? ' selected' : ''}>Part-time</option>
          <option value="casual"${emp.employment_type === 'casual' ? ' selected' : ''}>Casual</option>
        </select>
      </div>
      <div class="fg" style="flex:1"><label class="lb">Hourly Rate ($)</label><input class="inp" id="hr-edit-rate" type="number" step="0.01" value="${emp.hourly_rate || ''}"></div>
    </div>
    <div class="fg"><label class="lb">Bank Account</label><input class="inp" id="hr-edit-bank" value="${esc(emp.bank_account || '')}"></div>
    <div class="fg"><label class="lb">Tax File Number</label><input class="inp" id="hr-edit-tfn" value="${esc(emp.tax_file_number || '')}"></div>
    <div class="fg"><label class="lb">Status</label>
      <select class="inp" id="hr-edit-status">
        <option value="active"${emp.status === 'active' ? ' selected' : ''}>Active</option>
        <option value="probation"${emp.status === 'probation' ? ' selected' : ''}>Probation</option>
        <option value="inactive"${emp.status === 'inactive' ? ' selected' : ''}>Inactive</option>
        <option value="terminated"${emp.status === 'terminated' ? ' selected' : ''}>Terminated</option>
      </select>
    </div>
    <div class="error-msg" id="hr-edit-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" id="hr-edit-save" onclick="HRSection.doUpdateEmployee()">Save</button>
    </div>
  </div>`);
}

async function doUpdateEmployee() {
  const emp = _hr.employeeDetail?.employee || _hr.employeeDetail;
  if (!emp) return;
  const display_name = document.getElementById('hr-edit-display')?.value.trim();
  const full_name = document.getElementById('hr-edit-full')?.value.trim();
  if (!display_name || !full_name) { SPG.showError('hr-edit-error', 'Name fields are required'); return; }

  const btn = document.getElementById('hr-edit-save');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    await hrPost('hr_update_employee', {
      employee_id: emp.employee_id || emp.user_id,
      display_name,
      full_name,
      phone: document.getElementById('hr-edit-phone')?.value.trim() || '',
      email: document.getElementById('hr-edit-email')?.value.trim() || '',
      store_id: document.getElementById('hr-edit-store')?.value || '',
      position_id: document.getElementById('hr-edit-position')?.value || '',
      employment_type: document.getElementById('hr-edit-emptype')?.value || '',
      hourly_rate: parseFloat(document.getElementById('hr-edit-rate')?.value) || null,
      bank_account: document.getElementById('hr-edit-bank')?.value.trim() || '',
      tax_file_number: document.getElementById('hr-edit-tfn')?.value.trim() || '',
      status: document.getElementById('hr-edit-status')?.value || 'active',
    });
    SPG.closeDialog();
    SPG.toast('Employee updated', 'success');
    loadEmployeeDetail({ id: emp.employee_id || emp.user_id });
  } catch (e) {
    SPG.showError('hr-edit-error', e.message);
    btn.disabled = false; btn.textContent = 'Save';
  }
}

async function deactivateEmployee(empId) {
  if (!confirm('Are you sure you want to deactivate this employee?')) return;
  try {
    SPG.showLoader();
    await hrPost('hr_update_employee', { employee_id: empId, status: 'inactive' });
    SPG.toast('Employee deactivated', 'success');
    loadEmployeeDetail({ id: empId });
  } catch (e) { SPG.toast(e.message, 'error'); }
  finally { SPG.hideLoader(); }
}


// ════════════════════════════════════════════════════════════
// 4. ADD EMPLOYEE
// ════════════════════════════════════════════════════════════
function renderAddEmployee() {
  return SPG.shell(`
    ${SPG.toolbar('Add Employee', backBtn('employees', 'Employees'))}
    <div class="content">
      <div class="card max-w-md" id="hr-add-form">${ui.skeleton(300)}</div>
    </div>`, 'HR');
}

async function loadAddEmployee() {
  await loadHRBundle();
  const el = document.getElementById('hr-add-form');
  if (!el) return;
  const stores = _hr.bundle?.stores || [];
  const positions = _hr.bundle?.positions || [];
  const depts = _hr.bundle?.departments || [];

  const storeOpts = stores.map(s =>
    `<option value="${esc(s.store_id)}">${esc(s.store_name_th || s.store_name || s.store_id)}</option>`
  ).join('');
  const posOpts = positions.map(p =>
    `<option value="${esc(p.position_id)}">${esc(p.position_name || p.position_id)}</option>`
  ).join('');
  const deptOpts = depts.map(d =>
    `<option value="${esc(d.dept_id)}">${esc(d.dept_name_th || d.dept_name || d.dept_id)}</option>`
  ).join('');

  el.innerHTML = `
    <div class="fg"><label class="lb">Full Name *</label><input class="inp" id="hr-add-full" placeholder="First Last"></div>
    <div class="fg"><label class="lb">Display Name *</label><input class="inp" id="hr-add-display" placeholder="e.g. Mint"></div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Phone</label><input class="inp" id="hr-add-phone" placeholder="0400000000"></div>
      <div class="fg" style="flex:1"><label class="lb">Email</label><input class="inp" id="hr-add-email" placeholder="email@example.com"></div>
    </div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Store *</label><select class="inp" id="hr-add-store"><option value="">-- Select --</option>${storeOpts}</select></div>
      <div class="fg" style="flex:1"><label class="lb">Department</label><select class="inp" id="hr-add-dept"><option value="">-- Select --</option>${deptOpts}</select></div>
    </div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Position *</label><select class="inp" id="hr-add-position"><option value="">-- Select --</option>${posOpts}</select></div>
      <div class="fg" style="flex:1"><label class="lb">Employment Type</label>
        <select class="inp" id="hr-add-emptype">
          <option value="full-time">Full-time</option>
          <option value="part-time">Part-time</option>
          <option value="casual">Casual</option>
        </select>
      </div>
    </div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Hourly Rate ($)</label><input class="inp" id="hr-add-rate" type="number" step="0.01" placeholder="25.00"></div>
      <div class="fg" style="flex:1"><label class="lb">Start Date</label><input class="inp" id="hr-add-start" type="date" value="${toDateInput()}"></div>
    </div>
    <div class="fg"><label class="lb">Bank Account</label><input class="inp" id="hr-add-bank" placeholder="BSB-Account"></div>
    <div class="fg"><label class="lb">Tax File Number</label><input class="inp" id="hr-add-tfn" placeholder="123456789"></div>
    <div class="error-msg" id="hr-add-error"></div>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="btn btn-outline" onclick="SPG.go('hr/employees')">Cancel</button>
      <button class="btn btn-primary" id="hr-add-save" onclick="HRSection.doCreateEmployee()">Create Employee</button>
    </div>`;
}

async function doCreateEmployee() {
  const full_name = document.getElementById('hr-add-full')?.value.trim();
  const display_name = document.getElementById('hr-add-display')?.value.trim();
  const store_id = document.getElementById('hr-add-store')?.value;
  const position_id = document.getElementById('hr-add-position')?.value;
  if (!full_name || !display_name) { SPG.showError('hr-add-error', 'Name fields are required'); return; }
  if (!store_id) { SPG.showError('hr-add-error', 'Please select a store'); return; }
  if (!position_id) { SPG.showError('hr-add-error', 'Please select a position'); return; }

  const btn = document.getElementById('hr-add-save');
  btn.disabled = true; btn.textContent = 'Creating...';

  try {
    const data = await hrPost('hr_create_employee', {
      full_name,
      display_name,
      phone: document.getElementById('hr-add-phone')?.value.trim() || '',
      email: document.getElementById('hr-add-email')?.value.trim() || '',
      store_id,
      dept_id: document.getElementById('hr-add-dept')?.value || '',
      position_id,
      employment_type: document.getElementById('hr-add-emptype')?.value || 'full-time',
      hourly_rate: parseFloat(document.getElementById('hr-add-rate')?.value) || null,
      start_date: document.getElementById('hr-add-start')?.value || '',
      bank_account: document.getElementById('hr-add-bank')?.value.trim() || '',
      tax_file_number: document.getElementById('hr-add-tfn')?.value.trim() || '',
    });
    SPG.toast('Employee created', 'success');
    SPG.go('hr/employee-detail', { id: data.employee_id || data.user_id });
  } catch (e) {
    SPG.showError('hr-add-error', e.message);
    btn.disabled = false; btn.textContent = 'Create Employee';
  }
}


// ════════════════════════════════════════════════════════════
// 5. SCAN LOGS
// ════════════════════════════════════════════════════════════
function renderScanLogs() {
  return SPG.shell(`
    ${SPG.toolbar('Scan Logs')}
    <div class="content">
      <div id="hr-scan-filters"></div>
      <div id="hr-scan-list">${ui.skeleton(40, 8)}</div>
    </div>`, 'HR');
}

async function loadScanLogs() {
  await loadHRBundle();
  if (!_hr.scanDate) _hr.scanDate = toDateInput();
  renderScanFilters();
  await fetchScanLogs();
}

function renderScanFilters() {
  const el = document.getElementById('hr-scan-filters');
  if (!el) return;
  el.innerHTML = ui.filterBar([
    { id: 'hr-scan-date', label: 'Date', type: 'date', value: _hr.scanDate, onChange: "HRSection.onScanFilter()" },
    { id: 'hr-scan-store', label: 'Store', type: 'select', options: parseStoreOptions(), value: _hr.scanStore, onChange: "HRSection.onScanFilter()" },
  ]);
}

async function fetchScanLogs() {
  try {
    SPG.showLoader();
    const data = await hrPost('hr_get_scan_logs', {
      date: _hr.scanDate,
      store_id: _hr.scanStore,
    });
    _hr.scanLogs = data.logs || data || [];
    renderScanTable();
  } catch (e) {
    document.getElementById('hr-scan-list').innerHTML = ui.empty('📋', 'Failed to load scan logs', e.message);
  } finally {
    SPG.hideLoader();
  }
}

function onScanFilter() {
  _hr.scanDate = document.getElementById('hr-scan-date')?.value || '';
  _hr.scanStore = document.getElementById('hr-scan-store')?.value || '';
  fetchScanLogs();
}

function renderScanTable() {
  const el = document.getElementById('hr-scan-list');
  if (!el) return;
  const logs = _hr.scanLogs;
  if (!logs.length) { el.innerHTML = ui.empty('📋', 'No scan logs for this date'); return; }

  const sort = ui.getSortState('hr-scan');
  const sorted = sort ? ui.sortData(logs, sort.key, sort.dir) : logs;

  let html = `<div class="tbl-wrap"><table class="tbl">
    <thead><tr>
      ${ui.sortTh('hr-scan', 'employee_name', 'Employee')}
      <th>Store</th>
      ${ui.sortTh('hr-scan', 'time_in', 'Time In')}
      ${ui.sortTh('hr-scan', 'time_out', 'Time Out')}
      <th>Hours</th>
      <th>Status</th>
    </tr></thead><tbody>`;

  sorted.forEach(log => {
    const hours = log.total_hours || calcHours(log.time_in, log.time_out);
    const status = log.status || scanStatus(log.scheduled_start, log.time_in);
    html += `<tr>
      <td style="font-weight:600">${esc(log.employee_name || log.display_name || '-')}</td>
      <td>${esc(log.store_id || '-')}</td>
      <td>${esc(log.time_in ? sydneyDateTime(log.time_in).split(', ')[1] || log.time_in : '-')}</td>
      <td>${esc(log.time_out ? sydneyDateTime(log.time_out).split(', ')[1] || log.time_out : '-')}</td>
      <td>${formatHours(hours)}</td>
      <td>${scanStatusBadge(status)}</td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  html += `<div style="font-size:11px;color:var(--t3);margin-top:8px">${sorted.length} record(s)</div>`;
  el.innerHTML = html;
}


// ════════════════════════════════════════════════════════════
// 6. ROSTER TEMPLATES — List
// ════════════════════════════════════════════════════════════
function renderRosterTemplates() {
  const actions = isAdmin()
    ? `<button class="btn btn-primary btn-sm" onclick="HRSection.showNewTemplate()">+ New Template</button>`
    : '';
  return SPG.shell(`
    ${SPG.toolbar('Roster Templates', actions)}
    <div class="content">
      <div id="hr-tpl-list">${ui.skeleton(80, 4)}</div>
    </div>`, 'HR');
}

async function loadRosterTemplates() {
  try {
    SPG.showLoader();
    const data = await hrPost('hr_get_roster_templates');
    _hr.templates = data.templates || data || [];
    renderTemplateList();
  } catch (e) {
    document.getElementById('hr-tpl-list').innerHTML = ui.empty('📅', 'Failed to load templates', e.message);
  } finally {
    SPG.hideLoader();
  }
}

function renderTemplateList() {
  const el = document.getElementById('hr-tpl-list');
  if (!el) return;
  if (!_hr.templates.length) { el.innerHTML = ui.empty('📅', 'No roster templates', 'Create one to get started'); return; }

  let html = '';
  _hr.templates.forEach(tpl => {
    const shiftCount = tpl.shift_count || (tpl.shifts ? tpl.shifts.length : 0);
    html += `<div class="card" style="margin-bottom:10px;cursor:pointer" onclick="SPG.go('hr/template-edit',{id:'${esc(tpl.template_id)}'})">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-weight:700">${esc(tpl.template_name || tpl.name)}</div>
          <div style="font-size:11px;color:var(--t3)">${esc(tpl.store_id || 'All Stores')} &middot; ${shiftCount} shift(s)</div>
        </div>
        <div>${ui.badge(tpl.status || 'active')}</div>
      </div>
      ${tpl.description ? `<div style="font-size:11px;color:var(--t3);margin-top:6px">${esc(tpl.description)}</div>` : ''}
    </div>`;
  });
  el.innerHTML = html;
}

function showNewTemplate() {
  SPG.showDialog(`<div class="popup-sheet" style="width:380px">
    <div class="popup-header"><div class="popup-title">New Roster Template</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Template Name *</label><input class="inp" id="hr-ntpl-name" placeholder="e.g. Weekday Standard"></div>
    <div class="fg"><label class="lb">Store</label><select class="inp" id="hr-ntpl-store">${storeFilterOptions()}</select></div>
    <div class="fg"><label class="lb">Description</label><textarea class="inp" id="hr-ntpl-desc" rows="2" style="width:100%;box-sizing:border-box" placeholder="Optional description"></textarea></div>
    <div class="error-msg" id="hr-ntpl-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="HRSection.doCreateTemplate()">Create</button>
    </div>
  </div>`);
}

async function doCreateTemplate() {
  const name = document.getElementById('hr-ntpl-name')?.value.trim();
  if (!name) { SPG.showError('hr-ntpl-error', 'Template name is required'); return; }
  try {
    SPG.showLoader();
    const data = await hrPost('hr_save_template', {
      template_name: name,
      store_id: document.getElementById('hr-ntpl-store')?.value || '',
      description: document.getElementById('hr-ntpl-desc')?.value.trim() || '',
      shifts: [],
    });
    SPG.closeDialog();
    SPG.toast('Template created', 'success');
    SPG.go('hr/template-edit', { id: data.template_id });
  } catch (e) {
    SPG.showError('hr-ntpl-error', e.message);
  } finally {
    SPG.hideLoader();
  }
}


// ════════════════════════════════════════════════════════════
// 7. TEMPLATE EDIT — Shift grid (drag-and-drop style)
// ════════════════════════════════════════════════════════════
function renderTemplateEdit(p) {
  return SPG.shell(`
    ${SPG.toolbar('Edit Template', backBtn('roster-templates', 'Templates'))}
    <div class="content">
      <div id="hr-tpl-edit">${ui.skeleton(400)}</div>
    </div>`, 'HR');
}

async function loadTemplateEdit(p) {
  const tplId = p?.id;
  if (!tplId) { SPG.go('hr/roster-templates'); return; }
  await loadHRBundle();
  try {
    SPG.showLoader();
    const data = await hrPost('hr_get_template_detail', { template_id: tplId });
    _hr.templateDetail = data;
    renderTemplateEditor(data);
  } catch (e) {
    document.getElementById('hr-tpl-edit').innerHTML = ui.empty('📅', 'Failed to load template', e.message);
  } finally {
    SPG.hideLoader();
  }
}

function renderTemplateEditor(data) {
  const el = document.getElementById('hr-tpl-edit');
  if (!el) return;
  const tpl = data.template || data;
  const shifts = tpl.shifts || [];

  let html = `<div class="card" style="margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>
        <div style="font-size:16px;font-weight:700">${esc(tpl.template_name || tpl.name)}</div>
        <div style="font-size:11px;color:var(--t3)">${esc(tpl.store_id || 'All Stores')}${tpl.description ? ' &middot; ' + esc(tpl.description) : ''}</div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="HRSection.doSaveTemplate()">Save Template</button>
    </div>
    <div style="margin-bottom:10px">
      <button class="btn btn-outline btn-sm" onclick="HRSection.addShift()">+ Add Shift</button>
    </div>`;

  // Weekly grid: rows = shifts, cols = Mon-Sun
  if (shifts.length === 0) {
    html += ui.empty('📅', 'No shifts defined', 'Add shifts to build your roster template');
  } else {
    html += `<div class="hr-roster-grid-wrap"><table class="tbl hr-roster-grid">
      <thead><tr><th style="min-width:120px">Shift</th><th>Time</th>`;
    DAY_NAMES.forEach(d => { html += `<th style="text-align:center;min-width:36px">${d}</th>`; });
    html += `<th></th></tr></thead><tbody>`;

    shifts.forEach((shift, idx) => {
      const days = shift.days || [];
      html += `<tr data-shift-idx="${idx}">
        <td>
          <input class="inp inp-sm hr-tpl-shift-name" data-idx="${idx}" value="${esc(shift.shift_name || shift.name || '')}" placeholder="e.g. Morning" style="width:110px">
        </td>
        <td style="white-space:nowrap">
          <input class="inp inp-sm hr-tpl-shift-start" data-idx="${idx}" type="time" value="${esc(shift.start_time || '09:00')}" style="width:80px"> -
          <input class="inp inp-sm hr-tpl-shift-end" data-idx="${idx}" type="time" value="${esc(shift.end_time || '17:00')}" style="width:80px">
        </td>`;
      for (let d = 0; d < 7; d++) {
        const checked = days.includes(d) ? ' checked' : '';
        html += `<td style="text-align:center"><input type="checkbox" class="hr-tpl-day" data-idx="${idx}" data-day="${d}"${checked}></td>`;
      }
      html += `<td><button class="btn btn-outline btn-sm" style="color:var(--red);padding:2px 6px" onclick="HRSection.removeShift(${idx})">✕</button></td>`;
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  }

  html += '</div>';

  // Headcount preview
  if (shifts.length > 0) {
    html += '<div class="sec-title">Headcount by Day</div><div class="hr-kpi-grid">';
    for (let d = 0; d < 7; d++) {
      const count = shifts.filter(s => (s.days || []).includes(d)).length;
      html += kpiCard(DAY_NAMES[d], count, 'shift(s)');
    }
    html += '</div>';
  }

  el.innerHTML = html;
}

function addShift() {
  const tpl = _hr.templateDetail?.template || _hr.templateDetail;
  if (!tpl) return;
  if (!tpl.shifts) tpl.shifts = [];
  tpl.shifts.push({ shift_name: '', start_time: '09:00', end_time: '17:00', days: [0, 1, 2, 3, 4] });
  renderTemplateEditor(_hr.templateDetail);
}

function removeShift(idx) {
  const tpl = _hr.templateDetail?.template || _hr.templateDetail;
  if (!tpl || !tpl.shifts) return;
  tpl.shifts.splice(idx, 1);
  renderTemplateEditor(_hr.templateDetail);
}

function collectShiftsFromDOM() {
  const tpl = _hr.templateDetail?.template || _hr.templateDetail;
  if (!tpl || !tpl.shifts) return [];

  return tpl.shifts.map((shift, idx) => {
    const nameEl = document.querySelector(`.hr-tpl-shift-name[data-idx="${idx}"]`);
    const startEl = document.querySelector(`.hr-tpl-shift-start[data-idx="${idx}"]`);
    const endEl = document.querySelector(`.hr-tpl-shift-end[data-idx="${idx}"]`);
    const days = [];
    for (let d = 0; d < 7; d++) {
      const cb = document.querySelector(`.hr-tpl-day[data-idx="${idx}"][data-day="${d}"]`);
      if (cb && cb.checked) days.push(d);
    }
    return {
      shift_name: nameEl?.value.trim() || shift.shift_name || '',
      start_time: startEl?.value || shift.start_time || '09:00',
      end_time: endEl?.value || shift.end_time || '17:00',
      days,
    };
  });
}

async function doSaveTemplate() {
  const tpl = _hr.templateDetail?.template || _hr.templateDetail;
  if (!tpl) return;

  const shifts = collectShiftsFromDOM();
  // Update local state
  if (_hr.templateDetail.template) _hr.templateDetail.template.shifts = shifts;
  else _hr.templateDetail.shifts = shifts;

  try {
    SPG.showLoader();
    await hrPost('hr_save_template', {
      template_id: tpl.template_id,
      template_name: tpl.template_name || tpl.name,
      store_id: tpl.store_id || '',
      description: tpl.description || '',
      shifts,
    });
    SPG.toast('Template saved', 'success');
  } catch (e) {
    SPG.toast(e.message || 'Failed to save template', 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ════════════════════════════════════════════════════════════
// 8. WEEKLY ROSTER
// ════════════════════════════════════════════════════════════
function renderWeeklyRoster() {
  const actions = isManager()
    ? `<button class="btn btn-outline btn-sm" onclick="HRSection.publishRoster()">Publish</button>
       <button class="btn btn-primary btn-sm" onclick="HRSection.doSaveRoster()">Save</button>`
    : '';
  return SPG.shell(`
    ${SPG.toolbar('Weekly Roster', actions)}
    <div class="content">
      <div id="hr-roster-filters"></div>
      <div id="hr-roster-view">${ui.skeleton(400)}</div>
    </div>`, 'HR');
}

async function loadWeeklyRoster() {
  await loadHRBundle();
  if (!_hr.rosterWeek) _hr.rosterWeek = mondayOfWeek();
  renderRosterFilters();
  await fetchWeeklyRoster();
}

function renderRosterFilters() {
  const el = document.getElementById('hr-roster-filters');
  if (!el) return;
  el.innerHTML = `<div class="fl-bar">
    <div>
      <div class="fl-label">Week Starting</div>
      <div style="display:flex;align-items:center;gap:6px">
        <button class="btn btn-outline btn-sm" onclick="HRSection.rosterPrevWeek()">←</button>
        <input class="fl" type="date" id="hr-roster-week" value="${esc(_hr.rosterWeek)}" onchange="HRSection.onRosterWeekChange()">
        <button class="btn btn-outline btn-sm" onclick="HRSection.rosterNextWeek()">→</button>
      </div>
    </div>
    <div>
      <div class="fl-label">Store</div>
      <select class="fl" id="hr-roster-store" onchange="HRSection.fetchWeeklyRoster()">${storeFilterOptions()}</select>
    </div>
  </div>`;
}

function rosterPrevWeek() {
  const d = new Date(_hr.rosterWeek);
  d.setDate(d.getDate() - 7);
  _hr.rosterWeek = toDateInput(d);
  const el = document.getElementById('hr-roster-week');
  if (el) el.value = _hr.rosterWeek;
  fetchWeeklyRoster();
}

function rosterNextWeek() {
  const d = new Date(_hr.rosterWeek);
  d.setDate(d.getDate() + 7);
  _hr.rosterWeek = toDateInput(d);
  const el = document.getElementById('hr-roster-week');
  if (el) el.value = _hr.rosterWeek;
  fetchWeeklyRoster();
}

function onRosterWeekChange() {
  const val = document.getElementById('hr-roster-week')?.value;
  if (val) {
    _hr.rosterWeek = mondayOfWeek(val);
    document.getElementById('hr-roster-week').value = _hr.rosterWeek;
    fetchWeeklyRoster();
  }
}

async function fetchWeeklyRoster() {
  const storeId = document.getElementById('hr-roster-store')?.value || '';
  try {
    SPG.showLoader();
    const data = await hrPost('hr_get_weekly_roster', {
      week_start: _hr.rosterWeek,
      store_id: storeId,
    });
    _hr.weeklyRoster = data;
    renderRosterGrid(data);
  } catch (e) {
    document.getElementById('hr-roster-view').innerHTML = ui.empty('🗓', 'Failed to load roster', e.message);
  } finally {
    SPG.hideLoader();
  }
}

function renderRosterGrid(data) {
  const el = document.getElementById('hr-roster-view');
  if (!el) return;

  const roster = data.roster || data;
  const employees = roster.employees || [];
  const dates = weekDates(_hr.rosterWeek);
  const assignments = roster.assignments || {};
  const published = roster.is_published;

  if (!employees.length) {
    el.innerHTML = ui.empty('🗓', 'No roster data for this week', 'Assign employees to shifts or apply a template');
    if (isManager()) {
      el.innerHTML += `<div style="text-align:center;margin-top:12px">
        <button class="btn btn-outline btn-sm" onclick="HRSection.showApplyTemplate()">Apply Template</button>
      </div>`;
    }
    return;
  }

  let html = '';
  if (published) {
    html += `<div style="padding:8px 12px;background:var(--green-bg);border-radius:var(--rd);font-size:11px;color:var(--green);margin-bottom:12px">Published roster — visible to all staff</div>`;
  } else if (isManager()) {
    html += `<div style="padding:8px 12px;background:var(--orange-bg);border-radius:var(--rd);font-size:11px;color:var(--orange);margin-bottom:12px">Draft — not yet published</div>`;
  }

  html += `<div class="hr-roster-grid-wrap"><table class="tbl hr-roster-grid">
    <thead><tr><th style="min-width:130px;position:sticky;left:0;background:var(--bg2);z-index:1">Employee</th>`;
  dates.forEach((dt, i) => {
    const d = new Date(dt);
    const dayLabel = DAY_NAMES[i];
    const dateLabel = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    html += `<th style="text-align:center;min-width:80px"><div>${dayLabel}</div><div style="font-size:9px;font-weight:400;color:var(--t3)">${dateLabel}</div></th>`;
  });
  html += '<th style="text-align:right">Total</th></tr></thead><tbody>';

  employees.forEach(emp => {
    const empId = emp.employee_id || emp.user_id;
    html += `<tr>
      <td style="position:sticky;left:0;background:var(--bg1);z-index:1">
        <div style="display:flex;align-items:center;gap:6px">
          ${employeeAvatar(emp)}
          <div style="font-size:11px;font-weight:600">${esc(emp.display_name || emp.full_name)}</div>
        </div>
      </td>`;

    let totalHours = 0;
    dates.forEach(dt => {
      const key = empId + '_' + dt;
      const assignment = assignments[key] || (roster.grid && roster.grid[empId] && roster.grid[empId][dt]);
      if (assignment) {
        const hrs = assignment.hours || calcHours(assignment.start_time, assignment.end_time) || 0;
        totalHours += hrs;
        const shiftLabel = assignment.shift_name || (assignment.start_time ? assignment.start_time + '-' + assignment.end_time : '');
        html += `<td style="text-align:center" class="hr-roster-cell filled" onclick="HRSection.editRosterCell('${esc(empId)}','${esc(dt)}')">
          <div class="hr-roster-shift">${esc(shiftLabel)}</div>
          <div class="hr-roster-hours">${formatHours(hrs)}</div>
        </td>`;
      } else {
        html += `<td style="text-align:center" class="hr-roster-cell" onclick="HRSection.editRosterCell('${esc(empId)}','${esc(dt)}')">
          <div class="hr-roster-empty">${isManager() ? '+' : '-'}</div>
        </td>`;
      }
    });
    html += `<td style="text-align:right;font-weight:600">${formatHours(totalHours)}</td></tr>`;
  });

  html += '</tbody></table></div>';

  if (isManager()) {
    html += `<div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-outline btn-sm" onclick="HRSection.showApplyTemplate()">Apply Template</button>
      <button class="btn btn-outline btn-sm" onclick="HRSection.showAddEmpToRoster()">+ Add Employee</button>
    </div>`;
  }

  el.innerHTML = html;
}

function editRosterCell(empId, date) {
  if (!isManager()) return;
  const roster = _hr.weeklyRoster?.roster || _hr.weeklyRoster || {};
  const assignments = roster.assignments || {};
  const key = empId + '_' + date;
  const existing = assignments[key] || (roster.grid && roster.grid[empId] && roster.grid[empId][date]);

  SPG.showDialog(`<div class="popup-sheet" style="width:320px">
    <div class="popup-header"><div class="popup-title">Assign Shift</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div style="font-size:11px;color:var(--t3);margin-bottom:10px">${esc(date)}</div>
    <div class="fg"><label class="lb">Shift Name</label><input class="inp" id="hr-rc-shift" value="${esc(existing?.shift_name || '')}" placeholder="e.g. Morning"></div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Start</label><input class="inp" id="hr-rc-start" type="time" value="${esc(existing?.start_time || '09:00')}"></div>
      <div class="fg" style="flex:1"><label class="lb">End</label><input class="inp" id="hr-rc-end" type="time" value="${esc(existing?.end_time || '17:00')}"></div>
    </div>
    <div class="popup-actions">
      ${existing ? `<button class="btn btn-outline" style="color:var(--red)" onclick="HRSection.removeRosterCell('${esc(empId)}','${esc(date)}')">Remove</button>` : ''}
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="HRSection.saveRosterCell('${esc(empId)}','${esc(date)}')">Save</button>
    </div>
  </div>`);
}

function saveRosterCell(empId, date) {
  const roster = _hr.weeklyRoster?.roster || _hr.weeklyRoster;
  if (!roster) return;
  if (!roster.assignments) roster.assignments = {};
  const key = empId + '_' + date;
  roster.assignments[key] = {
    shift_name: document.getElementById('hr-rc-shift')?.value.trim() || '',
    start_time: document.getElementById('hr-rc-start')?.value || '09:00',
    end_time: document.getElementById('hr-rc-end')?.value || '17:00',
  };
  SPG.closeDialog();
  renderRosterGrid(_hr.weeklyRoster);
}

function removeRosterCell(empId, date) {
  const roster = _hr.weeklyRoster?.roster || _hr.weeklyRoster;
  if (!roster || !roster.assignments) return;
  delete roster.assignments[empId + '_' + date];
  if (roster.grid && roster.grid[empId]) delete roster.grid[empId][date];
  SPG.closeDialog();
  renderRosterGrid(_hr.weeklyRoster);
}

async function doSaveRoster() {
  const roster = _hr.weeklyRoster?.roster || _hr.weeklyRoster;
  if (!roster) return;
  try {
    SPG.showLoader();
    await hrPost('hr_save_roster', {
      week_start: _hr.rosterWeek,
      store_id: document.getElementById('hr-roster-store')?.value || '',
      assignments: roster.assignments || {},
    });
    SPG.toast('Roster saved', 'success');
  } catch (e) { SPG.toast(e.message, 'error'); }
  finally { SPG.hideLoader(); }
}

async function publishRoster() {
  if (!confirm('Publish this roster? Staff will be able to see it.')) return;
  try {
    SPG.showLoader();
    await hrPost('hr_publish_roster', {
      week_start: _hr.rosterWeek,
      store_id: document.getElementById('hr-roster-store')?.value || '',
    });
    SPG.toast('Roster published', 'success');
    fetchWeeklyRoster();
  } catch (e) { SPG.toast(e.message, 'error'); }
  finally { SPG.hideLoader(); }
}

function showApplyTemplate() {
  const templates = _hr.templates || [];
  if (!templates.length) {
    SPG.toast('No templates available. Create one first.', 'info');
    return;
  }
  const opts = templates.map(t => `<option value="${esc(t.template_id)}">${esc(t.template_name || t.name)}</option>`).join('');
  SPG.showDialog(`<div class="popup-sheet" style="width:340px">
    <div class="popup-header"><div class="popup-title">Apply Template</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Template</label><select class="inp" id="hr-apply-tpl">${opts}</select></div>
    <div class="inp-hint">This will overwrite current assignments for the week.</div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="HRSection.doApplyTemplate()">Apply</button>
    </div>
  </div>`);
}

async function doApplyTemplate() {
  const tplId = document.getElementById('hr-apply-tpl')?.value;
  if (!tplId) return;
  SPG.closeDialog();
  SPG.toast('Template applied. Save to persist.', 'info');
  // Re-fetch to show the applied template
  fetchWeeklyRoster();
}

function showAddEmpToRoster() {
  SPG.showDialog(`<div class="popup-sheet" style="width:340px">
    <div class="popup-header"><div class="popup-title">Add Employee to Roster</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Search Employee</label><input class="inp" id="hr-add-roster-search" placeholder="Name..." oninput="HRSection.searchEmpForRoster()"></div>
    <div id="hr-add-roster-results" style="max-height:200px;overflow-y:auto"></div>
    <div class="popup-actions"><button class="btn btn-outline" onclick="SPG.closeDialog()">Close</button></div>
  </div>`);
}

function searchEmpForRoster() {
  const q = (document.getElementById('hr-add-roster-search')?.value || '').toLowerCase();
  const el = document.getElementById('hr-add-roster-results');
  if (!el) return;
  const emps = _hr.employees || [];
  const filtered = emps.filter(e => (e.display_name || e.full_name || '').toLowerCase().includes(q)).slice(0, 10);
  el.innerHTML = filtered.map(e =>
    `<div class="hr-emp-card" style="cursor:pointer" onclick="SPG.closeDialog();SPG.toast('Employee added to roster','success')">
      ${employeeAvatar(e)}
      <div class="hr-emp-info"><div class="hr-emp-name">${esc(e.display_name || e.full_name)}</div></div>
    </div>`
  ).join('') || '<div style="font-size:11px;color:var(--t3);padding:8px">No matches</div>';
}


// ════════════════════════════════════════════════════════════
// 9. ATTENDANCE REVIEW
// ════════════════════════════════════════════════════════════
function renderAttendanceReview() {
  return SPG.shell(`
    ${SPG.toolbar('Attendance Review')}
    <div class="content">
      <div id="hr-att-filters"></div>
      <div id="hr-att-list">${ui.skeleton(60, 6)}</div>
    </div>`, 'HR');
}

async function loadAttendanceReview() {
  await loadHRBundle();
  if (!_hr.reviewPeriod) _hr.reviewPeriod = toDateInput();
  renderAttReviewFilters();
  await fetchAttendanceReview();
}

function renderAttReviewFilters() {
  const el = document.getElementById('hr-att-filters');
  if (!el) return;
  el.innerHTML = ui.filterBar([
    { id: 'hr-att-period', label: 'Period (From)', type: 'date', value: _hr.reviewPeriod, onChange: "HRSection.onAttReviewFilter()" },
    { id: 'hr-att-store', label: 'Store', type: 'select', options: parseStoreOptions(), value: _hr.reviewStore, onChange: "HRSection.onAttReviewFilter()" },
  ]);
}

function onAttReviewFilter() {
  _hr.reviewPeriod = document.getElementById('hr-att-period')?.value || '';
  _hr.reviewStore = document.getElementById('hr-att-store')?.value || '';
  fetchAttendanceReview();
}

async function fetchAttendanceReview() {
  try {
    SPG.showLoader();
    const data = await hrPost('hr_get_attendance_review', {
      period_start: _hr.reviewPeriod,
      store_id: _hr.reviewStore,
    });
    _hr.attendanceReview = data;
    renderAttReviewList(data);
  } catch (e) {
    document.getElementById('hr-att-list').innerHTML = ui.empty('✅', 'Failed to load', e.message);
  } finally {
    SPG.hideLoader();
  }
}

function renderAttReviewList(data) {
  const el = document.getElementById('hr-att-list');
  if (!el) return;

  const records = data.records || data.employees || [];
  if (!records.length) { el.innerHTML = ui.empty('✅', 'No attendance records for this period'); return; }

  // Summary KPIs
  let totalHours = 0, totalLate = 0, totalAbsent = 0, pendingCount = 0;
  records.forEach(r => {
    totalHours += r.total_hours || 0;
    totalLate += r.late_count || 0;
    totalAbsent += r.absent_count || 0;
    if (r.review_status === 'pending') pendingCount++;
  });

  let html = `<div class="hr-kpi-grid" style="margin-bottom:16px">
    ${kpiCard('Employees', records.length)}
    ${kpiCard('Total Hours', formatHours(totalHours))}
    ${kpiCard('Pending', pendingCount, '', 'var(--orange)')}
    ${kpiCard('Late / Absent', totalLate + ' / ' + totalAbsent)}
  </div>`;

  html += `<div class="tbl-wrap"><table class="tbl">
    <thead><tr>
      <th>Employee</th>
      <th>Store</th>
      <th>Days</th>
      <th>Hours</th>
      <th>Late</th>
      <th>Status</th>
      <th>Actions</th>
    </tr></thead><tbody>`;

  records.forEach(r => {
    const empId = r.employee_id || r.user_id;
    const reviewBadge = ui.badge(r.review_status || 'pending');
    html += `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:6px;cursor:pointer" onclick="SPG.go('hr/attendance-detail',{id:'${esc(empId)}'})">
          <div style="font-weight:600">${esc(r.display_name || r.full_name)}</div>
        </div>
      </td>
      <td>${esc(r.store_id || '-')}</td>
      <td>${r.days_worked || 0}</td>
      <td>${formatHours(r.total_hours)}</td>
      <td>${r.late_count || 0}</td>
      <td>${reviewBadge}</td>
      <td>
        ${r.review_status === 'pending' ? `
          <button class="btn btn-primary btn-sm" style="font-size:10px;padding:2px 8px" onclick="HRSection.approveAttendance('${esc(empId)}')">Approve</button>
          <button class="btn btn-outline btn-sm" style="font-size:10px;padding:2px 8px;color:var(--red)" onclick="HRSection.rejectAttendance('${esc(empId)}')">Reject</button>
        ` : `<span style="font-size:10px;color:var(--t3)">${esc(r.reviewed_by || '-')}</span>`}
      </td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}

async function approveAttendance(empId) {
  try {
    SPG.showLoader();
    await hrPost('hr_approve_attendance', {
      employee_id: empId,
      period_start: _hr.reviewPeriod,
    });
    SPG.toast('Attendance approved', 'success');
    fetchAttendanceReview();
  } catch (e) { SPG.toast(e.message, 'error'); }
  finally { SPG.hideLoader(); }
}

async function rejectAttendance(empId) {
  SPG.showDialog(`<div class="popup-sheet" style="width:340px">
    <div class="popup-header"><div class="popup-title">Reject Attendance</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="lb">Reason *</label><textarea class="inp" id="hr-reject-note" rows="3" style="width:100%;box-sizing:border-box" placeholder="Explain why..."></textarea></div>
    <div class="error-msg" id="hr-reject-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" style="background:var(--red)" onclick="HRSection.doRejectAttendance('${esc(empId)}')">Reject</button>
    </div>
  </div>`);
}

async function doRejectAttendance(empId) {
  const note = document.getElementById('hr-reject-note')?.value.trim();
  if (!note) { SPG.showError('hr-reject-error', 'Reason is required'); return; }
  SPG.closeDialog();
  try {
    SPG.showLoader();
    await hrPost('hr_reject_attendance', {
      employee_id: empId,
      period_start: _hr.reviewPeriod,
      note,
    });
    SPG.toast('Attendance rejected', 'success');
    fetchAttendanceReview();
  } catch (e) { SPG.toast(e.message, 'error'); }
  finally { SPG.hideLoader(); }
}


// ════════════════════════════════════════════════════════════
// 10. ATTENDANCE DETAIL
// ════════════════════════════════════════════════════════════
function renderAttendanceDetail(p) {
  return SPG.shell(`
    ${SPG.toolbar('Attendance Detail', backBtn('attendance-review', 'Review'))}
    <div class="content">
      <div id="hr-att-detail">${ui.skeleton(400)}</div>
    </div>`, 'HR');
}

async function loadAttendanceDetail(p) {
  const empId = p?.id;
  if (!empId) { SPG.go('hr/attendance-review'); return; }
  try {
    SPG.showLoader();
    const data = await hrPost('hr_get_attendance_detail', {
      employee_id: empId,
      period_start: _hr.reviewPeriod || toDateInput(),
    });
    _hr.attendanceDetail = data;
    renderAttDetail(data);
  } catch (e) {
    document.getElementById('hr-att-detail').innerHTML = ui.empty('✅', 'Failed to load', e.message);
  } finally {
    SPG.hideLoader();
  }
}

function renderAttDetail(data) {
  const el = document.getElementById('hr-att-detail');
  if (!el) return;
  const emp = data.employee || {};
  const records = data.records || data.attendance || [];
  const summary = data.summary || {};

  let html = `<div class="card" style="margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      ${employeeAvatar(emp)}
      <div>
        <div style="font-size:15px;font-weight:700">${esc(emp.display_name || emp.full_name || '-')}</div>
        <div style="font-size:11px;color:var(--t3)">${esc(emp.position_name || '')} &middot; ${esc(emp.store_id || '')}</div>
      </div>
      <div style="margin-left:auto">${ui.badge(data.review_status || 'pending')}</div>
    </div>
    <div class="hr-kpi-grid">
      ${kpiCard('Days Worked', summary.days_worked || records.filter(r => r.time_in).length)}
      ${kpiCard('Total Hours', formatHours(summary.total_hours || records.reduce((s, r) => s + (r.total_hours || calcHours(r.time_in, r.time_out) || 0), 0)))}
      ${kpiCard('Late', summary.late_count || records.filter(r => (r.status || scanStatus(r.scheduled_start, r.time_in)) === 'late').length, '', 'var(--orange)')}
      ${kpiCard('Absent', summary.absent_count || records.filter(r => (r.status || scanStatus(r.scheduled_start, r.time_in)) === 'absent').length, '', 'var(--red)')}
    </div>
  </div>`;

  // Detail table
  if (records.length) {
    html += `<div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Date</th><th>Scheduled</th><th>Time In</th><th>Time Out</th><th>Hours</th><th>Status</th><th>Notes</th></tr></thead><tbody>`;
    records.forEach(r => {
      const hours = r.total_hours || calcHours(r.time_in, r.time_out);
      const status = r.status || scanStatus(r.scheduled_start, r.time_in);
      html += `<tr>
        <td>${esc(sydneyDate(r.date))}</td>
        <td>${esc(r.scheduled_start ? r.scheduled_start + ' - ' + (r.scheduled_end || '') : '-')}</td>
        <td>${esc(r.time_in ? sydneyDateTime(r.time_in).split(', ')[1] || r.time_in : '-')}</td>
        <td>${esc(r.time_out ? sydneyDateTime(r.time_out).split(', ')[1] || r.time_out : '-')}</td>
        <td>${formatHours(hours)}</td>
        <td>${scanStatusBadge(status)}</td>
        <td style="font-size:10px;color:var(--t3)">${esc(r.note || '')}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
  } else {
    html += ui.empty('📋', 'No attendance records for this period');
  }

  // Review actions
  if (isManager() && (data.review_status === 'pending' || !data.review_status)) {
    html += `<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
      <button class="btn btn-outline" style="color:var(--red)" onclick="HRSection.rejectAttendance('${esc(emp.employee_id || emp.user_id)}')">Reject</button>
      <button class="btn btn-primary" onclick="HRSection.approveAttendance('${esc(emp.employee_id || emp.user_id)}')">Approve</button>
    </div>`;
  }

  el.innerHTML = html;
}


// ════════════════════════════════════════════════════════════
// 11. PAY RUNS — List
// ════════════════════════════════════════════════════════════
function renderPayRuns() {
  const actions = isAdmin()
    ? `<button class="btn btn-primary btn-sm" onclick="HRSection.showCreatePayRun()">+ New Pay Run</button>`
    : '';
  return SPG.shell(`
    ${SPG.toolbar('Pay Runs', actions)}
    <div class="content">
      <div id="hr-payrun-list">${ui.skeleton(60, 5)}</div>
    </div>`, 'HR');
}

async function loadPayRuns() {
  try {
    SPG.showLoader();
    const data = await hrPost('hr_get_pay_runs');
    _hr.payRuns = data.pay_runs || data || [];
    renderPayRunList();
  } catch (e) {
    document.getElementById('hr-payrun-list').innerHTML = ui.empty('💵', 'Failed to load pay runs', e.message);
  } finally {
    SPG.hideLoader();
  }
}

function renderPayRunList() {
  const el = document.getElementById('hr-payrun-list');
  if (!el) return;
  const runs = _hr.payRuns;
  if (!runs.length) { el.innerHTML = ui.empty('💵', 'No pay runs yet', 'Create your first pay run'); return; }

  const sort = ui.getSortState('hr-payrun');
  const sorted = sort ? ui.sortData(runs, sort.key, sort.dir) : runs;

  let html = `<div class="tbl-wrap"><table class="tbl">
    <thead><tr>
      ${ui.sortTh('hr-payrun', 'pay_run_id', 'ID')}
      ${ui.sortTh('hr-payrun', 'period_start', 'Period')}
      <th>Employees</th>
      <th>Total Gross</th>
      <th>Total Net</th>
      ${ui.sortTh('hr-payrun', 'status', 'Status')}
    </tr></thead><tbody>`;

  sorted.forEach(run => {
    html += `<tr class="clickable" onclick="SPG.go('hr/pay-run-detail',{id:'${esc(run.pay_run_id)}'})">
      <td style="font-weight:600">${esc(run.pay_run_id || run.id)}</td>
      <td>${esc(run.period_label || (sydneyDate(run.period_start) + ' - ' + sydneyDate(run.period_end)))}</td>
      <td>${run.employee_count || 0}</td>
      <td>${formatMoney(run.total_gross)}</td>
      <td style="font-weight:600">${formatMoney(run.total_net)}</td>
      <td>${ui.badge(run.status || 'draft')}</td>
    </tr>`;
  });

  html += '</tbody></table></div>';
  el.innerHTML = html;
}

function showCreatePayRun() {
  const today = toDateInput();
  // Default period: previous fortnight
  const endDate = new Date(today);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 13);

  SPG.showDialog(`<div class="popup-sheet" style="width:380px">
    <div class="popup-header"><div class="popup-title">New Pay Run</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div style="display:flex;gap:8px">
      <div class="fg" style="flex:1"><label class="lb">Period Start *</label><input class="inp" id="hr-pr-start" type="date" value="${toDateInput(startDate)}"></div>
      <div class="fg" style="flex:1"><label class="lb">Period End *</label><input class="inp" id="hr-pr-end" type="date" value="${toDateInput(endDate)}"></div>
    </div>
    <div class="fg"><label class="lb">Store</label><select class="inp" id="hr-pr-store">${storeFilterOptions()}</select></div>
    <div class="fg"><label class="lb">Notes</label><textarea class="inp" id="hr-pr-notes" rows="2" style="width:100%;box-sizing:border-box" placeholder="Optional notes"></textarea></div>
    <div class="error-msg" id="hr-pr-error"></div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" id="hr-pr-create" onclick="HRSection.doCreatePayRun()">Create Pay Run</button>
    </div>
  </div>`);
}

async function doCreatePayRun() {
  const period_start = document.getElementById('hr-pr-start')?.value;
  const period_end = document.getElementById('hr-pr-end')?.value;
  if (!period_start || !period_end) { SPG.showError('hr-pr-error', 'Period dates are required'); return; }
  if (period_start > period_end) { SPG.showError('hr-pr-error', 'Start must be before end'); return; }

  const btn = document.getElementById('hr-pr-create');
  btn.disabled = true; btn.textContent = 'Creating...';

  try {
    const data = await hrPost('hr_create_pay_run', {
      period_start,
      period_end,
      store_id: document.getElementById('hr-pr-store')?.value || '',
      notes: document.getElementById('hr-pr-notes')?.value.trim() || '',
    });
    SPG.closeDialog();
    SPG.toast('Pay run created', 'success');
    SPG.go('hr/pay-run-detail', { id: data.pay_run_id || data.id });
  } catch (e) {
    SPG.showError('hr-pr-error', e.message);
    btn.disabled = false; btn.textContent = 'Create Pay Run';
  }
}


// ════════════════════════════════════════════════════════════
// 12. PAY RUN DETAIL
// ════════════════════════════════════════════════════════════
function renderPayRunDetail(p) {
  return SPG.shell(`
    ${SPG.toolbar('Pay Run Detail', backBtn('pay-runs', 'Pay Runs'))}
    <div class="content">
      <div id="hr-pr-detail">${ui.skeleton(400)}</div>
    </div>`, 'HR');
}

async function loadPayRunDetail(p) {
  const prId = p?.id;
  if (!prId) { SPG.go('hr/pay-runs'); return; }
  try {
    SPG.showLoader();
    const data = await hrPost('hr_get_pay_run_detail', { pay_run_id: prId });
    _hr.payRunDetail = data;
    renderPRDetail(data);
  } catch (e) {
    document.getElementById('hr-pr-detail').innerHTML = ui.empty('💵', 'Failed to load', e.message);
  } finally {
    SPG.hideLoader();
  }
}

function renderPRDetail(data) {
  const el = document.getElementById('hr-pr-detail');
  if (!el) return;
  const pr = data.pay_run || data;
  const employees = pr.employees || data.employees || [];

  let html = `<div class="card" style="margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div>
        <div style="font-size:16px;font-weight:700">Pay Run ${esc(pr.pay_run_id || pr.id || '')}</div>
        <div style="font-size:11px;color:var(--t3)">${esc(pr.period_label || (sydneyDate(pr.period_start) + ' - ' + sydneyDate(pr.period_end)))}</div>
        ${pr.store_id ? `<div style="font-size:11px;color:var(--t3)">Store: ${esc(pr.store_id)}</div>` : ''}
      </div>
      <div>${ui.badge(pr.status || 'draft')}</div>
    </div>
    <div class="hr-kpi-grid">
      ${kpiCard('Employees', employees.length)}
      ${kpiCard('Total Hours', formatHours(pr.total_hours || employees.reduce((s, e) => s + (e.total_hours || 0), 0)))}
      ${kpiCard('Total Gross', formatMoney(pr.total_gross || employees.reduce((s, e) => s + (e.gross_pay || 0), 0)))}
      ${kpiCard('Total Net', formatMoney(pr.total_net || employees.reduce((s, e) => s + (e.net_pay || 0), 0)), '', 'var(--acc)')}
    </div>
    ${pr.notes ? `<div style="font-size:11px;color:var(--t3);margin-top:10px">${esc(pr.notes)}</div>` : ''}
  </div>`;

  // Employee breakdowns
  if (employees.length) {
    html += `<div class="sec-title">Employee Breakdowns</div>`;
    html += `<div class="tbl-wrap"><table class="tbl">
      <thead><tr>
        <th>Employee</th>
        <th>Hours</th>
        <th>Rate</th>
        <th>Gross</th>
        <th>Deductions</th>
        <th>Net Pay</th>
      </tr></thead><tbody>`;

    employees.forEach(emp => {
      html += `<tr>
        <td>
          <div style="font-weight:600">${esc(emp.display_name || emp.full_name)}</div>
          <div style="font-size:9px;color:var(--t3)">${esc(emp.employee_id || '')}</div>
        </td>
        <td>${formatHours(emp.total_hours)}</td>
        <td>${emp.hourly_rate != null ? formatMoney(emp.hourly_rate) + '/hr' : '-'}</td>
        <td>${formatMoney(emp.gross_pay)}</td>
        <td>${formatMoney(emp.deductions)}</td>
        <td style="font-weight:700">${formatMoney(emp.net_pay)}</td>
      </tr>`;

      // Show deduction breakdown if available
      if (emp.deduction_details && emp.deduction_details.length) {
        emp.deduction_details.forEach(dd => {
          html += `<tr style="background:var(--bg3)">
            <td colspan="4" style="padding-left:30px;font-size:10px;color:var(--t3)">${esc(dd.description || dd.type)}</td>
            <td style="font-size:10px;color:var(--red)">-${formatMoney(dd.amount)}</td>
            <td></td>
          </tr>`;
        });
      }
    });

    // Totals row
    const totalGross = employees.reduce((s, e) => s + (e.gross_pay || 0), 0);
    const totalDeductions = employees.reduce((s, e) => s + (e.deductions || 0), 0);
    const totalNet = employees.reduce((s, e) => s + (e.net_pay || 0), 0);
    html += `<tr style="font-weight:700;border-top:2px solid var(--bd2)">
      <td>TOTAL</td>
      <td>${formatHours(employees.reduce((s, e) => s + (e.total_hours || 0), 0))}</td>
      <td></td>
      <td>${formatMoney(totalGross)}</td>
      <td>${formatMoney(totalDeductions)}</td>
      <td>${formatMoney(totalNet)}</td>
    </tr>`;

    html += '</tbody></table></div>';
  } else {
    html += ui.empty('💵', 'No employee data in this pay run');
  }

  // Actions
  if (isAdmin() && (pr.status === 'draft' || pr.status === 'pending')) {
    html += `<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end">
      <button class="btn btn-primary" onclick="HRSection.doApprovePayRun('${esc(pr.pay_run_id || pr.id)}')">Approve Pay Run</button>
    </div>`;
  }

  el.innerHTML = html;
}

async function doApprovePayRun(prId) {
  if (!confirm('Approve this pay run? This action cannot be undone.')) return;
  try {
    SPG.showLoader();
    await hrPost('hr_approve_pay_run', { pay_run_id: prId });
    SPG.toast('Pay run approved', 'success');
    loadPayRunDetail({ id: prId });
  } catch (e) { SPG.toast(e.message, 'error'); }
  finally { SPG.hideLoader(); }
}


// ════════════════════════════════════════════════════════════
// 13. REPORTS
// ════════════════════════════════════════════════════════════
function renderReports() {
  return SPG.shell(`
    ${SPG.toolbar('HR Reports')}
    <div class="content">
      <div id="hr-report-filters"></div>
      <div id="hr-report-content">${ui.skeleton(200, 3)}</div>
    </div>`, 'HR');
}

async function loadReports() {
  await loadHRBundle();
  renderReportFilters();
  await fetchReports();
}

function renderReportFilters() {
  const el = document.getElementById('hr-report-filters');
  if (!el) return;
  el.innerHTML = ui.filterBar([
    { id: 'hr-rpt-type', label: 'Report', type: 'select', options: [
      { value: 'headcount', label: 'Headcount by Store' },
      { value: 'hours', label: 'Total Hours by Period' },
      { value: 'costs', label: 'Cost Breakdown' },
    ], value: 'headcount', onChange: "HRSection.fetchReports()" },
    { id: 'hr-rpt-store', label: 'Store', type: 'select', options: parseStoreOptions(), value: '', onChange: "HRSection.fetchReports()" },
  ]);
}

async function fetchReports() {
  const reportType = document.getElementById('hr-rpt-type')?.value || 'headcount';
  const storeId = document.getElementById('hr-rpt-store')?.value || '';
  try {
    SPG.showLoader();
    const data = await hrPost('hr_get_reports', { report_type: reportType, store_id: storeId });
    _hr.reports = data;
    renderReportContent(reportType, data);
  } catch (e) {
    document.getElementById('hr-report-content').innerHTML = ui.empty('📊', 'Failed to load report', e.message);
  } finally {
    SPG.hideLoader();
  }
}

function renderReportContent(type, data) {
  const el = document.getElementById('hr-report-content');
  if (!el) return;
  const records = data.records || data.rows || data || [];

  if (type === 'headcount') {
    renderHeadcountReport(el, records);
  } else if (type === 'hours') {
    renderHoursReport(el, records);
  } else if (type === 'costs') {
    renderCostReport(el, records);
  } else {
    el.innerHTML = ui.empty('📊', 'Unknown report type');
  }
}

function renderHeadcountReport(el, records) {
  if (!records.length) { el.innerHTML = ui.empty('📊', 'No headcount data'); return; }

  let totalActive = 0, totalAll = 0;
  let html = `<div class="sec-title">Headcount by Store</div>`;
  html += `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Store</th><th>Active</th><th>Inactive</th><th>Probation</th><th>Total</th></tr></thead><tbody>`;

  records.forEach(r => {
    const active = r.active || 0;
    const inactive = r.inactive || 0;
    const probation = r.probation || 0;
    const total = r.total || (active + inactive + probation);
    totalActive += active;
    totalAll += total;
    html += `<tr>
      <td style="font-weight:600">${esc(r.store_id || r.store_name || '-')}</td>
      <td>${active}</td>
      <td>${inactive}</td>
      <td>${probation}</td>
      <td style="font-weight:700">${total}</td>
    </tr>`;
  });

  html += `<tr style="font-weight:700;border-top:2px solid var(--bd2)">
    <td>TOTAL</td><td>${totalActive}</td><td></td><td></td><td>${totalAll}</td>
  </tr>`;
  html += '</tbody></table></div>';

  // KPI summary
  html = `<div class="hr-kpi-grid" style="margin-bottom:16px">
    ${kpiCard('Total Staff', totalAll)}
    ${kpiCard('Active', totalActive, '', 'var(--green)')}
    ${kpiCard('Stores', records.length)}
  </div>` + html;

  el.innerHTML = html;
}

function renderHoursReport(el, records) {
  if (!records.length) { el.innerHTML = ui.empty('📊', 'No hours data'); return; }

  let html = `<div class="sec-title">Total Hours by Period</div>`;
  html += `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Period</th><th>Store</th><th>Total Hours</th><th>Avg Hours/Day</th><th>Employees</th></tr></thead><tbody>`;

  let totalHours = 0;
  records.forEach(r => {
    totalHours += r.total_hours || 0;
    html += `<tr>
      <td>${esc(r.period_label || r.period || '-')}</td>
      <td>${esc(r.store_id || 'All')}</td>
      <td style="font-weight:600">${formatHours(r.total_hours)}</td>
      <td>${formatHours(r.avg_hours_per_day)}</td>
      <td>${r.employee_count || '-'}</td>
    </tr>`;
  });

  html += '</tbody></table></div>';

  html = `<div class="hr-kpi-grid" style="margin-bottom:16px">
    ${kpiCard('Total Hours', formatHours(totalHours))}
    ${kpiCard('Periods', records.length)}
  </div>` + html;

  el.innerHTML = html;
}

function renderCostReport(el, records) {
  if (!records.length) { el.innerHTML = ui.empty('📊', 'No cost data'); return; }

  let html = `<div class="sec-title">Cost Breakdown</div>`;
  html += `<div class="tbl-wrap"><table class="tbl">
    <thead><tr><th>Category</th><th>Store</th><th>Amount</th><th>% of Total</th></tr></thead><tbody>`;

  const totalCost = records.reduce((s, r) => s + (r.amount || 0), 0);
  records.forEach(r => {
    const pct = totalCost > 0 ? ((r.amount || 0) / totalCost * 100).toFixed(1) : '0.0';
    html += `<tr>
      <td style="font-weight:600">${esc(r.category || r.label || '-')}</td>
      <td>${esc(r.store_id || 'All')}</td>
      <td>${formatMoney(r.amount)}</td>
      <td>${pct}%</td>
    </tr>`;
  });

  html += `<tr style="font-weight:700;border-top:2px solid var(--bd2)">
    <td>TOTAL</td><td></td><td>${formatMoney(totalCost)}</td><td>100%</td>
  </tr>`;
  html += '</tbody></table></div>';

  html = `<div class="hr-kpi-grid" style="margin-bottom:16px">
    ${kpiCard('Total Cost', formatMoney(totalCost), '', 'var(--acc)')}
    ${kpiCard('Categories', records.length)}
  </div>` + html;

  el.innerHTML = html;
}


// ════════════════════════════════════════════════════════════
// 14. SETTINGS
// ════════════════════════════════════════════════════════════
function renderSettings() {
  return SPG.shell(`
    ${SPG.toolbar('HR Settings')}
    <div class="content">
      <div class="card max-w-md" id="hr-settings">${ui.skeleton(300)}</div>
    </div>`, 'HR');
}

async function loadSettings() {
  try {
    SPG.showLoader();
    const data = await hrPost('hr_get_settings');
    _hr.settings = data.settings || data;
    renderSettingsForm(_hr.settings);
  } catch (e) {
    document.getElementById('hr-settings').innerHTML = ui.empty('⚙', 'Failed to load settings', e.message);
  } finally {
    SPG.hideLoader();
  }
}

function renderSettingsForm(s) {
  const el = document.getElementById('hr-settings');
  if (!el) return;

  el.innerHTML = `
    <div style="font-size:14px;font-weight:700;margin-bottom:16px">HR Module Settings</div>

    <div class="sec-title">Attendance</div>
    <div class="fg"><label class="lb">Grace Period (minutes)</label>
      <input class="inp" id="hr-set-grace" type="number" value="${s.grace_period_minutes || 5}" min="0" max="60">
      <div class="inp-hint">Minutes after scheduled start before marking as "Late"</div>
    </div>
    <div class="fg"><label class="lb">Auto Clock-out (hours)</label>
      <input class="inp" id="hr-set-autoclock" type="number" step="0.5" value="${s.auto_clockout_hours || 12}" min="1" max="24">
      <div class="inp-hint">Automatically clock out if employee forgets</div>
    </div>

    <div class="sec-title" style="margin-top:20px">Pay</div>
    <div class="fg"><label class="lb">Default Pay Cycle</label>
      <select class="inp" id="hr-set-cycle">
        <option value="weekly"${s.pay_cycle === 'weekly' ? ' selected' : ''}>Weekly</option>
        <option value="fortnightly"${s.pay_cycle === 'fortnightly' || !s.pay_cycle ? ' selected' : ''}>Fortnightly</option>
        <option value="monthly"${s.pay_cycle === 'monthly' ? ' selected' : ''}>Monthly</option>
      </select>
    </div>
    <div class="fg"><label class="lb">Default Hourly Rate ($)</label>
      <input class="inp" id="hr-set-rate" type="number" step="0.01" value="${s.default_hourly_rate || 23.23}">
    </div>
    <div class="fg"><label class="lb">Overtime Multiplier</label>
      <input class="inp" id="hr-set-ot" type="number" step="0.1" value="${s.overtime_multiplier || 1.5}" min="1" max="3">
      <div class="inp-hint">e.g. 1.5 = time and a half</div>
    </div>
    <div class="fg"><label class="lb">Weekly Overtime Threshold (hours)</label>
      <input class="inp" id="hr-set-ot-threshold" type="number" value="${s.overtime_threshold_hours || 38}" min="0" max="80">
      <div class="inp-hint">Hours per week before overtime kicks in</div>
    </div>

    <div class="sec-title" style="margin-top:20px">Roster</div>
    <div class="fg"><label class="lb">Week Start Day</label>
      <select class="inp" id="hr-set-weekstart">
        <option value="monday"${s.week_start_day === 'monday' || !s.week_start_day ? ' selected' : ''}>Monday</option>
        <option value="sunday"${s.week_start_day === 'sunday' ? ' selected' : ''}>Sunday</option>
      </select>
    </div>
    <div class="fg">
      <label class="lb" style="display:flex;align-items:center;gap:6px">
        <input type="checkbox" id="hr-set-autopub" ${s.auto_publish_roster ? 'checked' : ''}>
        Auto-publish roster on Monday
      </label>
    </div>

    <div class="sec-title" style="margin-top:20px">Notifications</div>
    <div class="fg">
      <label class="lb" style="display:flex;align-items:center;gap:6px">
        <input type="checkbox" id="hr-set-notify-late" ${s.notify_late !== false ? 'checked' : ''}>
        Notify manager when employee is late
      </label>
    </div>
    <div class="fg">
      <label class="lb" style="display:flex;align-items:center;gap:6px">
        <input type="checkbox" id="hr-set-notify-absent" ${s.notify_absent !== false ? 'checked' : ''}>
        Notify manager when employee is absent
      </label>
    </div>

    <div class="error-msg" id="hr-set-error"></div>
    <div style="display:flex;gap:8px;margin-top:20px">
      <button class="btn btn-primary" id="hr-set-save" onclick="HRSection.doSaveSettings()">Save Settings</button>
    </div>`;
}

async function doSaveSettings() {
  const btn = document.getElementById('hr-set-save');
  btn.disabled = true; btn.textContent = 'Saving...';

  try {
    await hrPost('hr_update_settings', {
      grace_period_minutes: parseInt(document.getElementById('hr-set-grace')?.value) || 5,
      auto_clockout_hours: parseFloat(document.getElementById('hr-set-autoclock')?.value) || 12,
      pay_cycle: document.getElementById('hr-set-cycle')?.value || 'fortnightly',
      default_hourly_rate: parseFloat(document.getElementById('hr-set-rate')?.value) || 23.23,
      overtime_multiplier: parseFloat(document.getElementById('hr-set-ot')?.value) || 1.5,
      overtime_threshold_hours: parseInt(document.getElementById('hr-set-ot-threshold')?.value) || 38,
      week_start_day: document.getElementById('hr-set-weekstart')?.value || 'monday',
      auto_publish_roster: document.getElementById('hr-set-autopub')?.checked || false,
      notify_late: document.getElementById('hr-set-notify-late')?.checked !== false,
      notify_absent: document.getElementById('hr-set-notify-absent')?.checked !== false,
    });
    SPG.toast('Settings saved', 'success');
    btn.disabled = false; btn.textContent = 'Save Settings';
  } catch (e) {
    SPG.showError('hr-set-error', e.message);
    btn.disabled = false; btn.textContent = 'Save Settings';
  }
}


// ════════════════════════════════════════════════════════════
// REGISTER SECTION
// ════════════════════════════════════════════════════════════
SPG.section('hr', {
  defaultRoute: 'home',
  routes: {
    'home':              { render: renderHome,              onLoad: loadHome },
    'employees':         { render: renderEmployees,         onLoad: loadEmployees },
    'employee-detail':   { render: renderEmployeeDetail,    onLoad: loadEmployeeDetail },
    'add-employee':      { render: renderAddEmployee,       onLoad: loadAddEmployee,       minPerm: 'admin' },
    'scan-logs':         { render: renderScanLogs,          onLoad: loadScanLogs },
    'roster-templates':  { render: renderRosterTemplates,   onLoad: loadRosterTemplates },
    'template-edit':     { render: renderTemplateEdit,      onLoad: loadTemplateEdit },
    'weekly-roster':     { render: renderWeeklyRoster,      onLoad: loadWeeklyRoster },
    'attendance-review': { render: renderAttendanceReview,  onLoad: loadAttendanceReview },
    'attendance-detail': { render: renderAttendanceDetail,  onLoad: loadAttendanceDetail },
    'pay-runs':          { render: renderPayRuns,           onLoad: loadPayRuns,           minPerm: 'admin' },
    'pay-run-detail':    { render: renderPayRunDetail,      onLoad: loadPayRunDetail,      minPerm: 'admin' },
    'reports':           { render: renderReports,           onLoad: loadReports },
    'settings':          { render: renderSettings,          onLoad: loadSettings,          minPerm: 'admin' },
  },
});


// ═══ PUBLIC API (for onclick handlers) ═══
window.HRSection = {
  // Employees
  onEmpFilter,
  showEditEmployee, doUpdateEmployee, deactivateEmployee,
  doCreateEmployee,
  // Scan logs
  onScanFilter,
  // Templates
  showNewTemplate, doCreateTemplate,
  addShift, removeShift, doSaveTemplate,
  // Weekly roster
  rosterPrevWeek, rosterNextWeek, onRosterWeekChange,
  fetchWeeklyRoster,
  editRosterCell, saveRosterCell, removeRosterCell,
  doSaveRoster, publishRoster,
  showApplyTemplate, doApplyTemplate,
  showAddEmpToRoster, searchEmpForRoster,
  // Attendance
  onAttReviewFilter,
  approveAttendance, rejectAttendance, doRejectAttendance,
  // Pay runs
  showCreatePayRun, doCreatePayRun,
  doApprovePayRun,
  // Reports
  fetchReports,
  // Settings
  doSaveSettings,
};

})();
