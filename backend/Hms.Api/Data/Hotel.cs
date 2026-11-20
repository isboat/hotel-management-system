namespace Hms.Api.Data;

public sealed record Hotel(Guid Id, string Name, bool Suspended = false, bool Archived = false,
    string? Telephone = null, string? Description = null, string? Address = null);
