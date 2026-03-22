/**
 * SPG HUB v1.0.0 | 22 MAR 2026 | Siam Palette Group
 * sections/sd_screens2.js — Input Screens S1-S4
 * S1: Daily Sale | S2: Expense | S3: Invoice | S4: Cash
 * All functions/logic identical to legacy — uses One Union pattern
 *
 * Depends on: sd_core.js (SD global)
 */

(() => {
const S = SD.S;
const esc = SD.esc;
const fm = SD.fmtMoney;
const td = SD.todayStr;
const ui = SPG.ui;
const _busy = {};

const SECTION = 'Sales Daily';


// ═══════════════════════════════════════
// SHARED: Vendor Search + Create
// ═══════════════════════════════════════
let _vnClickHandler = null;
function vnShow(id) { vnFilter(id); document.getElementById(id + '-list').style.display = 'block';
  if (_vnClickHandler) { document.removeEventListener('click', _vnClickHandler); _vnClickHandler = null; }
  setTimeout(() => { _vnClickHandler = function(ev) { if (!ev.target.closest('.vendor-wrap')) { const el = document.getElementById(id + '-list'); if (el) el.style.display = 'none'; document.removeEventListener('click', _vnClickHandler); _vnClickHandler = null; } }; document.addEventListener('click', _vnClickHandler); }, 50); }

function vnFilter(id) {
  const q = (document.getElementById(id)?.value || '').toLowerCase();
  const el = document.getElementById(id + '-list'); if (!el) return;
  const vendors = S.vendors || [];
  const filtered = vendors.filter(v => v.name.toLowerCase().includes(q));
  el.innerHTML = filtered.length ? filtered.map(v => `<div style="padding:8px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--bd2)" onmousedown="SDSection.vnPick('${id}','${esc(v.name)}')">${esc(v.name)}</div>`).join('')
    : '<div style="padding:10px;color:var(--t3);font-size:11px;text-align:center">ไม่พบ — ลองกด "+ เพิ่ม"</div>';
  el.style.display = 'block';
}

function vnPick(id, name) { const inp = document.getElementById(id); if (inp) inp.value = name; const el = document.getElementById(id + '-list'); if (el) el.style.display = 'none'; }

function vnCreate(dropdownId) {
  SPG.showDialog(`<div class="popup-sheet" style="width:320px">
    <div class="popup-header"><div class="popup-title">➕ สร้าง Vendor ใหม่</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="fl">ชื่อ Vendor <span class="req">*</span></label><input class="fi" id="vn-new-name" placeholder="เช่น Akipan" autofocus></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-gold" style="flex:1" id="vn-new-save" onclick="SDSection.vnDoCreate('${dropdownId}')">สร้าง</button>
      <button class="btn btn-outline" style="flex:1" onclick="SPG.closeDialog()">ยกเลิก</button>
    </div>
  </div>`);
}

async function vnDoCreate(dropdownId) {
  const name = (document.getElementById('vn-new-name')?.value || '').trim();
  if (!name) return SPG.toast('กรุณาใส่ชื่อ Vendor', 'error');
  const btn = document.getElementById('vn-new-save'); if (btn) btn.disabled = true;
  try {
    const data = await SD.api('create_vendor', { vendor_name: name });
    S.vendors.push({ id: data.id, name: data.vendor_name || name });
    S.vendors.sort((a, b) => a.name.localeCompare(b.name));
    const inp = document.getElementById(dropdownId); if (inp) inp.value = data.vendor_name || name;
    SPG.closeDialog();
    SPG.toast(`สร้าง "${name}" สำเร็จ`, 'success');
  } catch (err) {
    if (err.code === 'DUPLICATE_VISIBLE') { SPG.toast(err.message || 'ชื่อซ้ำ', 'error'); const inp = document.getElementById(dropdownId); if (inp) inp.value = ''; }
    else SPG.toast(err.message || 'สร้างไม่สำเร็จ', 'error');
  } finally { if (btn) btn.disabled = false; }
}


// ═══════════════════════════════════════
// S1: DAILY SALE
// ═══════════════════════════════════════
let s1 = { date: '', channels: [], amounts: {}, photoCard: null, photoCash: null, extraPhotos: [], synced: false, saleId: null, _target: null, _dirty: false, _editMode: false, _originalDate: null, dips: [] };

function renderS1(params) {
  const isEdit = params?.edit || false;
  s1.date = params?.date || s1.date || td();
  s1._editMode = isEdit;
  if (isEdit) s1._originalDate = s1.date;
  const title = isEdit ? '✏️ แก้ยอดขาย' : 'Daily Sale';
  const backRoute = isEdit ? 'sales/daily-hub' : 'sales/dashboard';
  const dateSec = isEdit
    ? `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;margin-bottom:10px"><div style="flex:1;text-align:center;font-size:13px;font-weight:600;cursor:pointer" id="s1-label" onclick="document.getElementById('s1-edit-picker').showPicker()">📅 ${SD.fmtDate(s1.date)} <span style="font-size:10px;color:var(--theme)">กดเพื่อเปลี่ยนวัน</span></div><input type="date" id="s1-edit-picker" value="${s1.date}" onchange="SDSection.s1EditDate(this.value)" style="position:absolute;opacity:0;width:0;height:0"></div>`
    : SD.dateBar('s1', s1.date, 'SDSection.s1Nav');

  return SPG.shell(`<div class="toolbar"><button class="toolbar-back" onclick="SPG.go('${backRoute}')">←</button><div class="toolbar-title">${title}</div></div>
  <div class="content" id="s1-content">
    ${SD.renderStoreSelector({ noAll: true })}
    ${dateSec}
    <div id="s1-lock"></div>
    <div class="sl">ช่องทางขาย</div>
    <div class="card" style="padding:12px">
      <div id="s1-channels">${ui.skeleton(200)}</div>
      <div class="total-bar" style="background:var(--gold-bg,rgba(212,150,10,.06));border:1.5px solid var(--gold,#d4960a);color:var(--gold,#d4960a)">
        <span>ยอดรวมทั้งหมด</span><span style="font-size:18px" id="s1-total">$0.00</span>
      </div>
      <details style="margin-top:8px;border:1px solid var(--bd);border-radius:var(--rd);padding:8px 10px">
        <summary style="font-size:12px;font-weight:600;cursor:pointer">▸ Diff (ถ้ามี)</summary>
        <div id="s1-dips" style="padding-top:8px"></div>
        <button class="btn btn-outline btn-sm" id="s1-add-dip" style="margin-top:6px;font-size:10px" onclick="SDSection.s1AddDip()">+ เพิ่มรายการ Diff</button>
      </details>
    </div>
    <div class="sl">📸 Photo (mandatory)</div>
    <div class="card" style="padding:12px">
      <div style="display:flex;gap:8px">
        <div class="pbox" id="s1-photo-card" onclick="SDSection.s1PickPhoto('card')"><div>📸</div><div>Card Summary</div><div class="req">*</div></div>
      </div>
      <div id="s1-extra-photos" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"></div>
      <button class="btn btn-outline btn-sm" style="margin-top:4px;font-size:10px" onclick="SDSection.s1PickPhoto('extra')">+ เพิ่มรูป/ไฟล์</button>
      <input type="file" id="s1-file" accept="" style="display:none" onchange="SDSection.s1HandlePhoto(event)">
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-primary" style="flex:1;padding:10px" id="s1-save" onclick="SDSection.s1Save()">💾 Save</button>
      <button class="btn btn-outline" style="padding:10px" id="s1-clear" onclick="SDSection.s1Clear()">🗑 Clear</button>
    </div>
  </div>`, SECTION);
}

async function loadS1(params) {
  await SD.initModule(); if (!S.initLoaded) return; SD.buildSDSidebar();
  if (params?.date) s1.date = params.date;
  if (params?.edit) { s1._editMode = true; s1._originalDate = s1.date; }
  if (s1._dirty) { fillS1(); return; }
  if (_busy.s1) return; _busy.s1 = true;
  try {
    const data = await SD.api('get_daily_sale', { sale_date: s1.date, store_id: SD.getStore() });
    s1.channels = S.channels || [];
    s1.synced = data.is_synced;
    s1.saleId = data.sale?.id || null;
    s1.amounts = {};
    s1.photoCard = data.sale?.photo_card_url || null;
    s1.photoCash = data.sale?.photo_cash_url || null;
    s1.extraPhotos = data.sale?.extra_photos || [];
    if (data.sale?.sd_sale_channels) data.sale.sd_sale_channels.forEach(ch => { s1.amounts[ch.channel_key] = ch.amount; });
    s1.dips = data.sale?.dips || [];
    if (!s1.dips.length && data.sale?.cancel_amount && parseFloat(data.sale.cancel_amount) !== 0) {
      s1.dips = [{ type: 'cash', channel_key: '', amount: parseFloat(data.sale.cancel_amount) || 0, note: data.sale.cancel_reason || '' }];
    }
    s1._dirty = false;
    fillS1();
  } catch (err) { SPG.toast('โหลดข้อมูลไม่สำเร็จ', 'error'); }
  finally { _busy.s1 = false; }
}

function fillS1() {
  document.getElementById('s1-lock').innerHTML = SD.lockBanner(s1.synced);
  const el = document.getElementById('s1-channels'); if (!el) return;
  if (!s1.channels.length) { el.innerHTML = ui.empty('', 'ไม่มี channel config'); return; }
  const icons = { card_sale: '💳', cash_sale: '💵', delivery_sale: '🛵', other: '📦' };
  const dipMap = {}; s1.dips.forEach(d => { if (d.channel_key) dipMap[d.channel_key] = true; });
  el.innerHTML = s1.channels.map(ch => {
    const v = s1.amounts[ch.channel_key] ?? '';
    const ico = icons[ch.dashboard_group] || '📦';
    const hasDip = dipMap[ch.channel_key] ? '<span style="color:var(--red);font-weight:700"> *</span>' : '';
    return `<div class="ch-row">
      <div class="ch-icon">${ico}</div><div style="flex:1;min-width:0">
        <div class="ch-name">${esc(ch.channel_label)}${hasDip}</div>
        ${ch.finance_sub_category ? `<div class="ch-sub">Revenue → ${esc(ch.finance_sub_category)}</div>` : ''}
      </div><input class="ch-input" type="number" step="1" min="0" value="${v}" data-key="${ch.channel_key}"
        oninput="SDSection.s1Recalc();SDSection.s1MarkDirty()" ${s1.synced ? 'disabled' : ''}></div>`;
  }).join('');
  s1Recalc();
  s1RenderDips();
  const pc = document.getElementById('s1-photo-card');
  if (pc && s1.photoCard) { pc.innerHTML = `<img src="${s1.photoCard}" style="width:100%;height:100%;object-fit:cover;border-radius:6px">`; pc.style.border = 'none'; }
  const epEl = document.getElementById('s1-extra-photos');
  if (epEl) epEl.innerHTML = SD.renderExtraPhotos(s1.extraPhotos, 's1');
  const btn = document.getElementById('s1-save'); if (btn) btn.disabled = s1.synced;
  const addDipBtn = document.getElementById('s1-add-dip'); if (addDipBtn) addDipBtn.disabled = s1.synced;
  const clearBtn = document.getElementById('s1-clear'); if (clearBtn) clearBtn.disabled = s1.synced;
}

function s1Recalc() {
  let total = 0;
  document.querySelectorAll('.ch-input').forEach(inp => { total += parseFloat(inp.value) || 0; });
  const el = document.getElementById('s1-total'); if (el) el.textContent = fm(total);
}

function s1Nav(delta, dateVal) {
  if (s1._dirty && !confirm('มีข้อมูลที่ยังไม่ได้ Save ต้องการเปลี่ยนวันไหม?')) return;
  s1._dirty = false; s1.dips = [];
  if (dateVal) s1.date = dateVal; else s1.date = SD.addDays(s1.date, delta);
  const lbl = document.getElementById('s1-label'); if (lbl) lbl.textContent = SD.fmtDate(s1.date);
  const pk = document.getElementById('s1-picker'); if (pk) pk.value = s1.date;
  loadS1();
}

function s1PickPhoto(target) { s1._target = target; document.getElementById('s1-file')?.click(); }

async function s1HandlePhoto(event) {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    SPG.toast('กำลังอัพโหลด...', 'info');
    const data = await SD.uploadPhoto(file, 'sale', SD.getStore());
    if (s1._target === 'card') {
      s1.photoCard = data.url;
      const el = document.getElementById('s1-photo-card');
      if (el) { el.innerHTML = `<img src="${data.url}" style="width:100%;height:100%;object-fit:cover;border-radius:6px">`; el.style.border = 'none'; }
    } else if (s1._target === 'extra') {
      s1.extraPhotos.push(data.url);
      const epEl = document.getElementById('s1-extra-photos');
      if (epEl) epEl.innerHTML = SD.renderExtraPhotos(s1.extraPhotos, 's1');
    } else { s1.photoCash = data.url; }
    SPG.toast('อัพโหลดสำเร็จ', 'success');
  } catch { SPG.toast('อัพโหลดล้มเหลว', 'error'); }
  event.target.value = '';
}

function s1RemoveExtra(idx) { s1.extraPhotos.splice(idx, 1); const epEl = document.getElementById('s1-extra-photos'); if (epEl) epEl.innerHTML = SD.renderExtraPhotos(s1.extraPhotos, 's1'); }

async function s1Save() {
  if (s1.synced) return SPG.toast('ข้อมูลถูก Sync แล้ว', 'error');
  if (!s1.photoCard) return SPG.toast('กรุณาถ่ายรูป Card Summary', 'error');
  const channels = {}; document.querySelectorAll('.ch-input').forEach(inp => { channels[inp.dataset.key] = inp.value || '0'; });
  const dips = s1.dips.filter(d => d.amount && parseFloat(d.amount) !== 0);
  const btn = document.getElementById('s1-save'); if (btn) btn.disabled = true;
  try {
    const payload = { store_id: SD.getStore(), sale_date: s1.date, channels, photo_card_url: s1.photoCard, photo_cash_url: s1.photoCash, extra_photos: s1.extraPhotos.length ? s1.extraPhotos : [], dips: dips.length ? dips : [] };
    if (s1._editMode && s1._originalDate && s1._originalDate !== s1.date) payload.original_date = s1._originalDate;
    const resp = await SD.api('save_daily_sale', payload);
    s1.saleId = resp.daily_sale_id; s1._dirty = false;
    if (s1._editMode && s1._originalDate !== s1.date) s1._originalDate = s1.date;
    if (S.dashboard?.today && s1.date === td()) { S.dashboard.today.total_sales = resp.total_sales; S.dashboard.today.is_recorded = true; }
    SPG.toast('บันทึกสำเร็จ', 'success');
  } catch (err) { SPG.toast(err.message || 'บันทึกไม่สำเร็จ', 'error'); }
  finally { if (btn) btn.disabled = false; }
}

function s1MarkDirty() { s1._dirty = true; }
function s1Clear() {
  if (!confirm('ล้างข้อมูลทั้งหมดในฟอร์ม?')) return;
  s1.amounts = {}; s1.photoCard = null; s1.photoCash = null; s1.extraPhotos = []; s1.dips = []; s1._dirty = false;
  fillS1();
  const pc = document.getElementById('s1-photo-card');
  if (pc) { pc.innerHTML = '<div>📸</div><div>Card Summary</div><div class="req">*</div>'; pc.style.border = ''; }
}

async function s1EditDate(newDate) {
  if (newDate === s1.date) return;
  try {
    const data = await SD.api('get_daily_sale', { sale_date: newDate, store_id: SD.getStore() });
    if (data.is_synced) { SPG.toast('วันที่ ' + SD.fmtDate(newDate) + ' ถูก Lock แล้ว', 'error'); return; }
    if (data.sale && !confirm('วันที่ ' + SD.fmtDate(newDate) + ' มีข้อมูลอยู่แล้ว\nต้องการทับข้อมูลเดิมไหม?')) return;
    s1.date = newDate; s1._dirty = true;
    const lbl = document.getElementById('s1-label');
    if (lbl) lbl.innerHTML = '📅 ' + SD.fmtDate(s1.date) + ' <span style="font-size:10px;color:var(--theme)">กดเพื่อเปลี่ยนวัน</span>';
    SPG.toast('เปลี่ยนวันเป็น ' + SD.fmtDate(newDate), 'success');
  } catch { SPG.toast('เช็ควันที่ไม่สำเร็จ', 'error'); }
}

function s1AddDip() { s1.dips.push({ type: 'card', channel_key: '', amount: '', note: '' }); s1RenderDips(); s1MarkDirty(); }
function s1RemoveDip(idx) { s1.dips.splice(idx, 1); s1MarkDirty(); fillS1(); }
function s1DipUpdate(idx, field, value) {
  if (!s1.dips[idx]) return; s1.dips[idx][field] = value;
  if (field === 'type' && value === 'cash') s1.dips[idx].channel_key = '';
  s1MarkDirty();
  if (field === 'type') s1RenderDips();
  if (field === 'channel_key') fillS1();
}

function s1RenderDips() {
  const el = document.getElementById('s1-dips'); if (!el) return;
  if (!s1.dips.length) { el.innerHTML = '<div style="font-size:11px;color:var(--t3);padding:4px 0">ไม่มีรายการ Diff</div>'; return; }
  const cardChs = s1.channels.filter(c => c.dashboard_group === 'card_sale');
  el.innerHTML = s1.dips.map((d, i) => {
    const chSel = d.type === 'card' ? `<select class="fi" style="flex:1;font-size:11px" onchange="SDSection.s1DipUpdate(${i},'channel_key',this.value)"><option value="">-- Channel --</option>${cardChs.map(c => `<option value="${c.channel_key}" ${c.channel_key === d.channel_key ? 'selected' : ''}>${esc(c.channel_label)}</option>`).join('')}</select>` : '<div style="flex:1;font-size:11px;color:var(--t3);padding:6px">Cash</div>';
    return `<div style="border:1px solid var(--bd);border-radius:var(--rd);padding:8px;margin-bottom:6px;background:var(--bg3)">
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
        <select class="fi" style="flex:0 0 80px;font-size:11px" onchange="SDSection.s1DipUpdate(${i},'type',this.value)"><option value="card" ${d.type === 'card' ? 'selected' : ''}>Card</option><option value="cash" ${d.type === 'cash' ? 'selected' : ''}>Cash</option></select>
        ${chSel}
        <button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red);font-size:10px;padding:2px 6px" onclick="SDSection.s1RemoveDip(${i})" ${s1.synced ? 'disabled' : ''}>🗑</button>
      </div>
      <div style="display:flex;gap:6px">
        <input class="fi" type="number" step="0.01" value="${d.amount}" placeholder="จำนวน (+/-)" style="flex:1;font-size:11px" oninput="SDSection.s1DipUpdate(${i},'amount',this.value)">
        <input class="fi" type="text" value="${esc(d.note || '')}" placeholder="หมายเหตุ" style="flex:2;font-size:11px" oninput="SDSection.s1DipUpdate(${i},'note',this.value)">
      </div>
    </div>`;
  }).join('');
}


// ═══════════════════════════════════════
// S2: EXPENSE
// ═══════════════════════════════════════
let s2 = { date: '', expenses: [], total: 0, synced: false, extraPhotos: [] };

function renderS2(params) {
  s2.date = params?.date || s2.date || td();
  return SPG.shell(`<div class="toolbar"><button class="toolbar-back" onclick="SPG.go('sales/dashboard')">←</button><div class="toolbar-title">Expense</div></div>
  <div class="content" id="s2-content">
    ${SD.renderStoreSelector({ noAll: true })}
    ${SD.dateBar('s2', s2.date, 'SDSection.s2Nav')}
    <div id="s2-lock"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div class="sl" style="margin:0" id="s2-count">Today (0)</div>
      <button class="btn btn-primary btn-sm" id="s2-add-btn" onclick="SDSection.s2ShowPopup()">+ Add</button>
    </div>
    <div id="s2-list">${ui.skeleton(100)}</div>
    <div class="total-bar" style="background:var(--rbg,#fef2f2);border:1.5px solid var(--r,#dc2626);color:var(--r,#dc2626)" id="s2-total"><span>Total</span><span>$0.00</span></div>
  </div>`, SECTION);
}

async function loadS2(params) {
  await SD.initModule(); if (!S.initLoaded) return; SD.buildSDSidebar();
  if (params?.date) s2.date = params.date;
  if (_busy.s2) return; _busy.s2 = true;
  try {
    const data = await SD.api('get_expenses', { expense_date: s2.date, store_id: SD.getStore() });
    s2.expenses = data.expenses || []; s2.total = data.total || 0; s2.synced = data.is_synced; fillS2();
  } catch { SPG.toast('โหลดข้อมูลไม่สำเร็จ', 'error'); }
  finally { _busy.s2 = false; }
}

function fillS2() {
  document.getElementById('s2-lock').innerHTML = SD.lockBanner(s2.synced);
  const addBtn = document.getElementById('s2-add-btn'); if (addBtn) addBtn.style.display = s2.synced ? 'none' : '';
  const cnt = document.getElementById('s2-count'); if (cnt) cnt.textContent = `${SD.fmtDate(s2.date)} (${s2.expenses.length})`;
  document.getElementById('s2-total').innerHTML = `<span>Total</span><span>-${fm(s2.total)}</span>`;
  const el = document.getElementById('s2-list'); if (!el) return;
  if (!s2.expenses.length) { el.innerHTML = ui.empty('', 'ยังไม่มีค่าใช้จ่าย'); return; }
  el.innerHTML = s2.expenses.map(ex => `<div class="card" style="padding:10px;margin-bottom:6px;border-left:3px solid var(--orange)">
    <div style="display:flex;justify-content:space-between">
      <div><div style="font-size:12px;font-weight:700">${esc(ex.description)}</div><div style="font-size:10px;color:var(--t3)">${esc(ex.vendor_name)} · ${esc(ex.payment_method)}</div></div>
      <div style="font-size:13px;font-weight:800;color:var(--red)">-${fm(ex.total_amount)}</div>
    </div>
    ${!s2.synced ? `<div style="display:flex;gap:4px;margin-top:6px"><button class="btn btn-outline btn-sm" onclick="SDSection.s2ShowPopup('${ex.id}')">✏️</button><button class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red)" onclick="SDSection.s2Delete('${ex.id}')">🗑️</button></div>` : ''}
  </div>`).join('');
}

function s2Nav(delta, dateVal) {
  if (dateVal) s2.date = dateVal; else s2.date = SD.addDays(s2.date, delta);
  document.getElementById('s2-label').textContent = SD.fmtDate(s2.date);
  document.getElementById('s2-picker').value = s2.date;
  loadS2();
}

function s2ShowPopup(editId) {
  const ex = editId ? s2.expenses.find(x => x.id === editId) : null;
  s2.extraPhotos = ex?.extra_photos || [];
  SPG.showDialog(`<div class="popup-sheet" style="width:400px;max-height:85dvh;overflow-y:auto">
    <div class="popup-header"><div class="popup-title">${ex ? 'Edit' : '+ Add'} Expense</div><button class="popup-close" onclick="SPG.closeDialog()">✕</button></div>
    <div class="fg"><label class="fl">📅 Date</label><input class="fi" type="date" id="s2f-date" value="${ex?.expense_date || s2.date}"></div>
    <div class="fg"><label class="fl">Vendor <span class="req">*</span></label>${SD.renderVendorInput('s2f-vendor', ex?.vendor_name || '')}</div>
    <div class="fg"><label class="fl">Doc Number <span class="req">*</span></label><input class="fi" id="s2f-doc" value="${esc(ex?.doc_number || '')}"></div>
    <div class="fg"><label class="fl">Description <span class="req">*</span></label><input class="fi" id="s2f-desc" value="${esc(ex?.description || '')}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
      <div class="fg"><label class="fl">Amount (ex GST) <span class="req">*</span></label><input class="fi" type="number" step="0.01" id="s2f-amt" value="${ex?.amount_ex_gst || ''}" oninput="SDSection.s2CalcTotal()"></div>
      <div class="fg"><label class="fl">GST</label><input class="fi" type="number" step="0.01" id="s2f-gst" value="${ex?.gst || '0'}" oninput="SDSection.s2CalcTotal()"></div>
      <div class="fg"><label class="fl">Total</label><input class="fi" id="s2f-total" readonly style="background:var(--bg3)"></div>
    </div>
    <div class="fg"><label class="fl">💳 Payment</label><div style="display:flex;gap:4px">
      <button class="pill ${(!ex || ex?.payment_method === 'cash') ? 'active' : ''}" onclick="SDSection.s2SetPm('cash',this)">Cash</button>
      <button class="pill ${ex?.payment_method === 'card' ? 'active' : ''}" onclick="SDSection.s2SetPm('card',this)">Card</button>
    </div></div>
    <div class="fg"><label class="fl">📸 Photo <span class="req">*</span></label>
      <div class="pbox" style="width:60px;height:60px" id="s2f-photo-box" onclick="SDSection.s2PickPhoto('main')">${ex?.photo_url ? `<img src="${ex.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:6px">` : '📸'}</div>
    </div>
    <div id="s2f-extra-photos" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${SD.renderExtraPhotos(s2.extraPhotos, 's2')}</div>
    <button class="btn btn-outline btn-sm" style="margin-top:4px;font-size:10px" onclick="SDSection.s2PickPhoto('extra')">+ เพิ่มรูป/ไฟล์</button>
    <input type="file" id="s2f-file" accept="" style="display:none" onchange="SDSection.s2HandlePhoto(event)">
    <input type="hidden" id="s2f-photo-url" value="${ex?.photo_url || ''}">
    <input type="hidden" id="s2f-id" value="${editId || ''}">
    <input type="hidden" id="s2f-pm-val" value="${ex?.payment_method || 'cash'}">
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-primary btn-full" id="s2f-save" onclick="SDSection.s2Save()">💾 บันทึก</button>
      <button class="btn btn-outline" style="flex:0 0 70px" onclick="SPG.closeDialog()">ยกเลิก</button>
    </div>
  </div>`);
  s2CalcTotal();
}

function s2SetPm(val, el) { document.getElementById('s2f-pm-val').value = val; el.parentElement.querySelectorAll('.pill').forEach(c => c.classList.remove('active')); el.classList.add('active'); }
function s2CalcTotal() { const a = parseFloat(document.getElementById('s2f-amt')?.value) || 0; const g = parseFloat(document.getElementById('s2f-gst')?.value) || 0; const el = document.getElementById('s2f-total'); if (el) el.value = fm(a + g); }

let _s2PhotoTarget = 'main';
function s2PickPhoto(target) { _s2PhotoTarget = target || 'main'; document.getElementById('s2f-file')?.click(); }

async function s2HandlePhoto(event) {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    SPG.toast('กำลังอัพโหลด...', 'info');
    const data = await SD.uploadPhoto(file, 'expense', SD.getStore());
    if (_s2PhotoTarget === 'extra') { s2.extraPhotos.push(data.url); const epEl = document.getElementById('s2f-extra-photos'); if (epEl) epEl.innerHTML = SD.renderExtraPhotos(s2.extraPhotos, 's2'); }
    else { document.getElementById('s2f-photo-url').value = data.url; const box = document.getElementById('s2f-photo-box'); if (box) { box.innerHTML = `<img src="${data.url}" style="width:100%;height:100%;object-fit:cover;border-radius:6px">`; box.style.border = 'none'; } }
    SPG.toast('อัพโหลดสำเร็จ', 'success');
  } catch { SPG.toast('อัพโหลดล้มเหลว', 'error'); }
  event.target.value = '';
}

function s2RemoveExtra(idx) { s2.extraPhotos.splice(idx, 1); const epEl = document.getElementById('s2f-extra-photos'); if (epEl) epEl.innerHTML = SD.renderExtraPhotos(s2.extraPhotos, 's2'); }

async function s2Save() {
  const vendorName = (document.getElementById('s2f-vendor')?.value || '').trim();
  if (!vendorName) return SPG.toast('กรุณาเลือก Vendor', 'error');
  if (!(document.getElementById('s2f-doc')?.value || '').trim()) return SPG.toast('กรุณาใส่ Doc Number', 'error');
  if (!(document.getElementById('s2f-desc')?.value || '').trim()) return SPG.toast('กรุณาใส่ Description', 'error');
  const amt = document.getElementById('s2f-amt')?.value;
  if (!amt || parseFloat(amt) <= 0) return SPG.toast('กรุณาใส่ Amount', 'error');
  const btn = document.getElementById('s2f-save'); if (btn) btn.disabled = true;
  try {
    await SD.api('save_expense', { store_id: SD.getStore(), expense_date: document.getElementById('s2f-date')?.value || s2.date, vendor_name: document.getElementById('s2f-vendor')?.value, doc_number: document.getElementById('s2f-doc')?.value, description: document.getElementById('s2f-desc')?.value, amount_ex_gst: document.getElementById('s2f-amt')?.value, gst: document.getElementById('s2f-gst')?.value || '0', payment_method: document.getElementById('s2f-pm-val')?.value || 'cash', photo_url: document.getElementById('s2f-photo-url')?.value, extra_photos: s2.extraPhotos.length ? s2.extraPhotos : [], expense_id: document.getElementById('s2f-id')?.value || null });
    SPG.closeDialog(); SPG.toast('บันทึกสำเร็จ', 'success'); loadS2();
  } catch (err) { SPG.toast(err.message || 'บันทึกไม่สำเร็จ', 'error'); }
  finally { if (btn) btn.disabled = false; }
}

function s2Delete(id) {
  SPG.showDialog(`<div class="popup-sheet" style="width:300px;text-align:center">
    <div style="font-size:15px;font-weight:700;margin-bottom:12px">ลบรายการนี้?</div>
    <div style="display:flex;gap:8px;justify-content:center">
      <button class="btn btn-outline" onclick="SPG.closeDialog()">ยกเลิก</button>
      <button class="btn btn-primary" style="background:var(--red)" onclick="SDSection.s2ConfirmDelete('${id}')">ลบ</button>
    </div>
  </div>`);
}

async function s2ConfirmDelete(id) {
  try { await SD.api('delete_expense', { expense_id: id }); SPG.closeDialog(); SPG.toast('ลบแล้ว', 'success'); s2.expenses = s2.expenses.filter(x => x.id !== id); s2.total = s2.expenses.reduce((s, x) => s + (x.total_amount || 0), 0); fillS2(); }
  catch (err) { SPG.toast(err.message || 'ลบไม่สำเร็จ', 'error'); }
}


// ═══════════════════════════════════════
// S3: INVOICE (List + Form)
// ═══════════════════════════════════════
let s3 = { invoices: [], summary: {}, dateFrom: '', dateTo: '', offset: 0, hasMore: false };
let s3f = { id: null, photoUrl: '', hasCN: false, extraPhotos: [] };

function renderS3List(p) {
  const now = td(); s3.dateTo = s3.dateTo || now; s3.dateFrom = s3.dateFrom || SD.addDays(now, -3);
  return SPG.shell(`<div class="toolbar"><button class="toolbar-back" onclick="SPG.go('sales/dashboard')">←</button><div class="toolbar-title">Invoice</div></div>
  <div class="content" id="s3-content">
    ${SD.renderStoreSelector({ noAll: true })}
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;font-size:12px"><span>📅</span><input class="fi" type="date" style="flex:1;padding:6px 8px" id="s3-from" value="${s3.dateFrom}" onchange="SDSection.s3Reload()"><span style="color:var(--t3)">→</span><input class="fi" type="date" style="flex:1;padding:6px 8px" id="s3-to" value="${s3.dateTo}" onchange="SDSection.s3Reload()"></div>
    <button class="btn btn-primary btn-full" style="margin-bottom:10px;padding:10px" onclick="SPG.go('sales/invoice-form')">+ New Invoice →</button>
    <div id="s3-kpi" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">${ui.skeleton(72, 3)}</div>
    <div id="s3-list">${ui.skeleton(100)}</div>
    <div id="s3-more" style="display:none;text-align:center;padding:10px"><span style="font-size:11px;color:var(--theme);padding:5px 14px;border:1px solid var(--bd);border-radius:var(--rd);cursor:pointer" onclick="SDSection.s3LoadMore()">โหลดเพิ่ม →</span></div>
  </div>`, SECTION);
}

async function loadS3List(reset) {
  await SD.initModule(); if (!S.initLoaded) return; SD.buildSDSidebar();
  if (reset) { s3.invoices = []; s3.offset = 0; }
  if (_busy.s3) return; _busy.s3 = true;
  try {
    s3.dateFrom = document.getElementById('s3-from')?.value || s3.dateFrom;
    s3.dateTo = document.getElementById('s3-to')?.value || s3.dateTo;
    const data = await SD.api('get_invoices', { store_id: SD.getStore(), date_from: s3.dateFrom, date_to: s3.dateTo, limit: 10, offset: s3.offset });
    const newInvs = data.invoices || [];
    s3.invoices = s3.offset === 0 ? newInvs : [...s3.invoices, ...newInvs];
    s3.summary = data.summary || {}; s3.hasMore = data.has_more || false; fillS3List();
  } catch { SPG.toast('โหลดข้อมูลไม่สำเร็จ', 'error'); }
  finally { _busy.s3 = false; }
}

function fillS3List() {
  const creditTotal = s3.invoices.filter(i => i.has_credit_note).reduce((s, i) => s + (parseFloat(i.credit_note_amount) || 0), 0);
  document.getElementById('s3-kpi').innerHTML = `
    <div class="card" style="text-align:center;padding:12px"><div style="font-size:10px;color:var(--t3)">Total</div><div style="font-size:14px;font-weight:800">${s3.invoices.length}</div></div>
    <div class="card" style="text-align:center;padding:12px"><div style="font-size:10px;color:var(--t3)">Unpaid</div><div style="font-size:14px;font-weight:800;color:var(--red)">${fm(s3.invoices.filter(i => i.payment_status === 'unpaid').reduce((s, i) => s + (i.total_amount || 0), 0))}</div></div>
    <div class="card" style="text-align:center;padding:12px"><div style="font-size:10px;color:var(--t3)">Credit</div><div style="font-size:14px;font-weight:800;color:var(--green)">${creditTotal > 0 ? fm(creditTotal) : '$0.00'}</div></div>`;
  const el = document.getElementById('s3-list'); if (!el) return;
  if (!s3.invoices.length) { el.innerHTML = ui.empty('', 'ยังไม่มี Invoice'); return; }
  el.innerHTML = s3.invoices.map(inv => {
    const isPaid = inv.payment_status === 'paid';
    let html = `<div class="card" style="padding:10px;margin-bottom:6px;border-left:3px solid ${isPaid ? 'var(--green)' : 'var(--red)'};cursor:pointer" onclick="SPG.go('sales/invoice-form',{id:'${inv.id}'})">
      <div style="display:flex;justify-content:space-between"><div><div style="font-size:12px;font-weight:700">${esc(inv.invoice_no)}</div><div style="font-size:10px;color:var(--t3)">${esc(inv.vendor_name)} · ${inv.invoice_date || ''}</div></div>
      <div style="text-align:right"><div style="font-size:13px;font-weight:700${isPaid ? ';color:var(--green)' : ''}">${fm(inv.total_amount)}</div>${ui.badge(isPaid ? 'approved' : 'rejected')}</div></div>
    </div>`;
    if (inv.has_credit_note && inv.credit_note_no) {
      html += `<div class="card" style="margin-top:-8px;margin-left:24px;padding:6px 10px;background:var(--green-bg);border-left:3px solid var(--green);cursor:pointer" onclick="SPG.go('sales/invoice-form',{id:'${inv.id}'})"><div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:11px;color:var(--green);font-weight:600">↳ CN: ${esc(inv.credit_note_no)}</div><div style="font-size:12px;font-weight:700;color:var(--green)">+${fm(parseFloat(inv.credit_note_amount) || 0)}</div></div></div>`;
    }
    return html;
  }).join('');
  document.getElementById('s3-more').style.display = s3.hasMore ? '' : 'none';
}

