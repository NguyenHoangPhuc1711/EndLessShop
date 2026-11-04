-- Additive auth migration. Existing accounts, products and orders are preserved.
IF OBJECT_ID(N'dbo.AUTH_SESSION', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AUTH_SESSION (
        session_key CHAR(64) NOT NULL PRIMARY KEY, -- SHA-256 of the opaque session ID
        session_data NVARCHAR(MAX) NOT NULL CHECK (ISJSON(session_data) = 1),
        expires_at DATETIME2 NOT NULL
    );
    CREATE INDEX IX_AUTH_SESSION_EXPIRY ON dbo.AUTH_SESSION(expires_at);
END;
GO
-- Ownership chaining allows runtime EXECUTE without table-wide account access.
CREATE OR ALTER PROCEDURE dbo.auth_create_customer
    @username VARCHAR(50), @password_hash VARCHAR(255),
    @full_name NVARCHAR(100), @email VARCHAR(100), @phone VARCHAR(15) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    IF @password_hash NOT LIKE '$argon2id$%'
        THROW 51010, 'A password hash is required.', 1;
    INSERT dbo.TAI_KHOAN(ten_dang_nhap,mat_khau,ho_ten,email,sdt,vai_tro)
    OUTPUT inserted.tai_khoan_id AS id, inserted.ten_dang_nhap AS username,
           inserted.ho_ten AS fullName, inserted.email, inserted.sdt AS phone, inserted.vai_tro AS role
    VALUES(@username,@password_hash,@full_name,@email,@phone,'khach_hang');
END;
GO
CREATE OR ALTER PROCEDURE dbo.auth_find_account @username VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT tai_khoan_id AS id, ten_dang_nhap AS username, mat_khau AS passwordHash,
           ho_ten AS fullName, email, sdt AS phone, vai_tro AS role
    FROM dbo.TAI_KHOAN WHERE ten_dang_nhap=@username;
END;
GO
CREATE OR ALTER PROCEDURE dbo.auth_profile @id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT tai_khoan_id AS id, ten_dang_nhap AS username, ho_ten AS fullName,
           email, sdt AS phone, vai_tro AS role
    FROM dbo.TAI_KHOAN WHERE tai_khoan_id=@id;
END;
