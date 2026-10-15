




let cart = JSON.parse(localStorage.getItem("moc_cart")) || [];


let wishlist = JSON.parse(localStorage.getItem("moc_wishlist")) || [];


let currentProduct = null;
let currentImageIndex = 0;
let selectedSize = null;
let selectedColor = null;
let currentQty = 1;


let appliedVoucher = null;


const voucherList = {
  "ENDLESS10": { type: "percent", value: 10, label: "Giảm 10% tổng đơn" },
  "FREESHIP": { type: "shipping", value: 30000, label: "Miễn phí vận chuyển (giảm 30.000đ)" }
};


let revealObserver = null;




function removeDiacritics(str) {
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}


function formatPrice(number) {
  return number.toLocaleString("vi-VN") + "đ";
}


function findProductById(id) {
  return products.find(function (item) {
    return item.id === id;
  });
}


function saveCart() {
  localStorage.setItem("moc_cart", JSON.stringify(cart));
}


function saveWishlist() {
  localStorage.setItem("moc_wishlist", JSON.stringify(wishlist));
}


function openBox(overlayId, boxId) {
  document.getElementById(overlayId).classList.add("active");
  document.getElementById(boxId).classList.add("active");
}


function closeBox(overlayId, boxId) {
  document.getElementById(overlayId).classList.remove("active");
  document.getElementById(boxId).classList.remove("active");
}


/* dùng chung cho hàm debounce ở ô tìm kiếm, tránh gọi lại render quá nhiều lần khi gõ nhanh */
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


/* icon giỏ hàng rung nhẹ khi thêm sản phẩm thành công */
function pulseCartIcon() {
  const cartBtn = document.getElementById("cartBtn");
  cartBtn.classList.remove("is-shaking");

  void cartBtn.offsetWidth;
  cartBtn.classList.add("is-shaking");
  setTimeout(function () {
    cartBtn.classList.remove("is-shaking");
  }, 500);
}


/* icon trái tim đập nhẹ khi bấm yêu thích / bỏ yêu thích */
function pulseHeart() {
  const heartIcon = document.getElementById("wishlistIcon");
  heartIcon.classList.remove("is-beating");
  void heartIcon.offsetWidth;
  heartIcon.classList.add("is-beating");
  setTimeout(function () {
    heartIcon.classList.remove("is-beating");
  }, 500);
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
      colorDots += "<span class='color-dot' style='background:" + colorToHex(color) + "' title='" + color + "'></span>";
    });

    const badgeHtml = product.isNew ? "<span class='product-card__badge'>Mới</span>" : "";

    const cardHtml =
      "<div class='product-card reveal' data-id='" + product.id + "'>" +
        "<div class='product-card__image'>" +
          badgeHtml +
          "<img src='" + product.images[0] + "' alt='" + product.name + "' loading='lazy'>" +
        "</div>" +
        "<p class='product-card__name'>" + product.name + "</p>" +
        "<p class='product-card__price'>" + formatPrice(product.price) + "</p>" +
        "<div class='product-card__colors'>" + colorDots + "</div>" +
      "</div>";

    grid.innerHTML += cardHtml;
  });


  const cards = document.querySelectorAll(".product-card");
  cards.forEach(function (card) {
    card.addEventListener("click", function () {
      const id = Number(card.getAttribute("data-id"));
      openProductModal(id);
    });
  });


  observeRevealCards();
}


/* dùng IntersectionObserver để thẻ sản phẩm chỉ hiện hiệu ứng khi cuộn tới,
   mượt hơn và đỡ tốn hiệu năng so với lắng nghe sự kiện scroll liên tục */
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
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  }

  document.querySelectorAll(".product-card.reveal:not(.is-visible)").forEach(function (card) {
    revealObserver.observe(card);
  });
}


