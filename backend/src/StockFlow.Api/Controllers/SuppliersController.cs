using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockFlow.Api.Data;
using StockFlow.Api.Dtos;
using StockFlow.Api.Entities;

namespace StockFlow.Api.Controllers;

[ApiController]
[Route("api/suppliers")]
[Authorize] // Cualquier rol autenticado puede consultar
public class SuppliersController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IEnumerable<SupplierDto>>> GetAll()
    {
        var suppliers = await ProjectToDto(db.Suppliers.AsNoTracking().OrderBy(s => s.Name))
            .ToListAsync();
        return suppliers;
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<SupplierDto>> GetById(int id)
    {
        var supplier = await ProjectToDto(db.Suppliers.AsNoTracking().Where(s => s.Id == id))
            .FirstOrDefaultAsync();
        return supplier is null ? NotFound() : supplier;
    }

    /// <summary>Productos asociados al proveedor.</summary>
    [HttpGet("{id:int}/products")]
    public async Task<ActionResult<IEnumerable<SupplierProductDto>>> GetProducts(int id)
    {
        if (!await db.Suppliers.AnyAsync(s => s.Id == id)) return NotFound();

        var products = await db.Products.AsNoTracking()
            .Where(p => p.SupplierId == id)
            .OrderBy(p => p.Name)
            .Select(p => new SupplierProductDto(
                p.Id, p.Sku, p.Name, p.Unit, p.UnitPrice,
                p.Stocks.Sum(s => (int?)s.Quantity) ?? 0,
                p.IsActive))
            .ToListAsync();
        return products;
    }

    [HttpPost]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<SupplierDto>> Create(SupplierUpsertRequest request)
    {
        var error = await ValidateAsync(request, null);
        if (error is not null) return error;

        var supplier = new Supplier();
        Apply(supplier, request);
        db.Suppliers.Add(supplier);
        await db.SaveChangesAsync();

        var dto = await ProjectToDto(db.Suppliers.AsNoTracking().Where(s => s.Id == supplier.Id)).FirstAsync();
        return CreatedAtAction(nameof(GetById), new { id = supplier.Id }, dto);
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Update(int id, SupplierUpsertRequest request)
    {
        var supplier = await db.Suppliers.FindAsync(id);
        if (supplier is null) return NotFound();

        var error = await ValidateAsync(request, id);
        if (error is not null) return error;

        Apply(supplier, request);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Delete(int id)
    {
        var supplier = await db.Suppliers.FindAsync(id);
        if (supplier is null) return NotFound();

        if (await db.Products.AnyAsync(p => p.SupplierId == id))
        {
            // Con productos asociados no se borra: se desactiva y los productos lo conservan.
            supplier.IsActive = false;
        }
        else
        {
            db.Suppliers.Remove(supplier);
        }

        await db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<ActionResult?> ValidateAsync(SupplierUpsertRequest request, int? currentId)
    {
        var ruc = request.Ruc.Trim();
        if (await db.Suppliers.AnyAsync(s => s.Ruc == ruc && s.Id != currentId))
            return Conflict(new { message = $"Ya existe un proveedor con RUC '{ruc}'." });
        return null;
    }

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static void Apply(Supplier supplier, SupplierUpsertRequest request)
    {
        supplier.Name = request.Name.Trim();
        supplier.Ruc = request.Ruc.Trim();
        supplier.ContactName = Clean(request.ContactName);
        supplier.Phone = Clean(request.Phone);
        supplier.Email = Clean(request.Email)?.ToLowerInvariant();
        supplier.Address = Clean(request.Address);
        supplier.IsActive = request.IsActive;
    }

    private static IQueryable<SupplierDto> ProjectToDto(IQueryable<Supplier> query) =>
        query.Select(s => new SupplierDto(
            s.Id,
            s.Name,
            s.Ruc,
            s.ContactName,
            s.Phone,
            s.Email,
            s.Address,
            s.IsActive,
            s.Products.Count()));
}
