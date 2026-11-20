using System.Data;
using Hms.Api.Contracts;
using Hms.Api.Data;
using Hms.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Controllers;

[ApiController, Authorize]
[Route("api/v1/properties/{hotelId:guid}")]
public sealed class ReservationsController(HotelDatabase database, TenantAccess access) : ControllerBase
{
    private Task<bool> CanOperate(Guid hotelId) => access.Allows(User, hotelId, "Manager", "FrontDesk", "Administrator");

    [HttpGet("reservations")]
    public async Task<IActionResult> List(Guid hotelId) =>
        await CanOperate(hotelId) ? Ok(await database.Reservations.Where(row => row.HotelId == hotelId)
            .OrderByDescending(row => row.Arrival).Take(250).ToListAsync()) : Forbid();

    [HttpGet("availability")]
    public async Task<IActionResult> Availability(Guid hotelId, DateOnly arrival, DateOnly departure)
    {
        if (!await CanOperate(hotelId)) return Forbid();
        if (!StayRules.ValidDates(arrival, departure)) return BadRequest("Enter a stay of 1 to 365 nights.");
        return Ok(await database.Rooms.Where(room => room.HotelId == hotelId && !room.Archived && !room.OutOfService &&
            !database.RoomNights.Any(night => night.HotelId == hotelId && night.RoomId == room.Id &&
                night.Date >= arrival && night.Date < departure)).OrderBy(room => room.Number).ToListAsync());
    }

    /// <summary>Allocates one unique inventory record for each night of the stay.</summary>
    [HttpPost("reservations")]
    public async Task<IActionResult> Create(Guid hotelId, BookingInput input)
    {
        if (!await CanOperate(hotelId)) return Forbid();
        if (!StayRules.ValidDates(input.Arrival, input.Departure)) return BadRequest("Enter a stay of 1 to 365 nights.");
        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var room = await database.Rooms.FindAsync(hotelId, input.RoomId);
        if (room is null || room.Archived || room.OutOfService) return Conflict("Room is unavailable.");
        var guest = input.GuestId is Guid guestId ? await database.Guests.FindAsync(hotelId, guestId) : null;
        if (input.GuestId.HasValue && guest is null) return NotFound("Guest profile unavailable.");
        var numberOfNights = input.Departure.DayNumber - input.Arrival.DayNumber;
        var reservation = new Reservation(hotelId, Guid.NewGuid(), room.Id, guest?.Name ?? input.Guest.Trim(), input.Arrival,
            input.Departure, room.Rate * numberOfNights, GuestId: guest?.Id);
        database.Reservations.Add(reservation);
        database.RoomNights.AddRange(Enumerable.Range(0, numberOfNights)
            .Select(offset => new RoomNight(hotelId, room.Id, input.Arrival.AddDays(offset), reservation.Id)));
        try
        {
            await database.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (DbUpdateException) { return Conflict("Room is unavailable for one or more selected nights."); }
        return Ok(reservation);
    }

    [HttpPatch("reservations/{reservationId:guid}")]
    public async Task<IActionResult> ChangeStatus(Guid hotelId, Guid reservationId, StatusInput input)
    {
        if (!await CanOperate(hotelId)) return Forbid();
        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var stay = await database.Reservations.FindAsync(hotelId, reservationId);
        if (stay is null) return NotFound();
        if (!StayRules.CanTransition(stay.Status, input.Status)) return Conflict("This status change is unavailable.");
        var room = await database.Rooms.FindAsync(hotelId, stay.RoomId);
        if (input.Status == "CheckedIn")
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (today < stay.Arrival || today >= stay.Departure || room!.Status == "Dirty" || room.OutOfService ||
                await database.Reservations.AnyAsync(row => row.HotelId == hotelId && row.RoomId == stay.RoomId && row.Status == "CheckedIn"))
                return Conflict("This room is not ready for check-in.");
        }
        if (input.Status is "Cancelled" or "CheckedOut")
        {
            var paid = await database.Payments.Where(row => row.HotelId == hotelId && row.ReservationId == stay.Id)
                .SumAsync(row => (long?)row.Amount) ?? 0;
            var charges = await database.Charges.Where(row => row.HotelId == hotelId && row.ReservationId == stay.Id)
                .SumAsync(row => (long?)row.Amount) ?? 0;
            if ((input.Status == "Cancelled" && paid != 0) || (input.Status == "CheckedOut" && paid < stay.Total + charges))
                return Conflict("Settle the folio before continuing.");
        }
        database.Entry(stay).CurrentValues.SetValues(stay with { Status = input.Status });
        if (input.Status == "Cancelled")
            await database.RoomNights.Where(row => row.HotelId == hotelId && row.ReservationId == reservationId).ExecuteDeleteAsync();
        if (input.Status == "CheckedOut")
            database.Entry(room!).CurrentValues.SetValues(room! with { Status = "Dirty" });
        await database.SaveChangesAsync();
        await transaction.CommitAsync();
        return NoContent();
    }
}
