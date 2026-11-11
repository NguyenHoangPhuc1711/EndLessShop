# PHÁT BIỂU BÀI TOÁN NHÓM 5

**Đề tài:** Xây dựng Website thời trang online

## 1. Bối cảnh và Thực trạng (Lý do chọn đề tài)
- **Bối cảnh:** Cùng với sự phát triển mạnh mẽ của thương mại điện tử và Internet, xu hướng mua sắm trực tuyến ngày càng phổ biến. Khách hàng ngày nay có nhu cầu tìm kiếm, so sánh mẫu mã, giá cả và đặt mua các sản phẩm thời trang (quần áo, giày dép, phụ kiện) mọi lúc, mọi nơi một cách tiện lợi, nhanh chóng.
- **Hạn chế hiện tại:** Các cửa hàng thời trang truyền thống khó mở rộng tệp khách hàng ra ngoài phạm vi địa lý, trong khi chi phí mặt bằng ngày càng cao. Việc quản lý bán hàng, tồn kho và đơn hàng thủ công hoặc bằng sổ sách cũng dễ sai sót, khó kiểm soát và tốn nhiều nhân lực, thời gian.
- **Nhu cầu cấp thiết:** Cần xây dựng một hệ thống phần mềm website bán lẻ thời trang tích hợp, hỗ trợ tự động hóa các khâu từ giới thiệu sản phẩm, đặt hàng, xử lý giao dịch đến thống kê, quản lý nội bộ.

## 2. Phát biểu bài toán (Problem Statement)
> "Xây dựng một website thương mại điện tử chuyên ngành thời trang nhằm cung cấp nền tảng mua sắm trực tuyến thuận tiện cho khách hàng, đồng thời số hóa và tự động hóa quy trình quản lý bán hàng, tồn kho, đơn hàng và doanh thu cho cửa hàng."

## 3. Đối tượng và Phạm vi đề tài
- **Đối tượng nghiên cứu:** Quy trình nghiệp vụ bán hàng thời trang trực tuyến (giới thiệu mẫu mã/kích thước/màu sắc, chọn hàng, đặt hàng, thanh toán, xử lý và vận chuyển đơn hàng, quản lý phản hồi và thống kê kết quả kinh doanh).
- **Đối tượng sử dụng hệ thống:**
  - **Khách hàng (Customer):** Người dùng có nhu cầu tìm kiếm, xem thông tin chi tiết và mua sắm sản phẩm trực tuyến.
  - **Nhân viên (Staff):** Người phụ trách tiếp nhận đơn, xác nhận thông tin, chuẩn bị hàng và cập nhật tiến trình giao nhận.
  - **Quản trị viên (Admin):** Người quản lý tổng thể hệ thống (danh mục, sản phẩm, kho, khách hàng, chương trình khuyến mãi và báo cáo doanh thu).
- **Phạm vi bài toán:** Hệ thống web bán lẻ áp dụng cho mô hình một thương hiệu/cửa hàng thời trang, hoạt động trên môi trường mạng và tương thích với các trình duyệt phổ biến.

## 4. Mục tiêu của đề tài
- Xây dựng website hoàn chỉnh theo kiến trúc chuẩn (ví dụ: mô hình MVC hoặc phân lớp rõ ràng).
- Tối ưu hóa trải nghiệm người dùng trong việc tìm kiếm, phân loại và đặt mua sản phẩm thời trang.
- Tự động hóa các thao tác xử lý đơn hàng và hỗ trợ ban quản trị ra quyết định kinh doanh qua số liệu thống kê trực quan.
- Đảm bảo kiểm thử đầy đủ các chức năng và đáp ứng các tiêu chuẩn kỹ thuật về hiệu năng, bảo mật và tính khả dụng.

## 5. Yêu cầu hệ thống

### a. Yêu cầu chức năng (Functional Requirements)
- **Phân hệ Khách hàng:**
  - **Quản lý tài khoản:** Đăng ký, đăng nhập, quên mật khẩu, cập nhật thông tin cá nhân.
  - **Khám phá sản phẩm:** Tìm kiếm, lọc theo thuộc tính đặc thù của thời trang (kích thước, màu sắc, chất liệu, mức giá, danh mục), xem chi tiết sản phẩm.
  - **Giỏ hàng & Đặt hàng:** Thêm/sửa/xóa sản phẩm trong giỏ, chọn thuộc tính (size, color), nhập thông tin nhận hàng và chọn phương thức thanh toán.
  - **Quản lý đơn mua:** Theo dõi tiến độ xử lý đơn hàng, xem lịch sử mua sắm.
  - **Đánh giá & Phản hồi:** Đánh giá sao, để lại nhận xét và phản hồi về sản phẩm đã mua.
- **Phân hệ Nhân viên & Quản trị:**
  - **Quản lý sản phẩm & danh mục:** Thêm, sửa, xóa, phân loại sản phẩm; quản lý biến thể (kích cỡ, màu sắc, số lượng tồn kho tương ứng).
  - **Quản lý đơn hàng:** Tiếp nhận, xác nhận duyệt đơn, cập nhật trạng thái (đang xử lý, đang giao, đã giao, hủy đơn).
  - **Quản lý người dùng:** Danh sách khách hàng, phân quyền nhân viên/quản trị.
  - **Quản lý khuyến mãi:** Tạo mã giảm giá, voucher, chương trình ưu đãi có thời hạn.
  - **Thống kê & Báo cáo:** Biểu đồ doanh thu theo ngày/tháng/năm, danh sách sản phẩm bán chạy, sản phẩm tồn kho lâu.

### b. Yêu cầu phi chức năng (Non-Functional Requirements)
- **Giao diện (UI/UX):** Thiết kế Responsive Web Design (tương thích trên cả máy tính để bàn, máy tính bảng và điện thoại di động), hình ảnh rõ nét, bố cục trực quan.
- **Hiệu năng (Performance):** Tốc độ phản hồi trang nhanh, tối ưu hóa kích thước hình ảnh sản phẩm, chịu tải tốt khi có nhiều người dùng truy cập đồng thời.
- **Bảo mật (Security):** Mã hóa mật khẩu người dùng, bảo vệ dữ liệu thanh toán, phòng chống các lỗ hổng phổ biến như SQL Injection và XSS.
- **Khả năng bảo trì & Mở rộng (Maintainability & Scalability):** Mã nguồn phân tách rõ ràng, dễ bảo trì và sẵn sàng mở rộng các tính năng tương lai (cổng thanh toán online, chatbot tư vấn tự động, đề xuất sản phẩm dựa trên hành vi).

## 6. Kết quả dự kiến
- Một trang web thương mại điện tử thời trang hoạt động ổn định, đáp ứng đầy đủ các quy trình nghiệp vụ đã đề ra.
- Bộ tài liệu phân tích thiết kế hệ thống, sơ đồ ca sử dụng (Use Case), cơ sở dữ liệu và kịch bản kiểm thử (Test Case).
