# BÁO CÁO KIỂM THỬ VÀ DANH MỤC LỖI (BUG REPORT & FIX SOLUTIONS)

> **Dự án:** Endless — Cửa hàng thời trang  
> **Phạm vi kiểm thử:** Các tập tin JavaScript (`js/products.js`, `js/navigation.js`, `js/app.js`, `js/checkout.js`)  
> **Người thực hiện:** QA / QC Tester  
> **Ngày lập báo cáo:** 23/10/2026  

---

## I. BẢNG TỔNG HỢP DANH MỤC LỖI (TEST SUMMARY)

| Mã lỗi | Tập tin | Vị trí dòng | Mức độ | Phân loại lỗi | Tóm tắt lỗi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BUG-01** | `js/app.js` | 144, 404, 577, 713 | 🔴 Critical | Security (XSS) | Chèn trực tiếp chuỗi chưa escape vào `innerHTML` |
| **BUG-02** | `js/app.js` | 19, 832 | 🔴 Critical | Data Sync | Không đọc lại mã giảm giá từ `localStorage` khi tải lại trang |
| **BUG-03** | `js/app.js`, `js/checkout.js` | `app.js`: 6, 9<br>`checkout.js`: 6, 7 | 🔴 Critical | Stability | `JSON.parse()` thiếu `try...catch`, nguy cơ sập toàn trang |
| **BUG-04** | `js/navigation.js` | 28–33 | 🟠 High | Functional / UI | Không thể click chuột để đóng Mega Menu trên Desktop |
| **BUG-05** | `js/app.js` | 278–296 | 🟠 High | Business Logic | Tìm kiếm đa từ khóa (vd: "áo đen", "quần trắng") trả về 0 kết quả |
| **BUG-06** | `js/checkout.js`, `js/app.js` | `checkout.js`: 39<br>`app.js`: 646 | 🟠 High | Business Logic | Mã `FREESHIP` giảm 30.000đ trực tiếp vào giá sản phẩm |
| **BUG-07** | `js/app.js` | 138–159 | 🟠 High | Accessibility | Thẻ sản phẩm dùng thẻ `div`, không thể focus/mở bằng bàn phím |
| **BUG-08** | `js/app.js` | 770–778 | 🟡 Medium | Functional | Nút "Xóa lọc" không đưa bộ sắp xếp giá `#sortSelect` về mặc định |
| **BUG-09** | `js/app.js` | 836–841 | 🟡 Medium | Routing / URL | Tham số tìm kiếm `q` trên URL bị bỏ qua nếu thiếu `category` |
| **BUG-10** | `js/checkout.js` | 148, 189 | 🟡 Medium | Data Display | Thông tin ghi chú đơn hàng (`note`) bị bỏ sót trong lịch sử giao dịch |
| **BUG-11** | `js/checkout.js` | 199 | 🟡 Medium | UX Flow | Form đặt hàng bị ẩn vĩnh viễn sau khi hoàn tất đơn hàng |
| **BUG-12** | `js/app.js` | 753 | 🟡 Medium | UX / A11y | Modal và Drawer thiếu bẫy tiêu điểm (Focus Trap) và không đóng bằng phím `Escape` |
| **CODE-13**| `js/app.js` | 129–150 | 🔵 Low | Performance | `innerHTML +=` trong vòng lặp render danh sách sản phẩm |
| **CODE-14**| `js/products.js`| 29, 41, 53... | 🔵 Low | Asset Standard | Tên tệp ảnh chứa ký tự khoảng trắng chưa encode |
| **CODE-15**| Tất cả các tệp | Toàn bộ | 🔵 Low | Architecture | Biến khai báo toàn cục (Global Namespace), trùng lặp code |

---

## II. CHI TIẾT TỪNG LỖI VÀ PHƯƠNG ÁN KHẮC PHỤC

---

