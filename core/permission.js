/**
 * SPG HUB v2.0.0 | 22 MAR 2026 | Siam Palette Group
 * core/permission.js — One Permission Engine
 * Single source of truth for all permission checks across all sections
 *
 * Permission levels: no_access(0) < view_only(1) < edit(2) < admin(3) < super_admin(4)
 * Resolution: position → dept override → account override
 * Fallback: tier_id if no position assigned
 *
 * v2.0: Added canDo() for function-level permission checks
 *       setFunctions() to store allowed function keys from init_bundle
 *       getUserRole() to derive role from position_level
 */

SPG.perm = (() => {
  const LEVELS = {
    'no_access': 0,
    'view_only': 1,
    'edit': 2,
    'admin': 3,
    'super_admin': 4,
  };

  // Stored per-section permissions (populated from init_bundle)
  const _perms = {}; // { section_id: 'admin' | 'edit' | ... }

  // Set permission for a section
  function set(sectionId, level) { _perms[sectionId] = level; }

  // Get raw permission level for a section
  function get(sectionId) { return _perms[sectionId] || null; }

  // Check: does user have at least `minLevel` for a section?
  function has(sectionId, minLevel) {
    const userLevel = _perms[sectionId];
    if (userLevel) {
      return (LEVELS[userLevel] || 0) >= (LEVELS[minLevel] || 0);
    }
    // Fallback: derive from session position_level or tier
    return _fallback(minLevel);
  }

  // Fallback when section permission not loaded yet
  function _fallback(minLevel) {
    const s = SPG.api.getSession();
    if (!s) return false;
    const pl = s.position_id
      ? (s.position_level || 99)
      : parseInt((s.tier_id || 'T9').replace('T', ''));
    const derived = pl === 1 ? 'super_admin'
      : pl === 2 ? 'admin'
      : pl <= 4 ? 'edit'
      : 'view_only';
    return (LEVELS[derived] || 0) >= (LEVELS[minLevel] || 0);
  }

  // Convenience: check home permission
  function hasHome(minLevel) { return has('home', minLevel); }

  // Clear all (on logout)
  function clear() {
    for (const k in _perms) delete _perms[k];
    _functions = {};
  }

  // ═══ FUNCTION-LEVEL PERMISSIONS (canDo) ═══
  // Stores allowed function keys per module: { 'home': ['fn_key1','fn_key2'], 'bc_order': [...] }
  let _functions = {};

  /**
   * Store allowed function keys from init_bundle or module init
   * @param {string} moduleId - e.g., 'home', 'bc_order', 'sd'
   * @param {string[]} allowedKeys - array of function keys user can access
   */
  function setFunctions(moduleId, allowedKeys) {
    _functions[moduleId] = new Set(allowedKeys || []);
  }

  /**
   * Check if current user can execute a specific function
   * Used for UI show/hide and frontend guards
   * Backend always does its own check — this is for UX only
   *
   * @param {string} functionKey - e.g., 'fn_create_order', 'fn_manage_config'
   * @param {string} [moduleId] - module to check in (default: current section or 'home')
   * @returns {boolean}
   */
  function canDo(functionKey, moduleId) {
    // super_admin bypasses everything
    const s = SPG.api.getSession();
    if (!s) return false;
    const pl = s.position_id ? (s.position_level || 99) : parseInt((s.tier_id || 'T9').replace('T', ''));
    if (pl === 1) return true; // Owner/CEO = super_admin

    // Determine which module to check
    const mod = moduleId || SPG.state?.currentSection || 'home';

    // If we have function permissions loaded for this module, check the set
    const fnSet = _functions[mod];
    if (fnSet) return fnSet.has(functionKey);

    // Fallback: if no function permissions loaded, allow based on access level
    // (write functions need at least 'edit', read functions need 'view_only')
    const isWrite = functionKey.includes('create') || functionKey.includes('edit')
      || functionKey.includes('delete') || functionKey.includes('manage')
      || functionKey.includes('update') || functionKey.includes('save');
    return has(mod, isWrite ? 'edit' : 'view_only');
  }

  /**
   * Get user's derived role based on position_level
   * @returns {string} 'super_admin' | 'admin' | 'manager' | 'staff' | 'viewer'
   */
  function getUserRole() {
    const s = SPG.api.getSession();
    if (!s) return 'viewer';
    const pl = s.position_id ? (s.position_level || 99) : parseInt((s.tier_id || 'T9').replace('T', ''));
    if (pl === 1) return 'super_admin';
    if (pl === 2) return 'admin';
    if (pl === 3) return 'manager';
    if (pl <= 5) return 'staff';
    return 'viewer';
  }

  /**
   * Get all allowed function keys for a module
   * @param {string} moduleId
   * @returns {string[]}
   */
  function getFunctions(moduleId) {
    const fnSet = _functions[moduleId];
    return fnSet ? [...fnSet] : [];
  }

  // ═══ STORES / DEPTS CACHE (shared across all sections) ═══
  let _stores = null, _storesLoaded = false;
  let _depts = null, _deptsLoaded = false;

  async function getStoresCache() {
    if (_storesLoaded && _stores) return _stores;
    const data = await SPG.api.getStores();
    _stores = data.stores || [];
    _storesLoaded = true;
    return _stores;
  }

  async function getDeptsCache() {
    if (_deptsLoaded && _depts) return _depts;
    const data = await SPG.api.getDepartments();
    _depts = data.departments || [];
    _deptsLoaded = true;
    return _depts;
  }

  function clearCache() {
    _stores = null; _storesLoaded = false;
    _depts = null; _deptsLoaded = false;
  }

  // Get numeric level value for a section (useful for comparisons)
  function getLevel(sectionId) {
    const userLevel = _perms[sectionId];
    if (userLevel) return LEVELS[userLevel] || 0;
    // Fallback: derive from session
    const s = SPG.api.getSession();
    if (!s) return 0;
    const pl = s.position_id
      ? (s.position_level || 99)
      : parseInt((s.tier_id || 'T9').replace('T', ''));
    if (pl === 1) return LEVELS['super_admin'];
    if (pl === 2) return LEVELS['admin'];
    if (pl <= 4) return LEVELS['edit'];
    return LEVELS['view_only'];
  }

  return {
    LEVELS,
    set, get, has, hasHome, getLevel, clear,
    getStoresCache, getDeptsCache, clearCache,
    // v2.0: Function-level permissions
    canDo, setFunctions, getFunctions, getUserRole,
  };
})();
