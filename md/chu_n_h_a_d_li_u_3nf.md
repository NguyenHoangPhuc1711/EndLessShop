# Chuẩn hóa cơ sở dữ liệu 3NF

Nếu gộp chung toàn bộ dữ liệu vào một bảng ghi nhận duy nhất, hệ thống sẽ gặp hiện tượng dư thừa và dễ phát sinh bất thường khi thêm/sửa/xóa dữ liệu (Insert/Update/Delete Anomalies). Vì vậy nhóm thực hiện chuẩn hóa tuần tự qua các mức UNF → 1NF → 2NF → 3NF trước khi lập bảng vật lý.

## Dạng bảng thô ban đầu (UNF)

Giả định ban đầu, mỗi lần khách đặt hàng, hệ thống ghi nhận toàn bộ thông tin khách hàng, đơn hàng, voucher sử dụng và danh sách sản phẩm trong đơn vào chung một bản ghi:

`UNF (MaKH, HoTen, SDT, Email, MaDonHang, NgayDat, TrangThai, MaVoucher, MaCodeVC, GiaTriGiam, DanhSachSanPham)`

Thuộc tính `DanhSachSanPham` không phải là một giá trị đơn — nó là một nhóm lặp, chứa nhiều bộ `(MaSP, TenSP, TenDanhMuc, Size, Mau, SoLuong, DonGia)` tương ứng với từng sản phẩm khách mua trong cùng đơn hàng đó.

## Chuẩn hóa về 1NF:

**Vấn đề gặp phải:**
Một đơn hàng có thể mua nhiều sản phẩm khác nhau, mỗi sản phẩm lại có size/màu/số lượng riêng biệt, nên không thể gộp chung vào một ô dữ liệu — vi phạm điều kiện giá trị nguyên tử của 1NF.

**Xử lý:**
Tách mỗi sản phẩm trong đơn thành một dòng dữ liệu riêng, sao cho mỗi ô chỉ còn giữ đúng một giá trị:

`ORDER_UNF (MaKH, HoTen, SDT, Email, MaDonHang, NgayDat, TrangThai, MaVoucher, MaCodeVC, GiaTriGiam, MaSP, TenSP, TenDanhMuc, Size, Mau, SoLuong, DonGia)`

Ở bước này khóa chính được xác định tạm thời là tổ hợp `(MaDonHang, MaSP, Size, Mau)`, vì phải đủ 4 giá trị đó mới xác định được đúng 1 dòng sản phẩm trong 1 đơn.

⇒ Dữ liệu đã thỏa Dạng chuẩn 1 (1NF).

## Chuẩn hóa về 2NF — loại bỏ phụ thuộc một phần vào khóa

**Phân tích phụ thuộc:**
Với bảng `ORDER_UNF` có khóa chính hỗn hợp `(MaDonHang, MaSP, Size, Mau)`, xét từng nhóm thuộc tính không khóa:
- `HoTen, SDT, Email` chỉ gắn với `MaKH` — không liên quan gì đến `MaSP, Size` hay `Mau` được chọn.
- `NgayDat, TrangThai, MaVoucher, MaCodeVC, GiaTriGiam` chỉ gắn với `MaDonHang` không đổi theo từng sản phẩm trong đơn.
- `TenSP, TenDanhMuc` chỉ gắn với `MaSP` — giống nhau ở mọi đơn hàng có bán sản phẩm đó.
- Riêng `SoLuong` và `DonGia` mới thật sự cần đủ cả 4 giá trị khóa `(MaDonHang, MaSP, Size, Mau)` để xác định.

**Xử lý:**
Những thuộc tính chỉ phụ thuộc vào một phần của khóa được tách ra bảng riêng tương ứng với phần khóa đó:

- `TAI_KHOAN (TaiKhoanID, HoTen, SDT, Email)`
- `SAN_PHAM (SanPhamID, TenSP, TenDanhMuc)`
- `HOA_DON (MaDonHang, TaiKhoanID, NgayDat, TrangThai, MaVoucher, MaCodeVC, GiaTriGiam)`
- `CHI_TIET_HOA_DON (MaDonHang, SanPhamID, Size, Mau, SoLuong, DonGia)`

⇒ Mọi thuộc tính không khóa giờ phụ thuộc đầy đủ vào khóa của bảng chứa nó — dữ liệu đạt Dạng chuẩn 2 (2NF).

## Chuẩn hóa về 3NF loại bỏ phụ thuộc bắc cầu

**Phân tích phụ thuộc bắc cầu:**
Trong bảng `HOA_DON` vừa tách, `MaCodeVC` và `GiaTriGiam` không phụ thuộc trực tiếp vào `MaDonHang` mà đi qua trung gian `MaVoucher`: `MaDonHang → MaVoucher → (MaCodeVC, GiaTriGiam)`. Nếu giữ nguyên như vậy, mỗi lần đổi mức giảm giá của 1 voucher sẽ phải dò sửa lại tất cả các đơn hàng từng dùng mã đó — rất dễ sót và gây sai lệch số liệu.

