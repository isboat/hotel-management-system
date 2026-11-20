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