### BUG-01: Lỗ hổng bảo mật XSS (Cross-Site Scripting) khi chèn dữ liệu vào DOM
* **File:** `js/app.js` (Dòng 144, 404, 577, 713)
* **Mức độ:** 🔴 **Critical**
* **Nguyên nhân:** 
  Dữ liệu sản phẩm và dữ liệu người dùng lưu trong `localStorage` (`item.name`, `item.size`, `item.color`, `product.description`...) được nối trực tiếp vào chuỗi HTML thông qua thuộc tính `.innerHTML` mà không thông qua hàm lọc (sanitize/escape). Trái lại, ở `checkout.js` lập trình viên đã viết hàm `escapeHtml()`, cho thấy sự thiếu đồng bộ về tiêu chuẩn an toàn.
* **Tác động:** Kẻ tấn công có thể chèn mã độc vào `localStorage` hoặc payload qua tham số URL để chiếm phiên làm việc hoặc đánh cắp dữ liệu.
* **Các bước tái hiện:**
  1. Mở DevTools Console, chạy:
     ```javascript
     localStorage.setItem("moc_cart", JSON.stringify([{ id: 1, name: "<img src=x onerror=alert('XSS')>", price: 100000, qty: 1, size: "M", color: "Đen", image: "img/id1.jpg" }]));
     ```
  2. Bấm vào icon Giỏ hàng ở header.
  3. Hộp thoại `alert('XSS')` lập tức xuất hiện.
* **Phương án khắc phục:**
  1. Bổ sung hàm `escapeHtml()` dùng chung vào `app.js`:
     ```javascript
     function escapeHtml(value) {
       return String(value || "").replace(/[&<>"']/g, function (c) {
         return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
       });
     }
     ```
  2. Bọc tất cả các biến chuỗi khi tạo mã HTML: `escapeHtml(item.name)`, `escapeHtml(item.size)`, `escapeHtml(item.color)`.

---

### BUG-02: Không khôi phục mã giảm giá từ LocalStorage khi tải lại trang
* **File:** `js/app.js` (Dòng 19, 832)
* **Mức độ:** 🔴 **Critical**
* **Nguyên nhân:** 
  Khi người dùng nhập voucher ở giỏ hàng, hàm `applyVoucher()` lưu mã vào `localStorage.setItem("moc_voucher", code)`. Tuy nhiên, trong hàm khởi tạo `init()` của `app.js`, biến `appliedVoucher` luôn mặc định là `null` và không có đoạn mã nào đọc lại `localStorage.getItem("moc_voucher")`.
* **Tác động:** 
  * Khi người dùng F5 lại trang chủ `index.html` hoặc chuyển từ `checkout.html` về lại cửa hàng, tổng tiền giỏ hàng hiển thị nguyên giá không có chiết khấu.
  * Trong khi đó, `checkout.js` lại đọc từ `localStorage` và hiển thị giá đã giảm. Sự không nhất quán này khiến người dùng tưởng hệ thống bị lỗi tính tiền.
* **Phương án khắc phục:**
  Cập nhật hàm `init()` trong `js/app.js` để đọc và khôi phục mã giảm giá:
  ```javascript
  const savedVoucher = localStorage.getItem("moc_voucher");
  if (savedVoucher && voucherList[savedVoucher]) {
    appliedVoucher = voucherList[savedVoucher];
    const voucherInput = document.getElementById("voucherInput");
    if (voucherInput) voucherInput.value = savedVoucher;
    const msg = document.getElementById("voucherMessage");
    if (msg) {
      msg.textContent = "Đã áp dụng: " + appliedVoucher.label;
      msg.className = "voucher-message success";
    }
  }
  ```

---

