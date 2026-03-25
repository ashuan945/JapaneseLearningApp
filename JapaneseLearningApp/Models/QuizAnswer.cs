using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace JapaneseLearningApp.Models
{
    public class QuizAnswer
    {

        [Required]
        public int VocabularyId { get; set; }  // Vocab Id

        //[ForeignKey("VocabularyId")]
        //public Vocabulary Vocabulary { get; set; } = null!;
        //[Required]
        public string SelectedAnswer { get; set; } = null!; // user choice
    }
}
