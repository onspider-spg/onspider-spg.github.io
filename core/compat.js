/**
 * SPG HUB v1.0.0 | 20 MAR 2026 | Siam Palette Group
 * core/compat.js — Compatibility Layer
 * Maps old App/API globals to new SPG.* namespace
 * This allows existing admin/master scripts to work without modification
 * Will be removed once all code is migrated to SPG.* directly
 */

window.App = {
  // Utilities
  esc: (...a) => SPG.esc(...a),
  toast: (...a) => SPG.toast(...a),
  showLoader: () => SPG.showLoader(),
  hideLoader: () => SPG.hideLoader(),
  showDialog: (h) => SPG.showDialog(h),
  closeDialog: () => SPG.closeDialog(),
  showError: (id, msg) => SPG.showError(id, msg),
  hideError: (id) => SPG.hideError(id),

  // Navigation
  go: (...a) => SPG.go(...a),
  updateHash: (...a) => SPG.updateHash(...a),

  // Permission
  hasHomePerm: (level) => SPG.perm.hasHome(level),
  S: SPG.state,

  // Sort (now in SPG.ui)
  getSortState: (id) => SPG.ui.getSortState(id),
  sortData: (...a) => SPG.ui.sortData(...a),
  sortTh: (...a) => SPG.ui.sortTh(...a),
  toggleSort: (...a) => SPG.ui.toggleSort(...a),

  // Stores/Depts cache (now in SPG.perm)
  getStoresCache: () => SPG.perm.getStoresCache(),
  getDeptsCache: () => SPG.perm.getDeptsCache(),
  clearStoresCache: () => SPG.perm.clearCache(),
  clearDeptsCache: () => {},

  // Layout
  shell: (...a) => SPG.shell(...a),
  topbar: (...a) => SPG.topbar(...a),
  toolbar: (...a) => SPG.toolbar(...a),
  buildSidebar: () => SPG.buildSidebar(),
  loadBundle: () => SPG.loadBundle(),
  hardRefresh: () => SPG.hardRefresh(),
};

window.API = SPG.api;
