using JapaneseLearningApp.Data;
using JapaneseLearningApp.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JapaneseLearningAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserProgressController : ControllerBase
    {
        private readonly AppDbContext _context;
        public UserProgressController(AppDbContext context)
        {
            _context = context;
        }

        // =========================================================
        // Helper: Extract UserId from JWT Token
        // =========================================================
        private int GetUserIdFromToken()
        {
            var claim = User.FindFirst("userId");
            if (claim == null)
                throw new Exception("UserId not found in token");
            return int.Parse(claim.Value);
        }

        // =========================================================
        // GET USER PROGRESS
        // GET: /api/userprogress/{userId}
        // =========================================================
        [HttpGet("{userId}")]
        public async Task<IActionResult> GetProgress(int userId)
        {
            var progress = await _context.UserProgress
                .Where(up => up.UserId == userId)
                .ToListAsync();
            return Ok(progress);
        }

        // =========================================================
        // UPDATE VOCABULARY STATUS
        // PUT: /api/userprogress/status
        // =========================================================
        [Authorize]
        [HttpPut("status")]
        public async Task<IActionResult> UpdateStatus([FromBody] UpdateStatusRequest request)
        {
            // Get userId from JWT (not from request body for security)
            var userId = GetUserIdFromToken();

            // Find existing progress record
            var progress = await _context.UserProgress
                .FirstOrDefaultAsync(p => p.UserId == userId
                                       && p.VocabularyId == request.VocabularyId);

            if (progress == null)
            {
                // Create new record if not exists
                progress = new UserProgress
                {
                    UserId = userId,
                    VocabularyId = request.VocabularyId,
                    Status = request.Status,
                    CorrectCount = 0,
                    WrongCount = 0,
                    LastReviewed = DateTime.Now
                };
                _context.UserProgress.Add(progress);
            }
            else
            {
                // Update existing record
                progress.Status = request.Status;
                progress.LastReviewed = DateTime.Now;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Status updated" });
        }
    }
}
