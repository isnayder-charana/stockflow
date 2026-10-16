using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using StockFlow.Api.Entities;
using StockFlow.Api.Services;

namespace StockFlow.Api.Tests;

public class TokenServiceTests
{
    private static TokenService CreateService() => new(Options.Create(new JwtSettings
    {
        Key = "clave-de-pruebas-con-mas-de-32-caracteres!!",
        Issuer = "StockFlow.Api",
        Audience = "StockFlow.Web",
        ExpirationMinutes = 60
    }));

    [Fact]
    public void CreateToken_IncluyeRolYUsuario()
    {
        var user = new User { Id = 7, Username = "almacen1", Role = UserRole.Almacenero };

        var (token, expiresAt) = CreateService().CreateToken(user);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

        Assert.Equal("StockFlow.Api", jwt.Issuer);
        Assert.Contains(jwt.Claims, c => c.Type == ClaimTypes.Role && c.Value == "Almacenero");
        Assert.Contains(jwt.Claims, c => c.Type == ClaimTypes.Name && c.Value == "almacen1");
        Assert.True(expiresAt > DateTime.UtcNow.AddMinutes(59));
    }
}
