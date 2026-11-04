# Endless — Cửa hàng thời trang

Website bán quần áo trực tuyến giao diện tiếng Việt, được xây dựng bằng HTML, CSS và JavaScript thuần, có API Node.js và cơ sở dữ liệu Microsoft SQL Server.

## Chức năng

- Hiển thị danh sách sản phẩm, hình ảnh, giá và màu sắc.
- Tìm kiếm, lọc theo danh mục, kích cỡ, màu sắc và khoảng giá; sắp xếp sản phẩm theo giá.
- Xem thông tin chi tiết, hình ảnh sản phẩm và gợi ý phối đồ.
- Quản lý giỏ hàng và danh sách yêu thích.
- Đặt hàng và lưu sản phẩm/đơn hàng trên SQL Server.
- Giỏ hàng, yêu thích và lịch sử giao dịch trên trình duyệt được lưu trong `localStorage`.

## Chạy bằng Docker

1. Cài Docker Desktop hoặc Docker Engine với Docker Compose.
2. Tạo file `.env` từ mẫu và đặt mật khẩu SQL Server mạnh:

   ```bash
   cp .env.example .env
   ```

3. Khởi động ứng dụng và SQL Server:

   ```bash
   docker compose up --build
   ```

   Lần đầu chạy, ứng dụng tạo database `EndlessShop`, các bảng và dữ liệu 12 sản phẩm mẫu.

4. Mở [http://localhost:3000](http://localhost:3000). SQL Server được ánh xạ cổng `1433`.

Để dừng ứng dụng, chạy `docker compose down`. Dữ liệu SQL được giữ trong volume `mssql_data`. Chỉ xóa volume khi chủ động muốn xóa toàn bộ dữ liệu:

```bash
docker compose down -v
```

## API

- `GET /api/health` — kiểm tra kết nối database.
- `GET /api/products` — đọc sản phẩm, hình ảnh, kích cỡ, màu sắc và gợi ý phối đồ từ SQL Server.
- `POST /api/orders` — xác thực sản phẩm/biến thể và tính lại giá, mã giảm giá ở máy chủ trước khi lưu đơn hàng.

Thông tin giao hàng và các dòng hàng được lưu cùng đơn trong SQL Server. API không cung cấp danh sách đơn công khai; lịch sử hiển thị trên trình duyệt hiện tại vẫn nằm trong `localStorage`.

## Chạy Node.js trực tiếp

Cài Node.js 22 trở lên, cài dependencies bằng `npm install`, đặt các biến `MSSQL_SERVER`, `MSSQL_PORT`, `MSSQL_USER`, `MSSQL_PASSWORD` và `MSSQL_DATABASE`, sau đó chạy `npm start`. Khi dùng Docker Compose, các biến kết nối đã được cấu hình sẵn.

## Cấu trúc dự án

```text
.
├── index.html          # Trang cửa hàng
├── checkout.html       # Thanh toán và lịch sử giao dịch
├── css/
│   ├── style.css       # Giao diện cửa hàng
│   └── checkout.css    # Giao diện thanh toán
├── js/
│   ├── app.js          # Tìm kiếm, lọc, giỏ hàng và tương tác cửa hàng
│   ├── checkout.js     # Đặt hàng và lịch sử giao dịch
│   ├── navigation.js   # Điều hướng và menu sản phẩm
│   └── products.js     # Dữ liệu sản phẩm
├── database/
│   └── schema.sql      # Schema và dữ liệu sản phẩm mẫu
├── server.js           # API Express và kết nối MSSQL
├── docker-compose.yml  # Ứng dụng và SQL Server
└── img/                # Logo, banner và hình ảnh sản phẩm
```

## Lưu ý

- Không dùng Live Server hoặc `python -m http.server` để đặt hàng; hãy mở trang qua API tại cổng 3000 để dữ liệu được ghi vào database.
- Mật khẩu trong `.env` chỉ dành cho phát triển cục bộ; không dùng tài khoản `sa` hoặc cấu hình chứng chỉ phát triển khi triển khai thật.
- Font chữ được tải từ Google Fonts nên cần kết nối Internet để hiển thị đúng kiểu chữ.
