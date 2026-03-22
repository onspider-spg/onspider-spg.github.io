# SPG HUB — Module Development Guide
**Version 2.0 | 22 MAR 2026**

> **อ่านก่อนเริ่มเขียนโค้ด** — ทุก module ต้องยึดตาม guide นี้เท่านั้น
> ดู Bakery module (`bakery.js`) เป็น reference ที่ถูกต้อง

---

## Rule #1: ห้ามสร้างอะไรใหม่

SPG HUB เป็น **One Union System** — ทุก module อยู่ใน `index.html` เดียวกัน ใช้ core เดียวกัน

### ❌ ห้ามทำ (จะทำให้ระบบพัง)

```
❌ สร้าง .html ใหม่         → ใช้ index.html ตัวเดียว
❌ สร้าง .css ใหม่           → ใช้ core/styles.css ตัวเดียว
❌ สร้าง api client ใหม่     → ใช้ SPG.api.post() ตัวเดียว
❌ สร้าง auth/login ใหม่     → ใช้ Home auth ที่มีอยู่
❌ สร้าง sidebar ใหม่        → ใช้ pattern จาก buildBakerySidebar()
❌ สร้าง permission ใหม่     → ใช้ SPG.perm.canDo()
❌ สร้าง router ใหม่         → ใช้ SPG.section() + SPG.go()
❌ Import Google Fonts        → ใช้ System Font
❌ Import FontAwesome          → ใช้ Emoji
❌ เขียน admin/settings/audit  → อยู่ใน Home แล้ว
❌ แก้ไขไฟล์ที่ไม่ใช่ของตัวเอง → ดูกฎด้านล่าง
```

### 🚫 กฎสำคัญ: ห้ามแก้ไฟล์ของ module อื่น

```
แต่ละ module มีสิทธิ์แก้ได้เฉพาะไฟล์ของตัวเองเท่านั้น

ห้ามแก้:
  - core/*           (api.js, app.js, permission.js, components.js, styles.css)
  - sections/home.js (และ home_*.js ทั้งหมด)
  - sections/bc_*.js (ถ้าคุณไม่ใช่ทีม BC)
  - sections/sd_*.js (ถ้าคุณไม่ใช่ทีม SD)
  - index.html       (ยกเว้นเพิ่ม <script> ของตัวเอง)

ถ้าต้องการแก้ core หรือ Home:
  → แจ้ง Home team (พี่อร) พร้อมอธิบายว่าต้องการอะไร
  → Home team จะแก้ให้ + deploy

ตัวอย่าง:
  - ต้องการ API endpoint ใหม่ใน core/api.js → แจ้ง Home team
  - ต้องการ CSS class ใหม่ใน core/styles.css → แจ้ง Home team
  - ต้องการ sidebar feature ใหม่ใน core/app.js → แจ้ง Home team
```

### ✅ สิ่งที่ต้องสร้าง (ต่อ 1 module)

```
✅ sections/{prefix}_{name}.js  — ใช้ตัวย่อ module เป็น prefix เสมอ
✅ supabase/functions/{fn}/     — Backend edge function
✅ เพิ่ม <script> ใน index.html  — defer, ต่อจาก core
```

### 📛 Naming Convention: ใช้ตัวย่อ module เป็น prefix

```
ชื่อไฟล์ต้องขึ้นต้นด้วยตัวย่อ module เสมอ — ห้ามใช้ชื่อเต็ม

Module        Prefix    ตัวอย่างไฟล์
─────────────────────────────────────────────
Bakery        bc_       sections/bc_core.js, bc_store.js, bc_admin.js
Sales Daily   sd_       sections/sd_core.js, sd_daily.js, sd_report.js
Finance       fin_      sections/fin_core.js, fin_transactions.js
HR            hr_       sections/hr_core.js, hr_roster.js
Purchase      pur_      sections/pur_core.js, pur_orders.js
Operations    ops_      sections/ops_core.js
Food Hub      fh_       sections/fh_core.js
Marketing     mk_       sections/mk_core.js
Equipment     eq_       sections/eq_core.js
BI Dashboard  bi_       sections/bi_core.js
CRM           crm_      sections/crm_core.js

❌ ห้าม: bakery_store.js, saledaily_report.js, finance_payroll.js
✅ ถูก:  bc_store.js, sd_report.js, fin_payroll.js
```

---

## File Structure (ต้องเป็นแบบนี้เท่านั้น)

