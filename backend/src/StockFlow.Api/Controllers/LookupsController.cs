using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockFlow.Api.Data;
using StockFlow.Api.Dtos;

namespace StockFlow.Api.Controllers;

/// <summary>Listas cortas para combos del frontend.</summary>
[ApiController]
[Route("api/lookups")]
[Authorize]
public class LookupsController(AppDbContext db) : ControllerBase
{
    [HttpGet("categories")]
    public async Task<IEnumerable<LookupDto>> Categories() =>
        await db.Categories.AsNoTracking().OrderBy(c => c.Name)
            .Select(c => new LookupDto(c.Id, c.Name)).ToListAsync();

    /// <summary>Todos los proveedores con su estado: el formulario de productos solo ofrece los activos.</summary>
    [HttpGet("suppliers")]
    public async Task<IEnumerable<SupplierLookupDto>> Suppliers() =>
        await db.Suppliers.AsNoTracking().OrderBy(s => s.Name)
            .Select(s => new SupplierLookupDto(s.Id, s.Name, s.IsActive)).ToListAsync();

    [HttpGet("warehouses")]
    public async Task<IEnumerable<LookupDto>> Warehouses() =>
        await db.Warehouses.AsNoTracking().Where(w => w.IsActive).OrderBy(w => w.Name)
            .Select(w => new LookupDto(w.Id, w.Name)).ToListAsync();
}
