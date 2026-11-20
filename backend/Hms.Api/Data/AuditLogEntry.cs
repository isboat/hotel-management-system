namespace Hms.Api.Data;

/// <summary>Exposes staff display identity alongside an event to authorised audit readers.</summary>
public sealed record AuditLogEntry(Guid Id, Guid? StaffId, DateTime Utc, string Action, string Target, int Outcome,
    string? StaffName, string? StaffEmail)
{
    public static IQueryable<AuditLogEntry> WithStaff(IQueryable<AuditEvent> events, IQueryable<Staff> staff) =>
        from audit in events.OrderByDescending(row => row.Utc).ThenBy(row => row.Id).Take(100)
        join actor in staff on audit.StaffId equals (Guid?)actor.Id into actors
        from actor in actors.DefaultIfEmpty()
        orderby audit.Utc descending, audit.Id
        select new AuditLogEntry(audit.Id, audit.StaffId, audit.Utc, audit.Action, audit.Target, audit.Outcome,
            actor == null ? null : actor.Name, actor == null ? null : actor.Email);
}
