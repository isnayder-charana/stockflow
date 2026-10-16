using System.Net;
using System.Text;

namespace StockFlow.Alerts.Tests;

public class AlertsTests
{
    private static readonly AlertsSettings Settings = new()
    {
        ApiBaseUrl = "https://api.test",
        Username = "alertas",
        Password = "secreto",
        FromEmail = "stock@empresa.pe",
        ToEmails = ["jefe@empresa.pe"]
    };

    private const string LowStockJson = """
        [
          {
            "productId": 1, "sku": "CAS-01", "productName": "Casco <blanco>", "unit": "UND",
            "categoryName": "Seguridad", "minStock": 10, "totalStock": 0, "shortage": 10,
            "supplierId": 3, "supplierName": "Ferretería Industrial SAC",
            "supplierPhone": "987654321", "supplierEmail": "ventas@ferreteria.pe",
            "warehouses": [ { "warehouseId": 1, "warehouseName": "Principal", "isActive": true, "quantity": 0 } ]
          },
          {
            "productId": 2, "sku": "GUA-01", "productName": "Guantes", "unit": "PAR",
            "categoryName": "Seguridad", "minStock": 20, "totalStock": 5, "shortage": 15,
            "supplierId": null, "supplierName": null, "supplierPhone": null, "supplierEmail": null,
            "warehouses": []
          }
        ]
        """;

    private class FakeApi(string lowStockJson) : HttpMessageHandler
    {
        public List<string> Calls { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls.Add($"{request.Method} {request.RequestUri!.AbsolutePath} {request.Headers.Authorization}");
            var body = request.RequestUri.AbsolutePath == "/api/auth/login" ? """{"token":"abc"}""" : lowStockJson;
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            });
        }
    }

    private class FakeSender : IEmailSender
    {
        public List<AlertEmail> Sent { get; } = [];

        public Task SendAsync(AlertEmail email, CancellationToken ct = default)
        {
            Sent.Add(email);
            return Task.CompletedTask;
        }
    }

    private static (AlertsJob Job, FakeApi Api, FakeSender Sender) Setup(string json, AlertsSettings? settings = null)
    {
        settings ??= Settings;
        var api = new FakeApi(json);
        var sender = new FakeSender();
        var job = new AlertsJob(new StockFlowApiClient(new HttpClient(api), settings), sender, settings, TimeProvider.System);
        return (job, api, sender);
    }

    [Fact]
    public async Task ConProductosBajoElMinimo_IniciaSesionYEnviaUnCorreo()
    {
        var (job, api, sender) = Setup(LowStockJson);

        var result = await job.RunAsync();

        Assert.Equal(["POST /api/auth/login ", "GET /api/alerts/low-stock Bearer abc"], api.Calls);
        Assert.True(result.EmailSent);
        Assert.Equal(2, result.LowStockCount);
        var email = Assert.Single(sender.Sent);
        Assert.Equal("StockFlow: 2 productos bajo el stock mínimo (1 agotado)", email.Subject);
    }

    [Fact]
    public async Task SinProductosBajoElMinimo_NoEnviaCorreo()
    {
        var (job, _, sender) = Setup("[]");

        var result = await job.RunAsync();

        Assert.False(result.EmailSent);
        Assert.Empty(sender.Sent);
    }

    [Fact]
    public async Task SinProductosBajoElMinimo_ConSendWhenEmpty_AvisaQueTodoEstaBien()
    {
        var (job, _, sender) = Setup("[]", Settings with { SendWhenEmpty = true });

        await job.RunAsync();

        Assert.Equal("StockFlow: sin productos bajo el stock mínimo", Assert.Single(sender.Sent).Subject);
    }

    [Fact]
    public void Correo_EscapaHtmlYMuestraProveedorYAgotados()
    {
        var alerts = System.Text.Json.JsonSerializer.Deserialize<List<LowStockAlert>>(
            LowStockJson, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web))!;

        var email = AlertEmailBuilder.Build(alerts, new DateTimeOffset(2026, 10, 16, 13, 0, 0, TimeSpan.Zero));

        Assert.Contains("Casco &lt;blanco&gt;", email.Html);
        Assert.DoesNotContain("<blanco>", email.Html);
        Assert.Contains("Agotado", email.Html);
        Assert.Contains("Ferretería Industrial SAC", email.Html);
        Assert.Contains("Sin proveedor", email.Html);
        Assert.Contains("16/10/2026 08:00", email.Text);
        Assert.Contains("- GUA-01 Guantes: 5 PAR (mínimo 20, faltan 15)", email.Text);
    }

    [Fact]
    public async Task LoginRechazado_LanzaErrorClaro()
    {
        var handler = new RejectingApi();
        var job = new AlertsJob(new StockFlowApiClient(new HttpClient(handler), Settings), new FakeSender(), Settings, TimeProvider.System);

        var error = await Assert.ThrowsAsync<InvalidOperationException>(() => job.RunAsync());

        Assert.Contains("alertas", error.Message);
    }

    private class RejectingApi : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.Unauthorized));
    }
}

public class AlertsSettingsTests
{
    [Fact]
    public void ConGmail_ElRemitenteEsLaCuentaDeGmail()
    {
        var vars = new Dictionary<string, string?>
        {
            ["STOCKFLOW_API_URL"] = "https://api.test/",
            ["STOCKFLOW_API_PASSWORD"] = "secreto",
            ["ALERTS_TO"] = "jefe@empresa.pe; almacen@empresa.pe",
            ["ALERTS_SMTP_USER"] = "stockflow@gmail.com",
            ["ALERTS_SMTP_PASSWORD"] = "abcdabcdabcdabcd"
        };
        foreach (var (k, v) in vars) Environment.SetEnvironmentVariable(k, v);
        try
        {
            var settings = AlertsSettings.FromEnvironment();

            Assert.True(settings.UsesSmtp);
            Assert.Equal("stockflow@gmail.com", settings.FromEmail);
            Assert.Equal("smtp.gmail.com", settings.SmtpHost);
            Assert.Equal(587, settings.SmtpPort);
            Assert.True(settings.SmtpSsl);
            Assert.Equal("https://api.test", settings.ApiBaseUrl);
            Assert.Equal(["jefe@empresa.pe", "almacen@empresa.pe"], settings.ToEmails);
        }
        finally
        {
            foreach (var k in vars.Keys) Environment.SetEnvironmentVariable(k, null);
        }
    }
}
