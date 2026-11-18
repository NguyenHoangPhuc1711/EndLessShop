using System.Net;
using System.Text;
using System.Text.Json;
using EndLessShop.Api.Models;
using EndLessShop.Api.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace EndLessShop.Tests;

public class GeminiChatServiceTests
{
    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, string?, HttpResponseMessage> _responder;

        public StubHttpMessageHandler(Func<HttpRequestMessage, string?, HttpResponseMessage> responder)
        {
            _responder = responder;
        }

        public int RequestCount { get; private set; }
        public HttpRequestMessage? LastRequest { get; private set; }
        public string? LastRequestBody { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            RequestCount++;
            LastRequest = request;
            LastRequestBody = request.Content != null
                ? await request.Content.ReadAsStringAsync(cancellationToken)
                : null;
            return _responder(request, LastRequestBody);
        }
    }

    [Fact]
    public async Task GenerateReplyAsync_WhenApiKeyMissing_ReturnsNullWithoutHttpCall()
    {
        var handler = new StubHttpMessageHandler((_, _) => new HttpResponseMessage(HttpStatusCode.OK));
        using var httpClient = new HttpClient(handler);
        var service = new GeminiChatService(
            httpClient,
            Options.Create(new GeminiOptions { ApiKey = "" }),
            NullLogger<GeminiChatService>.Instance);

        if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("GEMINI_API_KEY")) ||
            !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("GOOGLE_API_KEY")))
        {
            // Skip assertion if ambient shell already defines GEMINI_API_KEY/GOOGLE_API_KEY.
            return;
        }

        Assert.False(service.IsConfigured);
        var result = await service.GenerateReplyAsync("Xin chào", null, "Store info");
        Assert.Null(result);
        Assert.Equal(0, handler.RequestCount);
    }

    [Fact]
    public async Task GenerateReplyAsync_SendsInteractionsRequestAndParsesStructuredResponse()
    {
        const string fakeApiKey = "test-google-ai-studio-key";
        var responseJson = """
        {
          "id": "v1_test123",
          "model": "gemini-4-hydrogen",
          "status": "completed",
          "steps": [
            {
              "type": "thought",
              "signature": "sig_123",
              "summary": [{ "type": "text", "text": "Internal reasoning that must be ignored" }]
            },
            {
              "type": "model_output",
              "content": [
                {
                  "type": "text",
                  "text": "{\"reply\":\"Dạ bạn có thể phối **Áo sơ mi Linen** cùng quần tây đen nhé!\",\"suggestions\":[\"📏 Tư vấn size\",\"🏷️ Mã giảm giá\"],\"recommended_product_ids\":[1,3]}"
                }
              ]
            }
          ]
        }
        """;

        var handler = new StubHttpMessageHandler((_, _) => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(responseJson, Encoding.UTF8, "application/json")
        });
        using var httpClient = new HttpClient(handler);

        var service = new GeminiChatService(
            httpClient,
            Options.Create(new GeminiOptions
            {
                ApiKey = fakeApiKey,
                Model = "gemini-4-hydrogen",
                Endpoint = "https://generativelanguage.googleapis.com/v1/interactions",
                ThinkingLevel = "low",
                MaxOutputTokens = 1024
            }),
            NullLogger<GeminiChatService>.Instance);

        var history = new List<ChatHistoryTurn>
        {
            new() { Role = "user", Text = "Mình sắp đi phỏng vấn" },
            new() { Role = "model", Text = "Dạ bạn cần gợi ý trang phục công sở phải không ạ?" }
        };

        var result = await service.GenerateReplyAsync("Tư vấn phối đồ giúp mình", history, "Catalog context");

        Assert.NotNull(result);
        Assert.Contains("Áo sơ mi Linen", result!.Reply);
        Assert.Equal(new[] { "📏 Tư vấn size", "🏷️ Mã giảm giá" }, result.Suggestions);
        Assert.Equal(new[] { 1, 3 }, result.RecommendedProductIds);

        Assert.Equal(1, handler.RequestCount);
        Assert.NotNull(handler.LastRequest);
        Assert.Equal("https://generativelanguage.googleapis.com/v1/interactions", handler.LastRequest!.RequestUri?.ToString());
        Assert.True(handler.LastRequest.Headers.TryGetValues("x-goog-api-key", out var keyValues));
        Assert.Equal(fakeApiKey, keyValues.Single());

        using var sentDoc = JsonDocument.Parse(handler.LastRequestBody!);
        var root = sentDoc.RootElement;
        Assert.Equal("gemini-4-hydrogen", root.GetProperty("model").GetString());
        Assert.False(root.GetProperty("store").GetBoolean());
        Assert.Contains("Catalog context", root.GetProperty("system_instruction").GetString());
        Assert.Equal(3, root.GetProperty("input").GetArrayLength());
        Assert.Equal("low", root.GetProperty("generation_config").GetProperty("thinking_level").GetString());
    }

    [Fact]
    public async Task GenerateReplyAsync_StripsMarkdownFence_AndSupportsPlainTextFallback()
    {
        var fencedJsonResponse = """
        {
          "steps": [
            {
              "type": "model_output",
              "content": [
                {
                  "type": "text",
                  "text": "```json\n{\"reply\":\"Dạ mẫu này mặc thoáng mát lắm ạ.\",\"suggestions\":[\"📏 Xem bảng size\"]}\n```"
                }
              ]
            }
          ]
        }
        """;

        var fencedHandler = new StubHttpMessageHandler((_, _) => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(fencedJsonResponse, Encoding.UTF8, "application/json")
        });
        using var fencedClient = new HttpClient(fencedHandler);
        var fencedService = new GeminiChatService(
            fencedClient,
            Options.Create(new GeminiOptions { ApiKey = "test-key" }),
            NullLogger<GeminiChatService>.Instance);

        var fencedResult = await fencedService.GenerateReplyAsync("Chất vải sao?", null, "Catalog");
        Assert.NotNull(fencedResult);
        Assert.Equal("Dạ mẫu này mặc thoáng mát lắm ạ.", fencedResult!.Reply);
        Assert.Single(fencedResult.Suggestions);

        var plainTextResponse = """
        {
          "steps": [
            {
              "type": "model_output",
              "content": [
                { "type": "text", "text": "Dạ shop mở cửa từ 08:30 đến 22:00 hằng ngày ạ." }
              ]
            }
          ]
        }
        """;

        var plainHandler = new StubHttpMessageHandler((_, _) => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(plainTextResponse, Encoding.UTF8, "application/json")
        });
        using var plainClient = new HttpClient(plainHandler);
        var plainService = new GeminiChatService(
            plainClient,
            Options.Create(new GeminiOptions { ApiKey = "test-key" }),
            NullLogger<GeminiChatService>.Instance);

        var plainResult = await plainService.GenerateReplyAsync("Mấy giờ mở cửa?", null, "Catalog");
        Assert.NotNull(plainResult);
        Assert.Equal("Dạ shop mở cửa từ 08:30 đến 22:00 hằng ngày ạ.", plainResult!.Reply);
        Assert.NotEmpty(plainResult.Suggestions);
    }

    [Fact]
    public async Task GenerateReplyAsync_WhenApiReturnsErrorStatus_ReturnsNullGracefully()
    {
        var handler = new StubHttpMessageHandler((_, _) => new HttpResponseMessage(HttpStatusCode.TooManyRequests)
        {
            Content = new StringContent("{\"error\":\"quota exceeded\"}", Encoding.UTF8, "application/json")
        });
        using var httpClient = new HttpClient(handler);

        var service = new GeminiChatService(
            httpClient,
            Options.Create(new GeminiOptions { ApiKey = "test-key" }),
            NullLogger<GeminiChatService>.Instance);

        var result = await service.GenerateReplyAsync("Hỏi thử", null, "Catalog");
        Assert.Null(result);
    }
}
