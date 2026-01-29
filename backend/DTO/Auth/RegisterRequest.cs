using System.ComponentModel.DataAnnotations;

namespace ScribbleAPI.DTOs.Auth;

public class RegisterRequest
{
    [Required]
    [StringLength(15, MinimumLength = 3)]
    public required string Username { get; set; }
    
    [Required]
    [EmailAddress]
    [StringLength(30)]
    public required string Email { get; set; }
    
    [Required]
    [StringLength(100, MinimumLength = 8)]
    public required string Password { get; set; }
    
    public required string DisplayName { get; set; }
}