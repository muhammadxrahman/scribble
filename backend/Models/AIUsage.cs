namespace ScribbleAPI.Models;
public class AIUsage
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public DateTime Date { get; set; }
    public int CallsToday { get; set; }
    public string Feature { get; set; } = string.Empty;
    
    public User User { get; set; } = null!;
}