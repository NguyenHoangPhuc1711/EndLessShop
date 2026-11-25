-- Additive migration for staff/role management, dynamic categories, and Winter Black Friday bundles/items.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.TAI_KHOAN', 'chuc_vu') IS NULL
    ALTER TABLE dbo.TAI_KHOAN ADD chuc_vu NVARCHAR(80) NULL;

IF COL_LENGTH('dbo.TAI_KHOAN', 'trang_thai') IS NULL
    ALTER TABLE dbo.TAI_KHOAN ADD trang_thai VARCHAR(20) NOT NULL
        CONSTRAINT DF_TAI_KHOAN_STATUS DEFAULT 'active'
        CONSTRAINT CK_TAI_KHOAN_STATUS CHECK (trang_thai IN ('active', 'locked'));

IF COL_LENGTH('dbo.TAI_KHOAN', 'ngay_tao') IS NULL
    ALTER TABLE dbo.TAI_KHOAN ADD ngay_tao DATETIME2 NOT NULL
        CONSTRAINT DF_TAI_KHOAN_CREATED DEFAULT SYSUTCDATETIME();

IF COL_LENGTH('dbo.DANH_MUC', 'mo_ta') IS NULL
    ALTER TABLE dbo.DANH_MUC ADD mo_ta NVARCHAR(300) NULL;

IF COL_LENGTH('dbo.DANH_MUC', 'thu_tu') IS NULL
    ALTER TABLE dbo.DANH_MUC ADD thu_tu INT NOT NULL
        CONSTRAINT DF_DANH_MUC_ORDER DEFAULT 0;

IF COL_LENGTH('dbo.DANH_MUC', 'hien_thi') IS NULL
    ALTER TABLE dbo.DANH_MUC ADD hien_thi BIT NOT NULL
        CONSTRAINT DF_DANH_MUC_VISIBLE DEFAULT 1;

IF COL_LENGTH('dbo.SAN_PHAM', 'gia_goc') IS NULL
    ALTER TABLE dbo.SAN_PHAM ADD gia_goc INT NULL;

IF COL_LENGTH('dbo.SAN_PHAM', 'bundle_items_json') IS NULL
    ALTER TABLE dbo.SAN_PHAM ADD bundle_items_json NVARCHAR(MAX) NULL;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.auth_create_customer
    @username VARCHAR(50), @password_hash VARCHAR(255),
    @full_name NVARCHAR(100), @email VARCHAR(100), @phone VARCHAR(15) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @password_hash NOT LIKE '$argon2id$%'
        THROW 51010, 'A password hash is required.', 1;
    INSERT dbo.TAI_KHOAN(ten_dang_nhap,mat_khau,ho_ten,email,sdt,vai_tro,trang_thai)
    OUTPUT inserted.tai_khoan_id AS id, inserted.ten_dang_nhap AS username,
           inserted.ho_ten AS fullName, inserted.email, inserted.sdt AS phone,
           inserted.vai_tro AS role, inserted.trang_thai AS status, inserted.chuc_vu AS position
    VALUES(@username,@password_hash,@full_name,@email,@phone,'khach_hang','active');
END;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.auth_find_account @username VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT tai_khoan_id AS id, ten_dang_nhap AS username, mat_khau AS passwordHash,
           ho_ten AS fullName, email, sdt AS phone, vai_tro AS role, dia_chi AS address,
           ISNULL(trang_thai, 'active') AS status, chuc_vu AS position
    FROM dbo.TAI_KHOAN WHERE ten_dang_nhap = @username;
END;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.auth_profile @id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT tai_khoan_id AS id, ten_dang_nhap AS username, ho_ten AS fullName,
           email, sdt AS phone, vai_tro AS role, dia_chi AS address,
           ISNULL(trang_thai, 'active') AS status, chuc_vu AS position
    FROM dbo.TAI_KHOAN WHERE tai_khoan_id = @id;
END;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.auth_update_shipping_info
    @user_id INT,
    @full_name NVARCHAR(100) = NULL,
    @phone VARCHAR(15) = NULL,
    @address NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.TAI_KHOAN WHERE tai_khoan_id = @user_id)
        THROW 51011, 'Account not found.', 1;

    UPDATE dbo.TAI_KHOAN
    SET dia_chi = @address,
        ho_ten = COALESCE(NULLIF(LTRIM(RTRIM(@full_name)), N''), ho_ten),
        sdt = COALESCE(NULLIF(LTRIM(RTRIM(@phone)), ''), sdt)
    WHERE tai_khoan_id = @user_id;

    SELECT tai_khoan_id AS id, ten_dang_nhap AS username, ho_ten AS fullName,
           email, sdt AS phone, vai_tro AS role, dia_chi AS address,
           ISNULL(trang_thai, 'active') AS status, chuc_vu AS position
    FROM dbo.TAI_KHOAN
    WHERE tai_khoan_id = @user_id;
END;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.admin_update_stock
    @id INT,
    @stock INT
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.SAN_PHAM SET ton_kho = @stock WHERE san_pham_id = @id;
    SELECT @@ROWCOUNT;
END;
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.admin_update_order_status
    @id INT,
    @status NVARCHAR(50),
    @staff_id INT = NULL
WITH EXECUTE AS OWNER
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @current_status VARCHAR(20);
    BEGIN TRY
        BEGIN TRANSACTION;
        SELECT @current_status = trang_thai
        FROM dbo.HOA_DON WITH (UPDLOCK, HOLDLOCK)
        WHERE hoa_don_id = @id;

        IF @current_status IS NULL
        BEGIN
            ROLLBACK TRANSACTION;
            SELECT 0;
            RETURN;
        END

        IF @current_status IN ('da_huy', 'hoan_thanh') AND @status <> @current_status
            THROW 51044, N'Đơn hàng ở trạng thái kết thúc không thể chuyển trạng thái.', 1;

        IF @status = 'da_huy' AND @current_status <> 'da_huy'
        BEGIN
            DECLARE @restore TABLE (id INT PRIMARY KEY, qty INT NOT NULL);
            INSERT INTO @restore (id, qty)
            SELECT san_pham_id, SUM(so_luong)
            FROM dbo.CHI_TIET_HOA_DON
            WHERE hoa_don_id = @id
            GROUP BY san_pham_id;

            UPDATE p
            SET ton_kho = p.ton_kho + r.qty
            FROM dbo.SAN_PHAM p
            JOIN @restore r ON r.id = p.san_pham_id;
        END

        UPDATE dbo.HOA_DON
        SET trang_thai = @status,
            nhan_vien_id = COALESCE(@staff_id, nhan_vien_id)
        WHERE hoa_don_id = @id;

        DECLARE @rows INT = @@ROWCOUNT;
        COMMIT TRANSACTION;
        SELECT @rows;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
