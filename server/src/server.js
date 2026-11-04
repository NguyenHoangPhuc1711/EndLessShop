'use strict';

const express = require('express');
const path = require('node:path');
const { getPool, closePool } = require('./db');
const { createAuthRouter, createSessionMiddleware } = require('./auth');
const { createOrdersRouter } = require('./orders');
const { corsMiddleware, configureProxy } = require('./http-settings');

const app = express();
const frontend = path.resolve(__dirname, '../../frontend');
const imageDirectory = path.resolve(__dirname, '../../img');
app.disable('x-powered-by');
configureProxy(app);
app.use('/api', corsMiddleware());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.get('/api/health', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    await (await getPool()).request().query('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error' });
  }
});

app.use('/api', createSessionMiddleware());
app.use('/api/auth', createAuthRouter());
app.use('/api/orders', createOrdersRouter());

app.get('/api/products', async (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const result = await (await getPool()).request().query(`
      SELECT p.san_pham_id, p.ten_sp, p.mo_ta, p.gia, p.ton_kho,
             p.sizes_json, p.colors_json, p.images_json, p.color_image_indices_json, p.la_moi,
             d.ma_danh_muc
      FROM dbo.SAN_PHAM AS p
      JOIN dbo.DANH_MUC AS d ON d.danh_muc_id = p.danh_muc_id
      ORDER BY p.san_pham_id`);
    res.json(result.recordset.map(row => ({
      id: row.san_pham_id,
      name: row.ten_sp,
      category: row.ma_danh_muc,
      price: row.gia,
      stock: row.ton_kho,
      sizes: JSON.parse(row.sizes_json || '[]'),
      colors: JSON.parse(row.colors_json || '[]'),
      images: JSON.parse(row.images_json || '[]'),
      colorImageIndices: JSON.parse(row.color_image_indices_json || '{}'),
      description: row.mo_ta,
      isNew: Boolean(row.la_moi)
    })));
  } catch (error) { next(error); }
});

// Only the listed frontend directories and HTML documents are public.
const staticOptions = { dotfiles: 'deny', index: false, redirect: false };
app.use('/css', express.static(path.join(frontend, 'css'), staticOptions));
app.use('/js', express.static(path.join(frontend, 'js'), staticOptions));
app.use('/img', express.static(imageDirectory, staticOptions));
app.get(['/', '/index.html'], (req, res) => res.sendFile(path.join(frontend, 'index.html')));
app.get('/checkout.html', (req, res) => res.sendFile(path.join(frontend, 'checkout.html')));
app.get('/account.html', (req, res) => res.sendFile(path.join(frontend, 'account.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(frontend, 'login.html')));
app.get('/register.html', (req, res) => res.sendFile(path.join(frontend, 'register.html')));
app.use((req, res) => res.status(404).json({ message: 'Không tìm thấy tài nguyên.' }));
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') {
    return res.status(error.type === 'entity.too.large' ? 413 : 400).json({ message: 'Dữ liệu yêu cầu không hợp lệ.' });
  }
  console.error('Request failed; internal details withheld');
  res.status(500).json({ message: 'Không thể xử lý yêu cầu.' });
});

const server = app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
  console.log('EndLessShop listening on port ' + (process.env.PORT || 3000));
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(async () => {
    await closePool().catch(() => {});
    process.exit(0);
  }));
}
