let products = [];
let categories = [];
let catalogReady = false;
let catalogLoading = false;
let catalogFromFallback = false;
let cart = [];
const escapeHtml = EndlessCatalog.escapeHtml;

let wishlist = [];

let currentProduct = null;
let currentImageIndex = 0;
let selectedSize = null;
let selectedColor = null;
let currentQty = 1;

let appliedVoucher = null;

const voucherList = {
  "BF2026": { type: "percent", value: 25, label: "Black Friday: Giảm 25% tổng đơn" },
  "BF50K": { type: "fixed", value: 50000, label: "Black Friday: Giảm ngay 50.000đ" },
  "ENDLESS10": { type: "percent", value: 10, label: "Giảm 10% tổng đơn" },
  "FREESHIP": { type: "shipping", value: 30000, label: "Miễn phí vận chuyển (giảm 30.000đ)" }
};

let revealObserver = null;

function removeDiacritics(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function formatPrice(number) {
  return Number(number || 0).toLocaleString("vi-VN") + "đ";
}

function findProductById(id) {
  return products.find(function (item) {
    return item.id === id;
  });
}

function getCategoryLabel(code) {
  const found = categories.find(function (c) { return c.code === code; });
  if (found && found.name) return found.name;
  const fallbackMap = {
    bo_mua_dong: "Bộ Mùa Đông",
    ao_khoac: "Áo Khoác Đông",
    ao: "Áo",
    quan: "Quần",
    vay: "Váy",
    phukien: "Phụ kiện"
  };
  return fallbackMap[code] || code || "";
}

function saveCart() {
  EndlessCatalog.write("moc_cart", JSON.stringify(cart));
  showStorageNotice();
}

function saveWishlist() {
  EndlessCatalog.write("moc_wishlist", JSON.stringify(wishlist));
  showStorageNotice();
}

function openBox(overlayId, boxId) {
  document.getElementById(overlayId).classList.add("active");
  document.getElementById(boxId).classList.add("active");
}

function closeBox(overlayId, boxId) {
  document.getElementById(overlayId).classList.remove("active");
  document.getElementById(boxId).classList.remove("active");
}

function debounce(fn, delay) {
  let timerId;
  return function () {
    const args = arguments;
    clearTimeout(timerId);
    timerId = setTimeout(function () {
      fn.apply(null, args);
    }, delay);
  };
}

function pulseCartIcon() {
  const cartBtn = document.getElementById("cartBtn");
  cartBtn.classList.remove("is-shaking");
  void cartBtn.offsetWidth;
  cartBtn.classList.add("is-shaking");
  setTimeout(function () {
    cartBtn.classList.remove("is-shaking");
  }, 500);
}

function pulseHeart() {
  const heartIcon = document.getElementById("wishlistIcon");
  heartIcon.classList.remove("is-beating");
  void heartIcon.offsetWidth;
  heartIcon.classList.add("is-beating");
  setTimeout(function () {
    heartIcon.classList.remove("is-beating");
  }, 500);
}

/* ================= BLACK FRIDAY COUNTDOWN & VOUCHER WALLET ================= */
function initBlackFridayCountdown() {
  const grid = document.getElementById("bfCountdownGrid");
  if (!grid) return;
  const targetTime = new Date("2026-11-29T23:59:59+07:00").getTime();

  function tick() {
    let diff = Math.max(0, targetTime - Date.now());
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    diff -= days * (1000 * 60 * 60 * 24);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    diff -= hours * (1000 * 60 * 60);
    const mins = Math.floor(diff / (1000 * 60));
    const secs = Math.floor((diff - mins * (1000 * 60)) / 1000);

    const values = {
      days: String(days).padStart(2, "0"),
      hours: String(hours).padStart(2, "0"),
      mins: String(mins).padStart(2, "0"),
      secs: String(secs).padStart(2, "0")
    };
    Object.keys(values).forEach(function (unit) {
      const el = grid.querySelector('[data-unit="' + unit + '"]');
      if (el) el.textContent = values[unit];
    });
  }

  tick();
  setInterval(tick, 1000);
}

function applyQuickVoucherCode(code) {
  const upper = String(code || "").trim().toUpperCase();
  const voucherInput = document.getElementById("voucherInput");
  if (voucherInput) voucherInput.value = upper;

  if (Object.hasOwn(voucherList, upper)) {
    appliedVoucher = voucherList[upper];
    EndlessCatalog.write("moc_voucher", upper);
    const messageBox = document.getElementById("voucherMessage");
    if (messageBox) {
      messageBox.textContent = "Đã áp dụng: " + appliedVoucher.label;
      messageBox.className = "voucher-message success";
    }
    updateCartTotal();
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(upper).catch(function () {});
  }

  document.querySelectorAll("[data-voucher-copy]").forEach(function (btn) {
    const btnCode = btn.getAttribute("data-voucher-copy");
    if (btnCode === upper) {
      btn.textContent = "✓ Đã áp mã";
      btn.classList.add("is-applied");
    } else {
      btn.textContent = "Áp mã";
      btn.classList.remove("is-applied");
    }
  });
}

function initVoucherWallet() {
  const savedCode = EndlessCatalog.readText("moc_voucher");
  if (savedCode && Object.hasOwn(voucherList, savedCode)) {
    const voucherInput = document.getElementById("voucherInput");
    if (voucherInput) voucherInput.value = savedCode;
    document.querySelectorAll("[data-voucher-copy]").forEach(function (btn) {
      if (btn.getAttribute("data-voucher-copy") === savedCode) {
        btn.textContent = "✓ Đã áp mã";
        btn.classList.add("is-applied");
      }
    });
  }

  document.querySelectorAll("[data-voucher-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const code = btn.getAttribute("data-voucher-copy");
      applyQuickVoucherCode(code);
    });
  });
}

