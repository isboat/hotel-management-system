namespace Hms.Api.Data;

public sealed record Reservation(Guid HotelId, Guid Id, Guid RoomId, string Guest, DateOnly Arrival, DateOnly Departure, long Total, string Status = "Confirmed", Guid? GuestId = null);
