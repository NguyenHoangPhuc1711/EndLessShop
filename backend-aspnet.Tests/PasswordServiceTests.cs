using EndLessShop.Api.Services;
using Xunit;

namespace EndLessShop.Tests;

public class PasswordServiceTests
{
    private readonly PasswordService _passwordService = new();

    [Fact]
    public void HashPassword_ShouldReturnValidArgon2idFormat()
    {
        var password = "SecurePassword123!";
        var hash = _passwordService.HashPassword(password);

        Assert.NotNull(hash);
        Assert.StartsWith("$argon2id$", hash);
    }

    [Fact]
    public void VerifyPassword_ShouldReturnTrueForCorrectPassword()
    {
        var password = "SuperSecretPassword2026!";
        var hash = _passwordService.HashPassword(password);

        var isValid = _passwordService.VerifyPassword(password, hash);

        Assert.True(isValid);
    }

    [Fact]
    public void VerifyPassword_ShouldReturnFalseForWrongPassword()
    {
        var password = "CorrectPassword123";
        var wrongPassword = "WrongPassword456";
        var hash = _passwordService.HashPassword(password);

        var isValid = _passwordService.VerifyPassword(wrongPassword, hash);

        Assert.False(isValid);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not_a_valid_hash")]
    [InlineData("$2a$12$somebcryptstring")]
    public void VerifyPassword_InvalidHash_ShouldReturnFalse(string invalidHash)
    {
        var isValid = _passwordService.VerifyPassword("AnyPassword", invalidHash);
        Assert.False(isValid);
    }
}
