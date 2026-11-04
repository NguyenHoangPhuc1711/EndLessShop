'use strict';

const express = require('express');
const session = require('express-session');
const argon2 = require('argon2');
const { rateLimit } = require('express-rate-limit');
const { randomBytes, timingSafeEqual } = require('node:crypto');
const { sql, getPool } = require('./db');
const { SqlSessionStore, SESSION_MS } = require('./session-store');
const { appOrigins, clientIpKey } = require('./http-settings');

const cookieName = 'endless.sid';
const hashOptions = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 };
const usernamePattern = /^[A-Za-z0-9_.-]{3,50}$/;
const validPassword = value => typeof value === 'string' && value.length >= 10 && value.length <= 128 && /\S/.test(value);
const saveSession = req => new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
const regenerateSession = req => new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
const destroySession = req => new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));

function authSettings() {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must contain at least 32 random characters');
  }
  const origins = appOrigins();
  const secure = process.env.SESSION_COOKIE_SECURE === 'true';
  const sameSite = process.env.SESSION_COOKIE_SAMESITE || 'lax';
  if (!['lax', 'none'].includes(sameSite)) throw new Error('SESSION_COOKIE_SAMESITE must be lax or none');
  if (sameSite === 'none' && !secure) throw new Error('SESSION_COOKIE_SAMESITE=none requires SESSION_COOKIE_SECURE=true');
  const cookie = { httpOnly: true, sameSite, secure, path: '/' };
  return { cookie, origins };
}

function requestCookie(req, cookie) {
  // The loopback-only published port still supports local HTTP in public mode.
  // Forwarded/tunnel requests never use this exception.
  const local = !req.secure && ['localhost', '127.0.0.1', '[::1]'].includes(req.hostname) &&
    !req.get('x-forwarded-for') && !req.get('x-forwarded-proto') && !req.get('cf-ray');
  return local ? { ...cookie, sameSite: 'lax', secure: false } : cookie;
}

function createSessionMiddleware() {
  const { cookie } = authSettings();
  const middleware = session({ name: cookieName, secret: process.env.SESSION_SECRET, store: new SqlSessionStore(),
    resave: false, saveUninitialized: false, rolling: false, cookie: { ...cookie, maxAge: SESSION_MS } });
  return (req, res, next) => middleware(req, res, error => {
    if (error) return next(error);
    const settings = requestCookie(req, cookie);
    req.session.cookie.sameSite = settings.sameSite;
    req.session.cookie.secure = settings.secure;
    next();
  });
}

function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const { origins } = authSettings();
  const supplied = req.get('x-csrf-token');
  const expected = req.session.csrfToken;
  if ((req.get('origin') && !origins.includes(req.get('origin'))) || typeof supplied !== 'string' ||
      typeof expected !== 'string' || !/^[0-9a-f]{64}$/.test(supplied) || expected.length !== 64 ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return res.status(403).json({ message: 'Phiên bảo mật không hợp lệ. Vui lòng tải lại trang.', code: 'csrf_invalid' });
  }
  next();
}

async function requireUser(req, res, next) {
  if (!Number.isInteger(req.session.userId)) return res.status(401).json({ message: 'Vui lòng đăng nhập để tiếp tục.' });
  const result = await (await getPool()).request().input('id', sql.Int, req.session.userId).execute('dbo.auth_profile');
  if (!result.recordset[0]) return res.status(401).json({ message: 'Phiên đăng nhập không còn hợp lệ.' });
  req.user = result.recordset[0];
  next();
}

