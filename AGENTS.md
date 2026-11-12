# HƯỚNG DẪN DÀNH CHO AI AGENT & ĐẶC TẢ DỰ ÁN (AGENTS.MD)

> **Tài liệu hướng dẫn phát triển, kiến trúc kỹ thuật và quy chuẩn vận hành cho các AI Agent và Kỹ sư phần mềm làm việc trên kho mã nguồn EndLess Shop.**  
> *Ngày cập nhật:* 2026-11-12  
> *Phiên bản hệ thống:* 2.0 (ASP.NET Core 10 + MS SQL Server 2022 + Scandinavian Warm Minimal)

---

## 1. TỔNG QUAN & MỤC TIÊU DỰ ÁN (PROJECT OVERVIEW)

### 1.1. Mục tiêu cốt lõi
**EndLess Shop** là nền tảng thương mại điện tử chuyên ngành thời trang tối giản theo mô hình D2C (Direct-to-Consumer) và B2C. Dự án được xây dựng nhằm giải quyết hai bài toán lớn:
1. **Trải nghiệm mua sắm của Khách hàng (Storefront):**
   - Khám phá danh mục thời trang với phong cách Bắc Âu (**Scandinavian Warm Minimal**), giao diện sạch, tải nhanh, tối ưu Core Web Vitals.
   - Chọn biến thể sản phẩm trực quan (kích cỡ S/M/L/XL, màu sắc tự động cập nhật ảnh mẫu, bảng tra cứu size chi tiết).
   - Giỏ hàng trượt (Mini-Cart Drawer), tự động tính mã giảm giá Voucher (`ENDLESS10`, `FREESHIP`), đặt hàng nhận tiền mặt (COD - Cash on Delivery) không cần thanh toán trước.
   - Đăng ký, đăng nhập bảo mật, tự khôi phục mật khẩu khi quên.
   - Trợ lý ảo AI Chatbot (Endless Assistant) giải đáp tức thì 24/7 về size, vận chuyển COD, mã khuyến mãi và đơn mua.
2. **Hệ thống Quản trị Vận hành Toàn diện (Admin Portal):**
   - Cổng đăng nhập độc lập (`admin-login.html`) được bảo vệ nghiêm ngặt bằng Argon2id và kiểm soát truy cập theo vai trò (RBAC).
   - Bảng số liệu điều hành KPI thời gian thực (doanh thu hôm nay, hàng đợi COD, tổng tồn kho, voucher kích hoạt).
   - Quản lý vòng đời đơn hàng COD (*Chờ xử lý* $\rightarrow$ *Đang giao* $\rightarrow$ *Đã thu COD* / *Đã hủy*), xem chi tiết hóa đơn thu hộ và in phiếu giao hàng (`window.print()`).
   - Quản lý danh mục sản phẩm & tồn kho trực tiếp từ CSDL MS SQL Server, hỗ trợ thêm mới, sửa số lượng tồn kho nhanh và xóa sản phẩm an toàn.
   - Quản lý chương trình khuyến mãi (Voucher) và hỗ trợ khôi phục mật khẩu cho khách hàng.

---

## 2. NGĂN XẾP CÔNG NGHỆ (TECH STACK)

| Tầng hệ thống | Công nghệ / Thư viện | Ghi chú & Phiên bản |
|:---|:---|:---|
| **Frontend Storefront** | HTML5 Semantic, CSS3, Vanilla JavaScript (ES6+) | Không phụ thuộc framework cồng kềnh, tải trang tức thì, chuẩn responsive |
| **Thiết kế Giao diện** | Scandinavian Warm Minimal Palette | `#FAF9F5` (Alabaster), `#FFFFFF` (Surface), `#141413` (Main Text), `#2C3527` (Olive), `#C07B57` (Terracotta) |
| **Backend API** | C# 13, ASP.NET Core 10 Web API | Controller-based architecture, Dependency Injection, Middleware pipeline |
| **Data Access** | Dapper ORM | Viết truy vấn T-SQL tối ưu hiệu năng cao, thực thi Stored Procedures |
| **Cơ sở dữ liệu** | Microsoft SQL Server 2022 (Docker container `sql1`) | Mô hình quan hệ chuẩn hóa 3NF, ràng buộc toàn vẹn dữ liệu, ACID Transactions |
| **Mật mã & Bảo mật** | `Isopoh.Cryptography.Argon2` (Argon2id) | Băm mật khẩu chuẩn RFC 9106, chống tấn công brute-force & GPU cracking |
| **Bảo vệ Phiên & CSRF** | ASP.NET Core Distributed Memory Cache, Anti-CSRF Token | Cookie `endless.sid` (HttpOnly, SameSite=Lax), token 64-hex so sánh cố định thời gian |
| **Kiểm soát Tần suất** | ASP.NET Core RateLimiter | Giới hạn 60 yêu cầu / 15 phút trên mỗi IP cho các luồng xác thực |
| **Bộ kiểm thử (Tests)** | .NET xUnit, Playwright MCP | 37 Backend unit/integration tests + 12 Kịch bản E2E kiểm thử toàn hệ thống |
| **Đóng gói & DevOps** | Docker, Docker Compose, Cloudflare Tunnel | Container hóa dịch vụ, cấu hình tunnel an toàn không cần mở port public |