function s3Reload() { loadS3List(true); }
function s3LoadMore() { s3.offset += 10; loadS3List(false); }

// S3 Form — abbreviated (same logic, uses SPG.shell + SD.api)
function renderS3Form(params) {
  s3f.id = params?.id || null; s3f.hasCN = false; s3f.extraPhotos = [];
  return SPG.shell(`<div class="toolbar"><button class="toolbar-back" onclick="SPG.go('sales/invoice')">←</button><div class="toolbar-title">${s3f.id ? 'Edit Invoice' : 'New Invoice'}</div></div>
  <div class="content" id="s3f-content">
    <div id="s3f-lock"></div>
    <div class="card">
      <div class="fg"><label class="fl">📅 Issue Date <span class="req">*</span></label><input class="fi" type="date" id="s3f-date" value="${td()}" onchange="SDSection.s3fDateChange()"></div>
      <div class="fg"><label class="fl">Invoice No <span class="req">*</span></label><input class="fi" id="s3f-no" oninput="SDSection.s3fSyncCnNo()"></div>
      <div class="fg"><label class="fl">Vendor <span class="req">*</span></label>${SD.renderVendorInput('s3f-vendor', '')}</div>
      <div class="fg"><label class="fl">Description <span class="req">*</span></label><input class="fi" id="s3f-desc"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div class="fg"><label class="fl">Amount <span class="req">*</span></label><input class="fi" type="number" step="0.01" id="s3f-amt" oninput="SDSection.s3fCalc()"></div>
        <div class="fg"><label class="fl">GST</label><input class="fi" type="number" step="0.01" id="s3f-gst" value="0" oninput="SDSection.s3fCalc()"></div>
        <div class="fg"><label class="fl">Total</label><input class="fi" id="s3f-total" readonly style="background:var(--bg3)"></div>
      </div>
      <div style="height:1px;background:var(--bd2);margin:10px 0"></div>
      <div style="padding:8px 10px;background:var(--red-bg);border-radius:var(--rd);margin-bottom:8px"><span style="font-size:12px;font-weight:700;color:var(--red)">Invoice = Unpaid เสมอ</span></div>
      <div class="fg"><label class="fl">Due Date <span class="req">*</span></label><input class="fi" type="date" id="s3f-due" min="${SD.addDays(td(), 1)}"></div>
      <div style="height:1px;background:var(--bd2);margin:10px 0"></div>
      <div class="fg"><label class="fl">🔄 Credit Note</label><div style="display:flex;gap:4px"><button class="pill active" onclick="SDSection.s3fCnToggle(false,this)">No</button><button class="pill" onclick="SDSection.s3fCnToggle(true,this)">Yes</button></div></div>
      <div id="s3f-cn-fields" style="display:none">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="fg"><label class="fl">CN No</label><input class="fi" id="s3f-cn-no" readonly style="background:var(--bg3)"></div><div class="fg"><label class="fl">CR Reason <span class="req">*</span></label><select class="fi" id="s3f-cr-reason"><option value="">-- เลือก --</option><option value="return">สินค้าคืน</option><option value="damaged">ชำรุด</option><option value="discount">ส่วนลด</option><option value="overcharge">คิดเกิน</option></select></div></div>
        <div class="fg"><label class="fl">CR Description <span class="req">*</span></label><input class="fi" id="s3f-cr-desc"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><div class="fg"><label class="fl">CR Amount <span class="req">*</span></label><input class="fi" type="number" step="0.01" id="s3f-cn-amt" style="color:var(--green);font-weight:700" oninput="SDSection.s3fCalc()"></div><div class="fg"><label class="fl">CR GST</label><input class="fi" type="number" step="0.01" id="s3f-cr-gst" oninput="SDSection.s3fCalc()"></div><div class="fg"><label class="fl">CR Total</label><input class="fi" id="s3f-cr-total" readonly style="background:var(--bg3);color:var(--green);font-weight:700"></div></div>
      </div>
      <div class="fg"><label class="fl">📸 Photo <span class="req">*</span></label>
        <div class="pbox" id="s3f-photo-box" onclick="SDSection.s3fPickPhoto('main')"><div>📸</div><div style="font-size:8px">* บังคับ</div></div>
        <div id="s3f-extra-photos" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px"></div>
        <button class="btn btn-outline btn-sm" style="margin-top:4px;font-size:10px" onclick="SDSection.s3fPickPhoto('extra')">+ เพิ่มรูป</button>
        <input type="file" id="s3f-file" accept="" style="display:none" onchange="SDSection.s3fHandlePhoto(event)">
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-primary" style="flex:1;padding:10px" id="s3f-save" onclick="SDSection.s3fSave()">💾 บันทึก</button><button class="btn btn-outline" style="flex:0.4" onclick="SPG.go('sales/invoice')">ยกเลิก</button></div>
  </div>`, SECTION);
}

