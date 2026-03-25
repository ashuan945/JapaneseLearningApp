using JapaneseLearningApp.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JapaneseLearningApp.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DashboardController : ControllerBase
    {
        private readonly AppDbContext _context;

        // Constructor: inject database context
        public DashboardController(AppDbContext context)
        {
            _context = context;
        }

        // Extract userId from JWT token
        private int? GetUserIdFromToken()
        {
            var claim = User.FindFirst("userId");
            return claim == null ? null : int.Parse(claim.Value);
        }

        // ====================
        // GET DASHBOARD DATA
        // ====================
        // Returns overall stats + accuracy (+ breakdown by level)
        [Authorize]
        [HttpGet]
        public async Task<IActionResult> GetDashboard(string? level = null)
        {
            // Get current user ID
            var userId = GetUserIdFromToken()!.Value;

            // Base query: user progress
            var query = _context.UserProgress
                .Where(up => up.UserId == userId);

            // Optional filter by JLPT level
            if (!string.IsNullOrWhiteSpace(level))
                query = query.Where(up => up.Vocabulary.Level == level);

            // Aggregate total correct & wrong answers
            var result = await query
                .GroupBy(up => up.UserId)
                .Select(g => new
                {
                    TotalCorrect = g.Sum(p => p.CorrectCount),
                    TotalWrong = g.Sum(p => p.WrongCount)
                })
                .FirstOrDefaultAsync();

            // Calculate totals, accuracy
            int correct = result?.TotalCorrect ?? 0;
            int wrong = result?.TotalWrong ?? 0;
            int total = correct + wrong;
            double accuracy = total == 0 ? 0 : Math.Round((double)correct / total * 100, 2);

            // Breakdown by level (only if no filter)
            List<object> byLevel = [];
            if (string.IsNullOrWhiteSpace(level))
            {
                byLevel = await _context.UserProgress
                    .Where(up => up.UserId == userId)
                    .GroupBy(up => up.Vocabulary.Level)
                    .Select(g => new
                    {
                        Level = g.Key,
                        Correct = g.Sum(p => p.CorrectCount),
                        Wrong = g.Sum(p => p.WrongCount)
                    })
                    .ToListAsync()
                    // Convert to accuracy per level
                    .ContinueWith(t => t.Result.Select(x =>
                    {
                        int t2 = x.Correct + x.Wrong;
                        return (object)new
                        {
                            level = x.Level,
                            accuracy = t2 == 0 ? 0 : Math.Round((double)x.Correct / t2 * 100, 2)
                        };
                    }).ToList());
            }
            // Return dashboard data
            return Ok(new { total, correct, wrong, accuracy, byLevel });
        }
    }
}