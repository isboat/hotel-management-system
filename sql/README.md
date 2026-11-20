# Azure SQL migrations

This directory contains the database schema changes for the Hotel Management API.

- [azure-migrations.sql](azure-migrations.sql) is the generated, idempotent T-SQL script for SSMS. It creates the schema in a new database or applies pending migrations to an existing database managed by Entity Framework Core.
- [Migrations](Migrations/) contains the EF Core migration source, designer files, and model snapshot. The API project compiles these files from this directory so the EF CLI and the API still recognise the same migration history.

## Apply the script in SSMS

1. Connect to the Azure SQL server using an identity authorised to make schema changes.
2. Open `azure-migrations.sql` and select the **hotel application database** in the query window.
3. Review and execute the full script, including the batch separators and commands that update `__EFMigrationsHistory`. The script skips migrations already recorded in that table.
4. Confirm the expected migrations are recorded.

```sql
SELECT MigrationId, ProductVersion
FROM dbo.__EFMigrationsHistory
ORDER BY MigrationId;
```

The script prepares the schema. The API creates the first system administrator during startup. Follow the [first-deployment guide](../backend/README.md#first-deployment-to-azure-web-app) for app configuration and bootstrap instructions.

## Add a migration and regenerate the SQL script

After changing the EF Core model, run these commands from the repository root with the .NET 10 SDK. Install `dotnet-ef` 10.0.12 if it is unavailable.

```sh
dotnet restore backend/Hms.Api
dotnet ef migrations add AddExampleField --project backend/Hms.Api --output-dir ../../sql/Migrations --namespace Hms.Api.Data.Migrations
mv backend/Hms.Api/Hms/Api/Data/Migrations/HotelDatabaseModelSnapshot.cs sql/Migrations/HotelDatabaseModelSnapshot.cs
dotnet ef migrations script --idempotent --project backend/Hms.Api --output sql/azure-migrations.sql
```

The migration output directory is relative to the API project. EF Core writes the updated snapshot inside the API project when the prior snapshot is linked from outside it. The `mv` command replaces the linked snapshot before the next build. Review and commit the new EF migration, model snapshot, and regenerated SQL script together.
