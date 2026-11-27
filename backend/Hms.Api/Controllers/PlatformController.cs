using System.Data;
using Hms.Api.Contracts;
using Hms.Api.Data;
using Hms.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Controllers;

[ApiController, Authorize]
[Route("api/v1/platform")]
public sealed class PlatformController(HotelDatabase database) : ControllerBase
{
    private Task<bool> IsAdministrator() => database.Staff.AnyAsync(row => row.Id == TenantAccess.Actor(User) && row.IsSystemAdmin);

    /// <summary>Lists platform accounts, including accounts without a hotel membership.</summary>
    [HttpGet("users")]
    [AuditAction("viewed the platform user directory", "view the platform user directory")]
    public async Task<IActionResult> ListUsers(string? search, int offset = 0)
    {
        if (!await IsAdministrator()) return Forbid();
        if (offset < 0) return BadRequest("Offset must be zero or greater.");
        var query = database.Staff.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToUpperInvariant();
            query = query.Where(user => user.Email.Contains(term) || user.Name.ToUpper().Contains(term));
        }
        const int pageSize = 50;
        var users = await query.OrderBy(user => user.Name).ThenBy(user => user.Id)
            .Skip(offset).Take(pageSize + 1)
            .Select(user => new
            {
                user.Id, user.Name, user.Email, user.IsSystemAdmin,
                Hotels = (from member in database.Memberships
                          join hotel in database.Hotels on member.HotelId equals hotel.Id
                          where member.StaffId == user.Id
                          orderby hotel.Name, hotel.Id
                          select new { hotel.Id, hotel.Name, member.Role, member.Active }).ToList()
            }).ToListAsync();
        return Ok(new { items = users.Take(pageSize), hasMore = users.Count > pageSize });
    }

    /// <summary>Issues account-wide recovery for any user, regardless of hotel membership.</summary>
    [HttpPost("users/{staffId:guid}/reset")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    [AuditAction("issued a platform password reset code", "issue a platform password reset code")]
    public async Task<IActionResult> ResetUserPassword(Guid staffId)
    {
        if (!await IsAdministrator()) return Forbid();
        var user = await database.Staff.AsNoTracking().SingleOrDefaultAsync(row => row.Id == staffId);
        if (user is null) return NotFound();

        var code = await PasswordResetCodes.IssueAsync(database, staffId);
        AuditActionAttribute.Describe(HttpContext, $"issued a password reset code for {user.Name} ({user.Email.ToLowerInvariant()})");
        return Ok(new { code });
    }

    [HttpDelete("users/{staffId:guid}/properties/{propertyId:guid}")]
    [AuditAction("revoked a user’s hotel access", "revoke a user’s hotel access")]
    public async Task<IActionResult> RevokeHotelAccess(Guid staffId, Guid propertyId)
    {
        if (!await IsAdministrator()) return Forbid();
        var target = await (from member in database.Memberships
                            join staff in database.Staff on member.StaffId equals staff.Id
                            join hotel in database.Hotels on member.HotelId equals hotel.Id
                            where member.StaffId == staffId && member.HotelId == propertyId
                            select new { staff.Email, staff.Name, Hotel = hotel.Name }).SingleOrDefaultAsync();
        if (target is null) return NotFound();

        var removed = await database.Memberships.Where(row => row.StaffId == staffId && row.HotelId == propertyId)
            .ExecuteDeleteAsync();
        if (removed == 0) return NotFound();
        AuditActionAttribute.Describe(HttpContext, $"revoked {target.Name} ({target.Email.ToLowerInvariant()})’s access to {target.Hotel}");
        return NoContent();
    }

    [HttpDelete("users/{staffId:guid}")]
    [AuditAction("deleted a platform user account", "delete a platform user account")]
    public async Task<IActionResult> DeleteUser(Guid staffId)
    {
        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        if (!await IsAdministrator()) return Forbid();
        if (TenantAccess.Actor(User) == staffId) return Conflict("You cannot delete your own account.");
        var target = await database.Staff.AsNoTracking().SingleOrDefaultAsync(row => row.Id == staffId);
        if (target is null) return NotFound();

        await database.PasswordResets.Where(row => row.StaffId == staffId).ExecuteDeleteAsync();
        await database.RefreshSessions.Where(row => row.StaffId == staffId).ExecuteDeleteAsync();
        // Memberships cascade with the account. Financial and audit records retain the original account ID.
        await database.Staff.Where(row => row.Id == staffId).ExecuteDeleteAsync();
        await transaction.CommitAsync();
        AuditActionAttribute.Describe(HttpContext, $"deleted the account for {target.Name} ({target.Email.ToLowerInvariant()})");
        return NoContent();
    }

    [HttpGet("properties")]
    [AuditAction("viewed hotel tenants", "view hotel tenants")]
    public async Task<IActionResult> List() =>
        await IsAdministrator() ? Ok(await database.Hotels.OrderBy(row => row.Name).ToListAsync()) : Forbid();

    [HttpPost("properties")]
    [AuditAction("created a hotel tenant", "create a hotel tenant")]
    public async Task<IActionResult> Create(HotelInput input)
    {
        if (!await IsAdministrator()) return Forbid();
        var hotel = input.ApplyTo(new Hotel(Guid.NewGuid(), input.Name));
        database.Hotels.Add(hotel);
        await database.SaveChangesAsync();
        return Ok(hotel);
    }

    [HttpPut("properties/{hotelId:guid}")]
    [AuditAction("updated hotel details", "update hotel details")]
    public async Task<IActionResult> Edit(Guid hotelId, HotelInput input)
    {
        if (!await IsAdministrator()) return Forbid();
        var hotel = await database.Hotels.FindAsync(hotelId);
        if (hotel is null) return NotFound();
        database.Entry(hotel).CurrentValues.SetValues(input.ApplyTo(hotel));
        await database.SaveChangesAsync();
        return NoContent();
    }

    [HttpPatch("properties/{hotelId:guid}")]
    [AuditAction("changed a hotel tenant’s status", "change a hotel tenant’s status")]
    public async Task<IActionResult> ChangeStatus(Guid hotelId, StatusInput input)
    {
        if (!await IsAdministrator()) return Forbid();
        if (input.Status is not ("Active" or "Suspended" or "Archived")) return BadRequest("Unknown tenant status.");
        var updated = await database.Hotels.Where(row => row.Id == hotelId).ExecuteUpdateAsync(set =>
            set.SetProperty(row => row.Suspended, input.Status == "Suspended")
                .SetProperty(row => row.Archived, input.Status == "Archived"));
        return updated == 0 ? NotFound() : NoContent();
    }

    [HttpGet("audit")]
    [AuditAction("viewed the platform audit log", "view the platform audit log")]
    public async Task<IActionResult> Audit(string? search, string? result, DateTimeOffset? snapshot,
        int offset = 0, int pageSize = 25)
    {
        if (!await IsAdministrator()) return Forbid();
        if (offset < 0 || pageSize is < 1 or > 100) return BadRequest("Invalid audit page.");
        var events = database.Audit.Where(row => row.HotelId == null || row.Target.StartsWith("/api/v1/platform"));
        return Ok(await AuditLogPage.ReadAsync(events, database.Staff, offset, pageSize, snapshot, search, result));
    }

}
