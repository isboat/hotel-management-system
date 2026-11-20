namespace Hms.Api.Data;

/// <summary>Exposes staff display identity alongside an event to authorised audit readers.</summary>
public sealed record AuditLogEntry(Guid Id, Guid? StaffId, DateTime Utc, string Action, string Target, int Outcome,
    string? StaffName, string? StaffEmail);
