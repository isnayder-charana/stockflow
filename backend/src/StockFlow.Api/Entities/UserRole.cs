namespace StockFlow.Api.Entities;

public enum UserRole
{
    Admin,
    Almacenero,
    Supervisor
}

public static class Roles
{
    public const string Admin = nameof(UserRole.Admin);
    public const string Almacenero = nameof(UserRole.Almacenero);
    public const string Supervisor = nameof(UserRole.Supervisor);
}
