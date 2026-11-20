using System.Data;
using Hms.Api.Contracts;
using Hms.Api.Data;
using Hms.Api.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Controllers;

[ApiController, Authorize]
[Route("api/v1/properties/{hotelId:guid}/folios/{reservationId:guid}")]
public sealed class FoliosController(HotelDatabase database, TenantAccess access) : ControllerBase
{
    private Task<bool> CanOperate(Guid hotelId) => access.Allows(User, hotelId, "Manager", "FrontDesk", "Administrator");

    [HttpGet]
    public async Task<IActionResult> Folio(Guid hotelId, Guid reservationId)
    {
        if (!await CanOperate(hotelId)) return Forbid();
        var stay = await database.Reservations.FindAsync(hotelId, reservationId);
        if (stay is null) return NotFound();
        var payments = await database.Payments.Where(row => row.HotelId == hotelId && row.ReservationId == reservationId)
            .OrderBy(row => row.Utc).ToListAsync();
        var charges = await database.Charges.Where(row => row.HotelId == hotelId && row.ReservationId == reservationId).ToListAsync();
        var total = stay.Total + charges.Sum(row => row.Amount);
        return Ok(new { Total = total, Balance = total - payments.Sum(payment => payment.Amount), Payments = payments, Charges = charges });
    }

    /// <summary>Records physical cash and returns the same receipt for a matching retry.</summary>
    [HttpPost("payments")]
    public async Task<IActionResult> RecordCash(Guid hotelId, Guid reservationId, PaymentInput input)
    {
        if (!await CanOperate(hotelId)) return Forbid();
        if (input.Tendered < input.Amount) return BadRequest("Tendered cash is below the amount applied.");
        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var existing = await database.Payments.SingleOrDefaultAsync(row => row.HotelId == hotelId && row.Reference == input.Reference);
        if (existing is not null)
            return existing.ReservationId == reservationId && existing.Amount == input.Amount && existing.Tendered == input.Tendered
                ? Ok(existing) : Conflict("Payment reference already used.");
        var stay = await database.Reservations.FindAsync(hotelId, reservationId);
        if (stay is null) return NotFound();
        if (stay.Status is "Cancelled" or "CheckedOut") return Conflict("This folio is closed.");
        var paid = await database.Payments.Where(row => row.HotelId == hotelId && row.ReservationId == reservationId)
            .SumAsync(row => (long?)row.Amount) ?? 0;
        var charges = await database.Charges.Where(row => row.HotelId == hotelId && row.ReservationId == reservationId)
            .SumAsync(row => (long?)row.Amount) ?? 0;
        if (input.Amount > stay.Total + charges - paid) return BadRequest("Payment exceeds folio balance.");
        var shift = await OpenShift(hotelId);
        if (shift is null) return Conflict("Open a cash shift before recording a payment.");
        var payment = new CashPayment(hotelId, Guid.NewGuid(), reservationId, TenantAccess.Actor(User)!.Value, shift.Id,
            input.Reference, input.Amount, input.Tendered, DateTime.UtcNow);
        database.Payments.Add(payment);
        RecordFinancialEvent(hotelId, payment.Id, "Cash payment");
        try
        {
            await database.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (DbUpdateException) { return Conflict("Payment changed concurrently. Retry with the same reference."); }
        return Ok(payment);
    }

    [HttpPost("charges")]
    public async Task<IActionResult> PostCharge(Guid hotelId, Guid reservationId, ChargeInput input)
    {
        if (!await CanOperate(hotelId)) return Forbid();
        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var stay = await database.Reservations.FindAsync(hotelId, reservationId);
        if (stay is null) return NotFound();
        if (stay.Status is "Cancelled" or "CheckedOut") return Conflict("This folio is closed.");
        var charge = new FolioCharge(hotelId, Guid.NewGuid(), reservationId, input.Description.Trim(), input.Amount);
        database.Charges.Add(charge);
        RecordFinancialEvent(hotelId, charge.Id, "Folio charge");
        await database.SaveChangesAsync();
        await transaction.CommitAsync();
        return Ok(charge);
    }

    /// <summary>Records a physical refund against a prior receipt without altering that receipt.</summary>
    [HttpPost("refunds")]
    public async Task<IActionResult> Refund(Guid hotelId, Guid reservationId, RefundInput input)
    {
        if (!await access.Allows(User, hotelId, "Manager", "Administrator")) return Forbid();
        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var existing = await database.Payments.SingleOrDefaultAsync(row => row.HotelId == hotelId && row.Reference == input.Reference);
        if (existing is not null)
            return existing.ReservationId == reservationId && existing.OriginalPaymentId == input.PaymentId && existing.Amount == -input.Amount
                ? Ok(existing) : Conflict("Refund reference already used.");
        var original = await database.Payments.SingleOrDefaultAsync(row =>
            row.HotelId == hotelId && row.ReservationId == reservationId && row.Id == input.PaymentId && row.Amount > 0);
        if (original is null) return NotFound();
        var refunded = await database.Payments.Where(row => row.HotelId == hotelId && row.OriginalPaymentId == original.Id)
            .SumAsync(row => (long?)row.Amount) ?? 0;
        if (input.Amount > original.Amount + refunded) return BadRequest("Refund exceeds the unrefunded amount.");
        var shift = await OpenShift(hotelId);
        if (shift is null) return Conflict("Open a cash shift before recording a refund.");
        var refund = new CashPayment(hotelId, Guid.NewGuid(), reservationId, TenantAccess.Actor(User)!.Value, shift.Id,
            input.Reference, -input.Amount, 0, DateTime.UtcNow, original.Id, input.Reason.Trim());
        database.Payments.Add(refund);
        RecordFinancialEvent(hotelId, refund.Id, "Cash refund");
        try
        {
            await database.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        catch (DbUpdateException) { return Conflict("Refund changed concurrently. Retry with the same reference."); }
        return Ok(refund);
    }

    private Task<CashShift?> OpenShift(Guid hotelId) => database.CashShifts.SingleOrDefaultAsync(row =>
        row.HotelId == hotelId && row.CashierId == TenantAccess.Actor(User) && row.ClosedUtc == null);

    private void RecordFinancialEvent(Guid hotelId, Guid resource, string action) =>
        database.Audit.Add(new AuditEvent(Guid.NewGuid(), hotelId, TenantAccess.Actor(User), DateTime.UtcNow,
            action, resource.ToString(), 200, HttpContext.TraceIdentifier));
}
