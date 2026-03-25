using JapaneseLearningApp.Data;
using JapaneseLearningApp.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace JapaneseLearningAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class VocabularyController : ControllerBase
    {
        private readonly AppDbContext _context;

        public VocabularyController(AppDbContext context)
        {
            _context = context;
        }

        // =========================================================
        // Helper: Get UserId from JWT Token
        // =========================================================
        private int GetUserIdFromToken()
        {
            var claim = User.FindFirst("userId");

            if (claim == null)
                throw new Exception("UserId not found in token");

            return int.Parse(claim.Value);
        }

        // =========================================================
        // PUBLIC API (Guest - No Authentication)
        // GET: /api/vocabulary/guest
        // =========================================================
        [HttpGet("guest")]
        public async Task<IActionResult> GetGuestVocabulary(
            [FromQuery] string? level = null,
            [FromQuery] string? search = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 40) pageSize = 20;

            var query = _context.Vocabulary.AsQueryable();

            // Filter by level
            if (!string.IsNullOrWhiteSpace(level) && level.ToUpper() != "ALL")
            {
                query = query.Where(v => v.Level.ToUpper() == level.ToUpper());
            }

            // Search filter
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                query = query.Where(v =>
                    EF.Functions.Like(v.JapaneseWord, $"%{s}%") ||
                    EF.Functions.Like(v.Hiragana, $"%{s}%") ||
                    EF.Functions.Like(v.Meaning, $"%{s}%")
                );
            }

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            var data = await query
                .OrderByDescending(v => v.Level)
                .ThenBy(v => v.JapaneseWord)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new
            {
                Data = data,
                TotalCount = totalCount,
                TotalPages = totalPages,
                CurrentPage = page,
                PageSize = pageSize
            });
        }

        // =========================================================
        // AUTHENTICATED API
        // GET: /api/vocabulary
        // Returns vocabulary WITH user progress status
        // =========================================================
        [Authorize]
        [HttpGet]
        public async Task<IActionResult> GetVocabularyWithStatus(
            [FromQuery] string? level = null,
            [FromQuery] string? search = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            var userId = GetUserIdFromToken();

            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 40) pageSize = 20;

            var query = _context.Vocabulary.AsQueryable();

            // Filter by level
            var levelParam = level?.Trim().ToUpper();
            if (!string.IsNullOrWhiteSpace(levelParam) && levelParam != "ALL")
            {
                query = query.Where(v => v.Level == levelParam);
            }

            // Search filter
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                query = query.Where(v =>
                    EF.Functions.Like(v.JapaneseWord, $"%{s}%") ||
                    EF.Functions.Like(v.Hiragana, $"%{s}%") ||
                    EF.Functions.Like(v.Meaning, $"%{s}%")
                );
            }

            var totalCount = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

            // Join vocabulary with user progress
            var data = await (
                from v in query
                join p in _context.UserProgress
                    on new { VocabId = v.Id, UserId = userId }
                    equals new { VocabId = p.VocabularyId, p.UserId }
                    into prog
                from p in prog.DefaultIfEmpty()
                orderby v.Level descending, v.JapaneseWord
                select new VocabularyWithStatusDto
                {
                    Id = v.Id,
                    JapaneseWord = v.JapaneseWord,
                    Hiragana = v.Hiragana,
                    Meaning = v.Meaning,
                    Level = v.Level,
                    Status = p != null ? p.Status : "new"
                })
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new
            {
                Data = data,
                TotalCount = totalCount,
                TotalPages = totalPages,
                CurrentPage = page,
                PageSize = pageSize
            });
        }

        // =========================================================
        // AUTHENTICATED API
        // Reset vocabulary status for current user
        // PUT: /api/vocabulary/reset?level=N4
        // =========================================================
        [Authorize]
        [HttpPut("reset")]
        public async Task<IActionResult> ResetStatus([FromQuery] string? level = null)
        {
            var userId = GetUserIdFromToken();

            var query = _context.UserProgress
                .Where(x => x.UserId == userId);

            // If level is specified, filter by vocabulary level
            if (!string.IsNullOrWhiteSpace(level) && level.ToUpper() != "ALL")
            {
                query = query.Where(x => x.Vocabulary.Level == level.ToUpper());
            }

            var records = await query.ToListAsync();

            // Reset status to "new"
            foreach (var r in records)
            {
                r.Status = "new";
                r.LastReviewed = null;
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Reset successful" });
        }
    }
}