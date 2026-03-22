/**
 * SPG HUB v1.0.0 | 22 MAR 2026 | Siam Palette Group
 * sections/bc_core.js — Bakery Center Order Module (Core)
 * State, API wrapper, role detection, sidebar, route registration
 *
 * Sub-files (loaded in order via defer):
 *   bc_store.js  — Store screens (9 pages)
 *   bc_staff.js  — BC Staff screens (8 pages)
 *   bc_admin.js  — Admin + Reports (8 pages)
 *   bc_exec.js   — Executive Dashboard (6 pages, wireframe v5)
 *
 * Architecture:
 *   - Uses SPG.section('bakery', {...}) for route registration
 *   - Uses SPG.shell() + SPG.toolbar() for layout (matches Home exactly)
 *   - Uses SPG.api.post('bakery', 'bc_action', ...) for API calls
 *   - Sidebar: text-only accordion, Modules group, matches Home design language
 *   - Accent: Pink #db2777 (via THEME_COLORS in app.js)
 */

(() => {
const esc = SPG.esc;

// ═══════════════════════════════════════
// STATE (shared across all bakery sub-files via window.BK)
// ═══════════════════════════════════════
const S = {
  // Auth & Role
  role: null,            // 'store' | 'bc' | 'management'
  sidebarRole: null,     // 'store' | 'bc' | 'management'
  storeId: null,
  deptId: null,
  config: {},            // { cutoff_time, timezone, ... }
  permissions: [],       // function-level permission keys
  stores: [],
  departments: [],
  orderingChannels: [],
  deptMapping: null,     // { module_role, section_scope }
  initLoaded: false,
  _initLoading: false,

  // Categories & Products
  categories: [],
  _catsLoaded: false,
  products: [],
  _prodsLoaded: false,
  _prodsLoading: false,

  // Orders
  orders: [],
  _ordersLoaded: false,
  _ordersLoading: false,
  currentOrder: null,

  // Cart
  cart: [],              // [{ product_id, product_name, unit, qty, is_urgent, note, stock_on_hand, section_id, min_order, order_step }]
  deliveryDate: '',
  headerNote: '',
  editingOrderId: null,
  productSearch: '',
  productFilter: 'all',

  // Quotas
  quotas: {},            // flat map { pid: qty } for current delivery day
  _quotasDay: -1,
  quotaMap: {},          // full 7-day map for quota screen

  // Stock
  stock: [],
  _stockLoaded: false,
  _stockLoading: false,
  stockInputs: {},       // { pid: value } or { pid: { s1: v, s2: v } } for 2pt
  stockHistory: [],
  stockHistDateFrom: '',
  stockHistDateTo: '',

  // Waste
  wasteLog: [],
  _wasteLoaded: false,
  _wasteLoading: false,

  // Returns
  returns: [],
  _retsLoaded: false,
  _retsLoading: false,

  // Print
  printData: null,

  // Admin
  adminProducts: null,
  adminChannels: null,
  deptMappings: null,
  wasteDash: null,
  topProds: null,
  cutoffData: null,
  auditData: null,

  // Executive
  execDash: null,
  alertConfig: null,

  // Dashboard (pre-loaded from init)
  dashboard: {},
  _dashPreloaded: false,

  // Notifications
  notifications: [],

  // Sort states for tables
  sortStates: {},
};


// ═══════════════════════════════════════
// API WRAPPER
// ═══════════════════════════════════════
function api(action, data = {}) {
  // Auto-add bc_ prefix if not present (backend strips it)
  const act = action.startsWith('bc_') ? action : 'bc_' + action;
  return SPG.api.post('bakery', act, SPG.api.tb(data));
}


// ═══════════════════════════════════════
// TIMEZONE HELPERS (Australia/Sydney)
// ═══════════════════════════════════════
const SYDNEY_TZ = 'Australia/Sydney';

function sydneyNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: SYDNEY_TZ }));
}

