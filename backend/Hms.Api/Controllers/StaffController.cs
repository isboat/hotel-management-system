using System.Data;
using Hms.Api.Contracts;
using Hms.Api.Data;
using Hms.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Controllers;

[ApiController, Authorize]
[Route("api/v1/properties/{hotelId:guid}/staff")]
public sealed class StaffController(HotelDatabase database, TenantAccess access, IPasswordHasher<Staff> hasher) : ControllerBase
{
    private async Task<bool> CanManage(Guid hotelId, string role) => role switch
    {
        "FrontDesk" or "Housekeeping" => await access.Allows(User, hotelId, "Manager", "Administrator"),
        "Manager" or "Supervisor" => await access.Allows(User, hotelId, "Administrator"),
        _ => false
    };

    [HttpGet]
    [AuditAction("viewed the staff directory", "view the staff directory")]
    public async Task<IActionResult> List(Guid hotelId)
    {
        if (!await access.Allows(User, hotelId, "Manager", "Administrator")) return Forbid();
        return Ok(await (from member in database.Memberships
            join staff in database.Staff on member.StaffId equals staff.Id
            where member.HotelId == hotelId
            orderby staff.Name
            select new { staff.Id, staff.Name, staff.Email, member.Role, member.Active }).ToListAsync());
    }

    [HttpPost]
    [HttpPost("/api/v1/platform/properties/{hotelId:guid}/administrator")]
    [AuditAction("added a staff member", "add a staff member")]
    public async Task<IActionResult> Add(Guid hotelId, StaffInput input)
    {
        if (input.Role == "Administrator")
        {
            if (!Request.Path.StartsWithSegments("/api/v1/platform") ||
                !await database.Staff.AnyAsync(row => row.Id == TenantAccess.Actor(User) && row.IsSystemAdmin))
                return Forbid();
        }
        else if (!await CanManage(hotelId, input.Role)) return Forbid();

        if (!await database.Hotels.AnyAsync(row => row.Id == hotelId && !row.Archived && !row.Suspended)) return NotFound();
        var email = input.Email.Trim().ToUpperInvariant();
        var staff = await database.Staff.SingleOrDefaultAsync(row => row.Email == email);
        if (staff is null)
        {
            if (input.Password is null) return BadRequest("A new account requires an initial password.");
            staff = new Staff(Guid.NewGuid(), email, input.Name.Trim(), "");
            staff = staff with { PasswordHash = hasher.HashPassword(staff, input.Password) };
            database.Staff.Add(staff);
        }
        if (staff.IsSystemAdmin || await database.Memberships.AnyAsync(row => row.HotelId == hotelId && row.StaffId == staff.Id))
            return Conflict("Account already exists for this property or cannot be assigned.");
        database.Memberships.Add(new Membership(hotelId, staff.Id, input.Role));
        try { await database.SaveChangesAsync(); }
        catch (DbUpdateException) { return Conflict("Account changed concurrently."); }
        return Ok(new { staff.Id, staff.Name, staff.Email, input.Role });
    }

    /// <summary>Updates an eligible membership and allows edits to locally managed names.</summary>
    [HttpPut("{staffId:guid}")]
    [AuditAction("updated a staff member", "update a staff member")]
    public async Task<IActionResult> Edit(Guid hotelId, Guid staffId, StaffUpdateInput input)
    {
        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var member = await database.Memberships.FindAsync(hotelId, staffId);
        if (member is null || !await CanManage(hotelId, member.Role) || !await CanManage(hotelId, input.Role)) return Forbid();
        var staff = await database.Staff.SingleAsync(row => row.Id == staffId);
        var name = input.Name.Trim();
        if (name != staff.Name)
        {
            if (await database.Memberships.AnyAsync(row => row.StaffId == staffId && row.HotelId != hotelId))
                return Conflict("Ask the system administrator to update the name of a shared account.");
            database.Entry(staff).CurrentValues.SetValues(staff with { Name = name });
        }
        database.Entry(member).CurrentValues.SetValues(member with { Role = input.Role });
        await database.SaveChangesAsync();
        await transaction.CommitAsync();
        return NoContent();
    }

    [HttpPatch("{staffId:guid}/status")]
    [AuditAction("changed a staff member’s access", "change a staff member’s access")]
    public async Task<IActionResult> Status(Guid hotelId, Guid staffId, StatusInput input)
    {
        var member = await database.Memberships.FindAsync(hotelId, staffId);
        if (member is null || !await CanManage(hotelId, member.Role)) return Forbid();
        if (input.Status is not ("Active" or "Suspended")) return BadRequest();
        await database.Memberships.Where(row => row.HotelId == hotelId && row.StaffId == staffId)
            .ExecuteUpdateAsync(set => set.SetProperty(row => row.Active, input.Status == "Active"));
        return NoContent();
    }

    [HttpDelete("{staffId:guid}")]
    [AuditAction("removed a staff member’s access", "remove a staff member’s access")]
    public async Task<IActionResult> Remove(Guid hotelId, Guid staffId)
    {
        var member = await database.Memberships.FindAsync(hotelId, staffId);
        if (member is null || !await CanManage(hotelId, member.Role)) return Forbid();
        database.Memberships.Remove(member);
        await database.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{staffId:guid}/reset")]
    [AuditAction("issued a password reset code", "issue a password reset code")]
    public async Task<IActionResult> RequestReset(Guid hotelId, Guid staffId)
    {
        var member = await database.Memberships.FindAsync(hotelId, staffId);
        if (member is null || !await CanManage(hotelId, member.Role) ||
            await database.Memberships.AnyAsync(row => row.StaffId == staffId && row.HotelId != hotelId))
            return Forbid();
        return Ok(new { code = await PasswordResetCodes.IssueAsync(database, staffId) });
    }
}
