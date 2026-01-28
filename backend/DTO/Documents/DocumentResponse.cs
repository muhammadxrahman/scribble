namespace ScribbleAPI.DTOs.Documents;

public class DocumentResponse
{
    public Guid Id { get; set; }
    public required string Title { get; set; }
    public required string Content { get; set; }
    public int CharacterCount { get; set; }
    public Guid OwnerId { get; set; }
    public required string OwnerUsername { get; set; }
    public required string OwnerDisplayName { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}