using JapaneseLearningApp.Data;
using JapaneseLearningApp.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JapaneseLearningAPI.Controllers
{
    [Route("api/flashcards")]
    [ApiController]
    public class FlashcardsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public FlashcardsController(AppDbContext context)
        {
            _context = context;
        }

        // Extract userId from JWT token
        private int? GetUserIdFromToken()
        {
            var claim = User.FindFirst("userId");
            return claim == null ? null : int.Parse(claim.Value);
        }

        // =========================
        // Get flashcard for guest
        // =========================
        // GET /api/flashcards/all
        [HttpGet("all")]
        public async Task<IActionResult> GetAll()
        {
            var userId = GetUserIdFromToken();
            var vocabList = await _context.Vocabulary.ToListAsync();

            // Guest mode: return all as "new"
            if (userId == null)
            {
                return Ok(vocabList.Select(v => new {
                    v.Id,
                    v.JapaneseWord,
                    v.Hiragana,
                    v.Meaning,
                    v.Level,
                    Status = "new"
                }));
            }
            // Get user progress
            var progressList = await _context.UserProgress
                .Where(p => p.UserId == userId)
                .ToListAsync();
            // Merge vocabulary with progress
            var result = vocabList.Select(v => {
                var progress = progressList.FirstOrDefault(p => p.VocabularyId == v.Id);
                return new
                {
                    v.Id,
                    v.JapaneseWord,
                    v.Hiragana,
                    v.Meaning,
                    v.Level,
                    Status = progress?.Status ?? "new"
                };
            })
            // Exclude learned words
            .Where(x => x.Status != "learned")
            .ToList();

            return Ok(result);
        }


        // =============================
        // Get flashcard for login user 
        // =============================
        // GET /api/flashcards/by-level?level=N5
        [HttpGet("by-level")]
        public async Task<IActionResult> GetByLevel(string level)
        {
            var userId = GetUserIdFromToken();

            // Filter vocabulary by level
            var vocabList = await _context.Vocabulary
                .Where(v => v.Level == level)
                .ToListAsync();

            // Guest mode: return all as "new"
            if (userId == null)
            {
                return Ok(vocabList.Select(v => new {
                    v.Id,
                    v.JapaneseWord,
                    v.Hiragana,
                    v.Meaning,
                    v.Level,
                    Status = "new"
                }));
            }

            // Get user progress
            var progressList = await _context.UserProgress
                .Where(p => p.UserId == userId)
                .ToListAsync();

            // Merge vocabulary with progress
            var result = vocabList.Select(v => {
                var progress = progressList.FirstOrDefault(p => p.VocabularyId == v.Id);
                return new
                {
                    v.Id,
                    v.JapaneseWord,
                    v.Hiragana,
                    v.Meaning,
                    v.Level,
                    Status = progress?.Status ?? "new"
                };
            })
            // Exclude learned words
            .Where(x => x.Status != "learned")
            .ToList();

            return Ok(result);
        }

        // ===========================
        // Mark flashcard as Learned
        // ===========================
        // Set status to "learned" (unless flagged)
        // POST /api/flashcards/mark-learned
        [Authorize]
        [HttpPost("mark-learned")]
        public async Task<IActionResult> MarkLearned([FromBody] FlashcardActionRequest input)
        {
            var userId = GetUserIdFromToken()!.Value;

            // Find existing progress
            var progress = await _context.UserProgress
                .FirstOrDefaultAsync(p => p.UserId == userId
                                       && p.VocabularyId == input.VocabularyId);

            if (progress == null)
            {
                // Create new progress record
                _context.UserProgress.Add(new UserProgress
                {
                    UserId = userId,
                    VocabularyId = input.VocabularyId,
                    CorrectCount = 0,
                    WrongCount = 0,
                    LastReviewed = DateTime.Now,
                    Status = "learned"
                });
            }
            else
            {
                // Update status (do not override flagged)
                if (progress.Status != "flagged")
                    progress.Status = "learned";
                progress.LastReviewed = DateTime.Now;
            }

            await _context.SaveChangesAsync();
            return Ok();
        }


        // ====================
        // Toggle flag status
        // ====================
        // Switch between "flagged" and "new"
        // POST /api/flashcards/toggle-flag
        [Authorize]
        [HttpPost("toggle-flag")]
        public async Task<IActionResult> ToggleFlag([FromBody] FlashcardActionRequest input)
        {
            var userId = GetUserIdFromToken()!.Value;

            // Find existing progress
            var progress = await _context.UserProgress
                .FirstOrDefaultAsync(p => p.UserId == userId
                                       && p.VocabularyId == input.VocabularyId);

            if (progress == null)
            {
                // Create new flagged record
                progress = new UserProgress
                {
                    UserId = userId,
                    VocabularyId = input.VocabularyId,
                    CorrectCount = 0,
                    WrongCount = 0,
                    LastReviewed = DateTime.Now,
                    Status = "flagged"
                };
                _context.UserProgress.Add(progress);
            }
            else
            {
                // Toggle status
                progress.Status = progress.Status == "flagged" ? "new" : "flagged";
                progress.LastReviewed = DateTime.Now;
            }

            await _context.SaveChangesAsync();
            // Return updated status
            return Ok(new { status = progress.Status });
        }
    }
}