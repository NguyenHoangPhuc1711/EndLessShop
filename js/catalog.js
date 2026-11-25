/* Shared catalog loading, dynamic categories, safe storage, offline fallback flag, and cart reconciliation. */
(function () {
  'use strict';
  const notices = new Set();
  let usingFallback = false;
  const validId = value => Number.isSafeInteger(value) && value > 0;
  const validMoney = value => Number.isSafeInteger(value) && value >= 0;
  const validQty = value => Number.isSafeInteger(value) && value > 0 && value <= 999;
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const sameName = (a, b) => typeof a === 'string' && a.normalize('NFC').trim().toLowerCase() === b.normalize('NFC').trim().toLowerCase();

  const FALLBACK_CATEGORIES = [
    { id: 1, code: 'bo_mua_dong', name: 'Bộ Mùa Đông', description: 'Trọn bộ phối đồ Thu Đông tiết kiệm đến 33%, hỗ trợ mua nguyên bộ hoặc mua lẻ từng món.', sortOrder: 1, isVisible: true },
    { id: 2, code: 'ao_khoac', name: 'Áo Khoác Đông', description: 'Áo khoác gió 2 lớp, lớp phủ giữ ấm Bắc Âu.', sortOrder: 2, isVisible: true },
    { id: 3, code: 'ao', name: 'Áo', description: 'Áo thun cotton compact, sơ mi Oxford, áo giữ nhiệt.', sortOrder: 3, isVisible: true },
    { id: 4, code: 'quan', name: 'Quần', description: 'Quần âu dạ Flannel, quần tây công sở và jeans ống suông.', sortOrder: 4, isVisible: true },
    { id: 5, code: 'vay', name: 'Váy', description: 'Chân váy dạ xếp ly, đầm sơ mi thanh lịch.', sortOrder: 5, isVisible: true },
    { id: 6, code: 'phukien', name: 'Phụ kiện', description: 'Túi tote vải bố, mũ lưỡi trai và thắt lưng da.', sortOrder: 6, isVisible: true }
  ];

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function imagePath(value) {
    if (typeof value !== 'string') return '';
    try {
      const pageBase = window.EndlessConfig?.pageBase || new URL('.', window.location.href).href;
      // Legacy DB paths refer to the shop's img directory, never its parent site.
      const source = /^(?:\.\.\/|\/)img\//.test(value) ? value.replace(/^(?:\.\.\/|\/)img\//, 'img/') : value;
      const url = new URL(source, pageBase);
      const decoded = decodeURIComponent(url.pathname);
      const imageDirectory = new URL('img/', pageBase);
      const prefix = decodeURIComponent(imageDirectory.pathname);
      const filename = decoded.slice(prefix.length);
      if (url.origin !== window.location.origin || !decoded.startsWith(prefix) ||
          !/^[^/\\\x00-\x1f]+\.(?:jpe?g|png|webp|gif|avif)$/i.test(filename) || url.search || url.hash) return '';
      return 'img/' + encodeURIComponent(filename);
    } catch { return ''; }
  }

  function readArray(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return [];
      const value = JSON.parse(raw);
      if (!Array.isArray(value)) throw new Error('Invalid storage shape');
      return value;
    } catch {
      notices.add('Dữ liệu lưu ' + key + ' không đọc được; đã bỏ qua để trang tiếp tục hoạt động.');
      return [];
    }
  }

  function readText(key) {
    try { return localStorage.getItem(key); }
    catch { notices.add('Trình duyệt đang chặn lưu trữ cục bộ.'); return null; }
  }

  function write(key, value) {
    try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); return true; }
    catch { notices.add('Không lưu được thay đổi trong trình duyệt; dữ liệu chỉ giữ trong lần mở trang này.'); return false; }
  }

  function validateProducts(data) {
    if (!Array.isArray(data)) throw new Error('Invalid catalog');
    const ids = new Set();
    return data.map(p => {
      const labels = values => Array.isArray(values) && values.length > 0 && values.every(v => typeof v === 'string' && v.length > 0 && v.length <= 100);
      if (!isObject(p) || !validId(p.id) || ids.has(p.id) || typeof p.name !== 'string' || !p.name.trim() ||
          !validMoney(p.price) || !validMoney(p.stock) || typeof p.category !== 'string' || !/^[a-z][a-z0-9_]{0,19}$/.test(p.category) ||
          !labels(p.sizes) || !labels(p.colors) || !labels(p.images) || !isObject(p.colorImageIndices) ||
          (p.description !== null && typeof p.description !== 'string') || typeof p.isNew !== 'boolean') throw new Error('Invalid product fields');
      ids.add(p.id);
      const images = p.images.map(imagePath);
      if (images.some(value => !value)) throw new Error('Invalid product image');
      const indices = Object.create(null);
      for (let i = 0; i < p.colors.length; i++) {
        const color = p.colors[i];
        const rawIndex = (p.colorImageIndices && Object.hasOwn(p.colorImageIndices, color)) ? p.colorImageIndices[color] : null;
        const validIndex = Number.isInteger(rawIndex) && rawIndex >= 0 && rawIndex < images.length;
        indices[color] = validIndex ? rawIndex : (images.length > 0 ? (i % images.length) : 0);
      }
      const originalPrice = (validMoney(p.originalPrice) && p.originalPrice > p.price) ? p.originalPrice : null;
      const bundleItems = Array.isArray(p.bundleItems) ? [...new Set(p.bundleItems.filter(validId))] : [];
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        categoryName: typeof p.categoryName === 'string' ? p.categoryName : null,
        price: p.price,
        originalPrice,
        bundleItems,
        stock: p.stock,
        sizes: [...new Set(p.sizes)],
        colors: [...new Set(p.colors)],
        images,
        colorImageIndices: indices,
        description: p.description || '',
        isNew: p.isNew
      };
    });
  }

  async function fetchCategories() {
    const apiUrl = EndlessConfig.apiUrl('categories');
    if (apiUrl) {
      try {
        const response = await fetch(apiUrl, { credentials: EndlessConfig.credentials, cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.categories) && data.categories.length > 0) {
            return data.categories.filter(c => c && typeof c.code === 'string' && typeof c.name === 'string');
          }
        }
      } catch (err) {
        console.warn('API /api/categories không khả dụng, dùng danh mục mặc định:', err.message);
      }
    }
    return FALLBACK_CATEGORIES.slice();
  }

  async function fetchProducts() {
    usingFallback = false;
    const apiUrl = EndlessConfig.apiUrl('products');
    if (apiUrl) {
      const timeoutMs = EndlessConfig.API_BASE ? 4000 : 10000;
      const fetchOptions = {
        credentials: EndlessConfig.credentials,
        cache: 'no-store'
      };
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        fetchOptions.signal = AbortSignal.timeout(timeoutMs);
      }
      try {
        const response = await fetch(apiUrl, fetchOptions);
        if (response.ok) {
          return validateProducts(await response.json());
        }
      } catch (err) {
        console.warn('API /api/products không khả dụng, kích hoạt danh mục tĩnh dự phòng:', err.message);
      }
    }

    if (Array.isArray(window.FALLBACK_PRODUCTS) && window.FALLBACK_PRODUCTS.length > 0) {
      usingFallback = true;
      return validateProducts(window.FALLBACK_PRODUCTS);
    }

    throw new Error('Catalog API unavailable');
  }

  function reconcileCart(raw, products) {
    const byId = new Map(products.map(p => [p.id, p]));
    const items = [];
    let skipped = 0;
    for (const item of raw) {
      if (!isObject(item)) { skipped++; continue; }
      const id = typeof item.id === 'string' && /^[1-9][0-9]*$/.test(item.id) ? Number(item.id) : item.id;
      const p = byId.get(id);
      const qty = typeof item.qty === 'string' && /^[1-9][0-9]*$/.test(item.qty) ? Number(item.qty) : item.qty;
      if (!p || !validQty(qty) || !p.sizes.includes(item.size) || !p.colors.includes(item.color) ||
          (item.catalogSource !== 'sql-v1' && !sameName(item.name, p.name))) { skipped++; continue; }
      const existing = items.find(row => row.id === id && row.size === item.size && row.color === item.color);
      if (existing) {
        if (existing.qty + qty <= 999) existing.qty += qty; else skipped++;
      } else {
        items.push({ id, name: p.name, price: p.price, image: p.images[p.colorImageIndices[item.color]],
          size: item.size, color: item.color, qty, catalogSource: 'sql-v1' });
      }
    }
    if (skipped) notices.add('Đã bỏ qua ' + skipped + ' dòng giỏ cũ không đối chiếu được ID/tên/biến thể hoặc số lượng; không đổi sang sản phẩm khác.');
    return items;
  }

  function reconcileWishlist(raw, products) {
    const ids = new Set(products.map(p => p.id));
    const result = [...new Set(raw.filter(id => validId(id) && ids.has(id)))];
    if (result.length !== raw.length) notices.add('Đã bỏ qua ID yêu thích không còn hợp lệ hoặc trùng lặp.');
    return result;
  }

  function readOrders() {
    return readArray('moc_orders').filter(order => {
      const valid = isObject(order) && typeof order.code === 'string' && typeof order.date === 'string' &&
        typeof order.status === 'string' && typeof order.paymentLabel === 'string' && validMoney(order.total) &&
        Array.isArray(order.items) && order.items.every(item => isObject(item) && typeof item.name === 'string' &&
          typeof item.size === 'string' && typeof item.color === 'string' && validMoney(item.price) && validQty(item.qty)) &&
        isObject(order.delivery) && ['fullName', 'phone', 'address'].every(key => typeof order.delivery[key] === 'string');
      if (!valid) notices.add('Đã bỏ qua đơn mô phỏng trong trình duyệt có cấu trúc hỏng.');
      return valid;
    }).map(order => ({ ...order, items: order.items.map(item => ({ ...item, image: imagePath(item.image) })),
      discount: validMoney(order.discount) ? order.discount : 0,
      voucherCode: typeof order.voucherCode === 'string' ? order.voucherCode : null }));
  }

  window.EndlessCatalog = { fetchProducts, fetchCategories, validateProducts, imagePath, escapeHtml, readArray, readText,
    write, reconcileCart, reconcileWishlist, readOrders, isFallback: () => usingFallback,
    notice: () => [...notices].join(' ') };
}());
