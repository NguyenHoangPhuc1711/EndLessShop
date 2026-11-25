-- Additive migration: customer feedback. Existing data is preserved.
IF OBJECT_ID(N'dbo.PHAN_HOI', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.PHAN_HOI (
        phan_hoi_id INT IDENTITY(1,1) CONSTRAINT PK_PHAN_HOI PRIMARY KEY,
        tai_khoan_id INT NOT NULL CONSTRAINT FK_PHAN_HOI_TAI_KHOAN REFERENCES dbo.TAI_KHOAN(tai_khoan_id),
        so_sao TINYINT NOT NULL CONSTRAINT CK_PHAN_HOI_SO_SAO CHECK (so_sao BETWEEN 1 AND 5),
        noi_dung NVARCHAR(1000) NOT NULL,
        trang_thai VARCHAR(20) NOT NULL CONSTRAINT DF_PHAN_HOI_TRANG_THAI DEFAULT 'moi'
            CONSTRAINT CK_PHAN_HOI_TRANG_THAI CHECK (trang_thai IN ('moi','da_xu_ly')),
        nhan_vien_id INT NULL,
        ngay_tao DATETIME2 NOT NULL CONSTRAINT DF_PHAN_HOI_NGAY_TAO DEFAULT SYSDATETIME()
    );
END;
GO