async function loadS3Form(params) {
  await SD.initModule(); if (!S.initLoaded) return; SD.buildSDSidebar();
  if (!params?.id) return;
  const inv = s3.invoices.find(x => x.id === params.id);
  if (!inv) { SPG.toast('ไม่พบ Invoice', 'error'); SPG.go('sales/invoice'); return; }
  s3f.id = inv.id; s3f.photoUrl = inv.photo_url || ''; s3f.extraPhotos = inv.extra_photos || [];
  document.getElementById('s3f-date').value = inv.invoice_date;
  document.getElementById('s3f-no').value = inv.invoice_no;
  const vnInp = document.getElementById('s3f-vendor'); if (vnInp) vnInp.value = inv.vendor_name;
  document.getElementById('s3f-desc').value = inv.description;
  document.getElementById('s3f-amt').value = inv.amount_ex_gst;
  document.getElementById('s3f-gst').value = inv.gst;
  document.getElementById('s3f-due').value = inv.due_date || '';
  if (inv.photo_url) { const box = document.getElementById('s3f-photo-box'); if (box) box.innerHTML = `<img src="${inv.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:6px">`; }
  const epEl = document.getElementById('s3f-extra-photos'); if (epEl) epEl.innerHTML = SD.renderExtraPhotos(s3f.extraPhotos, 's3f');
  if (inv.has_credit_note) { s3f.hasCN = true; const toggleBtns = document.querySelectorAll('#s3f-cn-fields')?.closest('.fg')?.querySelectorAll('.pill'); document.getElementById('s3f-cn-fields').style.display = ''; const cnNo = document.getElementById('s3f-cn-no'); if (cnNo) cnNo.value = inv.credit_note_no || ''; const cnAmt = document.getElementById('s3f-cn-amt'); if (cnAmt) cnAmt.value = inv.cr_amount_ex_gst ?? inv.credit_note_amount ?? ''; const crR = document.getElementById('s3f-cr-reason'); if (crR) crR.value = inv.cr_reason || ''; const crD = document.getElementById('s3f-cr-desc'); if (crD) crD.value = inv.cr_description || ''; const crG = document.getElementById('s3f-cr-gst'); if (crG) crG.value = inv.cr_gst || ''; }
  s3fCalc();
  if (inv.invoice_date) { try { const syncData = await SD.api('check_sync', { sync_date: inv.invoice_date, store_id: SD.getStore() }); if (syncData?.is_synced) { document.getElementById('s3f-lock').innerHTML = SD.lockBanner(true); const btn = document.getElementById('s3f-save'); if (btn) btn.disabled = true; } } catch {} }
}

