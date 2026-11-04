'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function verify() {
  const raw = await (await fetch('http://localhost:3000/api/products')).json();
  const storage = new Map();
  const frontend = fs.existsSync(path.resolve(__dirname, '../../frontend'))
    ? path.resolve(__dirname, '../../frontend') : path.resolve(__dirname, '../../web-ban-quan-ao');
  const context = vm.createContext({ URL, AbortSignal, console, location: new URL('http://localhost:3000/'),
    window: { location: { href: 'http://localhost:3000/', origin: 'http://localhost:3000' } },
    localStorage: { getItem: key => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    fetch: async () => ({ ok: true, json: async () => raw }) });
  vm.runInContext(fs.readFileSync(path.join(frontend, 'js/config.js'), 'utf8'), context);
  context.EndlessConfig = context.window.EndlessConfig;
  vm.runInContext(fs.readFileSync(path.join(frontend, 'js/catalog.js'), 'utf8'), context);
  const catalog = context.window.EndlessCatalog;
  const products = await catalog.fetchProducts();
  assert.equal(products.length, 12);
  assert.equal(products.find(p => p.id === 2).name, 'Áo sơ mi tay dài');
  assert.equal(products.find(p => p.id === 4).name, 'Quần jean ống suông');
  assert.throws(() => catalog.validateProducts({ products: raw }));
  assert.throws(() => catalog.validateProducts([...raw, raw[0]]));
  assert.throws(() => catalog.validateProducts([{ ...raw[0], price: '189000' }]));
  assert.throws(() => catalog.validateProducts([{ ...raw[0], images: ['javascript:alert(1)'] }]));
  assert.throws(() => catalog.validateProducts([{ ...raw[0], images: ['https://foreign.example/test.jpg'] }]));
  assert.equal(catalog.imagePath('../img/id 2.jpg'), 'img/id%202.jpg');
  assert.equal(catalog.imagePath('/img/../../.env'), '');
  assert.equal(catalog.escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
  assert.equal(catalog.validateProducts([{ ...raw[0], name: '<script>test</script>' }])[0].name, '<script>test</script>');
  storage.set('moc_cart', '{broken');
  assert.equal(catalog.readArray('moc_cart').length, 0);
  storage.set('moc_wishlist', '{"invalid":"shape"}');
  assert.equal(catalog.readArray('moc_wishlist').length, 0);
  const legacy = { id: 2, name: 'Áo sơ mi tay dài', size: 'M', color: 'Đen', qty: '2', price: 1, image: 'javascript:alert(1)' };
  const cart = catalog.reconcileCart([legacy, { ...legacy, name: 'Quần jean ống suông' }, { ...legacy, id: 999 }, null,
    { ...legacy, qty: { toString: {} } }], products);
  assert.equal(cart.length, 1);
  assert.equal(cart[0].id, 2);
  assert.equal(cart[0].price, products.find(p => p.id === 2).price);
  assert.equal(cart[0].qty, 2);
  assert.equal(cart[0].image.startsWith('img/'), true);
  assert.equal(cart[0].catalogSource, 'sql-v1');
  const renamed = products.map(p => p.id === 2 ? { ...p, name: 'Current name', price: p.price + 1 } : p);
  assert.equal(catalog.reconcileCart(cart, renamed)[0].name, 'Current name');
  assert.equal(catalog.reconcileWishlist([2, 2, 999, {}, null], products).length, 1);
  storage.set('moc_orders', '[null,{"items":null},{"total":{"toString":{}}}]');
  assert.equal(catalog.readOrders().length, 0);
  context.fetch = async () => ({ ok: false });
  await assert.rejects(catalog.fetchProducts());
  context.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(catalog.fetchProducts());
  context.localStorage.setItem = () => { throw new Error('Storage blocked'); };
  assert.equal(catalog.write('moc_cart', '[]'), false);
  console.log('PASS: API contract, duplicate/unsafe data, URL/HTML safety, corrupt storage, exact legacy ID mapping, repricing, wishlist and no API fallback');
}

verify().catch(() => { console.error('Catalog validation check failed.'); process.exitCode = 1; });
