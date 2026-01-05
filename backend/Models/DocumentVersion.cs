namespace ScribbleAPI.Models;

public class DocumentVersion
{
    public int Id { get; set; }
    
    public required int DocumentId { get; set; }
    
    public required string Content { get; set; } // JSON snapshot
    
    public required int CreatedByUserId { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public int VersionNumber { get; set; }
    
    // Navigation property
    public Document Document { get; set; } = null!;
}