---

## 3. CẤU TRÚC THƯ MỤC DỰ ÁN (PROJECT DIRECTORY STRUCTURE)

```text
web-ban-quan-ao/
├── AGENTS.md                    # [Tệp này] Cẩm nang quy chuẩn cho AI Agent & Lập trình viên
├── README.md                    # Tài liệu giới thiệu tổng quan dự án
├── index.html                   # Trang chủ mua sắm (Storefront)
├── checkout.html                # Trang thanh toán COD & tra cứu lịch sử đơn hàng
├── login.html                   # Đăng nhập tài khoản khách hàng (+ Modal quên mật khẩu)
├── register.html                # Đăng ký tài khoản khách hàng mới
├── account.html                 # Trang chuyển hướng tài khoản
├── admin.html                   # Bảng điều khiển quản trị (Admin Dashboard 5 tabs)
├── admin-login.html             # Cổng đăng nhập dành riêng cho Quản trị viên
├── css/                         # Bảng mã CSS cho giao diện gốc
│   ├── style.css                # CSS giao diện chính (Scandinavian Minimal)
│   ├── account.css              # CSS form đăng nhập, đăng ký, quên mật khẩu
│   ├── checkout.css             # CSS trang thanh toán COD
│   └── chatbot.css              # CSS widget trợ lý ảo khách hàng
├── js/                          # Bộ mã JavaScript cho giao diện gốc
│   ├── app.js                   # Logic render catalog, giỏ hàng, bộ lọc sản phẩm
│   ├── catalog.js               # Nạp & kiểm định sản phẩm từ API, phòng thủ dữ liệu
│   ├── account.js               # Xử lý xác thực, đăng nhập/đăng ký/quên MK khách hàng
│   ├── checkout.js              # Báo giá voucher, đặt hàng COD với Idempotency
│   ├── chatbot.js               # Logic trợ lý ảo hỗ trợ chọn size, tư vấn chính sách
│   ├── navigation.js            # Điều khiển mega-menu điều hướng
│   ├── products.js              # Dữ liệu bảng hướng dẫn size & gợi ý phối đồ
│   └── config.js                # Cấu hình dynamic API Base URL
├── img/                         # Tài nguyên hình ảnh sản phẩm chuẩn & banner
├── web-ban-quan-ao/             # Thư mục web con (ĐỒNG BỘ 1:1 VỚI THƯ MỤC GỐC)
│   ├── index.html, admin.html, admin-login.html, checkout.html...
│   ├── css/                     # style.css, account.css, checkout.css, chatbot.css
│   └── js/                      # app.js, catalog.js, account.js, chatbot.js...
├── backend-aspnet/              # Mã nguồn Backend ASP.NET Core 10
│   ├── Controllers/             # API Endpoints
│   │   ├── AdminController.cs   # Quản lý đơn COD, duyệt giao, voucher, thêm sản phẩm, reset MK
│   │   ├── AuthController.cs    # Đăng nhập, đăng ký, phiên làm việc, CSRF, quên mật khẩu
│   │   ├── ChatController.cs    # Xử lý hội thoại trợ lý ảo, gợi ý câu hỏi
│   │   ├── HealthController.cs  # Healthcheck endpoint (/api/health)
│   │   ├── OrdersController.cs  # Báo giá voucher, tạo đơn COD, lịch sử đơn khách hàng
│   │   └── ProductsController.cs# Danh mục sản phẩm & chi tiết sản phẩm thời gian thực
│   ├── Data/
│   │   └── DbConnectionFactory.cs # Quản lý kết nối SqlConnection tới MS SQL Server
│   ├── Models/                  # DTOs & Request/Response Models
│   ├── Services/
│   │   ├── PasswordService.cs   # Mã hóa & kiểm tra mật khẩu bằng Argon2id
│   │   └── SecurityValidator.cs # Kiểm tra Anti-CSRF token & White-list Origin
│   ├── Program.cs               # Cấu hình WebApplication, CORS, RateLimit, StaticFiles, Session
│   ├── EndLessShop.Api.csproj   # File cấu hình project .NET 10
│   └── appsettings.json         # Chuỗi kết nối CSDL và cấu hình CORS
├── backend-aspnet.Tests/        # Bộ kiểm thử tự động xUnit
│   ├── ChatControllerTests.cs
│   ├── HealthControllerTests.cs
│   ├── OrderModelTests.cs
│   ├── PasswordServiceTests.cs
│   ├── SecurityValidatorTests.cs
│   └── VoucherModelTests.cs
├── server/                      # Công cụ & kịch bản CSDL
│   ├── db/                      # T-SQL scripts (001-database, 002-schema, 003-auth, 004-orders)
│   └── scripts/
│       ├── init-db.js           # Khởi tạo CSDL, phân quyền runtime & nạp seed
│       └── test-e2e-features.js # Kịch bản kiểm thử tích hợp 12 luồng nghiệp vụ
├── md/                          # Tài liệu kỹ thuật dự án của Nhóm 5
│   ├── thiet_ke_ky_thuat.md     # Đặc tả kỹ thuật chi tiết
│   ├── chu_n_h_a_d_li_u_3nf.md  # Chứng minh chuẩn hóa dữ liệu 3NF
│   ├── th_c_th_v_s_erd.md       # Sơ đồ thực thể quan hệ ERD
│   ├── ph_t_bi_u_b_i_to_n.md     # Phát biểu bài toán ban đầu
│   └── t_c_nh_n_actor_use_case.md # Phân tích tác nhân Actor & Use Case
├── compose.yaml                 # Docker Compose cho môi trường Production / Cloudflare Tunnel
├── Dockerfile                   # Dockerfile build image ASP.NET Core
└── .gitignore                   # Cấu hình bỏ qua tệp build, tệp tạm thời
```

