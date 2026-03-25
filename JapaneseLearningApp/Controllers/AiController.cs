using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;
using JapaneseLearningApp.Models;
using JapaneseLearningApp.Data;

[ApiController]
[Route("api/[controller]")]
public class AiController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly HttpClient _httpClient;
    private readonly string apiKey;

    // Constructor: inject HttpClient, DB context, and config (API key)
    public AiController(IHttpClientFactory factory, AppDbContext context, IConfiguration config)
    {
        _httpClient = factory.CreateClient();
        _context = context;
        apiKey = config["Gemini:ApiKey"];
    }

    // ============================
    // Basic AI Call (No cache)
    // ============================
    // Directly call Gemini API without saving result
    [HttpGet("explain")]
    public async Task<IActionResult> Explain(string word, string hiragana, string meaning, string level)
    {
        var aiResult = await CallGemini(word, hiragana, meaning, level);
        return Ok(aiResult);
    }

    // =====================================================
    // Cached AI (from Database)
    // =====================================================
    // Get explanation from DB if exists, otherwise call AI and store
    [HttpGet("explain/{vocabId}")]
    public async Task<IActionResult> ExplainCached(int vocabId)
    {
        // Check if AI result already exists
        var existing = await _context.VocabularyAi
            .FirstOrDefaultAsync(x => x.VocabularyId == vocabId);

        if (existing != null)
        {
            return Ok(new
            {
                explanation = existing.Explanation,
                examples = JsonSerializer.Deserialize<object>(existing.Examples)
            });
        }

        // Get vocabulary
        var vocab = await _context.Vocabulary.FindAsync(vocabId);

        if (vocab == null)
        {
            return NotFound("Vocabulary not found.");
        }

        // Call Gemini API
        var aiResult = await CallGemini(
            vocab.JapaneseWord,
            vocab.Hiragana,
            vocab.Meaning,
            vocab.Level
        );

        // Save AI result to DB
        var newAi = new VocabularyAi
        {
            VocabularyId = vocabId,
            Explanation = aiResult.Explanation,
            Examples = JsonSerializer.Serialize(aiResult.Examples),
            CreatedAt = DateTime.Now
        };

        _context.VocabularyAi.Add(newAi);
        await _context.SaveChangesAsync();

        return Ok(aiResult);
    }

    // =======================
    // Regenerate AI Result
    // =======================
    // Always call AI again and update DB
    [HttpPost("regenerate/{vocabId}")]
    public async Task<IActionResult> Regenerate(int vocabId)
    {
        // Get vocabulary data
        var vocab = await _context.Vocabulary.FindAsync(vocabId);

        if (vocab == null)
        {
            return NotFound("Vocabulary not found.");
        }

        // Call Gemini API
        var aiResult = await CallGemini(
            vocab.JapaneseWord,
            vocab.Hiragana,
            vocab.Meaning,
            vocab.Level
        );

        // Check if record already exists
        var existing = await _context.VocabularyAi
            .FirstOrDefaultAsync(x => x.VocabularyId == vocabId);

        if (existing != null)
        {
            // Update existing record
            existing.Explanation = aiResult.Explanation;
            existing.Examples = JsonSerializer.Serialize(aiResult.Examples);
            existing.UpdatedAt = DateTime.Now;
        }
        else
        {
            // Insert new record
            var newAi = new VocabularyAi
            {
                VocabularyId = vocabId,
                Explanation = aiResult.Explanation,
                Examples = JsonSerializer.Serialize(aiResult.Examples),
                CreatedAt = DateTime.Now
            };

            _context.VocabularyAi.Add(newAi);
        }
        await _context.SaveChangesAsync();

        // Return fresh AI result
        return Ok(aiResult);
    }

    // ========================
    // Gemini API Call Logic
    // ========================
    private async Task<AiResponse> CallGemini(string word, string hiragana, string meaning, string level)
    {
        // Build AI prompt
        var prompt = $@"
You are a Japanese teacher.

Word: {word}
Reading: {hiragana}
Meaning: {meaning}
Level: {level}

Tasks:
- Simply explain the word in English.
- If there are multiple meanings, explain each briefly.
- Provide example sentences:
  - At least 2 examples.
  - If multiple meanings exist, give at least one example per meaning.
  - Each example must include Japanese + English.

Return ONLY valid JSON in this format:
{{
  ""explanation"": """",
  ""examples"": [
    {{ ""jp"": """", ""en"": """" }}
  ]
}}";

        // Request body for Gemini
        var requestBody = new
        {
            contents = new[]
            {
                new
                {
                    parts = new[]
                    {
                        new { text = prompt }
                    }
                }
            }
        };

        var json = JsonSerializer.Serialize(requestBody);

        // Send request to Gemini API
        var response = await _httpClient.PostAsync(
            $"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key={apiKey}",
            new StringContent(json, Encoding.UTF8, "application/json")
        );

        var result = await response.Content.ReadAsStringAsync();

        Console.WriteLine(result);

        // Handle API failure
        if (!response.IsSuccessStatusCode)
        {
            throw new Exception($"Gemini API failed: {result}");
        }

        // Parse response JSON
        var doc = JsonDocument.Parse(result);

        var text = doc.RootElement
            .GetProperty("candidates")[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString();

        // Clean markdown formatting
        var cleanJson = ExtractJson(text);

        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };

        // Convert to AiResponse object
        return JsonSerializer.Deserialize<AiResponse>(cleanJson, options);
    }


    // =========================
    // Clean AI Response JSON
    // =========================
    // Remove markdown wrappers (```json ... ```)
    private string ExtractJson(string text)
    {
        if (string.IsNullOrEmpty(text)) return "";

        text = text.Replace("```json", "")
                   .Replace("```", "")
                   .Trim();

        return text;
    }
}