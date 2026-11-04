'use strict';

// Configuration test with a simulated trusted TLS proxy, not an actual HTTPS deployment.
const assert = require('node:assert/strict');
const express = require('express');
const { createAuthRouter, createSessionMiddleware } = require('../src/auth');
const { closePool } = require('../src/db');

async function verify() {
  process.env.SESSION_COOKIE_SECURE = 'true';
  process.env.APP_ORIGINS = 'https://shop.example';
  const app = express();
  app.set('trust proxy', 1);
  app.use('/api', createSessionMiddleware());
  app.use('/api/auth', createAuthRouter());
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const address = 'http://127.0.0.1:' + server.address().port + '/api/auth/csrf';
    const proxied = await fetch(address, { headers: { 'X-Forwarded-Proto': 'https' } });
    assert.equal(proxied.status, 200);
    const cookie = proxied.headers.get('set-cookie');
    assert.match(cookie, /; Secure/i);
    assert.match(cookie, /HttpOnly/i);
    const insecure = await fetch(address);
    assert.match(insecure.headers.get('set-cookie'), /SameSite=Lax/i);
    assert.doesNotMatch(insecure.headers.get('set-cookie'), /; Secure/i);
    const forwardedHttp = await fetch(address, { headers: { 'X-Forwarded-Proto': 'http' } });
    assert.equal(forwardedHttp.headers.get('set-cookie'), null);
    console.log('PASS: Secure cookie behind simulated trusted HTTPS proxy; local HTTP Lax exception only without forwarding headers');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

verify().catch(() => { console.error('HTTPS cookie configuration check failed.'); process.exitCode = 1; })
  .finally(() => closePool().catch(() => {}));
