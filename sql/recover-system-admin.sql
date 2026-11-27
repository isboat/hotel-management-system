-- Connect directly to the PremaDesk Azure SQL database in SSMS.
-- Set both values below and run the entire script.
DECLARE @ExpectedDatabase sysname = N'';
DECLARE @AdministratorEmail nvarchar(254) = N'';

IF @@TRANCOUNT <> 0 OR (@@OPTIONS & 2) = 2
    THROW 50001, 'Run this script in a new query window with implicit transactions disabled and no open transaction.', 1;

IF NULLIF(TRIM(@ExpectedDatabase), N'') IS NULL
    OR DB_NAME() <> @ExpectedDatabase
    THROW 50002, 'Set @ExpectedDatabase and connect directly to that database.', 1;

SET @AdministratorEmail = UPPER(TRIM(@AdministratorEmail));
IF NULLIF(@AdministratorEmail, N'') IS NULL
    THROW 50003, 'Set @AdministratorEmail to the existing System Administrator email.', 1;

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @StaffId uniqueidentifier;
DECLARE @StaffName nvarchar(max);
DECLARE @Code varchar(64);
DECLARE @ExpiresUtc datetime2;

BEGIN TRY
    BEGIN TRANSACTION;

    SELECT @StaffId = [Id], @StaffName = [Name]
    FROM dbo.[Staff] WITH (UPDLOCK, HOLDLOCK)
    WHERE [Email] = @AdministratorEmail AND [IsSystemAdmin] = 1;

    IF @StaffId IS NULL
        THROW 50004, 'No System Administrator matches the specified email.', 1;

    SET @Code = CONVERT(varchar(64), CRYPT_GEN_RANDOM(32), 2);
    -- The hexadecimal code is ASCII. varchar supplies the same bytes as the API's UTF-8 encoding.
    DECLARE @Digest varchar(64) = CONVERT(varchar(64), HASHBYTES('SHA2_256', @Code), 2);
    DECLARE @IssuedUtc datetime2 = SYSUTCDATETIME();
    SET @ExpiresUtc = DATEADD(MINUTE, 30, @IssuedUtc);

    DELETE FROM dbo.[PasswordResets] WITH (HOLDLOCK)
    WHERE [StaffId] = @StaffId;

    INSERT INTO dbo.[PasswordResets] ([Digest], [StaffId], [ExpiresUtc])
    VALUES (@Digest, @StaffId, @ExpiresUtc);

    INSERT INTO dbo.[Audit] ([Id], [HotelId], [StaffId], [Utc], [Action], [Target], [Outcome], [CorrelationId])
    VALUES (NEWID(), NULL, NULL, @IssuedUtc,
        CONCAT(N'SQL operator ', ORIGINAL_LOGIN(), N' issued an emergency password reset code for ',
            @StaffName, N' (', LOWER(@AdministratorEmail), N')'),
        N'recover-system-admin.sql', 200, CONVERT(nvarchar(36), NEWID()));

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;

SELECT @Code AS [ResetCode], @ExpiresUtc AS [ExpiresUtc];
