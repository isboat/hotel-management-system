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
public sealed class RoomsController(HotelDatabase database, TenantAccess access) : ControllerBase
{
    [HttpGet("rooms")]
    public async Task<IActionResult> List(Guid hotelId) =>
        await access.Allows(User, hotelId, "Administrator", "Manager", "FrontDesk", "Housekeeping", "Supervisor")
            ? Ok(await database.Rooms.Where(row => row.HotelId == hotelId && !row.Archived).OrderBy(row => row.Number).ToListAsync())
            : Forbid();

    [HttpPost("rooms")]
    [AuditAction("added a room", "add a room")]
    public async Task<IActionResult> Add(Guid hotelId, RoomInput input)
    {
        if (!await access.Allows(User, hotelId, "Manager", "Administrator")) return Forbid();
        var room = new Room(hotelId, Guid.NewGuid(), input.Number.Trim(), input.Type.Trim(), input.Capacity, input.Rate, OutOfService: input.OutOfService, Description: NormalizeDescription(input.Description));
        database.Rooms.Add(room);
        try { await database.SaveChangesAsync(); }
        catch (DbUpdateException) { return Conflict("Room number is already in use."); }
        return Ok(room);
    }

    /// <summary>Closes or reopens a room without invalidating a current or future booking.</summary>
    [HttpPut("rooms/{roomId:guid}")]
    [AuditAction("updated a room", "update a room")]
    public async Task<IActionResult> Edit(Guid hotelId, Guid roomId, RoomInput input)
    {
        if (!await access.Allows(User, hotelId, "Manager", "Administrator")) return Forbid();
        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        if (input.OutOfService && await HasBookings(hotelId, roomId)) return Conflict("Resolve current and future bookings first.");
        var description = NormalizeDescription(input.Description);
        int updated;
        try
        {
            updated = await database.Rooms.Where(row => row.HotelId == hotelId && row.Id == roomId && !row.Archived)
                .ExecuteUpdateAsync(set => set.SetProperty(row => row.Number, input.Number.Trim())
                    .SetProperty(row => row.Type, input.Type.Trim()).SetProperty(row => row.Capacity, input.Capacity)
                    .SetProperty(row => row.Rate, input.Rate).SetProperty(row => row.OutOfService, input.OutOfService)
                    .SetProperty(row => row.Description, description));
        }
        catch (Microsoft.Data.SqlClient.SqlException exception) when (exception.Number is 1205 or 2601 or 2627)
        {
            return Conflict("The room or room number changed concurrently.");
        }
        await transaction.CommitAsync();
        return updated == 0 ? NotFound() : NoContent();
    }

    [HttpDelete("rooms/{roomId:guid}")]
    [AuditAction("removed a room", "remove a room")]
    public async Task<IActionResult> Remove(Guid hotelId, Guid roomId)
    {
        if (!await access.Allows(User, hotelId, "Manager", "Administrator")) return Forbid();
        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var room = await database.Rooms.FindAsync(hotelId, roomId);
        if (room is null) return NotFound();
        if (await HasBookings(hotelId, roomId)) return Conflict("Resolve current and future bookings first.");
        if (await database.Reservations.AnyAsync(row => row.HotelId == hotelId && row.RoomId == roomId)
            || await database.Maintenance.AnyAsync(row => row.HotelId == hotelId && row.RoomId == roomId))
            database.Entry(room).CurrentValues.SetValues(room with { Archived = true });
        else database.Rooms.Remove(room);
        try { await database.SaveChangesAsync(); }
        catch (DbUpdateException) { return Conflict("The room changed concurrently."); }
        await transaction.CommitAsync();
        return NoContent();
    }

    [HttpPatch("rooms/{roomId:guid}/housekeeping")]
    [AuditAction("updated housekeeping status", "update housekeeping status")]
    public async Task<IActionResult> Housekeeping(Guid hotelId, Guid roomId, StatusInput input)
    {
        if (!await access.Allows(User, hotelId, "Housekeeping", "Supervisor", "Manager", "Administrator")) return Forbid();
        if (input.Status is not ("Dirty" or "Clean" or "Inspected")) return BadRequest();
        if (input.Status == "Inspected" && !await access.Allows(User, hotelId, "Supervisor", "Manager", "Administrator"))
            return Forbid();
        var updated = await database.Rooms.Where(row => row.HotelId == hotelId && row.Id == roomId && !row.Archived)
            .ExecuteUpdateAsync(set => set.SetProperty(row => row.Status, input.Status));
        return updated == 0 ? NotFound() : NoContent();
    }

    [HttpGet("maintenance")]
    public async Task<IActionResult> Maintenance(Guid hotelId) =>
        await access.Allows(User, hotelId, "Housekeeping", "Supervisor", "Manager", "Administrator")
            ? Ok(await database.Maintenance.Where(row => row.HotelId == hotelId && !row.Resolved).ToListAsync())
            : Forbid();

    [HttpPost("maintenance")]
    [AuditAction("reported a maintenance issue", "report a maintenance issue")]
    public async Task<IActionResult> ReportIssue(Guid hotelId, MaintenanceInput input)
    {
        if (!await access.Allows(User, hotelId, "Housekeeping", "Supervisor", "Manager", "Administrator")) return Forbid();
        if (!await database.Rooms.AnyAsync(row => row.HotelId == hotelId && row.Id == input.RoomId && !row.Archived)) return NotFound();
        var issue = new MaintenanceIssue(hotelId, Guid.NewGuid(), input.RoomId, input.Description.Trim());
        database.Maintenance.Add(issue);
        await database.SaveChangesAsync();
        return Ok(issue);
    }

    private static string? NormalizeDescription(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private Task<bool> HasBookings(Guid hotelId, Guid roomId)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return database.Reservations.AnyAsync(row => row.HotelId == hotelId && row.RoomId == roomId &&
            (row.Status == "CheckedIn" || (row.Status == "Confirmed" && row.Departure >= today)));
    }
}