```
onspider-spg.github.io/
├── index.html              ← เพิ่ม <script> ที่นี่
├── core/                   ← ห้ามแก้ (ยกเว้นได้รับอนุญาต)
│   ├── api.js
│   ├── app.js
│   ├── permission.js
│   ├── components.js
│   └── styles.css
├── sections/
│   ├── home.js             ← ห้ามแก้ (Home team only)
│   ├── bc_core.js          ← REFERENCE MODULE (ดูตัวอย่างจากนี้)
│   ├── bc_store.js         ← BC sub-file
│   ├── bc_staff.js
│   ├── bc_admin.js
│   ├── bc_exec.js
│   ├── sd_core.js          ← your module core (ตัวย่อ!)
│   ├── sd_daily.js         ← your sub-file (ตัวย่อ!)
│   └── sd_report.js
```

### เพิ่มใน index.html (ต่อจาก sections ที่มี):

```html
<!-- Sales Module (ใช้ตัวย่อ sd_ เป็น prefix) -->
<script src="sections/sd_core.js" defer></script>
<script src="sections/sd_daily.js" defer></script>
<script src="sections/sd_report.js" defer></script>
```

> **สำคัญ**: ใช้ `defer` เสมอ — ลำดับไฟล์สำคัญ (core ก่อน sub-files)

---

## Template: Core File (copy แล้วแก้)

**ไฟล์**: `sections/{module}.js`

```javascript
/**
 * SPG HUB | {Module Name}
 * sections/{module}.js — Core (state, api, init, sidebar, routes)
 *
 * Sub-files:
 *   {module}_xxx.js — {description}
 */

(() => {
const esc = SPG.esc;

// ═══════════════════════════════════════
// STATE (shared via window.{XX})
// ═══════════════════════════════════════
const S = {
  // Init
  initLoaded: false,
  _initLoading: false,

  // Config from init_bundle
  config: {},
  permissions: [],
  stores: [],
  departments: [],

  // Data (add your module-specific data here)
  // ...

  // Sort states for tables
  sortStates: {},
};


// ═══════════════════════════════════════
// API WRAPPER (uses module prefix)
// ═══════════════════════════════════════
// Endpoint key must match core/api.js ENDPOINTS
// e.g., 'sales' → https://xxx.supabase.co/functions/v1/saledaily-report
function api(action, data = {}) {
  return SPG.api.post('{endpoint_key}', action, SPG.api.tb(data));
}


// ═══════════════════════════════════════
// INIT (load once per session)
// ═══════════════════════════════════════
async function initModule() {
  if (S.initLoaded) return;
  if (S._initLoading) return;
  S._initLoading = true;

  try {
    const data = await api('{prefix}_init_bundle');
    S.config = data.config || {};
    S.permissions = data.permissions || [];
    S.stores = data.stores || [];
    S.departments = data.departments || [];
    // ... store module-specific data

    S.initLoaded = true;
  } catch (e) {
    SPG.toast(e.message || 'โหลดข้อมูลไม่สำเร็จ', 'error');
  } finally {
    S._initLoading = false;
  }
}


// ═══════════════════════════════════════
// PERMISSION HELPERS
// ═══════════════════════════════════════
function hasPerm(fnId) {
  const s = SPG.api.getSession();
  if (!s) return false;
  const pl = s.position_id ? (s.position_level || 99)
    : parseInt((s.tier_id || 'T9').replace('T', ''));
  if (pl <= 2) return true; // Owner/GM
  return S.permissions.includes(fnId);
}


// ═══════════════════════════════════════
// SIDEBAR — วิธีทำ (3 ขั้นตอน)
// ═══════════════════════════════════════
//
// ขั้นตอนที่ 1: สร้าง buildSidebar() function ใน core file ของ module
//   - ใช้ helper: sdItem(), sdAccordion(), sdSub() (copy จาก template ด้านล่าง)
//   - เมนูต้อง permission-gated ด้วย hasPerm()
//   - ด้านล่างสุดต้องมี "Modules" accordion (ลิงก์ไป module อื่น)
//   - ด้านล่างสุดต้องมี Footer (version + Home link + Logout)
//
// ขั้นตอนที่ 2: ส่ง buildSidebar ตอน SPG.section() register
//   SPG.section('mymodule', {
//     buildSidebar: buildSidebar,  // ← ส่งตรงนี้!
//     routes: { ... },
//   });
//   → Core app.js จะเรียก function นี้อัตโนมัติทุกครั้งที่ navigate ใน module
//   → ไม่ต้อง hack, ไม่ต้อง setTimeout, ไม่ต้อง override DOM
//
// ขั้นตอนที่ 3: เรียก buildSidebar() ใน onLoad ของทุกหน้า
//   async function loadDashboard() {
//     await XX.initModule();
//     XX.buildSidebar();    // ← เรียกทุกหน้า
//     ...
//   }
//
// CSS Classes ที่ใช้ (อยู่ใน core/styles.css แล้ว ห้ามสร้างใหม่):
//   .sd-item / .sd-item.active       — menu item ระดับ 1
//   .sd-group / .sd-group.open       — accordion group
//   .sd-group-head / .sd-group-arr   — accordion header + arrow
//   .sd-sub / .sd-sub-item           — sub-menu items
//   .sd-divider                      — เส้นแบ่ง
//   .sd-section                      — section label (uppercase)
//   .sd-footer / .sd-version         — footer
//
// ดู bc_core.js (bakery) เป็นตัวอย่างที่ถูกต้อง
// ═══════════════════════════════════════
function buildSidebar() {
  const sd = document.querySelector('.sidebar');
  if (!sd) return;
  const cur = SPG.currentRoute;

  let html = '';

  // Dashboard
  html += sdItem('dashboard', 'Dashboard', cur);
  html += '<div class="sd-divider"></div>';

  // Module-specific menu items (permission-gated)
  let mainItems = '';
  mainItems += sdSub('page1', 'Page 1', cur);
  mainItems += sdSub('page2', 'Page 2', cur);
  html += sdAccordion('main', 'Main Menu', mainItems, cur);

  // Reports (if applicable)
  if (hasPerm('fn_view_reports')) {
    let reportItems = '';
    reportItems += sdSub('report1', 'Report 1', cur);
    html += sdAccordion('reports', 'Reports', reportItems, cur);
  }

  // ── Other Modules (always at bottom) ──
  html += '<div class="sd-divider"></div>';
  const modules = SPG.state.modules;
  if (modules) {
    let modItems = '';
    // Show other accessible modules (not this one)
    ['sales','finance','bakery','hr','purchase'].forEach(id => {
      if (id === '{this_module_id}') return; // skip self
      const map = { sales:'saledaily_report', finance:'finance', bakery:'bakery_order', hr:'hr', purchase:'purchase' };
      const mod = modules.find(m => m.module_id === map[id]);
      if (mod && mod.is_accessible && mod.status === 'active') {
        modItems += `<div class="sd-sub-item" onclick="SPG.go('${id}/dashboard')">${mod.module_name || id}</div>`;
      }
    });
    if (modItems) html += sdAccordion('modules', 'Modules', modItems, cur);
  }

  // Footer
  html += `<div class="sd-footer">
    <div class="sd-version">{XX} v1.0</div>
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

