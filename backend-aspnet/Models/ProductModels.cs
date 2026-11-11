using System.Text.Json.Serialization;

namespace EndLessShop.Api.Models;

public class ProductDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("category")]
    public string Category { get; set; } = string.Empty;

    [JsonPropertyName("price")]
    public int Price { get; set; }

    [JsonPropertyName("stock")]
    public int Stock { get; set; }

    [JsonPropertyName("sizes")]
    public List<string> Sizes { get; set; } = new();

    [JsonPropertyName("colors")]
    public List<string> Colors { get; set; } = new();

    [JsonPropertyName("images")]
    public List<string> Images { get; set; } = new();

    [JsonPropertyName("colorImageIndices")]
    public Dictionary<string, int> ColorImageIndices { get; set; } = new();

    [JsonPropertyName("description")]
    public string? Description { get; set; }

    [JsonPropertyName("isNew")]
    public bool IsNew { get; set; }
}

public class ProductRawRow
{
    public int san_pham_id { get; set; }
    public string ten_sp { get; set; } = string.Empty;
    public string? mo_ta { get; set; }
    public int gia { get; set; }
    public int ton_kho { get; set; }
    public string? sizes_json { get; set; }
    public string? colors_json { get; set; }
    public string? images_json { get; set; }
    public string? color_image_indices_json { get; set; }
    public bool? la_moi { get; set; }
    public string ma_danh_muc { get; set; } = string.Empty;
}