/* ================= WINTER BUNDLES SPOTLIGHT (MUA TRỌN BỘ & TÁCH LẺ) ================= */
function renderWinterBundlesSection() {
  const container = document.getElementById("winterBundlesGrid");
  if (!container) return;

  const bundles = products.filter(function (p) {
    return Array.isArray(p.bundleItems) && p.bundleItems.length > 0;
  });

  if (bundles.length === 0) {
    const section = document.getElementById("bo-mua-dong");
    if (section) section.style.display = "none";
    return;
  }

  container.innerHTML = bundles.map(function (bundle, idx) {
    const discountPct = (bundle.originalPrice && bundle.originalPrice > bundle.price)
      ? Math.round((1 - bundle.price / bundle.originalPrice) * 100)
      : 0;
    const savings = (bundle.originalPrice && bundle.originalPrice > bundle.price)
      ? (bundle.originalPrice - bundle.price)
      : 0;

    const swatchesHtml = bundle.colors.map(function (color, cIdx) {
      const imgIdx = (bundle.colorImageIndices && Number.isInteger(bundle.colorImageIndices[color]))
        ? bundle.colorImageIndices[color]
        : (cIdx % bundle.images.length);
      const imgUrl = bundle.images[imgIdx] || bundle.images[0];
      return "<button type='button' class='winter-swatch-btn" + (cIdx === 0 ? " active" : "") + "' " +
        "data-bundle-swatch='" + bundle.id + "' data-color='" + escapeHtml(color) + "' data-img='" + escapeHtml(imgUrl) + "'>" +
        "<span class='winter-swatch-dot' style='background:" + colorToHex(color) + "'></span>" + escapeHtml(color) +
      "</button>";
    }).join("");

    const childRowsHtml = bundle.bundleItems.map(function (childId) {
      const child = findProductById(childId);
      if (!child) return "";
      return "<div class='winter-split-item'>" +
        "<img src='" + escapeHtml(child.images[0]) + "' alt='" + escapeHtml(child.name) + "' loading='lazy'>" +
        "<div class='winter-split-item__info'>" +
          "<div class='winter-split-item__name'>" + escapeHtml(child.name) + "</div>" +
          "<div class='winter-split-item__price'>Mua lẻ: " + formatPrice(child.price) + "</div>" +
        "</div>" +
        "<button type='button' class='winter-split-item__btn' data-open-item='" + child.id + "'>Mua lẻ</button>" +
      "</div>";
    }).join("");

    return "<article class='winter-bundle-card' data-bundle-id='" + bundle.id + "'>" +
      "<div class='winter-bundle-media' data-open-bundle='" + bundle.id + "'>" +
        "<img src='" + escapeHtml(bundle.images[0]) + "' alt='" + escapeHtml(bundle.name) + "' loading='lazy' class='winter-bundle-main-img'>" +
      "</div>" +
      "<div class='winter-bundle-body'>" +
        "<div class='winter-badge-row'>" +
          (discountPct > 0 ? "<span class='badge-sale'>-" + discountPct + "% · Tiết kiệm " + formatPrice(savings) + "</span>" : "<span class='badge-sale'>BLACK FRIDAY</span>") +
          "<span class='badge-bundle-tag'>WINTER SET 0" + (idx + 1) + "</span>" +
        "</div>" +
        "<h3 class='winter-bundle-title' data-open-bundle='" + bundle.id + "'>" + escapeHtml(bundle.name) + "</h3>" +
        "<p class='winter-bundle-desc'>" + escapeHtml(bundle.description) + "</p>" +
        "<div class='winter-swatch-row'>" + swatchesHtml + "</div>" +
        "<div class='winter-price-box'>" +
          "<div><span class='winter-price-now'>" + formatPrice(bundle.price) + "</span>" +
          (bundle.originalPrice ? "<span class='winter-price-old'>" + formatPrice(bundle.originalPrice) + "</span>" : "") +
          "</div>" +
          "<button type='button' class='btn btn--primary' style='padding:8px 16px;font-size:13px;' data-open-bundle='" + bundle.id + "'>Mua Trọn Bộ</button>" +
        "</div>" +
        "<div class='winter-split-box'>" +
          "<div class='winter-split-label'>Hoặc tách lẻ từng món trong bộ (" + bundle.bundleItems.length + " món):</div>" +
          "<div class='winter-split-list'>" + childRowsHtml + "</div>" +
        "</div>" +
      "</div>" +
    "</article>";
  }).join("");

  container.querySelectorAll("[data-bundle-swatch]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      const card = btn.closest(".winter-bundle-card");
      if (!card) return;
      card.querySelectorAll("[data-bundle-swatch]").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      const img = card.querySelector(".winter-bundle-main-img");
      if (img) img.src = btn.getAttribute("data-img");
    });
  });

  container.querySelectorAll("[data-open-bundle]").forEach(function (el) {
    el.addEventListener("click", function () {
      const id = Number(el.getAttribute("data-open-bundle"));
      const card = el.closest(".winter-bundle-card");
      const activeSwatch = card ? card.querySelector(".winter-swatch-btn.active") : null;
      const preColor = activeSwatch ? activeSwatch.getAttribute("data-color") : null;
      openProductModal(id, preColor);
    });
  });

  container.querySelectorAll("[data-open-item]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      openProductModal(Number(btn.getAttribute("data-open-item")));
    });
  });
}

