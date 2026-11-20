namespace Hms.Api.Data;

public sealed record GuestProfile(Guid HotelId, Guid Id, string Name, string? Email, string? Phone, string? Preferences, bool MarketingOptIn);