---

## 4. QUY ƯỚC & NGUYÊN TẮC PHÁT TRIỂN (CODING CONVENTIONS)

Khi thực hiện bất kỳ sửa đổi, bổ sung tính năng hay vá lỗi trong dự án, **AI Agent và lập trình viên BẮT BUỘC tuân thủ các quy tắc sau:**

### 4.1. Quy tắc Đồng bộ File Frontend (BẮT BUỘC)
- Dự án tồn tại hai thư mục giao diện song song: thư mục gốc `./` và thư mục con `web-ban-quan-ao/`.
- **Mọi chỉnh sửa** trên các file HTML/JS/CSS (`admin.html`, `index.html`, `checkout.html`, `js/*.js`, `css/*.css`) tại một bên **PHẢI ĐƯỢC SAO CHÉP ĐỒNG BỘ NGAY LẬP TỨC** sang bên còn lại bằng lệnh copy:
  ```bash
  cp -v web-ban-quan-ao/admin.html ./admin.html
  cp -v web-ban-quan-ao/js/catalog.js ./js/catalog.js
  ```
- Không bao giờ để xảy ra tình trạng code tại `web-ban-quan-ao/` và `./` bị lệch nhau.

### 4.2. Quy ước Backend ASP.NET Core & C#
1. **Kiến trúc Controller & DI:**
   - Đặt controller trong `backend-aspnet/Controllers/`, kế thừa `ControllerBase`, đánh dấu attribute `[ApiController]` và `[Route("api/[controller]")]`.
   - Kết nối cơ sở dữ liệu luôn thông qua interface `IDbConnectionFactory`.
