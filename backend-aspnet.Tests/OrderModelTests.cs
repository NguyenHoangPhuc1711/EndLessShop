using System.Text.Encodings.Web;
using System.Text.Json;
using EndLessShop.Api.Models;
using Xunit;

namespace EndLessShop.Tests;

public class OrderModelTests
{
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    [Fact]
    public void OrderCheckoutRequest_Serialization_MatchesExpectedJson()
    {
        var request = new OrderCheckoutRequest
        {
            Items = new List<OrderItemInput>
            {
                new() { Id = 1, Size = "M", Color = "Đen", Qty = 2 },
                new() { Id = 2, Size = "L", Color = "Trắng", Qty = 1 }
            },
            VoucherCode = "ENDLESS10",
            Payment = "cod",
            Delivery = new DeliveryInfo
            {
                FullName = "Nguyễn Văn A",
                Phone = "0987654321",
                Address = "123 Đường Lê Lợi, Quận 1, TP.HCM",
                Note = "Giao giờ hành chính"
            }
        };

        var json = JsonSerializer.Serialize(request, _jsonOptions);

        Assert.Contains("\"voucherCode\":\"ENDLESS10\"", json);
        Assert.Contains("\"payment\":\"cod\"", json);
        Assert.Contains("\"fullName\":\"Nguyễn Văn A\"", json);
        Assert.Contains("\"items\":", json);

        var deserialized = JsonSerializer.Deserialize<OrderCheckoutRequest>(json, _jsonOptions);
        Assert.NotNull(deserialized);
        Assert.Equal("Nguyễn Văn A", deserialized.Delivery?.FullName);
        Assert.Equal(2, deserialized.Items?.Count);
    }

    [Fact]
    public void ProductDto_Deserialization_HandlesJsonCorrectly()
    {
        var product = new ProductDto
        {
            Id = 1,
            Name = "Áo Thun Cotton Organic",
            Category = "ao-thun",
            Price = 250000,
            Stock = 50,
            Sizes = new List<string> { "S", "M", "L", "XL" },
            Colors = new List<string> { "Đen", "Trắng", "Xám" },
            Images = new List<string> { "img/ao1.jpg", "img/ao2.jpg" },
            ColorImageIndices = new Dictionary<string, int> { { "Đen", 0 }, { "Trắng", 1 } },
            Description = "Chất liệu 100% cotton tự nhiên",
            IsNew = true
        };

        var json = JsonSerializer.Serialize(product, _jsonOptions);
        var deserialized = JsonSerializer.Deserialize<ProductDto>(json, _jsonOptions);

        Assert.NotNull(deserialized);
        Assert.Equal(product.Id, deserialized.Id);
        Assert.Equal(product.Name, deserialized.Name);
        Assert.Equal(4, deserialized.Sizes.Count);
        Assert.True(deserialized.IsNew);
    }

    [Fact]
    public void OrderCheckoutRequest_QrPayment_Serialization_PreservesQrMethod()
    {
        var request = new OrderCheckoutRequest
        {
            Items = new List<OrderItemInput>
            {
                new() { Id = 1, Size = "M", Color = "Đen", Qty = 1 }
            },
            Payment = "qr",
            Delivery = new DeliveryInfo
            {
                FullName = "Trần Thị B",
                Phone = "0912345678",
                Address = "456 Đường Nguyễn Trãi, Quận 5, TP.HCM"
            }
        };

        var json = JsonSerializer.Serialize(request, _jsonOptions);
        Assert.Contains("\"payment\":\"qr\"", json);

        var deserialized = JsonSerializer.Deserialize<OrderCheckoutRequest>(json, _jsonOptions);
        Assert.NotNull(deserialized);
        Assert.Equal("qr", deserialized.Payment);
    }

    [Fact]
    public void OrderDetailDto_WithPaymentQrInfo_SerializesCorrectly()
    {
        var order = new OrderDetailDto
        {
            Id = 2050,
            Code = "ENDLESS-2050",
            Date = DateTime.UtcNow,
            Status = "cho_xu_ly",
            Payment = "qr",
            Subtotal = 350000,
            Discount = 0,
            Total = 350000,
            QrInfo = new PaymentQrInfo
            {
                BankId = "MB",
                BankName = "MBBank",
                AccountNo = "0987654321",
                AccountName = "ENDLESS SHOP",
                Amount = 350000,
                Description = "ENDLESS-2050",
                QrUrl = "https://img.vietqr.io/image/MB-0987654321-compact2.png?amount=350000&addInfo=ENDLESS-2050&accountName=ENDLESS%20SHOP"
            }
        };

        var json = JsonSerializer.Serialize(order, _jsonOptions);
        Assert.Contains("\"qrInfo\":", json);
        Assert.Contains("\"bankId\":\"MB\"", json);
        Assert.Contains("\"qrUrl\":", json);

        var deserialized = JsonSerializer.Deserialize<OrderDetailDto>(json, _jsonOptions);
        Assert.NotNull(deserialized);
        Assert.NotNull(deserialized.QrInfo);
        Assert.Equal("MB", deserialized.QrInfo.BankId);
        Assert.Equal(350000, deserialized.QrInfo.Amount);
    }
}
