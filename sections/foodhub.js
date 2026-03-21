/**
 * SPG HUB v2.0.0 | 21 MAR 2026 | Siam Palette Group
 * sections/foodhub.js — Food Hub Section (Shell)
 * Pure Operational Section — NO admin/settings/audit
 */
(() => {
  const esc = SPG.esc;

  function renderHome() {
    return SPG.shell(`
      ${SPG.toolbar('Food Hub')}
      <div class="content">
        <div style="text-align:center;padding:60px 20px">
          <div style="font-size:40px;margin-bottom:12px">FH</div>
          <div style="font-size:18px;font-weight:700;margin-bottom:8px">Food Hub</div>
          <div style="color:var(--t3);font-size:13px">Recipes, SOP & training content</div>
          <div style="margin-top:16px;padding:8px 16px;background:var(--theme-bg,#dcfce7);color:var(--theme,#16a34a);border-radius:var(--rd);display:inline-block;font-size:12px;font-weight:600">Coming Soon</div>
        </div>
      </div>
    `, 'Food Hub');
  }

  SPG.section('foodhub', {
    defaultRoute: 'home',
    routes: {
      'home': { render: renderHome },
    },
  });
})();
