using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockFlow.Api.Data;
using StockFlow.Api.Dtos;
using StockFlow.Api.Entities;

namespace StockFlow.Api.Controllers;

[ApiController]
[Route("api/warehouses")]
[Authorize] // Cualquier rol autenticado puede consultar
public class WarehousesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<WarehouseDto>>> GetAll()
    {
        var warehouses = await ProjectToDto(db.Warehouses.AsNoTracking().OrderBy(w => w.Code))
            .ToListAsync();
        return warehouses;
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<WarehouseDto>> GetById(int id)
    {
        var warehouse = await ProjectToDto(db.Warehouses.AsNoTracking().Where(w => w.Id == id))
            .FirstOrDefaultAsync();
        return warehouse is null ? NotFound() : warehouse;
    }

    /// <summary>Stock actual de cada producto en el almacén.</summary>
    [HttpGet("{id:int}/stock")]
    public async Task<ActionResult<IEnumerable<WarehouseStockDto>>> GetStock(int id)
    {
        if (!await db.Warehouses.AnyAsync(w => w.Id == id)) return NotFound();

        var stock = await db.WarehouseStocks.AsNoTracking()
            .Where(s => s.WarehouseId == id)
            .OrderBy(s => s.Product.Name)
            .Select(s => new WarehouseStockDto(
                s.ProductId, s.Product.Sku, s.Product.Name, s.Product.Unit, s.Quantity, s.Product.MinStock))
            .ToListAsync();
        return stock;
    }

    [HttpPost]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<WarehouseDto>> Create(WarehouseUpsertRequest request)
    {
        var error = await ValidateAsync(request, null);
        if (error is not null) return error;

        var warehouse = new Warehouse();
        Apply(warehouse, request);
        db.Warehouses.Add(warehouse);
        await db.SaveChangesAsync();

        var dto = await ProjectToDto(db.Warehouses.AsNoTracking().Where(w => w.Id == warehouse.Id)).FirstAsync();
        return CreatedAtAction(nameof(GetById), new { id = warehouse.Id }, dto);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Update(int id, WarehouseUpsertRequest request)
    {
        var warehouse = await db.Warehouses.FindAsync(id);
        if (warehouse is null) return NotFound();

        var error = await ValidateAsync(request, id);
        if (error is not null) return error;

        if (warehouse.IsActive && !request.IsActive && await HasStockAsync(id))
            return Conflict(new { message = "No se puede desactivar un almacén que todavía tiene stock." });

        Apply(warehouse, request);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Delete(int id)
    {
        var warehouse = await db.Warehouses.FindAsync(id);
        if (warehouse is null) return NotFound();

        if (await HasStockAsync(id))
            return Conflict(new { message = "No se puede eliminar un almacén que todavía tiene stock. Registra las salidas primero." });

        if (await db.StockMovements.AnyAsync(m => m.WarehouseId == id))
        {
            // Con historial de movimientos no se borra: se desactiva.
            warehouse.IsActive = false;
        }
        else
        {
            db.WarehouseStocks.RemoveRange(db.WarehouseStocks.Where(s => s.WarehouseId == id));
            db.Warehouses.Remove(warehouse);
        }

        await db.SaveChangesAsync();
        return NoContent();
    }

    private Task<bool> HasStockAsync(int warehouseId) =>
        db.WarehouseStocks.AnyAsync(s => s.WarehouseId == warehouseId && s.Quantity > 0);

    private async Task<ActionResult?> ValidateAsync(WarehouseUpsertRequest request, int? currentId)
    {
        var code = request.Code.Trim();
        if (await db.Warehouses.AnyAsync(w => w.Code == code && w.Id != currentId))
            return Conflict(new { message = $"Ya existe un almacén con código '{code}'." });
        return null;
    }

    private static void Apply(Warehouse warehouse, WarehouseUpsertRequest request)
    {
        warehouse.Code = request.Code.Trim().ToUpperInvariant();
        warehouse.Name = request.Name.Trim();
        warehouse.Location = string.IsNullOrWhiteSpace(request.Location) ? null : request.Location.Trim();
        warehouse.IsActive = request.IsActive;
    }

    private static IQueryable<WarehouseDto> ProjectToDto(IQueryable<Warehouse> query) =>
        query.Select(w => new WarehouseDto(
            w.Id,
            w.Code,
            w.Name,
            w.Location,
            w.IsActive,
            w.Stocks.Count(s => s.Quantity > 0),
            w.Stocks.Sum(s => (int?)s.Quantity) ?? 0));
}
