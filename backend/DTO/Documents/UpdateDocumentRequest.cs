using System.ComponentModel.DataAnnotations;

namespace ScribbleAPI.DTOs.Documents;

public class UpdateDocumentRequest
{
    [StringLength(255, MinimumLength = 1)]
    public string? Title { get; set; }
    
    public string? Content { get; set; } // JSON string
}