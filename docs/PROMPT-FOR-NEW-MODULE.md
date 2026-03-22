# Prompt Instruction สำหรับสร้าง Module ใหม่ใน SPG HUB

> **Copy prompt ข้างล่างนี้ทั้งก้อน** แล้ววางให้ AI (Claude / ChatGPT) เพื่อเริ่มสร้าง module ใหม่
> แก้ `{MODULE_NAME}`, `{module}`, `{prefix}` ตามที่ต้องการ

---

## Prompt (copy ทั้งหมด)

```
คุณกำลังจะสร้าง module "{MODULE_NAME}" สำหรับระบบ SPG HUB

ก่อนเริ่มเขียนโค้ด คุณต้องอ่านไฟล์เหล่านี้ตามลำดับ:

### Step 1: อ่าน Architecture & Rules (อ่านทั้งหมด ห้ามข้าม)
1. @/Users/onjaijang/SPG HUB/Central Hub Guideline/MODULE-DEV-GUIDE.md — อ่านทั้งหมด นี่คือ guide หลัก มี template สำหรับ copy, ❌ ห้ามทำ, ✅ ต้องทำ, checklist
2. @/Users/onjaijang/SPG HUB/Central Hub Guideline/DEV-MANUAL.md — อ่านส่วน Architecture, Permission System, API Pattern
3. @/Users/onjaijang/SPG HUB/docs/SPG_HUB_Design_Guide_GenZ_v2.docx — อ่านเรื่อง UI design: สี, font, components, do/don't

### Step 2: อ่าน Reference Module (Bakery = ตัวอย่างที่ถูกต้อง)
4. @/Users/onjaijang/SPG HUB/onspider-spg.github.io/sections/bakery.js — ดู pattern: state, api wrapper, init, sidebar, route registration, window.BK
5. อ่าน bakery_store.js, bakery_bc.js (แค่ 50 บรรทัดแรก) — ดูวิธี sub-file register render/load functions เข้า BK

### Step 3: อ่าน Core ที่ใช้ร่วมกัน
6. @/Users/onjaijang/SPG HUB/onspider-spg.github.io/core/app.js — ดู SPG.section(), SPG.shell(), SPG.toolbar(), SPG.go(), buildSidebar pattern
7. @/Users/onjaijang/SPG HUB/onspider-spg.github.io/core/api.js — ดู ENDPOINTS object, SPG.api.post(), SPG.api.tb()
8. @/Users/onjaijang/SPG HUB/onspider-spg.github.io/core/components.js — ดู SPG.ui.sortTh(), SPG.ui.sortData(), SPG.ui.badge(), SPG.ui.empty(), SPG.ui.skeleton()
9. @/Users/onjaijang/SPG HUB/onspider-spg.github.io/core/styles.css — ดู CSS variables (:root section), Gen Z component classes (.kpi-card, .pill, .grad-text, .bento-*)
10. @/Users/onjaijang/SPG HUB/onspider-spg.github.io/core/permission.js — ดู SPG.perm.canDo(), SPG.perm.has()

### Step 4: อ่าน Backend Reference
11. @/Users/onjaijang/SPG HUB/supabase/functions/bakeryorder/index.ts — ดู pattern: validateSession, ok()/err() response, switch router, prefix stripping

### Step 5: เช็ค index.html
12. @/Users/onjaijang/SPG HUB/onspider-spg.github.io/index.html — ดูว่า script tags เรียงยังไง, เพิ่มไฟล์ใหม่ตรงไหน

---

หลังอ่านครบแล้ว ให้:
1. สร้าง sections/{module}.js — core file (copy template จาก MODULE-DEV-GUIDE.md แล้วแก้)
2. สร้าง sections/{module}_xxx.js — sub-files ตามจำนวนหน้า
3. สร้าง supabase/functions/{fn}/index.ts — backend
4. เพิ่ม <script> tags ใน index.html
5. เช็ค checklist ท้าย MODULE-DEV-GUIDE.md ทุกข้อ

กฎสำคัญ:
- ห้ามสร้าง .html, .css, auth, router ใหม่ — ใช้ของ core เท่านั้น
- Sidebar: สร้าง buildSidebar() function แล้วส่งใน SPG.section('xxx', { buildSidebar: buildSidebar, ... })
  → Core จะเรียกให้อัตโนมัติ ห้าม override DOM เอง
  → ดู bakery.js buildBakerySidebar() เป็นตัวอย่าง
- ทุกหน้าต้อง wrap ด้วย SPG.shell() + SPG.toolbar()
- API ใช้ SPG.api.post('{endpoint}', '{prefix}_action', SPG.api.tb(data))
- Permission ใช้ SPG.perm.canDo() ไม่สร้างระบบใหม่
- UI ใช้ CSS variables + Gen Z components จาก core/styles.css
- ตารางทุกตัวต้องมี sort arrows (SPG.ui.sortTh)
- ทุก onLoad ต้องมี try/catch + SPG.toast() on error
```

---

## ตัวอย่าง Prompt สำหรับแต่ละ Module

### Sales Daily
```
คุณกำลังจะสร้าง module "Sales Daily" สำหรับระบบ SPG HUB
- Section ID: sales
- API Endpoint key: sales
- Action Prefix: sd_
- Theme: Blue #2563eb
- Sub-files: sales.js (core), sales_daily.js (daily entry), sales_report.js (reports)
[แล้วตามด้วย prompt ข้างบน]
```

### Finance
```
คุณกำลังจะสร้าง module "Finance" สำหรับระบบ SPG HUB
- Section ID: finance
- API Endpoint key: finance
- Action Prefix: fin_
- Theme: Purple #7c3aed
- Sub-files: finance.js (core), finance_transactions.js, finance_payroll.js, finance_reports.js
[แล้วตามด้วย prompt ข้างบน]
```

### HR
```
คุณกำลังจะสร้าง module "HR" สำหรับระบบ SPG HUB
- Section ID: hr
- API Endpoint key: hr
- Action Prefix: hr_
- Theme: Indigo #4f46e5
- Sub-files: hr.js (core), hr_employees.js, hr_roster.js, hr_attendance.js, hr_reports.js
[แล้วตามด้วย prompt ข้างบน]
```

---

## หมายเหตุ

- ไฟล์ที่ต้องอ่าน **12 ไฟล์** — ใช้เวลาอ่านประมาณ 5-10 นาที
- Module ที่เป็นตัวอย่างที่ดีที่สุดคือ **Bakery** (`bakery.js` + sub-files)
- ถ้า AI สร้าง `.html` ใหม่ หรือ `.css` ใหม่ = **ผิด** ให้แก้ทันที
- ถ้า AI สร้าง `fetch()` ตรงแทน `SPG.api.post()` = **ผิด** ให้แก้ทันที
