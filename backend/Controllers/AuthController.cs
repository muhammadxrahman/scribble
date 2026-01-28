using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ScribbleAPI.DTOs.Auth;
using ScribbleAPI.Services;

namespace ScribbleAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AuthService _authService;

    public AuthController(AuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var result = await _authService.RegisterAsync(request);

        if (result == null)
        {
            return BadRequest(new { message = "Username or email already exists" });
        }

        return Ok(result);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginAsync(request);

        if (result == null)
        {
            return Unauthorized(new { message = "Invalid username/email or password" });
        }

        return Ok(result);
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        // Get token from Authorization header
        var token = Request.Headers["Authorization"].ToString().Replace("Bearer ", "");
        
        if (string.IsNullOrEmpty(token))
        {
            return BadRequest(new { message = "No token provided" });
        }

        var result = await _authService.BlacklistTokenAsync(token);
        
        if (!result)
        {
            return BadRequest(new { message = "Failed to logout" });
        }

        return Ok(new { message = "Logged out successfully" });
    }

}