function s3fDateChange() { const d = document.getElementById('s3f-date')?.value; const dueEl = document.getElementById('s3f-due'); if (d && dueEl) { const m = SD.addDays(d, 1); dueEl.min = m; if (dueEl.value && dueEl.value <= d) dueEl.value = m; } }
function s3fCnToggle(show, el) { if (el) { el.parentElement.querySelectorAll('.pill').forEach(c => c.classList.remove('active')); el.classList.add('active'); } document.getElementById('s3f-cn-fields').style.display = show ? '' : 'none'; s3f.hasCN = show; if (show) s3fSyncCnNo(); else ['s3f-cn-no','s3f-cn-amt','s3f-cr-gst','s3f-cr-reason','s3f-cr-desc','s3f-cr-total'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; }); s3fCalc(); }
function s3fSyncCnNo() { if (!s3f.hasCN) return; const inv = (document.getElementById('s3f-no')?.value || '').trim(); const cn = document.getElementById('s3f-cn-no'); if (cn) cn.value = inv ? inv + '-CR' : ''; }
function s3fCalc() { const a = parseFloat(document.getElementById('s3f-amt')?.value) || 0; const g = parseFloat(document.getElementById('s3f-gst')?.value) || 0; document.getElementById('s3f-total').value = fm(a + g); if (s3f.hasCN) { const ca = parseFloat(document.getElementById('s3f-cn-amt')?.value) || 0; const cg = parseFloat(document.getElementById('s3f-cr-gst')?.value) || 0; const ct = document.getElementById('s3f-cr-total'); if (ct) ct.value = fm(ca + cg); } }

