using Microsoft.EntityFrameworkCore;
using StockFlow.Api.Entities;

namespace StockFlow.Api.Data;

public static class DbSeeder
{
    /// <summary>Crea el usuario administrador inicial si la tabla de usuarios está vacía.</summary>
    public static async Task SeedAdminAsync(AppDbContext db, IConfiguration config)
    {
        if (await db.Users.AnyAsync()) return;

        var username = config["Seed:AdminUsername"] ?? "admin";
        var password = config["Seed:AdminPassword"];
        if (string.IsNullOrWhiteSpace(password)) return;

        db.Users.Add(new User
        {
            Username = username,
            FullName = "Administrador",
            Email = "admin@stockflow.local",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = UserRole.Admin
        });
        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Crea un usuario de prueba por cada rol que no sea Admin (solo si no existe ya).
    /// Usa la contraseña de Seed:DemoPassword; si está vacía, no crea nada.
    /// </summary>
    public static async Task SeedDemoUsersAsync(AppDbContext db, IConfiguration config)
    {
        var password = config["Seed:DemoPassword"];
        if (string.IsNullOrWhiteSpace(password)) return;

        var demoUsers = new[]
        {
            (Username: "almacenero", FullName: "Almacenero de prueba", Role: UserRole.Almacenero),
            (Username: "supervisor", FullName: "Supervisor de prueba", Role: UserRole.Supervisor)
        };

        foreach (var demo in demoUsers)
        {
            if (await db.Users.AnyAsync(u => u.Username == demo.Username)) continue;

            db.Users.Add(new User
            {
                Username = demo.Username,
                FullName = demo.FullName,
                Email = $"{demo.Username}@stockflow.local",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                Role = demo.Role
            });
        }
        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Crea el usuario de solo lectura (rol Supervisor) con el que el microservicio de alertas
    /// consulta la API. Usa Seed:AlertsPassword; si está vacía, no crea nada.
    /// </summary>
    public static async Task SeedAlertsUserAsync(AppDbContext db, IConfiguration config)
    {
        var username = config["Seed:AlertsUsername"] ?? "alertas";
        var password = config["Seed:AlertsPassword"];
        if (string.IsNullOrWhiteSpace(password)) return;
        if (await db.Users.AnyAsync(u => u.Username == username)) return;

        db.Users.Add(new User
        {
            Username = username,
            FullName = "Servicio de alertas",
            Email = $"{username}@stockflow.local",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            Role = UserRole.Supervisor
        });
        await db.SaveChangesAsync();
    }
}
