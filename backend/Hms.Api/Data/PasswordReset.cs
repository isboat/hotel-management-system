namespace Hms.Api.Data;

public sealed record PasswordReset(string Digest, Guid StaffId, DateTime ExpiresUtc);
