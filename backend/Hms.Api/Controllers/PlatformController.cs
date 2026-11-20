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
    public async Task<IActionResult> List() =>
        await IsAdministrator() ? Ok(await database.Hotels.OrderBy(row => row.Name).ToListAsync()) : Forbid();

    [HttpPost("properties")]
    public async Task<IActionResult> Create(HotelInput input)
    {
        if (!await IsAdministrator()) return Forbid();
        var hotel = new Hotel(Guid.NewGuid(), input.Name.Trim());
        database.Hotels.Add(hotel);
        await database.SaveChangesAsync();
        return Ok(hotel);
    }

    [HttpPut("properties/{hotelId:guid}")]
    public async Task<IActionResult> Rename(Guid hotelId, HotelInput input)
    {
        if (!await IsAdministrator()) return Forbid();
        var updated = await database.Hotels.Where(row => row.Id == hotelId)
            .ExecuteUpdateAsync(set => set.SetProperty(row => row.Name, input.Name.Trim()));
        return updated == 0 ? NotFound() : NoContent();
    }

    [HttpPatch("properties/{hotelId:guid}")]
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
    public async Task<IActionResult> Audit() =>
        await IsAdministrator() ? Ok(await database.Audit.Where(row => row.HotelId == null || row.Target.StartsWith("/api/v1/platform"))
            .OrderByDescending(row => row.Utc).Take(100).ToListAsync()) : Forbid();
}