// Sidebar helpers (same pattern as Home app.js)
function sdItem(route, label, cur) {
  const active = cur === route ? ' active' : '';
  return `<div class="sd-item${active}" onclick="SPG.go('{module}/${route}')">${label}</div>`;
}
function sdAccordion(id, label, items) {
  return `<div class="sd-group" data-group="${id}">
    <div class="sd-group-head">${label}<span class="sd-group-arr">›</span></div>
    <div class="sd-sub">${items}</div>
  </div>`;
}
function sdSub(route, label, cur) {
  const active = cur === route ? ' active' : '';
  return `<div class="sd-sub-item${active}" onclick="SPG.go('{module}/${route}')">${label}</div>`;
}


// ═══════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}


// ═══════════════════════════════════════
// ROUTE REGISTRATION
// ═══════════════════════════════════════
// IMPORTANT: buildSidebar ต้องส่งตอน register
// ถ้าไม่ส่ง → จะใช้ Home sidebar (ผิด!)
SPG.section('{module}', {
  defaultRoute: 'dashboard',
  buildSidebar: buildSidebar,  // ← module's own sidebar function
  routes: {
    'dashboard': { render: (p) => XX.renderDashboard(p), onLoad: (p) => XX.loadDashboard(p) },
    'page1':     { render: (p) => XX.renderPage1(p),     onLoad: (p) => XX.loadPage1(p) },
    'page2':     { render: (p) => XX.renderPage2(p),     onLoad: (p) => XX.loadPage2(p) },
    // Sub-file routes delegate via window.XX
  },
});


// ═══════════════════════════════════════
// PUBLIC API (shared with sub-files)
// ═══════════════════════════════════════
window.XX = {
  S,
  api,
  initModule,
  buildSidebar,
  hasPerm,
  esc,
  debounce,
  // Route handlers — filled by sub-files
};

