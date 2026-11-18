using System.Data;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Dapper;
using EndLessShop.Api.Data;
using EndLessShop.Api.Models;
using EndLessShop.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;

namespace EndLessShop.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ChatController : ControllerBase
{
    private const string StoreSnapshotCacheKey = "endless:chat:store_snapshot";

    private readonly IDbConnectionFactory _db;
    private readonly IGeminiChatService? _geminiChatService;
    private readonly IMemoryCache? _memoryCache;

    public ChatController(
        IDbConnectionFactory db,
        IGeminiChatService? geminiChatService = null,
        IMemoryCache? memoryCache = null)
    {
        _db = db;
        _geminiChatService = geminiChatService;
        _memoryCache = memoryCache;
    }

    [HttpPost]
    [EnableRateLimiting("chat-limit")]
    public async Task<IActionResult> Message([FromBody] ChatMessageRequest? request, CancellationToken cancellationToken = default)
    {
        var rawText = request?.Message?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(rawText))
        {
            return Ok(new ChatResponse
            {
                Reply = "Dạ xin chào quý khách! Em là Trợ lý ảo của Endless Shop 🌿. Em có thể hỗ trợ quý khách tìm sản phẩm, săn mã giảm giá, tư vấn chọn size và giải đáp chính sách giao nhận hàng.",
                Intent = "greeting",
                Suggestions = new List<string> { "🏷️ Mã giảm giá hot", "📏 Tư vấn chọn size", "🚚 Phí ship & Giao hàng", "🔄 Chính sách đổi trả", "🧥 Gợi ý áo & quần" }
            });
        }

        if (rawText.Length > 500)
        {
            rawText = rawText.Substring(0, 500);
        }

        var normalized = rawText.ToLowerInvariant();

        // 1. Check if user is asking for size recommendation with height / weight
        var sizeAnalysis = AnalyzeSizeConsultation(normalized);
        if (sizeAnalysis != null)
        {
            return Ok(sizeAnalysis);
        }

        // 2. Check for Vouchers / Discounts
        if (Regex.IsMatch(normalized, @"(mã\s*giảm\s*giá|voucher|khuyến\s*mãi|coupon|code|ưu\s*đãi|discount|giảm\s*giá|sale)"))
        {
            return await HandleVouchers();
        }

        // 3. Check for Size Chart / General size question
        if (Regex.IsMatch(normalized, @"(bảng\s*size|chọn\s*size|hướng\s*dẫn\s*size|size\s*gì|mặc\s*size|tư\s*vấn\s*size|kích\s*cỡ|kích\s*thước)"))
        {
            return Ok(new ChatResponse
            {
                Reply = "📐 **Bảng kích cỡ chuẩn dáng Endless Shop:**\n\n" +
                        "• **Size S**: Cao dưới 1m60 | Nặng dưới 52kg\n" +
                        "• **Size M**: Cao 1m60 – 1m67 | Nặng 52kg – 62kg\n" +
                        "• **Size L**: Cao 1m68 – 1m75 | Nặng 63kg – 72kg\n" +
                        "• **Size XL**: Cao 1m76 – 1m83 | Nặng 73kg – 82kg\n" +
                        "• **Size XXL**: Cao trên 1m83 | Nặng trên 82kg\n\n" +
                        "💡 *Mẹo:* Bạn có thể nhắn trực tiếp chiều cao & cân nặng (Ví dụ: **1m70 65kg**) để em tư vấn size chính xác nhất nhé!\n\n" +
                        "👉 [Mở bộ tính size thông minh & Bảng số đo chi tiết](size-guide.html)",
                Intent = "sizing",
                Suggestions = new List<string> { "1m65 58kg", "1m72 68kg", "1m78 75kg", "🏷️ Mã giảm giá hot" }
            });
        }