2. **An toàn Truy vấn Dữ liệu (Dapper ORM):**
   - **Tuyệt đối không cộng chuỗi SQL (SQL Concatenation).** Mọi tham số phải truyền qua object anonymous của Dapper (ví dụ: `new { id, status }`) để chống triệt để SQL Injection.
   - Ưu tiên gọi Stored Procedure cho các tác vụ cập nhật trạng thái phức tạp hoặc trừ tồn kho giao dịch (`dbo.admin_update_order_status`, `dbo.admin_update_stock`, `dbo.order_checkout`).
3. **Phân quyền & Kiểm soát truy cập (RBAC):**
   - Mọi API trong `AdminController` phải gọi `CheckAdminAccessAsync()` để đảm bảo người gọi có vai trò `admin`. Người dùng có vai trò `khach_hang` hoặc chưa đăng nhập lập tức bị từ chối `403 Forbidden` hoặc `401 Unauthorized`.
4. **Bảo vệ Anti-CSRF trên các endpoint thay đổi dữ liệu:**
   - Mọi phương thức `POST`, `PUT`, `DELETE` (ngoại trừ đăng nhập công khai) **phải xác thực CSRF Token** qua `SecurityValidator.ValidateCsrfAndOrigin(HttpContext)`.
   - Token hợp lệ phải là chuỗi 64 ký tự hex được so sánh an toàn bằng `CryptographicOperations.FixedTimeEquals`.
5. **Mã hóa mật khẩu:**
   - Mọi thao tác tạo tài khoản, đổi mật khẩu hoặc khôi phục mật khẩu **phải thông qua `IPasswordService` (Argon2id)**. Không bao giờ lưu trữ plain text hay dùng MD5/SHA.
6. **Xử lý Exception & Chuẩn hóa Response:**
   - Không để lộ chi tiết cấu trúc bảng hay chuỗi kết nối ra ngoài thông báo lỗi.
   - Luôn trả về phản hồi định dạng JSON nhất quán: `{ message = "...", code = "..." }`.

### 4.3. Quy ước Cơ sở dữ liệu (MS SQL Server 2022)
1. **Cấu trúc bảng và định dạng:**
   - Tên bảng viết hoa danh từ: `dbo.SAN_PHAM`, `dbo.DANH_MUC`, `dbo.HOA_DON`, `dbo.CHI_TIET_HOA_DON`, `dbo.TAI_KHOAN`, `dbo.VOUCHER`, `dbo.AUTH_SESSION`.
   - Các trường danh sách lưu dưới dạng chuỗi JSON: `sizes_json`, `colors_json`, `images_json`, `color_image_indices_json`.
2. **Quy tắc JSON Biến thể màu sắc & Ảnh (QUAN TRỌNG):**
   - Trường `color_image_indices_json` trong `dbo.SAN_PHAM` **bắt buộc phải có ánh xạ chỉ số ảnh** cho mọi màu sắc trong `colors_json` (ví dụ: `{"Đen": 0, "Trắng": 1}`).
   - Khi tạo sản phẩm mới, Backend phải tự động tính toán chỉ số ảnh an toàn `(i % images.Count)` thay vì để rỗng `{}`.
3. **Phân quyền người dùng runtime tối thiểu (Principle of Least Privilege):**
   - Backend chỉ kết nối bằng tài khoản `endless_runtime`.
   - Tài khoản này chỉ được cấp các quyền `SELECT`, `INSERT`, `UPDATE`, `DELETE` trên bảng được phép và `EXECUTE` trên các Stored Procedure được chỉ định. Tuyệt đối không dùng tài khoản `sa` trong ứng dụng runtime.

### 4.4. Quy ước Frontend JavaScript & CSS
1. **Phòng thủ dữ liệu Client-side:**
   - Không tin cậy tuyệt đối cấu trúc dữ liệu từ server. Luôn kiểm tra mảng rỗng, fallback giá trị mặc định cho chỉ số ảnh, phân loại và giá tiền để giao diện không bị gián đoạn.
2. **Giao tiếp API:**
   - Dùng helper `EndlessConfig.apiUrl('endpoint')` để tự động tương thích môi trường local lẫn reverse proxy.
   - Đính kèm `credentials: EndlessConfig.credentials` trên mọi request fetch để trình duyệt gửi kèm session cookie `endless.sid`.
   - Với request `POST`, `PUT`, `DELETE`, lấy token qua hàm `getAdminCsrfToken()` hoặc `EndlessAccount.getCsrfToken()` và gửi trong header `X-CSRF-Token`.
