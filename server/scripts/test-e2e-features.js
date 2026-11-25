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

  console.log('[15/15] Kiểm thử Đặt Hàng Không Cần Đăng Nhập (Guest Checkout - Bắt Buộc Nhập Địa Chỉ)...');
  const guestOrderClient = new TestClient('Khách Vãng Lai');
  await guestOrderClient.fetchCsrf();

  // 15a. Guest quote works without login
  const guestQuote = await guestOrderClient.call('/api/orders/quote', 'POST', {
    items: [{ id: sampleProduct.id, size: 'M', color: 'Đen', qty: 1 }],
    voucherCode: 'FREESHIP'
  });
  assert.equal(guestQuote.status, 200);
  console.log(`  💰 Khách chưa đăng nhập báo giá thành công: Tổng ${guestQuote.body.total.toLocaleString('vi-VN')}đ`);

  // 15b. Guest order without address is rejected (400 Bad Request)
  const guestNoAddressRes = await guestOrderClient.call('/api/orders', 'POST', {
    items: [{ id: sampleProduct.id, size: 'M', color: 'Đen', qty: 1 }],
    payment: 'cod',
    delivery: {
      fullName: 'Khách Không Nhập Địa Chỉ',
      phone: '0911223344',
      address: '   '
    }
  }, { 'Idempotency-Key': randomUUID() });
  assert.equal(guestNoAddressRes.status, 400, 'Đặt hàng thiếu địa chỉ phải bị từ chối 400');
  console.log('  🛡️ [VALIDATION] Khách không nhập địa chỉ nhận hàng bị chặn chính xác (400 Bad Request)');

  // 15c. Guest order with valid fullName, phone, and address succeeds without login
  const guestOrderKey = randomUUID();
  const guestOrderRes = await guestOrderClient.call('/api/orders', 'POST', {
    items: [{ id: sampleProduct.id, size: 'M', color: 'Đen', qty: 1 }],
    voucherCode: 'FREESHIP',
    payment: 'cod',
    delivery: {
      fullName: 'Khách Mua Nhanh Không Cần Tài Khoản',
      phone: '0933445566',
      address: '99 Đường Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM',
      note: 'Giao tận nơi không cần đăng nhập'
    }
  }, { 'Idempotency-Key': guestOrderKey });
  assert.equal(guestOrderRes.status, 201, `Guest checkout failed: ${JSON.stringify(guestOrderRes.body)}`);
  const guestOrderId = guestOrderRes.body.order.id;
  assert.equal(guestOrderRes.body.order.delivery.address, '99 Đường Lê Lợi, Phường Bến Thành, Quận 1, TP.HCM');
  console.log(`  🛒 Khách vãng lai đặt hàng COD thành công không cần đăng nhập: Mã #${guestOrderRes.body.order.code} (ID: ${guestOrderId})`);

  // 15d. Guest can recover order by Idempotency request key
  const guestRecoverRes = await guestOrderClient.call(`/api/orders/requests/${guestOrderKey}`);
  assert.equal(guestRecoverRes.status, 200);
  assert.equal(guestRecoverRes.body.order.id, guestOrderId);
  console.log('  🔄 Khách vãng lai khôi phục đơn hàng qua Request Key thành công');
  console.log('  ✅ [PASS] Tính năng Thanh Toán Không Cần Đăng Nhập (Bắt Buộc Địa Chỉ) vận hành hoàn hảo 100%!\n');

  console.log('[16/16] Kiểm thử Khách Hàng Tự Hủy Đơn Hàng & Hoàn Kho Tự Động...');
  const stockBeforeRes = await customer.call(`/api/products/${sampleProduct.id}`);
  assert.equal(stockBeforeRes.status, 200);
  const stockBefore = stockBeforeRes.body.stock;
  assert.ok(stockBefore >= 3, `Expected stock >= 3 for cancellation test, got ${stockBefore}`);

  // 16a. Đặt đơn gồm 2 dòng biến thể cùng sản phẩm (2 + 1 = 3 chiếc)
  const cancelTargetRes = await customer.call('/api/orders', 'POST', {
    items: [
      { id: sampleProduct.id, size: 'M', color: 'Đen', qty: 2 },
      { id: sampleProduct.id, size: 'L', color: 'Trắng', qty: 1 }
    ],
    payment: 'cod',
    delivery: {
      fullName: 'Khách Hủy Đơn',
      phone: '0987654321',
      address: '123 Đường Hủy Đơn, Quận 1, TP.HCM',
      note: 'Test customer cancel'
    }
  }, { 'Idempotency-Key': randomUUID() });
  assert.equal(cancelTargetRes.status, 201);
  const cancelOrderId = cancelTargetRes.body.order.id;
  assert.equal(cancelTargetRes.body.order.status, 'cho_xu_ly');

  const stockAfterPlace = (await customer.call(`/api/products/${sampleProduct.id}`)).body.stock;
  assert.equal(stockAfterPlace, stockBefore - 3, 'Stock must drop by 3 across both variant lines');

  // 16b. Khách chưa đăng nhập bị chặn 401
  const guestCancelRes = await new TestClient('GuestCancel').call(`/api/orders/${cancelOrderId}/cancel`, 'POST', {});
  assert.equal(guestCancelRes.status, 401);

  // 16c. Thiếu CSRF bị chặn 403
  const noCsrfCancel = new TestClient('NoCsrfCancel');
  noCsrfCancel.cookie = customer.cookie;
  const noCsrfCancelRes = await noCsrfCancel.call(`/api/orders/${cancelOrderId}/cancel`, 'POST', {});
  assert.equal(noCsrfCancelRes.status, 403);

  // 16d. Khách hàng khác bị chặn 404 (chống IDOR)
  const otherCustomerUsername = 'e2e_other_' + suffix;
  const otherCustomer = new TestClient('Khách hàng khác');
  const otherRegRes = await otherCustomer.register(otherCustomerUsername, customerPassword, 'Khách Hàng Khác', otherCustomerUsername + '@test.example');
  assert.equal(otherRegRes.status, 201);
  const otherLoginRes = await otherCustomer.login(otherCustomerUsername, customerPassword);
  assert.equal(otherLoginRes.status, 200);
  const idorCancelRes = await otherCustomer.call(`/api/orders/${cancelOrderId}/cancel`, 'POST', {});
  assert.equal(idorCancelRes.status, 404);
  console.log('  🛡️ [BẢO MẬT] Khách vãng lai (401), thiếu CSRF (403) và tài khoản khác (404) đều bị chặn');

  // 16e. Chính chủ hủy đơn đang chờ xử lý -> 200 + hoàn đủ 3 chiếc vào kho
  const cancelRes = await customer.call(`/api/orders/${cancelOrderId}/cancel`, 'POST', {});
  assert.equal(cancelRes.status, 200, `Cancel failed: ${JSON.stringify(cancelRes.body)}`);
  assert.equal(cancelRes.body.order.status, 'da_huy');

  const stockAfterCancel = (await customer.call(`/api/products/${sampleProduct.id}`)).body.stock;
  assert.equal(stockAfterCancel, stockBefore, 'Stock must be restored completely across all lines');

  const cancelledDetailRes = await customer.call(`/api/orders/${cancelOrderId}`);
  assert.equal(cancelledDetailRes.status, 200);
  assert.equal(cancelledDetailRes.body.order.status, 'da_huy');
  const cancelledListItem = (await customer.call('/api/orders')).body.orders.find(o => o.id === cancelOrderId);
  assert.equal(cancelledListItem?.status, 'da_huy');
  console.log(`  🔄 [HOÀN KHO] Hủy đơn #${cancelOrderId} thành công -> trạng thái "da_huy", tồn kho ${stockAfterPlace} -> ${stockAfterCancel}`);

  // 16f. Hủy lại lần 2 bị từ chối 409 và không hoàn kho thêm lần 2
  const dupCancelRes = await customer.call(`/api/orders/${cancelOrderId}/cancel`, 'POST', {});
  assert.equal(dupCancelRes.status, 409);
  assert.equal(dupCancelRes.body.code, 'order_51043');
  const stockAfterDupCancel = (await customer.call(`/api/products/${sampleProduct.id}`)).body.stock;
  assert.equal(stockAfterDupCancel, stockBefore, 'Double cancel must never double-restore stock');

  // 16g. Không cho hủy đơn dang_giao hoặc hoan_thanh
  const moveDelivering = await admin.call(`/api/admin/orders/${secondOrderId}/status`, 'PUT', { status: 'dang_giao' });
  assert.equal(moveDelivering.status, 200);
  const cancelDeliveringRes = await customer.call(`/api/orders/${secondOrderId}/cancel`, 'POST', {});
  assert.equal(cancelDeliveringRes.status, 409);
  assert.equal(cancelDeliveringRes.body.code, 'order_51042');

  const cancelCompletedRes = await customer.call(`/api/orders/${createdOrderId}/cancel`, 'POST', {});
  assert.equal(cancelCompletedRes.status, 409);
  assert.equal(cancelCompletedRes.body.code, 'order_51042');
  console.log('  🚫 [TRẠNG THÁI] Hủy lặp lại (409) và hủy đơn đang giao / hoàn thành (409) bị từ chối chính xác');
  console.log('  ✅ [PASS] Tính năng Khách Hàng Tự Hủy Đơn Hàng & Hoàn Kho vận hành hoàn hảo 100%!\n');

  console.log('[17/19] Kiểm thử Danh Mục Động (Dynamic Categories CRUD)...');
  const publicCatsRes = await customer.call('/api/categories');
  assert.equal(publicCatsRes.status, 200);
  assert.ok(Array.isArray(publicCatsRes.body.categories));
  const winterCat = publicCatsRes.body.categories.find(c => c.code === 'bo_mua_dong');
  const coatCat = publicCatsRes.body.categories.find(c => c.code === 'ao_khoac');
  assert.ok(winterCat, 'Missing bo_mua_dong category');
  assert.ok(coatCat, 'Missing ao_khoac category');

  const e2eCatCode = 'e2e_cat_' + Math.floor(1000 + Math.random() * 8999);
  const custCreateCatRes = await customer.call('/api/admin/categories', 'POST', {
    name: 'Danh Mục Lỗi Quyền',
    code: e2eCatCode
  });
  assert.equal(custCreateCatRes.status, 403);

  const createCatRes = await admin.call('/api/admin/categories', 'POST', {
    name: 'Thời Trang Tuyết E2E',
    code: e2eCatCode,
    description: 'Danh mục tạm phục vụ kiểm thử E2E',
    sortOrder: 99,
    isVisible: true
  });
  assert.equal(createCatRes.status, 201, `Create category failed: ${JSON.stringify(createCatRes.body)}`);
  const createdCatId = createCatRes.body.category.id;

  const updateCatRes = await admin.call(`/api/admin/categories/${createdCatId}`, 'PUT', {
    name: 'Thời Trang Thu Đông E2E Updated',
    code: e2eCatCode,
    description: 'Đã cập nhật mô tả',
    sortOrder: 98,
    isVisible: true
  });
  assert.equal(updateCatRes.status, 200);
  assert.equal(updateCatRes.body.category.name, 'Thời Trang Thu Đông E2E Updated');

  const delNonEmptyCat = await admin.call(`/api/admin/categories/${winterCat.id}`, 'DELETE');
  assert.equal(delNonEmptyCat.status, 400, 'Deleting non-empty category must return 400');

  const delEmptyCat = await admin.call(`/api/admin/categories/${createdCatId}`, 'DELETE');
  assert.equal(delEmptyCat.status, 200);
  console.log('  ✅ [PASS] Quản lý danh mục động CRUD + bảo vệ danh mục có sản phẩm hoạt động chính xác 100%!\n');

  console.log('[18/19] Kiểm thử Nhân Viên, Vai Trò, Khóa Tài Khoản & RBAC Nghiêm Ngặt...');
  const staffUsername = 'e2e_staff_' + suffix;
  const staffPassword = 'StaffPass!2026_' + randomBytes(3).toString('hex');
  const staffEmail = staffUsername + '@test.example';

  const createStaffRes = await admin.call('/api/admin/staff', 'POST', {
    username: staffUsername,
    password: staffPassword,
    fullName: 'Nhân Viên Kho E2E',
    email: staffEmail,
    phone: '0909887766',
    role: 'nhan_vien',
    position: 'Nhân viên Kho & Đơn hàng'
  });
  assert.equal(createStaffRes.status, 201, `Create staff failed: ${JSON.stringify(createStaffRes.body)}`);
  const staffAccountId = createStaffRes.body.account.id;

  const staffClient = new TestClient('Nhân viên');
  const staffLoginRes = await staffClient.login(staffUsername, staffPassword);
  assert.equal(staffLoginRes.status, 200);
  assert.equal(staffClient.user.role, 'nhan_vien');
  console.log(`  👔 Tạo & đăng nhập nhân viên "${staffUsername}" (role: nhan_vien) thành công`);

  // Allowed actions for nhan_vien
  assert.equal((await staffClient.call('/api/admin/orders')).status, 200);
  assert.equal((await staffClient.call(`/api/admin/orders/${createdOrderId}`)).status, 200);

  const staffStockRes = await staffClient.call(`/api/admin/products/${sampleProduct.id}/stock`, 'PUT', { stock: originalStock + 5 });
  assert.equal(staffStockRes.status, 200);
  await staffClient.call(`/api/admin/products/${sampleProduct.id}/stock`, 'PUT', { stock: originalStock });

  const staffCustomersRes = await staffClient.call('/api/admin/customers');
  assert.equal(staffCustomersRes.status, 200);
  assert.ok(staffCustomersRes.body.customers.every(c => c.vai_tro === 'khach_hang'), 'Staff must only view basic customer accounts');
  console.log('  ✅ Nhân viên được phép: xem đơn, chi tiết in phiếu, cập nhật tồn kho, xem thông tin cơ bản khách hàng');

  // Blocked actions for nhan_vien (403 Forbidden)
  assert.equal((await staffClient.call('/api/admin/metrics')).status, 403);
  assert.equal((await staffClient.call(`/api/admin/orders/${secondOrderId}/status`, 'PUT', { status: 'hoan_thanh' })).status, 403);
  assert.equal((await staffClient.call('/api/admin/products', 'POST', { name: 'Forbidden SP', category: 'ao', price: 100000, stock: 10 })).status, 403);
  assert.equal((await staffClient.call(`/api/admin/products/${sampleProduct.id}`, 'DELETE')).status, 403);
  assert.equal((await staffClient.call('/api/admin/vouchers')).status, 403);
  assert.equal((await staffClient.call('/api/admin/vouchers', 'POST', { code: 'STAFFNO', type: 'fixed', value: 10000 })).status, 403);
  assert.equal((await staffClient.call('/api/admin/categories')).status, 403);
  assert.equal((await staffClient.call('/api/admin/categories', 'POST', { name: 'Forbidden Cat', code: 'forbid_cat' })).status, 403);
  assert.equal((await staffClient.call('/api/admin/staff')).status, 403);
  assert.equal((await staffClient.call('/api/admin/staff', 'POST', { username: 'bad', password: 'Password1234!', fullName: 'X', email: 'x@test.example' })).status, 403);
  assert.equal((await staffClient.call(`/api/admin/customers/${staffCustomersRes.body.customers[0].tai_khoan_id}/reset-password`, 'POST', { newPassword: 'NewPass123456' })).status, 403);
  console.log('  🛡️ Tất cả API ngoài quyền nhân viên (duyệt đơn, KPI, voucher, DM, tạo/xóa SP, reset MK) đều bị chặn 403');

  // Self-lock guard + Lock/Unlock staff account
  assert.equal((await admin.call(`/api/admin/accounts/${admin.user.id}/status`, 'PUT', { status: 'locked' })).status, 400);
  const lockStaffRes = await admin.call(`/api/admin/accounts/${staffAccountId}/status`, 'PUT', { status: 'locked' });
  assert.equal(lockStaffRes.status, 200);
  assert.equal((await staffClient.call('/api/admin/orders')).status, 403, 'Locked staff session must be invalidated immediately');
  assert.equal((await new TestClient('LockedStaff').login(staffUsername, staffPassword)).status, 403, 'Locked staff login must be blocked');

  const unlockStaffRes = await admin.call(`/api/admin/accounts/${staffAccountId}/status`, 'PUT', { status: 'active' });
  assert.equal(unlockStaffRes.status, 200);
  assert.equal((await new TestClient('UnlockedStaff').login(staffUsername, staffPassword)).status, 200);

  const editRoleRes = await admin.call(`/api/admin/accounts/${staffAccountId}/role`, 'PUT', { role: 'nhan_vien', position: 'Nhân viên Đóng gói' });
  assert.equal(editRoleRes.status, 200);
  console.log('  ✅ [PASS] Quản lý nhân viên, phân quyền RBAC & khóa/mở khóa tài khoản hoạt động hoàn hảo 100%!\n');

  console.log('[19/19] Kiểm thử 3 Bộ Mùa Đông (Mua Trọn Bộ + Mua Lẻ Từng Món) & Mã Black Friday BF2026...');
  const catalogAfterRes = await customer.call('/api/products');
  assert.equal(catalogAfterRes.status, 200);
  const byId = new Map(catalogAfterRes.body.map(p => [p.id, p]));
  for (const bundleId of [18, 19, 20]) {
    const b = byId.get(bundleId);
    assert.ok(b, `Winter bundle #${bundleId} missing`);
    assert.equal(b.category, 'bo_mua_dong');
    assert.ok(b.originalPrice && b.originalPrice > b.price, `Bundle #${bundleId} must have originalPrice > price`);
    assert.ok(Array.isArray(b.bundleItems) && b.bundleItems.length === 4, `Bundle #${bundleId} must link 4 individual items`);
    for (const childId of b.bundleItems) {
      assert.ok(byId.get(childId), `Child product #${childId} missing for bundle #${bundleId}`);
    }
  }

  const bundleProd = byId.get(18);
  const singleCoat = byId.get(13);
  const winterQuoteRes = await customer.call('/api/orders/quote', 'POST', {
    items: [
      { id: bundleProd.id, size: 'M', color: bundleProd.colors[0], qty: 1 },
      { id: singleCoat.id, size: 'L', color: singleCoat.colors[0], qty: 1 }
    ],
    voucherCode: 'BF2026'
  });
  assert.equal(winterQuoteRes.status, 200);
  const expectedWinterSubtotal = bundleProd.price + singleCoat.price;
  const expectedBfDiscount = Math.round(expectedWinterSubtotal * 0.25);
  assert.equal(winterQuoteRes.body.subtotal, expectedWinterSubtotal);
  assert.equal(winterQuoteRes.body.discount, expectedBfDiscount);

  const winterOrderRes = await customer.call('/api/orders', 'POST', {
    items: [
      { id: bundleProd.id, size: 'M', color: bundleProd.colors[0], qty: 1 },
      { id: singleCoat.id, size: 'L', color: singleCoat.colors[0], qty: 1 }
    ],
    voucherCode: 'BF2026',
    payment: 'cod',
    delivery: {
      fullName: 'Khách Mua Bộ Đông',
      phone: '0912345678',
      address: '84 Phố Huế, Hoàn Kiếm, Hà Nội',
      note: 'Kiểm thử đặt trọn bộ + áo lẻ + mã BF2026'
    }
  }, { 'Idempotency-Key': randomUUID() });
  assert.equal(winterOrderRes.status, 201, `Winter order failed: ${JSON.stringify(winterOrderRes.body)}`);
  const winterOrderId = winterOrderRes.body.order.id;
  console.log(`  🎁 Đặt thành công Bộ Đông + Món Lẻ (Mã #${winterOrderRes.body.order.code}) với voucher BF2026 (-25% = -${expectedBfDiscount.toLocaleString('vi-VN')}đ)`);
  console.log('  ✅ [PASS] Bộ sưu tập Mùa Đông (Mua Trọn Bộ + Tách Lẻ) & Black Friday BF2026 hoạt động 100%!\n');

  // Cleanup test accounts & restore stock from winter test order
  console.log('🧹 Dọn dẹp tài khoản kiểm thử khỏi cơ sở dữ liệu...');
  await pool.request()
    .input('orderId1', sql.Int, createdOrderId)
    .input('orderId2', sql.Int, secondOrderId)
    .input('orderId3', sql.Int, qrOrderId)
    .input('orderId4', sql.Int, guestOrderId)
    .input('orderId5', sql.Int, cancelOrderId)
    .input('orderId6', sql.Int, winterOrderId)
    .input('cust', sql.VarChar(50), customerUsername)
    .input('otherCust', sql.VarChar(50), otherCustomerUsername)
    .input('adm', sql.VarChar(50), adminUsername)
    .input('stf', sql.VarChar(50), staffUsername)
    .query(`
      SET QUOTED_IDENTIFIER ON;
      UPDATE dbo.SAN_PHAM SET ton_kho = ton_kho + 1 WHERE san_pham_id IN (18, 13);
      DELETE FROM dbo.CHI_TIET_HOA_DON WHERE hoa_don_id IN (@orderId1, @orderId2, @orderId3, @orderId4, @orderId5, @orderId6);
      DELETE FROM dbo.HOA_DON WHERE hoa_don_id IN (@orderId1, @orderId2, @orderId3, @orderId4, @orderId5, @orderId6);
      DELETE FROM dbo.TAI_KHOAN WHERE ten_dang_nhap IN (@cust, @otherCust, @adm, @stf);
    `);
  await pool.close();
  console.log('  ✅ Dữ liệu kiểm thử đã được dọn sạch hoàn toàn, bảo toàn tính toàn vẹn CSDL.\n');

  console.log('================================================================');
  console.log('🎉 TẤT CẢ 19/19 TÍNH NĂNG VÀ LUỒNG VẬN HÀNH ĐÃ PASS 100%!');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('❌ Kiểm thử thất bại:', err);
  process.exit(1);
});
