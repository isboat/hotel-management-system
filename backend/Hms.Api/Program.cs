using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Hms.Api.Data;
using Hms.Api.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddDbContext<HotelDatabase>((services, options) =>
{
    var configuration = services.GetRequiredService<IConfiguration>();
    var environment = services.GetRequiredService<IHostEnvironment>();
    var sql = configuration.GetConnectionString("Hotel");
    if (sql is not null) options.UseSqlServer(sql);
    else if (environment.IsDevelopment()) options.UseSqlite(configuration.GetConnectionString("Local") ?? "Data Source=hms.db");
    else throw new InvalidOperationException("Configure ConnectionStrings__Hotel for Azure SQL.");
});
builder.Services.AddSingleton(services =>
{
    var signingKey = services.GetRequiredService<IConfiguration>()["Jwt:Key"] ?? throw new InvalidOperationException("Configure Jwt__Key.");
    if (Encoding.UTF8.GetByteCount(signingKey) < 32)
        throw new InvalidOperationException("Jwt__Key must contain at least 32 bytes.");
    return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
});
builder.Services.AddScoped<TenantAccess>();
builder.Services.AddScoped<SessionTokens>();
builder.Services.AddScoped<IPasswordHasher<Staff>, PasswordHasher<Staff>>();
builder.Services.AddControllers();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<SymmetricSecurityKey>((options, key) =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidIssuer = "hotel-management-system",
        ValidAudience = "hotel-staff",
        IssuerSigningKey = key,
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
        ValidateIssuerSigningKey = true,
        ClockSkew = TimeSpan.FromSeconds(15)
    };
    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = async context =>
        {
            var database = context.HttpContext.RequestServices.GetRequiredService<HotelDatabase>();
            var actor = TenantAccess.Actor(context.Principal!);
            var version = context.Principal!.FindFirstValue("session_version");
            if (!int.TryParse(version, out var current) ||
                !await database.Staff.AnyAsync(user => user.Id == actor && user.SessionVersion == current))
                context.Fail("Session has expired.");
        }
    };
});
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("credentials", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "local",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1) }));
});
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
{
    var origins = builder.Configuration.GetSection("FrontendOrigins").Get<string[]>() ?? ["http://localhost:5173"];
    policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod();
}));
builder.Services.AddSwaggerGen(options =>
{
    options.IncludeXmlComments(Path.Combine(AppContext.BaseDirectory, "Hms.Api.xml"));
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "Hotel Management API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme { Type = SecuritySchemeType.Http, Scheme = "bearer", In = ParameterLocation.Header });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } }] = []
    });
});

var app = builder.Build();
_ = app.Services.GetRequiredService<SymmetricSecurityKey>();
await using (var scope = app.Services.CreateAsyncScope())
{
    var database = scope.ServiceProvider.GetRequiredService<HotelDatabase>();
    if (database.Database.IsSqlServer() && app.Configuration.GetValue<bool>("Database:Migrate"))
        await database.Database.MigrateAsync();
    else if (app.Environment.IsDevelopment() && database.Database.IsSqlite())
        await database.Database.EnsureCreatedAsync();

    var email = builder.Configuration["Bootstrap:Email"];
    var password = builder.Configuration["Bootstrap:Password"];
    if (!string.IsNullOrWhiteSpace(email) && password is { Length: >= 12 } && !await database.Staff.AnyAsync(row => row.IsSystemAdmin))
    {
        var staff = new Staff(Guid.NewGuid(), email.Trim().ToUpperInvariant(), "System administrator", "", true);
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Staff>>();
        database.Staff.Add(staff with { PasswordHash = hasher.HashPassword(staff, password) });
        await database.SaveChangesAsync();
    }
}

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors();
app.UseAuthentication();
app.UseMiddleware<AuditMiddleware>();
app.UseRateLimiter();
app.UseAuthorization();
app.MapGet("/health", async (HotelDatabase database) =>
    await database.Database.CanConnectAsync() ? Results.Ok(new { status = "ok" }) : Results.StatusCode(503));
app.MapControllers();
app.Run();

public partial class Program;
