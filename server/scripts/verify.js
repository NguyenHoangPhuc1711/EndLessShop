'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getPool, closePool } = require('../src/db');
const base = process.env.VERIFY_BASE_URL || 'http://127.0.0.1:3000';

async function verify() {
  const health = await fetch(base + '/api/health');
  assert.equal(health.status, 200);
  const status = await health.json();
  assert.deepEqual(status, { status: 'ok' });

  const response = await fetch(base + '/api/products');
  assert.equal(response.status, 200);
  const products = await response.json();
  const frontend = path.resolve(__dirname, '../../frontend');
  // Seed is a server-side migration fixture, no longer a public frontend data source.
  const original = require('../db/products.seed.json');
  assert.equal(/const\s+products\s*=/.test(fs.readFileSync(path.join(frontend, 'js/products.js'), 'utf8')), false);
  for (const product of original) {
    const actual = products.find(row => row.id === product.id);
    assert.ok(actual, 'Missing frontend product ' + product.id);
    const { stock, ...fields } = actual;
    assert.deepEqual(fields, product, 'Database/frontend mismatch at ID ' + product.id);
    assert.ok(Number.isInteger(stock) && stock >= 0);
  }
  assert.equal(products.find(p => p.id === 2).name, 'Áo sơ mi tay dài');

  const checked = new Set();
  async function checkAsset(asset, from) {
    if (!asset || /^(https?:|data:|#)/i.test(asset)) return;
    const url = new URL(asset, from);
    if (url.origin !== new URL(base).origin || checked.has(url.href)) return;
    checked.add(url.href);
    const result = await fetch(url);
    assert.equal(result.status, 200, 'Asset unavailable: ' + url.pathname);
    if (url.pathname.endsWith('.css')) {
      const css = await result.text();
      for (const match of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) await checkAsset(match[1], url);
    }
  }
  for (const document of ['/', '/index.html', '/checkout.html', '/account.html', '/login.html', '/register.html']) {
    const url = new URL(document, base);
    const result = await fetch(url);
    assert.equal(result.status, 200);
    assert.match(result.headers.get('content-type'), /text\/html/);
    const html = await result.text();
    if (document === '/login.html' || document === '/register.html') {
      assert.equal((html.match(/<form id="(?:login|register)Form"/g) || []).length, 1);
      assert.ok(html.includes(document === '/login.html' ? 'id="loginForm"' : 'id="registerForm"'));
    }
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      if (/\.(css|js|png|jpg|jpeg)(?:[?#]|$)/i.test(match[1])) await checkAsset(match[1], url);
    }
  }
  for (const product of products) for (const image of product.images) await checkAsset(image, new URL('/', base));
  for (const blocked of ['/.env', '/.env.example', '/compose.yaml', '/server/package.json', '/server/db/002-schema.sql', '/.git/config', '/.reference/bao-ve-extracted.txt', '/api/missing']) {
    assert.equal((await fetch(base + blocked)).status, 404, 'Private file exposed: ' + blocked);
  }

  const permissions = await (await getPool()).request().query(`
    SELECT ORIGINAL_LOGIN() AS login_name,
      IS_SRVROLEMEMBER('sysadmin') AS is_admin,
      HAS_PERMS_BY_NAME('dbo.SAN_PHAM','OBJECT','SELECT') AS can_read_products,
      HAS_PERMS_BY_NAME('dbo.SAN_PHAM','OBJECT','UPDATE') AS can_change_products,
      HAS_PERMS_BY_NAME('dbo.TAI_KHOAN','OBJECT','SELECT') AS can_read_accounts,
      HAS_PERMS_BY_NAME('dbo.HOA_DON','OBJECT','INSERT') AS can_create_orders,
      HAS_PERMS_BY_NAME('dbo.CHI_TIET_HOA_DON','OBJECT','INSERT') AS can_insert_details,
      HAS_PERMS_BY_NAME('dbo.order_checkout','OBJECT','EXECUTE') AS can_execute_checkout,
      IS_MEMBER('db_owner') AS is_owner,
      HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','ALTER') AS can_alter_database`);
  const permission = permissions.recordset[0];
  assert.equal(permission.login_name, 'endless_runtime');
  assert.equal(permission.is_admin, 0);
  assert.equal(permission.can_read_products, 1);
  assert.equal(permission.can_execute_checkout, 1);
  for (const field of ['is_owner', 'can_change_products', 'can_read_accounts', 'can_create_orders', 'can_insert_details', 'can_alter_database']) {
    assert.notEqual(permission[field], 1, 'Excess runtime permission: ' + field);
  }
  console.log(JSON.stringify({ health: 'SQL query succeeded', products: products.length, frontendIdsMatch: true,
    assetsChecked: checked.size, privatePaths: '404', runtime: 'Product/category SELECT; auth/COD procedures + session CRUD; no direct account/order/stock writes' }, null, 2));
}

verify().catch((e) => {
  console.error('Verification failed. Check API, database mapping, assets and runtime permissions.', e);
  process.exitCode = 1;
}).finally(() => closePool().catch(() => {}));
