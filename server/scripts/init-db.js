'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { sql, config } = require('../src/db');
const products = require('../db/products.seed.json');
const database = 'web_thoi_trang';
const categories = {
  bo_mua_dong: ['Bộ Mùa Đông', 'Bo Mua Dong', 1, 'Trọn bộ phối đồ Thu Đông tiết kiệm đến 33%, hỗ trợ mua nguyên bộ hoặc mua lẻ từng món.'],
  ao_khoac: ['Áo Khoác Đông', 'Ao Khoac Dong', 2, 'Áo khoác gió 2 lớp, lớp phủ giữ ấm Bắc Âu.'],
  ao: ['Áo', 'Ao', 3, 'Áo thun cotton compact, sơ mi Oxford, áo giữ nhiệt.'],
  quan: ['Quần', 'Quan', 4, 'Quần âu dạ Flannel, quần tây công sở và jeans ống suông.'],
  vay: ['Váy', 'Vay', 5, 'Chân váy dạ xếp ly, đầm sơ mi thanh lịch.'],
  phukien: ['Phụ kiện', 'Phu kien', 6, 'Túi tote vải bố, mũ lưỡi trai và thắt lưng da.']
};
let stage = 'connect';

async function seed(transaction) {
  const categoryIds = {};
  for (const [code, [name, legacyName, sortOrder, desc]] of Object.entries(categories)) {
    const result = await new sql.Request(transaction)
      .input('code', sql.VarChar(20), code)
      .input('name', sql.NVarChar(100), name)
      .input('legacy', sql.NVarChar(100), legacyName)
      .input('sortOrder', sql.Int, sortOrder)
      .input('desc', sql.NVarChar(300), desc)
      .query(`
        SET QUOTED_IDENTIFIER ON;
        DECLARE @id INT = (SELECT TOP (1) danh_muc_id FROM dbo.DANH_MUC
          WHERE ma_danh_muc = @code OR (ma_danh_muc IS NULL AND ten_danh_muc IN (@name,@legacy))
          ORDER BY danh_muc_id);
        IF @id IS NULL BEGIN
          INSERT dbo.DANH_MUC(ten_danh_muc, ma_danh_muc, mo_ta, thu_tu, hien_thi)
          VALUES(@name, @code, @desc, @sortOrder, 1);
          SET @id = SCOPE_IDENTITY();
        END ELSE BEGIN
          UPDATE dbo.DANH_MUC
          SET ma_danh_muc = COALESCE(ma_danh_muc, @code),
              mo_ta = COALESCE(mo_ta, @desc),
              thu_tu = CASE WHEN thu_tu = 0 THEN @sortOrder ELSE thu_tu END
          WHERE danh_muc_id = @id;
        END
        SELECT @id AS id;`);
    categoryIds[code] = result.recordset[0].id;
  }

  for (const product of products) {
    const request = new sql.Request(transaction)
      .input('id', sql.Int, product.id)
      .input('name', sql.NVarChar(150), product.name)
      .input('description', sql.NVarChar(sql.MAX), product.description)
      .input('price', sql.Int, product.price)
      .input('originalPrice', sql.Int, product.originalPrice ?? null)
      .input('bundleItems', sql.NVarChar(sql.MAX), Array.isArray(product.bundleItems) ? JSON.stringify(product.bundleItems) : null)
      .input('category', sql.Int, categoryIds[product.category])
      .input('sizes', sql.NVarChar(sql.MAX), JSON.stringify(product.sizes))
      .input('colors', sql.NVarChar(sql.MAX), JSON.stringify(product.colors))
      .input('images', sql.NVarChar(sql.MAX), JSON.stringify(product.images))
      .input('indices', sql.NVarChar(sql.MAX), JSON.stringify(product.colorImageIndices))
      .input('isNew', sql.Bit, product.isNew);
    await request.query(`
      SET QUOTED_IDENTIFIER ON;
      IF EXISTS (SELECT 1 FROM dbo.SAN_PHAM WHERE san_pham_id=@id AND
        (ten_sp COLLATE Latin1_General_100_BIN2 <> @name COLLATE Latin1_General_100_BIN2 OR danh_muc_id<>@category))
        THROW 51001, 'Product ID conflict. No product or order has been overwritten. Review mapping first.', 1;
      IF NOT EXISTS (SELECT 1 FROM dbo.SAN_PHAM WHERE san_pham_id=@id) BEGIN
        SET IDENTITY_INSERT dbo.SAN_PHAM ON;
        -- DEMO STOCK ONLY: 50 units per product, not per size/color. Never reset on rerun.
        INSERT dbo.SAN_PHAM(san_pham_id,ten_sp,mo_ta,gia,gia_goc,bundle_items_json,ton_kho,danh_muc_id,
          sizes_json,colors_json,images_json,color_image_indices_json,la_moi)
        VALUES(@id,@name,@description,@price,@originalPrice,@bundleItems,50,@category,@sizes,@colors,@images,@indices,@isNew);
        SET IDENTITY_INSERT dbo.SAN_PHAM OFF;
      END ELSE BEGIN
        -- Fill missing metadata only. Preserve existing prices, stock and non-null metadata.
        UPDATE dbo.SAN_PHAM SET sizes_json=COALESCE(sizes_json,@sizes),
          colors_json=COALESCE(colors_json,@colors), images_json=COALESCE(images_json,@images),
          color_image_indices_json=COALESCE(color_image_indices_json,@indices), la_moi=COALESCE(la_moi,@isNew),
          gia_goc=COALESCE(gia_goc,@originalPrice), bundle_items_json=COALESCE(bundle_items_json,@bundleItems)
        WHERE san_pham_id=@id;
      END`);
  }

  for (const voucher of [
    { code: 'ENDLESS10', type: 'percent', value: 10 },
    { code: 'FREESHIP', type: 'fixed', value: 30000 },
    { code: 'BF2026', type: 'percent', value: 25 },
    { code: 'BF50K', type: 'fixed', value: 50000 }
  ]) {
    await new sql.Request(transaction)
      .input('code', sql.VarChar(30), voucher.code)
      .input('type', sql.VarChar(10), voucher.type)
      .input('value', sql.Int, voucher.value)
      .query(`
        IF EXISTS (SELECT 1 FROM dbo.VOUCHER WHERE ma_code=@code AND (loai_giam<>@type OR gia_tri<>@value))
          THROW 51002, 'Voucher conflict. Existing data preserved.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.VOUCHER WHERE ma_code=@code)
          INSERT dbo.VOUCHER(ma_code,loai_giam,gia_tri,han_su_dung) VALUES(@code,@type,@value,NULL);`);
  }
}

