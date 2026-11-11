using System.Security.Cryptography;
using System.Text;
using EndLessShop.Api.Services;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace EndLessShop.Tests;

public class SecurityValidatorTests
{
    private class MockSession : ISession
    {
        private readonly Dictionary<string, byte[]> _store = new();

        public bool IsAvailable => true;
        public string Id => "test-session";
        public IEnumerable<string> Keys => _store.Keys;

        public void Clear() => _store.Clear();
        public Task CommitAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LoadAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public void Remove(string key) => _store.Remove(key);
        public void Set(string key, byte[] value) => _store[key] = value;
        public bool TryGetValue(string key, out byte[] value) => _store.TryGetValue(key, out value!);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    [InlineData("http://localhost:3000")]
    [InlineData("http://127.0.0.1:3000")]
    [InlineData("http://localhost:5000")]
    [InlineData("http://127.0.0.1:5100")]
    [InlineData("https://nguyenhoangphuc1711.github.io")]
    public void IsAllowedOrigin_ValidOrEmpty_ShouldReturnTrue(string? origin)
    {
        Assert.True(SecurityValidator.IsAllowedOrigin(origin!));
    }

    [Theory]
    [InlineData("https://evil.attacker.com")]
    [InlineData("https://foreign.example")]
    [InlineData("http://fake-localhost:3000")]
    public void IsAllowedOrigin_ForeignOrigins_ShouldReturnFalse(string origin)
    {
        Assert.False(SecurityValidator.IsAllowedOrigin(origin));
    }

    [Fact]
    public void ValidateCsrfAndOrigin_MissingCsrfHeader_ShouldReturnFalse()
    {
        var context = new DefaultHttpContext();
        var session = new MockSession();
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        session.Set("csrfToken", Encoding.UTF8.GetBytes(token));
        context.Session = session;

        var result = SecurityValidator.ValidateCsrfAndOrigin(context);
        Assert.False(result);
    }

    [Fact]
    public void ValidateCsrfAndOrigin_InvalidFormat_ShouldReturnFalse()
    {
        var context = new DefaultHttpContext();
        var session = new MockSession();
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        session.Set("csrfToken", Encoding.UTF8.GetBytes(token));
        context.Session = session;
        context.Request.Headers["X-CSRF-Token"] = new string('é', 64);

        var result = SecurityValidator.ValidateCsrfAndOrigin(context);
        Assert.False(result);
    }

    [Fact]
    public void ValidateCsrfAndOrigin_Mismatch_ShouldReturnFalse()
    {
        var context = new DefaultHttpContext();
        var session = new MockSession();
        var token1 = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var token2 = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        session.Set("csrfToken", Encoding.UTF8.GetBytes(token1));
        context.Session = session;
        context.Request.Headers["X-CSRF-Token"] = token2;

        var result = SecurityValidator.ValidateCsrfAndOrigin(context);
        Assert.False(result);
    }

    [Fact]
    public void ValidateCsrfAndOrigin_ForeignOrigin_ShouldReturnFalse()
    {
        var context = new DefaultHttpContext();
        var session = new MockSession();
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        session.Set("csrfToken", Encoding.UTF8.GetBytes(token));
        context.Session = session;
        context.Request.Headers["X-CSRF-Token"] = token;
        context.Request.Headers["Origin"] = "https://foreign.example";

        var result = SecurityValidator.ValidateCsrfAndOrigin(context);
        Assert.False(result);
    }

    [Fact]
    public void ValidateCsrfAndOrigin_MatchingTokenAndAllowedOrigin_ShouldReturnTrue()
    {
        var context = new DefaultHttpContext();
        var session = new MockSession();
        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        session.Set("csrfToken", Encoding.UTF8.GetBytes(token));
        context.Session = session;
        context.Request.Headers["X-CSRF-Token"] = token;
        context.Request.Headers["Origin"] = "http://localhost:3000";

        var result = SecurityValidator.ValidateCsrfAndOrigin(context);
        Assert.True(result);
    }
}
