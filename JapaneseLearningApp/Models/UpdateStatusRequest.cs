namespace JapaneseLearningApp.Models
{
    public class UpdateStatusRequest
    {
        public int VocabularyId { get; set; }
        public string Status { get; set; } = "new";
    }
}
