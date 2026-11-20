using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Data;

public sealed record AuditLogPage(IReadOnlyList<AuditLogEntry> Items, bool HasMore, DateTime SnapshotUtc)
{
    public static async Task<AuditLogPage> ReadAsync(IQueryable<AuditEvent> events, IQueryable<Staff> staff,
        int offset, int pageSize, DateTimeOffset? snapshot, string? search, string? result)
    {
        var now = DateTime.UtcNow;
        var snapshotUtc = snapshot is { } boundary && boundary.UtcDateTime < now ? boundary.UtcDateTime : now;
        events = events.Where(row => row.Utc <= snapshotUtc);
        if (result == "success") events = events.Where(row => row.Outcome < 400);
        if (result == "failure") events = events.Where(row => row.Outcome >= 400);
        var term = search?.Trim().ToUpperInvariant();

        var query = from audit in events
                    join actor in staff on audit.StaffId equals (Guid?)actor.Id into actors
                    from actor in actors.DefaultIfEmpty()
                    where term == null || term == "" || audit.Action.ToUpper().Contains(term) ||
                          (actor != null && (actor.Name.ToUpper().Contains(term) || actor.Email.ToUpper().Contains(term)))
                    orderby audit.Utc descending, audit.Id
                    select new AuditLogEntry(audit.Id, audit.StaffId, audit.Utc, audit.Action, audit.Target, audit.Outcome,
                        actor == null ? null : actor.Name, actor == null ? null : actor.Email);
        var items = await query.Skip(offset).Take(pageSize + 1).ToListAsync();
        var hasMore = items.Count > pageSize;
        if (hasMore) items.RemoveAt(pageSize);
        return new AuditLogPage(items, hasMore, snapshotUtc);
    }
}
