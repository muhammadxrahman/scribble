namespace ScribbleAPI.Models;

public class TokenBlacklist
{
    public int Id { get; set; }
    
    public required string Token { get; set; }
    
    public DateTime BlacklistedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime ExpiresAt { get; set; }
}