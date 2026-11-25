using System.Data;
using System.Text.Json;
using EndLessShop.Api.Controllers;
using EndLessShop.Api.Data;
using EndLessShop.Api.Models;
using EndLessShop.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Xunit;

namespace EndLessShop.Tests;

public class AdminValidationTests
{
    private sealed class StubDbFactory : IDbConnectionFactory
    {
        public IDbConnection CreateConnection()
            => throw new NotSupportedException("Stub DB should not be called when unauthenticated.");
    }

    private sealed class StubSession : ISession
    {
        private readonly Dictionary<string, byte[]> _store = new();
        public bool IsAvailable => true;
        public string Id => "stub-session";
        public IEnumerable<string> Keys => _store.Keys;
        public void Clear() => _store.Clear();
        public Task CommitAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task LoadAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public void Remove(string key) => _store.Remove(key);
        public void Set(string key, byte[] value) => _store[key] = value;
        public bool TryGetValue(string key, out byte[] value) => _store.TryGetValue(key, out value!);
    }

    [Theory]
    [InlineData("bo-mua-dong", "bo_mua_dong")]
    [InlineData("  Ao Khoac  ", "ao_khoac")]
    [InlineData("ao__thun", "ao_thun")]
    public void NormalizeCategoryCode_NormalizesSpacesAndHyphens(string input, string expected)
    {
        Assert.Equal(expected, AdminController.NormalizeCategoryCode(input));
    }

    [Theory]
    [InlineData("bo_mua_dong", true)]
    [InlineData("ao_khoac", true)]
    [InlineData("a", true)]
    [InlineData("123_abc", false)]
    [InlineData("bo-mua-dong", false)]
    [InlineData("invalid!", false)]
    [InlineData("too_long_category_slug_over_20", false)]
    [InlineData("", false)]
    public void IsValidCategoryCode_EnforcesClientCatalogRegex(string code, bool expected)
    {
        Assert.Equal(expected, AdminController.IsValidCategoryCode(code));
    }

    [Fact]
    public void ProductDto_SerializesBundleItemsAndOriginalPrice()
    {
        var dto = new ProductDto
        {
            Id = 18,
            Name = "Bộ Đông Công Sở Bắc Âu",
            Category = "bo_mua_dong",
            CategoryName = "Bộ Mùa Đông",
            Price = 799000,
            OriginalPrice = 1186000,
            BundleItems = new List<int> { 13, 14, 16, 12 },
            Stock = 50
        };

        var json = JsonSerializer.Serialize(dto);
        Assert.Contains("\"originalPrice\":1186000", json);
        Assert.Contains("\"bundleItems\":[13,14,16,12]", json);
        Assert.Contains("\"category\":\"bo_mua_dong\"", json);
    }

    [Fact]
    public async Task AdminEndpoints_WithoutSession_Return401()
    {
        var controller = new AdminController(new StubDbFactory(), new PasswordService())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { Session = new StubSession() }
            }
        };

        var staffResult = await controller.GetStaff();
        var catResult = await controller.GetCategories();
        var ordersResult = await controller.GetOrders();

        Assert.Equal(401, Assert.IsType<ObjectResult>(staffResult).StatusCode);
        Assert.Equal(401, Assert.IsType<ObjectResult>(catResult).StatusCode);
        Assert.Equal(401, Assert.IsType<ObjectResult>(ordersResult).StatusCode);
    }
}
