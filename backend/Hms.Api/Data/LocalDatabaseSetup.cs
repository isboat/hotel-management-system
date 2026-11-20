using Microsoft.EntityFrameworkCore;

namespace Hms.Api.Data;

/// <summary>Initializes local SQLite and upgrades existing local records created by earlier development builds.</summary>
public static class LocalDatabaseSetup
{
    public static async Task InitializeAsync(HotelDatabase database)
    {
        if (await database.Database.EnsureCreatedAsync()) return;

        await using var transaction = await database.Database.BeginTransactionAsync();
        await AddMissingColumn(database, "Guests", "IdNumber", """ALTER TABLE "Guests" ADD COLUMN "IdNumber" TEXT NULL""");
        await AddMissingColumn(database, "Rooms", "Description", """ALTER TABLE "Rooms" ADD COLUMN "Description" TEXT NULL""");
        await AddMissingColumn(database, "Hotels", "Telephone", """ALTER TABLE "Hotels" ADD COLUMN "Telephone" TEXT NULL""");
        await AddMissingColumn(database, "Hotels", "Description", """ALTER TABLE "Hotels" ADD COLUMN "Description" TEXT NULL""");
        await AddMissingColumn(database, "Hotels", "Address", """ALTER TABLE "Hotels" ADD COLUMN "Address" TEXT NULL""");
        await AddMissingColumn(database, "Maintenance", "ReportedUtc", """ALTER TABLE "Maintenance" ADD COLUMN "ReportedUtc" TEXT NULL""");
        await AddMissingColumn(database, "Maintenance", "FixedUtc", """ALTER TABLE "Maintenance" ADD COLUMN "FixedUtc" TEXT NULL""");
        await transaction.CommitAsync();
    }

    private static async Task AddMissingColumn(HotelDatabase database, string table, string column, string alterTable)
    {
        var hasColumn = await database.Database.SqlQuery<string>(
            $"""SELECT name AS "Value" FROM pragma_table_info({table})""").AnyAsync(name => name == column);
        if (!hasColumn)
            await database.Database.ExecuteSqlRawAsync(alterTable);
    }
}