### BUG-03: `JSON.parse()` thiếu `try...catch`, nguy cơ sập toàn trang (Crash)
* **File:** `js/app.js` (Dòng 6, 9) & `js/checkout.js` (Dòng 6, 7)
* **Mức độ:** 🔴 **Critical**
* **Nguyên nhân:**
  ```javascript
  // Hiện tại:
  let cart = JSON.parse(localStorage.getItem("moc_cart")) || [];
  let wishlist = JSON.parse(localStorage.getItem("moc_wishlist")) || [];
  ```
  Nếu giá trị lưu trong `localStorage` bị hỏng cấu trúc cú pháp JSON (ví dụ `"abc"`, `"[{"`), lệnh `JSON.parse` sẽ quăng lỗi ngoại lệ `SyntaxError` chưa bắt, chặn đứng toàn bộ các dòng lệnh phía sau.
* **Phương án khắc phục:**
  Tạo hàm bọc an toàn có xử lý lỗi:
  ```javascript
  function safeGetJson(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      console.warn("Lỗi đọc dữ liệu từ localStorage với key:", key, e);
      return fallback;
    }
  }

  let cart = safeGetJson("moc_cart", []);
  let wishlist = safeGetJson("moc_wishlist", []);
  ```

---

### BUG-04: Không thể click chuột để đóng Mega Menu trên Desktop
* **File:** `js/navigation.js` (Dòng 28–33)
* **Mức độ:** 🟠 **High**
* **Nguyên nhân:**
  ```javascript
  trigger.addEventListener("click", function () {
    const isOpen = window.matchMedia("(hover: none)").matches
      ? menu.classList.toggle("is-open")
      : true; // <--- Lỗi tại đây: trên desktop hover: hover, giá trị luôn là true!
    setMenuOpen(isOpen);
  });
  ```
  Trên màn hình máy tính có chuột, media query `(hover: none)` trả về `false`. Do đó biến `isOpen` luôn nhận giá trị `true`. Khi người dùng click nút "Sản Phẩm" lần 1, menu mở ra. Khi click lần 2 với kỳ vọng đóng lại, menu vẫn được lệnh mở tiếp (`setMenuOpen(true)`).
* **Phương án khắc phục:**
  Cho phép click đóng mở trên cả hai loại thiết bị:
  ```javascript
  trigger.addEventListener("click", function (e) {
    e.stopPropagation();
    const currentlyOpen = menu.classList.contains("is-open");
    setMenuOpen(!currentlyOpen);
  });
  ```

---

### BUG-05: Tìm kiếm đa từ khóa (Multi-word search) trả về 0 kết quả
* **File:** `js/app.js` (Dòng 278–296)
* **Mức độ:** 🟠 **High**
* **Nguyên nhân:**
  Hàm `searchProducts()` ghép chuỗi:
  ```javascript
  const searchableText = [product.name, categoryNames[product.category], product.description]
    .concat(product.colors, product.sizes, String(product.id))
    .join(" ")
    .toLowerCase();
  return removeDiacritics(searchableText).includes(normalizedKeyword);
  ```
  Nếu khách gõ `"áo đen"`:
  * Tên sản phẩm: `"Áo thun basic cotton"` (chứa từ "áo")
  * Màu sắc: `["Xanh", "Đen", ...]` (chứa từ "đen")
  Khi nối lại: `"áo thun basic cotton ... xanh đen ..."`. Do từ "áo" và "đen" cách xa nhau trong chuỗi nên `.includes("áo đen")` trả về `false`. Khách hàng hoàn toàn không thể tìm sản phẩm kết hợp giữa loại và màu sắc/size.
* **Phương án khắc phục:**
  Tách từ khóa tìm kiếm thành từng từ (token) và kiểm tra tất cả các token:
  ```javascript
  function searchProducts(keyword) {
    const rawKeyword = keyword.trim().toLowerCase();
    if (!rawKeyword) return products.slice();

    const categoryNames = { ao: "áo", quan: "quần", vay: "váy", phukien: "phụ kiện" };
    const queryTokens = removeDiacritics(rawKeyword).split(/\s+/);

    return products.filter(function (product) {
      const fullText = [product.name, categoryNames[product.category] || "", product.description]
        .concat(product.colors, product.sizes, String(product.id))
        .join(" ")
        .toLowerCase();
      const normalizedFullText = removeDiacritics(fullText);

      return queryTokens.every(function (token) {
        return normalizedFullText.includes(token);
      });
    });
  }
  ```

