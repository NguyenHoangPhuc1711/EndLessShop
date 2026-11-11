using System.Data;
using System.Security.Cryptography;
using System.Text;
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
public class OrdersController : ControllerBase
{
    private readonly IDbConnectionFactory _db;
    private static readonly Regex KeyPattern = new("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    private static readonly Regex PhonePattern = new("^[0-9]{9,11}$", RegexOptions.Compiled);
    private static readonly Regex VoucherPattern = new("^[A-Z0-9_-]{1,30}$", RegexOptions.Compiled);

    private static readonly Dictionary<int, (int Status, string Message)> ErrorMap = new()
    {
        [51030] = (400, "Giỏ hàng hoặc khóa yêu cầu không hợp lệ."),
        [51031] = (400, "Sản phẩm không còn tồn tại."),
        [51032] = (400, "Size hoặc màu không hợp lệ. Vui lòng chọn lại."),
        [51033] = (409, "Số lượng mua vượt tồn kho của sản phẩm."),
        [51034] = (400, "Mã giảm giá không hợp lệ hoặc đã hết hạn."),
        [51035] = (400, "Thông tin người nhận không hợp lệ."),
        [51036] = (400, "Hiện chỉ hỗ trợ thanh toán COD."),
        [51037] = (401, "Vui lòng đăng nhập để đặt hàng."),
        [51038] = (400, "Tổng giá trị đơn vượt giới hạn cho phép."),
        [51039] = (409, "Khóa yêu cầu đã được dùng cho nội dung đơn khác."),
        [51040] = (404, "Không tìm thấy đơn hàng của bạn."),
        [51041] = (409, "Đơn đang được xử lý. Vui lòng thử lại cùng yêu cầu.")
    };

    public OrdersController(IDbConnectionFactory db)
    {
        _db = db;
    }

    [HttpPost("quote")]
    public async Task<IActionResult> Quote([FromBody] OrderCheckoutRequest request)
    {
        var userId = HttpContext.Session.GetInt32("userId") ?? 1; // Default to demo user for guest quote
        return await ExecuteCheckout(userId, request, isCreate: false);
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrder([FromBody] OrderCheckoutRequest request)
    {
        var userId = HttpContext.Session.GetInt32("userId");
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập để đặt hàng." });
        }

        // CSRF Verification
        if (!SecurityValidator.ValidateCsrfAndOrigin(HttpContext))
        {
            return StatusCode(403, new { message = "Phiên bảo mật không hợp lệ. Vui lòng tải lại trang.", code = "csrf_invalid" });
        }

        var key = Request.Headers["Idempotency-Key"].ToString();
        if (string.IsNullOrWhiteSpace(key) || !KeyPattern.IsMatch(key))
        {
            return BadRequest(new { message = "Cần khóa Idempotency-Key UUID hợp lệ." });
        }

        return await ExecuteCheckout(userId.Value, request, isCreate: true, key.ToLowerInvariant());
    }

    [HttpGet]
    public async Task<IActionResult> GetOrders()
    {
        var userId = HttpContext.Session.GetInt32("userId");
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập để xem đơn hàng." });
        }

        using var connection = _db.CreateConnection();
        var parameters = new DynamicParameters();
        parameters.Add("@user_id", userId.Value, DbType.Int32);

        var orders = await connection.QueryAsync<OrderSummaryDto>(
            "dbo.order_list",
            parameters,
            commandType: CommandType.StoredProcedure);

        return Ok(new { orders });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetOrderById(int id)
    {
        var userId = HttpContext.Session.GetInt32("userId");
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập để xem đơn hàng." });
        }

        return await FetchOrder(userId.Value, orderId: id, requestKey: null);
    }

    [HttpGet("requests/{key}")]
    public async Task<IActionResult> GetOrderByRequestKey(string key)
    {
        var userId = HttpContext.Session.GetInt32("userId");
        if (!userId.HasValue)
        {
            return Unauthorized(new { message = "Vui lòng đăng nhập để xem đơn hàng." });
        }

        if (!KeyPattern.IsMatch(key))
        {
            return NotFound(new { message = "Không tìm thấy đơn hàng." });
        }

        return await FetchOrder(userId.Value, orderId: null, requestKey: key.ToLowerInvariant());
    }

