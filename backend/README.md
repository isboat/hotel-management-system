# Hotel Management API

ASP.NET Core Web API on .NET 10 and C#, with EF Core and Azure SQL Database. The API provides tenant administration, role-based staff access, room inventory, reservations, housekeeping, guest profiles, cash folios, shift reconciliation, occupancy reporting, and API activity auditing.

## Run locally

Install the .NET 10 SDK. From `backend/`, set local-only bootstrap credentials and run the API.

```sh
export ASPNETCORE_ENVIRONMENT=Development
export Jwt__Key="$(openssl rand -hex 32)"
export Bootstrap__Email="admin@example.test"
read -rsp "Bootstrap password (at least 12 characters): " Bootstrap__Password
export Bootstrap__Password
printf '\n'
dotnet run --project Hms.Api --urls http://localhost:5080
```

Open `http://localhost:5080/swagger` for Swagger UI, `/swagger/v1/swagger.json` for OpenAPI, and `/health` to verify database connectivity. The default local database is SQLite. Set `ConnectionStrings__Local` to select a different local file. Bootstrap runs only if no system administrator exists. Sign in through the React app to create a property and assign its administrator, then sign in as that administrator to manage rooms and staff.

Open a cash shift before posting a cash payment or refund. Amounts in the API are integer pesewas. A retry of a cash payment or refund must reuse the original reference.

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

Passwords use ASP.NET Core Identity's password hasher. The API issues short-lived JWTs and rotating, hashed refresh credentials. The React client keeps both credentials in memory for the separate Azure origins. Reloading the page requires sign-in. Password reset codes are single-use and issued for private delivery by authorised staff. Sign-out and successful reset invalidate prior sessions.

The API records method, route, actor when known, and outcome for API requests. The authenticated workspace also records views, form submissions, and control interactions without field contents. Successful cash and charge events also have transactional audit records. OTA synchronisation, automated password reset delivery, marketing campaigns, and historical room-capacity reporting still need implementation. The current occupancy report uses booked nights and current bookable room inventory.
