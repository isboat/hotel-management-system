# Set up Azure SQL in SSMS

Use SQL Server Management Studio (SSMS) to create the Azure SQL database, apply the application schema, and grant the Web App database access. Before running these scripts, provision the Azure SQL logical server and the Web App, configure SQL networking and Microsoft Entra administration, and enable the Web App’s system-assigned managed identity. See the [Azure deployment guide](../backend/README.md#first-deployment-to-azure-web-app).

## Run the scripts in order

| Step | Script | Where to run it |
| --- | --- | --- |
| 1 | [Create the application database](create-database.sql) | Connect directly to the logical server’s `master` database as an identity authorised to create databases. Replace the database name and service objective and uncomment the statement. Skip this step if the database already exists. |
| 2 | [Apply the application schema](azure-migrations.sql) | Open a new connection directly to the **hotel application database** as an identity authorised to change its schema. Check the database shown in SSMS, then run the entire script. |
| 3 | [Grant the Web App access](grant-web-app-access.sql) | Stay connected to the **hotel application database** as the SQL server’s Microsoft Entra administrator. Set `@IdentityName` to the Web App’s unique managed identity display name, typically the Web App name, and run the script. |

The schema script covers all five EF Core migrations, from the initial schema through guest IDs, room descriptions, hotel details, and maintenance dates. It checks `dbo.__EFMigrationsHistory` before applying changes. Run the updated schema script again before deploying an API version that requires a new migration. Keep `Database__Migrate` unset on the Web App when applying migrations through SSMS.

The access script creates the managed identity’s database user and grants application data access. The Web App can append audit records, while updates and deletes on the audit table are denied.

## Verify the schema

Run this query in the hotel application database after the schema script completes.

```sql
SELECT MigrationId, ProductVersion
FROM dbo.__EFMigrationsHistory
ORDER BY MigrationId;
```

Continue with the [first system administrator setup](../backend/README.md#3-configure-the-api-and-first-system-administrator). The API creates the account on startup and hashes its password using the configured application password hasher.

## Regenerate the schema script after a model change

The [EF Core migration source](../backend/Hms.Api/Data/Migrations/README.md) is the input used to generate the T-SQL. From the repository root, use .NET 10 and `dotnet-ef` 10.0.12 to regenerate the script after adding a migration. The operator applying the resulting script in SSMS only needs the SQL file.

```sh
dotnet restore backend/Hms.Api
dotnet ef migrations script --idempotent --project backend/Hms.Api --output sql/azure-migrations.sql
```

Review and commit the refreshed SQL script with the source migration.

## Recover a locked-out System Administrator

Run [recover-system-admin.sql](recover-system-admin.sql) only when recovery is needed. Use an authorized operator identity with permission to read `dbo.Staff`, delete and insert rows in `dbo.PasswordResets`, and insert rows in `dbo.Audit`.

1. In SSMS, connect directly to the PremaDesk application database using your organization's Microsoft Entra MFA policy.
2. Open the script and set `@ExpectedDatabase` to the application database name and `@AdministratorEmail` to the existing System Administrator's email. Run the entire script.
3. Share the code from the SSMS results privately with the administrator. Avoid exporting or retaining the result grid. The code expires after 30 minutes and replaces any earlier codes for that account.
4. The administrator selects **I have a reset code** on the sign-in page and enters the code and a new password. Completing the reset invalidates existing sessions.
5. Verify that the administrator can sign in. The platform audit log records the SQL login and target account. The reset code is stored only as a digest.

This operation requires the existing application schema. It uses the existing password reset flow and requires no schema changes.
