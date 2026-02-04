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
            return StatusCode(429, new
            {
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

        return Ok(new
        {
            result = result.Result,
            remaining
        });
    }

    [HttpPost("summarize")]
    public async Task<IActionResult> Summarize([FromBody] AIRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();

            // Check rate limit
            if (!await _usageService.CanUseAIFeature(userId))
            {
                return StatusCode(429, new
                {
                    error = "Daily AI limit reached. You have 5 free calls per day."
                });
            }

            // Call AI service
            var result = await _aiService.Summarize(request.Text);

            if (result == null)
            {
                return StatusCode(500, new { error = "AI service unavailable" });
            }

            // Increment usage
            await _usageService.IncrementUsage(userId, "summarize");

            // Get remaining calls
            var remaining = await _usageService.GetRemainingCalls(userId);

            return Ok(new
            {
                result = result.Result,
                remaining
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] /api/ai/summarize failed: {ex.Message}");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("improve")]
    public async Task<IActionResult> ImproveWriting([FromBody] AIRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();

            // Check rate limit
            if (!await _usageService.CanUseAIFeature(userId))
            {
                return StatusCode(429, new
                {
                    error = "Daily AI limit reached. You have 5 free calls per day."
                });
            }

            // Call AI service
            var result = await _aiService.ImproveWriting(request.Text);

            if (result == null)
            {
                return StatusCode(500, new { error = "AI service unavailable" });
            }

            // Increment usage
            await _usageService.IncrementUsage(userId, "improve");

            // Get remaining calls
            var remaining = await _usageService.GetRemainingCalls(userId);

            return Ok(new
            {
                result = result.Result,
                remaining
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] /api/ai/improve failed: {ex.Message}");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("generate")]
    public async Task<IActionResult> ContinueWriting([FromBody] AIRequest request)
    {
        try
        {
            var userId = GetCurrentUserId();

            // Check rate limit
            if (!await _usageService.CanUseAIFeature(userId))
            {
                return StatusCode(429, new
                {
                    error = "Daily AI limit reached. You have 5 free calls per day."
                });
            }

            // Call AI service
            var result = await _aiService.ContinueWriting(request.Text);

            if (result == null)
            {
                return StatusCode(500, new { error = "AI service unavailable" });
            }

            // Increment usage
            await _usageService.IncrementUsage(userId, "generate");

            // Get remaining calls
            var remaining = await _usageService.GetRemainingCalls(userId);

            return Ok(new
            {
                result = result.Result,
                remaining
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] /api/ai/generate failed: {ex.Message}");
            return StatusCode(500, new { error = ex.Message });
        }
    }
}

public class AIRequest
{
    public string Text { get; set; } = string.Empty;
}