let _s3fPhotoTarget = 'main';
function s3fPickPhoto(t) { _s3fPhotoTarget = t || 'main'; document.getElementById('s3f-file')?.click(); }
async function s3fHandlePhoto(event) { const file = event.target.files?.[0]; if (!file) return; try { SPG.toast('กำลังอัพโหลด...', 'info'); const data = await SD.uploadPhoto(file, 'invoice', SD.getStore()); if (_s3fPhotoTarget === 'extra') { s3f.extraPhotos.push(data.url); const ep = document.getElementById('s3f-extra-photos'); if (ep) ep.innerHTML = SD.renderExtraPhotos(s3f.extraPhotos, 's3f'); } else { s3f.photoUrl = data.url; const box = document.getElementById('s3f-photo-box'); if (box) box.innerHTML = `<img src="${data.url}" style="width:100%;height:100%;object-fit:cover;border-radius:6px">`; } SPG.toast('อัพโหลดสำเร็จ', 'success'); } catch { SPG.toast('อัพโหลดล้มเหลว', 'error'); } event.target.value = ''; }
function s3fRemoveExtra(idx) { s3f.extraPhotos.splice(idx, 1); const ep = document.getElementById('s3f-extra-photos'); if (ep) ep.innerHTML = SD.renderExtraPhotos(s3f.extraPhotos, 's3f'); }

