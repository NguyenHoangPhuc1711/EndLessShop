(function (root) {
  "use strict";

  const store = root.Endless = root.Endless || {};
  const vouchers = {
    ENDLESS10: { type: "percent", value: 10, label: "Giảm 10% tổng đơn" },
    FREESHIP: {
      type: "fixed",
      value: 30000,
      minSubtotal: 200000,
      label: "Giảm 30.000đ cho đơn từ 200.000đ"
    }
  };

  Object.assign(store, {
    escapeHtml: function (value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
        return {
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[character];
      });
    },
    formatPrice: function (value) {
      return Math.round(Number(value) || 0).toLocaleString("vi-VN") + "đ";
    },
    resolveProductImagePath: function (path) {
      return String(path || "").replace(/^(\.\.\/)+img\//, "img/");
    },
    safeGetValue: function (key) {
      try {
        return root.localStorage.getItem(key);
      } catch (error) {
        console.warn("Không thể đọc dữ liệu đã lưu:", key, error);
        return null;
      }
    },
    safeGetJson: function (key, fallback) {
      try {
        const value = store.safeGetValue(key);
        return value ? JSON.parse(value) : fallback;
      } catch (error) {
        console.warn("Không thể đọc dữ liệu đã lưu:", key, error);
        return fallback;
      }
    },
    vouchers: vouchers
  });
})(window);
