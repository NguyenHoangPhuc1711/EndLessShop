/* Same auth API/CSRF/HttpOnly session; only account UI and safe return navigation. */
(function () {
  'use strict';
  let user = null;
  let csrfToken = null;
  const status = document.getElementById('accountStatus');
  const forms = document.getElementById('accountForms');
  const pageName = location.pathname.split('/').pop() || 'index.html';
  const params = new URLSearchParams(location.search);
  const fallback = 'index.html#san-pham';

  function safeNext(value) {
    if (!value) return null;
    try {
      const base = new URL(EndlessConfig.pageBase);
      const url = new URL(value, base);
      const pages = ['', 'index.html', 'checkout.html'];
      if (url.origin !== location.origin || url.username || url.password ||
          !pages.some(page => new URL(page || './', base).pathname === url.pathname)) return null;
      return (url.pathname === base.pathname ? 'index.html' : url.pathname.slice(base.pathname.length)) + url.search + url.hash;
    } catch { return null; }
  }
  const destination = safeNext(params.get('next')) ||
    (['index.html', 'checkout.html'].includes(pageName) ? safeNext(location.href) : safeNext(document.referrer)) || fallback;
  function pageLink(name, registered) {
    const query = new URLSearchParams({ next: destination });
    if (registered) query.set('registered', '1');
    return name + '?' + query;
  }
  if (pageName === 'account.html') {
    location.replace(pageLink('login.html'));
    return;
  }
  document.querySelectorAll('[data-register-link]').forEach(link => { link.href = pageLink('register.html'); });
  document.querySelectorAll('[data-login-link]').forEach(link => { link.href = pageLink('login.html'); });
  const icon = '<svg class="account-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4"></circle><path d="M4 21v-2a8 8 0 0 1 16 0v2"></path></svg>';
  const widgets = Array.from(document.querySelectorAll('[data-account-control]')).map((root, index) => {
    const login = root.querySelector('[data-account-login]');
    login.href = pageLink('login.html');
    root.insertAdjacentHTML('beforeend', '<div class="account-session" hidden><button type="button" class="account-trigger" aria-expanded="false" aria-controls="accountMenu' + index + '" aria-label="Tài khoản">' + icon +
      '<span class="account-name" data-account-name></span><span class="account-chevron" aria-hidden="true">⌄</span></button>' +
      '<div id="accountMenu' + index + '" class="account-menu" hidden><a href="checkout.html#lich-su">Đơn hàng của tôi</a><button type="button" data-auth-logout>Đăng xuất</button></div></div>');
    const session = root.querySelector('.account-session');
    const trigger = root.querySelector('.account-trigger');
    const menu = root.querySelector('.account-menu');
    const entries = Array.from(menu.querySelectorAll('a,button'));
    function close(focus) {
      menu.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (focus) trigger.focus();
    }
    function open(focusIndex) {
      menu.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      if (focusIndex !== undefined) entries[focusIndex].focus();
    }
    trigger.addEventListener('click', event => {
      if (menu.hidden) open(event.detail === 0 ? 0 : undefined); else close(false);
    });
    trigger.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); open(event.key === 'ArrowDown' ? 0 : entries.length - 1);
      }
    });
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !menu.hidden) { event.preventDefault(); close(true); }
    });
    menu.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const current = entries.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 :
        (current + (event.key === 'ArrowDown' ? 1 : -1) + entries.length) % entries.length;
      entries[next].focus();
    });
    root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) close(false); });
    document.addEventListener('click', event => { if (!root.contains(event.target)) close(false); });
    return { root, login, session, trigger, close };
  });

  function message(element, text, isError) {
    if (!element) return;
    element.textContent = text;
    element.className = 'account-message' + (text ? isError ? ' is-error' : ' is-success' : '');
  }
  function shortcutCounts() {
    function read(key) {
      try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; }
      catch { return []; }
    }
    const cartCount = read('moc_cart').reduce((sum, item) => sum + (item && Number.isSafeInteger(item.qty) && item.qty > 0 ? item.qty : 0), 0);
    const wishlistCount = new Set(read('moc_wishlist').filter(Number.isSafeInteger)).size;
    document.querySelectorAll('[data-cart-badge]').forEach(el => { el.textContent = cartCount; });
    document.querySelectorAll('[data-wishlist-badge]').forEach(el => { el.textContent = wishlistCount; });
  }
  function render() {
    widgets.forEach(widget => {
      widget.login.hidden = Boolean(user);
      widget.session.hidden = !user;
      widget.root.querySelector('[data-account-name]').textContent = user ? user.username : '';
      widget.trigger.title = user ? user.fullName : '';
      widget.trigger.setAttribute('aria-label', user ? 'Tài khoản ' + user.username : 'Tài khoản');
      if (!user) widget.close(false);
    });
    if (forms) forms.hidden = Boolean(user);
    shortcutCounts();
    window.dispatchEvent(new CustomEvent('endless:auth-changed', { detail: { user } }));
  }
  async function request(endpoint, body) {
    if (body && !csrfToken) {
      const response = await fetch(EndlessConfig.apiUrl('auth/csrf'), { credentials: EndlessConfig.credentials, cache: 'no-store' });
      if (!response.ok) throw new Error('Không tải được phiên bảo mật. Vui lòng thử lại.');
      csrfToken = (await response.json()).csrfToken;
    }
    const response = await fetch(EndlessConfig.apiUrl('auth/' + endpoint), {
      method: body ? 'POST' : 'GET', credentials: EndlessConfig.credentials, cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 403) csrfToken = null;
      if (endpoint === 'me' && response.status === 401) return { user: null };
      throw new Error(data.message || 'Không xử lý được yêu cầu. Vui lòng thử lại.');
    }
    return data;
  }
  ['login', 'register'].forEach(action => {
    const form = document.getElementById(action + 'Form');
    if (!form) return;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      if (button.disabled) return;
      const label = button.textContent;
      const output = form.querySelector('[data-form-message]');
      // Pass password exactly as entered. No trimming, reset or auth-rule changes.
      const body = Object.fromEntries(new FormData(form));
      button.disabled = true; button.textContent = 'Đang gửi…'; form.setAttribute('aria-busy', 'true');
      message(output, '', false);
      try {
        const data = await request(action, body);
        form.querySelector('[name="password"]').value = '';
        if (action === 'login') {
          csrfToken = data.csrfToken;
          const profile = await request('me');
          if (!profile.user) {
            user = null; csrfToken = null; render();
            throw new Error(EndlessConfig.credentials === 'include'
              ? 'Trình duyệt có thể đang chặn cookie của trang khác. Hãy dùng Chrome/Edge hoặc bật cho phép cookie bên thứ ba cho trang này, rồi đăng nhập lại.'
              : 'Không giữ được phiên đăng nhập. Hãy cho phép cookie và thử lại.');
          }
          user = profile.user; render();
          location.assign(destination);
        } else {
          // Register API only creates an account. It does not log the user in.
          location.assign(pageLink('login.html', true));
        }
      } catch (error) { message(output, error.message, true); }
      finally { button.disabled = false; button.textContent = label; form.removeAttribute('aria-busy'); }
    });
  });
  document.querySelectorAll('[data-auth-logout]').forEach(button => {
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      button.disabled = true;
      const label = button.textContent;
      button.textContent = 'Đang đăng xuất…';
      try {
        await request('logout', {});
        csrfToken = null; user = null; render(); message(status, 'Đã đăng xuất.', false);
      } catch (error) {
        if (status) message(status, error.message, true); else window.alert(error.message);
      } finally { button.disabled = false; button.textContent = label; }
    });
  });
  request('me').then(data => {
    user = data.user; render();
    if (user && ['login.html', 'register.html'].includes(pageName)) { location.replace(destination); return; }
    message(status, params.get('registered') === '1' ? 'Đăng ký thành công. Vui lòng đăng nhập.' : '', false);
  }).catch(() => {
    render();
    message(status, 'Chưa kết nối được dịch vụ tài khoản. Vui lòng tải lại trang hoặc thử gửi form.', true);
  });
}());