        // 4. Check for Shipping / Delivery
        if (Regex.IsMatch(normalized, @"(ship|giao\s*hàng|vận\s*chuyển|phí\s*ship|bao\s*lâu|mấy\s*ngày|nội\s*thành|freeship)"))
        {
            return Ok(new ChatResponse
            {
                Reply = "🚚 **Chính sách giao hàng của Endless Shop:**\n\n" +
                        "• **Thời gian giao:** 1–2 ngày đối với khu vực nội thành (Hà Nội, TP.HCM); 2–4 ngày đối với các tỉnh thành toàn quốc.\n" +
                        "• **Phí vận chuyển:** Đồng giá 30.000₫ toàn quốc.\n" +
                        "• **Miễn phí vận chuyển:** Áp dụng tự động cho đơn hàng từ **300.000₫** hoặc khi sử dụng mã voucher `FREESHIP`.\n" +
                        "• **Đồng kiểm COD:** Khách hàng được mở hộp kiểm tra đúng mẫu, đúng màu trước khi thanh toán tiền mặt.\n\n" +
                        "👉 [Xem chi tiết chính sách giao nhận COD](policy.html#van-chuyen)",
                Intent = "shipping",
                Suggestions = new List<string> { "🏷️ Mã FREESHIP", "🔄 Chính sách đổi trả", "📦 Tra cứu đơn hàng" }
            });
        }

        // 5. Check for Returns / Warranty / Exchange
        if (Regex.IsMatch(normalized, @"(đổi\s*trả|trả\s*hàng|đổi\s*size|bảo\s*hành|hoàn\s*tiền|lỗi\s*hàng|chính\s*sách\s*đổi)"))
        {
            return Ok(new ChatResponse
            {
                Reply = "🔄 **Chính sách đổi trả 30 ngày linh hoạt:**\n\n" +
                        "• Thời hạn đổi trả trong vòng **30 ngày** kể từ lúc nhận hàng.\n" +
                        "• Hỗ trợ đổi size tận nhà: Nhân viên giao vận sẽ mang size mới đến và thu hồi size cũ trực tiếp.\n" +
                        "• Miễn phí 100% chi phí đổi trả đối với sản phẩm có lỗi từ nhà sản xuất hoặc giao sai mẫu.\n" +
                        "• Điều kiện: Sản phẩm còn nguyên tem mác thương hiệu và chưa qua giặt tẩy.\n\n" +
                        "👉 [Xem chi tiết & gửi yêu cầu đổi trả online](policy.html)",
                Intent = "returns",
                Suggestions = new List<string> { "📞 Gặp tư vấn viên", "🚚 Chính sách giao hàng", "🏷️ Mã giảm giá hot" }
            });
        }

        // 6. Check for Payment methods (COD, QR / VietQR, chuyển khoản)
        if (Regex.IsMatch(normalized, @"(thanh\s*toán|chuyển\s*khoản|mã\s*qr|vietqr|qr\s*code|quẹt\s*thẻ|ngân\s*hàng)"))
        {
            return Ok(new ChatResponse
            {
                Reply = "💳 **Endless Shop hỗ trợ 2 hình thức thanh toán thuận tiện:**\n\n" +
                        "1. 💵 **Thanh toán khi nhận hàng (COD):** Bạn được kiểm tra hàng trước khi nhận, thanh toán tiền mặt trực tiếp cho nhân viên giao vận.\n" +
                        "2. 📱 **Chuyển khoản qua mã QR (VietQR):** Quét mã VietQR động trực tiếp bằng ứng dụng của hơn 40 ngân hàng (Vietcombank, MB, Techcombank, ACB...) hoặc ví điện tử (MoMo, VNPay). Hệ thống tự động điền số tài khoản, số tiền và nội dung chuyển khoản chính xác 100%.\n\n" +
                        "👉 Bạn có thể tùy chọn hình thức thanh toán thuận tiện nhất tại bước **Thanh toán đơn hàng**!",
                Intent = "payment_methods",
                Suggestions = new List<string> { "🚚 Chính sách giao hàng", "🏷️ Mã giảm giá hot", "🛒 Xem giỏ hàng" }
            });
        }

