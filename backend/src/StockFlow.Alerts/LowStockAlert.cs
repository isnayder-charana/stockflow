namespace StockFlow.Alerts;

/// <summary>Lo que devuelve GET /api/alerts/low-stock (mismos nombres que LowStockAlertDto de la API).</summary>
public record LowStockAlert(
    int ProductId,
    string Sku,
    string ProductName,
    string Unit,
    string CategoryName,
    int MinStock,
    int TotalStock,
    int Shortage,
    string? SupplierName,
    string? SupplierPhone,
    string? SupplierEmail,
    IReadOnlyList<LowStockWarehouse> Warehouses);

public record LowStockWarehouse(int WarehouseId, string WarehouseName, bool IsActive, int Quantity);
