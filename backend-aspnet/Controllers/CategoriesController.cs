using Dapper;
using EndLessShop.Api.Data;
using EndLessShop.Api.Models;
using Microsoft.AspNetCore.Mvc;

namespace EndLessShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly IDbConnectionFactory _db;

    public CategoriesController(IDbConnectionFactory db)
    {
        _db = db;
    }

    [HttpGet]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> GetCategories()
    {
        const string sql = @"
            SELECT d.danh_muc_id AS id,
                   d.ten_danh_muc AS name,
                   d.ma_danh_muc AS code,
                   d.mo_ta AS description,
                   ISNULL(d.thu_tu, 0) AS sortOrder,
                   CAST(ISNULL(d.hien_thi, 1) AS BIT) AS isVisible,
                   (SELECT COUNT(*) FROM dbo.SAN_PHAM p WHERE p.danh_muc_id = d.danh_muc_id) AS productCount
            FROM dbo.DANH_MUC d
            WHERE ISNULL(d.hien_thi, 1) = 1 AND d.ma_danh_muc IS NOT NULL
            ORDER BY ISNULL(d.thu_tu, 99), d.danh_muc_id;";

        using var connection = _db.CreateConnection();
        var categories = (await connection.QueryAsync<CategoryDto>(sql)).ToList();
        return Ok(new { categories });
    }
}
