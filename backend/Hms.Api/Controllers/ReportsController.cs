using Hms.Api.Data;
using Hms.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Controllers;

[ApiController, Authorize]
[Route("api/v1/properties/{hotelId:guid}")]
public sealed class ReportsController(HotelDatabase database, TenantAccess access) : ControllerBase
{
    [HttpGet("audit")]
    [AuditAction("viewed the audit log", "view the audit log")]
    public async Task<IActionResult> Audit(Guid hotelId, Guid? userId, int? outcome, string? search, string? result,
        DateTimeOffset? snapshot, int offset = 0, int pageSize = 25)
    {
        if (!await access.Allows(User, hotelId, "Administrator")) return Forbid();
        if (offset < 0 || pageSize is < 1 or > 100) return BadRequest("Invalid audit page.");
        var events = database.Audit.Where(row => (row.HotelId == hotelId && !row.Target.StartsWith("/api/v1/platform")) ||
            (row.HotelId == null && row.Action == "logged in" && database.Memberships.Any(member =>
                member.HotelId == hotelId && member.StaffId == row.StaffId && member.Active)));
        if (userId.HasValue) events = events.Where(row => row.StaffId == userId);
        if (outcome.HasValue) events = events.Where(row => row.Outcome == outcome);
        var propertyStaff = database.Staff.Where(actor =>
            database.Memberships.Any(member => member.HotelId == hotelId && member.StaffId == actor.Id) ||
            database.Audit.Any(row => row.HotelId == hotelId && row.StaffId == actor.Id && row.Outcome < 400 &&
                !row.Target.StartsWith("/api/v1/platform")));
        return Ok(await AuditLogPage.ReadAsync(events, propertyStaff, offset, pageSize, snapshot, search, result));
    }

    [HttpGet("reports/occupancy")]
    [AuditAction("ran the occupancy report", "run the occupancy report")]
    public async Task<IActionResult> Occupancy(Guid hotelId, DateOnly arrival, DateOnly departure)
    {
        if (!await access.Allows(User, hotelId, "Manager", "Administrator")) return Forbid();
        if (!StayRules.ValidDates(arrival, departure)) return BadRequest("Enter a reporting period of 1 to 365 nights.");
        var sold = await (from night in database.RoomNights
            join stay in database.Reservations
                on new { night.HotelId, Id = night.ReservationId } equals new { stay.HotelId, stay.Id }
            where night.HotelId == hotelId && night.Date >= arrival && night.Date < departure
            select new { stay.Total, stay.Arrival, stay.Departure }).ToListAsync();
        var available = await database.Rooms.CountAsync(row => row.HotelId == hotelId && !row.Archived && !row.OutOfService)
            * (departure.DayNumber - arrival.DayNumber);
        var revenue = sold.Sum(row => row.Total / (decimal)(row.Departure.DayNumber - row.Arrival.DayNumber));
        return Ok(new { Sold = sold.Count, Available = available, Revenue = revenue,
            Occupancy = available == 0 ? 0 : sold.Count * 100m / available,
            Adr = sold.Count == 0 ? 0 : revenue / sold.Count, RevPar = available == 0 ? 0 : revenue / available });
    }
}