async function s3fSave() {
  const d = document.getElementById('s3f-date')?.value;
  if (d) { try { const sc = await SD.api('check_sync', { sync_date: d, store_id: SD.getStore() }); if (sc?.is_synced) { SPG.toast('วันนี้ถูก Sync แล้ว', 'error'); return; } } catch {} }
  if (!(document.getElementById('s3f-vendor')?.value || '').trim()) return SPG.toast('กรุณาเลือก Vendor', 'error');
  if (!(document.getElementById('s3f-no')?.value || '').trim()) return SPG.toast('กรุณาใส่ Invoice No', 'error');
  if (!(document.getElementById('s3f-desc')?.value || '').trim()) return SPG.toast('กรุณาใส่ Description', 'error');
  const amt = document.getElementById('s3f-amt')?.value; if (!amt || parseFloat(amt) <= 0) return SPG.toast('กรุณาใส่ Amount', 'error');
  if (!s3f.photoUrl) return SPG.toast('กรุณาถ่ายรูป Invoice', 'error');
  const due = document.getElementById('s3f-due')?.value; if (!due) return SPG.toast('กรุณาใส่ Due Date', 'error'); if (due <= d) return SPG.toast('Due Date ต้องหลัง Issue Date', 'error');
  if (s3f.hasCN) { if (!(document.getElementById('s3f-cr-reason')?.value)) return SPG.toast('กรุณาเลือก CR Reason', 'error'); if (!(document.getElementById('s3f-cr-desc')?.value?.trim())) return SPG.toast('กรุณาใส่ CR Description', 'error'); const ca = parseFloat(document.getElementById('s3f-cn-amt')?.value) || 0; if (ca <= 0) return SPG.toast('กรุณาใส่ CR Amount', 'error'); const cg = parseFloat(document.getElementById('s3f-cr-gst')?.value) || 0; if ((ca + cg) >= (parseFloat(amt) + (parseFloat(document.getElementById('s3f-gst')?.value) || 0))) return SPG.toast('CR Total ต้องน้อยกว่ายอด Invoice', 'error'); }
  const btn = document.getElementById('s3f-save'); if (btn) btn.disabled = true;
  try {
    await SD.api('save_invoice', { store_id: SD.getStore(), invoice_date: d, invoice_no: document.getElementById('s3f-no')?.value, vendor_name: document.getElementById('s3f-vendor')?.value, description: document.getElementById('s3f-desc')?.value, amount_ex_gst: amt, gst: document.getElementById('s3f-gst')?.value || '0', due_date: due, photo_url: s3f.photoUrl, extra_photos: s3f.extraPhotos.length ? s3f.extraPhotos : [], invoice_id: s3f.id, has_credit_note: s3f.hasCN, credit_note_no: s3f.hasCN ? (document.getElementById('s3f-cn-no')?.value || '') : null, cr_reason: s3f.hasCN ? (document.getElementById('s3f-cr-reason')?.value || '') : null, cr_description: s3f.hasCN ? (document.getElementById('s3f-cr-desc')?.value?.trim() || '') : null, cr_amount_ex_gst: s3f.hasCN ? (parseFloat(document.getElementById('s3f-cn-amt')?.value) || 0) : 0, cr_gst: s3f.hasCN ? (parseFloat(document.getElementById('s3f-cr-gst')?.value) || 0) : 0 });
    SPG.toast('บันทึกสำเร็จ', 'success'); SPG.go('sales/invoice');
  } catch (err) { SPG.toast(err.message || 'บันทึกไม่สำเร็จ', 'error'); }
  finally { if (btn) btn.disabled = false; }
}


