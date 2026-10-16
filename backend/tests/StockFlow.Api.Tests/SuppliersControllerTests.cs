using Microsoft.AspNetCore.Mvc;
using StockFlow.Api.Controllers;
using StockFlow.Api.Dtos;
using StockFlow.Api.Entities;

namespace StockFlow.Api.Tests;

public class SuppliersControllerTests
{
    private static SupplierUpsertRequest NewRequest(string ruc = "20512345678") => new()
    {
        Name = "  Ferretería Industrial SAC ",
        Ruc = ruc,
        ContactName = "Rosa Quispe",
        Email = "Ventas@Ferreteria.pe",
        Phone = "  "
    };

    private static async Task<int> CreateAsync(SuppliersController controller, string ruc = "20512345678")
    {
        var created = (CreatedAtActionResult)(await controller.Create(NewRequest(ruc))).Result!;
        return ((SupplierDto)created.Value!).Id;
    }

    [Fact]
    public async Task Create_GuardaProveedorNormalizado()
    {
        using var db = TestDb.Create();

        var result = await new SuppliersController(db).Create(NewRequest());

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var dto = Assert.IsType<SupplierDto>(created.Value);
        Assert.Equal("Ferretería Industrial SAC", dto.Name);
        Assert.Equal("ventas@ferreteria.pe", dto.Email);
        Assert.Null(dto.Phone);
        Assert.True(dto.IsActive);
    }

    [Fact]
    public async Task Create_RucDuplicado_DevuelveConflict()
    {
        using var db = TestDb.Create();
        var controller = new SuppliersController(db);
        await CreateAsync(controller);

        var result = await controller.Create(NewRequest());

        Assert.IsType<ConflictObjectResult>(result.Result);
    }

    [Fact]
    public async Task Delete_SinProductos_BorraElProveedor()
    {
        using var db = TestDb.Create();
        var controller = new SuppliersController(db);
        var id = await CreateAsync(controller);

        var result = await controller.Delete(id);

        Assert.IsType<NoContentResult>(result);
        Assert.Null(await db.Suppliers.FindAsync(id));
    }

    [Fact]
    public async Task Delete_ConProductos_DesactivaYConservaLaRelacion()
    {
        using var db = TestDb.Create();
        var controller = new SuppliersController(db);
        var id = await CreateAsync(controller);
        db.Products.Add(new Product { Sku = "CAS-01", Name = "Casco", CategoryId = 2, SupplierId = id });
        await db.SaveChangesAsync();

        var result = await controller.Delete(id);

        Assert.IsType<NoContentResult>(result);
        Assert.False(db.Suppliers.Single().IsActive);
        Assert.Equal(id, db.Products.Single().SupplierId);
    }

    [Fact]
    public async Task GetProducts_DevuelveProductosConSuStock()
    {
        using var db = TestDb.Create();
        var controller = new SuppliersController(db);
        var id = await CreateAsync(controller);
        var product = new Product { Sku = "GUA-01", Name = "Guantes", CategoryId = 2, SupplierId = id };
        db.Products.Add(product);
        db.WarehouseStocks.Add(new WarehouseStock { Product = product, WarehouseId = 1, Quantity = 9 });
        await db.SaveChangesAsync();

        var result = await controller.GetProducts(id);

        var row = Assert.Single(result.Value!);
        Assert.Equal("GUA-01", row.Sku);
        Assert.Equal(9, row.TotalStock);
        Assert.Equal(1, (await controller.GetById(id)).Value!.ProductCount);
    }

    [Fact]
    public async Task Producto_NoAceptaProveedorInactivoNuevo_PeroConservaElQueYaTenia()
    {
        using var db = TestDb.Create();
        var inactive = new Supplier { Name = "Antiguo", Ruc = "20100000001", IsActive = false };
        db.Suppliers.Add(inactive);
        var product = new Product { Sku = "LEN-01", Name = "Lentes", CategoryId = 2, Supplier = inactive };
        db.Products.Add(product);
        await db.SaveChangesAsync();
        var products = new ProductsController(db, new FakeFileStorage());

        var create = await products.Create(new ProductUpsertRequest
        {
            Sku = "LEN-02", Name = "Lentes oscuros", Unit = "UND", CategoryId = 2, SupplierId = inactive.Id
        });
        var update = await products.Update(product.Id, new ProductUpsertRequest
        {
            Sku = "LEN-01", Name = "Lentes claros", Unit = "UND", CategoryId = 2, SupplierId = inactive.Id
        });

        Assert.IsType<BadRequestObjectResult>(create.Result);
        Assert.IsType<NoContentResult>(update);
    }
}
