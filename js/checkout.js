(function () {
"use strict";

const { escapeHtml, formatPrice, resolveProductImagePath, safeGetJson, safeGetValue, vouchers } = window.Endless;
const cartStorageKey = "moc_cart";
const orderStorageKey = "moc_orders";
const voucherStorageKey = "moc_voucher";
let cart = [];
let orders = [];
let voucherCode = null;

function normalizeCart(items) {
  return Array.isArray(items) ? items.filter(function (item) {
    return item && typeof item.name === "string" && Number.isFinite(Number(item.price)) && Number(item.price) >= 0 && Number.isFinite(Number(item.qty)) && Number(item.qty) > 0;
  }).map(function (item) {
    return Object.assign({}, item, { price: Number(item.price), qty: Number(item.qty) });
  }) : [];
}

function refreshStoredData() {
  cart = normalizeCart(safeGetJson(cartStorageKey, []));
  const savedOrders = safeGetJson(orderStorageKey, []);
  orders = Array.isArray(savedOrders) ? savedOrders.filter(function (order) { return order && typeof order === "object"; }) : [];
  voucherCode = safeGetValue(voucherStorageKey);
  if (!vouchers[voucherCode]) voucherCode = null;
  const subtotal = cart.reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
  if (voucherCode && vouchers[voucherCode].minSubtotal && subtotal < vouchers[voucherCode].minSubtotal) voucherCode = null;
  if (voucherCode) localStorage.setItem(voucherStorageKey, voucherCode);
  else localStorage.removeItem(voucherStorageKey);
}

refreshStoredData();

function getTotals(items) {
  const subtotal = items.reduce(function (sum, item) {
    return sum + Number(item.price) * Number(item.qty);
  }, 0);
  const candidate = vouchers[voucherCode] || null;
  const voucher = candidate && (!candidate.minSubtotal || subtotal >= candidate.minSubtotal) ? candidate : null;
  const total = !voucher
    ? subtotal
    : voucher.type === "percent"
      ? subtotal - subtotal * voucher.value / 100
      : Math.max(0, subtotal - voucher.value);

  return { subtotal: subtotal, total: total, discount: subtotal - total, voucher: voucher };
}

function renderCheckoutSummary() {
  const itemsWrap = document.getElementById("checkoutItems");
  const usableItems = cart;

  document.getElementById("summaryItemCount").textContent = usableItems.reduce(function (sum, item) {
    return sum + Number(item.qty);
  }, 0) + " sản phẩm";

  if (usableItems.length === 0) {
    itemsWrap.innerHTML = '<p class="checkout-empty">Giỏ hàng đang trống. <a href="index.html#san-pham">Chọn sản phẩm</a> để bắt đầu đặt hàng.</p>';
    document.getElementById("placeOrderBtn").disabled = true;
  } else {
    itemsWrap.innerHTML = usableItems.map(function (item) {
      return '<article class="checkout-item">' +
        '<img src="' + escapeHtml(resolveProductImagePath(item.image)) + '" alt="">' +
        '<div class="checkout-item__details"><h3>' + escapeHtml(item.name) + '</h3>' +
        '<p>Size ' + escapeHtml(item.size || "—") + ' · ' + escapeHtml(item.color || "—") + '</p>' +
        '<span>Số lượng: ' + Number(item.qty) + '</span></div>' +
        '<strong>' + formatPrice(Number(item.price) * Number(item.qty)) + '</strong>' +
        '</article>';
    }).join("");
  }

  const totals = getTotals(usableItems);
  document.getElementById("checkoutSubtotal").textContent = formatPrice(totals.subtotal);
  const totalElement = document.getElementById("checkoutTotal");
  totalElement.textContent = formatPrice(totals.total);
  totalElement.classList.remove("is-updated");
  void totalElement.offsetWidth;
  totalElement.classList.add("is-updated");
  if (totals.voucher) {
    document.getElementById("checkoutDiscountRow").hidden = false;
    document.getElementById("checkoutDiscount").textContent = totals.voucher.label + " · " + voucherCode;
  } else {
    document.getElementById("checkoutDiscountRow").hidden = true;
    document.getElementById("checkoutDiscount").textContent = "";
  }

  renderVoucherState();
}

function renderVoucherState(message, state) {
  const input = document.getElementById("checkoutVoucherInput");
  const messageElement = document.getElementById("checkoutVoucherMessage");
  const removeButton = document.getElementById("checkoutVoucherRemove");
  if (!input) return;

  if (document.activeElement !== input) input.value = voucherCode || "";
  removeButton.hidden = !voucherCode;
  messageElement.textContent = message || (voucherCode && vouchers[voucherCode] ? "Đã áp dụng: " + vouchers[voucherCode].label : "Nhập ENDLESS10 hoặc FREESHIP để nhận ưu đãi.");
  messageElement.className = "checkout-voucher__message" + (state ? " is-" + state : voucherCode ? " is-success" : "");
  document.querySelectorAll(".voucher-chip").forEach(function (chip) {
    chip.classList.toggle("is-active", chip.getAttribute("data-voucher") === voucherCode);
  });
}

function applyCheckoutVoucher(code) {
  const normalizedCode = (code || "").trim().toUpperCase();
  if (!normalizedCode) {
    renderVoucherState("Vui lòng nhập mã giảm giá.", "error");
    return;
  }
  if (!vouchers[normalizedCode]) {
    voucherCode = null;
    localStorage.removeItem(voucherStorageKey);
    renderCheckoutSummary();
    renderVoucherState("Mã giảm giá không hợp lệ. Hãy thử ENDLESS10 hoặc FREESHIP.", "error");
    return;
  }

  const subtotal = cart.reduce(function (sum, item) {
    return sum + Number(item.price) * Number(item.qty);
  }, 0);
  if (vouchers[normalizedCode].minSubtotal && subtotal < vouchers[normalizedCode].minSubtotal) {
    voucherCode = null;
    localStorage.removeItem(voucherStorageKey);
    renderCheckoutSummary();
    renderVoucherState("Mã này áp dụng cho đơn hàng từ " + formatPrice(vouchers[normalizedCode].minSubtotal) + ".", "error");
    return;
  }

  voucherCode = normalizedCode;
  localStorage.setItem(voucherStorageKey, voucherCode);
  renderCheckoutSummary();
  renderVoucherState("Đã áp dụng " + voucherCode + ": " + vouchers[voucherCode].label, "success");
}

function renderTransactions() {
  const transactionList = document.getElementById("transactionList");
  if (orders.length === 0) {
    transactionList.innerHTML = '<div class="transaction-empty"><span aria-hidden="true">↗</span><h3>Chưa có giao dịch nào</h3><p>Đơn hàng bạn đặt sẽ được lưu và hiển thị tại đây.</p><a class="btn btn--primary" href="index.html#san-pham">Khám phá sản phẩm</a></div>';
    return;
  }

  transactionList.innerHTML = orders.slice().reverse().map(function (order) {
    const orderItems = Array.isArray(order.items) ? order.items : [];
    return '<article class="transaction-card">' +
      '<div class="transaction-card__top"><div><span class="transaction-card__label">Mã đơn hàng</span><h3>' + escapeHtml(order.code || "ENDLESS") + '</h3></div>' +
      '<span class="transaction-status">' + escapeHtml(order.status || "Đang xử lý") + '</span></div>' +
      '<div class="transaction-card__meta"><span>' + escapeHtml(order.date || "") + '</span><span>' + escapeHtml(order.paymentLabel || "") + '</span><strong>' + formatPrice(Number(order.total) || 0) + '</strong></div>' +
      '<details class="transaction-card__details"><summary>Chi tiết đơn hàng (' + orderItems.length + ')</summary>' +
      '<ul>' + orderItems.map(function (item) {
        return '<li class="transaction-item">' +
          '<img class="transaction-item__image" src="' + escapeHtml(resolveProductImagePath(item.image)) + '" alt="' + escapeHtml(item.name || "Sản phẩm") + '" loading="lazy">' +
          '<div class="transaction-item__info"><strong>' + escapeHtml(item.name || "Sản phẩm") + '</strong>' +
          '<span>Size ' + escapeHtml(item.size || "—") + ' · Màu ' + escapeHtml(item.color || "—") + '</span>' +
          '<span>Số lượng: ' + (Number(item.qty) || 0) + ' × ' + formatPrice(Number(item.price) || 0) + '</span></div>' +
          '<strong class="transaction-item__total">' + formatPrice((Number(item.price) || 0) * (Number(item.qty) || 0)) + '</strong>' +
          '</li>';
      }).join("") + '</ul>' +
      (order.voucherCode ? '<p class="transaction-voucher"><strong>Mã ưu đãi:</strong> ' + escapeHtml(order.voucherCode) + ' · Tiết kiệm ' + formatPrice(Number(order.discount) || 0) + '</p>' : '') +
      '<p class="transaction-address"><strong>Giao đến:</strong> ' + escapeHtml(order.delivery && order.delivery.fullName || "") + ' · ' + escapeHtml(order.delivery && order.delivery.phone || "") + '<br>' + escapeHtml(order.delivery && order.delivery.address || "") + '</p>' +
      (order.delivery && order.delivery.note ? '<p class="transaction-note"><strong>Ghi chú:</strong> ' + escapeHtml(order.delivery.note) + '</p>' : '') +
      '</details></article>';
  }).join("");
}

function placeOrder(event) {
  event.preventDefault();
  if (cart.length === 0) {
    document.getElementById("checkoutNotice").textContent = "Giỏ hàng trống. Vui lòng quay lại cửa hàng để chọn sản phẩm.";
    return;
  }

  const form = event.currentTarget;
  const formData = new FormData(form);
  const totals = getTotals(cart);
  const payment = formData.get("payment");
  const order = {
    code: "ENDLESS" + Math.floor(100000 + Math.random() * 900000),
    date: new Date().toLocaleString("vi-VN"),
    status: "Đang xử lý",
    payment: payment,
    paymentLabel: payment === "transfer" ? "Chuyển khoản ngân hàng" : "Thanh toán khi nhận hàng (COD)",
    items: cart.map(function (item) {
      return {
        id: item.id,
        name: item.name,
        image: item.image,
        size: item.size,
        color: item.color,
        price: Number(item.price),
        qty: Number(item.qty)
      };
    }),
    subtotal: totals.subtotal,
    discount: totals.discount,
    voucherCode: totals.voucher ? voucherCode : null,
    total: totals.total,
    delivery: {
      fullName: formData.get("fullName"),
      phone: formData.get("phone"),
      address: formData.get("address"),
      note: formData.get("note")
    }
  };

  orders.push(order);
  localStorage.setItem(orderStorageKey, JSON.stringify(orders));
  localStorage.setItem(cartStorageKey, JSON.stringify([]));
  localStorage.removeItem(voucherStorageKey);
  cart.length = 0;
  voucherCode = null;
  form.hidden = true;
  const success = document.getElementById("checkoutSuccess");
  success.hidden = false;
  success.innerHTML = '<div class="success-icon">✓</div><h2>Đặt hàng thành công!</h2><p>Mã đơn hàng: <strong>' + escapeHtml(order.code) + '</strong></p><p>Cửa hàng sẽ liên hệ xác nhận trong thời gian sớm nhất.</p><a class="btn btn--primary" href="#lich-su">Xem lịch sử giao dịch</a>';
  success.insertAdjacentHTML("beforeend", '<button type="button" class="btn btn--ghost" id="newOrderBtn">Tạo đơn hàng khác</button>');
  document.getElementById("newOrderBtn").addEventListener("click", function () {
    form.reset();
    form.hidden = false;
    success.hidden = true;
    success.textContent = "";
    renderCheckoutSummary();
    document.getElementById("fullName").focus();
  });
  renderCheckoutSummary();
  renderTransactions();
  document.getElementById("checkoutNotice").textContent = "";
}

document.getElementById("checkoutForm").addEventListener("submit", placeOrder);
document.getElementById("checkoutVoucherApply").addEventListener("click", function () {
  applyCheckoutVoucher(document.getElementById("checkoutVoucherInput").value);
});
document.getElementById("checkoutVoucherInput").addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault();
    applyCheckoutVoucher(event.currentTarget.value);
  }
});
document.querySelectorAll(".voucher-chip").forEach(function (chip) {
  chip.addEventListener("click", function () {
    applyCheckoutVoucher(chip.getAttribute("data-voucher"));
  });
});
document.getElementById("checkoutVoucherRemove").addEventListener("click", function () {
  voucherCode = null;
  localStorage.removeItem(voucherStorageKey);
  renderCheckoutSummary();
  renderVoucherState("Đã xóa mã giảm giá.", "success");
});
renderCheckoutSummary();
renderTransactions();
window.addEventListener("pageshow", function (event) {
  if (!event.persisted) return;
  refreshStoredData();
  renderCheckoutSummary();
  renderTransactions();
});
})();
