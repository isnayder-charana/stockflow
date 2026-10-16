using Microsoft.AspNetCore.Mvc;
using StockFlow.Api.Controllers;
using StockFlow.Api.Dtos;
using StockFlow.Api.Entities;

namespace StockFlow.Api.Tests;

public class ProductsControllerTests
{
    private static ProductUpsertRequest NewRequest(string sku = "TAL-001") => new()
    {
        Sku = sku,
        Name = "Taladro percutor",
        Unit = "UND",
        UnitPrice = 350m,
        MinStock = 5,
        CategoryId = 1
    };

    [Fact]
    public async Task Create_GuardaProductoYDevuelveCreated()
    {
        using var db = TestDb.Create();
        var controller = new ProductsController(db, new FakeFileStorage());

        var result = await controller.Create(NewRequest());

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var dto = Assert.IsType<ProductDto>(created.Value);
        Assert.Equal("TAL-001", dto.Sku);
        Assert.Equal("Herramientas", dto.CategoryName);
        Assert.Single(db.Products);
    }

    [Fact]
    public async Task Create_SkuDuplicado_DevuelveConflict()
    {
        using var db = TestDb.Create();
        var controller = new ProductsController(db, new FakeFileStorage());
        await controller.Create(NewRequest());

        var result = await controller.Create(NewRequest());

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task GetAll_MarcaProductosBajoStockMinimo()
    {
        using var db = TestDb.Create();
        var product = new Product { Sku = "CAS-01", Name = "Casco", CategoryId = 2, MinStock = 10 };
        db.Products.Add(product);
        db.WarehouseStocks.Add(new WarehouseStock { Product = product, WarehouseId = 1, Quantity = 3 });
        await db.SaveChangesAsync();

        var result = await new ProductsController(db, new FakeFileStorage()).GetAll();

        var dto = Assert.Single(result.Value!);
        Assert.Equal(3, dto.TotalStock);
        Assert.True(dto.BelowMinStock);
    }

    [Fact]
    public async Task Delete_ConMovimientos_DesactivaEnVezDeBorrar()
    {
        using var db = TestDb.Create();
        var user = new User { Username = "admin", PasswordHash = "x", Role = UserRole.Admin };
        var product = new Product { Sku = "GUA-01", Name = "Guantes", CategoryId = 2 };
        db.AddRange(user, product);
        db.StockMovements.Add(new StockMovement
        {
            Product = product, WarehouseId = 1, User = user, Type = MovementType.In, Quantity = 20
        });
        await db.SaveChangesAsync();

        var result = await new ProductsController(db, new FakeFileStorage()).Delete(product.Id);

        Assert.IsType<NoContentResult>(result);
        Assert.False(db.Products.Single().IsActive);
    }
}
