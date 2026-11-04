IF OBJECT_ID(N'dbo.Products', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Products (
    Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Products PRIMARY KEY,
    Name NVARCHAR(160) NOT NULL,
    Category VARCHAR(30) NOT NULL,
    Price DECIMAL(12,0) NOT NULL,
    Description NVARCHAR(1000) NOT NULL,
    IsNew BIT NOT NULL CONSTRAINT DF_Products_IsNew DEFAULT (0),
    IsActive BIT NOT NULL CONSTRAINT DF_Products_IsActive DEFAULT (1),
    CONSTRAINT CK_Products_Price CHECK (Price >= 0)
  );
END;

IF OBJECT_ID(N'dbo.ProductImages', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductImages (
    ProductId INT NOT NULL,
    ImagePath NVARCHAR(500) NOT NULL,
    SortOrder INT NOT NULL,
    CONSTRAINT PK_ProductImages PRIMARY KEY (ProductId, SortOrder),
    CONSTRAINT FK_ProductImages_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(Id)
  );
END;

IF OBJECT_ID(N'dbo.ProductSizes', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductSizes (
    ProductId INT NOT NULL,
    SizeName NVARCHAR(40) NOT NULL,
    SortOrder INT NOT NULL,
    CONSTRAINT PK_ProductSizes PRIMARY KEY (ProductId, SizeName),
    CONSTRAINT FK_ProductSizes_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(Id)
  );
END;

IF OBJECT_ID(N'dbo.ProductColors', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.ProductColors (
    ProductId INT NOT NULL,
    ColorName NVARCHAR(40) NOT NULL,
    ImageIndex INT NOT NULL,
    SortOrder INT NOT NULL,
    CONSTRAINT PK_ProductColors PRIMARY KEY (ProductId, ColorName),
    CONSTRAINT FK_ProductColors_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(Id)
  );
END;

IF OBJECT_ID(N'dbo.OutfitSuggestions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.OutfitSuggestions (
    ProductId INT NOT NULL,
    SuggestedProductId INT NOT NULL,
    SortOrder INT NOT NULL,
    CONSTRAINT PK_OutfitSuggestions PRIMARY KEY (ProductId, SuggestedProductId),
    CONSTRAINT FK_OutfitSuggestions_Product FOREIGN KEY (ProductId) REFERENCES dbo.Products(Id),
    CONSTRAINT FK_OutfitSuggestions_SuggestedProduct FOREIGN KEY (SuggestedProductId) REFERENCES dbo.Products(Id)
  );
END;

IF OBJECT_ID(N'dbo.Orders', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Orders (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Orders PRIMARY KEY,
    Code NVARCHAR(40) NOT NULL CONSTRAINT UQ_Orders_Code UNIQUE,
    CustomerName NVARCHAR(120) NOT NULL,
    Phone NVARCHAR(11) NOT NULL,
    Address NVARCHAR(500) NOT NULL,
    Note NVARCHAR(1000) NULL,
    PaymentMethod VARCHAR(20) NOT NULL,
    Status NVARCHAR(40) NOT NULL CONSTRAINT DF_Orders_Status DEFAULT (N'Đang xử lý'),
    Subtotal DECIMAL(12,0) NOT NULL,
    Discount DECIMAL(12,0) NOT NULL CONSTRAINT DF_Orders_Discount DEFAULT (0),
    VoucherCode VARCHAR(30) NULL,
    Total DECIMAL(12,0) NOT NULL,
    CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_Orders_PaymentMethod CHECK (PaymentMethod IN ('cod', 'transfer')),
    CONSTRAINT CK_Orders_Total CHECK (Subtotal >= 0 AND Discount >= 0 AND Total >= 0)
  );
END;

IF OBJECT_ID(N'dbo.OrderItems', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.OrderItems (
    Id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_OrderItems PRIMARY KEY,
    OrderId BIGINT NOT NULL,
    ProductId INT NOT NULL,
    ProductName NVARCHAR(160) NOT NULL,
    ImagePath NVARCHAR(500) NOT NULL,
    SizeName NVARCHAR(40) NOT NULL,
    ColorName NVARCHAR(40) NOT NULL,
    UnitPrice DECIMAL(12,0) NOT NULL,
    Quantity INT NOT NULL,
    CONSTRAINT FK_OrderItems_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(Id),
    CONSTRAINT FK_OrderItems_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(Id),
    CONSTRAINT CK_OrderItems_Quantity CHECK (Quantity > 0),
    CONSTRAINT CK_OrderItems_UnitPrice CHECK (UnitPrice >= 0)
  );
END;

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (SELECT 1 FROM dbo.Products)
BEGIN
  SET IDENTITY_INSERT dbo.Products ON;
  INSERT INTO dbo.Products (Id, Name, Category, Price, Description, IsNew) VALUES
    (1, N'Áo thun basic cotton', 'ao', 189000, N'Áo thun cotton 100%, form rộng vừa, mặc thoải mái, dễ phối đồ hằng ngày.', 1),
    (2, N'Áo sơ mi tay dài', 'ao', 329000, N'Áo sơ mi vải linen mềm mại, form suông, phù hợp đi học đi làm.', 0),
    (3, N'Áo khoác dù 2 lớp', 'ao', 459000, N'Áo khoác dù chống nước nhẹ, có mũ, giữ ấm tốt cho ngày se lạnh.', 1),
    (4, N'Quần jean ống suông', 'quan', 379000, N'Quần jean form suông, chất vải dày dặn, lên form đẹp.', 0),
    (5, N'Quần tây công sở', 'quan', 349000, N'Quần tây ống đứng, vải co giãn nhẹ, phù hợp môi trường công sở.', 0),
    (6, N'Quần short kaki', 'quan', 219000, N'Quần short kaki basic, form gọn, mặc mát mẻ ngày hè.', 1),
    (7, N'Váy liền hoa nhí', 'vay', 299000, N'Váy liền thân họa tiết hoa nhí, chất vải mềm rũ, nhẹ nhàng nữ tính.', 1),
    (8, N'Chân váy xếp ly', 'vay', 259000, N'Chân váy xếp ly dáng chữ A, dễ phối cùng áo thun hoặc sơ mi.', 0),
    (9, N'Váy sơ mi dáng dài', 'vay', 339000, N'Váy sơ mi dáng dài, có thắt eo, phong cách thanh lịch.', 0),
    (10, N'Mũ lưỡi trai basic', 'phukien', 99000, N'Mũ lưỡi trai form chuẩn, có khóa điều chỉnh phía sau.', 0),
    (11, N'Túi tote vải bố', 'phukien', 149000, N'Túi tote vải bố dày dặn, sức chứa lớn, tiện dụng khi đi học đi làm.', 1),
    (12, N'Thắt lưng da basic', 'phukien', 179000, N'Thắt lưng da tổng hợp, khóa kim loại chắc chắn, dễ phối nhiều loại quần.', 0);
  SET IDENTITY_INSERT dbo.Products OFF;

  INSERT INTO dbo.ProductImages (ProductId, ImagePath, SortOrder) VALUES
    (1, N'img/id1.jpg', 0), (1, N'img/id1.1.jpg', 1), (1, N'img/id1.2.jpg', 2), (1, N'img/id1.3.jpg', 3), (1, N'img/id1.4.jpg', 4),
    (2, N'img/id-2.jpg', 0), (2, N'img/id-2.1.jpg', 1), (2, N'img/id-2.2.jpg', 2),
    (3, N'img/id-3.jpg', 0), (3, N'img/id-3.1.jpg', 1), (3, N'img/id-3.2.jpg', 2),
    (4, N'img/id-4.jpg', 0), (4, N'img/id-4.1.jpg', 1), (4, N'img/id-4.2.jpg', 2),
    (5, N'img/id-5.jpg', 0), (5, N'img/id-5.1.jpg', 1), (5, N'img/id-5.2.jpg', 2),
    (6, N'img/id-6.jpg', 0), (6, N'img/id-6.1.jpg', 1), (6, N'img/id-6.2.jpg', 2),
    (7, N'img/id-7.jpg', 0), (7, N'img/id-7.1.jpg', 1), (7, N'img/id-7.2.jpg', 2),
    (8, N'img/id-8.jpg', 0), (8, N'img/id-8.1.jpg', 1), (8, N'img/id-8.2.jpg', 2),
    (9, N'img/id-9.jpg', 0), (9, N'img/id-9.1.jpg', 1), (9, N'img/id-9.2.jpg', 2),
    (10, N'img/id-10.jpg', 0), (10, N'img/id-10.1.jpg', 1), (10, N'img/id-10.2.jpg', 2),
    (11, N'img/id-11.jpg', 0), (11, N'img/id-11.1.jpg', 1), (11, N'img/id-11.2.jpg', 2),
    (12, N'img/id-12.jpg', 0), (12, N'img/id-12.1.jpg', 1);

  INSERT INTO dbo.ProductSizes (ProductId, SizeName, SortOrder) VALUES
    (1, N'S', 0), (1, N'M', 1), (1, N'L', 2), (1, N'XL', 3),
    (2, N'S', 0), (2, N'M', 1), (2, N'L', 2),
    (3, N'M', 0), (3, N'L', 1), (3, N'XL', 2),
    (4, N'S', 0), (4, N'M', 1), (4, N'L', 2), (4, N'XL', 3),
    (5, N'S', 0), (5, N'M', 1), (5, N'L', 2), (5, N'XL', 3),
    (6, N'S', 0), (6, N'M', 1), (6, N'L', 2), (6, N'XL', 3),
    (7, N'S', 0), (7, N'M', 1), (7, N'L', 2),
    (8, N'S', 0), (8, N'M', 1), (8, N'L', 2),
    (9, N'M', 0), (9, N'L', 1), (9, N'XL', 2),
    (10, N'Freesize', 0), (11, N'Freesize', 0),
    (12, N'105 cm', 0), (12, N'110 cm', 1), (12, N'115 cm', 2), (12, N'120 cm', 3);

  INSERT INTO dbo.ProductColors (ProductId, ColorName, ImageIndex, SortOrder) VALUES
    (1, N'Xanh', 0, 0), (1, N'Đen', 1, 1), (1, N'Xanh navy', 2, 2), (1, N'Be', 3, 3), (1, N'Trắng', 4, 4),
    (2, N'Xanh', 0, 0), (2, N'Đen', 1, 1), (2, N'Trắng', 2, 2),
    (3, N'Xanh navy', 0, 0), (3, N'Đen', 1, 1), (3, N'Trắng', 2, 2),
    (4, N'Xanh', 0, 0), (4, N'Đen', 1, 1), (4, N'Trắng', 2, 2),
    (5, N'Xám', 0, 0), (5, N'Đen', 1, 1), (5, N'Trắng', 2, 2),
    (6, N'Be', 0, 0), (6, N'Đen', 1, 1), (6, N'Trắng', 2, 2),
    (7, N'Vàng', 0, 0), (7, N'Đen', 1, 1), (7, N'Trắng', 2, 2),
    (8, N'Be', 0, 0), (8, N'Đen', 1, 1), (8, N'Trắng', 2, 2),
    (9, N'Xanh', 0, 0), (9, N'Đen', 1, 1), (9, N'Trắng', 2, 2),
    (10, N'Xanh navy', 0, 0), (10, N'Đen', 1, 1), (10, N'Trắng', 2, 2),
    (11, N'Be', 0, 0), (11, N'Đen', 1, 1), (11, N'Trắng', 2, 2),
    (12, N'Nâu', 0, 0), (12, N'Đen', 1, 1);

  INSERT INTO dbo.OutfitSuggestions (ProductId, SuggestedProductId, SortOrder) VALUES
    (1, 4, 0), (1, 6, 1), (1, 10, 2),
    (2, 5, 0), (2, 12, 1), (2, 11, 2),
    (3, 4, 0), (3, 1, 1), (3, 10, 2),
    (4, 1, 0), (4, 3, 1), (4, 12, 2),
    (5, 2, 0), (5, 12, 1), (5, 9, 2),
    (6, 1, 0), (6, 10, 1), (6, 11, 2),
    (7, 11, 0), (7, 10, 1),
    (8, 1, 0), (8, 2, 1), (8, 12, 2),
    (9, 12, 0), (9, 11, 1),
    (10, 1, 0), (10, 6, 1),
    (11, 2, 0), (11, 8, 1),
    (12, 5, 0), (12, 2, 1);
END;

COMMIT TRANSACTION;
