namespace Hms.Api.Data;

public sealed record CashPayment(Guid HotelId, Guid Id, Guid ReservationId, Guid CashierId, Guid ShiftId, string Reference, long Amount, long Tendered, DateTime Utc, Guid? OriginalPaymentId = null, string? Reason = null);
