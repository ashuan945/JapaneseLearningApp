using JapaneseLearningApp.Data;
using JapaneseLearningApp.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Text;

namespace JapaneseLearningApp.Pages.Vocabulary
{
    public class IndexModel(AppDbContext context, IConfiguration config) : PageModel
    {
        private readonly AppDbContext _context = context;
        private readonly IConfiguration _config = config;

        public static readonly List<string> Levels = ["ALL", "N5", "N4", "N3", "N2", "N1"];

        [BindProperty(SupportsGet = true)]
        public string? Level { get; set; } = "ALL";

        [BindProperty(SupportsGet = true)]
        public int PageNumber { get; set; } = 1;

        [BindProperty(SupportsGet = true)]
        public string? Search { get; set; }

        [BindProperty(SupportsGet = true)]
        public string? SelectedStatus { get; set; } = "ALL";

        public List<VocabularyWithStatusDto> VocabularyList { get; set; } = [];
        public int TotalCount { get; set; }
        public int TotalPages { get; set; }
        public int CurrentPage { get; set; } = 1;
        public string SelectedLevel { get; set; } = "ALL";
        public bool IsLoggedIn { get; set; } = false;

        public async Task OnGetAsync()
        {
            SelectedLevel = string.IsNullOrWhiteSpace(Level) ? "ALL" : Level.ToUpper();
            if (PageNumber < 1) PageNumber = 1;

            var levelParam = SelectedLevel;
            var searchParam = Search?.Trim() ?? "";
            var statusParam = string.IsNullOrWhiteSpace(SelectedStatus) ? "ALL" : SelectedStatus.ToLower();

            // Read userId from HttpOnly JWT cookie
            int? userId = GetUserIdFromCookie();

            // NEW: validate user existence
            if (userId.HasValue)
            {
                var exists = await _context.Users.AnyAsync(u => u.Id == userId.Value);
                if (!exists)
                {
                    userId = null; // treat as guest
                }
            }

            IsLoggedIn = userId.HasValue;

            var query = _context.Vocabulary.AsQueryable();

            if (levelParam != "ALL")
                query = query.Where(v => v.Level == levelParam);

            if (!string.IsNullOrWhiteSpace(searchParam))
                query = query.Where(v =>
                    EF.Functions.Like(v.JapaneseWord, $"%{searchParam}%") ||
                    EF.Functions.Like(v.Hiragana, $"%{searchParam}%") ||
                    EF.Functions.Like(v.Meaning, $"%{searchParam}%")
                );

            if (!IsLoggedIn)
            {
                TotalCount = await query.CountAsync();
                TotalPages = (int)Math.Ceiling(TotalCount / 20.0);
                CurrentPage = PageNumber;

                VocabularyList = await query
                    .OrderByDescending(v => v.Level)
                    .ThenBy(v => v.JapaneseWord)
                    .Skip((PageNumber - 1) * 20)
                    .Take(20)
                    .Select(v => new VocabularyWithStatusDto
                    {
                        Id = v.Id,
                        JapaneseWord = v.JapaneseWord,
                        Hiragana = v.Hiragana,
                        Meaning = v.Meaning,
                        Level = v.Level,
                        Status = "new"
                    })
                    .ToListAsync();
            }
            else
            {
                var uid = userId!.Value;

                var joinedQuery =
                    from v in query
                    join p in _context.UserProgress
                        on new { VocabId = v.Id, UserId = uid }
                        equals new { VocabId = p.VocabularyId, p.UserId }
                        into prog
                    from p in prog.DefaultIfEmpty()
                    select new
                    {
                        v.Id,
                        v.JapaneseWord,
                        v.Hiragana,
                        v.Meaning,
                        v.Level,
                        Status = p != null ? p.Status : "new"
                    };

                if (statusParam != "all")
                    joinedQuery = joinedQuery.Where(x => x.Status == statusParam);

                TotalCount = await joinedQuery.CountAsync();
                TotalPages = (int)Math.Ceiling(TotalCount / 20.0);
                CurrentPage = PageNumber;

                VocabularyList = await joinedQuery
                    .OrderByDescending(x => x.Level)
                    .ThenBy(x => x.JapaneseWord)
                    .Skip((PageNumber - 1) * 20)
                    .Take(20)
                    .Select(x => new VocabularyWithStatusDto
                    {
                        Id = x.Id,
                        JapaneseWord = x.JapaneseWord,
                        Hiragana = x.Hiragana,
                        Meaning = x.Meaning,
                        Level = x.Level,
                        Status = x.Status
                    })
                    .ToListAsync();
            }
        }

        private int? GetUserIdFromCookie()
        {
            if (!Request.Cookies.TryGetValue("auth_token", out var token)
                || string.IsNullOrEmpty(token))
                return null;

            try
            {
                var key = new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));

                var handler = new JwtSecurityTokenHandler();
                handler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = key,
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ClockSkew = TimeSpan.Zero
                }, out var validated);

                var jwt = (JwtSecurityToken)validated;
                var claim = jwt.Claims.FirstOrDefault(c => c.Type == "userId");
                return claim == null ? null : int.Parse(claim.Value);
            }
            catch
            {
                Response.Cookies.Delete("auth_token");
                return null;
            }
        }
    }
}