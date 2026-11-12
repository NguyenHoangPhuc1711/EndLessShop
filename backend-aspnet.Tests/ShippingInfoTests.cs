using System.Text.Encodings.Web;
using System.Text.Json;
using EndLessShop.Api.Models;
using Xunit;

namespace EndLessShop.Tests;

public class ShippingInfoTests
{
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    [Fact]
    public void UserDto_SupportsAddress_SerializationAndDeserialization()
    {
        var user = new UserDto
        {
            Id = 10,
            Username = "customer1",
            FullName = "Nguyễn Văn B",
            Email = "customer1@example.com",
            Phone = "0912345678",
            Address = "Số 456 Hai Bà Trưng, Quận 3, TP.HCM",
            Role = "khach_hang"
        };

        var json = JsonSerializer.Serialize(user, _jsonOptions);
        Assert.Contains("\"address\":\"Số 456 Hai Bà Trưng, Quận 3, TP.HCM\"", json);

        var deserialized = JsonSerializer.Deserialize<UserDto>(json, _jsonOptions);
        Assert.NotNull(deserialized);
        Assert.Equal("Số 456 Hai Bà Trưng, Quận 3, TP.HCM", deserialized.Address);
        Assert.Equal("0912345678", deserialized.Phone);
        Assert.Equal("Nguyễn Văn B", deserialized.FullName);
    }

    [Fact]
    public void UpdateShippingInfoRequest_SerializationAndDeserialization()
    {
        var request = new UpdateShippingInfoRequest
        {
            FullName = "Trần Thị C",
            Phone = "0988776655",
            Address = "Tòa nhà Landmark 81, Bình Thạnh, TP.HCM"
        };

        var json = JsonSerializer.Serialize(request, _jsonOptions);
        Assert.Contains("\"fullName\":\"Trần Thị C\"", json);
        Assert.Contains("\"phone\":\"0988776655\"", json);
        Assert.Contains("\"address\":\"Tòa nhà Landmark 81, Bình Thạnh, TP.HCM\"", json);

        var deserialized = JsonSerializer.Deserialize<UpdateShippingInfoRequest>(json, _jsonOptions);
        Assert.NotNull(deserialized);
        Assert.Equal("Trần Thị C", deserialized.FullName);
        Assert.Equal("0988776655", deserialized.Phone);
        Assert.Equal("Tòa nhà Landmark 81, Bình Thạnh, TP.HCM", deserialized.Address);
    }

    [Fact]
    public void OrderCheckoutRequest_SupportsSaveShippingInfoFlag()
    {
        var request = new OrderCheckoutRequest
        {
            Items = new List<OrderItemInput>
            {
                new() { Id = 1, Size = "M", Color = "Đen", Qty = 1 }
            },
            Payment = "cod",
            Delivery = new DeliveryInfo
            {
                FullName = "Lê Hoàng D",
                Phone = "0909123456",
                Address = "789 Nguyễn Huệ, Quận 1, TP.HCM"
            },
            SaveShippingInfo = true
        };

        var json = JsonSerializer.Serialize(request, _jsonOptions);
        Assert.Contains("\"saveShippingInfo\":true", json);

        var deserialized = JsonSerializer.Deserialize<OrderCheckoutRequest>(json, _jsonOptions);
        Assert.NotNull(deserialized);
        Assert.True(deserialized.SaveShippingInfo);
    }
}
