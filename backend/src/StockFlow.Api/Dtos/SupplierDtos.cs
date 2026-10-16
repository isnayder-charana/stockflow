using System.ComponentModel.DataAnnotations;

namespace StockFlow.Api.Dtos;

public record SupplierDto(
    int Id,
    string Name,
    string Ruc,
    string? ContactName,
    string? Phone,
    string? Email,
    string? Address,
    bool IsActive,
    int ProductCount);

public class SupplierUpsertRequest
{
    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [Required, RegularExpression(@"^\d{11}$", ErrorMessage = "El RUC debe tener 11 dígitos.")]
    public string Ruc { get; set; } = string.Empty;

    [MaxLength(120)]
    public string? ContactName { get; set; }

    [MaxLength(20)]
    public string? Phone { get; set; }

    [MaxLength(120), EmailAddress(ErrorMessage = "El correo no es válido.")]
    public string? Email { get; set; }

    [MaxLength(250)]
    public string? Address { get; set; }

    public bool IsActive { get; set; } = true;
}

/// <summary>Producto que se compra a un proveedor.</summary>
public record SupplierProductDto(
    int Id,
    string Sku,
    string Name,
    string Unit,
    decimal UnitPrice,
    int TotalStock,
    bool IsActive);

/// <summary>Proveedor para combos: incluye los inactivos para poder mostrar el de productos antiguos.</summary>
public record SupplierLookupDto(int Id, string Name, bool IsActive);