3. **Bảo mật XSS:**
   - Mọi chuỗi dữ liệu người dùng nhập hoặc lấy từ API khi ghép vào HTML động đều phải đi qua hàm `escapeHtml(str)` trước khi gán vào `innerHTML`.

---

## 5. CÁC LỆNH CHẠY CHÍNH (KEY COMMANDS & WORKFLOWS)

### 5.1. Khởi động Cơ sở dữ liệu MS SQL Server
Container Docker chứa MS SQL Server 2022 mang tên `sql1`.
```bash
# Kiểm tra trạng thái container SQL
docker ps -a --filter "name=sql1"

# Khởi động container
docker start sql1

# Khởi tạo schema 3NF và nạp seed dữ liệu mẫu (khi cần)
node server/scripts/init-db.js
```

### 5.2. Quản lý & Khởi chạy Backend ASP.NET Core
Backend lắng nghe đồng thời trên hai cổng `http://127.0.0.1:3000` (cổng chính phục vụ cả API và static frontend) và `http://127.0.0.1:5100`.

```bash
# Di chuyển vào thư mục backend
cd /home/komi/web-ban-quan-ao/backend-aspnet

# Biên dịch mã nguồn Backend
dotnet build EndLessShop.Api.csproj

# Chạy Backend trực tiếp
dotnet run --urls "http://127.0.0.1:3000;http://127.0.0.1:5100"

# Publish bản release tối ưu cho production
dotnet publish EndLessShop.Api.csproj -c Release -o publish
```

### 5.3. Kiểm thử Tự động (Testing Suites)

#### A. Kiểm thử Backend Unit & Integration Tests (xUnit)
Bộ kiểm thử gồm 37 bài test tự động bao quát toàn bộ logic mã hóa Argon2id, Anti-CSRF, tính toán giá trị Voucher, Idempotency-Key và Chatbot.
```bash
dotnet test backend-aspnet.Tests/backend-aspnet.Tests.csproj
```
*(Kết quả yêu cầu: **37/37 Tests PASS**, 0 Failed).*

#### B. Kiểm thử Tích hợp Toàn diện 12 Luồng Nghiệp vụ (E2E Integration Test)
Kịch bản tự động hóa Node.js kiểm tra tuần tự từ Healthcheck, Catalog, Đăng ký, Đăng nhập, Báo giá Voucher, Đặt hàng COD, Lịch sử khách, Phân quyền RBAC, Admin Metrics, Tạo Voucher mới đến Quản lý trạng thái COD và điều chỉnh tồn kho.
```bash
node server/scripts/test-e2e-features.js
```
*(Kết quả yêu cầu: **12/12 Scenarios PASS 100%**).*

#### C. Kiểm tra Nhanh Endpoint Sức Khỏe (Healthcheck)
```bash
curl -s http://127.0.0.1:3000/api/health
# Phản hồi mong đợi: {"status":"ok"}
```

---

## 6. DANH SÁCH API ENDPOINTS CHÍNH (API DIRECTORY)

### 6.1. Phân hệ Khách hàng & Công khai
- `GET /api/health`: Healthcheck hệ thống.
- `GET /api/products`: Danh sách toàn bộ sản phẩm đang bán.
- `GET /api/products/{id}`: Chi tiết sản phẩm theo ID.
- `POST /api/auth/register`: Đăng ký tài khoản khách hàng mới.
- `POST /api/auth/login`: Đăng nhập, thiết lập session cookie `endless.sid`.
- `POST /api/auth/logout`: Đăng xuất, hủy bỏ phiên làm việc.
- `GET /api/auth/me`: Lấy thông tin định danh của người dùng đang đăng nhập.
- `GET /api/auth/csrf`: Lấy token Anti-CSRF hiện hành.
- `POST /api/auth/forgot-password`: Khôi phục mật khẩu khách hàng bằng số điện thoại.
- `POST /api/orders/quote`: Báo giá đơn hàng, tính tiền giảm giá theo voucher.
- `POST /api/orders`: Đặt hàng COD (kèm header `Idempotency-Key` và `X-CSRF-Token`).
- `GET /api/orders`: Tra cứu lịch sử đơn hàng của tài khoản đang đăng nhập.
- `GET /api/orders/{id}`: Tra cứu chi tiết đơn hàng cụ thể.
- `POST /api/chat`: Gửi câu hỏi cho Trợ lý ảo AI Chatbot.
- `GET /api/chat/suggestions`: Lấy danh sách câu hỏi gợi ý nhanh cho khách hàng.

