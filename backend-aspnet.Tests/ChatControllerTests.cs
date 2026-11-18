using System.Data;
using EndLessShop.Api.Controllers;
using EndLessShop.Api.Data;
using EndLessShop.Api.Models;
using EndLessShop.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;
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

    private sealed class FakeGeminiChatService : IGeminiChatService
    {
        private readonly GeminiReplyResult? _result;

        public FakeGeminiChatService(bool isConfigured, GeminiReplyResult? result)
        {
            IsConfigured = isConfigured;
            _result = result;
        }

        public bool IsConfigured { get; }
        public int CallCount { get; private set; }
        public string? LastUserMessage { get; private set; }
        public string? LastStoreContext { get; private set; }
        public IReadOnlyList<ChatHistoryTurn>? LastHistory { get; private set; }

        public Task<GeminiReplyResult?> GenerateReplyAsync(
            string userMessage,
            IReadOnlyList<ChatHistoryTurn>? history,
            string storeContext,
            CancellationToken cancellationToken = default)
        {
            CallCount++;
            LastUserMessage = userMessage;
            LastStoreContext = storeContext;
            LastHistory = history;
            return Task.FromResult(_result);
        }
    }

    [Fact]
    public async Task Message_OpenEndedQuestion_WhenGeminiConfigured_UsesAiAssistant()
    {
        var fakeGemini = new FakeGeminiChatService(true, new GeminiReplyResult
        {
            Reply = "Dạ phong cách Bắc Âu tối giản rất hợp với các gam màu trung tính như trắng, be và xanh olive ạ.",
            Suggestions = new List<string> { "🧥 Gợi ý áo & quần", "📏 Tư vấn chọn size" }
        });
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var controller = new ChatController(new DummyDbFactory(), fakeGemini, cache);

        var result = await controller.Message(new ChatMessageRequest
        {
            Message = "Phong cách tối giản Bắc Âu hợp phối màu gì?",
            History = new List<ChatHistoryTurn>
            {
                new() { Role = "user", Text = "Mình thích đồ đơn giản" },
                new() { Role = "model", Text = "Dạ Endless chuyên thiết kế tối giản ạ." }
            }
        });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ChatResponse>(okResult.Value);
        Assert.Equal("ai_assistant", response.Intent);
        Assert.Contains("trung tính", response.Reply);
        Assert.Equal(1, fakeGemini.CallCount);
        Assert.Contains("Endless Shop", fakeGemini.LastStoreContext);
        Assert.Equal(2, fakeGemini.LastHistory?.Count);
    }

    [Fact]
    public async Task Message_AdvisoryProductQuestion_WhenGeminiConfigured_UsesAiAssistant()
    {
        var fakeGemini = new FakeGeminiChatService(true, new GeminiReplyResult
        {
            Reply = "Với áo sơ mi trắng, bạn có thể phối cùng quần tây dáng suông màu đen để đi làm rất thanh lịch.",
            Suggestions = new List<string> { "📏 Tư vấn chọn size", "🏷️ Mã giảm giá hot" }
        });
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var controller = new ChatController(new DummyDbFactory(), fakeGemini, cache);

        var result = await controller.Message(new ChatMessageRequest
        {
            Message = "Áo sơ mi trắng nên phối với quần gì đi làm cho lịch sự?"
        });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ChatResponse>(okResult.Value);
        Assert.Equal("ai_assistant", response.Intent);
        Assert.Equal(1, fakeGemini.CallCount);
    }

    [Fact]
    public async Task Message_AdvisoryProductQuestion_WhenGeminiFails_FallsBackToProductSearch()
    {
        var fakeGemini = new FakeGeminiChatService(true, null);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var controller = new ChatController(new DummyDbFactory(), fakeGemini, cache);

        var result = await controller.Message(new ChatMessageRequest
        {
            Message = "Áo sơ mi trắng nên phối với quần gì?"
        });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ChatResponse>(okResult.Value);
        Assert.Equal("products", response.Intent);
        Assert.Equal(1, fakeGemini.CallCount);
    }

    [Fact]
    public async Task Message_OpenEndedQuestion_WhenGeminiFails_FallsBackToGeneralResponse()
    {
        var fakeGemini = new FakeGeminiChatService(true, null);
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var controller = new ChatController(new DummyDbFactory(), fakeGemini, cache);

        var result = await controller.Message(new ChatMessageRequest
        {
            Message = "Thời tiết cuối tuần mặc gì cho hợp?"
        });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ChatResponse>(okResult.Value);
        Assert.Equal("general", response.Intent);
        Assert.Equal(1, fakeGemini.CallCount);
    }

    [Theory]
    [InlineData("phí ship thế nào")]
    [InlineData("1m70 65kg")]
    [InlineData("có voucher nào không")]
    [InlineData("xin chào")]
    [InlineData("chính sách đổi trả")]
    public async Task Message_DeterministicQueries_DoNotCallGeminiService(string input)
    {
        var fakeGemini = new FakeGeminiChatService(true, new GeminiReplyResult { Reply = "should not be used" });
        using var cache = new MemoryCache(new MemoryCacheOptions());
        var controller = new ChatController(new DummyDbFactory(), fakeGemini, cache);

        await controller.Message(new ChatMessageRequest { Message = input });

        Assert.Equal(0, fakeGemini.CallCount);
    }
}
