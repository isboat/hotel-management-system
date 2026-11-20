namespace Hms.Api.Data;

public sealed record RoomNight(Guid HotelId, Guid RoomId, DateOnly Date, Guid ReservationId);