/* ================= DYNAMIC CATEGORY TABS & SIDEBAR CHECKBOXES ================= */
function renderDynamicCategoryControls() {
  const tabsWrap = document.getElementById("categoryTabs");
  const filterWrap = document.getElementById("filterCategories");

  const counts = {};
  products.forEach(function (p) {
    counts[p.category] = (counts[p.category] || 0) + 1;
  });

  if (tabsWrap) {
    let tabsHtml = "<button type='button' class='category-tab active' data-category='all'>Tất cả (" + products.length + ")</button>";
    categories.forEach(function (c) {
      const count = counts[c.code] || 0;
      tabsHtml += "<button type='button' class='category-tab' data-category='" + escapeHtml(c.code) + "'>" + escapeHtml(c.name) + " (" + count + ")</button>";
    });
    tabsWrap.innerHTML = tabsHtml;
  }

  if (filterWrap) {
    filterWrap.innerHTML = categories.map(function (c) {
      return "<label class='custom-checkbox'><input type='checkbox' class='filter-category' value='" + escapeHtml(c.code) + "'> <span>" + escapeHtml(c.name) + " (" + (counts[c.code] || 0) + ")</span></label>";
    }).join("");
  }

  const tabs = document.querySelectorAll("#categoryTabs .category-tab");
  const checkboxes = document.querySelectorAll(".filter-category");

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      const cat = tab.getAttribute("data-category");
      checkboxes.forEach(function (box) {
        box.checked = (cat !== "all" && box.value === cat);
      });
      updateProductGrid();
    });
  });

  checkboxes.forEach(function (box) {
    box.addEventListener("change", function () {
      const checked = Array.from(checkboxes).filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
      tabs.forEach(function (t) {
        const tc = t.getAttribute("data-category");
        t.classList.toggle("active", (checked.length === 0 && tc === "all") || (checked.length === 1 && checked[0] === tc));
      });
      updateProductGrid();
    });
  });
}

function renderProducts(list) {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = "";

  if (list.length === 0) {
    grid.innerHTML = "<p class='empty-msg'>Không tìm thấy sản phẩm phù hợp.</p>";
    return;
  }

  list.forEach(function (product) {
    let colorDots = "";
    product.colors.forEach(function (color) {
      colorDots += "<span class='color-dot' style='background:" + colorToHex(color) + "' title='" + escapeHtml(color) + "'></span>";
    });

    const discountPct = (product.originalPrice && product.originalPrice > product.price)
      ? Math.round((1 - product.price / product.originalPrice) * 100)
      : 0;
    const isBundle = Array.isArray(product.bundleItems) && product.bundleItems.length > 0;

    let badgeHtml = "";
    if (discountPct > 0) {
      badgeHtml += "<span class='product-card__badge product-card__badge--sale'>-" + discountPct + "%</span>";
    } else if (product.isNew) {
      badgeHtml += "<span class='product-card__badge'>Mới</span>";
    }
    if (isBundle) {
      badgeHtml += "<span class='product-card__badge product-card__badge--bundle'>Bộ " + product.bundleItems.length + " món</span>";
    }

    const oldPriceHtml = product.originalPrice
      ? "<span class='product-card__price-old'>" + formatPrice(product.originalPrice) + "</span>"
      : "";

    const cardHtml =
      "<div class='product-card reveal' data-id='" + product.id + "'>" +
        "<div class='product-card__image'>" +
          badgeHtml +
          "<img src='" + escapeHtml(product.images[0]) + "' alt='" + escapeHtml(product.name) + "' loading='lazy'>" +
        "</div>" +
        "<p class='product-card__name'>" + escapeHtml(product.name) + "</p>" +
        "<p class='product-card__price'>" + formatPrice(product.price) + oldPriceHtml + "</p>" +
        "<div class='product-card__colors'>" + colorDots + "</div>" +
      "</div>";

    grid.innerHTML += cardHtml;
  });

  document.querySelectorAll("#productGrid .product-card").forEach(function (card) {
    card.addEventListener("click", function () {
      const id = Number(card.getAttribute("data-id"));
      openProductModal(id);
    });
  });

  observeRevealCards();
}

function observeRevealCards() {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".product-card.reveal").forEach(function (card) {
      card.classList.add("is-visible");
    });
    return;
  }

  if (!revealObserver) {
    revealObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -30px 0px" });
  }

  document.querySelectorAll(".product-card.reveal:not(.is-visible)").forEach(function (card) {
    revealObserver.observe(card);
  });
}

function colorToHex(colorName) {
  const map = {
    "Trắng": "#ffffff",
    "Đen": "#1c1a17",
    "Đen Obsidian": "#181818",
    "Đen Tuyền": "#141413",
    "Xanh": "#3b5b6b",
    "Xanh navy": "#26364a",
    "Be": "#d8c9ab",
    "Be Yến Mạch": "#d8ccb8",
    "Kem Alabaster": "#eae6df",
    "Rêu & Than": "#2c3527",
    "Vàng": "#d1a64a",
    "Hồng": "#e3a9b0",
    "Xám": "#9b968d",
    "Nâu": "#7a5230"
  };
  return Object.hasOwn(map, colorName) ? map[colorName] : "#cccccc";
}

