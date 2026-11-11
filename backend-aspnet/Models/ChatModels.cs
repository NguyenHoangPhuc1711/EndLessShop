using System.Text.Json.Serialization;

namespace EndLessShop.Api.Models;

public class ChatMessageRequest
{
    [JsonPropertyName("message")]
    public string? Message { get; set; }
}

public class ChatVoucherItemDto
{
    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("value")]
    public int Value { get; set; }

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;
}

public class ChatProductCardDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("price")]
    public int Price { get; set; }

    [JsonPropertyName("category")]
    public string Category { get; set; } = string.Empty;

    [JsonPropertyName("image")]
    public string? Image { get; set; }

    [JsonPropertyName("description")]
    public string? Description { get; set; }
}

public class ChatResponse
{
    [JsonPropertyName("reply")]
    public string Reply { get; set; } = string.Empty;

    [JsonPropertyName("intent")]
    public string Intent { get; set; } = "general";

    [JsonPropertyName("suggestions")]
    public List<string> Suggestions { get; set; } = new();

    [JsonPropertyName("vouchers")]
    public List<ChatVoucherItemDto>? Vouchers { get; set; }

    [JsonPropertyName("products")]
    public List<ChatProductCardDto>? Products { get; set; }

    [JsonPropertyName("recommendedSize")]
    public string? RecommendedSize { get; set; }
}