// ═══════════════════════════════════════
// S4: CASH ON HAND
// ═══════════════════════════════════════
let s4 = { date: '', cashSale: 0, cashExpend: 0, expected: 0, tolerance: 2, existing: null };

function renderS4(p) {
  s4.date = s4.date || td();
  return SPG.shell(`<div class="toolbar"><button class="toolbar-back" onclick="SPG.go('sales/dashboard')">←</button><div class="toolbar-title">Cash On Hand</div></div>
  <div class="content" id="s4-content">
    ${SD.renderStoreSelector({ noAll: true })}
    ${SD.dateBar('s4', s4.date, 'SDSection.s4Nav')}
    <div class="sl">🧮 Auto-Calculation</div>
    <div id="s4-calc">${ui.skeleton(140)}</div>
    <div class="sl">✍️ นับเงินสดจริง</div>
    <div class="card"><div class="fg"><label class="fl">④ Actual Cash <span class="req">*</span></label><input class="fi" type="number" step="0.01" id="s4-actual" placeholder="0.00" style="font-size:16px;font-weight:700;text-align:right" oninput="SDSection.s4Check()"></div></div>
    <div id="s4-result"></div>
    <div id="s4-mismatch" style="display:none"><div class="card" style="padding:10px"><div class="fg" style="margin:0"><label class="fl">เหตุผลเงินไม่ตรง <span class="req">*</span></label><input class="fi" id="s4-reason" placeholder="อธิบายเหตุผล"></div></div></div>
    <div class="sl">📸 ถ่ายรูปเงินสด (บังคับ)</div>
    <div class="card" style="padding:12px">
      <div style="width:100%;height:50px;border:2px dashed var(--bd);border-radius:var(--rd);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;color:var(--t3);gap:8px" id="s4-photo-box" onclick="document.getElementById('s4-file').click()">💵 ถ่ายรูปเงินสดก่อนส่ง <span style="color:var(--red)">*</span></div>
      <input type="file" id="s4-file" accept="" style="display:none" onchange="SDSection.s4HandlePhoto(event)">
      <input type="hidden" id="s4-photo-url">
    </div>
    <div class="sl">🤝 Handover</div>
    <div id="s4-handover">${ui.empty('', 'ยังไม่มีข้อมูล')}</div>
    <div style="margin-top:12px"><button class="btn btn-primary btn-full" style="padding:10px" id="s4-submit" onclick="SDSection.s4Submit()">💾 Submit</button></div>
  </div>`, SECTION);
}

async function loadS4(p) {
  await SD.initModule(); if (!S.initLoaded) return; SD.buildSDSidebar();
  if (_busy.s4) return; _busy.s4 = true;
  try {
    const data = await SD.api('get_cash', { cash_date: s4.date, store_id: SD.getStore() });
    s4.cashSale = data.cash_sale || 0; s4.cashExpend = data.cash_expend || 0; s4.expected = data.expected_cash || 0; s4.tolerance = data.tolerance || 2; s4.existing = data.existing; fillS4();
  } catch { SPG.toast('โหลดข้อมูลไม่สำเร็จ', 'error'); }
  finally { _busy.s4 = false; }
}