---

### BUG-06: Mã giảm giá `FREESHIP` làm sai lệch doanh thu
* **File:** `js/checkout.js` (Dòng 39–41) & `js/app.js` (Dòng 646–649)
* **Mức độ:** 🟠 **High**
* **Nguyên nhân:**
  Cửa hàng chưa có chi phí vận chuyển trong tổng đơn hàng (phí ship mặc định bằng 0đ). Tuy nhiên, voucher `FREESHIP` lại thực hiện `subtotal - 30000`, tức là giảm trực tiếp 30.000đ vào tổng tiền hàng.
* **Phương án khắc phục:**
  1. Nếu cửa hàng có tính phí vận chuyển chuẩn (ví dụ 30.000đ): Cần thêm trường `shippingFee = 30000` vào đơn hàng, và khi áp mã `FREESHIP`, đặt `shippingFee = 0`.
  2. Nếu cửa hàng miễn phí ship toàn quốc từ đầu: Cần xóa mã này hoặc sửa mô tả thành mã giảm trực tiếp tiền mặt 30.000đ cho đơn hàng đạt giá trị tối thiểu.

---

### BUG-07: Thẻ sản phẩm không hỗ trợ truy cập bằng bàn phím (A11y)
* **File:** `js/app.js` (Dòng 138–159)
* **Mức độ:** 🟠 **High**
* **Nguyên nhân:**
  Thẻ sản phẩm là thẻ `<div>` bình thường, không có `tabindex="0"`, không có `role="button"` và chỉ lắng nghe sự kiện `click`. Người dùng duyệt web bằng phím `Tab` không thể dừng lại ở thẻ sản phẩm và không thể bấm `Enter` để xem chi tiết.
* **Phương án khắc phục:**
  1. Thêm `tabindex="0"` và `role="button"` vào chuỗi HTML tạo thẻ:
     ```javascript
     "<div class='product-card reveal' data-id='" + product.id + "' tabindex='0' role='button' aria-label='Xem chi tiết " + escapeHtml(product.name) + "'>"
     ```
  2. Lắng nghe thêm sự kiện phím trong JS:
     ```javascript
     card.addEventListener("keydown", function (e) {
       if (e.key === "Enter" || e.key === " ") {
         e.preventDefault();
         openProductModal(Number(card.getAttribute("data-id")));
       }
     });
     ```

---

### BUG-08: Nút "Xóa lọc" không reset bộ sắp xếp giá
* **File:** `js/app.js` (Dòng 770–778)
* **Mức độ:** 🟡 **Medium**
* **Nguyên nhân:**
  Trong hàm xử lý sự kiện click của `#resetFilterBtn`, chỉ có lệnh uncheck các checkbox và đặt lại radio giá, không có lệnh đặt lại giá trị của thẻ `<select id="sortSelect">`.
* **Phương án khắc phục:**
  Bổ sung vào hàm xử lý:
  ```javascript
  const sortSelect = document.getElementById("sortSelect");
  if (sortSelect) sortSelect.value = "default";
  ```

---

### BUG-09: Tham số tìm kiếm `q` trên URL bị bỏ qua nếu thiếu `category`
* **File:** `js/app.js` (Dòng 836–841)
* **Mức độ:** 🟡 **Medium**
* **Nguyên nhân:**
  Khối lệnh lấy tham số `q` bị đặt lồng bên trong `if (category && ...)`:
  ```javascript
  if (category && ["ao", "quan", "vay", "phukien"].includes(category)) {
    const categoryFilter = document.querySelector(".filter-category[value='" + category + "']");
    if (categoryFilter) categoryFilter.checked = true;
    const keyword = params.get("q"); // <--- Nếu không có ?category= thì dòng này không bao giờ chạy!
    if (keyword) document.getElementById("searchInput").value = keyword.replace(/-/g, " ");
  }
  ```
