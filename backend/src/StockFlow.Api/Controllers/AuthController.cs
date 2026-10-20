using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StockFlow.Api.Data;
using StockFlow.Api.Dtos;
using StockFlow.Api.Entities;
using StockFlow.Api.Services;

namespace StockFlow.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, ITokenService tokenService) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
        if (user is null || !user.IsActive || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Usuario o contraseña incorrectos." });

        var (token, expiresAt) = tokenService.CreateToken(user);
        return new LoginResponse(token, expiresAt, user.Username, user.FullName, user.Role.ToString());
    }

    /// <summary>
    /// Entra como invitado: token con rol Invitado, que puede consultar todo pero no crear, editar ni borrar.
    /// No usa ningún usuario de la base, así que funciona en cualquier entorno sin preparar nada.
    /// </summary>
    [HttpPost("guest")]
    [AllowAnonymous]
    public ActionResult<LoginResponse> Guest()
    {
        var guest = new User { Id = 0, Username = "invitado", FullName = "Invitado", Role = UserRole.Invitado };
        var (token, expiresAt) = tokenService.CreateToken(guest);
        return new LoginResponse(token, expiresAt, guest.Username, guest.FullName, guest.Role.ToString());
    }
}
