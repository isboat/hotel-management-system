namespace Hms.Api.Data;

public sealed record Staff(Guid Id, string Email, string Name, string PasswordHash, bool IsSystemAdmin = false, int SessionVersion = 0);
