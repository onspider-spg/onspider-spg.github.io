/**
 * Bill Upload HQ v2.0 | 23 MAR 2026 | Siam Palette Group
 * Standalone bill capture for Management Team
 * Banking-app style: Login once → Setup PIN → Quick PIN access
 * v2: Business/Personal context toggle (Personal → WealthPilot)
 */

const BHQ = (() => {
  const API = 'https://ahvzblrfzhtrjhvbzdhg.supabase.co/functions/v1/billhq';
  const BHQ_TOKEN_KEY = 'bhq_token';
  const BHQ_DEVICE_KEY = 'bhq_device';
  const BHQ_USER_KEY = 'bhq_user';
  const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
  const MAX_IMG_WIDTH = 1920;
  const JPEG_QUALITY = 0.8;

  let _accounts = [];
  let _currentPhoto = null; // { base64, contentType, dataUrl }

  // v2: Context state
  let _context = 'business'; // 'business' | 'personal'
  let _tierId = null;
  let _wpConfig = null; // { wp_user_id, wp_api_url, wp_api_key }
  let _wpAccounts = [];
  let _wpBills = [];

  // ═══ API ═══
  async function api(action, data = {}) {
    const resp = await fetch(`${API}?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await resp.json();
    if (!json.success) {
      const e = new Error(json.error?.message || 'Unknown error');
      e.code = json.error?.code;
      e.key = json.error?.key;
      throw e;
    }
    return json.data;
  }

  // ═══ WP API (Personal mode) ═══
  async function wpApi(action, data = {}) {
    if (!_wpConfig) throw new Error('WealthPilot not configured');
    const resp = await fetch(`${_wpConfig.wp_api_url}?action=${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: _wpConfig.wp_api_key, wp_user_id: _wpConfig.wp_user_id, ...data }),
    });
    const json = await resp.json();
    if (!json.success) {
      const e = new Error(json.error?.message || 'Unknown error');
      e.code = json.error?.code;
      e.key = json.error?.key;
      throw e;
    }
    return json.data;
  }

  async function loadWpConfig() {
    if (_wpConfig) return _wpConfig;
    const res = await api('bhq_get_wp_config', { bhq_token: getToken() });
    _wpConfig = res;
    return res;
  }

  // ═══ Storage ═══
  function getToken() { return localStorage.getItem(BHQ_TOKEN_KEY) || ''; }
  function setToken(t) { if (t) localStorage.setItem(BHQ_TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(BHQ_TOKEN_KEY); }

  function getDevice() {
    let d = localStorage.getItem(BHQ_DEVICE_KEY);
    if (!d) { d = 'DEV-' + crypto.randomUUID().slice(0, 12); localStorage.setItem(BHQ_DEVICE_KEY, d); }
    return d;
  }

  function getUser() { try { return JSON.parse(localStorage.getItem(BHQ_USER_KEY)); } catch { return null; } }
  function setUser(u) { localStorage.setItem(BHQ_USER_KEY, JSON.stringify(u)); }
  function clearUser() { localStorage.removeItem(BHQ_USER_KEY); }

  // ═══ UI Helpers ═══
  const $ = (id) => document.getElementById(id);
  const app = () => $('app');

  function showLoader() { $('loader').classList.remove('hidden'); }
  function hideLoader() { $('loader').classList.add('hidden'); }

  let _toastTimer;
  function toast(msg, type = 'info') {
    const el = $('toast');
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function timeAgo(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'Australia/Sydney' });
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Australia/Sydney' });
  }

  // ═══ Image Processing ═══
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > MAX_IMG_WIDTH) { h = Math.round(h * MAX_IMG_WIDTH / w); w = MAX_IMG_WIDTH; }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          const base64 = dataUrl.split(',')[1];
          resolve({ base64, contentType: 'image/jpeg', dataUrl });
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ═══ SCREENS ═══

  // ── PIN Screen ──
  function renderPinScreen() {
    const user = getUser();
    let pin = '';

    app().innerHTML = `
      <div class="pin-screen">
        <div class="pin-logo">SPG</div>
        <div class="pin-title">Enter PIN</div>
        <div class="pin-subtitle">${user ? esc(user.display_name) : 'SPG Assist'}</div>
        <div class="pin-dots" id="pinDots">
          ${[0,1,2,3].map(i => `<div class="pin-dot" data-i="${i}"></div>`).join('')}
        </div>
        <div class="pin-pad" id="pinPad">
          ${[1,2,3,4,5,6,7,8,9].map(n => {
            const subs = ['','','ABC','DEF','GHI','JKL','MNO','PQRS','TUV','WXYZ'];
            return `<button class="pin-key" data-n="${n}"><span>${n}</span>${subs[n] ? `<span class="sub">${subs[n]}</span>` : ''}</button>`;
          }).join('')}
          <div class="pin-key empty"></div>
          <button class="pin-key" data-n="0"><span>0</span></button>
          <button class="pin-key" data-n="del" aria-label="Delete">✕</button>
        </div>
        <button class="pin-login-link" onclick="BHQ.showLogin()">Login with password</button>
      </div>
    `;

    $('pinPad').addEventListener('click', async (e) => {
      const btn = e.target.closest('.pin-key');
      if (!btn || btn.classList.contains('empty')) return;
      const n = btn.dataset.n;

      if (n === 'del') {
        pin = pin.slice(0, -1);
      } else if (pin.length < 4) {
        pin += n;
      }

      // Update dots
      document.querySelectorAll('.pin-dot').forEach((dot, i) => {
        dot.classList.toggle('filled', i < pin.length);
        dot.classList.remove('error');
      });

      // Auto-submit on 4 digits
      if (pin.length === 4) {
        try {
          showLoader();
          const res = await api('bhq_verify_pin', { device_token: getDevice(), pin });
          setToken(res.bhq_token);
          _tierId = res.tier_id || null;
          const prevUser = getUser();
          setUser({ ...prevUser, display_name: res.display_name || prevUser?.display_name, tier_id: _tierId });
          hideLoader();
          renderHomeScreen();
        } catch (e) {
          hideLoader();
          // Shake animation
          document.querySelectorAll('.pin-dot').forEach(d => d.classList.add('error'));
          toast(e.message, 'error');
          pin = '';
          setTimeout(() => {
            document.querySelectorAll('.pin-dot').forEach(d => { d.classList.remove('filled', 'error'); });
          }, 500);
          // If locked, go to login
          if (e.key === 'PIN_LOCKED' || e.key === 'NO_PIN_FOUND') {
            setTimeout(() => renderLoginScreen(), 1500);
          }
        }
      }
    });
  }

  // ── Login Screen ──
  function renderLoginScreen() {
    app().innerHTML = `
      <div class="login-screen">
        <div class="login-card">
          <div class="pin-logo" style="margin: 0 auto 24px;">SPG</div>
          <h2>SPG Assist</h2>
          <div class="mgmt-badge">🔒 Management Team Only</div>
          <p>Login to set up your PIN</p>
          <div class="field">
            <label>Username</label>
            <input type="text" id="loginUser" autocomplete="username" autocapitalize="off">
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" id="loginPass" autocomplete="current-password">
          </div>
          <button class="btn btn-primary" id="loginBtn">Login</button>
          <button class="btn btn-outline" onclick="BHQ.init()">Back</button>
        </div>
      </div>
    `;

    $('loginBtn').addEventListener('click', doLogin);
    $('loginPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  }

  async function doLogin() {
    const username = $('loginUser').value.trim();
    const password = $('loginPass').value;
    if (!username || !password) return toast('กรุณากรอกข้อมูลให้ครบ', 'error');

    try {
      showLoader();
      const res = await api('bhq_login', { username, password });
      hideLoader();

      _tierId = res.tier_id || null;
      setUser({ display_name: res.display_name, account_id: res.account_id, user_id: res.user_id, tier_id: _tierId });

      if (res.has_pin) {
        // Already has PIN, just re-setup with new device token
        renderSetupPinScreen(res, true);
      } else {
        // First time, setup new PIN
        renderSetupPinScreen(res, false);
      }
    } catch (e) {
      hideLoader();
      toast(e.message, 'error');
    }
  }

  // ── Setup PIN Screen ──
  function renderSetupPinScreen(loginData, isReset) {
    let pin = '';
    let confirmPin = '';
    let step = 'create'; // 'create' or 'confirm'

    app().innerHTML = `
      <div class="setup-pin-screen">
        <div class="pin-logo">SPG</div>
        <div class="pin-title" id="setupTitle">${isReset ? 'Reset your PIN' : 'Create a PIN'}</div>
        <div class="pin-subtitle" id="setupSubtitle">Enter a 4 digit passcode</div>
        <div class="pin-dots" id="setupDots">
          ${[0,1,2,3].map(i => `<div class="pin-dot" data-i="${i}"></div>`).join('')}
        </div>
        <div class="pin-pad" id="setupPad">
          ${[1,2,3,4,5,6,7,8,9].map(n => {
            const subs = ['','','ABC','DEF','GHI','JKL','MNO','PQRS','TUV','WXYZ'];
            return `<button class="pin-key" data-n="${n}"><span>${n}</span>${subs[n] ? `<span class="sub">${subs[n]}</span>` : ''}</button>`;
          }).join('')}
          <div class="pin-key empty"></div>
          <button class="pin-key" data-n="0"><span>0</span></button>
          <button class="pin-key" data-n="del" aria-label="Delete">✕</button>
        </div>
      </div>
    `;

    $('setupPad').addEventListener('click', async (e) => {
      const btn = e.target.closest('.pin-key');
      if (!btn || btn.classList.contains('empty')) return;
      const n = btn.dataset.n;

      if (step === 'create') {
        if (n === 'del') { pin = pin.slice(0, -1); }
        else if (pin.length < 4) { pin += n; }

        document.querySelectorAll('#setupDots .pin-dot').forEach((dot, i) => {
          dot.classList.toggle('filled', i < pin.length);
        });

        if (pin.length === 4) {
          setTimeout(() => {
            step = 'confirm';
            $('setupTitle').textContent = 'Confirm PIN';
            $('setupSubtitle').textContent = 'Re-enter your 4 digit passcode';
            document.querySelectorAll('#setupDots .pin-dot').forEach(d => d.classList.remove('filled'));
          }, 200);
        }
      } else {
        // Confirm step
        if (n === 'del') { confirmPin = confirmPin.slice(0, -1); }
        else if (confirmPin.length < 4) { confirmPin += n; }

        document.querySelectorAll('#setupDots .pin-dot').forEach((dot, i) => {
          dot.classList.toggle('filled', i < confirmPin.length);
        });

        if (confirmPin.length === 4) {
          if (confirmPin !== pin) {
            document.querySelectorAll('#setupDots .pin-dot').forEach(d => d.classList.add('error'));
            toast('PIN ไม่ตรงกัน ลองใหม่', 'error');
            setTimeout(() => {
              pin = '';
              confirmPin = '';
              step = 'create';
              $('setupTitle').textContent = isReset ? 'Reset your PIN' : 'Create a PIN';
              $('setupSubtitle').textContent = 'Enter a 4 digit passcode';
              document.querySelectorAll('#setupDots .pin-dot').forEach(d => { d.classList.remove('filled', 'error'); });
            }, 600);
            return;
          }

          // PINs match — save
          try {
            showLoader();
            const res = await api('bhq_setup_pin', {
              account_id: loginData.account_id,
              user_id: loginData.user_id,
              display_name: loginData.display_name,
              pin,
              device_token: getDevice(),
            });
            setToken(res.bhq_token);
            _tierId = res.tier_id || null;
            setUser({ display_name: loginData.display_name, account_id: loginData.account_id, user_id: loginData.user_id, tier_id: _tierId });
            hideLoader();
            toast('PIN set up successfully!', 'success');
            renderHomeScreen();
          } catch (e) {
            hideLoader();
            toast(e.message, 'error');
          }
        }
      }
    });
  }

  // ── Home Screen ──
  async function renderHomeScreen() {
    const user = getUser();
    const displayName = user?.display_name || 'User';
    if (!_tierId && user?.tier_id) _tierId = user.tier_id;
    const isT1 = _tierId === 'T1';
    const isPersonal = _context === 'personal';

    // Get greeting
    const h = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' })).getHours();
    const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

    const headerGrad = isPersonal ? 'style="background:linear-gradient(135deg,#0d9488,#06b6d4)"' : '';

    app().innerHTML = `
      <div class="home-screen">
        <div class="home-header" ${headerGrad}>
          <div class="home-greeting">${greeting}</div>
          <div class="home-name">${esc(displayName)}</div>
          <button class="home-logout" onclick="BHQ.logout()">Sign out</button>
        </div>

        ${isT1 ? `
        <div class="context-toggle" id="ctxToggle">
          <button class="ctx-btn ${!isPersonal ? 'active' : ''}" data-ctx="business">
            <span class="ctx-dot" style="background:var(--acc)"></span> Business
          </button>
          <button class="ctx-btn ${isPersonal ? 'active' : ''}" data-ctx="personal">
            <span class="ctx-dot" style="background:#0d9488"></span> Personal
          </button>
        </div>` : ''}

        <div class="capture-card" onclick="BHQ.showSelect()">
          <h3>Capture a receipt</h3>
          <p>${isPersonal ? 'Take or upload a personal receipt' : 'Take or upload a photo of a receipt or bill'}</p>
          <div class="icon">📸</div>
        </div>

        <div class="action-row">
          <div class="action-card-sm" onclick="BHQ.showInvoice()">
            <h4>Invoice</h4>
            <p>Create invoices on the go</p>
            <div class="plus">+</div>
          </div>
          <div class="action-card-sm" onclick="BHQ.showAlbum()">
            <h4>Uploads</h4>
            <p>View all captured receipts</p>
            <div class="plus">📋</div>
          </div>
        </div>

        <div class="album-header">
          <h3>Recent Bills ${isPersonal ? '<span class="ctx-badge personal">Personal</span>' : isT1 ? '<span class="ctx-badge biz">Business</span>' : ''}</h3>
          <a onclick="BHQ.showAlbum()">View all →</a>
        </div>
        <div id="recentBills" class="bill-grid">
          <div class="empty-state" style="grid-column: 1/-1;">
            <div class="icon">📋</div>
            <p>Loading...</p>
          </div>
        </div>

        <div class="bottom-nav">
          <div class="nav-item active"><span class="ico">🏠</span>Home</div>
          <div class="nav-item" onclick="BHQ.showAlbum()"><span class="ico">🧾</span>Receipts</div>
          <div class="nav-item" onclick="BHQ.showInvoice()"><span class="ico">💰</span>Invoices</div>
          <div class="nav-item"><span class="ico">···</span>More</div>
        </div>
      </div>
    `;

    // Context toggle click handler
    if (isT1) {
      $('ctxToggle')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.ctx-btn');
        if (!btn) return;
        const newCtx = btn.dataset.ctx;
        if (newCtx !== _context) {
          _context = newCtx;
          renderHomeScreen();
        }
      });
    }

    // Load recent bills
    try {
      if (isPersonal) {
        await loadWpConfig();
        const res = await wpApi('get_receipts', { limit: 9 });
        const mapped = (res.receipts || []).map(r => ({
          id: r.id,
          account_name: r.account_name || r.merchant || 'Personal',
          photo_url: r.image_url,
          note: r.merchant,
          captured_at: r.created_at,
          linked: r.status === 'matched',
        }));
        renderBillGrid('recentBills', mapped);
      } else {
        const res = await api('bhq_get_my_uploads', { bhq_token: getToken(), limit: 9 });
        renderBillGrid('recentBills', res.bills);
      }
    } catch (e) {
      if (e.key === 'SESSION_EXPIRED' || e.key === 'SESSION_NOT_FOUND') {
        clearToken();
        renderPinScreen();
        return;
      }
      $('recentBills').innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">⚠️</div><p>${esc(e.message)}</p></div>`;
    }
  }

  function renderBillGrid(containerId, bills) {
    const container = $(containerId);
    if (!bills || bills.length === 0) {
      container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">📋</div><p>No bills captured yet</p></div>`;
      return;
    }
    container.innerHTML = bills.map(b => `
      <div class="bill-thumb" onclick="BHQ.showBillDetail(${JSON.stringify(b).replace(/"/g, '&quot;')})">
        <img src="${esc(b.photo_url)}" alt="Bill" loading="lazy">
        <div class="meta">
          <div>${esc(b.account_name)}</div>
          <div>${timeAgo(b.captured_at)}</div>
        </div>
      </div>
    `).join('');
  }

  // ── Select Card Screen (dedicated page) ──
  async function renderSelectScreen() {
    const isPersonal = _context === 'personal';
    const badgeHtml = isPersonal ? '<span class="ctx-badge personal" style="font-size:10px;padding:3px 10px">Personal</span>' : '<span class="ctx-badge biz" style="font-size:10px;padding:3px 10px">Biz</span>';

    app().innerHTML = `
      <div class="select-screen">
        <div class="select-topbar">
          <button class="back" onclick="BHQ.renderHomeScreen()">←</button>
          <h2>Capture Receipt</h2>
          ${badgeHtml}
        </div>
        <div class="select-body">
          <div class="heading">Select a card:</div>
          <div class="sub-text">Which card or account was used for this purchase?</div>
          <div class="account-list" id="selectAccountList">
            <div class="empty-state"><p>Loading accounts...</p></div>
          </div>
        </div>
      </div>
    `;

    try {
      let accounts = [];
      if (isPersonal) {
        await loadWpConfig();
        if (_wpAccounts.length === 0) {
          const res = await wpApi('get_accounts');
          _wpAccounts = res.accounts || [];
        }
        accounts = _wpAccounts.map(a => ({
          id: a.id,
          name: a.name + (a.bank_name ? ' · ' + a.bank_name : ''),
          desc: a.account_type === 'credit_card' ? 'Credit card' : a.account_type === 'savings' ? 'Savings account' : 'Everyday account',
          initials: (a.name || '').substring(0, 2).toUpperCase(),
          color: a.color || '#0d9488',
        }));
      } else {
        if (_accounts.length === 0) {
          const res = await api('bhq_get_accounts');
          _accounts = res.accounts || [];
        }
        const colors = ['linear-gradient(135deg,#7C3AED,#EC4899)', 'linear-gradient(135deg,#F59E0B,#EC4899)', 'linear-gradient(135deg,#10B981,#06B6D4)', 'linear-gradient(135deg,#3B82F6,#7C3AED)'];
        accounts = _accounts.map((a, i) => ({
          id: a.id,
          name: a.account_name,
          desc: 'Payment account',
          initials: (a.account_name || '').substring(0, 2).toUpperCase(),
          color: colors[i % colors.length],
        }));
      }

      const listEl = $('selectAccountList');
      if (accounts.length === 0) {
        listEl.innerHTML = '<div class="empty-state"><p>No accounts found</p></div>';
        return;
      }
      listEl.innerHTML = accounts.map(a => `
        <div class="account-item" data-id="${a.id}">
          <div class="av" style="background:${a.color}">${esc(a.initials)}</div>
          <div class="info"><div class="name">${esc(a.name)}</div><div class="desc">${esc(a.desc)}</div></div>
          <div class="arrow">›</div>
        </div>
      `).join('');

      listEl.addEventListener('click', (e) => {
        const item = e.target.closest('.account-item');
        if (!item) return;
        const id = item.dataset.id;
        const name = item.querySelector('.name')?.textContent || '';
        renderCaptureScreen(id, name);
      });
    } catch (e) {
      $('selectAccountList').innerHTML = `<div class="empty-state"><p>${esc(e.message)}</p></div>`;
    }
  }

  // ── Install Guide Screen ──
  function renderInstallScreen() {
    const ua = navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua);
    const isAndroid = /Android/.test(ua);
    const isSafari = isIOS && /Safari/.test(ua) && !/CriOS|Chrome|FxiOS|EdgiOS/.test(ua);
    const isIOSChrome = isIOS && /CriOS/.test(ua);

    // Detect platform for display + instructions
    let platform, deviceIcon, steps;
    if (isIOS && isSafari) {
      platform = 'iPhone · Safari';
      deviceIcon = '📱';
      steps = `
        <div class="install-step"><div class="step-num">1</div><div class="step-content"><div class="s-title">Tap the Share button</div><div class="s-desc">Tap <span class="key">⬆︎</span> at the bottom of Safari</div></div></div>
        <div class="install-step"><div class="step-num">2</div><div class="step-content"><div class="s-title">Scroll down and tap</div><div class="s-desc">Find <span class="hl">"Add to Home Screen"</span> in the share menu</div></div></div>
        <div class="install-step"><div class="step-num">3</div><div class="step-content"><div class="s-title">Tap "Add"</div><div class="s-desc">Confirm the name <span class="key">SPG Assist</span> and tap <span class="hl">Add</span></div></div></div>
        <div class="install-step"><div class="step-num">4</div><div class="step-content"><div class="s-title">Open from Home Screen</div><div class="s-desc">Close Safari and open <span class="key">SPG Assist</span> from your Home Screen</div></div></div>`;
    } else if (isIOSChrome) {
      platform = 'iPhone · Chrome';
      deviceIcon = '📱';
      steps = `
        <div class="install-step"><div class="step-num">1</div><div class="step-content"><div class="s-title">Open in Safari</div><div class="s-desc">Chrome on iPhone doesn't support installing apps. Copy this link and open it in <span class="hl">Safari</span></div></div></div>
        <div class="install-step"><div class="step-num">2</div><div class="step-content"><div class="s-title">Tap the Share button</div><div class="s-desc">In Safari, tap <span class="key">⬆︎</span> at the bottom</div></div></div>
        <div class="install-step"><div class="step-num">3</div><div class="step-content"><div class="s-title">Add to Home Screen</div><div class="s-desc">Find <span class="hl">"Add to Home Screen"</span> and tap <span class="hl">Add</span></div></div></div>
        <div class="install-step"><div class="step-num">4</div><div class="step-content"><div class="s-title">Open from Home Screen</div><div class="s-desc">Open <span class="key">SPG Assist</span> from your Home Screen</div></div></div>`;
    } else if (isAndroid) {
      platform = 'Android · Chrome';
      deviceIcon = '📱';
      steps = `
        <div class="install-step"><div class="step-num">1</div><div class="step-content"><div class="s-title">Tap the menu</div><div class="s-desc">Tap <span class="key">⋮</span> in the top-right of Chrome</div></div></div>
        <div class="install-step"><div class="step-num">2</div><div class="step-content"><div class="s-title">Tap "Add to Home screen"</div><div class="s-desc">Find <span class="hl">"Add to Home screen"</span> or <span class="hl">"Install app"</span></div></div></div>
        <div class="install-step"><div class="step-num">3</div><div class="step-content"><div class="s-title">Confirm</div><div class="s-desc">Tap <span class="hl">Add</span> to install</div></div></div>
        <div class="install-step"><div class="step-num">4</div><div class="step-content"><div class="s-title">Open from Home Screen</div><div class="s-desc">Close Chrome and open <span class="key">SPG Assist</span> from your Home Screen</div></div></div>`;
    } else {
      // Desktop or unknown
      platform = 'Desktop';
      deviceIcon = '💻';
      steps = `
        <div class="install-step"><div class="step-num">1</div><div class="step-content"><div class="s-title">Open on your phone</div><div class="s-desc">Visit <span class="hl">spghub.app/bill.html</span> on your iPhone or Android phone</div></div></div>
        <div class="install-step"><div class="step-num">2</div><div class="step-content"><div class="s-title">Install the app</div><div class="s-desc">Follow the on-screen instructions to add to your Home Screen</div></div></div>
        <div class="install-step"><div class="step-num">3</div><div class="step-content"><div class="s-title">Use anytime</div><div class="s-desc">Open <span class="key">SPG Assist</span> from your Home Screen to capture receipts on the go</div></div></div>`;
    }

    app().innerHTML = `
      <div class="install-screen">
        <div class="install-header">
          <div class="inst-logo">SPG</div>
          <h1>SPG Assist</h1>
          <p>Install app to get started</p>
        </div>
        <div class="install-body">
          <div class="install-detect">
            <div class="device-icon">${deviceIcon}</div>
            <div class="device-info">
              <div class="name">${platform}</div>
              <div class="detail">Detected automatically</div>
            </div>
            <div class="check">✓</div>
          </div>
          <div class="install-title">${platform === 'Desktop' ? 'Use on Mobile' : 'Add to Home Screen'}</div>
          <div class="install-steps">${steps}</div>
          <div class="install-note">
            <strong>⚠ Why is this needed?</strong><br>
            Installing as an app enables full-screen mode, better camera access, and a native app experience. This only needs to be done once.
          </div>
        </div>
        <div class="install-footer">
          <button class="btn btn-primary" onclick="BHQ.dismissInstall()">I've installed it →</button>
          <div class="install-skip"><a onclick="BHQ.dismissInstall()">Skip for now</a></div>
        </div>
      </div>
    `;
  }

  function dismissInstall() {
    localStorage.setItem('bhq_installed', '1');
    init();
  }

  // ── Invoice Screen (placeholder) ──
  function renderInvoiceScreen() {
    app().innerHTML = `
      <div class="invoice-screen">
        <div class="invoice-topbar">
          <button class="back" onclick="BHQ.renderHomeScreen()">✕</button>
          <h2>Create invoice</h2>
          <div style="width:32px"></div>
        </div>
        <div class="invoice-body">
          <div class="invoice-row"><span class="label">Customer</span><span class="value">Choose ›</span></div>
          <div class="invoice-divider"></div>
          <div class="invoice-section-title">Details</div>
          <div class="invoice-row"><span class="label">Invoice number</span><span class="value mute">INV-00001</span></div>
          <div class="invoice-row"><span class="label">Issue date</span><span class="value mute">${new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
          <div class="invoice-row"><span class="label">Due date</span><span class="value mute">—</span></div>
          <div class="invoice-row"><span class="label">Payment terms</span><span class="value">14 days ›</span></div>
          <div class="invoice-divider"></div>
          <div class="invoice-section-title">Products and services</div>
          <div style="padding:14px 0;text-align:center">
            <button class="btn btn-outline" style="display:inline-flex;align-items:center;gap:6px;width:auto;padding:10px 18px;font-size:12px;color:var(--acc);border-color:rgba(124,58,237,.2)">+ Add item</button>
          </div>
          <div class="invoice-divider"></div>
          <div style="display:flex;justify-content:space-between;padding:12px 0;font-size:14px"><span style="font-weight:600">Total</span><span style="font-weight:900;font-size:20px">$0.00</span></div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:#8A8AAA;padding-bottom:8px"><span>Tax</span><span>$0.00</span></div>
          <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:900;padding:12px 0;border-top:2px solid #F1F3F9"><span>Balance due</span><span>$0.00</span></div>
          <div style="padding:16px 0;display:flex;flex-direction:column;gap:8px">
            <button class="btn btn-primary">Send</button>
            <button class="btn btn-outline">Save</button>
          </div>
        </div>
      </div>
    `;
  }

  // ── Capture Screen ──
  let _selectedAccountId = null;
  let _selectedAccountName = null;

  function renderCaptureScreen(selectedAccountId, selectedAccountName) {
    _currentPhoto = null;
    if (selectedAccountId) _selectedAccountId = selectedAccountId;
    if (selectedAccountName) _selectedAccountName = selectedAccountName;

    const acctBadge = _selectedAccountName ? `<span style="padding:4px 12px;border-radius:50px;font-size:10px;font-weight:700;background:rgba(124,58,237,.06);color:var(--acc)">${esc(_selectedAccountName)}</span>` : '<div style="width:32px"></div>';

    app().innerHTML = `
      <div class="capture-screen">
        <div class="capture-topbar">
          <button class="back" onclick="BHQ.showSelect()">←</button>
          <h2>Capture Receipt</h2>
          ${acctBadge}
        </div>
        <div class="capture-body">
          <div class="photo-area">
            <div id="photoDropzone" class="photo-dropzone" onclick="BHQ._triggerPhoto()">
              <div class="cam-icon">📷</div>
              <p>Tap to scan or upload</p>
              <div class="hint">Scan Document · Camera · Photo Library</div>
            </div>
            <div id="photoPreview" class="photo-preview hidden"></div>
          </div>

          <div class="note-field">
            <label>Add notes (optional)</label>
            <textarea id="captureNote" placeholder="e.g. Bought vegetables for ISH" maxlength="200"></textarea>
            <div class="char-count"><span id="noteCount">0</span>/200</div>
          </div>

          <button class="btn btn-primary" id="saveBtn" disabled>Done</button>
        </div>
      </div>
    `;

    // Note char count
    $('captureNote').addEventListener('input', () => {
      $('noteCount').textContent = $('captureNote').value.length;
    });

    // Save button
    $('saveBtn').addEventListener('click', doSaveBill);

    // File inputs
    $('fileInput').onchange = handleFileSelect;
    $('cameraInput').onchange = handleFileSelect;
  }

  async function loadAccounts() {
    try {
      const sel = $('captureAccount');
      if (!sel) return;

      if (_context === 'personal') {
        await loadWpConfig();
        const res = await wpApi('get_accounts');
        _wpAccounts = res.accounts || [];
        _wpAccounts.forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.id;
          opt.textContent = `${a.name}${a.bank_name ? ' · ' + a.bank_name : ''}`;
          sel.appendChild(opt);
        });
      } else {
        const res = await api('bhq_get_accounts');
        _accounts = res.accounts || [];
        _accounts.forEach(a => {
          const opt = document.createElement('option');
          opt.value = a.id;
          opt.textContent = a.account_name;
          sel.appendChild(opt);
        });
      }
    } catch (e) {
      toast('Failed to load accounts', 'error');
    }
  }

  function _triggerPhoto() {
    // Show action sheet with 3 options
    const existing = document.querySelector('.photo-action-sheet');
    if (existing) existing.remove();

    const sheet = document.createElement('div');
    sheet.className = 'photo-action-sheet';
    sheet.innerHTML = `
      <div class="sheet-overlay"></div>
      <div class="sheet-content">
        <div class="sheet-title">Add a photo</div>
        <button class="sheet-btn" data-action="scan">📄 Scan Document</button>
        <button class="sheet-btn" data-action="camera">📸 Take Photo</button>
        <button class="sheet-btn" data-action="gallery">🖼️ Choose from Library</button>
        <button class="sheet-btn cancel">Cancel</button>
      </div>
    `;
    document.body.appendChild(sheet);

    // Animate in
    requestAnimationFrame(() => sheet.classList.add('show'));

    const close = () => { sheet.classList.remove('show'); setTimeout(() => sheet.remove(), 200); };

    sheet.querySelector('.sheet-overlay').onclick = close;
    sheet.querySelector('.cancel').onclick = close;

    sheet.querySelectorAll('.sheet-btn[data-action]').forEach(btn => {
      btn.onclick = () => {
        close();
        const action = btn.dataset.action;
        if (action === 'camera') {
          // Camera only (no capture attr on fileInput to force camera)
          $('cameraInput').setAttribute('capture', 'environment');
          $('cameraInput').click();
        } else if (action === 'scan') {
          // On iOS, file input without capture opens document scanner option
          $('fileInput').click();
        } else {
          // Gallery / file picker
          $('cameraInput').removeAttribute('capture');
          $('cameraInput').click();
        }
      };
    });
  }

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset

    if (file.size > MAX_FILE_SIZE) {
      toast('File too large (max 8MB)', 'error');
      return;
    }

    try {
      showLoader();
      const result = await compressImage(file);
      _currentPhoto = result;
      hideLoader();

      // Show preview
      $('photoDropzone').classList.add('hidden');
      const preview = $('photoPreview');
      preview.classList.remove('hidden');
      preview.innerHTML = `
        <img src="${result.dataUrl}" alt="Bill preview">
        <button class="remove" onclick="BHQ._removePhoto()" title="Remove">✕</button>
        <button class="retry" onclick="BHQ._retakePhoto()">Retry</button>
      `;

      // Enable save
      updateSaveBtn();
    } catch (e) {
      hideLoader();
      toast('Failed to process image', 'error');
    }
  }

  function _removePhoto() {
    _currentPhoto = null;
    $('photoDropzone').classList.remove('hidden');
    $('photoPreview').classList.add('hidden');
    $('photoPreview').innerHTML = '';
    updateSaveBtn();
  }

  function _retakePhoto() {
    _removePhoto();
    _triggerPhoto();
  }

  function updateSaveBtn() {
    const hasPhoto = !!_currentPhoto;
    const btn = $('saveBtn');
    if (btn) btn.disabled = !hasPhoto;
  }

  async function doSaveBill() {
    const accountId = _selectedAccountId;
    const note = $('captureNote').value.trim();
    if (!accountId || !_currentPhoto) return;

    try {
      showLoader();
      let res;
      if (_context === 'personal') {
        await loadWpConfig();
        res = await wpApi('upload', {
          photo_base64: _currentPhoto.base64,
          content_type: _currentPhoto.contentType,
          account_id: accountId,
          note: note || null,
        });
      } else {
        res = await api('bhq_upload_bill', {
          bhq_token: getToken(),
          payment_account_id: accountId,
          photo_base64: _currentPhoto.base64,
          content_type: _currentPhoto.contentType,
          note: note || null,
        });
      }
      hideLoader();
      renderSuccessScreen(res);
    } catch (e) {
      hideLoader();
      if (e.key === 'SESSION_EXPIRED' || e.key === 'SESSION_NOT_FOUND') {
        clearToken();
        toast('Session expired, please login again', 'error');
        renderPinScreen();
        return;
      }
      toast(e.message, 'error');
    }
  }

  // ── Success Screen ──
  function renderSuccessScreen(result) {
    const isPersonal = _context === 'personal';
    const destBadge = isPersonal
      ? '<div class="success-dest personal">Saved to WealthPilot Receipts</div>'
      : '<div class="success-dest biz">Saved to SPG Finance Uploads</div>';
    const btnStyle = isPersonal ? 'style="margin-bottom:12px;background:linear-gradient(135deg,#0d9488,#06b6d4)"' : 'style="margin-bottom:12px"';

    app().innerHTML = `
      <div class="success-screen">
        <div class="success-icon">✅</div>
        <h2>Receipt captured</h2>
        ${destBadge}
        <button class="btn btn-primary" onclick="BHQ.showCapture()" ${btnStyle}>Capture another receipt</button>
        <button class="btn btn-outline" onclick="BHQ.renderHomeScreen()" style="max-width:280px">Back to Home</button>
      </div>
    `;
  }

  // ── Album Screen ──
  async function renderAlbumScreen() {
    const isPersonal = _context === 'personal';

    app().innerHTML = `
      <div class="album-screen">
        <div class="album-topbar">
          <button class="back" onclick="BHQ.renderHomeScreen()">←</button>
          <h2>All Uploads ${isPersonal ? '<span class="ctx-badge personal" style="font-size:9px;vertical-align:middle">Personal</span>' : ''}</h2>
          <div style="width:32px"></div>
        </div>
        <div class="album-filters" id="albumFilters"></div>
        <div id="albumGrid" class="bill-grid" style="padding-top:8px;">
          <div class="empty-state" style="grid-column:1/-1;"><div class="icon">📋</div><p>Loading...</p></div>
        </div>
      </div>
    `;

    // Load accounts for filter chips
    try {
      if (isPersonal) {
        await loadWpConfig();
        if (_wpAccounts.length === 0) {
          const res = await wpApi('get_accounts');
          _wpAccounts = res.accounts || [];
        }
        const filters = $('albumFilters');
        filters.innerHTML = `<div class="filter-chip active" data-filter="all">All</div>` +
          _wpAccounts.map(a => `<div class="filter-chip" data-filter="${a.id}">${esc(a.name)}</div>`).join('');
      } else {
        if (_accounts.length === 0) {
          const res = await api('bhq_get_accounts');
          _accounts = res.accounts || [];
        }
        const filters = $('albumFilters');
        filters.innerHTML = `<div class="filter-chip active" data-filter="all">All</div>` +
          _accounts.map(a => `<div class="filter-chip" data-filter="${a.id}">${esc(a.account_name)}</div>`).join('');
      }

      $('albumFilters').addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        loadAlbumBills(chip.dataset.filter === 'all' ? null : chip.dataset.filter);
      });
    } catch (_) {}

    loadAlbumBills();
  }

  async function loadAlbumBills(accountFilter) {
    const isPersonal = _context === 'personal';
    try {
      if (isPersonal) {
        await loadWpConfig();
        const res = await wpApi('get_receipts', { limit: 50 });
        let bills = (res.receipts || []).map(r => ({
          id: r.id,
          account_name: r.account_name || r.merchant || 'Personal',
          photo_url: r.image_url,
          note: r.merchant,
          captured_at: r.created_at,
          linked: r.status === 'matched',
        }));
        // Client-side account filter for personal (by matching account_name)
        if (accountFilter) {
          const acct = _wpAccounts.find(a => a.id === accountFilter);
          if (acct) bills = bills.filter(b => b.account_name === acct.name);
        }
        renderBillGrid('albumGrid', bills);
      } else {
        const params = { bhq_token: getToken(), limit: 50 };
        if (accountFilter) params.payment_account_id = accountFilter;
        const res = await api('bhq_get_all_uploads', params);
        renderBillGrid('albumGrid', res.bills);
      }
    } catch (e) {
      if (e.key === 'SESSION_EXPIRED' || e.key === 'SESSION_NOT_FOUND') {
        clearToken();
        renderPinScreen();
        return;
      }
      $('albumGrid').innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon">⚠️</div><p>${esc(e.message)}</p></div>`;
    }
  }

  // ── Bill Detail (Lightbox) ──
  function showBillDetail(bill) {
    const overlay = document.createElement('div');
    overlay.className = 'lightbox';
    overlay.innerHTML = `
      <button class="close" onclick="this.parentElement.remove()">✕</button>
      <img src="${esc(bill.photo_url)}" alt="Bill">
      <div class="info">
        <div><strong>${esc(bill.account_name)}</strong></div>
        ${bill.note ? `<div style="margin-top:4px">${esc(bill.note)}</div>` : ''}
        <div style="margin-top:4px;opacity:.7">${fmtDate(bill.captured_at)}${bill.display_name ? ' · ' + esc(bill.display_name) : ''}</div>
      </div>
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  // ── Logout ──
  function logout() {
    clearToken();
    clearUser();
    localStorage.removeItem(BHQ_DEVICE_KEY);
    toast('Signed out', 'info');
    renderLoginScreen();
  }

  // ═══ INIT ═══
  function init() {
    const hasDevice = localStorage.getItem(BHQ_DEVICE_KEY);
    const hasToken = getToken();
    const storedUser = getUser();
    if (storedUser?.tier_id) _tierId = storedUser.tier_id;
    const hasInstalled = localStorage.getItem('bhq_installed');

    // Check if running as PWA (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    if (!hasInstalled && !isStandalone && !hasDevice) {
      // First time in browser → show install guide
      renderInstallScreen();
      return;
    }

    if (hasToken) {
      renderHomeScreen();
    } else if (hasDevice) {
      renderPinScreen();
    } else {
      renderLoginScreen();
    }
  }

  // Start
  init();

  // ═══ PUBLIC API ═══
  return {
    init,
    showLogin: renderLoginScreen,
    showSelect: renderSelectScreen,
    showCapture: renderCaptureScreen,
    showAlbum: renderAlbumScreen,
    showInvoice: renderInvoiceScreen,
    showBillDetail,
    renderHomeScreen,
    dismissInstall,
    logout,
    _triggerPhoto,
    _removePhoto,
    _retakePhoto,
  };
})();
