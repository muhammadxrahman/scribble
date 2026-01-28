namespace ScribbleAPI.Models;

public class DocumentVersion
{
    public int Id { get; set; }
    
    public required Guid DocumentId { get; set; }
    
    public required string Content { get; set; } // JSON snapshot
    
    public required Guid CreatedByUserId { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public int VersionNumber { get; set; }
    
    // Navigation property
    public Document Document { get; set; } = null!;
}