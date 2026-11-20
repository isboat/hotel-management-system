using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Hms.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddHotelDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Address",
                table: "Hotels",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Hotels",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Telephone",
                table: "Hotels",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Address",
                table: "Hotels");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Hotels");

            migrationBuilder.DropColumn(
                name: "Telephone",
                table: "Hotels");
        }
    }
}
