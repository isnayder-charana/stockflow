namespace StockFlow.Api.Entities;

public enum MovementType
{
    In,
    Out
}

public class StockMovement
{
    public int Id { get; set; }
    public MovementType Type { get; set; }
    public int Quantity { get; set; }
    public DateTime Date { get; set; } = DateTime.UtcNow;
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    /// <summary>Clave del archivo de la guía de remisión (en S3 o en la carpeta local).</summary>
    public string? DocumentUrl { get; set; }

    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    public int WarehouseId { get; set; }
    public Warehouse Warehouse { get; set; } = null!;

    public int UserId { get; set; }
    public User User { get; set; } = null!;
}
