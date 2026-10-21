# Endless Shop

Website cửa hàng thời trang Endless, được xây dựng bằng HTML, CSS và JavaScript thuần. Giao diện tiếng Việt, bố cục thích ứng với thiết bị di động và máy tính.

## Tính năng

- Duyệt 12 sản phẩm thuộc các danh mục áo, quần, váy và phụ kiện.
- Tìm kiếm theo tên, loại, màu sắc và kích cỡ; lọc theo danh mục, kích cỡ, màu sắc và khoảng giá.
- Sắp xếp sản phẩm theo giá, xem chi tiết, chọn biến thể và xem gợi ý phối đồ.
- Lưu sản phẩm yêu thích và giỏ hàng trong trình duyệt.
- Áp dụng mã `ENDLESS10` (giảm 10%) hoặc `FREESHIP` (giảm 30.000đ).
- Điền thông tin giao hàng, chọn COD hoặc chuyển khoản và xem lịch sử đơn hàng.

## Chạy dự án

Dự án không cần cài thư viện hay bước build. Mở `index.html` trong trình duyệt để bắt đầu.

Để chạy qua máy chủ tĩnh cục bộ, có thể dùng Python:

```bash
python -m http.server 8000
```

Sau đó mở [http://localhost:8000](http://localhost:8000). Trang thanh toán nằm tại `checkout.html` và cũng có thể mở trực tiếp.

## Cấu trúc thư mục

```text
.
├── index.html          # Trang cửa hàng và danh sách sản phẩm
├── checkout.html       # Trang thanh toán và lịch sử giao dịch
├── css/
│   ├── style.css       # Giao diện cửa hàng dùng chung
│   └── checkout.css    # Giao diện thanh toán
├── js/
│   ├── products.js     # Dữ liệu sản phẩm, gợi ý phối đồ và bảng size
│   ├── navigation.js   # Điều khiển menu điều hướng
│   ├── app.js          # Tìm kiếm, bộ lọc, giỏ hàng và yêu thích
│   └── checkout.js     # Mã ưu đãi, đặt hàng và lịch sử đơn hàng
└── img/                # Logo, ảnh banner và ảnh sản phẩm
```

## Lưu trữ và giới hạn

Giỏ hàng, sản phẩm yêu thích, mã ưu đãi và lịch sử đơn hàng được lưu bằng `localStorage` trên trình duyệt hiện tại. Dữ liệu không đồng bộ giữa thiết bị hoặc trình duyệt và có thể mất khi xóa dữ liệu trang web. Quy trình đặt hàng chỉ mô phỏng ở phía giao diện; dự án chưa kết nối máy chủ, cơ sở dữ liệu, cổng thanh toán hay dịch vụ vận chuyển. Tùy chọn chuyển khoản chỉ ghi nhận phương thức trên đơn, không thực hiện giao dịch ngân hàng.

## Công nghệ

- HTML5
- CSS3
- JavaScript thuần
- Google Fonts: Be Vietnam Pro và Playfair Display
