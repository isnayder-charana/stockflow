using System.IdentityModel.Tokens.Jwt;
using System.Reflection;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.Extensions.Options;
using StockFlow.Api.Controllers;
using StockFlow.Api.Entities;
using StockFlow.Api.Services;

namespace StockFlow.Api.Tests;

public class GuestAccessTests
{
    private static TokenService CreateTokenService() => new(Options.Create(new JwtSettings
    {
        Key = "clave-de-pruebas-con-mas-de-32-caracteres!!",
        Issuer = "StockFlow.Api",
        Audience = "StockFlow.Web",
        ExpirationMinutes = 60
    }));

    [Fact]
    public void Guest_DevuelveTokenConRolInvitado()
    {
        using var db = TestDb.Create();

        var result = new AuthController(db, CreateTokenService()).Guest();

        var response = result.Value!;
        Assert.Equal("Invitado", response.Role);
        Assert.Equal("invitado", response.Username);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(response.Token);
        Assert.Contains(jwt.Claims, c => c.Type == ClaimTypes.Role && c.Value == "Invitado");
        Assert.Empty(db.Users.Where(u => u.Username == "invitado")); // no crea usuarios en la base
    }

    public static IEnumerable<object[]> WriteActions() =>
        typeof(AuthController).Assembly.GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && t != typeof(AuthController))
            .SelectMany(t => t.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            .Where(m => m.GetCustomAttributes<HttpMethodAttribute>()
                .Any(a => a.HttpMethods.Any(h => h != "GET")))
            .Select(m => new object[] { $"{m.DeclaringType!.Name}.{m.Name}" });

    [Theory]
    [MemberData(nameof(WriteActions))]
    public void AccionesDeEscritura_NoPermitenAlInvitado(string action)
    {
        var parts = action.Split('.');
        var method = typeof(AuthController).Assembly.GetTypes().Single(t => t.Name == parts[0])
            .GetMethods().First(m => m.Name == parts[1] &&
                m.GetCustomAttributes<HttpMethodAttribute>().Any(a => a.HttpMethods.Any(h => h != "GET")));

        // Cada acción que crea, edita o borra debe limitar los roles, y el invitado no puede estar entre ellos.
        var roles = method.GetCustomAttributes<AuthorizeAttribute>()
            .Where(a => !string.IsNullOrEmpty(a.Roles))
            .SelectMany(a => a.Roles!.Split(',', StringSplitOptions.TrimEntries))
            .ToList();
        Assert.NotEmpty(roles);
        Assert.DoesNotContain(Roles.Invitado, roles);
        Assert.Empty(method.GetCustomAttributes<AllowAnonymousAttribute>());
    }
}
