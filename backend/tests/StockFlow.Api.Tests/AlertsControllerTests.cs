using StockFlow.Api.Controllers;
using StockFlow.Api.Entities;

namespace StockFlow.Api.Tests;

public class AlertsControllerTests
{
    [Fact]
    public async Task LowStock_DevuelveSoloProductosActivosBajoElMinimo()
    {
        using var db = TestDb.Create();
        var norte = new Warehouse { Code = "ALM-02", Name = "Almacén Norte" };
        var supplier = new Supplier { Name = "Seguridad SAC", Ruc = "20123456789", Phone = "987654321" };
        var bajo = new Product { Sku = "CAS-01", Name = "Casco", CategoryId = 2, MinStock = 10, Supplier = supplier };
        var agotado = new Product { Sku = "GUA-01", Name = "Guantes", CategoryId = 2, MinStock = 5 };
        var suficiente = new Product { Sku = "LEN-01", Name = "Lentes", CategoryId = 2, MinStock = 3 };
        var inactivo = new Product { Sku = "BOT-01", Name = "Botas", CategoryId = 2, MinStock = 8, IsActive = false };
        db.AddRange(norte, bajo, agotado, suficiente, inactivo);
        db.WarehouseStocks.AddRange(
            new WarehouseStock { Product = bajo, WarehouseId = 1, Quantity = 4 },
            new WarehouseStock { Product = bajo, Warehouse = norte, Quantity = 2 },
            new WarehouseStock { Product = suficiente, WarehouseId = 1, Quantity = 3 });
        await db.SaveChangesAsync();

        var result = await new AlertsController(db).LowStock();

        var alerts = result.Value!.ToList();
        Assert.Equal(["GUA-01", "CAS-01"], alerts.Select(a => a.Sku)); // agotados primero

        var casco = alerts[1];
        Assert.Equal(6, casco.TotalStock);
        Assert.Equal(4, casco.Shortage);
        Assert.Equal("Seguridad SAC", casco.SupplierName);
        Assert.Equal("987654321", casco.SupplierPhone);
        Assert.Equal(2, casco.Warehouses.Count);
        Assert.Equal(2, casco.Warehouses.Single(w => w.WarehouseName == "Almacén Norte").Quantity);

        Assert.Equal(0, alerts[0].TotalStock);
        Assert.Equal(5, alerts[0].Shortage);
        Assert.Empty(alerts[0].Warehouses);
    }

    [Fact]
    public async Task LowStockCount_CoincideConLaLista()
    {
        using var db = TestDb.Create();
        db.Products.AddRange(
            new Product { Sku = "CAS-01", Name = "Casco", CategoryId = 2, MinStock = 10 },
            new Product { Sku = "LEN-01", Name = "Lentes", CategoryId = 2, MinStock = 0 });
        await db.SaveChangesAsync();

        var count = await new AlertsController(db).LowStockCount();

        Assert.Equal(1, count.Count);
    }
}
