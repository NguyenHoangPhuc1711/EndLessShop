'use strict';

const session = require('express-session');
const { createHash } = require('node:crypto');
const { sql, getPool } = require('./db');

const SESSION_MS = 2 * 60 * 60 * 1000;
const sessionKey = sid => createHash('sha256').update(sid).digest('hex');

// express-session Store contract: get, set, destroy, touch; no MemoryStore fallback.
class SqlSessionStore extends session.Store {
  constructor() {
    super();
    this.cleanupTimer = setInterval(() => {
      getPool().then(pool => pool.request().query('DELETE dbo.AUTH_SESSION WHERE expires_at <= SYSUTCDATETIME()'))
        .catch(() => console.error('Expired session cleanup failed'));
    }, 15 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  get(sid, callback) {
    getPool().then(pool => pool.request().input('key', sql.Char(64), sessionKey(sid)).query(`
      SELECT session_data FROM dbo.AUTH_SESSION WHERE session_key=@key AND expires_at>SYSUTCDATETIME()`))
      .then(result => callback(null, result.recordset[0] ? JSON.parse(result.recordset[0].session_data) : null))
      .catch(error => callback(error));
  }

  set(sid, data, callback = () => {}) {
    const expires = new Date(data.expiresAt || Date.now() + SESSION_MS);
    getPool().then(pool => pool.request()
      .input('key', sql.Char(64), sessionKey(sid))
      .input('data', sql.NVarChar(sql.MAX), JSON.stringify(data))
      .input('expires', sql.DateTime2, expires).query(`
        MERGE dbo.AUTH_SESSION WITH (HOLDLOCK) AS target
        USING (SELECT @key AS session_key) AS source ON target.session_key=source.session_key
        WHEN MATCHED THEN UPDATE SET session_data=@data, expires_at=@expires
        WHEN NOT MATCHED THEN INSERT(session_key,session_data,expires_at) VALUES(@key,@data,@expires);`))
      .then(() => callback()).catch(error => callback(error));
  }

  touch(sid, data, callback = () => {}) {
    // Absolute expiry: ordinary requests never extend the two-hour lifetime.
    getPool().then(pool => pool.request().input('key', sql.Char(64), sessionKey(sid))
      .input('expires', sql.DateTime2, new Date(data.expiresAt)).query(`
        UPDATE dbo.AUTH_SESSION SET expires_at=@expires WHERE session_key=@key AND expires_at>SYSUTCDATETIME()`))
      .then(() => callback()).catch(error => callback(error));
  }

  destroy(sid, callback = () => {}) {
    getPool().then(pool => pool.request().input('key', sql.Char(64), sessionKey(sid))
      .query('DELETE dbo.AUTH_SESSION WHERE session_key=@key'))
      .then(() => callback()).catch(error => callback(error));
  }
}

module.exports = { SqlSessionStore, SESSION_MS, sessionKey };