    private async Task<IActionResult> ExecuteCheckout(int userId, OrderCheckoutRequest request, bool isCreate, string? requestKey = null)
    {
        if (request.Items == null || request.Items.Count == 0 || request.Items.Count > 50)
        {
            return BadRequest(new { message = "Giỏ hàng cần có 1–50 dòng sản phẩm." });
        }

        if (request.Payment != "cod")
        {
            return BadRequest(new { message = "Hiện chỉ hỗ trợ thanh toán COD." });
        }

        // Validate voucher format if supplied
        string? voucherCode = null;
        if (request.VoucherCode != null)
        {
            var trimmedVoucher = request.VoucherCode.Trim().ToUpperInvariant();
            if (!string.IsNullOrEmpty(trimmedVoucher))
            {
                if (!VoucherPattern.IsMatch(trimmedVoucher))
                {
                    return BadRequest(new { message = "Mã giảm giá không hợp lệ." });
                }
                voucherCode = trimmedVoucher;
            }
        }

        // Normalize items: merge duplicates. Raw size/color preserved without trimming.
        var merged = new Dictionary<string, OrderItemInput>();
        foreach (var item in request.Items)
        {
            if (item.Id < 1 || item.Qty < 1 || item.Qty > 999 || string.IsNullOrEmpty(item.Size) || item.Size.Length > 10 || string.IsNullOrEmpty(item.Color) || item.Color.Length > 30)
            {
                return BadRequest(new { message = "ID, size, màu hoặc số lượng không hợp lệ." });
            }

            var comboKey = $"{item.Id}_{item.Size}_{item.Color}";
            if (merged.TryGetValue(comboKey, out var existing))
            {
                existing.Qty += item.Qty;
                if (existing.Qty > 999) return BadRequest(new { message = "Số lượng một biến thể không được vượt 999." });
            }
            else
            {
                merged[comboKey] = new OrderItemInput
                {
                    Id = item.Id,
                    Size = item.Size,
                    Color = item.Color,
                    Qty = item.Qty
                };
            }
        }

        var normalizedItems = merged.Values.OrderBy(x => x.Id).ThenBy(x => x.Size).ThenBy(x => x.Color).ToList();
        var itemsJson = JsonSerializer.Serialize(normalizedItems.Select(x => new { id = x.Id, size = x.Size, color = x.Color, qty = x.Qty }));

        string? requestHash = null;
        if (isCreate)
        {
            var d = request.Delivery;
            if (d == null || string.IsNullOrWhiteSpace(d.FullName) || string.IsNullOrWhiteSpace(d.Address)
                || string.IsNullOrWhiteSpace(d.Phone) || !PhonePattern.IsMatch(d.Phone.Trim())
                || d.FullName.Trim().Length > 100 || d.Address.Trim().Length > 500
                || (d.Note != null && d.Note.Length > 1000))
            {
                return BadRequest(new { message = "Kiểm tra họ tên, địa chỉ, điện thoại 9–11 chữ số và ghi chú tối đa 1000 ký tự." });
            }

            var hashObj = new
            {
                items = normalizedItems.Select(x => new { id = x.Id, size = x.Size, color = x.Color, qty = x.Qty }),
                voucherCode,
                payment = "cod",
                delivery = new
                {
                    fullName = d.FullName.Trim(),
                    phone = d.Phone.Trim(),
                    address = d.Address.Trim(),
                    note = (d.Note ?? string.Empty).Trim()
                }
            };
            var hashJson = JsonSerializer.Serialize(hashObj, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            requestHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(hashJson))).ToLowerInvariant();
        }

        using var connection = _db.CreateConnection();
        var parameters = new DynamicParameters();
        parameters.Add("@user_id", userId, DbType.Int32);
        parameters.Add("@items", itemsJson, DbType.String);
        parameters.Add("@voucher_code", voucherCode, DbType.AnsiString, size: 30);
        parameters.Add("@create", isCreate, DbType.Boolean);
        parameters.Add("@payment", "cod", DbType.AnsiString, size: 20);

