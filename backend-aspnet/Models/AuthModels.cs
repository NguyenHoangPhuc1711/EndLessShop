using System.Text.Json.Serialization;

namespace EndLessShop.Api.Models;

public class UserDto
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("fullName")]
    public string FullName { get; set; } = string.Empty;

    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    [JsonPropertyName("phone")]
    public string? Phone { get; set; }

    [JsonPropertyName("address")]
    public string? Address { get; set; }

    [JsonPropertyName("role")]
    public string Role { get; set; } = "khach_hang";
}

public class UpdateShippingInfoRequest
{
    [JsonPropertyName("fullName")]
    public string? FullName { get; set; }

    [JsonPropertyName("phone")]
    public string? Phone { get; set; }

    [JsonPropertyName("address")]
    public string? Address { get; set; }
}

public class RegisterRequest
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
}

public class LoginRequest
{
    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;
}

public class LoginResponse
{
    [JsonPropertyName("user")]
    public UserDto User { get; set; } = null!;

    [JsonPropertyName("csrfToken")]
    public string CsrfToken { get; set; } = string.Empty;
}

public class ForgotPasswordRequest
{
    [JsonPropertyName("identifier")]
    public string Identifier { get; set; } = string.Empty;
}

public class AccountEntity
{
    public int id { get; set; }
    public string username { get; set; } = string.Empty;
    public string passwordHash { get; set; } = string.Empty;
    public string fullName { get; set; } = string.Empty;
    public string email { get; set; } = string.Empty;
    public string? phone { get; set; }
    public string? address { get; set; }
    public string role { get; set; } = string.Empty;
}
