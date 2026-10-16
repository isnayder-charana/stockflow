namespace StockFlow.Api.Entities;

public class Product
{
    public int Id { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Unit { get; set; } = "UND";
    public decimal UnitPrice { get; set; }
    public int MinStock { get; set; }
    /// <summary>Clave del archivo de la foto (en S3 o en la carpeta local), no una URL pública.</summary>
    public string? PhotoUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public int CategoryId { get; set; }
    public Category Category { get; set; } = null!;

    public int? SupplierId { get; set; }
    public Supplier? Supplier { get; set; }

    public ICollection<WarehouseStock> Stocks { get; set; } = new List<WarehouseStock>();
    public ICollection<StockMovement> Movements { get; set; } = new List<StockMovement>();
}
