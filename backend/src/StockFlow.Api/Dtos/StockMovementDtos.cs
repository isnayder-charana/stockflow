using System.ComponentModel.DataAnnotations;
using StockFlow.Api.Entities;

namespace StockFlow.Api.Dtos;

public record StockMovementDto(
    int Id,
    MovementType Type,
    DateTime Date,
    int Quantity,
    int ProductId,
    string Sku,
    string ProductName,
    string Unit,
    int WarehouseId,
    string WarehouseName,
    string? Reference,
    string? Notes,
    string Username,
    string? DocumentUrl);

public class StockMovementCreateRequest
{
    [Required]
    public MovementType? Type { get; set; }

    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    [Range(1, int.MaxValue)]
    public int WarehouseId { get; set; }

    [Range(1, 1_000_000)]
    public int Quantity { get; set; }

    [MaxLength(60)]
    public string? Reference { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }
}
