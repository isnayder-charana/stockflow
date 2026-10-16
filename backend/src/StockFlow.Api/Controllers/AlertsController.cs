using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockFlow.Api.Data;
using StockFlow.Api.Dtos;
using StockFlow.Api.Entities;

namespace StockFlow.Api.Controllers;

/// <summary>Alertas en pantalla de productos bajo el stock mínimo. Visibles para todos los roles.</summary>
[ApiController]
[Route("api/alerts")]
[Authorize]
public class AlertsController(AppDbContext db) : ControllerBase
{
    /// <summary>Productos bajo el mínimo: primero los agotados, luego los de mayor faltante.</summary>
    [HttpGet("low-stock")]
    public async Task<ActionResult<IEnumerable<LowStockAlertDto>>> LowStock()
    {
        var rows = await LowStockProducts()
            .Select(p => new
            {
                p.Id,
                p.Sku,
                p.Name,
                p.Unit,
                CategoryName = p.Category.Name,
                p.MinStock,
                TotalStock = p.Stocks.Sum(s => (int?)s.Quantity) ?? 0,
                p.SupplierId,
                SupplierName = p.Supplier != null ? p.Supplier.Name : null,
                SupplierPhone = p.Supplier != null ? p.Supplier.Phone : null,
                SupplierEmail = p.Supplier != null ? p.Supplier.Email : null,
                Warehouses = p.Stocks
                    .Select(s => new LowStockWarehouseDto(s.WarehouseId, s.Warehouse.Name, s.Warehouse.IsActive, s.Quantity))
                    .ToList()
            })
            .ToListAsync();

        var alerts = rows
            .Select(r => new LowStockAlertDto(
                r.Id, r.Sku, r.Name, r.Unit, r.CategoryName, r.MinStock, r.TotalStock,
                r.MinStock - r.TotalStock,
                r.SupplierId, r.SupplierName, r.SupplierPhone, r.SupplierEmail,
                r.Warehouses.OrderBy(w => w.WarehouseName).ToList()))
            .OrderBy(a => a.TotalStock > 0)
            .ThenByDescending(a => a.Shortage)
            .ThenBy(a => a.ProductName)
            .ToList();

        return alerts;
    }

    /// <summary>Solo la cantidad, para el indicador de la barra de navegación.</summary>
    [HttpGet("low-stock/count")]
    public async Task<AlertCountDto> LowStockCount() => new(await LowStockProducts().CountAsync());

    // Mismo criterio que ProductDto.BelowMinStock, solo para productos activos.
    private IQueryable<Product> LowStockProducts() =>
        db.Products.AsNoTracking()
            .Where(p => p.IsActive && (p.Stocks.Sum(s => (int?)s.Quantity) ?? 0) < p.MinStock);
}
