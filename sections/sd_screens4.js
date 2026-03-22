/**
 * SPG HUB v1.0.0 | 22 MAR 2026 | Siam Palette Group
 * sections/sd_screens4.js — Admin Screens
 * Account Review | Report Dashboard | Channels | Vendors | Config | User Access | Audit
 *
 * Depends on: sd_core.js (SD global)
 */

(() => {
const S = SD.S;
const esc = SD.esc;
const fm = SD.fmtMoney;
const fms = SD.fmtMoneyShort;
const ui = SPG.ui;
const _busy = {};
const SECTION = 'Sales Daily';

function backBtn() { return `<button class="toolbar-back" onclick="SPG.go('sales/dashboard')">←</button>`; }

// Brand filter pills (shared by AccReview + ReportDash)
function brandPills(selected, onSelect) {
  const brands = [...new Set((S.stores || []).map(s => s.brand).filter(Boolean))].sort();
  if (!brands.length) return '';
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
    <button class="store-pill${!selected ? ' active' : ''}" onclick="${onSelect}('')">ทั้งหมด</button>
    ${brands.map(b => `<button class="store-pill${selected === b ? ' active' : ''}" onclick="${onSelect}('${esc(b)}')">${esc(b)}</button>`).join('')}
  </div>`;
}

function monthLabel(m) { const p = m.split('-'); const ms = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return ms[parseInt(p[1])] + ' ' + p[0]; }


// ═══════════════════════════════════════
// ACCOUNT REVIEW
// ═══════════════════════════════════════
let ar = { days: [], stores: [], kpis: {}, month: '', brand: '' };

function renderAccReview(p) {
  ar.month = ar.month || SD.todayStr().substring(0, 7);
  return SPG.shell(`<div class="toolbar">${backBtn()}<div class="toolbar-title">Account Review</div></div>
  <div class="content" id="ar-content">
    <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:4px 0 10px;font-size:13px;font-weight:600">
      <button class="dbar-btn" onclick="SDSection.arMonthNav(-1)">‹</button>
      <span id="ar-month-label">📅 ${monthLabel(ar.month)}</span>
      <button class="dbar-btn" onclick="SDSection.arMonthNav(1)">›</button>
    </div>
    <div id="ar-brand-pills">${brandPills(ar.brand, 'SDSection.arBrandFilter')}</div>
    <div class="alert alert-info">📋 Editable = ยังแก้ได้ · 🔒 Synced = ส่งไป Finance แล้ว</div>
    <div id="ar-kpi" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px">${ui.skeleton(72, 4)}</div>
    <div id="ar-table">${ui.skeleton(200)}</div>
  </div>`, SECTION);
}

async function loadAccReview(p) {
  await SD.initModule(); if (!S.initLoaded) return; SD.buildSDSidebar();
  if (_busy.ar) return; _busy.ar = true;
  try { const data = await SD.api('get_acc_review', { month: ar.month }); ar.days = data.days || []; ar.stores = data.stores || []; ar.kpis = data.kpis || {}; fillAccReview(); }
  catch { SPG.toast('โหลดไม่สำเร็จ', 'error'); } finally { _busy.ar = false; }
}

function arMonthNav(delta) {
  const p = ar.month.split('-'); const d = new Date(parseInt(p[0]), parseInt(p[1]) - 1 + delta, 1);
  ar.month = d.toISOString().substring(0, 7); document.getElementById('ar-month-label').textContent = '📅 ' + monthLabel(ar.month); loadAccReview();
}

function arBrandFilter(brand) { ar.brand = brand; document.getElementById('ar-brand-pills').innerHTML = brandPills(ar.brand, 'SDSection.arBrandFilter'); fillAccReview(); }

function fillAccReview() {
  const isT1 = SD.getTierLevel() <= 1;
  const days = ar.brand ? ar.days.filter(d => d.brand === ar.brand) : ar.days;
  const totalSale = days.reduce((s, d) => s + (d.total_sales || 0), 0);
  const totalExp = days.reduce((s, d) => s + (d.total_expense || 0), 0);
  const synced = days.filter(d => d.sync_status === 'synced').length;

  document.getElementById('ar-kpi').innerHTML = `
    <div class="kpi-box"><div class="kpi-label">💰 Sales</div><div class="kpi-val" style="color:var(--theme)">${fms(totalSale)}</div></div>
    <div class="kpi-box"><div class="kpi-label">🧾 Expense</div><div class="kpi-val" style="color:var(--red)">${fms(totalExp)}</div></div>
    <div class="kpi-box"><div class="kpi-label">🔒 Synced</div><div class="kpi-val" style="color:var(--green)">${synced}</div></div>
    <div class="kpi-box"><div class="kpi-label">✏️ Pending</div><div class="kpi-val" style="color:var(--orange)">${days.length - synced}</div></div>`;

  const el = document.getElementById('ar-table'); if (!el) return;
  if (!days.length) { el.innerHTML = ui.empty('', 'ยังไม่มีข้อมูลเดือนนี้'); return; }
  const byDate = {}; days.forEach(d => { if (!byDate[d.sale_date]) byDate[d.sale_date] = []; byDate[d.sale_date].push(d); });
  const dates = Object.keys(byDate).sort().reverse();

  el.innerHTML = `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Date</th><th>Store</th><th>Sales</th><th>Expense</th><th>Status</th><th></th></tr></thead>
  <tbody>${dates.map(date => byDate[date].map(d => {
    const isSynced = d.sync_status === 'synced';
    let actionCol;
    if (isSynced) { actionCol = `<span style="font-size:9px;color:var(--t4)">${d.sync_method || ''}</span>${isT1 ? ` <button class="btn btn-outline btn-sm" style="font-size:9px;color:var(--orange);border-color:var(--orange)" onclick="SDSection.arUnlock('${d.store_id}','${d.sale_date}')">🔓</button>` : ''}`; }
    else { actionCol = `<button class="btn btn-primary btn-sm" style="font-size:9px" onclick="SDSection.arSync('${d.store_id}','${d.sale_date}')">🔒 Sync</button>`; }
    return `<tr${isSynced ? ' style="opacity:.7"' : ''}><td style="font-size:10px;font-weight:600;white-space:nowrap">${SD.fmtDateShort(d.sale_date)}</td><td style="font-size:10px">${esc(d.store_name || d.store_id)}</td><td style="font-size:10px">${fm(d.total_sales)}</td><td style="font-size:10px">${fm(d.total_expense)}</td><td>${isSynced ? ui.badge('approved') : ui.badge('pending')}</td><td>${actionCol}</td></tr>`;
  }).join('')).join('')}</tbody></table></div>`;
}

async function arSync(storeId, date) {
  SPG.showDialog(`<div class="popup-sheet" style="width:300px;text-align:center"><div style="font-size:15px;font-weight:700;margin-bottom:8px">🔒 Sync ${esc(storeId)} ${date}?</div><div style="font-size:12px;color:var(--t3);margin-bottom:14px">ข้อมูลจะถูกส่งไป Finance</div><div style="display:flex;gap:8px;justify-content:center"><button class="btn btn-outline" onclick="SPG.closeDialog()">ยกเลิก</button><button class="btn btn-primary" id="ar-sync-btn" onclick="SDSection.arConfirmSync('${storeId}','${date}')">🔒 Sync</button></div></div>`);
}

async function arConfirmSync(storeId, date) {
  const btn = document.getElementById('ar-sync-btn'); if (btn) btn.disabled = true;
  try { await SD.api('sync_day', { store_id: storeId, sync_date: date }); SPG.closeDialog(); SPG.toast('Sync สำเร็จ', 'success'); const d = ar.days.find(x => x.store_id === storeId && x.sale_date === date); if (d) { d.sync_status = 'synced'; d.sync_method = 'manual'; } fillAccReview(); }
  catch (err) { SPG.toast(err.message || 'Sync ไม่สำเร็จ', 'error'); } finally { if (btn) btn.disabled = false; }
}

async function arUnlock(storeId, date) {
  SPG.showDialog(`<div class="popup-sheet" style="width:300px;text-align:center"><div style="font-size:15px;font-weight:700;margin-bottom:8px">🔓 Unlock ${esc(storeId)} ${SD.fmtDateShort(date)}?</div><div style="font-size:12px;color:var(--t2);margin-bottom:14px">⚠️ T1 Only — ข้อมูลจะกลับเป็น Editable</div><div style="display:flex;gap:8px;justify-content:center"><button class="btn btn-outline" onclick="SPG.closeDialog()">ยกเลิก</button><button class="btn btn-outline" id="ar-unlock-btn" style="color:var(--orange);border-color:var(--orange)" onclick="SDSection.arConfirmUnlock('${storeId}','${date}')">🔓 Unlock</button></div></div>`);
}

async function arConfirmUnlock(storeId, date) {
  const btn = document.getElementById('ar-unlock-btn'); if (btn) btn.disabled = true;
  try { await SD.api('unlock_day', { store_id: storeId, sync_date: date }); SPG.closeDialog(); SPG.toast('Unlock สำเร็จ', 'success'); const d = ar.days.find(x => x.store_id === storeId && x.sale_date === date); if (d) { d.sync_status = 'editable'; d.sync_method = null; } fillAccReview(); }
  catch (err) { SPG.toast(err.message || 'Unlock ไม่ได้', 'error'); } finally { if (btn) btn.disabled = false; }
}


// ═══════════════════════════════════════
// CHANNELS — Matrix
// ═══════════════════════════════════════
let ch = { masters: [], stores: [], visibility: {} };

function renderChannels(p) {
  return SPG.shell(`<div class="toolbar">${backBtn()}<div class="toolbar-title">Channels</div></div>
  <div class="content" id="ch-content">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div class="sl" style="margin:0" id="ch-count">📡 Channel Matrix</div><button class="btn btn-primary btn-sm" onclick="SDSection.chAdd()">+ Add Channel</button></div>
    <div style="font-size:10px;color:var(--t3);margin-bottom:8px">✓ = ร้านเห็น channel นี้ · กดเพื่อ toggle</div>
    <div id="ch-table">${ui.skeleton(200)}</div>
  </div>`, SECTION);
}

async function loadChannels(p) {
  await SD.initModule(); if (!S.initLoaded) return; SD.buildSDSidebar();
  if (_busy.ch) return; _busy.ch = true;
  try { const data = await SD.api('admin_get_channel_matrix'); ch.masters = data.masters || []; ch.stores = data.stores || []; ch.visibility = data.visibility || {}; fillChannels(); }
  catch { SPG.toast('โหลดไม่สำเร็จ', 'error'); } finally { _busy.ch = false; }
}

function fillChannels() {
  document.getElementById('ch-count').textContent = `📡 Channel Matrix (${ch.masters.length} × ${ch.stores.length})`;
  const el = document.getElementById('ch-table'); if (!el) return;
  if (!ch.masters.length) { el.innerHTML = ui.empty('', 'ยังไม่มี Channel'); return; }
  el.innerHTML = `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th style="min-width:100px">Channel</th><th>Group</th>${ch.stores.map(s => `<th style="text-align:center;font-size:10px;min-width:40px">${esc(s.store_id)}</th>`).join('')}</tr></thead>
  <tbody>${ch.masters.map(m => {
    const vis = ch.visibility[m.channel_key] || {};
    return `<tr><td><div style="font-size:11px;font-weight:600">${esc(m.channel_label)}</div><div style="font-size:9px;color:var(--t4)">${esc(m.channel_key)}</div></td><td>${ui.badge(m.dashboard_group)}</td>
    ${ch.stores.map(s => { const cell = vis[s.store_id]; const on = cell?.is_enabled !== false; const hasRow = !!cell;
      return `<td style="text-align:center"><div style="width:36px;height:20px;border-radius:10px;background:${on && hasRow ? 'var(--theme)' : 'var(--bd)'};position:relative;cursor:pointer;margin:0 auto" onclick="SDSection.chToggle('${m.channel_key}','${s.store_id}',${!(on && hasRow)})"><div style="position:absolute;top:2px;left:${on && hasRow ? '18px' : '2px'};width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s"></div></div></td>`;
    }).join('')}</tr>`;
  }).join('')}</tbody></table></div>`;
}

async function chToggle(channelKey, storeId, newState) {
  if (!ch.visibility[channelKey]) ch.visibility[channelKey] = {};
  const prev = ch.visibility[channelKey][storeId];
  ch.visibility[channelKey][storeId] = { id: prev?.id || 'new', is_enabled: newState }; fillChannels();
  try { await SD.api('admin_toggle_channel', { channel_key: channelKey, store_id: storeId, is_enabled: newState }); }
  catch { ch.visibility[channelKey][storeId] = prev || undefined; fillChannels(); SPG.toast('อัพเดทไม่สำเร็จ', 'error'); }
}

function chAdd() {
  SPG.showDialog(`<div class="popup-sheet" style="width:360px"><div class="popup-header"><div class="popup-title">+ Add Channel</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="fl">Channel Label <span style="color:var(--red)">*</span></label><input class="fi" id="ch-label" placeholder="เช่น Card Eftpos 3"></div>
    <div class="fg"><label class="fl">Channel Key <span style="color:var(--red)">*</span></label><input class="fi" id="ch-key" placeholder="เช่น eftpos3"></div>
    <div class="fg"><label class="fl">Dashboard Group</label><select class="fi" id="ch-group"><option value="card_sale">card_sale</option><option value="cash_sale">cash_sale</option><option value="delivery_sale">delivery_sale</option><option value="other">other</option></select></div>
    <div class="fg"><label class="fl">Finance Sub Category</label><input class="fi" id="ch-fincat" placeholder="Revenue → ..."></div>
    <button class="btn btn-primary btn-full" id="ch-save" onclick="SDSection.chSaveNew()">💾 Save</button>
  </div>`);
}

async function chSaveNew() {
  const label = document.getElementById('ch-label')?.value?.trim(); const key = document.getElementById('ch-key')?.value?.trim();
  if (!label || !key) return SPG.toast('กรุณากรอก Label + Key', 'error');
  const btn = document.getElementById('ch-save'); if (btn) btn.disabled = true;
  try { const data = await SD.api('admin_create_channel', { store_id: SD.getStore(), channel_label: label, channel_key: key, dashboard_group: document.getElementById('ch-group')?.value || 'other', finance_sub_category: document.getElementById('ch-fincat')?.value || key }); ch.masters.push(data); SPG.closeDialog(); fillChannels(); SPG.toast('สร้าง Channel สำเร็จ', 'success'); }
  catch (err) { SPG.toast(err.message || 'สร้างไม่สำเร็จ', 'error'); } finally { if (btn) btn.disabled = false; }
}


// ═══════════════════════════════════════
// VENDORS
// ═══════════════════════════════════════
let vn = { list: [], search: '' };

function renderVendors(p) {
  return SPG.shell(`<div class="toolbar">${backBtn()}<div class="toolbar-title">Vendors</div></div>
  <div class="content" id="vn-content">
    ${SD.renderStoreSelector()}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><div class="sl" style="margin:0" id="vn-count">🏪 Vendors</div><button class="btn btn-primary btn-sm" onclick="SDSection.vnAdminAdd()">+ Add Vendor</button></div>
    <input class="fi" style="margin-bottom:8px" placeholder="🔍 Search vendors..." oninput="SDSection.vnSearch(this.value)">
    <div id="vn-table">${ui.skeleton(200)}</div>
  </div>`, SECTION);
}

async function loadVendors(p) {
  await SD.initModule(); if (!S.initLoaded) return; SD.buildSDSidebar();
  if (_busy.vn) return; _busy.vn = true;
  try { const data = await SD.api('admin_get_suppliers'); vn.list = (data.vendors || []).map(v => ({ id: v.id, name: v.vendor_name, is_active: v.is_active })); fillVendors(); }
  catch { SPG.toast('โหลดไม่สำเร็จ', 'error'); } finally { _busy.vn = false; }
}

function fillVendors() {
  const list = vn.search ? vn.list.filter(m => m.name.toLowerCase().includes(vn.search.toLowerCase())) : vn.list;
  document.getElementById('vn-count').textContent = `🏪 Vendors (${list.length})`;
  const el = document.getElementById('vn-table'); if (!el) return;
  if (!list.length) { el.innerHTML = ui.empty('', 'ยังไม่มี Vendor'); return; }
  el.innerHTML = `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Name</th><th style="width:60px">Active</th></tr></thead>
  <tbody>${list.map(v => `<tr${!v.is_active ? ' style="opacity:.5"' : ''}><td style="font-size:12px;font-weight:600">${esc(v.name)}</td>
    <td style="text-align:center"><div style="width:36px;height:20px;border-radius:10px;background:${v.is_active ? 'var(--theme)' : 'var(--bd)'};position:relative;cursor:pointer;margin:0 auto" onclick="SDSection.vnToggle('${v.id}',${!v.is_active})"><div style="position:absolute;top:2px;left:${v.is_active ? '18px' : '2px'};width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s"></div></div></td>
  </tr>`).join('')}</tbody></table></div>`;
}

function vnSearch(val) { vn.search = val; fillVendors(); }

async function vnToggle(vendorId, newState) {
  const v = vn.list.find(x => x.id === vendorId); if (!v) return;
  const prev = v.is_active; v.is_active = newState; fillVendors();
  try { await SD.api('admin_update_supplier', { vendor_id: vendorId, is_active: newState }); if (newState) { if (!S.vendors.find(x => x.id === vendorId)) { S.vendors.push({ id: vendorId, name: v.name }); S.vendors.sort((a, b) => a.name.localeCompare(b.name)); } } else { S.vendors = S.vendors.filter(x => x.id !== vendorId); } }
  catch { v.is_active = prev; fillVendors(); SPG.toast('อัพเดทไม่สำเร็จ', 'error'); }
}

function vnAdminAdd() {
  SPG.showDialog(`<div class="popup-sheet" style="width:320px"><div class="popup-header"><div class="popup-title">+ Add Vendor</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="fl">Vendor Name <span style="color:var(--red)">*</span></label><input class="fi" id="vn-admin-name"></div>
    <button class="btn btn-primary btn-full" id="vn-admin-save" onclick="SDSection.vnAdminSaveNew()">💾 Save</button>
  </div>`);
}

async function vnAdminSaveNew() {
  const name = document.getElementById('vn-admin-name')?.value?.trim(); if (!name) return SPG.toast('กรุณาใส่ชื่อ Vendor', 'error');
  const btn = document.getElementById('vn-admin-save'); if (btn) btn.disabled = true;
  try { const data = await SD.api('create_vendor', { vendor_name: name }); S.vendors.push({ id: data.id, name: data.vendor_name || name }); S.vendors.sort((a, b) => a.name.localeCompare(b.name)); SPG.closeDialog(); SPG.toast(`สร้าง "${name}" สำเร็จ`, 'success'); loadVendors(); }
  catch (err) { SPG.toast(err.message || 'สร้างไม่สำเร็จ', 'error'); } finally { if (btn) btn.disabled = false; }
}


// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════
let cfg = {};

function renderConfig(p) {
  return SPG.shell(`<div class="toolbar">${backBtn()}<div class="toolbar-title">Config</div></div>
  <div class="content" id="cfg-content">
    <div class="sl" style="margin-top:0">⚙️ Global Config</div>
    <div style="font-size:10px;color:var(--t3);margin-bottom:10px">ตั้งค่ากลาง — ใช้ร่วมกันทุกร้าน</div>
    <div id="cfg-form">${ui.skeleton(200)}</div>
  </div>`, SECTION);
}

async function loadConfig(p) {
  await SD.initModule(); if (!S.initLoaded) return; SD.buildSDSidebar();
  if (_busy.cfg) return; _busy.cfg = true;
  try { const data = await SD.api('admin_get_settings'); cfg = data.settings || {}; fillConfig(); }
  catch { SPG.toast('โหลดไม่สำเร็จ', 'error'); } finally { _busy.cfg = false; }
}

function fillConfig() {
  const el = document.getElementById('cfg-form'); if (!el) return;
  el.innerHTML = `<div class="card">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">💰 Cash & Edit Window</div>
    <div class="fg"><label class="fl">Cash Tolerance ($)</label><input class="fi" type="number" step="0.01" id="cfg-tol" value="${cfg.cash_mismatch_tolerance || 2}" style="width:100px"></div>
    <div class="fg"><label class="fl">Edit Window (days)</label><input class="fi" type="number" id="cfg-days" value="${cfg.backdate_limit_days || 3}" style="width:100px"></div>
    <div class="fg"><label class="fl">Require Photos</label><div style="width:36px;height:20px;border-radius:10px;background:${cfg.require_photos !== false ? 'var(--theme)' : 'var(--bd)'};position:relative;cursor:pointer" id="cfg-photos" onclick="this.dataset.on=this.dataset.on==='1'?'0':'1';this.style.background=this.dataset.on==='1'?'var(--theme)':'var(--bd)';this.firstElementChild.style.left=this.dataset.on==='1'?'18px':'2px'" data-on="${cfg.require_photos !== false ? '1' : '0'}"><div style="position:absolute;top:2px;left:${cfg.require_photos !== false ? '18px' : '2px'};width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s"></div></div></div>
    <div class="fg"><label class="fl">Auto-sync after window</label><div style="width:36px;height:20px;border-radius:10px;background:${cfg.auto_sync_after_window !== false ? 'var(--theme)' : 'var(--bd)'};position:relative;cursor:pointer" id="cfg-autosync" onclick="this.dataset.on=this.dataset.on==='1'?'0':'1';this.style.background=this.dataset.on==='1'?'var(--theme)':'var(--bd)';this.firstElementChild.style.left=this.dataset.on==='1'?'18px':'2px'" data-on="${cfg.auto_sync_after_window !== false ? '1' : '0'}"><div style="position:absolute;top:2px;left:${cfg.auto_sync_after_window !== false ? '18px' : '2px'};width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s"></div></div></div>
  </div>
  <div class="card" style="margin-top:10px">
    <div style="font-size:12px;font-weight:700;margin-bottom:10px">🚨 Anomaly Detection</div>
    <div class="fg"><label class="fl">Cash Variance Threshold ($)</label><input class="fi" type="number" step="0.01" id="cfg-anomaly-cash" value="${cfg.anomaly_cash_threshold || 5}" style="width:100px"></div>
    <div class="fg"><label class="fl">Sales Drop Alert (%)</label><input class="fi" type="number" id="cfg-anomaly-drop" value="${cfg.anomaly_sales_drop_pct || 30}" style="width:100px"></div>
  </div>
  <div style="margin-top:12px"><button class="btn btn-primary btn-full" id="cfg-save" onclick="SDSection.cfgSave()">💾 Save Config</button></div>`;
}

async function cfgSave() {
  const btn = document.getElementById('cfg-save'); if (btn) btn.disabled = true;
  try {
    await SD.api('admin_update_settings', { cash_mismatch_tolerance: parseFloat(document.getElementById('cfg-tol')?.value) || 2, backdate_limit_days: parseInt(document.getElementById('cfg-days')?.value) || 3, require_photos: document.getElementById('cfg-photos')?.dataset.on === '1', auto_sync_after_window: document.getElementById('cfg-autosync')?.dataset.on === '1', anomaly_cash_threshold: parseFloat(document.getElementById('cfg-anomaly-cash')?.value) || 5, anomaly_sales_drop_pct: parseInt(document.getElementById('cfg-anomaly-drop')?.value) || 30 });
    SPG.toast('บันทึกสำเร็จ', 'success');
  } catch (err) { SPG.toast(err.message || 'บันทึกไม่สำเร็จ', 'error'); } finally { if (btn) btn.disabled = false; }
}


// ═══════════════════════════════════════
// USER ACCESS — Permission matrix
// ═══════════════════════════════════════
let ua = { perms: [], changes: [], original: [] };

function renderAccess(p) {
  return SPG.shell(`<div class="toolbar">${backBtn()}<div class="toolbar-title">User Access</div></div>
  <div class="content" id="ua-content">
    <div style="font-size:11px;color:var(--t3);margin-bottom:10px">18 functions × 7 tiers — ติ๊ก checkbox แล้วกด Save</div>
    <div id="ua-table">${ui.skeleton(300)}</div>
    <div style="display:none;gap:8px;margin-top:10px" id="ua-actions"><button class="btn btn-primary" id="ua-save" onclick="SDSection.uaSave()">💾 Save Permissions</button><button class="btn btn-outline" onclick="SDSection.uaReset()">↩ Reset</button></div>
  </div>`, SECTION);
}

async function loadAccess(p) {
  await SD.initModule(); if (!S.initLoaded) return; SD.buildSDSidebar();
  if (_busy.ua) return; _busy.ua = true;
  try { const data = await SD.api('admin_get_permissions'); ua.perms = data.permissions || []; ua.original = JSON.parse(JSON.stringify(ua.perms)); ua.changes = []; fillAccess(); toggleUaButtons(); }
  catch { SPG.toast('โหลดไม่สำเร็จ', 'error'); } finally { _busy.ua = false; }
}

function fillAccess() {
  const el = document.getElementById('ua-table'); if (!el || !ua.perms.length) return;
  const groups = {}; ua.perms.forEach(p => { if (!groups[p.function_key]) groups[p.function_key] = { name: p.function_name, group: p.function_group, tiers: {} }; groups[p.function_key].tiers[p.tier_id] = p.is_allowed; });
  const tiers = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  let lastGroup = ''; let rows = '';
  for (const [key, fn] of Object.entries(groups)) {
    if (fn.group !== lastGroup) { lastGroup = fn.group; rows += `<tr><td colspan="8" style="background:var(--bg3);font-size:10px;font-weight:700;color:var(--theme);padding:6px 8px;text-transform:uppercase;border-top:2px solid var(--theme)">${esc(fn.group.toUpperCase())}</td></tr>`; }
    rows += `<tr><td><div style="font-weight:600;font-size:11px">${esc(fn.name)}</div><div style="font-size:9px;color:var(--t4)">${esc(key)}</div></td>`;
    tiers.forEach(t => { const checked = fn.tiers[t] ? 'checked' : ''; rows += `<td style="text-align:center"><input type="checkbox" style="width:18px;height:18px;accent-color:var(--theme);cursor:pointer" data-key="${key}" data-tier="${t}" ${checked} onchange="SDSection.uaToggle('${key}','${t}',this.checked)"></td>`; });
    rows += '</tr>';
  }
  el.innerHTML = `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th style="min-width:140px">Function</th>${tiers.map(t => `<th>${t}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function uaToggle(key, tier, checked) {
  const p = ua.perms.find(x => x.function_key === key && x.tier_id === tier); if (!p) return; p.is_allowed = checked;
  const existing = ua.changes.findIndex(c => c.function_key === key && c.tier_id === tier); if (existing >= 0) ua.changes.splice(existing, 1);
  const orig = ua.original.find(x => x.function_key === key && x.tier_id === tier);
  if (orig && orig.is_allowed !== checked) ua.changes.push({ function_key: key, tier_id: tier, is_allowed: checked });
  toggleUaButtons();
}

function toggleUaButtons() { const el = document.getElementById('ua-actions'); if (el) el.style.display = ua.changes.length > 0 ? 'flex' : 'none'; }

function uaReset() { ua.perms = JSON.parse(JSON.stringify(ua.original)); ua.changes = []; fillAccess(); toggleUaButtons(); SPG.toast('Reset แล้ว', 'info'); }

async function uaSave() {
  if (!ua.changes.length) return;
  const btn = document.getElementById('ua-save'); if (btn) btn.disabled = true;
  try { await SD.api('admin_batch_update_permissions', { changes: ua.changes }); ua.original = JSON.parse(JSON.stringify(ua.perms)); ua.changes = []; toggleUaButtons(); SPG.toast(`อัพเดท ${ua.changes.length || 'all'} permissions สำเร็จ`, 'success'); }
  catch (err) { SPG.toast(err.message || 'อัพเดทไม่สำเร็จ', 'error'); } finally { if (btn) btn.disabled = false; }
}


// ═══════════════════════════════════════
// AUDIT
// ═══════════════════════════════════════
let au = { logs: [], offset: 0 };

function renderAudit(p) {
  const now = SD.todayStr(); const weekAgo = SD.addDays(now, -7);
  return SPG.shell(`<div class="toolbar">${backBtn()}<div class="toolbar-title">Audit Trail</div></div>
  <div class="content" id="au-content">
    <div class="sl" style="margin-top:0">📜 Audit Trail</div>
    <div class="card">
      <div style="font-size:11px;color:var(--t3);margin-bottom:10px">Select date range and click Load.</div>
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
        <div class="fg" style="margin:0;flex:1;min-width:100px"><label class="fl">Date from</label><input class="fi" type="date" id="au-from" value="${weekAgo}"></div>
        <div class="fg" style="margin:0;flex:1;min-width:100px"><label class="fl">Date to</label><input class="fi" type="date" id="au-to" value="${now}"></div>
        <div class="fg" style="margin:0;flex:1;min-width:100px"><label class="fl">Event Type</label><select class="fi" id="au-type"><option value="">All</option><option value="login">Login</option><option value="sale">Sale</option><option value="expense">Expense</option><option value="invoice">Invoice</option><option value="cash">Cash</option><option value="settings">Settings</option><option value="sync">Sync</option></select></div>
        <button class="btn btn-primary" onclick="SDSection.auLoad()">Load</button>
      </div>
    </div>
    <div id="au-result" style="margin-top:10px"><div style="text-align:center;padding:30px;color:var(--t3);font-size:12px">Select date range and click Load</div></div>
    <div id="au-more" style="display:none;text-align:center;padding:10px"><span style="font-size:11px;color:var(--theme);padding:5px 14px;border:1px solid var(--bd);border-radius:var(--rd);cursor:pointer" onclick="SDSection.auLoadMore()">โหลดเพิ่ม →</span></div>
  </div>`, SECTION);
}

async function loadAudit(p) {
  await SD.initModule(); if (!S.initLoaded) return; SD.buildSDSidebar();
}

async function auLoad(append) {
  if (!append) { au.logs = []; au.offset = 0; }
  try {
    const data = await SD.api('admin_get_audit_log', { date_from: document.getElementById('au-from')?.value, date_to: document.getElementById('au-to')?.value, event_type: document.getElementById('au-type')?.value || undefined, store_id: SD.getStore(), limit: 50, offset: au.offset });
    const newLogs = data.logs || []; au.logs = append ? [...au.logs, ...newLogs] : newLogs; fillAudit();
    document.getElementById('au-more').style.display = newLogs.length >= 50 ? '' : 'none';
  } catch { SPG.toast('โหลดไม่สำเร็จ', 'error'); }
}

function fillAudit() {
  const el = document.getElementById('au-result'); if (!el) return;
  if (!au.logs.length) { el.innerHTML = ui.empty('', 'ไม่มีข้อมูล'); return; }
  el.innerHTML = `<div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Time</th><th>Type</th><th>Action</th><th>By</th><th>Detail</th></tr></thead>
  <tbody>${au.logs.map(l => {
    const time = l.created_at ? new Date(l.created_at).toLocaleString('en-AU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    return `<tr><td style="font-size:10px;white-space:nowrap">${time}</td><td>${ui.badge(l.event_type || 'info')}</td><td style="font-size:11px">${esc(l.action)}</td><td style="font-size:10px">${esc(l.changed_by_name || l.changed_by)}</td><td style="font-size:10px;color:var(--t3);max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(l.target_type)}:${esc(l.target_id)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function auLoadMore() { au.offset += 50; auLoad(true); }


// ═══════════════════════════════════════
// REPORT DASHBOARD
// ═══════════════════════════════════════
let rd = { data: null, month: '', brand: '' };

function renderReportDash(p) {
  rd.month = rd.month || SD.todayStr().substring(0, 7);
  return SPG.shell(`<div class="toolbar">${backBtn()}<div class="toolbar-title">Report Dashboard</div></div>
  <div class="content" id="rd-content">
    <div style="display:flex;align-items:center;justify-content:center;gap:12px;padding:4px 0 10px;font-size:13px;font-weight:600">
      <button class="dbar-btn" onclick="SDSection.rdMonthNav(-1)">‹</button>
      <span id="rd-month-label">📊 ${monthLabel(rd.month)}</span>
      <button class="dbar-btn" onclick="SDSection.rdMonthNav(1)">›</button>
    </div>
    <div id="rd-brand-pills">${brandPills(rd.brand, 'SDSection.rdBrandFilter')}</div>
    <div id="rd-kpi" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">${ui.skeleton(72, 3)}</div>
    <div id="rd-stores">${ui.skeleton(120)}</div>
  </div>`, SECTION);
}

async function loadReportDash(p) {
  await SD.initModule(); if (!S.initLoaded) return; SD.buildSDSidebar();
  if (_busy.rd) return; _busy.rd = true;
  try { rd.data = await SD.api('get_report_dashboard', { month: rd.month }); fillReportDash(); }
  catch { SPG.toast('โหลดไม่ได้', 'error'); } finally { _busy.rd = false; }
}

function rdMonthNav(delta) { const p = rd.month.split('-'); const d = new Date(parseInt(p[0]), parseInt(p[1]) - 1 + delta, 1); rd.month = d.toISOString().substring(0, 7); document.getElementById('rd-month-label').textContent = '📊 ' + monthLabel(rd.month); loadReportDash(); }
function rdBrandFilter(brand) { rd.brand = brand; document.getElementById('rd-brand-pills').innerHTML = brandPills(rd.brand, 'SDSection.rdBrandFilter'); fillReportDash(); }

function fillReportDash() {
  const d = rd.data; if (!d) return;
  const brandMap = {}; (S.stores || []).forEach(s => { brandMap[s.store_id] = s.brand || ''; });
  const filteredSids = rd.brand ? new Set((S.stores || []).filter(s => s.brand === rd.brand).map(s => s.store_id)) : null;
  const filterStores = (arr) => filteredSids ? (arr || []).filter(s => filteredSids.has(s.store_id)) : (arr || []);
  const stores = filterStores(d.store_comparison || []);
  const totalSales = stores.reduce((s, x) => s + (x.total_sales || 0), 0);
  const totalExpense = stores.reduce((s, x) => s + (x.total_expense || 0), 0);
  const net = totalSales - totalExpense;

  document.getElementById('rd-kpi').innerHTML = `
    <div class="kpi-box"><div class="kpi-label">💰 Total Sales</div><div class="kpi-val" style="color:var(--theme)">${fms(totalSales)}</div></div>
    <div class="kpi-box"><div class="kpi-label">🧾 Total Expense</div><div class="kpi-val" style="color:var(--red)">${fms(totalExpense)}</div></div>
    <div class="kpi-box"><div class="kpi-label">📈 Net</div><div class="kpi-val" style="color:${net >= 0 ? 'var(--green)' : 'var(--red)'}">${fms(net)}</div></div>`;

  const storesEl = document.getElementById('rd-stores'); if (!storesEl) return;
  if (stores.length) {
    storesEl.innerHTML = `<div class="card"><div class="sl" style="margin-top:0">🏪 Store Comparison</div><div style="overflow-x:auto"><table class="tbl"><thead><tr><th>Store</th><th>Sales</th><th>Expense</th><th>Days</th><th>Avg/Day</th></tr></thead>
    <tbody>${stores.map(s => `<tr><td style="font-size:10px;font-weight:600">${esc(s.store_name || s.store_id)}</td><td style="font-size:10px;color:var(--theme)">${fms(s.total_sales)}</td><td style="font-size:10px;color:var(--red)">${fms(s.total_expense)}</td><td style="font-size:10px;text-align:center">${s.days_recorded}</td><td style="font-size:10px">${fms(s.avg_sales)}</td></tr>`).join('')}</tbody></table></div></div>`;
  } else { storesEl.innerHTML = ui.empty('', 'ยังไม่มีข้อมูล'); }
}


// ═══════════════════════════════════════
// REGISTER TO PARENT
// ═══════════════════════════════════════
SD.renderAccReview = renderAccReview; SD.loadAccReview = loadAccReview;
SD.renderReportDash = renderReportDash; SD.loadReportDash = loadReportDash;
SD.renderChannels = renderChannels; SD.loadChannels = loadChannels;
SD.renderVendors = renderVendors; SD.loadVendors = loadVendors;
SD.renderConfig = renderConfig; SD.loadConfig = loadConfig;
SD.renderAccess = renderAccess; SD.loadAccess = loadAccess;
SD.renderAudit = renderAudit; SD.loadAudit = loadAudit;

Object.assign(window.SDSection, {
  arMonthNav, arBrandFilter, arSync, arConfirmSync, arUnlock, arConfirmUnlock,
  rdMonthNav, rdBrandFilter,
  chToggle, chAdd, chSaveNew,
  vnSearch, vnToggle, vnAdminAdd, vnAdminSaveNew,
  cfgSave,
  uaToggle, uaSave, uaReset,
  auLoad, auLoadMore,
});

})();
