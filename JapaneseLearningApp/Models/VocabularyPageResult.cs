using System.Text.Json.Serialization;

namespace JapaneseLearningApp.Models
{
    public class VocabularyPageResult
    {
        [JsonPropertyName("data")]
        public List<Models.VocabularyWithStatusDto> Data { get; set; } = [];

        [JsonPropertyName("totalCount")]
        public int TotalCount { get; set; }

        [JsonPropertyName("totalPages")]
        public int TotalPages { get; set; }

        [JsonPropertyName("currentPage")]
        public int CurrentPage { get; set; }

        [JsonPropertyName("pageSize")]
        public int PageSize { get; set; }
    }
}