* **Phương án khắc phục:**
  Tách độc lập phần xử lý từ khóa tìm kiếm:
  ```javascript
  if (category && ["ao", "quan", "vay", "phukien"].includes(category)) {
    const categoryFilter = document.querySelector(".filter-category[value='" + category + "']");
    if (categoryFilter) categoryFilter.checked = true;
  }
  const keyword = params.get("q");
  if (keyword) {
    document.getElementById("searchInput").value = keyword.replace(/-/g, " ");
  }
  ```

---

### BUG-10: Ghi chú giao hàng (`note`) bị bỏ sót trong Lịch sử giao dịch
* **File:** `js/checkout.js` (Dòng 148, 189)
* **Mức độ:** 🟡 **Medium**
* **Nguyên nhân:**
  Trong `placeOrder()`, thông tin `note` được ghi nhận từ form và lưu vào đối tượng `delivery.note`. Tuy nhiên ở hàm `renderTransactions()`, thông tin giao hàng chỉ render:
  ```javascript
  '<p class="transaction-address"><strong>Giao đến:</strong> ' + escapeHtml(order.delivery && order.delivery.fullName || "") + ...
  ```
  Trường `order.delivery.note` không được đưa vào giao diện.
* **Phương án khắc phục:**
  Thêm hiển thị ghi chú nếu khách hàng có nhập:
  ```javascript
  (order.delivery && order.delivery.note ? '<p class="transaction-note"><strong>Ghi chú:</strong> ' + escapeHtml(order.delivery.note) + '</p>' : '')
  ```

---

### BUG-11: Form thanh toán bị ẩn vĩnh viễn sau khi hoàn tất đặt hàng
* **File:** `js/checkout.js` (Dòng 199)
* **Mức độ:** 🟡 **Medium**
* **Nguyên nhân:**
  Khi đặt hàng thành công, code chạy lệnh `form.hidden = true;` và hiển thị thông báo thành công. Nếu người dùng quay lại cửa hàng mua thêm hàng mới rồi quay lại trang `checkout.html` (trong phiên làm việc SPA hoặc hash link), form thanh toán vẫn bị ẩn, khiến người dùng không thể thực hiện giao dịch tiếp theo.
* **Phương án khắc phục:**
  * Bổ sung nút "Tạo đơn hàng mới" bên dưới thông báo thành công:
  ```javascript
  success.innerHTML += '<button type="button" class="btn btn--ghost" id="newOrderBtn">Tạo đơn hàng khác</button>';
  document.getElementById("newOrderBtn").addEventListener("click", function () {
    form.reset();
    form.hidden = false;
    success.hidden = true;
    renderCheckoutSummary();
  });
  ```

---

### BUG-12: Modal & Drawer thiếu bẫy tiêu điểm và không đóng bằng phím `Escape`
* **File:** `js/app.js` (Dòng 753, 781–815)
* **Mức độ:** 🟡 **Medium**
* **Nguyên nhân:**
  Phím `Escape` chỉ được xử lý cho việc ẩn gợi ý tìm kiếm (`hideSearchSuggestions`). Người dùng mở xem chi tiết sản phẩm, bảng hướng dẫn size, giỏ hàng hoặc danh sách yêu thích khi bấm `Esc` đều không đóng được. Ngoài ra, khi modal mở, chuột vẫn cuộn được nội dung trang phía sau (`scroll bleed`).
