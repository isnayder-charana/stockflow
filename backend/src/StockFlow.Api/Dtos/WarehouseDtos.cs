using System.ComponentModel.DataAnnotations;

namespace StockFlow.Api.Dtos;

public record WarehouseDto(
    int Id,
    string Code,
    string Name,
    string? Location,
    bool IsActive,
    int ProductCount,
    int TotalUnits);

public class WarehouseUpsertRequest
{
    [Required, MaxLength(20)]
    public string Code { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(250)]
    public string? Location { get; set; }

    public bool IsActive { get; set; } = true;
}

/// <summary>Stock de un producto dentro de un almacén.</summary>
public record WarehouseStockDto(
    int ProductId,
    string Sku,
    string ProductName,
    string Unit,
    int Quantity,
    int MinStock);