function getFilteredProducts() {
  const keyword = document.getElementById("searchInput").value.trim().toLowerCase();
  const matchingProductIds = new Set(searchProducts(keyword).map(function (product) { return product.id; }));

  const checkedCategories = [];
  document.querySelectorAll(".filter-category:checked").forEach(function (box) {
    checkedCategories.push(box.value);
  });

  const checkedSizes = [];
  document.querySelectorAll(".filter-size:checked").forEach(function (box) {
    checkedSizes.push(box.value);
  });

  const checkedColors = [];
  document.querySelectorAll(".filter-color:checked").forEach(function (box) {
    checkedColors.push(box.value);
  });

  const priceRadio = document.querySelector(".filter-price:checked");
  let minPrice = 0;
  let maxPrice = 999999999;
  if (priceRadio && priceRadio.value !== "all") {
    const parts = priceRadio.value.split("-");
    minPrice = Number(parts[0]);
    maxPrice = Number(parts[1]);
  }

  let result = products.filter(function (product) {
    const matchKeyword = matchingProductIds.has(product.id);
    const matchCategory = checkedCategories.length === 0 || checkedCategories.includes(product.category);
    const matchSize = checkedSizes.length === 0 || product.sizes.some(function (s) { return checkedSizes.includes(s); });
    const matchColor = checkedColors.length === 0 || product.colors.some(function (c) { return checkedColors.includes(c); });
    const matchPrice = product.price >= minPrice && product.price <= maxPrice;

    return matchKeyword && matchCategory && matchSize && matchColor && matchPrice;
  });

  const sortValue = document.getElementById("sortSelect").value;
  if (sortValue === "asc") {
    result.sort(function (a, b) { return a.price - b.price; });
  } else if (sortValue === "desc") {
    result.sort(function (a, b) { return b.price - a.price; });
  }

  return result;
}

function updateProductGrid() {
  if (!catalogReady) return;
  const result = getFilteredProducts();
  renderProducts(result);

  const resultCount = document.getElementById("resultCount");
  resultCount.textContent = "Tìm thấy " + result.length + " sản phẩm";
}

function searchProducts(keyword) {
  const normalizedKeyword = removeDiacritics(keyword.trim().toLowerCase());
  if (!normalizedKeyword) return products.slice();

  const directMatches = products.filter(function (product) {
    const directText = [product.name, getCategoryLabel(product.category)].join(" ").toLowerCase();
    return removeDiacritics(directText).includes(normalizedKeyword);
  });
  if (directMatches.length > 0) return directMatches;

  return products.filter(function (product) {
    const searchableText = [product.name, getCategoryLabel(product.category), product.description]
      .concat(product.colors, product.sizes, String(product.id))
      .join(" ")
      .toLowerCase();
    return removeDiacritics(searchableText).includes(normalizedKeyword);
  });
}

function hideSearchSuggestions() {
  const input = document.getElementById("searchInput");
  const suggestions = document.getElementById("searchSuggestions");
  suggestions.classList.remove("active");
  suggestions.innerHTML = "";
  input.setAttribute("aria-expanded", "false");
}

function renderSearchSuggestions() {
  if (!catalogReady) return;
  const input = document.getElementById("searchInput");
  const query = input.value.trim();
  const suggestions = document.getElementById("searchSuggestions");

  if (!query) {
    hideSearchSuggestions();
    return;
  }

  const matches = searchProducts(query).slice(0, 5);

  if (matches.length === 0) {
    suggestions.innerHTML = "<p class='search-suggestions__empty'>Không tìm thấy sản phẩm phù hợp.</p>";
  } else {
    suggestions.innerHTML = matches.map(function (product) {
      return "<button type='button' class='search-suggestion' role='option' aria-label='" + escapeHtml(product.name) + ", " + formatPrice(product.price) + "' data-id='" + product.id + "'>" +
        "<img src='" + escapeHtml(product.images[0]) + "' alt='' loading='lazy'>" +
        "<span class='search-suggestion__info'><span class='search-suggestion__name'>" + escapeHtml(product.name) + "</span><span class='search-suggestion__category'>" + escapeHtml(getCategoryLabel(product.category)) + "</span></span>" +
        "<span class='search-suggestion__price'>" + formatPrice(product.price) + "</span>" +
      "</button>";
    }).join("");

    suggestions.querySelectorAll(".search-suggestion").forEach(function (item) {
      item.addEventListener("click", function () {
        const id = Number(item.getAttribute("data-id"));
        hideSearchSuggestions();
        openProductModal(id);
      });
    });
  }

  suggestions.classList.add("active");
  input.setAttribute("aria-expanded", "true");
}

function openProductModal(id, preselectedColor) {
  if (!catalogReady) return;
  currentProduct = findProductById(id);
  if (!currentProduct) return;
  currentImageIndex = 0;
  selectedSize = null;
  selectedColor = null;
  currentQty = 1;

  if (preselectedColor && currentProduct.colors.includes(preselectedColor)) {
    selectedColor = preselectedColor;
    if (currentProduct.colorImageIndices && Number.isInteger(currentProduct.colorImageIndices[preselectedColor])) {
      currentImageIndex = currentProduct.colorImageIndices[preselectedColor];
    }
  }

  renderProductModal();
  openBox("productOverlay", "productModal");
}