* **Phương án khắc phục:**
  1. Thêm sự kiện lắng nghe phím `Escape` chung cho các hộp thoại đang mở:
     ```javascript
     document.addEventListener("keydown", function (e) {
       if (e.key === "Escape") {
         closeProductModal();
         closeBox("sizeOverlay", "sizeModal");
         closeBox("cartOverlay", "cartDrawer");
         closeBox("wishlistOverlay", "wishlistDrawer");
         hideSearchSuggestions();
       }
     });
     ```
  2. Bổ sung `document.body.classList.toggle("no-scroll", isOpen)` trong hàm `openBox()` và `closeBox()`.

---

### CODE-13: Lỗi hiệu năng `innerHTML +=` trong vòng lặp Render
* **File:** `js/app.js` (Dòng 129–150)
* **Mức độ:** 🔵 **Low / Performance**
* **Nguyên nhân:**
  ```javascript
  list.forEach(function (product) {
    // ...
    grid.innerHTML += cardHtml; // <--- DOM anti-pattern
  });
  ```
  Câu lệnh `grid.innerHTML += cardHtml` nối chuỗi và gán lại cho DOM ở mỗi vòng lặp. Nếu danh sách có 12 sản phẩm, trình duyệt phải xóa, phân tích cú pháp HTML và khởi tạo lại cây DOM 12 lần liên tiếp, gây hiện tượng giật/lag (layout thrashing).
* **Phương án khắc phục:**
  Tích lũy chuỗi và gán 1 lần:
  ```javascript
  let allCardsHtml = "";
  list.forEach(function (product) {
    // ...
    allCardsHtml += cardHtml;
  });
  grid.innerHTML = allCardsHtml;
  ```

---

### CODE-14: Đường dẫn ảnh chứa khoảng trắng chưa được encode
* **File:** `js/products.js` (Dòng 29, 41, 53, 65, 77, 89, 101, 113, 125, 137, 149)
* **Mức độ:** 🔵 **Low / Asset Standard**
* **Nguyên nhân:**
  Các ảnh từ sản phẩm ID 2 đến ID 12 chứa dấu cách trực tiếp: `"img/id 2.jpg"`, `"img/id 10.1.jpg"`. Dù một số trình duyệt tự sửa thành `%20`, đây là vi phạm quy chuẩn đặt tên tài nguyên tĩnh trên môi trường Linux, có thể dẫn đến lỗi 404 khi build hoặc triển khai lên CDN/server khác.
* **Phương án khắc phục:**
  Đổi tên tệp thực tế thành không dấu cách (ví dụ `id-2.jpg`, `id-10.1.jpg` hoặc `id2.jpg`) và cập nhật lại mảng trong `products.js`.

---

### CODE-15: Ô nhiễm phạm vi toàn cục và phân mảnh mã nguồn
* **File:** Toàn bộ các file `.js`
* **Mức độ:** 🔵 **Low / Code Architecture**
* **Nguyên nhân:**
  * Toàn bộ biến như `products`, `cart`, `wishlist`, `appliedVoucher`, `voucherList` được khai báo trực tiếp ở phạm vi toàn cục (`window`), không được đóng gói trong IIFE hoặc ES Modules (`type="module"`).
  * Danh sách voucher bị định nghĩa ở 2 nơi với cấu trúc khác nhau (`voucherList` trong `app.js` vs `vouchers` trong `checkout.js`), nhãn hiển thị không khớp nhau (`"Giảm 10% tổng đơn"` vs `"Giảm 10%"`).
  * Hàm `formatPrice()` và `resolveProductImagePath()` bị viết lặp lại ở cả 2 tệp `app.js` và `checkout.js`.
* **Phương án khắc phục:**
  * Tách một file tiện ích chung (ví dụ `js/utils.js`) để chứa các hàm dùng chung: `formatPrice`, `escapeHtml`, `safeGetJson`, danh sách voucher chuẩn.
  * Đóng gói mã nguồn trong hàm tự gọi (IIFE) hoặc chuyển sang ES Modules (`import/export`).

---
*Báo cáo được lập tự động dựa trên phân tích mã nguồn thực tế của dự án.*

