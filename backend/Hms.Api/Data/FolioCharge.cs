namespace Hms.Api.Data;

public sealed record FolioCharge(Guid HotelId, Guid Id, Guid ReservationId, string Description, long Amount);