function renderProductModal() {
  const product = currentProduct;

  let thumbsHtml = "";
  product.images.forEach(function (img, index) {
    const activeClass = index === currentImageIndex ? "active" : "";
    thumbsHtml += "<img src='" + escapeHtml(img) + "' alt='" + escapeHtml(product.name) + " - ảnh " + (index + 1) + "' class='" + activeClass + "' data-index='" + index + "'>";
  });

  let sizeHtml = "";
  product.sizes.forEach(function (size) {
    const selectedClass = size === selectedSize ? "selected" : "";
    sizeHtml += "<button type='button' class='option-chip " + selectedClass + "' data-size='" + escapeHtml(size) + "' aria-pressed='" + (size === selectedSize) + "'>" + escapeHtml(size) + "</button>";
  });

  let colorHtml = "";
  product.colors.forEach(function (color) {
    const selectedClass = color === selectedColor ? "selected" : "";
    colorHtml += "<button type='button' class='option-chip color-chip " + selectedClass + "' data-color='" + escapeHtml(color) + "' aria-pressed='" + (color === selectedColor) + "'><span class='color-dot' style='background:" + colorToHex(color) + "'></span>" + escapeHtml(color) + "</button>";
  });

  let bundlePanelHtml = "";
  if (Array.isArray(product.bundleItems) && product.bundleItems.length > 0) {
    const splitItemsHtml = product.bundleItems.map(function (cid) {
      const cp = findProductById(cid);
      if (!cp) return "";
      return "<div class='winter-split-item'>" +
        "<img src='" + escapeHtml(cp.images[0]) + "' alt='" + escapeHtml(cp.name) + "'>" +
        "<div class='winter-split-item__info'>" +
          "<div class='winter-split-item__name'>" + escapeHtml(cp.name) + "</div>" +
          "<div class='winter-split-item__price'>" + formatPrice(cp.price) + "</div>" +
        "</div>" +
        "<button type='button' class='winter-split-item__btn pm-jump-product' data-id='" + cp.id + "'>Mua lẻ →</button>" +
      "</div>";
    }).join("");
    bundlePanelHtml = "<div class='pm-bundle-panel'><h4>📦 Tách lẻ từng món trong bộ này</h4><div class='pm-bundle-items-grid'>" + splitItemsHtml + "</div></div>";
  } else {
    const parentBundles = products.filter(function (b) {
      return Array.isArray(b.bundleItems) && b.bundleItems.includes(product.id);
    });
    if (parentBundles.length > 0) {
      const parentHtml = parentBundles.map(function (b) {
        return "<div class='winter-split-item'>" +
          "<img src='" + escapeHtml(b.images[0]) + "' alt='" + escapeHtml(b.name) + "'>" +
          "<div class='winter-split-item__info'>" +
            "<div class='winter-split-item__name'>" + escapeHtml(b.name) + "</div>" +
            "<div class='winter-split-item__price'>Trọn bộ: " + formatPrice(b.price) + "</div>" +
          "</div>" +
          "<button type='button' class='winter-split-item__btn pm-jump-product' data-id='" + b.id + "'>Xem bộ →</button>" +
        "</div>";
      }).join("");
      bundlePanelHtml = "<div class='pm-bundle-panel'><h4>🎁 Nằm trong Bộ Mùa Đông (Tiết kiệm đến 33%)</h4><div class='pm-bundle-items-grid'>" + parentHtml + "</div></div>";
    }
  }

  let suggestHtml = "";
  const suggestIds = (typeof outfitSuggestions !== "undefined" && outfitSuggestions[product.id]) ? outfitSuggestions[product.id] : [];
  suggestIds.forEach(function (sid) {
    const sp = findProductById(sid);
    if (sp) {
      suggestHtml +=
        "<div class='pm-suggest-item' data-id='" + sp.id + "'>" +
          "<img src='" + escapeHtml(sp.images[0]) + "' alt='" + escapeHtml(sp.name) + "'>" +
          "<p>" + escapeHtml(sp.name) + "</p>" +
        "</div>";
    }
  });

  const heartLabel = wishlist.includes(product.id) ? "♥ Đã yêu thích" : "♡ Yêu thích";
  const canShowSizeChart = product.category !== "phukien";
  const oldPriceBlock = product.originalPrice
    ? " <span style='font-size:14px;font-weight:400;color:#6E6D68;text-decoration:line-through;margin-left:8px;'>" + formatPrice(product.originalPrice) + "</span>"
    : "";

  const html =
    "<div class='pm-gallery'>" +
      "<div class='pm-gallery__main'><img src='" + escapeHtml(product.images[currentImageIndex]) + "' id='pmMainImage'></div>" +
      "<div class='pm-gallery__thumbs' id='pmThumbs'>" + thumbsHtml + "</div>" +
    "</div>" +
    "<div class='pm-info'>" +
      "<h2>" + escapeHtml(product.name) + "</h2>" +
      "<p class='pm-price'>" + formatPrice(product.price) + oldPriceBlock + "</p>" +
      "<p class='pm-desc'>" + escapeHtml(product.description) + "</p>" +

      "<div class='pm-option-label'>Chọn kích cỡ" + (canShowSizeChart ? " <button id='openSizeChartBtn'>Hướng dẫn chọn size</button>" : "") + "</div>" +
      "<div class='pm-options' id='pmSizes'>" + sizeHtml + "</div>" +

      "<div class='pm-option-label'>Chọn màu</div>" +
      "<div class='pm-options' id='pmColors'>" + colorHtml + "</div>" +

      "<div class='pm-option-label'>Số lượng</div>" +
      "<div class='pm-qty'>" +
        "<button id='qtyMinus'>-</button>" +
        "<span id='qtyValue'>" + currentQty + "</span>" +
        "<button id='qtyPlus'>+</button>" +
      "</div>" +

      "<div class='pm-actions'>" +
        "<button class='btn btn--primary' id='addToCartBtn'>Thêm vào giỏ hàng</button>" +
        "<button class='btn btn--ghost' id='toggleWishlistBtn'>" + heartLabel + "</button>" +
      "</div>" +

      bundlePanelHtml +

      "<div class='pm-suggest'>" +
        "<h4>Gợi ý phối đồ cùng</h4>" +
        "<div class='pm-suggest-grid'>" + (suggestHtml || "<p style='color:var(--color-ink-light);font-size:13px'>Chưa có gợi ý cho sản phẩm này.</p>") + "</div>" +
      "</div>" +
    "</div>";

  document.getElementById("productModalContent").innerHTML = html;
  attachProductModalEvents();
}

