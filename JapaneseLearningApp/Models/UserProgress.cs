using Microsoft.AspNetCore.Mvc.ModelBinding.Validation;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace JapaneseLearningApp.Models
{
    public class UserProgress
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [ForeignKey("UserId")]
        [ValidateNever]
        public User User { get; set; } = null!;

        [Required]
        public int VocabularyId { get; set; } 

        [ForeignKey("VocabularyId")]
        [ValidateNever]
        public Vocabulary Vocabulary { get; set; } = null!;

        public int CorrectCount { get; set; } = 0;

        public int WrongCount { get; set; } = 0;

        public DateTime? LastReviewed { get; set; }

        public string Status { get; set; } = "new";
    }
}
