-- Additive COD migration. No existing order, product, stock or account is reset.
IF COL_LENGTH('dbo.HOA_DON','idempotency_key') IS NULL
    ALTER TABLE dbo.HOA_DON ADD idempotency_key VARCHAR(36) NULL;
IF COL_LENGTH('dbo.HOA_DON','request_hash') IS NULL
    ALTER TABLE dbo.HOA_DON ADD request_hash CHAR(64) NULL;
IF COL_LENGTH('dbo.HOA_DON','ma_voucher') IS NULL
    ALTER TABLE dbo.HOA_DON ADD ma_voucher VARCHAR(30) NULL;
IF COL_LENGTH('dbo.HOA_DON','ma_don') IS NULL
    ALTER TABLE dbo.HOA_DON ADD ma_don AS ('ENDLESS-' + CONVERT(VARCHAR(20),hoa_don_id)) PERSISTED;
IF COL_LENGTH('dbo.CHI_TIET_HOA_DON','ten_sp') IS NULL
    ALTER TABLE dbo.CHI_TIET_HOA_DON ADD ten_sp NVARCHAR(150) NULL;
IF COL_LENGTH('dbo.CHI_TIET_HOA_DON','anh_sp') IS NULL
    ALTER TABLE dbo.CHI_TIET_HOA_DON ADD anh_sp NVARCHAR(500) NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.HOA_DON') AND name='UX_HOA_DON_CODE')
    CREATE UNIQUE INDEX UX_HOA_DON_CODE ON dbo.HOA_DON(ma_don);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.HOA_DON') AND name='UX_HOA_DON_REQUEST')
    CREATE UNIQUE INDEX UX_HOA_DON_REQUEST ON dbo.HOA_DON(khach_hang_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
GO
CREATE OR ALTER PROCEDURE dbo.order_get
    @user_id INT, @order_id INT = NULL, @request_key VARCHAR(36) = NULL, @replayed BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    IF @request_key IS NOT NULL
      SELECT @order_id=hoa_don_id FROM dbo.HOA_DON WHERE khach_hang_id=@user_id AND idempotency_key=@request_key;
    IF NOT EXISTS (SELECT 1 FROM dbo.HOA_DON WHERE hoa_don_id=@order_id AND khach_hang_id=@user_id)
      THROW 51040, 'Order not found.', 1;
    SELECT h.hoa_don_id AS id,h.ma_don AS code,h.ngay_dat AS date,h.trang_thai AS status,
      h.phuong_thuc_thanh_toan AS payment,h.tam_tinh AS subtotal,h.tien_giam AS discount,h.tong_tien AS total,
      COALESCE(h.ma_voucher,v.ma_code) AS voucherCode,h.ten_nguoi_nhan AS fullName,
      h.sdt_nguoi_nhan AS phone,h.dia_chi AS address,h.ghi_chu AS note,@replayed AS replayed
    FROM dbo.HOA_DON h LEFT JOIN dbo.VOUCHER v ON v.voucher_id=h.voucher_id
    WHERE h.hoa_don_id=@order_id AND h.khach_hang_id=@user_id;
    SELECT d.san_pham_id AS id,COALESCE(d.ten_sp,p.ten_sp) AS name,d.anh_sp AS image,
      d.size,d.mau AS color,d.so_luong AS qty,d.don_gia AS price
    FROM dbo.CHI_TIET_HOA_DON d JOIN dbo.SAN_PHAM p ON p.san_pham_id=d.san_pham_id
    JOIN dbo.HOA_DON h ON h.hoa_don_id=d.hoa_don_id
    WHERE d.hoa_don_id=@order_id AND h.khach_hang_id=@user_id ORDER BY d.chi_tiet_id;
END;
GO
CREATE OR ALTER PROCEDURE dbo.order_list @user_id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (100) h.hoa_don_id AS id,h.ma_don AS code,h.ngay_dat AS date,h.trang_thai AS status,
      h.phuong_thuc_thanh_toan AS payment,h.tam_tinh AS subtotal,h.tien_giam AS discount,h.tong_tien AS total,
      h.ma_voucher AS voucherCode,
      (SELECT COUNT(*) FROM dbo.CHI_TIET_HOA_DON d WHERE d.hoa_don_id=h.hoa_don_id) AS itemCount
    FROM dbo.HOA_DON h WHERE h.khach_hang_id=@user_id ORDER BY h.hoa_don_id DESC;
END;
GO
-- Quote and create deliberately share the SAME SQL pricing/validation code.
CREATE OR ALTER PROCEDURE dbo.order_checkout
    @user_id INT, @items NVARCHAR(MAX), @voucher_code VARCHAR(30) = NULL,
    @create BIT = 0, @payment VARCHAR(20) = 'cod',
    @full_name NVARCHAR(100) = NULL, @phone VARCHAR(15) = NULL,
    @address NVARCHAR(500) = NULL, @note NVARCHAR(1000) = NULL,
    @request_key VARCHAR(36) = NULL, @request_hash CHAR(64) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF NOT EXISTS (SELECT 1 FROM dbo.TAI_KHOAN WHERE tai_khoan_id=@user_id)
      THROW 51037, 'Authentication required.', 1;
    IF @payment COLLATE Latin1_General_100_BIN2 <> 'cod' OR @payment IS NULL
      THROW 51036, 'Only COD is supported.', 1;
    IF ISJSON(@items)<>1 OR LEFT(LTRIM(@items),1)<>'['
      THROW 51030, 'Invalid cart.', 1;
    IF @create=1 AND (@request_key IS NULL OR @request_hash IS NULL)
      THROW 51030, 'Missing idempotency key.', 1;
    IF @create=1 AND (NULLIF(LTRIM(RTRIM(@full_name)),N'') IS NULL OR NULLIF(LTRIM(RTRIM(@address)),N'') IS NULL
      OR @phone IS NULL OR LEN(@phone) NOT BETWEEN 9 AND 11 OR @phone LIKE '%[^0-9]%')
      THROW 51035, 'Invalid delivery information.', 1;

    DECLARE @lines TABLE (id INT,size NVARCHAR(10),color NVARCHAR(30),qty INT);
    INSERT @lines SELECT id,size,color,qty FROM OPENJSON(@items)
      WITH(id INT '$.id',size NVARCHAR(10) '$.size',color NVARCHAR(30) '$.color',qty INT '$.qty');
    IF NOT EXISTS(SELECT 1 FROM @lines) OR (SELECT COUNT(*) FROM @lines)>50
      OR EXISTS(SELECT 1 FROM @lines WHERE id IS NULL OR id<=0 OR qty IS NULL OR qty NOT BETWEEN 1 AND 999 OR size IS NULL OR color IS NULL)
      THROW 51030, 'Invalid cart.', 1;
    DECLARE @needed TABLE(id INT PRIMARY KEY,qty INT);
    INSERT @needed SELECT id,SUM(qty) FROM @lines GROUP BY id;
    DECLARE @products TABLE(id INT PRIMARY KEY,name NVARCHAR(150),price INT,sizes NVARCHAR(MAX),colors NVARCHAR(MAX),images NVARCHAR(MAX),indices NVARCHAR(MAX));
    DECLARE @priced TABLE(id INT,name NVARCHAR(150),image NVARCHAR(500),size NVARCHAR(10),color NVARCHAR(30),qty INT,price INT);
    DECLARE @id INT,@quantity INT,@stock INT,@price INT,@name NVARCHAR(150),@sizes NVARCHAR(MAX),@colors NVARCHAR(MAX),@images NVARCHAR(MAX),@indices NVARCHAR(MAX);
    DECLARE @order_id INT,@old_hash CHAR(64),@lock_result INT,@lock_name NVARCHAR(255);
    BEGIN TRY
      BEGIN TRANSACTION;
      IF @create=1 BEGIN
        SET @lock_name=N'cod:'+CONVERT(NVARCHAR(20),@user_id)+N':'+@request_key;
        EXEC @lock_result=sys.sp_getapplock @Resource=@lock_name,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
        IF @lock_result<0 THROW 51041,'Order busy. Retry with the same key.',1;
        SELECT @order_id=hoa_don_id,@old_hash=request_hash FROM dbo.HOA_DON
          WHERE khach_hang_id=@user_id AND idempotency_key=@request_key;
        IF @order_id IS NOT NULL BEGIN
          IF @old_hash<>@request_hash THROW 51039,'Idempotency key already used for another request.',1;
          COMMIT TRANSACTION;
          EXEC dbo.order_get @user_id=@user_id,@order_id=@order_id,@replayed=1;
          RETURN;
        END;
      END;

      -- Acquire stock locks in product-ID order, including all size/color lines of each product.
      DECLARE stock_cursor CURSOR LOCAL FAST_FORWARD FOR SELECT id,qty FROM @needed ORDER BY id;
      OPEN stock_cursor;
      FETCH NEXT FROM stock_cursor INTO @id,@quantity;
      WHILE @@FETCH_STATUS=0 BEGIN
        SET @stock=NULL;
        SELECT @stock=ton_kho,@price=gia,@name=ten_sp,@sizes=sizes_json,@colors=colors_json,@images=images_json,@indices=color_image_indices_json
          FROM dbo.SAN_PHAM WITH(UPDLOCK,HOLDLOCK) WHERE san_pham_id=@id;
        IF @stock IS NULL THROW 51031,'Product does not exist.',1;
        IF @stock<@quantity THROW 51033,'Insufficient product stock.',1;
        IF @price<0 OR ISJSON(@sizes)<>1 OR ISJSON(@colors)<>1 OR ISJSON(@images)<>1 OR ISJSON(@indices)<>1
          THROW 51032,'Invalid product metadata.',1;
        INSERT @products VALUES(@id,@name,@price,@sizes,@colors,@images,@indices);
        FETCH NEXT FROM stock_cursor INTO @id,@quantity;
      END;
      CLOSE stock_cursor;
      DEALLOCATE stock_cursor;
      IF EXISTS(SELECT 1 FROM @lines l JOIN @products p ON p.id=l.id
        WHERE NOT EXISTS(SELECT 1 FROM OPENJSON(p.sizes) s WHERE s.value COLLATE Latin1_General_100_BIN2=l.size COLLATE Latin1_General_100_BIN2 AND DATALENGTH(s.value)=DATALENGTH(l.size))
        OR NOT EXISTS(SELECT 1 FROM OPENJSON(p.colors) c WHERE c.value COLLATE Latin1_General_100_BIN2=l.color COLLATE Latin1_General_100_BIN2 AND DATALENGTH(c.value)=DATALENGTH(l.color)))
        THROW 51032,'Invalid size or color.',1;
      INSERT @priced
        SELECT l.id,p.name,COALESCE(img.value,JSON_VALUE(p.images,'$[0]')),l.size,l.color,l.qty,p.price
        FROM @lines l JOIN @products p ON p.id=l.id
        OUTER APPLY(SELECT value FROM OPENJSON(p.indices) WHERE [key] COLLATE Latin1_General_100_BIN2=l.color COLLATE Latin1_General_100_BIN2) ix
        OUTER APPLY(SELECT value FROM OPENJSON(p.images) WHERE TRY_CONVERT(INT,[key])=TRY_CONVERT(INT,ix.value)) img;
      DECLARE @amount BIGINT=(SELECT SUM(CONVERT(BIGINT,price)*qty) FROM @priced);
      IF @amount>2147483647 THROW 51038,'Order amount is too large.',1;
      DECLARE @subtotal INT=CONVERT(INT,@amount),@total INT=CONVERT(INT,@amount),@discount INT=0;
      DECLARE @voucher_id INT,@type VARCHAR(10),@value INT,@expires DATETIME;
      IF @voucher_code IS NOT NULL BEGIN
        SELECT @voucher_id=voucher_id,@type=loai_giam,@value=gia_tri,@expires=han_su_dung
          FROM dbo.VOUCHER WITH(HOLDLOCK) WHERE ma_code=@voucher_code;
        IF @voucher_id IS NULL OR (@expires IS NOT NULL AND @expires<=GETDATE())
          OR @value<=0 OR @type NOT IN('percent','fixed') OR (@type='percent' AND @value>100)
          THROW 51034,'Invalid or expired voucher.',1;
        IF @type='percent' SET @total=CONVERT(INT,ROUND(@subtotal*(100.0-@value)/100.0,0));
        ELSE SET @total=CASE WHEN @subtotal<@value THEN 0 ELSE @subtotal-@value END;
        SET @discount=@subtotal-@total;
      END;
      IF @create=0 BEGIN
        COMMIT TRANSACTION;
        SELECT @subtotal AS subtotal,@total AS total,@discount AS discount,@voucher_code AS voucherCode;
        SELECT id,name,image,size,color,qty,price FROM @priced ORDER BY id,size,color;
        RETURN;
      END;
      INSERT dbo.HOA_DON(khach_hang_id,voucher_id,trang_thai,tong_tien,tam_tinh,tien_giam,
        ten_nguoi_nhan,sdt_nguoi_nhan,dia_chi,ghi_chu,phuong_thuc_thanh_toan,ma_voucher,idempotency_key,request_hash)
        VALUES(@user_id,@voucher_id,'cho_xu_ly',@total,@subtotal,@discount,@full_name,@phone,@address,@note,'cod',@voucher_code,@request_key,@request_hash);
      SET @order_id=SCOPE_IDENTITY();
      -- Do the stock update before details so the rollback test covers both parent + stock writes.
      UPDATE p SET ton_kho=p.ton_kho-n.qty FROM dbo.SAN_PHAM p JOIN @needed n ON n.id=p.san_pham_id;
      INSERT dbo.CHI_TIET_HOA_DON(hoa_don_id,san_pham_id,size,mau,so_luong,don_gia,ten_sp,anh_sp)
        SELECT @order_id,id,size,color,qty,price,name,image FROM @priced;
      COMMIT TRANSACTION;
      EXEC dbo.order_get @user_id=@user_id,@order_id=@order_id,@replayed=0;
    END TRY
    BEGIN CATCH
      IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
      THROW;
    END CATCH;
END;
