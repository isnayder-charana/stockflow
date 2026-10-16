using Microsoft.AspNetCore.Mvc;
using StockFlow.Api.Controllers;
using StockFlow.Api.Dtos;
using StockFlow.Api.Entities;

namespace StockFlow.Api.Tests;

public class WarehousesControllerTests
{
    private static WarehouseUpsertRequest NewRequest(string code = "alm-02") => new()
    {
        Code = code,
        Name = "Almacén Norte",
        Location = "Sede Trujillo"
    };

    [Fact]
    public async Task Create_GuardaAlmacenConCodigoEnMayusculas()
    {
        using var db = TestDb.Create();

        var result = await new WarehousesController(db).Create(NewRequest());

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var dto = Assert.IsType<WarehouseDto>(created.Value);
        Assert.Equal("ALM-02", dto.Code);
        Assert.True(dto.IsActive);
        Assert.Equal(2, db.Warehouses.Count()); // el semilla + el nuevo
    }

    [Fact]
    public async Task Create_CodigoDuplicado_DevuelveConflict()
    {
        using var db = TestDb.Create();

        var result = await new WarehousesController(db).Create(NewRequest("ALM-01"));

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task Delete_SinMovimientos_BorraElAlmacen()
    {
        using var db = TestDb.Create();
        var controller = new WarehousesController(db);
        var created = (CreatedAtActionResult)(await controller.Create(NewRequest())).Result!;
        var id = ((WarehouseDto)created.Value!).Id;

        var result = await controller.Delete(id);

        Assert.IsType<NoContentResult>(result);
        Assert.Null(await db.Warehouses.FindAsync(id));
    }

    [Fact]
    public async Task Delete_ConStock_DevuelveConflict()
    {
        using var db = TestDb.Create();
        var product = new Product { Sku = "CAS-01", Name = "Casco", CategoryId = 2 };
        db.Products.Add(product);
        db.WarehouseStocks.Add(new WarehouseStock { Product = product, WarehouseId = 1, Quantity = 4 });
        await db.SaveChangesAsync();

        var result = await new WarehousesController(db).Delete(1);

        Assert.IsType<ConflictObjectResult>(result);
        Assert.True(db.Warehouses.Single().IsActive);
    }

    [Fact]
    public async Task Delete_ConMovimientosSinStock_DesactivaEnVezDeBorrar()
    {
        using var db = TestDb.Create();
        var user = new User { Username = "admin", PasswordHash = "x", Role = UserRole.Admin };
        var product = new Product { Sku = "GUA-01", Name = "Guantes", CategoryId = 2 };
        db.AddRange(user, product);
        db.StockMovements.Add(new StockMovement
        {
            Product = product, WarehouseId = 1, User = user, Type = MovementType.In, Quantity = 5
        });
        db.WarehouseStocks.Add(new WarehouseStock { Product = product, WarehouseId = 1, Quantity = 0 });
        await db.SaveChangesAsync();

        var result = await new WarehousesController(db).Delete(1);

        Assert.IsType<NoContentResult>(result);
        Assert.False(db.Warehouses.Single().IsActive);
    }

    [Fact]
    public async Task GetStock_DevuelveCantidadPorProducto()
    {
        using var db = TestDb.Create();
        var product = new Product { Sku = "CAS-01", Name = "Casco", CategoryId = 2, MinStock = 10 };
        db.Products.Add(product);
        db.WarehouseStocks.Add(new WarehouseStock { Product = product, WarehouseId = 1, Quantity = 7 });
        await db.SaveChangesAsync();

        var result = await new WarehousesController(db).GetStock(1);

        var row = Assert.Single(result.Value!);
        Assert.Equal("CAS-01", row.Sku);
        Assert.Equal(7, row.Quantity);
    }
}
