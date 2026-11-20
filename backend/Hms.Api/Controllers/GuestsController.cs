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
    [AuditAction("viewed the guest directory", "view the guest directory")]
    public async Task<IActionResult> List(Guid hotelId, string? search)
    {
        if (!await CanManage(hotelId)) return Forbid();
        var profiles = database.Guests.Where(row => row.HotelId == hotelId);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToUpperInvariant();
            profiles = profiles.Where(row => row.Name.ToUpper().Contains(term));
        }
        return Ok(await profiles.OrderBy(row => row.Name).ThenBy(row => row.Id).Take(100)
            .Select(row => new { row.Id, row.Name, row.Email, row.Phone }).ToListAsync());
    }

    [HttpGet("{guestId:guid}")]
    [AuditAction("viewed guest details", "view guest details")]
    public async Task<IActionResult> Details(Guid hotelId, Guid guestId)
    {
        if (!await CanManage(hotelId)) return Forbid();
        var guest = await database.Guests.FindAsync(hotelId, guestId);
        if (guest is null) return NotFound();
        AuditActionAttribute.Describe(HttpContext, $"viewed guest ({guest.Name}) details");
        return Ok(guest);
    }

    [HttpGet("{guestId:guid}/stays")]
    [AuditAction("viewed a guest’s stay history", "view guest stay history")]
    public async Task<IActionResult> History(Guid hotelId, Guid guestId) =>
        await CanManage(hotelId)
            ? Ok(await (from stay in database.Reservations
                        where stay.HotelId == hotelId && stay.GuestId == guestId
                        join room in database.Rooms on new { stay.HotelId, Id = stay.RoomId } equals new { room.HotelId, room.Id }
                        orderby stay.Arrival descending, stay.Id
                        select new
                        {
                            stay.HotelId, stay.Id, stay.RoomId, stay.Guest, stay.Arrival, stay.Departure,
                            stay.Total, stay.Status, stay.GuestId, RoomNumber = room.Number
                        }).Take(100).ToListAsync())
            : Forbid();

    [HttpPost]
    [AuditAction("added a guest", "add a guest")]
    public async Task<IActionResult> Create(Guid hotelId, GuestInput input)
    {
        if (!await CanManage(hotelId)) return Forbid();
        var profile = new GuestProfile(hotelId, Guid.NewGuid(), input.Name.Trim(), input.Email, input.Phone, input.Preferences, input.MarketingOptIn, NormalizeIdNumber(input.IdNumber));
        database.Guests.Add(profile);
        await database.SaveChangesAsync();
        return Ok(profile);
    }

    [HttpPut("{guestId:guid}")]
    [AuditAction("updated a guest profile", "update a guest profile")]
    public async Task<IActionResult> Edit(Guid hotelId, Guid guestId, GuestInput input)
    {
        if (!await CanManage(hotelId)) return Forbid();
        var profile = await database.Guests.FindAsync(hotelId, guestId);
        if (profile is null) return NotFound();
        database.Entry(profile).CurrentValues.SetValues(profile with
        {
            Name = input.Name.Trim(), Email = input.Email, Phone = input.Phone,
            Preferences = input.Preferences, MarketingOptIn = input.MarketingOptIn,
            IdNumber = NormalizeIdNumber(input.IdNumber)
        });
        await database.SaveChangesAsync();
        return NoContent();
    }

    private static string? NormalizeIdNumber(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
