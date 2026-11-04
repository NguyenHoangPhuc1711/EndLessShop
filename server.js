"use strict";

const express = require("express");
const sql = require("mssql");
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomInt } = require("node:crypto");

const app = express();
const port = Number(process.env.PORT || 3000);
const database = process.env.MSSQL_DATABASE || "EndlessShop";
const password = process.env.MSSQL_PASSWORD;

if (!password) {
  throw new Error("Thiếu biến môi trường MSSQL_PASSWORD.");
}
if (!/^[A-Za-z0-9_]+$/.test(database)) {
  throw new Error("MSSQL_DATABASE chỉ được chứa chữ, số và dấu gạch dưới.");
}

const sqlConfig = {
  server: process.env.MSSQL_SERVER || "localhost",
  port: Number(process.env.MSSQL_PORT || 1433),
  user: process.env.MSSQL_USER || "sa",
  password: password,
  database: database,
  options: {
    encrypt: true,
    trustServerCertificate: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  connectionTimeout: 30000,
  requestTimeout: 30000
};

let pool;

async function initializeDatabase() {
  const masterPool = await new sql.ConnectionPool({
    ...sqlConfig,
    database: "master",
    pool: { max: 1, min: 0, idleTimeoutMillis: 10000 }
  }).connect();

  try {
    await masterPool.request().query(
      "IF DB_ID(N'" + database + "') IS NULL CREATE DATABASE [" + database + "]"
    );
  } finally {
    await masterPool.close();
  }

  pool = await new sql.ConnectionPool(sqlConfig).connect();
  const schema = await fs.readFile(path.join(__dirname, "database", "schema.sql"), "utf8");
  await pool.request().batch(schema);
}

function invalidRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function buildOrderCode() {
  return "ENDLESS" + randomInt(10000000, 100000000);
}

app.use(express.json({ limit: "32kb" }));

app.get("/api/health", async function (request, response, next) {
  try {
    await pool.request().query("SELECT 1 AS healthy");
    response.json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/products", async function (request, response, next) {
  try {
    const [productResult, imageResult, sizeResult, colorResult, suggestionResult] = await Promise.all([
      pool.request().query(
        "SELECT Id AS id, Name AS name, Category AS category, Price AS price, Description AS description, IsNew AS isNew FROM dbo.Products WHERE IsActive = 1 ORDER BY Id"
      ),
      pool.request().query(
        "SELECT ProductId AS productId, ImagePath AS imagePath, SortOrder AS sortOrder FROM dbo.ProductImages ORDER BY ProductId, SortOrder"
      ),
      pool.request().query(
        "SELECT ProductId AS productId, SizeName AS size FROM dbo.ProductSizes ORDER BY ProductId, SortOrder"
      ),
      pool.request().query(
        "SELECT ProductId AS productId, ColorName AS color, ImageIndex AS imageIndex FROM dbo.ProductColors ORDER BY ProductId, SortOrder"
      ),
      pool.request().query(
        "SELECT ProductId AS productId, SuggestedProductId AS suggestedProductId FROM dbo.OutfitSuggestions ORDER BY ProductId, SortOrder"
      )
    ]);

    const products = productResult.recordset.map(function (product) {
      const images = imageResult.recordset
        .filter(function (image) { return image.productId === product.id; })
        .map(function (image) { return image.imagePath; });
      const colors = colorResult.recordset.filter(function (color) { return color.productId === product.id; });
      const colorImageIndices = {};
      colors.forEach(function (color) {
        colorImageIndices[color.color] = color.imageIndex;
      });

      return {
        ...product,
        price: Number(product.price),
        isNew: Boolean(product.isNew),
        images: images,
        sizes: sizeResult.recordset
          .filter(function (size) { return size.productId === product.id; })
          .map(function (size) { return size.size; }),
        colors: colors.map(function (color) { return color.color; }),
        colorImageIndices: colorImageIndices
      };
    });
    const suggestionsByProduct = new Map();
    suggestionResult.recordset.forEach(function (suggestion) {
      if (!suggestionsByProduct.has(suggestion.productId)) {
        suggestionsByProduct.set(suggestion.productId, []);
      }
      suggestionsByProduct.get(suggestion.productId).push(suggestion.suggestedProductId);
    });
    products.forEach(function (product) {
      product.outfitSuggestions = suggestionsByProduct.get(product.id) || [];
    });

    response.json(products);
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", async function (request, response, next) {
  let transaction;

  try {
    const body = request.body;
    const delivery = body && body.delivery;
    const items = body && body.items;
    const payment = body && body.payment;
    const voucherCode = body && typeof body.voucherCode === "string"
      ? body.voucherCode.trim().toUpperCase()
      : null;

    if (!delivery || typeof delivery !== "object") {
      throw invalidRequest("Vui lòng cung cấp thông tin giao hàng.");
    }
    const fullName = typeof delivery.fullName === "string" ? delivery.fullName.trim() : "";
    const phone = typeof delivery.phone === "string" ? delivery.phone.trim() : "";
    const address = typeof delivery.address === "string" ? delivery.address.trim() : "";
    const note = typeof delivery.note === "string" ? delivery.note.trim() : "";
    if (!fullName || fullName.length > 120 || !/^[0-9]{9,11}$/.test(phone) || !address || address.length > 500 || note.length > 1000) {
      throw invalidRequest("Thông tin giao hàng không hợp lệ.");
    }
    if (!["cod", "transfer"].includes(payment)) {
      throw invalidRequest("Phương thức thanh toán không hợp lệ.");
    }
    if (!Array.isArray(items) || items.length === 0 || items.length > 30) {
      throw invalidRequest("Giỏ hàng không hợp lệ.");
    }

    const requestedItems = items.map(function (item) {
      const id = Number(item && item.id);
      const qty = Number(item && item.qty);
      const size = typeof (item && item.size) === "string" ? item.size.trim() : "";
      const color = typeof (item && item.color) === "string" ? item.color.trim() : "";
      if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(qty) || qty < 1 || qty > 50 || size.length > 40 || color.length > 40) {
        throw invalidRequest("Sản phẩm hoặc số lượng trong giỏ hàng không hợp lệ.");
      }
      return { id: id, qty: qty, size: size, color: color };
    });

    const productIds = Array.from(new Set(requestedItems.map(function (item) { return item.id; })));
    const idParameters = productIds.map(function (id, index) { return "@product" + index; });
    const productRequest = pool.request();
    productIds.forEach(function (id, index) {
      productRequest.input("product" + index, sql.Int, id);
    });
    const sizesRequest = pool.request();
    const colorsRequest = pool.request();
    productIds.forEach(function (id, index) {
      sizesRequest.input("product" + index, sql.Int, id);
      colorsRequest.input("product" + index, sql.Int, id);
    });
    const [productsResult, sizesResult, colorsResult] = await Promise.all([
      productRequest.query(
        "SELECT Id AS id, Name AS name, Price AS price FROM dbo.Products WHERE IsActive = 1 AND Id IN (" + idParameters.join(",") + ")"
      ),
      sizesRequest.query(
        "SELECT ProductId AS productId, SizeName AS value FROM dbo.ProductSizes WHERE ProductId IN (" + idParameters.join(",") + ")"
      ),
      colorsRequest.query(
        "SELECT ProductId AS productId, ColorName AS value FROM dbo.ProductColors WHERE ProductId IN (" + idParameters.join(",") + ")"
      )
    ]);
    const productMap = new Map(productsResult.recordset.map(function (product) { return [product.id, product]; }));
    const allowedSizes = new Map();
    sizesResult.recordset.forEach(function (option) {
      if (!allowedSizes.has(option.productId)) allowedSizes.set(option.productId, new Set());
      allowedSizes.get(option.productId).add(option.value);
    });
    const allowedColors = new Map();
    colorsResult.recordset.forEach(function (option) {
      if (!allowedColors.has(option.productId)) allowedColors.set(option.productId, new Set());
      allowedColors.get(option.productId).add(option.value);
    });

    const orderItems = requestedItems.map(function (item) {
      const product = productMap.get(item.id);
      if (!product) {
        throw invalidRequest("Một sản phẩm trong giỏ hàng không còn khả dụng.");
      }
      if (!allowedSizes.get(item.id)?.has(item.size) || !allowedColors.get(item.id)?.has(item.color)) {
        throw invalidRequest("Kích cỡ hoặc màu sắc của sản phẩm không hợp lệ.");
      }
      return {
        ...item,
        name: product.name,
        price: Number(product.price)
      };
    });

    const subtotal = orderItems.reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
    let discount = 0;
    if (voucherCode) {
      if (voucherCode === "ENDLESS10") {
        discount = Math.round(subtotal * 0.1);
      } else if (voucherCode === "FREESHIP" && subtotal >= 200000) {
        discount = 30000;
      } else {
        throw invalidRequest("Mã giảm giá không hợp lệ hoặc chưa đạt giá trị đơn tối thiểu.");
      }
    }
    const total = subtotal - discount;
    const code = buildOrderCode();
    const imageRequest = pool.request();
    productIds.forEach(function (id, index) {
      imageRequest.input("imageProduct" + index, sql.Int, id);
    });
    const imagesResult = await imageRequest.query(
      "SELECT ProductId AS productId, ImagePath AS imagePath FROM dbo.ProductImages WHERE SortOrder = 0 AND ProductId IN (" +
      productIds.map(function (_, index) { return "@imageProduct" + index; }).join(",") + ")"
    );
    const firstImageByProduct = new Map(imagesResult.recordset.map(function (image) { return [image.productId, image.imagePath]; }));

    transaction = new sql.Transaction(pool);
    await transaction.begin();
    const orderInsert = await new sql.Request(transaction)
      .input("code", sql.NVarChar(40), code)
      .input("fullName", sql.NVarChar(120), fullName)
      .input("phone", sql.NVarChar(11), phone)
      .input("address", sql.NVarChar(500), address)
      .input("note", sql.NVarChar(1000), note || null)
      .input("payment", sql.VarChar(20), payment)
      .input("subtotal", sql.Decimal(12, 0), subtotal)
      .input("discount", sql.Decimal(12, 0), discount)
      .input("voucherCode", sql.VarChar(30), voucherCode)
      .input("total", sql.Decimal(12, 0), total)
      .query(
        "INSERT INTO dbo.Orders (Code, CustomerName, Phone, Address, Note, PaymentMethod, Subtotal, Discount, VoucherCode, Total) " +
        "OUTPUT INSERTED.Id AS id, INSERTED.CreatedAt AS createdAt " +
        "VALUES (@code, @fullName, @phone, @address, @note, @payment, @subtotal, @discount, @voucherCode, @total)"
      );
    const orderId = orderInsert.recordset[0].id;

    for (const item of orderItems) {
      await new sql.Request(transaction)
        .input("orderId", sql.BigInt, orderId)
        .input("productId", sql.Int, item.id)
        .input("productName", sql.NVarChar(160), item.name)
        .input("imagePath", sql.NVarChar(500), firstImageByProduct.get(item.id) || "")
        .input("size", sql.NVarChar(40), item.size)
        .input("color", sql.NVarChar(40), item.color)
        .input("unitPrice", sql.Decimal(12, 0), item.price)
        .input("quantity", sql.Int, item.qty)
        .query(
          "INSERT INTO dbo.OrderItems (OrderId, ProductId, ProductName, ImagePath, SizeName, ColorName, UnitPrice, Quantity) " +
          "VALUES (@orderId, @productId, @productName, @imagePath, @size, @color, @unitPrice, @quantity)"
        );
    }
    await transaction.commit();

    response.status(201).json({
      order: {
        code: code,
        date: new Date(orderInsert.recordset[0].createdAt).toLocaleString("vi-VN"),
        status: "Đang xử lý",
        payment: payment,
        paymentLabel: payment === "transfer" ? "Chuyển khoản ngân hàng" : "Thanh toán khi nhận hàng (COD)",
        items: orderItems.map(function (item) {
          return {
            id: item.id,
            name: item.name,
            image: firstImageByProduct.get(item.id) || "",
            size: item.size,
            color: item.color,
            price: item.price,
            qty: item.qty
          };
        }),
        subtotal: subtotal,
        discount: discount,
        voucherCode: voucherCode,
        total: total,
        delivery: { fullName: fullName, phone: phone, address: address, note: note }
      }
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    next(error);
  }
});

app.get("/", function (request, response) {
  response.sendFile(path.join(__dirname, "index.html"));
});
app.get("/checkout.html", function (request, response) {
  response.sendFile(path.join(__dirname, "checkout.html"));
});
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use("/img", express.static(path.join(__dirname, "img")));

app.use(function (error, request, response, next) {
  if (response.headersSent) {
    return next(error);
  }
  if (error.statusCode) {
    return response.status(error.statusCode).json({ error: error.message });
  }
  console.error("Lỗi xử lý yêu cầu:", error);
  return response.status(500).json({ error: "Máy chủ gặp lỗi khi xử lý yêu cầu." });
});

initializeDatabase()
  .then(function () {
    app.listen(port, "0.0.0.0", function () {
      console.log("Endless API đang chạy tại cổng " + port + ".");
    });
  })
  .catch(function (error) {
    console.error("Không thể khởi tạo SQL Server:", error);
    process.exitCode = 1;
  });
