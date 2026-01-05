using System.ComponentModel.DataAnnotations;

namespace ScribbleAPI.DTOs.Documents;

public class CreateDocumentRequest
{
    [Required]
    [MaxLength(200)]
    public required string Title { get; set; }

}