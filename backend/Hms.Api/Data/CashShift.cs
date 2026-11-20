namespace Hms.Api.Data;

public sealed record CashShift(Guid HotelId, Guid Id, Guid CashierId, DateTime OpenedUtc, long Float,
    DateTime? ClosedUtc = null, long? Counted = null, long? Expected = null);