        // 7. Check for Order Tracking / Status
        if (Regex.IsMatch(normalized, @"(đơn\s*hàng|tra\s*cứu|kiểm\s*tra\s*đơn|tình\s*trạng\s*đơn|order|mã\s*đơn)"))
        {
            // If user mentioned a specific numeric order code
            var orderMatch = Regex.Match(normalized, @"#?(\d{1,6})");
            if (orderMatch.Success && int.TryParse(orderMatch.Groups[1].Value, out var orderId) && orderId > 0 && orderId < 999999)
            {
                return await HandleOrderLookup(orderId);
            }

            return Ok(new ChatResponse
            {
                Reply = "📦 **Tra cứu đơn hàng dễ dàng:**\n\n" +
                        "• Quý khách có thể xem toàn bộ đơn hàng tại mục **[Lịch sử đơn hàng](checkout.html#lich-su)**.\n" +
                        "• Hoặc quý khách hãy nhắn trực tiếp mã đơn hàng (Ví dụ: `#1001` hoặc `1001`), em sẽ tra cứu trạng thái tức thì giúp mình nhé!",
                Intent = "order_tracking",
                Suggestions = new List<string> { "Đơn hàng gần nhất", "🚚 Thời gian giao hàng", "📞 Hotline hỗ trợ" }
            });
        }

        // 7. Check for Contact / Human Agent / Store / Hotline
        if (Regex.IsMatch(normalized, @"(hotline|liên\s*hệ|tổng\s*đài|nhân\s*viên|tư\s*vấn\s*viên|gặp\s*người|địa\s*chỉ|cửa\s*hàng|showroom|sđt|số\s*điện\s*thoại)"))
        {
            return Ok(new ChatResponse
            {
                Reply = "📞 **Thông tin liên hệ & Hỗ trợ khách hàng Endless:**\n\n" +
                        "• **Hotline hỗ trợ (24/7):** `1900 8888` (Miễn phí cước gọi)\n" +
                        "• **Email chăm sóc khách hàng:** `support@endlessshop.vn`\n" +
                        "• **Showroom:** 123 Phố Huế, Quận Hai Bà Trưng, Hà Nội (Mở cửa: 08:30 – 22:00 hằng ngày)\n" +
                        "• Đội ngũ tư vấn viên luôn túc trực để hỗ trợ quý khách trong mọi đơn hàng.",
                Intent = "contact",
                Suggestions = new List<string> { "🏷️ Mã giảm giá hot", "🚚 Phí giao hàng", "🧥 Xem sản phẩm mới" }
            });
        }

        // 8. Check for Products / Shopping inquiry
        if (Regex.IsMatch(normalized, @"(áo|sơ\s*mi|khoác|quần|jean|váy|đầm|phụ\s*kiện|túi|mũ|sản\s*phẩm|bán\s*chạy|mới|mẫu\s*nào|giá)"))
        {
            if (_geminiChatService?.IsConfigured == true && IsAdvisoryProductQuestion(normalized))
            {
                var aiProductResponse = await TryHandleWithGeminiAsync(rawText, request?.History, cancellationToken);
                if (aiProductResponse != null)
                {
                    return Ok(aiProductResponse);
                }
            }

            return await HandleProductsSearch(normalized);
        }

        // 9. Check for short Greeting / Thank you
        var isShortGreeting = rawText.Length <= 30 && !rawText.Contains('?');
        if ((isShortGreeting || _geminiChatService?.IsConfigured != true) &&
            Regex.IsMatch(normalized, @"(chào|hello|hi|hey|alo|bạn\s*ơi|cảm\s*ơn|thanks|thank\s*you)"))
        {
            return Ok(new ChatResponse
            {
                Reply = "Dạ xin chào quý khách! 🌿 Endless Shop rất hân hạnh được phục vụ quý khách. Quý khách đang tìm kiếm phong cách thời trang nào, hoặc cần hỗ trợ thông tin gì cứ nhắn em nhé!",
                Intent = "greeting",
                Suggestions = new List<string> { "🏷️ Mã giảm giá hot", "🧥 Gợi ý áo & quần", "📏 Tư vấn chọn size", "🚚 Phí ship" }
            });
        }

        // 10. Hybrid AI Assistant (Google AI Studio) with safe rule-based fallback
        if (_geminiChatService?.IsConfigured == true)
        {
            var aiResponse = await TryHandleWithGeminiAsync(rawText, request?.History, cancellationToken);
            if (aiResponse != null)
            {
                return Ok(aiResponse);
            }
        }