window.{Module}Section = {
  // onclick handlers for HTML
};

})();
```

---

## Template: Sub-file (copy แล้วแก้)

**ไฟล์**: `sections/{module}_xxx.js`

```javascript
/**
 * SPG HUB | {Module} — {Sub-file description}
 * Extends window.XX from {module}.js
 */

(() => {
const S = XX.S;
const api = XX.api;
const esc = XX.esc;
const ui = SPG.ui;


// ═══════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════
function renderDashboard() {
  return SPG.shell(`
    ${SPG.toolbar('Dashboard')}
    <div class="content" id="mod-content">
      ${ui.skeleton(120, 3)}
    </div>`, '{Module Name}');
}

async function loadDashboard() {
  await XX.initModule();
  if (!S.initLoaded) return;
  XX.buildSidebar();

  const el = document.getElementById('mod-content');
  if (!el) return;

  try {
    // Render dashboard content
    el.innerHTML = `<div class="grad-text" style="font-size:16px;font-weight:900">Welcome</div>`;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load', e.message);
  }
}


// ═══════════════════════════════════════
// PAGE 1 (example with table + sort)
// ═══════════════════════════════════════
function renderPage1() {
  return SPG.shell(`
    ${SPG.toolbar('Page 1')}
    <div class="content" id="p1-content">
      ${ui.skeleton(60, 6)}
    </div>`, '{Module Name}');
}

async function loadPage1() {
  await XX.initModule();
  if (!S.initLoaded) return;
  XX.buildSidebar();

  const el = document.getElementById('p1-content');
  if (!el) return;

  SPG.showLoader();
  try {
    const data = await api('{prefix}_get_items');
    const items = data.items || [];

    // Sort
    const ST = ui.getSortState('p1');
    const sorted = ui.sortData(items, ST ? ST.key : 'name', ST ? ST.dir : 'asc');

    el.innerHTML = `
      <div class="card" style="padding:0;overflow-x:auto">
        <table class="tbl">
          <thead><tr>
            ${ui.sortTh('p1', 'name', 'Name')}
            ${ui.sortTh('p1', 'store_id', 'Store')}
            ${ui.sortTh('p1', 'status', 'Status')}
          </tr></thead>
          <tbody>${sorted.map(item => `
            <tr>
              <td style="font-weight:600">${esc(item.name)}</td>
              <td>${esc(item.store_id)}</td>
              <td>${ui.badge(item.status)}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>`;
  } catch (e) {
    el.innerHTML = ui.empty('', 'Failed to load', e.message);
    SPG.toast(e.message, 'error');
  } finally {
    SPG.hideLoader();
  }
}


// ═══════════════════════════════════════
// SORT EVENT LISTENER
// ═══════════════════════════════════════
document.addEventListener('spg-sort', (e) => {
  if (e.detail.tableId === 'p1') loadPage1();
});


// ═══════════════════════════════════════
// REGISTER TO PARENT
// ═══════════════════════════════════════
XX.renderDashboard = renderDashboard;
XX.loadDashboard = loadDashboard;
XX.renderPage1 = renderPage1;
XX.loadPage1 = loadPage1;

// Expose onclick handlers
Object.assign(window.{Module}Section, {
  // add handlers here
});

})();
```

---

## Backend Template (Edge Function)

**ไฟล์**: `supabase/functions/{module}/index.ts`

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Response helpers — ALWAYS use these
function ok(d: any) {
  return new Response(JSON.stringify({ success: true, data: d }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function err(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ success: false, error: { code, message } }), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Session validation (copy from bakeryorder/index.ts — same pattern)
async function validateSession(token: string) {
  // ... (see bakeryorder for full implementation)
}

// Handlers
async function h_initBundle(session: any) {
  // Return module config, permissions, etc.
  return ok({ config: {}, permissions: session.permissions || [] });
}

// Router
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || '';
    const token = url.searchParams.get('token') || '';

    if (action === 'health') return ok({ status: 'ok', module: '{module}' });

    const session = await validateSession(token);
    if (!session) return err(401, 'INVALID_SESSION', 'กรุณา login ใหม่');

    let body: any = {};
    if (req.method === 'POST') { try { body = await req.json(); } catch { body = {}; } }

    // Strip prefix: {prefix}_get_items → get_items
    const act = action.startsWith('{prefix}_') ? action.slice({N}) : action;

    switch (act) {
      case 'init_bundle': return await h_initBundle(session);
      default: return err(400, 'UNKNOWN_ACTION', 'Unknown: ' + action);
    }
  } catch (e: any) {
    return err(500, 'SERVER_ERROR', e.message);
  }
});
```

---

## Core APIs ที่ใช้ได้ (ห้ามสร้างใหม่)

### Layout
```javascript
SPG.shell(innerHTML, sectionLabel)  // Wrap content with topbar + sidebar shell
SPG.toolbar(title, actionsHTML)     // Page title bar
SPG.showLoader() / SPG.hideLoader()
SPG.toast(message, 'success'|'error'|'info')
SPG.showDialog(html) / SPG.closeDialog()
```

### Navigation
```javascript
SPG.go('module/route')              // Navigate (hash-based)
SPG.go('module/route', { id: 'x' }) // With params
SPG.currentRoute                    // Current route string
```

### API
```javascript
SPG.api.post(endpoint, action, data) // Generic API call
SPG.api.tb(data)                     // Add token to data
SPG.api.getSession()                 // Current session object
SPG.api.getToken()                   // Current token string
```

### Permission
```javascript
SPG.perm.has(sectionId, 'admin')     // Module-level check
SPG.perm.canDo('fn_key', moduleId)   // Function-level check
SPG.perm.getUserRole()               // 'super_admin'|'admin'|'manager'|'staff'|'viewer'
```

### UI Components
```javascript
SPG.ui.skeleton(height, count)       // Loading skeleton
SPG.ui.empty(icon, title, sub)       // Empty state
SPG.ui.badge(status)                 // Status badge
SPG.ui.sortTh(tableId, key, label)   // Sortable table header
SPG.ui.sortData(array, key, dir)     // Sort array
SPG.ui.getSortState(tableId)         // Get current sort state
SPG.esc(string)                      // HTML escape
```

### CSS Classes (from core/styles.css)
```
.card          — Standard card (shadow + hover)
.kpi-card      — KPI metric (gradient top stripe)
.pill          — Filter chip (pill shape)
.btn-primary   — Gradient button (purple→pink)
.btn-outline   — Outline button
.sts-ok/warn/err/info — Status badges
.grad-text     — Gradient text
.bento-2/3/4/6 — Grid layouts
.tbl / .tbl-wrap — Tables
.fl / .fl-bar  — Filter inputs
.inp / .fg / .lb — Form inputs
```

---

## Module Theme Colors (app.js มีอยู่แล้ว)

| Module | Accent | Background |
|--------|--------|-----------|
| Home | #7C3AED | #ede9fe |
| Sales | #2563eb | #dbeafe |
| Purchase | #d97706 | #fef3c7 |
| Bakery | #db2777 | #fce7f3 |
| Finance | #7c3aed | #ede9fe |
| HR | #4f46e5 | #e0e7ff |

Theme ถูก set อัตโนมัติตอน navigate เข้า module (`setTheme()` ใน app.js)

---

## Checklist ก่อน Deploy

### Files
- [ ] `sections/{module}.js` — Core file (state, api, init, sidebar, routes)
- [ ] `sections/{module}_xxx.js` — Sub-files (render + load functions)
- [ ] `supabase/functions/{fn}/index.ts` — Backend
- [ ] `index.html` — เพิ่ม `<script src="sections/..." defer>`

### Code Quality
- [ ] ใช้ `SPG.section()` register routes
- [ ] ใช้ `SPG.shell()` + `SPG.toolbar()` ทุกหน้า
- [ ] ใช้ `SPG.api.post()` ไม่ใช้ `fetch()` ตรง
- [ ] API actions ใช้ prefix (`sd_`, `fin_` ฯลฯ)
- [ ] Backend response: `{ success: true, data: {...} }`
- [ ] ทุกตาราง มี `SPG.ui.sortTh()` + listen `spg-sort`
- [ ] ทุก `onLoad` มี `try/catch` + `SPG.toast()` on error
- [ ] มี loading state (`SPG.showLoader()` หรือ `skeleton`)
- [ ] มี `_loading` flag ป้องกัน double-call
- [ ] Search input ใช้ `debounce(fn, 300)`

### Design
- [ ] ใช้ CSS variables เท่านั้น (ไม่ hardcode สี)
- [ ] border-radius ≥ 12px (ไม่มีมุมแหลม)
- [ ] ใช้ emoji เป็น icon
- [ ] ไม่มี external font / icon library
- [ ] Responsive (test 375px mobile)

### ห้ามมี
- [ ] ❌ ไม่มี `.html` ใหม่
- [ ] ❌ ไม่มี `.css` ใหม่
- [ ] ❌ ไม่มี auth/login code
- [ ] ❌ ไม่มี admin/settings/audit routes
- [ ] ❌ ไม่มี `console.log` ใน production
