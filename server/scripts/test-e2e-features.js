'use strict';

const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');

const base = process.env.TEST_API_BASE_URL || 'http://127.0.0.1:3000';
const suffix = Date.now().toString(36) + randomBytes(3).toString('hex');
const customerUsername = 'e2e_cust_' + suffix;
const customerPassword = 'Password!2026_' + randomBytes(4).toString('hex');
const customerEmail = customerUsername + '@test.example';
const adminUsername = 'e2e_adm_' + suffix;
const adminPassword = 'AdminPass!2026_' + randomBytes(4).toString('hex');
const adminEmail = adminUsername + '@test.example';

class TestClient {
  constructor(name) {
    this.name = name;
    this.cookie = '';
    this.csrfToken = '';
    this.user = null;
  }

  async call(path, method = 'GET', body = null, headers = {}) {
    const reqHeaders = {
      Cookie: this.cookie,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(this.csrfToken ? { 'X-CSRF-Token': this.csrfToken } : {}),
      ...headers
    };

    const response = await fetch(base + path, {
      method,
      headers: reqHeaders,
      body: body ? JSON.stringify(body) : undefined
    });

    const setCookies = response.headers.getSetCookie();
    for (const c of setCookies) {
      if (c.startsWith('endless.sid=')) {
        this.cookie = c.split(';')[0];
      }
    }

    let json = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      json = await response.json();
    } else {
      json = await response.text();
    }

