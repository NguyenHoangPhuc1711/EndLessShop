using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using EndLessShop.Api.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace EndLessShop.Api.Services;

/// <summary>
/// Configuration options for calling the Google AI Studio Gemini Interactions API.
/// </summary>
public class GeminiOptions
{
    public const string SectionName = "Gemini";

    public string ApiKey { get; set; } = string.Empty;
    public string Model { get; set; } = "gemini-4-hydrogen";
    public string Endpoint { get; set; } = "https://generativelanguage.googleapis.com/v1/interactions";
    public string ThinkingLevel { get; set; } = "low";
    public int MaxOutputTokens { get; set; } = 1024;
    public int TimeoutSeconds { get; set; } = 15;
}

/// <summary>
/// Structured reply returned by the Gemini AI assistant service.
/// </summary>
public class GeminiReplyResult
{
    public string Reply { get; set; } = string.Empty;
    public List<string> Suggestions { get; set; } = new();
    public List<int> RecommendedProductIds { get; set; } = new();
}

/// <summary>
/// Abstraction for generating grounded customer support replies with Google AI Studio.
/// </summary>
public interface IGeminiChatService
{
    bool IsConfigured { get; }

    Task<GeminiReplyResult?> GenerateReplyAsync(
        string userMessage,
        IReadOnlyList<ChatHistoryTurn>? history,
        string storeContext,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Calls the Google AI Studio Gemini Interactions API (v1) via HttpClient.
/// </summary>
public class GeminiChatService : IGeminiChatService
{
    private const string DefaultEndpoint = "https://generativelanguage.googleapis.com/v1/interactions";
    private const string DefaultModel = "gemini-4-hydrogen";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private static readonly object StructuredResponseFormat = new
    {
        type = "text",
        mime_type = "application/json",
        schema = new
        {
            type = "object",
            properties = new
            {
                reply = new
                {
                    type = "string",
                    description = "Câu trả lời tiếng Việt lịch sự, ngắn gọn, có thể dùng markdown **in đậm** hoặc gạch đầu dòng •."
                },
                suggestions = new
                {
                    type = "array",
                    items = new { type = "string" },
                    description = "2 đến 4 gợi ý câu hỏi ngắn tiếp theo phù hợp cho khách."
                },
                recommended_product_ids = new
                {
                    type = "array",
                    items = new { type = "integer" },
                    description = "Tối đa 4 ID sản phẩm thật từ danh mục trong ngữ cảnh nếu có sản phẩm phù hợp."
                }
            },
            required = new[] { "reply", "suggestions" }
        }
    };

    private readonly HttpClient _httpClient;
    private readonly GeminiOptions _options;
    private readonly ILogger<GeminiChatService> _logger;
    private readonly string _apiKey;

    public GeminiChatService(
        HttpClient httpClient,
        IOptions<GeminiOptions> options,
        ILogger<GeminiChatService> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
        _apiKey = ResolveApiKey(_options);
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_apiKey);

    public async Task<GeminiReplyResult?> GenerateReplyAsync(
        string userMessage,
        IReadOnlyList<ChatHistoryTurn>? history,
        string storeContext,
        CancellationToken cancellationToken = default)
    {
        if (!IsConfigured || string.IsNullOrWhiteSpace(userMessage))
        {
            return null;
        }

        var endpoint = string.IsNullOrWhiteSpace(_options.Endpoint) ? DefaultEndpoint : _options.Endpoint.Trim();
        var model = string.IsNullOrWhiteSpace(_options.Model) ? DefaultModel : _options.Model.Trim();

        var inputSteps = BuildInputSteps(userMessage, history);
        var generationConfig = new Dictionary<string, object>
        {
            ["max_output_tokens"] = Math.Clamp(_options.MaxOutputTokens, 128, 4096)
        };
        if (!string.IsNullOrWhiteSpace(_options.ThinkingLevel))
        {
            generationConfig["thinking_level"] = _options.ThinkingLevel.Trim();
        }

        var payload = new Dictionary<string, object>
        {
            ["model"] = model,
            ["system_instruction"] = BuildSystemInstruction(storeContext),
            ["store"] = false,
            ["input"] = inputSteps,
            ["generation_config"] = generationConfig,
            ["response_format"] = StructuredResponseFormat
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Add("x-goog-api-key", _apiKey);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        request.Content = new StringContent(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json");

        using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeoutCts.CancelAfter(TimeSpan.FromSeconds(Math.Clamp(_options.TimeoutSeconds, 3, 60)));

        try
        {
            using var response = await _httpClient.SendAsync(request, timeoutCts.Token);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Gemini API returned non-success status code {StatusCode}.", (int)response.StatusCode);
                return null;
            }

            var responseBody = await response.Content.ReadAsStringAsync(timeoutCts.Token);
            return ParseInteractionResponse(responseBody);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Gemini API request timed out after {TimeoutSeconds}s.", _options.TimeoutSeconds);
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Gemini API call failed; falling back to rule-based response.");
            return null;
        }
    }

    internal static GeminiReplyResult? ParseInteractionResponse(string responseBody)
    {
        if (string.IsNullOrWhiteSpace(responseBody))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            if (!root.TryGetProperty("steps", out var steps) || steps.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            // Collect text blocks from the final model_output step (ignoring thought steps).
            var textSegments = new List<string>();
            foreach (var step in steps.EnumerateArray())
            {
                if (!step.TryGetProperty("type", out var stepType) || stepType.GetString() != "model_output")
                {
                    continue;
                }

                if (!step.TryGetProperty("content", out var contentArr) || contentArr.ValueKind != JsonValueKind.Array)
                {
                    continue;
                }

                var stepTexts = new List<string>();
                foreach (var block in contentArr.EnumerateArray())
                {
                    if (block.TryGetProperty("type", out var blockType) &&
                        blockType.GetString() == "text" &&
                        block.TryGetProperty("text", out var textProp))
                    {
                        var val = textProp.GetString();
                        if (!string.IsNullOrWhiteSpace(val))
                        {
                            stepTexts.Add(val);
                        }
                    }
                }

                if (stepTexts.Count > 0)
                {
                    textSegments = stepTexts;
                }
            }

            var rawOutput = string.Join("\n", textSegments).Trim();
            if (string.IsNullOrWhiteSpace(rawOutput))
            {
                return null;
            }

            return ParseStructuredOrPlainOutput(rawOutput);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static GeminiReplyResult? ParseStructuredOrPlainOutput(string rawOutput)
    {
        var candidate = StripMarkdownJsonFence(rawOutput);
        try
        {
            var structured = JsonSerializer.Deserialize<StructuredChatPayload>(candidate);
            if (structured != null && !string.IsNullOrWhiteSpace(structured.Reply))
            {
                var suggestions = (structured.Suggestions ?? new List<string>())
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .Select(s => s.Trim())
                    .Distinct()
                    .Take(4)
                    .ToList();

                var productIds = (structured.RecommendedProductIds ?? new List<int>())
                    .Where(id => id > 0)
                    .Distinct()
                    .Take(4)
                    .ToList();

                return new GeminiReplyResult
                {
                    Reply = structured.Reply.Trim(),
                    Suggestions = suggestions,
                    RecommendedProductIds = productIds
                };
            }
        }
        catch (JsonException)
        {
            // Fall through to plain-text markdown response if model returned non-JSON.
        }

        return new GeminiReplyResult
        {
            Reply = rawOutput,
            Suggestions = new List<string> { "🧥 Gợi ý áo & quần", "📏 Tư vấn chọn size", "🏷️ Mã giảm giá hot" }
        };
    }

    private static string StripMarkdownJsonFence(string text)
    {
        var trimmed = text.Trim();
        if (!trimmed.StartsWith("```", StringComparison.Ordinal))
        {
            return trimmed;
        }

        var firstNewline = trimmed.IndexOf('\n');
        var lastFence = trimmed.LastIndexOf("```", StringComparison.Ordinal);
        if (firstNewline >= 0 && lastFence > firstNewline)
        {
            return trimmed.Substring(firstNewline + 1, lastFence - firstNewline - 1).Trim();
        }

        return trimmed;
    }

    private static List<object> BuildInputSteps(string userMessage, IReadOnlyList<ChatHistoryTurn>? history)
    {
        var steps = new List<object>();

        if (history != null && history.Count > 0)
        {
            foreach (var turn in history.TakeLast(6))
            {
                var text = turn.Text?.Trim();
                if (string.IsNullOrWhiteSpace(text))
                {
                    continue;
                }

                if (text.Length > 500)
                {
                    text = text.Substring(0, 500);
                }

                var stepType = string.Equals(turn.Role, "model", StringComparison.OrdinalIgnoreCase) ||
                               string.Equals(turn.Role, "bot", StringComparison.OrdinalIgnoreCase)
                    ? "model_output"
                    : "user_input";

                steps.Add(new
                {
                    type = stepType,
                    content = new[] { new { type = "text", text } }
                });
            }
        }

        steps.Add(new
        {
            type = "user_input",
            content = new[] { new { type = "text", text = userMessage.Trim() } }
        });

        return steps;
    }

    private static string BuildSystemInstruction(string storeContext)
    {
        return
            "Bạn là Trợ lý AI chính thức của Endless Shop — thương hiệu thời trang tối giản phong cách Bắc Âu (Scandinavian Warm Minimal).\n" +
            "Nhiệm vụ: Tư vấn phối đồ, chọn chất liệu, kích cỡ, giải đáp thông tin sản phẩm, khuyến mãi và chính sách mua sắm cho khách hàng.\n\n" +
            "NGUYÊN TẮC BẮT BUỘC:\n" +
            "1. Chỉ sử dụng thông tin sản phẩm (tên, ID, giá, size, màu, tồn kho), mã giảm giá và chính sách được cung cấp trong phần DỮ LIỆU CỬA HÀNG bên dưới. Tuyệt đối KHÔNG bịa sản phẩm, giá tiền, mã giảm giá hay tình trạng đơn hàng.\n" +
            "2. Nếu khách hỏi ngoài phạm vi dữ liệu có sẵn hoặc hỏi trạng thái đơn hàng cụ thể mà chưa tra được, hãy hướng dẫn khách nhắn mã đơn (ví dụ `#1001`) hoặc liên hệ Hotline `1900 8888`.\n" +
            "3. Trả lời bằng tiếng Việt lịch sự (xưng 'em', gọi 'quý khách' hoặc 'bạn'), ngắn gọn (tối đa 4-5 câu hoặc vài gạch đầu dòng `•`), dùng `**in đậm**` hợp lý, KHÔNG dùng thẻ HTML.\n" +
            "4. Nếu gợi ý sản phẩm cụ thể có trong danh mục, đưa ID sản phẩm đó vào `recommended_product_ids` (tối đa 4 ID); nếu không cần thẻ sản phẩm, để mảng rỗng `[]`.\n" +
            "5. Tạo 2-4 nút gợi ý ngắn tiếp theo trong `suggestions`.\n\n" +
            "DỮ LIỆU CỬA HÀNG ENDLESS SHOP:\n" +
            storeContext;
    }

    private static string ResolveApiKey(GeminiOptions options)
    {
        if (!string.IsNullOrWhiteSpace(options.ApiKey))
        {
            return options.ApiKey.Trim();
        }

        var fromGeminiEnv = Environment.GetEnvironmentVariable("GEMINI_API_KEY");
        if (!string.IsNullOrWhiteSpace(fromGeminiEnv))
        {
            return fromGeminiEnv.Trim();
        }

        var fromGoogleEnv = Environment.GetEnvironmentVariable("GOOGLE_API_KEY");
        return string.IsNullOrWhiteSpace(fromGoogleEnv) ? string.Empty : fromGoogleEnv.Trim();
    }

    private sealed class StructuredChatPayload
    {
        [JsonPropertyName("reply")]
        public string? Reply { get; set; }

        [JsonPropertyName("suggestions")]
        public List<string>? Suggestions { get; set; }

        [JsonPropertyName("recommended_product_ids")]
        public List<int>? RecommendedProductIds { get; set; }
    }
}