function fillS4() {
  document.getElementById('s4-calc').innerHTML = `<div class="card" style="border-left:3px solid var(--theme)">
    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center;text-align:center">
      <div><div style="font-size:10px;color:var(--t3)">① Cash Sale</div><div style="font-size:18px;font-weight:700;color:var(--green)">${fm(s4.cashSale)}</div></div>
      <div style="font-size:20px;color:var(--t3)">−</div>
      <div><div style="font-size:10px;color:var(--t3)">② Cash Expend</div><div style="font-size:18px;font-weight:700;color:var(--red)">${fm(s4.cashExpend)}</div></div>
    </div>
    <div style="text-align:center;margin:8px 0;font-size:18px;color:var(--t3)">=</div>
    <div style="text-align:center"><div style="font-size:10px;color:var(--t3)">③ Expected Cash</div><div style="font-size:24px;font-weight:700;color:var(--theme)">${fm(s4.expected)}</div></div>
  </div>`;
  if (s4.existing) {
    document.getElementById('s4-actual').value = s4.existing.actual_cash; s4Check();
    if (s4.existing.cashier_photo_url) { document.getElementById('s4-photo-url').value = s4.existing.cashier_photo_url; const box = document.getElementById('s4-photo-box'); if (box) box.innerHTML = `<img src="${s4.existing.cashier_photo_url}" style="height:48px;border-radius:6px"> เปลี่ยนรูป`; }
    fillS4Handover();
  }
}

function s4Check() {
  const actual = parseFloat(document.getElementById('s4-actual')?.value) || 0;
  const diff = actual - s4.expected; const matched = Math.abs(diff) <= s4.tolerance;
  const el = document.getElementById('s4-result'); if (!el) return;
  if (actual === 0 && !s4.existing) { el.innerHTML = ''; document.getElementById('s4-mismatch').style.display = 'none'; return; }
  if (matched) { el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:var(--rd);font-size:12px;margin-bottom:8px;background:var(--green-bg);color:var(--green)">✅ Match — ผลต่าง ${fm(Math.abs(diff))}</div>`; document.getElementById('s4-mismatch').style.display = 'none'; }
  else { el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:var(--rd);font-size:12px;margin-bottom:8px;background:var(--red-bg);color:var(--red)">⚠️ ไม่ตรง — ผลต่าง ${diff >= 0 ? '+' : ''}${fm(diff)}</div>`; document.getElementById('s4-mismatch').style.display = ''; }
}

function fillS4Handover() {
  const c = s4.existing; if (!c) return;
  const steps = [{ label: '👤 Cashier counted', done: !!c.cashier_confirmed_at, by: c.cashier_confirmed_by }, { label: '👔 Cash Collected', done: c.handover_status === 'manager' || c.handover_status === 'owner' || c.handover_status === 'deposited', by: c.manager_confirmed_by }];
  const completed = c.handover_status !== 'with_cashier'; const canConfirm = c.handover_status === 'with_cashier';
  document.getElementById('s4-handover').innerHTML = `<div class="card">${steps.map(s => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:11px"><div style="width:8px;height:8px;border-radius:50%;background:${s.done ? 'var(--green)' : 'var(--orange)'}"></div><div>${s.done ? '<b>' : ''}${s.label}${s.done ? '</b>' : ''}${s.by ? ' · ' + esc(s.by) : ''}</div></div>`).join('')}
    ${completed ? '<div style="margin-top:8px;padding:6px 10px;background:var(--green-bg);border-radius:var(--rd);font-size:11px;font-weight:600;color:var(--green);text-align:center">✅ Completed</div>' : ''}
    ${canConfirm ? '<button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="SDSection.s4Confirm()">✓ Cash Collected</button>' : ''}
  </div>`;
}

function s4Nav(delta, dateVal) { if (dateVal) s4.date = dateVal; else s4.date = SD.addDays(s4.date, delta); document.getElementById('s4-label').textContent = SD.fmtDate(s4.date); document.getElementById('s4-picker').value = s4.date; loadS4(); }

async function s4HandlePhoto(event) {
  const file = event.target.files?.[0]; if (!file) return;
  try { SPG.toast('กำลังอัพโหลด...', 'info'); const data = await SD.uploadPhoto(file, 'cash', SD.getStore()); document.getElementById('s4-photo-url').value = data.url; const box = document.getElementById('s4-photo-box'); if (box) box.innerHTML = `<img src="${data.url}" style="height:48px;border-radius:6px"> เปลี่ยนรูป`; SPG.toast('อัพโหลดสำเร็จ', 'success'); } catch { SPG.toast('อัพโหลดล้มเหลว', 'error'); }
  event.target.value = '';
}

async function s4Submit() {
  if (!document.getElementById('s4-photo-url')?.value) return SPG.toast('กรุณาถ่ายรูปเงินสด', 'error');
  if (!document.getElementById('s4-actual')?.value) return SPG.toast('กรุณาใส่จำนวนเงินจริง', 'error');
  const btn = document.getElementById('s4-submit'); if (btn) btn.disabled = true;
  try { await SD.api('submit_cash_count', { store_id: SD.getStore(), cash_date: s4.date, actual_cash: document.getElementById('s4-actual')?.value, photo_url: document.getElementById('s4-photo-url')?.value, mismatch_reason: document.getElementById('s4-reason')?.value || '' }); SPG.toast('บันทึกสำเร็จ', 'success'); loadS4(); }
  catch (err) { SPG.toast(err.message || 'บันทึกไม่สำเร็จ', 'error'); }
  finally { if (btn) btn.disabled = false; }
}

async function s4Confirm() {
  if (!s4.existing?.id) return;
  try { const resp = await SD.api('confirm_handover', { cash_id: s4.existing.id }); SPG.toast(`${resp.previous} → ${resp.new_status}`, 'success'); loadS4(); }
  catch (err) { SPG.toast(err.message || 'ยืนยันไม่สำเร็จ', 'error'); }
}


// ═══════════════════════════════════════
// REGISTER TO PARENT
// ═══════════════════════════════════════
SD.renderS1 = renderS1; SD.loadS1 = loadS1;
SD.renderS2 = renderS2; SD.loadS2 = loadS2;
SD.renderS3List = renderS3List; SD.loadS3List = loadS3List;
SD.renderS3Form = renderS3Form; SD.loadS3Form = loadS3Form;
SD.renderS4 = renderS4; SD.loadS4 = loadS4;

// Extra photo remove handler
function removeExtraPhoto(prefix, idx) {
  if (prefix === 's1') s1RemoveExtra(idx);
  else if (prefix === 's2') s2RemoveExtra(idx);
  else if (prefix === 's3f') s3fRemoveExtra(idx);
}

// Expose onclick handlers
Object.assign(window.SDSection, {
  // Vendor
  vnShow, vnFilter, vnPick, vnCreate, vnDoCreate,
  // S1
  s1Nav, s1Recalc, s1PickPhoto, s1HandlePhoto, s1RemoveExtra: (i) => s1RemoveExtra(i),
  s1Save, s1MarkDirty, s1Clear, s1EditDate, s1AddDip, s1RemoveDip, s1DipUpdate,
  // S2
  s2Nav, s2ShowPopup, s2SetPm, s2CalcTotal, s2PickPhoto, s2HandlePhoto,
  s2RemoveExtra: (i) => s2RemoveExtra(i), s2Save, s2Delete, s2ConfirmDelete,
  // S3
  s3Reload, s3LoadMore,
  s3fDateChange, s3fCnToggle, s3fSyncCnNo, s3fCalc, s3fPickPhoto, s3fHandlePhoto,
  s3fRemoveExtra: (i) => s3fRemoveExtra(i), s3fSave,
  // S4
  s4Nav, s4Check, s4HandlePhoto, s4Submit, s4Confirm,
  // Extra photos
  removeExtraPhoto,
});

})();
