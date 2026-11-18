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

LoadGeminiKeyFromDotEnvIfMissing();

var builder = WebApplication.CreateBuilder(args);

// Register Core Services
builder.Services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();
builder.Services.AddSingleton<IPasswordService, PasswordService>();
builder.Services.AddMemoryCache();
builder.Services.Configure<GeminiOptions>(builder.Configuration.GetSection(GeminiOptions.SectionName));
builder.Services.AddHttpClient<IGeminiChatService, GeminiChatService>();

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
    options.AddPolicy("chat-limit", httpContext =>
    {
        var clientIp = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(
            clientIp,
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            });
    });
    options.OnRejected = async (context, token) =>
    {
        var isChatEndpoint = context.HttpContext.Request.Path.StartsWithSegments("/api/chat", StringComparison.OrdinalIgnoreCase);
        context.HttpContext.Response.Headers.RetryAfter = isChatEndpoint ? "60" : "900";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            message = isChatEndpoint
                ? "Quá nhiều tin nhắn trong thời gian ngắn. Vui lòng thử lại sau 1 phút."
                : "Quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.",
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

static void LoadGeminiKeyFromDotEnvIfMissing()
{
    if (!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("GEMINI_API_KEY")))
    {
        return;
    }

    var candidatePaths = new[]
    {
        Path.Combine(Directory.GetCurrentDirectory(), ".env"),
        Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "..", ".env")),
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".env")
    };

    foreach (var path in candidatePaths)
    {
        if (!File.Exists(path))
        {
            continue;
        }

        try
        {
            foreach (var rawLine in File.ReadLines(path))
            {
                var line = rawLine.Trim();
                if (string.IsNullOrEmpty(line) || line.StartsWith('#'))
                {
                    continue;
                }

                if (line.StartsWith("export ", StringComparison.Ordinal))
                {
                    line = line.Substring(7).TrimStart();
                }

                const string prefix = "GEMINI_API_KEY=";
                if (!line.StartsWith(prefix, StringComparison.Ordinal))
                {
                    continue;
                }

                var val = line.Substring(prefix.Length).Trim();
                if (val.Length >= 2 && ((val.StartsWith('"') && val.EndsWith('"')) || (val.StartsWith('\'') && val.EndsWith('\''))))
                {
                    val = val.Substring(1, val.Length - 2);
                }

                if (!string.IsNullOrWhiteSpace(val))
                {
                    Environment.SetEnvironmentVariable("GEMINI_API_KEY", val);
                    return;
                }
            }
        }
        catch
        {
            // Ignore unreadable local .env files
        }
    }
}
