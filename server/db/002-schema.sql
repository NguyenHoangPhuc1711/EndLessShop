-- Adapted from Sprint 1/web_thoi_trang.sql. No original sample accounts/data.
-- This file runs inside a transaction. GO separates compilation batches.
IF OBJECT_ID(N'dbo.DANH_MUC', N'U') IS NULL
CREATE TABLE dbo.DANH_MUC (
    danh_muc_id INT IDENTITY(1,1) PRIMARY KEY,
    ten_danh_muc NVARCHAR(100) NOT NULL UNIQUE
);
IF OBJECT_ID(N'dbo.TAI_KHOAN', N'U') IS NULL
CREATE TABLE dbo.TAI_KHOAN (
    tai_khoan_id INT IDENTITY(1,1) PRIMARY KEY,
    ten_dang_nhap VARCHAR(50) NOT NULL UNIQUE,
    mat_khau VARCHAR(255) NOT NULL, -- reserved for password hashes, never plaintext
    ho_ten NVARCHAR(100) NOT NULL,
    sdt VARCHAR(15),
    email VARCHAR(100) NOT NULL UNIQUE,
    vai_tro VARCHAR(20) NOT NULL DEFAULT 'khach_hang',
    CONSTRAINT CK_TAI_KHOAN_ROLE CHECK (vai_tro IN ('khach_hang','nhan_vien','admin'))
);
IF OBJECT_ID(N'dbo.VOUCHER', N'U') IS NULL
CREATE TABLE dbo.VOUCHER (
    voucher_id INT IDENTITY(1,1) PRIMARY KEY,
    ma_code VARCHAR(30) NOT NULL UNIQUE,
    loai_giam VARCHAR(10) NOT NULL,
    gia_tri INT NOT NULL,
    han_su_dung DATETIME,
    CONSTRAINT CK_VOUCHER_VALUE CHECK (
      (loai_giam = 'percent' AND gia_tri BETWEEN 1 AND 100) OR
      (loai_giam = 'fixed' AND gia_tri > 0))
);
IF OBJECT_ID(N'dbo.SAN_PHAM', N'U') IS NULL
CREATE TABLE dbo.SAN_PHAM (
    san_pham_id INT IDENTITY(1,1) PRIMARY KEY,
    ten_sp NVARCHAR(150) NOT NULL,
    mo_ta NVARCHAR(MAX),
    gia INT NOT NULL CHECK (gia >= 0),
    ton_kho INT NOT NULL DEFAULT 0 CHECK (ton_kho >= 0),
    danh_muc_id INT NOT NULL REFERENCES dbo.DANH_MUC(danh_muc_id)
);
IF OBJECT_ID(N'dbo.HOA_DON', N'U') IS NULL
CREATE TABLE dbo.HOA_DON (
    hoa_don_id INT IDENTITY(1,1) PRIMARY KEY,
    khach_hang_id INT NOT NULL REFERENCES dbo.TAI_KHOAN(tai_khoan_id),
    nhan_vien_id INT REFERENCES dbo.TAI_KHOAN(tai_khoan_id),
    voucher_id INT REFERENCES dbo.VOUCHER(voucher_id),
    ngay_dat DATETIME NOT NULL DEFAULT GETDATE(),
    trang_thai VARCHAR(20) NOT NULL DEFAULT 'cho_xu_ly',
    tong_tien INT NOT NULL DEFAULT 0 CHECK (tong_tien >= 0)
);
IF OBJECT_ID(N'dbo.CHI_TIET_HOA_DON', N'U') IS NULL
CREATE TABLE dbo.CHI_TIET_HOA_DON (
    chi_tiet_id INT IDENTITY(1,1) PRIMARY KEY,
    hoa_don_id INT NOT NULL REFERENCES dbo.HOA_DON(hoa_don_id),
    san_pham_id INT NOT NULL REFERENCES dbo.SAN_PHAM(san_pham_id),
    size VARCHAR(10) NOT NULL,
    mau NVARCHAR(30) NOT NULL,
    so_luong INT NOT NULL DEFAULT 1 CHECK (so_luong > 0),
    don_gia INT NOT NULL CHECK (don_gia >= 0),
    UNIQUE (hoa_don_id, san_pham_id, size, mau)
);
GO
-- Keep the original six tables. Add only frontend metadata and COD delivery fields.
IF COL_LENGTH('dbo.DANH_MUC', 'ma_danh_muc') IS NULL
    ALTER TABLE dbo.DANH_MUC ADD ma_danh_muc VARCHAR(20) NULL;
