namespace Hms.Api.Data;

public sealed record Room(Guid HotelId, Guid Id, string Number, string Type, int Capacity, long Rate, string Status = "Dirty", bool Archived = false, bool OutOfService = false);
