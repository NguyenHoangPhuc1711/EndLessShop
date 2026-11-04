'use strict';

// Invoked with generated test credentials on stdin, never on the command line or in logs.
const assert = require('node:assert/strict');
const argon2 = require('argon2');
const { sql, getPool, closePool } = require('../src/db');
const { sessionKey } = require('../src/session-store');

async function verify() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const { usernames, password, cookie } = JSON.parse(input);
  const pool = await getPool();
  const hashes = [];
  for (const username of usernames) {
    const result = await pool.request().input('username', sql.VarChar(50), username).execute('dbo.auth_find_account');
    const account = result.recordset[0];
    assert.ok(account);
    assert.equal(account.role, 'khach_hang');
    assert.ok(account.passwordHash.startsWith('$argon2id$'));
    assert.notEqual(account.passwordHash, password);
    assert.ok(await argon2.verify(account.passwordHash, password));
    hashes.push(account.passwordHash);
  }
  assert.notEqual(hashes[0], hashes[1], 'Separate accounts must use separate random salts');
  const signed = decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1));
  const sid = signed.slice(2, signed.lastIndexOf('.'));
  const sessions = await pool.request().input('key', sql.Char(64), sessionKey(sid)).query(`
    SELECT session_data, DATEDIFF(SECOND,SYSUTCDATETIME(),expires_at) AS seconds_left
    FROM dbo.AUTH_SESSION WHERE session_key=@key`);
  assert.equal(sessions.recordset.length, 1);
  const stored = sessions.recordset[0];
  assert.ok(stored.seconds_left > 0 && stored.seconds_left <= 7200);
  const data = JSON.parse(stored.session_data);
  assert.ok(Number.isInteger(data.userId));
  assert.deepEqual(Object.keys(data).sort(), ['cookie', 'csrfToken', 'expiresAt', 'userId'].sort());
  assert.equal(stored.session_data.includes(password), false);
  assert.equal(stored.session_data.includes('$argon2'), false);
  const rights = (await pool.request().query(`SELECT
    IS_SRVROLEMEMBER('sysadmin') AS is_admin, IS_MEMBER('db_owner') AS is_owner,
    HAS_PERMS_BY_NAME('dbo.TAI_KHOAN','OBJECT','SELECT') AS read_accounts,
    HAS_PERMS_BY_NAME('dbo.TAI_KHOAN','OBJECT','UPDATE') AS update_accounts,
    HAS_PERMS_BY_NAME('dbo.auth_create_customer','OBJECT','EXECUTE') AS register_account`)).recordset[0];
  for (const key of ['is_admin', 'is_owner', 'read_accounts', 'update_accounts']) assert.notEqual(rights[key], 1);
  assert.equal(rights.register_account, 1);
  console.log('PASS: SQL accounts hashed/salted; customer role; SQL session <=2h; least privilege');
}

verify().catch(() => { console.error('Auth database verification failed; no credential details logged.'); process.exitCode = 1; })
  .finally(() => closePool().catch(() => {}));
