using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using EndLessShop.Api.Data;
using EndLessShop.Api.Services;
using Microsoft.AspNetCore.RateLimiting;

if (args.Contains("--healthcheck"))
{
    try
    {
        var port = Environment.GetEnvironmentVariable("PORT") ?? "3000";
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(4) };
        var res = client.GetAsync($"http://127.0.0.1:{port}/api/health").GetAwaiter().GetResult();
        Environment.Exit(res.IsSuccessStatusCode ? 0 : 1);
    }
    catch
    {
        Environment.Exit(1);
    }
}

var builder = WebApplication.CreateBuilder(args);

// Register Core Services
builder.Services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();
builder.Services.AddSingleton<IPasswordService, PasswordService>();

// Session & Memory Cache
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromHours(2);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.Lax;
    options.Cookie.Name = "endless.sid";
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
});

// Rate Limiter
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth-limit", httpContext =>
    {
        var clientIp = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(
            clientIp,
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(15),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            });
    });
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "900";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            message = "Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.",
            code = "rate_limit_exceeded"
        }, cancellationToken: token);
    };
});

// JSON Serialization Configuration
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        options.JsonSerializerOptions.WriteIndented = false;
    });

// CORS Configuration
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? new[]
        {
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8080",
            "http://127.0.0.1:8080",
            "http://localhost:5000",
            "http://127.0.0.1:5000",
            "https://nguyenhoangphuc1711.github.io"
        };

        policy.WithOrigins(origins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("AllowFrontend");
app.UseRateLimiter();

app.UseDefaultFiles();
app.UseStaticFiles();

var localImgPath = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "img"));
if (Directory.Exists(localImgPath))
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(localImgPath),
        RequestPath = "/img"
    });
}

app.UseSession();

app.UseAuthorization();

app.MapControllers();

app.Run();