### 6.2. Phân hệ Quản trị Viên (Yêu cầu Session `admin`)
- `GET /api/admin/metrics`: Lấy các chỉ số KPI vận hành thời gian thực.
- `GET /api/admin/orders`: Danh sách tất cả đơn hàng COD kèm thông tin người nhận và số lượng món.
- `GET /api/admin/orders/{id}`: Chi tiết toàn bộ hóa đơn COD và danh sách sản phẩm.
- `PUT /api/admin/orders/{id}/status`: Cập nhật trạng thái đơn (*cho_xu_ly, dang_giao, hoan_thanh, da_huy*).
- `POST /api/admin/products`: Thêm sản phẩm mới vào CSDL MS SQL.
- `DELETE /api/admin/products/{id}`: Xóa sản phẩm an toàn (ngăn chặn nếu đã có đơn hàng).
- `PUT /api/admin/products/{id}/stock`: Điều chỉnh nhanh số lượng tồn kho sản phẩm.
- `GET /api/admin/vouchers`: Danh sách mã giảm giá.
- `POST /api/admin/vouchers`: Tạo mã voucher mới (phần trăm hoặc tiền cố định).
- `DELETE /api/admin/vouchers/{id}`: Xóa mã voucher.
- `GET /api/admin/customers`: Danh sách tài khoản người dùng và vai trò hệ thống.
- `POST /api/admin/customers/{id}/reset-password`: Quản trị viên cấp lại mật khẩu cho khách hàng.

---

## 7. THÔNG TIN MÔI TRƯỜNG & TÀI KHOẢN MẪU (TEST ACCOUNTS)

| Tài khoản | Mật khẩu | Vai trò | Mục đích sử dụng |
|:---|:---|:---|:---|
| `longadmin` | `Yourst0ngp@@word` | `admin` | Đăng nhập cổng quản trị [`/admin-login.html`](./admin-login.html) |
| `admin_ui` | `AdminUiPass12345!` | `admin` | Tài khoản quản trị dự phòng cho automated test |
| `testcustomer` | *(Theo CSDL)* | `khach_hang` | Tài khoản khách hàng mẫu kiểm thử luồng mua hàng |
| `komi` | *(Theo CSDL)* | `khach_hang` | Tài khoản khách hàng kiểm thử thực tế |

- **Địa chỉ truy cập Storefront:** `http://127.0.0.1:3000/index.html`
- **Địa chỉ truy cập Admin Portal:** `http://127.0.0.1:3000/admin-login.html`
- **Chuỗi kết nối CSDL nội bộ:** `Server=127.0.0.1,1433;Database=web_thoi_trang;User Id=endless_runtime;Password=LocalDevOnly!ChangeInEnv12345;TrustServerCertificate=True;Encrypt=True;`

---

## 8. LƯU Ý BẢO MẬT & VẬN HÀNH DÀNH CHO AI AGENT

> [!IMPORTANT]
> 1. **Không sửa đổi `sa` password:** Container SQL Server đang quản lý dữ liệu thực; không chạy lệnh reset mật khẩu `sa` tùy tiện.
> 2. **Kiểm tra tính toàn vẹn sau khi sửa đổi:** Bất cứ khi nào cập nhật code Backend hoặc Frontend, luôn chạy `dotnet test backend-aspnet.Tests/backend-aspnet.Tests.csproj` và `node server/scripts/test-e2e-features.js` để đảm bảo hệ thống không phát sinh lỗi hồi quy (regression).
> 3. **Bảo tồn tính toàn vẹn của giỏ hàng:** Khi cập nhật sản phẩm trong `ProductsController`, luôn đảm bảo `ColorImageIndices` không bị rỗng để tránh làm sập bộ kiểm định `validateProducts` trên Client.
> 4. **Giữ nguyên các file markdown báo cáo trong `md/`:** Thư mục `md/` chứa báo cáo đồ án chính thức của Nhóm 5 (3NF, ERD, Use Case, Khảo sát Coolmate/Canifa); không được tự ý xóa các file này.
