using Hms.Api.Contracts;
using Hms.Api.Data;
using Hms.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Controllers;

[ApiController, Authorize]
[Route("api/v1/properties/{hotelId:guid}/guests")]
public sealed class GuestsController(HotelDatabase database, TenantAccess access) : ControllerBase
{
    private Task<bool> CanManage(Guid hotelId) => access.Allows(User, hotelId, "Administrator", "Manager", "FrontDesk");

    [HttpGet]
    public async Task<IActionResult> List(Guid hotelId, string? search)
    {
        if (!await CanManage(hotelId)) return Forbid();
        var profiles = database.Guests.Where(row => row.HotelId == hotelId);
        if (!string.IsNullOrWhiteSpace(search)) profiles = profiles.Where(row => row.Name.Contains(search));
        return Ok(await profiles.OrderBy(row => row.Name).Take(100).ToListAsync());
    }

    [HttpGet("{guestId:guid}/stays")]
    public async Task<IActionResult> History(Guid hotelId, Guid guestId) =>
        await CanManage(hotelId)
            ? Ok(await database.Reservations.Where(row => row.HotelId == hotelId && row.GuestId == guestId)
                .OrderByDescending(row => row.Arrival).Take(100).ToListAsync())
            : Forbid();

    [HttpPost]
    public async Task<IActionResult> Create(Guid hotelId, GuestInput input)
    {
        if (!await CanManage(hotelId)) return Forbid();
        var profile = new GuestProfile(hotelId, Guid.NewGuid(), input.Name.Trim(), input.Email, input.Phone, input.Preferences, input.MarketingOptIn);
        database.Guests.Add(profile);
        await database.SaveChangesAsync();
        return Ok(profile);
    }

    [HttpPut("{guestId:guid}")]
    public async Task<IActionResult> Edit(Guid hotelId, Guid guestId, GuestInput input)
    {
        if (!await CanManage(hotelId)) return Forbid();
        var profile = await database.Guests.FindAsync(hotelId, guestId);
        if (profile is null) return NotFound();
        database.Entry(profile).CurrentValues.SetValues(profile with
        {
            Name = input.Name.Trim(), Email = input.Email, Phone = input.Phone,
            Preferences = input.Preferences, MarketingOptIn = input.MarketingOptIn
        });
        await database.SaveChangesAsync();
        return NoContent();
    }
}