function createAuthRouter() {
  const { cookie } = authSettings();
  // Keep login timing comparable for unknown usernames; never reuse this as an account password.
  const dummyHash = argon2.hash(randomBytes(32), hashOptions);
  const router = express.Router();
  const limited = message => ({ keyGenerator: clientIpKey, standardHeaders: 'draft-8', legacyHeaders: false, message: { message } });
  router.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, ...limited('Quá nhiều yêu cầu tài khoản. Vui lòng thử lại sau.') }));
  router.use((req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  router.get('/csrf', async (req, res) => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = randomBytes(32).toString('hex');
      req.session.expiresAt = Date.now() + SESSION_MS;
      await saveSession(req);
    }
    res.json({ csrfToken: req.session.csrfToken });
  });

  // Synchronizer token + Origin allowlist, including for login/logout/registration.
  router.use(csrfProtection);
  router.use(express.json({ limit: '8kb', strict: true }));

  router.post('/register', rateLimit({ windowMs: 60 * 60 * 1000, limit: 10,
    ...limited('Đã vượt số lần đăng ký cho phép. Vui lòng thử lại sau.') }), async (req, res) => {
    const body = req.body || {};
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    if (!usernamePattern.test(username) || !fullName || fullName.length > 100 || /[\x00-\x1f\x7f]/.test(fullName) ||
        !/^[\x21-\x7e]+$/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100 ||
        (body.phone !== undefined && typeof body.phone !== 'string') ||
        (phone && !/^[0-9]{9,11}$/.test(phone)) || !validPassword(body.password)) {
      return res.status(400).json({ message: 'Kiểm tra thông tin: tên đăng nhập 3–50 ký tự a-z, số, _ . -; họ tên tối đa 100; email hợp lệ; mật khẩu 10–128 ký tự; điện thoại 9–11 chữ số nếu có.' });
    }
    // Password is passed unchanged to Argon2; library generates a fresh random salt.
    const hash = await argon2.hash(body.password, hashOptions);
    try {
      const result = await (await getPool()).request()
        .input('username', sql.VarChar(50), username).input('password_hash', sql.VarChar(255), hash)
        .input('full_name', sql.NVarChar(100), fullName).input('email', sql.VarChar(100), email)
        .input('phone', sql.VarChar(15), phone || null).execute('dbo.auth_create_customer');
      // The stored procedure hardcodes khach_hang; role/userId supplied by client are ignored.
      res.status(201).json({ user: result.recordset[0], message: 'Đăng ký thành công. Bạn có thể đăng nhập.' });
    } catch (error) {
      if ([2601, 2627].includes(error.number)) return res.status(409).json({ message: 'Tên đăng nhập hoặc email đã được sử dụng.' });
      throw error;
    }
  });

  router.post('/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true,
    ...limited('Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.') }), async (req, res) => {
    const body = req.body || {};
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    if (!usernamePattern.test(username) || typeof body.password !== 'string' || body.password.length > 128) {
      return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }
    const result = await (await getPool()).request().input('username', sql.VarChar(50), username).execute('dbo.auth_find_account');
    const account = result.recordset[0];
    const eligible = account && typeof account.passwordHash === 'string' && account.passwordHash.startsWith('$argon2id$');
    let matches = false;
    try { matches = await argon2.verify(eligible ? account.passwordHash : await dummyHash, body.password); }
    catch { /* malformed legacy hashes cannot authenticate */ }
    if (!eligible || !matches) return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    await regenerateSession(req); // revokes the anonymous/previous SID before creating the authenticated one
    req.session.userId = account.id;
    req.session.expiresAt = Date.now() + SESSION_MS;
    req.session.csrfToken = randomBytes(32).toString('hex');
    await saveSession(req);
    const { passwordHash, ...user } = account;
    res.json({ user, csrfToken: req.session.csrfToken });
  });

  router.get('/me', async (req, res) => {
    if (!Number.isInteger(req.session.userId)) return res.status(401).json({ user: null });
    const result = await (await getPool()).request().input('id', sql.Int, req.session.userId).execute('dbo.auth_profile');
    if (!result.recordset[0]) {
      await destroySession(req);
      res.clearCookie(cookieName, requestCookie(req, cookie));
      return res.status(401).json({ user: null });
    }
    res.json({ user: result.recordset[0] });
  });

  router.post('/logout', async (req, res) => {
    await destroySession(req);
    res.clearCookie(cookieName, requestCookie(req, cookie));
    res.json({ message: 'Đã đăng xuất.' });
  });
  return router;
}

module.exports = { createAuthRouter, createSessionMiddleware, csrfProtection, requireUser };
