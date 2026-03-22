/**
 * SPG HUB v1.0.0 | 22 MAR 2026 | Siam Palette Group
 * sections/sd_core.js — Sales Daily Module (Core)
 * State, API wrapper, role detection, sidebar, route registration
 *
 * Sub-files (loaded in order via defer):
 *   sd_screens.js   — Dashboard (Store + Management view)
 *   sd_screens2.js  — S1-S4 Input (Daily Sale, Expense, Invoice, Cash)
 *   sd_screens3.js  — S5-S8 History + Report + Tasks + Daily Hub
 *   sd_screens4.js  — Admin (Account Review, Report Dash, Channels, Vendors, Config, Access, Audit)
 *   sd_exclusive.js — Executive Dashboard (6 pages, T1-T2 only)
 *
 * Architecture:
 *   - Uses SPG.section('sales', {...}) for route registration
 *   - Uses SPG.shell() + SPG.toolbar() for layout (matches Home exactly)
 *   - Uses SPG.api.post('sales', 'sd_action', ...) for API calls
 *   - Sidebar: text-only accordion, role-based (3 variants), Modules group
 *   - Accent: Blue #2563eb (via THEME_COLORS in app.js)
 */

(() => {
const esc = SPG.esc;
const ui = SPG.ui;

// ═══════════════════════════════════════
// STATE (shared across all SD sub-files via window.SD)
// ═══════════════════════════════════════
const S = {
  // Init
  initLoaded: false,
  _initLoading: false,

  // Session info
  storeId: null,
  deptId: null,
  selectedStore: null,   // HQ store picker

  // Config from init_bundle
  config: {},
  permissions: [],       // function-level permission keys (sd_acc_review, etc.)
  stores: [],            // all stores (for HQ picker)
  allChannels: [],       // all channels (all stores)
  channels: [],          // channels for selected store
  vendors: [],
  settings: {},

  // Dashboard
  dashboard: null,
  _dashPreloaded: false,

  // Sort states
  sortStates: {},
};


// ═══════════════════════════════════════
// API WRAPPER
// ═══════════════════════════════════════
function api(action, data = {}) {
  const act = action.startsWith('sd_') ? action : 'sd_' + action;
  return SPG.api.post('sales', act, SPG.api.tb(data));
}

/**
 * Photo upload — FormData (not JSON)
 * Core api.js doesn't support FormData, so we do it directly
 */
async function uploadPhoto(file, category, storeId) {
  const BASE = 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/saledaily-report';
  const fd = new FormData();
  fd.append('token', SPG.api.getToken());
  fd.append('file', file);
  fd.append('category', category || 'sale');
  if (storeId) fd.append('store_id', storeId);
  const resp = await fetch(`${BASE}?action=sd_upload_photo`, { method: 'POST', body: fd });
  const json = await resp.json();
  if (!json.success) { const e = new Error(json.error?.message || 'Upload failed'); e.code = json.error?.code; throw e; }
  return json.data;
}


// ═══════════════════════════════════════
// TIMEZONE HELPERS (Australia/Sydney)
// ═══════════════════════════════════════
const TZ = 'Australia/Sydney';

function sydneyNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
}

function todayStr() {
  const d = sydneyNow();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDate() + '/' + (d.getMonth() + 1);
}

function fmtMoney(n) {
  const v = parseFloat(n) || 0;
  return '$' + v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMoneyShort(n) {
  const v = parseFloat(n) || 0;
  return v >= 1000 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + v.toFixed(0);
}


// ═══════════════════════════════════════
// ROLE DETECTION
// ═══════════════════════════════════════
function getTierLevel() {
  const s = SPG.api.getSession();
  return s?.position_id ? (s.position_level || 99) : parseInt((s?.tier_id || 'T9').replace('T', ''));
}

function isOwner() { return getTierLevel() <= 2; }   // T1-T2
function isMgmt() { return getTierLevel() <= 4; }    // T1-T4
function isHQ() {
  const s = SPG.api.getSession();
  return s?.store_id === 'HQ' || getTierLevel() <= 2;
}


// ═══════════════════════════════════════
// PERMISSION HELPERS
// ═══════════════════════════════════════
function hasPerm(fnId) {
  if (isOwner()) return true;
  return S.permissions.includes(fnId);
}


// ═══════════════════════════════════════
// STORE SELECTOR
// ═══════════════════════════════════════
function getStore() { return S.selectedStore || SPG.api.getSession()?.store_id || null; }

function setStore(id) {
  S.selectedStore = id;
  S.dashboard = null;
  S.channels = (id && id !== 'ALL') ? S.allChannels.filter(c => c.store_id === id) : [];
}

function renderStoreSelector(opts) {
  if (!isMgmt()) return '';
  const noAll = opts?.noAll || false;
  let sel = getStore();
  if (noAll && (!sel || sel === 'ALL') && S.stores.length) { sel = S.stores[0].store_id; setStore(sel); }
  const allPill = noAll ? '' : `<div class="store-pill${sel === 'ALL' ? ' on' : ''}" onclick="SDSection.selectStore('ALL')">ทุกร้าน</div>`;
  return `<div class="store-sel">${allPill}${S.stores.map(s =>
    `<div class="store-pill${s.store_id === sel ? ' on' : ''}" onclick="SDSection.selectStore('${s.store_id}')">${esc(s.short || s.store_id)}</div>`
  ).join('')}</div>`;
}

function selectStore(id) {
  setStore(id);
  SPG.go('sales/' + SPG.currentRoute);
}


// ═══════════════════════════════════════
// INIT (load once per session)
// ═══════════════════════════════════════
async function initModule() {
  if (S.initLoaded) return;
  if (S._initLoading) return;
  S._initLoading = true;

  try {
    const data = await api('init_bundle');

    // Session info
    const ses = SPG.api.getSession();
    S.storeId = ses?.store_id;
    S.deptId = ses?.dept_id;

    // Config
    S.stores = data.all_stores || [];
    S.allChannels = data.all_channels || [];
    S.vendors = data.vendors || [];
    S.settings = data.settings || {};
    S.permissions = data.permissions ? Object.keys(data.permissions).filter(k => data.permissions[k] === true) : [];

    // Dashboard preload
    if (data._dashboard) {
      S.dashboard = data._dashboard;
      S._dashPreloaded = true;
    }

    // Default store
    if (!isHQ()) {
      const sid = ses?.store_id;
      setStore(sid);
    } else {
      setStore('ALL');
    }

    S.initLoaded = true;
  } catch (e) {
    SPG.toast(e.message || 'โหลดข้อมูล Sales Daily ไม่สำเร็จ', 'error');
  } finally {
    S._initLoading = false;
  }
}


// ═══════════════════════════════════════
// SIDEBAR (matches Home exactly — text-only, accordion)
// ═══════════════════════════════════════
function buildSDSidebar() {
  const sd = document.querySelector('.sidebar');
  if (!sd) return;

  const s = SPG.api.getSession();
  if (!s) return;
  const cur = SPG.currentRoute;

  let html = '';

  // ── T1-T2: Executive Dashboard ON TOP ──
  if (isOwner()) {
    let execItems = '';
    execItems += sdSub('exec-cmd', 'Command Centre', cur);
    execItems += sdSub('exec-pnl', 'P&L Deep Dive', cur);
    execItems += sdSub('exec-revenue', 'Revenue Intelligence', cur);
    execItems += sdSub('exec-report', 'Report Intelligence', cur);
    execItems += sdSub('exec-store', 'Store Performance', cur);
    execItems += sdSub('exec-staff', 'Staff × Money', cur);
    html += sdAccordion('executive', 'Executive Dashboard', execItems);
    html += '<div class="sd-divider"></div>';
  }

  // ── Dashboard (not for T1-T2 — they use Executive) ──
  if (!isOwner()) {
    html += sdItem('dashboard', 'Dashboard', cur);
    html += '<div class="sd-divider"></div>';
  }

  // ── Input ──
  let inputItems = '';
  inputItems += sdSub('daily-sale', 'Daily Sale', cur);
  inputItems += sdSub('expense', 'Expense', cur);
  inputItems += sdSub('invoice', 'Invoice', cur);
  inputItems += sdSub('cash', 'Cash On Hand', cur);
  html += sdAccordion('input', 'Input', inputItems);

  // ── History ──
  let histItems = '';
  histItems += sdSub('sale-history', 'Sale History', cur);
  histItems += sdSub('expense-history', 'Expense History', cur);
  html += sdAccordion('history', 'History', histItems);

  // ── Report ──
  let repItems = '';
  repItems += sdSub('daily-report', 'Daily Report', cur);
  repItems += sdSub('daily-hub', 'Daily Hub', cur);
  repItems += sdSub('tasks', 'Tasks', cur);
  html += sdAccordion('report', 'Report', repItems);

  // ── Admin ──
  if (isMgmt()) {
    html += '<div class="sd-divider"></div>';
    html += '<div class="sd-section">Admin</div>';

    if (isOwner()) {
      // T1-T2: 3 sub-groups
      let fnItems = '';
      if (hasPerm('sd_acc_review')) fnItems += sdSub('acc-review', 'Account Review', cur);
      if (hasPerm('sd_view_admin_reports')) fnItems += sdSub('admin-report', 'Report Dashboard', cur);
      if (fnItems) html += sdAccordion('admin-fn', 'Operations', fnItems);

      let cfgItems = '';
      if (hasPerm('sd_manage_channels')) cfgItems += sdSub('channels', 'Channels', cur);
      if (hasPerm('sd_manage_vendors')) cfgItems += sdSub('vendors', 'Vendors', cur);
      if (hasPerm('sd_manage_settings')) cfgItems += sdSub('config', 'Config', cur);
      if (cfgItems) html += sdAccordion('admin-cfg', 'Configuration', cfgItems);

      let accItems = '';
      if (hasPerm('sd_manage_permissions')) accItems += sdSub('access', 'User Access', cur);
      if (hasPerm('sd_view_audit')) accItems += sdSub('audit', 'Audit', cur);
      if (accItems) html += sdAccordion('admin-access', 'Access & Audit', accItems);
    } else {
      // T3-T4: single admin group
      let adminItems = '';
      if (hasPerm('sd_acc_review')) adminItems += sdSub('acc-review', 'Account Review', cur);
      if (hasPerm('sd_view_admin_reports')) adminItems += sdSub('admin-report', 'Report Dashboard', cur);
      if (hasPerm('sd_manage_channels')) adminItems += sdSub('channels', 'Channels', cur);
      if (hasPerm('sd_manage_vendors')) adminItems += sdSub('vendors', 'Vendors', cur);
      if (hasPerm('sd_manage_settings')) adminItems += sdSub('config', 'Config', cur);
      if (hasPerm('sd_manage_permissions')) adminItems += sdSub('access', 'User Access', cur);
      if (hasPerm('sd_view_audit')) adminItems += sdSub('audit', 'Audit', cur);
      if (adminItems) html += sdAccordion('admin', 'Admin', adminItems);
    }
  }

  // ── Modules (other modules — NOT Sales Daily) ──
  html += '<div class="sd-divider"></div>';
  const modules = SPG.state.modules;
  if (modules) {
    let modItems = '';
    const MOD_DEFS = [
      { id: 'bakery', label: 'Bakery', key: 'bakery_order' },
      { id: 'finance', label: 'Finance', key: 'finance' },
      { id: 'hr', label: 'HR', key: 'hr' },
      { id: 'purchase', label: 'Purchase', key: 'purchase' },
    ];
    const MOD_MAP = { 'bakery_order': 'bakery', 'finance': 'finance', 'hr': 'hr', 'purchase': 'purchase' };

    MOD_DEFS.forEach(def => {
      const mod = modules.find(m => MOD_MAP[m.module_id] === def.id);
      if (mod && !mod.is_accessible) return;
      const isActive = mod && mod.status === 'active';
      if (isActive) {
        modItems += `<div class="sd-sub-item" onclick="SPG.go('${def.id}/dashboard')">${def.label}</div>`;
      } else if (mod) {
        modItems += `<div class="sd-sub-item" style="opacity:.35;cursor:default">${def.label}</div>`;
      }
    });
    if (modItems) html += sdAccordion('modules', 'Modules', modItems);
  }

  // ── Footer ──
  html += `<div class="sd-footer">
    <div class="sd-version">SD v2.0</div>
    <a href="#" onclick="SPG.go('dashboard');return false">← Home</a>
    <a href="#" class="danger" onclick="SPG.doLogout();return false">Log out</a>
  </div>`;

  sd.innerHTML = html;
  if (SPG.state.sidebarCollapsed) sd.classList.add('closed');

  // Auto-expand current accordion
  sd.querySelectorAll('.sd-group').forEach(sg => {
    if (sg.querySelector('.sd-sub-item.active')) sg.classList.add('open');
  });
}

// Sidebar helpers (same pattern as Bakery bc_core.js)
function sdItem(route, label, cur) {
  const active = cur === route ? ' active' : '';
  return `<div class="sd-item${active}" onclick="SPG.go('sales/${route}')">${label}</div>`;
}

function sdAccordion(id, label, items) {
  return `<div class="sd-group" data-group="${id}">
    <div class="sd-group-head">${label}<span class="sd-group-arr">›</span></div>
    <div class="sd-sub">${items}</div>
  </div>`;
}

function sdSub(route, label, cur) {
  const active = cur === route ? ' active' : '';
  return `<div class="sd-sub-item${active}" onclick="SPG.go('sales/${route}')">${label}</div>`;
}


// ═══════════════════════════════════════
// SHARED UI HELPERS
// ═══════════════════════════════════════
function dateBar(id, date, onChange) {
  return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;margin-bottom:10px">
    <button class="btn btn-outline btn-sm" onclick="${onChange}(-1)">‹</button>
    <div style="flex:1;text-align:center;font-size:13px;font-weight:600" id="${id}-label">${fmtDate(date)}</div>
    <button class="btn btn-outline btn-sm" onclick="${onChange}(1)">›</button>
    <input type="date" class="inp" style="width:auto;padding:4px 8px;font-size:11px;border-color:var(--theme)" id="${id}-picker" value="${date}" onchange="${onChange}(0,this.value)">
  </div>`;
}

function lockBanner(synced) {
  if (!synced) return '';
  return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:var(--rd);font-size:12px;margin-bottom:8px;background:var(--bg3);color:var(--t3);border:1.5px solid var(--bd)">🔒 <b>ข้อมูลถูก Sync แล้ว</b> — แก้ไขไม่ได้ ติดต่อ Admin</div>`;
}

function renderExtraPhotos(photos, prefix) {
  if (!photos || !photos.length) return '';
  return photos.map((url, i) => `<div style="position:relative;width:54px;height:54px;border-radius:6px;overflow:hidden;border:1px solid var(--bd)">
    <img src="${url}" style="width:100%;height:100%;object-fit:cover">
    <div style="position:absolute;top:-2px;right:-2px;background:var(--red);color:#fff;width:16px;height:16px;border-radius:50%;font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer" onclick="SDSection.removeExtraPhoto('${prefix}',${i})">×</div>
  </div>`).join('');
}

function renderVendorInput(id, value) {
  return `<div class="vendor-wrap" style="position:relative">
    <input type="text" class="inp" id="${id}" value="${esc(value || '')}" placeholder="🔍 พิมพ์ค้นหา Vendor..."
      autocomplete="off" onfocus="SDSection.vnShow('${id}')" oninput="SDSection.vnFilter('${id}')">
    <div id="${id}-list" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:100;background:var(--bg2);border:1px solid var(--bd);border-radius:0 0 var(--rd) var(--rd);max-height:180px;overflow-y:auto;box-shadow:var(--sh2)"></div>
    <button class="btn btn-outline btn-sm" style="margin-top:4px;font-size:10px" onclick="SDSection.vnCreate('${id}')">+ เพิ่ม Vendor ใหม่</button>
  </div>`;
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].substring(0, 2).toUpperCase();
}


// ═══════════════════════════════════════
// ROUTE REGISTRATION
// ═══════════════════════════════════════
SPG.section('sales', {
  defaultRoute: isOwner() ? 'exec-cmd' : 'dashboard',
  buildSidebar: buildSDSidebar,
  routes: {
    // ── Dashboard (sd_screens.js) ──
    'dashboard':      { render: (p) => SD.renderDashboard(p),     onLoad: (p) => SD.loadDashboard(p) },

    // ── Input S1-S4 (sd_screens2.js) ──
    'daily-sale':     { render: (p) => SD.renderS1(p),            onLoad: (p) => SD.loadS1(p) },
    'daily-sale-edit':{ render: (p) => SD.renderS1({ ...p, edit: true }), onLoad: (p) => SD.loadS1({ ...p, edit: true }) },
    'expense':        { render: (p) => SD.renderS2(p),            onLoad: (p) => SD.loadS2(p) },
    'invoice':        { render: (p) => SD.renderS3List(p),        onLoad: (p) => SD.loadS3List(true) },
    'invoice-form':   { render: (p) => SD.renderS3Form(p),        onLoad: (p) => SD.loadS3Form(p) },
    'cash':           { render: (p) => SD.renderS4(p),            onLoad: (p) => SD.loadS4(p) },

    // ── History + Report S5-S8 (sd_screens3.js) ──
    'sale-history':   { render: (p) => SD.renderS5(p),            onLoad: (p) => SD.loadS5(true) },
    'expense-history':{ render: (p) => SD.renderS6(p),            onLoad: (p) => SD.loadS6(true) },
    'daily-report':   { render: (p) => SD.renderS8(p),            onLoad: (p) => SD.loadS8(p) },
    'tasks':          { render: (p) => SD.renderTasks(p),          onLoad: (p) => SD.loadTasks(p) },
    'daily-hub':      { render: (p) => SD.renderDH(p),            onLoad: (p) => SD.loadDH(p) },

    // ── Admin (sd_screens4.js) ──
    'acc-review':     { render: (p) => SD.renderAccReview(p),     onLoad: (p) => SD.loadAccReview(p) },
    'admin-report':   { render: (p) => SD.renderReportDash(p),    onLoad: (p) => SD.loadReportDash(p) },
    'channels':       { render: (p) => SD.renderChannels(p),      onLoad: (p) => SD.loadChannels(p) },
    'vendors':        { render: (p) => SD.renderVendors(p),       onLoad: (p) => SD.loadVendors(p) },
    'config':         { render: (p) => SD.renderConfig(p),        onLoad: (p) => SD.loadConfig(p) },
    'access':         { render: (p) => SD.renderAccess(p),        onLoad: (p) => SD.loadAccess(p) },
    'audit':          { render: (p) => SD.renderAudit(p),         onLoad: (p) => SD.loadAudit(p) },

    // ── Executive (sd_exclusive.js) — T1-T2 only ──
    'exec-cmd':       { render: (p) => SD.renderExecCmd(p),       onLoad: (p) => SD.loadExecCmd(p) },
    'exec-pnl':       { render: (p) => SD.renderExecPnl(p),       onLoad: (p) => SD.loadExecPnl(p) },
    'exec-revenue':   { render: (p) => SD.renderExecRevenue(p),   onLoad: (p) => SD.loadExecRevenue(p) },
    'exec-report':    { render: (p) => SD.renderExecReport(p),    onLoad: (p) => SD.loadExecReport(p) },
    'exec-store':     { render: (p) => SD.renderExecStore(p),     onLoad: (p) => SD.loadExecStore(p) },
    'exec-staff':     { render: (p) => SD.renderExecStaff(p),     onLoad: (p) => SD.loadExecStaff(p) },
  },
});


// ═══════════════════════════════════════
// PUBLIC API (shared with sub-files via window.SD)
// ═══════════════════════════════════════
window.SD = {
  // State
  S,

  // API
  api,
  uploadPhoto,

  // Init
  initModule,
  buildSDSidebar,

  // Role
  getTierLevel, isOwner, isMgmt, isHQ,

  // Permission
  hasPerm,

  // Store
  getStore, setStore, renderStoreSelector, selectStore,

  // Date/Time
  todayStr, addDays, fmtDate, fmtDateShort, fmtMoney, fmtMoneyShort,

  // UI Helpers
  dateBar, lockBanner, renderExtraPhotos, renderVendorInput,

  // Utils
  esc, debounce, getInitials,

  // Route render/load placeholders — filled by sub-files
};


// ═══════════════════════════════════════
// EXPOSED ONCLICK HANDLERS
// ═══════════════════════════════════════
window.SDSection = {
  selectStore,

  // Vendor search (filled by sd_screens2.js)
  vnShow: () => {},
  vnFilter: () => {},
  vnCreate: () => {},
  vnDoCreate: () => {},
  vnPick: () => {},

  // Extra photos
  removeExtraPhoto: () => {},
};

})();
