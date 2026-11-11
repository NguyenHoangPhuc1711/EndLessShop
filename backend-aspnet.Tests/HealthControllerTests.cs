using System.Data;
using EndLessShop.Api.Controllers;
using EndLessShop.Api.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EndLessShop.Tests;

public class HealthControllerTests
{
    private class FaultyDbFactory : IDbConnectionFactory
    {
        public IDbConnection CreateConnection()
        {
            throw new Exception("Sensitive internal connection string: Server=10.0.0.5;User=sa;Password=super_secret_db_password;");
        }
    }

    [Fact]
    public async Task CheckHealth_WhenDbFails_ShouldReturn503AndNotLeakErrorMessage()
    {
        var faultyDb = new FaultyDbFactory();
        var logger = NullLogger<HealthController>.Instance;
        var controller = new HealthController(faultyDb, logger)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        var result = await controller.CheckHealth();

        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(503, objectResult.StatusCode);

        // Serialize or check anonymous properties
        var json = System.Text.Json.JsonSerializer.Serialize(objectResult.Value, new System.Text.Json.JsonSerializerOptions 
        { 
            Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping 
        });
        Assert.DoesNotContain("Sensitive internal", json);
        Assert.DoesNotContain("super_secret_db_password", json);
        Assert.Contains("Dịch vụ cơ sở dữ liệu tạm thời không khả dụng.", json);
    }
}
