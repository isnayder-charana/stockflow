using System.Globalization;
using System.Text;

namespace StockFlow.Alerts;

public record AlertEmail(string Subject, string Html, string Text);

/// <summary>Arma el correo con la lista de productos bajo el stock mínimo.</summary>
public static class AlertEmailBuilder
{
    private static readonly CultureInfo Peru = CultureInfo.GetCultureInfo("es-PE");

    public static AlertEmail Build(IReadOnlyList<LowStockAlert> alerts, DateTimeOffset now)
    {
        var date = ToLima(now).ToString("dd/MM/yyyy HH:mm", Peru);

        if (alerts.Count == 0)
        {
            const string ok = "Todos los productos activos están en su stock mínimo o por encima.";
            return new AlertEmail(
                "StockFlow: sin productos bajo el stock mínimo",
                Wrap($"<p>{ok}</p>", date),
                $"{ok}\n\nRevisado el {date}.");
        }

        var outOfStock = alerts.Count(a => a.TotalStock == 0);
        var subject = alerts.Count == 1
            ? "StockFlow: 1 producto bajo el stock mínimo"
            : $"StockFlow: {alerts.Count} productos bajo el stock mínimo";
        if (outOfStock > 0) subject += $" ({outOfStock} agotado{(outOfStock == 1 ? "" : "s")})";

        var html = new StringBuilder();
        html.Append("<p>Estos productos están por debajo de su stock mínimo:</p>");
        html.Append("<table cellpadding=\"6\" cellspacing=\"0\" style=\"border-collapse:collapse;font-size:14px\">");
        html.Append("<tr style=\"background:#f1f3f5;text-align:left\">");
        foreach (var h in new[] { "SKU", "Producto", "Stock", "Mínimo", "Faltan", "Por almacén", "Proveedor" })
            html.Append($"<th style=\"border-bottom:1px solid #ccc\">{h}</th>");
        html.Append("</tr>");

        var text = new StringBuilder("Estos productos están por debajo de su stock mínimo:\n\n");

        foreach (var a in alerts)
        {
            var rowStyle = a.TotalStock == 0 ? " style=\"background:#fdecea\"" : "";
            var stock = a.TotalStock == 0 ? "<strong>Agotado</strong>" : $"{a.TotalStock} {E(a.Unit)}";
            var warehouses = string.Join("<br>", a.Warehouses.Select(w =>
                $"{E(w.WarehouseName)}{(w.IsActive ? "" : " (inactivo)")}: {w.Quantity}"));
            var contact = string.Join(" · ", new[] { a.SupplierPhone, a.SupplierEmail }.Where(x => !string.IsNullOrWhiteSpace(x)));
            var supplier = a.SupplierName is null
                ? "<span style=\"color:#888\">Sin proveedor</span>"
                : $"{E(a.SupplierName)}{(contact.Length > 0 ? $"<br><small>{E(contact)}</small>" : "")}";

            html.Append($"<tr{rowStyle}>")
                .Append($"<td style=\"border-bottom:1px solid #eee\">{E(a.Sku)}</td>")
                .Append($"<td style=\"border-bottom:1px solid #eee\">{E(a.ProductName)}<br><small style=\"color:#666\">{E(a.CategoryName)}</small></td>")
                .Append($"<td style=\"border-bottom:1px solid #eee\">{stock}</td>")
                .Append($"<td style=\"border-bottom:1px solid #eee\">{a.MinStock}</td>")
                .Append($"<td style=\"border-bottom:1px solid #eee\">{a.Shortage}</td>")
                .Append($"<td style=\"border-bottom:1px solid #eee\">{(warehouses.Length > 0 ? warehouses : "—")}</td>")
                .Append($"<td style=\"border-bottom:1px solid #eee\">{supplier}</td>")
                .Append("</tr>");

            text.Append($"- {a.Sku} {a.ProductName}: ")
                .Append(a.TotalStock == 0 ? "AGOTADO" : $"{a.TotalStock} {a.Unit}")
                .Append($" (mínimo {a.MinStock}, faltan {a.Shortage})");
            if (a.SupplierName is not null)
                text.Append($" · Proveedor: {a.SupplierName}{(contact.Length > 0 ? $" ({contact})" : "")}");
            text.Append('\n');
        }
        html.Append("</table>");
        text.Append($"\nRevisado el {date}.");

        return new AlertEmail(subject, Wrap(html.ToString(), date), text.ToString());
    }

    private static string Wrap(string body, string date) =>
        "<div style=\"font-family:Segoe UI,Arial,sans-serif;color:#212529\">" +
        "<h2 style=\"margin:0 0 12px\">StockFlow · Alertas de stock</h2>" +
        body +
        $"<p style=\"color:#888;font-size:12px;margin-top:16px\">Revisado el {date} (hora de Lima).</p></div>";

    // Solo se escapan los caracteres especiales de HTML; las tildes quedan tal cual (el correo va en UTF-8).
    private static string E(string? value) =>
        (value ?? "").Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace("\"", "&quot;");

    // Lima no tiene horario de verano: si el sistema no trae la zona horaria, basta con UTC-5.
    private static DateTimeOffset ToLima(DateTimeOffset now) =>
        TimeZoneInfo.TryFindSystemTimeZoneById("America/Lima", out var lima)
            ? TimeZoneInfo.ConvertTime(now, lima)
            : now.ToOffset(TimeSpan.FromHours(-5));
}
