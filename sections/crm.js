/**
 * SPG HUB v2.0.0 | 21 MAR 2026 | Siam Palette Group
 * sections/crm.js — CRM Section (Shell)
 * Pure Operational Section — NO admin/settings/audit
 */
(() => {
  const esc = SPG.esc;

  function renderHome() {
    return SPG.shell(`
      ${SPG.toolbar('CRM')}
      <div class="content">
        <div style="text-align:center;padding:60px 20px">
          <div style="font-size:40px;margin-bottom:12px">CR</div>
          <div style="font-size:18px;font-weight:700;margin-bottom:8px">CRM</div>
          <div style="color:var(--t3);font-size:13px">Customer relationship management</div>
          <div style="margin-top:16px;padding:8px 16px;background:var(--theme-bg,#ede9fe);color:var(--theme,#8b5cf6);border-radius:var(--rd);display:inline-block;font-size:12px;font-weight:600">Coming Soon</div>
        </div>
      </div>
    `, 'CRM');
  }

  SPG.section('crm', {
    defaultRoute: 'home',
    routes: {
      'home': { render: renderHome },
    },
  });
})();
