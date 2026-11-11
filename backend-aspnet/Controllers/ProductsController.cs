using System.Text.Json;
using Dapper;
using EndLessShop.Api.Data;
using EndLessShop.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace EndLessShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ProductsController : ControllerBase
{
    private readonly IDbConnectionFactory _db;

    public ProductsController(IDbConnectionFactory db)
    {
        _db = db;
    }

    [HttpGet]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> GetProducts()
    {
        const string sql = @"
            SELECT p.san_pham_id, p.ten_sp, p.mo_ta, p.gia, p.ton_kho,
                   p.sizes_json, p.colors_json, p.images_json, p.color_image_indices_json, p.la_moi,
                   d.ma_danh_muc
            FROM dbo.SAN_PHAM AS p
            JOIN dbo.DANH_MUC AS d ON d.danh_muc_id = p.danh_muc_id
            ORDER BY p.san_pham_id;";

        using var connection = _db.CreateConnection();
        var rows = await connection.QueryAsync<ProductRawRow>(sql);

        var products = rows.Select(r =>
        {
            var sizes = !string.IsNullOrWhiteSpace(r.sizes_json)
                ? JsonSerializer.Deserialize<List<string>>(r.sizes_json) ?? new()
                : new();
            var colors = !string.IsNullOrWhiteSpace(r.colors_json)
                ? JsonSerializer.Deserialize<List<string>>(r.colors_json) ?? new()
                : new();
            var images = !string.IsNullOrWhiteSpace(r.images_json)
                ? JsonSerializer.Deserialize<List<string>>(r.images_json) ?? new()
                : new();
            var colorIndices = !string.IsNullOrWhiteSpace(r.color_image_indices_json)
                ? JsonSerializer.Deserialize<Dictionary<string, int>>(r.color_image_indices_json) ?? new()
                : new();

            for (int i = 0; i < colors.Count; i++)
            {
                var c = colors[i];
                if (!colorIndices.ContainsKey(c) || colorIndices[c] < 0 || (images.Count > 0 && colorIndices[c] >= images.Count))
                {
                    colorIndices[c] = images.Count > 0 ? (i % images.Count) : 0;
                }
            }

            return new ProductDto
            {
                Id = r.san_pham_id,
                Name = r.ten_sp,
                Category = r.ma_danh_muc,
                Price = r.gia,
                Stock = r.ton_kho,
                Sizes = sizes,
                Colors = colors,
                Images = images,
                ColorImageIndices = colorIndices,
                Description = r.mo_ta,
                IsNew = r.la_moi ?? false
            };
        }).ToList();

        return Ok(products);
    }

    [HttpGet("{id:int}")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> GetProductById(int id)
    {
        const string sql = @"
            SELECT p.san_pham_id, p.ten_sp, p.mo_ta, p.gia, p.ton_kho,
                   p.sizes_json, p.colors_json, p.images_json, p.color_image_indices_json, p.la_moi,
                   d.ma_danh_muc
            FROM dbo.SAN_PHAM AS p
            JOIN dbo.DANH_MUC AS d ON d.danh_muc_id = p.danh_muc_id
            WHERE p.san_pham_id = @id;";

        using var connection = _db.CreateConnection();
        var r = await connection.QuerySingleOrDefaultAsync<ProductRawRow>(sql, new { id });
        if (r == null)
        {
            return NotFound(new { message = "Không tìm thấy sản phẩm." });
        }

        var sizes = !string.IsNullOrWhiteSpace(r.sizes_json)
            ? JsonSerializer.Deserialize<List<string>>(r.sizes_json) ?? new()
            : new();
        var colors = !string.IsNullOrWhiteSpace(r.colors_json)
            ? JsonSerializer.Deserialize<List<string>>(r.colors_json) ?? new()
            : new();
        var images = !string.IsNullOrWhiteSpace(r.images_json)
            ? JsonSerializer.Deserialize<List<string>>(r.images_json) ?? new()
            : new();
        var colorIndices = !string.IsNullOrWhiteSpace(r.color_image_indices_json)
            ? JsonSerializer.Deserialize<Dictionary<string, int>>(r.color_image_indices_json) ?? new()
            : new();

        for (int i = 0; i < colors.Count; i++)
        {
            var c = colors[i];
            if (!colorIndices.ContainsKey(c) || colorIndices[c] < 0 || (images.Count > 0 && colorIndices[c] >= images.Count))
            {
                colorIndices[c] = images.Count > 0 ? (i % images.Count) : 0;
            }
        }

        var product = new ProductDto
        {
            Id = r.san_pham_id,
            Name = r.ten_sp,
            Category = r.ma_danh_muc,
            Price = r.gia,
            Stock = r.ton_kho,
            Sizes = sizes,
            Colors = colors,
            Images = images,
            ColorImageIndices = colorIndices,
            Description = r.mo_ta,
            IsNew = r.la_moi ?? false
        };

        return Ok(product);
    }
}
