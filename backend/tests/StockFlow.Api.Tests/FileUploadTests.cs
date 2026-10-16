using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using StockFlow.Api.Controllers;
using StockFlow.Api.Dtos;
using StockFlow.Api.Entities;
using StockFlow.Api.Services.Storage;

namespace StockFlow.Api.Tests;

public class FileUploadTests
{
    [Fact]
    public async Task FotoDeProducto_SeGuardaYDevuelveUrl()
    {
        using var db = TestDb.Create();
        db.Products.Add(new Product { Id = 1, Sku = "CAS-01", Name = "Casco", CategoryId = 2 });
        await db.SaveChangesAsync();
        var storage = new FakeFileStorage();
        var controller = new ProductsController(db, storage);

        var result = await controller.UploadPhoto(1, FakeFileStorage.File("casco.jpg", "image/jpeg"), default);

        var key = Assert.Single(storage.Files.Keys);
        Assert.StartsWith("products/1/", key);
        Assert.EndsWith(".jpg", key);
        Assert.Equal(key, db.Products.Single().PhotoUrl);
        Assert.Equal($"https://archivos.test/{key}", result.Value!.PhotoUrl);
    }

    [Fact]
    public async Task FotoDeProducto_AlReemplazarBorraLaAnterior()
    {
        using var db = TestDb.Create();
        db.Products.Add(new Product { Id = 1, Sku = "CAS-01", Name = "Casco", CategoryId = 2 });
        await db.SaveChangesAsync();
        var storage = new FakeFileStorage();
        var controller = new ProductsController(db, storage);

        await controller.UploadPhoto(1, FakeFileStorage.File("a.jpg", "image/jpeg"), default);
        await controller.UploadPhoto(1, FakeFileStorage.File("b.png", "image/png"), default);

        var key = Assert.Single(storage.Files.Keys);
        Assert.EndsWith(".png", key);
    }

    [Theory]
    [InlineData("manual.pdf", "application/pdf", 100)]
    [InlineData("grande.jpg", "image/jpeg", (int)FileRules.MaxBytes + 1)]
    public async Task FotoDeProducto_FormatoOTamanoInvalido_DevuelveBadRequest(string name, string type, int size)
    {
        using var db = TestDb.Create();
        db.Products.Add(new Product { Id = 1, Sku = "CAS-01", Name = "Casco", CategoryId = 2 });
        await db.SaveChangesAsync();
        var storage = new FakeFileStorage();

        var result = await new ProductsController(db, storage).UploadPhoto(1, FakeFileStorage.File(name, type, size), default);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        Assert.Empty(storage.Files);
    }

    [Fact]
    public async Task GuiaDeRemision_SeAdjuntaUnaSolaVez()
    {
        using var db = TestDb.Create();
        var user = new User { Id = 10, Username = "almacen1", PasswordHash = "x", Role = UserRole.Almacenero };
        var product = new Product { Id = 1, Sku = "TAL-001", Name = "Taladro", CategoryId = 1 };
        db.AddRange(user, product);
        db.StockMovements.Add(new StockMovement
        {
            Id = 5, Product = product, WarehouseId = 1, User = user, Type = MovementType.In, Quantity = 10
        });
        await db.SaveChangesAsync();
        var storage = new FakeFileStorage();
        var controller = new StockMovementsController(db, storage);

        var first = await controller.UploadDocument(5, FakeFileStorage.File("guia.pdf", "application/pdf"), default);
        var second = await controller.UploadDocument(5, FakeFileStorage.File("otra.pdf", "application/pdf"), default);

        var key = Assert.Single(storage.Files.Keys);
        Assert.StartsWith("movements/5/", key);
        Assert.Equal($"https://archivos.test/{key}", first.Value!.DocumentUrl);
        Assert.IsType<ConflictObjectResult>(second.Result);
    }

    [Fact]
    public async Task SubidaDesactivada_Responde404SinTocarElProducto()
    {
        using var db = TestDb.Create();
        db.Products.Add(new Product { Id = 1, Sku = "CAS-01", Name = "Casco", CategoryId = 2 });
        await db.SaveChangesAsync();
        var controller = new ProductsController(db, new DisabledFileStorage());

        var result = await controller.UploadPhoto(1, FakeFileStorage.File("casco.jpg", "image/jpeg"), default);

        Assert.IsType<NotFoundObjectResult>(result.Result);
        Assert.Null(db.Products.Single().PhotoUrl);
    }
}
