namespace StockFlow.Api.Services.Storage;

/// <summary>
/// Guarda los archivos en una carpeta del proyecto y la API los sirve en /files.
/// Solo para desarrollo: en AWS se usa <see cref="S3FileStorage"/>.
/// </summary>
public class LocalFileStorage(string rootPath) : IFileStorage
{
    public const string RequestPath = "/files";

    public async Task SaveAsync(string key, Stream content, string contentType, CancellationToken ct = default)
    {
        var path = FullPath(key);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        await using var file = File.Create(path);
        await content.CopyToAsync(file, ct);
    }

    public Task DeleteAsync(string key, CancellationToken ct = default)
    {
        File.Delete(FullPath(key));
        return Task.CompletedTask;
    }

    // Relativa a la API: el frontend le antepone VITE_API_URL.
    public string GetUrl(string key) => $"{RequestPath}/{key}";

    private string FullPath(string key)
    {
        var path = Path.GetFullPath(Path.Combine(rootPath, key));
        if (!path.StartsWith(Path.GetFullPath(rootPath), StringComparison.Ordinal))
            throw new ArgumentException("Clave de archivo inválida.", nameof(key));
        return path;
    }
}
