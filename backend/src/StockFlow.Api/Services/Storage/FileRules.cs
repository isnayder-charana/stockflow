namespace StockFlow.Api.Services.Storage;

/// <summary>Tipos y tamaño permitidos para los archivos que se suben.</summary>
public static class FileRules
{
    /// <summary>
    /// 4 MB: en AWS el archivo pasa por API Gateway y Lambda, que aceptan hasta 6 MB por petición
    /// (y el cuerpo llega en base64, que ocupa un tercio más).
    /// </summary>
    public const long MaxBytes = 4 * 1024 * 1024;

    public static readonly IReadOnlyDictionary<string, string> Images = new Dictionary<string, string>
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp"
    };

    public static readonly IReadOnlyDictionary<string, string> Documents = new Dictionary<string, string>
    {
        ["application/pdf"] = ".pdf",
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png"
    };

    /// <summary>Devuelve el mensaje de error, o null si el archivo es válido.</summary>
    public static string? Validate(IFormFile? file, IReadOnlyDictionary<string, string> allowed, string allowedText)
    {
        if (file is null || file.Length == 0) return "Elige un archivo.";
        if (file.Length > MaxBytes) return "El archivo supera los 4 MB.";
        if (!allowed.ContainsKey(file.ContentType)) return $"Formato no permitido. Usa {allowedText}.";
        return null;
    }

    /// <summary>Clave única dentro del bucket, por ejemplo products/12/3f2a….jpg.</summary>
    public static string NewKey(string folder, int id, IFormFile file, IReadOnlyDictionary<string, string> allowed) =>
        $"{folder}/{id}/{Guid.NewGuid():N}{allowed[file.ContentType]}";
}
