using Microsoft.EntityFrameworkCore;
using ScribbleAPI.Data;
using ScribbleAPI.DTOs.Documents;
using ScribbleAPI.Models;

namespace ScribbleAPI.Services;

public class DocumentService
{
    private readonly ApplicationDbContext _context;
    private const int MaxDocumentsPerUser = 5;
    private const int MaxCharacterCount = 50000;

    public DocumentService(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<DocumentResponse?> CreateDocumentAsync(int userId, CreateDocumentRequest request)
    {
        // Check if user already has 5 documents
        var userDocumentCount = await _context.Documents.CountAsync(d => d.OwnerId == userId);
        if (userDocumentCount >= MaxDocumentsPerUser)
        {
            return null; // Max limit reached
        }

        var document = new Document
        {
            OwnerId = userId,
            Title = request.Title,
            Content = "{}",
            CharacterCount = 0,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Documents.Add(document);
        await _context.SaveChangesAsync();

        return await GetDocumentResponseAsync(document.Id);
    }


    public async Task<List<DocumentResponse>> GetUserDocumentsAsync(int userId)
    {
        var documents = await _context.Documents
            .Where(d => d.OwnerId == userId)
            .Include(d => d.Owner)
            .OrderByDescending(d => d.UpdatedAt)
            .ToListAsync();

        return documents.Select(d => new DocumentResponse
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
        }).ToList();
    }


    public async Task<DocumentResponse?> GetDocumentByIdAsync(int documentId, int userId)
    {
        var document = await _context.Documents
            .Include(d => d.Owner)
            .FirstOrDefaultAsync(d => d.Id == documentId);

        if (document == null)
        {
            return null;
        }

        if (document.OwnerId != userId)
        {
            // temp until sharing
            return null;
        }

        return new DocumentResponse
        {
            Id = document.Id,
            Title = document.Title,
            Content = document.Content,
            CharacterCount = document.CharacterCount,
            OwnerId = document.OwnerId,
            OwnerUsername = document.Owner.Username,
            OwnerDisplayName = document.Owner.DisplayName,
            CreatedAt = document.CreatedAt,
            UpdatedAt = document.UpdatedAt
        };
    }


    public async Task<DocumentResponse?> UpdateDocumentAsync(int documentId, int userId, UpdateDocumentRequest request)
    {
        var document = await _context.Documents.FirstOrDefaultAsync(d => d.Id == documentId);

        if (document == null || document.OwnerId != userId)
        {
            return null;
        }

        // update accordingly

        if (request.Title != null)
        {
            document.Title = request.Title;
        }

        if (request.Content != null)
        {
            // Count characters (strip JSON formatting)
            var characterCount = CountPlainTextCharacters(request.Content);
            
            if (characterCount > MaxCharacterCount)
            {
                return null; // Character limit exceeded
            }

            document.Content = request.Content;
            document.CharacterCount = characterCount;
        }

        document.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return await GetDocumentResponseAsync(document.Id);

    }


    public async Task<bool> DeleteDocumentAsync(int documentId, int userId)
    {
        var document = await _context.Documents.FirstOrDefaultAsync(d => d.Id == documentId);

        if (document == null || document.OwnerId != userId)
        {
            return false;
        }

        _context.Documents.Remove(document);
        await _context.SaveChangesAsync();

        return true;
    }


    private async Task<DocumentResponse?> GetDocumentResponseAsync(int documentId)
    {
        var document = await _context.Documents
            .Include(d => d.Owner)
            .FirstOrDefaultAsync(d => d.Id == documentId);

        if (document == null)
        {
            return null;
        }

        return new DocumentResponse
        {
            Id = document.Id,
            Title = document.Title,
            Content = document.Content,
            CharacterCount = document.CharacterCount,
            OwnerId = document.OwnerId,
            OwnerUsername = document.Owner.Username,
            OwnerDisplayName = document.Owner.DisplayName,
            CreatedAt = document.CreatedAt,
            UpdatedAt = document.UpdatedAt
        };
    }


    private int CountPlainTextCharacters(string content)
    {
        // simple char count until JSON parsing is implemented
        return content.Length;
    }

}