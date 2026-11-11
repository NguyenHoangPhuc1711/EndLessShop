using Isopoh.Cryptography.Argon2;

namespace EndLessShop.Api.Services;

public interface IPasswordService
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string hash);
}

public class PasswordService : IPasswordService
{
    public string HashPassword(string password)
    {
        // Generates standard $argon2id$ hash with cryptographically secure salt,
        // matching the Node.js argon2 settings: memoryCost 65536 (64 MiB), timeCost 3, parallelism 1
        return Argon2.Hash(password, timeCost: 3, memoryCost: 65536);
    }

    public bool VerifyPassword(string password, string hash)
    {
        if (string.IsNullOrWhiteSpace(hash) || !hash.StartsWith("$argon2id$"))
            return false;

        try
        {
            return Argon2.Verify(hash, password);
        }
        catch
        {
            return false;
        }
    }
}