Tương tự, trong bảng `SAN_PHAM`, thuộc tính `TenDanhMuc` cũng không phụ thuộc trực tiếp vào `SanPhamID` mà qua trung gian `DanhMucID`: `SanPhamID → DanhMucID → TenDanhMuc`. Đổi tên 1 danh mục sẽ phải sửa theo mọi sản phẩm thuộc danh mục đó nếu không tách riêng.

**Xử lý:**
Tách Voucher và Danh mục thành 2 bảng danh mục độc lập, các bảng còn lại chỉ giữ khóa ngoại trỏ tới:

- `VOUCHER (VoucherID, MaCodeVC, LoaiGiam, GiaTriGiam, HanSuDung)`
- `DANH_MUC (DanhMucID, TenDanhMuc)`

Lúc này `HOA_DON` chỉ còn lưu khóa ngoại `VoucherID`, còn `SAN_PHAM` chỉ còn lưu khóa ngoại `DanhMucID` — không còn thuộc tính nào suy ra được từ một thuộc tính không khóa khác.

**Kết luận:** Toàn bộ cơ sở dữ liệu sau khi tách đã đạt Dạng chuẩn 3 (3NF), không còn dư thừa hay phụ thuộc bắc cầu. Kết quả gồm đúng 6 bảng: `DANH_MUC`, `SAN_PHAM`, `TAI_KHOAN`, `VOUCHER`, `HOA_DON`, `CHI_TIET_HOA_DON` — thống nhất với sơ đồ ERD đã trình bày ở mục 1.

## Thiết kế bảng vật lý và script SQL

Dựa trên sơ đồ ERD và kết quả chuẩn hóa 3NF ở mục 2, dưới đây là cấu trúc chi tiết của từng bảng trong cơ sở dữ liệu thực tế.

### 3.1. Cấu trúc chi tiết từng bảng

**Bảng 1: danh_muc (Danh mục sản phẩm)**

| Tên cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
| :--- | :--- | :--- | :--- |
| danh_muc_id | INT | PK, AUTO_INCREMENT | Mã danh mục |
| ten_danh_muc | VARCHAR (100) | NOT NULL, UNIQUE | Tên danh mục (Áo, Quần, Váy, Phụ kiện...) |

**Bảng 2: tai_khoan (Tài khoản người dùng)**

| Tên cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
| :--- | :--- | :--- | :--- |
| tai_khoan_id | INT | PK, AUTO_INCREMENT | Mã tài khoản |
| ten_dang_nhap | VARCHAR (50) | NOT NULL, UNIQUE | Tên đăng nhập |
| mat_khau | VARCHAR (255) | NOT NULL | Mật khẩu đã mã hóa |
| ho_ten | VARCHAR (100) | NOT NULL | Họ và tên |
| sdt | VARCHAR (15) | NULL | Số điện thoại |
| email | VARCHAR (100) | NOT NULL, UNIQUE | Email liên hệ |
| vai_tro | ENUM | NOT NULL, DEFAULT 'khach_hang' | 'Khach_hang', 'nhan_vien', 'admin' |

**Bảng 3: san_pham (Sản phẩm)**

| Tên cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
| :--- | :--- | :--- | :--- |
| san_pham_id | INT | PK, AUTO_INCREMENT | Mã sản phẩm |
| ten_sp | VARCHAR(150) | NOT NULL | Tên sản phẩm |
| mo_ta | TEXT | NULL | Mô tả chi tiết |
| gia | INT | NOT NULL | Giá bán hiện tại |
| ton_kho | INT | NOT NULL, DEFAULT 0 | Số lượng còn trong kho |
| danh_muc_id | INT | FK → danh_muc | Thuộc danh mục nào |

**Bảng 4: voucher (Mã giảm giá)**

| Tên cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
| :--- | :--- | :--- | :--- |
| voucher_id | INT | PK, AUTO_INCREMENT | Mã voucher |
| ma_code | VARCHAR(30) | NOT NULL, UNIQUE | Mã code khách nhập khi đặt hàng |
| loai_giam | ENUM | NOT NULL | 'percent', 'fixed' |
| gia_tri | INT | NOT NULL | Giá trị giảm (% hoặc số tiền) |
| han_su_dung | DATETIME | NULL | Hạn sử dụng mã |

**Bảng 5: hoa_don (Đơn hàng)**

| Tên cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
| :--- | :--- | :--- | :--- |
| hoa_don_id | INT | PK, AUTO_INCREMENT | Mã hóa đơn |
| khach_hang_id | INT | FK → tai_khoan | Khách hàng đặt đơn |
| nhan_vien_id | INT | FK → tai_khoan, NULL | Nhân viên xử lý đơn |
| voucher_id | INT | FK → voucher, NULL | Voucher áp dụng (nếu có) |
| ngay_dat | DATETIME | DEFAULT NOW | Thời điểm đặt hàng |
| trang_thai | ENUM | DEFAULT 'cho_xu_ly' | 'cho_xu_ly','dang_giao','hoan_thanh','da_huy' |
| tong_tien | INT | NOT NULL, DEFAULT 0 | Tổng tiền đơn hàng |

