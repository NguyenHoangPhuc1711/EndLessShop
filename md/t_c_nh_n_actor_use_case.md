# Thiết kế hệ thống: Tác nhân (Actor) và Use Case

Phần `vai_tro` trong bảng `TAI_KHOAN` (mục 3) đã phân biệt sẵn 3 loại tài khoản: `khach_hang`, `nhan_vien`, `admin`. Ngoài 3 loại tài khoản đó, trang web còn phục vụ người dùng chưa đăng nhập (chỉ xem và tìm sản phẩm). Vì vậy nhóm xác định hệ thống có 4 tác nhân (actor) tương tác, mỗi tác nhân gắn với một tập chức năng (use case) riêng, có tác nhân kế thừa quyền của tác nhân khác:

## Danh sách tác nhân:
1. **Khách (Guest):** người vào web nhưng chưa đăng nhập — chỉ xem được, chưa thao tác được đơn hàng.
2. **Khách hàng (Customer):** tài khoản `vai_tro = khach_hang`, kế thừa toàn bộ quyền của Khách, cộng thêm quyền mua hàng.
3. **Nhân viên (Staff):** tài khoản `vai_tro = nhan_vien`, phụ trách xử lý đơn hàng phía sau.
4. **Admin (Quản trị viên):** tài khoản `vai_tro = admin`, kế thừa quyền của Nhân viên, cộng thêm quyền quản trị toàn hệ thống (sản phẩm, danh mục, voucher, tài khoản).

## Use case theo từng tác nhân:

### a) Khách (Guest = khách hàng chưa đăng nhập tài khoản)
1. **UC-K01:** Xem danh mục và danh sách sản phẩm.
2. **UC-K02:** Tìm kiếm sản phẩm theo tên, lọc theo danh mục/giá.
3. **UC-K03:** Đăng ký tài khoản mới hoặc đăng nhập.

### b) Khách hàng (Customer = khách hàng đăng nhập tài khoản) — kế thừa Khách
1. **UC-KH01:** Thêm sản phẩm vào giỏ hàng, chọn size và màu.
2. **UC-KH02:** Nhập mã voucher để được giảm giá khi đặt hàng.
3. **UC-KH03:** Đặt hàng / thanh toán đơn hàng trong giỏ.
4. **UC-KH04:** Theo dõi trạng thái các đơn đã đặt ("Đơn hàng của tôi").
5. **UC-KH05:** Hủy đơn hàng khi đơn còn ở trạng thái chờ xử lý, chưa giao.

### c) Nhân viên (Staff)
1. **UC-NV01:** Xem danh sách đơn hàng đang chờ xử lý.
2. **UC-NV02:** Cập nhật trạng thái đơn hàng (đang giao, hoàn thành, đã hủy).
3. **UC-NV03:** Tra cứu đơn hàng theo khách hàng.

### d) Admin (Quản trị viên) — kế thừa Nhân viên
1. **UC-AD01:** Quản lý danh mục sản phẩm (thêm/sửa/xóa).
2. **UC-AD02:** Quản lý sản phẩm và số lượng tồn kho.
3. **UC-AD03:** Quản lý voucher giảm giá (tạo mã, loại giảm, hạn dùng).
4. **UC-AD04:** Quản lý tài khoản nhân viên.
5. **UC-AD05:** Xem báo cáo doanh thu theo thời gian.

## Sơ đồ tổng hợp