        if (isCreate && request.Delivery != null)
        {
            parameters.Add("@full_name", request.Delivery.FullName.Trim(), DbType.String, size: 100);
            parameters.Add("@phone", request.Delivery.Phone.Trim(), DbType.AnsiString, size: 15);
            parameters.Add("@address", request.Delivery.Address.Trim(), DbType.String, size: 500);
            parameters.Add("@note", request.Delivery.Note?.Trim(), DbType.String, size: 1000);
            parameters.Add("@request_key", requestKey, DbType.AnsiString, size: 36);
            parameters.Add("@request_hash", requestHash, DbType.AnsiStringFixedLength, size: 64);
        }

        try
        {
            using var multi = await connection.QueryMultipleAsync(
                "dbo.order_checkout",
                parameters,
                commandType: CommandType.StoredProcedure);

            if (!isCreate)
            {
                var summary = await multi.ReadSingleAsync<dynamic>();
                var pricedItems = (await multi.ReadAsync<PricedItemDto>()).ToList();

                return Ok(new OrderQuoteResponse
                {
                    Subtotal = (int)summary.subtotal,
                    Discount = (int)summary.discount,
                    Total = (int)summary.total,
                    VoucherCode = (string?)summary.voucherCode,
                    Items = pricedItems
                });
            }
            else
            {
                var orderHeader = await multi.ReadSingleAsync<dynamic>();
                var orderItems = (await multi.ReadAsync<PricedItemDto>()).ToList();

                var order = new OrderDetailDto
                {
                    Id = (int)orderHeader.id,
                    Code = (string)orderHeader.code,
                    Date = (DateTime)orderHeader.date,
                    Status = (string)orderHeader.status,
                    Payment = (string)orderHeader.payment,
                    Subtotal = (int?)orderHeader.subtotal,
                    Discount = (int)orderHeader.discount,
                    Total = (int)orderHeader.total,
                    VoucherCode = (string?)orderHeader.voucherCode,
                    Delivery = new DeliveryInfo
                    {
                        FullName = (string)orderHeader.fullName,
                        Phone = (string)orderHeader.phone,
                        Address = (string)orderHeader.address,
                        Note = (string?)orderHeader.note
                    },
                    Items = orderItems,
                    Replayed = (bool)orderHeader.replayed
                };

                return StatusCode(order.Replayed ? 200 : 201, new { order });
            }
        }
        catch (SqlException ex) when (ErrorMap.TryGetValue(ex.Number, out var err))
        {
            return StatusCode(err.Status, new { message = err.Message, code = $"order_{ex.Number}" });
        }
        catch (Exception)
        {
            return StatusCode(500, new { message = "Lỗi xử lý đơn hàng. Vui lòng thử lại sau.", code = "order_error" });
        }
    }

    private async Task<IActionResult> FetchOrder(int userId, int? orderId, string? requestKey)
    {
        using var connection = _db.CreateConnection();
        var parameters = new DynamicParameters();
        parameters.Add("@user_id", userId, DbType.Int32);
        parameters.Add("@order_id", orderId, DbType.Int32);
        parameters.Add("@request_key", requestKey, DbType.AnsiString, size: 36);

        try
        {
            using var multi = await connection.QueryMultipleAsync(
                "dbo.order_get",
                parameters,
                commandType: CommandType.StoredProcedure);

            var orderHeader = await multi.ReadSingleOrDefaultAsync<dynamic>();
            if (orderHeader == null)
            {
                return NotFound(new { message = "Không tìm thấy đơn hàng của bạn." });
            }

            var orderItems = (await multi.ReadAsync<PricedItemDto>()).ToList();

            var order = new OrderDetailDto
            {
                Id = (int)orderHeader.id,
                Code = (string)orderHeader.code,
                Date = (DateTime)orderHeader.date,
                Status = (string)orderHeader.status,
                Payment = (string)orderHeader.payment,
                Subtotal = (int?)orderHeader.subtotal,
                Discount = (int)orderHeader.discount,
                Total = (int)orderHeader.total,
                VoucherCode = (string?)orderHeader.voucherCode,
                Delivery = new DeliveryInfo
                {
                    FullName = (string)orderHeader.fullName,
                    Phone = (string)orderHeader.phone,
                    Address = (string)orderHeader.address,
                    Note = (string?)orderHeader.note
                },
                Items = orderItems
            };

            return Ok(new { order });
        }
        catch (SqlException ex) when (ex.Number == 51040)
        {
            return NotFound(new { message = "Không tìm thấy đơn hàng của bạn." });
        }
    }
}
