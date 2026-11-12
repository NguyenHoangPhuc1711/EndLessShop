using System.Text.Json.Serialization;

namespace EndLessShop.Api.Models;

public class OrderItemInput
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("size")]
    public string Size { get; set; } = string.Empty;

    [JsonPropertyName("color")]
    public string Color { get; set; } = string.Empty;

    [JsonPropertyName("qty")]
    public int Qty { get; set; }
}

public class DeliveryInfo
{
    [JsonPropertyName("fullName")]
    public string FullName { get; set; } = string.Empty;

    [JsonPropertyName("phone")]
    public string Phone { get; set; } = string.Empty;

    [JsonPropertyName("address")]
    public string Address { get; set; } = string.Empty;

    [JsonPropertyName("note")]
    public string? Note { get; set; }
}

public class OrderCheckoutRequest
{
    [JsonPropertyName("items")]
    public List<OrderItemInput> Items { get; set; } = new();

    [JsonPropertyName("voucherCode")]
    public string? VoucherCode { get; set; }

    [JsonPropertyName("payment")]
    public string Payment { get; set; } = "cod";

    [JsonPropertyName("delivery")]
    public DeliveryInfo? Delivery { get; set; }

    [JsonPropertyName("saveShippingInfo")]
    public bool? SaveShippingInfo { get; set; }
}

public class PricedItemDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("image")]
    public string? Image { get; set; }

    [JsonPropertyName("size")]
    public string Size { get; set; } = string.Empty;

    [JsonPropertyName("color")]
    public string Color { get; set; } = string.Empty;

    [JsonPropertyName("qty")]
    public int Qty { get; set; }

    [JsonPropertyName("price")]
    public int Price { get; set; }
}

public class OrderQuoteResponse
{
    [JsonPropertyName("subtotal")]
    public int Subtotal { get; set; }

    [JsonPropertyName("discount")]
    public int Discount { get; set; }

    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("voucherCode")]
    public string? VoucherCode { get; set; }

    [JsonPropertyName("items")]
    public List<PricedItemDto> Items { get; set; } = new();
}

public class OrderSummaryDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("date")]
    public DateTime Date { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("payment")]
    public string Payment { get; set; } = "cod";

    [JsonPropertyName("subtotal")]
    public int? Subtotal { get; set; }

    [JsonPropertyName("discount")]
    public int Discount { get; set; }

    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("voucherCode")]
    public string? VoucherCode { get; set; }

    [JsonPropertyName("itemCount")]
    public int ItemCount { get; set; }
}

public class OrderDetailDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("date")]
    public DateTime Date { get; set; }

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("payment")]
    public string Payment { get; set; } = "cod";

    [JsonPropertyName("subtotal")]
    public int? Subtotal { get; set; }

    [JsonPropertyName("discount")]
    public int Discount { get; set; }

    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("voucherCode")]
    public string? VoucherCode { get; set; }

    [JsonPropertyName("delivery")]
    public DeliveryInfo Delivery { get; set; } = new();

    [JsonPropertyName("items")]
    public List<PricedItemDto> Items { get; set; } = new();

    [JsonPropertyName("replayed")]
    public bool Replayed { get; set; }

    [JsonPropertyName("qrInfo")]
    public PaymentQrInfo? QrInfo { get; set; }
}

public class PaymentQrInfo
{
    [JsonPropertyName("bankId")]
    public string BankId { get; set; } = string.Empty;

    [JsonPropertyName("bankName")]
    public string BankName { get; set; } = string.Empty;

    [JsonPropertyName("accountNo")]
    public string AccountNo { get; set; } = string.Empty;

    [JsonPropertyName("accountName")]
    public string AccountName { get; set; } = string.Empty;

    [JsonPropertyName("amount")]
    public int Amount { get; set; }

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("qrUrl")]
    public string QrUrl { get; set; } = string.Empty;
}
