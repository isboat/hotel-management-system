using System.Security.Claims;
using Hms.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Security;

/// <summary>Evaluates current property membership for every hotel operation.</summary>
public sealed class TenantAccess(HotelDatabase database)
{
    public static Guid? Actor(ClaimsPrincipal user) =>
        Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    public Task<bool> Allows(ClaimsPrincipal user, Guid hotel, params string[] roles) =>
        database.Memberships.AnyAsync(row => row.HotelId == hotel && row.StaffId == Actor(user) &&
            row.Active && roles.Contains(row.Role) &&
            database.Hotels.Any(property => property.Id == hotel && !property.Suspended && !property.Archived));
}
