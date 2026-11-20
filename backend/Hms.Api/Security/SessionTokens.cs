using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Hms.Api.Data;
using Microsoft.IdentityModel.Tokens;

namespace Hms.Api.Security;

/// <summary>Creates short-lived JWTs and stores only hashed refresh credentials.</summary>
public sealed class SessionTokens(HotelDatabase database, SymmetricSecurityKey key)
{
    public static string Digest(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    public async Task<object> Issue(Staff staff, DateTime expiresUtc)
    {
        var refreshToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        database.RefreshSessions.Add(new RefreshSession(Digest(refreshToken), staff.Id, staff.SessionVersion, expiresUtc));
        await database.SaveChangesAsync();
        var token = new JwtSecurityToken("hotel-management-system", "hotel-staff",
            [new Claim(ClaimTypes.NameIdentifier, staff.Id.ToString()), new Claim("session_version", staff.SessionVersion.ToString())],
            expires: DateTime.UtcNow.AddMinutes(15), signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
        return new { token = new JwtSecurityTokenHandler().WriteToken(token), refreshToken, staff.Id, staff.Name, staff.IsSystemAdmin };
    }
}
