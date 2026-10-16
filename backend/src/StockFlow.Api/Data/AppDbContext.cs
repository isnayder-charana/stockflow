using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using StockFlow.Api.Entities;

namespace StockFlow.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<WarehouseStock> WarehouseStocks => Set<WarehouseStock>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        // Las fechas se guardan en UTC; al leerlas se marcan como UTC para que el JSON lleve la "Z".
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(e =>
        {
            e.Property(u => u.Username).HasMaxLength(50).IsRequired();
            e.HasIndex(u => u.Username).IsUnique();
            e.Property(u => u.FullName).HasMaxLength(120);
            e.Property(u => u.Email).HasMaxLength(120);
            e.Property(u => u.PasswordHash).HasMaxLength(100).IsRequired();
            e.Property(u => u.Role).HasConversion<string>().HasMaxLength(20);
        });

        modelBuilder.Entity<Category>(e =>
        {
            e.Property(c => c.Name).HasMaxLength(80).IsRequired();
            e.HasIndex(c => c.Name).IsUnique();
            e.Property(c => c.Description).HasMaxLength(250);
        });

        modelBuilder.Entity<Supplier>(e =>
        {
            e.Property(s => s.Name).HasMaxLength(150).IsRequired();
            e.Property(s => s.Ruc).HasMaxLength(11).IsRequired();
            e.HasIndex(s => s.Ruc).IsUnique();
            e.Property(s => s.ContactName).HasMaxLength(120);
            e.Property(s => s.Phone).HasMaxLength(20);
            e.Property(s => s.Email).HasMaxLength(120);
            e.Property(s => s.Address).HasMaxLength(250);
        });

        modelBuilder.Entity<Warehouse>(e =>
        {
            e.Property(w => w.Code).HasMaxLength(20).IsRequired();
            e.HasIndex(w => w.Code).IsUnique();
            e.Property(w => w.Name).HasMaxLength(100).IsRequired();
            e.Property(w => w.Location).HasMaxLength(250);
        });

        modelBuilder.Entity<Product>(e =>
        {
            e.Property(p => p.Sku).HasMaxLength(40).IsRequired();
            e.HasIndex(p => p.Sku).IsUnique();
            e.Property(p => p.Name).HasMaxLength(150).IsRequired();
            e.Property(p => p.Description).HasMaxLength(500);
            e.Property(p => p.Unit).HasMaxLength(10);
            e.Property(p => p.UnitPrice).HasPrecision(12, 2);
            e.Property(p => p.PhotoUrl).HasMaxLength(500);

            e.HasOne(p => p.Category)
                .WithMany(c => c.Products)
                .HasForeignKey(p => p.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(p => p.Supplier)
                .WithMany(s => s.Products)
                .HasForeignKey(p => p.SupplierId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<WarehouseStock>(e =>
        {
            e.HasKey(ws => new { ws.ProductId, ws.WarehouseId });
            e.ToTable(t => t.HasCheckConstraint("CK_WarehouseStocks_Quantity", "`Quantity` >= 0"));
            // Concurrencia optimista: si dos usuarios mueven el mismo stock a la vez, el segundo reintenta.
            e.Property(ws => ws.Quantity).IsConcurrencyToken();

            e.HasOne(ws => ws.Product)
                .WithMany(p => p.Stocks)
                .HasForeignKey(ws => ws.ProductId)
                .OnDelete(DeleteBehavior.Cascade);

            e.HasOne(ws => ws.Warehouse)
                .WithMany(w => w.Stocks)
                .HasForeignKey(ws => ws.WarehouseId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<StockMovement>(e =>
        {
            e.ToTable(t => t.HasCheckConstraint("CK_StockMovements_Quantity", "`Quantity` > 0"));
            e.Property(m => m.Type).HasConversion<string>().HasMaxLength(10);
            e.Property(m => m.Reference).HasMaxLength(60);
            e.Property(m => m.Notes).HasMaxLength(500);
            e.Property(m => m.DocumentUrl).HasMaxLength(500);
            e.HasIndex(m => m.Date);

            e.HasOne(m => m.Product)
                .WithMany(p => p.Movements)
                .HasForeignKey(m => m.ProductId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(m => m.Warehouse)
                .WithMany(w => w.Movements)
                .HasForeignKey(m => m.WarehouseId)
                .OnDelete(DeleteBehavior.Restrict);

            e.HasOne(m => m.User)
                .WithMany(u => u.Movements)
                .HasForeignKey(m => m.UserId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Catálogos iniciales (los usuarios se crean en DbSeeder porque el hash de la contraseña cambia en cada ejecución).
        modelBuilder.Entity<Category>().HasData(
            new Category { Id = 1, Name = "Herramientas", Description = "Herramientas manuales y eléctricas" },
            new Category { Id = 2, Name = "EPP", Description = "Equipos de protección personal" },
            new Category { Id = 3, Name = "Repuestos", Description = "Repuestos para maquinaria" });

        modelBuilder.Entity<Warehouse>().HasData(
            new Warehouse { Id = 1, Code = "ALM-01", Name = "Almacén Central", Location = "Planta principal" });
    }
}

internal class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
    v => v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : v,
    v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
