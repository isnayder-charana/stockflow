namespace StockFlow.Api.Entities;

/// <summary>Stock actual de un producto en un almacén (clave compuesta ProductId + WarehouseId).</summary>
public class WarehouseStock
{
    public int ProductId { get; set; }
    public Product Product { get; set; } = null!;

    public int WarehouseId { get; set; }
    public Warehouse Warehouse { get; set; } = null!;

    public int Quantity { get; set; }
}
