using Hms.Api.Contracts;
using Hms.Api.Data;
using Hms.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Controllers;

[ApiController, Authorize]
[Route("api/v1/properties/{hotelId:guid}/details")]
public sealed class HotelDetailsController(HotelDatabase database, TenantAccess access) : ControllerBase
{
    [HttpGet]
    [AuditAction("viewed hotel details", "view hotel details")]
    public async Task<IActionResult> Details(Guid hotelId)
    {
        if (!await access.Allows(User, hotelId, "Administrator")) return Forbid();
        var hotel = await database.Hotels.FindAsync(hotelId);
        return hotel is null ? NotFound() : Ok(hotel);
    }

    [HttpPut]
    [AuditAction("updated hotel details", "update hotel details")]
    public async Task<IActionResult> Edit(Guid hotelId, HotelInput input)
    {
        if (!await access.Allows(User, hotelId, "Administrator")) return Forbid();
        var hotel = await database.Hotels.SingleOrDefaultAsync(row => row.Id == hotelId && !row.Suspended && !row.Archived);
        if (hotel is null) return NotFound();
        var updated = input.ApplyTo(hotel);
        database.Entry(hotel).CurrentValues.SetValues(updated);
        await database.SaveChangesAsync();
        return Ok(updated);
    }
}
