IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE TABLE [Audit] (
        [Id] uniqueidentifier NOT NULL,
        [HotelId] uniqueidentifier NULL,
        [StaffId] uniqueidentifier NULL,
        [Utc] datetime2 NOT NULL,
        [Action] nvarchar(max) NOT NULL,
        [Target] nvarchar(max) NOT NULL,
        [Outcome] int NOT NULL,
        [CorrelationId] nvarchar(max) NOT NULL,
        CONSTRAINT [PK_Audit] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE TABLE [Hotels] (
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(max) NOT NULL,
        [Suspended] bit NOT NULL,
        [Archived] bit NOT NULL,
        CONSTRAINT [PK_Hotels] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE TABLE [PasswordResets] (
        [Digest] nvarchar(64) NOT NULL,
        [StaffId] uniqueidentifier NOT NULL,
        [ExpiresUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_PasswordResets] PRIMARY KEY ([Digest])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE TABLE [RefreshSessions] (
        [Digest] nvarchar(64) NOT NULL,
        [StaffId] uniqueidentifier NOT NULL,
        [Version] int NOT NULL,
        [ExpiresUtc] datetime2 NOT NULL,
        CONSTRAINT [PK_RefreshSessions] PRIMARY KEY ([Digest])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE TABLE [Staff] (
        [Id] uniqueidentifier NOT NULL,
        [Email] nvarchar(254) NOT NULL,
        [Name] nvarchar(max) NOT NULL,
        [PasswordHash] nvarchar(max) NOT NULL,
        [IsSystemAdmin] bit NOT NULL,
        [SessionVersion] int NOT NULL,
        CONSTRAINT [PK_Staff] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE TABLE [CashShifts] (
        [HotelId] uniqueidentifier NOT NULL,
        [Id] uniqueidentifier NOT NULL,
        [CashierId] uniqueidentifier NOT NULL,
        [OpenedUtc] datetime2 NOT NULL,
        [Float] bigint NOT NULL,
        [ClosedUtc] datetime2 NULL,
        [Counted] bigint NULL,
        [Expected] bigint NULL,
        CONSTRAINT [PK_CashShifts] PRIMARY KEY ([HotelId], [Id]),
        CONSTRAINT [FK_CashShifts_Hotels_HotelId] FOREIGN KEY ([HotelId]) REFERENCES [Hotels] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE TABLE [Guests] (
        [HotelId] uniqueidentifier NOT NULL,
        [Id] uniqueidentifier NOT NULL,
        [Name] nvarchar(max) NOT NULL,
        [Email] nvarchar(max) NULL,
        [Phone] nvarchar(max) NULL,
        [Preferences] nvarchar(max) NULL,
        [MarketingOptIn] bit NOT NULL,
        CONSTRAINT [PK_Guests] PRIMARY KEY ([HotelId], [Id]),
        CONSTRAINT [FK_Guests_Hotels_HotelId] FOREIGN KEY ([HotelId]) REFERENCES [Hotels] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE TABLE [Rooms] (
        [HotelId] uniqueidentifier NOT NULL,
        [Id] uniqueidentifier NOT NULL,
        [Number] nvarchar(30) NOT NULL,
        [Type] nvarchar(max) NOT NULL,
        [Capacity] int NOT NULL,
        [Rate] bigint NOT NULL,
        [Status] nvarchar(max) NOT NULL,
        [Archived] bit NOT NULL,
        [OutOfService] bit NOT NULL,
        CONSTRAINT [PK_Rooms] PRIMARY KEY ([HotelId], [Id]),
        CONSTRAINT [FK_Rooms_Hotels_HotelId] FOREIGN KEY ([HotelId]) REFERENCES [Hotels] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE TABLE [Memberships] (
        [HotelId] uniqueidentifier NOT NULL,
        [StaffId] uniqueidentifier NOT NULL,
        [Role] nvarchar(max) NOT NULL,
        [Active] bit NOT NULL,
        CONSTRAINT [PK_Memberships] PRIMARY KEY ([HotelId], [StaffId]),
        CONSTRAINT [FK_Memberships_Hotels_HotelId] FOREIGN KEY ([HotelId]) REFERENCES [Hotels] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_Memberships_Staff_StaffId] FOREIGN KEY ([StaffId]) REFERENCES [Staff] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE TABLE [Maintenance] (
        [Id] uniqueidentifier NOT NULL,
        [HotelId] uniqueidentifier NOT NULL,
        [RoomId] uniqueidentifier NOT NULL,
        [Description] nvarchar(max) NOT NULL,
        [Resolved] bit NOT NULL,
        CONSTRAINT [PK_Maintenance] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Maintenance_Rooms_HotelId_RoomId] FOREIGN KEY ([HotelId], [RoomId]) REFERENCES [Rooms] ([HotelId], [Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE TABLE [Reservations] (
        [HotelId] uniqueidentifier NOT NULL,
        [Id] uniqueidentifier NOT NULL,
        [RoomId] uniqueidentifier NOT NULL,
        [Guest] nvarchar(max) NOT NULL,
        [Arrival] date NOT NULL,
        [Departure] date NOT NULL,
        [Total] bigint NOT NULL,
        [Status] nvarchar(max) NOT NULL,
        [GuestId] uniqueidentifier NULL,
        CONSTRAINT [PK_Reservations] PRIMARY KEY ([HotelId], [Id]),
        CONSTRAINT [FK_Reservations_Guests_HotelId_GuestId] FOREIGN KEY ([HotelId], [GuestId]) REFERENCES [Guests] ([HotelId], [Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Reservations_Rooms_HotelId_RoomId] FOREIGN KEY ([HotelId], [RoomId]) REFERENCES [Rooms] ([HotelId], [Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE TABLE [Charges] (
        [Id] uniqueidentifier NOT NULL,
        [HotelId] uniqueidentifier NOT NULL,
        [ReservationId] uniqueidentifier NOT NULL,
        [Description] nvarchar(max) NOT NULL,
        [Amount] bigint NOT NULL,
        CONSTRAINT [PK_Charges] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Charges_Reservations_HotelId_ReservationId] FOREIGN KEY ([HotelId], [ReservationId]) REFERENCES [Reservations] ([HotelId], [Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE TABLE [Payments] (
        [Id] uniqueidentifier NOT NULL,
        [HotelId] uniqueidentifier NOT NULL,
        [ReservationId] uniqueidentifier NOT NULL,
        [CashierId] uniqueidentifier NOT NULL,
        [ShiftId] uniqueidentifier NOT NULL,
        [Reference] nvarchar(80) NOT NULL,
        [Amount] bigint NOT NULL,
        [Tendered] bigint NOT NULL,
        [Utc] datetime2 NOT NULL,
        [OriginalPaymentId] uniqueidentifier NULL,
        [Reason] nvarchar(max) NULL,
        CONSTRAINT [PK_Payments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Payments_CashShifts_HotelId_ShiftId] FOREIGN KEY ([HotelId], [ShiftId]) REFERENCES [CashShifts] ([HotelId], [Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Payments_Reservations_HotelId_ReservationId] FOREIGN KEY ([HotelId], [ReservationId]) REFERENCES [Reservations] ([HotelId], [Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE TABLE [RoomNights] (
        [HotelId] uniqueidentifier NOT NULL,
        [RoomId] uniqueidentifier NOT NULL,
        [Date] date NOT NULL,
        [ReservationId] uniqueidentifier NOT NULL,
        CONSTRAINT [PK_RoomNights] PRIMARY KEY ([HotelId], [RoomId], [Date]),
        CONSTRAINT [FK_RoomNights_Reservations_HotelId_ReservationId] FOREIGN KEY ([HotelId], [ReservationId]) REFERENCES [Reservations] ([HotelId], [Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE INDEX [IX_Audit_HotelId_Utc] ON [Audit] ([HotelId], [Utc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_CashShifts_HotelId_CashierId] ON [CashShifts] ([HotelId], [CashierId]) WHERE [ClosedUtc] IS NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE INDEX [IX_Charges_HotelId_ReservationId] ON [Charges] ([HotelId], [ReservationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE INDEX [IX_Maintenance_HotelId_RoomId] ON [Maintenance] ([HotelId], [RoomId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE INDEX [IX_Memberships_StaffId] ON [Memberships] ([StaffId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Payments_HotelId_Reference] ON [Payments] ([HotelId], [Reference]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE INDEX [IX_Payments_HotelId_ReservationId] ON [Payments] ([HotelId], [ReservationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE INDEX [IX_Payments_HotelId_ShiftId] ON [Payments] ([HotelId], [ShiftId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE INDEX [IX_RefreshSessions_ExpiresUtc] ON [RefreshSessions] ([ExpiresUtc]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE INDEX [IX_Reservations_HotelId_GuestId] ON [Reservations] ([HotelId], [GuestId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE INDEX [IX_Reservations_HotelId_RoomId] ON [Reservations] ([HotelId], [RoomId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE INDEX [IX_RoomNights_HotelId_ReservationId] ON [RoomNights] ([HotelId], [ReservationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Rooms_HotelId_Number] ON [Rooms] ([HotelId], [Number]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Staff_Email] ON [Staff] ([Email]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120124335_InitialAzureSql'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261120124335_InitialAzureSql', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120133829_AddGuestIdNumber'
)
BEGIN
    ALTER TABLE [Guests] ADD [IdNumber] nvarchar(64) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120133829_AddGuestIdNumber'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261120133829_AddGuestIdNumber', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120134031_AddRoomDescription'
)
BEGIN
    ALTER TABLE [Rooms] ADD [Description] nvarchar(1000) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120134031_AddRoomDescription'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261120134031_AddRoomDescription', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120134329_AddHotelDetails'
)
BEGIN
    ALTER TABLE [Hotels] ADD [Address] nvarchar(500) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120134329_AddHotelDetails'
)
BEGIN
    ALTER TABLE [Hotels] ADD [Description] nvarchar(1000) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120134329_AddHotelDetails'
)
BEGIN
    ALTER TABLE [Hotels] ADD [Telephone] nvarchar(40) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120134329_AddHotelDetails'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261120134329_AddHotelDetails', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120172429_TrackMaintenanceDates'
)
BEGIN
    ALTER TABLE [Maintenance] ADD [FixedUtc] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120172429_TrackMaintenanceDates'
)
BEGIN
    ALTER TABLE [Maintenance] ADD [ReportedUtc] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261120172429_TrackMaintenanceDates'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261120172429_TrackMaintenanceDates', N'10.0.12');
END;

COMMIT;
GO
