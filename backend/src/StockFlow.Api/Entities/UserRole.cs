namespace StockFlow.Api.Entities;

public enum UserRole
{
    Admin,
    Almacenero,
    Supervisor,
    Invitado
}

public static class Roles
{
    public const string Admin = nameof(UserRole.Admin);
    public const string Almacenero = nameof(UserRole.Almacenero);
    public const string Supervisor = nameof(UserRole.Supervisor);
    /// <summary>Solo lectura: entra desde el botón "Entrar como invitado" sin contraseña.</summary>
    public const string Invitado = nameof(UserRole.Invitado);
}