async function initialize() {
  if (process.env.DB_DATABASE !== database) throw new Error('This migration is for web_thoi_trang only');
  const runtimeUser = process.env.RUNTIME_DB_USER;
  const runtimePassword = process.env.RUNTIME_DB_PASSWORD;
  if (runtimeUser !== 'endless_runtime' || !runtimePassword || runtimePassword.length < 24) {
    throw new Error('A dedicated runtime user and a strong runtime password are required');
  }
  const master = await new sql.ConnectionPool(config('master')).connect();
  let pool;
  try {
    stage = 'create database';
    await master.request().batch(fs.readFileSync(path.join(__dirname, '../db/001-database.sql'), 'utf8'));
    pool = await new sql.ConnectionPool(config(database)).connect();
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      await new sql.Request(transaction).batch(`SET XACT_ABORT ON;
        DECLARE @result INT;
        EXEC @result=sys.sp_getapplock @Resource=N'endlessshop-migration', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=10000;
        IF @result < 0 THROW 51003, 'Migration lock unavailable', 1;`);
      stage = 'schema';
      for (const file of ['002-schema.sql', '003-auth.sql', '004-orders.sql', '005-staff-categories-winter.sql', '006-feedback.sql']) {
        const schema = fs.readFileSync(path.join(__dirname, '../db', file), 'utf8');
        for (const batch of schema.split(/^\s*GO\s*$/mi).filter(x => x.trim())) {
          await new sql.Request(transaction).batch(batch);
        }
      }
      stage = 'seed';
      await seed(transaction);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }

    stage = 'runtime login';
    // SQL Server DDL cannot parameterize a password literal. QUOTENAME escapes it on the server.
    await master.request().input('runtimePassword', sql.NVarChar(128), runtimePassword).query(`
      IF SUSER_ID(N'endless_runtime') IS NULL BEGIN
        DECLARE @ddl NVARCHAR(MAX)=N'CREATE LOGIN [endless_runtime] WITH PASSWORD='
          + QUOTENAME(@runtimePassword, '''') + N', CHECK_POLICY=ON, DEFAULT_DATABASE=[web_thoi_trang]';
        EXEC sys.sp_executesql @ddl;
      END;`);
    stage = 'runtime permissions';
    await pool.request().batch(`
      IF DATABASE_PRINCIPAL_ID(N'endless_runtime') IS NULL
        CREATE USER [endless_runtime] FOR LOGIN [endless_runtime];
      GRANT CONNECT TO [endless_runtime];
      GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.SAN_PHAM TO [endless_runtime];
      GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.DANH_MUC TO [endless_runtime];
      GRANT EXECUTE ON OBJECT::dbo.auth_create_customer TO [endless_runtime];
      GRANT EXECUTE ON OBJECT::dbo.auth_find_account TO [endless_runtime];
      GRANT EXECUTE ON OBJECT::dbo.auth_profile TO [endless_runtime];
      GRANT EXECUTE ON OBJECT::dbo.auth_update_shipping_info TO [endless_runtime];
      GRANT EXECUTE ON OBJECT::dbo.admin_update_stock TO [endless_runtime];
      GRANT EXECUTE ON OBJECT::dbo.admin_update_order_status TO [endless_runtime];
      GRANT SELECT, INSERT, UPDATE, DELETE ON OBJECT::dbo.AUTH_SESSION TO [endless_runtime];
      GRANT SELECT, INSERT, DELETE ON OBJECT::dbo.VOUCHER TO [endless_runtime];
      GRANT SELECT, INSERT, UPDATE ON OBJECT::dbo.TAI_KHOAN TO [endless_runtime];
      GRANT SELECT, UPDATE ON OBJECT::dbo.HOA_DON TO [endless_runtime];
      GRANT SELECT ON OBJECT::dbo.CHI_TIET_HOA_DON TO [endless_runtime];
      GRANT EXECUTE ON OBJECT::dbo.order_checkout TO [endless_runtime];
      GRANT EXECUTE ON OBJECT::dbo.order_get TO [endless_runtime];
      GRANT EXECUTE ON OBJECT::dbo.order_list TO [endless_runtime];
      GRANT SELECT, INSERT, UPDATE ON OBJECT::dbo.PHAN_HOI TO [endless_runtime];
      GRANT EXECUTE ON OBJECT::dbo.order_cancel TO [endless_runtime];`);
    stage = 'runtime connection';
    const runtime = await new sql.ConnectionPool({ ...config(database), user: runtimeUser, password: runtimePassword }).connect();
    try { await runtime.request().query('SELECT TOP (1) san_pham_id FROM dbo.SAN_PHAM'); }
    finally { await runtime.close(); }
    console.log('Database ready: schema + dynamic categories + staff RBAC + Black Friday winter bundles & vouchers.');
  } finally {
    if (pool) await pool.close();
    await master.close();
  }
}

initialize().catch(error => {
  // Never print a SQL statement, connection configuration, password or raw driver message.
  console.error(`Database initialization failed at ${stage} (code: ${error.number || error.code || 'configuration'}).`);
  if (error.number === 51001) console.error('Existing product ID conflicts with frontend; existing records were preserved.');
  if (error.number === 51002) console.error('Existing voucher differs from the expected definition; data was preserved.');
  process.exitCode = 1;
});
