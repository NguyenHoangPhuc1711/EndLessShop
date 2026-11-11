## Thực thể:
- **DANH MỤC (DANH_MUC):** Nhóm tách riêng bảng này để phục vụ tính năng lọc sản phẩm theo danh mục (ví dụ Áo, Quần, Váy, Phụ kiện...).
- **TÀI KHOẢN (TAI_KHOAN):** Lưu tài khoản của cả Khách hàng, Nhân viên bán hàng và Quản trị viên, phân biệt qua trường `vai_tro`.
- **SẢN PHẨM (SAN_PHAM):** Lưu thông tin các mặt hàng thời trang do Admin tạo như tên sản phẩm, giá, mô tả, số lượng tồn kho...
- **VOUCHER (VOUCHER):** Bảng này lưu cấu hình các mã giảm giá áp dụng cho đơn hàng (loại giảm theo %, hoặc giảm số tiền cố định, hạn sử dụng).
- **HÓA ĐƠN (HOA_DON):** Lưu đơn hàng khi khách bấm đặt hàng, gồm người đặt, nhân viên xử lý, voucher áp dụng (nếu có), trạng thái và tổng tiền.
- **CHI TIẾT HÓA ĐƠN (CHI_TIET_HOA_DON):** Lưu các dòng sản phẩm cụ thể trong từng hóa đơn (gồm size, màu, số lượng, đơn giá tại thời điểm mua). Bảng có khóa chính riêng `chi_tiet_id` để định danh từng dòng, tách biệt với ràng buộc `UNIQUE` ở mục 1.2.

## Mối quan hệ giữa các bảng (Bản chất nghiệp vụ)
1. **DANH_MUC — SAN_PHAM (1 – n):** Một danh mục có nhiều sản phẩm; mỗi sản phẩm chỉ thuộc về một danh mục cụ thể.
2. **TAI_KHOAN — HOA_DON (Đặt hàng, 1 – n):** Một khách hàng đặt được nhiều hóa đơn khác nhau; mỗi hóa đơn gắn liền với tài khoản người đặt.
3. **TAI_KHOAN — HOA_DON (Xử lý, 1 – n):** Một nhân viên bán hàng có thể xử lý nhiều hóa đơn của nhiều khách hàng khác nhau.
4. **VOUCHER — HOA_DON (Áp dụng, 1 – n):** Một voucher có thể được áp dụng cho nhiều hóa đơn khác nhau; một hóa đơn chỉ dùng được 1 voucher (`voucher_id` có thể `NULL` nếu không dùng mã).
5. **HOA_DON — CHI_TIET_HOA_DON (1 – n):** Một hóa đơn gồm nhiều dòng chi tiết sản phẩm; mỗi dòng chi tiết chỉ thuộc về một hóa đơn.
6. **SAN_PHAM — CHI_TIET_HOA_DON (1 – n):** Một sản phẩm có thể xuất hiện trong nhiều dòng chi tiết của nhiều hóa đơn khác nhau. Mỗi dòng chi tiết có khóa chính riêng (`chi_tiet_id`); ngoài ra, trong cùng một hóa đơn, nhóm đặt thêm ràng buộc `UNIQUE (hoa_don_id, san_pham_id, size, mau)`

## Sơ đồ ERD:


