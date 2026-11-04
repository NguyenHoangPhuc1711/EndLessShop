'use strict';

const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const fs = require('node:fs');
const { sql, config } = require('../src/db');
const run = process.env.TEST_RUN_ID;
if (!/^[0-9a-f]{12}$/.test(run || '')) throw new Error('Explicit test run marker required');
const tag = 'COD-TEST:' + run;
const base = process.env.TEST_API_BASE_URL;
const names = ['cod_a_' + run, 'cod_b_' + run, 'cod_ui_' + run];
const products = [];
const reports = [];
const constraint = 'CK_COD_TEST_' + run;
let pool, originalProducts, originalOrders, stage = 'setup';
const report = message => { reports.push(message); console.log('PASS: ' + message); };
class Client {
  constructor() { this.cookie = ''; this.token = ''; }
  async request(path, body, key) {
    const response = await fetch(base + '/api/' + path, { method: body ? 'POST' : 'GET',
      headers: { Cookie: this.cookie, ...(body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': this.token } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
      body: body ? JSON.stringify(body) : undefined });
    for (const cookie of response.headers.getSetCookie()) if (cookie.startsWith('endless.sid=')) this.cookie = cookie.split(';')[0];
    return { status: response.status, body: await response.json() };
  }
  async login(username) {
    const password = randomBytes(24).toString('hex') + '!A9';
    this.token = (await this.request('auth/csrf')).body.csrfToken;
    const created = await this.request('auth/register', { username, password, fullName: tag, email: username + '@example.invalid' });
    assert.equal(created.status, 201);
    const login = await this.request('auth/login', { username, password });
    assert.equal(login.status, 200);
    this.token = login.body.csrfToken;
    this.userId = login.body.user.id;
  }
}
const stock = async id => (await pool.request().input('id', sql.Int, id).query('SELECT ton_kho AS stock FROM dbo.SAN_PHAM WHERE san_pham_id=@id')).recordset[0].stock;
async function snapshot() {
  return (await pool.request().input('prefix', sql.NVarChar(150), tag + '%').query(`
    SELECT COUNT(*) AS count,SUM(ton_kho) AS stock,CHECKSUM_AGG(BINARY_CHECKSUM(*)) AS checksum
    FROM dbo.SAN_PHAM WHERE ten_sp NOT LIKE @prefix`)).recordset[0];
}
async function addProduct(label, quantity, price) {
  const result = await pool.request().input('name', sql.NVarChar(150), tag + ' ' + label).input('stock', sql.Int, quantity).input('price', sql.Int, price).query(`
    INSERT dbo.SAN_PHAM(ten_sp,mo_ta,gia,ton_kho,danh_muc_id,sizes_json,colors_json,images_json,color_image_indices_json,la_moi)
    OUTPUT inserted.san_pham_id AS id
    SELECT @name,N'Test fixture only',@price,@stock,danh_muc_id,N'["M","L"]',N'["Đen","Trắng"]',
      N'["/img/id1.1.jpg","/img/id1.4.jpg"]',N'{"Đen":0,"Trắng":1}',0 FROM dbo.DANH_MUC WHERE ma_danh_muc='ao';`);
  const id = result.recordset[0].id;
  products.push(id);
  return id;
}
async function cleanup() {
  if (!pool) return;
  await pool.request().batch(`IF OBJECT_ID(N'dbo.${constraint}',N'C') IS NOT NULL ALTER TABLE dbo.CHI_TIET_HOA_DON DROP CONSTRAINT [${constraint}];`);
  // Exact per-run account names + recipient note marker isolate all deletion to newly created fixtures.
  await pool.request().input('a', sql.VarChar(50), names[0]).input('b', sql.VarChar(50), names[1]).input('ui', sql.VarChar(50), names[2])
    .input('tag', sql.NVarChar(1000), tag).input('prefix', sql.NVarChar(150), tag + '%').input('expired', sql.VarChar(30), 'COD_EX_' + run).query(`
      SET XACT_ABORT ON; BEGIN TRAN;
      DECLARE @users TABLE(id INT PRIMARY KEY);
      INSERT @users SELECT tai_khoan_id FROM dbo.TAI_KHOAN WHERE ten_dang_nhap IN(@a,@b,@ui) AND ho_ten=@tag AND email LIKE '%@example.invalid';
      DELETE d FROM dbo.CHI_TIET_HOA_DON d JOIN dbo.HOA_DON h ON h.hoa_don_id=d.hoa_don_id JOIN @users u ON u.id=h.khach_hang_id WHERE h.ghi_chu=@tag;
      DELETE h FROM dbo.HOA_DON h JOIN @users u ON u.id=h.khach_hang_id WHERE h.ghi_chu=@tag;
      DELETE s FROM dbo.AUTH_SESSION s JOIN @users u ON u.id=TRY_CONVERT(INT,JSON_VALUE(s.session_data,'$.userId'));
      DELETE a FROM dbo.TAI_KHOAN a JOIN @users u ON u.id=a.tai_khoan_id
        WHERE NOT EXISTS(SELECT 1 FROM dbo.HOA_DON h WHERE h.khach_hang_id=a.tai_khoan_id OR h.nhan_vien_id=a.tai_khoan_id);
      DELETE p FROM dbo.SAN_PHAM p WHERE ten_sp LIKE @prefix AND mo_ta=N'Test fixture only'
        AND NOT EXISTS(SELECT 1 FROM dbo.CHI_TIET_HOA_DON d WHERE d.san_pham_id=p.san_pham_id);
      DELETE v FROM dbo.VOUCHER v WHERE ma_code=@expired AND NOT EXISTS(SELECT 1 FROM dbo.HOA_DON h WHERE h.voucher_id=v.voucher_id);
      COMMIT;`);
  assert.deepEqual(await snapshot(), originalProducts);
  const orderCount = (await pool.request().query('SELECT COUNT(*) AS count FROM dbo.HOA_DON')).recordset[0].count;
  assert.equal(orderCount, originalOrders);
  report('Only tagged fixtures cleaned; original products/stock checksum and existing orders unchanged');
}
async function verify() {
  pool = await new sql.ConnectionPool(config()).connect();
  originalProducts = await snapshot();
  originalOrders = (await pool.request().query('SELECT COUNT(*) AS count FROM dbo.HOA_DON')).recordset[0].count;
  const basic = await addProduct('basic', 20, 100000);
  const fixed = await addProduct('fixed', 2, 10000);
  const aggregate = await addProduct('aggregate', 3, 25000);
  const last = await addProduct('last-unit', 1, 20000);
  const rollback = await addProduct('rollback', 5, 15000);
  const same = await addProduct('same-request', 5, 12000);
  const ui = await addProduct('browser', 3, 5000);
  await pool.request().input('code', sql.VarChar(30), 'COD_EX_' + run).query(`INSERT dbo.VOUCHER(ma_code,loai_giam,gia_tri,han_su_dung) VALUES(@code,'percent',10,DATEADD(DAY,-1,GETDATE()))`);
  const a = new Client(), b = new Client(), guest = new Client();
  await a.login(names[0]); await b.login(names[1]);
  const line = (id, qty = 1, size = 'M', color = 'Đen') => ({ id, qty, size, color });
  const order = (items, voucherCode = null) => ({ items, voucherCode, payment: 'cod',
    delivery: { fullName: tag, phone: '0900000000', address: 'Test fixture address', note: tag } });
  stage = 'success';
  const body = order([line(basic, 1, 'M'), line(basic, 2, 'L')], 'ENDLESS10');
  const key = randomUUID();
  assert.equal((await guest.request('orders', body, randomUUID())).status, 401);
  const noCsrf = new Client(); noCsrf.cookie = a.cookie;
  assert.equal((await noCsrf.request('orders', body, randomUUID())).status, 403);
  const made = await a.request('orders', body, key);
  assert.equal(made.status, 201);
  const first = made.body.order;
  assert.equal(first.subtotal, 300000); assert.equal(first.discount, 30000); assert.equal(first.total, 270000);
  assert.equal(first.items.length, 2); assert.equal(await stock(basic), 17);
  const persisted = (await pool.request().input('id', sql.Int, first.id).query(`
    SELECT khach_hang_id AS owner,trang_thai AS status,tong_tien AS total,
      (SELECT COUNT(*) FROM dbo.CHI_TIET_HOA_DON d WHERE d.hoa_don_id=h.hoa_don_id) AS lines
    FROM dbo.HOA_DON h WHERE hoa_don_id=@id`)).recordset[0];
  assert.equal(persisted.owner, a.userId); assert.equal(persisted.total, 270000); assert.equal(persisted.lines, 2);
  report('COD persisted with SQL details/prices/percent voucher; total stock deducted across size/color lines; guest + CSRF rejected');
  stage = 'tampering';
  const tampered = order([{ ...line(basic), price: 1, total: 0 }], 'ENDLESS10');
  Object.assign(tampered, { userId: b.userId, status: 'hoan_thanh', total: 1, discount: 999999, subtotal: 1 });
  const tamperResult = await a.request('orders', tampered, randomUUID());
  assert.equal(tamperResult.status, 201); assert.equal(tamperResult.body.order.total, 90000);
  assert.equal(tamperResult.body.order.status, 'cho_xu_ly');
  assert.equal((await b.request('orders/' + tamperResult.body.order.id)).status, 404);
  const listB = await b.request('orders'); assert.equal(listB.body.orders.some(o => o.id === first.id), false);
  assert.equal((await a.request('orders/' + first.id)).status, 200);
  assert.equal((await b.request('orders/requests/' + key)).status, 404);
  report('Client price/total/discount/status/userId ignored; list/detail/request recovery enforce ownership');
  stage = 'validation';
  for (const invalid of [order([line(basic,-1)]),order([line(basic,0.5)]),order([line(basic,999)]),
    order([line(basic,1,'BAD')]),order([line(basic,1,'M ')]),order([line(basic,1,'M','Đỏ')]),
    order([line(2147483647)]),order([line(basic)],'NO_SUCH_'+run),order([line(basic)],'COD_EX_'+run),
    { ...order([line(basic)]),payment:'transfer' },
    { ...order([line(basic)]),delivery:{...body.delivery,fullName:'   '} },
    { ...order([line(basic)]),delivery:{...body.delivery,address:' \t '} },
    { ...order([line(basic)]),delivery:{...body.delivery,phone:'abc'} }]) {
    assert.ok([400,409].includes((await a.request('orders',invalid,randomUUID())).status));
  }
  const free = await a.request('orders', order([line(fixed)],'FREESHIP'), randomUUID());
  assert.equal(free.status,201); assert.equal(free.body.order.discount,10000); assert.equal(free.body.order.total,0);
  const over = order([line(aggregate,2,'M'),line(aggregate,2,'L')]);
  assert.equal((await a.request('orders',over,randomUUID())).status,409); assert.equal(await stock(aggregate),3);
  report('Negative/fractional/excess quantities, invalid variant/receiver/COD/voucher/expiry rejected; aggregate product stock enforced; fixed discount floors at zero');
  stage = 'idempotency';
  const replay = await a.request('orders',body,key); assert.equal(replay.status,200); assert.equal(replay.body.order.id,first.id);
  const recovered = await a.request('orders/requests/'+key);
  assert.equal(recovered.status,200); assert.equal(recovered.body.order.id,first.id);
  assert.equal(await stock(basic),16);
  assert.equal((await a.request('orders',order([line(basic,2)]),key)).status,409);
  const sameBody=order([line(same)]), sameKey=randomUUID();
  const duplicate=await Promise.all([a.request('orders',sameBody,sameKey),a.request('orders',sameBody,sameKey)]);
  assert.deepEqual(duplicate.map(r=>r.status).sort(),[200,201]);
  assert.equal(duplicate[0].body.order.id,duplicate[1].body.order.id); assert.equal(await stock(same),4);
  report('Repeated and simultaneous same-key requests create/deduct once; changed payload with same key rejected');
  stage = 'last stock';
  const race=await Promise.all([a.request('orders',order([line(last)]),randomUUID()),b.request('orders',order([line(last)]),randomUUID())]);
  assert.deepEqual(race.map(r=>r.status).sort(),[201,409]); assert.equal(await stock(last),0);
  report('Two concurrent buyers of the last unit: exactly one succeeds; no negative stock');
  stage = 'rollback';
  const before=(await pool.request().query('SELECT COUNT(*) AS count FROM dbo.HOA_DON')).recordset[0].count;
  await pool.request().batch(`ALTER TABLE dbo.CHI_TIET_HOA_DON ADD CONSTRAINT [${constraint}] CHECK(san_pham_id<>${rollback})`);
  const failed=await a.request('orders',order([line(rollback)]),randomUUID()); assert.equal(failed.status,500);
  assert.equal(await stock(rollback),5);
  assert.equal((await pool.request().query('SELECT COUNT(*) AS count FROM dbo.HOA_DON')).recordset[0].count,before);
  assert.equal((await pool.request().input('id',sql.Int,rollback).query('SELECT COUNT(*) AS count FROM dbo.CHI_TIET_HOA_DON WHERE san_pham_id=@id')).recordset[0].count,0);
  await pool.request().batch(`ALTER TABLE dbo.CHI_TIET_HOA_DON DROP CONSTRAINT [${constraint}]`);
  report('Actual SQL detail constraint failure rolls back the inserted parent and already-updated stock');
  assert.equal((await a.request('products')).status,200); assert.equal((await a.request('auth/me')).status,200);
  const logout=await b.request('auth/logout',{}); assert.equal(logout.status,200); assert.equal((await b.request('auth/me')).status,401);
  report('Product API and login/me/logout regression passed');
  if(process.env.TEST_WAIT_FOR_BROWSER==='true') {
    stage = 'browser';
    fs.writeFileSync('/test-control/ready.json',JSON.stringify({run,productId:ui,price:5000,tag}));
    console.log('Browser fixture ready; waiting up to 180 seconds for done.flag.');
    for(let i=0;i<360&&!fs.existsSync('/test-control/done.flag');i++) await new Promise(resolve=>setTimeout(resolve,500));
    assert.ok(fs.existsSync('/test-control/done.flag'),'Browser test did not finish');
  }
}
(async()=>{
  try{await verify();}catch{console.error('COD verification failed at '+stage+'; credentials and personal data withheld.');process.exitCode=1;}
  finally{
    try{await cleanup();}catch{console.error('Fixture cleanup requires review; only per-run test markers may be removed.');process.exitCode=1;}
    if(pool)await pool.close();
    fs.writeFileSync('/test-control/report.json',JSON.stringify({run,passed:!process.exitCode,checks:reports},null,2));
  }
})();
