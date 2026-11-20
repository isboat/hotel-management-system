namespace Hms.Api.Data;

public sealed record RefreshSession(string Digest, Guid StaffId, int Version, DateTime ExpiresUtc);
