namespace Hms.Api.Data;

public sealed record Membership(Guid HotelId, Guid StaffId, string Role, bool Active = true);
