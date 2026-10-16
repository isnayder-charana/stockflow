namespace StockFlow.Api.Services.Storage;

/// <summary>
/// Subida de archivos desactivada (Storage:Provider = "None"), para desplegar sin bucket.
/// Los endpoints de subida responden 404 y el resto de la API funciona igual.
/// </summary>
public class DisabledFileStorage : IFileStorage
{
    public const string Message = "La subida de archivos está desactivada en este servidor.";

    public bool IsEnabled => false;

    public Task SaveAsync(string key, Stream content, string contentType, CancellationToken ct = default) =>
        throw new InvalidOperationException(Message);

    public Task DeleteAsync(string key, CancellationToken ct = default) => Task.CompletedTask;

    public string GetUrl(string key) => key;
}
