using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hms.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class TrackMaintenanceDates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "FixedUtc",
                table: "Maintenance",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ReportedUtc",
                table: "Maintenance",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FixedUtc",
                table: "Maintenance");

            migrationBuilder.DropColumn(
                name: "ReportedUtc",
                table: "Maintenance");
        }
    }
}
