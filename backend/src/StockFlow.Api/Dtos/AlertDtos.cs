namespace StockFlow.Api.Dtos;

/// <summary>Producto activo cuyo stock total está por debajo de su stock mínimo.</summary>
public record LowStockAlertDto(
    int ProductId,
    string Sku,
    string ProductName,
    string Unit,
    string CategoryName,
    int MinStock,
    int TotalStock,
    int Shortage,
    int? SupplierId,
    string? SupplierName,
    string? SupplierPhone,
    string? SupplierEmail,
    IReadOnlyList<LowStockWarehouseDto> Warehouses);

/// <summary>Stock del producto en un almacén.</summary>
public record LowStockWarehouseDto(int WarehouseId, string WarehouseName, bool IsActive, int Quantity);

public record AlertCountDto(int Count);
