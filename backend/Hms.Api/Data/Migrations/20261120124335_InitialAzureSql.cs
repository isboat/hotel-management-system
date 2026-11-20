using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hms.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialAzureSql : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Audit",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    HotelId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    StaffId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Target = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Outcome = table.Column<int>(type: "int", nullable: false),
                    CorrelationId = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Audit", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Hotels",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Suspended = table.Column<bool>(type: "bit", nullable: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Hotels", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PasswordResets",
                columns: table => new
                {
                    Digest = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    StaffId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExpiresUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PasswordResets", x => x.Digest);
                });

            migrationBuilder.CreateTable(
                name: "RefreshSessions",
                columns: table => new
                {
                    Digest = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    StaffId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    ExpiresUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefreshSessions", x => x.Digest);
                });

            migrationBuilder.CreateTable(
                name: "Staff",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(254)", maxLength: 254, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    IsSystemAdmin = table.Column<bool>(type: "bit", nullable: false),
                    SessionVersion = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Staff", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CashShifts",
                columns: table => new
                {
                    HotelId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CashierId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OpenedUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Float = table.Column<long>(type: "bigint", nullable: false),
                    ClosedUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Counted = table.Column<long>(type: "bigint", nullable: true),
                    Expected = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CashShifts", x => new { x.HotelId, x.Id });
                    table.ForeignKey(
                        name: "FK_CashShifts_Hotels_HotelId",
                        column: x => x.HotelId,
                        principalTable: "Hotels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Guests",
                columns: table => new
                {
                    HotelId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Preferences = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    MarketingOptIn = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Guests", x => new { x.HotelId, x.Id });
                    table.ForeignKey(
                        name: "FK_Guests_Hotels_HotelId",
                        column: x => x.HotelId,
                        principalTable: "Hotels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Rooms",
                columns: table => new
                {
                    HotelId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Number = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Capacity = table.Column<int>(type: "int", nullable: false),
                    Rate = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Archived = table.Column<bool>(type: "bit", nullable: false),
                    OutOfService = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Rooms", x => new { x.HotelId, x.Id });
                    table.ForeignKey(
                        name: "FK_Rooms_Hotels_HotelId",
                        column: x => x.HotelId,
                        principalTable: "Hotels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Memberships",
                columns: table => new
                {
                    HotelId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    StaffId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Role = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Active = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Memberships", x => new { x.HotelId, x.StaffId });
                    table.ForeignKey(
                        name: "FK_Memberships_Hotels_HotelId",
                        column: x => x.HotelId,
                        principalTable: "Hotels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Memberships_Staff_StaffId",
                        column: x => x.StaffId,
                        principalTable: "Staff",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Maintenance",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    HotelId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Resolved = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Maintenance", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Maintenance_Rooms_HotelId_RoomId",
                        columns: x => new { x.HotelId, x.RoomId },
                        principalTable: "Rooms",
                        principalColumns: new[] { "HotelId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Reservations",
                columns: table => new
                {
                    HotelId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Guest = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Arrival = table.Column<DateOnly>(type: "date", nullable: false),
                    Departure = table.Column<DateOnly>(type: "date", nullable: false),
                    Total = table.Column<long>(type: "bigint", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    GuestId = table.Column<Guid>(type: "uniqueidentifier", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reservations", x => new { x.HotelId, x.Id });
                    table.ForeignKey(
                        name: "FK_Reservations_Guests_HotelId_GuestId",
                        columns: x => new { x.HotelId, x.GuestId },
                        principalTable: "Guests",
                        principalColumns: new[] { "HotelId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Reservations_Rooms_HotelId_RoomId",
                        columns: x => new { x.HotelId, x.RoomId },
                        principalTable: "Rooms",
                        principalColumns: new[] { "HotelId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Charges",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    HotelId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReservationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Amount = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Charges", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Charges_Reservations_HotelId_ReservationId",
                        columns: x => new { x.HotelId, x.ReservationId },
                        principalTable: "Reservations",
                        principalColumns: new[] { "HotelId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Payments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    HotelId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReservationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CashierId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ShiftId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Reference = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Amount = table.Column<long>(type: "bigint", nullable: false),
                    Tendered = table.Column<long>(type: "bigint", nullable: false),
                    Utc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OriginalPaymentId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Reason = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Payments_CashShifts_HotelId_ShiftId",
                        columns: x => new { x.HotelId, x.ShiftId },
                        principalTable: "CashShifts",
                        principalColumns: new[] { "HotelId", "Id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Payments_Reservations_HotelId_ReservationId",
                        columns: x => new { x.HotelId, x.ReservationId },
                        principalTable: "Reservations",
                        principalColumns: new[] { "HotelId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "RoomNights",
                columns: table => new
                {
                    HotelId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Date = table.Column<DateOnly>(type: "date", nullable: false),
                    ReservationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoomNights", x => new { x.HotelId, x.RoomId, x.Date });
                    table.ForeignKey(
                        name: "FK_RoomNights_Reservations_HotelId_ReservationId",
                        columns: x => new { x.HotelId, x.ReservationId },
                        principalTable: "Reservations",
                        principalColumns: new[] { "HotelId", "Id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Audit_HotelId_Utc",
                table: "Audit",
                columns: new[] { "HotelId", "Utc" });

            migrationBuilder.CreateIndex(
                name: "IX_CashShifts_HotelId_CashierId",
                table: "CashShifts",
                columns: new[] { "HotelId", "CashierId" },
                unique: true,
                filter: "[ClosedUtc] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Charges_HotelId_ReservationId",
                table: "Charges",
                columns: new[] { "HotelId", "ReservationId" });

            migrationBuilder.CreateIndex(
                name: "IX_Maintenance_HotelId_RoomId",
                table: "Maintenance",
                columns: new[] { "HotelId", "RoomId" });

            migrationBuilder.CreateIndex(
                name: "IX_Memberships_StaffId",
                table: "Memberships",
                column: "StaffId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_HotelId_Reference",
                table: "Payments",
                columns: new[] { "HotelId", "Reference" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Payments_HotelId_ReservationId",
                table: "Payments",
                columns: new[] { "HotelId", "ReservationId" });

            migrationBuilder.CreateIndex(
                name: "IX_Payments_HotelId_ShiftId",
                table: "Payments",
                columns: new[] { "HotelId", "ShiftId" });

            migrationBuilder.CreateIndex(
                name: "IX_RefreshSessions_ExpiresUtc",
                table: "RefreshSessions",
                column: "ExpiresUtc");

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_HotelId_GuestId",
                table: "Reservations",
                columns: new[] { "HotelId", "GuestId" });

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_HotelId_RoomId",
                table: "Reservations",
                columns: new[] { "HotelId", "RoomId" });

            migrationBuilder.CreateIndex(
                name: "IX_RoomNights_HotelId_ReservationId",
                table: "RoomNights",
                columns: new[] { "HotelId", "ReservationId" });

            migrationBuilder.CreateIndex(
                name: "IX_Rooms_HotelId_Number",
                table: "Rooms",
                columns: new[] { "HotelId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Staff_Email",
                table: "Staff",
                column: "Email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Audit");

            migrationBuilder.DropTable(
                name: "Charges");

            migrationBuilder.DropTable(
                name: "Maintenance");

            migrationBuilder.DropTable(
                name: "Memberships");

            migrationBuilder.DropTable(
                name: "PasswordResets");

            migrationBuilder.DropTable(
                name: "Payments");

            migrationBuilder.DropTable(
                name: "RefreshSessions");

            migrationBuilder.DropTable(
                name: "RoomNights");

            migrationBuilder.DropTable(
                name: "Staff");

            migrationBuilder.DropTable(
                name: "CashShifts");

            migrationBuilder.DropTable(
                name: "Reservations");

            migrationBuilder.DropTable(
                name: "Guests");

            migrationBuilder.DropTable(
                name: "Rooms");

            migrationBuilder.DropTable(
                name: "Hotels");
        }
    }
}
