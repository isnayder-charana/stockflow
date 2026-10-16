using Microsoft.EntityFrameworkCore;
using StockFlow.Api.Data;

namespace StockFlow.Api.Tests;

internal static class TestDb
{
    /// <summary>Contexto en memoria con los datos semilla (categorías y almacén).</summary>
    public static AppDbContext Create()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        var db = new AppDbContext(options);
        db.Database.EnsureCreated();
        return db;
    }
}
