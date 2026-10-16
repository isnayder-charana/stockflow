namespace StockFlow.Alerts;

/// <summary>Configuración del microservicio, leída de variables de entorno.</summary>
public record AlertsSettings
{
    /// <summary>URL base de la API, sin barra final. Ej.: https://abc123.execute-api.us-east-1.amazonaws.com</summary>
    public required string ApiBaseUrl { get; init; }

    /// <summary>Usuario de solo lectura con el que se consulta la API (lo crea Seed:AlertsPassword).</summary>
    public required string Username { get; init; }

    public required string Password { get; init; }

    /// <summary>Remitente. Con Gmail debe ser la misma cuenta de <see cref="SmtpUser"/>.</summary>
    public string FromEmail { get; init; } = string.Empty;

    /// <summary>
    /// Servidor de correo (por defecto Gmail). Si <see cref="SmtpUser"/> está vacío, se usa Amazon SES,
    /// que no está disponible en las cuentas del plan gratuito de AWS.
    /// </summary>
    public string SmtpHost { get; init; } = "smtp.gmail.com";

    public int SmtpPort { get; init; } = 587;

    public string SmtpUser { get; init; } = string.Empty;

    /// <summary>Con Gmail, una contraseña de aplicación (no la contraseña normal de la cuenta).</summary>
    public string SmtpPassword { get; init; } = string.Empty;

    public bool SmtpSsl { get; init; } = true;

    public bool UsesSmtp => SmtpUser.Length > 0;

    public IReadOnlyList<string> ToEmails { get; init; } = [];

    /// <summary>Si es true, no envía correo: guarda el correo en <see cref="PreviewPath"/>.</summary>
    public bool DryRun { get; init; }

    public string PreviewPath { get; init; } = "alerts-preview.html";

    /// <summary>Si es true, también avisa cuando no hay productos bajo el mínimo.</summary>
    public bool SendWhenEmpty { get; init; }

    public static AlertsSettings FromEnvironment()
    {
        static string Get(string name, string? fallback = null) =>
            Environment.GetEnvironmentVariable(name) is { Length: > 0 } value
                ? value
                : fallback ?? throw new InvalidOperationException($"Falta la variable de entorno {name}.");

        static bool Flag(string name) =>
            bool.TryParse(Environment.GetEnvironmentVariable(name), out var value) && value;

        var dryRun = Flag("ALERTS_DRY_RUN");
        var smtpUser = Get("ALERTS_SMTP_USER", "");
        var settings = new AlertsSettings
        {
            ApiBaseUrl = Get("STOCKFLOW_API_URL").TrimEnd('/'),
            Username = Get("STOCKFLOW_API_USER", "alertas"),
            Password = Get("STOCKFLOW_API_PASSWORD"),
            FromEmail = Get("ALERTS_FROM", dryRun || smtpUser.Length > 0 ? smtpUser : null),
            SmtpHost = Get("ALERTS_SMTP_HOST", "smtp.gmail.com"),
            SmtpPort = int.Parse(Get("ALERTS_SMTP_PORT", "587")),
            SmtpUser = smtpUser,
            SmtpPassword = Get("ALERTS_SMTP_PASSWORD", dryRun || smtpUser.Length == 0 ? "" : null),
            SmtpSsl = !bool.TryParse(Environment.GetEnvironmentVariable("ALERTS_SMTP_SSL"), out var ssl) || ssl,
            ToEmails = Get("ALERTS_TO", dryRun ? "" : null)
                .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
            DryRun = dryRun,
            PreviewPath = Get("ALERTS_PREVIEW_PATH", "alerts-preview.html"),
            SendWhenEmpty = Flag("ALERTS_SEND_WHEN_EMPTY")
        };

        if (!settings.DryRun && settings.ToEmails.Count == 0)
            throw new InvalidOperationException("ALERTS_TO no tiene ningún correo.");
        return settings;
    }
}
