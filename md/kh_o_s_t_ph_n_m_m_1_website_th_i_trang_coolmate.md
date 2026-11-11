# BÁO CÁO KHẢO SÁT HỆ THỐNG: WEBSITE THỜI TRANG COOLMATE

**Dự án tham chiếu:** Xây dựng Website thời trang online

## 1. Giới thiệu tổng quan hệ thống
- **Tên hệ thống:** Website thương mại điện tử thời trang Coolmate
- **Đơn vị chủ quản:** Công ty TNHH Fastech Asia (Thương hiệu Coolmate)
- **Địa chỉ truy cập:** [https://www.coolmate.me](https://www.coolmate.me)
- **Mô hình hoạt động:** D2C (Direct-to-Consumer) E-commerce — Sản xuất và phân phối trực tiếp từ nhà máy đến tay người tiêu dùng qua nền tảng trực tuyến, loại bỏ chi phí trung gian của các cửa hàng vật lý truyền thống.
- **Đối tượng khách hàng mục tiêu:** Nam giới trẻ, nhân viên văn phòng, học sinh - sinh viên và những người yêu thích phong cách thời trang cơ bản (basic), năng động, thể thao.

## 2. Khảo sát giao diện và Trải nghiệm người dùng (UI/UX)
- **Phong cách thiết kế:** Hiện đại, tối giản, sử dụng tông màu chủ đạo trắng - đen - xanh navy. Bố cục trực quan, làm nổi bật hình ảnh sản phẩm.



- **Thanh điều hướng (Header):**
  - Phân cấp rõ ràng: Sản phẩm mới, Bán chạy, Nam giới, Thể thao, Đồ lót & Phụ kiện, Coolclub (Hội viên), Blog chăm sóc phong cách.
  - Tích hợp thanh tìm kiếm thông minh tự động gợi ý từ khóa xu hướng và danh sách sản phẩm nổi bật ngay khi người dùng bấm vào.



- **Trải nghiệm trên thiết bị di động (Responsive Web Design):**
  - Tối ưu hóa sâu cho màn hình smartphone: Menu dạng trượt (Drawer Menu), bộ lọc dạng Bottom Sheet tiện lợi cho thao tác ngón tay cái.
  - Nút "Thêm vào giỏ" và "Mua ngay" được cố định (sticky action bar) ở mép dưới màn hình khi cuộn trang chi tiết sản phẩm.
- **Tốc độ và hiệu năng:** Tối ưu hóa tài nguyên rất tốt, hình ảnh sử dụng định dạng WebP nén dung lượng cao nhưng giữ độ nét, trang tải mượt mà dưới 2 giây.

## 3. Khảo sát các chức năng nghiệp vụ chính

### a. Phân hệ Khách hàng (Front-End)
- **Quản lý tài khoản & Khách hàng thân thiết:**
  - Đăng ký, đăng nhập nhanh chóng bằng số điện thoại (xác thực mã OTP) hoặc tài khoản mạng xã hội (Google, Facebook).
  - Chương trình hội viên Coolclub: Tự động tích lũy hoàn tiền (Coolcash), theo dõi cấp bậc thành viên (Cool Fan, Cool Pro, Cool VIP) với các đặc quyền giảm giá riêng và quà sinh nhật.
- **Tìm kiếm và Lọc sản phẩm:**
  - Bộ lọc đa tiêu chí: Lọc theo kích thước (Size S, M, L, XL, 2XL, 3XL), màu sắc, mức giá, kiểu dáng, chất liệu (Cotton Compact, Excool công nghệ làm mát, Modal mềm mại).
  - Sắp xếp linh hoạt: Theo độ phổ biến, mới nhất, giá tăng/giảm dần, điểm đánh giá cao.
- **Trang chi tiết sản phẩm (Product Detail Page):**
  - Bộ sưu tập hình ảnh góc chụp 360 độ, hình chụp cận cảnh chất vải và video người mẫu thực tế.
  - Công cụ gợi ý chọn size: Khách hàng chỉ cần kéo thanh chọn Chiều cao (cm) và Cân nặng (kg), hệ thống sẽ tự động đưa ra khuyến nghị size vừa vặn nhất.
  - Bảng thông số chi tiết chất liệu, công nghệ dệt may, hướng dẫn giặt ủi.
  - Hiển thị trạng thái còn hàng/hết hàng tức thì theo từng cặp thuộc tính (Màu sắc + Kích cỡ).
- **Giỏ hàng & Đặt hàng (Cart & Checkout):**
  - Giỏ hàng nhanh (Mini Cart / Drawer Cart): Người dùng có thể kiểm tra giỏ hàng, cập nhật số lượng, áp mã giảm giá mà không cần tải lại trang.
  - Tính năng Mua theo Combo (Tủ đồ Coolmate): Cho phép người dùng tự phối nhiều món đồ (áo + quần + phụ kiện) để nhận mức chiết khấu combo hấp dẫn.
  - Quy trình thanh toán một trang (One-Step Checkout): Điền địa chỉ nhận hàng, chọn hình thức giao hàng tiêu chuẩn hoặc hỏa tốc, áp dụng voucher khuyến mãi hoặc trừ trực tiếp điểm Coolcash.
- **Phương thức thanh toán:**
  - Thanh toán khi nhận hàng (COD).
  - Chuyển khoản ngân hàng qua mã QR động (VietQR).
  - Thẻ thanh toán nội địa ATM và quốc tế (Visa/Mastercard).
  - Cổng ví điện tử: MoMo, ZaloPay, ShopeePay, VNPAY.
- **Dịch vụ hậu mãi & Chăm sóc khách hàng:**
  - Chính sách đổi trả trong vòng 60 ngày miễn phí tận nhà với bất kỳ lý do gì ("Dịch vụ 100% hài lòng").
  - Tích hợp khung chat trực tuyến kết nối Messenger/Zalo hỗ trợ tức thì.
  - Tra cứu trạng thái đơn hàng trực tiếp bằng số điện thoại đặt hàng.
  - Chức năng đánh giá sao, gửi nhận xét và tải ảnh phản hồi thực tế của khách hàng.

### b. Phân hệ Quản trị & Vận hành (Back-End / Nghiệp vụ)
- **Quản lý sản phẩm:** Quản lý theo cấu trúc phân cấp danh mục, quản lý mã SKU đa biến thể (Size, Color, Kiểu dáng), theo dõi tồn kho realtime.
- **Quản lý đơn hàng:** Tiếp nhận đơn hàng tự động, phân loại trạng thái đơn (Chờ xác nhận, Đang đóng gói, Đang giao, Hoàn tất, Trả hàng), tích hợp API với các đơn vị vận chuyển (Giao Hàng Nhanh, Viettel Post).
- **Quản lý khuyến mãi:** Tạo coupon giảm giá theo %, giảm tiền mặt, mã freeship, mã kích hoạt theo điều kiện giá trị đơn hàng.
- **Báo cáo & Thống kê:** Phân tích doanh số bán hàng, tỷ lệ chuyển đổi, sản phẩm bán chạy nhất (Top Sellers) và tỷ lệ đổi trả hàng.

## 4. Đánh giá Ưu điểm và Hạn chế
- **Ưu điểm nổi bật:**
  - Trải nghiệm người dùng cực kỳ mượt mà, tối giản, giảm thiểu tối đa các bước rườm rà khi đặt hàng.
  - Công cụ gợi ý chọn size trực quan giúp giảm đáng kể rủi ro đổi trả cho mặt hàng thời trang online.
  - Chính sách đổi trả 60 ngày và dịch vụ CSKH xuất sắc tạo dựng niềm tin vững chắc cho người mua.
  - Cơ chế mua theo combo thông minh giúp tăng giá trị trung bình trên mỗi đơn hàng (AOV).
- **Hạn chế:**
  - Tập trung chủ yếu vào dòng thời trang thường ngày (Casual/Basic) cho nam giới, ít các thiết kế thời trang đa dạng theo mùa hoặc thời trang dự tiệc.
  - Hệ thống đánh giá chưa hỗ trợ bộ lọc sâu (như lọc đánh giá theo chiều cao, cân nặng của người mua trước đó).

## 5. Bài học kinh nghiệm và Đề xuất áp dụng cho Đề tài
- **Thiết kế CSDL biến thể sản phẩm:** Thiết kế các bảng dữ liệu `Product`, `Product_Attribute` (Size, Color), `Product_Variant` (kèm SKU, giá, số lượng tồn kho) một cách chuẩn hóa.
- **Module Giỏ hàng Ajax:** Tích hợp giỏ hàng cập nhật trực tiếp không cần reload trang để tăng trải nghiệm mua sắm.
- **Quy trình Checkout đơn giản:** Hỗ trợ khách vãng lai đặt hàng chỉ với thông tin số điện thoại và địa chỉ giao hàng, không ép buộc đăng nhập trước khi mua.
- **Bảng hướng dẫn chọn size:** Bổ sung giao diện hướng dẫn đo vóc dáng và chọn kích cỡ quần áo phù hợp cho người dùng.
v
