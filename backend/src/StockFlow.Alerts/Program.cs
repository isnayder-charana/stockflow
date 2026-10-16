using Amazon.Lambda.Core;
using Amazon.Lambda.RuntimeSupport;
using Amazon.Lambda.Serialization.SystemTextJson;
using Amazon.SimpleEmailV2;
using StockFlow.Alerts;

// Microservicio de alertas de stock mínimo.
// Lo ejecuta GitHub Actions una vez al día (o una Lambda en AWS) y envía el correo por Gmail (SMTP).
// En tu PC, `dotnet run` lo ejecuta una vez contra la API local y guarda el correo en alerts-preview.html.

var settings = AlertsSettings.FromEnvironment();
// Holgado: en hosting gratuito la API puede estar dormida y tardar un minuto en despertar.
using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(3) };
IEmailSender sender =
    settings.DryRun ? new PreviewEmailSender(settings.PreviewPath)
    : settings.UsesSmtp ? new SmtpEmailSender(settings)
    : new SesEmailSender(new AmazonSimpleEmailServiceV2Client(), settings);
var job = new AlertsJob(new StockFlowApiClient(http, settings), sender, settings, TimeProvider.System);

if (Environment.GetEnvironmentVariable("AWS_LAMBDA_FUNCTION_NAME") is not null)
{
    // El evento del programador no trae datos útiles: se ignora.
    Func<Stream, ILambdaContext, Task<AlertsResult>> handler = async (_, context) =>
    {
        var result = await job.RunAsync();
        context.Logger.LogInformation(result.Message);
        return result;
    };
    await LambdaBootstrapBuilder.Create(handler, new DefaultLambdaJsonSerializer())
        .Build()
        .RunAsync();
}
else
{
    var result = await job.RunAsync();
    Console.WriteLine(result.Message);
}
