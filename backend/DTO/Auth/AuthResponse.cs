namespace ScribbleAPI.DTOs.Auth;

public class AuthResponse
{
    public required string Token { get; set; }
    public required int UserId { get; set; }
    public required string Username { get; set; }
    public required string Email { get; set; }
    public required string DisplayName { get; set; }
}