'use strict';

const express = require('express');
const { createHash } = require('node:crypto');
const { sql, getPool } = require('./db');
const { csrfProtection, requireUser } = require('./auth');
const { rateLimit } = require('express-rate-limit');
const { clientIpKey } = require('./http-settings');
const keyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const messages = {
  51030: [400, 'Giỏ hàng hoặc khóa yêu cầu không hợp lệ.'],
  51031: [400, 'Sản phẩm không còn tồn tại.'],
  51032: [400, 'Size hoặc màu không hợp lệ. Vui lòng chọn lại sản phẩm.'],
  51033: [409, 'Số lượng mua vượt tồn kho của sản phẩm (cộng tất cả size/màu).'],
  51034: [400, 'Mã giảm giá không hợp lệ hoặc đã hết hạn.'],
  51035: [400, 'Thông tin người nhận không hợp lệ.'],
  51036: [400, 'Hiện chỉ hỗ trợ thanh toán COD.'],
  51037: [401, 'Vui lòng đăng nhập để đặt hàng.'],
  51038: [400, 'Tổng giá trị đơn vượt giới hạn cho phép.'],
  51039: [409, 'Khóa yêu cầu đã được dùng cho nội dung đơn khác.'],
  51040: [404, 'Không tìm thấy đơn hàng của bạn.'],
  51041: [409, 'Đơn đang được xử lý. Vui lòng thử lại cùng yêu cầu.']
};
function bad(message) { const error = new Error(message); error.status = 400; throw error; }
function normalize(body, create) {
  if (!body || !Array.isArray(body.items) || !body.items.length || body.items.length > 50) bad('Giỏ hàng cần có 1–50 dòng sản phẩm.');
  if (body.payment !== 'cod') bad('Hiện chỉ hỗ trợ thanh toán COD.');
  const merged = new Map();
  for (const row of body.items) {
    if (!row || !Number.isSafeInteger(row.id) || row.id < 1 || row.id > 2147483647 ||
        !Number.isSafeInteger(row.qty) || row.qty < 1 || row.qty > 999 ||
        typeof row.size !== 'string' || !row.size.length || row.size.length > 10 ||
        typeof row.color !== 'string' || !row.color.length || row.color.length > 30) bad('ID, size, màu hoặc số lượng không hợp lệ.');
    const key = JSON.stringify([row.id, row.size, row.color]);
    const previous = merged.get(key);
    const qty = row.qty + (previous ? previous.qty : 0);
    if (qty > 999) bad('Số lượng một biến thể không được vượt 999.');
    merged.set(key, { id: row.id, size: row.size, color: row.color, qty });
  }
  const items = [...merged.values()].sort((a, b) => a.id - b.id || (a.size < b.size ? -1 : a.size > b.size ? 1 : a.color < b.color ? -1 : a.color > b.color ? 1 : 0));
  if (body.voucherCode != null && typeof body.voucherCode !== 'string') bad('Mã giảm giá không hợp lệ.');
  const voucherCode = (body.voucherCode || '').trim().toUpperCase() || null;
  if (voucherCode && !/^[A-Z0-9_-]{1,30}$/.test(voucherCode)) bad('Mã giảm giá không hợp lệ.');
  let delivery = null;
  if (create) {
    const d = body.delivery;
    if (!d || typeof d.fullName !== 'string' || typeof d.phone !== 'string' || typeof d.address !== 'string' ||
        (d.note !== undefined && typeof d.note !== 'string')) bad('Thông tin người nhận không hợp lệ.');
    delivery = { fullName: d.fullName.trim(), phone: d.phone.trim(), address: d.address.trim(), note: (d.note || '').trim() };
    if (!delivery.fullName || delivery.fullName.length > 100 || !delivery.address || delivery.address.length > 500 ||
        !/^[0-9]{9,11}$/.test(delivery.phone) || delivery.note.length > 1000 ||
        /[\x00-\x1f\x7f]/.test(delivery.fullName + delivery.address) || /\x00/.test(delivery.note)) bad('Kiểm tra họ tên, địa chỉ, điện thoại 9–11 chữ số và ghi chú tối đa 1000 ký tự.');
  }
  // Deliberately discard userId, price, discount, totals, status, names and images from the request.
  return { items, voucherCode, payment: 'cod', ...(create ? { delivery } : {}) };
}
function serializeOrder(result) {
  const row = result.recordsets[0][0];
  const { fullName, phone, address, note, ...fields } = row;
  return { ...fields, delivery: { fullName, phone, address, note }, items: result.recordsets[1] || [] };
}
function createOrdersRouter() {
  const router = express.Router();
  const limits = (windowMs, accountLimit, ipLimit, message) => [
    rateLimit({ windowMs, limit: ipLimit, keyGenerator: clientIpKey,
      standardHeaders: 'draft-8', legacyHeaders: false, message: { message } }),
    rateLimit({ windowMs, limit: accountLimit, keyGenerator: req => String(req.user.id),
      standardHeaders: 'draft-8', legacyHeaders: false, message: { message } })
  ];
  router.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.use(requireUser, csrfProtection, express.json({ limit: '16kb', strict: true }));
  async function checkout(req, create) {
    const data = normalize(req.body, create);
    const key = req.get('idempotency-key');
    if (create && (!key || !keyPattern.test(key))) bad('Cần khóa Idempotency-Key UUID hợp lệ.');
    const request = (await getPool()).request().input('user_id', sql.Int, req.user.id)
      .input('items', sql.NVarChar(sql.MAX), JSON.stringify(data.items))
      .input('voucher_code', sql.VarChar(30), data.voucherCode).input('create', sql.Bit, create)
      .input('payment', sql.VarChar(20), 'cod');
    if (create) {
      request.input('full_name', sql.NVarChar(100), data.delivery.fullName)
        .input('phone', sql.VarChar(15), data.delivery.phone).input('address', sql.NVarChar(500), data.delivery.address)
        .input('note', sql.NVarChar(1000), data.delivery.note).input('request_key', sql.VarChar(36), key.toLowerCase())
        .input('request_hash', sql.Char(64), createHash('sha256').update(JSON.stringify(data)).digest('hex'));
    }
    return request.execute('dbo.order_checkout');
  }
  router.post('/quote', ...limits(60 * 1000, 60, 120, 'Bạn kiểm tra giỏ hàng quá nhanh. Vui lòng chờ một phút rồi thử lại.'), async (req, res) => {
    const result = await checkout(req, false);
    res.json({ ...result.recordsets[0][0], items: result.recordsets[1] });
  });
  router.post('/', ...limits(15 * 60 * 1000, 10, 30, 'Bạn gửi quá nhiều yêu cầu đặt hàng. Vui lòng chờ 15 phút rồi thử lại.'), async (req, res) => {
    const order = serializeOrder(await checkout(req, true));
    res.status(order.replayed ? 200 : 201).json({ order });
  });
  router.get('/', async (req, res) => {
    const result = await (await getPool()).request().input('user_id', sql.Int, req.user.id).execute('dbo.order_list');
    res.json({ orders: result.recordset });
  });
  router.get('/requests/:key', async (req, res) => {
    if (!keyPattern.test(req.params.key)) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    const result = await (await getPool()).request().input('user_id', sql.Int, req.user.id)
      .input('request_key', sql.VarChar(36), req.params.key.toLowerCase()).execute('dbo.order_get');
    res.json({ order: serializeOrder(result) });
  });
  router.get('/:id', async (req, res) => {
    if (!/^[1-9][0-9]*$/.test(req.params.id) || Number(req.params.id) > 2147483647) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    const result = await (await getPool()).request().input('user_id', sql.Int, req.user.id)
      .input('order_id', sql.Int, Number(req.params.id)).execute('dbo.order_get');
    res.json({ order: serializeOrder(result) });
  });
  router.use((error, req, res, next) => {
    if (error.status === 400 && !error.type) return res.status(400).json({ message: error.message });
    const mapped = messages[error.number];
    if (mapped) return res.status(mapped[0]).json({ message: mapped[1], code: 'order_' + error.number });
    next(error);
  });
  return router;
}
module.exports = { createOrdersRouter };
