# KHẢO SÁT HỆ THỐNG 2: WEBSITE THỜI TRANG CANIFA

**Dự án tham chiếu:** Xây dựng Website thời trang online

## 1. Giới thiệu tổng quan hệ thống
- **Tên hệ thống:** Website thương mại điện tử thời trang Canifa
- **Đơn vị chủ quản:** Công ty Cổ phần Canifa (Thương hiệu thời trang Canifa)
- **Địa chỉ truy cập:** [https://canifa.com](https://canifa.com)
- **Mô hình hoạt động:** B2C & Omnichannel Retail E-commerce — Kết hợp đồng bộ giữa hệ thống chuỗi cửa hàng thời trang bán lẻ trên toàn quốc với nền tảng bán hàng trực tuyến (Website & Mobile App).
- **Đối tượng cách thiết kế:** Trang nhã, tươi sáng và ấm cúng, sử dụng tông màu nhận diện thương hiệu đỏ - trắng - xám. Hình ảnh người mẫu mang phong cách gia đình, gần gũi.



- **Thanh điều hướng đa tầng (Mega Menu):**
  - Phân loại danh mục cực kỳ chi tiết theo từng đối tượng: Nữ, Nam, Bé gái, Bé trai, Bộ sưu tập mới, Sản phẩm giá tốt (Sale).



  - Khi rê chuột vào từng mục lớn, menu mở rộng hiển thị theo từng nhóm chủng loại (Áo thun, Áo sơ mi, Quần jeans, Váy đầm, Đồ len, Đồ mặc nhà, Đồ lót, Phụ kiện), kèm theo hình ảnh minh họa cho các chiến dịch nổi bật.



- **Bộ sưu tập theo mùa và chất liệu (Special Collections):**
  - Website có khu vực giới thiệu chuyên sâu theo công nghệ và chất liệu: Dòng sản phẩm len lông cừu Úc (Merino Wool), Áo phao lông vũ siêu nhẹ, Cotton Organic, Đồ chống nắng công nghệ Anti-UV.
- **Tính đồng bộ đa kênh (Omnichannel Experience):**
  - Giao diện và dữ liệu khuyến mãi được đồng bộ chặt chẽ với ứng dụng di động Canifa và hệ thống thẻ thành viên tại các cửa hàng vật lý.

## 3. Khảo sát các chức năng nghiệp vụ chính

### a. Phân hệ Khách hàng (Front-End)
- **Bộ lọc và Tìm kiếm đa cấp:**
  - Khả năng lọc sản phẩm theo nhiều tiêu chí kết hợp: Lọc theo Đối tượng, Kích thước (từ sơ sinh 6-12M đến XXL người lớn), Màu sắc, Phom dáng (Regular fit, Slim fit, Loose fit), Mức giá và Dòng chất liệu đặc thù.
  - Chức năng sắp xếp theo giá cả, mức độ giảm giá (% sale) hoặc độ mới của sản phẩm.
- **Trang chi tiết sản phẩm và Tra cứu tồn kho đa kênh:**
  - Cung cấp mã sản phẩm (SKU) rõ ràng, hình ảnh chụp chi tiết từng đường kim mũi chỉ và thông số thành phần vải.
  - Tính năng "Tìm sản phẩm tại cửa hàng gần bạn": Cho phép khách hàng chọn size/màu và chọn Tỉnh/Thành phố để kiểm tra xem cửa hàng Canifa nào gần nhất còn hàng trong kho.
  - Bảng hướng dẫn đo kích thước cơ thể chi tiết kèm hình vẽ minh họa vị trí đo (vòng ngực, vòng eo, vòng mông, chiều dài lưng).
- **Quản lý tài khoản & Chương trình khách hàng thân thiết (C-Point):**
  - Đăng nhập qua số điện thoại; quản lý thông tin gia đình (ngày sinh con cái để nhận quà tặng ưu đãi).
  - Hệ thống tích điểm C-Point: Điểm tích lũy khi mua sắm tại cửa hàng hay trên website đều được cộng chung vào một tài khoản, cho phép đổi điểm trực tiếp thành tiền mặt trừ vào hóa đơn thanh toán.
  - Quản lý sổ địa chỉ giao nhận, danh sách sản phẩm yêu thích (Wishlist).
- **Giỏ hàng và Quy trình đặt hàng:**
  - Hỗ trợ lưu trữ giỏ hàng lâu dài cho thành viên đã đăng nhập.
  - Nhập mã voucher khuyến mãi, mã ưu đãi sinh nhật hoặc áp dụng điểm thưởng C-Point trước khi tính tổng tiền.
  - Phương thức nhận hàng đa dạng: Giao hàng tận nhà hoặc nhận hàng trực tiếp tại cửa hàng Canifa gần nhất (Click & Collect).
- **Phương thức thanh toán tích hợp:**
  - Thanh toán khi nhận hàng (COD).
  - Thẻ quốc tế Visa/Mastercard/JCB.
  - Thẻ ATM nội địa qua cổng thanh toán OnePay / VNPAY-QR.

### b. Phân hệ Quản trị & Vận hành (Back-End / Nghiệp vụ)
- **Quản lý danh mục đa tầng và kho hàng phân tán:**
  - Quản lý hàng nghìn mã SKU phức tạp với nhiều thuộc tính (Giới tính > Nhóm tuổi > Chủng loại > Kích cỡ > Màu sắc > Bộ sưu tập).
  - Đồng bộ tồn kho giữa Kho tổng thương mại điện tử và kho tại hàng trăm chi nhánh cửa hàng trên toàn quốc.
- **Xử lý và điều phối đơn hàng:**
  - Thuật toán định tuyến đơn hàng tự động: Hệ thống có thể chuyển đơn hàng cho chi nhánh cửa hàng gần địa chỉ khách hàng nhất để tối ưu thời gian giao hàng và chi phí vận chuyển.
- **Quản lý chương trình khuyến mãi linh hoạt:**
  - Cài đặt các chương trình khuyến mãi phong phú: Mua 1 tặng 1, Mua 2 giảm thêm 10%, Đồng giá (Flash sale), Tặng quà theo bậc giá trị đơn hàng.
- **Thống kê và Báo cáo:**
  - Báo cáo hiệu quả bán hàng theo từng bộ sưu tập, theo dòng chất liệu, so sánh doanh thu giữa các kênh bán hàng online và offline.

## 4. Đánh giá Ưu điểm và Hạn chế
- **Ưu điểm nổi bật:**
  - Khả năng quản lý danh mục và biến thể sản phẩm quy mô lớn rất khoa học, dễ tìm kiếm.
  - Trải nghiệm đa kênh (Omnichannel) vượt trội: Tra cứu tồn kho tại cửa hàng vật lý và đồng bộ điểm tích lũy C-Point giúp kết nối liền mạch giữa mua online và mua trực tiếp.
  - Phân loại sản phẩm theo chất liệu và bộ sưu tập chuyên sâu, giúp định vị thương hiệu chất lượng cao.
- **Hạn chế:**
  - Do lượng danh mục và sản phẩm rất lớn nên giao diện trên màn hình nhỏ đôi khi có nhiều thông tin, yêu cầu người dùng phải thao tác nhiều lần để lọc chính xác.
  - Quy trình đặt hàng có nhiều bước xác nhận hơn so với các website D2C thuần túy.

## 5. Bài học kinh nghiệm và Đề xuất áp dụng cho Đề tài
- **Thiết kế Mega Menu phân cấp:** Học hỏi cách bố trí menu nhiều cấp (Danh mục cha -> Danh mục con) để website trông chuyên nghiệp và người dùng dễ định hướng.
- **Bộ lọc đa tiêu chí:** Xây dựng câu lệnh truy vấn SQL/ORM động để lọc sản phẩm linh hoạt theo nhiều điều kiện đồng thời (ví dụ: `WHERE category = 'ao' AND size IN ('M','L') AND price BETWEEN 200000 AND 500000`).
- **Cơ chế quản lý khuyến mãi:** Thiết kế bảng `Discount` và `Order_Discount` để hỗ trợ áp dụng mã giảm giá theo tỷ lệ % hoặc số tiền cố định, có điều kiện đơn hàng tối thiểu.
- **Trang thông tin sản phẩm chuyên sâu:** Cung cấp thông tin chi tiết về chất liệu và chính sách giặt ủi để tăng tính thuyết phục khi bán hàng thời trang trực tuyến.

Báo cáo được hoàn thiện bởi: PersonNgày hoàn tất: Date
