/**
 * SPG HUB v1.0.0 | 20 MAR 2026 | Siam Palette Group
 * core/app.js — Shell + Router + Section Manager
 * The heart of the One Union System
 *
 * Architecture:
 *   SPG.go(route, params)       → navigate anywhere
 *   SPG.section(id, config)     → register a section
 *   SPG.shell(inner)            → wrap content in shell layout
 *   SPG.toast/showLoader/etc    → shared utilities
 *
 * Route patterns:
 *   #login, #dashboard, #profile  → root routes (mapped to 'home' section)
 *   #sales/daily, #purchase/new   → section/route format
 *   #settings/accounts            → settings section
 */

(() => {
  const VERSION = '2.0.0';
  const esc = SPG.ui.esc;

  // ═══ THEME COLORS (per section) ═══
  const THEME_COLORS = {
    home:       { theme: '#7c3aed', bg: '#ede9fe', dark: '#6d28d9' },
    sales:      { theme: '#2563eb', bg: '#dbeafe', dark: '#1d4ed8' },
    purchase:   { theme: '#d97706', bg: '#fef3c7', dark: '#b45309' },
    bakery:     { theme: '#db2777', bg: '#fce7f3', dark: '#be185d' },
    finance:    { theme: '#7c3aed', bg: '#ede9fe', dark: '#6d28d9' },
    hr:         { theme: '#4f46e5', bg: '#e0e7ff', dark: '#4338ca' },
    operations: { theme: '#0d9488', bg: '#ccfbf1', dark: '#0f766e' },
    foodhub:    { theme: '#16a34a', bg: '#dcfce7', dark: '#15803d' },
    marketing:  { theme: '#e11d48', bg: '#ffe4e6', dark: '#be123c' },
    equipment:  { theme: '#475569', bg: '#f1f5f9', dark: '#334155' },
    bi:         { theme: '#0891b2', bg: '#cffafe', dark: '#0e7490' },
    crm:        { theme: '#8b5cf6', bg: '#ede9fe', dark: '#7c3aed' },
  };

  function setTheme(sectionId) {
    const t = THEME_COLORS[sectionId] || THEME_COLORS.home;
    document.documentElement.style.setProperty('--theme', t.theme);
    document.documentElement.style.setProperty('--theme-bg', t.bg);
    document.documentElement.style.setProperty('--theme-dark', t.dark);
  }

  // ═══ STATE ═══
  const state = {
    session: null,
    modules: null,         // from init_bundle (sections accessible by this user)
    homePermission: null,
    profileComplete: true,
    profile: null,
    _bundleLoaded: false,
    _bundleLoading: false,
    _profileLoaded: false,
    sidebarCollapsed: false,
  };

  // ═══ SECTION REGISTRY ═══
  // Each section registers itself: SPG.section('sales', { routes, sidebar, ... })
  const _sections = {};
  const _loadedScripts = {};

  function registerSection(id, config) {
    _sections[id] = config;
  }

  // ═══ ROOT ROUTE → SECTION MAPPING ═══
  // These routes don't need a section prefix in the hash
  const ROOT_ROUTES = {
    'login': 'home', 'register': 'home',
    'staff-select': 'home', 'store-select': 'home', 'new-staff': 'home',
    'dashboard': 'home', 'profile': 'home',
    'pending-approval': 'home', 'employee-form': 'home', 'line-connect': 'home',
  };

  // Public routes (no auth required)
  const PUBLIC_ROUTES = ['login', 'register'];

  // Routes that need temp account (not full session)
  const TEMP_ROUTES = ['staff-select', 'new-staff', 'store-select'];

  // ═══ CURRENT STATE ═══
  let currentSection = '';
  let currentRoute = '';
  let currentParams = {};

  // ═══ HASH PARSER ═══
  function parseHash(hash) {
    const clean = (hash || '').replace(/^#/, '');
    if (!clean) return { section: 'home', route: 'dashboard', params: {} };

    const parts = clean.split('/');
    const first = parts[0];
    const rest = parts.slice(1).join('/');

    // Root route?
    if (ROOT_ROUTES[first]) {
      return { section: ROOT_ROUTES[first], route: first, params: parseRouteParams(first, rest) };
    }

    // Section route: #sales/daily → section=sales, route=daily
    if (_sections[first]) {
      const route = rest || _sections[first].defaultRoute || 'home';
      return { section: first, route, params: parseRouteParams(route, parts.slice(2).join('/')) };
    }

    // Admin/Master sub-routes: #admin/staff-assignments → route='admin/staff-assignments'
    if (first === 'admin' || first === 'master') {
      const subRoute = rest ? `${first}/${rest.split('/')[0]}` : first;
      // Check if clean sub-route exists in section routes
      const homeSection = _sections['home'];
      if (homeSection && homeSection.routes && homeSection.routes[subRoute]) {
        return { section: 'home', route: subRoute, params: parseRouteParams(subRoute, parts.slice(2).join('/')) };
      }
      // Fallback: old style with tab param
      return { section: 'home', route: first, params: parseRouteParams(first, rest) };
    }
    if (first === 'audit') {
      return { section: 'home', route: first, params: parseRouteParams(first, rest) };
    }

    // Unknown → dashboard
    return { section: 'home', route: 'dashboard', params: {} };
  }

  function parseRouteParams(route, sub) {
    const params = {};
    if (!sub) return params;
    if (route === 'admin' && sub) params.tab = sub;
    if (route === 'master' && sub) params.tab = sub;
    if (route === 'account-detail' && sub) params.account_id = sub;
    // Generic: if sub exists, store as 'id' or 'tab'
    if (!Object.keys(params).length && sub) params.id = sub;
    return params;
  }

  function buildHash(section, route, params = {}) {
    // Root routes stay flat
    if (ROOT_ROUTES[route]) {
      if (route === 'admin') return `#admin/${params.tab || 'accounts'}`;
      if (route === 'master') return `#master/${params.tab || 'modules'}`;
      if (route === 'account-detail' && params.account_id) return `#account-detail/${params.account_id}`;
      return `#${route}`;
    }
    // Section routes
    if (section && section !== 'home') {
      return params.id ? `#${section}/${route}/${params.id}` : `#${section}/${route}`;
    }
    return `#${route}`;
  }

  // ═══ NAVIGATE ═══
  function go(route, params = {}) {
    const parsed = parseHash(`#${route}`);
    let section = parsed.section;
    let resolvedRoute = parsed.route;
    let resolvedParams = { ...parsed.params, ...params };

    // If someone calls go('sales/daily'), parse it properly
    if (route.includes('/')) {
      const pp = parseHash(`#${route}`);
      section = pp.section;
      resolvedRoute = pp.route;
      resolvedParams = { ...pp.params, ...params };
    } else {
      resolvedRoute = route;
      section = ROOT_ROUTES[route] || section;
    }

    // Find the section
    const sec = _sections[section];
    if (!sec) {
      console.warn(`[SPG] Section not found: ${section}`);
      return go('login');
    }

    // Find route config
    const routeConfig = sec.routes?.[resolvedRoute];
    if (!routeConfig) {
      console.warn(`[SPG] Route not found: ${section}/${resolvedRoute}`);
      return go('dashboard');
    }

    // Auth guard
    if (!PUBLIC_ROUTES.includes(resolvedRoute)) {
      if (TEMP_ROUTES.includes(resolvedRoute)) {
        if (!SPG.api.getAccountTemp()) return go('login');
      } else if (!SPG.api.getSession()) {
        return go('login');
      }
    }

    // Permission guard
    if (routeConfig.minPerm && state._bundleLoaded) {
      if (!SPG.perm.has(section, routeConfig.minPerm)) {
        toast('ไม่มีสิทธิ์เข้าถึงหน้านี้', 'error');
        return go('dashboard');
      }
    }

    // Profile incomplete guard — block navigation everywhere except allowed routes
    // Skip for Owner/GM (position_level <= 2) — they don't need employee form
    const PROFILE_EXEMPT = ['login', 'register', 'staff-select', 'store-select', 'new-staff', 'employee-form', 'line-connect', 'pending-approval'];
    const _ses = SPG.api.getSession();
    const _isAdmin = _ses && ((_ses.position_level && _ses.position_level <= 2) || (_ses.tier_id === 'T1' || _ses.tier_id === 'T2'));
    if (state._bundleLoaded && state.profileComplete === false && !_isAdmin && !PROFILE_EXEMPT.includes(resolvedRoute)) {
      // Show blocking popup
      setTimeout(() => {
        showDialog(`<div class="popup-sheet" style="width:360px">
          <div class="popup-header"><div class="popup-title">⚠️ Employee Form Incomplete</div></div>
          <div style="font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.6">
            กรุณากรอกข้อมูลพนักงานให้ครบถ้วนก่อนใช้งาน<br>
            <span style="color:var(--t3);font-size:11px">Please complete your employee details to continue.</span>
          </div>
          <div class="popup-actions">
            <button class="btn btn-primary" onclick="SPG.closeDialog();SPG.go('employee-form')">Go to Employee Form</button>
          </div>
        </div>`);
      }, 300);
    }

    // Update state
    currentSection = section;
    currentRoute = resolvedRoute;
    currentParams = resolvedParams;

    // Apply theme color for this section
    setTheme(section);

    // Render
    const appEl = document.getElementById('app');
    appEl.innerHTML = routeConfig.render(resolvedParams);

    // Build sidebar for shell pages
    if (routeConfig.shell !== false) {
      const sidebarEl = appEl.querySelector('.sidebar');
      if (sidebarEl && (resolvedRoute !== 'dashboard' || state._bundleLoaded)) {
        buildSidebar();
      }
    }

    // Post-render data loading
    if (routeConfig.onLoad) setTimeout(() => routeConfig.onLoad(resolvedParams), 30);

    // Scroll reset
    window.scrollTo(0, 0);
    const ct = appEl.querySelector('.content');
    if (ct) ct.scrollTop = 0;

    // URL hash
    history.replaceState(
      { section, route: resolvedRoute, params: resolvedParams },
      '',
      buildHash(section, resolvedRoute, resolvedParams)
    );
  }

  function updateHash(route, params = {}) {
    currentParams = { ...currentParams, ...params };
    history.replaceState(
      { section: currentSection, route: route || currentRoute, params: currentParams },
      '',
      buildHash(currentSection, route || currentRoute, currentParams)
    );
  }

  // ═══ INIT BUNDLE ═══
  async function loadBundle() {
    if (state._bundleLoaded) {
      // Data in memory → let section handle it
      return state;
    }
    if (state._bundleLoading) return null;
    state._bundleLoading = true;
    try {
      const data = await SPG.api.initBundle();
      state.session = data.session;
      state.modules = data.modules;
      state.homePermission = data.home_permission || 'view_only';
      state.profileComplete = data.profile_complete !== false;
      state.lineConnected = data.line_connected !== false;
      state.unreadNotifications = data.unread_notifications || 0;
      state._bundleLoaded = true;

      // Update notification badge
      const badge = document.getElementById('notif-count');
      if (badge) {
        badge.textContent = state.unreadNotifications > 99 ? '99+' : state.unreadNotifications;
        badge.style.display = state.unreadNotifications > 0 ? 'flex' : 'none';
      }

      // Start notification polling (every 60s)
      if (!state._notifPolling) {
        state._notifPolling = setInterval(async () => {
          try {
            const nd = await SPG.api.getNotifications({ limit: 1 });
            const count = nd.unread_count || 0;
            const b = document.getElementById('notif-count');
            if (b) { b.textContent = count > 99 ? '99+' : count; b.style.display = count > 0 ? 'flex' : 'none'; }
          } catch { /* silent */ }
        }, 60000);
      }

      // Set home permission
      SPG.perm.set('home', state.homePermission);

      return state;
    } catch (e) {
      toast(e.message || 'โหลดข้อมูลไม่สำเร็จ', 'error');
      return null;
    } finally {
      state._bundleLoading = false;
    }
  }

  // ═══ TOAST ═══
  let _toastTimer = null;
  function toast(msg, type = 'info') {
    const el = document.getElementById('toast');
    if (!el) return;
    clearTimeout(_toastTimer);
    el.textContent = msg;
    el.className = `toast ${type}`;
    requestAnimationFrame(() => el.classList.add('show'));
    _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  // ═══ LOADER ═══
  function showLoader() { document.getElementById('loader')?.classList.remove('hidden'); }
  function hideLoader() { document.getElementById('loader')?.classList.add('hidden'); }

  // ═══ DIALOG ═══
  function showDialog(html) {
    document.getElementById('dialog-root').innerHTML =
      `<div class="popup-overlay show" onclick="if(event.target===this)SPG.closeDialog()">${html}</div>`;
  }
  function closeDialog() { document.getElementById('dialog-root').innerHTML = ''; }

  // ═══ ERROR HELPERS ═══
  function showError(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
  }
  function hideError(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('show');
  }

  // ═══ SHARED LAYOUT ═══
  function topbar(sectionLabel) {
    const s = SPG.api.getSession();
    const name = s ? (s.display_name || s.display_label || '') : '';
    const initial = (name || '?').charAt(0).toUpperCase();
    const multiStore = s && s.store_assignments && s.store_assignments.length > 1;
    return `<div class="topbar">
      <div class="hamburger" onclick="SPG.openSidebar()">☰</div>
      <div class="topbar-logo" onclick="SPG.go('dashboard')">SPG HUB</div>
      ${sectionLabel ? `<div class="topbar-section-label">${esc(sectionLabel)}</div>` : ''}
      <div class="topbar-right">
        ${multiStore ? `<div class="topbar-icon" onclick="SPG.showStoreSwitcher()" title="Switch Store" style="font-size:11px;cursor:pointer">⇄ ${esc(s.store_id || '')}</div>` : ''}
        <div class="notif-bell" onclick="SPG.toggleNotifications()" title="Notifications">
          <span class="bell-icon">🔔</span>
          <span class="notif-badge" id="notif-count" style="display:none">0</span>
          <div class="notif-dropdown" id="notif-dropdown" style="display:none" onclick="event.stopPropagation()">
            <div class="notif-dropdown-header" style="padding:12px 14px;border-bottom:1px solid var(--bd2);display:flex;justify-content:space-between;align-items:center">
              <span style="font-weight:700;font-size:13px">Notifications</span>
              <a href="#" style="font-size:11px;color:var(--theme,var(--acc))" onclick="SPG.markAllNotificationsRead();return false">Mark all read</a>
            </div>
            <div class="notif-dropdown-body" id="notif-list">
              <div style="padding:20px;text-align:center;color:var(--t3);font-size:12px">No notifications</div>
            </div>
          </div>
        </div>
        <div class="topbar-icon" onclick="SPG.hardRefresh()" title="Refresh">↻</div>
        <div class="topbar-user" onclick="SPG.showProfilePopup()" style="cursor:pointer">
          <div class="topbar-avatar">${esc(initial)}</div>
          <span class="hide-m">${esc(name)}</span>
        </div>
      </div>
    </div>`;
  }

  function shell(inner, sectionLabel) {
    const toggleIcon = state.sidebarCollapsed ? '›' : '‹';
    return `<div class="shell fade-in">
      ${topbar(sectionLabel)}
      <!-- notif-dropdown moved inside .notif-bell -->
      <div class="shell-body">
        <nav class="sidebar${state.sidebarCollapsed ? ' closed' : ''}"></nav>
        <div class="sd-toggle" onclick="SPG.toggleSidebar()" title="Toggle sidebar">${toggleIcon}</div>
        <div class="shell-main">${inner}</div>
      </div>
    </div>`;
  }

  // ═══ NOTIFICATIONS ═══
  let _notifOpen = false;
  function toggleNotifications() {
    const dd = document.getElementById('notif-dropdown');
    if (!dd) return;
    _notifOpen = !_notifOpen;
    dd.style.display = _notifOpen ? 'block' : 'none';
    if (_notifOpen) loadNotifications();
  }

  async function loadNotifications() {
    try {
      const data = await SPG.api.getNotifications({ limit: 20 });
      const list = document.getElementById('notif-list');
      if (!list) return;
      const items = data.notifications || [];
      if (items.length === 0) {
        list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--t3);font-size:12px">No notifications</div>';
      } else {
        list.innerHTML = items.map(n => SPG.ui.notifItem(n)).join('');
      }
      const unread = items.filter(n => !n.is_read).length;
      const badge = document.getElementById('notif-count');
      if (badge) {
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.style.display = unread > 0 ? 'flex' : 'none';
      }
    } catch { /* notifications not implemented yet — silent fail */ }
  }

  async function markAllNotificationsRead() {
    try {
      await SPG.api.markAllNotificationsRead();
      const badge = document.getElementById('notif-count');
      if (badge) badge.style.display = 'none';
      document.querySelectorAll('.notif-item.notif-unread').forEach(el => el.classList.remove('notif-unread'));
    } catch { /* silent */ }
  }

  function toolbar(title, actions) {
    return `<div class="toolbar"><div class="toolbar-title">${esc(title)}</div>${actions || ''}</div>`;
  }

  // ═══ PROFILE POPUP ═══
  function showProfilePopup() {
    const s = SPG.api.getSession();
    if (!s) return;
    const initial = (s.display_name || s.display_label || '?').charAt(0).toUpperCase();
    const row = (label, val) => `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--bd2)"><span style="color:var(--t3);font-size:12px">${label}</span><span style="font-size:12px;font-weight:600">${esc(val)}</span></div>`;
    const posLabel = s.position_id ? s.position_name : (s.tier_name || s.tier_id || '');
    showDialog(`<div class="popup-sheet" style="width:320px">
      <div class="popup-header"><div class="popup-title">Profile</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div class="topbar-avatar" style="width:40px;height:40px;font-size:16px">${esc(initial)}</div>
        <div><div style="font-size:14px;font-weight:700">${esc(s.display_name || s.display_label)}</div>
        <div style="font-size:11px;color:var(--t3)">${esc(s.display_label || '')}</div></div>
      </div>
      <div style="margin-bottom:14px">
        ${row('Store', s.store_id || 'HQ')}
        ${row('Dept', s.dept_id || '—')}
        ${row('Position', posLabel)}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="btn btn-primary btn-full" onclick="SPG.closeDialog();SPG.go('profile')">View Full Profile</button>
        <button class="btn btn-outline btn-full" style="color:var(--red);border-color:var(--red)" onclick="SPG.closeDialog();SPG.doLogout()">Log out</button>
      </div>
    </div>`);
  }

  // ═══ STORE SWITCHER ═══
  function showStoreSwitcher() {
    const s = SPG.api.getSession();
    if (!s || !s.store_assignments || s.store_assignments.length < 2) return;
    const cards = s.store_assignments.map(a => {
      const active = a.store_id === s.store_id ? ' style="border:2px solid var(--acc);background:var(--acc2)"' : '';
      return `<div class="staff-card"${active} onclick="SPG.doSwitchStore('${esc(a.store_id)}')" style="cursor:pointer;margin-bottom:6px">
        <div class="staff-avatar" style="background:var(--acc2);color:var(--acc);font-size:12px;width:32px;height:32px">${esc((a.store_id || '?').substring(0, 2))}</div>
        <div><div style="font-size:12px;font-weight:600">${esc(a.store_id)}</div>
        <div style="font-size:10px;color:var(--t3)">${esc(a.position_name || '')}${a.dept_id ? ' · ' + esc(a.dept_id) : ''}</div></div>
        ${a.store_id === s.store_id ? '<span style="margin-left:auto;font-size:10px;color:var(--acc)">Current</span>' : ''}
      </div>`;
    }).join('');
    showDialog(`<div class="popup-sheet" style="width:340px">
      <div class="popup-header"><div class="popup-title">Switch Store</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
      <div style="margin-bottom:8px">${cards}</div>
    </div>`);
  }

  async function doSwitchStore(storeId) {
    const s = SPG.api.getSession();
    if (!s || storeId === s.store_id) { closeDialog(); return; }
    closeDialog();
    showLoader();
    try {
      const data = await SPG.api.selectStore(s.token, storeId);
      SPG.api.saveSession(data);
      resetState();
      hideLoader();
      go('dashboard');
    } catch (e) {
      hideLoader();
      toast(e.message || 'Switch failed', 'error');
    }
  }

  // ═══ LOGOUT ═══
  async function doLogout() {
    showLoader();
    try { await SPG.api.logout(); } catch { /* ignore */ }
    SPG.api.clearSession();
    SPG.perm.clear();
    SPG.perm.clearCache();
    resetState();
    hideLoader();
    go('login');
    toast('Signed out', 'info');
  }

  // ═══ HARD REFRESH ═══
  function hardRefresh() {
    resetState();
    location.reload();
  }

  function resetState() {
    state.session = null;
    state.modules = null;
    state.profile = null;
    state.homePermission = null;
    state._bundleLoaded = false;
    state._bundleLoading = false;
    state._profileLoaded = false;
  }

  // ═══ SIDEBAR — Desktop (Clean Text, Accordion) ═══
  let _sidebarBuilt = false;

  function buildSidebar() {
    const s = SPG.api.getSession();
    if (!s) return;

    const sd = document.querySelector('.sidebar');
    if (!sd) return;

    let html = '';

    // ── Home items (text only, no icons) ──
    html += sdItem('dashboard', 'Home');
    html += sdItem('profile', 'Profile');

    html += '<div class="sd-divider"></div>';
    html += '<div class="sd-section">Sections</div>';

    // ── Sections ──
    const sectionDefs = [
      { id: 'sales',      label: 'Sales Daily' },
      { id: 'purchase',   label: 'Purchase' },
      { id: 'bakery',     label: 'Bakery' },
      { id: 'finance',    label: 'Finance' },
      { id: 'hr',         label: 'HR' },
      { id: 'operations', label: 'Operations' },
      { id: 'foodhub',    label: 'Food Hub' },
      { id: 'marketing',  label: 'Marketing' },
      { id: 'equipment',  label: 'Equipment' },
      { id: 'bi',         label: 'BI Dashboard' },
      { id: 'crm',        label: 'CRM' },
    ];

    const moduleToSection = {
      'bakery_order': 'bakery', 'saledaily_report': 'sales', 'finance': 'finance',
      'purchase': 'purchase', 'hr': 'hr', 'operations': 'operations',
      'foodhub': 'foodhub', 'marketing': 'marketing',
      'equipment': 'equipment', 'bi': 'bi', 'crm': 'crm',
    };

    if (state.modules) {
      sectionDefs.forEach(def => {
        const mod = state.modules.find(m => moduleToSection[m.module_id] === def.id);
        if (mod && !mod.is_accessible) return;
        const isActive = mod && mod.status === 'active' && _sections[def.id];
        if (isActive) {
          const route = def.id + '/' + (_sections[def.id]?.defaultRoute || 'home');
          const active = currentSection === def.id ? ' active' : '';
          html += `<div class="sd-item${active}" onclick="SPG.go('${route}')">${def.label}</div>`;
        } else if (mod) {
          html += `<div class="sd-item" style="opacity:.35;cursor:default">${def.label}</div>`;
        }
      });
    }

    // ── Admin (accordion, not flyout) ──
    if (SPG.perm.hasHome('admin')) {
      html += '<div class="sd-divider"></div>';
      html += '<div class="sd-section">Admin</div>';
      html += sdAccordion('admin', 'Function Access',
        sdSubItem('admin/accounts', null, 'Accounts') +
        sdSubItem('admin/base-permissions', null, 'Base Permissions') +
        sdSubItem('admin/dept-overrides', null, 'Dept Overrides') +
        sdSubItem('admin/staff-assignments', null, 'Staff Assignments') +
        sdSubItem('admin/requests', null, 'Requests', 'req-badge') +
        sdSubItem('admin/store-requests', null, 'Store Requests')
      );
      html += sdAccordion('master', 'Master Data',
        sdSubItem('master/modules', null, 'Modules') +
        sdSubItem('master/stores', null, 'Stores') +
        sdSubItem('master/depts', null, 'Departments')
      );
      html += sdAccordion('announce', 'Announcements',
        sdSubItem('admin/announcements', null, 'All Announcements') +
        sdSubItem('admin/create-announcement', null, 'Create New')
      );
      html += sdAccordion('settings', 'Settings',
        sdSubItem('settings', 'general', 'General') +
        sdSubItem('settings', 'notifications', 'Notifications')
      );
    }
    if (SPG.perm.hasHome('edit')) {
      html += sdAccordion('reports', 'Reports',
        sdSubItem('audit', null, 'Audit Trail')
      );
    }

    // ── Footer ──
    html += `<div class="sd-footer">
      <div class="sd-version">v${VERSION}</div>
      <a href="#" class="danger" onclick="SPG.doLogout();return false">Log out</a>
    </div>`;

    sd.innerHTML = html;
    // Preserve closed state
    if (state.sidebarCollapsed) {
      sd.className = 'sidebar closed';
    } else {
      sd.className = 'sidebar';
    }
    _sidebarBuilt = true;

    // Auto-open accordion for current route
    autoExpandAccordion();

    buildMobileSidebar(s);
    setupAccordion();
  }

  function sdItem(route, label) {
    const active = currentRoute === route ? ' active' : '';
    return `<div class="sd-item${active}" onclick="SPG.go('${route}')">${label}</div>`;
  }

  function sdAccordion(id, label, items) {
    const routes = id === 'admin' ? ['admin'] : id === 'master' ? ['master'] : id === 'reports' ? ['audit'] : [];
    const isActive = routes.includes(currentRoute);
    const open = isActive ? ' open' : '';
    return `<div class="sd-group${open}" data-group="${id}">
      <div class="sd-group-head${isActive ? ' active' : ''}">${label}<span class="sd-group-arr">›</span></div>
      <div class="sd-sub">${items}</div>
    </div>`;
  }

  function sdSubItem(route, tab, label, badgeId) {
    const active = currentRoute === route && (!tab || currentParams.tab === tab) ? ' active' : '';
    const onclick = tab ? `SPG.go('${route}',{tab:'${tab}'})` : `SPG.go('${route}')`;
    const badge = badgeId ? `<span id="${badgeId}" style="display:none;background:#ef4444;color:#fff;font-size:10px;font-weight:700;border-radius:50%;min-width:18px;height:18px;line-height:18px;text-align:center;padding:0 4px;margin-left:6px"></span>` : '';
    return `<div class="sd-sub-item${active}" onclick="${onclick}" style="display:flex;align-items:center;justify-content:space-between">${label}${badge}</div>`;
  }

  // ═══ ACCORDION ═══
  function setupAccordion() {
    document.querySelectorAll('.sd-group').forEach(sg => {
      const head = sg.querySelector('.sd-group-head');
      if (!head) return;
      head.addEventListener('click', (e) => {
        e.stopPropagation();
        sg.classList.toggle('open');
      });
    });
  }

  function autoExpandAccordion() {
    // Auto-expand the accordion group that contains the current route
    document.querySelectorAll('.sd-group').forEach(sg => {
      if (sg.querySelector('.sd-sub-item.active')) {
        sg.classList.add('open');
      }
    });
  }

  function toggleSidebar() {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    const sd = document.querySelector('.sidebar');
    const toggle = document.querySelector('.sd-toggle');
    if (sd) sd.classList.toggle('closed', state.sidebarCollapsed);
    if (toggle) toggle.textContent = state.sidebarCollapsed ? '›' : '‹';
  }

  // ═══ MOBILE SIDEBAR (text-only, matching desktop) ═══
  function buildMobileSidebar(s) {
    const panel = document.getElementById('sidebar-panel');
    if (!panel) return;

    let html = `<div class="mob-sidebar-header">
      <div class="topbar-avatar">${esc((s.display_name || s.display_label || '?').charAt(0).toUpperCase())}</div>
      <div><div style="font-size:12px;font-weight:600">${esc(s.display_name || s.display_label)}</div>
      <div style="font-size:9px;color:var(--t3)">${esc(s.position_id ? s.position_name : s.tier_id)} · ${esc(s.store_id || 'HQ')}</div></div>
    </div>`;

    html += mobItem('dashboard', 'Home');
    html += mobItem('profile', 'Profile');

    // Sections
    html += '<div class="mob-sidebar-section">Sections</div>';
    const mobSectionDefs = [
      { id: 'sales',      label: 'Sales Daily' },
      { id: 'purchase',   label: 'Purchase' },
      { id: 'bakery',     label: 'Bakery Order' },
      { id: 'operations', label: 'Operations' },
      { id: 'finance',    label: 'Finance' },
      { id: 'hr',         label: 'HR' },
      { id: 'foodhub',    label: 'Food Hub' },
      { id: 'marketing',  label: 'Marketing' },
      { id: 'equipment',  label: 'Equipment' },
      { id: 'bi',         label: 'BI Dashboard' },
      { id: 'crm',        label: 'CRM' },
    ];

    const moduleToSection = {
      'bakery_order': 'bakery', 'saledaily_report': 'sales', 'finance': 'finance',
      'purchase': 'purchase', 'hr': 'hr', 'operations': 'operations',
      'foodhub': 'foodhub', 'marketing': 'marketing',
      'equipment': 'equipment', 'bi': 'bi', 'crm': 'crm',
    };

    if (state.modules) {
      mobSectionDefs.forEach(def => {
        const mod = state.modules.find(m => moduleToSection[m.module_id] === def.id);
        if (mod && !mod.is_accessible) return;
        const isActive = mod && mod.status === 'active' && _sections[def.id];
        if (isActive) {
          const route = def.id + '/' + (_sections[def.id]?.defaultRoute || 'home');
          html += `<div class="mob-sd-item" onclick="SPG.closeSidebar();SPG.go('${route}')">${def.label}</div>`;
        } else {
          html += `<div class="mob-sd-item disabled">${def.label} <span style="font-size:7px;padding:1px 4px;border-radius:3px;background:var(--orange-bg);color:var(--orange)">Soon</span></div>`;
        }
      });
    }

    // Admin
    if (SPG.perm.hasHome('admin')) {
      html += '<div style="height:8px"></div><div class="mob-sidebar-section">Admin</div>';
      html += mobNav('admin', 'accounts', 'Accounts');
      html += mobNav('admin', 'base-permissions', 'Base Permissions');
      html += mobNav('admin', 'dept-overrides', 'Dept Overrides');
      html += mobNav('admin', 'staff-assignments', 'Staff Assignments');
      html += mobNav('admin', 'requests', 'Requests');
      html += mobNav('admin', 'store-requests', 'Store Requests');
      html += '<div style="height:8px"></div><div class="mob-sidebar-section">Master Data</div>';
      html += mobNav('master', 'modules', 'Modules');
      html += mobNav('master', 'stores', 'Stores');
      html += mobNav('master', 'depts', 'Departments');
    }
    if (SPG.perm.hasHome('edit')) {
      html += '<div style="height:8px"></div>';
      html += mobItem('audit', 'Audit Trail');
    }

    html += `<div class="mob-sd-footer"><a href="#" style="font-size:10px;color:var(--red);text-decoration:none" onclick="SPG.doLogout();return false">Log out</a></div>`;
    panel.innerHTML = html;
  }

  function mobItem(route, label) {
    const active = currentRoute === route ? ' active' : '';
    return `<div class="mob-sd-item${active}" onclick="SPG.closeSidebar();SPG.go('${route}')">${label}</div>`;
  }

  function mobNav(route, tab, label) {
    return `<div class="mob-sd-item" onclick="SPG.closeSidebar();SPG.go('${route}',{tab:'${tab}'})">${label}</div>`;
  }

  function openSidebar() {
    if (!_sidebarBuilt) buildSidebar();
    document.getElementById('sidebar-overlay')?.classList.add('open');
    document.getElementById('sidebar-panel')?.classList.add('open');
  }
  function closeSidebar() {
    document.getElementById('sidebar-overlay')?.classList.remove('open');
    document.getElementById('sidebar-panel')?.classList.remove('open');
  }

  // ═══ LAZY LOAD SECTION SCRIPT ═══
  function loadSectionScript(name) {
    if (_loadedScripts[name]) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `sections/${name}.js`;
      script.onload = () => { _loadedScripts[name] = true; resolve(); };
      script.onerror = () => reject(new Error(`Failed to load section: ${name}`));
      document.head.appendChild(script);
    });
  }

  // ═══ INIT ═══
  function init() {
    window.scrollTo(0, 0);

    // #logout — cross-module logout link
    if (location.hash === '#logout') {
      SPG.api.clearSession();
      SPG.perm.clear();
      _sidebarBuilt = false;
      history.replaceState(null, '', '#login');
      go('login');
      return;
    }

    // Token from URL param (cross-module navigation)
    const urlParams = new URLSearchParams(location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      SPG.api.setToken(urlToken);
      history.replaceState(null, '', location.pathname + location.hash);
    }

    // LINE callback: ?line_code=xxx → handle automatically
    const lineCode = urlParams.get('line_code');
    if (lineCode) {
      history.replaceState(null, '', location.pathname + '#employee-form');
      setTimeout(() => {
        if (typeof EmpForm !== 'undefined') EmpForm.handleLineCallback(lineCode);
      }, 1000);
    }

    const session = SPG.api.getSession();
    const { section, route, params } = parseHash(location.hash);

    if (route && _sections[section]?.routes?.[route]) {
      if (PUBLIC_ROUTES.includes(route) || session) {
        go(route, params);
      } else {
        go('login');
      }
    } else {
      go(session ? 'dashboard' : 'login');
    }

    // Browser back/forward
    window.addEventListener('popstate', (e) => {
      if (e.state?.route) {
        go(e.state.route, e.state.params || {});
      } else {
        const parsed = parseHash(location.hash);
        if (parsed.route) go(parsed.route, parsed.params);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  // ═══ PUBLIC API ═══
  Object.assign(SPG, {
    // State
    state,
    VERSION,

    // Navigation
    go, updateHash, parseHash,

    // Section registration
    section: registerSection,
    loadSectionScript,

    // Layout
    topbar, shell, toolbar,

    // Utilities
    esc, toast, showLoader, hideLoader,
    showDialog, closeDialog,
    showError, hideError,

    // Auth actions
    doLogout, doSwitchStore,
    showProfilePopup, showStoreSwitcher,
    hardRefresh, loadBundle,

    // Theme
    setTheme,

    // Notifications
    toggleNotifications, loadNotifications, markAllNotificationsRead,

    // Sidebar
    buildSidebar, openSidebar, closeSidebar, toggleSidebar,

    // Getters
    get currentSection() { return currentSection; },
    get currentRoute() { return currentRoute; },
    get currentParams() { return currentParams; },
  });
})();
