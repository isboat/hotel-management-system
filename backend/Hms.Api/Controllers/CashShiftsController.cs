using System.Data;
using Hms.Api.Contracts;
using Hms.Api.Data;
using Hms.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Controllers;

[ApiController, Authorize]
[Route("api/v1/properties/{hotelId:guid}/cash-shifts")]
public sealed class CashShiftsController(HotelDatabase database, TenantAccess access) : ControllerBase
{
    private Task<bool> CanOperate(Guid hotelId) => access.Allows(User, hotelId, "FrontDesk", "Manager", "Administrator");

    [HttpGet]
    public async Task<IActionResult> List(Guid hotelId)
    {
        if (!await CanOperate(hotelId)) return Forbid();
        var manager = await access.Allows(User, hotelId, "Manager", "Administrator");
        var actorId = TenantAccess.Actor(User);
        var shifts = from shift in database.CashShifts
                     where shift.HotelId == hotelId && (manager || shift.CashierId == actorId)
                     join staff in database.Staff on shift.CashierId equals staff.Id into cashiers
                     from cashier in cashiers.DefaultIfEmpty()
                     orderby shift.OpenedUtc descending, shift.Id
                     select new
                     {
                         shift.HotelId, shift.Id, shift.CashierId, shift.OpenedUtc, shift.Float,
                         shift.ClosedUtc, shift.Counted, shift.Expected,
                         CashierName = cashier == null ? null : cashier.Name,
                         CashierEmail = cashier == null ? null : cashier.Email
                     };
        return Ok(await shifts.Take(100).ToListAsync());
    }

    [HttpPost]
    [AuditAction("opened a cash shift", "open a cash shift")]
    public async Task<IActionResult> Open(Guid hotelId, CashCountInput input)
    {
        if (!await CanOperate(hotelId)) return Forbid();
        var shift = new CashShift(hotelId, Guid.NewGuid(), TenantAccess.Actor(User)!.Value, DateTime.UtcNow, input.Amount);
        database.CashShifts.Add(shift);
        try { await database.SaveChangesAsync(); }
        catch (DbUpdateException) { return Conflict("A cash shift is already open."); }
        return Ok(shift);
    }

    /// <summary>Reconciles the physical count against recorded cash in the shift.</summary>
    [HttpPost("{shiftId:guid}/close")]
    [AuditAction("closed a cash shift", "close a cash shift")]
    public async Task<IActionResult> Close(Guid hotelId, Guid shiftId, CashCountInput input)
    {
        if (!await CanOperate(hotelId)) return Forbid();
        var manager = await access.Allows(User, hotelId, "Manager", "Administrator");
        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var shift = await database.CashShifts.FindAsync(hotelId, shiftId);
        if (shift is null) return NotFound();
        if (!manager && shift.CashierId != TenantAccess.Actor(User)) return Forbid();
        if (shift.ClosedUtc is not null) return Conflict("This shift has already closed.");
        var movement = await database.Payments.Where(row => row.HotelId == hotelId && row.ShiftId == shiftId)
            .SumAsync(row => (long?)row.Amount) ?? 0;
        var closed = shift with { ClosedUtc = DateTime.UtcNow, Counted = input.Amount, Expected = shift.Float + movement };
        database.Entry(shift).CurrentValues.SetValues(closed);
        await database.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(closed);
    }
}
