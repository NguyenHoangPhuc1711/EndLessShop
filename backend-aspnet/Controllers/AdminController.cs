using System.Data;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using Dapper;
using EndLessShop.Api.Data;
using EndLessShop.Api.Models;
using EndLessShop.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace EndLessShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AdminController : ControllerBase
{
    private readonly IDbConnectionFactory _db;
    private readonly IPasswordService _passwordService;

    private static readonly Regex CategoryCodePattern = new("^[a-z][a-z0-9_]{0,19}$", RegexOptions.Compiled);
    private static readonly Regex UsernamePattern = new("^[A-Za-z0-9_.-]{3,50}$", RegexOptions.Compiled);
    private static readonly Regex PhonePattern = new("^[0-9]{9,11}$", RegexOptions.Compiled);

    public AdminController(IDbConnectionFactory db, IPasswordService passwordService)
    {
        _db = db;
        _passwordService = passwordService;
    }

    public static string NormalizeCategoryCode(string? raw)
    {
        var text = (raw ?? string.Empty).Trim().ToLowerInvariant();
        text = Regex.Replace(text, @"[\s-]+", "_");
        return Regex.Replace(text, @"_{2,}", "_").Trim('_');
    }

    public static bool IsValidCategoryCode(string? code)
        => !string.IsNullOrWhiteSpace(code) && CategoryCodePattern.IsMatch(code);

    private async Task<(bool Authorized, int UserId, string Role, IActionResult? ErrorResult)> CheckBackofficeAccessAsync(
        bool allowStaff = false,
        bool requireCsrf = false)
    {
        var userId = HttpContext.Session.GetInt32("userId");
        if (!userId.HasValue)
        {
            return (false, 0, string.Empty, StatusCode(StatusCodes.Status401Unauthorized, new
            {
                message = "Vui lòng đăng nhập tài khoản quản trị hoặc nhân viên.",
                code = "unauthorized"
            }));
        }

        using var connection = _db.CreateConnection();
        var parameters = new DynamicParameters();
        parameters.Add("@id", userId.Value, DbType.Int32);
        var user = await connection.QuerySingleOrDefaultAsync<UserDto>(
            "dbo.auth_profile",
            parameters,
            commandType: CommandType.StoredProcedure);

        if (user == null)
        {
            HttpContext.Session.Clear();
            return (false, 0, string.Empty, StatusCode(StatusCodes.Status401Unauthorized, new
            {
                message = "Phiên đăng nhập không còn hợp lệ.",
                code = "unauthorized"
            }));
        }

        if (string.Equals(user.Status, "locked", StringComparison.OrdinalIgnoreCase))
        {
            HttpContext.Session.Clear();
            return (false, 0, string.Empty, StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Tài khoản của bạn đang bị khóa. Vui lòng liên hệ Quản trị viên.",
                code = "account_locked"
            }));
        }

        var role = (user.Role ?? string.Empty).Trim().ToLowerInvariant();
        HttpContext.Session.SetString("role", role);

        var isAdmin = role == "admin";
        var isStaff = role == "nhan_vien";
        if (!isAdmin && !(allowStaff && isStaff))
        {
            return (false, userId.Value, role, StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Bạn không có quyền truy cập chức năng này.",
                code = "forbidden"
            }));
        }

        if (requireCsrf && !SecurityValidator.ValidateCsrfAndOrigin(HttpContext))
        {
            return (false, userId.Value, role, StatusCode(StatusCodes.Status403Forbidden, new
            {
                message = "Phiên bảo mật không hợp lệ. Vui lòng tải lại trang.",
                code = "csrf_invalid"
            }));
        }

        return (true, userId.Value, role, null);
    }

    [HttpGet("metrics")]
    public async Task<IActionResult> GetMetrics()
    {
        var (authorized, _, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: false, requireCsrf: false);
        if (!authorized) return errorResult!;

        const string sql = @"
            SELECT
                (SELECT ISNULL(SUM(tong_tien), 0) FROM dbo.HOA_DON WHERE CONVERT(DATE, ngay_dat) = CONVERT(DATE, GETDATE()) AND trang_thai <> 'da_huy') AS revenueToday,
                (SELECT COUNT(*) FROM dbo.HOA_DON WHERE trang_thai = 'cho_xu_ly') AS pendingOrders,
                (SELECT COUNT(*) FROM dbo.SAN_PHAM WHERE ton_kho <= 5) AS lowStockCount,
                (SELECT ISNULL(SUM(ton_kho), 0) FROM dbo.SAN_PHAM) AS totalStock,
                (SELECT COUNT(*) FROM dbo.VOUCHER WHERE han_su_dung IS NULL OR han_su_dung > GETDATE()) AS activeVouchers,
                (SELECT COUNT(*) FROM dbo.TAI_KHOAN WHERE vai_tro IN ('admin', 'nhan_vien')) AS totalStaff,
                (SELECT COUNT(*) FROM dbo.DANH_MUC) AS totalCategories;";

        using var connection = _db.CreateConnection();
        var metrics = await connection.QuerySingleAsync(sql);
        return Ok(metrics);
    }

    [HttpPut("orders/{id:int}/status")]
    public async Task<IActionResult> UpdateOrderStatus(int id, [FromBody] UpdateStatusRequest request)
    {
        var (authorized, currentUserId, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: true, requireCsrf: true);
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
            new { id, status = request.Status, staff_id = currentUserId },
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
        var (authorized, _, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: true, requireCsrf: true);
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
        var (authorized, _, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: false, requireCsrf: false);
        if (!authorized) return errorResult!;

        const string sql = "SELECT voucher_id, ma_code, loai_giam, gia_tri, han_su_dung FROM dbo.VOUCHER ORDER BY voucher_id;";
        using var connection = _db.CreateConnection();
        var vouchers = await connection.QueryAsync(sql);
        return Ok(new { vouchers });
    }

    [HttpPost("vouchers")]
    public async Task<IActionResult> CreateVoucher([FromBody] CreateVoucherRequest request)
    {
        var (authorized, _, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: false, requireCsrf: true);
        if (!authorized) return errorResult!;

        if (request == null)
        {
            return BadRequest(new { message = "Dữ liệu yêu cầu không hợp lệ." });
        }

        var code = (request.Code ?? string.Empty).Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(code) || !Regex.IsMatch(code, "^[A-Z0-9_-]{1,30}$"))
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
        var (authorized, _, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: false, requireCsrf: true);
        if (!authorized) return errorResult!;

        using var connection = _db.CreateConnection();

        var voucher = await connection.QuerySingleOrDefaultAsync<dynamic>(
            "SELECT voucher_id, ma_code FROM dbo.VOUCHER WHERE voucher_id = @id;", new { id });
        if (voucher == null)
        {
            return NotFound(new { message = "Không tìm thấy mã voucher cần xóa." });
        }

        var usedCount = await connection.ExecuteScalarAsync<int>(
            "SET QUOTED_IDENTIFIER ON; SELECT COUNT(*) FROM dbo.HOA_DON WHERE voucher_id = @id;", new { id });
        if (usedCount > 0)
        {
            return BadRequest(new { message = $"Mã voucher này đã được áp dụng trong {usedCount} đơn hàng, không thể xóa để đảm bảo toàn vẹn dữ liệu lịch sử." });
        }

        await connection.ExecuteAsync("DELETE FROM dbo.VOUCHER WHERE voucher_id = @id;", new { id });
        return Ok(new { message = "Xóa mã voucher thành công.", voucherId = id });
    }

    [HttpGet("feedback")]
    public async Task<IActionResult> GetFeedback()
    {
        var (authorized, _, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: true, requireCsrf: false);
        if (!authorized) return errorResult!;

        using var connection = _db.CreateConnection();
        var items = await connection.QueryAsync(@"
            SELECT p.phan_hoi_id AS id, t.ten_dang_nhap AS username, t.ho_ten AS fullName, t.sdt AS phone,
                   p.so_sao AS rating, p.noi_dung AS content, p.trang_thai AS status, p.ngay_tao AS createdAt
            FROM dbo.PHAN_HOI p
            JOIN dbo.TAI_KHOAN t ON t.tai_khoan_id = p.tai_khoan_id
            ORDER BY CASE p.trang_thai WHEN 'moi' THEN 0 ELSE 1 END, p.phan_hoi_id DESC;");
        return Ok(new { feedback = items });
    }

    [HttpPut("feedback/{id:int}/status")]
    public async Task<IActionResult> UpdateFeedbackStatus(int id, [FromBody] UpdateStatusRequest request)
    {
        var (authorized, currentUserId, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: true, requireCsrf: true);
        if (!authorized) return errorResult!;
        if (request.Status != "moi" && request.Status != "da_xu_ly")
            return BadRequest(new { message = "Trạng thái không hợp lệ.", code = "invalid_status" });

        using var connection = _db.CreateConnection();
        var affected = await connection.ExecuteAsync(
            "UPDATE dbo.PHAN_HOI SET trang_thai = @status, nhan_vien_id = @staff WHERE phan_hoi_id = @id;",
            new { id, status = request.Status, staff = currentUserId });
        if (affected == 0) return NotFound(new { message = "Không tìm thấy phản hồi.", code = "not_found" });
        return Ok(new { message = "Đã cập nhật phản hồi.", id, status = request.Status });
    }

    [HttpGet("customers")]
    public async Task<IActionResult> GetCustomers()
    {
        var (authorized, _, role, errorResult) = await CheckBackofficeAccessAsync(allowStaff: true, requireCsrf: false);
        if (!authorized) return errorResult!;

        using var connection = _db.CreateConnection();
        if (role == "nhan_vien")
        {
            const string staffViewSql = @"
                SELECT
                    tai_khoan_id,
                    ten_dang_nhap,
                    ho_ten,
                    email,
                    sdt,
                    dia_chi,
                    vai_tro,
                    ISNULL(trang_thai, 'active') AS trang_thai
                FROM dbo.TAI_KHOAN
                WHERE ISNULL(vai_tro, 'khach_hang') = 'khach_hang'
                ORDER BY tai_khoan_id DESC;";

            var customersForStaff = await connection.QueryAsync(staffViewSql);
            return Ok(new { customers = customersForStaff, viewerRole = role });
        }

        const string adminViewSql = @"
            SELECT
                tai_khoan_id,
                ten_dang_nhap,
                ho_ten,
                email,
                sdt,
                dia_chi,
                vai_tro,
                chuc_vu,
                ISNULL(trang_thai, 'active') AS trang_thai,
                ngay_tao
            FROM dbo.TAI_KHOAN
            ORDER BY tai_khoan_id DESC;";

        var customers = await connection.QueryAsync(adminViewSql);
        return Ok(new { customers, viewerRole = role });
    }

    [HttpPost("customers/{id:int}/reset-password")]
    public async Task<IActionResult> ResetCustomerPassword(int id, [FromBody] ResetCustomerPasswordRequest? request)
    {
        var (authorized, _, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: false, requireCsrf: true);
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

        string targetRole = (string)customer.vai_tro;
        if (string.Equals(targetRole, "admin", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "Tính năng này không áp dụng cho tài khoản quản trị viên." });
        }

        var newPassword = request?.NewPassword?.Trim();
        if (string.IsNullOrWhiteSpace(newPassword))
        {
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
        var (authorized, _, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: true, requireCsrf: false);
        if (!authorized) return errorResult!;

        const string sql = @"
            SET QUOTED_IDENTIFIER ON;
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
        var (authorized, _, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: true, requireCsrf: false);
        if (!authorized) return errorResult!;

        const string headerSql = @"
            SET QUOTED_IDENTIFIER ON;
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
        var (authorized, _, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: false, requireCsrf: true);
        if (!authorized) return errorResult!;

        var name = request.Name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(name) || name.Length < 2 || name.Length > 150)
        {
            return BadRequest(new { message = "Tên sản phẩm phải từ 2 đến 150 ký tự." });
        }

        var cat = NormalizeCategoryCode(request.Category);
        if (!IsValidCategoryCode(cat))
        {
            return BadRequest(new { message = "Mã danh mục không hợp lệ." });
        }

        if (request.Price <= 0 || request.Price > 50_000_000)
        {
            return BadRequest(new { message = "Giá sản phẩm phải lớn hơn 0 và tối đa 50.000.000₫." });
        }

        if (request.OriginalPrice.HasValue && (request.OriginalPrice.Value <= request.Price || request.OriginalPrice.Value > 100_000_000))
        {
            return BadRequest(new { message = "Giá gốc trước giảm phải lớn hơn giá bán hiện tại." });
        }

        if (request.Stock < 0 || request.Stock > 100_000)
        {
            return BadRequest(new { message = "Số lượng tồn kho không được âm." });
        }

        using var connection = _db.CreateConnection();
        var catId = await connection.ExecuteScalarAsync<int?>(
            "SET QUOTED_IDENTIFIER ON; SELECT danh_muc_id FROM dbo.DANH_MUC WHERE ma_danh_muc = @cat;", new { cat });
        if (!catId.HasValue)
        {
            return BadRequest(new { message = $"Danh mục '{cat}' không tồn tại trong hệ thống." });
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

        string? bundleItemsJson = null;
        if (request.BundleItems != null && request.BundleItems.Count > 0)
        {
            var validIds = request.BundleItems.Where(id => id > 0).Distinct().ToList();
            if (validIds.Count > 0)
            {
                bundleItemsJson = JsonSerializer.Serialize(validIds);
            }
        }

        const string insertSql = @"
            SET QUOTED_IDENTIFIER ON;
            INSERT INTO dbo.SAN_PHAM(ten_sp, mo_ta, gia, gia_goc, bundle_items_json, ton_kho, danh_muc_id, sizes_json, colors_json, images_json, color_image_indices_json, la_moi)
            OUTPUT INSERTED.san_pham_id, INSERTED.ten_sp, INSERTED.gia, INSERTED.gia_goc, INSERTED.ton_kho, INSERTED.la_moi
            VALUES(@name, @desc, @price, @originalPrice, @bundleItemsJson, @stock, @catId, @sizesJson, @colorsJson, @imagesJson, @colorIndicesJson, 1);";

        var inserted = await connection.QuerySingleAsync(insertSql, new
        {
            name,
            desc = request.Description?.Trim(),
            price = request.Price,
            originalPrice = request.OriginalPrice,
            bundleItemsJson,
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
        var (authorized, _, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: false, requireCsrf: true);
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

    /* ================= DYNAMIC CATEGORY MANAGEMENT (ADMIN ONLY) ================= */

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories()
    {
        var (authorized, _, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: false, requireCsrf: false);
        if (!authorized) return errorResult!;

        const string sql = @"
            SELECT d.danh_muc_id AS id,
                   d.ten_danh_muc AS name,
                   d.ma_danh_muc AS code,
                   d.mo_ta AS description,
                   ISNULL(d.thu_tu, 0) AS sortOrder,
                   CAST(ISNULL(d.hien_thi, 1) AS BIT) AS isVisible,
                   (SELECT COUNT(*) FROM dbo.SAN_PHAM p WHERE p.danh_muc_id = d.danh_muc_id) AS productCount
            FROM dbo.DANH_MUC d
            ORDER BY ISNULL(d.thu_tu, 99), d.danh_muc_id;";

        using var connection = _db.CreateConnection();
        var categories = (await connection.QueryAsync<CategoryDto>(sql)).ToList();
        return Ok(new { categories });
    }

    [HttpPost("categories")]
    public async Task<IActionResult> CreateCategory([FromBody] SaveCategoryRequest request)
    {
        var (authorized, _, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: false, requireCsrf: true);
        if (!authorized) return errorResult!;

        var name = request?.Name?.Trim() ?? string.Empty;
        var code = NormalizeCategoryCode(request?.Code);
        var description = request?.Description?.Trim();

        if (string.IsNullOrWhiteSpace(name) || name.Length < 2 || name.Length > 100)
        {
            return BadRequest(new { message = "Tên danh mục phải từ 2 đến 100 ký tự." });
        }

        if (!IsValidCategoryCode(code))
        {
            return BadRequest(new { message = "Mã danh mục (slug) chỉ gồm chữ thường a-z, số 0-9 và dấu gạch dưới '_', bắt đầu bằng chữ cái (tối đa 20 ký tự)." });
        }

        if (description != null && description.Length > 300)
        {
            return BadRequest(new { message = "Mô tả danh mục tối đa 300 ký tự." });
        }

        using var connection = _db.CreateConnection();
        const string dupSql = @"
            SET QUOTED_IDENTIFIER ON;
            SELECT COUNT(*) FROM dbo.DANH_MUC
            WHERE ma_danh_muc = @code OR ten_danh_muc = @name;";
        var exists = await connection.ExecuteScalarAsync<int>(dupSql, new { code, name });
        if (exists > 0)
        {
            return Conflict(new { message = $"Tên hoặc mã danh mục '{code}' đã tồn tại." });
        }

        const string insertSql = @"
            SET QUOTED_IDENTIFIER ON;
            INSERT INTO dbo.DANH_MUC (ten_danh_muc, ma_danh_muc, mo_ta, thu_tu, hien_thi)
            OUTPUT INSERTED.danh_muc_id AS id,
                   INSERTED.ten_danh_muc AS name,
                   INSERTED.ma_danh_muc AS code,
                   INSERTED.mo_ta AS description,
                   INSERTED.thu_tu AS sortOrder,
                   CAST(INSERTED.hien_thi AS BIT) AS isVisible
            VALUES (@name, @code, @description, @sortOrder, @isVisible);";

        var created = await connection.QuerySingleAsync<CategoryDto>(insertSql, new
        {
            name,
            code,
            description = string.IsNullOrWhiteSpace(description) ? null : description,
            sortOrder = request!.SortOrder,
            isVisible = request.IsVisible
        });
        created.ProductCount = 0;

        return StatusCode(StatusCodes.Status201Created, new
        {
            message = $"Đã tạo danh mục '{name}' thành công.",
            category = created
        });
    }

    [HttpPut("categories/{id:int}")]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] SaveCategoryRequest request)
    {
        var (authorized, _, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: false, requireCsrf: true);
        if (!authorized) return errorResult!;

        var name = request?.Name?.Trim() ?? string.Empty;
        var code = NormalizeCategoryCode(request?.Code);
        var description = request?.Description?.Trim();

        if (string.IsNullOrWhiteSpace(name) || name.Length < 2 || name.Length > 100)
        {
            return BadRequest(new { message = "Tên danh mục phải từ 2 đến 100 ký tự." });
        }

        if (!IsValidCategoryCode(code))
        {
            return BadRequest(new { message = "Mã danh mục (slug) chỉ gồm chữ thường a-z, số 0-9 và dấu gạch dưới '_', bắt đầu bằng chữ cái (tối đa 20 ký tự)." });
        }

        if (description != null && description.Length > 300)
        {
            return BadRequest(new { message = "Mô tả danh mục tối đa 300 ký tự." });
        }

        using var connection = _db.CreateConnection();
        var dupCount = await connection.ExecuteScalarAsync<int>(@"
            SET QUOTED_IDENTIFIER ON;
            SELECT COUNT(*) FROM dbo.DANH_MUC
            WHERE (ma_danh_muc = @code OR ten_danh_muc = @name) AND danh_muc_id <> @id;",
            new { id, code, name });

        if (dupCount > 0)
        {
            return Conflict(new { message = $"Tên hoặc mã danh mục '{code}' đã được danh mục khác sử dụng." });
        }

        const string updateSql = @"
            SET QUOTED_IDENTIFIER ON;
            UPDATE dbo.DANH_MUC
            SET ten_danh_muc = @name,
                ma_danh_muc = @code,
                mo_ta = @description,
                thu_tu = @sortOrder,
                hien_thi = @isVisible
            WHERE danh_muc_id = @id;

            SELECT d.danh_muc_id AS id,
                   d.ten_danh_muc AS name,
                   d.ma_danh_muc AS code,
                   d.mo_ta AS description,
                   ISNULL(d.thu_tu, 0) AS sortOrder,
                   CAST(ISNULL(d.hien_thi, 1) AS BIT) AS isVisible,
                   (SELECT COUNT(*) FROM dbo.SAN_PHAM p WHERE p.danh_muc_id = d.danh_muc_id) AS productCount
            FROM dbo.DANH_MUC d
            WHERE d.danh_muc_id = @id;";

        var updated = await connection.QuerySingleOrDefaultAsync<CategoryDto>(updateSql, new
        {
            id,
            name,
            code,
            description = string.IsNullOrWhiteSpace(description) ? null : description,
            sortOrder = request!.SortOrder,
            isVisible = request.IsVisible
        });

        if (updated == null)
        {
            return NotFound(new { message = $"Không tìm thấy danh mục #{id}." });
        }

        return Ok(new { message = "Cập nhật danh mục thành công.", category = updated });
    }

    [HttpDelete("categories/{id:int}")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var (authorized, _, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: false, requireCsrf: true);
        if (!authorized) return errorResult!;

        using var connection = _db.CreateConnection();
        var usedCount = await connection.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM dbo.SAN_PHAM WHERE danh_muc_id = @id;", new { id });
        if (usedCount > 0)
        {
            return BadRequest(new { message = $"Danh mục này đang có {usedCount} sản phẩm. Vui lòng chuyển hoặc xóa sản phẩm trước khi xóa danh mục." });
        }

        var affected = await connection.ExecuteAsync(
            "SET QUOTED_IDENTIFIER ON; DELETE FROM dbo.DANH_MUC WHERE danh_muc_id = @id;", new { id });
        if (affected == 0)
        {
            return NotFound(new { message = $"Không tìm thấy danh mục #{id}." });
        }

        return Ok(new { message = "Đã xóa danh mục thành công.", categoryId = id });
    }

    /* ================= STAFF & ROLE MANAGEMENT (ADMIN ONLY) ================= */

    [HttpGet("staff")]
    public async Task<IActionResult> GetStaff([FromQuery] string? scope = "staff")
    {
        var (authorized, _, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: false, requireCsrf: false);
        if (!authorized) return errorResult!;

        var includeAll = string.Equals(scope, "all", StringComparison.OrdinalIgnoreCase);

        const string sql = @"
            SELECT tai_khoan_id AS id,
                   ten_dang_nhap AS username,
                   ho_ten AS fullName,
                   email,
                   sdt AS phone,
                   dia_chi AS address,
                   vai_tro AS role,
                   chuc_vu AS position,
                   ISNULL(trang_thai, 'active') AS status,
                   ngay_tao AS createdAt
            FROM dbo.TAI_KHOAN
            WHERE (@includeAll = 1 OR vai_tro IN ('admin', 'nhan_vien'))
            ORDER BY CASE vai_tro WHEN 'admin' THEN 1 WHEN 'nhan_vien' THEN 2 ELSE 3 END, tai_khoan_id DESC;

            SELECT
                SUM(CASE WHEN vai_tro = 'admin' THEN 1 ELSE 0 END) AS adminCount,
                SUM(CASE WHEN vai_tro = 'nhan_vien' THEN 1 ELSE 0 END) AS staffCount,
                SUM(CASE WHEN vai_tro = 'khach_hang' THEN 1 ELSE 0 END) AS customerCount,
                SUM(CASE WHEN ISNULL(trang_thai, 'active') = 'locked' THEN 1 ELSE 0 END) AS lockedCount
            FROM dbo.TAI_KHOAN;";

        using var connection = _db.CreateConnection();
        using var multi = await connection.QueryMultipleAsync(sql, new { includeAll = includeAll ? 1 : 0 });
        var accounts = (await multi.ReadAsync()).ToList();
        var summary = await multi.ReadSingleAsync();

        return Ok(new { accounts, summary });
    }

    [HttpPost("staff")]
    public async Task<IActionResult> CreateStaff([FromBody] CreateStaffRequest request)
    {
        var (authorized, _, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: false, requireCsrf: true);
        if (!authorized) return errorResult!;

        var username = request?.Username?.Trim() ?? string.Empty;
        var fullName = request?.FullName?.Trim() ?? string.Empty;
        var email = request?.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        var phone = request?.Phone?.Trim();
        var role = string.IsNullOrWhiteSpace(request?.Role) ? "nhan_vien" : request!.Role.Trim().ToLowerInvariant();
        var position = request?.Position?.Trim();

        if (!UsernamePattern.IsMatch(username))
        {
            return BadRequest(new { message = "Tên đăng nhập phải dài 3–50 ký tự (gồm chữ, số, _, ., -)." });
        }
        if (string.IsNullOrWhiteSpace(fullName) || fullName.Length < 2 || fullName.Length > 100)
        {
            return BadRequest(new { message = "Họ và tên phải từ 2 đến 100 ký tự." });
        }
        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@') || email.Length > 100)
        {
            return BadRequest(new { message = "Email không hợp lệ." });
        }
        if (!string.IsNullOrWhiteSpace(phone) && !PhonePattern.IsMatch(phone))
        {
            return BadRequest(new { message = "Số điện thoại phải gồm 9–11 chữ số." });
        }
        if (string.IsNullOrWhiteSpace(request?.Password) || request!.Password.Length < 10 || request.Password.Length > 128)
        {
            return BadRequest(new { message = "Mật khẩu phải từ 10 đến 128 ký tự." });
        }
        if (role != "nhan_vien" && role != "admin")
        {
            return BadRequest(new { message = "Vai trò cấp mới phải là 'nhan_vien' hoặc 'admin'." });
        }
        if (position != null && position.Length > 80)
        {
            return BadRequest(new { message = "Chức vụ tối đa 80 ký tự." });
        }

        position ??= role == "admin" ? "Quản trị viên hệ thống" : "Nhân viên kho & đơn hàng";

        var passwordHash = _passwordService.HashPassword(request.Password);
        using var connection = _db.CreateConnection();
        try
        {
            const string sql = @"
                INSERT INTO dbo.TAI_KHOAN (ten_dang_nhap, mat_khau, ho_ten, email, sdt, vai_tro, chuc_vu, trang_thai)
                OUTPUT INSERTED.tai_khoan_id AS id,
                       INSERTED.ten_dang_nhap AS username,
                       INSERTED.ho_ten AS fullName,
                       INSERTED.email,
                       INSERTED.sdt AS phone,
                       INSERTED.vai_tro AS role,
                       INSERTED.chuc_vu AS position,
                       INSERTED.trang_thai AS status,
                       INSERTED.ngay_tao AS createdAt
                VALUES (@username, @passwordHash, @fullName, @email, @phone, @role, @position, 'active');";

            var created = await connection.QuerySingleAsync(sql, new
            {
                username,
                passwordHash,
                fullName,
                email,
                phone = string.IsNullOrWhiteSpace(phone) ? null : phone,
                role,
                position
            });

            return StatusCode(StatusCodes.Status201Created, new
            {
                message = $"Đã tạo tài khoản {(role == "admin" ? "Quản trị viên" : "Nhân viên")} '{username}' thành công.",
                account = created
            });
        }
        catch (SqlException ex) when (ex.Number is 2601 or 2627)
        {
            return Conflict(new { message = "Tên đăng nhập hoặc email đã được sử dụng." });
        }
    }

    [HttpPut("accounts/{id:int}/role")]
    public async Task<IActionResult> UpdateAccountRole(int id, [FromBody] UpdateAccountRoleRequest request)
    {
        var (authorized, currentUserId, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: false, requireCsrf: true);
        if (!authorized) return errorResult!;

        var newRole = (request?.Role ?? string.Empty).Trim().ToLowerInvariant();
        if (newRole != "khach_hang" && newRole != "nhan_vien" && newRole != "admin")
        {
            return BadRequest(new { message = "Vai trò không hợp lệ. Chỉ chấp nhận: khach_hang, nhan_vien, admin." });
        }

        var position = request?.Position?.Trim();
        if (position != null && position.Length > 80)
        {
            return BadRequest(new { message = "Chức vụ tối đa 80 ký tự." });
        }

        using var connection = _db.CreateConnection();
        var target = await connection.QuerySingleOrDefaultAsync<dynamic>(
            "SELECT tai_khoan_id, ten_dang_nhap, vai_tro, ISNULL(trang_thai, 'active') AS trang_thai FROM dbo.TAI_KHOAN WHERE tai_khoan_id = @id;",
            new { id });

        if (target == null)
        {
            return NotFound(new { message = $"Không tìm thấy tài khoản #{id}." });
        }

        if (id == currentUserId && newRole != "admin")
        {
            return BadRequest(new { message = "Bạn không thể tự hạ vai trò Quản trị viên của chính mình." });
        }

        string currentRole = (string)target.vai_tro;
        string currentStatus = (string)target.trang_thai;
        if (string.Equals(currentRole, "admin", StringComparison.OrdinalIgnoreCase)
            && string.Equals(currentStatus, "active", StringComparison.OrdinalIgnoreCase)
            && newRole != "admin")
        {
            var activeAdmins = await connection.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM dbo.TAI_KHOAN WHERE vai_tro = 'admin' AND ISNULL(trang_thai, 'active') = 'active';");
            if (activeAdmins <= 1)
            {
                return BadRequest(new { message = "Hệ thống phải giữ lại ít nhất 1 Quản trị viên đang hoạt động." });
            }
        }

        var updatedPosition = newRole == "khach_hang"
            ? null
            : (string.IsNullOrWhiteSpace(position)
                ? (newRole == "admin" ? "Quản trị viên hệ thống" : "Nhân viên kho & đơn hàng")
                : position);

        const string updateSql = @"
            UPDATE dbo.TAI_KHOAN
            SET vai_tro = @newRole,
                chuc_vu = @updatedPosition
            WHERE tai_khoan_id = @id;

            SELECT tai_khoan_id AS id, ten_dang_nhap AS username, ho_ten AS fullName,
                   email, sdt AS phone, vai_tro AS role, chuc_vu AS position,
                   ISNULL(trang_thai, 'active') AS status
            FROM dbo.TAI_KHOAN WHERE tai_khoan_id = @id;";

        var account = await connection.QuerySingleAsync(updateSql, new { id, newRole, updatedPosition });
        return Ok(new
        {
            message = $"Đã cập nhật vai trò tài khoản '{target.ten_dang_nhap}' thành '{newRole}'.",
            account
        });
    }

    [HttpPut("accounts/{id:int}/status")]
    public async Task<IActionResult> UpdateAccountStatus(int id, [FromBody] UpdateAccountStatusRequest request)
    {
        var (authorized, currentUserId, _, errorResult) = await CheckBackofficeAccessAsync(allowStaff: false, requireCsrf: true);
        if (!authorized) return errorResult!;

        var newStatus = (request?.Status ?? string.Empty).Trim().ToLowerInvariant();
        if (newStatus != "active" && newStatus != "locked")
        {
            return BadRequest(new { message = "Trạng thái không hợp lệ. Chỉ chấp nhận: active hoặc locked." });
        }

        using var connection = _db.CreateConnection();
        var target = await connection.QuerySingleOrDefaultAsync<dynamic>(
            "SELECT tai_khoan_id, ten_dang_nhap, vai_tro, ISNULL(trang_thai, 'active') AS trang_thai FROM dbo.TAI_KHOAN WHERE tai_khoan_id = @id;",
            new { id });

        if (target == null)
        {
            return NotFound(new { message = $"Không tìm thấy tài khoản #{id}." });
        }

        if (id == currentUserId && newStatus == "locked")
        {
            return BadRequest(new { message = "Bạn không thể tự khóa tài khoản đang đăng nhập." });
        }

        string currentRole = (string)target.vai_tro;
        string currentStatus = (string)target.trang_thai;
        if (newStatus == "locked"
            && string.Equals(currentRole, "admin", StringComparison.OrdinalIgnoreCase)
            && string.Equals(currentStatus, "active", StringComparison.OrdinalIgnoreCase))
        {
            var activeAdmins = await connection.ExecuteScalarAsync<int>(
                "SELECT COUNT(*) FROM dbo.TAI_KHOAN WHERE vai_tro = 'admin' AND ISNULL(trang_thai, 'active') = 'active';");
            if (activeAdmins <= 1)
            {
                return BadRequest(new { message = "Không thể khóa Quản trị viên đang hoạt động cuối cùng." });
            }
        }

        const string updateSql = @"
            UPDATE dbo.TAI_KHOAN
            SET trang_thai = @newStatus
            WHERE tai_khoan_id = @id;

            SELECT tai_khoan_id AS id, ten_dang_nhap AS username, ho_ten AS fullName,
                   email, sdt AS phone, vai_tro AS role, chuc_vu AS position,
                   ISNULL(trang_thai, 'active') AS status
            FROM dbo.TAI_KHOAN WHERE tai_khoan_id = @id;";

        var account = await connection.QuerySingleAsync(updateSql, new { id, newStatus });
        return Ok(new
        {
            message = newStatus == "locked"
                ? $"Đã tạm khóa tài khoản '{target.ten_dang_nhap}'."
                : $"Đã mở khóa tài khoản '{target.ten_dang_nhap}'.",
            account
        });
    }

    public class CreateProductRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public int Price { get; set; }
        public int? OriginalPrice { get; set; }
        public List<int>? BundleItems { get; set; }
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
