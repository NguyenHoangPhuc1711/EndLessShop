'use strict';

const { isIP } = require('node:net');
const { ipKeyGenerator } = require('express-rate-limit');

function appOrigins() {
  const origins = (process.env.APP_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',').map(value => value.trim()).filter(Boolean);
  if (!origins.length || origins.some(value => {
    try { return !['http:', 'https:'].includes(new URL(value).protocol) || new URL(value).origin !== value; }
    catch { return true; }
  })) throw new Error('APP_ORIGINS must contain explicit HTTP(S) origins without paths or trailing slashes');
  return origins;
}

function corsMiddleware() {
  const origins = appOrigins();
  return (req, res, next) => {
    res.vary('Origin');
    if (origins.includes(req.get('origin'))) {
      res.setHeader('Access-Control-Allow-Origin', req.get('origin'));
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, Idempotency-Key');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
}

function configureProxy(app) {
  const value = process.env.TRUST_PROXY || '0';
  // Trust the dedicated cloudflared address, never an arbitrary one-hop caller.
  const proxy = value === '1' ? '172.30.251.2' : value;
  if (proxy !== '0' && !isIP(proxy)) throw new Error('TRUST_PROXY must be 0 or the exact cloudflared IP (default 172.30.251.2)');
  app.set('trust proxy', proxy === '0' ? false : proxy);
}

function clientIpKey(req) {
  const trusted = req.app.get('trust proxy fn');
  const cloudflareIp = req.get('cf-connecting-ip');
  const ip = trusted && trusted(req.socket.remoteAddress, 0) && isIP(cloudflareIp || '')
    ? cloudflareIp : req.ip;
  return ipKeyGenerator(ip);
}

module.exports = { appOrigins, corsMiddleware, configureProxy, clientIpKey };
