using System.Security.Cryptography;
using System.Text;
using Hms.Api.Data;

namespace Hms.Api.Security;

/// <summary>Issues a 30-minute recovery code and stores only its digest.</summary>
public static class PasswordResetCodes
{
    public static async Task<string> IssueAsync(HotelDatabase database, Guid staffId)
    {
        var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var digest = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));
        database.PasswordResets.Add(new PasswordReset(digest, staffId, DateTime.UtcNow.AddMinutes(30)));
        await database.SaveChangesAsync();
        return code;
    }
}
