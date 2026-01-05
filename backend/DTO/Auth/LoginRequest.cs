using System.ComponentModel.DataAnnotations;

namespace ScribbleAPI.DTOs.Auth;

public class LoginRequest
{
    [Required]
    public required string UsernameOrEmail { get; set; }
    
    [Required]
    public required string Password { get; set; }
}