using Dapper;
using EndLessShop.Api.Data;
using Microsoft.AspNetCore.Mvc;

namespace EndLessShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly IDbConnectionFactory _db;
    private readonly ILogger<HealthController> _logger;

    public HealthController(IDbConnectionFactory db, ILogger<HealthController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> CheckHealth()
    {
        try
        {
            using var connection = _db.CreateConnection();
            await connection.ExecuteScalarAsync<int>("SELECT 1;");
            return Ok(new { status = "ok" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Health check database connection failed");
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new 
            { 
                status = "error", 
                message = "Dịch vụ cơ sở dữ liệu tạm thời không khả dụng." 
            });
        }
    }
}
