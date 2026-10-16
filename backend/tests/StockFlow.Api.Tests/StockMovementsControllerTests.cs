using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using StockFlow.Api.Controllers;
using StockFlow.Api.Data;
using StockFlow.Api.Dtos;
using StockFlow.Api.Entities;

namespace StockFlow.Api.Tests;

public class StockMovementsControllerTests
{
    /// <summary>Base con un almacenero y un producto (Id 1) en el almacén semilla (Id 1).</summary>
    private static (AppDbContext Db, StockMovementsController Controller) Setup()
    {
        var db = TestDb.Create();
        db.Users.Add(new User { Id = 10, Username = "almacen1", PasswordHash = "x", Role = UserRole.Almacenero });
        db.Products.Add(new Product { Id = 1, Sku = "TAL-001", Name = "Taladro", CategoryId = 1 });
        db.SaveChanges();

        var controller = new StockMovementsController(db, new FakeFileStorage())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        [new Claim(ClaimTypes.NameIdentifier, "10")], "Test"))
                }
            }
        };
        return (db, controller);
    }

    private static StockMovementCreateRequest Request(MovementType type, int quantity) => new()
    {
        Type = type,
        ProductId = 1,
        WarehouseId = 1,
        Quantity = quantity,
        Reference = " GR-0001 "
    };

    private static int Stock(AppDbContext db) =>
        db.WarehouseStocks.SingleOrDefault(s => s.ProductId == 1 && s.WarehouseId == 1)?.Quantity ?? 0;

    [Fact]
    public async Task Entrada_CreaElStockYGuardaElMovimiento()
    {
        var (db, controller) = Setup();
        using var _ = db;

        var result = await controller.Create(Request(MovementType.In, 20));

        var created = Assert.IsType<CreatedAtActionResult>(result.Result);
        var dto = Assert.IsType<StockMovementDto>(created.Value);
        Assert.Equal(MovementType.In, dto.Type);
        Assert.Equal("almacen1", dto.Username);
        Assert.Equal("GR-0001", dto.Reference);
        Assert.Equal(20, Stock(db));
    }

    [Fact]
    public async Task Salida_DescuentaDelStock()
    {
        var (db, controller) = Setup();
        using var _ = db;
        await controller.Create(Request(MovementType.In, 20));

        var result = await controller.Create(Request(MovementType.Out, 8));

        Assert.IsType<CreatedAtActionResult>(result.Result);
        Assert.Equal(12, Stock(db));
        Assert.Equal(2, db.StockMovements.Count());
    }

    [Fact]
    public async Task Salida_MayorAlStock_DevuelveConflictYNoCambiaNada()
    {
        var (db, controller) = Setup();
        using var _ = db;
        await controller.Create(Request(MovementType.In, 5));

        var result = await controller.Create(Request(MovementType.Out, 6));

        Assert.IsType<ConflictObjectResult>(result.Result);
        Assert.Equal(5, Stock(db));
        Assert.Single(db.StockMovements);
    }

    [Fact]
    public async Task Salida_SinStockPrevio_DevuelveConflict()
    {
        var (db, controller) = Setup();
        using var _ = db;

        var result = await controller.Create(Request(MovementType.Out, 1));

        Assert.IsType<ConflictObjectResult>(result.Result);
        Assert.Empty(db.WarehouseStocks);
    }

    [Fact]
    public async Task AlmacenInactivo_DevuelveBadRequest()
    {
        var (db, controller) = Setup();
        using var _ = db;
        db.Warehouses.Single().IsActive = false;
        db.SaveChanges();

        var result = await controller.Create(Request(MovementType.In, 3));

        Assert.IsType<BadRequestObjectResult>(result.Result);
    }

    [Fact]
    public async Task GetAll_FiltraPorFechaYAlmacen()
    {
        var (db, controller) = Setup();
        using var _ = db;
        db.Warehouses.Add(new Warehouse { Id = 2, Code = "ALM-02", Name = "Norte" });
        db.StockMovements.AddRange(
            new StockMovement { ProductId = 1, WarehouseId = 1, UserId = 10, Type = MovementType.In, Quantity = 1, Date = new DateTime(2026, 1, 10, 0, 0, 0, DateTimeKind.Utc) },
            new StockMovement { ProductId = 1, WarehouseId = 1, UserId = 10, Type = MovementType.In, Quantity = 2, Date = new DateTime(2026, 2, 10, 0, 0, 0, DateTimeKind.Utc) },
            new StockMovement { ProductId = 1, WarehouseId = 2, UserId = 10, Type = MovementType.In, Quantity = 3, Date = new DateTime(2026, 2, 11, 0, 0, 0, DateTimeKind.Utc) });
        db.SaveChanges();

        var result = await controller.GetAll(
            new DateTimeOffset(2026, 2, 1, 0, 0, 0, TimeSpan.Zero), null, warehouseId: 1, productId: null);

        var row = Assert.Single(result.Value!);
        Assert.Equal(2, row.Quantity);
    }
}
