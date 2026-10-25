# Endless — Cửa hàng thời trang

Website bán quần áo trực tuyến giao diện tiếng Việt, được xây dựng bằng HTML, CSS và JavaScript thuần. Dự án chạy trực tiếp trên trình duyệt và không cần cài đặt thư viện.

## Chức năng

- Hiển thị danh sách sản phẩm, hình ảnh, giá và màu sắc.
- Tìm kiếm, lọc theo danh mục, kích cỡ, màu sắc và khoảng giá; sắp xếp sản phẩm theo giá.
- Xem thông tin chi tiết, hình ảnh sản phẩm và gợi ý phối đồ.
- Quản lý giỏ hàng và danh sách yêu thích.
- Đặt hàng, áp dụng mã giảm giá và xem lịch sử giao dịch.
- Lưu giỏ hàng, yêu thích và đơn hàng trong `localStorage` của trình duyệt.

## Cách chạy

### Dùng VS Code

Mở thư mục dự án bằng VS Code, sau đó dùng tiện ích Live Server để chạy `index.html`.

### Dùng Python

Mở terminal tại thư mục dự án và chạy:

```bash
python -m http.server 8000
```

Mở [http://localhost:8000](http://localhost:8000) để vào cửa hàng. Trang thanh toán nằm tại [http://localhost:8000/checkout.html](http://localhost:8000/checkout.html).

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
└── img/                # Logo, banner và hình ảnh sản phẩm
```

## Lưu ý

- Đây là bản giao diện tĩnh; dữ liệu giỏ hàng, yêu thích và đơn hàng chỉ được lưu trên trình duyệt hiện tại, chưa kết nối máy chủ hoặc cơ sở dữ liệu.
- Font chữ được tải từ Google Fonts nên cần kết nối Internet để hiển thị đúng kiểu chữ.
