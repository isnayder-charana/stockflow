namespace StockFlow.Alerts;

public record AlertsResult(int LowStockCount, bool EmailSent, string Message);

/// <summary>Consulta los productos bajo el mínimo y, si hay alguno, envía el correo de alerta.</summary>
public class AlertsJob(StockFlowApiClient api, IEmailSender sender, AlertsSettings settings, TimeProvider clock)
{
    public async Task<AlertsResult> RunAsync(CancellationToken ct = default)
    {
        var alerts = await api.GetLowStockAsync(ct);

        if (alerts.Count == 0 && !settings.SendWhenEmpty)
            return new AlertsResult(0, false, "No hay productos bajo el stock mínimo; no se envió correo.");

        var email = AlertEmailBuilder.Build(alerts, clock.GetUtcNow());
        await sender.SendAsync(email, ct);

        var destination = settings.DryRun ? $"guardado en {settings.PreviewPath}" : $"enviado a {string.Join(", ", settings.ToEmails)}";
        return new AlertsResult(alerts.Count, true, $"{email.Subject}: correo {destination}.");
    }
}
