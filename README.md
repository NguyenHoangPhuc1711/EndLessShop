# EndLess Shop — Nền Tảng Thương Mại Điện Tử Thời Trang

> **Dự án Website Bán Quần Áo Trực Tuyến (Nhóm 5)**  
> Phong cách thiết kế: **Scandinavian Warm Minimal**  
> Kiến trúc hệ thống: **ASP.NET Core (.NET 10) + MS SQL Server 2022 + Vanilla JavaScript**

---

## 🌟 Tổng Quan Hệ Thống

**EndLess Shop** là giải pháp website thương mại điện tử chuyên ngành thời trang tối giản theo mô hình D2C/B2C, cung cấp trải nghiệm mua sắm mượt mà, phân loại sản phẩm đa chiều, thanh toán COD an toàn và bảng điều khiển quản trị vận hành toàn diện theo thời gian thực.

---

## 🏛️ Kiến Trúc Công Nghệ

| Thành phần | Công nghệ / Thư viện | Vai trò |
|:---|:---|:---|
| **Frontend Storefront** | HTML5, CSS3, Vanilla JS (ES6+) | Giao diện cửa hàng tối giản Bắc Âu, tối ưu Core Web Vitals, Responsive Mobile/Desktop |
| **Backend API** | C# 13, ASP.NET Core 10 Web API | Xử lý nghiệp vụ, xác thực định danh, phân quyền RBAC, kiểm soát giao dịch |
| **Data Access** | Dapper ORM | Truy vấn hiệu năng cao, thực thi Stored Procedures |
| **Cơ sở dữ liệu** | Microsoft SQL Server 2022 | CSDL quan hệ chuẩn 3NF, toàn vẹn dữ liệu, ràng buộc khóa ngoại |
| **Bảo mật** | Isopoh Argon2id, Anti-CSRF, HttpOnly Cookies | Mã hóa mật khẩu chuẩn doanh nghiệp, chống tấn công CSRF & XSS |
| **Trợ lý ảo AI** | Endless Assistant (Chatbot Widget) | Tư vấn chọn size, chính sách giao hàng COD, mã giảm giá tự động |
| **Container & Mạng** | Docker, Docker Compose, Cloudflare Tunnel | Container hóa backend, đóng gói triển khai và bảo mật mạng |

---

## 📱 Phân Hệ Chức Năng

### 1. Phân Hệ Khách Hàng (Storefront)
- **Danh mục sản phẩm thời gian thực:** Đồng bộ trực tiếp từ MS SQL Server qua `GET /api/products`.
- **Bộ lọc & Tìm kiếm:** Lọc theo danh mục (Áo, Quần, Váy, Phụ kiện), kích cỡ (S, M, L, XL), màu sắc và khoảng giá.
- **Chi tiết sản phẩm & Biến thể:** Bảng hướng dẫn chọn size, chọn màu sắc tự động đổi ảnh mẫu, xem gợi ý phối đồ (Outfit).
- **Giỏ hàng trượt (Mini-Cart Drawer):** Thêm nhanh vào giỏ, tăng giảm số lượng, tự động áp dụng mã voucher (`ENDLESS10`, `FREESHIP`).
- **Thanh toán COD & Lịch sử đơn:** Đặt hàng nhận tiền mặt (COD), tra cứu lịch sử mua sắm theo tài khoản.
- **Tài khoản cá nhân:** Đăng ký, đăng nhập bảo mật với Argon2id, tính năng *Quên mật khẩu* tự phục hồi.
- **Trợ lý Chatbot:** Widget chat hỗ trợ khách hàng tức thì ở góc màn hình.

### 2. Phân Hệ Quản Trị Viên (Admin Portal)
- **Cổng đăng nhập riêng biệt:** Đường dẫn bảo vệ [`/admin-login.html`](./admin-login.html), chỉ cho phép tài khoản có vai trò `admin`.
- **Bảng số liệu điều hành (KPI Dashboard):** Thống kê doanh thu hôm nay, số đơn chờ xử lý, tổng tồn kho và số voucher hiệu lực.
- **Quản lý Đơn hàng COD:** Danh sách đơn thời gian thực, lọc theo tiến trình (*Chờ xử lý* $\rightarrow$ *Đang giao* $\rightarrow$ *Đã thu COD* / *Đã hủy*), xem chi tiết phiếu thu hộ và in phiếu giao hàng (`window.print()`).
- **Thêm Sản phẩm & Tồn kho:** Thêm mới sản phẩm trực tiếp vào CSDL MS SQL, phân loại danh mục, điều chỉnh tồn kho tức thì, xóa an toàn (chống xóa nếu đã phát sinh trong đơn hàng).
- **Quản lý Voucher Khuyến Mãi:** Tạo mới voucher theo phần trăm (%) hoặc số tiền cố định (₫), thiết lập hạn dùng hoặc vô thời hạn, xóa voucher hết hạn.
- **Quản lý Khách hàng & Khôi phục mật khẩu:** Xem danh sách khách, phân quyền, hỗ trợ cấp lại mật khẩu cho khách hàng khi quên.

