# Hotel Management API

ASP.NET Core Web API on .NET 10 and C#, with EF Core and Azure SQL Database. The API provides tenant administration, role-based staff access, room inventory, reservations, housekeeping, guest profiles, cash folios, shift reconciliation, occupancy reporting, and API activity auditing.

## Run locally

Install the .NET 10 SDK. Start at the repository root and run the commands for your shell in the same terminal. When prompted, enter a password of at least 12 characters and press Enter.

### Bash

Use Bash with OpenSSL installed. On Windows, use Git Bash or WSL.

```bash
cd backend

export ASPNETCORE_ENVIRONMENT=Development
export Jwt__Key="$(openssl rand -hex 32)"
export Bootstrap__Email="admin@example.test"
read -rsp "Bootstrap password (at least 12 characters): " Bootstrap__Password
export Bootstrap__Password
printf '\n'
dotnet run --project Hms.Api --urls http://localhost:5080
```

### PowerShell

Use PowerShell 7.2 or newer.

```powershell
cd backend

$env:ASPNETCORE_ENVIRONMENT = "Development"
$env:Jwt__Key = [Convert]::ToHexString(
    [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
)
$env:Bootstrap__Email = "admin@example.test"
$env:Bootstrap__Password = Read-Host "Bootstrap password (at least 12 characters)" -MaskInput

dotnet run --project Hms.Api --urls http://localhost:5080
```

For local development only, you can use this example in place of the generated JWT key. Generate a unique secret for deployed environments.

```powershell
$env:Jwt__Key = "4A8F2C1E9D7B3F5A6C2E1D8F4A9B7C3E2F1A6D8C5B4E9F2A7C3D1E8F4A9B5C6D"
```

### Verify and sign in

Open `http://localhost:5080/swagger` for Swagger UI, `/swagger/v1/swagger.json` for OpenAPI, and `/health` to verify database connectivity. The default local database is SQLite. Set `ConnectionStrings__Local` to select a different local file. Bootstrap runs only if no system administrator exists. Sign in through the React app to create a property and assign its administrator, then sign in as that administrator to manage rooms and staff.

Open a cash shift before posting a cash payment or refund. Amounts in the API are integer pesewas. A retry of a cash payment or refund must reuse the original reference.

### Troubleshoot a 401 on first sign-in

A `401 Unauthorized` at sign-in means the account could not be found or the password did not match. The bootstrap account has no default password. At startup, the API creates the account only if `Bootstrap__Email` is set, `Bootstrap__Password` has at least 12 characters, and the database has no system administrator.

Stop the API with `Ctrl+C`, then rerun the setup commands above in the same terminal you use to start it. Sign in with `admin@example.test` and the password you entered at the prompt. If you start the API from an IDE, set the environment variables in the IDE's run configuration.

If sign-in still fails with the default local SQLite setup, stop the API and point it at a fresh SQLite file. This preserves the original database.

```powershell
$env:ConnectionStrings__Local = "Data Source=hms-first-login.db"
```

```bash
export ConnectionStrings__Local="Data Source=hms-first-login.db"
```

Restart the API in the same terminal with the bootstrap variables still set. If the credentials work with the fresh database, the original database likely already had a system administrator. Changing the bootstrap password does not reset an existing account.

## Tests

```sh
dotnet test Hms.Tests
dotnet publish Hms.Api -c Release
```

The integration suite starts the API with a temporary SQLite database and tests HTTP authentication, tenant boundaries, concurrent room allocation, cash idempotency, refunds, reconciliation, audit records, and Swagger. SQL Server schema changes use EF Core migrations under `Hms.Api/Data/Migrations`. Validate the migration and concurrent booking and payment behavior on an Azure SQL staging database before production rollout.

## Azure Web App

Provision a Web App with the .NET 10 runtime and an Azure SQL database. Configure HTTPS only and set these App Service settings.

| Setting | Value |
| --- | --- |
| `ConnectionStrings__Hotel` | Azure SQL connection string, preferably using the Web App managed identity |
| `Jwt__Key` | Strong secret of at least 32 bytes, preferably a Key Vault reference |
| `FrontendOrigins__0` | Exact HTTPS origin of the Static Web App, without a trailing slash |
| `Bootstrap__Email`, `Bootstrap__Password` | First administrator credentials. Remove the bootstrap settings after provisioning. |

Apply the EF migrations with a separate database identity before starting a deployment. The runtime identity needs data access to application tables, including insert/read permissions on the audit table. For a dedicated development or staging app whose identity can run migrations, set `Database__Migrate=true` to apply them on startup.

```sh
# Run with ConnectionStrings__Hotel set for the migration identity.
dotnet tool install --global dotnet-ef --version 10.0.12
dotnet ef database update --project Hms.Api
```

Set the `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, and `AZURE_WEBAPP_NAME` variables in the GitHub `backend-production` environment. Configure a matching Azure federated identity and grant it deployment access to the Web App. The backend build workflow tests and publishes the API artifact. The deployment workflow downloads the artifact from the successful `main` build and deploys it.

## Implementation notes

Passwords use ASP.NET Core Identity's password hasher. The API issues short-lived JWTs and rotating, hashed refresh credentials. The React client uses browser session storage so credentials survive reloading the current tab across the separate Azure origins. Sign-out or rejected session credentials clear the stored session. Password reset codes are single-use and issued for private delivery by authorised staff. Sign-out and successful reset invalidate prior sessions.

The API records named actions such as sign-ins, guest detail views, room assignments, and failed attempts. Authorised readers see the actor’s current staff name and email alongside each event. Guest names and room numbers provide context without logging guest contact details or credentials. Successful cash and charge events also have transactional audit records. OTA synchronisation, automated password reset delivery, marketing campaigns, and historical room-capacity reporting still need implementation. The current occupancy report uses booked nights and current bookable room inventory.
