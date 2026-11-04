'use strict';

// Run from Windows: node server/scripts/verify-auth.js
// Creates two explicitly named demo accounts and keeps them. Restarts backend only.
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const base = 'http://localhost:3000';
const suffix = Date.now().toString(36) + randomBytes(3).toString('hex');
const usernames = ['demo_auth_' + suffix, 'demo_salt_' + suffix];
const password = '  Demo!9' + randomBytes(20).toString('hex') + '  ';
const reports = [];
const pass = text => { reports.push(text); console.log('PASS: ' + text); };

class Client {
  constructor(cookie = '') { this.cookie = cookie; this.token = null; }
  async call(endpoint, body, options = {}) {
    const headers = { Cookie: this.cookie, ...(body ? { 'Content-Type': 'application/json', 'X-CSRF-Token': this.token || '' } : {}), ...options.headers };
    const result = await fetch(base + '/api/auth/' + endpoint, { method: body ? 'POST' : 'GET', headers,
      body: body ? options.raw || JSON.stringify(body) : undefined });
    const cookies = result.headers.getSetCookie();
    for (const value of cookies) if (value.startsWith('endless.sid=')) this.cookie = value.split(';')[0];
    const json = await result.json();
    assert.equal(/passwordHash|\$argon2id\$/.test(JSON.stringify(json)), false, 'Hash must not appear in API response');
    return { status: result.status, json, headers: result.headers, cookies };
  }
  async csrf() {
    const result = await this.call('csrf');
    assert.equal(result.status, 200);
    this.token = result.json.csrfToken;
    return result;
  }
}

async function verify() {
  const client = new Client();
  assert.equal((await client.call('me')).status, 401);
  const initial = await client.csrf();
  assert.match(initial.cookies[0], /HttpOnly/i);
  assert.match(initial.cookies[0], /SameSite=Lax/i);
  assert.match(initial.cookies[0], /Expires=/i);
  assert.doesNotMatch(initial.cookies[0], /; Secure/i);
  const anonymousCookie = client.cookie;
  pass('Local cookie: HttpOnly + SameSite=Lax + expiry; no Secure on HTTP');

  const registration = { username: usernames[0], password, fullName: 'Tài khoản demo kiểm thử',
    email: usernames[0] + '@example.invalid', phone: '', role: 'admin', vai_tro: 'admin', userId: 999999 };
  assert.equal((await client.call('register', registration, { headers: { 'X-CSRF-Token': '' } })).status, 403);
  assert.equal((await client.call('register', registration, { headers: { 'X-CSRF-Token': 'é'.repeat(64) } })).status, 403);
  assert.equal((await client.call('register', registration, { headers: { Origin: 'https://foreign.example' } })).status, 403);
  pass('CSRF missing/invalid token and foreign Origin rejected');

  assert.equal((await client.call('register', { ...registration, fullName: '   ', password: 'short' })).status, 400);
  const created = await client.call('register', registration);
  assert.equal(created.status, 201);
  assert.equal(created.json.user.role, 'khach_hang');
  assert.notEqual(created.json.user.id, 999999);
  assert.equal((await client.call('register', { ...registration, email: usernames[1] + '@example.invalid' })).status, 409);
  assert.equal((await client.call('register', { ...registration, username: usernames[1] })).status, 409);
  const second = await client.call('register', { ...registration, username: usernames[1], email: usernames[1] + '@example.invalid' });
  assert.equal(second.status, 201);
  pass('SQL registration; duplicate username/email rejected; server validation; forged role/userId ignored');

  assert.equal((await client.call('login', { username: usernames[0], password: password.trim() })).status, 401);
  const login = await client.call('login', { username: usernames[0], password, role: 'admin', userId: second.json.user.id });
  assert.equal(login.status, 200);
  assert.equal(login.json.user.id, created.json.user.id);
  assert.equal(login.json.user.role, 'khach_hang');
  client.token = login.json.csrfToken;
  assert.notEqual(client.cookie, anonymousCookie);
  assert.equal((await new Client(anonymousCookie).call('me')).status, 401);
  assert.equal((await client.call('me')).json.user.id, created.json.user.id);
  pass('Correct/incorrect password; spaces preserved; SID rotated; previous SID revoked; /me authenticated');

  execFileSync('docker', ['compose', 'exec', '-T', 'backend', 'node', 'scripts/verify-auth-db.js'], {
    cwd: root, input: JSON.stringify({ usernames, password, cookie: client.cookie }), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
  });
  pass('Argon2id verified against SQL; different salts; session stored in SQL; runtime is not sa/db_owner');
  assert.equal((await client.call('login', {}, { raw: '{' })).status, 400);
  // One failed login was already sent above: nine more reach the 10/15-minute limit.
  for (let i = 0; i < 9; i++) assert.equal((await client.call('login', { username: usernames[0], password: 'wrong' })).status, 401);
  const limited = await client.call('login', { username: usernames[0], password: 'wrong' });
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get('retry-after'));
  pass('Login throttling: 10 failures/15 minutes, next attempt 429');

  execFileSync('docker', ['compose', 'restart', 'backend'], { cwd: root, stdio: 'pipe' });
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(ready, 'Backend must recover after restart');
  const resumed = await client.call('me');
  assert.equal(resumed.status, 200);
  assert.equal(resumed.json.user.id, created.json.user.id);
  pass('Backend restart preserves SQL account and authenticated SQL session');
  const oldCookie = client.cookie;
  const logout = await client.call('logout', {});
  assert.equal(logout.status, 200);
  assert.ok(logout.cookies.some(value => /Expires=Thu, 01 Jan 1970/i.test(value)));
  assert.equal((await new Client(oldCookie).call('me')).status, 401);
  assert.equal((await client.call('me')).status, 401);
  pass('Logout deletes SQL session, clears cookie; copied old cookie cannot authenticate');
  console.log(`Auth checks completed: ${reports.length} groups. Two demo accounts retained; credentials were not logged.`);
}

verify().catch(() => {
  console.error('Auth integration check failed. No credentials or hashes were logged.');
  process.exitCode = 1;
});
