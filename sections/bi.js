/**
 * SPG HUB v2.0.0 | 21 MAR 2026 | Siam Palette Group
 * sections/bi.js — BI Dashboard Section (Shell)
 * Pure Operational Section — NO admin/settings/audit
 */
(() => {
  const esc = SPG.esc;

  function renderHome() {
    return SPG.shell(`
      ${SPG.toolbar('BI Dashboard')}
      <div class="content">
        <div style="text-align:center;padding:60px 20px">
          <div style="font-size:40px;margin-bottom:12px">BI</div>
          <div style="font-size:18px;font-weight:700;margin-bottom:8px">BI Dashboard</div>
          <div style="color:var(--t3);font-size:13px">Cross-module insights & executive view</div>
          <div style="margin-top:16px;padding:8px 16px;background:var(--theme-bg,#cffafe);color:var(--theme,#0891b2);border-radius:var(--rd);display:inline-block;font-size:12px;font-weight:600">Coming Soon</div>
        </div>
      </div>
    `, 'BI Dashboard');
  }

  SPG.section('bi', {
    defaultRoute: 'home',
    routes: {
      'home': { render: renderHome },
    },
  });
})();
