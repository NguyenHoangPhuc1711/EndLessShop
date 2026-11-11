using System.Data;
using System.Security.Cryptography;
using System.Text.Json;
using Dapper;
using EndLessShop.Api.Data;
using EndLessShop.Api.Models;
using EndLessShop.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace EndLessShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private readonly IDbConnectionFactory _db;
    private readonly IPasswordService _passwordService;

    public AdminController(IDbConnectionFactory db, IPasswordService passwordService)
    {
        _db = db;
        _passwordService = passwordService;
    }

    private async Task<(bool Authorized, IActionResult? ErrorResult)> CheckAdminAccessAsync(bool requireCsrf = false)
    {
        var userId = HttpContext.Session.GetInt32("userId");
        if (!userId.HasValue)
        {
            return (false, StatusCode(StatusCodes.Status401Unauthorized, new 
            { 
                message = "Vui lòng đăng nhập tài khoản quản trị.", 
                code = "unauthorized" 
            }));
        }

        var role = HttpContext.Session.GetString("role");
        if (string.IsNullOrWhiteSpace(role))
        {
            using var connection = _db.CreateConnection();
            var parameters = new DynamicParameters();
            parameters.Add("@id", userId.Value, DbType.Int32);
            var user = await connection.QuerySingleOrDefaultAsync<UserDto>(
                "dbo.auth_profile",
                parameters,
                commandType: CommandType.StoredProcedure);

            if (user != null && !string.IsNullOrWhiteSpace(user.Role))
            {
                role = user.Role;
                HttpContext.Session.SetString("role", role);
            }
        }

        if (!string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
        {
            return (false, StatusCode(StatusCodes.Status403Forbidden, new 
            { 
                message = "Bạn không có quyền truy cập quản trị.", 
                code = "forbidden" 
            }));
        }

        if (requireCsrf)
        {
            if (!SecurityValidator.ValidateCsrfAndOrigin(HttpContext))
            {
                return (false, StatusCode(StatusCodes.Status403Forbidden, new 
                { 
                    message = "Phiên bảo mật không hợp lệ. Vui lòng tải lại trang.", 
                    code = "csrf_invalid" 
                }));
            }
        }

        return (true, null);
    }

    [HttpGet("metrics")]
    public async Task<IActionResult> GetMetrics()
    {
        var (authorized, errorResult) = await CheckAdminAccessAsync(requireCsrf: false);
        if (!authorized) return errorResult!;

        const string sql = @"
            SELECT 
                (SELECT ISNULL(SUM(tong_tien), 0) FROM dbo.HOA_DON WHERE CONVERT(DATE, ngay_dat) = CONVERT(DATE, GETDATE())) AS revenueToday,
                (SELECT COUNT(*) FROM dbo.HOA_DON WHERE trang_thai = 'cho_xu_ly') AS pendingOrders,
                (SELECT COUNT(*) FROM dbo.SAN_PHAM WHERE ton_kho <= 5) AS lowStockCount,
                (SELECT ISNULL(SUM(ton_kho), 0) FROM dbo.SAN_PHAM) AS totalStock,
                (SELECT COUNT(*) FROM dbo.VOUCHER WHERE han_su_dung IS NULL OR han_su_dung > GETDATE()) AS activeVouchers;";

        using var connection = _db.CreateConnection();
        var metrics = await connection.QuerySingleAsync(sql);
        return Ok(metrics);
    }

    [HttpPut("orders/{id:int}/status")]
    public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] UpdateStatusRequest request)
    {
        var (authorized, errorResult) = await CheckAdminAccessAsync(requireCsrf: true);
        if (!authorized) return errorResult!;

        if (string.IsNullOrWhiteSpace(request.Status))
        {
            return BadRequest(new { message = "Trạng thái không được để trống." });
        }

        var allowed = new[] { "cho_xu_ly", "dang_giao", "hoan_thanh", "da_huy" };
        if (!allowed.Contains(request.Status))
        {
            return BadRequest(new { message = "Trạng thái không hợp lệ." });
        }

        using var connection = _db.CreateConnection();
        var affected = await connection.ExecuteScalarAsync<int>(
            "dbo.admin_update_order_status", 
            new { id, status = request.Status }, 
            commandType: CommandType.StoredProcedure);

        if (affected == 0)
        {
            return NotFound(new { message = "Không tìm thấy hóa đơn cần cập nhật." });
        }

        return Ok(new { message = "Cập nhật trạng thái thành công.", orderId = id, status = request.Status });
    }

    [HttpPut("products/{id:int}/stock")]
    public async Task<IActionResult> UpdateProductStock(int id, [FromBody] UpdateStockRequest request)
    {
        var (authorized, errorResult) = await CheckAdminAccessAsync(requireCsrf: true);
        if (!authorized) return errorResult!;

        if (request.Stock < 0)
        {
            return BadRequest(new { message = "Số lượng tồn kho không được âm." });
        }

        using var connection = _db.CreateConnection();
        var affected = await connection.ExecuteScalarAsync<int>(
            "dbo.admin_update_stock", 
            new { id, stock = request.Stock }, 
            commandType: CommandType.StoredProcedure);

        if (affected == 0)
        {
            return NotFound(new { message = "Không tìm thấy sản phẩm." });
        }

        return Ok(new { message = "Cập nhật tồn kho thành công.", productId = id, stock = request.Stock });
    }

    [HttpGet("vouchers")]
    public async Task<IActionResult> GetVouchers()
    {
        var (authorized, errorResult) = await CheckAdminAccessAsync(requireCsrf: false);
        if (!authorized) return errorResult!;

        const string sql = "SELECT voucher_id, ma_code, loai_giam, gia_tri, han_su_dung FROM dbo.VOUCHER ORDER BY voucher_id;";
        using var connection = _db.CreateConnection();
        var vouchers = await connection.QueryAsync(sql);
        return Ok(new { vouchers });
    }

    [HttpPost("vouchers")]
    public async Task<IActionResult> CreateVoucher([FromBody] CreateVoucherRequest request)
    {
        var (authorized, errorResult) = await CheckAdminAccessAsync(requireCsrf: true);
        if (!authorized) return errorResult!;

        if (request == null)
        {
            return BadRequest(new { message = "Dữ liệu yêu cầu không hợp lệ." });
        }

        var code = (request.Code ?? string.Empty).Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(code) || !System.Text.RegularExpressions.Regex.IsMatch(code, "^[A-Z0-9_-]{1,30}$"))
        {
            return BadRequest(new { message = "Mã voucher không hợp lệ. Chỉ chấp nhận chữ in hoa, số và dấu gạch nối (1-30 ký tự)." });
        }

        var type = (request.Type ?? string.Empty).Trim().ToLowerInvariant();
        if (type != "percent" && type != "fixed")
        {
            return BadRequest(new { message = "Loại giảm giá không hợp lệ. Vui lòng chọn 'percent' hoặc 'fixed'." });
        }

        if (type == "percent")
        {
            if (request.Value < 1 || request.Value > 100)
            {
                return BadRequest(new { message = "Phần trăm giảm giá phải từ 1% đến 100%." });
            }
        }
        else
        {
            if (request.Value <= 0 || request.Value > 100_000_000)
            {
                return BadRequest(new { message = "Số tiền giảm phải lớn hơn 0₫ và tối đa 100.000.000₫." });
            }
        }

        DateTime? expiresAt = null;
        if (request.ExpiresAt.HasValue)
        {
            expiresAt = request.ExpiresAt.Value;
            if (expiresAt.Value < DateTime.UtcNow.AddMinutes(-5))
            {
                return BadRequest(new { message = "Ngày hết hạn không được ở trong quá khứ." });
            }
        }

        using var connection = _db.CreateConnection();

        const string checkSql = "SELECT COUNT(*) FROM dbo.VOUCHER WHERE ma_code = @code;";
        var existingCount = await connection.ExecuteScalarAsync<int>(checkSql, new { code });
        if (existingCount > 0)
        {
            return Conflict(new { message = $"Mã voucher '{code}' đã tồn tại trong hệ thống." });
        }

        const string insertSql = @"
            INSERT INTO dbo.VOUCHER (ma_code, loai_giam, gia_tri, han_su_dung)
            OUTPUT INSERTED.voucher_id, INSERTED.ma_code, INSERTED.loai_giam, INSERTED.gia_tri, INSERTED.han_su_dung
            VALUES (@code, @type, @value, @expiresAt);";

        var inserted = await connection.QuerySingleOrDefaultAsync(insertSql, new
        {
            code,
            type,
            value = request.Value,
            expiresAt
        });

        return StatusCode(StatusCodes.Status201Created, new
        {
            message = "Tạo mã giảm giá mới thành công.",
            voucher = inserted
        });
    }

    [HttpDelete("vouchers/{id:int}")]
    public async Task<IActionResult> DeleteVoucher(int id)
    {
        var (authorized, errorResult) = await CheckAdminAccessAsync(requireCsrf: true);
        if (!authorized) return errorResult!;

        using var connection = _db.CreateConnection();

        var voucher = await connection.QuerySingleOrDefaultAsync<dynamic>(
            "SELECT voucher_id, ma_code FROM dbo.VOUCHER WHERE voucher_id = @id;", new { id });
        if (voucher == null)
        {
            return NotFound(new { message = "Không tìm thấy mã voucher cần xóa." });
        }

        var usedCount = await connection.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM dbo.HOA_DON WHERE voucher_id = @id;", new { id });
        if (usedCount > 0)
        {
            return BadRequest(new { message = $"Mã voucher này đã được áp dụng trong {usedCount} đơn hàng, không thể xóa để đảm bảo toàn vẹn dữ liệu lịch sử." });
        }

        await connection.ExecuteAsync("DELETE FROM dbo.VOUCHER WHERE voucher_id = @id;", new { id });
        return Ok(new { message = "Xóa mã voucher thành công.", voucherId = id });
    }

    [HttpGet("customers")]
    public async Task<IActionResult> GetCustomers()
    {
        var (authorized, errorResult) = await CheckAdminAccessAsync(requireCsrf: false);
        if (!authorized) return errorResult!;

        const string sql = @"
            SELECT 
                tai_khoan_id, 
                ten_dang_nhap, 
                ho_ten, 
                email, 
                sdt, 
                vai_tro
            FROM dbo.TAI_KHOAN 
            ORDER BY tai_khoan_id DESC;";

        using var connection = _db.CreateConnection();
        var customers = await connection.QueryAsync(sql);
        return Ok(new { customers });
    }

    [HttpPost("customers/{id:int}/reset-password")]
    public async Task<IActionResult> ResetCustomerPassword(int id, [FromBody] ResetCustomerPasswordRequest? request)
    {
        var (authorized, errorResult) = await CheckAdminAccessAsync(requireCsrf: true);
        if (!authorized) return errorResult!;

        using var connection = _db.CreateConnection();
        const string findSql = @"
            SELECT tai_khoan_id, ten_dang_nhap, ho_ten, email, vai_tro
            FROM dbo.TAI_KHOAN
            WHERE tai_khoan_id = @id;";

        var customer = await connection.QuerySingleOrDefaultAsync<dynamic>(findSql, new { id });
        if (customer == null)
        {
            return NotFound(new { message = $"Không tìm thấy tài khoản khách hàng có ID #{id}." });
        }

        string role = (string)customer.vai_tro;
        if (string.Equals(role, "admin", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Tính năng này chỉ áp dụng cho tài khoản khách hàng, không thể đặt lại mật khẩu cho tài khoản quản trị viên tại đây." });
        }

        var newPassword = request?.NewPassword?.Trim();
        if (string.IsNullOrWhiteSpace(newPassword))
        {
            // Auto generate strong random temporary password if none provided
            const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
            var randomBytes = RandomNumberGenerator.GetBytes(8);
            var randomPart = new char[8];
            for (int i = 0; i < 8; i++)
            {
                randomPart[i] = chars[randomBytes[i] % chars.Length];
            }
            newPassword = "Endless@" + new string(randomPart);
        }
        else if (newPassword.Length < 10 || newPassword.Length > 128)
        {
            return BadRequest(new { message = "Mật khẩu mới phải có độ dài từ 10 đến 128 ký tự." });
        }

        var passwordHash = _passwordService.HashPassword(newPassword);

        const string updateSql = @"
            UPDATE dbo.TAI_KHOAN
            SET mat_khau = @hash
            WHERE tai_khoan_id = @id;";

        await connection.ExecuteAsync(updateSql, new { id, hash = passwordHash });

        return Ok(new
        {
            message = $"Đã khôi phục mật khẩu thành công cho tài khoản '{customer.ten_dang_nhap}'.",
            customerId = (int)customer.tai_khoan_id,
            username = (string)customer.ten_dang_nhap,
            fullName = (string)(customer.ho_ten ?? ""),
            newPassword,
            resetAt = DateTime.UtcNow
        });
    }

    [HttpGet("orders")]
    public async Task<IActionResult> GetOrders()
    {
        var (authorized, errorResult) = await CheckAdminAccessAsync(requireCsrf: false);
        if (!authorized) return errorResult!;

        const string sql = @"
            SELECT 
                h.hoa_don_id AS id,
                h.ma_don AS code,
                h.ngay_dat AS date,
                h.trang_thai AS status,
                h.phuong_thuc_thanh_toan AS payment,
                h.tam_tinh AS subtotal,
                h.tien_giam AS discount,
                h.tong_tien AS total,
                COALESCE(h.ma_voucher, v.ma_code) AS voucherCode,
                h.ten_nguoi_nhan AS fullName,
                h.sdt_nguoi_nhan AS phone,
                h.dia_chi AS address,
                h.ghi_chu AS note,
                (SELECT COUNT(*) FROM dbo.CHI_TIET_HOA_DON d WHERE d.hoa_don_id = h.hoa_don_id) AS itemCount
            FROM dbo.HOA_DON h
            LEFT JOIN dbo.VOUCHER v ON v.voucher_id = h.voucher_id
            ORDER BY h.hoa_don_id DESC;";

        using var connection = _db.CreateConnection();
        var orders = await connection.QueryAsync(sql);
        return Ok(new { orders });
    }

    [HttpGet("orders/{id:int}")]
    public async Task<IActionResult> GetOrderDetail(int id)
    {
        var (authorized, errorResult) = await CheckAdminAccessAsync(requireCsrf: false);
        if (!authorized) return errorResult!;

        const string headerSql = @"
            SELECT 
                h.hoa_don_id AS id,
                h.ma_don AS code,
                h.ngay_dat AS date,
                h.trang_thai AS status,
                h.phuong_thuc_thanh_toan AS payment,
                h.tam_tinh AS subtotal,
                h.tien_giam AS discount,
                h.tong_tien AS total,
                COALESCE(h.ma_voucher, v.ma_code) AS voucherCode,
                h.ten_nguoi_nhan AS fullName,
                h.sdt_nguoi_nhan AS phone,
                h.dia_chi AS address,
                h.ghi_chu AS note
            FROM dbo.HOA_DON h
            LEFT JOIN dbo.VOUCHER v ON v.voucher_id = h.voucher_id
            WHERE h.hoa_don_id = @id;";

        const string itemsSql = @"
            SELECT 
                d.chi_tiet_id AS id,
                d.san_pham_id AS productId,
                COALESCE(d.ten_sp, p.ten_sp) AS name,
                COALESCE(d.anh_sp, p.images_json) AS image,
                d.size,
                d.mau AS color,
                d.so_luong AS qty,
                d.don_gia AS price
            FROM dbo.CHI_TIET_HOA_DON d
            LEFT JOIN dbo.SAN_PHAM p ON p.san_pham_id = d.san_pham_id
            WHERE d.hoa_don_id = @id
            ORDER BY d.chi_tiet_id;";

        using var connection = _db.CreateConnection();
        var order = await connection.QuerySingleOrDefaultAsync(headerSql, new { id });
        if (order == null)
        {
            return NotFound(new { message = $"Không tìm thấy đơn hàng #{id}." });
        }

        var items = await connection.QueryAsync(itemsSql, new { id });
        return Ok(new { order, items });
    }

    [HttpPost("products")]
    public async Task<IActionResult> CreateProduct([FromBody] CreateProductRequest request)
    {
        var (authorized, errorResult) = await CheckAdminAccessAsync(requireCsrf: true);
        if (!authorized) return errorResult!;

        var name = request.Name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(name) || name.Length < 2 || name.Length > 150)
        {
            return BadRequest(new { message = "Tên sản phẩm phải từ 2 đến 150 ký tự." });
        }

        var cat = (request.Category?.Trim() ?? "ao").ToLowerInvariant();
        var allowedCategories = new[] { "ao", "quan", "vay", "phukien" };
        if (!allowedCategories.Contains(cat))
        {
            return BadRequest(new { message = "Danh mục không hợp lệ. Chỉ chấp nhận: ao, quan, vay hoặc phukien." });
        }

        if (request.Price <= 0 || request.Price > 50_000_000)
        {
            return BadRequest(new { message = "Giá sản phẩm phải lớn hơn 0 và tối đa 50.000.000₫." });
        }

        if (request.Stock < 0 || request.Stock > 100_000)
        {
            return BadRequest(new { message = "Số lượng tồn kho không được âm." });
        }

        using var connection = _db.CreateConnection();
        var catId = await connection.ExecuteScalarAsync<int?>(
            "SELECT danh_muc_id FROM dbo.DANH_MUC WHERE ma_danh_muc = @cat;", new { cat });
        if (!catId.HasValue)
        {
            catId = 1;
        }

        var sizes = request.Sizes != null && request.Sizes.Count > 0 
            ? request.Sizes 
            : new List<string> { "S", "M", "L", "XL" };
        var colors = request.Colors != null && request.Colors.Count > 0 
            ? request.Colors 
            : new List<string> { "Đen", "Trắng", "Xám" };
        var images = request.Images != null && request.Images.Count > 0 
            ? request.Images 
            : new List<string> { "../img/id1.jpg" };

        var sizesJson = JsonSerializer.Serialize(sizes);
        var colorsJson = JsonSerializer.Serialize(colors);
        var imagesJson = JsonSerializer.Serialize(images);

        var colorIndices = new Dictionary<string, int>();
        for (int i = 0; i < colors.Count; i++)
        {
            colorIndices[colors[i]] = images.Count > 0 ? (i % images.Count) : 0;
        }
        var colorIndicesJson = JsonSerializer.Serialize(colorIndices);

        const string insertSql = @"
            INSERT INTO dbo.SAN_PHAM(ten_sp, mo_ta, gia, ton_kho, danh_muc_id, sizes_json, colors_json, images_json, color_image_indices_json, la_moi)
            OUTPUT INSERTED.san_pham_id, INSERTED.ten_sp, INSERTED.gia, INSERTED.ton_kho, INSERTED.la_moi
            VALUES(@name, @desc, @price, @stock, @catId, @sizesJson, @colorsJson, @imagesJson, @colorIndicesJson, 1);";

        var inserted = await connection.QuerySingleAsync(insertSql, new
        {
            name,
            desc = request.Description?.Trim(),
            price = request.Price,
            stock = request.Stock,
            catId = catId.Value,
            sizesJson,
            colorsJson,
            imagesJson,
            colorIndicesJson
        });

        return StatusCode(StatusCodes.Status201Created, new
        {
            message = "Thêm sản phẩm mới thành công.",
            product = inserted
        });
    }

    [HttpDelete("products/{id:int}")]
    public async Task<IActionResult> DeleteProduct(int id)
    {
        var (authorized, errorResult) = await CheckAdminAccessAsync(requireCsrf: true);
        if (!authorized) return errorResult!;

        using var connection = _db.CreateConnection();
        var usedCount = await connection.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM dbo.CHI_TIET_HOA_DON WHERE san_pham_id = @id;", new { id });
        if (usedCount > 0)
        {
            return BadRequest(new { message = $"Sản phẩm này đã phát sinh trong {usedCount} đơn hàng, không thể xóa để bảo toàn lịch sử giao dịch." });
        }

        var affected = await connection.ExecuteAsync(
            "DELETE FROM dbo.SAN_PHAM WHERE san_pham_id = @id;", new { id });
        if (affected == 0)
        {
            return NotFound(new { message = "Không tìm thấy sản phẩm cần xóa." });
        }

        return Ok(new { message = "Xóa sản phẩm thành công.", productId = id });
    }

    public class CreateProductRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public int Price { get; set; }
        public int Stock { get; set; } = 50;
        public string? Description { get; set; }
        public List<string>? Sizes { get; set; }
        public List<string>? Colors { get; set; }
        public List<string>? Images { get; set; }
    }

    public class ResetCustomerPasswordRequest
    {
        public string? NewPassword { get; set; }
    }

    public class UpdateStatusRequest
    {
        public string Status { get; set; } = string.Empty;
    }

    public class UpdateStockRequest
    {
        public int Stock { get; set; }
    }

    public class CreateVoucherRequest
    {
        public string Code { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public int Value { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }
}