        return Ok(new ChatResponse
        {
            Reply = "Dạ em đã ghi nhận câu hỏi của quý khách. Em có thể hỗ trợ nhanh nhất cho quý khách ở các mục bên dưới, hoặc kết nối đến Hotline `1900 8888` để gặp chuyên viên trực tiếp ạ!",
            Intent = "general",
            Suggestions = new List<string> { "🏷️ Xem mã giảm giá", "🧥 Tìm mẫu áo mới", "📏 Bảng tư vấn size", "🚚 Thời gian giao hàng", "📞 Hotline 1900 8888" }
        });
    }

    private ChatResponse? AnalyzeSizeConsultation(string text)
    {
        // Extract height: 1m70, 1.70m, 170cm, cao 170, 1m65...
        int? heightCm = null;
        var hMatch1 = Regex.Match(text, @"1[m|.,](\d{1,2})");
        if (hMatch1.Success && int.TryParse(hMatch1.Groups[1].Value, out var cmPart))
        {
            if (cmPart < 10) cmPart *= 10;
            heightCm = 100 + cmPart;
        }
        else
        {
            var hMatch2 = Regex.Match(text, @"(\d{3})\s*(?:cm)?");
            if (hMatch2.Success && int.TryParse(hMatch2.Groups[1].Value, out var hVal) && hVal >= 130 && hVal <= 210)
            {
                heightCm = hVal;
            }
        }

        // Extract weight: 65kg, 55 ký, nặng 60...
        int? weightKg = null;
        var wMatch = Regex.Match(text, @"(\d{2,3})\s*(?:kg|kí|ký)");
        if (wMatch.Success && int.TryParse(wMatch.Groups[1].Value, out var wVal) && wVal >= 35 && wVal <= 150)
        {
            weightKg = wVal;
        }
        else
        {
            var wMatch2 = Regex.Match(text, @"nặng\s*(\d{2,3})");
            if (wMatch2.Success && int.TryParse(wMatch2.Groups[1].Value, out var wVal2) && wVal2 >= 35 && wVal2 <= 150)
            {
                weightKg = wVal2;
            }
        }

        if (!heightCm.HasValue && !weightKg.HasValue)
        {
            return null;
        }

        // Compute recommended size
        string size;
        var h = heightCm ?? 165;
        var w = weightKg ?? 60;

        if (w <= 52 && h < 160)
        {
            size = "S";
        }
        else if (w <= 62 && h <= 168)
        {
            size = "M";
        }
        else if (w <= 72 && h <= 176)
        {
            size = "L";
        }
        else if (w <= 83 && h <= 184)
        {
            size = "XL";
        }
        else
        {
            size = "XXL";
        }

        var details = new List<string>();
        if (heightCm.HasValue) details.Add($"chiều cao **{heightCm}cm**");
        if (weightKg.HasValue) details.Add($"cân nặng **{weightKg}kg**");

        var detailStr = string.Join(" và ", details);

        return new ChatResponse
        {
            Reply = $"Dựa trên thông số {detailStr} của bạn:\n\n" +
                    $"👉 Endless gợi ý bạn nên chọn **Size {size}** để mặc chuẩn phom dáng Bắc Âu!\n\n" +
                    $"• Nếu bạn thích phong cách mặc vừa vặn, chỉn chu: Chọn đúng **Size {size}**.\n" +
                    $"• Nếu bạn chuộng phong cách rộng rãi thoải mái (Oversized phong cách Bắc Âu): Bạn có thể nâng lên **1 size**.\n\n" +
                    $"*Tất cả sản phẩm của Endless đều hỗ trợ đổi size miễn phí tận nhà trong vòng 30 ngày nên bạn hoàn toàn yên tâm lựa chọn nhé!*",
            Intent = "sizing_result",
            RecommendedSize = size,
            Suggestions = new List<string> { "🧥 Gợi ý áo phù hợp", "🏷️ Lấy mã giảm giá", "🚚 Phí giao hàng" }
        };
    }

    private async Task<IActionResult> HandleVouchers()
    {
        try
        {
            using var connection = _db.CreateConnection();
            const string sql = @"
                SELECT ma_code, loai_giam, gia_tri, han_su_dung 
                FROM dbo.VOUCHER 
                WHERE han_su_dung IS NULL OR han_su_dung > GETDATE()
                ORDER BY gia_tri DESC;";

            var rows = await connection.QueryAsync<dynamic>(sql);
            var vouchers = rows.Select(r =>
            {
                string code = (string)r.ma_code;
                string type = (string)r.loai_giam;
                int val = (int)r.gia_tri;
                string desc = type == "percent"
                    ? $"Giảm {val}% tổng giá trị đơn hàng"
                    : $"Giảm {val:N0}₫ trực tiếp vào đơn hàng";

                return new ChatVoucherItemDto
                {
                    Code = code,
                    Type = type,
                    Value = val,
                    Description = desc
                };
            }).ToList();

            var voucherListText = string.Join("\n", vouchers.Select(v => $"• **`{v.Code}`**: {v.Description}"));

            return Ok(new ChatResponse
            {
                Reply = "🎉 **Endless dành tặng bạn các mã ưu đãi độc quyền đang hoạt động:**\n\n" +
                        voucherListText + "\n\n" +
                        "💡 *Bạn có thể nhấp nút sao chép mã bên dưới và dán vào ô Mã giảm giá tại giỏ hàng hoặc trang Thanh toán để nhận ưu đãi ngay!*",
                Intent = "vouchers",
                Vouchers = vouchers,
                Suggestions = new List<string> { "🧥 Xem mẫu áo mới", "🚚 Chính sách freeship", "📏 Tư vấn chọn size" }
            });
        }
        catch (Exception)
        {
            // Fallback response with known default vouchers
            var defaultVouchers = new List<ChatVoucherItemDto>
            {
                new() { Code = "ENDLESS10", Type = "percent", Value = 10, Description = "Giảm 10% tổng đơn hàng" },
                new() { Code = "FREESHIP", Type = "fixed", Value = 30000, Description = "Giảm 30.000₫ phí ship cho đơn từ 300k" },
                new() { Code = "KM50K", Type = "fixed", Value = 50000, Description = "Giảm 50.000₫ bộ sưu tập đông" },
                new() { Code = "BF100", Type = "fixed", Value = 100000, Description = "Giảm 100.000₫ đơn từ 800k" }
            };

            return Ok(new ChatResponse
            {
                Reply = "🎉 **Các mã ưu đãi nổi bật đang áp dụng tại Endless Shop:**\n\n" +
                        "• **`ENDLESS10`**: Giảm 10% tổng đơn hàng\n" +
                        "• **`FREESHIP`**: Miễn phí giao hàng (giảm 30.000₫)\n" +
                        "• **`KM50K`**: Giảm 50.000₫\n" +
                        "• **`BF100`**: Giảm 100.000₫\n\n" +
                        "Hãy nhập mã tại bước thanh toán để áp dụng nhé!",
                Intent = "vouchers",
                Vouchers = defaultVouchers,
                Suggestions = new List<string> { "🧥 Xem mẫu áo mới", "🚚 Chính sách giao hàng" }
            });
        }
    }

    private async Task<IActionResult> HandleProductsSearch(string normalizedText)
    {
        try
        {
            using var connection = _db.CreateConnection();
            string categoryFilter = "";
            string nameFilter = "";

            if (normalizedText.Contains("khoác"))
            {
                nameFilter = "%khoác%";
            }
            else if (normalizedText.Contains("sơ mi") || normalizedText.Contains("so mi"))
            {
                nameFilter = "%sơ mi%";
            }
            else if (normalizedText.Contains("thun"))
            {
                nameFilter = "%thun%";
            }
            else if (normalizedText.Contains("quần") || normalizedText.Contains("jean"))
            {
                categoryFilter = "quan";
            }
            else if (normalizedText.Contains("váy") || normalizedText.Contains("đầm"))
            {
                categoryFilter = "vay";
            }
            else if (normalizedText.Contains("túi") || normalizedText.Contains("mũ") || normalizedText.Contains("phụ kiện"))
            {
                categoryFilter = "phukien";
            }
            else if (normalizedText.Contains("áo"))
            {
                categoryFilter = "ao";
            }

            string sql = @"
                SELECT TOP 4 p.san_pham_id, p.ten_sp, p.mo_ta, p.gia, d.ma_danh_muc, p.images_json
                FROM dbo.SAN_PHAM p
                JOIN dbo.DANH_MUC d ON d.danh_muc_id = p.danh_muc_id
                WHERE 1=1 ";

            var parameters = new DynamicParameters();
            if (!string.IsNullOrEmpty(categoryFilter))
            {
                sql += " AND d.ma_danh_muc = @cat";
                parameters.Add("@cat", categoryFilter);
            }
            if (!string.IsNullOrEmpty(nameFilter))
            {
                sql += " AND p.ten_sp LIKE @name";
                parameters.Add("@name", nameFilter);
            }

            sql += " ORDER BY p.la_moi DESC, p.san_pham_id ASC;";

            var rows = await connection.QueryAsync<dynamic>(sql, parameters);
            var products = rows.Select(r => new ChatProductCardDto
            {
                Id = (int)r.san_pham_id,
                Name = (string)r.ten_sp,
                Price = (int)r.gia,
                Category = (string)r.ma_danh_muc,
                Description = (string?)r.mo_ta,
                Image = ExtractFirstImage((string?)r.images_json)
            }).ToList();

            if (products.Count == 0)
            {
                return Ok(new ChatResponse
                {
                    Reply = "Dạ hiện tại mẫu bạn tìm có thể đang được cập nhật thêm. Bạn có thể xem toàn bộ các bộ sưu tập Fall/Winter mới nhất tại trang chủ hoặc danh mục sản phẩm nhé!",
                    Intent = "products",
                    Suggestions = new List<string> { "Áo thun cotton", "Áo sơ mi tay dài", "Quần jean slim", "🏷️ Mã giảm giá" }
                });
            }

            return Ok(new ChatResponse
            {
                Reply = "✨ **Gợi ý thiết kế phù hợp nhất cho bạn tại Endless Shop:**\n\n" +
                        "Dưới đây là các sản phẩm nổi bật với chất liệu cao cấp và kiểu dáng Bắc Âu tinh tế. Bạn có thể nhấn vào để xem chi tiết ngay:",
                Intent = "products",
                Products = products,
                Suggestions = new List<string> { "📏 Tư vấn chọn size", "🏷️ Mã giảm giá hot", "🚚 Phí ship" }
            });
        }
        catch (Exception)
        {
            return Ok(new ChatResponse
            {
                Reply = "Bạn có thể tham khảo toàn bộ các sản phẩm tại trang chủ Endless Shop, bao gồm Áo thun basic, Sơ mi Linen, Áo khoác dù và Quần dáng suông!",
                Intent = "products",
                Suggestions = new List<string> { "🏷️ Mã giảm giá", "📏 Tư vấn chọn size" }
            });
        }
    }

    private async Task<IActionResult> HandleOrderLookup(int orderId)
    {
        try
        {
            using var connection = _db.CreateConnection();
            const string sql = @"
                SELECT hoa_don_id, ma_hoa_don, ngay_tao, tong_tien, trang_thai, ho_ten_nhan
                FROM dbo.HOA_DON 
                WHERE hoa_don_id = @id OR ma_hoa_don = @code;";

            var order = await connection.QuerySingleOrDefaultAsync<dynamic>(sql, new { id = orderId, code = $"HD{orderId:D6}" });
            if (order == null)
            {
                return Ok(new ChatResponse
                {
                    Reply = $"Dạ em chưa tìm thấy đơn hàng mã **#{orderId}** trong hệ thống. Quý khách vui lòng kiểm tra lại mã đơn hoặc tra cứu trên trang [Lịch sử đơn hàng](checkout.html#lich-su) nhé!",
                    Intent = "order_tracking",
                    Suggestions = new List<string> { "Quản lý đơn hàng", "📞 Hotline 1900 8888" }
                });
            }

            string status = (string)order.trang_thai;
            string statusText = status switch
            {
                "cho_xu_ly" => "⏳ Đang chờ xác nhận",
                "dang_giao" => "🚚 Đang trên đường vận chuyển",
                "da_giao" => "✅ Giao hàng thành công",
                "da_huy" => "❌ Đã hủy",
                _ => status
            };

            int total = (int)order.tong_tien;

            return Ok(new ChatResponse
            {
                Reply = $"📦 **Thông tin đơn hàng #{orderId}:**\n\n" +
                        $"• **Trạng thái:** {statusText}\n" +
                        $"• **Người nhận:** {order.ho_ten_nhan}\n" +
                        $"• **Tổng thanh toán:** {total:N0}₫\n" +
                        $"• **Ngày đặt:** {((DateTime)order.ngay_tao):dd/MM/yyyy HH:mm}\n\n" +
                        $"Cần hỗ trợ thay đổi địa chỉ hoặc thời gian nhận hàng, quý khách hãy liên hệ Hotline `1900 8888` để được phục vụ nhanh nhất ạ!",
                Intent = "order_tracking_result",
                Suggestions = new List<string> { "🚚 Thời gian giao hàng", "🔄 Chính sách đổi trả" }
            });
        }
        catch
        {
            return Ok(new ChatResponse
            {
                Reply = "Để kiểm tra đơn hàng, quý khách vui lòng truy cập trang [Lịch sử đơn hàng](checkout.html#lich-su) để xem chi tiết đầy đủ nhé!",
                Intent = "order_tracking"
            });
        }
    }

    private static bool IsAdvisoryProductQuestion(string normalizedText)
    {
        return normalizedText.Contains('?') ||
               Regex.IsMatch(
                   normalizedText,
                   @"(phối|mix|chất\s*liệu|vải|mặc\s*đi|hợp\s*với|phong\s*cách|so\s*sánh|nên\s*chọn|nên\s*mua|tư\s*vấn|tầm\s*giá|dưới\s*\d|trên\s*\d|khoảng\s*\d|set\s*đồ|outfit|mùa\s*(?:đông|hè|thu|xuân)|lạnh|nóng|công\s*sở|đi\s*(?:làm|chơi|học|tiệc)|co\s*giãn|chống\s*nước|thoáng|mỏng|dày|bền)"
               );
    }

    private async Task<ChatResponse?> TryHandleWithGeminiAsync(
        string userMessage,
        IReadOnlyList<ChatHistoryTurn>? history,
        CancellationToken cancellationToken)
    {
        if (_geminiChatService == null || !_geminiChatService.IsConfigured)
        {
            return null;
        }

        var snapshot = await GetStoreSnapshotAsync();
        var aiResult = await _geminiChatService.GenerateReplyAsync(
            userMessage,
            history,
            snapshot.ContextText,
            cancellationToken);

        if (aiResult == null || string.IsNullOrWhiteSpace(aiResult.Reply))
        {
            return null;
        }

        var verifiedProducts = aiResult.RecommendedProductIds
            .Where(snapshot.ProductsById.ContainsKey)
            .Select(id => snapshot.ProductsById[id])
            .Take(4)
            .ToList();

        var suggestions = aiResult.Suggestions.Count > 0
            ? aiResult.Suggestions
            : new List<string> { "🧥 Gợi ý áo & quần", "📏 Tư vấn chọn size", "🏷️ Mã giảm giá hot" };

        return new ChatResponse
        {
            Reply = aiResult.Reply,
            Intent = "ai_assistant",
            Suggestions = suggestions,
            Products = verifiedProducts.Count > 0 ? verifiedProducts : null
        };
    }

    private async Task<StoreCatalogSnapshot> GetStoreSnapshotAsync()
    {
        if (_memoryCache != null && _memoryCache.TryGetValue(StoreSnapshotCacheKey, out StoreCatalogSnapshot? cached) && cached != null)
        {
            return cached;
        }

        var snapshot = await BuildStoreSnapshotAsync();
        _memoryCache?.Set(StoreSnapshotCacheKey, snapshot, TimeSpan.FromMinutes(3));
        return snapshot;
    }

    private async Task<StoreCatalogSnapshot> BuildStoreSnapshotAsync()
    {
        var sb = new StringBuilder();
        var productsById = new Dictionary<int, ChatProductCardDto>();

        sb.AppendLine("=== CHÍNH SÁCH & THÔNG TIN CỬA HÀNG ===");
        sb.AppendLine("- Thương hiệu: Endless Shop (phong cách tối giản Bắc Âu / Scandinavian Warm Minimal).");
        sb.AppendLine("- Giao hàng: Nội thành HN/HCM 1-2 ngày, toàn quốc 2-4 ngày. Phí ship 30.000₫, MIỄN PHÍ SHIP từ 300.000₫ hoặc dùng mã FREESHIP. Được đồng kiểm COD.");
        sb.AppendLine("- Thanh toán: COD (tiền mặt khi nhận hàng) và chuyển khoản VietQR.");
        sb.AppendLine("- Đổi trả: Miễn phí đổi size/lỗi NSX tận nhà trong 30 ngày (còn tem mác, chưa giặt tẩy).");
        sb.AppendLine("- Bảng size: S (<1m60, <52kg) | M (1m60-1m67, 52-62kg) | L (1m68-1m75, 63-72kg) | XL (1m76-1m83, 73-82kg) | XXL (>1m83, >82kg).");
        sb.AppendLine("- Liên hệ: Hotline 1900 8888 (24/7) | Email support@endlessshop.vn | Showroom 123 Phố Huế, Hai Bà Trưng, Hà Nội (08:30 - 22:00).");

        try
        {
            using var connection = _db.CreateConnection();
            const string productSql = @"
                SELECT TOP 50 p.san_pham_id, p.ten_sp, p.mo_ta, p.gia, p.ton_kho,
                       p.sizes_json, p.colors_json, p.images_json, d.ma_danh_muc
                FROM dbo.SAN_PHAM p
                JOIN dbo.DANH_MUC d ON d.danh_muc_id = p.danh_muc_id
                ORDER BY p.la_moi DESC, p.san_pham_id ASC;";

            var productRows = (await connection.QueryAsync<dynamic>(productSql)).ToList();
            if (productRows.Count > 0)
            {
                sb.AppendLine("\n=== DANH MỤC SẢN PHẨM HIỆN CÓ ===");
                foreach (var r in productRows)
                {
                    int id = (int)r.san_pham_id;
                    string name = (string)r.ten_sp;
                    int price = (int)r.gia;
                    int stock = (int)r.ton_kho;
                    string category = (string)r.ma_danh_muc;
                    string? desc = (string?)r.mo_ta;
                    var sizes = ParseJsonStringList((string?)r.sizes_json);
                    var colors = ParseJsonStringList((string?)r.colors_json);

                    productsById[id] = new ChatProductCardDto
                    {
                        Id = id,
                        Name = name,
                        Price = price,
                        Category = category,
                        Description = desc,
                        Image = ExtractFirstImage((string?)r.images_json)
                    };

                    var shortDesc = string.IsNullOrWhiteSpace(desc)
                        ? ""
                        : (desc.Length > 120 ? desc.Substring(0, 120) + "..." : desc);

                    sb.Append($"- ID {id} | {name} | Danh mục: {category} | Giá: {price:N0}₫ | Tồn kho: {stock}");
                    if (sizes.Count > 0) sb.Append($" | Size: {string.Join("/", sizes)}");
                    if (colors.Count > 0) sb.Append($" | Màu: {string.Join("/", colors)}");
                    if (!string.IsNullOrEmpty(shortDesc)) sb.Append($" | Mô tả: {shortDesc}");
                    sb.AppendLine();
                }
            }

            const string voucherSql = @"
                SELECT ma_code, loai_giam, gia_tri
                FROM dbo.VOUCHER
                WHERE han_su_dung IS NULL OR han_su_dung > GETDATE()
                ORDER BY gia_tri DESC;";

            var voucherRows = (await connection.QueryAsync<dynamic>(voucherSql)).ToList();
            if (voucherRows.Count > 0)
            {
                sb.AppendLine("\n=== MÃ GIẢM GIÁ ĐANG HOẠT ĐỘNG ===");
                foreach (var v in voucherRows)
                {
                    string code = (string)v.ma_code;
                    string type = (string)v.loai_giam;
                    int val = (int)v.gia_tri;
                    string desc = type == "percent" ? $"Giảm {val}%" : $"Giảm {val:N0}₫";
                    sb.AppendLine($"- {code}: {desc}");
                }
            }
        }
        catch
        {
            sb.AppendLine("\n=== MÃ GIẢM GIÁ MẶC ĐỊNH ===");
            sb.AppendLine("- ENDLESS10: Giảm 10% | FREESHIP: Giảm 30.000₫ phí ship | KM50K: Giảm 50.000₫ | BF100: Giảm 100.000₫");
        }

        return new StoreCatalogSnapshot(sb.ToString(), productsById);
    }

    private static string? ExtractFirstImage(string? imgJson)
    {
        return ParseJsonStringList(imgJson).FirstOrDefault();
    }

    private static List<string> ParseJsonStringList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return new List<string>();
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? new List<string>();
        }
        catch
        {
            return new List<string>();
        }
    }

    private sealed record StoreCatalogSnapshot(string ContextText, Dictionary<int, ChatProductCardDto> ProductsById);
}
