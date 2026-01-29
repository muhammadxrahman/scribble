using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace ScribbleAPI.Hubs;

[Authorize]
public class DocumentHub : Hub
{
    // Track which users are in which documents
    private static readonly Dictionary<string, HashSet<string>> DocumentUsers = new();
    private static readonly Dictionary<string, string> ConnectionToUser = new();

    public override async Task OnConnectedAsync()
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var displayName = Context.User?.FindFirst("displayName")?.Value;
        
        if (userId != null)
        {
            ConnectionToUser[Context.ConnectionId] = userId;
        }
        
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        // Find which document this connection was in
        var connectionId = Context.ConnectionId;
        
        foreach (var (documentId, users) in DocumentUsers)
        {
            if (users.Contains(connectionId))
            {
                users.Remove(connectionId);
                
                // Notify others in the document
                var userId = ConnectionToUser.GetValueOrDefault(connectionId);
                var displayName = Context.User?.FindFirst("displayName")?.Value;
                
                await Clients.Group(documentId).SendAsync("UserLeft", new
                {
                    userId,
                    displayName,
                    connectionId
                });
                
                // If no one left in document, clean up
                if (users.Count == 0)
                {
                    DocumentUsers.Remove(documentId);
                }
                
                break;
            }
        }
        
        ConnectionToUser.Remove(connectionId);
        await base.OnDisconnectedAsync(exception);
    }

    public async Task JoinDocument(string documentId)
    {
        // Add connection to document group
        await Groups.AddToGroupAsync(Context.ConnectionId, documentId);
        
        // Track user in this document
        if (!DocumentUsers.ContainsKey(documentId))
        {
            DocumentUsers[documentId] = new HashSet<string>();
        }
        DocumentUsers[documentId].Add(Context.ConnectionId);
        
        // Get user info
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var displayName = Context.User?.FindFirst("displayName")?.Value;
        
        // Notify others in the document
        await Clients.OthersInGroup(documentId).SendAsync("UserJoined", new
        {
            userId,
            displayName,
            connectionId = Context.ConnectionId
        });
        
        // Send current users to the joining user
        var currentUsers = DocumentUsers[documentId]
            .Where(connId => connId != Context.ConnectionId)
            .Select(connId => new
            {
                userId = ConnectionToUser.GetValueOrDefault(connId),
                displayName = "User", // We'd need to track this better
                connectionId = connId
            })
            .ToList();
        
        await Clients.Caller.SendAsync("CurrentUsers", currentUsers);
    }

    public async Task LeaveDocument(string documentId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, documentId);
        
        if (DocumentUsers.ContainsKey(documentId))
        {
            DocumentUsers[documentId].Remove(Context.ConnectionId);
            
            var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var displayName = Context.User?.FindFirst("displayName")?.Value;
            
            await Clients.Group(documentId).SendAsync("UserLeft", new
            {
                userId,
                displayName,
                connectionId = Context.ConnectionId
            });
        }
    }

    public async Task SendContentChange(string documentId, string content, int cursorPosition)
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var displayName = Context.User?.FindFirst("displayName")?.Value;
        
        // Broadcast to all others in the document
        await Clients.OthersInGroup(documentId).SendAsync("ReceiveContentChange", new
        {
            content,
            cursorPosition,
            userId,
            displayName,
            timestamp = DateTime.UtcNow
        });
    }

    public async Task SendCursorPosition(string documentId, int position)
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var displayName = Context.User?.FindFirst("displayName")?.Value;
        
        await Clients.OthersInGroup(documentId).SendAsync("ReceiveCursorPosition", new
        {
            userId,
            displayName,
            position
        });
    }
}