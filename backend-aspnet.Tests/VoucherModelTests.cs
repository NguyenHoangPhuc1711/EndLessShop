using System.Text.Json;
using EndLessShop.Api.Controllers;
using Xunit;

namespace EndLessShop.Tests;

public class VoucherModelTests
{
    [Fact]
    public void CreateVoucherRequest_Serialization_HandlesBothTypes()
    {
        var percentRequest = new AdminController.CreateVoucherRequest
        {
            Code = "TESTPERCENT10",
            Type = "percent",
            Value = 10,
            ExpiresAt = null
        };

        var fixedRequest = new AdminController.CreateVoucherRequest
        {
            Code = "TESTFIXED50",
            Type = "fixed",
            Value = 50000,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };

        var percentJson = JsonSerializer.Serialize(percentRequest);
        var fixedJson = JsonSerializer.Serialize(fixedRequest);

        var deserializedPercent = JsonSerializer.Deserialize<AdminController.CreateVoucherRequest>(percentJson);
        var deserializedFixed = JsonSerializer.Deserialize<AdminController.CreateVoucherRequest>(fixedJson);

        Assert.NotNull(deserializedPercent);
        Assert.Equal("TESTPERCENT10", deserializedPercent.Code);
        Assert.Equal("percent", deserializedPercent.Type);
        Assert.Equal(10, deserializedPercent.Value);
        Assert.Null(deserializedPercent.ExpiresAt);

        Assert.NotNull(deserializedFixed);
        Assert.Equal("TESTFIXED50", deserializedFixed.Code);
        Assert.Equal("fixed", deserializedFixed.Type);
        Assert.Equal(50000, deserializedFixed.Value);
        Assert.NotNull(deserializedFixed.ExpiresAt);
    }
}
