using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using ScribbleAPI.Data;
using ScribbleAPI.Hubs;
using ScribbleAPI.Services;

var builder = WebApplication.CreateBuilder(args);

// Services to container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSignalR();
// cors
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        // Get allowed origins from environment variable or use defaults
        var allowedOrigins = builder.Configuration["AllowedOrigins"]
            ?.Split(',', StringSplitOptions.RemoveEmptyEntries)
            ?? new[] { "http://localhost:3000" };

        policy.WithOrigins(allowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Description = "Enter your Bearer token"
    });

    options.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// DB - Handle Railway's DATABASE_URL format
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

// Convert Railway's postgres:// or postgresql:// format to Npgsql format if needed
if (!string.IsNullOrEmpty(connectionString) && 
    (connectionString.StartsWith("postgres://") || connectionString.StartsWith("postgresql://")))
{
    var uri = new Uri(connectionString);
    var userInfo = uri.UserInfo.Split(':');
    connectionString = $"Host={uri.Host};Port={uri.Port};Database={uri.AbsolutePath.TrimStart('/')};Username={userInfo[0]};Password={userInfo[1]};SSL Mode=Require;Trust Server Certificate=true";
    Console.WriteLine($"[DEBUG] Converted connection string to Npgsql format");
}

// connector to microservice
builder.Services.AddHttpClient();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<DocumentService>();

// jwt auth
var jwtSecret = builder.Configuration["Jwt:Secret"] ?? throw new InvalidOperationException("JWT Secret not configured");
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("JWT Issuer not configured");
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? throw new InvalidOperationException("JWT Audience not configured");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
    };

    // config for signalr
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];

            // if the request is for hub
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) &&
                path.StartsWithSegments("/hubs"))
            {
                // read the token out of the query string
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

var app = builder.Build();

// Run migrations automatically on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    Console.WriteLine("[INFO] Running database migrations...");
    db.Database.Migrate();
    Console.WriteLine("[INFO] Database migrations complete!");
}

// Configure HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowFrontend");
app.UseMiddleware<ScribbleAPI.Middleware.TokenBlacklistMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.MapHub<DocumentHub>("/hubs/document");

app.Run();