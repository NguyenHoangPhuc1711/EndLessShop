using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;

namespace EndLessShop.Api.Services;

public static class SecurityValidator
{
    private static readonly Regex Hex64Pattern = new("^[0-9a-fA-F]{64}$", RegexOptions.Compiled);

    private static readonly HashSet<string> DefaultAllowedOrigins = new(StringComparer.OrdinalIgnoreCase)
    {
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:5100",
        "http://127.0.0.1:5100",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "https://nguyenhoangphuc1711.github.io"
    };

    public static bool IsAllowedOrigin(string origin)
    {
        if (string.IsNullOrWhiteSpace(origin))
        {
            return true;
        }

        if (DefaultAllowedOrigins.Contains(origin))
        {
            return true;
        }

        var envOrigins = Environment.GetEnvironmentVariable("APP_ORIGINS");
        if (!string.IsNullOrWhiteSpace(envOrigins))
        {
            var parts = envOrigins.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var part in parts)
            {
                if (string.Equals(part, origin, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
        }

        return false;
    }

    public static bool ValidateCsrfAndOrigin(HttpContext context)
    {
        // 1. Origin validation (if provided)
        if (context.Request.Headers.TryGetValue("Origin", out var originValues))
        {
            var origin = originValues.ToString();
            if (!string.IsNullOrWhiteSpace(origin) && !IsAllowedOrigin(origin))
            {
                return false;
            }
        }

        // 2. CSRF token validation
        var supplied = context.Request.Headers["X-CSRF-Token"].ToString();
        var expected = context.Session.GetString("csrfToken");

        if (string.IsNullOrWhiteSpace(supplied) || string.IsNullOrWhiteSpace(expected))
        {
            return false;
        }

        if (supplied.Length != 64 || expected.Length != 64)
        {
            return false;
        }

        if (!Hex64Pattern.IsMatch(supplied) || !Hex64Pattern.IsMatch(expected))
        {
            return false;
        }

        var suppliedBytes = Encoding.UTF8.GetBytes(supplied.ToLowerInvariant());
        var expectedBytes = Encoding.UTF8.GetBytes(expected.ToLowerInvariant());

        return CryptographicOperations.FixedTimeEquals(suppliedBytes, expectedBytes);
    }
}
