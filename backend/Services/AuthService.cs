using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ScribbleAPI.Data;
using ScribbleAPI.DTOs.Auth;
using ScribbleAPI.Models;

namespace ScribbleAPI.Services;

public class AuthService
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;

    public AuthService(ApplicationDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    private string GenerateJwtToken(User user)
    {
        var jwtSecret = _configuration["Jwt:Secret"] ?? throw new InvalidOperationException("JWT Secret not configured");
        var jwtIssuer = _configuration["Jwt:Issuer"] ?? throw new InvalidOperationException("JWT Issuer not configured");
        var jwtAudience = _configuration["Jwt:Audience"] ?? throw new InvalidOperationException("JWT Audience not configured");
        var jwtExpirationHours = int.Parse(_configuration["Jwt:ExpirationHours"] ?? "24");

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.UniqueName, user.Username),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim("displayName", user.DisplayName),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: jwtIssuer,
            audience: jwtAudience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(jwtExpirationHours),
            signingCredentials: credentials
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public async Task<AuthResponse?> RegisterAsync(RegisterRequest request)
    {
        // check if username/email already exists
        if (await _context.Users.AnyAsync(u => u.Username == request.Username))
        {
            return null;
        }

        if (await _context.Users.AnyAsync(u => u.Email == request.Email))
        {
            return null;
        }

        // hash password
        string passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

        // new user
        var user = new User
        {
            Username = request.Username,
            Email = request.Email,
            PasswordHash = passwordHash,
            DisplayName = request.DisplayName,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // JWT token
        string token = GenerateJwtToken(user);

        return new AuthResponse
        {
            Token = token,
            UserId = user.Id,
            Username = user.Username,
            Email = user.Email,
            DisplayName = user.DisplayName
        };

    }

    public async Task<AuthResponse?> LoginAsync(LoginRequest request)
    {
        // find by username or email
        var user = await _context.Users
            .FirstOrDefaultAsync(u => 
                u.Username == request.UsernameOrEmail || 
                u.Email == request.UsernameOrEmail);

        if (user == null)
        {
            return null;
        }

        bool isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
        if (!isPasswordValid)
        {
            return null;
        }

        string token = GenerateJwtToken(user);

        return new AuthResponse
        {
            Token = token,
            UserId = user.Id,
            Username = user.Username,
            Email = user.Email,
            DisplayName = user.DisplayName
        };

    }

    public async Task<bool> BlacklistTokenAsync(string token)
    {
        try
        {
            // Parse token to get expiration
            var handler = new JwtSecurityTokenHandler();
            var jwtToken = handler.ReadJwtToken(token);
            var expiresAt = jwtToken.ValidTo;

            // Check if already blacklisted
            var exists = await _context.TokenBlacklist.AnyAsync(t => t.Token == token);
            if (exists)
            {
                return true;
            }

            // Add to blacklist
            var blacklistedToken = new TokenBlacklist
            {
                Token = token,
                BlacklistedAt = DateTime.UtcNow,
                ExpiresAt = expiresAt
            };

            _context.TokenBlacklist.Add(blacklistedToken);
            await _context.SaveChangesAsync();

            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> IsTokenBlacklistedAsync(string token)
    {
        return await _context.TokenBlacklist.AnyAsync(t => t.Token == token);
    }
    
}