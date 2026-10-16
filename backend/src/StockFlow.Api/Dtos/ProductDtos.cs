using System.ComponentModel.DataAnnotations;

namespace StockFlow.Api.Dtos;

public record ProductDto(
    int Id,
    string Sku,
    string Name,
    string? Description,
    string Unit,
    decimal UnitPrice,
    int MinStock,
    int TotalStock,
    bool BelowMinStock,
    string? PhotoUrl,
    bool IsActive,
    int CategoryId,
    string CategoryName,
    int? SupplierId,
    string? SupplierName,
    DateTime CreatedAt);

public class ProductUpsertRequest
{
    [Required, MaxLength(40)]
    public string Sku { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [Required, MaxLength(10)]
    public string Unit { get; set; } = "UND";

    [Range(0, 999999999)]
    public decimal UnitPrice { get; set; }

    [Range(0, int.MaxValue)]
    public int MinStock { get; set; }

    [Range(1, int.MaxValue)]
    public int CategoryId { get; set; }

    public int? SupplierId { get; set; }

    public bool IsActive { get; set; } = true;
}
