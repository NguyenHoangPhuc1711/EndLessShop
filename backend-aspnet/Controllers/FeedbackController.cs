using Dapper;
using EndLessShop.Api.Data;
using EndLessShop.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace EndLessShop.Api.Controllers;

public record FeedbackRequest(int Rating, string? Content);

[ApiController]
[Route("api/[controller]")]
public class FeedbackController : ControllerBase
{
    private readonly IDbConnectionFactory _db;

    public FeedbackController(IDbConnectionFactory db) => _db = db;

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] FeedbackRequest request)
    {
        var userId = HttpContext.Session.GetInt32("userId");
        if (userId is null)
            return Unauthorized(new { message = "Vui lòng đăng nhập để gửi phản hồi.", code = "unauthorized" });
        if (!SecurityValidator.ValidateCsrfAndOrigin(HttpContext))
            return StatusCode(403, new { message = "Phiên bảo mật không hợp lệ. Vui lòng tải lại trang.", code = "csrf_invalid" });

        var content = request.Content?.Trim() ?? string.Empty;
        if (request.Rating < 1 || request.Rating > 5 || content.Length < 5 || content.Length > 1000)
            return BadRequest(new { message = "Vui lòng chọn số sao và nhập nội dung từ 5 đến 1000 ký tự.", code = "invalid_feedback" });

        using var connection = _db.CreateConnection();
        await connection.ExecuteAsync(
            "INSERT dbo.PHAN_HOI(tai_khoan_id, so_sao, noi_dung) VALUES(@userId, @rating, @content);",
            new { userId, rating = request.Rating, content });
        return Ok(new { message = "Cảm ơn bạn đã gửi phản hồi cho Endless!" });
    }
}
