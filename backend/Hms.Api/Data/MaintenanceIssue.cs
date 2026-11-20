namespace Hms.Api.Data;

public sealed record MaintenanceIssue(Guid HotelId, Guid Id, Guid RoomId, string Description, bool Resolved = false,
    DateTime? ReportedUtc = null, DateTime? FixedUtc = null);
