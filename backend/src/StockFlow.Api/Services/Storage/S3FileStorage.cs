using Amazon.S3;
using Amazon.S3.Model;

namespace StockFlow.Api.Services.Storage;

/// <summary>Archivos en un bucket privado de S3; se leen con URL firmadas que vencen.</summary>
public class S3FileStorage(IAmazonS3 s3, StorageSettings settings) : IFileStorage
{
    public async Task SaveAsync(string key, Stream content, string contentType, CancellationToken ct = default)
    {
        await s3.PutObjectAsync(new PutObjectRequest
        {
            BucketName = settings.BucketName,
            Key = key,
            InputStream = content,
            ContentType = contentType
        }, ct);
    }

    public async Task DeleteAsync(string key, CancellationToken ct = default)
    {
        await s3.DeleteObjectAsync(settings.BucketName, key, ct);
    }

    public string GetUrl(string key) =>
        s3.GetPreSignedURL(new GetPreSignedUrlRequest
        {
            BucketName = settings.BucketName,
            Key = key,
            Verb = HttpVerb.GET,
            Expires = DateTime.UtcNow.AddMinutes(settings.UrlExpirationMinutes)
        });
}
