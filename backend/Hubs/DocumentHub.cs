using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using ScribbleAPI.Data;

namespace ScribbleAPI.Hubs;

[Authorize]
public class DocumentHub : Hub
{
    private readonly ApplicationDbContext _context;
    // Track which users are in which documents
    private static readonly Dictionary<string, HashSet<string>> DocumentUsers = new();
    private static readonly Dictionary<string, Guid> ConnectionToUser = new();

    public DocumentHub(ApplicationDbContext context)
    {
        _context = context;
    }

    private Guid GetCurrentUserId()
    {
        var userIdString = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.Parse(userIdString ?? throw new Exception("User not authenticated"));
    }

    public override async Task OnConnectedAsync()
    {
        var userId = GetCurrentUserId();
        ConnectionToUser[Context.ConnectionId] = userId;
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var connectionId = Context.ConnectionId;

        if (ConnectionToUser.TryGetValue(connectionId, out var userId))
        {
            // Get user info
            var user = await _context.Users.FindAsync(userId);

            // Find and leave all document groups
            var documentsToLeave = DocumentUsers
                .Where(kvp => kvp.Value.Contains(connectionId))
                .Select(kvp => kvp.Key)
                .ToList();

            foreach (var documentId in documentsToLeave)
            {
                DocumentUsers[documentId].Remove(connectionId);

                if (DocumentUsers[documentId].Count == 0)
                {
                    DocumentUsers.Remove(documentId);
                }

                // Notify others
                if (user != null)
                {
                    await Clients.Group(documentId).SendAsync("UserLeft", new
                    {
                        userId = userId,
                        displayName = user.DisplayName,
                        username = user.Username,
                        connectionId = connectionId
                    });
                }
            }

            ConnectionToUser.Remove(connectionId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinDocument(string documentId)
    {
        var userId = GetCurrentUserId();
        var connectionId = Context.ConnectionId;

        // Get user info
        var user = await _context.Users.FindAsync(userId);
        if (user == null) return;

        // Add to group
        await Groups.AddToGroupAsync(connectionId, documentId);

        // Track user in document
        if (!DocumentUsers.ContainsKey(documentId))
        {
            DocumentUsers[documentId] = new HashSet<string>();
        }
        DocumentUsers[documentId].Add(connectionId);
        ConnectionToUser[connectionId] = userId;

        // Notify others in the group
        await Clients.OthersInGroup(documentId).SendAsync("UserJoined", new
        {
            userId = userId,
            displayName = user.DisplayName,
            username = user.Username,
            connectionId = connectionId
        });

        // Send current users to the caller
        var currentUsers = new List<object>();
        var seenUserIds = new HashSet<Guid>();
        if (DocumentUsers.ContainsKey(documentId))
        {
            foreach (var connId in DocumentUsers[documentId])
            {
                if (connId != connectionId && ConnectionToUser.TryGetValue(connId, out var otherUserId))
                {
                    // Only add if we haven't seen this user yet
                    if (!seenUserIds.Contains(otherUserId))
                    {
                        seenUserIds.Add(otherUserId);
                        var otherUser = await _context.Users.FindAsync(otherUserId);
                        if (otherUser != null)
                        {
                            currentUsers.Add(new
                            {
                                userId = otherUserId,
                                displayName = otherUser.DisplayName,
                                username = otherUser.Username,
                                connectionId = connId // Use first connection we find for this user
                            });
                        }
                    }
                }
            }
        }

        await Clients.Caller.SendAsync("CurrentUsers", currentUsers);
    }

    public async Task LeaveDocument(string documentId)
    {
        var userId = GetCurrentUserId();
        var connectionId = Context.ConnectionId;

        await Groups.RemoveFromGroupAsync(connectionId, documentId);

        if (DocumentUsers.ContainsKey(documentId))
        {
            DocumentUsers[documentId].Remove(connectionId);

            var user = await _context.Users.FindAsync(userId);
            if (user != null)
            {
                await Clients.Group(documentId).SendAsync("UserLeft", new
                {
                    userId = userId,
                    displayName = user.DisplayName,
                    username = user.Username,
                    connectionId = connectionId
                });
            }
        }
    }

    public async Task SendContentChange(string documentId, string content, int cursorPosition)
    {
        var userId = GetCurrentUserId();
        var user = await _context.Users.FindAsync(userId);

        if (user != null)
        {
            // Broadcast to all others in the document
            await Clients.OthersInGroup(documentId).SendAsync("ReceiveContentChange", new
            {
                content,
                cursorPosition,
                userId = userId,
                displayName = user.DisplayName,
                timestamp = DateTime.UtcNow
            });
        }
    }

    public async Task SendCursorPosition(string documentId, int position)
    {
        var userId = GetCurrentUserId();
        var user = await _context.Users.FindAsync(userId);

        if (user != null)
        {
            await Clients.OthersInGroup(documentId).SendAsync("ReceiveCursorPosition", new
            {
                userId = userId,
                displayName = user.DisplayName,
                username = user.Username,
                position = position
            });
        }
    }
}