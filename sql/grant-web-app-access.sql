-- Run in the hotel application database after azure-migrations.sql.
-- Set this to the Web App managed identity's unique Microsoft Entra display name.
DECLARE @IdentityName sysname = N'';

IF DB_NAME() = N'master' OR OBJECT_ID(N'dbo.Audit', N'U') IS NULL
    THROW 50000, 'Select the migrated hotel application database before running this script.', 1;

IF NULLIF(LTRIM(RTRIM(@IdentityName)), N'') IS NULL
    THROW 50001, 'Set @IdentityName to the Web App managed identity display name.', 1;

IF EXISTS (
    SELECT 1 FROM sys.database_principals
    WHERE name = @IdentityName AND type <> 'E'
)
    THROW 50002, 'A database principal with this name already exists and is not an external user.', 1;

DECLARE @QuotedIdentity nvarchar(258) = QUOTENAME(@IdentityName);
DECLARE @Statement nvarchar(max);

IF DATABASE_PRINCIPAL_ID(@IdentityName) IS NULL
BEGIN
    SET @Statement = N'CREATE USER ' + @QuotedIdentity + N' FROM EXTERNAL PROVIDER;';
    EXEC sys.sp_executesql @Statement;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.database_role_members
    WHERE role_principal_id = DATABASE_PRINCIPAL_ID(N'db_datareader')
      AND member_principal_id = DATABASE_PRINCIPAL_ID(@IdentityName)
)
BEGIN
    SET @Statement = N'ALTER ROLE db_datareader ADD MEMBER ' + @QuotedIdentity + N';';
    EXEC sys.sp_executesql @Statement;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.database_role_members
    WHERE role_principal_id = DATABASE_PRINCIPAL_ID(N'db_datawriter')
      AND member_principal_id = DATABASE_PRINCIPAL_ID(@IdentityName)
)
BEGIN
    SET @Statement = N'ALTER ROLE db_datawriter ADD MEMBER ' + @QuotedIdentity + N';';
    EXEC sys.sp_executesql @Statement;
END;

SET @Statement = N'DENY UPDATE, DELETE ON OBJECT::dbo.[Audit] TO ' + @QuotedIdentity + N';';
EXEC sys.sp_executesql @Statement;
GO
