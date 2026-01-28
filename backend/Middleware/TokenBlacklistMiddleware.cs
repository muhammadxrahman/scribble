using Microsoft.EntityFrameworkCore;
using ScribbleAPI.Data;

namespace ScribbleAPI.Middleware;

public class TokenBlacklistMiddleware
{
    private readonly RequestDelegate _next;

    public TokenBlacklistMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ApplicationDbContext dbContext)
    {
        // Get token from Authorization header
        var authHeader = context.Request.Headers["Authorization"].ToString();
        
        if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
        {
            var token = authHeader.Replace("Bearer ", "");
            
            // Check if token is blacklisted
            var isBlacklisted = await dbContext.TokenBlacklist
                .AnyAsync(t => t.Token == token);
            
            if (isBlacklisted)
            {
                context.Response.StatusCode = 401;
                await context.Response.WriteAsJsonAsync(new { message = "Token has been revoked" });
                return;
            }
        }

        await _next(context);
    }
}