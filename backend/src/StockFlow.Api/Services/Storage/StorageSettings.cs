namespace StockFlow.Api.Services.Storage;

public class StorageSettings
{
    /// <summary>"Local" (carpeta en disco, para desarrollo), "S3" o "None" (sin subida de archivos).</summary>
    public string Provider { get; set; } = "Local";

    /// <summary>Bucket de S3 cuando Provider es "S3".</summary>
    public string BucketName { get; set; } = string.Empty;

    /// <summary>
    /// Opcional: endpoint de un servicio compatible con S3 (por ejemplo Cloudflare R2).
    /// Vacío = Amazon S3 en la región de AWS_REGION.
    /// </summary>
    public string ServiceUrl { get; set; } = string.Empty;

    /// <summary>Carpeta (relativa al proyecto) donde se guardan los archivos cuando Provider es "Local".</summary>
    public string LocalPath { get; set; } = "uploads";

    /// <summary>Minutos de validez de las URL firmadas de S3.</summary>
    public int UrlExpirationMinutes { get; set; } = 60;
}
