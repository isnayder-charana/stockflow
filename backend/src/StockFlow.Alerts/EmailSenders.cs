using System.Net;
using System.Net.Mail;
using System.Text;
using Amazon.SimpleEmailV2;
using Amazon.SimpleEmailV2.Model;

namespace StockFlow.Alerts;

public interface IEmailSender
{
    Task SendAsync(AlertEmail email, CancellationToken ct = default);
}

/// <summary>Envía el correo por SMTP (por ejemplo Gmail con una contraseña de aplicación).</summary>
public class SmtpEmailSender(AlertsSettings settings) : IEmailSender
{
    public async Task SendAsync(AlertEmail email, CancellationToken ct = default)
    {
        using var message = new MailMessage
        {
            From = new MailAddress(settings.FromEmail, "StockFlow"),
            Subject = email.Subject,
            SubjectEncoding = Encoding.UTF8,
            Body = email.Text,
            BodyEncoding = Encoding.UTF8
        };
        foreach (var to in settings.ToEmails) message.To.Add(to);
        // Versión HTML (la tabla); los clientes que no la muestran usan el texto.
        message.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(
            email.Html, Encoding.UTF8, "text/html"));

        using var smtp = new SmtpClient(settings.SmtpHost, settings.SmtpPort)
        {
            EnableSsl = settings.SmtpSsl,
            Credentials = new NetworkCredential(settings.SmtpUser, settings.SmtpPassword)
        };
        await smtp.SendMailAsync(message, ct);
    }
}

/// <summary>Envía el correo con Amazon SES (no disponible en el plan gratuito de AWS).</summary>
public class SesEmailSender(IAmazonSimpleEmailServiceV2 ses, AlertsSettings settings) : IEmailSender
{
    public async Task SendAsync(AlertEmail email, CancellationToken ct = default)
    {
        await ses.SendEmailAsync(new SendEmailRequest
        {
            FromEmailAddress = settings.FromEmail,
            Destination = new Destination { ToAddresses = settings.ToEmails.ToList() },
            Content = new EmailContent
            {
                Simple = new Message
                {
                    Subject = new Content { Data = email.Subject, Charset = "UTF-8" },
                    Body = new Body
                    {
                        Html = new Content { Data = email.Html, Charset = "UTF-8" },
                        Text = new Content { Data = email.Text, Charset = "UTF-8" }
                    }
                }
            }
        }, ct);
    }
}

/// <summary>Modo de prueba: guarda el correo en un archivo HTML en vez de enviarlo.</summary>
public class PreviewEmailSender(string path) : IEmailSender
{
    public async Task SendAsync(AlertEmail email, CancellationToken ct = default)
    {
        var html = $"<!-- Asunto: {System.Net.WebUtility.HtmlEncode(email.Subject)} -->\n{email.Html}";
        await File.WriteAllTextAsync(path, html, ct);
    }
}
