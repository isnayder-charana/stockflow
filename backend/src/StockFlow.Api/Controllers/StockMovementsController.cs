using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockFlow.Api.Data;
using StockFlow.Api.Dtos;
using StockFlow.Api.Entities;
using StockFlow.Api.Services.Storage;

namespace StockFlow.Api.Controllers;

[ApiController]
[Route("api/movements")]
[Authorize] // Cualquier rol autenticado puede consultar
public class StockMovementsController(AppDbContext db, IFileStorage storage) : ControllerBase
{
    private const string CanRegister = Roles.Admin + "," + Roles.Almacenero;
    private const int MaxRetries = 5;

    /// <summary>Movimientos más recientes primero. <paramref name="to"/> es exclusivo.</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<StockMovementDto>>> GetAll(
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] int? warehouseId,
        [FromQuery] int? productId)
    {
        var query = db.StockMovements.AsNoTracking();
        if (from is not null) query = query.Where(m => m.Date >= from.Value.UtcDateTime);
        if (to is not null) query = query.Where(m => m.Date < to.Value.UtcDateTime);
        if (warehouseId is not null) query = query.Where(m => m.WarehouseId == warehouseId);
        if (productId is not null) query = query.Where(m => m.ProductId == productId);

        var movements = await ProjectToDto(query.OrderByDescending(m => m.Date).ThenByDescending(m => m.Id))
            .ToListAsync();
        return movements.Select(WithDocumentUrl).ToList();
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<StockMovementDto>> GetById(int id)
    {
        var movement = await ProjectToDto(db.StockMovements.AsNoTracking().Where(m => m.Id == id))
            .FirstOrDefaultAsync();
        return movement is null ? NotFound() : WithDocumentUrl(movement);
    }

    /// <summary>Registra una entrada o salida y actualiza el stock del almacén en la misma operación.</summary>
    [HttpPost]
    [Authorize(Roles = CanRegister)]
    public async Task<ActionResult<StockMovementDto>> Create(StockMovementCreateRequest request)
    {
        if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            return Unauthorized();

        var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == request.ProductId);
        if (product is null) return BadRequest(new { message = "El producto no existe." });
        if (!product.IsActive) return BadRequest(new { message = "El producto está inactivo." });

        var warehouse = await db.Warehouses.AsNoTracking().FirstOrDefaultAsync(w => w.Id == request.WarehouseId);
        if (warehouse is null) return BadRequest(new { message = "El almacén no existe." });
        if (!warehouse.IsActive) return BadRequest(new { message = "El almacén está inactivo." });

        var type = request.Type!.Value;
        if (!Enum.IsDefined(type)) return BadRequest(new { message = "Tipo de movimiento inválido." });

        for (var attempt = 1; attempt <= MaxRetries; attempt++)
        {
            var stock = await db.WarehouseStocks.FirstOrDefaultAsync(s =>
                s.ProductId == request.ProductId && s.WarehouseId == request.WarehouseId);
            var available = stock?.Quantity ?? 0;
            var newQuantity = type == MovementType.In ? available + request.Quantity : available - request.Quantity;

            if (newQuantity < 0)
                return Conflict(new
                {
                    message = $"Stock insuficiente en {warehouse.Name}: hay {available} {product.Unit} de {product.Name} y se intentó sacar {request.Quantity}.",
                    available
                });

            if (stock is null)
                db.WarehouseStocks.Add(new WarehouseStock
                {
                    ProductId = request.ProductId, WarehouseId = request.WarehouseId, Quantity = newQuantity
                });
            else
                stock.Quantity = newQuantity;

            var movement = new StockMovement
            {
                Type = type,
                Quantity = request.Quantity,
                Date = DateTime.UtcNow,
                Reference = Clean(request.Reference),
                Notes = Clean(request.Notes),
                ProductId = request.ProductId,
                WarehouseId = request.WarehouseId,
                UserId = userId
            };
            db.StockMovements.Add(movement);

            try
            {
                // Un solo SaveChanges: el movimiento y el stock se guardan juntos o no se guarda nada.
                await db.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                // Otro usuario cambió el mismo stock al mismo tiempo: se vuelve a leer y se reintenta.
                db.ChangeTracker.Clear();
                continue;
            }
            catch (DbUpdateException) when (stock is null)
            {
                // Otro usuario creó la fila de stock al mismo tiempo: se reintenta como actualización.
                db.ChangeTracker.Clear();
                continue;
            }

            var dto = await ProjectToDto(db.StockMovements.AsNoTracking().Where(m => m.Id == movement.Id)).FirstAsync();
            return CreatedAtAction(nameof(GetById), new { id = movement.Id }, WithDocumentUrl(dto));
        }

        return Conflict(new { message = "El stock cambió mientras se registraba el movimiento. Inténtalo de nuevo." });
    }

    /// <summary>
    /// Adjunta la guía de remisión (PDF, JPG o PNG, hasta 4 MB). Como el movimiento no se edita,
    /// la guía tampoco se reemplaza: si ya tiene una, devuelve 409.
    /// </summary>
    [HttpPost("{id:int}/document")]
    [Authorize(Roles = CanRegister)]
    [RequestSizeLimit(FileRules.MaxBytes + 64 * 1024)]
    public async Task<ActionResult<StockMovementDto>> UploadDocument(int id, IFormFile? file, CancellationToken ct)
    {
        if (!storage.IsEnabled) return NotFound(new { message = DisabledFileStorage.Message });
        var movement = await db.StockMovements.FindAsync([id], ct);
        if (movement is null) return NotFound();
        if (movement.DocumentUrl is not null)
            return Conflict(new { message = "Este movimiento ya tiene una guía adjunta." });

        var error = FileRules.Validate(file, FileRules.Documents, "PDF, JPG o PNG");
        if (error is not null) return BadRequest(new { message = error });

        var key = FileRules.NewKey("movements", id, file!, FileRules.Documents);
        await using (var stream = file!.OpenReadStream())
            await storage.SaveAsync(key, stream, file.ContentType, ct);

        movement.DocumentUrl = key;
        await db.SaveChangesAsync(ct);
        return await GetById(id);
    }

    // En la base se guarda la clave del archivo; al responder se cambia por una URL que se pueda abrir.
    private StockMovementDto WithDocumentUrl(StockMovementDto dto) =>
        dto.DocumentUrl is null ? dto : dto with { DocumentUrl = storage.GetUrl(dto.DocumentUrl) };

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static IQueryable<StockMovementDto> ProjectToDto(IQueryable<StockMovement> query) =>
        query.Select(m => new StockMovementDto(
            m.Id,
            m.Type,
            m.Date,
            m.Quantity,
            m.ProductId,
            m.Product.Sku,
            m.Product.Name,
            m.Product.Unit,
            m.WarehouseId,
            m.Warehouse.Name,
            m.Reference,
            m.Notes,
            m.User.Username,
            m.DocumentUrl));
}
