# Why EF Core migrations are kept here

The C# migrations in this folder are the source history for the Azure SQL schema. Each migration records a versioned schema change. EF Core uses the designer files and `HotelDatabaseModelSnapshot.cs` to compare the previous schema with the current model when a developer adds a migration.

The [idempotent SQL script](../../../../sql/azure-migrations.sql) is generated from this history. It contains the SQL statements to run in SSMS and checks the same `__EFMigrationsHistory` table that EF Core uses. Keeping the C# source lets developers generate the updated script when the schema changes. Commit future migrations, the updated snapshot, and the regenerated script together.

## Which setup uses these migrations?

| Environment | What creates or upgrades the schema |
| --- | --- |
| Local development with the default SQLite database | [LocalDatabaseSetup](../LocalDatabaseSetup.cs) creates a new database from the EF Core model and adds supported missing columns to existing local databases. SQLite uses this setup code independently of the Azure SQL migrations. |
| Azure SQL deployment through SSMS | The operator runs the scripts in the [SQL setup guide](../../../../sql/README.md). Leave `Database__Migrate` unset so the API leaves schema changes to that deployment step. |
| SQL Server or Azure SQL with automatic migrations explicitly enabled | If `Database__Migrate=true` is set and the API is using its SQL Server provider, [startup](../../Program.cs) applies pending EF Core migrations. This option requires a database identity with schema-change permissions. |

The first system administrator is created by the API after the schema is ready. See the [Azure deployment guide](../../../README.md#3-configure-the-api-and-first-system-administrator) for the bootstrap settings.
