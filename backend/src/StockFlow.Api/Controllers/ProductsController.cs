using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockFlow.Api.Data;
using StockFlow.Api.Dtos;
using StockFlow.Api.Entities;
using StockFlow.Api.Services.Storage;

namespace StockFlow.Api.Controllers;

[ApiController]
[Route("api/products")]
[Authorize] // Cualquier rol autenticado puede consultar
public class ProductsController(AppDbContext db, IFileStorage storage) : ControllerBase
{
    private const string CanEdit = Roles.Admin + "," + Roles.Almacenero;

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ProductDto>>> GetAll()
    {
        // Ordenar antes de proyectar: EF Core no traduce un OrderBy sobre el DTO.
        var products = await ProjectToDto(db.Products.AsNoTracking().OrderBy(p => p.Name))
            .ToListAsync();
        return products.Select(WithPhotoUrl).ToList();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ProductDto>> GetById(int id)
    {
        var product = await ProjectToDto(db.Products.AsNoTracking().Where(p => p.Id == id))
            .FirstOrDefaultAsync();
        return product is null ? NotFound() : WithPhotoUrl(product);
    }

    [HttpPost]
    [Authorize(Roles = CanEdit)]
    public async Task<ActionResult<ProductDto>> Create(ProductUpsertRequest request)
    {
        var error = await ValidateAsync(request, null);
        if (error is not null) return error;

        var product = new Product();
        Apply(product, request);
        db.Products.Add(product);
        await db.SaveChangesAsync();

        var dto = await ProjectToDto(db.Products.AsNoTracking().Where(p => p.Id == product.Id)).FirstAsync();
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, WithPhotoUrl(dto));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = CanEdit)]
    public async Task<IActionResult> Update(int id, ProductUpsertRequest request)
    {
        var product = await db.Products.FindAsync(id);
        if (product is null) return NotFound();

        var error = await ValidateAsync(request, id);
        if (error is not null) return error;

        Apply(product, request);
        await db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:int}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<IActionResult> Delete(int id)
    {
        var product = await db.Products.FindAsync(id);
        if (product is null) return NotFound();

        var hasMovements = await db.StockMovements.AnyAsync(m => m.ProductId == id);
        if (hasMovements)
        {
            // Con historial de movimientos no se borra: se desactiva.
            product.IsActive = false;
        }
        else
        {
            db.Products.Remove(product);
        }

        await db.SaveChangesAsync();

        // Si se borró de verdad, su foto ya no se necesita.
        if (!hasMovements && product.PhotoUrl is not null)
            await DeleteFileQuietlyAsync(product.PhotoUrl);

        return NoContent();
    }

    /// <summary>Sube o reemplaza la foto del producto (JPG, PNG o WebP, hasta 4 MB).</summary>
    [HttpPut("{id:int}/photo")]
    [Authorize(Roles = CanEdit)]
    [RequestSizeLimit(FileRules.MaxBytes + 64 * 1024)]
    public async Task<ActionResult<ProductDto>> UploadPhoto(int id, IFormFile? file, CancellationToken ct)
    {
        if (!storage.IsEnabled) return NotFound(new { message = DisabledFileStorage.Message });
        var product = await db.Products.FindAsync([id], ct);
        if (product is null) return NotFound();

        var error = FileRules.Validate(file, FileRules.Images, "JPG, PNG o WebP");
        if (error is not null) return BadRequest(new { message = error });

        var key = FileRules.NewKey("products", id, file!, FileRules.Images);
        await using (var stream = file!.OpenReadStream())
            await storage.SaveAsync(key, stream, file.ContentType, ct);

        var previous = product.PhotoUrl;
        product.PhotoUrl = key;
        await db.SaveChangesAsync(ct);
        if (previous is not null) await DeleteFileQuietlyAsync(previous);

        return await GetById(id);
    }

    [HttpDelete("{id:int}/photo")]
    [Authorize(Roles = CanEdit)]
    public async Task<IActionResult> DeletePhoto(int id)
    {
        var product = await db.Products.FindAsync(id);
        if (product is null) return NotFound();
        if (product.PhotoUrl is null) return NoContent();

        var previous = product.PhotoUrl;
        product.PhotoUrl = null;
        await db.SaveChangesAsync();
        await DeleteFileQuietlyAsync(previous);
        return NoContent();
    }

    // En la base se guarda la clave del archivo; al responder se cambia por una URL que se pueda abrir.
    private ProductDto WithPhotoUrl(ProductDto dto) =>
        dto.PhotoUrl is null ? dto : dto with { PhotoUrl = storage.GetUrl(dto.PhotoUrl) };

    // Si falla el borrado del archivo anterior solo queda un archivo huérfano; no se rompe la operación.
    private async Task DeleteFileQuietlyAsync(string key)
    {
        try { await storage.DeleteAsync(key); }
        catch (Exception) { /* se ignora a propósito */ }
    }

    private async Task<ActionResult?> ValidateAsync(ProductUpsertRequest request, int? currentId)
    {
        if (await db.Products.AnyAsync(p => p.Sku == request.Sku && p.Id != currentId))
            return Conflict(new { message = $"Ya existe un producto con SKU '{request.Sku}'." });

        if (!await db.Categories.AnyAsync(c => c.Id == request.CategoryId))
            return BadRequest(new { message = "La categoría no existe." });

        if (request.SupplierId is not null)
        {
            var supplier = await db.Suppliers.AsNoTracking()
                .Where(s => s.Id == request.SupplierId)
                .Select(s => new { s.IsActive })
                .FirstOrDefaultAsync();
            if (supplier is null)
                return BadRequest(new { message = "El proveedor no existe." });

            // Un producto que ya tenía este proveedor puede conservarlo aunque se haya desactivado.
            var keepsCurrent = currentId is not null &&
                await db.Products.AnyAsync(p => p.Id == currentId && p.SupplierId == request.SupplierId);
            if (!supplier.IsActive && !keepsCurrent)
                return BadRequest(new { message = "El proveedor está inactivo." });
        }

        return null;
    }

    private static void Apply(Product product, ProductUpsertRequest request)
    {
        product.Sku = request.Sku.Trim();
        product.Name = request.Name.Trim();
        product.Description = request.Description;
        product.Unit = request.Unit;
        product.UnitPrice = request.UnitPrice;
        product.MinStock = request.MinStock;
        product.CategoryId = request.CategoryId;
        product.SupplierId = request.SupplierId;
        product.IsActive = request.IsActive;
    }

    private static IQueryable<ProductDto> ProjectToDto(IQueryable<Product> query) =>
        query.Select(p => new ProductDto(
            p.Id,
            p.Sku,
            p.Name,
            p.Description,
            p.Unit,
            p.UnitPrice,
            p.MinStock,
            p.Stocks.Sum(s => (int?)s.Quantity) ?? 0,
            (p.Stocks.Sum(s => (int?)s.Quantity) ?? 0) < p.MinStock,
            p.PhotoUrl,
            p.IsActive,
            p.CategoryId,
            p.Category.Name,
            p.SupplierId,
            p.Supplier != null ? p.Supplier.Name : null,
            p.CreatedAt));
}
