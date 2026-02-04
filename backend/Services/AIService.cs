using System.Text.Json;

public class AIService
{
    private readonly HttpClient _httpClient;
    private readonly string _aiServiceUrl;
    
    public AIService(HttpClient httpClient, IConfiguration config)
    {
        _httpClient = httpClient;
        _aiServiceUrl = config["AI_SERVICE_URL"]
        ?? throw new InvalidOperationException(
                "AI_SERVICE_URL environment variable is not configured"
            );
    }
    
    public async Task<AIResponse?> GrammarCheck(string text)
    {
        try
        {
            var response = await _httpClient.PostAsJsonAsync(
                $"{_aiServiceUrl}/grammar",
                new { text }
            );
            
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadFromJsonAsync<AIResponse>();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[ERROR] AI Service grammar check failed: {ex.Message}");
            return null;
        }
    }
}

public class AIResponse
{
    public string Result { get; set; } = string.Empty;
    public Dictionary<string, int> Usage { get; set; } = new();
}