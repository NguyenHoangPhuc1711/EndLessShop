using System.Text.Json.Serialization;

namespace EndLessShop.Api.Models;

public class CreateStaffRequest
{
    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;

    [JsonPropertyName("fullName")]
    public string FullName { get; set; } = string.Empty;

    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    [JsonPropertyName("phone")]
    public string? Phone { get; set; }

    [JsonPropertyName("role")]
    public string Role { get; set; } = "nhan_vien";

    [JsonPropertyName("position")]
    public string? Position { get; set; }
}

public class UpdateAccountRoleRequest
{
    [JsonPropertyName("role")]
    public string Role { get; set; } = string.Empty;

    [JsonPropertyName("position")]
    public string? Position { get; set; }
}

public class UpdateAccountStatusRequest
{
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;
}