function attachProductModalEvents() {
  document.querySelectorAll("#pmThumbs img").forEach(function (thumb) {
    thumb.addEventListener("click", function () {
      currentImageIndex = Number(thumb.getAttribute("data-index"));
      if (currentProduct.colorImageIndices) {
        selectedColor = Object.keys(currentProduct.colorImageIndices).find(function (color) {
          return currentProduct.colorImageIndices[color] === currentImageIndex;
        }) || selectedColor;
      }
      renderProductModal();
    });
  });

  document.querySelectorAll("#pmSizes .option-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      selectedSize = chip.getAttribute("data-size");
      renderProductModal();
    });
  });

  document.querySelectorAll("#pmColors .option-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      selectedColor = chip.getAttribute("data-color");
      if (currentProduct.colorImageIndices && Number.isInteger(currentProduct.colorImageIndices[selectedColor])) {
        currentImageIndex = currentProduct.colorImageIndices[selectedColor];
      }
      renderProductModal();
    });
  });

  document.getElementById("qtyMinus").addEventListener("click", function () {
    if (currentQty > 1) currentQty--;
    document.getElementById("qtyValue").textContent = currentQty;
  });
  document.getElementById("qtyPlus").addEventListener("click", function () {
    if (currentQty < 999) currentQty++;
    document.getElementById("qtyValue").textContent = currentQty;
  });

  const sizeChartButton = document.getElementById("openSizeChartBtn");
  if (sizeChartButton) {
    sizeChartButton.addEventListener("click", function () {
      renderSizeChart();
      openBox("sizeOverlay", "sizeModal");
    });
  }

  document.getElementById("addToCartBtn").addEventListener("click", addCurrentProductToCart);

  document.getElementById("toggleWishlistBtn").addEventListener("click", function () {
    toggleWishlist(currentProduct.id);
    renderProductModal();
  });

  document.querySelectorAll(".pm-suggest-item, .pm-jump-product").forEach(function (item) {
    item.addEventListener("click", function () {
      const id = Number(item.getAttribute("data-id"));
      openProductModal(id);
    });
  });
}

function closeProductModal() {
  closeBox("productOverlay", "productModal");
}

function renderSizeChart() {
  let rows = "<tr><th>Size</th><th>Vòng ngực (cm)</th><th>Vòng eo (cm)</th><th>Chiều cao (cm)</th></tr>";
  sizeChart.forEach(function (row) {
    rows += "<tr><td>" + escapeHtml(row.size) + "</td><td>" + escapeHtml(row.chest) + "</td><td>" + escapeHtml(row.waist) + "</td><td>" + escapeHtml(row.height) + "</td></tr>";
  });
  document.getElementById("sizeTable").innerHTML = rows;
}

function addCurrentProductToCart() {
  if (!catalogReady || !currentProduct) return;
  if (currentProduct.sizes.length && !selectedSize) {
    alert("Vui lòng chọn kích cỡ trước khi thêm vào giỏ hàng.");
    return;
  }
  if (!selectedColor) {
    alert("Vui lòng chọn màu trước khi thêm vào giỏ hàng.");
    return;
  }

  const existingItem = cart.find(function (item) {
    return item.id === currentProduct.id && item.size === selectedSize && item.color === selectedColor;
  });

  if (existingItem) {
    existingItem.qty = Math.min(999, existingItem.qty + currentQty);
  } else {
    cart.push({
      id: currentProduct.id,
      name: currentProduct.name,
      price: currentProduct.price,
      image: currentProduct.images[currentImageIndex],
      size: selectedSize,
      color: selectedColor,
      qty: currentQty,
      catalogSource: "sql-v1"
    });
  }

  saveCart();
  updateCartCount();
  pulseCartIcon();
  closeProductModal();
  openBox("cartOverlay", "cartDrawer");
  renderCart();
}

function renderCart() {
  if (!catalogReady) return;
  const wrap = document.getElementById("cartItems");

  if (cart.length === 0) {
    wrap.innerHTML = "<p class='empty-msg'>Giỏ hàng đang trống.</p>";
  } else {
    let html = "";
    cart.forEach(function (item, index) {
      html +=
        "<div class='cart-item'>" +
          "<img src='" + escapeHtml(item.image) + "'>" +
          "<div class='cart-item__info'>" +
            "<p>" + escapeHtml(item.name) + "</p>" +
            "<p class='cart-item__meta'>Size " + escapeHtml(item.size) + " · " + escapeHtml(item.color) + "</p>" +
            "<div class='cart-item__qty'>" +
              "<button class='cart-minus' data-index='" + index + "'>-</button>" +
              "<span>" + item.qty + "</span>" +
              "<button class='cart-plus' data-index='" + index + "'>+</button>" +
            "</div>" +
            "<p>" + formatPrice(item.price * item.qty) + "</p>" +
            "<button class='cart-item__remove' data-index='" + index + "'>Xóa</button>" +
          "</div>" +
        "</div>";
    });
    wrap.innerHTML = html;
  }

  attachCartEvents();
  updateCartTotal();
  showStorageNotice();
}

function attachCartEvents() {
  document.querySelectorAll(".cart-minus").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const index = Number(btn.getAttribute("data-index"));
      if (cart[index].qty > 1) {
        cart[index].qty--;
      } else {
        cart.splice(index, 1);
      }
      saveCart();
      renderCart();
      updateCartCount();
    });
  });

  document.querySelectorAll(".cart-plus").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const index = Number(btn.getAttribute("data-index"));
      if (cart[index].qty < 999) cart[index].qty++;
      saveCart();
      renderCart();
      updateCartCount();
    });
  });

  document.querySelectorAll(".cart-item__remove").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const index = Number(btn.getAttribute("data-index"));
      cart.splice(index, 1);
      saveCart();
      renderCart();
      updateCartCount();
    });
  });
}

