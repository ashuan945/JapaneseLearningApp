using System;

namespace JapaneseLearningApp.Models
{
    public class VocabularyAi
    {
        public int Id { get; set; }
        public int VocabularyId { get; set; }

        public string Explanation { get; set; } = null!;
        public string Examples { get; set; } = null!;

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public Vocabulary Vocabulary { get; set; } = null!;
    }
}