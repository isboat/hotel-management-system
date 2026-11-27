using System.Data;
using Hms.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Security;

/// <summary>Recovers an existing system administrator from a privileged operator session.</summary>
public static class SystemAdministratorRecovery
{
    public const string CommandName = "recover-system-admin";

    /// <summary>Runs the recovery command without starting the web application.</summary>
    public static async Task<int> RunAsync(string[] args)
    {
        if (args.Length != 2 || string.IsNullOrWhiteSpace(args[1]))
        {
            Console.Error.WriteLine("Usage: dotnet Hms.Api.dll recover-system-admin <email>");
            return 2;
        }

        var connectionString = Environment.GetEnvironmentVariable("PREMADESK_RECOVERY_SQL");
        if (string.IsNullOrWhiteSpace(connectionString) || Console.IsOutputRedirected)
        {
            Console.Error.WriteLine("Set PREMADESK_RECOVERY_SQL and run this command in an interactive terminal.");
            return 2;
        }

        try
        {
            var options = new DbContextOptionsBuilder<HotelDatabase>().UseSqlServer(connectionString).Options;
            await using var database = new HotelDatabase(options);
            var sqlOperator = await database.Database.SqlQueryRaw<string>(
                "SELECT CONVERT(nvarchar(128), ORIGINAL_LOGIN()) AS [Value]").SingleAsync();
            var code = await IssueAsync(database, args[1], sqlOperator);
            if (code is null)
            {
                Console.Error.WriteLine("No System Administrator matches that email.");
                return 1;
            }

            Console.WriteLine("Single-use reset code (expires in 30 minutes). Share privately:");
            Console.WriteLine(code);
            return 0;
        }
        catch (Exception)
        {
            // Provider errors can contain connection details. Keep them out of terminal output.
            Console.Error.WriteLine("Recovery failed. Verify the Azure SQL connection, database permissions, and schema before retrying.");
            return 1;
        }
    }

    /// <summary>Replaces existing reset codes and records the operator in one transaction.</summary>
    public static async Task<string?> IssueAsync(HotelDatabase database, string email, string sqlOperator)
    {
        email = email.Trim().ToUpperInvariant();
        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var target = await database.Staff.AsNoTracking().SingleOrDefaultAsync(user => user.Email == email && user.IsSystemAdmin);
        if (target is null) return null;

        await database.PasswordResets.Where(reset => reset.StaffId == target.Id).ExecuteDeleteAsync();
        database.Audit.Add(new AuditEvent(Guid.NewGuid(), null, null, DateTime.UtcNow,
            $"SQL operator {sqlOperator} issued an emergency password reset code for {target.Name} ({target.Email.ToLowerInvariant()})",
            "recover-system-admin", 200, Guid.NewGuid().ToString("N")));
        var code = await PasswordResetCodes.IssueAsync(database, target.Id);
        await transaction.CommitAsync();
        return code;
    }
}
