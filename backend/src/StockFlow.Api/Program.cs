using System.Text;
using System.Text.Json.Serialization;
using Amazon.S3;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using StockFlow.Api.Data;
using StockFlow.Api.Services;
using StockFlow.Api.Services.Storage;

var builder = WebApplication.CreateBuilder(args);

// En AWS Lambda la API recibe las peticiones de API Gateway (HTTP API).
// Fuera de Lambda esta línea no hace nada y la API corre con Kestrel como siempre.
builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

// Base de datos (MySQL con Pomelo)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Falta ConnectionStrings:DefaultConnection.");
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 36))));

// JWT
var jwtSection = builder.Configuration.GetSection("Jwt");
builder.Services.Configure<JwtSettings>(jwtSection);
var jwt = jwtSection.Get<JwtSettings>() ?? new JwtSettings();
if (Encoding.UTF8.GetByteCount(jwt.Key) < 32)
    throw new InvalidOperationException("Jwt:Key debe tener al menos 32 caracteres.");

builder.Services.AddScoped<ITokenService, TokenService>();

// Archivos: carpeta local en desarrollo, S3 en AWS (Storage:Provider = "S3"), "None" para desactivarlos
var storage = builder.Configuration.GetSection("Storage").Get<StorageSettings>() ?? new StorageSettings();
var localStoragePath = Path.Combine(builder.Environment.ContentRootPath, storage.LocalPath);
if (storage.Provider.Equals("S3", StringComparison.OrdinalIgnoreCase))
{
    if (string.IsNullOrWhiteSpace(storage.BucketName))
        throw new InvalidOperationException("Falta Storage:BucketName.");
    builder.Services.AddSingleton(storage);
    // Sin ServiceUrl usa Amazon S3; con ServiceUrl, cualquier servicio compatible (Cloudflare R2, Supabase…).
    // Las credenciales salen de AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (o del rol de Lambda).
    builder.Services.AddSingleton<IAmazonS3>(_ => string.IsNullOrWhiteSpace(storage.ServiceUrl)
        ? new AmazonS3Client()
        : new AmazonS3Client(new AmazonS3Config { ServiceURL = storage.ServiceUrl, ForcePathStyle = true }));
    builder.Services.AddSingleton<IFileStorage, S3FileStorage>();
}
else if (storage.Provider.Equals("None", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddSingleton<IFileStorage, DisabledFileStorage>();
}
else
{
    builder.Services.AddSingleton<IFileStorage>(new LocalFileStorage(localStoragePath));
}
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });
builder.Services.AddAuthorization();

// CORS para el frontend de Vite
// Cada entrada puede traer varios orígenes separados por coma (así llegan desde AWS: Cors__AllowedOrigins__0).
var allowedOrigins = (builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [])
    .SelectMany(o => o.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
    .Select(o => o.TrimEnd('/'))
    .ToArray();
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddControllers()
    .AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "StockFlow API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Pega aquí el token JWT obtenido en /api/auth/login"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// dotnet run --project src/StockFlow.Api -- --setup-database
// Aplica las migraciones y crea el admin y el usuario de alertas en la base configurada (por ejemplo RDS).
if (args.Contains("--setup-database"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await DbSeeder.SeedAdminAsync(db, app.Configuration);
    await DbSeeder.SeedAlertsUserAsync(db, app.Configuration);
    app.Logger.LogInformation("Base de datos lista.");
    return;
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();

    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await DbSeeder.SeedAdminAsync(db, app.Configuration);
    await DbSeeder.SeedDemoUsersAsync(db, app.Configuration);
    await DbSeeder.SeedAlertsUserAsync(db, app.Configuration);
}

if (app.Services.GetRequiredService<IFileStorage>() is LocalFileStorage)
{
    Directory.CreateDirectory(localStoragePath);
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(localStoragePath),
        RequestPath = LocalFileStorage.RequestPath
    });
}

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Para el chequeo de salud del hosting (Render): no toca la base de datos.
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();

app.Run();

// Necesario para pruebas de integración con WebApplicationFactory
public partial class Program;
