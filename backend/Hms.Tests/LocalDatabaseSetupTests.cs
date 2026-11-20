using Hms.Api.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Hms.Tests;

public sealed class LocalDatabaseSetupTests
{
    [Fact]
    public async Task UpgradesExistingRecordsAndCanRunAgain()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:");
        await connection.OpenAsync();
        await using var database = new HotelDatabase(new DbContextOptionsBuilder<HotelDatabase>().UseSqlite(connection).Options);
        await LocalDatabaseSetup.InitializeAsync(database);
        var hotel = new Hotel(Guid.NewGuid(), "Test Hotel");
        var guest = new GuestProfile(hotel.Id, Guid.NewGuid(), "Smith", null, null, null, false);
        database.Hotels.Add(hotel);
        database.Rooms.Add(new Room(hotel.Id, Guid.NewGuid(), "101", "Double", 2, 0));
        database.Guests.Add(guest);
        await database.SaveChangesAsync();
        database.ChangeTracker.Clear();
        await database.Database.ExecuteSqlRawAsync("""ALTER TABLE "Guests" DROP COLUMN "IdNumber" """);

        await database.Database.ExecuteSqlRawAsync("""ALTER TABLE "Rooms" DROP COLUMN "Description" """);
        await database.Database.ExecuteSqlRawAsync("""ALTER TABLE "Hotels" DROP COLUMN "Telephone" """);
        await database.Database.ExecuteSqlRawAsync("""ALTER TABLE "Hotels" DROP COLUMN "Description" """);
        await database.Database.ExecuteSqlRawAsync("""ALTER TABLE "Hotels" DROP COLUMN "Address" """);
        await LocalDatabaseSetup.InitializeAsync(database);
        await LocalDatabaseSetup.InitializeAsync(database);

        var saved = await database.Guests.SingleAsync();
        Assert.Equal(guest.Id, saved.Id);
        Assert.Null(saved.IdNumber);
        Assert.Null((await database.Rooms.SingleAsync()).Description);
        Assert.Equal(hotel, await database.Hotels.SingleAsync());
    }
}
