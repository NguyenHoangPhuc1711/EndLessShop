using System.Data;
using Microsoft.Data.SqlClient;

namespace EndLessShop.Api.Data;

public interface IDbConnectionFactory
{
    IDbConnection CreateConnection();
}

public class DbConnectionFactory : IDbConnectionFactory
{
    private readonly string _connectionString;

    public DbConnectionFactory(IConfiguration configuration)
    {
        var rawConn = configuration.GetConnectionString("DefaultConnection") 
                      ?? Environment.GetEnvironmentVariable("MSSQL_CONNECTION_STRING");

        if (string.IsNullOrWhiteSpace(rawConn))
        {
            var host = Environment.GetEnvironmentVariable("DB_HOST") ?? "127.0.0.1";
            var port = Environment.GetEnvironmentVariable("DB_PORT") ?? "1433";
            var db = Environment.GetEnvironmentVariable("DB_NAME") ?? "web_thoi_trang";
            var user = Environment.GetEnvironmentVariable("DB_USER") ?? "endless_runtime";
            var pass = Environment.GetEnvironmentVariable("DB_PASSWORD") ?? "LocalDevOnly!ChangeInEnv";
            
            rawConn = $"Server={host},{port};Database={db};User Id={user};Password={pass};TrustServerCertificate=True;Encrypt=True;";
        }

        _connectionString = rawConn;
    }

    public IDbConnection CreateConnection()
    {
        return new SqlConnection(_connectionString);
    }
}
