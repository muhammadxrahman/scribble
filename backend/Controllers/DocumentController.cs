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


    // sharing
    [HttpPost("{id:guid}/share")]
    public async Task<IActionResult> ShareDocument(Guid id, [FromBody] ShareDocumentRequest request)
    {
        var userId = GetCurrentUserId();

        var share = await _documentService.ShareDocumentAsync(id, userId, request.Username, request.Permission);

        if (share == null)
        {
            return BadRequest(new { message = "Failed to share document. User not found or you don't own this document." });
        }

        return Ok(new { message = "Document shared successfully" });
    }

    [HttpGet("{id:guid}/shares")]
    public async Task<IActionResult> GetDocumentShares(Guid id)
    {
        var userId = GetCurrentUserId();

        var shares = await _documentService.GetDocumentSharesAsync(id, userId);

        return Ok(shares.Select(s => new
        {
            userId = s.UserId,
            username = s.User.Username,
            email = s.User.Email,
            displayName = s.User.DisplayName,
            permission = s.Permission.ToString(),
            sharedAt = s.SharedAt
        }));
    }

    [HttpDelete("{id:guid}/shares/{userId:guid}")]
    public async Task<IActionResult> RemoveShare(Guid id, Guid userId)
    {
        var currentUserId = GetCurrentUserId();

        var success = await _documentService.RemoveShareAsync(id, currentUserId, userId);

        if (!success)
        {
            return NotFound(new { message = "Share not found or you don't own this document" });
        }

        return NoContent();
    }

    [HttpGet("shared")]
    public async Task<IActionResult> GetSharedDocuments()
    {
        var userId = GetCurrentUserId();

        var documents = await _documentService.GetSharedDocumentsAsync(userId);

        return Ok(documents.Select(d => new DocumentResponse
        {
            Id = d.Id,
            Title = d.Title,
            Content = d.Content,
            CharacterCount = d.CharacterCount,
            OwnerId = d.OwnerId,
            OwnerUsername = d.Owner.Username,
            OwnerDisplayName = d.Owner.DisplayName,
            CreatedAt = d.CreatedAt,
            UpdatedAt = d.UpdatedAt
        }));
    }

}