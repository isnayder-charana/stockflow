using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace StockFlow.Alerts;

/// <summary>Cliente de la API de StockFlow: inicia sesión y consulta las alertas de stock.</summary>
public class StockFlowApiClient(HttpClient http, AlertsSettings settings)
{
    private record LoginResponse(string Token);

    public async Task<IReadOnlyList<LowStockAlert>> GetLowStockAsync(CancellationToken ct = default)
    {
        // Cuerpo con tamaño conocido (sin chunked), como lo espera API Gateway.
        var credentials = JsonSerializer.Serialize(new { username = settings.Username, password = settings.Password });
        using var login = await http.PostAsync(
            $"{settings.ApiBaseUrl}/api/auth/login",
            new StringContent(credentials, Encoding.UTF8, "application/json"),
            ct);
        if (!login.IsSuccessStatusCode)
            throw new InvalidOperationException(
                $"No se pudo iniciar sesión en la API como '{settings.Username}' (HTTP {(int)login.StatusCode}).");
        var token = (await login.Content.ReadFromJsonAsync<LoginResponse>(ct))!.Token;

        using var request = new HttpRequestMessage(HttpMethod.Get, $"{settings.ApiBaseUrl}/api/alerts/low-stock");
        request.Headers.Authorization = new("Bearer", token);
        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"La API respondió HTTP {(int)response.StatusCode} al pedir las alertas.");

        return await response.Content.ReadFromJsonAsync<List<LowStockAlert>>(ct) ?? [];
    }
}
