'use strict';

// Isolated HTTP/frontend regression checks: SQL is replaced before importing app modules.
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const session = require('express-session');
const { randomBytes } = require('node:crypto');
const { once } = require('node:events');
require.cache[require.resolve('../src/db')] = { loaded: true, exports: { sql: {},
  getPool: () => { throw new Error('SQL access is forbidden in connection tests'); }
} };
require.cache[require.resolve('../src/session-store')] = { loaded: true, exports: {
  SqlSessionStore: session.MemoryStore, SESSION_MS: 7200000
} };
const { corsMiddleware, configureProxy, clientIpKey } = require('../src/http-settings');
const auth = require('../src/auth');

async function withServer(app, run) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run('http://127.0.0.1:' + server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

async function backendChecks() {
  process.env.SESSION_SECRET = randomBytes(32).toString('hex');
  process.env.APP_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000,https://nguyenhoangphuc1711.github.io';
  process.env.SESSION_COOKIE_SECURE = 'false';
  process.env.SESSION_COOKIE_SAMESITE = 'none';
  assert.throws(() => auth.createSessionMiddleware(), /requires SESSION_COOKIE_SECURE=true/);
  process.env.SESSION_COOKIE_SAMESITE = 'strict';
  assert.throws(() => auth.createSessionMiddleware(), /lax or none/);
  process.env.SESSION_COOKIE_SAMESITE = 'lax';
  const app = express();
  process.env.TRUST_PROXY = '0';
  configureProxy(app);
  app.use('/api', corsMiddleware());
  app.use('/api', auth.createSessionMiddleware());
  app.get('/api/test-cookie', (req, res) => { req.session.test = true; res.json({ ok: true }); });
  app.use('/api/orders', (req, res) => res.sendStatus(401));
  await withServer(app, async base => {
    const origin = 'https://nguyenhoangphuc1711.github.io';
    const response = await fetch(base + '/api/orders', { method: 'OPTIONS', headers: {
      Origin: origin, 'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-csrf-token,idempotency-key'
    } });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    assert.equal(response.headers.get('access-control-allow-methods'), 'GET, POST, OPTIONS');
    assert.equal(response.headers.get('access-control-allow-headers'), 'Content-Type, X-CSRF-Token, Idempotency-Key');
    assert.equal(response.headers.get('access-control-max-age'), '600');
    assert.match(response.headers.get('vary'), /Origin/);
    assert.equal(response.headers.get('set-cookie'), null);
    const denied = await fetch(base + '/api/orders', { method: 'OPTIONS', headers: { Origin: 'https://foreign.example' } });
    assert.equal(denied.status, 204);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
    const local = await fetch(base + '/api/test-cookie');
    assert.match(local.headers.get('set-cookie'), /SameSite=Lax/);
    assert.doesNotMatch(local.headers.get('set-cookie'), /; Secure/);
  });

  process.env.SESSION_COOKIE_SECURE = 'true';
  process.env.SESSION_COOKIE_SAMESITE = 'none';
  process.env.TRUST_PROXY = '127.0.0.1'; // Simulate only the test reverse proxy.
  const secureApp = express();
  configureProxy(secureApp);
  secureApp.use(auth.createSessionMiddleware());
  secureApp.get('/', (req, res) => { req.session.test = true; res.json({ secure: req.secure }); });
  await withServer(secureApp, async base => {
    const publicResponse = await fetch(base, { headers: { 'X-Forwarded-Proto': 'https' } });
    assert.equal((await publicResponse.json()).secure, true);
    assert.match(publicResponse.headers.get('set-cookie'), /; Secure/);
    assert.match(publicResponse.headers.get('set-cookie'), /SameSite=None/);
    const localResponse = await fetch(base);
    assert.match(localResponse.headers.get('set-cookie'), /SameSite=Lax/);
    assert.doesNotMatch(localResponse.headers.get('set-cookie'), /; Secure/);
  });

  process.env.TRUST_PROXY = '172.30.251.2';
  const proxyApp = express();
  configureProxy(proxyApp);
  const fake = (peer, visitor) => ({ app: proxyApp, socket: { remoteAddress: peer },
    ip: peer, get: name => name === 'cf-connecting-ip' ? visitor : undefined });
  assert.equal(clientIpKey(fake('172.30.251.2', '203.0.113.8')), '203.0.113.8');
  assert.equal(clientIpKey(fake('::ffff:172.30.251.2', '203.0.113.9')), '203.0.113.9');
  assert.notEqual(clientIpKey(fake('172.30.251.2', '203.0.113.8')), clientIpKey(fake('172.30.251.2', '203.0.113.9')));
  assert.equal(clientIpKey(fake('127.0.0.1', '203.0.113.8')), '127.0.0.1');
  assert.equal(clientIpKey(fake('172.30.251.2', 'invalid')), '172.30.251.2');

  // Exercise real order rate limiters with stub auth and invalid bodies. SQL must never run.
  require.cache[require.resolve('../src/auth')].exports = {
    csrfProtection: (req, res, next) => next(),
    requireUser: (req, res, next) => { req.user = { id: req.get('test-user') || '1' }; next(); }
  };
  const { createOrdersRouter } = require('../src/orders');
  const ordersApp = express();
  ordersApp.use('/api/orders', createOrdersRouter());
  await withServer(ordersApp, async base => {
    const post = (endpoint, user) => fetch(base + '/api/orders' + endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'test-user': String(user) }, body: '{}'
    });
    for (let i = 0; i < 60; i++) assert.equal((await post('/quote', 1)).status, 400);
    let response = await post('/quote', 1);
    assert.equal(response.status, 429);
    assert.match((await response.json()).message, /Vui lòng/);
    assert.ok(response.headers.get('retry-after'));
    assert.equal((await post('/quote', 2)).status, 400); // Account counters are independent.
    for (let i = 0; i < 59; i++) await post('/quote', 2);
    assert.equal((await post('/quote', 3)).status, 429); // Aggregate IP ceiling.
    for (let i = 0; i < 10; i++) assert.equal((await post('', 1)).status, 400);
    response = await post('', 1);
    assert.equal(response.status, 429);
    assert.match((await response.json()).message, /15 phút/);
    assert.equal((await post('', 2)).status, 400);
    for (let i = 0; i < 19; i++) await post('', i + 3);
    assert.equal((await post('', 99)).status, 429);
  });
  console.log('PASS: CORS/preflight, cookie validation/local/public, trusted visitor IP, account/IP rate limits; no SQL access');
}

