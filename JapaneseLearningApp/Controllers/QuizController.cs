using JapaneseLearningApp.Data;
using JapaneseLearningApp.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JapaneseLearningAPI.Controllers
{
    [Route("api/quiz")]
    [ApiController]
    public class QuizController : ControllerBase
    {
        private readonly AppDbContext _context;

        public QuizController(AppDbContext context)
        {
            _context = context;
        }

        private int? GetUserIdFromToken()
        {
            var claim = User.FindFirst("userId");
            return claim == null ? null : int.Parse(claim.Value);
        }


        // =====================================================
        // Generate quiz
        // =====================================================
        // Returns random quiz questions with options
        // GET /api/quiz/{count}?level=N4
        [HttpGet("{count}")]
        public async Task<IActionResult> GetQuiz(int count, string? level = null)
        {
            var query = _context.Vocabulary.AsQueryable();
            // Optional filter by level
            if (!string.IsNullOrEmpty(level))
                query = query.Where(x => x.Level == level);

            var allVocab = await query.ToListAsync();
            // No data → return empty list
            if (!allVocab.Any())
                return Ok(new List<QuizQuestion>());

            // Randomly select questions
            var random = new Random();
            var selected = allVocab.OrderBy(x => random.Next()).Take(count).ToList();

            var quiz = new List<QuizQuestion>();
            foreach (var word in selected)
            {
                // Generate 3 wrong answers
                var wrongAnswers = allVocab
                    .Where(v => v.Id != word.Id)
                    .OrderBy(x => random.Next())
                    .Take(3)
                    .Select(v => v.Meaning)
                    .ToList();

                // Combine correct + wrong answers and shuffle
                var options = wrongAnswers
                    .Append(word.Meaning)
                    .OrderBy(x => random.Next())
                    .ToArray();

                // Build question
                quiz.Add(new QuizQuestion
                {
                    VocabularyId = word.Id,
                    JapaneseWord = word.JapaneseWord,
                    Options = options,
                    Answer = word.Meaning
                });
            }

            return Ok(quiz);
        }


        // =====================================================
        // Submit answer
        // =====================================================
        // Validate answer + update user progress (if logged in)
        // POST /api/quiz/submit
        [HttpPost("submit")]
        public async Task<IActionResult> SubmitAnswer([FromBody] QuizAnswer answer)
        {
            // Get vocabulary
            var vocab = await _context.Vocabulary
                .FirstOrDefaultAsync(v => v.Id == answer.VocabularyId);

            if (vocab == null)
                return BadRequest("Vocabulary not found");

            // Only track progress if logged in
            var userId = GetUserIdFromToken();
            if (userId.HasValue)
            {
                var progress = await _context.UserProgress
                    .FirstOrDefaultAsync(up =>
                        up.UserId == userId.Value &&
                        up.VocabularyId == answer.VocabularyId);

                if (progress == null)
                {
                    // Create new progress record
                    progress = new UserProgress
                    {
                        UserId = userId.Value,
                        VocabularyId = answer.VocabularyId,
                        CorrectCount = 0,
                        WrongCount = 0,
                        LastReviewed = DateTime.Now
                    };
                    _context.UserProgress.Add(progress);
                }

                // Update correct / wrong count
                if (answer.SelectedAnswer == vocab.Meaning)
                    progress.CorrectCount++;
                else
                    progress.WrongCount++;

                progress.LastReviewed = DateTime.Now;
                await _context.SaveChangesAsync();
            }

            // Return result
            return Ok(new
            {
                CorrectAnswer = vocab.Meaning,
                IsCorrect = answer.SelectedAnswer == vocab.Meaning
            });
        }
    }
}