/**
 * SPG HUB v1.0.0 | 20 MAR 2026 | Siam Palette Group
 * core/api.js — Unified API Client
 * One API layer for all sections — token, session, fetch
 */

window.SPG = window.SPG || {};

SPG.api = (() => {
  // ═══ ENDPOINTS (each section registers its own) ═══
  const ENDPOINTS = {
    home: 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/home',
    bakery: 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/bakeryorder',
    finance: 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/finance',
    sales: 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/saledaily-report',
    purchase: 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/purchase',
    hr: 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/hr',
    operations: 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/operations',
    foodhub: 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/foodhub',
    marketing: 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/marketing',
    equipment: 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/equipment',
    bi: 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/bi',
    crm: 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/crm',
  };

  // Register additional endpoints from sections
  function registerEndpoint(name, url) { ENDPOINTS[name] = url; }

  // ═══ STORAGE KEYS ═══
  const TOKEN_KEY = 'spg_token';
  const SESSION_KEY = 'spg_session';
  const ACCOUNT_KEY = 'spg_account';

  // ═══ GENERIC FETCH ═══
  async function post(endpoint, action, data = {}) {
    const url = ENDPOINTS[endpoint];
    if (!url) throw new Error(`Unknown endpoint: ${endpoint}`);
    const resp = await fetch(`${url}?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await resp.json();
    if (!json.success) {
      const e = new Error(json.error?.message || 'Unknown error');
      e.code = json.error?.code;
      e.key = json.error?.key;
      throw e;
    }
    return json.data;
  }

  // Shorthand for home endpoint
  function homePost(action, data = {}) { return post('home', action, data); }

  // ═══ TOKEN / SESSION ═══
  let _sesCache = null;

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(token) { if (token) localStorage.setItem(TOKEN_KEY, token); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

  function saveSession(data) {
    const s = {
      token: data.session_id,
      account_id: data.account_id,
      account_type: data.account_type,
      display_label: data.display_label,
      tier_id: data.tier_id,
      tier_name: data.tier_name,
      store_id: data.store_id,
      dept_id: data.dept_id,
      user_id: data.user_id || '',
      display_name: data.display_name || '',
      full_name: data.full_name || '',
      expires_at: data.expires_at,
      position_id: data.position_id || '',
      position_name: data.position_name || '',
      position_level: data.position_level || 99,
      store_assignments: data.store_assignments || [],
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    setToken(data.session_id);
    _sesCache = s;
    return s;
  }

  function getSession() {
    if (_sesCache) return _sesCache;
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        clearSession();
        return null;
      }
      _sesCache = data;
      return data;
    } catch { return null; }
  }

  function clearSession() {
    _sesCache = null;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
    clearToken();
  }

  function saveAccountTemp(data) { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(data)); }
  function getAccountTemp() { try { return JSON.parse(localStorage.getItem(ACCOUNT_KEY)); } catch { return null; } }

  // Token bundle helper
  function tb(extra = {}) { return { token: getToken(), ...extra }; }

  // ═══ HOME API ═══
  return {
    // Core
    post,
    registerEndpoint,
    getToken, setToken, clearToken,
    saveSession, getSession, clearSession,
    saveAccountTemp, getAccountTemp,
    tb,

    // Auth
    login: (username, password) => homePost('login', { username, password }),
    selectStore: (temp_token, store_id) => homePost('select_store', { temp_token, store_id }),
    register: (data) => homePost('register', data),
    getUsers: (account_id) => homePost('get_users', { account_id }),
    switchUser: (account_id, user_id, pin) => homePost('switch_user', { account_id, user_id, pin }),
    setUserPin: (account_id, user_id, new_pin) => homePost('set_user_pin', { account_id, user_id, new_pin }),
    createUser: (data) => homePost('create_user', data),
    logout: () => homePost('logout', tb()),

    // Bundle + Profile
    initBundle: () => homePost('init_bundle', tb()),
    getProfile: () => homePost('get_profile', tb()),
    updateProfile: (data) => homePost('update_profile', tb(data)),
    changePassword: (data) => homePost('change_password', tb(data)),
    changePin: (data) => homePost('change_pin', tb(data)),

    // Public
    getStores: () => homePost('get_stores', {}),
    getDepartments: () => homePost('get_departments', {}),

    // Store Requests
    requestStore: (data) => homePost('request_store', tb(data)),

    // Admin (used by settings section)
    adminGetAccounts: (f = {}) => homePost('admin_get_accounts', tb(f)),
    adminCreateAccount: (data) => homePost('admin_create_account', tb(data)),
    adminUpdateAccount: (data) => homePost('admin_update_account', tb(data)),
    adminGetPermissions: () => homePost('admin_get_permissions', tb()),
    adminUpdatePermission: (module_id, tier_id, access_level) => homePost('admin_update_permission', tb({ module_id, tier_id, access_level })),
    adminGetRegistrations: (f = {}) => homePost('admin_get_registrations', tb(f)),
    adminReviewRegistration: (data) => homePost('admin_review_registration', tb(data)),
    adminGetModuleAccess: () => homePost('admin_get_module_access', tb()),
    adminSetModuleAccess: (account_id, module_id, module_tier) => homePost('admin_set_module_access', tb({ account_id, module_id, module_tier })),
    adminRemoveModuleAccess: (account_id, module_id) => homePost('admin_remove_module_access', tb({ account_id, module_id })),
    adminGetUsers: (account_id) => homePost('admin_get_users', tb({ account_id })),
    adminUpdateUser: (data) => homePost('admin_update_user', tb(data)),
    adminGetAuditLog: (f = {}) => homePost('admin_get_audit_log', tb(f)),
    adminGetAllModules: () => homePost('admin_get_all_modules', tb()),
    adminUpdateModule: (data) => homePost('admin_update_module', tb(data)),
    adminGetAllStores: () => homePost('admin_get_all_stores', tb()),
    adminCreateStore: (data) => homePost('admin_create_store', tb(data)),
    adminUpdateStore: (data) => homePost('admin_update_store', tb(data)),
    adminGetAllDepts: () => homePost('admin_get_all_depts', tb()),
    adminCreateDept: (data) => homePost('admin_create_dept', tb(data)),
    adminUpdateDept: (data) => homePost('admin_update_dept', tb(data)),
    adminGetPositions: () => homePost('admin_get_positions', tb()),
    adminGetBasePermissions: () => homePost('admin_get_base_permissions', tb()),
    adminUpdateBasePermission: (position_id, module_id, access_level) => homePost('admin_update_base_permission', tb({ position_id, module_id, access_level })),
    adminGetDeptOverrides: (f = {}) => homePost('admin_get_dept_overrides', tb(f)),
    adminUpdateDeptOverride: (data) => homePost('admin_update_dept_override', tb(data)),
    adminGetStoreAssignments: (f = {}) => homePost('admin_get_store_assignments', tb(f)),
    adminSetStoreAssignment: (data) => homePost('admin_set_store_assignment', tb(data)),
    adminRemoveStoreAssignment: (data) => homePost('admin_remove_store_assignment', tb(data)),
    adminGetStoreRequests: (f = {}) => homePost('admin_get_store_requests', tb(f)),
    adminReviewStoreRequest: (data) => homePost('admin_review_store_request', tb(data)),

    // Notifications
    getNotifications: (f = {}) => homePost('get_notifications', tb(f)),
    markNotificationRead: (notification_id) => homePost('mark_notification_read', tb({ notification_id })),
    markAllNotificationsRead: () => homePost('mark_all_notifications_read', tb()),

    // Employee Detail (extended profile)
    getEmployeeDetail: () => homePost('get_employee_detail', tb()),
    saveEmployeeDetail: (data) => homePost('save_employee_detail', tb(data)),

    // Register v2 (Phase 2)
    checkEmail: (email) => homePost('check_email', { email }),
    sendOtp: (email) => homePost('send_otp', { email }),
    verifyOtp: (email, code) => homePost('verify_otp', { email, code }),
    registerV2: (data) => homePost('register_v2', data),
    submitForApproval: (data = {}) => homePost('submit_for_approval', tb(data)),
    getRegistrationStatus: () => homePost('get_registration_status', tb()),

    // LINE Connect
    lineConnect: (data) => homePost('line_connect', tb(data)),
    lineDisconnect: () => homePost('line_disconnect', tb()),
    getLineStatus: () => homePost('get_line_status', tb()),

    // Announcements (Admin)
    adminGetAnnouncements: (f = {}) => homePost('admin_get_announcements', tb(f)),
    adminCreateAnnouncement: (data) => homePost('admin_create_announcement', tb(data)),
    adminDeleteAnnouncement: (id) => homePost('admin_delete_announcement', tb({ announcement_id: id })),

    // Settings (Admin)
    adminGetSettings: () => homePost('admin_get_settings', tb()),
    adminUpdateSetting: (key, value) => homePost('admin_update_setting', tb({ setting_key: key, setting_value: value })),
  };
})();
