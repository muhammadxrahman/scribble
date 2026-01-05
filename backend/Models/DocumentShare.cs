namespace ScribbleAPI.Models;

public enum Permission
{
    Read,
    Edit
}

public class DocumentShare
{
    public int Id { get; set; }
    
    public required int DocumentId { get; set; }
    
    public required int UserId { get; set; }
    
    public required Permission Permission { get; set; }
    
    public DateTime SharedAt { get; set; } = DateTime.UtcNow;
    
    // Navigation properties
    public Document Document { get; set; } = null!;
    
    public User User { get; set; } = null!;
}