**Bảng 6: chi_tiet_hoa_don (Chi tiết đơn hàng)**

| Tên cột | Kiểu dữ liệu | Ràng buộc | Ý nghĩa |
| :--- | :--- | :--- | :--- |
| chi_tiet_id | INT | PK, AUTO_INCREMENT | Mã dòng chi tiết |
| hoa_don_id | INT | FK → hoa_don | Thuộc hóa đơn nào |
| san_pham_id | INT | FK → san_pham | Sản phẩm nào |
| size | VARCHAR (10) | NOT NULL | Size khách chọn |
| mau | VARCHAR (30) | NOT NULL | Màu khách chọn |
| so_luong | INT | NOT NULL, DEFAULT 1 | Số lượng mua |
| don_gia | INT | NOT NULL | Giá tại thời điểm mua (snapshot) |

### Script SQL khởi tạo cơ sở dữ liệu

```sql
-- Tao database 
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'web_thoi_trang')
    CREATE DATABASE web_thoi_trang;
GO
USE web_thoi_trang;
GO
-- 1. Bang danh muc san pham
CREATE TABLE DANH_MUC (
    danh_muc_id   INT IDENTITY(1,1) PRIMARY KEY,
    ten_danh_muc  NVARCHAR(100) NOT NULL UNIQUE
);
GO
-- 2. Bang tai khoan (dung chung cho khach hang, nhan vien, admin)
CREATE TABLE TAI_KHOAN (
    tai_khoan_id   INT IDENTITY(1,1) PRIMARY KEY,
    ten_dang_nhap  VARCHAR(50) NOT NULL UNIQUE,
    mat_khau       VARCHAR(255) NOT NULL,
    ho_ten         NVARCHAR(100) NOT NULL,
    sdt            VARCHAR(15),
    email          VARCHAR(100) NOT NULL UNIQUE,
    vai_tro        VARCHAR(20) NOT NULL DEFAULT 'khach_hang'
    -- vai_tro chi nhan 1 trong 3 gia tri: khach_hang, nhan_vien, admin
);
GO
-- 3. Bang voucher giam gia
CREATE TABLE VOUCHER (
    voucher_id    INT IDENTITY(1,1) PRIMARY KEY,
    ma_code       VARCHAR(30) NOT NULL UNIQUE,
    loai_giam     VARCHAR(10) NOT NULL,
    -- loai_giam chi nhan: percent (giam %) hoac fixed (giam so tien co dinh)
    gia_tri       INT NOT NULL,
    han_su_dung   DATETIME
);
GO
-- 4. Bang san pham (thuoc 1 danh muc)
CREATE TABLE SAN_PHAM (
    san_pham_id   INT IDENTITY(1,1) PRIMARY KEY,
    ten_sp        NVARCHAR(150) NOT NULL,
    mo_ta         NVARCHAR(MAX),
    gia           INT NOT NULL,
    ton_kho       INT NOT NULL DEFAULT 0,
    danh_muc_id   INT NOT NULL,
    FOREIGN KEY (danh_muc_id) REFERENCES DANH_MUC(danh_muc_id)
);
GO
-- 5. Bang hoa don (don hang)
CREATE TABLE HOA_DON (
    hoa_don_id     INT IDENTITY(1,1) PRIMARY KEY,
    khach_hang_id  INT NOT NULL,
    nhan_vien_id   INT,
    voucher_id     INT,
    ngay_dat       DATETIME NOT NULL DEFAULT GETDATE(),
    trang_thai     VARCHAR(20) NOT NULL DEFAULT 'cho_xu_ly',
    -- trang_thai: cho_xu_ly, dang_giao, hoan_thanh, da_huy
    tong_tien      INT NOT NULL DEFAULT 0,
    FOREIGN KEY (khach_hang_id) REFERENCES TAI_KHOAN(tai_khoan_id),
    FOREIGN KEY (nhan_vien_id) REFERENCES TAI_KHOAN(tai_khoan_id),
    FOREIGN KEY (voucher_id) REFERENCES VOUCHER(voucher_id)
);
GO
-- 6. Bang chi tiet hoa don (tung dong san pham trong 1 don hang)
CREATE TABLE CHI_TIET_HOA_DON (
    chi_tiet_id   INT IDENTITY(1,1) PRIMARY KEY,
    hoa_don_id    INT NOT NULL,
    san_pham_id   INT NOT NULL,
    size          VARCHAR(10) NOT NULL,
    mau           VARCHAR(30) NOT NULL,
    so_luong      INT NOT NULL DEFAULT 1,
    don_gia       INT NOT NULL,
    UNIQUE (hoa_don_id, san_pham_id, size, mau),
    FOREIGN KEY (hoa_don_id) REFERENCES HOA_DON(hoa_don_id),
    FOREIGN KEY (san_pham_id) REFERENCES SAN_PHAM(san_pham_id)
);
GO
```
