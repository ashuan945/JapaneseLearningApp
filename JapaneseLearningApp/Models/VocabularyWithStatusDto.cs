namespace JapaneseLearningApp.Models
{
    public class VocabularyWithStatusDto
    {
        public int Id { get; set; }
        public string JapaneseWord { get; set; } = null!;
        public string? Hiragana { get; set; }
        public string Meaning { get; set; } = null!;
        public string Level { get; set; } = null!;
        public string Status { get; set; } = "new"; // NEW
    }
}
