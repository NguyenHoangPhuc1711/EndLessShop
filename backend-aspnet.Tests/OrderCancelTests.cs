using System.Data;
using System.Security.Cryptography;
using System.Text;
using EndLessShop.Api.Controllers;
using EndLessShop.Api.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace EndLessShop.Tests;

public class OrderCancelTests
{
    private sealed class DummyDbFactory : IDbConnectionFactory
    {
        public IDbConnection CreateConnection()
        {
            throw new NotSupportedException("Unit test stub DB should not be called on auth/CSRF/input rejection.");
        }
    }

    private sealed class MockSession : ISession
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

    private static OrdersController CreateController(int? userId, string? csrfHeader = null, string? origin = null, bool setSessionToken = true)
    {
        var context = new DefaultHttpContext();
        var session = new MockSession();
        if (userId.HasValue)
        {
            session.SetInt32("userId", userId.Value);
        }

        var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        if (setSessionToken)
        {
            session.Set("csrfToken", Encoding.UTF8.GetBytes(token));
        }

        if (csrfHeader == "__VALID__")
        {
            context.Request.Headers["X-CSRF-Token"] = token;
        }
        else if (csrfHeader != null)
        {
            context.Request.Headers["X-CSRF-Token"] = csrfHeader;
        }

        if (origin != null)
        {
            context.Request.Headers["Origin"] = origin;
        }

        context.Session = session;

        var config = new ConfigurationBuilder().AddInMemoryCollection().Build();
        return new OrdersController(new DummyDbFactory(), config)
        {
            ControllerContext = new ControllerContext { HttpContext = context }
        };
    }

    [Fact]
    public async Task CancelOrder_Unauthenticated_Returns401()
    {
        var controller = CreateController(userId: null, csrfHeader: "__VALID__");
        var result = await controller.CancelOrder(100);

        var obj = Assert.IsType<UnauthorizedObjectResult>(result);
        Assert.Equal(401, obj.StatusCode);
    }

    [Fact]
    public async Task CancelOrder_MissingCsrf_Returns403()
    {
        var controller = CreateController(userId: 5, csrfHeader: null);
        var result = await controller.CancelOrder(100);

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, obj.StatusCode);
    }

    [Fact]
    public async Task CancelOrder_ForeignOrigin_Returns403()
    {
        var controller = CreateController(userId: 5, csrfHeader: "__VALID__", origin: "https://evil.attacker.com");
        var result = await controller.CancelOrder(100);

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(403, obj.StatusCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task CancelOrder_NonPositiveId_Returns404WithoutTouchingDb(int orderId)
    {
        var controller = CreateController(userId: 5, csrfHeader: "__VALID__");
        var result = await controller.CancelOrder(orderId);

        var obj = Assert.IsType<NotFoundObjectResult>(result);
        Assert.Equal(404, obj.StatusCode);
    }
}
