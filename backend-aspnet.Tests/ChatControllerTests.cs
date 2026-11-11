using System.Data;
using EndLessShop.Api.Controllers;
using EndLessShop.Api.Data;
using EndLessShop.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace EndLessShop.Tests;

public class ChatControllerTests
{
    private class DummyDbFactory : IDbConnectionFactory
    {
        public IDbConnection CreateConnection()
        {
            throw new NotSupportedException("Unit test stub DB");
        }
    }

    [Fact]
    public async Task Message_EmptyInput_ReturnsWelcomeGreeting()
    {
        var controller = new ChatController(new DummyDbFactory());
        var result = await controller.Message(new ChatMessageRequest { Message = "" });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ChatResponse>(okResult.Value);
        Assert.Equal("greeting", response.Intent);
        Assert.Contains("Endless Shop", response.Reply);
        Assert.NotEmpty(response.Suggestions);
    }

    [Theory]
    [InlineData("1m70 65kg", "L")]
    [InlineData("mình cao 1m62 nặng 55kg", "M")]
    [InlineData("cao 1m55 nặng 48kg tư vấn size", "S")]
    [InlineData("1m80 78kg mặc size gì", "XL")]
    [InlineData("1m85 88kg", "XXL")]
    public async Task Message_SizeConsultation_CalculatesCorrectSize(string input, string expectedSize)
    {
        var controller = new ChatController(new DummyDbFactory());
        var result = await controller.Message(new ChatMessageRequest { Message = input });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ChatResponse>(okResult.Value);
        Assert.Equal("sizing_result", response.Intent);
        Assert.Equal(expectedSize, response.RecommendedSize);
        Assert.Contains($"Size {expectedSize}", response.Reply);
    }

    [Fact]
    public async Task Message_ShippingQuestion_ReturnsShippingPolicy()
    {
        var controller = new ChatController(new DummyDbFactory());
        var result = await controller.Message(new ChatMessageRequest { Message = "phí ship và thời gian giao hàng thế nào" });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ChatResponse>(okResult.Value);
        Assert.Equal("shipping", response.Intent);
        Assert.Contains("30.000₫", response.Reply);
        Assert.Contains("300.000₫", response.Reply);
    }

    [Fact]
    public async Task Message_ReturnsQuestion_ReturnsReturnPolicy()
    {
        var controller = new ChatController(new DummyDbFactory());
        var result = await controller.Message(new ChatMessageRequest { Message = "chính sách đổi trả sản phẩm" });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ChatResponse>(okResult.Value);
        Assert.Equal("returns", response.Intent);
        Assert.Contains("30 ngày", response.Reply);
    }

    [Fact]
    public async Task Message_ContactQuestion_ReturnsHotline()
    {
        var controller = new ChatController(new DummyDbFactory());
        var result = await controller.Message(new ChatMessageRequest { Message = "cho mình xin số hotline và địa chỉ cửa hàng" });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ChatResponse>(okResult.Value);
        Assert.Equal("contact", response.Intent);
        Assert.Contains("1900 8888", response.Reply);
    }

    [Fact]
    public async Task Message_Vouchers_WhenDbFails_FallsBackToDefaultVouchers()
    {
        var controller = new ChatController(new DummyDbFactory());
        var result = await controller.Message(new ChatMessageRequest { Message = "có mã giảm giá hay voucher gì không shop" });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ChatResponse>(okResult.Value);
        Assert.Equal("vouchers", response.Intent);
        Assert.NotNull(response.Vouchers);
        Assert.Contains(response.Vouchers, v => v.Code == "ENDLESS10");
        Assert.Contains(response.Vouchers, v => v.Code == "FREESHIP");
    }
}
