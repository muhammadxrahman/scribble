using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class AIController : ControllerBase
{
    private readonly AIService _aiService;
    private readonly AIUsageService _usageService;
    
    public AIController(AIService aiService, AIUsageService usageService)
    {
        _aiService = aiService;
        _usageService = usageService;
    }
    
    private Guid GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return Guid.Parse(userIdClaim!);
    }
    
    [HttpGet("remaining")]
    public async Task<IActionResult> GetRemainingCalls()
    {
        var userId = GetCurrentUserId();
        var remaining = await _usageService.GetRemainingCalls(userId);
        
        return Ok(new { remaining, limit = 5 });
    }
    
    [HttpPost("grammar")]
    public async Task<IActionResult> GrammarCheck([FromBody] AIRequest request)
    {
        var userId = GetCurrentUserId();
        
        // Check rate limit
        if (!await _usageService.CanUseAIFeature(userId))
        {
            return StatusCode(429, new { 
                error = "Daily AI limit reached. You have 5 free calls per day." 
            });
        }
        
        // Call AI service
        var result = await _aiService.GrammarCheck(request.Text);
        
        if (result == null)
        {
            return StatusCode(500, new { error = "AI service unavailable" });
        }
        
        // Increment usage
        await _usageService.IncrementUsage(userId, "grammar");
        
        // Get remaining calls
        var remaining = await _usageService.GetRemainingCalls(userId);
        
        return Ok(new { 
            result = result.Result,
            remaining 
        });
    }
}

public class AIRequest
{
    public string Text { get; set; } = string.Empty;
}