namespace ScribbleAPI.Models;

public class User
{
    public int Id { get; set; }
    
    public required string Username { get; set; }
    
    public required string Email { get; set; }
    
    public required string PasswordHash { get; set; }
    
    public required string DisplayName { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation properties (relationships)
    public ICollection<Document> Documents { get; set; } = new List<Document>();
    
    public ICollection<DocumentShare> SharedDocuments { get; set; } = new List<DocumentShare>();
}