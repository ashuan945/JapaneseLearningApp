using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace JapaneseLearningApp.Models
{
    [Table("Vocabulary")]
    public class Vocabulary
    {
        [Key]
        public int Id { get; set; }
        public string JapaneseWord { get; set; } = null!;
        public string? Hiragana { get; set; }
        public string Meaning { get; set; } = null!;
        public string Level { get; set; } = null!;
    }
}
