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

## First deployment to Azure Web App

### 1. Provision Azure resources

1. Create an Azure SQL logical server. The application database is created through SSMS in the next step. Configure a Microsoft Entra administrator on the SQL server so you can create database users for managed identities.
2. Create an Azure App Service Web App with **Code** publishing and the **.NET 10** runtime. Enable **HTTPS Only** in the Web App settings.
3. In the Web App, open **Identity → System assigned**, turn the identity on, and save. This is the identity the API will use to connect to Azure SQL.
4. Configure Azure SQL networking so both the Web App and the workstation or runner applying migrations can reach the server. For a private SQL endpoint, use App Service VNet integration and private DNS. For public SQL access, allow the required outbound IPs through the database server firewall.

### 2. Set up the database in SSMS

Follow the [SQL setup guide](../sql/README.md) to create the database if needed, apply the idempotent schema script, and grant data access to the Web App’s managed identity. Run the scripts in order and verify the recorded migration history before deploying. Keep `Database__Migrate` unset on the Web App so schema updates are applied through SSMS.

### 3. Configure the API and first system administrator

In the Web App, open **Environment variables → App settings**. Add the following settings with the exact names shown, including the double underscores. Save the settings.

| Setting | Value |
| --- | --- |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ConnectionStrings__Hotel` | `Server=tcp:<sql-server>.database.windows.net,1433;Database=<database>;Authentication=Active Directory Managed Identity;Encrypt=True;TrustServerCertificate=False;` |
| `Jwt__Key` | A unique random signing secret of at least 32 bytes. Generate one with `openssl rand -hex 32` or a password manager. Store it in App Settings or use a Key Vault reference the Web App identity can read. |
| `FrontendOrigins__0` | The exact HTTPS origin of the Azure Static Web App, such as `https://<frontend-host>.azurestaticapps.net`. Omit the trailing slash. |
| `Bootstrap__Email` | The email address for the first **system administrator**. |
| `Bootstrap__Password` | A unique password of at least 12 characters for that account. Enter it in App Settings or use a Key Vault reference. |

The API creates the account on startup once it can connect to the migrated database and finds no existing system administrator. Use the production JWT signing secret consistently across restarts and instances. Keep the bootstrap password and signing key out of source control.

### 4. Connect GitHub Actions and deploy from main

1. In **Microsoft Entra ID → App registrations**, create an application for GitHub deployment. Add a **Federated credential** for GitHub Actions with the repository owner and name and the environment `backend-production`. For this repository the subject is `repo:isboat/hotel-management-system:environment:backend-production`. This deployment identity is separate from the Web App’s SQL identity.
2. In the Web App’s **Access control (IAM)**, grant that application’s service principal **Website Contributor** scoped to the Web App.
3. In the GitHub repository, open **Settings → Environments**, create `backend-production`, and set these environment variables.

   | GitHub variable | Value |
   | --- | --- |
   | `AZURE_CLIENT_ID` | Deployment app registration’s application (client) ID |
   | `AZURE_TENANT_ID` | Microsoft Entra directory (tenant) ID |
   | `AZURE_SUBSCRIPTION_ID` | Subscription ID containing the Web App |
   | `AZURE_WEBAPP_NAME` | Web App resource name without its hostname suffix |

4. In **Actions → Backend build → Run workflow**, select `main` and start the workflow. A successful run publishes the API artifact and triggers **Backend deploy to Azure Web App**. Check both runs for success and complete any environment approval configured in GitHub.

### 5. Verify the deployment and finish administrator setup

1. Open `https://<api-host>/health`. Expect HTTP 200 with `{"status":"ok"}`. If startup fails or health returns 503, check **App Service → Log stream**, SQL networking, identity permissions, and whether migrations were applied to the configured database.
2. Sign in to the deployed React application using the bootstrap email and password. The first system administrator should land on **Hotel tenants**. If the frontend is pending, open `https://<api-host>/swagger` over HTTPS and test `POST /api/v1/auth/login` directly. Expect HTTP 200 with a token and `isSystemAdmin: true`. Keep the returned tokens private.
3. Once sign-in is verified, delete `Bootstrap__Email` and `Bootstrap__Password` from App Settings, save, and verify you can still sign in after the app restarts. The account remains in Azure SQL. Changing the bootstrap settings later does not reset an existing system administrator’s password.
4. In **Hotel tenants**, create the first hotel and use **Assign administrator** to create its property administrator. Edit hotel details under **Hotel tenants** while signed in as the system administrator. Sign in as the property administrator to add rooms and invite staff.
5. Verify the frontend build uses `VITE_API_URL=https://<api-host>`. If direct login works but browser sign-in fails, compare that URL and the frontend’s actual origin with `FrontendOrigins__0`. For a direct 401, check the bootstrap email, the 12-character minimum, and whether the database already has a system administrator. Use the existing credentials for a database that was previously bootstrapped.

## Implementation notes

Passwords use ASP.NET Core Identity's password hasher. The API issues short-lived JWTs and rotating, hashed refresh credentials. The React client uses browser session storage so credentials survive reloading the current tab across the separate Azure origins. Sign-out or rejected session credentials clear the stored session. Password reset codes are single-use and issued for private delivery by authorised staff. Sign-out and successful reset invalidate prior sessions.

The API records named actions such as sign-ins, guest detail views, room assignments, and failed attempts. Authorised readers see the actor’s current staff name and email alongside each event. Guest names and room numbers provide context without logging guest contact details or credentials. Successful cash and charge events also have transactional audit records. OTA synchronisation, automated password reset delivery, marketing campaigns, and historical room-capacity reporting still need implementation. The current occupancy report uses booked nights and current bookable room inventory.
