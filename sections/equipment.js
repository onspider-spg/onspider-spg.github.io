/**
 * SPG HUB v2.0.0 | 21 MAR 2026 | Siam Palette Group
 * sections/equipment.js — Equipment Section (Shell)
 * Pure Operational Section — NO admin/settings/audit
 */
(() => {
  const esc = SPG.esc;

  function renderHome() {
    return SPG.shell(`
      ${SPG.toolbar('Equipment')}
      <div class="content">
        <div style="text-align:center;padding:60px 20px">
          <div style="font-size:40px;margin-bottom:12px">EQ</div>
          <div style="font-size:18px;font-weight:700;margin-bottom:8px">Equipment</div>
          <div style="color:var(--t3);font-size:13px">Asset tracking & repair history</div>
          <div style="margin-top:16px;padding:8px 16px;background:var(--theme-bg,#f1f5f9);color:var(--theme,#475569);border-radius:var(--rd);display:inline-block;font-size:12px;font-weight:600">Coming Soon</div>
        </div>
      </div>
    `, 'Equipment');
  }

  SPG.section('equipment', {
    defaultRoute: 'home',
    routes: {
      'home': { render: renderHome },
    },
  });
})();
