using Microsoft.AspNetCore.Http;
using StockFlow.Api.Services.Storage;

namespace StockFlow.Api.Tests;

/// <summary>Almacenamiento en memoria para las pruebas.</summary>
internal class FakeFileStorage : IFileStorage
{
    public Dictionary<string, (byte[] Content, string ContentType)> Files { get; } = new();

    public async Task SaveAsync(string key, Stream content, string contentType, CancellationToken ct = default)
    {
        using var memory = new MemoryStream();
        await content.CopyToAsync(memory, ct);
        Files[key] = (memory.ToArray(), contentType);
    }

    public Task DeleteAsync(string key, CancellationToken ct = default)
    {
        Files.Remove(key);
        return Task.CompletedTask;
    }

    public string GetUrl(string key) => $"https://archivos.test/{key}";

    public static IFormFile File(string fileName, string contentType, int size = 100)
    {
        var bytes = new byte[size];
        return new FormFile(new MemoryStream(bytes), 0, size, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }
}
