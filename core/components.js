/**
 * SPG HUB v1.0.0 | 20 MAR 2026 | Siam Palette Group
 * core/components.js — Shared UI Components
 * One Design Language — every section uses the same components
 *
 * Usage: SPG.ui.table(...), SPG.ui.badge(...), etc.
 */

SPG.ui = (() => {
  const esc = (str) => {
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  // ═══ STATUS BADGE ═══
  // Unified status styling across ALL sections
  const STATUS_MAP = {
    // Approval workflow
    'draft':      { cls: 'sts-neutral', label: 'Draft' },
    'pending':    { cls: 'sts-warn',    label: 'Pending' },
    'submitted':  { cls: 'sts-info',    label: 'Submitted' },
    'in_review':  { cls: 'sts-warn',    label: 'In Review' },
    'approved':   { cls: 'sts-ok',      label: 'Approved' },
    'rejected':   { cls: 'sts-err',     label: 'Rejected' },
    'done':       { cls: 'sts-ok',      label: 'Done' },
    'cancelled':  { cls: 'sts-neutral', label: 'Cancelled' },
    // Operation
    'open':       { cls: 'sts-warn',    label: 'Open' },
    'in_progress': { cls: 'sts-info',   label: 'In Progress' },
    'closed':     { cls: 'sts-ok',      label: 'Closed' },
    // Delivery
    'ordered':    { cls: 'sts-info',    label: 'Ordered' },
    'shipped':    { cls: 'sts-warn',    label: 'Shipped' },
    'delivered':  { cls: 'sts-ok',      label: 'Delivered' },
    'received':   { cls: 'sts-ok',      label: 'Received' },
    // General
    'active':     { cls: 'sts-ok',      label: 'Active' },
    'inactive':   { cls: 'sts-neutral', label: 'Inactive' },
    'pass':       { cls: 'sts-ok',      label: 'Pass' },
    'fail':       { cls: 'sts-err',     label: 'Fail' },
  };

  function badge(status, customLabel) {
    const st = STATUS_MAP[status?.toLowerCase()] || { cls: 'sts-neutral', label: status || '-' };
    return `<span class="sts ${st.cls}">${esc(customLabel || st.label)}</span>`;
  }

  // ═══ TABLE with SORT ═══
  let _sortState = {}; // { tableId: { key, dir } }

  function sortData(arr, key, dir = 'asc') {
    return [...arr].sort((a, b) => {
      let va = a[key], vb = b[key];
      if (va == null) va = '';
      if (vb == null) vb = '';
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function sortTh(tableId, key, label, extra = '') {
    const st = _sortState[tableId];
    const isActive = st && st.key === key;
    const upColor = isActive && st.dir === 'asc' ? 'var(--acc)' : '#ccc';
    const downColor = isActive && st.dir === 'desc' ? 'var(--acc)' : '#ccc';
    const arrows = `<span style="display:inline-flex;flex-direction:column;line-height:1;margin-left:4px;font-size:8px;vertical-align:middle"><span style="color:${upColor}">▲</span><span style="color:${downColor}">▼</span></span>`;
    return `<th${extra} style="cursor:pointer;user-select:none;white-space:nowrap" onclick="SPG.ui.toggleSort('${tableId}','${key}')">${esc(label)}${arrows}</th>`;
  }

  function toggleSort(tableId, key) {
    const st = _sortState[tableId];
    if (st && st.key === key) {
      st.dir = st.dir === 'asc' ? 'desc' : 'asc';
    } else {
      _sortState[tableId] = { key, dir: 'asc' };
    }
    document.dispatchEvent(new CustomEvent('spg-sort', { detail: { tableId } }));
  }

  function getSortState(tableId) { return _sortState[tableId] || null; }

  // ═══ EMPTY STATE ═══
  function empty(icon, text, sub) {
    return `<div class="empty-state">
      ${icon ? `<div class="empty-icon">${icon}</div>` : ''}
      <div class="empty-text">${esc(text)}</div>
      ${sub ? `<div class="empty-sub">${esc(sub)}</div>` : ''}
    </div>`;
  }

  // ═══ FILTER BAR ═══
  function filterBar(filters) {
    // filters = [{ id, label, type: 'select'|'text'|'date', options: [], value, onChange }]
    return `<div class="fl-bar">${filters.map(f => {
      if (f.type === 'select') {
        const opts = (f.options || []).map(o =>
          `<option value="${esc(o.value)}"${o.value === f.value ? ' selected' : ''}>${esc(o.label)}</option>`
        ).join('');
        return `<div><div class="fl-label">${esc(f.label)}</div><select class="fl" id="${esc(f.id)}" onchange="${f.onChange || ''}">${opts}</select></div>`;
      }
      if (f.type === 'date') {
        return `<div><div class="fl-label">${esc(f.label)}</div><input class="fl" type="date" id="${esc(f.id)}" value="${esc(f.value || '')}" onchange="${f.onChange || ''}"></div>`;
      }
      // text
      return `<div><div class="fl-label">${esc(f.label)}</div><input class="fl" type="text" id="${esc(f.id)}" value="${esc(f.value || '')}" placeholder="${esc(f.placeholder || '')}" oninput="${f.onChange || ''}"></div>`;
    }).join('')}</div>`;
  }

  // ═══ CARD HELPER ═══
  function card(content, className) {
    return `<div class="card${className ? ' ' + className : ''}">${content}</div>`;
  }

  // ═══ SKELETON ═══
  function skeleton(height, count = 1) {
    return Array.from({ length: count }, () =>
      `<div class="skeleton" style="height:${height}px;margin-bottom:8px"></div>`
    ).join('');
  }

  // ═══ SECTION CARD (for dashboard) ═══
  function sectionCard(cfg) {
    // cfg = { id, name, desc, icon, bg, color, abbr, status, onClick }
    const display = cfg.abbr || cfg.icon || '??';
    if (cfg.status !== 'active') {
      return `<div class="sec-card disabled">
        <div class="sec-icon" style="background:${cfg.bg};color:${cfg.color}">${display}</div>
        <div><div class="sec-name">${esc(cfg.name)}</div><div class="sec-desc">${esc(cfg.desc)} · Coming soon</div></div>
        <span class="sts sts-warn" style="font-size:9px;margin-left:auto">Soon</span>
      </div>`;
    }
    return `<div class="sec-card" onclick="${cfg.onClick || ''}">
      <div class="sec-icon" style="background:${cfg.bg};color:${cfg.color}">${display}</div>
      <div><div class="sec-name">${esc(cfg.name)}</div><div class="sec-desc">${esc(cfg.desc)}</div></div>
      <div class="sec-arr">\u203A</div>
    </div>`;
  }

  // ═══ NOTIFICATION ITEM ═══
  // Notification data store (avoid XSS via onclick JSON)
  const _notifData = {};

  function notifItem(n) {
    const unreadCls = n.is_read ? '' : ' notif-unread';
    const time = n.created_at ? new Date(n.created_at).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const nid = n.notification_id || n.id || '';
    // Store data safely — no JSON in onclick
    _notifData[nid] = { title: n.title || '', body: n.body || '', type: n.type || '', time, sender: n.sender_name || 'System', nid };
    const markBtn = !n.is_read ? `<span style="font-size:9px;color:var(--acc);cursor:pointer;flex-shrink:0" onclick="event.stopPropagation();SPG.markNotificationRead('${esc(nid)}',this)">Mark read</span>` : '';
    return `<div class="notif-item${unreadCls}" data-nid="${esc(nid)}" onclick="SPG.showNotifDetail('${esc(nid)}')">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:8px">
        <div class="notif-title">${esc(n.title || '')}</div>
        ${markBtn}
      </div>
      <div class="notif-body">${esc(n.body || '').substring(0, 80)}${(n.body || '').length > 80 ? '...' : ''}</div>
      <div class="notif-time">${esc(time)}</div>
    </div>`;
  }

  function getNotifData(nid) { return _notifData[nid] || null; }

  return {
    esc,
    badge, STATUS_MAP,
    sortData, sortTh, toggleSort, getSortState,
    empty, filterBar, card, skeleton, sectionCard, notifItem, getNotifData,
  };
})();
