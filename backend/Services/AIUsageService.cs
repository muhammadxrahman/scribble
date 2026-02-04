using Microsoft.EntityFrameworkCore;
using ScribbleAPI.Data;
using ScribbleAPI.Models;

public class AIUsageService
{
    private readonly ApplicationDbContext _context;
    private const int DailyLimit = 5;
    
    public AIUsageService(ApplicationDbContext context)
    {
        _context = context;
    }
    
    public async Task<bool> CanUseAIFeature(Guid userId)
    {
        var today = DateTime.UtcNow.Date;
        
        var usage = await _context.AIUsage
            .FirstOrDefaultAsync(u => u.UserId == userId && u.Date == today);
        
        if (usage == null)
        {
            return true; // First call today
        }
        
        return usage.CallsToday < DailyLimit;
    }
    
    public async Task<int> GetRemainingCalls(Guid userId)
    {
        var today = DateTime.UtcNow.Date;
        
        var usage = await _context.AIUsage
            .FirstOrDefaultAsync(u => u.UserId == userId && u.Date == today);
        
        if (usage == null)
        {
            return DailyLimit;
        }
        
        return Math.Max(0, DailyLimit - usage.CallsToday);
    }
    
    public async Task IncrementUsage(Guid userId, string feature)
    {
        var today = DateTime.UtcNow.Date;
        
        var usage = await _context.AIUsage
            .FirstOrDefaultAsync(u => u.UserId == userId && u.Date == today);
        
        if (usage == null)
        {
            usage = new AIUsage
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Date = today,
                CallsToday = 1,
                Feature = feature
            };
            _context.AIUsage.Add(usage);
        }
        else
        {
            usage.CallsToday++;
        }
        
        await _context.SaveChangesAsync();
    }
}