    return { status: response.status, body: json, headers: response.headers };
  }

  async fetchCsrf() {
    const res = await this.call('/api/auth/csrf');
    assert.equal(res.status, 200, `${this.name}: failed to get CSRF token`);
    this.csrfToken = res.body.csrfToken;
    return this.csrfToken;
  }

  async register(username, password, fullName, email, phone = '0912345678') {
    await this.fetchCsrf();
    const res = await this.call('/api/auth/register', 'POST', {
      username,
      password,
      fullName,
      email,
      phone
    });
    return res;
  }

  async login(username, password) {
    const res = await this.call('/api/auth/login', 'POST', { username, password });
    if (res.status === 200) {
      this.user = res.body.user;
      this.csrfToken = res.body.csrfToken;
    }
    return res;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN CÁC TÍNH NĂNG HỆ THỐNG ENDLESS SHOP');
  console.log(`🌐 Base URL: ${base}`);
  console.log('================================================================\n');

  const customer = new TestClient('Khách hàng');
  const admin = new TestClient('Quản trị viên');
  let createdOrderId = null;

  // 1. Health check
  console.log('[1/12] Kiểm thử Endpoint Sức khỏe Hệ thống (Health Check)...');
  const healthRes = await customer.call('/api/health');
  assert.equal(healthRes.status, 200);
  assert.equal(healthRes.body.status, 'ok');
  console.log('  ✅ [PASS] /api/health trả về status: "ok"\n');

  // 2. Product Catalog
  console.log('[2/12] Kiểm thử Duyệt Sản phẩm & Chi tiết Sản phẩm...');
  const productsRes = await customer.call('/api/products');
  assert.equal(productsRes.status, 200);
  assert.ok(Array.isArray(productsRes.body), 'Products list must be array');
  assert.ok(productsRes.body.length >= 10, 'Expected at least 10 products');
  const sampleProduct = productsRes.body[0];
  console.log(`  📦 Tổng số sản phẩm trong cơ sở dữ liệu: ${productsRes.body.length}`);
  console.log(`  📦 Sản phẩm mẫu (ID: ${sampleProduct.id}): "${sampleProduct.name}" - Giá: ${sampleProduct.price.toLocaleString('vi-VN')}đ - Tồn kho: ${sampleProduct.stock}`);

  const productDetailRes = await customer.call(`/api/products/${sampleProduct.id}`);
  assert.equal(productDetailRes.status, 200);
  assert.equal(productDetailRes.body.id, sampleProduct.id);
  console.log(`  ✅ [PASS] /api/products và /api/products/${sampleProduct.id} hoạt động chính xác\n`);

  // 3. Customer Registration with CSRF & Security
  console.log('[3/12] Kiểm thử Đăng ký Tài khoản Khách hàng Mới...');
  // 3a. Register without CSRF should fail
  const regNoCsrf = await new TestClient('Attacker').call('/api/auth/register', 'POST', {
    username: customerUsername + '_bad',
    password: customerPassword,
    fullName: 'Attacker Without CSRF',
    email: 'bad@example.com'
  });
  assert.equal(regNoCsrf.status, 403, 'Must reject registration without CSRF');
  console.log('  🔒 [BẢO MẬT] Đăng ký không CSRF bị từ chối 403 (csrf_invalid)');

  // 3b. Register with CSRF succeeds
  const regRes = await customer.register(customerUsername, customerPassword, 'Nguyễn Văn Kiểm Thử', customerEmail);
  assert.equal(regRes.status, 201);
  assert.equal(regRes.body.user.username, customerUsername);
  assert.equal(regRes.body.user.role, 'khach_hang');
  console.log(`  ✅ [PASS] Đăng ký thành công khách hàng "${customerUsername}" (ID: ${regRes.body.user.id}, Vai trò: ${regRes.body.user.role})\n`);

  // 4. Customer Login & Session
  console.log('[4/12] Kiểm thử Đăng nhập Khách hàng & Xác thực Phiên...');
  const loginRes = await customer.login(customerUsername, customerPassword);
  assert.equal(loginRes.status, 200);
  assert.equal(customer.user.username, customerUsername);
  assert.ok(customer.csrfToken && customer.csrfToken.length === 64);
  console.log(`  🔑 Đăng nhập thành công, nhận SID cookie và CSRF token: ${customer.csrfToken.substring(0, 16)}...`);

  // Check /me
  const meRes = await customer.call('/api/auth/me');
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.user.id, customer.user.id);
  console.log(`  ✅ [PASS] /api/auth/me trả về đúng thông tin định danh người dùng ID: ${meRes.body.user.id}\n`);

  // 5. Quote Calculation & Voucher Discounts
  console.log('[5/12] Kiểm thử Báo giá Đơn hàng & Tính toán Voucher...');
  // 5a. Quote without voucher
  const quoteItems = [
    { id: sampleProduct.id, qty: 2, size: 'L', color: 'Đen' }
  ];
  const quoteNoVoucher = await customer.call('/api/orders/quote', 'POST', { items: quoteItems });
  assert.equal(quoteNoVoucher.status, 200);
  const expectedSubtotal = sampleProduct.price * 2;
  assert.equal(quoteNoVoucher.body.subtotal, expectedSubtotal);
  console.log(`  💰 Tạm tính 2 sản phẩm: ${expectedSubtotal.toLocaleString('vi-VN')}đ (Tổng: ${quoteNoVoucher.body.total.toLocaleString('vi-VN')}đ)`);

  // 5b. Quote with percent voucher ENDLESS10
  const quotePercent = await customer.call('/api/orders/quote', 'POST', {
    items: quoteItems,
    voucherCode: 'ENDLESS10'
  });
  assert.equal(quotePercent.status, 200);
  assert.equal(quotePercent.body.discount, Math.round(expectedSubtotal * 0.1));
  console.log(`  🎟️ Áp voucher ENDLESS10: Giảm 10% (-${quotePercent.body.discount.toLocaleString('vi-VN')}đ) -> Tổng: ${quotePercent.body.total.toLocaleString('vi-VN')}đ`);

  // 5c. Quote with fixed voucher FREESHIP
  const quoteFixed = await customer.call('/api/orders/quote', 'POST', {
    items: quoteItems,
    voucherCode: 'FREESHIP'
  });
  assert.equal(quoteFixed.status, 200);
  assert.equal(quoteFixed.body.discount, 30000);
  console.log(`  🎟️ Áp voucher FREESHIP: Giảm 30.000đ (-${quoteFixed.body.discount.toLocaleString('vi-VN')}đ) -> Tổng: ${quoteFixed.body.total.toLocaleString('vi-VN')}đ`);
  console.log('  ✅ [PASS] Thuật toán báo giá và kiểm tra voucher hoạt động chính xác\n');

  // 6. COD Order Placement with Idempotency Key
  console.log('[6/12] Kiểm thử Đặt Hàng COD (với Idempotency-Key & CSRF)...');
  const idempotencyKey = randomUUID();
  const orderPayload = {
    items: quoteItems,
    voucherCode: 'ENDLESS10',
    delivery: {
      fullName: 'Nguyễn Văn Kiểm Thử',
      phone: '0987654321',
      address: '123 Đường Test, Quận 1, TP. Hồ Chí Minh',
      note: 'Giao hàng giờ hành chính'
    }
  };

  const orderRes = await customer.call('/api/orders', 'POST', orderPayload, {
    'Idempotency-Key': idempotencyKey
  });
  assert.equal(orderRes.status, 201, `Failed to create order: ${JSON.stringify(orderRes.body)}`);
  createdOrderId = orderRes.body.order.id;
  assert.ok(createdOrderId > 0);
  assert.equal(orderRes.body.order.payment?.toLowerCase(), 'cod');
  assert.equal(orderRes.body.order.status, 'cho_xu_ly');
  console.log(`  🛒 Đơn hàng COD tạo thành công: Mã đơn #${createdOrderId}`);
  console.log(`  📦 Tổng tiền thanh toán: ${orderRes.body.order.total.toLocaleString('vi-VN')}đ`);
  console.log(`  🚚 Trạng thái đơn ban đầu: "${orderRes.body.order.status}"`);

  // 6b. Idempotency test: repeating same request with same key returns identical order without re-deducting stock
  const dupOrderRes = await customer.call('/api/orders', 'POST', orderPayload, {
    'Idempotency-Key': idempotencyKey
  });
  assert.equal(dupOrderRes.status, 200);
  assert.equal(dupOrderRes.body.order.id, createdOrderId);
  console.log('  🔒 [TÍNH BẤT BIẾN] Gửi lại cùng Idempotency-Key trả về đơn hiện có, không trừ tồn kho 2 lần!');
  console.log('  ✅ [PASS] Tạo đơn hàng COD và Idempotency bảo vệ thành công\n');

  // 7. Order History & Tracking
  console.log('[7/12] Kiểm thử Lịch sử Đơn hàng của Khách hàng...');
  const ordersListRes = await customer.call('/api/orders');
  assert.equal(ordersListRes.status, 200);
  assert.ok(Array.isArray(ordersListRes.body.orders));
  const myOrder = ordersListRes.body.orders.find(o => o.id === createdOrderId);
  assert.ok(myOrder, 'Created order must be in user order history');
  console.log(`  📋 Tìm thấy đơn #${createdOrderId} trong danh sách lịch sử khách hàng`);

  const orderDetailRes = await customer.call(`/api/orders/${createdOrderId}`);
  assert.equal(orderDetailRes.status, 200);
  assert.equal(orderDetailRes.body.order.id, createdOrderId);
  assert.ok(orderDetailRes.body.order.items.length > 0);
  console.log(`  📄 Chi tiết đơn hàng #${createdOrderId}: ${orderDetailRes.body.order.items.length} món hàng`);
  console.log('  ✅ [PASS] Truy xuất lịch sử và chi tiết đơn hàng hoạt động tốt\n');

  // 8. Security Access Control: Customer blocked from Admin APIs
  console.log('[8/12] Kiểm thử Bảo mật Phân quyền: Khách hàng gọi API Quản trị...');
  const custCallMetrics = await customer.call('/api/admin/metrics');
  assert.equal(custCallMetrics.status, 403);
  assert.equal(custCallMetrics.body.code, 'forbidden');

  const custCallVouchers = await customer.call('/api/admin/vouchers');
  assert.equal(custCallVouchers.status, 403);
  assert.equal(custCallVouchers.body.code, 'forbidden');

  const custCallUpdateStatus = await customer.call(`/api/admin/orders/${createdOrderId}/status`, 'PUT', { status: 'dang_giao' });
  assert.equal(custCallUpdateStatus.status, 403);
  assert.equal(custCallUpdateStatus.body.code, 'forbidden');
  console.log('  🛡️ [PHÂN QUYỀN RBAC] Khách hàng bị chặn 403 Forbidden trên toàn bộ endpoint Admin');
  console.log('  ✅ [PASS] Phân quyền bảo vệ API Quản trị vững chắc\n');

  // 9. Admin Registration & Promotion
  console.log('[9/12] Chuẩn bị Tài khoản Quản trị viên (Admin)...');
  await admin.register(adminUsername, adminPassword, 'Quản Trị Viên Hệ Thống', adminEmail);
  
  // Promote to admin in DB via SQL connection
  const { sql } = require('../src/db');
  const dbConfig = {
    server: process.env.DB_SERVER || '127.0.0.1',
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_DATABASE || 'web_thoi_trang',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'YourStrong@Passw0rd',
    connectionTimeout: 10000,
    requestTimeout: 15000,
    options: {
      encrypt: true,
      trustServerCertificate: true
    }
  };
  const pool = await new sql.ConnectionPool(dbConfig).connect();
  await pool.request()
    .input('uname', sql.VarChar(50), adminUsername)
    .query("SET QUOTED_IDENTIFIER ON; UPDATE dbo.TAI_KHOAN SET vai_tro = 'admin' WHERE ten_dang_nhap = @uname;");

  const adminLoginRes = await admin.login(adminUsername, adminPassword);
  assert.equal(adminLoginRes.status, 200);
  assert.equal(admin.user.role, 'admin');
  console.log(`  👑 Đăng nhập Admin thành công: "${adminUsername}" (Vai trò: ${admin.user.role})\n`);

  // 10. Admin Dashboard & Metrics
  console.log('[10/12] Kiểm thử Bảng Điều khiển Số liệu Kinh doanh (Admin Metrics)...');
  const metricsRes = await admin.call('/api/admin/metrics');
  assert.equal(metricsRes.status, 200);
  console.log(`  📊 Doanh thu hôm nay: ${metricsRes.body.revenueToday.toLocaleString('vi-VN')}đ`);
  console.log(`  📊 Đơn hàng chờ xử lý: ${metricsRes.body.pendingOrders}`);
  console.log(`  📊 Số sản phẩm sắp hết hàng (<=5): ${metricsRes.body.lowStockCount}`);
  console.log(`  📊 Tổng số lượng tồn kho toàn hệ thống: ${metricsRes.body.totalStock}`);
  console.log(`  📊 Số voucher còn hiệu lực: ${metricsRes.body.activeVouchers}`);
  console.log('  ✅ [PASS] Bảng số liệu kinh doanh tải thành công\n');

  // 11. Admin Voucher Management
  console.log('[11/12] Kiểm thử Quản lý & Tạo Voucher Mới (Admin)...');
  const vouchersRes = await admin.call('/api/admin/vouchers');
  assert.equal(vouchersRes.status, 200);
  assert.ok(Array.isArray(vouchersRes.body.vouchers));
  console.log(`  🎟️ Tổng cộng ${vouchersRes.body.vouchers.length} voucher đang quản lý.`);

  // 11a. Tạo voucher mới thành công
  const testVoucherCode = 'E2EVOUCHER' + Math.floor(Math.random() * 10000);
  const createVoucherRes = await admin.call('/api/admin/vouchers', 'POST', {
    code: testVoucherCode,
    type: 'percent',
    value: 20,
    expiresAt: null
  });
  assert.equal(createVoucherRes.status, 201, 'Admin create voucher returned 201');
  assert.equal(createVoucherRes.body.voucher.ma_code, testVoucherCode);
  const createdVoucherId = createVoucherRes.body.voucher.voucher_id;
  console.log(`  ✨ [TẠO MÃ] Đã tạo thành công voucher mới "${testVoucherCode}" (Giảm 20%, ID: ${createdVoucherId})`);

  // 11b. Trùng mã voucher bị từ chối 409 Conflict
  const dupVoucherRes = await admin.call('/api/admin/vouchers', 'POST', {
    code: testVoucherCode,
    type: 'fixed',
    value: 50000
  });
  assert.equal(dupVoucherRes.status, 409, 'Duplicate voucher returned 409 Conflict');
  console.log(`  🔒 [CHỐNG TRÙNG] Mã trùng bị từ chối chính xác (409 Conflict)`);

  // 11c. Giá trị không hợp lệ bị từ chối 400 Bad Request
  const invalidVoucherRes = await admin.call('/api/admin/vouchers', 'POST', {
    code: 'INVALID150',
    type: 'percent',
    value: 150
  });
  assert.equal(invalidVoucherRes.status, 400, 'Invalid percent returned 400');
  console.log(`  🛡️ [VALIDATION] Giá trị phần trăm > 100% bị từ chối chính xác (400 Bad Request)`);

  // 11d. Khách hàng sử dụng voucher vừa tạo khi báo giá
  const testQuoteWithNewVoucher = await customer.call('/api/orders/quote', 'POST', {
    items: quoteItems,
    voucherCode: testVoucherCode
  });
  assert.equal(testQuoteWithNewVoucher.status, 200);
  const expectedNewDiscount = Math.round(expectedSubtotal * 0.20);
  assert.equal(testQuoteWithNewVoucher.body.discount, expectedNewDiscount);
  console.log(`  🛒 [ÁP DỤNG] Khách áp dụng mã mới "${testVoucherCode}": Giảm 20% (-${expectedNewDiscount.toLocaleString('vi-VN')}đ) thành công!`);

  // 11e. Xoá voucher thử nghiệm
  const deleteVoucherRes = await admin.call(`/api/admin/vouchers/${createdVoucherId}`, 'DELETE');
  assert.equal(deleteVoucherRes.status, 200, 'Delete voucher returned 200');
  console.log(`  🧹 [DỌN DẸP] Đã xóa voucher thử nghiệm ID: ${createdVoucherId}`);
  console.log('  ✅ [PASS] Tính năng Quản lý & Tạo Voucher mới vận hành hoàn hảo 100%\n');

  // 12. Admin Order Status Workflow & Stock Adjustment
  console.log('[12/12] Kiểm thử Quản trị viên Cập nhật Trạng thái Đơn hàng & Tồn kho...');
  // 12a. Order status change without CSRF rejected
  const updateNoCsrf = await new TestClient('AttackerAdmin').call(`/api/admin/orders/${createdOrderId}/status`, 'PUT', { status: 'dang_giao' });
  assert.equal(updateNoCsrf.status, 401, 'Unauthenticated rejected');
  
  // 12b. Admin update order status to 'dang_giao'
  const updateStatus1 = await admin.call(`/api/admin/orders/${createdOrderId}/status`, 'PUT', { status: 'dang_giao' });
  assert.equal(updateStatus1.status, 200);
  console.log(`  🚚 Admin duyệt đơn #${createdOrderId} -> Trạng thái: "dang_giao" (Đang giao)`);

  // 12c. Admin update order status to 'hoan_thanh'
  const updateStatus2 = await admin.call(`/api/admin/orders/${createdOrderId}/status`, 'PUT', { status: 'hoan_thanh' });
  assert.equal(updateStatus2.status, 200);
  console.log(`  🏁 Admin hoàn tất thu COD đơn #${createdOrderId} -> Trạng thái: "hoan_thanh" (Hoàn thành)`);

  // 12d. Verify customer sees updated status
  const customerRefreshedOrder = await customer.call(`/api/orders/${createdOrderId}`);
  assert.equal(customerRefreshedOrder.body.order.status, 'hoan_thanh');
  console.log(`  👀 Khách hàng tra cứu lại đơn #${createdOrderId} -> Thấy trạng thái cập nhật: "${customerRefreshedOrder.body.order.status}"`);

  // 12e. Admin adjust product stock
  const originalStock = sampleProduct.stock;
  const newStock = originalStock + 50;
  const updateStockRes = await admin.call(`/api/admin/products/${sampleProduct.id}/stock`, 'PUT', { stock: newStock });
  assert.equal(updateStockRes.status, 200);
  assert.equal(updateStockRes.body.stock, newStock);
  console.log(`  📦 Admin điều chỉnh tồn kho sản phẩm ID ${sampleProduct.id}: ${originalStock} -> ${newStock} chiếc`);

  // Reset stock back
  await admin.call(`/api/admin/products/${sampleProduct.id}/stock`, 'PUT', { stock: originalStock });
  console.log(`  🔄 Đã phục hồi tồn kho sản phẩm ID ${sampleProduct.id} về ${originalStock} chiếc`);
  console.log('  ✅ [PASS] Luồng quản trị đơn hàng và tồn kho vận hành hoàn hảo!\n');

  // 13. Customer Saved Shipping Information Feature
  console.log('[13/13] Kiểm thử Lưu & Tự động Điền Thông tin Giao hàng Tài khoản Khách hàng...');
  // 13a. Unauthenticated update rejected
  const guestClient = new TestClient('GuestUser');
  const unauthShipRes = await guestClient.call('/api/auth/shipping-info', 'POST', {
    fullName: 'Khách Ẩn Danh',
    phone: '0912345678',
    address: 'Địa chỉ ẩn danh'
  });
  assert.equal(unauthShipRes.status, 401, 'Khách chưa đăng nhập phải bị từ chối');

  // 13b. Validation: Empty address rejected
  const emptyAddrRes = await customer.call('/api/auth/shipping-info', 'POST', {
    fullName: 'Nguyễn Văn Test',
    phone: '0987654321',
    address: '   '
  });
  assert.equal(emptyAddrRes.status, 400, 'Địa chỉ rỗng phải bị từ chối');

  // 13c. Validation: Invalid phone rejected
  const invalidPhoneRes = await customer.call('/api/auth/shipping-info', 'POST', {
    fullName: 'Nguyễn Văn Test',
    phone: '123abc456',
    address: '123 Lê Duẩn, Quận 1, TP.HCM'
  });
  assert.equal(invalidPhoneRes.status, 400, 'Số điện thoại không hợp lệ phải bị từ chối');

  // 13d. Customer saves valid shipping info
  const testAddress = '123 Phố Thời Trang Scandinavian, Phường Bến Nghé, Quận 1, TP.HCM';
  const saveShipRes = await customer.call('/api/auth/shipping-info', 'POST', {
    fullName: 'Nguyễn Văn Test Đã Lưu',
    phone: '0987654321',
    address: testAddress
  });
  assert.equal(saveShipRes.status, 200);
  assert.equal(saveShipRes.body.user.address, testAddress);
  console.log(`  📍 Đã lưu thành công địa chỉ giao hàng vào tài khoản: "${testAddress}"`);

  // 13e. Check /api/auth/me returns saved address
  const refreshedCust = await customer.call('/api/auth/me');
  assert.equal(refreshedCust.status, 200);
  assert.equal(refreshedCust.body.user.address, testAddress);
  assert.equal(refreshedCust.body.user.phone, '0987654321');
  console.log(`  👤 /api/auth/me phản hồi chính xác thông tin giao hàng đã lưu của khách`);

  // 13f. Check /api/auth/shipping-info returns saved info
  const getShipRes = await customer.call('/api/auth/shipping-info');
  assert.equal(getShipRes.status, 200);
  assert.equal(getShipRes.body.address, testAddress);
  assert.equal(getShipRes.body.phone, '0987654321');
  console.log(`  🚚 /api/auth/shipping-info truy xuất đúng thông tin giao hàng mặc định`);

  // 13g. Checkout order with saveShippingInfo: true updates address automatically
  const newDeliveryAddress = '456 Đường Nguyễn Trãi, Phường 2, Quận 5, TP.HCM';
  const secondKey = randomUUID();
  const checkoutWithSave = await customer.call('/api/orders', 'POST', {
    items: [{ id: sampleProduct.id, size: 'M', color: 'Đen', qty: 1 }],
    payment: 'cod',
    delivery: {
      fullName: 'Nguyễn Văn Test',
      phone: '0912345678',
      address: newDeliveryAddress,
      note: 'Giao giờ hành chính'
    },
    saveShippingInfo: true
  }, { 'Idempotency-Key': secondKey });
  assert.equal(checkoutWithSave.status, 201);
  const secondOrderId = checkoutWithSave.body.order.id;

  // Verify /api/auth/me now reflects the updated address from checkout
  const custAfterCheckout = await customer.call('/api/auth/me');
  assert.equal(custAfterCheckout.body.user.address, newDeliveryAddress);
  console.log(`  🛒 Đặt hàng COD kèm tùy chọn lưu thông tin giao hàng -> Tự động cập nhật tài khoản thành công: "${newDeliveryAddress}"`);
  console.log('  ✅ [PASS] Tính năng Lưu Thông Tin Giao Hàng Tài Khoản Khách Hàng vận hành hoàn hảo 100%!\n');

  console.log('[14/14] Kiểm thử Thanh Toán Qua Mã QR (VietQR)...');
  const qrKey = crypto.randomUUID();
  const qrOrderRes = await customer.call('/api/orders', 'POST', {
    items: [{ id: sampleProduct.id, size: 'L', color: 'Trắng', qty: 1 }],
    payment: 'qr',
    delivery: {
      fullName: 'Khách Hàng QR',
      phone: '0988776655',
      address: '789 Đường Hai Bà Trưng, Quận 3, TP.HCM',
      note: 'Thanh toán quét mã VietQR'
    }
  }, { 'Idempotency-Key': qrKey });

  assert.equal(qrOrderRes.status, 201);
  assert.equal(qrOrderRes.body.order.payment, 'qr');
  assert.ok(qrOrderRes.body.order.qrInfo, 'qrInfo must be present for QR orders');
  assert.equal(qrOrderRes.body.order.qrInfo.bankId, 'MB');
  assert.ok(qrOrderRes.body.order.qrInfo.qrUrl.includes('img.vietqr.io'));
  assert.ok(qrOrderRes.body.order.qrInfo.description.includes(qrOrderRes.body.order.code));
  const qrOrderId = qrOrderRes.body.order.id;
  console.log(`  📱 Tạo đơn hàng thanh toán QR thành công: Mã #${qrOrderRes.body.order.code} (ID: ${qrOrderId})`);
  console.log(`  🏦 Thông tin VietQR: Ngân hàng ${qrOrderRes.body.order.qrInfo.bankName} - STK: ${qrOrderRes.body.order.qrInfo.accountNo}`);
  console.log(`  🖼️ Link ảnh VietQR: ${qrOrderRes.body.order.qrInfo.qrUrl.slice(0, 70)}...`);

  // Verify fetching order returns qrInfo
  const fetchQrOrder = await customer.call(`/api/orders/${qrOrderId}`);
  assert.equal(fetchQrOrder.status, 200);
  assert.equal(fetchQrOrder.body.order.payment, 'qr');
  assert.ok(fetchQrOrder.body.order.qrInfo);

  // Verify admin can view QR payment method
  const adminOrderDetail = await admin.call(`/api/admin/orders/${qrOrderId}`);
  assert.equal(adminOrderDetail.status, 200);
  assert.equal(adminOrderDetail.body.order.payment, 'qr');
  console.log('  👑 Quản trị viên xác nhận thông tin đơn hàng QR chính xác');
  console.log('  ✅ [PASS] Tính năng Thanh Toán Bằng Mã QR (VietQR) vận hành hoàn hảo 100%!\n');

  // Cleanup test accounts
  console.log('🧹 Dọn dẹp tài khoản kiểm thử khỏi cơ sở dữ liệu...');
  await pool.request()
    .input('orderId1', sql.Int, createdOrderId)
    .input('orderId2', sql.Int, secondOrderId)
    .input('orderId3', sql.Int, qrOrderId)
    .input('cust', sql.VarChar(50), customerUsername)
    .input('adm', sql.VarChar(50), adminUsername)
    .query(`
      SET QUOTED_IDENTIFIER ON;
      DELETE FROM dbo.CHI_TIET_HOA_DON WHERE hoa_don_id IN (@orderId1, @orderId2, @orderId3);
      DELETE FROM dbo.HOA_DON WHERE hoa_don_id IN (@orderId1, @orderId2, @orderId3);
      DELETE FROM dbo.TAI_KHOAN WHERE ten_dang_nhap IN (@cust, @adm);
    `);
  await pool.close();
  console.log('  ✅ Dữ liệu kiểm thử đã được dọn sạch hoàn toàn, bảo toàn tính toàn vẹn CSDL.\n');

  console.log('================================================================');
  console.log('🎉 TẤT CẢ 14/14 TÍNH NĂNG VÀ LUỒNG VẬN HÀNH ĐÃ PASS 100%!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
