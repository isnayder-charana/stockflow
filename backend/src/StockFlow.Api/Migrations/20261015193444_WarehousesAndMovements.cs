using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StockFlow.Api.Migrations
{
    /// <inheritdoc />
    public partial class WarehousesAndMovements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Warehouses",
                type: "tinyint(1)",
                nullable: false,
                // Los almacenes que ya existen quedan activos.
                defaultValue: true);

            migrationBuilder.UpdateData(
                table: "Warehouses",
                keyColumn: "Id",
                keyValue: 1,
                column: "IsActive",
                value: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_WarehouseStocks_Quantity",
                table: "WarehouseStocks",
                sql: "`Quantity` >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_StockMovements_Quantity",
                table: "StockMovements",
                sql: "`Quantity` > 0");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_WarehouseStocks_Quantity",
                table: "WarehouseStocks");

            migrationBuilder.DropCheckConstraint(
                name: "CK_StockMovements_Quantity",
                table: "StockMovements");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Warehouses");
        }
    }
}