function updateCartCount() {
  const totalQty = cart.reduce(function (sum, item) { return sum + item.qty; }, 0);
  document.getElementById("cartCount").textContent = totalQty;
}

function updateCartTotal() {
  let subtotal = cart.reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
  let total = subtotal;

  if (appliedVoucher) {
    if (appliedVoucher.type === "percent") {
      total = subtotal - (subtotal * appliedVoucher.value / 100);
    } else if (appliedVoucher.type === "shipping" || appliedVoucher.type === "fixed") {
      total = subtotal - appliedVoucher.value;
      if (total < 0) total = 0;
    }
  }

  document.getElementById("cartTotal").textContent = formatPrice(Math.round(total));
}

function applyVoucher() {
  const codeInput = document.getElementById("voucherInput");
  const code = codeInput.value.trim().toUpperCase();
  const messageBox = document.getElementById("voucherMessage");

  if (Object.hasOwn(voucherList, code)) {
    appliedVoucher = voucherList[code];
    EndlessCatalog.write("moc_voucher", code);
    messageBox.textContent = "Đã áp dụng: " + appliedVoucher.label;
    messageBox.className = "voucher-message success";
  } else {
    appliedVoucher = null;
    EndlessCatalog.write("moc_voucher", null);
    messageBox.textContent = "Mã giảm giá không hợp lệ.";
    messageBox.className = "voucher-message error";
  }

  updateCartTotal();
}

function toggleWishlist(id) {
  const index = wishlist.indexOf(id);
  if (index === -1) {
    wishlist.push(id);
  } else {
    wishlist.splice(index, 1);
  }
  saveWishlist();
  updateWishlistCount();
  pulseHeart();
}

function updateWishlistCount() {
  document.getElementById("wishlistCount").textContent = wishlist.length;
}

function renderWishlist() {
  if (!catalogReady) return;
  const wrap = document.getElementById("wishlistItems");

  if (wishlist.length === 0) {
    wrap.innerHTML = "<p class='empty-msg'>Chưa có sản phẩm yêu thích nào.</p>";
    return;
  }

  let html = "";
  wishlist.forEach(function (id) {
    const product = findProductById(id);
    if (!product) return;
    html +=
      "<div class='cart-item' data-id='" + product.id + "'>" +
        "<img src='" + escapeHtml(product.images[0]) + "'>" +
        "<div class='cart-item__info'>" +
          "<p>" + escapeHtml(product.name) + "</p>" +
          "<p class='cart-item__meta'>" + formatPrice(product.price) + "</p>" +
          "<button class='cart-item__remove' data-id='" + product.id + "'>Bỏ yêu thích</button>" +
        "</div>" +
      "</div>";
  });
  wrap.innerHTML = html;

  document.querySelectorAll("#wishlistItems .cart-item__remove").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const id = Number(btn.getAttribute("data-id"));
      toggleWishlist(id);
      renderWishlist();
    });
  });

  document.querySelectorAll("#wishlistItems .cart-item").forEach(function (row) {
    row.addEventListener("click", function (e) {
      if (e.target.classList.contains("cart-item__remove")) return;
      const id = Number(row.getAttribute("data-id"));
      closeBox("wishlistOverlay", "wishlistDrawer");
      openProductModal(id);
    });
  });
}

function initEvents() {
  document.getElementById("retryCatalog").addEventListener("click", loadCatalog);

  const searchInput = document.getElementById("searchInput");
  const debouncedSearch = debounce(function () {
    updateProductGrid();
    renderSearchSuggestions();
  }, 150);
  searchInput.addEventListener("input", debouncedSearch);
  searchInput.addEventListener("focus", renderSearchSuggestions);
  searchInput.addEventListener("keydown", function (event) {
    if (event.key === "Escape") hideSearchSuggestions();
  });
  document.addEventListener("click", function (event) {
    if (!event.target.closest(".search-box")) hideSearchSuggestions();
  });

  document.getElementById("sortSelect").addEventListener("change", updateProductGrid);

  document.querySelectorAll(".filter-price").forEach(function (input) {
    input.addEventListener("change", updateProductGrid);
  });

  document.getElementById("resetFilterBtn").addEventListener("click", function () {
    document.querySelectorAll(".filter-category, .filter-size, .filter-color").forEach(function (box) {
      box.checked = false;
    });
    document.querySelectorAll("#categoryTabs .category-tab").forEach(function (tab) {
      tab.classList.toggle("active", tab.getAttribute("data-category") === "all");
    });
    document.querySelector(".filter-price[value='all']").checked = true;
    document.getElementById("searchInput").value = "";
    hideSearchSuggestions();
    updateProductGrid();
  });

  document.getElementById("closeProductModal").addEventListener("click", closeProductModal);
  document.getElementById("productOverlay").addEventListener("click", closeProductModal);

  document.getElementById("closeSizeModal").addEventListener("click", function () {
    closeBox("sizeOverlay", "sizeModal");
  });
  document.getElementById("sizeOverlay").addEventListener("click", function () {
    closeBox("sizeOverlay", "sizeModal");
  });

  document.getElementById("cartBtn").addEventListener("click", function () {
    renderCart();
    openBox("cartOverlay", "cartDrawer");
  });
  document.getElementById("closeCartDrawer").addEventListener("click", function () {
    closeBox("cartOverlay", "cartDrawer");
  });
  document.getElementById("cartOverlay").addEventListener("click", function () {
    closeBox("cartOverlay", "cartDrawer");
  });

  document.getElementById("wishlistBtn").addEventListener("click", function () {
    renderWishlist();
    openBox("wishlistOverlay", "wishlistDrawer");
  });
  document.getElementById("closeWishlistDrawer").addEventListener("click", function () {
    closeBox("wishlistOverlay", "wishlistDrawer");
  });
  document.getElementById("wishlistOverlay").addEventListener("click", function () {
    closeBox("wishlistOverlay", "wishlistDrawer");
  });

  document.getElementById("applyVoucherBtn").addEventListener("click", applyVoucher);

  document.getElementById("checkoutBtn").addEventListener("click", function () {
    if (cart.length === 0) {
      alert("Giỏ hàng đang trống, vui lòng chọn sản phẩm trước.");
      return;
    }
    window.location.href = "checkout.html";
  });
}

