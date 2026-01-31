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

    public async Task<DocumentResponse?> CreateDocumentAsync(Guid userId, CreateDocumentRequest request)
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


    public async Task<List<DocumentResponse>> GetUserDocumentsAsync(Guid userId)
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


    public async Task<DocumentResponse?> GetDocumentByIdAsync(Guid documentId, Guid userId)
    {
        var document = await _context.Documents
            .Include(d => d.Owner)
            .FirstOrDefaultAsync(d => d.Id == documentId);

        if (document == null)
        {
            return null;
        }

        // user is owner OR has shared access
        var isOwner = document.OwnerId == userId;
        var hasSharedAccess = await _context.DocumentShares
            .AnyAsync(s => s.DocumentId == documentId && s.UserId == userId);

        if (!isOwner && !hasSharedAccess)
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


    public async Task<DocumentResponse?> UpdateDocumentAsync(Guid documentId, Guid userId, UpdateDocumentRequest request)
    {
        var document = await _context.Documents.FirstOrDefaultAsync(d => d.Id == documentId);

        if (document == null)
        {
            return null;
        }

        var isOwner = document.OwnerId == userId;
        var hasEditAccess = await _context.DocumentShares
            .AnyAsync(s => s.DocumentId == documentId && s.UserId == userId && s.Permission == Permission.Edit);

        if (!isOwner && !hasEditAccess)
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


    public async Task<bool> DeleteDocumentAsync(Guid documentId, Guid userId)
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


    private async Task<DocumentResponse?> GetDocumentResponseAsync(Guid documentId)
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

    public async Task<DocumentShare?> ShareDocumentAsync(Guid documentId, Guid ownerId, string username, string permission)
    {
        // Check if document exists and user is owner
        var document = await _context.Documents
            .FirstOrDefaultAsync(d => d.Id == documentId && d.OwnerId == ownerId);

        if (document == null)
        {
            return null;
        }

        // Find user by username
        var userToShareWith = await _context.Users
            .FirstOrDefaultAsync(u => u.Username == username);

        if (userToShareWith == null)
        {
            return null;
        }

        // Don't allow sharing with yourself
        if (userToShareWith.Id == ownerId)
        {
            return null;
        }

        // Parse permission
        if (!Enum.TryParse<Permission>(permission, out var permissionEnum))
        {
            return null;
        }

        // Check if already shared
        var existingShare = await _context.DocumentShares
            .FirstOrDefaultAsync(s => s.DocumentId == documentId && s.UserId == userToShareWith.Id);

        if (existingShare != null)
        {
            // Update existing permission
            existingShare.Permission = permissionEnum;
            await _context.SaveChangesAsync();
            return existingShare;
        }

        // Create new share
        var share = new DocumentShare
        {
            DocumentId = documentId,
            UserId = userToShareWith.Id,
            Permission = permissionEnum,
            SharedAt = DateTime.UtcNow
        };

        _context.DocumentShares.Add(share);
        await _context.SaveChangesAsync();

        return share;
    }

    public async Task<List<DocumentShare>> GetDocumentSharesAsync(Guid documentId, Guid ownerId)
    {
        // Check if user is owner
        var document = await _context.Documents
            .FirstOrDefaultAsync(d => d.Id == documentId && d.OwnerId == ownerId);

        if (document == null)
        {
            return new List<DocumentShare>();
        }

        return await _context.DocumentShares
            .Where(s => s.DocumentId == documentId)
            .Include(s => s.User)
            .ToListAsync();
    }

    public async Task<bool> RemoveShareAsync(Guid documentId, Guid ownerId, Guid userId)
    {
        // Check if user is owner
        var document = await _context.Documents
            .FirstOrDefaultAsync(d => d.Id == documentId && d.OwnerId == ownerId);

        if (document == null)
        {
            return false;
        }

        var share = await _context.DocumentShares
            .FirstOrDefaultAsync(s => s.DocumentId == documentId && s.UserId == userId);

        if (share == null)
        {
            return false;
        }

        _context.DocumentShares.Remove(share);
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<List<Document>> GetSharedDocumentsAsync(Guid userId)
    {
        var sharedDocumentIds = await _context.DocumentShares
            .Where(s => s.UserId == userId)
            .Select(s => s.DocumentId)
            .ToListAsync();

        return await _context.Documents
            .Where(d => sharedDocumentIds.Contains(d.Id))
            .Include(d => d.Owner)
            .OrderByDescending(d => d.UpdatedAt)
            .ToListAsync();
    }

}