function colorToHex(colorName) {
  const map = {
    "Trắng": "#ffffff",
    "Đen": "#1c1a17",
    "Xanh": "#3b5b6b",
    "Xanh navy": "#26364a",
    "Be": "#d8c9ab",
    "Vàng": "#d1a64a",
    "Hồng": "#e3a9b0",
    "Xám": "#9b968d",
    "Nâu": "#7a5230"
  };
  return map[colorName] || "#cccccc";
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
  const result = getFilteredProducts();
  renderProducts(result);

  const resultCount = document.getElementById("resultCount");
  resultCount.textContent = "Tìm thấy " + result.length + " sản phẩm";
}

function searchProducts(keyword) {
  const normalizedKeyword = removeDiacritics(keyword.trim().toLowerCase());
  if (!normalizedKeyword) return products.slice();

  const categoryNames = { ao: "áo", quan: "quần", vay: "váy", phukien: "phụ kiện" };
  const directMatches = products.filter(function (product) {
    const directText = [product.name, categoryNames[product.category]].join(" ").toLowerCase();
    return removeDiacritics(directText).includes(normalizedKeyword);
  });
  if (directMatches.length > 0) return directMatches;

  return products.filter(function (product) {
    const searchableText = [product.name, categoryNames[product.category], product.description]
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
  const input = document.getElementById("searchInput");
  const query = input.value.trim();
  const suggestions = document.getElementById("searchSuggestions");

  if (!query) {
    hideSearchSuggestions();
    return;
  }

  const categoryNames = { ao: "áo", quan: "quần", vay: "váy", phukien: "phụ kiện" };
  const matches = searchProducts(query).slice(0, 5);

  if (matches.length === 0) {
    suggestions.innerHTML = "<p class='search-suggestions__empty'>Không tìm thấy sản phẩm phù hợp.</p>";
  } else {
    suggestions.innerHTML = matches.map(function (product) {
      return "<button type='button' class='search-suggestion' role='option' aria-label='" + product.name + ", " + formatPrice(product.price) + "' data-id='" + product.id + "'>" +
        "<img src='" + product.images[0] + "' alt='' loading='lazy'>" +
        "<span class='search-suggestion__info'><span class='search-suggestion__name'>" + product.name + "</span><span class='search-suggestion__category'>" + categoryNames[product.category] + "</span></span>" +
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




function openProductModal(id) {
  currentProduct = findProductById(id);
  currentImageIndex = 0;
  selectedSize = null;
  selectedColor = null;
  currentQty = 1;

  renderProductModal();
  openBox("productOverlay", "productModal");
}

function renderProductModal() {
  const product = currentProduct;


  let thumbsHtml = "";
  product.images.forEach(function (img, index) {
    const activeClass = index === currentImageIndex ? "active" : "";
    thumbsHtml += "<img src='" + img + "' alt='" + product.name + " - ảnh " + (index + 1) + "' class='" + activeClass + "' data-index='" + index + "'>";
  });


  let sizeHtml = "";
  product.sizes.forEach(function (size) {
    const selectedClass = size === selectedSize ? "selected" : "";
    sizeHtml += "<button type='button' class='option-chip " + selectedClass + "' data-size='" + size + "' aria-pressed='" + (size === selectedSize) + "'>" + size + "</button>";
  });


  let colorHtml = "";
  product.colors.forEach(function (color) {
    const selectedClass = color === selectedColor ? "selected" : "";
    colorHtml += "<button type='button' class='option-chip color-chip " + selectedClass + "' data-color='" + color + "' aria-pressed='" + (color === selectedColor) + "'><span class='color-dot' style='background:" + colorToHex(color) + "'></span>" + color + "</button>";
  });


  let suggestHtml = "";
  const suggestIds = outfitSuggestions[product.id] || [];
  suggestIds.forEach(function (sid) {
    const sp = findProductById(sid);
    if (sp) {
      suggestHtml +=
        "<div class='pm-suggest-item' data-id='" + sp.id + "'>" +
          "<img src='" + sp.images[0] + "' alt='" + sp.name + "'>" +
          "<p>" + sp.name + "</p>" +
        "</div>";
    }
  });

  const heartLabel = wishlist.includes(product.id) ? "♥ Đã yêu thích" : "♡ Yêu thích";

  const canShowSizeChart = product.category !== "phukien";
  const html =
    "<div class='pm-gallery'>" +
      "<div class='pm-gallery__main'><img src='" + product.images[currentImageIndex] + "' id='pmMainImage'></div>" +
      "<div class='pm-gallery__thumbs' id='pmThumbs'>" + thumbsHtml + "</div>" +
    "</div>" +
    "<div class='pm-info'>" +
      "<h2>" + product.name + "</h2>" +
      "<p class='pm-price'>" + formatPrice(product.price) + "</p>" +
      "<p class='pm-desc'>" + product.description + "</p>" +

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
    currentQty++;
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


  document.querySelectorAll(".pm-suggest-item").forEach(function (item) {
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
    rows += "<tr><td>" + row.size + "</td><td>" + row.chest + "</td><td>" + row.waist + "</td><td>" + row.height + "</td></tr>";
  });
  document.getElementById("sizeTable").innerHTML = rows;
}




function addCurrentProductToCart() {
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
    existingItem.qty += currentQty;
  } else {
    cart.push({
      id: currentProduct.id,
      name: currentProduct.name,
      price: currentProduct.price,
      image: currentProduct.images[currentImageIndex],
      size: selectedSize,
      color: selectedColor,
      qty: currentQty
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
  const wrap = document.getElementById("cartItems");

  if (cart.length === 0) {
    wrap.innerHTML = "<p class='empty-msg'>Giỏ hàng đang trống.</p>";
  } else {
    let html = "";
    cart.forEach(function (item, index) {
      html +=
        "<div class='cart-item'>" +
          "<img src='" + item.image + "'>" +
          "<div class='cart-item__info'>" +
            "<p>" + item.name + "</p>" +
            "<p class='cart-item__meta'>Size " + item.size + " · " + item.color + "</p>" +
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
      cart[index].qty++;
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
    } else if (appliedVoucher.type === "shipping") {
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

  if (voucherList[code]) {
    appliedVoucher = voucherList[code];
    localStorage.setItem("moc_voucher", code);
    messageBox.textContent = "Đã áp dụng: " + appliedVoucher.label;
    messageBox.className = "voucher-message success";
  } else {
    appliedVoucher = null;
    localStorage.removeItem("moc_voucher");
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
        "<img src='" + product.images[0] + "'>" +
        "<div class='cart-item__info'>" +
          "<p>" + product.name + "</p>" +
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


  document.querySelectorAll(".filter-category, .filter-size, .filter-color, .filter-price")
    .forEach(function (input) {
      input.addEventListener("change", updateProductGrid);
    });


  document.getElementById("resetFilterBtn").addEventListener("click", function () {
    document.querySelectorAll(".filter-category, .filter-size, .filter-color").forEach(function (box) {
      box.checked = false;
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




function init() {
  renderFilterOptions();
  const params = new URLSearchParams(window.location.search);
  const category = params.get("category");
  if (category && ["ao", "quan", "vay", "phukien"].includes(category)) {
    const categoryFilter = document.querySelector(".filter-category[value='" + category + "']");
    if (categoryFilter) categoryFilter.checked = true;
    const keyword = params.get("q");
    if (keyword) document.getElementById("searchInput").value = keyword.replace(/-/g, " ");
  }
  updateProductGrid();
  updateCartCount();
  updateWishlistCount();
  initEvents();
}

function renderFilterOptions() {
  const allSizes = Array.from(new Set(products.flatMap(function (product) { return product.sizes; })));
  const allColors = Array.from(new Set(products.flatMap(function (product) { return product.colors; })));

  document.getElementById("filterSizes").innerHTML = allSizes.map(function (size) {
    return "<label><input type='checkbox' class='filter-size' value='" + size + "'> " + size + "</label>";
  }).join("");

  document.getElementById("filterColors").innerHTML = allColors.map(function (color) {
    return "<label class='filter-color-option'><input type='checkbox' class='filter-color' value='" + color + "'><span class='color-dot' style='background:" + colorToHex(color) + "'></span><span>" + color + "</span></label>";
  }).join("");

}


document.addEventListener("DOMContentLoaded", init);
