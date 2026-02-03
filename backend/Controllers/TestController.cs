using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/[controller]")]
public class TestController : ControllerBase
{
    private readonly HttpClient _httpClient;

    public TestController(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    [HttpGet("ai-health")]
    public async Task<IActionResult> TestAIService()
    {
        try
        {
            var aiServiceUrl = Environment.GetEnvironmentVariable("AI_SERVICE_URL");
            
            var response = await _httpClient.GetAsync($"{aiServiceUrl}/health");
            var content = await response.Content.ReadAsStringAsync();
            
            return Ok(new { 
                status = "success",
                aiServiceResponse = content,
                aiServiceUrl = aiServiceUrl
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { 
                status = "error", 
                message = ex.Message 
            });
        }
    }
}