async function loadCatalog() {
  if (catalogLoading) return;
  catalogLoading = true;
  catalogReady = false;
  products = [];
  hideSearchSuggestions();
  document.getElementById("productGrid").replaceChildren();
  document.getElementById("productGrid").setAttribute("aria-busy", "true");
  document.getElementById("resultCount").textContent = "Đang tải sản phẩm…";
  document.getElementById("catalogStatus").textContent = "Đang tải sản phẩm từ cửa hàng…";
  document.getElementById("retryCatalog").hidden = true;
  setCatalogControls(false);
  catalogFromFallback = false;
  try {
    const [fetchedCats, fetchedProducts] = await Promise.all([
      EndlessCatalog.fetchCategories(),
      EndlessCatalog.fetchProducts()
    ]);
    categories = fetchedCats;
    products = fetchedProducts;
    catalogFromFallback = typeof EndlessCatalog.isFallback === "function" && EndlessCatalog.isFallback();
    cart = EndlessCatalog.reconcileCart(EndlessCatalog.readArray("moc_cart"), products);
    wishlist = EndlessCatalog.reconcileWishlist(EndlessCatalog.readArray("moc_wishlist"), products);
    if (!catalogFromFallback) {
      saveCart();
      saveWishlist();
    }
    const code = EndlessCatalog.readText("moc_voucher");
    appliedVoucher = Object.hasOwn(voucherList, code || "") ? voucherList[code] : null;
    catalogReady = true;
    initializeCatalogView();
    document.getElementById("catalogStatus").textContent = products.length ? "" : "Cửa hàng hiện chưa có sản phẩm.";
    setCatalogControls(true);
  } catch {
    products = [];
    catalogReady = false;
    catalogFromFallback = false;
    document.getElementById("resultCount").textContent = "Chưa tải được sản phẩm";
    document.getElementById("catalogStatus").textContent = "Không tải được danh sách sản phẩm từ API. Vui lòng kiểm tra kết nối và thử lại.";
    document.getElementById("retryCatalog").hidden = false;
  } finally {
    catalogLoading = false;
    document.getElementById("productGrid").setAttribute("aria-busy", "false");
    showStorageNotice();
  }
}

function setCatalogControls(enabled) {
  document.querySelectorAll(".filters input, .filters button, #searchInput, #sortSelect, #cartBtn, #wishlistBtn, #checkoutBtn, #applyVoucherBtn")
    .forEach(function (element) { element.disabled = !enabled; });
}

function showStorageNotice() {
  const parts = [];
  if (catalogFromFallback) {
    parts.push("Đang hiển thị danh mục tĩnh dự phòng (chưa kết nối API máy chủ); giỏ đã lưu được giữ nguyên.");
  }
  const storageNotice = EndlessCatalog.notice();
  if (storageNotice) parts.push(storageNotice);
  document.getElementById("catalogNotice").textContent = parts.join(" ");
}

function initializeCatalogView() {
  renderWinterBundlesSection();
  renderDynamicCategoryControls();
  renderFilterOptions();

  const params = new URLSearchParams(window.location.search);
  const category = params.get("category");
  if (category && categories.some(function (c) { return c.code === category; })) {
    const categoryFilter = document.querySelector(".filter-category[value='" + category + "']");
    if (categoryFilter) categoryFilter.checked = true;
    document.querySelectorAll("#categoryTabs .category-tab").forEach(function (tab) {
      tab.classList.toggle("active", tab.getAttribute("data-category") === category);
    });
  }
  const keyword = params.get("q");
  if (keyword) document.getElementById("searchInput").value = keyword.replace(/-/g, " ");
  updateProductGrid();
  updateCartCount();
  updateWishlistCount();
  if (params.get("panel") === "cart") { renderCart(); openBox("cartOverlay", "cartDrawer"); }
  if (params.get("panel") === "wishlist") { renderWishlist(); openBox("wishlistOverlay", "wishlistDrawer"); }
}

function renderFilterOptions() {
  const allSizes = Array.from(new Set(products.flatMap(function (product) { return product.sizes; })));
  const allColors = Array.from(new Set(products.flatMap(function (product) { return product.colors; })));

  document.getElementById("filterSizes").innerHTML = allSizes.map(function (size) {
    return "<label><input type='checkbox' class='filter-size' value='" + escapeHtml(size) + "'> " + escapeHtml(size) + "</label>";
  }).join("");

  document.getElementById("filterColors").innerHTML = allColors.map(function (color) {
    return "<label class='filter-color-option'><input type='checkbox' class='filter-color' value='" + escapeHtml(color) + "'><span class='color-dot' style='background:" + colorToHex(color) + "'></span><span>" + escapeHtml(color) + "</span></label>";
  }).join("");

  document.querySelectorAll(".filter-size, .filter-color").forEach(function (input) {
    input.addEventListener("change", updateProductGrid);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  initBlackFridayCountdown();
  initVoucherWallet();
  initEvents();
  loadCatalog();
});