function fmtDate(d) {
  if (typeof d === 'string') return d;
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function todaySydney() { return fmtDate(sydneyNow()); }

function tomorrowSydney() {
  const d = sydneyNow();
  d.setDate(d.getDate() + 1);
  return fmtDate(d);
}

function sydneyDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { timeZone: SYDNEY_TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
}

function sydneyDateTime(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleString('en-AU', { timeZone: SYDNEY_TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtDateAU(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
}

function fmtDateThai(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  const m = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return d.getDate() + ' ' + m[d.getMonth()] + ' ' + d.getFullYear();
}


// ═══════════════════════════════════════
// DATE FILTER (preset ranges)
// ═══════════════════════════════════════
function getDateRange(preset) {
  const now = sydneyNow();
  const dow = now.getDay(); // 0=Sun
  const today = fmtDate(now);

  switch (preset) {
    case 'this_week': {
      const mon = new Date(now); mon.setDate(now.getDate() - ((dow + 6) % 7));
      return { from: fmtDate(mon), to: today };
    }
    case 'last_week': {
      const mon = new Date(now); mon.setDate(now.getDate() - ((dow + 6) % 7) - 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { from: fmtDate(mon), to: fmtDate(sun) };
    }
    case 'this_month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmtDate(first), to: today };
    }
    case 'last_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: fmtDate(first), to: fmtDate(last) };
    }
    default:
      return { from: '', to: '' };
  }
}

/** Render date filter chips */
function dateFilterChips(currentPreset, onChangeFn) {
  const presets = [
    { id: 'this_week', label: 'This Week' },
    { id: 'last_week', label: 'Last Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
  ];
  return `<div class="fl-bar" style="gap:6px;flex-wrap:wrap">${presets.map(p =>
    `<button class="btn btn-sm${p.id === currentPreset ? ' btn-primary' : ' btn-outline'}" onclick="${onChangeFn}('${p.id}')" style="font-size:11px;padding:5px 12px">${p.label}</button>`
  ).join('')}</div>`;
}


// ═══════════════════════════════════════
// ROLE DETECTION
// ═══════════════════════════════════════
function detectRole() {
  const s = SPG.api.getSession();
  if (!s) return 'store';

  const mr = S.deptMapping?.module_role;
  if (mr === 'bc_production' || mr === 'bc_management') {
    S.role = 'bc';
  } else {
    S.role = 'store';
  }

  // Sidebar role: admin sees everything
  const pl = s.position_id ? (s.position_level || 99) : parseInt((s.tier_id || 'T9').replace('T', ''));
  S.sidebarRole = pl <= 2 ? 'management' : S.role;

  return S.role;
}


// ═══════════════════════════════════════
// PERMISSION HELPERS
// ═══════════════════════════════════════
function hasPerm(fnId) {
  const s = SPG.api.getSession();
  if (!s) return false;
  const pl = s.position_id ? (s.position_level || 99) : parseInt((s.tier_id || 'T9').replace('T', ''));
  if (pl <= 2) return true; // Owner/GM = super_admin
  if (S.permissions.includes(fnId)) return true;
  // Implied permissions (match backend)
  if (fnId === 'fn_edit_order' && S.permissions.includes('fn_create_order')) return true;
  if (fnId === 'fn_cancel_order' && S.permissions.includes('fn_create_order')) return true;
  return false;
}

function isAdmin() {
  return S.sidebarRole === 'management';
}


// ═══════════════════════════════════════
// LOOKUP HELPERS
// ═══════════════════════════════════════
function getStoreName(id) {
  if (!id) return '';
  if (id === 'ALL') return 'All Stores';
  const s = S.stores.find(s => s.store_id === id);
  return s ? (s.store_name || id) : id;
}

function getDeptName(id) {
  if (!id) return '';
  if (id === 'ALL') return 'All';
  const d = S.departments.find(d => d.dept_id === id);
  return d ? (d.dept_name || id) : id;
}

function getStockPoints() {
  const s = SPG.api.getSession();
  const ch = S.orderingChannels.find(c => c.store_id === s?.store_id && c.dept_id === s?.dept_id);
  return ch?.stock_points || 1;
}


// ═══════════════════════════════════════
// PRODUCT HELPERS
// ═══════════════════════════════════════
function normalizeProducts(products) {
  products.forEach(p => {
    if (!p.cat_id && p.category_id) p.cat_id = p.category_id;
  });
  return products;
}

async function ensureProducts() {
  if (S._prodsLoaded) return;
  if (S._prodsLoading) return;
  S._prodsLoading = true;
  try {
    const data = await api('get_products', { include_stock: 'false' });
    S.products = normalizeProducts((data || []).sort((a, b) => (a.product_name || '').localeCompare(b.product_name || '')));
    S._prodsLoaded = true;
  } finally { S._prodsLoading = false; }
}


// ═══════════════════════════════════════
// CART MANAGEMENT
// ═══════════════════════════════════════
function getCartItem(pid) { return S.cart.find(c => c.product_id === pid); }

function setCartQty(pid, qty) {
  const idx = S.cart.findIndex(c => c.product_id === pid);
  if (qty <= 0) {
    if (idx >= 0) S.cart.splice(idx, 1);
    return;
  }
  if (idx >= 0) {
    S.cart[idx].qty = qty;
  } else {
    const p = S.products.find(pr => pr.product_id === pid);
    if (!p) return;
    S.cart.push({
      product_id: pid, product_name: p.product_name, unit: p.unit || '',
      qty, is_urgent: false, note: '', _auto: false,
      stock_on_hand: null, section_id: p.section_id,
      min_order: p.min_order || 1, order_step: p.order_step || 1,
    });
  }
}

function setCartStock(pid, stockVal) {
  const item = S.cart.find(c => c.product_id === pid);
  if (item) item.stock_on_hand = stockVal;
}

function toggleCartUrgent(pid) {
  const item = S.cart.find(c => c.product_id === pid);
  if (item) item.is_urgent = !item.is_urgent;
}

function setCartNote(pid, note) {
  const item = S.cart.find(c => c.product_id === pid);
  if (item) item.note = note;
}

function startOrder() {
  S.cart = [];
  S.stockInputs = {};
  S.deliveryDate = tomorrowSydney();
  S.headerNote = '';
  S.editingOrderId = null;
  S.productSearch = '';
  S.productFilter = 'all';
  SPG.go('bakery/browse');
}

function goToBrowse() {
  if (S.cart.length > 0 || Object.keys(S.stockInputs).length > 0) {
    SPG.go('bakery/browse');
  } else {
    startOrder();
  }
}

async function enterEditMode(orderId) {
  const data = S.currentOrder;
  if (!data || data.order.order_id !== orderId) return;
  const o = data.order;
  const items = data.items || [];
  const sp = getStockPoints();

  S.cart = items.filter(i => i.qty_ordered > 0).map(i => ({
    product_id: i.product_id,
    product_name: i.product_name,
    qty: i.qty_ordered,
    unit: i.unit || '',
    is_urgent: i.is_urgent || false,
    note: i.item_note || '',
    stock_on_hand: i.stock_on_hand != null ? i.stock_on_hand : null,
    section_id: i.section_id || '',
    _auto: false,
    min_order: i.min_order || 1,
    order_step: i.order_step || 1,
  }));

  // Fetch stock history for this order
  S.stockInputs = {};
  try {
    const hist = await api('get_stock_history', { order_id: orderId });
    if (hist) {
      (Array.isArray(hist) ? hist : []).forEach(h => {
        const val = h.stock_on_hand;
        if (sp === 2) {
          S.stockInputs[h.product_id] = { s1: String(val != null ? val : ''), s2: '' };
        } else {
          S.stockInputs[h.product_id] = String(val != null ? val : '');
        }
      });
    }
  } catch (e) { console.error('Edit mode stock fetch:', e); }

  // Fallback from order items
  items.forEach(i => {
    if (i.stock_on_hand != null && !S.stockInputs[i.product_id]) {
      if (sp === 2) {
        S.stockInputs[i.product_id] = { s1: String(i.stock_on_hand), s2: '' };
      } else {
        S.stockInputs[i.product_id] = String(i.stock_on_hand);
      }
    }
  });

  S.editingOrderId = orderId;
  S.deliveryDate = o.delivery_date;
  S.headerNote = o.header_note || '';
  S.productSearch = '';
  S.productFilter = 'all';
  S._quotasDay = -1;

  SPG.go('bakery/browse');
}

function cancelEditMode() {
  S.editingOrderId = null;
  S.cart = [];
  S.stockInputs = {};
  S.headerNote = '';
  SPG.go('bakery/orders');
}


// ═══════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════
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
// INIT (load session data for bakery)
// ═══════════════════════════════════════
async function initBakery() {
  if (S.initLoaded) return;
  if (S._initLoading) return;
  S._initLoading = true;

  try {
    const data = await api('init_lite');
    S.deptMapping = data.deptMapping || data.dept_mapping;
    S.config = data.config || {};
    S.permissions = data.permissions || [];
    S.stores = data.stores || [];
    S.departments = data.departments || [];
    S.orderingChannels = data.orderingChannels || data.ordering_channels || [];
    S.categories = data.categories || [];
    S._catsLoaded = true;

    if (data.dashboard) {
      S.dashboard = data.dashboard;
      S._dashPreloaded = true;
    }

    // Session info
    const ses = SPG.api.getSession();
    S.storeId = ses?.store_id;
    S.deptId = ses?.dept_id;

    // Detect role from dept mapping
    detectRole();

    // Check access
    if (ses?.access_level === 'no_access' || (S.deptMapping && S.deptMapping.module_role === 'not_applicable')) {
      SPG.toast('ไม่มีสิทธิ์เข้าถึง Bakery Module', 'error');
      SPG.go('dashboard');
      return;
    }

    S.initLoaded = true;
  } catch (e) {
    SPG.toast(e.message || 'โหลดข้อมูล Bakery ไม่สำเร็จ', 'error');
  } finally {
    S._initLoading = false;
  }
}


// ═══════════════════════════════════════
// SIDEBAR (matches Home exactly — text-only, accordion)
// ═══════════════════════════════════════
function buildBakerySidebar() {
  const sd = document.querySelector('.sidebar');
  if (!sd) return;

  const s = SPG.api.getSession();
  if (!s) return;

  const isBC = S.role === 'bc' || S.sidebarRole === 'management';
  const isStore = S.role === 'store' || S.sidebarRole === 'management';
  const isMgmt = S.sidebarRole === 'management';
  const cur = SPG.currentRoute;

  let html = '';

  // ── Dashboard ──
  html += sdItem('dashboard', 'Dashboard', cur);

  html += '<div class="sd-divider"></div>';

  // ── Store section ──
  if (isStore && S.role === 'store') {
    let orderItems = '';
    if (hasPerm('fn_create_order')) orderItems += sdSub('browse', 'Create Order', cur, "BakerySection.goToBrowse()");
    if (hasPerm('fn_view_own_orders')) orderItems += sdSub('orders', 'View Orders', cur);
    if (hasPerm('fn_create_order')) orderItems += sdSub('quota', 'Set Quota', cur);
    if (hasPerm('fn_create_order')) orderItems += sdSub('stock-history', 'Stock History', cur);
    if (orderItems) html += sdAccordion('orders', 'Orders', orderItems, cur);

    let recordItems = '';
    if (hasPerm('fn_view_waste')) recordItems += sdSub('waste', 'Waste Log', cur);
    if (hasPerm('fn_view_returns')) recordItems += sdSub('returns', 'Returns', cur);
    if (recordItems) html += sdAccordion('records', 'Records', recordItems, cur);
  }

  // ── BC Staff section ──
  if (isBC && S.role === 'bc') {
    let bcOrderItems = '';
    bcOrderItems += sdSub('orders', 'View Orders', cur);
    bcOrderItems += sdSub('print', 'Print Centre', cur);
    html += sdAccordion('orders', 'Orders', bcOrderItems, cur);

    let bcRecordItems = '';
    bcRecordItems += sdSub('waste', 'Waste Log', cur);
    bcRecordItems += sdSub('bc-returns', 'Incoming Returns', cur);
    html += sdAccordion('records', 'Records', bcRecordItems, cur);

    // ── Executive (management only) ──
    if (isMgmt) {
      let execItems = '';
      execItems += sdSub('exec-command', 'Command Centre', cur);
      execItems += sdSub('exec-product', 'Product Efficiency', cur);
      execItems += sdSub('exec-store', 'Store Performance', cur);
      execItems += sdSub('exec-demand', 'Demand & Quota', cur);
      execItems += sdSub('exec-waste', 'Waste Intelligence', cur);
      execItems += sdSub('exec-quality', 'Quality & Returns', cur);
      html += sdAccordion('executive', 'Executive', execItems, cur);
    }

    // ── Reports (position level ≤ 3) ──
    const pl = s.position_id ? (s.position_level || 99) : parseInt((s.tier_id || 'T9').replace('T', ''));
    if (pl <= 3) {
      let reportItems = '';
      if (hasPerm('fn_view_waste')) reportItems += sdSub('waste-dashboard', 'Waste Dashboard', cur);
      if (isMgmt || hasPerm('fn_view_all_orders')) reportItems += sdSub('top-products', 'Top Products', cur);
      if (isMgmt) reportItems += sdSub('cutoff', 'Cutoff Violations', cur);
      if (hasPerm('fn_view_audit_log')) reportItems += sdSub('audit', 'Audit Trail', cur);
      if (reportItems) html += sdAccordion('reports', 'Reports', reportItems, cur);
    }

    // ── Admin (perm-gated) ──
    let adminItems = '';
    if (hasPerm('fn_manage_products')) adminItems += sdSub('products', 'Manage Products', cur);
    if (hasPerm('fn_manage_visibility')) adminItems += sdSub('visibility', 'Product Visibility', cur);
    if (hasPerm('fn_manage_permissions')) adminItems += sdSub('access', 'User Access', cur);
    if (hasPerm('fn_manage_dept_mapping')) adminItems += sdSub('dept-mapping', 'Dept Mapping', cur);
    if (hasPerm('fn_manage_config')) adminItems += sdSub('config', 'System Config', cur);
    if (adminItems) {
      html += '<div class="sd-divider"></div>';
      html += '<div class="sd-section">Admin</div>';
      html += sdAccordion('admin', 'Settings', adminItems, cur);
    }
  }

  // ── Modules group (other modules — NOT Bakery) ──
  html += '<div class="sd-divider"></div>';
  const modules = SPG.state.modules;
  if (modules) {
    let modItems = '';
    const MODULE_DEFS = [
      { id: 'sales', label: 'Sales Daily', key: 'saledaily_report' },
      { id: 'finance', label: 'Finance', key: 'finance' },
      { id: 'hr', label: 'HR', key: 'hr' },
      { id: 'purchase', label: 'Purchase', key: 'purchase' },
    ];
    const MODULE_MAP = { 'saledaily_report': 'sales', 'finance': 'finance', 'hr': 'hr', 'purchase': 'purchase' };

    MODULE_DEFS.forEach(def => {
      const mod = modules.find(m => MODULE_MAP[m.module_id] === def.id);
      if (mod && !mod.is_accessible) return;
      const isActive = mod && mod.status === 'active';
      if (isActive) {
        modItems += `<div class="sd-sub-item" onclick="SPG.go('${def.id}/dashboard')">${def.label}</div>`;
      } else if (mod) {
        modItems += `<div class="sd-sub-item" style="opacity:.35;cursor:default">${def.label}</div>`;
      }
    });
    if (modItems) html += sdAccordion('modules', 'Modules', modItems, cur);
  }

  // ── Footer ──
  html += `<div class="sd-footer">
    <div class="sd-version">BC v1.0</div>
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

function sdItem(route, label, cur) {
  const active = cur === route ? ' active' : '';
  return `<div class="sd-item${active}" onclick="SPG.go('bakery/${route}')">${label}</div>`;
}

function sdAccordion(id, label, items, cur) {
  return `<div class="sd-group" data-group="${id}">
    <div class="sd-group-head">${label}<span class="sd-group-arr">›</span></div>
    <div class="sd-sub">${items}</div>
  </div>`;
}

function sdSub(route, label, cur, customOnclick) {
  const active = cur === route ? ' active' : '';
  const onclick = customOnclick || `SPG.go('bakery/${route}')`;
  return `<div class="sd-sub-item${active}" onclick="${onclick}">${label}</div>`;
}


// ═══════════════════════════════════════
// ROUTE REGISTRATION
// ═══════════════════════════════════════
// Route render/onLoad functions are set by sub-files (bc_store.js etc.)
// via window.BK object. Since all scripts use `defer`, they execute in order
// before DOMContentLoaded, so all functions are available when go() is called.

SPG.section('bakery', {
  defaultRoute: 'dashboard',
  buildSidebar: buildBakerySidebar,
  routes: {
    // ── Store routes (bc_store.js) ──
    'dashboard':      { render: (p) => BK.renderDashboard(p),     onLoad: (p) => BK.loadDashboard(p) },
    'browse':         { render: (p) => BK.renderBrowse(p),        onLoad: (p) => BK.loadBrowse(p) },
    'cart':           { render: (p) => BK.renderCart(p),           onLoad: (p) => BK.loadCart(p) },
    'orders':         { render: (p) => BK.renderOrders(p),        onLoad: (p) => BK.loadOrders(p) },
    'order-detail':   { render: (p) => BK.renderOrderDetail(p),   onLoad: (p) => BK.loadOrderDetail(p) },
    'quota':          { render: (p) => BK.renderQuota(p),         onLoad: (p) => BK.loadQuota(p) },
    'stock':          { render: (p) => BK.renderStock(p),         onLoad: (p) => BK.loadStock(p) },
    'waste':          { render: (p) => BK.renderWaste(p),         onLoad: (p) => BK.loadWaste(p) },
    'returns':        { render: (p) => BK.renderReturns(p),       onLoad: (p) => BK.loadReturns(p) },

    // ── BC Staff routes (bc_staff.js) ──
    'bc-dashboard':   { render: (p) => BK.renderBcDashboard(p),   onLoad: (p) => BK.loadBcDashboard(p) },
    'accept':         { render: (p) => BK.renderAccept(p),        onLoad: (p) => BK.loadAccept(p) },
    'fulfil':         { render: (p) => BK.renderFulfil(p),        onLoad: (p) => BK.loadFulfil(p) },
    'print':          { render: (p) => BK.renderPrint(p),         onLoad: (p) => BK.loadPrint(p) },
    'bc-returns':     { render: (p) => BK.renderBcReturns(p),     onLoad: (p) => BK.loadBcReturns(p) },
    'products':       { render: (p) => BK.renderProducts(p),      onLoad: (p) => BK.loadProducts(p) },
    'prod-edit':      { render: (p) => BK.renderProdEdit(p),      onLoad: (p) => BK.loadProdEdit(p) },
    'stock-history':  { render: (p) => BK.renderStockHistory(p),  onLoad: (p) => BK.loadStockHistory(p) },

    // ── Admin + Reports routes (bc_admin.js) ──
    'config':         { render: (p) => BK.renderConfig(p),        onLoad: (p) => BK.loadConfig(p) },
    'dept-mapping':   { render: (p) => BK.renderDeptMapping(p),   onLoad: (p) => BK.loadDeptMapping(p) },
    'visibility':     { render: (p) => BK.renderVisibility(p),    onLoad: (p) => BK.loadVisibility(p) },
    'access':         { render: (p) => BK.renderAccess(p),        onLoad: (p) => BK.loadAccess(p) },
    'waste-dashboard':{ render: (p) => BK.renderWasteDashboard(p),onLoad: (p) => BK.loadWasteDashboard(p) },
    'top-products':   { render: (p) => BK.renderTopProducts(p),   onLoad: (p) => BK.loadTopProducts(p) },
    'cutoff':         { render: (p) => BK.renderCutoff(p),        onLoad: (p) => BK.loadCutoff(p) },
    'audit':          { render: (p) => BK.renderAudit(p),         onLoad: (p) => BK.loadAudit(p) },

    // ── Executive routes (bc_exec.js) — wireframe v5 ──
    'exec-command':   { render: (p) => BK.renderExecCommand(p),   onLoad: (p) => BK.loadExecCommand(p) },
    'exec-product':   { render: (p) => BK.renderExecProduct(p),   onLoad: (p) => BK.loadExecProduct(p) },
    'exec-store':     { render: (p) => BK.renderExecStore(p),     onLoad: (p) => BK.loadExecStore(p) },
    'exec-demand':    { render: (p) => BK.renderExecDemand(p),    onLoad: (p) => BK.loadExecDemand(p) },
    'exec-waste':     { render: (p) => BK.renderExecWaste(p),     onLoad: (p) => BK.loadExecWaste(p) },
    'exec-quality':   { render: (p) => BK.renderExecQuality(p),   onLoad: (p) => BK.loadExecQuality(p) },
  },
});


// ═══════════════════════════════════════
// PUBLIC API (shared with sub-files via window.BK)
// ═══════════════════════════════════════
window.BK = {
  // State
  S,

  // API
  api,
  apiGet,

  // Init
  initBakery,
  detectRole,
  buildBakerySidebar,

  // Timezone
  sydneyNow, fmtDate, todaySydney, tomorrowSydney,
  sydneyDate, sydneyDateTime, fmtDateAU, fmtDateThai,

  // Date filter
  getDateRange, dateFilterChips,

  // Permissions
  hasPerm, isAdmin,

  // Lookups
  getStoreName, getDeptName, getStockPoints,

  // Products
  normalizeProducts, ensureProducts,

  // Cart
  getCartItem, setCartQty, setCartStock, toggleCartUrgent, setCartNote,
  startOrder, goToBrowse, enterEditMode, cancelEditMode,

  // Utils
  esc, debounce, getInitials,

  // Route render/load placeholders — filled by sub-files
  // (bc_store.js, bc_staff.js, bc_admin.js, bc_exec.js)
};


// ═══════════════════════════════════════
// EXPOSED ONCLICK HANDLERS
// ═══════════════════════════════════════
window.BakerySection = {
  // Cart
  startOrder,
  goToBrowse,
  enterEditMode,
  cancelEditMode,
  setCartQty: (pid, qty) => { setCartQty(pid, qty); },
  setCartStock: (pid, val) => { setCartStock(pid, val); },
  toggleCartUrgent: (pid) => { toggleCartUrgent(pid); },
  setCartNote: (pid, note) => { setCartNote(pid, note); },

  // Will be extended by sub-files
};

})();
