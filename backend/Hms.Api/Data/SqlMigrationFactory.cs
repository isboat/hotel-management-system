using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Hms.Api.Data;

/// <summary>Generates SQL Server migrations without starting the API or connecting to a database.</summary>
public sealed class SqlMigrationFactory : IDesignTimeDbContextFactory<HotelDatabase>
{
    public HotelDatabase CreateDbContext(string[] args)
    {
        var connection = Environment.GetEnvironmentVariable("ConnectionStrings__Hotel")
            ?? "Server=localhost;Database=HotelManagement;Integrated Security=True";
        return new HotelDatabase(new DbContextOptionsBuilder<HotelDatabase>().UseSqlServer(connection).Options);
    }
}
