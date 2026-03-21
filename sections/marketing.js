/**
 * SPG HUB v2.0.0 | 21 MAR 2026 | Siam Palette Group
 * sections/marketing.js — Marketing Section (Shell)
 * Pure Operational Section — NO admin/settings/audit
 */
(() => {
  const esc = SPG.esc;

  function renderHome() {
    return SPG.shell(`
      ${SPG.toolbar('Marketing')}
      <div class="content">
        <div style="text-align:center;padding:60px 20px">
          <div style="font-size:40px;margin-bottom:12px">MK</div>
          <div style="font-size:18px;font-weight:700;margin-bottom:8px">Marketing</div>
          <div style="color:var(--t3);font-size:13px">Sales analysis & product direction</div>
          <div style="margin-top:16px;padding:8px 16px;background:var(--theme-bg,#ffe4e6);color:var(--theme,#e11d48);border-radius:var(--rd);display:inline-block;font-size:12px;font-weight:600">Coming Soon</div>
        </div>
      </div>
    `, 'Marketing');
  }

  SPG.section('marketing', {
    defaultRoute: 'home',
    routes: {
      'home': { render: renderHome },
    },
  });
})();
