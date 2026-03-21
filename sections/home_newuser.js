/**
 * SPG HUB v2.0.0 | 21 MAR 2026 | Siam Palette Group
 * sections/home_newuser.js — New User Flow
 * Pending Approval page + post-login routing (force employee form / LINE)
 */
(() => {
const esc = SPG.esc;
const api = SPG.api;

// ═══ PENDING APPROVAL ═══
function renderPendingApproval() {
  return `<div class="shell-login fade-in">
    <div style="padding:40px 20px;text-align:center;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center">
      <div style="font-size:48px;margin-bottom:16px">⏳</div>
      <div style="font-size:20px;font-weight:700;margin-bottom:8px">Waiting for Approval</div>
      <div style="color:var(--t3);font-size:13px;margin-bottom:8px;max-width:320px;line-height:1.6">
        Your account is being reviewed by an administrator. You'll be notified once approved.
      </div>
      <div id="pending-status" style="margin-top:16px"></div>
      <div style="margin-top:24px;display:flex;flex-direction:column;gap:8px;width:100%;max-width:280px">
        <button class="btn btn-outline btn-full" onclick="NewUser.checkStatus()">Check Status</button>
        <button class="btn btn-outline btn-full" style="color:var(--t3);border-color:var(--bd2)" onclick="SPG.doLogout()">Sign Out</button>
      </div>
    </div>
  </div>`;
}

async function checkStatus() {
  SPG.showLoader();
  try {
    const data = await api.getRegistrationStatus();
    SPG.hideLoader();
    const el = document.getElementById('pending-status');
    if (!el) return;
    if (data.account_status === 'approved') {
      el.innerHTML = '<div style="padding:12px;background:var(--green-bg);color:var(--green);border-radius:var(--rd);font-size:13px;font-weight:600">✅ Approved! Redirecting...</div>';
      setTimeout(() => SPG.go('dashboard'), 1500);
    } else if (data.account_status === 'incomplete') {
      el.innerHTML = '<div style="padding:12px;background:var(--orange-bg);color:var(--orange);border-radius:var(--rd);font-size:13px">⚠️ Please complete your Employee Form first</div>';
      setTimeout(() => SPG.go('employee-form'), 1500);
    } else {
      el.innerHTML = '<div style="padding:12px;background:var(--bg3);border-radius:var(--rd);font-size:12px;color:var(--t3)">Status: ' + esc(data.account_status) + ' — Still waiting for admin review</div>';
    }
  } catch (e) {
    SPG.hideLoader();
    SPG.toast(e.message || 'Failed to check status', 'error');
  }
}

// ═══ POST-LOGIN CHECK ═══
// Called after successful login to determine where to route
async function postLoginCheck(loginData) {
  // 1. Account status = incomplete → go to employee form
  if (loginData.account_status === 'incomplete') {
    api.saveSession(loginData);
    SPG.go('employee-form');
    return true;
  }

  // 2. After saving session + loading bundle, check profile + LINE
  // This happens in dashboard loadBundle, but we check here for immediate redirect
  return false; // let normal flow continue
}

// Called from dashboard after bundle loaded
function checkBundleStatus(bundleState) {
  if (!bundleState) return;

  // Check profile_complete
  if (bundleState.profileComplete === false) {
    SPG.go('employee-form');
    return true;
  }

  // Check line_connected (only if line_enabled in settings)
  if (bundleState.lineConnected === false && bundleState.lineRequired) {
    SPG.go('line-connect');
    return true;
  }

  return false; // all good, stay on dashboard
}

window.NewUser = {
  renderPendingApproval, checkStatus,
  postLoginCheck, checkBundleStatus,
};
})();
