using System.ComponentModel.DataAnnotations;

namespace ScribbleAPI.DTOs.Documents;

public class ShareDocumentRequest
{
    [Required]
    [StringLength(50, MinimumLength = 3)]
    public required string Username { get; set; }
    
    [Required]
    public required string Permission { get; set; } // "Read" or "Edit"
}