---

## 📂 Cấu Trúc Thư Mục Chuẩn Hóa

```text
web-ban-quan-ao/
├── index.html                   # Trang chủ cửa hàng (Storefront)
├── checkout.html                # Trang thanh toán COD & Lịch sử đơn hàng
├── login.html                   # Đăng nhập tài khoản khách hàng
├── register.html                # Đăng ký tài khoản khách hàng mới
├── admin.html                   # Trung tâm điều hành quản trị (Admin Dashboard)
├── admin-login.html             # Cổng đăng nhập dành riêng cho Quản trị viên
├── css/                         # Bảng mã phong cách giao diện
│   ├── style.css                # Giao diện chính (Scandinavian Warm Minimal)
│   ├── account.css              # Giao diện đăng nhập / đăng ký / tài khoản
│   ├── checkout.css             # Giao diện thanh toán & đơn mua
│   └── chatbot.css              # Giao diện trợ lý ảo chatbot
├── js/                          # Logic xử lý giao diện phía Client
│   ├── app.js                   # Catalog sản phẩm, giỏ hàng, bộ lọc
│   ├── catalog.js               # Kiểm định & nạp sản phẩm từ API
│   ├── account.js               # Xác thực tài khoản khách hàng
│   ├── checkout.js              # Xử lý báo giá, voucher & đặt hàng COD
│   ├── chatbot.js               # Logic trợ lý ảo hỗ trợ khách hàng
│   ├── navigation.js            # Menu điều hướng đa cấp
│   └── config.js                # Cấu hình Base URL API linh hoạt
├── img/                         # Hình ảnh sản phẩm và banner thời trang
├── backend-aspnet/              # Backend C# / ASP.NET Core 10 Web API
│   ├── Controllers/             # AdminController, AuthController, ProductsController, OrdersController...
│   ├── Data/                    # DatabaseContext (kết nối MS SQL Server & Dapper)
│   ├── Models/                  # DTO và Data Models
│   ├── Services/                # Bảo mật Argon2id, Anti-CSRF Validator
│   └── Program.cs               # Cấu hình pipeline, DI, CORS & middleware
├── backend-aspnet.Tests/        # Bộ kiểm thử tự động xUnit (37 unit & integration tests)
├── server/scripts/              # Script khởi tạo CSDL (init-db.js) & kịch bản E2E (test-e2e-features.js)
├── compose.yaml                 # Docker Compose cấu hình Backend & SQL Server
└── Dockerfile                   # Dockerfile đóng gói Production Container
```

---

## 🚀 Hướng Dẫn Khởi Chạy

### 1. Khởi động Cơ sở dữ liệu MS SQL Server
Đảm bảo container `sql1` (MS SQL Server 2022) đang hoạt động trên cổng `1433`:
```bash
docker start sql1
```
*(Nếu là lần đầu tiên, chạy `node server/scripts/init-db.js` để tự động tạo schema 3NF và nạp dữ liệu mẫu).*

### 2. Khởi chạy Backend ASP.NET Core
```bash
cd backend-aspnet
dotnet run --urls "http://127.0.0.1:3000;http://127.0.0.1:5100"
```
Backend sẽ tự động phục vụ đồng thời cả RESTful API và static frontend tại `http://127.0.0.1:3000`.

### 3. Tài khoản thử nghiệm
- **Tài khoản Khách hàng:** `testcustomer` / mật khẩu quản trị đặt theo chuẩn.
- **Tài khoản Quản trị viên (Admin):** `longadmin` / `Yourst0ngp@@word`.

---

## 🧪 Kiểm Thử Hệ Thống

1. **Bộ kiểm thử Backend (.NET xUnit):**
   ```bash
   dotnet test backend-aspnet.Tests/backend-aspnet.Tests.csproj
   ```
   *(Kết quả: 37/37 Tests PASS).*

2. **Kịch bản kiểm thử E2E 12 luồng nghiệp vụ:**
   ```bash
   node server/scripts/test-e2e-features.js
   ```
   *(Kết quả: 12/12 Scenarios PASS 100%).*
