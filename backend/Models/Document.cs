namespace ScribbleAPI.Models;

public class Document
{
    public int Id { get; set; }
    
    public required int OwnerId { get; set; }
    
    public required string Title { get; set; }
    
    public string Content { get; set; } = "{}"; // JSON string, default to empty JSON object
    
    public int CharacterCount { get; set; } = 0;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    public User Owner { get; set; } = null!;
    
    public ICollection<DocumentShare> Shares { get; set; } = new List<DocumentShare>();
    
    public ICollection<DocumentVersion> Versions { get; set; } = new List<DocumentVersion>();
}