async function frontendChecks() {
  const frontend = fs.existsSync(path.resolve(__dirname, '../../frontend'))
    ? path.resolve(__dirname, '../../frontend') : path.resolve(__dirname, '../../web-ban-quan-ao');
  for (const address of ['http://localhost:3000/', 'http://localhost:3000/login.html',
    'https://nguyenhoangphuc1711.github.io/EndLessShop/login.html']) {
    const location = new URL(address);
    const context = { location, window: { location }, URL, URLSearchParams, AbortSignal, console,
      localStorage: { getItem: () => null } };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(frontend, 'js/config.js'), 'utf8'), context);
    context.EndlessConfig = context.window.EndlessConfig;
    const remote = location.protocol === 'https:';
    assert.equal(context.EndlessConfig.API_BASE, remote ? 'https://api.puckin.id.vn' : '');
    assert.equal(context.EndlessConfig.credentials, remote ? 'include' : 'same-origin');
    vm.runInContext(fs.readFileSync(path.join(frontend, 'js/catalog.js'), 'utf8'), context);
    const imagePath = context.window.EndlessCatalog.imagePath;
    for (const value of ['../img/id 2.jpg', '/img/id 2.jpg', 'img/id 2.jpg']) {
      assert.equal(imagePath(value), 'img/id%202.jpg');
      assert.equal(new URL(imagePath(value), address).pathname, (remote ? '/EndLessShop/' : '/') + 'img/id%202.jpg');
    }
    for (const value of ['https://foreign.example/img/x.jpg', '/img/../secret.jpg', '/img/a%2fb.jpg', 'data:text/html,test']) {
      assert.equal(imagePath(value), '');
    }
    context.document = { getElementById: () => null, referrer: '', querySelectorAll: () => [] };
    context.fetch = async () => ({ ok: true, json: async () => ({ user: null }) });
    context.window.dispatchEvent = () => {};
    context.CustomEvent = function () {};
    const account = fs.readFileSync(path.join(frontend, 'js/account.js'), 'utf8');
    vm.runInContext(account.replace('  const destination =', '  window.testSafeNext = safeNext;\n  const destination ='), context);
    const next = context.window.testSafeNext;
    assert.equal(next('checkout.html#lich-su'), 'checkout.html#lich-su');
    assert.equal(next(new URL('checkout.html', address).href), 'checkout.html');
    for (const value of ['https://foreign.example/', '//foreign.example/', 'javascript:alert(1)', '/outside.html', '../checkout.html']) {
      // ../checkout.html stays within root when already at /; only reject it at a subpath.
      if (value === '../checkout.html' && !remote) continue;
      assert.equal(next(value), null);
    }
  }
  for (const file of fs.readdirSync(frontend).filter(name => name.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(frontend, file), 'utf8');
    const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(match => match[1]);
    assert.equal(scripts[0], 'js/config.js', file);
    assert.doesNotMatch(html, /(?:href|src)="\//);
    assert.doesNotMatch(html, /src="\.\.\/img\//);
  }
  let submit;
  const output = {};
  const button = { textContent: 'Đăng nhập', disabled: false };
  const form = { addEventListener: (event, handler) => { submit = handler; },
    querySelector: selector => selector === '[type="submit"]' ? button : selector === '[name="password"]' ? {} : output,
    setAttribute() {}, removeAttribute() {} };
  const location = new URL('https://nguyenhoangphuc1711.github.io/EndLessShop/login.html');
  location.assign = () => { throw new Error('Blocked cookies must not redirect'); };
  const context = { location, URL, URLSearchParams, console,
    window: { dispatchEvent() {} }, CustomEvent: function () {},
    document: { referrer: '', getElementById: id => id === 'loginForm' ? form : null, querySelectorAll: () => [] },
    FormData: class { *[Symbol.iterator]() { yield ['username', 'fixture']; yield ['password', 'fixture-only']; } },
    fetch: async (url, options) => ({ ok: !url.endsWith('/me'), status: url.endsWith('/me') ? 401 : 200,
      json: async () => url.endsWith('/me') ? { user: null } : options?.method === 'POST'
        ? { user: { id: 1 }, csrfToken: 'fixture' } : { csrfToken: 'fixture' } }) };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(frontend, 'js/config.js'), 'utf8'), context);
  context.EndlessConfig = context.window.EndlessConfig;
  vm.runInContext(fs.readFileSync(path.join(frontend, 'js/account.js'), 'utf8'), context);
  await new Promise(resolve => setImmediate(resolve));
  await submit({ preventDefault() {} });
  assert.match(output.textContent, /cookie.*Chrome\/Edge/);
  assert.equal(button.disabled, false);
  console.log('PASS: frontend config, root/Pages images, safe redirects, config order, blocked-cookie UI');
}

backendChecks().then(frontendChecks).catch(error => {
  console.error('FAIL: isolated connection regression (no secrets or SQL details logged)');
  console.error(error.stack.split('\n').slice(1).join('\n'));
  process.exitCode = 1;
});
