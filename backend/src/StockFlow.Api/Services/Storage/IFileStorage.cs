namespace StockFlow.Api.Services.Storage;

/// <summary>
/// Almacenamiento de archivos (fotos de productos y guías de remisión).
/// En la base de datos solo se guarda la clave; la URL para verlo se genera al leer.
/// </summary>
public interface IFileStorage
{
    Task SaveAsync(string key, Stream content, string contentType, CancellationToken ct = default);

    Task DeleteAsync(string key, CancellationToken ct = default);

    /// <summary>URL para mostrar o descargar el archivo. En S3 es una URL firmada que vence.</summary>
    string GetUrl(string key);

    /// <summary>False cuando la subida de archivos está desactivada (Storage:Provider = "None").</summary>
    bool IsEnabled => true;
}
