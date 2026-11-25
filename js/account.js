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
      const pages = ['', 'index.html', 'checkout.html', 'account.html', 'forgot-password.html', 'staff.html', 'admin.html'];
      if (url.origin !== location.origin || url.username || url.password ||
          !pages.some(page => new URL(page || './', base).pathname === url.pathname)) return null;
      return (url.pathname === base.pathname ? 'index.html' : url.pathname.slice(base.pathname.length)) + url.search + url.hash;
    } catch { return null; }
  }
  const destination = safeNext(params.get('next')) ||
    (['index.html', 'checkout.html', 'account.html', 'staff.html', 'admin.html'].includes(pageName) ? safeNext(location.href) : safeNext(document.referrer)) || fallback;
  function pageLink(name, registered) {
    const query = new URLSearchParams({ next: destination });
    if (registered) query.set('registered', '1');
    return name + '?' + query;
  }
  document.querySelectorAll('[data-register-link]').forEach(link => { link.href = pageLink('register.html'); });
  document.querySelectorAll('[data-login-link]').forEach(link => { link.href = pageLink('login.html'); });
  const icon = '<svg class="account-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="4"></circle><path d="M4 21v-2a8 8 0 0 1 16 0v2"></path></svg>';
  const widgets = Array.from(document.querySelectorAll('[data-account-control]')).map((root, index) => {
    const login = root.querySelector('[data-account-login]');
    login.href = pageLink('login.html');
    root.insertAdjacentHTML('beforeend', '<div class="account-session" hidden><button type="button" class="account-trigger" aria-expanded="false" aria-controls="accountMenu' + index + '" aria-label="Tài khoản">' + icon +
      '<span class="account-name" data-account-name></span><span class="account-chevron" aria-hidden="true">⌄</span></button>' +
      '<div id="accountMenu' + index + '" class="account-menu" hidden>' +
      '<a href="account.html">Hồ sơ &amp; Địa chỉ giao hàng</a>' +
      '<a href="checkout.html#lich-su">Đơn hàng của tôi</a>' +
      '<a href="admin.html" data-staff-link hidden>Quản lý đơn &amp; phản hồi (Nhân viên)</a>' +
      '<a href="admin.html" data-admin-link hidden>Trang quản trị (Admin)</a>' +
      '<button type="button" data-auth-logout>Đăng xuất</button></div></div>');
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
    return { root, login, session, trigger, menu, close };
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

  function renderProfile() {
    const loadingEl = document.getElementById('accountLoading');
    const guestEl = document.getElementById('guestSection');
    const profileEl = document.getElementById('profileSection');
    if (!profileEl) return;
    if (loadingEl) loadingEl.hidden = true;
    if (!user) {
      if (guestEl) guestEl.hidden = false;
      profileEl.hidden = true;
      return;
    }
    if (guestEl) guestEl.hidden = true;
    profileEl.hidden = false;

    const viewUser = document.getElementById('viewUsername');
    const viewEmail = document.getElementById('viewEmail');
    const viewRole = document.getElementById('viewRole');
    if (viewUser) viewUser.textContent = user.username || '—';
    if (viewEmail) viewEmail.textContent = user.email || '—';
    if (viewRole) {
      viewRole.textContent = user.role === 'admin'
        ? 'Quản trị viên (Admin)'
        : user.role === 'nhan_vien' ? 'Nhân viên hệ thống' : 'Khách hàng thân thiết';
    }

    const fullNameInput = document.getElementById('profileFullName');
    const phoneInput = document.getElementById('profilePhone');
    const addressInput = document.getElementById('profileAddress');
    if (fullNameInput && !fullNameInput.value) fullNameInput.value = user.fullName || '';
    if (phoneInput && !phoneInput.value) phoneInput.value = user.phone || '';
    if (addressInput && !addressInput.value) addressInput.value = user.address || '';
  }

  function render() {
    widgets.forEach(widget => {
      widget.login.hidden = Boolean(user);
      widget.session.hidden = !user;
      widget.root.querySelector('[data-account-name]').textContent = user ? user.username : '';
      widget.trigger.title = user ? user.fullName : '';
      widget.trigger.setAttribute('aria-label', user ? 'Tài khoản ' + user.username : 'Tài khoản');
      const staffLink = widget.menu.querySelector('[data-staff-link]');
      if (staffLink) {
        staffLink.hidden = !(user && ['admin', 'nhan_vien'].includes(user.role));
      }
      const adminLink = widget.menu.querySelector('[data-admin-link]');
      if (adminLink) {
        adminLink.hidden = !(user && user.role === 'admin');
      }
      if (!user) widget.close(false);
    });
    if (forms) forms.hidden = Boolean(user);
    shortcutCounts();
    renderProfile();
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
    const data = await response.json().catch(() => ({}));
    if (!response.ok && !data.message && response.status >= 500) data.message = 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
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

  // Forgot Password handler (Standalone page & legacy form support)
  const forgotForm = document.getElementById('forgotPasswordForm');
  const forgotMsg = document.getElementById('forgotMessage');

  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const button = forgotForm.querySelector('[type="submit"]');
      if (button && button.disabled) return;
      const label = button ? button.textContent : '';
      const identifier = (forgotForm.querySelector('[name="identifier"]')?.value || '').trim();
      if (!identifier) {
        message(forgotMsg, 'Vui lòng nhập tên đăng nhập hoặc email.', true);
        return;
      }
      if (button) {
        button.disabled = true;
        button.textContent = 'Đang gửi email…';
      }
      message(forgotMsg, '', false);
      try {
        const data = await request('forgot-password', { identifier });
        message(forgotMsg, data.message || 'Mật khẩu mới đã được gửi thành công.', false);
        const idInput = forgotForm.querySelector('[name="identifier"]');
        if (idInput) idInput.value = '';
      } catch (err) {
        message(forgotMsg, err.message, true);
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = label;
        }
      }
    });
  }

  // Shipping Info Save Handler (account.html)
  const profileForm = document.getElementById('profileShippingForm');
  if (profileForm) {
    profileForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (!user) return;
      const btn = document.getElementById('btnSaveProfileShipping');
      const msg = document.getElementById('profileShippingMsg');
      const label = btn ? btn.textContent : '';
      const fullName = (document.getElementById('profileFullName')?.value || '').trim();
      const phone = (document.getElementById('profilePhone')?.value || '').trim();
      const address = (document.getElementById('profileAddress')?.value || '').trim();
      if (!fullName) {
        message(msg, 'Vui lòng nhập họ và tên người nhận.', true);
        return;
      }
      if (!address) {
        message(msg, 'Vui lòng nhập địa chỉ nhận hàng chi tiết.', true);
        return;
      }
      if (phone && !/^[0-9]{9,11}$/.test(phone)) {
        message(msg, 'Số điện thoại nhận hàng phải gồm 9 đến 11 chữ số.', true);
        return;
      }
      if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu…'; }
      message(msg, '', false);
      try {
        const data = await request('shipping-info', { fullName, phone, address });
        message(msg, '✓ ' + (data.message || 'Đã lưu thông tin giao hàng thành công!'), false);
        if (data.user) {
          user = { ...user, ...data.user };
          render();
        }
      } catch (error) {
        message(msg, error.message, true);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = label; }
      }
    });
  }

  // Customer feedback form (account.html)
  const feedbackForm = document.getElementById('feedbackForm');
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', async event => {
      event.preventDefault();
      const msg = document.getElementById('feedbackMsg');
      const button = document.getElementById('btnSendFeedback');
      const rating = Number(feedbackForm.querySelector('[name="rating"]').value);
      const content = feedbackForm.querySelector('[name="content"]').value.trim();
      if (!user) { message(msg, 'Vui lòng đăng nhập để gửi phản hồi.', true); return; }
      if (!rating || content.length < 5) { message(msg, 'Vui lòng chọn số sao và nhập nội dung tối thiểu 5 ký tự.', true); return; }
      button.disabled = true;
      message(msg, '', false);
      try {
        if (!csrfToken) {
          const r = await fetch(EndlessConfig.apiUrl('auth/csrf'), { credentials: EndlessConfig.credentials, cache: 'no-store' });
          csrfToken = (await r.json()).csrfToken;
        }
        const response = await fetch(EndlessConfig.apiUrl('feedback'), {
          method: 'POST', credentials: EndlessConfig.credentials, cache: 'no-store',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
          body: JSON.stringify({ rating, content })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 403) csrfToken = null;
          throw new Error(data.message || 'Không gửi được phản hồi. Vui lòng thử lại.');
        }
        message(msg, '✓ ' + data.message, false);
        feedbackForm.reset();
      } catch (error) {
        message(msg, error.message, true);
      } finally {
        button.disabled = false;
      }
    });
  }

  // Change Password Handler (account.html)
  const changePasswordForm = document.getElementById('changePasswordForm');
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (!user) return;
      const btn = document.getElementById('btnChangePassword');
      const msg = document.getElementById('changePasswordMsg');
      const label = btn ? btn.textContent : '';

      const currentPassword = changePasswordForm.querySelector('[name="currentPassword"]')?.value || '';
      const newPassword = changePasswordForm.querySelector('[name="newPassword"]')?.value || '';
      const confirmPassword = changePasswordForm.querySelector('[name="confirmNewPassword"]')?.value || '';

      if (!currentPassword) {
        message(msg, 'Vui lòng nhập mật khẩu hiện tại.', true);
        return;
      }
      if (!newPassword || newPassword.length < 10) {
        message(msg, 'Mật khẩu mới phải có tối thiểu 10 ký tự.', true);
        return;
      }
      if (newPassword !== confirmPassword) {
        message(msg, 'Xác nhận mật khẩu không trùng khớp.', true);
        return;
      }
      if (currentPassword === newPassword) {
        message(msg, 'Mật khẩu mới phải khác mật khẩu hiện tại.', true);
        return;
      }

      if (btn) { btn.disabled = true; btn.textContent = 'Đang cập nhật…'; }
      message(msg, '', false);

      try {
        const data = await request('change-password', { currentPassword, newPassword, confirmPassword });
        message(msg, '✓ ' + (data.message || 'Đổi mật khẩu thành công!'), false);
        changePasswordForm.reset();
      } catch (error) {
        message(msg, error.message, true);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = label; }
      }
    });
  }

  document.querySelectorAll('[data-auth-logout]').forEach(button => {
    button.addEventListener('click', async () => {
      if (button.disabled) return;
      button.disabled = true;
      const label = button.textContent;
      button.textContent = 'Đang đăng xuất…';
      try {
        await request('logout', {});
        csrfToken = null; user = null; render(); message(status, 'Đã đăng xuất.', false);
        if (pageName === 'account.html') {
          renderProfile();
        }
      } catch (error) {
        if (status) message(status, error.message, true); else window.alert(error.message);
      } finally { button.disabled = false; button.textContent = label; }
    });
  });

  request('me').then(data => {
    user = data.user; render();
    if (user && ['login.html', 'register.html', 'forgot-password.html'].includes(pageName)) { location.replace(destination); return; }
    message(status, params.get('registered') === '1' ? 'Đăng ký thành công. Vui lòng đăng nhập.' : '', false);
  }).catch(() => {
    render();
    message(status, 'Chưa kết nối được dịch vụ tài khoản. Vui lòng tải lại trang hoặc thử gửi form.', true);
  });
}());
