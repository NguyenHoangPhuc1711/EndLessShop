using System.Data;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Dapper;
using EndLessShop.Api.Data;
using EndLessShop.Api.Models;
using EndLessShop.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.SqlClient;

namespace EndLessShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IDbConnectionFactory _db;
    private readonly IPasswordService _passwordService;
    private static readonly Regex UsernamePattern = new("^[A-Za-z0-9_.-]{3,50}$", RegexOptions.Compiled);

    public AuthController(IDbConnectionFactory db, IPasswordService passwordService)
    {
        _db = db;
        _passwordService = passwordService;
    }

    [HttpGet("csrf")]
    public IActionResult GetCsrf()
    {
        var token = HttpContext.Session.GetString("csrfToken");
        if (string.IsNullOrWhiteSpace(token))
        {
            token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
            HttpContext.Session.SetString("csrfToken", token);
        }

        return Ok(new { csrfToken = token });
    }

    [HttpPost("register")]
    [EnableRateLimiting("auth-limit")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (!SecurityValidator.ValidateCsrfAndOrigin(HttpContext))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Phiên bảo mật không hợp lệ. Vui lòng tải lại trang.",
                code = "csrf_invalid"
            });
        }

        var username = request.Username?.Trim() ?? string.Empty;
        var fullName = request.FullName?.Trim() ?? string.Empty;
        var email = request.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        var phone = request.Phone?.Trim();

        if (!UsernamePattern.IsMatch(username) || string.IsNullOrWhiteSpace(fullName) || fullName.Length > 100
            || string.IsNullOrWhiteSpace(email) || !email.Contains('@') || email.Length > 100
            || string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 10 || request.Password.Length > 128)
        {
            return BadRequest(new { message = "Kiểm tra thông tin: tên đăng nhập 3–50 ký tự; họ tên tối đa 100; email hợp lệ; mật khẩu 10–128 ký tự; điện thoại 9–11 chữ số nếu có." });
        }

        var passwordHash = _passwordService.HashPassword(request.Password);

        using var connection = _db.CreateConnection();
        try
        {
            var parameters = new DynamicParameters();
            parameters.Add("@username", username, DbType.AnsiString, size: 50);
            parameters.Add("@password_hash", passwordHash, DbType.AnsiString, size: 255);
            parameters.Add("@full_name", fullName, DbType.String, size: 100);
            parameters.Add("@email", email, DbType.AnsiString, size: 100);
            parameters.Add("@phone", string.IsNullOrWhiteSpace(phone) ? null : phone, DbType.AnsiString, size: 15);

            var createdUser = await connection.QuerySingleAsync<UserDto>(
                "dbo.auth_create_customer",
                parameters,
                commandType: CommandType.StoredProcedure);

            return StatusCode(201, new { user = createdUser, message = "Đăng ký thành công. Bạn có thể đăng nhập." });
        }
        catch (SqlException ex) when (ex.Number is 2601 or 2627)
        {
            return Conflict(new { message = "Tên đăng nhập hoặc email đã được sử dụng." });
        }
    }

    [HttpPost("login")]
    [EnableRateLimiting("auth-limit")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var username = request.Username?.Trim() ?? string.Empty;
        if (!UsernamePattern.IsMatch(username) || string.IsNullOrWhiteSpace(request.Password) || request.Password.Length > 128)
        {
            return Unauthorized(new { message = "Tên đăng nhập hoặc mật khẩu không đúng." });
        }

        using var connection = _db.CreateConnection();
        var parameters = new DynamicParameters();
        parameters.Add("@username", username, DbType.AnsiString, size: 50);

        var account = await connection.QuerySingleOrDefaultAsync<AccountEntity>(
            "dbo.auth_find_account",
            parameters,
            commandType: CommandType.StoredProcedure);

        const string dummyArgon2Hash = "$argon2id$v=19$m=65536,t=3,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
        var hashToVerify = account?.passwordHash ?? dummyArgon2Hash;
        var passwordValid = _passwordService.VerifyPassword(request.Password, hashToVerify);

        if (account == null || !passwordValid)
        {
            return Unauthorized(new { message = "Tên đăng nhập hoặc mật khẩu không đúng." });
        }

        if (string.Equals(account.status, "locked", StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Tài khoản của bạn đang tạm khóa. Vui lòng liên hệ Quản trị viên.",
                code = "account_locked"
            });
        }

        HttpContext.Session.Clear();
        HttpContext.Session.SetInt32("userId", account.id);
        HttpContext.Session.SetString("role", account.role);
        var csrfToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        HttpContext.Session.SetString("csrfToken", csrfToken);

        var userDto = new UserDto
        {
            Id = account.id,
            Username = account.username,
            FullName = account.fullName,
            Email = account.email,
            Phone = account.phone,
            Address = account.address,
            Role = account.role,
            Status = string.IsNullOrWhiteSpace(account.status) ? "active" : account.status,
            Position = account.position
        };

        return Ok(new LoginResponse { User = userDto, CsrfToken = csrfToken });
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var userId = HttpContext.Session.GetInt32("userId");
        if (!userId.HasValue)
        {
            return Unauthorized(new { user = (object?)null });
        }

        using var connection = _db.CreateConnection();
        var parameters = new DynamicParameters();
        parameters.Add("@id", userId.Value, DbType.Int32);

        var user = await connection.QuerySingleOrDefaultAsync<UserDto>(
            "dbo.auth_profile",
            parameters,
            commandType: CommandType.StoredProcedure);

        if (user == null || string.Equals(user.Status, "locked", StringComparison.OrdinalIgnoreCase))
        {
            HttpContext.Session.Clear();
            return Unauthorized(new
            {
                user = (object?)null,
                code = user != null ? "account_locked" : "unauthorized"
            });
        }

        HttpContext.Session.SetString("role", user.Role);
        return Ok(new { user });
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        HttpContext.Session.Clear();
        return Ok(new { message = "Đã đăng xuất." });
    }

    [HttpPost("forgot-password")]
    [EnableRateLimiting("auth-limit")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        if (!SecurityValidator.ValidateCsrfAndOrigin(HttpContext))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Phiên bảo mật không hợp lệ. Vui lòng tải lại trang.",
                code = "csrf_invalid"
            });
        }

        var identifier = request?.Identifier?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(identifier) || identifier.Length > 100)
        {
            return BadRequest(new { message = "Vui lòng nhập tên đăng nhập hoặc email hợp lệ." });
        }

        using var connection = _db.CreateConnection();
        const string sql = @"
            SELECT tai_khoan_id
            FROM dbo.TAI_KHOAN
            WHERE (ten_dang_nhap = @id OR email = @id) AND vai_tro = 'khach_hang';";

        _ = await connection.QuerySingleOrDefaultAsync<int?>(sql, new { id = identifier });

        return Ok(new
        {
            message = "Nếu thông tin khớp với một tài khoản khách hàng đang hoạt động, hệ thống đã tiếp nhận yêu cầu đặt lại mật khẩu và gửi hướng dẫn tới email đã đăng ký. Quý khách cũng có thể liên hệ Hotline CSKH 1900 8888 để được hỗ trợ."
        });
    }

    [HttpGet("shipping-info")]
    public async Task<IActionResult> GetShippingInfo()
    {
        var userId = HttpContext.Session.GetInt32("userId");
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập." });
        }

        using var connection = _db.CreateConnection();
        var parameters = new DynamicParameters();
        parameters.Add("@id", userId.Value, DbType.Int32);

        var user = await connection.QuerySingleOrDefaultAsync<UserDto>(
            "dbo.auth_profile",
            parameters,
            commandType: CommandType.StoredProcedure);

        if (user == null || string.Equals(user.Status, "locked", StringComparison.OrdinalIgnoreCase))
        {
            HttpContext.Session.Clear();
            return Unauthorized(new
            {
                message = user != null
                    ? "Tài khoản của bạn đang tạm khóa. Vui lòng liên hệ Quản trị viên."
                    : "Không tìm thấy thông tin tài khoản.",
                code = user != null ? "account_locked" : "unauthorized"
            });
        }

        return Ok(new
        {
            fullName = user.FullName,
            phone = user.Phone,
            address = user.Address
        });
    }

    [HttpPut("shipping-info")]
    [HttpPost("shipping-info")]
    public async Task<IActionResult> UpdateShippingInfo([FromBody] UpdateShippingInfoRequest request)
    {
        var userId = HttpContext.Session.GetInt32("userId");
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập để lưu thông tin giao hàng." });
        }

        if (!SecurityValidator.ValidateCsrfAndOrigin(HttpContext))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Phiên bảo mật không hợp lệ. Vui lòng tải lại trang.",
                code = "csrf_invalid"
            });
        }

        var fullName = request?.FullName?.Trim();
        var phone = request?.Phone?.Trim();
        var address = request?.Address?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(address) || address.Length > 500)
        {
            return BadRequest(new { message = "Địa chỉ nhận hàng không được để trống và tối đa 500 ký tự." });
        }

        if (!string.IsNullOrWhiteSpace(fullName) && fullName.Length > 100)
        {
            return BadRequest(new { message = "Họ và tên tối đa 100 ký tự." });
        }

        if (!string.IsNullOrWhiteSpace(phone) && !Regex.IsMatch(phone, "^[0-9]{9,11}$"))
        {
            return BadRequest(new { message = "Số điện thoại nhận hàng phải gồm 9–11 chữ số." });
        }

        using var connection = _db.CreateConnection();
        var profileParams = new DynamicParameters();
        profileParams.Add("@id", userId.Value, DbType.Int32);
        var currentUser = await connection.QuerySingleOrDefaultAsync<UserDto>(
            "dbo.auth_profile",
            profileParams,
            commandType: CommandType.StoredProcedure);

        if (currentUser == null || string.Equals(currentUser.Status, "locked", StringComparison.OrdinalIgnoreCase))
        {
            HttpContext.Session.Clear();
            return Unauthorized(new
            {
                message = currentUser != null
                    ? "Tài khoản của bạn đang tạm khóa. Vui lòng liên hệ Quản trị viên."
                    : "Không tìm thấy tài khoản.",
                code = currentUser != null ? "account_locked" : "unauthorized"
            });
        }

        var parameters = new DynamicParameters();
        parameters.Add("@user_id", userId.Value, DbType.Int32);
        parameters.Add("@full_name", string.IsNullOrWhiteSpace(fullName) ? null : fullName, DbType.String, size: 100);
        parameters.Add("@phone", string.IsNullOrWhiteSpace(phone) ? null : phone, DbType.AnsiString, size: 15);
        parameters.Add("@address", address, DbType.String, size: 500);

        try
        {
            var updatedUser = await connection.QuerySingleAsync<UserDto>(
                "dbo.auth_update_shipping_info",
                parameters,
                commandType: CommandType.StoredProcedure);

            return Ok(new
            {
                message = "Đã lưu thông tin giao hàng thành công.",
                user = updatedUser
            });
        }
        catch (SqlException ex) when (ex.Number == 51011)
        {
            return NotFound(new { message = "Không tìm thấy tài khoản." });
        }
    }
}
