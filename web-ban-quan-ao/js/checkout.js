/* Real COD checkout: SQL prices, SQL orders, session ownership; never reads/writes moc_orders. */
(function () {
  'use strict';
  const C = EndlessCatalog;
  const esc = C.escapeHtml;
  const cart = [];
  const form = document.getElementById('checkoutForm');
  const pendingStorageKey = 'endless_pending_cod';
  let user = null, ready = false, loading = false, submitting = false, quote = null, csrfToken = null;
  let voucherCode = C.readText('moc_voucher') || null;
  let confirmedOrder = null;
  let quoteSequence = 0, historySequence = 0;
  const money = value => typeof value === 'number' ? Math.round(value).toLocaleString('vi-VN') + 'đ' : '—';
  const statuses = { cho_xu_ly: 'Chờ xử lý', dang_giao: 'Đang giao', hoan_thanh: 'Hoàn thành', da_huy: 'Đã hủy' };
  const dateText = value => new Date(value).toLocaleString('vi-VN');
  const notice = text => { document.getElementById('checkoutNotice').textContent = text; };

  async function api(path, options = {}) {
    try {
      if (options.body && !csrfToken) {
        const response = await fetch(EndlessConfig.apiUrl('auth/csrf'), { credentials: EndlessConfig.credentials, cache: 'no-store' });
        if (!response.ok) throw new Error('Không tải được phiên bảo mật.');
        csrfToken = (await response.json()).csrfToken;
      }
      const response = await fetch(EndlessConfig.apiUrl(path), { method: options.body ? 'POST' : 'GET',
        credentials: EndlessConfig.credentials, cache: 'no-store', signal: AbortSignal.timeout(15000),
        headers: options.body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken,
          ...(options.key ? { 'Idempotency-Key': options.key } : {}) } : {},
        body: options.body ? JSON.stringify(options.body) : undefined });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 403) csrfToken = null;
        const error = new Error(data.message || 'Không xử lý được yêu cầu.');
        error.status = response.status;
        throw error;
      }
      return data;
    } catch (error) {
      if (error.status) throw error;
      throw new Error('Không nhận được xác nhận từ máy chủ. Giỏ hàng được giữ nguyên; bạn có thể thử lại.');
    }
  }
  function itemPayload() {
    return cart.map(item => ({ id: item.id, size: item.size, color: item.color, qty: item.qty }))
      .sort((a, b) => a.id - b.id || (a.size < b.size ? -1 : a.size > b.size ? 1 : a.color < b.color ? -1 : a.color > b.color ? 1 : 0));
  }
  async function stamp(value) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  function readPending() {
    try {
      const value = JSON.parse(sessionStorage.getItem(pendingStorageKey) || 'null');
      return value && value.ownerId === user?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.key) &&
        /^[a-f0-9]{64}$/.test(value.signature) && /^[a-f0-9]{64}$/.test(value.cartStamp) ? value : null;
    } catch { return null; }
  }
  function renderItems(items, history) {
    return items.map(item => {
      const image = C.imagePath(item.image);
      if (history) return '<li class="transaction-item">' + (image ? '<img class="transaction-item__image" src="' + esc(image) + '" alt="" loading="lazy">' : '') +
        '<div class="transaction-item__info"><strong>' + esc(item.name) + '</strong><span>Size ' + esc(item.size) + ' · Màu ' + esc(item.color) + '</span>' +
        '<span>Số lượng: ' + esc(item.qty) + ' × ' + esc(money(item.price)) + '</span></div><strong>' + esc(money(item.price * item.qty)) + '</strong></li>';
      return '<article class="checkout-item">' + (image ? '<img src="' + esc(image) + '" alt="">' : '') +
        '<div class="checkout-item__details"><h3>' + esc(item.name) + '</h3><p>Size ' + esc(item.size) + ' · ' + esc(item.color) + '</p>' +
        '<span>Số lượng: ' + esc(item.qty) + '</span></div><strong>' + esc(money(item.price * item.qty)) + '</strong></article>';
    }).join('');
  }
  function renderTotals(totals) {
    document.getElementById('checkoutSubtotal').textContent = totals ? money(totals.subtotal) : 'Chờ máy chủ';
    document.getElementById('checkoutTotal').textContent = totals ? money(totals.total) : 'Chờ máy chủ';
    document.getElementById('checkoutDiscountRow').hidden = !totals?.voucherCode;
    document.getElementById('checkoutDiscount').textContent = totals?.voucherCode ? totals.voucherCode + ' · −' + money(totals.discount) : '';
  }
  function renderSummary() {
    const rows = confirmedOrder && form.hidden ? confirmedOrder.items : cart;
    document.getElementById('summaryItemCount').textContent = rows.reduce((sum, item) => sum + item.qty, 0) + ' sản phẩm';
    document.getElementById('checkoutItems').innerHTML = rows.length ? renderItems(confirmedOrder && form.hidden ? rows : quote?.items || cart, false) :
      '<p class="checkout-empty">Giỏ hàng trống. <a href="index.html#san-pham">Chọn sản phẩm</a>.</p>';
    renderTotals(confirmedOrder && form.hidden ? confirmedOrder : quote);
    document.getElementById('placeOrderBtn').disabled = !user || !ready || !cart.length || !quote || submitting;
    document.getElementById('placeOrderBtn').textContent = submitting ? 'Đang lưu đơn…' : 'Xác nhận đặt hàng COD';
    document.querySelectorAll('#checkoutVoucherApply,#checkoutVoucherRemove,#checkoutVoucherInput,.voucher-chip').forEach(el => {
      el.disabled = submitting || !ready || !user || !cart.length;
    });
    document.getElementById('checkoutVoucherInput').value = voucherCode || '';
    document.getElementById('checkoutVoucherRemove').hidden = !voucherCode;
    document.querySelectorAll('.voucher-chip').forEach(el => el.classList.toggle('is-active', el.dataset.voucher === voucherCode));
    document.getElementById('checkoutCatalogNotice').textContent = C.notice();
  }
  async function refreshQuote(code = voucherCode) {
    const sequence = ++quoteSequence;
    quote = null;
    renderSummary();
    if (!ready || !user || !cart.length) return false;
    const result = await api('orders/quote', { body: { items: itemPayload(), voucherCode: code, payment: 'cod' } });
    if (sequence !== quoteSequence || !user) return false;
    quote = result;
    renderSummary();
    return true;
  }
  async function applyVoucher(code) {
    const normalized = typeof code === 'string' ? code.trim().toUpperCase() : '';
    if (!normalized) { document.getElementById('checkoutVoucherMessage').textContent = 'Vui lòng nhập mã giảm giá.'; return; }
    try {
      if (await refreshQuote(normalized)) {
        voucherCode = normalized;
        C.write('moc_voucher', voucherCode);
        renderSummary();
        document.getElementById('checkoutVoucherMessage').textContent = 'Đã áp dụng ' + voucherCode + ' theo kết quả máy chủ.';
      }
    } catch (error) { document.getElementById('checkoutVoucherMessage').textContent = error.message; }
  }
  async function loadHistory() {
    const sequence = ++historySequence;
    const list = document.getElementById('transactionList');
    if (!user) { list.innerHTML = '<p>Vui lòng <a href="login.html?next=checkout.html%23lich-su">đăng nhập</a> để xem đơn của bạn.</p>'; return; }
    list.textContent = 'Đang tải đơn hàng từ máy chủ…';
    try {
      const { orders } = await api('orders');
      if (sequence !== historySequence || !user) return;
      list.innerHTML = orders.length ? orders.map(order => '<article class="transaction-card"><div class="transaction-card__top"><div><span class="transaction-card__label">Mã đơn hàng</span>' +
        '<h3>' + esc(order.code) + '</h3></div><span class="transaction-status">' + esc(statuses[order.status] || order.status) + '</span></div>' +
        '<div class="transaction-card__meta"><span>' + esc(dateText(order.date)) + '</span><span>Thanh toán khi nhận hàng (COD)</span><strong>' + esc(money(order.total)) + '</strong></div>' +
        '<details class="transaction-card__details" data-order-id="' + order.id + '"><summary>Chi tiết đơn hàng (' + order.itemCount + ')</summary><div class="order-details-body"></div></details></article>').join('') :
        '<div class="transaction-empty"><h3>Chưa có đơn hàng nào</h3><p>Đơn COD đã lưu trên máy chủ sẽ hiển thị tại đây.</p></div>';
      list.querySelectorAll('details').forEach(details => details.addEventListener('toggle', async () => {
        if (!details.open || details.dataset.loaded === 'true' || details.dataset.loading === 'true') return;
        details.dataset.loading = 'true';
        const body = details.querySelector('.order-details-body');
        body.textContent = 'Đang tải chi tiết…';
        try {
          const { order } = await api('orders/' + details.dataset.orderId);
          if (sequence !== historySequence || !user) return;
          body.innerHTML = '<ul>' + renderItems(order.items, true) + '</ul>' +
            (order.voucherCode ? '<p class="transaction-voucher">Mã ưu đãi: ' + esc(order.voucherCode) + ' · Giảm ' + esc(money(order.discount)) + '</p>' : '') +
            '<p class="transaction-address"><strong>Giao đến:</strong> ' + esc(order.delivery.fullName || '') + ' · ' + esc(order.delivery.phone || '') + '<br>' + esc(order.delivery.address || '') + '</p>' +
            (order.delivery.note ? '<p class="transaction-address">Ghi chú: ' + esc(order.delivery.note) + '</p>' : '');
          details.dataset.loaded = 'true';
        } catch (error) { body.textContent = error.message + ' Đóng và mở lại để thử lại.'; }
        finally { details.dataset.loading = 'false'; }
      }));
    } catch (error) { if (sequence === historySequence) list.textContent = error.message; }
  }
  function setUser(next) {
    const changed = user?.id !== next?.id;
    if (changed && user) {
      confirmedOrder = null;
      form.reset(); form.hidden = false;
      document.getElementById('checkoutSuccess').hidden = true;
      document.getElementById('checkoutSuccess').replaceChildren();
    }
    user = next;
    if (changed) { csrfToken = null; quote = null; ++quoteSequence; }
    if (!user) {
      notice('Vui lòng đăng nhập để đặt COD và xem đơn hàng. Giỏ hàng được giữ nguyên.');
      document.getElementById('checkoutLogin').hidden = false;
    } else { notice(''); document.getElementById('checkoutLogin').hidden = true; }
    renderSummary();
    loadHistory();
    if (changed && ready && user) recoverOrQuote();
  }
  async function completeOrder(order, expectedStamp) {
    if (!order || !Number.isSafeInteger(order.id) || !/^ENDLESS-[0-9]+$/.test(order.code) ||
        !Number.isSafeInteger(order.total) || order.total < 0 || !Array.isArray(order.items) || !order.items.length) {
      throw new Error('Phản hồi đơn hàng chưa hợp lệ; giỏ được giữ nguyên để kiểm tra lại.');
    }
    const sameCart = await stamp(itemPayload()) === expectedStamp;
    let cleared = false;
    if (sameCart) {
      cleared = C.write('moc_cart', JSON.stringify([]));
      cart.splice(0);
      voucherCode = null;
      C.write('moc_voucher', null);
    }
    if (!sameCart || cleared) { try { sessionStorage.removeItem(pendingStorageKey); } catch {} }
    confirmedOrder = order;
    quote = order;
    form.hidden = true;
    renderSummary();
    renderTotals(order);
    document.getElementById('checkoutItems').innerHTML = renderItems(order.items, false);
    const success = document.getElementById('checkoutSuccess');
    success.hidden = false;
    success.innerHTML = '<div class="success-icon">✓</div><h2>Đơn COD đã được lưu!</h2><p>Mã đơn: <strong>' + esc(order.code) + '</strong></p>' +
      '<p>Tổng thanh toán: <strong>' + esc(money(order.total)) + '</strong></p><p>Thanh toán khi nhận hàng.</p><a class="btn btn--primary" href="#lich-su">Xem đơn hàng của tôi</a>';
    form.hidden = true;
    notice(sameCart ? cleared ? '' : 'Đơn đã lưu nhưng trình duyệt chưa cập nhật được giỏ. Không gửi lại đơn mới.' : 'Đơn trước đã lưu; giỏ hiện tại khác nên được giữ nguyên.');
    await loadHistory();
  }
  async function recoverOrQuote() {
    if (!ready || !user) return;
    const pending = readPending();
    if (pending) {
      try {
        const { order } = await api('orders/requests/' + pending.key);
        await completeOrder(order, pending.cartStamp);
        return;
      } catch (error) { if (error.status !== 404) { notice(error.message); return; } }
    }
    try { await refreshQuote(); }
    catch (error) { notice(error.message); if (error.status === 401) setUser(null); }
  }
  async function loadCatalog() {
    if (loading) return;
    loading = true; ready = false; quote = null;
    document.getElementById('placeOrderBtn').disabled = true;
    document.getElementById('checkoutCatalogRetry').hidden = true;
    document.getElementById('checkoutItems').textContent = 'Đang đối chiếu giỏ với sản phẩm trên máy chủ…';
    try {
      const products = await C.fetchProducts();
      cart.splice(0, cart.length, ...C.reconcileCart(C.readArray('moc_cart'), products));
      C.write('moc_cart', JSON.stringify(cart));
      ready = true; renderSummary(); await recoverOrQuote();
    } catch (error) {
      document.getElementById('checkoutItems').textContent = 'Không tải được sản phẩm từ API. Giỏ đã lưu được giữ nguyên.';
      document.getElementById('checkoutCatalogRetry').hidden = false;
    } finally { loading = false; document.getElementById('checkoutCatalogNotice').textContent = C.notice(); }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || !ready || !quote || !cart.length || !user) return;
    const fields = Object.fromEntries(new FormData(form));
    const body = { items: itemPayload(), voucherCode, payment: fields.payment,
      delivery: { fullName: fields.fullName.trim(), phone: fields.phone.trim(), address: fields.address.trim(), note: fields.note.trim() } };
    submitting = true; renderSummary(); notice('Đang lưu đơn trên máy chủ…');
    try {
      const signature = await stamp(body);
      const cartStamp = await stamp(body.items);
      const old = readPending();
      const pending = old?.signature === signature ? old : { key: crypto.randomUUID(), signature, cartStamp, ownerId: user.id };
      try { sessionStorage.setItem(pendingStorageKey, JSON.stringify(pending)); }
      catch { throw new Error('Không lưu được khóa chống gửi trùng; chưa gửi đơn. Vui lòng cho phép lưu trữ trong trình duyệt.'); }
      const { order } = await api('orders', { body, key: pending.key });
      await completeOrder(order, cartStamp);
    } catch (error) {
      notice(error.message);
      if (error.status === 401) setUser(null);
      if (error.status === 400 || error.status === 409) { quote = null; document.getElementById('checkoutCatalogRetry').hidden = false; }
    } finally {
      submitting = false;
      document.getElementById('placeOrderBtn').disabled = !user || !ready || !quote || !cart.length;
      document.getElementById('placeOrderBtn').textContent = 'Xác nhận đặt hàng COD';
      document.querySelectorAll('#checkoutVoucherApply,#checkoutVoucherRemove,#checkoutVoucherInput,.voucher-chip').forEach(el => { el.disabled = !user || !ready || !cart.length; });
    }
  });
  document.getElementById('checkoutVoucherApply').addEventListener('click', () => applyVoucher(document.getElementById('checkoutVoucherInput').value));
  document.getElementById('checkoutVoucherInput').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); applyVoucher(event.currentTarget.value); } });
  document.querySelectorAll('.voucher-chip').forEach(chip => chip.addEventListener('click', () => applyVoucher(chip.dataset.voucher)));
  document.getElementById('checkoutVoucherRemove').addEventListener('click', async () => {
    voucherCode = null; C.write('moc_voucher', null); document.getElementById('checkoutVoucherMessage').textContent = 'Đã xóa mã ưu đãi.';
    try { await refreshQuote(null); } catch (error) { notice(error.message); }
  });
  document.getElementById('checkoutCatalogRetry').addEventListener('click', loadCatalog);
  document.getElementById('historyRetry').addEventListener('click', loadHistory);
  window.addEventListener('endless:auth-changed', event => setUser(event.detail.user));
  api('auth/me').then(data => setUser(data.user)).catch(error => { setUser(null); if (error.status !== 401) notice(error.message); });
  loadCatalog();
}());
