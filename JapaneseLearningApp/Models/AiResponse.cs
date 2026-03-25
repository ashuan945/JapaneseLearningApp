using System.Text.Json.Serialization;

namespace JapaneseLearningApp.Models
{
    public class AiResponse
    {
        [JsonPropertyName("explanation")]
        public string Explanation { get; set; } = null!;
        [JsonPropertyName("examples")]
        public List<Example> Examples { get; set; } = null!;
    }

    public class Example
    {
        [JsonPropertyName("jp")]
        public string Jp { get; set; } = null!;
        [JsonPropertyName("en")]
        public string En { get; set; } = null!;
    }
}
