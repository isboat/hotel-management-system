namespace Hms.Api.Data;

public sealed record AuditEvent(Guid Id, Guid? HotelId, Guid? StaffId, DateTime Utc, string Action, string Target, int Outcome, string CorrelationId);
