/**
 * SPG HUB v2.0.0 | 21 MAR 2026 | Siam Palette Group
 * sections/home_announcements.js — Admin Announcements
 * Create + send broadcast notifications (In-App + LINE)
 */
(() => {
const esc = SPG.esc;
const api = SPG.api;

let _announcements = [];

// ═══ LIST ═══
function renderList() {
  const ct = document.getElementById('admin-content');
  if (!ct) return;
  ct.innerHTML = SPG.ui.skeleton(200);
  loadList();
}

async function loadList() {
  const ct = document.getElementById('admin-content');
  if (!ct) return;
  try {
    const data = await api.adminGetAnnouncements({});
    _announcements = data.announcements || [];
    if (_announcements.length === 0) {
      ct.innerHTML = SPG.ui.empty('📢', 'No announcements yet', 'Create your first announcement');
      return;
    }
    ct.innerHTML = `<div class="card-list">${_announcements.map(a => `
      <div class="card" style="margin-bottom:8px;padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:14px;font-weight:700">${esc(a.title)}</div>
            <div style="font-size:12px;color:var(--t3);margin-top:4px">${esc(a.body || '').substring(0, 100)}${(a.body || '').length > 100 ? '...' : ''}</div>
          </div>
          <div style="display:flex;gap:4px;align-items:center;flex-shrink:0">
            ${a.send_line ? '<span style="font-size:9px;padding:2px 6px;border-radius:4px;background:#06C755;color:#fff">LINE</span>' : ''}
            ${SPG.ui.badge(a.status)}
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:var(--t3)">
          <span>Target: ${esc(a.target_type === 'all' ? 'All Staff' : a.target_type + ': ' + (a.target_ids || []).join(', '))}</span>
          <span>${a.created_at ? new Date(a.created_at).toLocaleString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
        </div>
        <div style="margin-top:8px;text-align:right">
          <button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red);font-size:10px" onclick="Announce.confirmDelete('${esc(a.announcement_id)}')">Delete</button>
        </div>
      </div>
    `).join('')}</div>`;
  } catch (e) {
    ct.innerHTML = `<div style="color:var(--red);font-size:13px">${esc(e.message || 'Failed to load')}</div>`;
  }
}

// ═══ CREATE ═══
function renderCreate() {
  const ct = document.getElementById('admin-content');
  if (!ct) return;
  ct.innerHTML = `
    <div class="card max-w-md">
      <div style="font-size:16px;font-weight:700;margin-bottom:14px">New Announcement</div>
      <div class="fg"><label class="lb">Title *</label><input class="inp" id="ann-title" placeholder="Announcement title"></div>
      <div class="fg"><label class="lb">Message</label><textarea class="inp" id="ann-body" rows="4" placeholder="Announcement content" style="width:100%;box-sizing:border-box"></textarea></div>
      <div class="fg"><label class="lb">Target</label>
        <select class="inp" id="ann-target" onchange="Announce.targetChanged()">
          <option value="all">All Staff</option>
          <option value="store">Specific Store(s)</option>
          <option value="dept">Specific Store → Department(s)</option>
        </select>
      </div>
      <div class="fg" id="ann-store-wrap" style="display:none">
        <label class="lb">Select Store(s)</label>
        <div id="ann-store-ids"></div>
      </div>
      <div class="fg" id="ann-dept-wrap" style="display:none">
        <label class="lb">Select Department(s)</label>
        <div id="ann-dept-ids"></div>
      </div>
      <div class="fg" style="margin-top:8px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
          <input type="checkbox" id="ann-line"> Also send via LINE push
        </label>
      </div>
      <div class="error-msg" id="ann-error"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
        <button class="btn btn-outline btn-sm" onclick="SPG.go('admin',{tab:'announcements'})">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="Announce.send()">Send Announcement</button>
      </div>
    </div>`;
  loadTargetOptions();
}

async function loadTargetOptions() {
  try {
    const [stores, depts] = await Promise.all([SPG.perm.getStoresCache(), SPG.perm.getDeptsCache()]);
    window._annStores = stores;
    window._annDepts = depts;
  } catch { /* ignore */ }
}

function targetChanged() {
  const type = document.getElementById('ann-target')?.value;
  const storeWrap = document.getElementById('ann-store-wrap');
  const deptWrap = document.getElementById('ann-dept-wrap');
  const storeCt = document.getElementById('ann-store-ids');
  const deptCt = document.getElementById('ann-dept-ids');
  if (!storeWrap || !deptWrap) return;

  // Reset
  storeWrap.style.display = 'none';
  deptWrap.style.display = 'none';

  if (type === 'all') return;

  // Show store checkboxes for both 'store' and 'dept'
  const stores = (window._annStores || []).filter(s => s.store_id !== 'ALL');
  if (storeCt) {
    storeCt.innerHTML = stores.map(s =>
      `<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;cursor:pointer">
        <input type="checkbox" value="${esc(s.store_id)}" class="ann-store-cb" onchange="Announce.storeFilterChanged()"> ${esc(s.store_name || s.store_id)}
      </label>`
    ).join('');
  }
  storeWrap.style.display = 'block';

  // If dept mode, clear dept list (will populate when store is selected)
  if (type === 'dept' && deptCt) {
    deptCt.innerHTML = '<div style="font-size:11px;color:var(--t3);padding:4px 0">Select store(s) first</div>';
  }
}

function storeFilterChanged() {
  const type = document.getElementById('ann-target')?.value;
  if (type !== 'dept') return; // Only show dept checkboxes in dept mode

  const deptWrap = document.getElementById('ann-dept-wrap');
  const deptCt = document.getElementById('ann-dept-ids');
  if (!deptWrap || !deptCt) return;

  const selectedStores = Array.from(document.querySelectorAll('.ann-store-cb:checked')).map(cb => cb.value);
  if (selectedStores.length === 0) {
    deptWrap.style.display = 'none';
    return;
  }

  // Show dept checkboxes
  deptWrap.style.display = 'block';
  const depts = (window._annDepts || []).filter(d => d.dept_id !== 'ALL');
  deptCt.innerHTML = depts.map(d =>
    `<label style="display:flex;align-items:center;gap:6px;padding:4px 0;font-size:12px;cursor:pointer">
      <input type="checkbox" value="${esc(d.dept_id)}" class="ann-target-cb"> ${esc(d.dept_name || d.dept_id)}
    </label>`
  ).join('');
}

async function send() {
  const title = document.getElementById('ann-title')?.value.trim();
  const body = document.getElementById('ann-body')?.value.trim();
  const target_type = document.getElementById('ann-target')?.value || 'all';
  const send_line = document.getElementById('ann-line')?.checked || false;
  if (!title) { SPG.showError('ann-error', 'Title is required'); return; }

  let target_ids = [];
  let target_store_ids = [];
  if (target_type === 'store') {
    target_ids = Array.from(document.querySelectorAll('.ann-store-cb:checked')).map(cb => cb.value);
    if (target_ids.length === 0) { SPG.showError('ann-error', 'Please select at least one store'); return; }
  } else if (target_type === 'dept') {
    target_store_ids = Array.from(document.querySelectorAll('.ann-store-cb:checked')).map(cb => cb.value);
    target_ids = Array.from(document.querySelectorAll('.ann-target-cb:checked')).map(cb => cb.value);
    if (target_store_ids.length === 0) { SPG.showError('ann-error', 'Please select store(s) first'); return; }
    if (target_ids.length === 0) { SPG.showError('ann-error', 'Please select at least one department'); return; }
  }

  // Confirmation
  const lineNote = send_line ? ' + LINE push' : '';
  const targetNote = target_type === 'all' ? 'all staff' : target_type === 'dept' ? `${target_ids.length} dept(s) in ${target_store_ids.length} store(s)` : `${target_ids.length} store(s)`;
  SPG.showDialog(`<div class="popup-sheet" style="width:340px">
    <div class="popup-header"><div class="popup-title">Confirm Send</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div style="font-size:13px;margin-bottom:14px">
      <strong>${esc(title)}</strong><br>
      <span style="color:var(--t3)">Send to ${targetNote}${lineNote}</span>
    </div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" onclick="SPG.closeDialog();Announce.doSend()">Send Now</button>
    </div>
  </div>`);

  // Store for doSend
  window._annPending = { title, body, target_type, target_ids, target_store_ids, send_line };
}

async function doSend() {
  const d = window._annPending;
  if (!d) return;
  SPG.showLoader();
  try {
    const result = await api.adminCreateAnnouncement(d);
    SPG.hideLoader();
    SPG.toast(`Announcement sent to ${result.sent_to || 0} users`, 'success');
    SPG.go('admin', { tab: 'announcements' });
  } catch (e) {
    SPG.hideLoader();
    SPG.toast(e.message || 'Send failed', 'error');
  }
}

function confirmDelete(id) {
  SPG.showDialog(`<div class="popup-sheet" style="width:300px">
    <div class="popup-header"><div class="popup-title">Delete Announcement</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div style="font-size:13px;color:var(--t2);margin-bottom:14px">Are you sure? This cannot be undone.</div>
    <div class="popup-actions">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">Cancel</button>
      <button class="btn btn-primary" style="background:var(--red);border-color:var(--red)" onclick="SPG.closeDialog();Announce.doDelete('${esc(id)}')">Delete</button>
    </div>
  </div>`);
}

async function doDelete(id) {
  SPG.showLoader();
  try {
    await api.adminDeleteAnnouncement(id);
    SPG.hideLoader();
    SPG.toast('Deleted', 'info');
    renderList();
  } catch (e) { SPG.hideLoader(); SPG.toast(e.message, 'error'); }
}

window.Announce = {
  renderList, renderCreate, loadList,
  targetChanged, storeFilterChanged, send, doSend,
  confirmDelete, doDelete,
};
})();