IF COL_LENGTH('dbo.TAI_KHOAN', 'dia_chi') IS NULL
    ALTER TABLE dbo.TAI_KHOAN ADD dia_chi NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.SAN_PHAM', 'sizes_json') IS NULL
    ALTER TABLE dbo.SAN_PHAM ADD sizes_json NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.SAN_PHAM', 'colors_json') IS NULL
    ALTER TABLE dbo.SAN_PHAM ADD colors_json NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.SAN_PHAM', 'images_json') IS NULL
    ALTER TABLE dbo.SAN_PHAM ADD images_json NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.SAN_PHAM', 'color_image_indices_json') IS NULL
    ALTER TABLE dbo.SAN_PHAM ADD color_image_indices_json NVARCHAR(MAX) NULL;
IF COL_LENGTH('dbo.SAN_PHAM', 'la_moi') IS NULL
    ALTER TABLE dbo.SAN_PHAM ADD la_moi BIT NULL;
IF COL_LENGTH('dbo.HOA_DON', 'ten_nguoi_nhan') IS NULL
    ALTER TABLE dbo.HOA_DON ADD ten_nguoi_nhan NVARCHAR(100) NULL;
IF COL_LENGTH('dbo.HOA_DON', 'sdt_nguoi_nhan') IS NULL
    ALTER TABLE dbo.HOA_DON ADD sdt_nguoi_nhan VARCHAR(15) NULL;
IF COL_LENGTH('dbo.HOA_DON', 'dia_chi') IS NULL
    ALTER TABLE dbo.HOA_DON ADD dia_chi NVARCHAR(500) NULL;
IF COL_LENGTH('dbo.HOA_DON', 'ghi_chu') IS NULL
    ALTER TABLE dbo.HOA_DON ADD ghi_chu NVARCHAR(1000) NULL;
IF COL_LENGTH('dbo.HOA_DON', 'phuong_thuc_thanh_toan') IS NULL
    ALTER TABLE dbo.HOA_DON ADD phuong_thuc_thanh_toan VARCHAR(20) NOT NULL
      CONSTRAINT DF_HOA_DON_PAYMENT DEFAULT 'cod';
IF COL_LENGTH('dbo.HOA_DON', 'tam_tinh') IS NULL
    ALTER TABLE dbo.HOA_DON ADD tam_tinh INT NULL;
IF COL_LENGTH('dbo.HOA_DON', 'tien_giam') IS NULL
    ALTER TABLE dbo.HOA_DON ADD tien_giam INT NOT NULL CONSTRAINT DF_HOA_DON_DISCOUNT DEFAULT 0;
GO
-- Original SQL used VARCHAR for Vietnamese colors; widening preserves existing values.
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.CHI_TIET_HOA_DON')
           AND name = 'mau' AND system_type_id = TYPE_ID('varchar'))
    ALTER TABLE dbo.CHI_TIET_HOA_DON ALTER COLUMN mau NVARCHAR(30) NOT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.DANH_MUC') AND name='UX_DANH_MUC_CODE')
    CREATE UNIQUE INDEX UX_DANH_MUC_CODE ON dbo.DANH_MUC(ma_danh_muc) WHERE ma_danh_muc IS NOT NULL;
