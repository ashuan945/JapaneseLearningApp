namespace JapaneseLearningApp.Models
{
    public class QuizQuestion
    {
        public int VocabularyId { get; set; }
        public string JapaneseWord { get; set; } = null!;
        public string[] Options { get; set; } = null!;
        public string Answer { get; set; } = null!;
    }
}
