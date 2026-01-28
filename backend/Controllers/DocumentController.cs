using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ScribbleAPI.DTOs.Documents;
using ScribbleAPI.Services;

namespace ScribbleAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DocumentController : ControllerBase
{
    private readonly DocumentService _documentService;

    public DocumentController(DocumentService documentService)
    {
        _documentService = documentService;
    }

    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.Parse(userIdClaim ?? Guid.Empty.ToString());
    }

    [HttpPost]
    public async Task<IActionResult> CreateDocument([FromBody] CreateDocumentRequest request)
    {
        var userId = GetCurrentUserId();
        var result = await _documentService.CreateDocumentAsync(userId, request);

        if (result == null)
        {
            return BadRequest(new { message = "Maximum document limit reached (5 documents per user)" });
        }

        return CreatedAtAction(nameof(GetDocument), new { id = result.Id }, result);
    }

    [HttpGet]
    public async Task<IActionResult> GetUserDocuments()
    {
        var userId = GetCurrentUserId();
        var documents = await _documentService.GetUserDocumentsAsync(userId);

        return Ok(documents);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetDocument(Guid id)
    {
        var userId = GetCurrentUserId();
        var document = await _documentService.GetDocumentByIdAsync(id, userId);

        if (document == null)
        {
            return NotFound(new { message = "Document not found or access denied" });
        }

        return Ok(document);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateDocument(Guid id, [FromBody] UpdateDocumentRequest request)
    {
        var userId = GetCurrentUserId();
        var result = await _documentService.UpdateDocumentAsync(id, userId, request);

        if (result == null)
        {
            return BadRequest(new { message = "Document not found, access denied, or character limit exceeded (50,000 characters max)" });
        }

        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteDocument(Guid id)
    {
        var userId = GetCurrentUserId();
        var success = await _documentService.DeleteDocumentAsync(id, userId);

        if (!success)
        {
            return NotFound(new { message = "Document not found or access denied" });
        }

        return NoContent();
    }
}